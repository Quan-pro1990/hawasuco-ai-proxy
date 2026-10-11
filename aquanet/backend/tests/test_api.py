"""Kiểm thử tích hợp (cần PostGIS và dữ liệu mẫu: python -m app.seed --reset)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def auth(user="admin", pw="admin123"):
    r = client.post("/api/auth/login", data={"username": user, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


H = None


def setup_module():
    global H
    client.__enter__()
    H = auth()


def test_requires_login():
    assert client.get("/api/pipes").status_code == 401


def test_layers():
    pipes = client.get("/api/pipes", headers=H).json()
    nodes = client.get("/api/nodes", headers=H).json()
    assert len(pipes["features"]) > 100
    assert any(f["properties"]["node_type"] == "valve" for f in nodes["features"])
    bbox = client.get("/api/pipes?bbox=106.650,10.980,106.653,10.983", headers=H).json()
    assert 0 < len(bbox["features"]) < len(pipes["features"])


def test_topology_valid():
    v = client.get("/api/network/validate", headers=H).json()
    assert v["unconnected_pipes"] == []
    assert v["orphan_nodes"] == []


def test_isolation():
    pipes = client.get("/api/pipes", headers=H).json()["features"]
    p = next(f for f in pipes if f["properties"]["pipe_class"] == "distribution")
    r = client.get(f"/api/network/isolate?pipe_id={p['id']}", headers=H).json()
    assert p["id"] in r["segment_pipes"]
    assert r["valves"], r["warnings"]
    # mọi van trả về phải là van đang mở
    nodes = {f["id"]: f["properties"] for f in client.get("/api/nodes?node_type=valve", headers=H).json()["features"]}
    assert all(nodes[v]["status"] == "open" for v in r["valves"])


def test_draw_pipe_and_insert_valve_splits():
    line = {"type": "LineString", "coordinates": [[106.6400, 10.9700], [106.6420, 10.9700]]}
    p = client.post("/api/pipes", json={"geometry": line, "diameter_mm": 110, "material": "HDPE"}, headers=H).json()
    assert p["properties"]["start_node_id"] and p["properties"]["end_node_id"]
    assert 200 < p["properties"]["length_m"] < 240
    v = client.post("/api/nodes", json={"node_type": "valve", "geometry": {"type": "Point", "coordinates": [106.6410, 10.9700]}},
                    headers=H).json()
    assert len(v["properties"]["split_pipes"]) == 2
    iso = client.get(f"/api/network/isolate?pipe_id={p['id']}", headers=H).json()
    assert iso.get("valves") == [v["id"]], iso
    # di chuyển nút đầu -> ống kéo theo
    client.put(f"/api/nodes/{p['properties']['start_node_id']}",
               json={"geometry": {"type": "Point", "coordinates": [106.6400, 10.9705]}}, headers=H)
    p2 = client.get(f"/api/pipes/{p['id']}", headers=H).json()
    assert p2["geometry"]["coordinates"][0] == [106.6400, 10.9705]


def test_incident_flow():
    r = client.post("/api/incidents", headers=H, json={
        "incident_type": "burst", "severity": "high", "title": "Vỡ ống thử nghiệm",
        "geometry": {"type": "Point", "coordinates": [106.6507, 10.9800]}})
    assert r.status_code == 200, r.text
    inc = r.json()
    assert inc["properties"]["pipe_id"] and inc["properties"]["isolation"]
    r = client.put(f"/api/incidents/{inc['id']}", headers=H, json={"status": "resolved", "repair_cost": 1500000, "note": "Đã thay ống"})
    assert r.json()["properties"]["resolved_at"]
    assert len(r.json()["properties"]["logs"]) == 2


def test_viewer_cannot_edit():
    hv = auth("xem", "xem123")
    r = client.post("/api/nodes", headers=hv, json={"geometry": {"type": "Point", "coordinates": [106.65, 10.98]}})
    assert r.status_code == 403


def test_customers_and_readings():
    lst = client.get("/api/customers?q=KH0000", headers=H).json()
    assert lst["total"] > 0
    c = client.get(f"/api/customers/{lst['items'][0]['id']}", headers=H).json()
    m = c["meters"][0]
    last = m["readings"][-1]
    y, mo = map(int, last["period"].split("-"))
    nxt = f"{y + (mo == 12)}-{(mo % 12) + 1:02d}"
    r = client.post("/api/readings", headers=H, json=[{"meter_id": m["id"], "period": nxt, "reading": last["reading"] + 21}])
    assert r.json()[0]["consumption"] == 21
    bad = client.post("/api/readings", headers=H, json=[{"meter_id": m["id"], "period": nxt, "reading": 0}])
    assert bad.status_code == 400
    sheet = client.get(f"/api/readings/sheet?period={nxt}", headers=H).json()
    assert any(s["reading"] for s in sheet)


def test_reports_and_export():
    s = client.get("/api/reports/summary", headers=H).json()
    assert s["pipe_length_km"] > 10
    assert client.get("/api/reports/pipes", headers=H).json()["by_material"]
    assert client.get("/api/reports/incidents", headers=H).json()["by_type"]
    nrw = client.get("/api/reports/nrw", headers=H).json()
    assert nrw and all(0 < r["nrw_pct"] < 50 for r in nrw)
    gj = client.get("/api/export/pipes", headers=H)
    assert gj.status_code == 200 and b"FeatureCollection" in gj.content
    assert client.get("/api/export/customers?format=csv", headers=H).status_code == 200


def test_import_geojson():
    fc = ('{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"vat_lieu":"upvc","dn":"90"},'
          '"geometry":{"type":"LineString","coordinates":[[106.64,10.975],[106.641,10.975]]}},'
          '{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}}]}')
    r = client.post("/api/import/pipes", headers=H, files={"file": ("a.geojson", fc, "application/json")})
    assert r.json()["created"] == 1 and len(r.json()["errors"]) == 1
