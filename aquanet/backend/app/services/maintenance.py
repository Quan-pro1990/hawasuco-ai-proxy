"""Lập lịch bảo trì van, trụ cứu hỏa và quản lý kho vật tư."""
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import (MAINT_OPEN, Material, MaintenancePlan, MaintenanceTask, Node, StockMovement)
from .incidents import create_incident
from ..geo import geom_to_geojson

TASK_LABEL = {"exercise": "Vận hành van", "inspect": "Kiểm tra", "flush": "Xả rửa", "lubricate": "Bôi trơn",
              "repair": "Sửa chữa", "replace": "Thay thế"}
RESULT_LABEL = {"ok": "hoạt động tốt", "needs_repair": "cần sửa chữa", "inoperable": "không vận hành được"}


class StockError(ValueError):
    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.status = status


def task_code(db: Session) -> str:
    y = date.today().year
    n = db.scalar(select(func.count()).select_from(MaintenanceTask)
                  .where(MaintenanceTask.code.like(f"BT{y}-%"))) or 0
    while True:
        n += 1
        c = f"BT{y}-{n:05d}"
        if not db.scalar(select(MaintenanceTask.id).where(MaintenanceTask.code == c)):
            return c


def generate_tasks(db: Session, plan: MaintenancePlan, horizon_days: int = 30, limit: int = 1000,
                   today: date | None = None) -> list[MaintenanceTask]:
    """Sinh lệnh cho mọi thiết bị đến hạn trong `horizon_days` ngày tới.

    Hạn = lần hoàn thành gần nhất (cùng loại công việc) + chu kỳ; chưa từng làm thì đến hạn ngay.
    Bỏ qua thiết bị đang có lệnh cùng loại chưa đóng. Ưu tiên thiết bị quá hạn lâu nhất.
    """
    today = today or date.today()
    q = select(Node.id).where(Node.node_type == plan.node_type)
    if plan.zone_id:
        q = q.where(Node.zone_id == plan.zone_id)
    if plan.min_diameter:
        q = q.where(Node.diameter_mm >= plan.min_diameter)
    node_ids = db.scalars(q).all()
    if not node_ids:
        return []
    last_done = dict(db.execute(
        select(MaintenanceTask.node_id, func.max(MaintenanceTask.completed_at))
        .where(MaintenanceTask.task_type == plan.task_type, MaintenanceTask.status == "done",
               MaintenanceTask.node_id.in_(node_ids))
        .group_by(MaintenanceTask.node_id)
    ).all())
    busy = set(db.scalars(select(MaintenanceTask.node_id).where(
        MaintenanceTask.task_type == plan.task_type, MaintenanceTask.status.in_(MAINT_OPEN),
        MaintenanceTask.node_id.in_(node_ids))).all())
    horizon = today + timedelta(days=horizon_days)
    due: list[tuple[date, int]] = []
    for nid in node_ids:
        if nid in busy:
            continue
        last = last_done.get(nid)
        d = (last.date() + timedelta(days=plan.interval_days)) if last else today
        if d <= horizon:
            due.append((d, nid))
    due.sort()
    created = []
    for d, nid in due[:limit]:
        t = MaintenanceTask(code=task_code(db), plan_id=plan.id, node_id=nid, task_type=plan.task_type,
                            due_date=d, status="assigned" if plan.default_assignee else "planned",
                            assignee=plan.default_assignee, checklist=list(plan.checklist or []))
        db.add(t)
        db.flush()
        created.append(t)
    return created


def task_dict(t: MaintenanceTask, node: Node | None = None, today: date | None = None) -> dict:
    today = today or date.today()
    d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
    for k in ("due_date", "completed_at", "created_at"):
        if d[k] is not None:
            d[k] = d[k].isoformat()
    d["overdue"] = t.status in MAINT_OPEN and t.due_date < today
    d["task_label"] = TASK_LABEL.get(t.task_type, t.task_type)
    if node is not None:
        d.update(node_code=node.code, node_type=node.node_type, node_status=node.status,
                 node_diameter=node.diameter_mm, zone_id=node.zone_id, address=node.address,
                 geometry=geom_to_geojson(node.geom))
    return d


