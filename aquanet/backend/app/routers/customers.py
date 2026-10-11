from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..geo import feature_collection, geojson_to_geom, geom_to_geojson, row_props, sql_geom
from ..models import Customer, Meter, MeterReading, Pipe, Zone, ZoneInflow
from ..schemas import CustomerIn, CustomerUpdate, InflowIn, MeterIn, ReadingIn
from ..security import get_current_user, require_editor
from ..services.topology import next_code

router = APIRouter(prefix="/api", tags=["Khách hàng & đồng hồ"], dependencies=[Depends(get_current_user)])


def _cust_dict(c: Customer, full: bool = False) -> dict:
    d = row_props(c)
    d["geometry"] = geom_to_geojson(c.geom)
    if full:
        d["meters"] = []
        for m in c.meters:
            md = row_props(m)
            md["readings"] = [row_props(r) for r in m.readings[-24:]]
            d["meters"].append(md)
    return d


def _auto_link(db: Session, c: Customer):
    if c.geom is None:
        return
    g = sql_geom(c.geom)
    if c.pipe_id is None:  # đấu nối vào ống phân phối gần nhất
        c.pipe_id = db.scalar(
            select(Pipe.id).where(Pipe.status == "active")
            .order_by(func.ST_Distance(func.Geography(Pipe.geom), func.Geography(g))).limit(1)
        )
    if c.zone_id is None:
        c.zone_id = db.scalar(select(Zone.id).where(func.ST_Intersects(Zone.geom, g)).limit(1))


# ============================================================ Khách hàng
@router.get("/customers")
def list_customers(q: str | None = None, zone_id: int | None = None, pipe_id: int | None = None,
                   page: int = 1, size: int = 50, db: Session = Depends(get_db)):
    stmt = select(Customer)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Customer.code.ilike(like), Customer.name.ilike(like),
                              Customer.address.ilike(like), Customer.phone.ilike(like)))
    if zone_id:
        stmt = stmt.where(Customer.zone_id == zone_id)
    if pipe_id:
        stmt = stmt.where(Customer.pipe_id == pipe_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Customer.code).offset((page - 1) * size).limit(size)).all()
    return {"total": total, "page": page, "size": size, "items": [_cust_dict(c) for c in rows]}


@router.get("/customers/geojson")
def customers_geojson(db: Session = Depends(get_db)):
    return feature_collection(db.scalars(select(Customer).where(Customer.geom.isnot(None))).all())


@router.get("/customers/{cid}")
def get_customer(cid: int, db: Session = Depends(get_db)):
    c = db.scalars(select(Customer).options(selectinload(Customer.meters).selectinload(Meter.readings))
                   .where(Customer.id == cid)).first()
    if not c:
        raise HTTPException(404, "Không tìm thấy khách hàng")
    return _cust_dict(c, full=True)


@router.post("/customers", dependencies=[Depends(require_editor)])
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    payload = data.model_dump(exclude={"geometry"})
    payload["code"] = payload["code"] or next_code(db, Customer, "KH")
    if db.scalar(select(Customer.id).where(Customer.code == payload["code"])):
        raise HTTPException(400, "Mã khách hàng đã tồn tại")
    c = Customer(**payload, geom=geojson_to_geom(data.geometry) if data.geometry else None)
    _auto_link(db, c)
    db.add(c)
    db.commit()
    return _cust_dict(c)


