"""Khởi động AquaNet GIS dưới IIS (ASP.NET Core Module V2, chế độ out-of-process).

IIS chạy tệp này bằng python.exe của môi trường ảo (venv) và chuyển mọi yêu cầu tới
http://127.0.0.1:%ASPNETCORE_PORT% – cổng do IIS tự chọn mỗi lần khởi động.

- Đọc cấu hình bí mật (chuỗi kết nối CSDL, SECRET_KEY…) từ %AQUANET_DULIEU%\\aquanet.env
- Ghi nhật ký vào %AQUANET_DULIEU%\\NhatKy\\aquanet.log (xoay vòng 10 tệp × 5 MB)
- Lỗi khi khởi động được ghi vào %AQUANET_DULIEU%\\loi-khoi-dong.txt
- Dùng SelectorEventLoop: trên Windows, ProactorEventLoop mặc định của uvicorn không chạy được
  kết nối CSDL bất đồng bộ (luồng số liệu SCADA thời gian thực).

Chạy thử bằng tay (cmd, tại thư mục cài đặt):  venv\\Scripts\\python.exe run_iis.py --port 8000
"""
import argparse
import asyncio
import logging
import logging.handlers
import os
import sys
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = Path(os.environ.get("AQUANET_DULIEU") or r"C:\AquaNetData")


def load_env(path: Path) -> None:
    """Đọc tệp KEY=VALUE vào biến môi trường; biến đã đặt sẵn (vd. trong web.config) được giữ nguyên."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def setup_logging(log_dir: Path) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    handler = logging.handlers.RotatingFileHandler(log_dir / "aquanet.log", maxBytes=5_000_000, backupCount=10,
                                                   encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.addHandler(handler)


def main() -> None:
    ap = argparse.ArgumentParser(description="Chạy AquaNet GIS sau IIS")
    ap.add_argument("--port", type=int, help="Cổng nội bộ (mặc định: ASPNETCORE_PORT do IIS cấp)")
    args = ap.parse_args()

    load_env(DATA / "aquanet.env")
    os.environ.setdefault("UPLOAD_DIR", str(DATA / "anh"))
    port = args.port or int(os.environ.get("ASPNETCORE_PORT") or 8000)
    setup_logging(DATA / "NhatKy")
    sys.path.insert(0, str(HERE))
    error_file = DATA / "loi-khoi-dong.txt"
    try:
        import uvicorn

        from app.main import app

        config = uvicorn.Config(app, host="127.0.0.1", port=port, proxy_headers=True,
                                forwarded_allow_ips="127.0.0.1", log_config=None, access_log=False)
        server = uvicorn.Server(config)
        logging.getLogger("aquanet").info("Khởi động AquaNet GIS, cổng nội bộ %s", port)
        error_file.unlink(missing_ok=True)
        with asyncio.Runner(loop_factory=asyncio.SelectorEventLoop) as runner:
            runner.run(server.serve())
    except Exception:
        error_file.write_text(traceback.format_exc(), encoding="utf-8")
        logging.getLogger("aquanet").exception("Không khởi động được AquaNet GIS")
        raise


if __name__ == "__main__":
    main()