def complete_task(db: Session, t: MaintenanceTask, data: dict, user_label: str) -> MaintenanceTask:
    """Hoàn thành lệnh: lưu kết quả, xuất vật tư đã dùng, tự lập phiếu sự cố nếu thiết bị hỏng."""
    if t.status in ("done", "cancelled", "skipped"):
        raise StockError(f"Lệnh {t.code} đã đóng", 409)
    t.status = "done"
    t.result = data.get("result") or "ok"
    t.checklist_result = data.get("checklist_result")
    t.note = data.get("note") or t.note
    t.turns = data.get("turns")
    t.duration_min = data.get("duration_min")
    t.completed_at = data.get("completed_at") or datetime.now()
    t.completed_by = user_label
    if data.get("materials"):
        issue_materials(db, data["materials"], "task", t.id, user_label, note=f"Lệnh bảo trì {t.code}")
    if t.result != "ok" and data.get("create_incident", True):
        node = db.get(Node, t.node_id)
        what = {"valve": "Van", "hydrant": "Trụ cứu hỏa"}.get(node.node_type, "Thiết bị")
        inc = create_incident(
            db,
            {"incident_type": "valve_fault" if node.node_type == "valve" else "other",
             "severity": "high" if t.result == "inoperable" else "medium",
             "title": f"{what} {node.code} {RESULT_LABEL[t.result]}",
             "description": f"Phát hiện khi thực hiện lệnh bảo trì {t.code}. {t.note or ''}".strip(),
             "reporter": user_label, "node_id": node.id},
            geom_to_geojson(node.geom), user_label, log_note=f"Tạo từ lệnh bảo trì {t.code}")
        t.incident_id = inc.id
    db.flush()
    return t


# ---------------------------------------------------------------- kho vật tư
def move_stock(db: Session, material_id: int, qty: float, kind: str, user_label: str,
               ref_type: str | None = None, ref_id: int | None = None, note: str | None = None,
               unit_price: float | None = None) -> StockMovement:
    """Ghi một giao dịch kho. Khóa dòng vật tư (FOR UPDATE) để nhiều người xuất cùng lúc không âm kho."""
    m = db.scalar(select(Material).where(Material.id == material_id).with_for_update())
    if not m:
        raise StockError(f"Không tìm thấy vật tư {material_id}", 404)
    new = round(m.stock + qty, 4)
    if new < 0:
        raise StockError(f"Vật tư {m.code} không đủ tồn kho (còn {m.stock:g} {m.unit}, cần {-qty:g})")
    if kind == "in" and unit_price is not None and qty > 0:
        # giá bình quân gia quyền
        m.unit_price = round((max(m.stock, 0) * m.unit_price + qty * unit_price) / (max(m.stock, 0) + qty), 2)
    m.stock = new
    mv = StockMovement(material_id=m.id, kind=kind, qty=qty, balance=new, ref_type=ref_type, ref_id=ref_id,
                       note=note, user=user_label,
                       unit_price=unit_price if (kind == "in" and unit_price is not None) else m.unit_price)
    db.add(mv)
    db.flush()
    return mv


def issue_materials(db: Session, items: list[dict], ref_type: str, ref_id: int, user_label: str,
                    note: str | None = None) -> list[StockMovement]:
    """Xuất kho cho sự cố / lệnh bảo trì. Khóa theo thứ tự mã vật tư để tránh deadlock."""
    merged: dict[int, float] = {}
    for it in items:
        q = float(it["qty"])
        if q <= 0:
            raise StockError("Số lượng xuất phải lớn hơn 0", 400)
        merged[int(it["material_id"])] = merged.get(int(it["material_id"]), 0) + q
    return [move_stock(db, mid, -q, "out", user_label, ref_type, ref_id, note) for mid, q in sorted(merged.items())]


def usage_cost(db: Session, ref_type: str, ref_id: int) -> float:
    v = db.scalar(select(func.coalesce(func.sum(-StockMovement.qty * StockMovement.unit_price), 0))
                  .where(StockMovement.ref_type == ref_type, StockMovement.ref_id == ref_id,
                         StockMovement.kind == "out"))
    return round(float(v or 0), 0)
