"""Nhập/xuất dữ liệu GeoJSON & CSV – trao đổi với QGIS, Excel."""
import csv
import io
import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import shape
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..geo import feature_collection, row_props
from ..models import NODE_TYPES, Customer, Incident, Node, Pipe, Zone
from ..security import get_current_user, require_editor
from ..services.topology import connect_pipe, next_code

router = APIRouter(prefix="/api", tags=["Nhập / xuất"])

LAYERS = {"pipes": Pipe, "nodes": Node, "customers": Customer, "incidents": Incident, "zones": Zone}


@router.get("/export/{layer}", dependencies=[Depends(get_current_user)])
def export_layer(layer: str, format: str = "geojson", db: Session = Depends(get_db)):
    model = LAYERS.get(layer)
    if not model:
        raise HTTPException(404, "Lớp không hợp lệ")
    objs = db.scalars(select(model).order_by(model.id)).all()
    if format == "csv":
        buf = io.StringIO()
        buf.write("﻿")  # BOM cho Excel đọc đúng tiếng Việt
        rows = []
        for o in objs:
            r = row_props(o)
            r.pop("isolation", None)
            r["wkt"] = to_shape(o.geom).wkt if o.geom is not None else ""
            rows.append(r)
        if rows:
            w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        return Response(buf.getvalue(), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="{layer}.csv"'})
    fc = feature_collection(objs)
    for f in fc["features"]:
        f["properties"].pop("isolation", None)
    fc["crs"] = {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::4326"}}
    return Response(json.dumps(fc, ensure_ascii=False), media_type="application/geo+json",
                    headers={"Content-Disposition": f'attachment; filename="{layer}.geojson"'})


def _pick(props: dict, *keys, default=None, cast=None):
    low = {k.lower(): v for k, v in props.items()}
    for k in keys:
        v = low.get(k.lower())
        if v not in (None, ""):
            try:
                return cast(v) if cast else v
            except (TypeError, ValueError):
                continue
    return default


@router.post("/import/{layer}", dependencies=[Depends(require_editor)])
async def import_layer(layer: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Nhập GeoJSON (EPSG:4326) xuất từ QGIS. Hỗ trợ: pipes, nodes, customers."""
    try:
        fc = json.loads((await file.read()).decode("utf-8-sig"))
    except Exception:
        raise HTTPException(400, "Tệp không phải GeoJSON hợp lệ")
    feats = fc.get("features", [])
    created, errors = 0, []
    for idx, f in enumerate(feats):
        sp = db.begin_nested()  # savepoint: lỗi 1 đối tượng không làm hỏng cả lô
        try:
            g = shape(f["geometry"])
            p = f.get("properties") or {}
            if layer == "pipes":
                parts = list(g.geoms) if g.geom_type == "MultiLineString" else [g]
                for part in parts:
                    code = _pick(p, "code", "ma_ong", "id_ong")
                    if code and db.scalar(select(Pipe.id).where(Pipe.code == str(code))):
                        code = None
                    pipe = Pipe(
                        code=str(code) if code else next_code(db, Pipe, "P"),
                        material=str(_pick(p, "material", "vat_lieu", "vatlieu", default="HDPE")).upper(),
                        diameter_mm=_pick(p, "diameter_mm", "diameter", "dn", "duong_kinh", default=110, cast=int),
                        install_year=_pick(p, "install_year", "year", "nam_lap", cast=int),
                        street=_pick(p, "street", "duong", "ten_duong"),
                        geom=from_shape(part, srid=4326),
                    )
                    db.add(pipe)
                    db.flush()
                    connect_pipe(db, pipe)
                    created += 1
            elif layer == "nodes":
                t = str(_pick(p, "node_type", "type", "loai", default="junction")).lower()
                n = Node(
                    code=str(_pick(p, "code", "ma") or next_code(db, Node, "N")),
                    node_type=t if t in NODE_TYPES else "junction",
                    status=str(_pick(p, "status", "trang_thai", default="open" if t == "valve" else "active")),
                    diameter_mm=_pick(p, "diameter_mm", "dn", cast=int),
                    install_year=_pick(p, "install_year", "nam_lap", cast=int),
                    geom=from_shape(g, srid=4326),
                )
                db.add(n)
                created += 1
            elif layer == "customers":
                c = Customer(
                    code=str(_pick(p, "code", "ma_kh") or next_code(db, Customer, "KH")),
                    name=str(_pick(p, "name", "ten", "ten_kh", default="(chưa có tên)")),
                    address=_pick(p, "address", "dia_chi"),
                    phone=_pick(p, "phone", "dien_thoai"),
                    geom=from_shape(g, srid=4326),
                )
                db.add(c)
                created += 1
            else:
                raise HTTPException(400, "Chỉ hỗ trợ nhập pipes, nodes, customers")
            db.flush()
            sp.commit()
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            sp.rollback()
            errors.append(f"Đối tượng #{idx}: {e}")
            if len(errors) > 50:
                break
    db.commit()
    return {"created": created, "errors": errors}
