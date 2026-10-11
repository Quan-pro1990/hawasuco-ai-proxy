-- Tiện ích CSDL cho người dùng QGIS (chạy lại an toàn – idempotent)

-- 1) Tự tính chiều dài ống khi số hóa/sửa trực tiếp trong QGIS
CREATE OR REPLACE FUNCTION trg_pipe_length() RETURNS trigger AS $$
BEGIN
  NEW.length_m := round(ST_Length(NEW.geom::geography)::numeric, 2);
  IF NEW.zone_id IS NULL THEN
    SELECT z.id INTO NEW.zone_id FROM zones z
     WHERE ST_Intersects(z.geom, ST_LineInterpolatePoint(NEW.geom, 0.5)) LIMIT 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS pipes_length ON pipes;
CREATE TRIGGER pipes_length BEFORE INSERT OR UPDATE OF geom ON pipes
  FOR EACH ROW EXECUTE FUNCTION trg_pipe_length();

-- 2) Các view tiện cho bản đồ chuyên đề trong QGIS
CREATE OR REPLACE VIEW v_pipes AS
SELECT p.id, p.code, p.material, p.diameter_mm, p.length_m, p.install_year,
       EXTRACT(YEAR FROM now())::int - p.install_year AS age_years,
       p.status, p.pipe_class, p.street, z.name AS zone_name,
       (SELECT count(*) FROM incidents i WHERE i.pipe_id = p.id) AS incident_count,
       (SELECT count(*) FROM customers c WHERE c.pipe_id = p.id) AS customer_count,
       p.geom
FROM pipes p LEFT JOIN zones z ON z.id = p.zone_id;

CREATE OR REPLACE VIEW v_valves AS
SELECT id, code, status, diameter_mm, install_year, address, geom
FROM nodes WHERE node_type = 'valve';

CREATE OR REPLACE VIEW v_open_incidents AS
SELECT id, code, incident_type, severity, status, title, assignee, reported_at, pipe_id, geom
FROM incidents WHERE status NOT IN ('resolved', 'closed');
