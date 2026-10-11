"""SCADA & đồng hồ thông minh: điểm đo, nhận số liệu, cảnh báo, giám sát thời gian thực."""
import asyncio
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal, get_db
from ..geo import geojson_to_geom, geom_to_geojson, row_props
from ..models import SENSOR_UNITS, Alarm, Meter, Node, Sensor, User, Zone, ZoneInflow
from ..schemas import SensorIn, SensorUpdate, TelemetryPoint
from ..security import (_user_from_token, get_current_user, oauth2_scheme, require_editor, require_field,
                        require_ingest)
from ..services.readings import ReadingError, save_reading
from ..services.realtime import hub, publish
from ..services.telemetry import TZ, alarm_dict, clear_alarms_if_unbounded, ingest, sensor_status

router = APIRouter(prefix="/api/scada", tags=["SCADA & đồng hồ thông minh"])


def _sensor_feature(s: Sensor, node_geom, now: datetime, alarmed: set[int]) -> dict:
    p = row_props(s)
    p["status"] = sensor_status(s, now, alarmed)
    g = s.geom if s.geom is not None else node_geom
    return {"type": "Feature", "id": s.id, "geometry": geom_to_geojson(g), "properties": p}


def _alarmed(db: Session) -> set[int]:
    return set(db.scalars(select(Alarm.sensor_id).where(Alarm.cleared_at.is_(None))).all())


def _get(db: Session, sid: int) -> Sensor:
    s = db.get(Sensor, sid)
    if not s:
        raise HTTPException(404, "Không tìm thấy điểm đo")
    return s


# ============================================================ Điểm đo
@router.get("/sensors", dependencies=[Depends(get_current_user)])
def list_sensors(sensor_type: str | None = None, zone_id: int | None = None, include_smart: bool = True,
                 db: Session = Depends(get_db)):
    q = select(Sensor, Node.geom).outerjoin(Node, Node.id == Sensor.node_id).order_by(Sensor.code)
    if sensor_type:
        q = q.where(Sensor.sensor_type.in_(sensor_type.split(",")))
    if not include_smart:
        q = q.where(Sensor.sensor_type != "smart_meter")
    if zone_id:
        q = q.where(Sensor.zone_id == zone_id)
    now, alarmed = datetime.now(timezone.utc), _alarmed(db)
    return {"type": "FeatureCollection",
            "features": [_sensor_feature(s, g, now, alarmed) for s, g in db.execute(q).all()]}


@router.get("/sensors/{sid}", dependencies=[Depends(get_current_user)])
def get_sensor(sid: int, db: Session = Depends(get_db)):
    s = _get(db, sid)
    ng = db.scalar(select(Node.geom).where(Node.id == s.node_id)) if s.node_id else None
    return _sensor_feature(s, ng, datetime.now(timezone.utc), _alarmed(db))


def _apply(s: Sensor, data: dict, geometry, db: Session):
    for k, v in data.items():
        setattr(s, k, v)
    if geometry:
        s.geom = geojson_to_geom(geometry)
    if s.node_id and s.zone_id is None:
        s.zone_id = db.scalar(select(Node.zone_id).where(Node.id == s.node_id))
    if s.meter_id and not db.get(Meter, s.meter_id):
        raise HTTPException(400, "Không tìm thấy đồng hồ khách hàng")


@router.post("/sensors", dependencies=[Depends(require_editor)])
def create_sensor(data: SensorIn, db: Session = Depends(get_db)):
    if db.scalar(select(Sensor.id).where(Sensor.code == data.code)):
        raise HTTPException(400, "Mã điểm đo đã tồn tại")
    s = Sensor(unit=data.unit or SENSOR_UNITS[data.sensor_type])
    _apply(s, data.model_dump(exclude={"geometry", "unit"}), data.geometry, db)
    db.add(s)
    db.commit()
    return get_sensor(s.id, db)


@router.put("/sensors/{sid}", dependencies=[Depends(require_editor)])
def update_sensor(sid: int, data: SensorUpdate, db: Session = Depends(get_db)):
    s = _get(db, sid)
    _apply(s, data.model_dump(exclude_unset=True, exclude={"geometry"}), data.geometry, db)
    clear_alarms_if_unbounded(db, s)
    db.commit()
    return get_sensor(s.id, db)


