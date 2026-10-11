"""Xuất mạng lưới sang tệp EPANET 2.2 (.inp) để mô phỏng thủy lực.

Quy ước chuyển đổi mô hình GIS -> EPANET:
- Nút nối, trụ cứu hỏa, đồng hồ tổng -> JUNCTION (cao độ = elevation_m, thiếu thì 0 và cảnh báo).
- Nhà máy / nguồn -> RESERVOIR, cột nước = cao độ + áp lực đầu nguồn (tham số).
- Bể chứa -> TANK (mực nước mặc định ghi chú trong tệp, cần hiệu chỉnh theo thực tế).
- Van nằm giữa 2 ống -> tách thành 2 junction nối bằng một VALVE kiểu TCV (hệ số tổn thất 0).
  Van đang đóng được ghi ở mục [STATUS] là Closed. Van chỉ nối 1 ống được giữ làm junction.
- Trạm bơm nằm giữa 2 ống -> PUMP (công suất mặc định). Phía hút là phía gần nguồn hơn.
- Ống -> PIPE, hệ số nhám Hazen–Williams theo vật liệu, giảm dần theo tuổi với ống kim loại.
- Nhu cầu nước: tiêu thụ trung bình N kỳ gần nhất của khách hàng (đã ghi chỉ số), chia đều cho 2
  nút đầu ống đấu nối; mẫu dùng nước theo giờ trong ngày (pattern 1).
- Xuất theo một DMA: nút biên còn nối với ống ngoài vùng (trừ van đang đóng) -> RESERVOIR
  (biên cột nước cố định) để mô hình tự giải được.
"""
import re
from collections import defaultdict, deque
from datetime import date, datetime
from math import hypot

from shapely import from_wkb
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..models import Customer, Meter, MeterReading, Node, Pipe, Zone
from .telemetry import DIURNAL

HW_C = {"HDPE": 140, "PPR": 140, "UPVC": 145, "DI": 130, "STEEL": 120, "CI": 110, "AC": 130}
AGING = {"CI": 1.2, "STEEL": 1.0, "DI": 0.4}  # C giảm mỗi năm tuổi (ống kim loại bị đóng cặn, ăn mòn)
C_MIN = 60
TANK_DEFAULT = {"init": 3.0, "min": 0.5, "max": 5.0, "diam": 25.0}
PUMP_POWER_KW = 30
SUPPLY = ("source", "tank")
M3_MONTH_TO_LPS = 1000 / (30.44 * 86400)


def hw_roughness(material: str | None, install_year: int | None, year: int | None = None) -> float:
    mat = (material or "").upper()
    c = HW_C.get(mat, 130)
    if install_year and mat in AGING:
        c -= AGING[mat] * max(0, (year or date.today().year) - install_year)
    return float(max(C_MIN, round(c)))


class _Ids:
    """Mã EPANET: tối đa 31 ký tự, không khoảng trắng/dấu ;. Nút và link là 2 không gian tên riêng."""

    def __init__(self):
        self.used = {"node": set(), "link": set()}

    def make(self, kind: str, raw: str) -> str:
        base = re.sub(r"[\s;\"]+", "_", str(raw)).strip("_")[:31] or kind
        cand, k = base, 1
        while cand in self.used[kind]:
            k += 1
            suf = f"~{k}"
            cand = base[: 31 - len(suf)] + suf
        self.used[kind].add(cand)
        return cand


def _months_back(n: int) -> str:
    d = date.today()
    y, m = d.year, d.month - n
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}"


