from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import Numeric, case, cast, func, select, text
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Customer, Incident, Meter, MeterReading, Node, Pipe, Zone, ZoneInflow
from ..security import get_current_user

router = APIRouter(prefix="/api/reports", tags=["Báo cáo"], dependencies=[Depends(get_current_user)])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    node_counts = dict(db.execute(select(Node.node_type, func.count()).group_by(Node.node_type)).all())
    total_len = db.scalar(select(func.coalesce(func.sum(Pipe.length_m), 0)).where(Pipe.status == "active"))
    open_inc = db.scalar(select(func.count()).select_from(Incident)
                         .where(Incident.status.notin_(["resolved", "closed"])))
    avg_hours = db.scalar(select(func.avg(func.extract("epoch", Incident.resolved_at - Incident.reported_at) / 3600))
                          .where(Incident.resolved_at.isnot(None)))
    return {
        "pipe_count": db.scalar(select(func.count()).select_from(Pipe)),
        "pipe_length_km": round(float(total_len) / 1000, 2),
        "node_counts": node_counts,
        "customer_count": db.scalar(select(func.count()).select_from(Customer)),
        "meter_count": db.scalar(select(func.count()).select_from(Meter).where(Meter.status == "active")),
        "zone_count": db.scalar(select(func.count()).select_from(Zone)),
        "open_incidents": open_inc,
        "avg_resolve_hours": round(float(avg_hours), 1) if avg_hours else None,
    }


@router.get("/pipes")
def pipe_stats(db: Session = Depends(get_db)):
    year = datetime.now().year
    km = func.round(cast(func.sum(Pipe.length_m) / 1000, Numeric), 3)
    active = Pipe.status == "active"
    by_material = db.execute(select(Pipe.material, km, func.count()).where(active)
                             .group_by(Pipe.material).order_by(km.desc())).all()
    by_diameter = db.execute(select(Pipe.diameter_mm, km, func.count()).where(active)
                             .group_by(Pipe.diameter_mm).order_by(Pipe.diameter_mm)).all()
    age = year - Pipe.install_year
    bucket = case(
        (Pipe.install_year.is_(None), "Không rõ"),
        (age < 10, "< 10 năm"),
        (age < 20, "10–20 năm"),
        (age < 30, "20–30 năm"),
        else_="≥ 30 năm",
    )
    by_age = db.execute(select(bucket.label("b"), km).where(active).group_by("b")).all()
    by_zone = db.execute(select(func.coalesce(Zone.name, "Ngoài vùng"), km).select_from(Pipe)
                         .outerjoin(Zone, Zone.id == Pipe.zone_id).where(active).group_by(Zone.name)).all()
    order = ["< 10 năm", "10–20 năm", "20–30 năm", "≥ 30 năm", "Không rõ"]
    return {
        "by_material": [{"material": m, "km": float(k), "count": c} for m, k, c in by_material],
        "by_diameter": [{"diameter_mm": d, "km": float(k), "count": c} for d, k, c in by_diameter],
        "by_age": sorted([{"bucket": b, "km": float(k)} for b, k in by_age], key=lambda r: order.index(r["bucket"])),
        "by_zone": [{"zone": z, "km": float(k)} for z, k in by_zone],
    }


@router.get("/incidents")
def incident_stats(months: int = 12, db: Session = Depends(get_db)):
    month = func.to_char(Incident.reported_at, "YYYY-MM")
    by_month = db.execute(select(month.label("m"), Incident.incident_type, func.count())
                          .where(Incident.reported_at >= func.now() - text(f"interval '{int(months)} months'"))
                          .group_by("m", Incident.incident_type).order_by("m")).all()
    by_type = db.execute(select(Incident.incident_type, func.count()).group_by(Incident.incident_type)).all()
    by_status = db.execute(select(Incident.status, func.count()).group_by(Incident.status)).all()
    hotspots = db.execute(
        select(Pipe.id, Pipe.code, Pipe.street, Pipe.material, Pipe.diameter_mm, Pipe.install_year, func.count(Incident.id).label("n"))
        .join(Incident, Incident.pipe_id == Pipe.id)
        .group_by(Pipe.id).order_by(text("n DESC")).limit(10)
    ).all()
    months_map: dict[str, dict] = {}
    for m, t, c in by_month:
        months_map.setdefault(m, {"month": m})[t] = c
    return {
        "by_month": list(months_map.values()),
        "by_type": [{"type": t, "count": c} for t, c in by_type],
        "by_status": [{"status": s, "count": c} for s, c in by_status],
        "hotspots": [dict(r._mapping) for r in hotspots],
        "loss_m3": float(db.scalar(select(func.coalesce(func.sum(Incident.est_loss_m3), 0)))),
        "repair_cost": float(db.scalar(select(func.coalesce(func.sum(Incident.repair_cost), 0)))),
    }


@router.get("/nrw")
def nrw(db: Session = Depends(get_db)):
    """Thất thoát (Non-Revenue Water) theo DMA và kỳ: cấp vào – tiêu thụ ghi thu."""
    billed = dict(
        ((z, p), float(v)) for z, p, v in db.execute(
            select(Customer.zone_id, MeterReading.period, func.sum(MeterReading.consumption))
            .join(Meter, Meter.id == MeterReading.meter_id).join(Customer, Customer.id == Meter.customer_id)
            .group_by(Customer.zone_id, MeterReading.period)
        ).all()
    )
    zones = dict(db.execute(select(Zone.id, Zone.name)).all())
    rows = []
    for inf in db.scalars(select(ZoneInflow).order_by(ZoneInflow.period, ZoneInflow.zone_id)):
        b = billed.get((inf.zone_id, inf.period), 0.0)
        loss = inf.volume_m3 - b
        rows.append({
            "zone_id": inf.zone_id, "zone": zones.get(inf.zone_id), "period": inf.period,
            "inflow_m3": round(inf.volume_m3, 1), "billed_m3": round(b, 1), "loss_m3": round(loss, 1),
            "nrw_pct": round(loss / inf.volume_m3 * 100, 1) if inf.volume_m3 else None,
        })
    return rows


@router.get("/consumption")
def consumption(db: Session = Depends(get_db)):
    rows = db.execute(
        select(MeterReading.period, Customer.customer_type, func.sum(MeterReading.consumption))
        .join(Meter, Meter.id == MeterReading.meter_id).join(Customer, Customer.id == Meter.customer_id)
        .group_by(MeterReading.period, Customer.customer_type).order_by(MeterReading.period)
    ).all()
    out: dict[str, dict] = {}
    for p, t, v in rows:
        out.setdefault(p, {"period": p})[t] = round(float(v), 1)
    return list(out.values())