@router.delete("/sensors/{sid}", dependencies=[Depends(require_editor)])
def delete_sensor(sid: int, db: Session = Depends(get_db)):
    db.delete(_get(db, sid))
    db.commit()
    return {"ok": True}


@router.get("/sensors/{sid}/series", dependencies=[Depends(get_current_user)])
def series(sid: int, hours: int = Query(24, ge=1, le=24 * 92), db: Session = Depends(get_db)):
    """Chuỗi số liệu gộp theo khung thời gian (tự chọn theo độ dài: 5 phút / 30 phút / 2 giờ)."""
    s = _get(db, sid)
    bucket = 300 if hours <= 24 else 1800 if hours <= 24 * 7 else 7200
    rows = db.execute(text("""
        SELECT to_timestamp(floor(extract(epoch FROM ts) / :b) * :b) AS bucket_ts,
               avg(value) AS avg, min(value) AS min, max(value) AS max
        FROM telemetry WHERE sensor_id = :sid AND ts >= now() - make_interval(hours => :h)
        GROUP BY 1 ORDER BY 1"""), {"b": bucket, "sid": sid, "h": hours}).all()
    return {"sensor_id": s.id, "code": s.code, "unit": s.unit, "bucket_seconds": bucket,
            "min_alarm": s.min_alarm, "max_alarm": s.max_alarm,
            "points": [{"ts": r.bucket_ts.isoformat(), "avg": round(r.avg, 3), "min": round(r.min, 3),
                        "max": round(r.max, 3)} for r in rows]}


# ============================================================ Nhận số liệu
@router.post("/ingest")
def ingest_endpoint(points: Annotated[list[TelemetryPoint], Body(max_length=5000)],
                    who: str = Depends(require_ingest), db: Session = Depends(get_db)):
    """Cổng thu thập SCADA / AMI gửi số liệu (tối đa 5.000 điểm mỗi lần).

    Xác thực bằng header `X-API-Key` (biến môi trường INGEST_API_KEYS) hoặc tài khoản kỹ thuật.
    `sensor` là mã điểm đo hoặc `external_id` (tên tag SCADA, mã thiết bị đồng hồ thông minh).
    """
    res = ingest(db, [p.model_dump() for p in points])
    db.commit()
    return res


@router.get("/stream")
async def stream(request: Request, token: str = Depends(oauth2_scheme),
                 max_seconds: int = Query(300, ge=5, le=3600)):
    """Luồng Server-Sent Events: số liệu mới (`values`) và cảnh báo (`alarms`) theo thời gian thực.

    Kết nối tự đóng sau `max_seconds` – trình duyệt kết nối lại, tránh kết nối treo qua proxy.
    """
    def check():
        with SessionLocal() as db:  # phiên CSDL ngắn – không giữ kết nối suốt luồng
            _user_from_token(token, db)

    await run_in_threadpool(check)
    q = hub.subscribe()
    loop = asyncio.get_running_loop()

    async def gen():
        try:
            yield "retry: 3000\nevent: hello\ndata: {}\n\n"
            deadline = loop.time() + max_seconds
            while (remaining := deadline - loop.time()) > 0:
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=min(15.0, remaining))
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                if await request.is_disconnected():
                    break
        finally:
            hub.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ============================================================ Cảnh báo
@router.get("/alarms", dependencies=[Depends(get_current_user)])
def list_alarms(active: bool = True, limit: int = Query(200, le=2000), db: Session = Depends(get_db)):
    q = select(Alarm, Sensor).join(Sensor, Sensor.id == Alarm.sensor_id).order_by(Alarm.started_at.desc()).limit(limit)
    if active:
        q = q.where(Alarm.cleared_at.is_(None))
    return [alarm_dict(a, s) for a, s in db.execute(q).all()]


@router.post("/alarms/{aid}/ack")
def ack_alarm(aid: int, db: Session = Depends(get_db), user: User = Depends(require_field)):
    a = db.get(Alarm, aid)
    if not a:
        raise HTTPException(404, "Không tìm thấy cảnh báo")
    if not a.ack_at:
        a.ack_by, a.ack_at = user.full_name or user.username, datetime.now(timezone.utc)
        s = db.get(Sensor, a.sensor_id)
        publish(db, "alarms", [alarm_dict(a, s, "ack")])
        db.commit()
    return alarm_dict(a, db.get(Sensor, a.sensor_id))


