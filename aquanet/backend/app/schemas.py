from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field

from .models import INCIDENT_STATUS, INCIDENT_TYPES, NODE_TYPES, SEVERITY

Geometry = dict[str, Any]  # GeoJSON geometry


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserIn(BaseModel):
    username: str
    full_name: str = ""
    password: str
    role: Literal["admin", "engineer", "viewer"] = "viewer"


# ---------- Mạng lưới ----------
class NodeIn(BaseModel):
    code: str | None = None
    node_type: Literal[tuple(NODE_TYPES)] = "junction"  # type: ignore[valid-type]
    status: str = "open"
    diameter_mm: int | None = None
    elevation_m: float | None = None
    install_year: int | None = None
    zone_id: int | None = None
    address: str | None = None
    note: str | None = None
    geometry: Geometry


class NodeUpdate(BaseModel):
    code: str | None = None
    node_type: Literal[tuple(NODE_TYPES)] | None = None  # type: ignore[valid-type]
    status: str | None = None
    diameter_mm: int | None = None
    elevation_m: float | None = None
    install_year: int | None = None
    zone_id: int | None = None
    address: str | None = None
    note: str | None = None
    geometry: Geometry | None = None


class PipeIn(BaseModel):
    code: str | None = None
    material: str = "HDPE"
    diameter_mm: int = 110
    install_year: int | None = None
    status: str = "active"
    pipe_class: str = "distribution"
    zone_id: int | None = None
    street: str | None = None
    note: str | None = None
    geometry: Geometry  # LineString


class PipeUpdate(BaseModel):
    code: str | None = None
    material: str | None = None
    diameter_mm: int | None = None
    install_year: int | None = None
    status: str | None = None
    pipe_class: str | None = None
    zone_id: int | None = None
    street: str | None = None
    note: str | None = None
    geometry: Geometry | None = None


class ZoneIn(BaseModel):
    code: str
    name: str
    note: str | None = None
    geometry: Geometry


# ---------- Khách hàng ----------
class CustomerIn(BaseModel):
    code: str | None = None
    name: str
    address: str | None = None
    phone: str | None = None
    customer_type: str = "household"
    status: str = "active"
    zone_id: int | None = None
    pipe_id: int | None = None
    geometry: Geometry | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    customer_type: str | None = None
    status: str | None = None
    zone_id: int | None = None
    pipe_id: int | None = None
    geometry: Geometry | None = None


class MeterIn(BaseModel):
    serial: str
    size_mm: int = 15
    brand: str | None = None
    install_date: date | None = None
    status: str = "active"


class ReadingIn(BaseModel):
    meter_id: int
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    reading: float


class InflowIn(BaseModel):
    zone_id: int
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    volume_m3: float


# ---------- Sự cố ----------
class IncidentIn(BaseModel):
    incident_type: Literal[tuple(INCIDENT_TYPES)] = "leak"  # type: ignore[valid-type]
    severity: Literal[tuple(SEVERITY)] = "medium"  # type: ignore[valid-type]
    title: str
    description: str | None = None
    reporter: str | None = None
    reporter_phone: str | None = None
    assignee: str | None = None
    pipe_id: int | None = None
    node_id: int | None = None
    geometry: Geometry


class IncidentUpdate(BaseModel):
    incident_type: Literal[tuple(INCIDENT_TYPES)] | None = None  # type: ignore[valid-type]
    severity: Literal[tuple(SEVERITY)] | None = None  # type: ignore[valid-type]
    status: Literal[tuple(INCIDENT_STATUS)] | None = None  # type: ignore[valid-type]
    title: str | None = None
    description: str | None = None
    assignee: str | None = None
    pipe_id: int | None = None
    repair_cost: float | None = None
    est_loss_m3: float | None = None
    resolution: str | None = None
    note: str | None = None  # ghi chú nhật ký khi đổi trạng thái
    geometry: Geometry | None = None
