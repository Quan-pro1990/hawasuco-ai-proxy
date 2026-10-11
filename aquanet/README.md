# AquaNet GIS – Phần mềm quản lý mạng lưới cấp nước

Hệ thống web GIS quản lý mạng lưới cấp nước. Dữ liệu nằm trên **PostgreSQL/PostGIS**,
nên mở và chỉnh sửa trực tiếp được trong **QGIS**. Phần mềm có thêm giao diện web để
tổ kỹ thuật, tổng đài và ban lãnh đạo cùng dùng.

## Chức năng

| Phân hệ | Nội dung |
|---|---|
| **Bản đồ GIS mạng lưới** | Lớp ống (tô màu theo vật liệu, tuổi ống, đường kính), van (mở/đóng), trụ cứu hỏa, trạm bơm, bể chứa, nhà máy, đồng hồ tổng, vùng DMA, khách hàng, sự cố. Nền OSM, ảnh vệ tinh, nền trắng. Tìm kiếm theo mã, tên đường, tên khách hàng. |
| **Biên tập topology** | Vẽ ống mới: đầu ống tự bắt dính vào nút gần nhất, hoặc tự tách ống có sẵn để tạo nối chữ T. Đặt van hay thiết bị lên thân ống thì ống tự tách làm 2. Kéo một nút thì các ống nối vào nút đó kéo theo. Sửa đỉnh của ống. Chiều dài ống tính theo trắc địa. Có công cụ kiểm tra lỗi topology. |
| **Phân tích cô lập van** | Chọn một đoạn ống, hệ thống trả về **danh sách van cần đóng**, đoạn ống bị cô lập và **vùng mất nước ở hạ lưu** (phần mạng bị mất kết nối với nguồn sau khi đóng van). Kèm danh sách **khách hàng cần thông báo**, xuất được ra CSV. |
| **Sự cố & sửa chữa** | Báo sự cố bằng cách nhấp lên bản đồ: hệ thống tự gắn ống gần nhất và tự lập phương án cô lập. Quy trình: Mới → Phân công → Đang xử lý → Đã khắc phục → Đóng. Ghi nhật ký, chi phí sửa chữa và lượng nước thất thoát. |
| **Khách hàng & đồng hồ** | Danh bạ khách hàng, tự gán ống đấu nối và DMA. Quản lý đồng hồ (lắp mới, thay thế). **Sổ ghi chỉ số** theo kỳ: tự tính tiêu thụ và chặn chỉ số mới nhỏ hơn kỳ trước. Nhập sản lượng cấp vào từng DMA. |
| **Thống kê & báo cáo** | Chỉ số tổng quan; chiều dài ống theo vật liệu, tuổi và đường kính; sự cố theo tháng; **tỷ lệ thất thoát (NRW) theo DMA**; bảng cân bằng nước; các đoạn ống hay xảy ra sự cố (điểm nóng); xuất CSV. |
| **Quản trị** | Người dùng có 3 vai trò: Quản trị, Kỹ thuật (được sửa), Chỉ xem. Nhập/xuất GeoJSON để trao đổi với QGIS. |

## Kiến trúc

```
┌──────────────┐   REST/JSON   ┌───────────────────┐   SQL    ┌─────────────────────┐
│ React + Leaflet│ ───────────▶ │ FastAPI (Python)  │ ───────▶ │ PostgreSQL + PostGIS │◀── QGIS
│ (frontend/)   │              │ (backend/app)     │          │ bảng: pipes, nodes,  │   (kết nối
└──────────────┘              │  topology, cô lập │          │ zones, customers,    │    trực tiếp)
                               └───────────────────┘          │ meters, incidents…   │
                                                              └─────────────────────┘
```