# ============================================================ Tổng quan & phân tích
@router.get("/overview", dependencies=[Depends(get_current_user)])
def overview(db: Session = Depends(get_db)):
    now, alarmed = datetime.now(timezone.utc), _alarmed(db)
    sensors = db.scalars(select(Sensor)).all()
    by_status: dict[str, int] = {}
    by_type: dict[str, int] = {}
    for s in sensors:
        st = sensor_status(s, now, alarmed)
        by_status[st] = by_status.get(st, 0) + 1
        by_type[s.sensor_type] = by_type.get(s.sensor_type, 0) + 1
    zones = []
    for z in db.scalars(select(Zone).order_by(Zone.code)):
        zs = [s for s in sensors if s.zone_id == z.id and s.active and s.last_value is not None
              and sensor_status(s, now, alarmed) != "offline"]
        flow = [s.last_value for s in zs if s.sensor_type == "flow"]
        pres = [s.last_value for s in zs if s.sensor_type == "pressure"]
        zones.append({"zone_id": z.id, "zone": z.name, "flow_m3h": round(sum(flow), 1) if flow else None,
                      "pressure_min": min(pres) if pres else None,
                      "pressure_avg": round(sum(pres) / len(pres), 2) if pres else None})
    return {"sensor_count": len(sensors), "by_status": by_status, "by_type": by_type,
            "active_alarms": len(alarmed), "zones": zones}


