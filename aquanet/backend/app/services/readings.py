"""Ghi chỉ số đồng hồ – dùng chung cho văn phòng, tổ hiện trường và đồng hồ thông minh (AMI)."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Meter, MeterReading


class ReadingError(ValueError):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def save_reading(db: Session, meter_id: int, period: str, reading: float, source: str = "office",
                 read_by: str | None = None, note: str | None = None) -> MeterReading:
    """Lưu (hoặc ghi đè) chỉ số kỳ `period`; tự tính tiêu thụ và chặn chỉ số nhỏ hơn kỳ trước."""
    m = db.get(Meter, meter_id)
    if not m:
        raise ReadingError(f"Không tìm thấy đồng hồ {meter_id}", 404)
    prev = db.scalar(select(MeterReading).where(MeterReading.meter_id == m.id, MeterReading.period < period)
                     .order_by(MeterReading.period.desc()).limit(1))
    if prev and reading < prev.reading:
        raise ReadingError(f"Đồng hồ {m.serial}: chỉ số mới ({reading}) nhỏ hơn kỳ trước ({prev.reading})")
    cons = reading - prev.reading if prev else 0
    row = db.scalar(select(MeterReading).where(MeterReading.meter_id == m.id, MeterReading.period == period))
    if row:
        row.reading, row.consumption = reading, cons
    else:
        row = MeterReading(meter_id=m.id, period=period, reading=reading, consumption=cons)
        db.add(row)
    row.source = source
    row.read_at = datetime.now()
    if read_by is not None:
        row.read_by = read_by
    if note is not None:
        row.note = note
    # chỉ số kỳ sau (nếu đã có) phải tính lại tiêu thụ
    nxt = db.scalar(select(MeterReading).where(MeterReading.meter_id == m.id, MeterReading.period > period)
                    .order_by(MeterReading.period).limit(1))
    if nxt is not None:
        if nxt.reading < reading:
            raise ReadingError(f"Đồng hồ {m.serial}: chỉ số ({reading}) lớn hơn kỳ sau {nxt.period} ({nxt.reading})")
        nxt.consumption = nxt.reading - reading
    db.flush()
    return row
