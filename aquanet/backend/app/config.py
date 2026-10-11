import os


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/capnuoc"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "doi-khoa-bi-mat-nay-khi-trien-khai")
    TOKEN_EXPIRE_MINUTES: int = int(os.getenv("TOKEN_EXPIRE_MINUTES", "720"))
    # Dung sai bắt điểm (m) khi nối đầu ống vào nút có sẵn
    SNAP_TOLERANCE_M: float = float(os.getenv("SNAP_TOLERANCE_M", "2.0"))
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")


settings = Settings()
