"""Kiểm thử các phân hệ mới: ứng dụng hiện trường, SCADA/AMI, EPANET, bảo trì & vật tư, vector tiles.

Cần PostGIS và dữ liệu mẫu (python -m app.seed --reset).
"""
import math
import os
import socket
import subprocess
import sys
import threading
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.config import settings
from app.db import SessionLocal
from app.main import app
from app.models import MaintenancePlan, MaintenanceTask, Material, MeterReading, Sensor, ZoneInflow

client = TestClient(app)
API_KEY = "khoa-thu-nghiem"
H: dict = {}


def login(user="admin", pw="admin123"):
    r = client.post("/api/auth/login", data={"username": user, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def setup_module():
    client.__enter__()
    settings.INGEST_API_KEYS = [API_KEY]
    H.update(login())


def teardown_module():
    client.__exit__(None, None, None)


def uid() -> str:
    return uuid.uuid4().hex


# ============================================================ Ứng dụng hiện trường
def test_field_package_and_reading_sync_is_idempotent():
    hf = login("hientruong", "hientruong123")
    pkg = client.get("/api/field/package", headers=hf).json()
    assert pkg["readings"] and pkg["zones"] and pkg["materials"]
    row = next(r for r in reversed(pkg["readings"]) if r["prev_reading"] is not None and r["reading"] is None)
    op = {"uuid": uid(), "kind": "reading",
          "payload": {"meter_id": row["meter_id"], "period": pkg["period"], "reading": row["prev_reading"] + 12}}
    r1 = client.post("/api/field/sync", headers=hf, json={"ops": [op]}).json()
    assert r1["ok"] == 1 and r1["results"][0]["consumption"] == 12
    r2 = client.post("/api/field/sync", headers=hf, json={"ops": [op]}).json()  # gửi lại do mất sóng
    assert r2["results"][0]["duplicate"] and r2["results"][0]["id"] == r1["results"][0]["id"]
    with SessionLocal() as db:
        rd = db.scalars(select(MeterReading).where(MeterReading.meter_id == row["meter_id"],
                                                   MeterReading.period == pkg["period"])).all()
        assert len(rd) == 1 and rd[0].source == "field" and rd[0].read_by == "Tổ hiện trường 1"
    # chỉ số nhỏ hơn kỳ trước: báo lỗi riêng mục đó, mục hợp lệ vẫn được ghi
    bad = {"uuid": uid(), "kind": "reading",
           "payload": {"meter_id": row["meter_id"], "period": pkg["period"], "reading": 0}}
    r3 = client.post("/api/field/sync", headers=hf, json={"ops": [bad]}).json()
    assert r3["failed"] == 1 and "nhỏ hơn" in r3["results"][0]["error"]


def test_field_incident_with_photo_and_permissions():
    hv = login("xem", "xem123")
    ops = [
        {"uuid": uid(), "kind": "incident", "payload": {
            "incident_type": "leak", "severity": "high", "title": "Rò rỉ trước nhà số 12",
            "lon": 106.6507, "lat": 10.9800, "accuracy_m": 6}},
        {"uuid": uid(), "kind": "reading", "payload": {"meter_id": 1, "period": "2020-01", "reading": 5}},
    ]
    res = client.post("/api/field/sync", headers=hv, json={"ops": ops}).json()["results"]
    assert res[0]["ok"] and res[0]["pipe_id"], res  # người xem vẫn được báo sự cố, tự gắn ống gần nhất
    assert not res[1]["ok"] and "quyền" in res[1]["error"]  # nhưng không được ghi chỉ số
    iid = res[0]["id"]
    jpeg = b"\xff\xd8\xff\xe0" + os.urandom(2000)
    cu = uid()
    form = {"owner_type": "incident", "owner_id": str(iid), "client_uuid": cu, "lon": "106.6507", "lat": "10.98"}
    a1 = client.post("/api/attachments", headers=hv, data=form, files={"file": ("a.jpg", jpeg, "image/jpeg")})
    assert a1.status_code == 200, a1.text
    a2 = client.post("/api/attachments", headers=hv, data=form, files={"file": ("a.jpg", jpeg, "image/jpeg")})
    assert a2.json()["id"] == a1.json()["id"]  # gửi lại cùng client_uuid không tạo bản sao
    lst = client.get(f"/api/attachments?owner_type=incident&owner_id={iid}", headers=H).json()
    assert len(lst) == 1
    f = client.get(lst[0]["url"], headers=H)
    assert f.status_code == 200 and f.content == jpeg and f.headers["content-type"] == "image/jpeg"
    svg = client.post("/api/attachments", headers=hv, data={"owner_type": "incident", "owner_id": str(iid)},
                      files={"file": ("x.svg", b"<svg onload=alert(1)>", "image/svg+xml")})
    assert svg.status_code == 415
    task_photo = client.post("/api/attachments", headers=hv, data={"owner_type": "task", "owner_id": "1"},
                             files={"file": ("a.jpg", jpeg, "image/jpeg")})
    assert task_photo.status_code == 403
    assert client.delete(f"/api/attachments/{a1.json()['id']}", headers=H).json()["ok"]


def test_field_task_complete_issues_materials_and_raises_incident():
    hf = login("hientruong", "hientruong123")
    task = client.get("/api/maintenance/tasks?open_only=true&node_type=valve&limit=1", headers=H).json()[0]
    mat = client.get("/api/materials", headers=H).json()[0]
    op = {"uuid": uid(), "kind": "task_complete", "payload": {
        "task_id": task["id"], "result": "inoperable", "note": "Ty van gãy",
        "checklist_result": {c: True for c in task["checklist"]}, "turns": 3,
        "materials": [{"material_id": mat["id"], "qty": 1}]}}
    r = client.post("/api/field/sync", headers=hf, json={"ops": [op]}).json()["results"][0]
    assert r["ok"] and r["incident_id"], r
    inc = client.get(f"/api/incidents/{r['incident_id']}", headers=H).json()
    assert inc["properties"]["incident_type"] == "valve_fault" and task["node_code"] in inc["properties"]["title"]
    t = client.get(f"/api/maintenance/tasks/{task['id']}", headers=H).json()
    assert t["status"] == "done" and t["completed_by"] == "Tổ hiện trường 1"
    assert t["materials"]["items"][0]["qty"] == 1
    after = next(m for m in client.get("/api/materials", headers=H).json() if m["id"] == mat["id"])
    assert after["stock"] == mat["stock"] - 1


# ============================================================ SCADA & đồng hồ thông minh
def test_scada_ingest_alarm_lifecycle():
    code = f"TEST-P-{uid()[:6]}"
    r = client.post("/api/scada/sensors", headers=H, json={
        "code": code, "name": "Áp lực thử nghiệm", "sensor_type": "pressure", "min_alarm": 1.5, "max_alarm": 6,
        "external_id": f"TAG.{code}", "geometry": {"type": "Point", "coordinates": [106.651, 10.981]}})
    assert r.status_code == 200, r.text
    sid = r.json()["id"]
    assert r.json()["properties"]["unit"] == "bar" and r.json()["properties"]["status"] == "offline"
    key = {"X-API-Key": API_KEY}
    t0 = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(minutes=5)
    # gửi bằng tag SCADA, không kèm múi giờ -> hiểu theo giờ Việt Nam
    local = t0.astimezone(timezone(timedelta(hours=7))).replace(tzinfo=None)
    r = client.post("/api/scada/ingest", headers=key, json=[
        {"sensor": f"TAG.{code}", "ts": local.isoformat(), "value": 1.2},
        {"sensor": "KHONG-CO", "value": 1},
        {"sensor": code, "ts": (t0 + timedelta(days=2)).isoformat(), "value": 3}])
    body = r.json()
    assert r.status_code == 200 and body["accepted"] == 1 and body["error_count"] == 2, body
    alarms = client.get("/api/scada/alarms", headers=H).json()
    mine = [a for a in alarms if a["sensor_id"] == sid]
    assert len(mine) == 1 and mine[0]["kind"] == "low" and mine[0]["value"] == 1.2
    s = client.get(f"/api/scada/sensors/{sid}", headers=H).json()["properties"]
    assert s["status"] == "alarm" and s["last_value"] == 1.2
    # gửi trùng thời điểm -> ghi đè, không nhân bản
    client.post("/api/scada/ingest", headers=key, json=[{"sensor": code, "ts": t0.isoformat(), "value": 1.1}])
    ser = client.get(f"/api/scada/sensors/{sid}/series?hours=1", headers=H).json()
    assert len(ser["points"]) == 1 and ser["points"][0]["avg"] == 1.1
    # xác nhận, rồi áp lực về bình thường -> cảnh báo tự đóng
    assert client.post(f"/api/scada/alarms/{mine[0]['id']}/ack", headers=H).json()["ack_by"]
    client.post("/api/scada/ingest", headers=key, json=[{"sensor": code, "value": 3.2}])
    assert not [a for a in client.get("/api/scada/alarms", headers=H).json() if a["sensor_id"] == sid]
    assert client.get(f"/api/scada/sensors/{sid}", headers=H).json()["properties"]["status"] == "normal"
    # xác thực cổng nhận số liệu
    assert client.post("/api/scada/ingest", headers={"X-API-Key": "sai"}, json=[]).status_code == 401
    assert client.post("/api/scada/ingest", json=[]).status_code == 401
    assert client.post("/api/scada/ingest", headers=login("xem", "xem123"), json=[]).status_code == 403
    assert client.post("/api/scada/ingest", headers=H, json=[{"sensor": code, "value": "NaN"}]).status_code == 422
    assert client.delete(f"/api/scada/sensors/{sid}", headers=H).json()["ok"]


def test_scada_overview_and_mnf_reflects_leakage():
    ov = client.get("/api/scada/overview", headers=H).json()
    assert ov["sensor_count"] >= 30 and ov["by_status"].get("offline") and ov["active_alarms"] >= 1
    mnf = {r["code"]: r for r in client.get("/api/scada/mnf?days=7", headers=H).json()}
    # DMA-01 (thất thoát ~30%) có tỷ lệ lưu lượng đêm cao hơn DMA-04 (~13%)
    assert mnf["F-DMA01"]["mnf_ratio_pct"] > mnf["F-DMA04"]["mnf_ratio_pct"]
    assert len(mnf["F-DMA01"]["nights"]) >= 6


def test_smart_meter_close_period_and_inflow_compute():
    period = date.today().strftime("%Y-%m")
    r = client.post(f"/api/scada/smart-meters/close-period?period={period}", headers=H).json()
    assert r["saved"] >= 10 and not r["errors"], r
    with SessionLocal() as db:
        s = db.scalars(select(Sensor).where(Sensor.sensor_type == "smart_meter")).first()
        rd = db.scalar(select(MeterReading).where(MeterReading.meter_id == s.meter_id, MeterReading.period == period))
        assert rd.source == "smart" and abs(rd.reading - round(s.last_value, 2)) < 0.01 and rd.consumption > 0
    try:
        res = client.post(f"/api/scada/inflows/compute?period={period}", headers=H).json()
        assert len(res["zones"]) == 4 and all(z["volume_m3"] > 0 for z in res["zones"])
    finally:  # không để sản lượng kỳ dở dang ảnh hưởng báo cáo thất thoát
        with SessionLocal() as db:
            db.execute(delete(ZoneInflow).where(ZoneInflow.period == period))
            db.commit()


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_realtime_stream_across_processes():
    """SSE qua máy chủ thật: số liệu gửi vào phải tới trình duyệt qua LISTEN/NOTIFY của PostgreSQL."""
    port = _free_port()
    env = {**os.environ, "INGEST_API_KEYS": API_KEY}
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(port)],
                            cwd=Path(__file__).resolve().parents[1], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            try:
                if httpx.get(base + "/api/health", timeout=1).status_code == 200:
                    break
            except httpx.TransportError:
                time.sleep(0.2)
        tok = httpx.post(base + "/api/auth/login", data={"username": "admin", "password": "admin123"}).json()
        got: list[str] = []
        ready = threading.Event()

        def listen():
            with httpx.stream("GET", base + "/api/scada/stream?max_seconds=8", timeout=15,
                              headers={"Authorization": f"Bearer {tok['access_token']}"}) as r:
                for line in r.iter_lines():
                    if line.startswith("event: hello"):
                        ready.set()
                    if line.startswith("data:") and "L-BC01" in line:
                        got.append(line)
                        return

        th = threading.Thread(target=listen, daemon=True)
        th.start()
        assert ready.wait(10)
        time.sleep(0.3)
        httpx.post(base + "/api/scada/ingest", headers={"X-API-Key": API_KEY},
                   json=[{"sensor": "SCADA.BC01.LT01", "value": 3.33}])
        th.join(10)
        assert got and '"value": 3.33' in got[0], got
    finally:
        proc.terminate()
        proc.wait(10)


# ============================================================ EPANET
def test_epanet_export():
    s = client.get("/api/network/epanet/summary", headers=H).json()
    assert s["pipes"] > 200 and s["reservoirs"] == 1 and s["tanks"] == 1 and s["valves"] > 50
    assert s["total_demand_lps"] > 0
    r = client.get("/api/network/epanet.inp", headers=H)
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    inp = r.text
    for sec in ("[JUNCTIONS]", "[RESERVOIRS]", "[TANKS]", "[PIPES]", "[VALVES]", "[PATTERNS]", "[OPTIONS]",
                "[COORDINATES]", "[END]"):
        assert sec in inp
    pipes = inp.split("[PIPES]")[1].split("[")[0].strip().splitlines()[1:]
    assert len(pipes) == s["pipes"]
    z = client.get("/api/network/epanet/summary?zone_id=1", headers=H).json()
    assert z["reservoirs"] >= 1 and z["pipes"] < s["pipes"]  # nút biên DMA thành RESERVOIR
    assert client.get("/api/network/epanet/summary?srid=999999", headers=H).status_code == 400


def test_epanet_file_solves_in_epanet(tmp_path, monkeypatch):
    wntr = pytest.importorskip("wntr")
    monkeypatch.chdir(tmp_path)  # EPANET ghi tệp tạm vào thư mục hiện hành
    inp = client.get("/api/network/epanet.inp", headers=H).text
    f = tmp_path / "net.inp"
    f.write_text(inp, encoding="utf-8")
    wn = wntr.network.WaterNetworkModel(str(f))
    res = wntr.sim.EpanetSimulator(wn).run_sim(file_prefix=str(tmp_path / "run"))
    assert res.node["pressure"].shape[0] == 25  # 0h..24h
    assert wn.num_valves > 50


# ============================================================ Bảo trì & vật tư
def test_maintenance_plan_generate_and_complete():
    he = login("kythuat", "kythuat123")
    plan = client.post("/api/maintenance/plans", headers=he, json={
        "name": "Kiểm tra van khu thử nghiệm", "node_type": "valve", "task_type": "inspect", "interval_days": 90,
        "zone_id": 2, "checklist": ["Mở nắp hố", "Kiểm tra rò rỉ"]}).json()
    try:
        _plan_flow(he, plan)
    finally:  # dọn lệnh thử nghiệm để chạy lại được
        with SessionLocal() as db:
            db.execute(delete(MaintenanceTask).where(MaintenanceTask.plan_id == plan["id"]))
            db.execute(delete(MaintenancePlan).where(MaintenancePlan.id == plan["id"]))
            db.commit()
    assert client.post("/api/maintenance/plans", headers=login("hientruong", "hientruong123"),
                       json={"name": "x", "node_type": "valve"}).status_code == 403


def _plan_flow(he, plan):
    g1 = client.post(f"/api/maintenance/plans/{plan['id']}/generate?horizon_days=30", headers=he).json()
    assert g1["created"] > 0
    g2 = client.post(f"/api/maintenance/plans/{plan['id']}/generate?horizon_days=30", headers=he).json()
    assert g2["created"] == 0  # thiết bị đã có lệnh đang mở thì không sinh trùng
    tasks = [t for t in client.get("/api/maintenance/tasks?open_only=true&task_type=inspect&zone_id=2",
                                   headers=he).json() if t["plan_id"] == plan["id"]]
    assert len(tasks) == g1["created"] and all(t["checklist"] == ["Mở nắp hố", "Kiểm tra rò rỉ"] for t in tasks)
    t = tasks[0]
    done = client.post(f"/api/maintenance/tasks/{t['id']}/complete", headers=he,
                       json={"result": "ok", "checklist_result": {"Mở nắp hố": True, "Kiểm tra rò rỉ": True}}).json()
    assert done["status"] == "done" and done["incident_id"] is None
    assert client.post(f"/api/maintenance/tasks/{t['id']}/complete", headers=he, json={}).status_code == 409
    hist = client.get(f"/api/maintenance/tasks?node_id={t['node_id']}", headers=he).json()
    assert hist[0]["id"] == t["id"]
    summ = client.get("/api/maintenance/summary", headers=he).json()
    assert any(c["plan_id"] == plan["id"] for c in summ["compliance"])


def test_materials_stock_rules():
    he = login("kythuat", "kythuat123")
    m = client.post("/api/materials", headers=he, json={"name": "Đai sửa ống D90 (thử)", "category": "clamp",
                                                        "unit": "cái", "min_stock": 5}).json()
    assert m["code"].startswith("VT") and m["stock"] == 0 and m["low"]
    m = client.post(f"/api/materials/{m['id']}/receive", headers=he, json={"qty": 10, "unit_price": 100_000}).json()
    m = client.post(f"/api/materials/{m['id']}/receive", headers=he, json={"qty": 10, "unit_price": 200_000}).json()
    assert m["stock"] == 20 and m["unit_price"] == 150_000 and not m["low"]  # giá bình quân gia quyền
    inc = client.get("/api/incidents", headers=he).json()["features"][0]
    over = client.post("/api/materials/issue", headers=he, json={
        "ref_type": "incident", "ref_id": inc["id"], "items": [{"material_id": m["id"], "qty": 25}]})
    assert over.status_code == 409 and "không đủ" in over.json()["detail"]
    use = client.post("/api/materials/issue", headers=he, json={
        "ref_type": "incident", "ref_id": inc["id"], "items": [{"material_id": m["id"], "qty": 3}]}).json()
    assert any(i["material_id"] == m["id"] and i["amount"] == 450_000 for i in use["items"])
    m = client.post(f"/api/materials/{m['id']}/adjust", headers=he, json={"counted_qty": 16, "note": "Kiểm kê"}).json()
    assert m["stock"] == 16
    mv = client.get(f"/api/materials/movements?material_id={m['id']}", headers=he).json()
    assert [x["kind"] for x in mv] == ["adjust", "out", "in", "in"] and mv[0]["qty"] == -1 and mv[0]["balance"] == 16
    assert client.delete(f"/api/materials/{m['id']}", headers=H).status_code == 409
    with SessionLocal() as db:
        assert db.get(Material, m["id"]).stock == 16


# ============================================================ Vector tiles
def _tile(lon, lat, z):
    n = 2 ** z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def test_vector_tiles():
    info = client.get("/api/tiles/info", headers=H).json()
    assert info["recommended"] == "geojson" and info["url_template"].startswith("/api/tiles/")
    lon = (info["bounds"][0] + info["bounds"][2]) / 2
    lat = (info["bounds"][1] + info["bounds"][3]) / 2
    x, y = _tile(lon, lat, 16)
    r = client.get(f"/api/tiles/16/{x}/{y}.pbf", headers=H)
    assert r.status_code == 200 and r.headers["content-type"] == "application/vnd.mapbox-vector-tile"
    for layer in (b"zones", b"pipes", b"nodes", b"customers"):
        assert layer in r.content
    assert b"phone" not in r.content  # không lộ số điện thoại khách hàng trong tile
    x, y = _tile(lon, lat, 12)
    low = client.get(f"/api/tiles/12/{x}/{y}.pbf", headers=H).content
    assert b"pipes" in low and b"customers" not in low  # zoom thấp: bỏ lớp khách hàng
    assert client.get("/api/tiles/16/0/0.pbf", headers=H).status_code == 204
    assert client.get("/api/tiles/3/9/0.pbf", headers=H).status_code == 404
    assert client.get(f"/api/tiles/16/{x}/{y}.pbf").status_code == 401


def test_vector_tile_decodes():
    mvt = pytest.importorskip("mapbox_vector_tile")
    info = client.get("/api/tiles/info", headers=H).json()
    x, y = _tile((info["bounds"][0] + info["bounds"][2]) / 2, (info["bounds"][1] + info["bounds"][3]) / 2, 16)
    t = mvt.decode(client.get(f"/api/tiles/16/{x}/{y}.pbf", headers=H).content)
    assert {"pipes", "nodes"} <= set(t)
    assert {"material", "diameter_mm", "code"} <= set(t["pipes"]["features"][0]["properties"])


def test_identify():
    r = client.get("/api/network/identify?lon=106.6507&lat=10.98&tol_m=15&layers=pipe", headers=H).json()
    assert r["layer"] == "pipe" and r["feature"]["properties"]["code"]
    r = client.get("/api/network/identify?lon=106.6507&lat=10.98&tol_m=15&layers=node&node_types=valve", headers=H).json()
    assert r is None or r["feature"]["properties"]["node_type"] == "valve"
    assert client.get("/api/network/identify?lon=0&lat=0&tol_m=5", headers=H).json() is None


def test_spa_blocks_path_traversal():
    if not any(getattr(r, "path", "") == "/{path:path}" for r in app.routes):
        pytest.skip("Chưa build giao diện (frontend/dist)")
    r = client.get("/..%2F..%2F..%2F..%2Fetc%2Fpasswd")
    assert b"root:" not in r.content