@router.get("/mnf", dependencies=[Depends(get_current_user)])
def minimum_night_flow(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    """Lưu lượng đêm nhỏ nhất (MNF, trung bình 2h–4h) tại các đồng hồ tổng – chỉ báo rò rỉ của DMA.

    Tỷ lệ MNF / lưu lượng trung bình ngày cao (thường > 30–40%) gợi ý DMA đang rò rỉ nhiều.
    """
    sensors = db.execute(select(Sensor, Zone.name).outerjoin(Zone, Zone.id == Sensor.zone_id)
                         .where(Sensor.sensor_type == "flow", Sensor.active)).all()
    if not sensors:
        return []
    rows = db.execute(text("""
        SELECT sensor_id, (ts AT TIME ZONE :tz)::date AS d,
               avg(value) FILTER (WHERE extract(hour FROM ts AT TIME ZONE :tz) IN (2, 3)) AS mnf,
               avg(value) AS avg_flow
        FROM telemetry
        WHERE sensor_id = ANY(:ids) AND ts >= now() - make_interval(days => :days)
        GROUP BY 1, 2 ORDER BY 1, 2"""),
        {"tz": settings.TIMEZONE, "ids": [s.id for s, _ in sensors], "days": days}).all()
    by_sensor: dict[int, list] = {}
    for r in rows:
        if r.mnf is not None:
            by_sensor.setdefault(r.sensor_id, []).append(
                {"date": r.d.isoformat(), "mnf": round(r.mnf, 2), "avg": round(r.avg_flow, 2)})
    out = []
    for s, zname in sensors:
        nights = by_sensor.get(s.id, [])
        if not nights:
            continue
        mnf = sum(n["mnf"] for n in nights) / len(nights)
        avg = sum(n["avg"] for n in nights) / len(nights)
        out.append({"sensor_id": s.id, "code": s.code, "name": s.name, "zone_id": s.zone_id, "zone": zname,
                    "unit": s.unit, "mnf": round(mnf, 2), "avg_flow": round(avg, 2),
                    "mnf_ratio_pct": round(mnf / avg * 100, 1) if avg else None, "nights": nights})
    return sorted(out, key=lambda r: -(r["mnf_ratio_pct"] or 0))


def _period_bounds(period: str) -> tuple[datetime, datetime]:
    try:
        y, m = map(int, period.split("-"))
        start = datetime(y, m, 1, tzinfo=TZ)
    except ValueError:
        raise HTTPException(422, "Kỳ phải có dạng YYYY-MM")
    end = datetime(y + (m == 12), m % 12 + 1, 1, tzinfo=TZ)
    return start, end


def _value_before(db: Session, sid: int, t: datetime) -> float | None:
    return db.scalar(text("SELECT value FROM telemetry WHERE sensor_id = :s AND ts < :t ORDER BY ts DESC LIMIT 1"),
                     {"s": sid, "t": t})


@router.post("/smart-meters/close-period")
def close_smart_meter_period(period: str, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    """Chốt chỉ số kỳ từ đồng hồ thông minh: lấy giá trị cuối cùng trước ngày 1 kỳ sau làm chỉ số kỳ."""
    _, end = _period_bounds(period)
    saved, skipped, errors = 0, 0, []
    for s in db.scalars(select(Sensor).where(Sensor.sensor_type == "smart_meter", Sensor.meter_id.isnot(None),
                                             Sensor.active)):
        v = _value_before(db, s.id, end)
        if v is None:
            skipped += 1
            continue
        sp = db.begin_nested()
        try:
            save_reading(db, s.meter_id, period, round(v, 2), source="smart", read_by="AMI")
            sp.commit()
            saved += 1
        except ReadingError as e:
            sp.rollback()
            errors.append(f"{s.code}: {e}")
    db.commit()
    return {"period": period, "saved": saved, "skipped": skipped, "errors": errors}


@router.post("/inflows/compute")
def compute_inflows(period: str, db: Session = Depends(get_db), _: User = Depends(require_editor)):
    """Tính sản lượng cấp vào DMA từ điểm đo tại đồng hồ tổng.

    Ưu tiên điểm đo tổng (totalizer: chỉ số cuối kỳ – đầu kỳ); không có thì lấy lưu lượng trung bình
    (m³/h) × số giờ trong kỳ, kèm độ phủ số liệu.
    """
    start, end = _period_bounds(period)
    hours = (end - start).total_seconds() / 3600
    rows = db.execute(select(Sensor, func.coalesce(Sensor.zone_id, Node.zone_id).label("zid"))
                      .join(Node, Node.id == Sensor.node_id)
                      .where(Node.node_type == "bulk_meter", Sensor.active,
                             Sensor.sensor_type.in_(["totalizer", "flow"]))).all()
    per_zone: dict[int, dict] = {}
    for s, zid in rows:
        if zid is None:
            continue
        per_zone.setdefault(zid, {"totalizer": [], "flow": []})[s.sensor_type].append(s)
    out = []
    for zid, groups in per_zone.items():
        vol, method, coverage = 0.0, None, None
        if groups["totalizer"]:
            parts = [(_value_before(db, s.id, start), _value_before(db, s.id, end)) for s in groups["totalizer"]]
            if all(a is not None and b is not None for a, b in parts):
                vol, method = sum(b - a for a, b in parts), "totalizer"
        if method is None and groups["flow"]:
            covs = []
            for s in groups["flow"]:
                avg, n_hours = db.execute(text("""
                    SELECT avg(value), count(DISTINCT date_trunc('hour', ts)) FROM telemetry
                    WHERE sensor_id = :s AND ts >= :a AND ts < :b"""), {"s": s.id, "a": start, "b": end}).one()
                if avg is not None:
                    vol += avg * hours
                    covs.append(n_hours / hours)
            if covs:
                method, coverage = "flow_avg", round(min(covs) * 100, 1)
        if method is None:
            continue
        row = db.scalar(select(ZoneInflow).where(ZoneInflow.zone_id == zid, ZoneInflow.period == period))
        if row:
            row.volume_m3 = round(vol, 0)
        else:
            db.add(ZoneInflow(zone_id=zid, period=period, volume_m3=round(vol, 0)))
        out.append({"zone_id": zid, "volume_m3": round(vol, 0), "method": method, "coverage_pct": coverage})
    db.commit()
    return {"period": period, "zones": out}


@router.get("/smart-meters/{meter_id}", dependencies=[Depends(get_current_user)])
def smart_meter_of(meter_id: int, db: Session = Depends(get_db)):
    """Điểm đo AMI gắn với đồng hồ khách hàng (nếu có) – dùng ở hồ sơ khách hàng."""
    s = db.scalar(select(Sensor).where(Sensor.meter_id == meter_id))
    return row_props(s) if s else None
