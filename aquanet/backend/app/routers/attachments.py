"""Ảnh hiện trường: chụp sự cố, đồng hồ, thiết bị khi bảo trì."""
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..geo import geom_to_geojson, row_props
from ..models import ATTACHMENT_OWNERS, Attachment, Incident, MaintenanceTask, MeterReading, User
from ..security import EDITOR_ROLES, FIELD_ROLES, get_current_user

router = APIRouter(prefix="/api/attachments", tags=["Ảnh hiện trường"])

OWNER_MODELS = {"incident": Incident, "task": MaintenanceTask, "reading": MeterReading}
# Chỉ nhận ảnh raster, kiểm tra cả chữ ký tệp (không tin Content-Type do máy khách gửi)
SIGNATURES = {"image/jpeg": (b"\xff\xd8\xff",), "image/png": (b"\x89PNG\r\n\x1a\n",), "image/webp": (b"RIFF",)}
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _sniff(head: bytes) -> str | None:
    for ctype, sigs in SIGNATURES.items():
        if any(head.startswith(s) for s in sigs):
            if ctype == "image/webp" and head[8:12] != b"WEBP":
                continue
            return ctype
    return None


def _dict(a: Attachment) -> dict:
    d = row_props(a)
    d.pop("path", None)
    d["geometry"] = geom_to_geojson(a.geom)
    d["url"] = f"/api/attachments/{a.id}/file"
    return d


@router.get("")
def list_attachments(owner_type: str, owner_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    rows = db.scalars(select(Attachment).where(Attachment.owner_type == owner_type, Attachment.owner_id == owner_id)
                      .order_by(Attachment.id)).all()
    return [_dict(a) for a in rows]


@router.post("")
async def upload(owner_type: str = Form(...), owner_id: int = Form(...), file: UploadFile = File(...),
                 client_uuid: str | None = Form(None), caption: str | None = Form(None),
                 lon: float | None = Form(None), lat: float | None = Form(None),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if owner_type not in ATTACHMENT_OWNERS:
        raise HTTPException(400, "owner_type phải là incident, task hoặc reading")
    # báo sự cố mở cho mọi người dùng nên ai cũng được gửi ảnh sự cố; còn lại cần quyền hiện trường
    if owner_type != "incident" and user.role not in FIELD_ROLES:
        raise HTTPException(403, "Chỉ tổ hiện trường hoặc kỹ thuật được gửi ảnh")
    if client_uuid:
        old = db.scalar(select(Attachment).where(Attachment.client_uuid == client_uuid))
        if old:  # máy hiện trường gửi lại – trả kết quả cũ
            return _dict(old)
    if not db.get(OWNER_MODELS[owner_type], owner_id):
        raise HTTPException(404, "Không tìm thấy đối tượng để gắn ảnh")
    limit = int(settings.MAX_UPLOAD_MB * 1024 * 1024)
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"Ảnh vượt quá {settings.MAX_UPLOAD_MB:g} MB")
    ctype = _sniff(data[:16])
    if not ctype:
        raise HTTPException(415, "Chỉ nhận ảnh JPEG, PNG hoặc WebP")
    now = datetime.now()
    rel = Path(owner_type) / f"{now:%Y}" / f"{now:%m}" / f"{uuid.uuid4().hex}.{EXT[ctype]}"
    dest = settings.UPLOAD_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    a = Attachment(owner_type=owner_type, owner_id=owner_id, client_uuid=client_uuid,
                   filename=(file.filename or rel.name)[:200], content_type=ctype, size_bytes=len(data),
                   path=rel.as_posix(), caption=caption, uploaded_by=user.full_name or user.username,
                   geom=from_shape(Point(lon, lat), srid=4326) if lon is not None and lat is not None else None)
    db.add(a)
    try:
        db.commit()
    except IntegrityError:  # hai lần gửi cùng client_uuid chạy song song
        db.rollback()
        dest.unlink(missing_ok=True)
        return _dict(db.scalar(select(Attachment).where(Attachment.client_uuid == client_uuid)))
    return _dict(a)


@router.get("/{aid}/file")
def get_file(aid: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    a = db.get(Attachment, aid)
    if not a:
        raise HTTPException(404, "Không tìm thấy ảnh")
    f = (settings.UPLOAD_DIR / a.path).resolve()
    if not f.is_relative_to(settings.UPLOAD_DIR.resolve()) or not f.is_file():
        raise HTTPException(404, "Tệp ảnh không còn trên máy chủ")
    return FileResponse(f, media_type=a.content_type,
                        headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})


@router.delete("/{aid}")
def delete(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Attachment, aid)
    if not a:
        raise HTTPException(404, "Không tìm thấy ảnh")
    if user.role not in EDITOR_ROLES and a.uploaded_by not in (user.full_name, user.username):
        raise HTTPException(403, "Chỉ người gửi hoặc kỹ thuật được xóa ảnh")
    f = settings.UPLOAD_DIR / a.path
    db.delete(a)
    db.commit()
    f.unlink(missing_ok=True)
    return {"ok": True}
