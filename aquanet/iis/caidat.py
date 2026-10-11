"""Công cụ cài đặt AquaNet GIS trên máy chủ – được CaiDat-IIS.ps1 gọi, chạy bằng python của venv.

    python caidat.py taocsdl    tạo tài khoản + CSDL PostgreSQL + PostGIS (cần tài khoản superuser)
    python caidat.py khoitao    tạo bảng / nâng cấp CSDL; lần đầu tạo tài khoản quản trị
    python caidat.py matkhau    đặt lại mật khẩu (hoặc tạo) tài khoản quản trị
    python caidat.py kiemtra    kiểm tra kết nối CSDL

Mật khẩu truyền qua biến môi trường để không lộ trên dòng lệnh / danh sách tiến trình:
    PG_SUPER_PASSWORD       mật khẩu superuser PostgreSQL (taocsdl)
    AQUANET_DB_PASSWORD     mật khẩu tài khoản CSDL của ứng dụng (taocsdl)
    AQUANET_ADMIN_PASSWORD  mật khẩu tài khoản quản trị AquaNet (khoitao, matkhau)

Mã thoát: 0 thành công · 1 lỗi · 2 không kết nối / sai mật khẩu superuser (taocsdl)
          · 3 chưa có tài khoản quản trị và chưa có mật khẩu (khoitao).
"""
import argparse
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def fail(msg: str, code: int = 1):
    print(f"LỖI: {msg}", file=sys.stderr)
    sys.exit(code)


def load_settings(env_file: str | None):
    """Nạp aquanet.env (giống run_iis.py) trước khi import ứng dụng."""
    from run_iis import DATA, load_env

    load_env(Path(env_file) if env_file else DATA / "aquanet.env")
    if not os.environ.get("DATABASE_URL"):
        fail("Chưa có DATABASE_URL (tệp aquanet.env trong thư mục dữ liệu)")


def db_error(e: Exception):
    fail("Không kết nối / ghi được CSDL bằng DATABASE_URL trong aquanet.env.\n"
         "  - Dịch vụ PostgreSQL đã chạy chưa? Mật khẩu tài khoản CSDL có bị đổi không?\n"
         f"  Chi tiết: {getattr(e, 'orig', None) or e}")


def taocsdl(a):
    import psycopg
    from psycopg import sql

    su_pw = os.environ.get("PG_SUPER_PASSWORD", "")
    app_pw = os.environ.get("AQUANET_DB_PASSWORD", "")
    if not app_pw:
        fail("Thiếu AQUANET_DB_PASSWORD")
    params = dict(host=a.host, port=a.port, user=a.superuser, password=su_pw, connect_timeout=10)
    try:
        conn = psycopg.connect(dbname="postgres", autocommit=True, **params)
    except psycopg.OperationalError as e:
        fail(f"Không kết nối được PostgreSQL {a.host}:{a.port} bằng tài khoản '{a.superuser}'.\n"
             f"  - Dịch vụ PostgreSQL đã chạy chưa (services.msc)?\n"
             f"  - Mật khẩu có đúng là mật khẩu đặt khi cài PostgreSQL không?\n  Chi tiết: {e}", code=2)
    with conn:
        role = sql.Identifier(a.user)
        if conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (a.user,)).fetchone():
            conn.execute(sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {}").format(role, sql.Literal(app_pw)))
            print(f"Tài khoản CSDL '{a.user}': đã có – cập nhật mật khẩu")
        else:
            conn.execute(sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(role, sql.Literal(app_pw)))
            print(f"Tài khoản CSDL '{a.user}': đã tạo")
        owner = conn.execute("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = %s", (a.db,)).fetchone()
        if owner is None:
            conn.execute(sql.SQL("CREATE DATABASE {} OWNER {} ENCODING 'UTF8' TEMPLATE template0")
                         .format(sql.Identifier(a.db), role))
            print(f"CSDL '{a.db}': đã tạo")
        elif owner[0] != a.user:
            conn.execute(sql.SQL("ALTER DATABASE {} OWNER TO {}").format(sql.Identifier(a.db), role))
            print(f"CSDL '{a.db}': đã có (chủ cũ '{owner[0]}') – chuyển chủ sở hữu cho '{a.user}'")
        else:
            print(f"CSDL '{a.db}': đã có")
    with psycopg.connect(dbname=a.db, autocommit=True, **params) as c:
        if not c.execute("SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'").fetchone():
            fail("PostgreSQL chưa cài PostGIS. Mở Stack Builder (Start menu › PostgreSQL) › chọn máy chủ "
                 "› Spatial Extensions › PostGIS rồi chạy lại.")
        c.execute("CREATE EXTENSION IF NOT EXISTS postgis")
        # bảng cũ (nếu CSDL do người khác tạo trước) phải thuộc tài khoản ứng dụng thì mới nâng cấp được
        for (t,) in c.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> %s "
                              "AND tablename <> 'spatial_ref_sys'", (a.user,)).fetchall():
            c.execute(sql.SQL("ALTER TABLE public.{} OWNER TO {}").format(sql.Identifier(t), role))
        print("PostGIS:", c.execute("SELECT postgis_lib_version()").fetchone()[0])


