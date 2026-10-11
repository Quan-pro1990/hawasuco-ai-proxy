# Dùng AquaNet GIS cùng QGIS

## 1. Kết nối trực tiếp PostGIS

1. Mở QGIS (từ bản 3.28 trở lên), vào **Layer › Data Source Manager › PostgreSQL** rồi bấm **New**.
2. Điền thông tin kết nối:
   - Name: `AquaNet`
   - Host: địa chỉ máy chủ (chạy Docker trên máy mình thì dùng `localhost`)
   - Port: `5432`, Database: `capnuoc`
   - Authentication: tài khoản `postgres` / mật khẩu trong `.env`. Nên tạo riêng một tài khoản cho QGIS, xem mục 4.
3. Bấm **Connect** và chọn các lớp cần mở:

| Bảng / view | Hình học | Ghi chú |
|---|---|---|
| `pipes` | LineString | Đường ống. **Biên tập được**; trigger tự tính `length_m` và `zone_id`. |
| `nodes` | Point | Van, trụ cứu hỏa, bể chứa… Trường `node_type`, `status` (open/closed). |
| `zones` | MultiPolygon | Vùng DMA |
| `customers` | Point | Khách hàng (`pipe_id` = ống đấu nối) |
| `incidents` | Point | Sự cố |
| `v_pipes` | LineString | View chỉ đọc, có sẵn `age_years`, `incident_count`, `customer_count` để làm bản đồ chuyên đề |
| `v_valves`, `v_open_incidents` | Point | Lọc sẵn van và sự cố đang mở |

Hệ tọa độ lưu trong CSDL là **EPSG:4326 (WGS84)**. Muốn đo vẽ theo mét trong QGIS thì đặt hệ tọa độ
của project là **VN-2000 / múi chiếu địa phương**, ví dụ EPSG:9210 (VN-2000 / TM-3 105-45) hoặc
múi phù hợp với tỉnh của bạn. QGIS sẽ tự chuyển đổi khi hiển thị.

## 2. Biên tập trong QGIS và topology

Hãy bật **Snapping** (Project › Snapping Options), đặt chế độ Vertex, dung sai 10 px, và chọn lớp
`nodes` và `pipes`.

- Khi vẽ ống mới trong QGIS, trigger CSDL tự tính chiều dài. Riêng `start_node_id` và
  `end_node_id` chỉ được gán khi tạo ống qua web hoặc API. Sau khi số hóa xong một loạt ống trong QGIS,
  có 2 cách để dựng lại topology:
  - **Cách khuyến nghị:** xuất lớp vừa vẽ ra GeoJSON (EPSG:4326) rồi nhập vào trang
    **Quản trị › Nhập**. Hệ thống tự bắt điểm, tạo nút và tách ống.
  - Hoặc vào trang Quản trị, bấm **Kiểm tra topology** để xem các ống chưa nối.
- Thuật toán cô lập van dựa trên `start_node_id`/`end_node_id`, vì vậy ống chưa nối nút sẽ không được
  tính vào phân tích.

## 3. Nhập dữ liệu có sẵn (shapefile, DWG…)

1. Mở dữ liệu cũ trong QGIS (shapefile, hoặc DXF/DWG đã chuyển đổi).
2. Bấm chuột phải vào lớp, chọn **Export › Save Features As…**, định dạng **GeoJSON**, CRS **EPSG:4326**.
3. Các tên trường được nhận diện tự động (không phân biệt hoa thường):

| Lớp | Trường |
|---|---|
| Ống | `code`/`ma_ong` · `material`/`vat_lieu` · `diameter_mm`/`dn`/`duong_kinh` · `install_year`/`nam_lap` · `street`/`ten_duong` |
| Thiết bị | `code`/`ma` · `node_type`/`loai` (junction, valve, hydrant, pump, tank, source, bulk_meter) · `status` · `dn` · `nam_lap` |
| Khách hàng | `code`/`ma_kh` · `name`/`ten_kh` · `address`/`dia_chi` · `phone`/`dien_thoai` |

4. Vào **Quản trị & dữ liệu › Nhập**, chọn lớp rồi chọn tệp. Hệ thống báo số đối tượng đã nhập và
   liệt kê các lỗi (nếu có).

> Nên nhập **thiết bị (van, trụ) trước**, sau đó mới nhập **ống**. Như vậy đầu ống sẽ bắt dính vào van có sẵn.

## 4. Tài khoản CSDL riêng cho QGIS (khuyến nghị)

```sql
CREATE ROLE qgis_editor LOGIN PASSWORD 'doi-mat-khau';
GRANT CONNECT ON DATABASE capnuoc TO qgis_editor;
GRANT USAGE ON SCHEMA public TO qgis_editor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO qgis_editor;
GRANT INSERT, UPDATE, DELETE ON pipes, nodes, zones, customers TO qgis_editor;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO qgis_editor;
-- Chỉ xem:
CREATE ROLE qgis_viewer LOGIN PASSWORD 'doi-mat-khau';
GRANT CONNECT ON DATABASE capnuoc TO qgis_viewer;
GRANT USAGE ON SCHEMA public TO qgis_viewer;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO qgis_viewer;
```

## 5. Gợi ý ký hiệu (Symbology)

- `pipes` hoặc `v_pipes`: chọn **Categorized** theo `material`, hoặc **Graduated** theo `age_years`.
  Độ dày nét đặt theo biểu thức `scale_linear("diameter_mm", 90, 500, 0.4, 1.6)`.
- `nodes`: chọn **Rule-based**:
  - `"node_type"='valve' AND "status"='closed'`: vòng tròn rỗng viền đỏ
  - `"node_type"='valve'`: chấm xanh lá
  - `"node_type"='hydrant'`: chấm đỏ
