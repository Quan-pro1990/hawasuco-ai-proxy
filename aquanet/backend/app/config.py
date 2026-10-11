import os
from pathlib import Path


def _list(name: str, default: str = "") -> list[str]:
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/capnuoc"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "doi-khoa-bi-mat-nay-khi-trien-khai")
    TOKEN_EXPIRE_MINUTES: int = int(os.getenv("TOKEN_EXPIRE_MINUTES", "720"))
    # Dung sai bắt điểm (m) khi nối đầu ống vào nút có sẵn
    SNAP_TOLERANCE_M: float = float(os.getenv("SNAP_TOLERANCE_M", "2.0"))
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")
    # Múi giờ dùng cho dữ liệu SCADA không kèm múi giờ và tính lưu lượng đêm nhỏ nhất
    TIMEZONE: str = os.getenv("TIMEZONE", "Asia/Ho_Chi_Minh")

    # ---- Ảnh hiện trường
    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", str(Path(__file__).resolve().parents[1] / "data" / "uploads")))
    MAX_UPLOAD_MB: float = float(os.getenv("MAX_UPLOAD_MB", "10"))

    # ---- SCADA / đồng hồ thông minh: khóa API cho cổng thu thập dữ liệu (phân cách bằng dấu phẩy)
    INGEST_API_KEYS: list[str] = _list("INGEST_API_KEYS")

    # ---- Vector tiles
    # Mẫu URL tile cho giao diện. Mặc định dùng API tích hợp; đổi sang Martin/pg_tileserv nếu chạy riêng, ví dụ
    #   http://may-chu:3000/aquanet_network/{z}/{x}/{y}            (Martin)
    #   http://may-chu:7800/postgisftw.aquanet_network/{z}/{x}/{y}.pbf  (pg_tileserv)
    TILE_URL_TEMPLATE: str = os.getenv("TILE_URL_TEMPLATE", "/api/tiles/{z}/{x}/{y}.pbf")
    # Tổng số ống + nút vượt ngưỡng này thì bản đồ tự chuyển sang vector tiles
    VECTOR_TILE_THRESHOLD: int = int(os.getenv("VECTOR_TILE_THRESHOLD", "20000"))


settings = Settings()