@router.put("/customers/{cid}", dependencies=[Depends(require_editor)])
def update_customer(cid: int, data: CustomerUpdate, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(404, "Không tìm thấy khách hàng")
    for k, v in data.model_dump(exclude_unset=True, exclude={"geometry"}).items():
        setattr(c, k, v)
    if data.geometry:
        c.geom = geojson_to_geom(data.geometry)
        if "pipe_id" not in data.model_fields_set:
            c.pipe_id = None
        _auto_link(db, c)
    db.commit()
    return _cust_dict(c)


@router.delete("/customers/{cid}", dependencies=[Depends(require_editor)])
def delete_customer(cid: int, db: Session = Depends(get_db)):
    c = db.get(Customer, cid)
    if not c:
        raise HTTPException(404, "Không tìm thấy khách hàng")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ============================================================ Đồng hồ
@router.post("/customers/{cid}/meters", dependencies=[Depends(require_editor)])
def add_meter(cid: int, data: MeterIn, db: Session = Depends(get_db)):
    if not db.get(Customer, cid):
        raise HTTPException(404, "Không tìm thấy khách hàng")
    if db.scalar(select(Meter.id).where(Meter.serial == data.serial)):
        raise HTTPException(400, "Số seri đồng hồ đã tồn tại")
    # đồng hồ cũ đang hoạt động -> chuyển trạng thái thay thế
    for m in db.scalars(select(Meter).where(Meter.customer_id == cid, Meter.status == "active")):
        m.status = "replaced"
    m = Meter(customer_id=cid, **data.model_dump())
    db.add(m)
    db.commit()
    return row_props(m)


@router.put("/meters/{mid}", dependencies=[Depends(require_editor)])
def update_meter(mid: int, data: MeterIn, db: Session = Depends(get_db)):
    m = db.get(Meter, mid)
    if not m:
        raise HTTPException(404, "Không tìm thấy đồng hồ")
    for k, v in data.model_dump().items():
        setattr(m, k, v)
    db.commit()
    return row_props(m)


# ============================================================ Ghi chỉ số
def _save_reading(db: Session, r: ReadingIn) -> MeterReading:
    m = db.get(Meter, r.meter_id)
    if not m:
        raise HTTPException(404, f"Không tìm thấy đồng hồ {r.meter_id}")
    prev = db.scalar(select(MeterReading).where(MeterReading.meter_id == m.id, MeterReading.period < r.period)
                     .order_by(MeterReading.period.desc()).limit(1))
    if prev and r.reading < prev.reading:
        raise HTTPException(400, f"Đồng hồ {m.serial}: chỉ số mới ({r.reading}) nhỏ hơn kỳ trước ({prev.reading})")
    cons = r.reading - prev.reading if prev else 0
    row = db.scalar(select(MeterReading).where(MeterReading.meter_id == m.id, MeterReading.period == r.period))
    if row:
        row.reading, row.consumption = r.reading, cons
    else:
        row = MeterReading(meter_id=m.id, period=r.period, reading=r.reading, consumption=cons)
        db.add(row)
    return row


@router.post("/readings", dependencies=[Depends(require_editor)])
def save_readings(items: list[ReadingIn], db: Session = Depends(get_db)):
    rows = [_save_reading(db, r) for r in items]
    db.commit()
    return [row_props(r) for r in rows]


@router.get("/readings/sheet")
def reading_sheet(period: str, zone_id: int | None = None, db: Session = Depends(get_db)):
    """Sổ ghi chỉ số kỳ: chỉ số kỳ trước + kỳ này (nếu đã ghi)."""
    stmt = (select(Meter, Customer).join(Customer).where(Meter.status == "active").order_by(Customer.code))
    if zone_id:
        stmt = stmt.where(Customer.zone_id == zone_id)
    out = []
    for m, c in db.execute(stmt).all():
        prev = db.scalar(select(MeterReading).where(MeterReading.meter_id == m.id, MeterReading.period < period)
                         .order_by(MeterReading.period.desc()).limit(1))
        cur = db.scalar(select(MeterReading).where(MeterReading.meter_id == m.id, MeterReading.period == period))
        out.append({
            "meter_id": m.id, "serial": m.serial, "customer_code": c.code, "customer_name": c.name,
            "address": c.address, "prev_period": prev.period if prev else None,
            "prev_reading": prev.reading if prev else None,
            "reading": cur.reading if cur else None, "consumption": cur.consumption if cur else None,
        })
    return out


# ============================================================ Sản lượng cấp vào DMA
@router.get("/inflows")
def list_inflows(zone_id: int | None = None, db: Session = Depends(get_db)):
    stmt = select(ZoneInflow).order_by(ZoneInflow.period.desc())
    if zone_id:
        stmt = stmt.where(ZoneInflow.zone_id == zone_id)
    return [row_props(r) for r in db.scalars(stmt)]


@router.post("/inflows", dependencies=[Depends(require_editor)])
def save_inflow(data: InflowIn, db: Session = Depends(get_db)):
    row = db.scalar(select(ZoneInflow).where(ZoneInflow.zone_id == data.zone_id, ZoneInflow.period == data.period))
    if row:
        row.volume_m3 = data.volume_m3
    else:
        row = ZoneInflow(**data.model_dump())
        db.add(row)
    db.commit()
    return row_props(row)
