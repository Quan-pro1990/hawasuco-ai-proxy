"""Sinh mạng lưới lớn để thử tải bản đồ vector tiles (không dùng cho dữ liệu thật).

    python -m app.gen_large --size 230          # ~53 nghìn nút, ~105 nghìn ống, ~105 nghìn khách hàng
    python -m app.gen_large --bench             # đo thời gian sinh tile ở các mức zoom
    python -m app.gen_large --drop              # xóa toàn bộ dữ liệu thử (mã bắt đầu bằng LG)

Lưới ô vuông đặt cách khu dữ liệu mẫu ~20 km về phía Bắc, có đủ van, trụ, ống nhiều vật liệu/cỡ.
"""
import argparse
import math
import time

from sqlalchemy import text

from .db import engine, init_db

LON0, LAT0, STEP = 106.60, 11.16, 0.0009  # ~100 m giữa hai nút


def generate(size: int):
    with engine.begin() as c:
        c.execute(text("""
            INSERT INTO nodes (code, node_type, status, diameter_mm, geom)
            SELECT 'LGN' || i || '_' || j,
                   CASE WHEN (i * 7 + j) % 9 = 0 THEN 'valve' WHEN (i + j) % 23 = 0 THEN 'hydrant' ELSE 'junction' END,
                   CASE WHEN (i * 7 + j) % 9 = 0 AND (i + j) % 31 = 0 THEN 'closed'
                        WHEN (i * 7 + j) % 9 = 0 THEN 'open' ELSE 'active' END,
                   110, ST_SetSRID(ST_MakePoint(:x0 + j * :d, :y0 + i * :d), 4326)
            FROM generate_series(0, :n - 1) i, generate_series(0, :n - 1) j"""),
                  {"x0": LON0, "y0": LAT0, "d": STEP, "n": size})
        c.execute(text("""
            CREATE TEMP TABLE lg ON COMMIT DROP AS
            SELECT split_part(substr(code, 4), '_', 1)::int AS i, split_part(code, '_', 2)::int AS j, id, geom
            FROM nodes WHERE code LIKE 'LGN%'"""))
        c.execute(text("CREATE INDEX ON lg (i, j)"))
        for suffix, join in (("h", "b.i = a.i AND b.j = a.j + 1"), ("v", "b.i = a.i + 1 AND b.j = a.j")):
            c.execute(text(f"""
                INSERT INTO pipes (code, material, diameter_mm, install_year, status, pipe_class,
                                   start_node_id, end_node_id, length_m, street, geom)
                SELECT 'LGP' || a.i || '_' || a.j || '{suffix}',
                       (ARRAY['HDPE','uPVC','DI','CI','STEEL','HDPE','uPVC'])[1 + (a.i * 3 + a.j) % 7],
                       CASE WHEN a.i % 20 = 0 OR a.j % 20 = 0 THEN (ARRAY[300, 400])[1 + (a.i + a.j) % 2]
                            WHEN a.i % 5 = 0 OR a.j % 5 = 0 THEN 200
                            ELSE (ARRAY[90, 110, 160])[1 + (a.i + a.j * 7) % 3] END,
                       1980 + (a.i * a.j) % 44, 'active',
                       CASE WHEN a.i % 20 = 0 OR a.j % 20 = 0 THEN 'transmission' ELSE 'distribution' END,
                       a.id, b.id, 0, 'Đường thử ' || a.i, ST_MakeLine(a.geom, b.geom)
                FROM lg a JOIN lg b ON {join}"""))
        c.execute(text("""
            INSERT INTO customers (code, name, address, customer_type, status, pipe_id, geom)
            SELECT 'LGC' || p.id, 'Khách hàng thử ' || p.id, p.street, 'household', 'active', p.id,
                   ST_Translate(ST_LineInterpolatePoint(p.geom, 0.5), 0.00012, 0.00012)
            FROM pipes p WHERE p.code LIKE 'LGP%'"""))
        c.execute(text("ANALYZE nodes; ANALYZE pipes; ANALYZE customers"))
        for t in ("nodes", "pipes", "customers"):
            print(t, c.scalar(text(f"SELECT count(*) FROM {t}")))


def drop():
    with engine.begin() as c:
        c.execute(text("DELETE FROM customers WHERE code LIKE 'LGC%'"))
        c.execute(text("DELETE FROM pipes WHERE code LIKE 'LGP%'"))
        c.execute(text("DELETE FROM nodes WHERE code LIKE 'LGN%'"))
    print("Đã xóa dữ liệu thử")


def tile_xy(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


def bench(size: int):
    lon = LON0 + size * STEP / 2
    lat = LAT0 + size * STEP / 2
    print("zoom  tile        kích thước   thời gian (lần 1 / TB 5 tile lân cận)")
    with engine.connect() as c:
        for z in (11, 12, 13, 14, 15, 16, 17):
            x, y = tile_xy(lon, lat, z)
            t0 = time.perf_counter()
            data = c.scalar(text("SELECT postgisftw.aquanet_network(:z, :x, :y)"), {"z": z, "x": x, "y": y})
            first = time.perf_counter() - t0
            t0 = time.perf_counter()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1)):
                c.scalar(text("SELECT postgisftw.aquanet_network(:z, :x, :y)"), {"z": z, "x": x + dx, "y": y + dy})
            avg = (time.perf_counter() - t0) / 5
            print(f"{z:>4}  {x}/{y:<10} {len(data or b'') / 1024:>7.1f} KB   {first * 1000:>6.0f} ms / {avg * 1000:>4.0f} ms")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--size", type=int, default=230, help="Số nút mỗi cạnh lưới (230 -> ~105 nghìn ống)")
    ap.add_argument("--drop", action="store_true")
    ap.add_argument("--bench", action="store_true")
    a = ap.parse_args()
    init_db()
    if a.drop:
        drop()
    elif a.bench:
        bench(a.size)
    else:
        t = time.perf_counter()
        generate(a.size)
        print(f"Xong sau {time.perf_counter() - t:.1f} s")
