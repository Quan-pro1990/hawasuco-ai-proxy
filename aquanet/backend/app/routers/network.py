from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import LineString, MultiPolygon, Polygon, shape
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..geo import bbox_filter, feature_collection, geojson_to_geom, sql_geom, to_feature
from ..models import Customer, Node, Pipe, Zone
from ..schemas import NodeIn, NodeUpdate, PipeIn, PipeUpdate, ZoneIn
from ..security import get_current_user, require_editor
from ..services.topology import connect_pipe, isolation_report, next_code, split_pipe_at_node

router = APIRouter(prefix="/api", tags=["Mạng lưới"], dependencies=[Depends(get_current_user)])


def _zone_at(db: Session, geom) -> int | None:
    return db.scalar(select(Zone.id).where(func.ST_Intersects(Zone.geom, geom)).limit(1))


def _get(db: Session, model, oid: int):
    obj = db.get(model, oid)
    if not obj:
        raise HTTPException(404, "Không tìm thấy đối tượng")
    return obj


# ============================================================ Vùng (DMA)
@router.get("/zones")
def list_zones(db: Session = Depends(get_db)):
    return feature_collection(db.scalars(select(Zone).order_by(Zone.code)).all())


@router.post("/zones", dependencies=[Depends(require_editor)])
def create_zone(data: ZoneIn, db: Session = Depends(get_db)):
    g = shape(data.geometry)
    if isinstance(g, Polygon):
        g = MultiPolygon([g])
    z = Zone(code=data.code, name=data.name, note=data.note, geom=from_shape(g, srid=4326))
    db.add(z)
    db.commit()
    return to_feature(z)


@router.delete("/zones/{zid}", dependencies=[Depends(require_editor)])
def delete_zone(zid: int, db: Session = Depends(get_db)):
    db.delete(_get(db, Zone, zid))
    db.commit()
    return {"ok": True}


