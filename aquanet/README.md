<img src="frontend/public/logo.png" alt="Logo HAWASUCO" width="96" align="right" />

# AquaNet GIS – Phần mềm quản lý mạng lưới cấp nước

Hệ thống web GIS quản lý mạng lưới cấp nước. Dữ liệu nằm trên **PostgreSQL/PostGIS**,
nên mở và chỉnh sửa trực tiếp được trong **QGIS**. Phần mềm có thêm giao diện web để
tổ kỹ thuật, tổng đài và ban lãnh đạo cùng dùng.

## Cài đặt trên máy chủ Windows (IIS) – dành cho người mới

Hướng dẫn từng bước, chỉ rõ từng lựa chọn cần đánh dấu khi cài: **[iis/HUONG_DAN_IIS.md](iis/HUONG_DAN_IIS.md)**. Tóm tắt:

0. **Máy chủ Windows mới cài:** đặt tên máy, IP tĩnh, chạy Windows Update đến hết, bật Remote Desktop
   (Phần 0 của hướng dẫn).
1. **Tải mã nguồn** (GitHub › *Code › Download ZIP*, nhớ *Unblock* tệp zip) và giải nén, ví dụ vào `C:\CaiDat`.
2. **Nhấp đúp `aquanet\iis\ChuanBi-MayChu.bat`** – tự tải và cài phần mềm nền: IIS, *ASP.NET Core Hosting
   Bundle*, PostgreSQL 16 + PostGIS (hỏi mật khẩu `postgres` – ghi lại), Python 3.12 cho mọi người dùng, Node.js LTS.
   Phần mềm đã có thì bỏ qua (máy chủ đang chạy *Quản lý thất thoát nước* đã có IIS và Hosting Bundle).
3. **Nhấp đúp `aquanet\iis\CaiDat-IIS.bat`** (hoặc để `ChuanBi-MayChu.bat` chạy luôn), nhập mật khẩu `postgres`
   và đặt mật khẩu cho `admin`. Bộ cài tự làm hết: dựng giao diện, cài thư viện Python, tạo CSDL riêng, site IIS
   HTTPS cổng **8443**, tường lửa, sao lưu hằng đêm.
4. **Mở** `https://<máy chủ>:8443` và đăng nhập `admin`. Hoàn thiện máy chủ (tên miền, chứng chỉ thật, sao lưu ra
   ngoài, bảo mật): Phần 4 và Phần 8 của hướng dẫn.

