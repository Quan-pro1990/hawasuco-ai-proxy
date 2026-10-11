"""Thu nhận số liệu SCADA / đồng hồ thông minh, đánh giá ngưỡng cảnh báo, mô hình số liệu mẫu."""
import math
import random
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Alarm, Sensor, Telemetry
from .realtime import publish

TZ = ZoneInfo(settings.TIMEZONE)
MAX_FUTURE = timedelta(minutes=10)  # chấp nhận lệch đồng hồ của RTU/datalogger

# Hệ số dùng nước theo giờ (khu dân cư đô thị Việt Nam), trung bình = 1.
# Dùng cho mẫu nhu cầu EPANET và sinh số liệu mô phỏng.
DIURNAL = [0.40, 0.30, 0.25, 0.25, 0.35, 0.75, 1.35, 1.60, 1.45, 1.20, 1.10, 1.15,
           1.25, 1.10, 1.00, 1.00, 1.10, 1.35, 1.55, 1.50, 1.25, 1.00, 0.75, 0.55]
_m = sum(DIURNAL) / 24
DIURNAL = [round(v / _m, 3) for v in DIURNAL]


# ---------------------------------------------------------------- nhận số liệu
def normalize_ts(ts: datetime | None, now: datetime) -> datetime:
    if ts is None:
        return now
    return ts.replace(tzinfo=TZ) if ts.tzinfo is None else ts


def ingest(db: Session, points: list[dict], now: datetime | None = None) -> dict:
    """points: [{sensor: mã hoặc external_id, ts: datetime|None, value: float}].

    Ghi đè khi trùng (sensor, ts) nên cổng thu thập gửi lại an toàn. Cập nhật giá trị mới nhất,
    đánh giá ngưỡng cảnh báo và phát sự kiện thời gian thực.
    """
    now = now or datetime.now(timezone.utc)
    keys = {str(p["sensor"]) for p in points}
    sensors = db.scalars(select(Sensor).where(or_(Sensor.code.in_(keys), Sensor.external_id.in_(keys)))).all()
    by_key: dict[str, Sensor] = {}
    for s in sensors:
        by_key[s.code] = s
        if s.external_id:
            by_key[s.external_id] = s
    rows: dict[tuple[int, datetime], float] = {}
    errors: list[str] = []
    for idx, p in enumerate(points):
        s = by_key.get(str(p["sensor"]))
        if s is None:
            errors.append(f"#{idx}: không có điểm đo '{p['sensor']}'")
            continue
        if not s.active:
            errors.append(f"#{idx}: điểm đo {s.code} đang ngưng hoạt động")
            continue
        ts = normalize_ts(p.get("ts"), now)
        if ts > now + MAX_FUTURE:
            errors.append(f"#{idx}: thời điểm {ts.isoformat()} ở tương lai")
            continue
        v = float(p["value"])
        if not math.isfinite(v):
            errors.append(f"#{idx}: giá trị không hợp lệ")
            continue
        rows[(s.id, ts)] = v  # trùng trong cùng lô: lấy giá trị sau cùng
    if rows:
        stmt = pg_insert(Telemetry).values([{"sensor_id": k[0], "ts": k[1], "value": v} for k, v in rows.items()])
        db.execute(stmt.on_conflict_do_update(index_elements=["sensor_id", "ts"], set_={"value": stmt.excluded.value}))

    latest: dict[int, tuple[datetime, float]] = {}
    for (sid, ts), v in rows.items():
        if sid not in latest or ts > latest[sid][0]:
            latest[sid] = (ts, v)
    by_id = {s.id: s for s in sensors}
    values, alarms = [], []
    for sid, (ts, v) in latest.items():
        s = by_id[sid]
        if s.last_ts is None or ts >= s.last_ts:
            s.last_ts, s.last_value = ts, v
            alarms += evaluate_alarm(db, s, v, ts)
            values.append({"id": s.id, "code": s.code, "value": v, "ts": ts.isoformat()})
    db.flush()
    if values:
        publish(db, "values", values)
    if alarms:
        publish(db, "alarms", alarms)
    return {"accepted": len(rows), "error_count": len(errors), "errors": errors[:100]}


def alarm_dict(a: Alarm, s: Sensor, event: str | None = None) -> dict:
    d = {"id": a.id, "sensor_id": s.id, "sensor_code": s.code, "sensor_name": s.name, "unit": s.unit,
         "kind": a.kind, "value": a.value, "threshold": a.threshold,
         "started_at": a.started_at.isoformat() if a.started_at else None,
         "cleared_at": a.cleared_at.isoformat() if a.cleared_at else None,
         "ack_by": a.ack_by, "ack_at": a.ack_at.isoformat() if a.ack_at else None}
    if event:
        d["event"] = event
    return d