def _admin(db, username: str, password: str):
    from app.models import User
    from app.security import hash_password

    u = db.query(User).filter(User.username == username).first()
    if u:
        u.password_hash, u.role = hash_password(password), "admin"
    else:
        db.add(User(username=username, full_name="Quản trị hệ thống", role="admin",
                    password_hash=hash_password(password)))
    db.commit()


def khoitao(a):
    load_settings(a.env)
    from sqlalchemy import func, select

    from app.db import SessionLocal, init_db
    from app.models import User

    init_db()  # tạo bảng mới, nâng cấp CSDL cũ, view, hàm vector tiles
    print("Cấu trúc CSDL: đã cập nhật")
    pw = os.environ.get("AQUANET_ADMIN_PASSWORD", "")
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            print("Tài khoản người dùng: đã có")
            return
    if not pw:
        print("Chưa có tài khoản quản trị – cần mật khẩu", file=sys.stderr)
        sys.exit(3)
    if a.dulieumau:
        from app import seed

        seed.run()
    with SessionLocal() as db:
        _admin(db, a.admin, pw)
    print(f"Tài khoản quản trị '{a.admin}': đã tạo" + (" (kèm dữ liệu mẫu)" if a.dulieumau else ""))


def matkhau(a):
    load_settings(a.env)
    from app.db import SessionLocal

    pw = os.environ.get("AQUANET_ADMIN_PASSWORD", "")
    if len(pw) < 8:
        fail("Mật khẩu quản trị phải có ít nhất 8 ký tự")
    with SessionLocal() as db:
        _admin(db, a.admin, pw)
    print(f"Đã đặt mật khẩu cho tài khoản quản trị '{a.admin}'")


def kiemtra(a):
    load_settings(a.env)
    from sqlalchemy import text

    from app.db import engine

    with engine.connect() as c:
        print(c.execute(text("SELECT version()")).scalar())
        print("PostGIS", c.execute(text("SELECT postgis_lib_version()")).scalar())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="lenh", required=True)
    p = sub.add_parser("taocsdl")
    p.add_argument("--host", default="localhost")
    p.add_argument("--port", type=int, default=5432)
    p.add_argument("--superuser", default="postgres")
    p.add_argument("--db", default="capnuoc")
    p.add_argument("--user", default="aquanet")
    for name in ("khoitao", "matkhau", "kiemtra"):
        p = sub.add_parser(name)
        p.add_argument("--env", help="Đường dẫn aquanet.env (mặc định trong thư mục dữ liệu)")
        p.add_argument("--admin", default="admin", help="Tên đăng nhập quản trị")
        if name == "khoitao":
            p.add_argument("--dulieumau", action="store_true", help="Tạo dữ liệu mẫu để dùng thử")
    a = ap.parse_args()
    from sqlalchemy.exc import OperationalError, ProgrammingError

    try:
        {"taocsdl": taocsdl, "khoitao": khoitao, "matkhau": matkhau, "kiemtra": kiemtra}[a.lenh](a)
    except (OperationalError, ProgrammingError) as e:
        db_error(e)


if __name__ == "__main__":
    main()