Cập nhật phiên bản mới: tải mã nguồn mới rồi chạy lại `CaiDat-IIS.bat` (không mất dữ liệu). Ứng dụng hiện trường
trên điện thoại cần chứng chỉ HTTPS thật để chạy offline – xem Phần 4 của hướng dẫn. Cài bằng Docker (Linux): xem
mục [Cài đặt bằng Docker](#cài-đặt-bằng-docker-linux).

## Chức năng

| Phân hệ | Nội dung |
|---|---|
| **Bản đồ GIS mạng lưới** | Lớp ống (tô màu theo vật liệu, tuổi ống, đường kính), van (mở/đóng), trụ cứu hỏa, trạm bơm, bể chứa, nhà máy, đồng hồ tổng, vùng DMA, khách hàng, sự cố. Nền OSM, ảnh vệ tinh, nền trắng. Tìm kiếm theo mã, tên đường, tên khách hàng. |
| **Biên tập topology** | Vẽ ống mới: đầu ống tự bắt dính vào nút gần nhất, hoặc tự tách ống có sẵn để tạo nối chữ T. Đặt van hay thiết bị lên thân ống thì ống tự tách làm 2. Kéo một nút thì các ống nối vào nút đó kéo theo. Sửa đỉnh của ống. Chiều dài ống tính theo trắc địa. Có công cụ kiểm tra lỗi topology. |
| **Phân tích cô lập van** | Chọn một đoạn ống, hệ thống trả về **danh sách van cần đóng**, đoạn ống bị cô lập và **vùng mất nước ở hạ lưu** (phần mạng bị mất kết nối với nguồn sau khi đóng van). Kèm danh sách **khách hàng cần thông báo**, xuất được ra CSV. |
| **Sự cố & sửa chữa** | Báo sự cố bằng cách nhấp lên bản đồ: hệ thống tự gắn ống gần nhất và tự lập phương án cô lập. Quy trình: Mới → Phân công → Đang xử lý → Đã khắc phục → Đóng. Ghi nhật ký, chi phí sửa chữa và lượng nước thất thoát. |
| **Khách hàng & đồng hồ** | Danh bạ khách hàng, tự gán ống đấu nối và DMA. Quản lý đồng hồ (lắp mới, thay thế). **Sổ ghi chỉ số** theo kỳ: tự tính tiêu thụ và chặn chỉ số mới nhỏ hơn kỳ trước. Nhập sản lượng cấp vào từng DMA. |
| **Thống kê & báo cáo** | Chỉ số tổng quan; chiều dài ống theo vật liệu, tuổi và đường kính; sự cố theo tháng; **tỷ lệ thất thoát (NRW) theo DMA**; bảng cân bằng nước; các đoạn ống hay xảy ra sự cố (điểm nóng); xuất CSV. |
| **Ứng dụng hiện trường** (`/field`) | Ứng dụng web cài được lên điện thoại (PWA), **chạy khi mất sóng**. Tải sổ ghi chỉ số theo kỳ/DMA về máy, ghi chỉ số theo lộ trình (tự chuyển khách kế tiếp, cảnh báo tiêu thụ bất thường, chụp mặt đồng hồ). Báo sự cố kèm GPS và ảnh (ảnh tự nén ~1600 px). Nhận lệnh bảo trì, sự cố được giao: đánh dấu checklist, ghi kết quả, vật tư đã dùng. Thao tác lưu trong máy (IndexedDB) và tự gửi khi có mạng; gửi lại không bị ghi trùng. |
| **SCADA & đồng hồ thông minh** | Điểm đo áp lực, lưu lượng, mực nước bể, chỉ số tổng, clo dư và đồng hồ thông minh (AMI) của khách hàng lớn. Cổng thu thập gửi số liệu qua API bằng khóa API. Màn hình giám sát **cập nhật trực tiếp** (Server-Sent Events), cảnh báo vượt ngưỡng tự mở/tự đóng, xác nhận cảnh báo, biểu đồ theo thời gian có vạch ngưỡng, điểm đo trên bản đồ. **Lưu lượng đêm nhỏ nhất (MNF)** theo DMA để khoanh vùng rò rỉ. Chốt chỉ số kỳ từ đồng hồ thông minh và tính sản lượng cấp vào DMA từ đồng hồ tổng (nối thẳng vào báo cáo thất thoát). |
| **Mô phỏng thủy lực (EPANET)** | Xuất toàn mạng hoặc từng DMA ra tệp EPANET 2.2 `.inp`: van thành VALVE (van đóng ghi Closed), trạm bơm thành PUMP, nhu cầu nước tính từ chỉ số khách hàng, mẫu dùng nước theo giờ, hệ số nhám Hazen–Williams theo vật liệu và tuổi ống, tọa độ UTM/VN-2000. Xem trước số phần tử và cảnh báo dữ liệu (thiếu cao độ, cụm mạng không nối nguồn…). Tệp đã được kiểm chứng giải được bằng EPANET. |
| **Bảo trì & vật tư** | Kế hoạch bảo trì định kỳ (vận hành van, xả trụ cứu hỏa, bôi trơn van lớn…) theo loại thiết bị, DMA, cỡ van; tự sinh lệnh công việc theo hạn, ưu tiên thiết bị quá hạn lâu nhất. Ghi kết quả theo checklist, số vòng van, ảnh; thiết bị hỏng tự lập phiếu sự cố. Chỉ số tuân thủ chu kỳ. **Kho vật tư**: nhập (giá bình quân gia quyền), xuất cho sự cố/lệnh bảo trì (không cho âm kho), kiểm kê, cảnh báo dưới mức tối thiểu, sổ nhập – xuất, chi phí vật tư theo phiếu. |
| **Vector tiles cho mạng lưới lớn** | Bản đồ tự chuyển sang vector tiles khi mạng lưới vượt 20.000 ống + nút. Tile sinh bởi một hàm PostGIS dùng chung cho API tích hợp (có đăng nhập), **Martin** và **pg_tileserv**; lọc theo mức zoom, không đưa dữ liệu cá nhân vào tile. Vẫn chọn, sửa, tìm kiếm, phân tích cô lập như bình thường. |
| **Quản trị** | Người dùng có 4 vai trò: Quản trị, Kỹ thuật (được sửa), Tổ hiện trường (ghi chỉ số, cập nhật hiện trường, hoàn thành lệnh bảo trì), Chỉ xem. Nhập/xuất GeoJSON để trao đổi với QGIS. |

Ảnh màn hình: [bản đồ](docs/screenshots/1-map.png) · [cô lập van](docs/screenshots/3-iso.png) ·
[sự cố](docs/screenshots/4-inc.png) · [khách hàng](docs/screenshots/5-cust.png) · [báo cáo](docs/screenshots/6-rep.png) ·
[giám sát SCADA](docs/screenshots/7-scada.png) · [bảo trì & vật tư](docs/screenshots/8-maintenance.png) ·
[ứng dụng hiện trường](docs/screenshots/9-field-app.png) · [vector tiles, mạng 260 nghìn đối tượng](docs/screenshots/10-vector-tiles.png)

## Kiến trúc

```
 Điện thoại (PWA, offline)            Cổng SCADA / AMI (Node-RED, historian…)
 IndexedDB + service worker            │ POST /api/scada/ingest (X-API-Key)
        │ /api/field/sync               ▼
┌───────┴────────┐  REST/JSON  ┌───────────────────┐   SQL    ┌──────────────────────┐
│ React + Leaflet │ ──────────▶ │ FastAPI (Python)  │ ───────▶ │ PostgreSQL + PostGIS  │◀── QGIS
│ (frontend/)     │ ◀── SSE ─── │ topology, cô lập, │ ◀─ NOTIFY │ mạng lưới, khách hàng,│
│ vector tiles    │             │ EPANET, bảo trì   │          │ telemetry, bảo trì…   │
└───────┬─────────┘             └───────────────────┘          │ hàm postgisftw.*      │
        │ MVT (tùy chọn)                                        └──────────┬───────────┘
        └──────────────▶ Martin / pg_tileserv ─────────────────────────────┘
```

- **backend/**: FastAPI, SQLAlchemy 2 + GeoAlchemy2, Shapely, xác thực bằng JWT.
  - `app/models.py`: mô hình dữ liệu (SRID 4326)
  - `app/services/topology.py`: bắt điểm, tách ống, thuật toán cô lập van (duyệt đồ thị BFS)
  - `app/services/epanet.py`: chuyển mạng lưới sang EPANET 2.2
  - `app/services/telemetry.py`, `realtime.py`: nhận số liệu SCADA/AMI, cảnh báo, phát sự kiện thời gian thực (LISTEN/NOTIFY)
  - `app/services/maintenance.py`: sinh lệnh bảo trì, hoàn thành lệnh, kho vật tư
  - `app/routers/`: các API `auth`, `network`, `incidents`, `customers`, `reports`, `io`, `field`, `attachments`, `scada`, `maintenance`, `tiles`
  - `app/sql/postgis_extras.sql`: trigger tự tính chiều dài ống khi sửa trong QGIS, cùng các view `v_pipes`, `v_valves`, `v_open_incidents`, `v_sensors`, `v_maintenance_due`
  - `app/sql/vector_tiles.sql`: hàm `postgisftw.aquanet_network(z, x, y)` sinh vector tile
  - `app/sql/migrations.sql`: nâng cấp CSDL đã tạo từ phiên bản 1.0 (tự chạy khi khởi động)
  - `app/seed.py`: dữ liệu mẫu (≈220 ống, 4 DMA, ≈500 khách hàng, 48 sự cố, 35 điểm đo kèm 7 ngày số liệu, kế hoạch & lịch sử bảo trì, kho vật tư)
  - `app/scada_sim.py`: bộ mô phỏng cổng SCADA; `app/gen_large.py`: sinh mạng lưới lớn để thử tải
  - `tests/`: kiểm thử tích hợp (pytest)
- **frontend/**: React 18, Vite, react-leaflet, Leaflet-Geoman (vẽ/sửa), Recharts, `@mapbox/vector-tile`.
  - `src/field/`: ứng dụng hiện trường (PWA); `pwa/sw-template.js`: service worker sinh lúc build
  - `src/components/VectorTileLayer.js`: lớp vector tiles vẽ bằng canvas cho Leaflet
- **tiles/martin.yaml**: cấu hình Martin.

## Cài đặt bằng Docker (Linux)

Dành cho máy chủ Linux hoặc máy có Docker. Máy chủ Windows + IIS: xem mục đầu tiên.


```bash
cp .env.example .env        # đổi DB_PASSWORD, SECRET_KEY
docker compose up -d --build
```

Mở http://localhost:8000. Tài khoản mẫu: `admin/admin123`, `kythuat/kythuat123`,
`hientruong/hientruong123` (tổ hiện trường), `xem/xem123`.
Tài liệu API (Swagger): http://localhost:8000/docs

Tùy chọn:

```bash
docker compose --profile demo up -d     # thêm bộ mô phỏng SCADA gửi số liệu mỗi 15 giây
docker compose --profile tiles up -d    # thêm Martin (cổng 3000) và pg_tileserv (cổng 7800)
```

> Khi triển khai thật: đặt `SEED_DEMO=0`, đổi mật khẩu admin, đặt `SECRET_KEY` mạnh, và
> chỉ mở cổng 5432 cho mạng nội bộ (QGIS). Ứng dụng hiện trường cần **HTTPS** (đặt sau nginx/Caddy
> có chứng chỉ): trình duyệt chỉ cho cài PWA, chạy offline (service worker) và lấy GPS trên HTTPS hoặc `localhost`.
>
> Nâng cấp từ phiên bản 1.0: chỉ cần chạy bản mới – bảng mới được tạo và cột mới được bổ sung tự động khi khởi động,
> dữ liệu cũ giữ nguyên.

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
python -m pytest -q                 # chạy kiểm thử (cần dữ liệu mẫu; cài thêm wntr để kiểm thử giải EPANET)

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
| `INGEST_API_KEYS` | (trống) | Khóa API cho cổng SCADA/AMI gửi số liệu (`X-API-Key`), nhiều khóa cách nhau bởi dấu phẩy |
| `TIMEZONE` | `Asia/Ho_Chi_Minh` | Múi giờ cho số liệu đo không kèm múi giờ và tính MNF |
| `UPLOAD_DIR` | `backend/data/uploads` | Thư mục lưu ảnh hiện trường (Docker: volume `uploads`) |
| `MAX_UPLOAD_MB` | 10 | Dung lượng tối đa mỗi ảnh |
| `TILE_URL_TEMPLATE` | `/api/tiles/{z}/{x}/{y}.pbf` | Nguồn vector tile cho bản đồ (đổi sang Martin/pg_tileserv nếu chạy riêng) |
| `VECTOR_TILE_THRESHOLD` | 20000 | Tổng số ống + nút vượt ngưỡng này thì bản đồ tự dùng vector tiles |

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
| GET | `/api/field/package?period=&zone_id=` | Gói dữ liệu tải về điện thoại (sổ ghi chỉ số, sự cố, lệnh bảo trì, vật tư) |
| POST | `/api/field/sync` | Gửi lô thao tác offline (`reading`, `incident`, `incident_update`, `task_complete`), chống trùng theo `uuid` |
| GET/POST/DELETE | `/api/attachments` | Ảnh hiện trường gắn với sự cố, lệnh bảo trì, lần ghi chỉ số |
| GET/POST/PUT/DELETE | `/api/scada/sensors` | Điểm đo SCADA, đồng hồ thông minh; `…/{id}/series?hours=` chuỗi số liệu |
| POST | `/api/scada/ingest` | Cổng thu thập gửi số liệu (`X-API-Key`), tối đa 5.000 điểm mỗi lần |
| GET | `/api/scada/stream` | Luồng thời gian thực (Server-Sent Events): số liệu mới, cảnh báo |
| GET/POST | `/api/scada/alarms`, `/api/scada/alarms/{id}/ack` | Cảnh báo vượt ngưỡng, xác nhận |
| GET | `/api/scada/overview`, `/api/scada/mnf?days=` | Tổng quan, lưu lượng đêm nhỏ nhất theo DMA |
| POST | `/api/scada/smart-meters/close-period?period=` | Chốt chỉ số kỳ từ đồng hồ thông minh |
| POST | `/api/scada/inflows/compute?period=` | Tính sản lượng cấp vào DMA từ đồng hồ tổng |
| GET | `/api/network/epanet.inp`, `/api/network/epanet/summary` | Xuất EPANET (`zone_id`, `source_pressure_m`, `srid`, `include_planned`, `demand_months`) |
| GET/POST/PUT/DELETE | `/api/maintenance/plans`, `…/{id}/generate` | Kế hoạch bảo trì định kỳ, sinh lệnh |
| GET/POST/PUT | `/api/maintenance/tasks`, `…/{id}/complete` | Lệnh công việc, hoàn thành (kèm vật tư) |
| GET | `/api/maintenance/summary` | Quá hạn, đến hạn, tuân thủ chu kỳ |
| GET/POST/PUT | `/api/materials`, `…/{id}/receive`, `…/{id}/adjust`, `/api/materials/issue` | Kho vật tư: nhập, kiểm kê, xuất |
| GET | `/api/materials/movements`, `/api/materials/usage` | Sổ nhập – xuất, chi phí vật tư theo phiếu |
| GET | `/api/tiles/{z}/{x}/{y}.pbf`, `/api/tiles/info` | Vector tile (MVT), thông tin chế độ hiển thị |
| GET | `/api/network/identify?lon=&lat=&tol_m=` | Tìm đối tượng tại điểm nhấp (chế độ vector tiles) |

## Ứng dụng hiện trường (PWA)

- Mở `https://may-chu/field` trên điện thoại, đăng nhập bằng tài khoản vai trò **Tổ hiện trường**, chọn
  *Thêm vào màn hình chính* để dùng như ứng dụng.
- Trước khi ra hiện trường: tab **Đồng bộ › Tải về máy** (chọn kỳ, DMA). Sau đó ghi chỉ số, báo sự cố,
  hoàn thành lệnh bảo trì được cả khi mất sóng; số mục chờ gửi hiện ở góc trên.
- Có mạng lại, ứng dụng tự gửi (và mỗi phút một lần nếu còn hàng đợi). Mục bị máy chủ từ chối (vd. chỉ số
  nhỏ hơn kỳ trước) được giữ lại kèm lý do để sửa hoặc bỏ.
- Dữ liệu offline gắn với tài khoản: người khác đăng nhập trên cùng máy không gửi nhầm dữ liệu của bạn.

## Kết nối SCADA và đồng hồ thông minh

1. Khai báo điểm đo ở trang **Giám sát SCADA** (mã, loại, `external_id` = tên tag SCADA hoặc mã thiết bị
   AMI, nút gắn kèm, ngưỡng cảnh báo). Đồng hồ thông minh: điền `meter_id` của đồng hồ khách hàng.
2. Đặt `INGEST_API_KEYS`. Cổng thu thập (Node-RED, Telegraf, historian của hãng SCADA, máy chủ LoRaWAN/NB-IoT…)
   gửi định kỳ:

   ```bash
   curl -X POST https://may-chu/api/scada/ingest -H "X-API-Key: <khoa>" -H "Content-Type: application/json" \
     -d '[{"sensor":"SCADA.DMA01.PT01","ts":"2026-10-11T08:00:00+07:00","value":2.85},
          {"sensor":"NBIOT-DH0000001","value":1532.4}]'
   ```

   Gửi trùng `(sensor, ts)` sẽ ghi đè nên cổng có thể gửi lại khi mất kết nối. Thời điểm không kèm múi giờ hiểu theo `TIMEZONE`.
3. Chạy thử khi chưa có SCADA: `python -m app.scada_sim --api-key <khoa>` (hoặc `docker compose --profile demo up -d`).
4. Cuối kỳ: **Chốt chỉ số ĐH thông minh** và **Tính sản lượng DMA** – số liệu vào thẳng sổ ghi chỉ số và báo cáo thất thoát.

Số liệu nằm trong bảng `telemetry` (khóa `sensor_id, ts`). Nếu máy chủ có TimescaleDB, bảng tự chuyển thành
hypertable để lưu hàng trăm triệu bản ghi.

## Mô phỏng thủy lực với EPANET

Trang **Quản trị › Mô phỏng thủy lực** (hoặc `GET /api/network/epanet.inp`): chọn toàn mạng hoặc một DMA, áp lực
đầu nguồn, bấm **Kiểm tra trước** để xem cảnh báo dữ liệu, rồi **Tải tệp .inp** và mở bằng EPANET 2.2
(*Project › Run Analysis*). Lưu ý:

- Nhập **cao độ** (`elevation_m`) cho nút để áp lực tính ra có ý nghĩa; thiếu thì tạm lấy 0 m.
- Bể chứa dùng mực nước mặc định (ghi trong cảnh báo) – hiệu chỉnh trong EPANET theo thực tế.
- Xuất theo DMA: các điểm cấp vào DMA (nút biên) thành RESERVOIR có cột nước cố định = cao độ + áp lực biên.
- Cụm ống không nối tới nguồn/bể bị loại ra (EPANET không giải được) và được liệt kê trong cảnh báo.

## Vector tiles cho mạng lưới lớn

Bản đồ GeoJSON tải toàn bộ đối tượng một lần – phù hợp mạng vài chục nghìn đối tượng. Lớn hơn, bản đồ tự chuyển
sang vector tiles (đổi được ở bảng lớp: *Tự động / GeoJSON / Vector tiles*). Đo trên mạng thử 105 nghìn ống,
53 nghìn nút, 106 nghìn khách hàng (`python -m app.gen_large`): tải toàn bộ lớp ống GeoJSON mất ~10 s, 41 MB;
một vector tile zoom 13 mất ~40 ms, 24 KB (đã nén gzip); sinh tile trong CSDL 2–50 ms tùy zoom.

Hàm `postgisftw.aquanet_network(z, x, y)` trả về tile nhiều lớp (`zones`, `pipes`, `nodes`, `customers`,
`incidents`) và có thể phục vụ bằng:

| Cách | URL tile | Ghi chú |
|---|---|---|
| API tích hợp (mặc định) | `/api/tiles/{z}/{x}/{y}.pbf` | Có đăng nhập, cùng cổng với ứng dụng |
| Martin (`--profile tiles`) | `http://may-chu:3000/aquanet_network/{z}/{x}/{y}` | Hiệu năng cao, có cache; cấu hình `tiles/martin.yaml` |
| pg_tileserv (`--profile tiles`) | `http://may-chu:7800/postgisftw.aquanet_network/{z}/{x}/{y}.pbf` | Tự xuất bản hàm trong schema `postgisftw` |

Đặt `TILE_URL_TEMPLATE` để giao diện dùng Martin/pg_tileserv. Hai tile server này **không có đăng nhập** – chỉ
mở trong mạng nội bộ, và dùng tài khoản CSDL chỉ có quyền gọi hàm tile (hàm là `SECURITY DEFINER` nên không cần
quyền đọc bảng; tile server không tự xuất bản được bảng `customers`):

```sql
CREATE ROLE tiles_reader LOGIN PASSWORD 'doi-mat-khau';
GRANT CONNECT ON DATABASE capnuoc TO tiles_reader;
GRANT USAGE ON SCHEMA postgisftw TO tiles_reader;
GRANT EXECUTE ON FUNCTION postgisftw.aquanet_network(integer, integer, integer) TO tiles_reader;
```

rồi đặt `TILES_DB_USER=tiles_reader`, `TILES_DB_PASSWORD=…` trong `.env`.

## Hướng phát triển tiếp

- Chạy mô phỏng EPANET ngay trên máy chủ và tô màu áp lực/lưu tốc lên bản đồ; hiệu chỉnh mô hình bằng số liệu SCADA
- Cầu nối MQTT/OPC UA đóng gói sẵn cho cổng thu thập
- Thông báo đẩy (push notification) cho cảnh báo SCADA và lệnh công việc mới
- Bản đồ nền offline cho ứng dụng hiện trường