- **backend/**: FastAPI, SQLAlchemy 2 + GeoAlchemy2, Shapely, xác thực bằng JWT.
  - `app/models.py`: mô hình dữ liệu (SRID 4326)
  - `app/services/topology.py`: bắt điểm, tách ống, thuật toán cô lập van (duyệt đồ thị BFS)
  - `app/routers/`: các API `auth`, `network`, `incidents`, `customers`, `reports`, `io`
  - `app/sql/postgis_extras.sql`: trigger tự tính chiều dài ống khi sửa trong QGIS, cùng các view `v_pipes`, `v_valves`, `v_open_incidents`
  - `app/seed.py`: dữ liệu mẫu (≈220 ống, 4 DMA, ≈500 khách hàng, 48 sự cố)
  - `tests/`: kiểm thử tích hợp (pytest)
- **frontend/**: React 18, Vite, react-leaflet, Leaflet-Geoman (vẽ/sửa), Recharts.

## Cài đặt nhanh bằng Docker (khuyến nghị)

```bash
cp .env.example .env        # đổi DB_PASSWORD, SECRET_KEY
docker compose up -d --build
```

Mở http://localhost:8000. Tài khoản mẫu: `admin/admin123`, `kythuat/kythuat123`, `xem/xem123`.
Tài liệu API (Swagger): http://localhost:8000/docs

> Khi triển khai thật: đặt `SEED_DEMO=0`, đổi mật khẩu admin, đặt `SECRET_KEY` mạnh, và
> chỉ mở cổng 5432 cho mạng nội bộ (QGIS).

## Chạy môi trường phát triển

Yêu cầu: Python ≥ 3.11, Node ≥ 18, PostgreSQL ≥ 14 có PostGIS ≥ 3.

```bash
# 1. CSDL
createdb capnuoc && psql capnuoc -c "CREATE EXTENSION postgis"

# 2. Backend
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/capnuoc
python -m app.seed --reset          # tạo dữ liệu mẫu
uvicorn app.main:app --reload       # http://localhost:8000/docs
python -m pytest -q                 # chạy kiểm thử (cần dữ liệu mẫu)

# 3. Frontend (cửa sổ khác)
cd frontend
npm install
npm run dev                         # http://localhost:5173 (proxy /api → :8000)
```

Build giao diện để FastAPI phục vụ trên cùng một cổng: chạy `npm run build`. Backend sẽ tự
phục vụ thư mục `frontend/dist`.

## Cấu hình (biến môi trường)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@localhost:5432/capnuoc` | Chuỗi kết nối |
| `SECRET_KEY` | (đổi khi triển khai) | Khóa ký JWT |
| `TOKEN_EXPIRE_MINUTES` | 720 | Thời hạn phiên đăng nhập (phút) |
| `SNAP_TOLERANCE_M` | 2.0 | Dung sai bắt điểm mặc định (m). Giao diện web tự gửi dung sai theo mức zoom. |
| `CORS_ORIGINS` | `*` | Danh sách nguồn được phép, phân cách bằng dấu phẩy |

## Dùng chung với QGIS

Xem hướng dẫn chi tiết trong [qgis/HUONG_DAN_QGIS.md](qgis/HUONG_DAN_QGIS.md). Có 3 cách:

1. **Kết nối trực tiếp PostGIS**: mở các bảng/view và biên tập ngay trên CSDL.
2. **Xuất GeoJSON** từ trang Quản trị để mở trong QGIS.
3. **Nhập GeoJSON** đã số hóa trong QGIS. Hệ thống tự dựng topology (gắn nút, bắt điểm) và tự nhận diện các trường thuộc tính như `vat_lieu`, `dn`, `nam_lap`.

## Các API chính

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/login` | Đăng nhập (form `username`, `password`) |
| GET/POST/PUT/DELETE | `/api/pipes`, `/api/nodes`, `/api/zones` | Lớp mạng lưới (GeoJSON); lọc theo `bbox`, `material`, `node_type`… |
| GET | `/api/network/isolate?pipe_id=` | Phân tích cô lập van |
| GET | `/api/network/validate` | Kiểm tra topology |
| GET | `/api/search?q=` | Tìm kiếm đối tượng |
| GET/POST/PUT | `/api/incidents` | Sự cố và quy trình xử lý |
| GET/POST/PUT | `/api/customers`, `/api/customers/{id}/meters` | Khách hàng, đồng hồ |
| GET/POST | `/api/readings`, `/api/readings/sheet?period=` | Ghi chỉ số |
| GET/POST | `/api/inflows` | Sản lượng cấp vào DMA |
| GET | `/api/reports/summary · pipes · incidents · nrw · consumption` | Báo cáo |
| GET | `/api/export/{layer}?format=geojson\|csv` | Xuất dữ liệu |
| POST | `/api/import/{layer}` | Nhập GeoJSON (pipes, nodes, customers) |

## Hướng phát triển tiếp

- Ứng dụng di động cho tổ hiện trường (ghi chỉ số, chụp ảnh sự cố, chạy offline)
- Kết nối SCADA và đồng hồ thông minh (áp lực, lưu lượng theo thời gian thực)
- Mô phỏng thủy lực: xuất mạng lưới sang EPANET (.inp)
- Lập lịch bảo trì van và trụ cứu hỏa; quản lý vật tư
- Phục vụ lớp bản đồ dạng vector tiles (pg_tileserv/Martin) cho mạng lưới hàng trăm nghìn đối tượng
