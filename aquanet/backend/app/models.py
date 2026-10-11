"""Mô hình dữ liệu mạng lưới cấp nước (PostGIS, SRID 4326).

Các bảng không gian (zones, nodes, pipes, customers, incidents) có thể mở trực
tiếp trong QGIS qua kết nối PostgreSQL/PostGIS.
"""
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

# ---- Danh mục giá trị ----
NODE_TYPES = ["junction", "valve", "hydrant", "pump", "tank", "source", "bulk_meter"]
PIPE_MATERIALS = ["HDPE", "uPVC", "DI", "STEEL", "CI", "PPR", "AC"]
PIPE_STATUS = ["active", "abandoned", "planned"]
INCIDENT_TYPES = ["leak", "burst", "low_pressure", "water_quality", "valve_fault", "other"]
INCIDENT_STATUS = ["new", "assigned", "in_progress", "resolved", "closed"]
SEVERITY = ["low", "medium", "high", "critical"]
USER_ROLES = ["admin", "engineer", "viewer"]


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="viewer")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Zone(Base):
    """Vùng tách mạng / DMA (District Metered Area)."""

    __tablename__ = "zones"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    note: Mapped[str | None] = mapped_column(Text)
    geom = mapped_column(Geometry("MULTIPOLYGON", srid=4326))


class Node(Base):
    """Điểm mạng: nút nối, van, trụ cứu hỏa, trạm bơm, bể chứa, nguồn, đồng hồ tổng."""

    __tablename__ = "nodes"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    node_type: Mapped[str] = mapped_column(String(20), index=True, default="junction")
    # Van: open / closed; thiết bị khác: active / inactive
    status: Mapped[str] = mapped_column(String(20), default="open")
    diameter_mm: Mapped[int | None] = mapped_column(Integer)
    elevation_m: Mapped[float | None] = mapped_column(Float)
    install_year: Mapped[int | None] = mapped_column(Integer)
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"))
    address: Mapped[str | None] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(Text)
    geom = mapped_column(Geometry("POINT", srid=4326), nullable=False)


class Pipe(Base):
    """Đoạn ống nối hai nút (start_node -> end_node)."""

    __tablename__ = "pipes"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    material: Mapped[str] = mapped_column(String(20), default="HDPE")
    diameter_mm: Mapped[int] = mapped_column(Integer, default=110)
    length_m: Mapped[float] = mapped_column(Float, default=0)
    install_year: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="active")
    pipe_class: Mapped[str] = mapped_column(String(20), default="distribution")  # transmission/distribution/service
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"))
    start_node_id: Mapped[int | None] = mapped_column(ForeignKey("nodes.id", ondelete="SET NULL"), index=True)
    end_node_id: Mapped[int | None] = mapped_column(ForeignKey("nodes.id", ondelete="SET NULL"), index=True)
    street: Mapped[str | None] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(Text)
    geom = mapped_column(Geometry("LINESTRING", srid=4326), nullable=False)


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    address: Mapped[str | None] = mapped_column(String(250))
    phone: Mapped[str | None] = mapped_column(String(30))
    customer_type: Mapped[str] = mapped_column(String(20), default="household")  # household/business/agency/industrial
    status: Mapped[str] = mapped_column(String(20), default="active")
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"))
    pipe_id: Mapped[int | None] = mapped_column(ForeignKey("pipes.id", ondelete="SET NULL"), index=True)
    geom = mapped_column(Geometry("POINT", srid=4326))
    meters: Mapped[list["Meter"]] = relationship(back_populates="customer", cascade="all, delete-orphan")


class Meter(Base):
    __tablename__ = "meters"
    id: Mapped[int] = mapped_column(primary_key=True)
    serial: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"))
    size_mm: Mapped[int] = mapped_column(Integer, default=15)
    brand: Mapped[str | None] = mapped_column(String(60))
    install_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active/broken/replaced
    customer: Mapped[Customer] = relationship(back_populates="meters")
    readings: Mapped[list["MeterReading"]] = relationship(
        back_populates="meter", cascade="all, delete-orphan", order_by="MeterReading.period"
    )


class MeterReading(Base):
    __tablename__ = "meter_readings"
    __table_args__ = (UniqueConstraint("meter_id", "period"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    meter_id: Mapped[int] = mapped_column(ForeignKey("meters.id", ondelete="CASCADE"), index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)  # YYYY-MM
    reading: Mapped[float] = mapped_column(Float)  # chỉ số (m3)
    consumption: Mapped[float] = mapped_column(Float, default=0)  # tiêu thụ kỳ (m3)
    read_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    meter: Mapped[Meter] = relationship(back_populates="readings")


class ZoneInflow(Base):
    """Sản lượng cấp vào DMA theo kỳ (từ đồng hồ tổng) – dùng tính thất thoát."""

    __tablename__ = "zone_inflows"
    __table_args__ = (UniqueConstraint("zone_id", "period"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    zone_id: Mapped[int] = mapped_column(ForeignKey("zones.id", ondelete="CASCADE"))
    period: Mapped[str] = mapped_column(String(7))
    volume_m3: Mapped[float] = mapped_column(Float)


class Incident(Base):
    __tablename__ = "incidents"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    incident_type: Mapped[str] = mapped_column(String(20), default="leak")
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    reporter: Mapped[str | None] = mapped_column(String(120))
    reporter_phone: Mapped[str | None] = mapped_column(String(30))
    assignee: Mapped[str | None] = mapped_column(String(120))
    pipe_id: Mapped[int | None] = mapped_column(ForeignKey("pipes.id", ondelete="SET NULL"))
    node_id: Mapped[int | None] = mapped_column(ForeignKey("nodes.id", ondelete="SET NULL"))
    zone_id: Mapped[int | None] = mapped_column(ForeignKey("zones.id", ondelete="SET NULL"))
    reported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime)
    repair_cost: Mapped[float | None] = mapped_column(Float)
    est_loss_m3: Mapped[float | None] = mapped_column(Float)
    resolution: Mapped[str | None] = mapped_column(Text)
    isolation: Mapped[dict | None] = mapped_column(JSON)  # kết quả phân tích cô lập van
    geom = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    logs: Mapped[list["IncidentLog"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan", order_by="IncidentLog.created_at"
    )


class IncidentLog(Base):
    __tablename__ = "incident_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text)
    user: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    incident: Mapped[Incident] = relationship(back_populates="logs")
