from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

SQL_DIR = Path(__file__).parent / "sql"
# Thứ tự chạy sau khi tạo bảng: nâng cấp cột cũ -> trigger/view cho QGIS -> hàm vector tiles
SQL_FILES = ("migrations.sql", "postgis_extras.sql", "vector_tiles.sql")
# Khóa tư vấn: nhiều worker uvicorn khởi động cùng lúc không chạy DDL chồng nhau
INIT_LOCK_ID = 727_274_001


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from . import models  # noqa: F401

    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    with engine.connect() as lock_conn:
        lock_conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": INIT_LOCK_ID})
        try:
            Base.metadata.create_all(bind=engine)
            for name in SQL_FILES:
                with engine.begin() as conn:
                    conn.exec_driver_sql((SQL_DIR / name).read_text(encoding="utf-8"))
        finally:
            lock_conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": INIT_LOCK_ID})
            lock_conn.commit()