def _auto_utm(db: Session) -> int:
    lon, lat = db.execute(text("SELECT ST_X(c), ST_Y(c) FROM (SELECT ST_Centroid(ST_Extent(geom)) c FROM nodes) t")).one()
    if lon is None:
        return 32648  # WGS 84 / UTM 48N (miền Nam – Trung Bộ)
    return (32600 if lat >= 0 else 32700) + int((lon + 180) // 6) + 1


def build_inp(db: Session, zone_id: int | None = None, include_planned: bool = False,
              source_pressure_m: float = 40.0, srid: int | None = None, demand_months: int = 3,
              pump_power_kw: float = PUMP_POWER_KW) -> tuple[str, dict]:
    warnings: list[str] = []
    srid = srid or _auto_utm(db)
    if not db.scalar(text("SELECT 1 FROM spatial_ref_sys WHERE srid = :s"), {"s": srid}):
        raise ValueError(f"Không có hệ tọa độ EPSG:{srid} trong PostGIS")

    statuses = ["active", "planned"] if include_planned else ["active"]
    all_pipes = db.execute(
        select(Pipe.id, Pipe.code, Pipe.start_node_id, Pipe.end_node_id, Pipe.length_m, Pipe.diameter_mm,
               Pipe.material, Pipe.install_year, Pipe.zone_id,
               func.ST_AsBinary(func.ST_Transform(Pipe.geom, srid)).label("wkb"))
        .where(Pipe.status.in_(statuses)).order_by(Pipe.id)
    ).all()
    pipes = []
    for p in all_pipes:
        if zone_id and p.zone_id != zone_id:
            continue
        if p.start_node_id is None or p.end_node_id is None:
            warnings.append(f"Ống {p.code} chưa nối topology – bỏ qua")
            continue
        if p.start_node_id == p.end_node_id:
            warnings.append(f"Ống {p.code} có 2 đầu trùng một nút – bỏ qua")
            continue
        pipes.append(p)
    if not pipes:
        raise ValueError("Không có đường ống nào để xuất")

    adj: dict[int, list] = defaultdict(list)
    for p in pipes:
        adj[p.start_node_id].append(p)
        adj[p.end_node_id].append(p)
    nodes = {n.id: n for n in db.execute(
        select(Node.id, Node.code, Node.node_type, Node.status, Node.elevation_m, Node.diameter_mm,
               func.ST_X(func.ST_Transform(Node.geom, srid)).label("x"),
               func.ST_Y(func.ST_Transform(Node.geom, srid)).label("y"))
        .where(Node.id.in_(list(adj)))
    ).all()}

    # nút biên khi xuất theo DMA
    boundary: set[int] = set()
    if zone_id:
        inside = {p.id for p in pipes}
        for p in all_pipes:
            if p.id in inside:
                continue
            for nid in (p.start_node_id, p.end_node_id):
                if nid in nodes and not (nodes[nid].node_type == "valve" and nodes[nid].status == "closed"):
                    boundary.add(nid)

    # khoảng cách (số cạnh) tới nguồn – xác định chiều trạm bơm
    dist: dict[int, int] = {}
    q = deque()
    for nid, n in nodes.items():
        if n.node_type in SUPPLY or nid in boundary:
            dist[nid] = 0
            q.append(nid)
    while q:
        nid = q.popleft()
        for p in adj[nid]:
            m = p.end_node_id if p.start_node_id == nid else p.start_node_id
            if m not in dist:
                dist[m] = dist[nid] + 1
                q.append(m)

    # cụm mạng không nối tới nguồn/bể (ống mồ côi, số hóa dở) làm EPANET báo lỗi 110 – loại ra
    if dist:
        islands = [p for p in pipes if p.start_node_id not in dist]
        if islands:
            warnings.append(f"{len(islands)} ống thuộc cụm mạng không nối với nguồn/bể – bỏ qua "
                            f"(vd. {', '.join(p.code for p in islands[:5])})")
            pipes = [p for p in pipes if p.start_node_id in dist]
            adj = defaultdict(list)
            for p in pipes:
                adj[p.start_node_id].append(p)
                adj[p.end_node_id].append(p)
            nodes = {nid: n for nid, n in nodes.items() if nid in adj}

    ids = _Ids()
    pipe_wkb = {p.id: from_wkb(p.wkb) for p in pipes}
    junctions: dict[str, dict] = {}
    reservoirs: dict[str, dict] = {}
    tanks: dict[str, dict] = {}
    coords: dict[str, tuple[float, float]] = {}
    endpoint: dict[tuple[int, int], str] = {}
    valves, pumps, status_lines = [], [], []
    missing_elev = 0

    def toward(p, nid: int, n) -> tuple[float, float]:
        """Điểm cách nút 0,5 m dọc theo ống p (đặt junction phía sau van/bơm cho dễ nhìn)."""
        cs = list(pipe_wkb[p.id].coords)
        if p.end_node_id == nid:
            cs.reverse()
        (x0, y0), (x1, y1) = (n.x, n.y), cs[1] if len(cs) > 1 else cs[0]
        d = hypot(x1 - x0, y1 - y0)
        t = min(0.5, d / 2) / d if d else 0
        return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t

    for nid, n in sorted(nodes.items()):
        elev = n.elevation_m
        if elev is None and n.node_type not in SUPPLY:
            missing_elev += 1
        elev = float(elev or 0)
        links_here = sorted(adj[nid], key=lambda p: p.id)
        if nid in boundary or n.node_type == "source":
            eid = ids.make("node", n.code)
            reservoirs[eid] = {"head": elev + source_pressure_m}
        elif n.node_type == "tank":
            eid = ids.make("node", n.code)
            tanks[eid] = {"elev": elev, **TANK_DEFAULT}
        elif n.node_type in ("valve", "pump") and len(links_here) == 2:
            pa, pb = links_here
            if n.node_type == "pump":
                da = dist.get(pa.end_node_id if pa.start_node_id == nid else pa.start_node_id, 10**9)
                db_ = dist.get(pb.end_node_id if pb.start_node_id == nid else pb.start_node_id, 10**9)
                if db_ < da:
                    pa, pb = pb, pa  # pa: phía hút (gần nguồn)
            a = ids.make("node", n.code)
            b = ids.make("node", f"{n.code}_{'D' if n.node_type == 'pump' else 'B'}")
            junctions[a] = {"elev": elev, "demand": 0.0}
            junctions[b] = {"elev": elev, "demand": 0.0}
            coords[a] = (n.x, n.y)
            coords[b] = toward(pb, nid, n)
            endpoint[(pa.id, nid)], endpoint[(pb.id, nid)] = a, b
            lid = ids.make("link", n.code)
            if n.node_type == "valve":
                dn = n.diameter_mm or max(pa.diameter_mm or 0, pb.diameter_mm or 0) or 100
                valves.append((lid, a, b, dn))
                if n.status == "closed":
                    status_lines.append((lid, "Closed"))
            else:
                pumps.append((lid, a, b))
            continue
        else:
            eid = ids.make("node", n.code)
            junctions[eid] = {"elev": elev, "demand": 0.0}
        coords[eid] = (n.x, n.y)
        for p in links_here:
            endpoint[(p.id, nid)] = eid

    # ---- nhu cầu nước từ tiêu thụ khách hàng
    sub = (select(Meter.customer_id, func.avg(MeterReading.consumption).label("avg"))
           .join(Meter, Meter.id == MeterReading.meter_id)
           .where(MeterReading.period >= _months_back(demand_months), MeterReading.consumption > 0)
           .group_by(Meter.customer_id).subquery())
    demand_rows = db.execute(
        select(Customer.pipe_id, func.sum(sub.c.avg)).join(sub, sub.c.customer_id == Customer.id)
        .where(Customer.pipe_id.isnot(None), Customer.status == "active").group_by(Customer.pipe_id)
    ).all()
    pipe_by_id = {p.id: p for p in pipes}
    total_demand, dropped = 0.0, 0.0
    for pid, m3 in demand_rows:
        p = pipe_by_id.get(pid)
        if p is None or not m3:
            continue
        lps = float(m3) * M3_MONTH_TO_LPS
        ends = [endpoint[(p.id, p.start_node_id)], endpoint[(p.id, p.end_node_id)]]
        ends = [e for e in ends if e in junctions]
        if not ends:
            dropped += lps
            continue
        for e in ends:
            junctions[e]["demand"] += lps / len(ends)
        total_demand += lps
    if dropped:
        warnings.append(f"{dropped:.3f} L/s nhu cầu nằm trên ống nối thẳng nguồn/bể – không gán được")
    if missing_elev:
        warnings.append(f"{missing_elev} nút chưa có cao độ (elevation_m) – tạm lấy 0 m")
    if not reservoirs and not tanks:
        warnings.append("Mạng không có nguồn hoặc bể chứa – EPANET sẽ không giải được")
    if tanks:
        warnings.append("Bể chứa dùng mực nước mặc định (ban đầu 3 m, 0,5–5 m, đường kính 25 m) – cần hiệu chỉnh")

    # ---- ghi tệp
    zone_name = db.scalar(select(Zone.name).where(Zone.id == zone_id)) if zone_id else None
    year = date.today().year
    L: list[str] = []
    w = L.append
    w("[TITLE]")
    w(f"AquaNet GIS – {'DMA ' + zone_name if zone_name else 'Toàn mạng lưới'}")
    w(f"Xuất lúc {datetime.now():%Y-%m-%d %H:%M}, tọa độ EPSG:{srid}, nhu cầu TB {demand_months} kỳ gần nhất")
    w("")
    w("[JUNCTIONS]")
    w(";ID                              \tElev    \tDemand    \tPattern")
    for k, v in junctions.items():
        w(f" {k:<32}\t{v['elev']:<8.2f}\t{v['demand']:<10.5f}\t1")
    w("")
    w("[RESERVOIRS]")
    w(";ID                              \tHead    \tPattern")
    for k, v in reservoirs.items():
        w(f" {k:<32}\t{v['head']:<8.2f}\t")
    w("")
    w("[TANKS]")
    w(";ID                              \tElevation\tInitLevel\tMinLevel\tMaxLevel\tDiameter\tMinVol\tVolCurve")
    for k, v in tanks.items():
        w(f" {k:<32}\t{v['elev']:<8.2f}\t{v['init']}\t{v['min']}\t{v['max']}\t{v['diam']}\t0\t")
    w("")
    w("[PIPES]")
    w(";ID                              \tNode1                           \tNode2                           \tLength  \tDiameter\tRoughness\tMinorLoss\tStatus")
    pipe_ids = {}
    for p in pipes:
        lid = ids.make("link", p.code)
        pipe_ids[p.id] = lid
        n1, n2 = endpoint[(p.id, p.start_node_id)], endpoint[(p.id, p.end_node_id)]
        length = max(0.1, float(p.length_m or 0))
        w(f" {lid:<32}\t{n1:<32}\t{n2:<32}\t{length:<8.2f}\t{p.diameter_mm or 100:<8}\t"
          f"{hw_roughness(p.material, p.install_year, year):<9}\t0\tOpen")
    w("")
    w("[PUMPS]")
    w(";ID                              \tNode1                           \tNode2                           \tParameters")
    for lid, a, b in pumps:
        w(f" {lid:<32}\t{a:<32}\t{b:<32}\tPOWER {pump_power_kw:g}")
    w("")
    w("[VALVES]")
    w(";ID                              \tNode1                           \tNode2                           \tDiameter\tType\tSetting\tMinorLoss")
    for lid, a, b, dn in valves:
        w(f" {lid:<32}\t{a:<32}\t{b:<32}\t{dn:<8}\tTCV \t0      \t0")
    w("")
    w("[TAGS]")
    for p in pipes:
        if p.material:
            w(f" LINK\t{pipe_ids[p.id]}\t{p.material}")
    w("")
    w("[DEMANDS]")
    w("")
    w("[STATUS]")
    for lid, st in status_lines:
        w(f" {lid:<32}\t{st}")
    w("")
    w("[PATTERNS]")
    w(";Hệ số dùng nước theo giờ (0h–23h)")
    for i in range(0, 24, 6):
        w(" 1\t" + "\t".join(f"{v:.3f}" for v in DIURNAL[i:i + 6]))
    w("")
    w("[CURVES]")
    w("")
    w("[CONTROLS]")
    w("")
    w("[RULES]")
    w("")
    w("[ENERGY]")
    w(" Global Efficiency  \t75")
    w(" Global Price       \t0")
    w(" Demand Charge      \t0")
    w("")
    w("[EMITTERS]")
    w("")
    w("[QUALITY]")
    w("")
    w("[SOURCES]")
    w("")
    w("[REACTIONS]")
    w("")
    w("[MIXING]")
    w("")
    w("[TIMES]")
    for k, v in (("Duration", "24:00"), ("Hydraulic Timestep", "1:00"), ("Quality Timestep", "0:05"),
                 ("Pattern Timestep", "1:00"), ("Pattern Start", "0:00"), ("Report Timestep", "1:00"),
                 ("Report Start", "0:00"), ("Start ClockTime", "12 am"), ("Statistic", "NONE")):
        w(f" {k:<20}\t{v}")
    w("")
    w("[REPORT]")
    w(" Status             \tNo")
    w(" Summary            \tNo")
    w(" Page               \t0")
    w("")
    w("[OPTIONS]")
    for k, v in (("Units", "LPS"), ("Headloss", "H-W"), ("Specific Gravity", "1.0"), ("Viscosity", "1.0"),
                 ("Trials", "40"), ("Accuracy", "0.001"), ("CHECKFREQ", "2"), ("MAXCHECK", "10"),
                 ("DAMPLIMIT", "0"), ("Unbalanced", "Continue 10"), ("Pattern", "1"),
                 ("Demand Multiplier", "1.0"), ("Emitter Exponent", "0.5"), ("Quality", "None mg/L"),
                 ("Diffusivity", "1.0"), ("Tolerance", "0.01")):
        w(f" {k:<20}\t{v}")
    w("")
    w("[COORDINATES]")
    w(";Node                            \tX-Coord           \tY-Coord")
    for k, (x, y) in coords.items():
        w(f" {k:<32}\t{x:<18.3f}\t{y:.3f}")
    w("")
    w("[VERTICES]")
    w(";Link                            \tX-Coord           \tY-Coord")
    for p in pipes:
        cs = list(pipe_wkb[p.id].coords)[1:-1]
        for x, y in cs:
            w(f" {pipe_ids[p.id]:<32}\t{x:<18.3f}\t{y:.3f}")
    w("")
    w("[LABELS]")
    w("")
    w("[BACKDROP]")
    w(" UNITS Meters")
    w("")
    w("[END]")

    stats = {
        "srid": srid, "zone_id": zone_id, "zone_name": zone_name,
        "junctions": len(junctions), "reservoirs": len(reservoirs), "tanks": len(tanks),
        "pipes": len(pipes), "valves": len(valves), "closed_valves": len(status_lines), "pumps": len(pumps),
        "total_demand_lps": round(total_demand, 3), "warnings": warnings,
    }
    return "\n".join(L) + "\n", stats
