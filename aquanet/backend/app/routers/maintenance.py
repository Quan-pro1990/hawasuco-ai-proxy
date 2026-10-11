"""Lập lịch bảo trì van, trụ cứu hỏa; quản lý kho vật tư."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..geo import row_props
from ..models import (MAINT_OPEN, Incident, Material, MaintenancePlan, MaintenanceTask, Node, StockMovement,
                      User)
from ..schemas import (IssueIn, MaterialIn, MaterialUpdate, PlanIn, StockAdjust, StockIn, TaskComplete, TaskIn,
                       TaskUpdate)
from ..security import get_current_user, require_admin, require_editor, require_field
from ..services.maintenance import (StockError, complete_task, generate_tasks, issue_materials, move_stock,
                                    task_code, task_dict, usage_cost)
from ..services.topology import next_code

router = APIRouter(prefix="/api", tags=["Bảo trì & vật tư"], dependencies=[Depends(get_current_user)])


def _who(u: User) -> str:
    return u.full_name or u.username


def _stock_error(e: StockError):
    raise HTTPException(e.status, str(e))


# ============================================================ Kế hoạch định kỳ
@router.get("/maintenance/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = db.scalars(select(MaintenancePlan).order_by(MaintenancePlan.id)).all()
    open_counts = dict(db.execute(select(MaintenanceTask.plan_id, func.count())
                                  .where(MaintenanceTask.status.in_(MAINT_OPEN)).group_by(MaintenanceTask.plan_id)).all())
    return [{**row_props(p), "open_tasks": open_counts.get(p.id, 0)} for p in plans]


@router.post("/maintenance/plans", dependencies=[Depends(require_editor)])
def create_plan(data: PlanIn, db: Session = Depends(get_db)):
    p = MaintenancePlan(**data.model_dump())
    db.add(p)
    db.commit()
    return row_props(p)


@router.put("/maintenance/plans/{pid}", dependencies=[Depends(require_editor)])
def update_plan(pid: int, data: PlanIn, db: Session = Depends(get_db)):
    p = db.get(MaintenancePlan, pid)
    if not p:
        raise HTTPException(404, "Không tìm thấy kế hoạch")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit()
    return row_props(p)


@router.delete("/maintenance/plans/{pid}", dependencies=[Depends(require_editor)])
def delete_plan(pid: int, db: Session = Depends(get_db)):
    p = db.get(MaintenancePlan, pid)
    if not p:
        raise HTTPException(404, "Không tìm thấy kế hoạch")
    db.delete(p)  # lệnh đã sinh vẫn giữ lại (plan_id = NULL)
    db.commit()
    return {"ok": True}


@router.post("/maintenance/plans/{pid}/generate", dependencies=[Depends(require_editor)])
def generate(pid: int, horizon_days: int = Query(30, ge=0, le=366), limit: int = Query(1000, ge=1, le=20000),
             db: Session = Depends(get_db)):
    """Sinh lệnh công việc cho các thiết bị đến hạn trong `horizon_days` ngày tới."""
    p = db.get(MaintenancePlan, pid)
    if not p:
        raise HTTPException(404, "Không tìm thấy kế hoạch")
    if not p.active:
        raise HTTPException(400, "Kế hoạch đang tạm dừng")
    created = generate_tasks(db, p, horizon_days, limit)
    db.commit()
    return {"created": len(created), "overdue": sum(1 for t in created if t.due_date < date.today())}


# ============================================================ Lệnh công việc
@router.get("/maintenance/tasks")
def list_tasks(status: str | None = None, open_only: bool = False, overdue: bool = False,
               due_within_days: int | None = None, node_type: str | None = None, node_id: int | None = None,
               zone_id: int | None = None, assignee: str | None = None, task_type: str | None = None,
               limit: int = Query(500, le=5000), db: Session = Depends(get_db)):
    today = date.today()
    q = select(MaintenanceTask, Node).join(Node, Node.id == MaintenanceTask.node_id)
    if status:
        q = q.where(MaintenanceTask.status.in_(status.split(",")))
    if open_only or overdue or due_within_days is not None:
        q = q.where(MaintenanceTask.status.in_(MAINT_OPEN))
    if overdue:
        q = q.where(MaintenanceTask.due_date < today)
    if due_within_days is not None:
        q = q.where(MaintenanceTask.due_date <= today + timedelta(days=due_within_days))
    if node_type:
        q = q.where(Node.node_type.in_(node_type.split(",")))
    if node_id:
        q = q.where(MaintenanceTask.node_id == node_id)
    if zone_id:
        q = q.where(Node.zone_id == zone_id)
    if assignee:
        q = q.where(MaintenanceTask.assignee.ilike(f"%{assignee}%"))
    if task_type:
        q = q.where(MaintenanceTask.task_type == task_type)
    order = (MaintenanceTask.completed_at.desc().nulls_last(), MaintenanceTask.due_date.desc()) if node_id \
        else (MaintenanceTask.due_date, MaintenanceTask.id)
    rows = db.execute(q.order_by(*order).limit(limit)).all()
    return [task_dict(t, n, today) for t, n in rows]


@router.get("/maintenance/summary")
def summary(db: Session = Depends(get_db)):
    today = date.today()
    open_q = select(Node.node_type, func.count()).select_from(MaintenanceTask) \
        .join(Node, Node.id == MaintenanceTask.node_id) \
        .where(MaintenanceTask.status.in_(MAINT_OPEN)).group_by(Node.node_type)
    overdue = dict(db.execute(open_q.where(MaintenanceTask.due_date < today)).all())
    due7 = dict(db.execute(open_q.where(MaintenanceTask.due_date >= today,
                                        MaintenanceTask.due_date <= today + timedelta(days=7))).all())
    due30 = dict(db.execute(open_q.where(MaintenanceTask.due_date >= today,
                                         MaintenanceTask.due_date <= today + timedelta(days=30))).all())
    year_start = date(today.year, 1, 1)
    done_year = dict(db.execute(select(Node.node_type, func.count()).select_from(MaintenanceTask)
                                .join(Node, Node.id == MaintenanceTask.node_id)
                                .where(MaintenanceTask.status == "done", MaintenanceTask.completed_at >= year_start)
                                .group_by(Node.node_type)).all())
    faults = dict(db.execute(select(MaintenanceTask.result, func.count())
                             .where(MaintenanceTask.status == "done", MaintenanceTask.completed_at >= year_start)
                             .group_by(MaintenanceTask.result)).all())
    # mức tuân thủ: tỷ lệ thiết bị đã được bảo trì trong chu kỳ của kế hoạch đang áp dụng
    compliance = []
    for p in db.scalars(select(MaintenancePlan).where(MaintenancePlan.active)):
        nq = select(func.count()).select_from(Node).where(Node.node_type == p.node_type)
        if p.zone_id:
            nq = nq.where(Node.zone_id == p.zone_id)
        if p.min_diameter:
            nq = nq.where(Node.diameter_mm >= p.min_diameter)
        total = db.scalar(nq) or 0
        dq = select(func.count(func.distinct(MaintenanceTask.node_id))).select_from(MaintenanceTask) \
            .join(Node, Node.id == MaintenanceTask.node_id) \
            .where(MaintenanceTask.status == "done", MaintenanceTask.task_type == p.task_type,
                   Node.node_type == p.node_type,
                   MaintenanceTask.completed_at >= today - timedelta(days=p.interval_days))
        if p.zone_id:
            dq = dq.where(Node.zone_id == p.zone_id)
        if p.min_diameter:
            dq = dq.where(Node.diameter_mm >= p.min_diameter)
        done = db.scalar(dq) or 0
        compliance.append({"plan_id": p.id, "plan": p.name, "node_type": p.node_type, "total": total,
                           "within_interval": done, "pct": round(done / total * 100, 1) if total else None})
    low_stock = db.scalar(select(func.count()).select_from(Material).where(Material.stock < Material.min_stock))
    return {"overdue": overdue, "due_7_days": due7, "due_30_days": due30, "done_this_year": done_year,
            "results_this_year": faults, "compliance": compliance, "low_stock_materials": low_stock}


def _task(db: Session, tid: int) -> MaintenanceTask:
    t = db.get(MaintenanceTask, tid)
    if not t:
        raise HTTPException(404, "Không tìm thấy lệnh công việc")
    return t


@router.get("/maintenance/tasks/{tid}")
def get_task(tid: int, db: Session = Depends(get_db)):
    t = _task(db, tid)
    d = task_dict(t, db.get(Node, t.node_id))
    d["materials"] = _usage(db, "task", t.id)
    return d


@router.post("/maintenance/tasks", dependencies=[Depends(require_editor)])
def create_task(data: TaskIn, db: Session = Depends(get_db)):
    n = db.get(Node, data.node_id)
    if not n:
        raise HTTPException(404, "Không tìm thấy thiết bị")
    t = MaintenanceTask(code=task_code(db), **data.model_dump(),
                        status="assigned" if data.assignee else "planned")
    db.add(t)
    db.commit()
    return task_dict(t, n)


@router.put("/maintenance/tasks/{tid}", dependencies=[Depends(require_editor)])
def update_task(tid: int, data: TaskUpdate, db: Session = Depends(get_db)):
    t = _task(db, tid)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("status") == "done":
        raise HTTPException(400, "Dùng chức năng Hoàn thành để ghi kết quả bảo trì")
    for k, v in changes.items():
        setattr(t, k, v)
    if "assignee" in changes and t.assignee and t.status == "planned" and "status" not in changes:
        t.status = "assigned"
    db.commit()
    return task_dict(t, db.get(Node, t.node_id))


@router.post("/maintenance/tasks/{tid}/complete")
def complete(tid: int, data: TaskComplete, db: Session = Depends(get_db), user: User = Depends(require_field)):
    t = _task(db, tid)
    try:
        complete_task(db, t, data.model_dump(), _who(user))
    except StockError as e:
        db.rollback()
        _stock_error(e)
    db.commit()
    return get_task(tid, db)


# ============================================================ Vật tư
def _material(db: Session, mid: int) -> Material:
    m = db.get(Material, mid)
    if not m:
        raise HTTPException(404, "Không tìm thấy vật tư")
    return m


def _mat_dict(m: Material) -> dict:
    d = row_props(m)
    d["low"] = m.stock < m.min_stock
    d["value"] = round(m.stock * m.unit_price, 0)
    return d


@router.get("/materials")
def list_materials(q: str | None = None, category: str | None = None, low: bool = False,
                   db: Session = Depends(get_db)):
    stmt = select(Material).order_by(Material.category, Material.code)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Material.code.ilike(like), Material.name.ilike(like), Material.spec.ilike(like)))
    if category:
        stmt = stmt.where(Material.category == category)
    if low:
        stmt = stmt.where(Material.stock < Material.min_stock)
    return [_mat_dict(m) for m in db.scalars(stmt)]


@router.post("/materials", dependencies=[Depends(require_editor)])
def create_material(data: MaterialIn, db: Session = Depends(get_db)):
    payload = data.model_dump()
    payload["code"] = payload["code"] or next_code(db, Material, "VT")
    if db.scalar(select(Material.id).where(Material.code == payload["code"])):
        raise HTTPException(400, "Mã vật tư đã tồn tại")
    m = Material(**payload, stock=0)
    db.add(m)
    db.commit()
    return _mat_dict(m)


@router.put("/materials/{mid}", dependencies=[Depends(require_editor)])
def update_material(mid: int, data: MaterialUpdate, db: Session = Depends(get_db)):
    m = _material(db, mid)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    return _mat_dict(m)


@router.delete("/materials/{mid}", dependencies=[Depends(require_admin)])
def delete_material(mid: int, db: Session = Depends(get_db)):
    m = _material(db, mid)
    if db.scalar(select(StockMovement.id).where(StockMovement.material_id == mid).limit(1)):
        raise HTTPException(409, "Vật tư đã có giao dịch nhập/xuất – không xóa được")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/materials/{mid}/receive")
def receive(mid: int, data: StockIn, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    """Nhập kho (cập nhật đơn giá bình quân gia quyền nếu có đơn giá)."""
    _material(db, mid)
    move_stock(db, mid, data.qty, "in", _who(user), note=data.note, unit_price=data.unit_price)
    db.commit()
    return _mat_dict(db.get(Material, mid))


@router.post("/materials/{mid}/adjust")
def adjust(mid: int, data: StockAdjust, db: Session = Depends(get_db), user: User = Depends(require_editor)):
    """Kiểm kê: đặt tồn kho bằng số đếm thực tế, ghi chênh lệch vào sổ."""
    m = _material(db, mid)
    delta = round(data.counted_qty - m.stock, 4)
    if delta:
        move_stock(db, mid, delta, "adjust", _who(user), note=data.note or "Kiểm kê")
    db.commit()
    return _mat_dict(db.get(Material, mid))


@router.post("/materials/issue")
def issue(data: IssueIn, db: Session = Depends(get_db), user: User = Depends(require_field)):
    """Xuất vật tư cho phiếu sự cố hoặc lệnh bảo trì."""
    model = Incident if data.ref_type == "incident" else MaintenanceTask
    if not db.get(model, data.ref_id):
        raise HTTPException(404, "Không tìm thấy phiếu/lệnh để xuất vật tư")
    try:
        issue_materials(db, [i.model_dump() for i in data.items], data.ref_type, data.ref_id, _who(user), data.note)
    except StockError as e:
        db.rollback()
        _stock_error(e)
    db.commit()
    return _usage(db, data.ref_type, data.ref_id)


def _usage(db: Session, ref_type: str, ref_id: int) -> dict:
    rows = db.execute(select(StockMovement, Material).join(Material, Material.id == StockMovement.material_id)
                      .where(StockMovement.ref_type == ref_type, StockMovement.ref_id == ref_id)
                      .order_by(StockMovement.id)).all()
    return {"items": [{"id": mv.id, "material_id": m.id, "code": m.code, "name": m.name, "unit": m.unit,
                       "qty": -mv.qty, "unit_price": mv.unit_price, "amount": round(-mv.qty * mv.unit_price, 0),
                       "user": mv.user, "created_at": mv.created_at.isoformat() if mv.created_at else None}
                      for mv, m in rows],
            "total_cost": usage_cost(db, ref_type, ref_id)}


@router.get("/materials/usage")
def usage(ref_type: str, ref_id: int, db: Session = Depends(get_db)):
    return _usage(db, ref_type, ref_id)


@router.get("/materials/movements")
def movements(material_id: int | None = None, kind: str | None = None, limit: int = Query(200, le=2000),
              db: Session = Depends(get_db)):
    q = select(StockMovement, Material).join(Material, Material.id == StockMovement.material_id)
    if material_id:
        q = q.where(StockMovement.material_id == material_id)
    if kind:
        q = q.where(StockMovement.kind == kind)
    rows = db.execute(q.order_by(StockMovement.id.desc()).limit(limit)).all()
    return [{**row_props(mv), "material_code": m.code, "material_name": m.name, "unit": m.unit} for mv, m in rows]