def evaluate_alarm(db: Session, s: Sensor, v: float, ts: datetime) -> list[dict]:
    """So giá trị mới nhất với ngưỡng: mở cảnh báo mới, cập nhật đỉnh, hoặc tự xóa khi về bình thường."""
    if s.min_alarm is None and s.max_alarm is None:
        return []
    kind = ("high" if s.max_alarm is not None and v > s.max_alarm
            else "low" if s.min_alarm is not None and v < s.min_alarm else None)
    active = db.scalars(select(Alarm).where(Alarm.sensor_id == s.id, Alarm.cleared_at.is_(None))).all()
    out = []
    for a in active:
        if a.kind != kind:
            a.cleared_at = ts
            out.append(alarm_dict(a, s, "cleared"))
        elif (kind == "high" and v > a.value) or (kind == "low" and v < a.value):
            a.value = v  # giữ giá trị vượt ngưỡng xa nhất
    if kind and not any(a.kind == kind for a in active):
        a = Alarm(sensor_id=s.id, kind=kind, value=v, started_at=ts,
                  threshold=s.max_alarm if kind == "high" else s.min_alarm)
        db.add(a)
        db.flush()
        out.append(alarm_dict(a, s, "raised"))
    return out


def clear_alarms_if_unbounded(db: Session, s: Sensor):
    """Gỡ ngưỡng thì đóng các cảnh báo đang mở của điểm đo đó."""
    now = datetime.now(timezone.utc)
    for a in db.scalars(select(Alarm).where(Alarm.sensor_id == s.id, Alarm.cleared_at.is_(None))):
        if (a.kind == "high" and s.max_alarm is None) or (a.kind == "low" and s.min_alarm is None):
            a.cleared_at = now


def sensor_status(s: Sensor, now: datetime, alarmed: set[int]) -> str:
    if not s.active:
        return "inactive"
    if s.last_ts is None or now - s.last_ts > timedelta(minutes=s.stale_minutes or 60):
        return "offline"
    return "alarm" if s.id in alarmed else "normal"


# ---------------------------------------------------------------- mô hình số liệu mẫu / mô phỏng
def diurnal(local_dt: datetime) -> float:
    h = local_dt.hour + local_dt.minute / 60
    i = int(h) % 24
    f = h - int(h)
    return DIURNAL[i] * (1 - f) + DIURNAL[(i + 1) % 24] * f


def model_value(sensor_type: str, p: dict, ts: datetime, rng: random.Random, prev: float | None = None,
                dt_hours: float = 0.25) -> float:
    """Sinh một giá trị hợp lý theo giờ trong ngày.

    p (tham số): flow {q, leak} · pressure {p0, k} · level {mid, amp} · totalizer/smart_meter {rate}
    · quality {mean}
    """
    d = diurnal(ts.astimezone(TZ))
    if sensor_type == "flow":
        return round(max(0.0, p["leak"] + p["q"] * d * rng.gauss(1, 0.04)), 2)
    if sensor_type == "pressure":
        return round(max(0.0, p["p0"] - p["k"] * d * d + rng.gauss(0, 0.04)), 3)
    if sensor_type == "level":
        h = ts.astimezone(TZ).hour + ts.astimezone(TZ).minute / 60
        return round(p["mid"] + p["amp"] * math.cos((h - 3) / 24 * 2 * math.pi) + rng.gauss(0, 0.02), 3)
    if sensor_type in ("totalizer", "smart_meter"):
        base = prev if prev is not None else p.get("start", 0.0)
        return round(base + max(0.0, p["rate"] * d * dt_hours * rng.gauss(1, 0.15)), 3)
    if sensor_type == "quality":
        return round(max(0.0, p["mean"] + rng.gauss(0, 0.03)), 3)
    return round(rng.gauss(p.get("mean", 1.0), 0.05), 3)


def estimate_params(db: Session, s: Sensor, days: int = 7) -> dict:
    """Ước lượng tham số mô phỏng từ lịch sử để chuỗi số liệu mô phỏng nối tiếp liền mạch."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    q = select(func.avg(Telemetry.value), func.min(Telemetry.value), func.max(Telemetry.value),
               func.count()).where(Telemetry.sensor_id == s.id, Telemetry.ts >= since)
    avg, mn, mx, n = db.execute(q).one()
    t = s.sensor_type
    if not n:
        return {"flow": {"q": 40.0, "leak": 8.0}, "pressure": {"p0": 3.6, "k": 0.7},
                "level": {"mid": 3.0, "amp": 0.8}, "quality": {"mean": 0.45}}.get(
            t, {"rate": 0.03, "start": s.last_value or 0.0})
    if t == "flow":
        q = max(0.1, (avg - mn) / (1 - min(DIURNAL)))
        return {"q": q, "leak": max(0.0, avg - q)}
    if t == "pressure":
        return {"p0": mx + 0.05, "k": max(0.05, (mx - avg) / 1.1)}
    if t == "level":
        return {"mid": avg, "amp": max(0.05, (mx - mn) / 2)}
    if t in ("totalizer", "smart_meter"):
        first = db.scalar(select(Telemetry.value).where(Telemetry.sensor_id == s.id, Telemetry.ts >= since)
                          .order_by(Telemetry.ts).limit(1))
        return {"rate": max(0.0, (mx - first) / (days * 24)) if first is not None else 0.03}
    return {"mean": avg}
