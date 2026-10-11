from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..geo import feature_collection, geojson_to_geom, to_feature
from ..models import Incident, IncidentLog, User
from ..schemas import IncidentIn, IncidentUpdate
from ..security import get_current_user, require_admin, require_editor
from ..services.incidents import create_incident as create_incident_svc
from ..services.topology import isolation_report

router = APIRouter(prefix="/api/incidents", tags=["Sự cố"], dependencies=[Depends(get_current_user)])


def _detail(i: Incident) -> dict:
    f = to_feature(i)
    f["properties"]["logs"] = [
        {"status": l.status, "note": l.note, "user": l.user, "created_at": l.created_at.isoformat()} for l in i.logs
    ]
    return f


@router.get("")
def list_incidents(
    status: str | None = None,
    incident_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    open_only: bool = False,
    db: Session = Depends(get_db),
):
    q = select(Incident)
    if status:
        q = q.where(Incident.status.in_(status.split(",")))
    if open_only:
        q = q.where(Incident.status.notin_(["resolved", "closed"]))
    if incident_type:
        q = q.where(Incident.incident_type == incident_type)
    if date_from:
        q = q.where(Incident.reported_at >= date_from)
    if date_to:
        q = q.where(Incident.reported_at < f"{date_to} 23:59:59")
    items = db.scalars(q.order_by(Incident.reported_at.desc())).all()
    return feature_collection(items, lambda i: {"isolation": None, "has_isolation": bool(i.isolation)})


@router.get("/{iid}")
def get_incident(iid: int, db: Session = Depends(get_db)):
    i = db.get(Incident, iid)
    if not i:
        raise HTTPException(404, "Không tìm thấy sự cố")
    return _detail(i)


@router.post("")
def create_incident(data: IncidentIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    i = create_incident_svc(db, data.model_dump(exclude={"geometry"}), data.geometry, user.full_name or user.username)
    db.commit()
    db.refresh(i)
    return _detail(i)


@router.put("/{iid}", dependencies=[Depends(require_editor)])
def update_incident(iid: int, data: IncidentUpdate, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    i = db.get(Incident, iid)
    if not i:
        raise HTTPException(404, "Không tìm thấy sự cố")
    old_status = i.status
    changes = data.model_dump(exclude_unset=True, exclude={"geometry", "note"})
    pipe_changed = "pipe_id" in changes and changes["pipe_id"] != i.pipe_id
    for k, v in changes.items():
        setattr(i, k, v)
    if data.geometry:
        i.geom = geojson_to_geom(data.geometry)
    if "assignee" in changes and i.assignee and i.status == "new" and "status" not in changes:
        i.status = "assigned"
    if i.status in ("resolved", "closed") and not i.resolved_at:
        i.resolved_at = datetime.now()
    if i.status not in ("resolved", "closed"):
        i.resolved_at = None
    if pipe_changed and i.pipe_id:
        try:
            i.isolation = isolation_report(db, i.pipe_id)
        except ValueError:
            i.isolation = None
    if i.status != old_status or data.note:
        db.add(IncidentLog(incident_id=i.id, status=i.status, note=data.note,
                           user=user.full_name or user.username))
    db.commit()
    db.refresh(i)
    return _detail(i)


@router.post("/{iid}/isolate", dependencies=[Depends(require_editor)])
def recompute_isolation(iid: int, db: Session = Depends(get_db)):
    i = db.get(Incident, iid)
    if not i or not i.pipe_id:
        raise HTTPException(400, "Sự cố chưa gắn với đường ống")
    i.isolation = isolation_report(db, i.pipe_id)
    db.commit()
    return i.isolation


@router.delete("/{iid}", dependencies=[Depends(require_admin)])
def delete_incident(iid: int, db: Session = Depends(get_db)):
    i = db.get(Incident, iid)
    if not i:
        raise HTTPException(404, "Không tìm thấy sự cố")
    db.delete(i)
    db.commit()
    return {"ok": True}