# ============================================================ Nút / thiết bị
@router.get("/nodes")
def list_nodes(
    bbox: str | None = None,
    node_type: str | None = Query(None, description="Lọc theo loại, nhiều loại cách nhau bởi dấu phẩy"),
    zone_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = select(Node)
    if (f := bbox_filter(Node.geom, bbox)) is not None:
        q = q.where(f)
    if node_type:
        q = q.where(Node.node_type.in_(node_type.split(",")))
    if zone_id:
        q = q.where(Node.zone_id == zone_id)
    return feature_collection(db.scalars(q.order_by(Node.id)).all())


@router.get("/nodes/{nid}")
def get_node(nid: int, db: Session = Depends(get_db)):
    n = _get(db, Node, nid)
    pipes = db.scalars(select(Pipe).where(or_(Pipe.start_node_id == nid, Pipe.end_node_id == nid))).all()
    return to_feature(n, {"connected_pipes": [{"id": p.id, "code": p.code, "diameter_mm": p.diameter_mm} for p in pipes]})


@router.post("/nodes", dependencies=[Depends(require_editor)])
def create_node(data: NodeIn, split: bool = True, snap_m: float | None = Query(None, ge=0, le=50),
                db: Session = Depends(get_db)):
    geom = geojson_to_geom(data.geometry)
    payload = data.model_dump(exclude={"geometry"})
    payload["code"] = payload["code"] or next_code(db, Node, {"valve": "V", "hydrant": "H"}.get(data.node_type, "N"))
    if data.node_type != "valve" and payload["status"] == "open":
        payload["status"] = "active"
    n = Node(**payload, geom=geom)
    if n.zone_id is None:
        n.zone_id = _zone_at(db, sql_geom(data.geometry))
    db.add(n)
    db.flush()
    split_info = []
    if split:  # đặt van/thiết bị lên giữa ống -> tự tách ống
        split_info = [p.code for p in split_pipe_at_node(db, n, tol_m=snap_m)]
    db.commit()
    return to_feature(n, {"split_pipes": split_info})


@router.put("/nodes/{nid}", dependencies=[Depends(require_editor)])
def update_node(nid: int, data: NodeUpdate, db: Session = Depends(get_db)):
    n = _get(db, Node, nid)
    for k, v in data.model_dump(exclude_unset=True, exclude={"geometry"}).items():
        setattr(n, k, v)
    if data.geometry:
        n.geom = geojson_to_geom(data.geometry)
        pt = shape(data.geometry)
        # kéo theo đầu mút các ống nối vào nút (giữ topology)
        for p in db.scalars(select(Pipe).where(or_(Pipe.start_node_id == nid, Pipe.end_node_id == nid))):
            coords = list(to_shape(p.geom).coords)
            if p.start_node_id == nid:
                coords[0] = (pt.x, pt.y)
            if p.end_node_id == nid:
                coords[-1] = (pt.x, pt.y)
            p.geom = from_shape(LineString(coords), srid=4326)
            db.flush()
            p.length_m = round(float(db.scalar(select(func.ST_Length(func.Geography(Pipe.geom))).where(Pipe.id == p.id))), 2)
    db.commit()
    return to_feature(n)


@router.delete("/nodes/{nid}", dependencies=[Depends(require_editor)])
def delete_node(nid: int, db: Session = Depends(get_db)):
    n = _get(db, Node, nid)
    cnt = db.scalar(select(func.count()).select_from(Pipe).where(or_(Pipe.start_node_id == nid, Pipe.end_node_id == nid)))
    if cnt:
        raise HTTPException(409, f"Nút đang nối với {cnt} ống – hãy xóa hoặc nối lại ống trước")
    db.delete(n)
    db.commit()
    return {"ok": True}


# ============================================================ Đường ống
@router.get("/pipes")
def list_pipes(
    bbox: str | None = None,
    material: str | None = None,
    min_diameter: int | None = None,
    zone_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = select(Pipe)
    if (f := bbox_filter(Pipe.geom, bbox)) is not None:
        q = q.where(f)
    if material:
        q = q.where(Pipe.material.in_(material.split(",")))
    if min_diameter:
        q = q.where(Pipe.diameter_mm >= min_diameter)
    if zone_id:
        q = q.where(Pipe.zone_id == zone_id)
    return feature_collection(db.scalars(q.order_by(Pipe.id)).all())


@router.get("/pipes/{pid}")
def get_pipe(pid: int, db: Session = Depends(get_db)):
    p = _get(db, Pipe, pid)
    n_cust = db.scalar(select(func.count()).select_from(Customer).where(Customer.pipe_id == pid))
    from ..models import Incident

    n_inc = db.scalar(select(func.count()).select_from(Incident).where(Incident.pipe_id == pid))
    return to_feature(p, {"customer_count": n_cust, "incident_count": n_inc})


@router.post("/pipes", dependencies=[Depends(require_editor)])
def create_pipe(data: PipeIn, snap_m: float | None = Query(None, ge=0, le=50,
                description="Dung sai bắt điểm đầu/cuối ống (m)"), db: Session = Depends(get_db)):
    g = shape(data.geometry)
    if g.geom_type != "LineString" or len(g.coords) < 2:
        raise HTTPException(422, "Hình học ống phải là LineString có ít nhất 2 điểm")
    payload = data.model_dump(exclude={"geometry"})
    payload["code"] = payload["code"] or next_code(db, Pipe, "P")
    p = Pipe(**payload, geom=from_shape(g, srid=4326))
    if p.zone_id is None:
        p.zone_id = _zone_at(db, func.ST_LineInterpolatePoint(func.ST_GeomFromText(g.wkt, 4326), 0.5))
    db.add(p)
    db.flush()
    connect_pipe(db, p, snap_m)
    db.commit()
    return to_feature(p)


@router.put("/pipes/{pid}", dependencies=[Depends(require_editor)])
def update_pipe(pid: int, data: PipeUpdate, db: Session = Depends(get_db)):
    p = _get(db, Pipe, pid)
    for k, v in data.model_dump(exclude_unset=True, exclude={"geometry"}).items():
        setattr(p, k, v)
    if data.geometry:
        p.geom = geojson_to_geom(data.geometry)
        db.flush()
        connect_pipe(db, p)
    db.commit()
    return to_feature(p)


@router.delete("/pipes/{pid}", dependencies=[Depends(require_editor)])
def delete_pipe(pid: int, db: Session = Depends(get_db)):
    p = _get(db, Pipe, pid)
    ends = [p.start_node_id, p.end_node_id]
    db.delete(p)
    db.flush()
    # dọn nút nối mồ côi
    for nid in ends:
        n = db.get(Node, nid) if nid else None
        if n and n.node_type == "junction":
            cnt = db.scalar(select(func.count()).select_from(Pipe).where(or_(Pipe.start_node_id == nid, Pipe.end_node_id == nid)))
            if not cnt:
                db.delete(n)
    db.commit()
    return {"ok": True}


# ============================================================ Phân tích
@router.get("/network/isolate")
def isolate(pipe_id: int, db: Session = Depends(get_db)):
    """Phân tích cô lập: van cần đóng, đoạn mất nước, khách hàng bị ảnh hưởng."""
    _get(db, Pipe, pipe_id)
    try:
        return isolation_report(db, pipe_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/network/nearest-pipe")
def nearest_pipe(lon: float, lat: float, max_m: float = 50, db: Session = Depends(get_db)):
    pt = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    row = db.execute(
        select(Pipe, func.ST_Distance(func.Geography(Pipe.geom), func.Geography(pt)).label("d"))
        .where(func.ST_DWithin(func.Geography(Pipe.geom), func.Geography(pt), max_m))
        .order_by("d").limit(1)
    ).first()
    if not row:
        return None
    return to_feature(row[0], {"distance_m": round(row[1], 1)})


@router.get("/network/validate")
def validate(db: Session = Depends(get_db)):
    """Kiểm tra lỗi topology: ống chưa nối nút, nút treo, ống quá ngắn."""
    unconnected = db.scalars(select(Pipe.code).where(or_(Pipe.start_node_id.is_(None), Pipe.end_node_id.is_(None)))).all()
    short = db.scalars(select(Pipe.code).where(Pipe.length_m < 0.5)).all()
    deg = (
        select(Node.id, Node.code, Node.node_type,
               func.count(Pipe.id).label("deg"))
        .outerjoin(Pipe, or_(Pipe.start_node_id == Node.id, Pipe.end_node_id == Node.id))
        .group_by(Node.id)
    ).subquery()
    orphan = db.execute(select(deg.c.code, deg.c.node_type).where(deg.c.deg == 0)).all()
    return {
        "unconnected_pipes": unconnected,
        "short_pipes": short,
        "orphan_nodes": [{"code": c, "type": t} for c, t in orphan],
    }


@router.get("/search")
def search(q: str, db: Session = Depends(get_db)):
    like = f"%{q}%"
    out = []
    for n in db.scalars(select(Node).where(or_(Node.code.ilike(like), Node.address.ilike(like))).limit(8)):
        out.append({"layer": "node", "id": n.id, "label": f"{n.code} ({n.node_type})", "geometry": to_feature(n)["geometry"]})
    for p in db.scalars(select(Pipe).where(or_(Pipe.code.ilike(like), Pipe.street.ilike(like))).limit(8)):
        out.append({"layer": "pipe", "id": p.id, "label": f"{p.code} – {p.street or ''} D{p.diameter_mm}",
                    "geometry": to_feature(p)["geometry"]})
    for c in db.scalars(select(Customer).where(or_(Customer.code.ilike(like), Customer.name.ilike(like),
                                                   Customer.address.ilike(like))).limit(8)):
        out.append({"layer": "customer", "id": c.id, "label": f"{c.code} – {c.name}",
                    "geometry": to_feature(c)["geometry"]})
    return out
