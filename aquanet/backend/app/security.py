from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
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


def require_editor(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "engineer"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền chỉnh sửa")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ quản trị viên được thực hiện")
    return user
