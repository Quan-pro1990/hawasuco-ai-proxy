from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import init_db
from .models import (INCIDENT_STATUS, INCIDENT_TYPES, MAINT_RESULTS, MAINT_STATUS, MAINT_TASK_TYPES,
                     MATERIAL_CATEGORIES, NODE_TYPES, PIPE_MATERIALS, SENSOR_TYPES, SENSOR_UNITS, SEVERITY,
                     USER_ROLES)
from .routers import (attachments, auth, customers, field, incidents, io, maintenance, network, reports, scada,
                      tiles)
from .services.realtime import hub


@asynccontextmanager
async def lifespan(_app):
    init_db()
    await hub.start()
    yield
    await hub.stop()


app = FastAPI(
    lifespan=lifespan,
    title="AquaNet GIS – Quản lý mạng lưới cấp nước",
    version="2.0.0",
    description="API quản lý mạng lưới cấp nước trên nền PostGIS (tương thích QGIS).",
)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
# nén gzip: lớp GeoJSON và vector tile nhỏ đi 3–6 lần (luồng SSE text/event-stream không bị nén)
app.add_middleware(GZipMiddleware, minimum_size=1024)

for r in (auth, network, incidents, customers, reports, io, scada, maintenance, field, attachments, tiles):
    app.include_router(r.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    """Danh mục dùng cho giao diện."""
    return {
        "node_types": NODE_TYPES,
        "pipe_materials": PIPE_MATERIALS,
        "incident_types": INCIDENT_TYPES,
        "incident_status": INCIDENT_STATUS,
        "severity": SEVERITY,
        "user_roles": USER_ROLES,
        "sensor_types": SENSOR_TYPES,
        "sensor_units": SENSOR_UNITS,
        "maintenance_task_types": MAINT_TASK_TYPES,
        "maintenance_status": MAINT_STATUS,
        "maintenance_results": MAINT_RESULTS,
        "material_categories": MATERIAL_CATEGORIES,
    }


# Phục vụ giao diện đã build (frontend/dist) nếu có – triển khai 1 cổng duy nhất
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
STATIC = Path(__file__).resolve().parents[1] / "static"
# Không cache: trang gốc và service worker phải luôn lấy bản mới để PWA tự cập nhật
NO_CACHE = {"index.html", "sw.js", "manifest.webmanifest"}
for root in (STATIC, DIST):
    if root.exists():
        app.mount("/assets", StaticFiles(directory=root / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str, _root=root.resolve()):
            f = (_root / path).resolve()
            # chỉ phục vụ tệp nằm trong thư mục giao diện (phòng thủ, không phụ thuộc chuẩn hóa đường dẫn của máy chủ)
            if not (path and f.is_relative_to(_root) and f.is_file()):
                f = _root / "index.html"
            headers = {"Cache-Control": "no-cache"} if f.name in NO_CACHE else None
            return FileResponse(f, headers=headers)

        break
