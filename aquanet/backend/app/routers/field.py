"""API cho ứng dụng di động tổ hiện trường (PWA chạy offline).

- `GET /api/field/package`: gói dữ liệu tải về máy trước khi ra hiện trường (sổ ghi chỉ số,
  sự cố đang mở, lệnh bảo trì, danh mục vật tư).
- `POST /api/field/sync`: gửi lô thao tác đã ghi khi mất sóng. Mỗi thao tác mang `uuid` do máy
  sinh ra; gửi lại (do mạng chập chờn) trả về đúng kết quả cũ, không ghi trùng.
"""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..geo import geom_to_geojson
from ..models import (MAINT_OPEN, Customer, FieldOp, Incident, IncidentLog, Material,
                      MaintenanceTask, Meter, MeterReading, Node, User, Zone)
from ..schemas import FieldIncident, FieldIncidentUpdate, FieldReading, FieldSyncIn, FieldTaskComplete
from ..security import FIELD_ROLES, get_current_user
from ..services.incidents import create_incident
from ..services.maintenance import StockError, complete_task, task_dict
from ..services.readings import ReadingError, save_reading

router = APIRouter(prefix="/api/field", tags=["Ứng dụng hiện trường"])


def _who(u: User) -> str:
    return u.full_name or u.username


def _ll(geom) -> tuple[float | None, float | None]:
    g = geom_to_geojson(geom)
    return (g["coordinates"][0], g["coordinates"][1]) if g else (None, None)


