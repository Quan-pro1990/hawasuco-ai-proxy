"""Tiện ích chuyển đổi hình học <-> GeoJSON."""
import json
import math
from typing import Any, Iterable

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape
from sqlalchemy import func, select
from sqlalchemy.orm import Session


def geom_to_geojson(geom) -> dict | None:
    if geom is None:
        return None
    return mapping(to_shape(geom))


def geojson_to_geom(gj: dict, srid: int = 4326):
    return from_shape(shape(gj), srid=srid)


def sql_geom(gj_or_wkb):
    """Biểu thức SQL hình học (dùng trong hàm PostGIS) từ GeoJSON hoặc WKBElement."""
    shp = shape(gj_or_wkb) if isinstance(gj_or_wkb, dict) else to_shape(gj_or_wkb)
    return func.ST_GeomFromText(shp.wkt, 4326)


def row_props(obj, exclude: Iterable[str] = ("geom",)) -> dict[str, Any]:
    out = {}
    for col in obj.__table__.columns:
        if col.name in exclude:
            continue
        v = getattr(obj, col.name)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def to_feature(obj, extra: dict | None = None) -> dict:
    props = row_props(obj)
    if extra:
        props.update(extra)
    return {"type": "Feature", "id": obj.id, "geometry": geom_to_geojson(obj.geom), "properties": props}


def feature_collection(objs, extra_fn=None) -> dict:
    return {
        "type": "FeatureCollection",
        "features": [to_feature(o, extra_fn(o) if extra_fn else None) for o in objs],
    }


def geodesic_length(db: Session, geom) -> float:
    """Chiều dài thực (m) tính trên ellipsoid."""
    return float(db.scalar(select(func.ST_Length(func.Geography(geom)))) or 0)


def bbox_filter(column, bbox: str | None):
    """bbox = 'minLon,minLat,maxLon,maxLat'"""
    if not bbox:
        return None
    x1, y1, x2, y2 = [float(v) for v in bbox.split(",")]
    return func.ST_Intersects(column, func.ST_MakeEnvelope(x1, y1, x2, y2, 4326))


def near_bbox(column, lon: float, lat: float, tol_m: float):
    """Điều kiện `&&` theo khung bao quanh điểm (độ) – dùng được chỉ mục GIST trên cột geometry,
    nên đặt trước phép lọc ST_DWithin(geography) vốn không dùng được chỉ mục."""
    dlat = tol_m / 111_320 * 1.01
    dlon = tol_m / (111_320 * max(0.01, math.cos(math.radians(lat)))) * 1.01
    return column.op("&&")(func.ST_MakeEnvelope(lon - dlon, lat - dlat, lon + dlon, lat + dlat, 4326))


def dumps(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)
