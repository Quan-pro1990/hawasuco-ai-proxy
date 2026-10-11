from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import LoginOut, UserIn
from ..security import create_token, get_current_user, hash_password, require_admin, verify_password

router = APIRouter(prefix="/api/auth", tags=["Xác thực"])


def user_dict(u: User) -> dict:
    return {"id": u.id, "username": u.username, "full_name": u.full_name, "role": u.role}


@router.post("/login", response_model=LoginOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    u = db.query(User).filter(User.username == form.username).first()
    if not u or not verify_password(form.password, u.password_hash):
        raise HTTPException(400, "Sai tên đăng nhập hoặc mật khẩu")
    return {"access_token": create_token(u.username), "user": user_dict(u)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_dict(user)


@router.get("/users")
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    return [user_dict(u) for u in db.query(User).order_by(User.id)]


@router.post("/users")
def create_user(data: UserIn, db: Session = Depends(get_db), _=Depends(require_admin)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(400, "Tên đăng nhập đã tồn tại")
    u = User(username=data.username, full_name=data.full_name, role=data.role,
             password_hash=hash_password(data.password))
    db.add(u)
    db.commit()
    return user_dict(u)


@router.delete("/users/{uid}")
def delete_user(uid: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "Không tìm thấy")
    if u.id == admin.id:
        raise HTTPException(400, "Không thể xóa chính mình")
    db.delete(u)
    db.commit()
    return {"ok": True}