@router.get("/package")
def package(period: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"), zone_id: int | None = None,
            limit: int = Query(5000, le=20000), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    period = period or date.today().strftime("%Y-%m")
    # ---- sổ ghi chỉ số: chỉ số kỳ trước, kỳ này (nếu đã ghi), tiêu thụ TB 3 kỳ để cảnh báo bất thường
    stmt = (select(Meter, Customer).join(Customer).where(Meter.status == "active", Customer.status == "active")
            .order_by(Customer.zone_id, Customer.address, Customer.code).limit(limit))
    if zone_id:
        stmt = stmt.where(Customer.zone_id == zone_id)
    pairs = db.execute(stmt).all()
    meter_ids = [m.id for m, _ in pairs]
    hist: dict[int, list[MeterReading]] = {}
    if meter_ids:
        for r in db.scalars(select(MeterReading).where(MeterReading.meter_id.in_(meter_ids),
                                                       MeterReading.period <= period)
                            .order_by(MeterReading.meter_id, MeterReading.period)):
            hist.setdefault(r.meter_id, []).append(r)
    readings = []
    for m, c in pairs:
        rs = hist.get(m.id, [])
        cur = next((r for r in rs if r.period == period), None)
        before = [r for r in rs if r.period < period]
        prev = before[-1] if before else None
        recent = [r.consumption for r in before[-3:] if r.consumption > 0]
        lon, lat = _ll(c.geom)
        readings.append({
            "meter_id": m.id, "serial": m.serial, "customer_id": c.id, "customer_code": c.code,
            "customer_name": c.name, "address": c.address, "phone": c.phone, "zone_id": c.zone_id,
            "lon": lon, "lat": lat, "prev_period": prev.period if prev else None,
            "prev_reading": prev.reading if prev else None,
            "avg_consumption": round(sum(recent) / len(recent), 1) if recent else None,
            "reading": cur.reading if cur else None, "consumption": cur.consumption if cur else None,
        })

    # ---- sự cố đang mở
    iq = select(Incident).where(Incident.status.notin_(["resolved", "closed"])).order_by(Incident.reported_at.desc())
    if zone_id:
        iq = iq.where(Incident.zone_id == zone_id)
    incidents = []
    for i in db.scalars(iq.limit(500)):
        lon, lat = _ll(i.geom)
        incidents.append({"id": i.id, "code": i.code, "title": i.title, "incident_type": i.incident_type,
                          "severity": i.severity, "status": i.status, "assignee": i.assignee,
                          "description": i.description, "reported_at": i.reported_at.isoformat(),
                          "lon": lon, "lat": lat, "mine": bool(i.assignee and i.assignee in (user.full_name, user.username))})

    # ---- lệnh bảo trì đến hạn trong 30 ngày (hoặc quá hạn)
    tq = (select(MaintenanceTask, Node).join(Node, Node.id == MaintenanceTask.node_id)
          .where(MaintenanceTask.status.in_(MAINT_OPEN), MaintenanceTask.due_date <= date.today() + timedelta(days=30))
          .order_by(MaintenanceTask.due_date).limit(1000))
    if zone_id:
        tq = tq.where(Node.zone_id == zone_id)
    tasks = []
    for t, n in db.execute(tq).all():
        d = task_dict(t, n)
        d["lon"], d["lat"] = d["geometry"]["coordinates"] if d.get("geometry") else (None, None)
        d.pop("geometry", None)
        d["mine"] = bool(t.assignee and t.assignee in (user.full_name, user.username))
        tasks.append(d)

    materials = [{"id": m.id, "code": m.code, "name": m.name, "unit": m.unit, "stock": m.stock}
                 for m in db.scalars(select(Material).where(Material.stock > 0).order_by(Material.code))]
    zones = [{"id": z.id, "code": z.code, "name": z.name} for z in db.scalars(select(Zone).order_by(Zone.code))]
    return {"generated_at": datetime.now().isoformat(timespec="seconds"), "period": period, "zone_id": zone_id,
            "user": {"username": user.username, "full_name": user.full_name, "role": user.role},
            "readings": readings, "incidents": incidents, "tasks": tasks, "materials": materials, "zones": zones}


def _require_field_role(user: User):
    if user.role not in FIELD_ROLES:
        raise PermissionError("Tài khoản không có quyền thực hiện thao tác hiện trường")


def _apply_op(db: Session, kind: str, payload: dict, user: User) -> dict:
    who = _who(user)
    if kind == "reading":
        _require_field_role(user)
        r = FieldReading(**payload)
        row = save_reading(db, r.meter_id, r.period, r.reading, source="field", read_by=who, note=r.note)
        return {"id": row.id, "consumption": row.consumption}
    if kind == "incident":  # mọi người dùng đều được báo sự cố (giống giao diện web)
        f = FieldIncident(**payload)
        desc = f.description or ""
        if f.accuracy_m:
            desc = (desc + f"\n(Vị trí GPS, sai số ~{f.accuracy_m:.0f} m)").strip()
        i = create_incident(
            db, {"incident_type": f.incident_type, "severity": f.severity, "title": f.title, "description": desc,
                 "reporter": who, "reporter_phone": f.reporter_phone, "pipe_id": f.pipe_id},
            {"type": "Point", "coordinates": [f.lon, f.lat]}, who, log_note="Báo từ ứng dụng hiện trường")
        return {"id": i.id, "code": i.code, "pipe_id": i.pipe_id}
    if kind == "incident_update":
        _require_field_role(user)
        u = FieldIncidentUpdate(**payload)
        i = db.get(Incident, u.incident_id)
        if not i:
            raise LookupError(f"Không tìm thấy sự cố {u.incident_id}")
        if u.status and u.status != i.status:
            i.status = u.status
            if i.status in ("resolved", "closed") and not i.resolved_at:
                i.resolved_at = datetime.now()
            if i.status not in ("resolved", "closed"):
                i.resolved_at = None
        if u.status or u.note:
            db.add(IncidentLog(incident_id=i.id, status=i.status, note=u.note, user=who))
        db.flush()
        return {"id": i.id, "status": i.status}
    if kind == "task_complete":
        _require_field_role(user)
        tc = FieldTaskComplete(**payload)
        t = db.get(MaintenanceTask, tc.task_id)
        if not t:
            raise LookupError(f"Không tìm thấy lệnh {tc.task_id}")
        complete_task(db, t, tc.model_dump(exclude={"task_id"}), who)
        return {"id": t.id, "code": t.code, "incident_id": t.incident_id}
    raise ValueError(f"Loại thao tác không hỗ trợ: {kind}")


@router.post("/sync")
def sync(data: FieldSyncIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Áp dụng lần lượt từng thao tác; mỗi thao tác một savepoint – lỗi ở một mục không ảnh hưởng mục khác."""
    if len({o.uuid for o in data.ops}) != len(data.ops):
        raise HTTPException(400, "Trùng uuid trong cùng một lô")
    done = {r.uuid: r for r in db.scalars(select(FieldOp).where(FieldOp.uuid.in_([o.uuid for o in data.ops])))}
    results = []
    for op in data.ops:
        if op.uuid in done:
            prev = done[op.uuid]
            results.append({"uuid": op.uuid, "kind": prev.kind, "ok": True, "duplicate": True, **prev.result})
            continue
        sp = db.begin_nested()
        try:
            res = _apply_op(db, op.kind, op.payload, user)
            db.add(FieldOp(uuid=op.uuid, kind=op.kind, username=user.username, result=res))
            db.flush()
            sp.commit()
            results.append({"uuid": op.uuid, "kind": op.kind, "ok": True, **res})
        except IntegrityError:
            # cùng uuid đang được một yêu cầu khác ghi (máy gửi lại khi chưa nhận phản hồi)
            sp.rollback()
            prev = db.get(FieldOp, op.uuid)
            extra = prev.result if prev else {"error": "Thao tác đang được xử lý, thử lại sau"}
            results.append({"uuid": op.uuid, "kind": op.kind, "ok": bool(prev), "duplicate": True, **extra})
        except (ReadingError, StockError, LookupError, PermissionError, ValueError, ValidationError) as e:
            sp.rollback()
            msg = "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors()) \
                if isinstance(e, ValidationError) else str(e)
            results.append({"uuid": op.uuid, "kind": op.kind, "ok": False, "error": msg})
    db.commit()
    return {"server_time": datetime.now().isoformat(timespec="seconds"), "results": results,
            "ok": sum(r["ok"] for r in results), "failed": sum(not r["ok"] for r in results)}


@router.get("/me/stats")
def my_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Thống kê nhanh trong ngày của người dùng hiện trường."""
    today = datetime.combine(date.today(), datetime.min.time())
    who = _who(user)
    return {
        "readings_today": db.scalar(select(func.count()).select_from(MeterReading)
                                    .where(MeterReading.read_by == who, MeterReading.read_at >= today)),
        "tasks_done_today": db.scalar(select(func.count()).select_from(MaintenanceTask)
                                      .where(MaintenanceTask.completed_by == who, MaintenanceTask.completed_at >= today)),
        "incidents_today": db.scalar(select(func.count()).select_from(Incident)
                                     .where(Incident.reporter == who, Incident.reported_at >= today)),
    }
