from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import init_db
from .models import INCIDENT_STATUS, INCIDENT_TYPES, NODE_TYPES, PIPE_MATERIALS, SEVERITY
from .routers import auth, customers, incidents, io, network, reports

@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="AquaNet GIS – Quản lý mạng lưới cấp nước",
    version="1.0.0",
    description="API quản lý mạng lưới cấp nước trên nền PostGIS (tương thích QGIS).",
)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth, network, incidents, customers, reports, io):
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
    }


# Phục vụ giao diện đã build (frontend/dist) nếu có – triển khai 1 cổng duy nhất
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
STATIC = Path(__file__).resolve().parents[1] / "static"
for root in (STATIC, DIST):
    if root.exists():
        app.mount("/assets", StaticFiles(directory=root / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str, _root=root):
            f = _root / path
            return FileResponse(f if path and f.is_file() else _root / "index.html")

        break
