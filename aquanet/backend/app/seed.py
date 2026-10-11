"""Tạo dữ liệu mẫu: mạng lưới dạng ô bàn cờ ~1 km², 4 DMA, khách hàng, sự cố.

Chạy:  python -m app.seed            (chỉ tạo khi CSDL trống)
       python -m app.seed --reset    (xóa sạch và tạo lại)
"""
import random
import sys
from datetime import date, datetime, timedelta

from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import LineString, MultiPolygon, Point, box
from sqlalchemy import func, select, text

from .db import Base, SessionLocal, engine, init_db
from .models import (Customer, Incident, IncidentLog, Meter, MeterReading, Node, Pipe, User, Zone,
                     ZoneInflow)
from .security import hash_password
from .services.topology import connect_pipe, isolation_report, split_pipe_at_node

random.seed(42)
LAT0, LON0 = 10.9800, 106.6500  # gốc lưới (khu vực minh họa)
DLAT, DLON = 0.00135, 0.00137  # ~150 m
N = 8
H_STREETS = ["Lê Lợi", "Trần Hưng Đạo", "Nguyễn Trãi", "Hai Bà Trưng", "Lý Thường Kiệt", "Phan Đình Phùng",
             "Quang Trung", "Nguyễn Du"]
V_STREETS = ["Đường số 1", "Đường số 2", "Đường số 3", "Ngô Quyền", "Đường số 5", "Đường số 6",
             "Bạch Đằng", "Đường số 8"]
HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Võ", "Đặng", "Bùi", "Đỗ", "Ngô"]
DEM = ["Văn", "Thị", "Minh", "Thanh", "Hữu", "Ngọc", "Quốc", "Thu"]
TEN = ["An", "Bình", "Cường", "Dung", "Hà", "Hải", "Hoa", "Hùng", "Lan", "Long", "Mai", "Nam", "Phúc",
       "Quân", "Sơn", "Tâm", "Thảo", "Trang", "Tuấn", "Vy"]


def pt(i, j):
    return (LON0 + j * DLON, LAT0 + i * DLAT)


