"""Topology mạng lưới: bắt điểm, tách ống, phân tích cô lập van.

Mô hình đồ thị: mỗi Pipe là một cạnh nối hai Node. Van (valve) là nút có
trạng thái open/closed; van đóng chặn dòng chảy qua nút đó.
"""
from collections import defaultdict, deque

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import LineString, Point, mapping
from shapely.ops import linemerge, unary_union
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Customer, Node, Pipe

SUPPLY_TYPES = {"source", "tank"}


# ---------------------------------------------------------------- mã tự động
def next_code(db: Session, model, prefix: str) -> str:
    n = db.scalar(select(func.count()).select_from(model)) or 0
    while True:
        n += 1
        code = f"{prefix}{n:05d}"
        if not db.scalar(select(model.id).where(model.code == code)):
            return code


# ---------------------------------------------------------------- bắt điểm
def find_node_near(db: Session, lon: float, lat: float, tol_m: float | None = None) -> Node | None:
    tol = tol_m if tol_m is not None else settings.SNAP_TOLERANCE_M
    pt = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return db.scalars(
        select(Node)
        .where(func.ST_DWithin(func.Geography(Node.geom), func.Geography(pt), tol))
        .order_by(func.ST_Distance(func.Geography(Node.geom), func.Geography(pt)))
        .limit(1)
    ).first()


def snap_or_create_node(db: Session, lon: float, lat: float, zone_id: int | None = None,
                        tol_m: float | None = None, exclude_pipe: int | None = None) -> Node:
    """Bắt vào nút gần nhất; nếu không có nhưng gần thân ống khác -> tạo nút nối và tách ống (nối chữ T)."""
    node = find_node_near(db, lon, lat, tol_m)
    if node:
        return node
    node = Node(
        code=next_code(db, Node, "N"),
        node_type="junction",
        status="open",
        zone_id=zone_id,
        geom=from_shape(Point(lon, lat), srid=4326),
    )
    db.add(node)
    db.flush()
    split_pipe_at_node(db, node, tol_m=tol_m, exclude_pipe=exclude_pipe)
    return node


def connect_pipe(db: Session, pipe: Pipe, tol_m: float | None = None) -> None:
    """Gắn nút đầu/cuối cho ống, nắn đầu mút trùng tọa độ nút, tính chiều dài."""
    line: LineString = to_shape(pipe.geom)
    coords = list(line.coords)
    a = snap_or_create_node(db, coords[0][0], coords[0][1], pipe.zone_id, tol_m, pipe.id)
    b = snap_or_create_node(db, coords[-1][0], coords[-1][1], pipe.zone_id, tol_m, pipe.id)
    pa, pb = to_shape(a.geom), to_shape(b.geom)
    coords[0] = (pa.x, pa.y)
    coords[-1] = (pb.x, pb.y)
    pipe.geom = from_shape(LineString(coords), srid=4326)
    pipe.start_node_id, pipe.end_node_id = a.id, b.id
    db.flush()
    pipe.length_m = round(
        float(db.scalar(select(func.ST_Length(func.Geography(Pipe.geom))).where(Pipe.id == pipe.id)) or 0), 2)


def split_pipe_at_node(db: Session, node: Node, tol_m: float | None = None,
                       exclude_pipe: int | None = None) -> list[Pipe]:
    """Nếu nút nằm giữa một ống (trong dung sai), tách ống đó thành 2 đoạn."""
    pt = to_shape(node.geom)
    g = func.ST_SetSRID(func.ST_MakePoint(pt.x, pt.y), 4326)
    q = (
        select(Pipe)
        .where(func.ST_DWithin(func.Geography(Pipe.geom), func.Geography(g), tol_m or settings.SNAP_TOLERANCE_M))
        .where(func.coalesce(Pipe.start_node_id, 0) != node.id, func.coalesce(Pipe.end_node_id, 0) != node.id)
        .order_by(func.ST_Distance(func.Geography(Pipe.geom), func.Geography(g)))
        .limit(1)
    )
    if exclude_pipe:
        q = q.where(Pipe.id != exclude_pipe)
    pipe = db.scalars(q).first()
    if not pipe:
        return []
    line: LineString = to_shape(pipe.geom)
    d = line.project(pt)
    if d <= 1e-9 or d >= line.length - 1e-9:
        return []
    pt = line.interpolate(d)  # chiếu nút lên đúng tuyến ống
    # cắt hình học
    coords = list(line.coords)
    first, second, acc = [coords[0]], [], 0.0
    for i in range(1, len(coords)):
        seg = LineString([coords[i - 1], coords[i]])
        if not second and acc + seg.length >= d:
            first.append((pt.x, pt.y))
            second = [(pt.x, pt.y), coords[i]]
        elif second:
            second.append(coords[i])
        else:
            first.append(coords[i])
        acc += seg.length
    # dịch nút về đúng vị trí trên ống
    node.geom = from_shape(Point(pt.x, pt.y), srid=4326)
    old_end = pipe.end_node_id
    pipe.geom = from_shape(LineString(first), srid=4326)
    pipe.end_node_id = node.id
    new_pipe = Pipe(
        code=next_code(db, Pipe, "P"),
        material=pipe.material,
        diameter_mm=pipe.diameter_mm,
        install_year=pipe.install_year,
        status=pipe.status,
        pipe_class=pipe.pipe_class,
        zone_id=pipe.zone_id,
        street=pipe.street,
        note=pipe.note,
        start_node_id=node.id,
        end_node_id=old_end,
        geom=from_shape(LineString(second), srid=4326),
    )
    db.add(new_pipe)
    db.flush()
    for p in (pipe, new_pipe):
        p.length_m = round(float(db.scalar(select(func.ST_Length(func.Geography(Pipe.geom))).where(Pipe.id == p.id))), 2)
    # khách hàng gắn ống cũ: gán lại theo đoạn gần nhất
    for c in db.scalars(select(Customer).where(Customer.pipe_id == pipe.id, Customer.geom.isnot(None))):
        cp = to_shape(c.geom)
        if LineString(second).distance(cp) < LineString(first).distance(cp):
            c.pipe_id = new_pipe.id
    return [pipe, new_pipe]


