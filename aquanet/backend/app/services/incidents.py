"""Tạo sự cố – dùng chung cho giao diện web và ứng dụng hiện trường."""
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..geo import geojson_to_geom, sql_geom
from ..models import Incident, IncidentLog, Pipe, Zone
from .topology import isolation_report


def incident_code(db: Session) -> str:
    y = datetime.now().year
    n = db.scalar(select(func.count()).select_from(Incident).where(Incident.code.like(f"SC{y}-%"))) or 0
    while True:
        n += 1
        c = f"SC{y}-{n:04d}"
        if not db.scalar(select(Incident.id).where(Incident.code == c)):
            return c


def create_incident(db: Session, fields: dict, geometry: dict, user_label: str,
                    log_note: str = "Tiếp nhận sự cố") -> Incident:
    i = Incident(**fields, code=incident_code(db), geom=geojson_to_geom(geometry))
    geom = sql_geom(geometry)
    if not i.pipe_id:  # gắn ống gần nhất trong 30 m
        i.pipe_id = db.scalar(
            select(Pipe.id)
            .where(func.ST_DWithin(func.Geography(Pipe.geom), func.Geography(geom), 30))
            .order_by(func.ST_Distance(func.Geography(Pipe.geom), func.Geography(geom)))
            .limit(1)
        )
    i.zone_id = db.scalar(select(Zone.id).where(func.ST_Intersects(Zone.geom, geom)).limit(1))
    if i.assignee:
        i.status = "assigned"
    db.add(i)
    db.flush()
    if i.pipe_id and i.incident_type in ("leak", "burst"):
        try:
            i.isolation = isolation_report(db, i.pipe_id)
        except ValueError:
            pass
    db.add(IncidentLog(incident_id=i.id, status=i.status, note=log_note, user=user_label))
    db.flush()
    return i