def run(reset: bool = False):
    if reset:
        with engine.begin() as conn:
            conn.execute(text("DROP VIEW IF EXISTS v_pipes, v_valves, v_open_incidents"))
        Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    if db.scalar(select(func.count()).select_from(Pipe)):
        print("CSDL đã có dữ liệu – bỏ qua (dùng --reset để tạo lại)")
        return

    # --- người dùng
    db.add_all([
        User(username="admin", full_name="Quản trị hệ thống", role="admin", password_hash=hash_password("admin123")),
        User(username="kythuat", full_name="Tổ kỹ thuật mạng", role="engineer", password_hash=hash_password("kythuat123")),
        User(username="xem", full_name="Người xem", role="viewer", password_hash=hash_password("xem123")),
    ])

    # --- 4 DMA
    mid_lat, mid_lon = LAT0 + (N - 1) / 2 * DLAT, LON0 + (N - 1) / 2 * DLON
    pad_lat, pad_lon = DLAT * 0.6, DLON * 0.6
    x1, y1 = LON0 - pad_lon, LAT0 - pad_lat
    x2, y2 = LON0 + (N - 1) * DLON + pad_lon, LAT0 + (N - 1) * DLAT + pad_lat
    zone_defs = [
        ("DMA-01", "DMA Tây Nam", box(x1, y1, mid_lon, mid_lat)),
        ("DMA-02", "DMA Đông Nam", box(mid_lon, y1, x2, mid_lat)),
        ("DMA-03", "DMA Tây Bắc", box(x1, mid_lat, mid_lon, y2)),
        ("DMA-04", "DMA Đông Bắc", box(mid_lon, mid_lat, x2, y2)),
    ]
    zones = []
    for code, name, poly in zone_defs:
        z = Zone(code=code, name=name, geom=from_shape(MultiPolygon([poly]), srid=4326))
        db.add(z)
        zones.append(z)
    db.flush()

    # --- nguồn: nhà máy nước + bể chứa phía Tây, ống truyền tải D400
    plant = Node(code="NM01", node_type="source", status="active", address="Nhà máy nước số 1",
                 geom=from_shape(Point(LON0 - 4 * DLON, LAT0 + 3.5 * DLAT), srid=4326))
    tank = Node(code="BC01", node_type="tank", status="active", elevation_m=28, address="Bể chứa 2.000 m³",
                geom=from_shape(Point(LON0 - 3.2 * DLON, LAT0 + 3.5 * DLAT), srid=4326))
    db.add_all([plant, tank])
    db.flush()

    def add_pipe(coords, **kw):
        p = Pipe(code=f"P{db.scalar(select(func.count()).select_from(Pipe)) + 1:05d}", geom=from_shape(LineString(coords), srid=4326), **kw)
        db.add(p)
        db.flush()
        connect_pipe(db, p)
        return p

    add_pipe([to_shape(plant.geom).coords[0], to_shape(tank.geom).coords[0]], material="STEEL", diameter_mm=500,
             install_year=2005, pipe_class="transmission", street="Tuyến nước sạch NM01")
    tank_xy = to_shape(tank.geom).coords[0]
    add_pipe([tank_xy, (LON0 - 1.5 * DLON, LAT0 + 3.5 * DLAT), pt(3, 0)], material="DI", diameter_mm=400,
             install_year=2005, pipe_class="transmission", street="Tuyến truyền tải chính")
    add_pipe([tank_xy, (LON0 - 1.5 * DLON, LAT0 + 4.5 * DLAT), pt(4, 0)], material="DI", diameter_mm=300,
             install_year=2012, pipe_class="transmission", street="Tuyến truyền tải phụ")

    # --- lưới phân phối
    def spec(main: bool, i: int, j: int):
        old = (i < 3 and j < 4)  # khu phố cũ
        if main:
            return dict(material="DI", diameter_mm=random.choice([200, 250]), install_year=random.randint(2003, 2012))
        if old:
            return dict(material=random.choice(["CI", "AC", "uPVC"]), diameter_mm=random.choice([100, 110, 150]),
                        install_year=random.randint(1985, 1998))
        return dict(material=random.choice(["HDPE", "HDPE", "uPVC"]), diameter_mm=random.choice([90, 110, 160]),
                    install_year=random.randint(2008, 2023))

    dist_pipes = []
    for i in range(N):
        for j in range(N - 1):  # ngang
            dist_pipes.append(add_pipe([pt(i, j), pt(i, j + 1)], street=H_STREETS[i], **spec(i in (3, 4), i, j)))
    for j in range(N):
        for i in range(N - 1):  # dọc
            dist_pipes.append(add_pipe([pt(i, j), pt(i + 1, j)], street=V_STREETS[j], **spec(j in (3, 4), i, j)))

    # gán DMA theo vị trí
    db.execute(text("UPDATE pipes p SET zone_id = z.id FROM zones z WHERE ST_Intersects(z.geom, ST_LineInterpolatePoint(p.geom, 0.5))"))
    db.execute(text("UPDATE nodes n SET zone_id = z.id FROM zones z WHERE ST_Intersects(z.geom, n.geom)"))

    # --- van: đặt gần đầu ~80% đoạn ống (tự tách ống)
    vcount = 0
    for p in list(dist_pipes):
        if random.random() < 0.8:
            line = to_shape(p.geom)
            frac = 0.12 if random.random() < 0.5 else 0.88
            vp = line.interpolate(frac, normalized=True)
            vcount += 1
            v = Node(code=f"V{vcount:05d}", node_type="valve", status="open", diameter_mm=p.diameter_mm,
                     install_year=p.install_year, zone_id=p.zone_id, geom=from_shape(vp, srid=4326))
            db.add(v)
            db.flush()
            split_pipe_at_node(db, v)
    # van ranh giới DMA thường đóng
    for v in db.scalars(select(Node).where(Node.node_type == "valve")).all():
        x, y = to_shape(v.geom).coords[0]
        if (abs(x - mid_lon) < DLON * 0.15 or abs(y - mid_lat) < DLAT * 0.15) and random.random() < 0.5:
            v.status = "closed"
    # van trên tuyến truyền tải
    for p in db.scalars(select(Pipe).where(Pipe.pipe_class == "transmission", Pipe.diameter_mm < 500)).all():
        vcount += 1
        v = Node(code=f"V{vcount:05d}", node_type="valve", status="open", diameter_mm=p.diameter_mm,
                 geom=from_shape(to_shape(p.geom).interpolate(0.9, normalized=True), srid=4326))
        db.add(v)
        db.flush()
        split_pipe_at_node(db, v)

    # --- đồng hồ tổng DMA + trụ cứu hỏa
    for k, (i, j) in enumerate([(1, 1), (1, 5), (5, 1), (5, 5)]):
        x, y = pt(i, j)
        bm = Node(code=f"DHT{k + 1:02d}", node_type="bulk_meter", status="active", diameter_mm=150,
                  zone_id=zones[k].id, geom=from_shape(Point(x + DLON * 0.5, y), srid=4326))
        db.add(bm)
        db.flush()
        split_pipe_at_node(db, bm)
    hc = 0
    for i in range(0, N, 2):
        for j in range(1, N - 1, 2):
            hc += 1
            x, y = pt(i, j)
            h = Node(code=f"H{hc:04d}", node_type="hydrant", status="active", diameter_mm=100,
                     install_year=random.randint(2005, 2020),
                     geom=from_shape(Point(x + DLON * 0.35, y), srid=4326))
            db.add(h)
            db.flush()
            split_pipe_at_node(db, h)
    db.execute(text("UPDATE nodes n SET zone_id = z.id FROM zones z WHERE n.zone_id IS NULL AND ST_Intersects(z.geom, n.geom)"))
    db.execute(text("UPDATE pipes p SET zone_id = z.id FROM zones z WHERE p.zone_id IS NULL AND ST_Intersects(z.geom, ST_LineInterpolatePoint(p.geom, 0.5))"))
    db.flush()

    # --- khách hàng + đồng hồ + chỉ số 6 kỳ
    today = date.today()
    periods = []
    y, m = today.year, today.month
    for _ in range(6):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
        periods.append(f"{y}-{m:02d}")
    periods.reverse()
    kh = 0
    dpipes = db.scalars(select(Pipe).where(Pipe.pipe_class == "distribution")).all()
    for p in dpipes:
        line = to_shape(p.geom)
        if line.length < DLON * 0.2:
            continue
        (ax, ay), (bx, by) = line.coords[0], line.coords[-1]
        horiz = abs(bx - ax) > abs(by - ay)
        for t in [0.2, 0.4, 0.6, 0.8][: random.randint(2, 4)]:
            for side in (-1, 1):
                if random.random() < 0.35:
                    continue
                kh += 1
                c0 = line.interpolate(t, normalized=True)
                off = 0.00018 * side
                cpt = Point(c0.x, c0.y + off) if horiz else Point(c0.x + off, c0.y)
                ctype = random.choices(["household", "business", "agency"], [85, 12, 3])[0]
                name = (f"{random.choice(HO)} {random.choice(DEM)} {random.choice(TEN)}" if ctype == "household"
                        else random.choice(["Cửa hàng ", "Công ty TNHH ", "Quán ăn "]) + random.choice(TEN) if ctype == "business"
                        else random.choice(["Trường THCS ", "UBND phường ", "Trạm y tế "]) + random.choice(TEN))
                c = Customer(code=f"KH{kh:06d}", name=name, address=f"{random.randint(1, 300)} {p.street}",
                             phone=f"09{random.randint(10000000, 99999999)}", customer_type=ctype,
                             zone_id=p.zone_id, pipe_id=p.id, geom=from_shape(cpt, srid=4326))
                db.add(c)
                db.flush()
                mt = Meter(serial=f"DH{kh:07d}", customer_id=c.id, size_mm=15 if ctype == "household" else 25,
                           brand=random.choice(["Itron", "Zenner", "Sensus", "Elster"]),
                           install_date=date(random.randint(2015, 2024), random.randint(1, 12), 1))
                db.add(mt)
                db.flush()
                base = {"household": 18, "business": 60, "agency": 120}[ctype]
                reading = random.randint(100, 3000)
                db.add(MeterReading(meter_id=mt.id, period=periods[0], reading=reading, consumption=0))
                for per in periods[1:]:
                    cons = max(0, round(random.gauss(base, base * 0.25)))
                    reading += cons
                    db.add(MeterReading(meter_id=mt.id, period=per, reading=reading, consumption=cons))
    db.flush()

    # --- sản lượng cấp vào DMA (thất thoát 12–32%, DMA cũ cao hơn)
    nrw = {zones[0].id: 0.30, zones[1].id: 0.18, zones[2].id: 0.22, zones[3].id: 0.13}
    billed = db.execute(text("""
        SELECT c.zone_id, r.period, SUM(r.consumption) FROM meter_readings r
        JOIN meters m ON m.id=r.meter_id JOIN customers c ON c.id=m.customer_id GROUP BY 1,2""")).all()
    for zid, per, b in billed:
        if zid and per != periods[0]:
            rate = nrw[zid] + random.uniform(-0.03, 0.03)
            db.add(ZoneInflow(zone_id=zid, period=per, volume_m3=round(float(b) / (1 - rate), 0)))

    # --- sự cố 12 tháng
    titles = {"leak": "Rò rỉ nước", "burst": "Vỡ ống", "low_pressure": "Nước yếu", "water_quality": "Nước đục",
              "valve_fault": "Van hỏng, không đóng được", "other": "Sự cố khác"}
    dp = [p for p in db.scalars(select(Pipe).where(Pipe.pipe_class == "distribution")).all()]
    old_pipes = [p for p in dp if (p.install_year or 2020) < 2000]
    now = datetime.now()
    for k in range(48):
        p = random.choice(old_pipes if random.random() < 0.6 else dp)
        t = random.choices(list(titles), [45, 15, 15, 8, 7, 10])[0]
        rep = now - timedelta(days=random.randint(0, 12) if k < 7 else random.randint(0, 360), hours=random.randint(0, 23))
        status = "closed" if (now - rep).days > 20 else random.choice(["new", "assigned", "in_progress", "resolved"])
        loc = to_shape(p.geom).interpolate(random.uniform(0.2, 0.8), normalized=True)
        inc = Incident(code=f"SC{rep.year}-{k + 1:04d}", incident_type=t,
                       severity=random.choices(["low", "medium", "high", "critical"], [25, 45, 22, 8])[0],
                       status=status, title=f"{titles[t]} trên đường {p.street}",
                       description="Người dân báo qua tổng đài", reporter=f"{random.choice(HO)} {random.choice(TEN)}",
                       reporter_phone=f"09{random.randint(10000000, 99999999)}",
                       assignee=None if status == "new" else random.choice(["Tổ sửa chữa 1", "Tổ sửa chữa 2", "Đội Kỹ thuật"]),
                       pipe_id=p.id, zone_id=p.zone_id, reported_at=rep, geom=from_shape(loc, srid=4326))
        if status in ("resolved", "closed"):
            inc.resolved_at = rep + timedelta(hours=random.randint(2, 48))
            inc.repair_cost = random.randint(2, 40) * 500_000
            inc.est_loss_m3 = random.randint(5, 300) if t in ("leak", "burst") else None
            inc.resolution = "Đã thay đoạn ống / bó ống" if t in ("leak", "burst") else "Đã xử lý"
        db.add(inc)
        db.flush()
        if t in ("leak", "burst"):
            try:
                inc.isolation = isolation_report(db, p.id)
            except ValueError:
                pass
        db.add(IncidentLog(incident_id=inc.id, status="new", note="Tiếp nhận sự cố", user="Tổng đài", created_at=rep))
        if status != "new":
            db.add(IncidentLog(incident_id=inc.id, status=status, note="Cập nhật xử lý", user=inc.assignee,
                               created_at=inc.resolved_at or rep + timedelta(hours=1)))
    db.commit()
    print(f"Đã tạo: {db.scalar(select(func.count()).select_from(Pipe))} ống, "
          f"{db.scalar(select(func.count()).select_from(Node))} nút, {kh} khách hàng, 48 sự cố")
    print("Tài khoản: admin/admin123 · kythuat/kythuat123 · xem/xem123")


if __name__ == "__main__":
    run(reset="--reset" in sys.argv)
