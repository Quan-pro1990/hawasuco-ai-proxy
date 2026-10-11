from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from .models import (INCIDENT_STATUS, INCIDENT_TYPES, MAINT_RESULTS, MAINT_STATUS, MAINT_TASK_TYPES,
                     MATERIAL_CATEGORIES, NODE_TYPES, SENSOR_TYPES, SEVERITY)

Geometry = dict[str, Any]  # GeoJSON geometry


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserIn(BaseModel):
    username: str
    full_name: str = ""
    password: str
    role: Literal["admin", "engineer", "field", "viewer"] = "viewer"


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


# ---------- SCADA & đồng hồ thông minh
class SensorIn(BaseModel):
    code: str
    name: str
    sensor_type: Literal[tuple(SENSOR_TYPES)]  # type: ignore[valid-type]
    unit: str | None = None
    external_id: str | None = None
    node_id: int | None = None
    meter_id: int | None = None
    zone_id: int | None = None
    min_alarm: float | None = None
    max_alarm: float | None = None
    stale_minutes: int = Field(60, ge=1, le=10080)
    active: bool = True
    note: str | None = None
    geometry: Geometry | None = None


class SensorUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    external_id: str | None = None
    node_id: int | None = None
    meter_id: int | None = None
    zone_id: int | None = None
    min_alarm: float | None = None
    max_alarm: float | None = None
    stale_minutes: int | None = Field(None, ge=1, le=10080)
    active: bool | None = None
    note: str | None = None
    geometry: Geometry | None = None


class TelemetryPoint(BaseModel):
    sensor: str = Field(description="Mã điểm đo hoặc external_id (tag SCADA / mã thiết bị AMI)")
    ts: datetime | None = Field(None, description="Thời điểm đo (ISO 8601). Không có múi giờ: hiểu theo TIMEZONE")
    value: float = Field(allow_inf_nan=False)


# ---------- Bảo trì & vật tư
class PlanIn(BaseModel):
    name: str
    node_type: Literal[tuple(NODE_TYPES)]  # type: ignore[valid-type]
    task_type: Literal[tuple(MAINT_TASK_TYPES)] = "inspect"  # type: ignore[valid-type]
    interval_days: int = Field(365, ge=1, le=3650)
    zone_id: int | None = None
    min_diameter: int | None = None
    checklist: list[str] = []
    default_assignee: str | None = None
    active: bool = True
    note: str | None = None


class TaskIn(BaseModel):
    node_id: int
    task_type: Literal[tuple(MAINT_TASK_TYPES)] = "inspect"  # type: ignore[valid-type]
    due_date: date
    assignee: str | None = None
    checklist: list[str] = []
    note: str | None = None


class TaskUpdate(BaseModel):
    due_date: date | None = None
    status: Literal[tuple(MAINT_STATUS)] | None = None  # type: ignore[valid-type]
    assignee: str | None = None
    note: str | None = None


class MaterialUse(BaseModel):
    material_id: int
    qty: float = Field(gt=0)


class TaskComplete(BaseModel):
    result: Literal[tuple(MAINT_RESULTS)] = "ok"  # type: ignore[valid-type]
    checklist_result: dict[str, bool] | None = None
    note: str | None = None
    turns: float | None = Field(None, ge=0)
    duration_min: int | None = Field(None, ge=0)
    completed_at: datetime | None = None
    materials: list[MaterialUse] = []
    create_incident: bool = True  # thiết bị hỏng -> tự lập phiếu sự cố


class MaterialIn(BaseModel):
    code: str | None = None
    name: str
    category: Literal[tuple(MATERIAL_CATEGORIES)] = "other"  # type: ignore[valid-type]
    spec: str | None = None
    unit: str = "cái"
    unit_price: float = Field(0, ge=0)
    min_stock: float = Field(0, ge=0)
    location: str | None = None
    note: str | None = None


class MaterialUpdate(BaseModel):
    name: str | None = None
    category: Literal[tuple(MATERIAL_CATEGORIES)] | None = None  # type: ignore[valid-type]
    spec: str | None = None
    unit: str | None = None
    unit_price: float | None = Field(None, ge=0)
    min_stock: float | None = Field(None, ge=0)
    location: str | None = None
    note: str | None = None


class StockIn(BaseModel):
    qty: float = Field(gt=0)
    unit_price: float | None = Field(None, ge=0)
    note: str | None = None


class StockAdjust(BaseModel):
    counted_qty: float = Field(ge=0)
    note: str | None = None


class IssueIn(BaseModel):
    ref_type: Literal["incident", "task"]
    ref_id: int
    items: list[MaterialUse] = Field(min_length=1)
    note: str | None = None


# ---------- Ứng dụng hiện trường (đồng bộ offline)
class FieldOpIn(BaseModel):
    uuid: str = Field(min_length=8, max_length=80)
    kind: Literal["reading", "incident", "incident_update", "task_complete"]
    payload: dict[str, Any]
    created_at: datetime | None = None


class FieldSyncIn(BaseModel):
    ops: list[FieldOpIn] = Field(max_length=500)


class FieldReading(BaseModel):
    meter_id: int
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    reading: float = Field(ge=0, allow_inf_nan=False)
    note: str | None = None


class FieldIncident(BaseModel):
    incident_type: Literal[tuple(INCIDENT_TYPES)] = "leak"  # type: ignore[valid-type]
    severity: Literal[tuple(SEVERITY)] = "medium"  # type: ignore[valid-type]
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    reporter_phone: str | None = None
    pipe_id: int | None = None
    lon: float = Field(ge=-180, le=180)
    lat: float = Field(ge=-90, le=90)
    accuracy_m: float | None = None


class FieldIncidentUpdate(BaseModel):
    incident_id: int
    status: Literal[tuple(INCIDENT_STATUS)] | None = None  # type: ignore[valid-type]
    note: str | None = None


class FieldTaskComplete(TaskComplete):
    task_id: int
