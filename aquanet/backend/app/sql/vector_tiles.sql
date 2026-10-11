-- Vector tiles (Mapbox Vector Tile) cho mạng lưới lớn – chạy lại an toàn.
--
-- Một hàm duy nhất trả về tile nhiều lớp: zones, pipes, nodes, customers, incidents.
-- Dùng chung cho:
--   * API tích hợp:  GET /api/tiles/{z}/{x}/{y}.pbf  (có đăng nhập)
--   * Martin:        http://may-chu:3000/aquanet_network/{z}/{x}/{y}
--   * pg_tileserv:   http://may-chu:7800/postgisftw.aquanet_network/{z}/{x}/{y}.pbf
--     (pg_tileserv mặc định chỉ xuất bản hàm trong schema postgisftw)
--
-- Lọc theo mức zoom để tile luôn nhẹ dù mạng lưới hàng trăm nghìn đối tượng:
--   ống:        z <= 11 chỉ tuyến truyền tải và >= D400; z 12 >= D300; z 13 >= D200; z 14 >= D100; z >= 15 tất cả
--   nút:        z < 14 chỉ nguồn, bể, trạm bơm, đồng hồ tổng; z 14–15 thêm van, trụ; z >= 16 tất cả
--   khách hàng: chỉ từ z >= 16 (không kèm tên/điện thoại – dữ liệu cá nhân không nằm trong tile)
--
-- SECURITY DEFINER: tài khoản chỉ đọc của tile server chỉ cần quyền EXECUTE, không cần quyền
-- SELECT trên bảng (pg_tileserv sẽ không tự xuất bản bảng customers…). Xem README.
CREATE SCHEMA IF NOT EXISTS postgisftw;

CREATE OR REPLACE FUNCTION postgisftw.aquanet_network(z integer, x integer, y integer)
RETURNS bytea
LANGUAGE sql STABLE PARALLEL SAFE SECURITY DEFINER
SET search_path = public
AS $$
WITH env AS (
  SELECT ST_TileEnvelope(z, x, y) AS t3857,
         ST_Transform(ST_TileEnvelope(z, x, y, margin => 0.015625), 4326) AS q4326
),
zones_t AS (
  SELECT zn.id, zn.code, zn.name,
         ST_AsMVTGeom(ST_Transform(zn.geom, 3857), env.t3857, 4096, 64, true) AS geom
  FROM zones zn, env
  WHERE zn.geom && env.q4326
),
pipes_t AS (
  SELECT p.id, p.code, p.material, p.diameter_mm, p.install_year, p.status, p.pipe_class,
         ST_AsMVTGeom(ST_Transform(p.geom, 3857), env.t3857, 4096, 64, true) AS geom
  FROM pipes p, env
  WHERE p.geom && env.q4326
    AND (z >= 15 OR p.pipe_class = 'transmission'
         OR p.diameter_mm >= CASE WHEN z >= 14 THEN 100 WHEN z = 13 THEN 200 WHEN z = 12 THEN 300 ELSE 400 END)
),
nodes_t AS (
  SELECT n.id, n.code, n.node_type, n.status, n.diameter_mm,
         ST_AsMVTGeom(ST_Transform(n.geom, 3857), env.t3857, 4096, 64, true) AS geom
  FROM nodes n, env
  WHERE n.geom && env.q4326
    AND (z >= 16
         OR (z >= 14 AND n.node_type <> 'junction')
         OR n.node_type IN ('source', 'tank', 'pump', 'bulk_meter'))
),
customers_t AS (
  SELECT c.id, c.code, c.customer_type, c.status,
         ST_AsMVTGeom(ST_Transform(c.geom, 3857), env.t3857, 4096, 64, true) AS geom
  FROM customers c, env
  WHERE z >= 16 AND c.geom IS NOT NULL AND c.geom && env.q4326
),
incidents_t AS (
  SELECT i.id, i.code, i.incident_type, i.severity, i.status,
         ST_AsMVTGeom(ST_Transform(i.geom, 3857), env.t3857, 4096, 64, true) AS geom
  FROM incidents i, env
  WHERE i.status NOT IN ('resolved', 'closed') AND i.geom && env.q4326
)
SELECT COALESCE((SELECT ST_AsMVT(t, 'zones', 4096, 'geom', 'id') FROM zones_t t WHERE t.geom IS NOT NULL), ''::bytea)
    || COALESCE((SELECT ST_AsMVT(t, 'pipes', 4096, 'geom', 'id') FROM pipes_t t WHERE t.geom IS NOT NULL), ''::bytea)
    || COALESCE((SELECT ST_AsMVT(t, 'customers', 4096, 'geom', 'id') FROM customers_t t WHERE t.geom IS NOT NULL), ''::bytea)
    || COALESCE((SELECT ST_AsMVT(t, 'nodes', 4096, 'geom', 'id') FROM nodes_t t WHERE t.geom IS NOT NULL), ''::bytea)
    || COALESCE((SELECT ST_AsMVT(t, 'incidents', 4096, 'geom', 'id') FROM incidents_t t WHERE t.geom IS NOT NULL), ''::bytea)
$$;

REVOKE ALL ON FUNCTION postgisftw.aquanet_network(integer, integer, integer) FROM PUBLIC;
COMMENT ON FUNCTION postgisftw.aquanet_network(integer, integer, integer) IS
  'AquaNet GIS – vector tile nhiều lớp (zones, pipes, nodes, customers, incidents)';
