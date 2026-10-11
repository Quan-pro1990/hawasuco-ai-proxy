"""Bộ mô phỏng cổng thu thập SCADA / AMI – gửi số liệu giả lập qua API nhận số liệu.

Dùng để chạy thử, trình diễn màn hình giám sát khi chưa nối SCADA thật. Tham số mô phỏng được
ước lượng từ lịch sử 7 ngày của từng điểm đo nên chuỗi số liệu nối tiếp liền mạch.

    python -m app.scada_sim --url http://localhost:8000 --api-key <khóa trong INGEST_API_KEYS>
    python -m app.scada_sim --once                  # gửi một lượt rồi thoát
    python -m app.scada_sim --skip P-H0007          # giữ một logger ở trạng thái mất kết nối
"""
import argparse
import random
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from .config import settings
from .db import SessionLocal
from .models import Sensor
from .services.telemetry import estimate_params, model_value


def main():
    ap = argparse.ArgumentParser(description="Mô phỏng cổng SCADA/AMI gửi số liệu về AquaNet GIS")
    ap.add_argument("--url", default="http://localhost:8000", help="Địa chỉ máy chủ AquaNet")
    ap.add_argument("--api-key", default=(settings.INGEST_API_KEYS or [""])[0], help="Khóa X-API-Key")
    ap.add_argument("--interval", type=float, default=15, help="Số giây giữa hai lượt gửi")
    ap.add_argument("--once", action="store_true", help="Gửi một lượt rồi thoát")
    ap.add_argument("--skip", default="", help="Mã điểm đo không gửi (phân cách bằng dấu phẩy)")
    args = ap.parse_args()
    if not args.api_key:
        ap.error("Chưa có khóa API: đặt INGEST_API_KEYS hoặc truyền --api-key")
    skip = {c.strip() for c in args.skip.split(",") if c.strip()}

    with SessionLocal() as db:
        sensors = [s for s in db.scalars(select(Sensor).where(Sensor.active)).all() if s.code not in skip]
        params = {s.id: estimate_params(db, s) for s in sensors}
        state = {s.id: (s.last_value, s.last_ts) for s in sensors}
        meta = {s.id: (s.code, s.sensor_type) for s in sensors}
    rng = random.Random()
    print(f"Mô phỏng {len(meta)} điểm đo -> {args.url}/api/scada/ingest (Ctrl+C để dừng)")
    while True:
        now = datetime.now(timezone.utc)
        points = []
        for sid, (code, stype) in meta.items():
            prev, prev_ts = state[sid]
            dt_h = max(((now - prev_ts).total_seconds() if prev_ts else args.interval) / 3600, 1 / 3600)
            v = model_value(stype, params[sid], now, rng, prev, dt_h)
            state[sid] = (v, now)
            points.append({"sensor": code, "ts": now.isoformat(), "value": v})
        try:
            r = httpx.post(f"{args.url}/api/scada/ingest", json=points, headers={"X-API-Key": args.api_key},
                           timeout=30)
            r.raise_for_status()
            res = r.json()
            print(f"{now:%H:%M:%S} gửi {len(points)} điểm – nhận {res['accepted']}, lỗi {res['error_count']}")
        except httpx.HTTPError as e:
            print(f"{now:%H:%M:%S} lỗi gửi: {e}")
        if args.once:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
