"""Vector tiles (MVT) cho bản đồ mạng lưới lớn – hàng trăm nghìn đối tượng.

Tile do hàm PostGIS `postgisftw.aquanet_network(z, x, y)` sinh ra; cùng hàm này được Martin
hoặc pg_tileserv xuất bản nếu triển khai tile server riêng (xem README).
"""
from fastapi import APIRouter, Depends, HTTPException, Path
from fastapi.responses import Response
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Customer, Node, Pipe
from ..security import get_current_user

router = APIRouter(prefix="/api/tiles", tags=["Vector tiles"], dependencies=[Depends(get_current_user)])
MVT = "application/vnd.mapbox-vector-tile"


@router.get("/info")
def info(db: Session = Depends(get_db)):
    """Số đối tượng, chế độ hiển thị khuyến nghị và mẫu URL tile cho giao diện."""
    counts = {k: db.scalar(select(func.count()).select_from(m)) or 0
              for k, m in (("pipes", Pipe), ("nodes", Node), ("customers", Customer))}
    ext = db.execute(select(func.ST_XMin(func.ST_Extent(Pipe.geom)), func.ST_YMin(func.ST_Extent(Pipe.geom)),
                            func.ST_XMax(func.ST_Extent(Pipe.geom)), func.ST_YMax(func.ST_Extent(Pipe.geom)))).one()
    total = counts["pipes"] + counts["nodes"]
    return {
        **counts,
        "threshold": settings.VECTOR_TILE_THRESHOLD,
        "recommended": "tiles" if total > settings.VECTOR_TILE_THRESHOLD else "geojson",
        "url_template": settings.TILE_URL_TEMPLATE,
        "layers": ["zones", "pipes", "customers", "nodes", "incidents"],
        "bounds": list(ext) if ext[0] is not None else None,
    }


@router.get("/{z}/{x}/{y}.pbf")
def tile(z: int = Path(ge=0, le=24), x: int = Path(ge=0), y: int = Path(ge=0), db: Session = Depends(get_db)):
    if x >= 1 << z or y >= 1 << z:
        raise HTTPException(404, "Tile ngoài phạm vi")
    data = db.scalar(text("SELECT postgisftw.aquanet_network(:z, :x, :y)"), {"z": z, "x": x, "y": y})
    if not data:
        return Response(status_code=204, headers={"Cache-Control": "private, max-age=60"})
    return Response(bytes(data), media_type=MVT, headers={"Cache-Control": "private, max-age=60"})
