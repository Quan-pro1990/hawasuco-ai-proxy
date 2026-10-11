import hmac
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
optional_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
EDITOR_ROLES = ("admin", "engineer")
FIELD_ROLES = ("admin", "engineer", "field")  # được ghi chỉ số, cập nhật hiện trường, hoàn thành lệnh bảo trì


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(username: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": username, "exp": exp}, settings.SECRET_KEY, algorithm=ALGORITHM)


def _user_from_token(token: str, db: Session) -> User:
    err = HTTPException(status.HTTP_401_UNAUTHORIZED, "Phiên đăng nhập không hợp lệ",
                        headers={"WWW-Authenticate": "Bearer"})
    try:
        username = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM]).get("sub")
    except JWTError:
        raise err
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise err
    return user


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    return _user_from_token(token, db)


def require_editor(user: User = Depends(get_current_user)) -> User:
    if user.role not in EDITOR_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền chỉnh sửa")
    return user


def require_field(user: User = Depends(get_current_user)) -> User:
    if user.role not in FIELD_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ tổ hiện trường hoặc kỹ thuật được thực hiện")
    return user


def require_ingest(x_api_key: str | None = Header(None), token: str | None = Depends(optional_oauth2),
                   db: Session = Depends(get_db)) -> str:
    """Cổng SCADA/AMI gửi số liệu bằng khóa API (header X-API-Key) hoặc người dùng kỹ thuật đăng nhập."""
    if x_api_key:
        if any(hmac.compare_digest(x_api_key.encode(), k.encode()) for k in settings.INGEST_API_KEYS):
            return "api-key"
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Khóa API không hợp lệ")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Thiếu khóa API hoặc phiên đăng nhập",
                            headers={"WWW-Authenticate": "Bearer"})
    user = _user_from_token(token, db)
    if user.role not in EDITOR_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền gửi số liệu đo")
    return user.username


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ quản trị viên được thực hiện")
    return user
