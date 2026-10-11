-- Nâng cấp CSDL đã tạo từ phiên bản 1.0 (chạy lại an toàn – idempotent).
-- Bảng mới do SQLAlchemy tự tạo; tệp này chỉ bổ sung cột cho bảng cũ.
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS source varchar(10) NOT NULL DEFAULT 'office';
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS read_by varchar(120);
ALTER TABLE meter_readings ADD COLUMN IF NOT EXISTS note text;

-- Nếu máy chủ có TimescaleDB: biến bảng telemetry thành hypertable để lưu hàng trăm triệu bản ghi SCADA.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
    PERFORM create_hypertable('telemetry', 'ts', if_not_exists => TRUE, migrate_data => TRUE);
  END IF;
END $$;
