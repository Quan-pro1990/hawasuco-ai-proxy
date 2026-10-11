"""Đẩy số liệu SCADA theo thời gian thực tới trình duyệt.

Luồng: API nhận số liệu -> `pg_notify` (gửi khi transaction commit) -> mỗi worker uvicorn có một
kết nối LISTEN -> phân phát tới các client đang mở luồng Server-Sent Events. Nhờ đi qua PostgreSQL,
chạy nhiều worker hoặc nhiều máy chủ ứng dụng vẫn nhận đủ sự kiện.
"""
import asyncio
import contextlib
import json
import logging
import sys

import psycopg
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import settings

CHANNEL = "aquanet_realtime"
MAX_PAYLOAD = 7000  # giới hạn của pg_notify là 8000 byte
log = logging.getLogger("aquanet.realtime")


def _libpq_url(url: str) -> str:
    for prefix in ("postgresql+psycopg://", "postgresql+psycopg2://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix):]
    return url


class Hub:
    def __init__(self):
        self._queues: set[asyncio.Queue] = set()
        self._task: asyncio.Task | None = None

    async def start(self):
        if self._task is None:
            self._task = asyncio.create_task(self._listen())

    async def stop(self):
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._task
            self._task = None

    def subscribe(self, maxsize: int = 500) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize)
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._queues.discard(q)

    def _dispatch(self, payload: str):
        for q in list(self._queues):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:  # client quá chậm: bỏ sự kiện cũ nhất
                with contextlib.suppress(asyncio.QueueEmpty):
                    q.get_nowait()
                q.put_nowait(payload)

    async def _listen(self):
        if sys.platform == "win32" and isinstance(asyncio.get_running_loop(), asyncio.ProactorEventLoop):
            # psycopg bất đồng bộ không chạy trên ProactorEventLoop (mặc định của uvicorn trên Windows)
            log.warning("Tắt số liệu thời gian thực: hãy chạy bằng iis/run_iis.py hoặc "
                        "uvicorn --loop asyncio:SelectorEventLoop")
            return
        delay = 1.0
        while True:
            try:
                async with await psycopg.AsyncConnection.connect(_libpq_url(settings.DATABASE_URL),
                                                                 autocommit=True) as conn:
                    await conn.execute(f"LISTEN {CHANNEL}")
                    delay = 1.0
                    async for n in conn.notifies():
                        self._dispatch(n.payload)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 – mất kết nối CSDL: thử lại
                log.warning("Mất kết nối LISTEN (%s), thử lại sau %.0fs", e, delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)


hub = Hub()


def publish(db: Session, event_type: str, items: list[dict]):
    """Gửi sự kiện (chia nhỏ theo giới hạn pg_notify). Chỉ phát đi khi transaction của `db` commit."""
    chunk: list[dict] = []
    size = 0
    for it in items:
        s = len(json.dumps(it, ensure_ascii=False, default=str))
        if chunk and size + s > MAX_PAYLOAD:
            _notify(db, event_type, chunk)
            chunk, size = [], 0
        chunk.append(it)
        size += s + 1
    if chunk:
        _notify(db, event_type, chunk)


def _notify(db: Session, event_type: str, items: list[dict]):
    payload = json.dumps({"type": event_type, "items": items}, ensure_ascii=False, default=str)
    db.execute(text("SELECT pg_notify(:c, :p)"), {"c": CHANNEL, "p": payload})