# ---------------------------------------------------------------- đồ thị
class NetworkGraph:
    def __init__(self, db: Session):
        self.nodes: dict[int, tuple[str, str, str]] = {
            r.id: (r.node_type, r.status, r.code)
            for r in db.execute(select(Node.id, Node.node_type, Node.status, Node.code))
        }
        self.pipes: dict[int, tuple[int, int]] = {}
        self.adj: dict[int, list[int]] = defaultdict(list)  # node -> [pipe]
        for r in db.execute(
            select(Pipe.id, Pipe.start_node_id, Pipe.end_node_id).where(Pipe.status == "active")
        ):
            if r.start_node_id is None or r.end_node_id is None:
                continue
            self.pipes[r.id] = (r.start_node_id, r.end_node_id)
            self.adj[r.start_node_id].append(r.id)
            self.adj[r.end_node_id].append(r.id)

    def is_valve(self, nid: int) -> bool:
        return self.nodes.get(nid, ("",))[0] == "valve"

    def is_closed_valve(self, nid: int) -> bool:
        t = self.nodes.get(nid)
        return bool(t and t[0] == "valve" and t[1] == "closed")

    def isolate(self, pipe_id: int) -> dict:
        """Tìm tập van cần đóng để cô lập đoạn ống bị sự cố."""
        if pipe_id not in self.pipes:
            raise ValueError("Ống không tồn tại hoặc chưa nối topology / không hoạt động")
        seg_pipes: set[int] = {pipe_id}
        seg_nodes: set[int] = set()
        valves: set[int] = set()
        supply_hits: set[int] = set()
        q = deque(self.pipes[pipe_id])
        visited: set[int] = set()
        while q:
            nid = q.popleft()
            if nid in visited:
                continue
            visited.add(nid)
            if self.is_valve(nid):
                if not self.is_closed_valve(nid):
                    valves.add(nid)
                continue
            seg_nodes.add(nid)
            if self.nodes.get(nid, ("",))[0] in SUPPLY_TYPES:
                supply_hits.add(nid)
            for pid in self.adj[nid]:
                if pid not in seg_pipes:
                    seg_pipes.add(pid)
                    a, b = self.pipes[pid]
                    q.extend((a, b))

        # Sau khi đóng van: phần mạng nào mất kết nối với nguồn?
        blocked = valves | {n for n in self.nodes if self.is_closed_valve(n)}
        sources = [n for n, t in self.nodes.items() if t[0] in SUPPLY_TYPES and n not in seg_nodes]
        reach_pipes: set[int] = set()
        seen: set[int] = set(sources)
        q = deque(sources)
        while q:
            nid = q.popleft()
            for pid in self.adj[nid]:
                if pid in seg_pipes or pid in reach_pipes:
                    continue
                reach_pipes.add(pid)
                for m in self.pipes[pid]:
                    if m not in seen and m not in blocked:
                        seen.add(m)
                        q.append(m)
        downstream = set(self.pipes) - reach_pipes - seg_pipes if sources else set()
        return {
            "pipe_id": pipe_id,
            "valves": sorted(valves),
            "segment_pipes": sorted(seg_pipes),
            "downstream_pipes": sorted(downstream),
            "segment_nodes": sorted(seg_nodes),
            "warnings": (
                ["Đoạn sự cố nối trực tiếp nguồn/bể chứa – không cô lập được hoàn toàn bằng van"]
                if supply_hits else []
            )
            + ([] if valves else ["Không tìm thấy van nào bao quanh đoạn ống"]),
        }


def _merge(geoms):
    if not geoms:
        return None
    u = unary_union(geoms)
    return mapping(linemerge(u) if u.geom_type == "MultiLineString" else u)


def isolation_report(db: Session, pipe_id: int) -> dict:
    g = NetworkGraph(db)
    res = g.isolate(pipe_id)
    affected = set(res["segment_pipes"]) | set(res["downstream_pipes"])
    valves = db.scalars(select(Node).where(Node.id.in_(res["valves"]))).all() if res["valves"] else []
    pipes = db.scalars(select(Pipe).where(Pipe.id.in_(affected))).all() if affected else []
    customers = (
        db.scalars(select(Customer).where(Customer.pipe_id.in_(affected))).all() if affected else []
    )
    seg_geom = [to_shape(p.geom) for p in pipes if p.id in set(res["segment_pipes"])]
    down_geom = [to_shape(p.geom) for p in pipes if p.id in set(res["downstream_pipes"])]
    return {
        **res,
        "valve_list": [
            {"id": v.id, "code": v.code, "geometry": mapping(to_shape(v.geom)), "diameter_mm": v.diameter_mm}
            for v in valves
        ],
        "segment_length_m": round(sum(p.length_m or 0 for p in pipes if p.id in set(res["segment_pipes"])), 1),
        "downstream_length_m": round(sum(p.length_m or 0 for p in pipes if p.id in set(res["downstream_pipes"])), 1),
        "affected_customers": len(customers),
        "customer_list": [{"id": c.id, "code": c.code, "name": c.name, "phone": c.phone, "address": c.address}
                          for c in customers[:500]],
        "segment_geometry": _merge(seg_geom),
        "downstream_geometry": mapping(unary_union(down_geom)) if down_geom else None,
    }
