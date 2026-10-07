# Phần mềm Quản lý thất thoát nước

Nhập chỉ số thủy lượng kế (TLK), chuẩn thu, súc xả hằng tháng → phần mềm tự tính sản lượng phát ra,
tỷ lệ thất thoát từng khu vực / đội / toàn công ty, lũy kế, so tháng trước / kế hoạch / cùng kỳ năm trước,
và xuất báo cáo Excel đúng mẫu "BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC".

Mở phần mềm: chạy `ThatThoatNuoc.exe` (không cần cài đặt; máy có sẵn .NET Framework 4.8 của Windows 10/11).

**Bản 2.0 — website HTTP cổng 80 + app Android**: cài lên máy chủ IIS (ASP.NET Core Hosting Bundle 9.0) thì mọi người
dùng phần mềm qua trình duyệt ở `http://<máy chủ>/` (máy tính hoặc điện thoại) hay app Android, không cần chứng chỉ —
xem mục [Website trên máy chủ IIS](#website-trên-máy-chủ-iis--http-cổng-80-trình-duyệt-app-android-nhiều-máy-tính-dùng-chung).

## Dữ liệu có sẵn

Phần mềm đã nhập sẵn 22 tháng từ 2 file Excel đang dùng:

- `BC THAT THOAT NĂM 2025 DC.xlsx`: tháng 12/2024 → 12/2025
- `BẢNG TỔNG HỢP TỶ LỆ THẤT THOÁT NƯỚC tháng 9 năm 2026.xlsx`: tháng 1 → 9/2026

Khi nhập, phần mềm tính lại toàn bộ rồi so với số trong Excel: 1.610 dòng khớp, không có sai lệch
(sản lượng, chuẩn thu, tỷ lệ, lũy kế). Có dữ liệu năm 2025 nên cột "so cùng kỳ năm trước" của các
tháng 10–12/2026 tự có số.

Cũng đã lấy từ 2 file đó: **vùng DMA** trong bảng TỔNG HỢP (12 vùng năm 2026, 7 vùng năm 2025 — tỷ lệ từng
tháng, tình trạng như "TLK đứng kim", lũy kế) và **kế hoạch năm** (2025 đủ sản lượng phát ra, chuẩn thu, tỷ lệ;
2026 tỷ lệ của 6 đội và toàn công ty). Dòng đang ẩn trong Excel (vd DMA Đường Nguyễn Minh Quang 2026) được bỏ qua.
Lưu ý: bảng TỔNG HỢP 2026 ghi "DMA 3 Liên - Tám Ngàn" tháng 9 là 4578 (%) — có thể gõ nhầm, sửa ở trang Vùng DMA.

## Làm báo cáo một tháng mới (vd tháng 10/2026)

1. **Nhập số liệu tháng** → bấm **+ Tạo tháng 10/2026**. Phần mềm chép nguyên cấu trúc tháng 9;
   chỉ số tháng trước của mỗi TLK lấy bằng chỉ số hiện tại tháng 9; kỳ hoá đơn và ngày tiêu thụ nối tiếp.
2. Gõ **chỉ số hiện tại** của từng TLK vào các ô nền vàng, Enter để xuống ô nhập kế tiếp (tự bỏ qua dòng công thức).
   Nhập **súc xả** (cột Sản lượng) và **chuẩn thu** của từng khu vực / đội.
   - Dán được từ Excel: chép 1 cột số rồi Ctrl+V vào ô đầu tiên.
   - Phím Delete xoá ô đang chọn. Mỗi lần sửa đều tự lưu.
   - **Lũy kế** chỉ cộng các tháng trong cùng năm: sang **tháng 1 năm sau** lũy kế tự bắt đầu lại từ số của tháng 1
     (cả đội, khu vực, TLK và vùng DMA; cả trong file Excel xuất). "So tháng trước" của tháng 1 so với tháng 12 năm trước,
     "so cùng kỳ" so với tháng 1 năm trước. Khi tạo tháng 1, phần mềm nhắc nếu năm mới chưa có kế hoạch.
3. Đội / khu vực / toàn công ty tự cộng theo công thức như file Excel (vd Đội 1 = 1 + 2 − 3, làm tròn).
   Các thẻ phía trên cho biết tỷ lệ thất thoát của từng đội so với kế hoạch (đỏ là vượt kế hoạch).
4. Xem khung **Kiểm tra số liệu** phía dưới: TLK chưa nhập, chỉ số mới nhỏ hơn cũ, sản lượng tăng / giảm bất thường,
   tỷ lệ âm… Bấm vào một dòng là tới ngay ô cần sửa.
5. **Thông tin kỳ báo cáo…**: kỳ hoá đơn, ngày tiêu thụ, ngày lập, ghi chú giải trình cuối báo cáo, người ký.
6. **Xuất Excel tháng này** → được file báo cáo tháng đúng mẫu, in A4 ngang.

### Các trường hợp đặc biệt (khung chi tiết bên phải)

Chọn 1 dòng, khung bên phải hiện cách tính và các ô ít dùng:

- **Thay / reset đồng hồ trong kỳ**: nhập chỉ số chốt đồng hồ cũ và chỉ số đầu đồng hồ mới,
  sản lượng = (chốt cũ − tháng trước) + (hiện tại − đầu mới).
- **Cộng thêm / trừ bớt**: vd cộng sản lượng TLK Cái Răng 14.200 m³, tạm tính 3 ngày 4.423 m³.
- **Nhập tay sản lượng**: khi không tính theo chỉ số được (vd reset đồng hồ không ghi được số cũ).
- **Số so sánh**: tỷ lệ tháng trước, cùng kỳ năm trước, lũy kế các tháng trước. Để trống thì phần mềm tự tính;
  chỉ cần nhập khi phần mềm chưa có số liệu tháng / năm đó.
- **Ghi chú** của dòng: được in vào báo cáo.

Nút **Ẩn khung chi tiết** để lưới nhập rộng hơn.

## Vùng DMA của từng đội

Trang **Vùng DMA** (Ctrl+2): chọn tháng và đội (hoặc "Tất cả các đội"). Lưới liệt kê từng đội / khu vực, bên dưới là các vùng DMA của nó.

- **+ Tạo tháng …** (nút xanh): tạo tháng kế tiếp ngay tại trang này, giống nút trên trang Nhập số liệu tháng —
  chép cấu trúc và danh sách vùng DMA, vùng đo bằng đồng hồ lấy chỉ số tháng trước, lũy kế nối tiếp; con trỏ đứng sẵn
  ở ô nhập của vùng đầu tiên. Số liệu TLK của các đội vẫn nhập ở trang Nhập số liệu tháng (cùng tháng vừa tạo).

- **+ Thêm vùng DMA**: đặt tên, chọn đội / khu vực chứa, chọn cách có sản lượng phát ra: *nhập số m³* (đội báo lên)
  hoặc *theo chỉ số đồng hồ tổng DMA*. **Sửa…** (hoặc nhấp đúp tên) để đổi tên / đơn vị / cách nhập; **▲ ▼** đổi thứ tự;
  **Xoá** bỏ vùng từ tháng đang chọn trở đi (số các tháng trước vẫn giữ và vẫn hiện trong bảng tổng hợp năm).
  Thêm / sửa / xoá áp dụng cho tháng đang chọn và các tháng sau đã tạo; tháng mới tạo sẽ chép danh sách vùng DMA.
- Hằng tháng gõ **phát ra** (hoặc chỉ số hiện tại) và **chuẩn thu** → phần mềm tính tỷ lệ thất thoát, so tháng trước, lũy kế.
  Đội chỉ báo tỷ lệ: để trống sản lượng, gõ thẳng vào cột **Thất thoát %**. Đồng hồ hỏng / đứng kim: để trống số,
  ghi vào cột **Tình trạng** (vd "TLK đứng kim") — chữ này hiện trong ô tháng của bảng tổng hợp.
- Vùng DMA không in trong báo cáo tháng; trong **Bảng tổng hợp năm** (màn hình và file Excel) mỗi vùng hiện ngay dưới
  đội / khu vực của nó, đánh số 1, 2, 3…, kèm lũy kế phát ra, chuẩn thu, tỷ lệ — như bảng TỔNG HỢP đang làm.
- **Nhập từ Excel…**: lấy lại vùng DMA từ bảng TỔNG HỢP của file báo cáo (cần có các tháng của năm đó trong phần mềm).

## Kế hoạch năm

Trang **Kế hoạch năm** (Ctrl+4): kế hoạch giao chỉ tiêu của từng đội / khu vực / toàn công ty — sản lượng phát ra,
sản lượng chuẩn thu, doanh thu tiền nước, tỷ lệ thất thoát, tồn hoá đơn (cột nền vàng). Cột nền xanh là thực hiện lũy kế
và % hoàn thành do phần mềm tự tính. **+ Thêm năm** để lập kế hoạch năm sau; **Chép kế hoạch năm trước**; dán được cả bảng
từ Excel (chọn ô đầu rồi Ctrl+V). **Xuất Excel** ra trang "KẾ HOẠCH GIAO CHỈ TIÊU NĂM" và "TÌNH HÌNH THỰC HIỆN KẾ HOẠCH".
Tỷ lệ thất thoát kế hoạch dùng cho cột "So kế hoạch" của các báo cáo.

## Xuất / in báo cáo

Trang **Xuất / in báo cáo**: mỗi mẫu có nút **Xuất Excel…** (lưu file) và **In…** (in thẳng, không cần mở Excel):

| Mẫu | Nội dung |
|---|---|
| Báo cáo tháng | như trang "Tháng 9-2026" |
| Bảng tóm tắt tháng | như trang "BC A KIÊN" |
| Báo cáo quý | như trang "Quý 3-2026"; nút "Số so sánh quý…" để nhập tay khi thiếu quý trước / năm trước |
| Bảng tổng hợp năm | như trang "TỔNG HỢP" |
| Gộp nhiều tháng | như trang "Tháng 8 + 9" |
| Sổ cả năm | 1 file đủ các trang: kế hoạch, tóm tắt, tổng hợp, từng tháng, từng quý |

Các ô tính toán trong file xuất có công thức Excel (vd `=D12-C12`, `=(E20-F20)/E20*100`), nên sửa số trong Excel vẫn tự tính lại.

**In…**: mở cửa sổ xem trước đúng mẫu như file Excel (khổ A4 ngang / dọc theo từng mẫu, vừa bề ngang 1 trang giấy,
lặp dòng tiêu đề cột ở mỗi trang, ghi "Trang 1/3" khi nhiều trang). Chọn máy in, số bản rồi bấm **In** (hoặc Ctrl+P);
**Tuỳ chọn máy in…** để in 1 số trang hoặc chỉnh máy in. ◀ ▶ (hoặc PageUp / PageDown) xem từng trang.
Nút **In…** còn có ở trang Nhập số liệu tháng (báo cáo tháng đang chọn), Tổng hợp năm, Vùng DMA (bảng tổng hợp năm),
Kế hoạch năm và Đồng hồ cấp 1 (nút **In ▾**: báo cáo khai thác tháng hoặc tổng hợp năm).

## Cấu trúc mạng lưới (thêm / bớt TLK, khu vực)

Trang **Cấu trúc mạng lưới** chỉnh cấu trúc của tháng đang chọn (vd khi có TLK mới như A3 "Thuỷ lượng kế tổng D.150mm" từ tháng 9):

- **+ Thêm dòng** / **Sửa…** / **Xoá** / **Lên** / **Xuống**.
- Mỗi dòng có 3 loại: **Đồng hồ (TLK)** (hiện tại − tháng trước, có thể khai sai số TLK %),
  **Nhập trực tiếp** (vd súc xả), **Công thức** (cộng trừ các dòng khác bằng STT, vd `A1 - A1.1 - A1.2 + A2`;
  STT trùng ở nhóm khác thì ghi kèm nhóm, vd `V.1.2`). Phần mềm kiểm tra công thức ngay khi gõ và chặn vòng lặp.
- **Chuẩn thu**: không tính / nhập số / cộng các dòng (vd Đội 2 = 1 + 2).
- **Bảng tổng hợp**: đánh dấu dòng là Đội / Khu vực / Toàn công ty / DMA để đưa vào bảng tổng hợp, kèm tên ngắn (vd "KV. Long Mỹ").
- Mỗi tháng giữ cấu trúc riêng (như mỗi tháng 1 trang Excel); tháng mới tạo sau chép theo tháng cuối.
  Nếu đã lỡ tạo tháng sau, dùng **Chép cấu trúc sang các tháng sau…**.

## Đồng hồ cấp 1 — sản lượng khai thác nước thô / nước mặt

Trang **Đồng hồ cấp 1** (Ctrl+7, nhóm "KHAI THÁC NƯỚC THÔ" trên thanh menu) **tách riêng** với các báo cáo thất thoát:
số liệu ở đây không làm thay đổi báo cáo thất thoát, bảng tổng hợp hay kế hoạch năm.

- Quản lý theo cấp: **Đội → Trạm cấp nước / nhà máy → Đồng hồ cấp 1**. Mỗi đồng hồ có tên, nguồn nước
  (**Giếng** = nước ngầm, hoặc **Nước mặt** = sông, kênh), hệ số nhân (đồng hồ ×10, ×100…; ghi m³ thì để 1).
  Danh sách đội lấy sẵn theo báo cáo thất thoát (Đội Cấp nước số 1…6).
- Lần đầu: **Nhập từ Excel…** file "BÁO CÁO SẢN LƯỢNG NƯỚC THÁNG 09/2026" (mẫu đang dùng: dòng I = đội,
  1, 2 = trạm / nhà máy với thời gian chốt ở cột C, 1.1, 2.1 = TLK cấp I với chỉ số tháng trước, hiện tại).
  Phần mềm tự lập danh mục đội / trạm / đồng hồ và lấy chỉ số. Mỗi đội 1 file hay cả công ty 1 file đều được.
  Tên đồng hồ không ghi rõ giếng hay nước mặt thì phần mềm đoán (nhà máy → nước mặt) và báo lại — kiểm tra ở **Sửa…**.
  Hoặc **+ Tạo tháng đầu tiên** rồi **+ Thêm đồng hồ** (chọn trạm; trạm mới thì bấm **+ Trạm mới…** và chọn đội).
- Hằng tháng: **+ Tạo tháng …** (chỉ số tháng trước = chỉ số hiện tại tháng cuối, kỳ khai thác nối tiếp) → gõ **chỉ số hiện tại**
  từng đồng hồ (Enter xuống dòng). Sản lượng = (hiện tại − tháng trước) × hệ số; tự cộng theo trạm, đội,
  **nước giếng / nước mặt**, toàn công ty; so tháng trước (%); **lũy kế năm** (tháng 1 bắt đầu lại).
- Đồng hồ hỏng / ước tính: gõ thẳng số vào cột **Sản lượng** (chữ xanh); phím Delete để tính lại theo chỉ số.
- Thay đồng hồ / đồng hồ quay vòng: nút **Thay ĐH / lũy kế…** (chốt ĐH cũ, đầu ĐH mới). Ở đó cũng nhập
  **lũy kế các tháng trước** khi bắt đầu dùng giữa năm.
- Cột **Ghi chú / thời gian chốt** của dòng trạm: thời gian chốt số (vd "Từ 6h 21/8 đến 6h 21/9"), in lên báo cáo.
- Đồng hồ không dùng nữa: chọn đồng hồ → **Xoá** (ngừng dùng từ tháng đang xem; số liệu các tháng trước vẫn giữ
  và vẫn cộng vào lũy kế năm). **Đội & trạm…**: thêm / đổi tên đội, trạm, chuyển trạm sang đội khác.
- Lọc theo đội ở ô "Tất cả các đội". **Xem cả năm**: bảng sản lượng từng tháng trong năm.
- **Xuất Excel**: báo cáo sản lượng khai thác tháng (cùng mẫu, thêm cột nguồn nước, dòng tổng cộng và
  "Trong đó: nước giếng / nước mặt", người ký theo trang Cài đặt) hoặc tổng hợp khai thác 12 tháng của năm.
  Đang lọc 1 đội thì xuất riêng đội đó.

## Người dùng: Admin toàn quyền, người dùng chỉ xem

- Lần đầu mở bản này, phần mềm mời **tạo tài khoản Admin** (bấm "Để sau" thì như cũ: ai mở cũng toàn quyền).
  Có tài khoản rồi thì mỗi lần mở phần mềm phải **đăng nhập**; tên người đăng nhập hiện ở chân thanh menu.
- **Admin**: nhập, sửa, xoá số liệu, cài đặt, quản lý người dùng (Cài đặt → Người dùng → **Người dùng…**: thêm / sửa / đổi mật khẩu / xoá).
- **Người dùng (chỉ xem)**: xem mọi trang, xuất Excel, in — mọi nút sửa / thêm / xoá / nhập bị khoá, ô nhập chỉ đọc,
  phần mềm không lưu bất kỳ thay đổi nào.
- **Đổi người dùng / đăng xuất**: Cài đặt → Người dùng (phần mềm mở lại để đăng nhập).
- Khi đã nối máy chủ IIS: người dùng là **tài khoản trên máy chủ** (dùng chung cho trang web, app Android và máy tính):
  "Admin (toàn quyền)" sửa được trên máy tính; "Chỉ xem" và "Nhập đồng hồ cấp 1" mở phần mềm máy tính ở chế độ chỉ xem
  (tài khoản "Nhập đồng hồ cấp 1" nhập chỉ số trên trang web / app). Admin quản lý ở thẻ **Quản trị** của trang web
  hoặc "Tài khoản người dùng (máy tính, điện thoại)…" trên phần mềm máy tính.

## Website trên máy chủ IIS — HTTP cổng 80, trình duyệt, app Android, nhiều máy tính dùng chung

Dữ liệu đặt trên máy chủ IIS của công ty; IIS (qua ASP.NET Core Module trong **ASP.NET Core Hosting Bundle 9.0**)
chạy chính file `ThatThoatNuoc.exe` ở chế độ máy chủ, phục vụ website **HTTP cổng 80**, giữ dữ liệu ở `C:\ThatThoatNuocData`,
tự sao lưu mỗi ngày. Không cần chứng chỉ, không cần ZeroTier.

```
Trình duyệt (máy tính, điện thoại) ─┐
App Android                         ─┼─ http://<máy chủ>/ ─> IIS ─> ThatThoatNuoc.exe (chế độ máy chủ) ─> C:\ThatThoatNuocData
Phần mềm trên máy tính (đồng bộ)    ─┘
```

1. **Gói cài**: thư mục `ThatThoatNuoc-MayChu-IIS` (có sẵn cạnh file này; tạo lại bằng `build.bat` hoặc trong phần mềm:
   Cài đặt → Máy chủ dữ liệu → **Tạo gói cài IIS…**). Chép thư mục gói sang máy chủ, nhấp đúp `CaiDat-IIS.bat`
   (xem `HUONG_DAN_IIS.txt` trong gói). Script tạo site **http cổng 80** (cổng 80 đã có "Default Web Site" thì cài thành
   ứng dụng con `http://<máy chủ>/thatthoat/`; muốn ở ngay `http://<máy chủ>/` thì chạy `CaiDat-IIS.bat -ThaySiteMacDinh`),
   hỏi mật khẩu tài khoản **quản trị**, mở tường lửa, in ra các địa chỉ truy cập.
2. **Trình duyệt**: mở địa chỉ đó trên máy tính hoặc điện thoại, đăng nhập. Trang web có:
   - **Thất thoát**: tỷ lệ thất thoát tháng (toàn công ty, đội, khu vực, vùng DMA, so kế hoạch / tháng trước / cùng kỳ, lũy kế)
     và bảng tổng hợp cả năm;
   - **Cấp 1**: nhập chỉ số đồng hồ cấp 1 (tự tính sản lượng, tổng giếng / nước mặt, tạo tháng mới, thời gian chốt số);
   - **Báo cáo**: tải Excel / PDF các mẫu (tháng, tóm tắt, quý, tổng hợp năm, kế hoạch, sổ cả năm, khai thác cấp 1);
   - **Tài khoản**: đổi mật khẩu, đăng xuất;
   - **Quản trị** (chỉ Admin): địa chỉ để gửi người dùng, thêm / sửa quyền / đặt lại mật khẩu / khoá / xoá tài khoản
     (Chỉ xem / Nhập đồng hồ cấp 1 — có thể giới hạn 1 đội / Admin).
   Trên điện thoại có thể "Thêm vào màn hình chính".
3. **App Android** `ThatThoatNuoc-DienThoai.apk`: tải tại `http://<máy chủ>/tai-app`, mở app, nhập địa chỉ máy chủ, đăng nhập.
   Giống trang web, thêm: in PDF thẳng qua máy in của điện thoại, mở / chia sẻ (Zalo, email) / lưu file Excel, PDF.
   Mã nguồn và cách build lại: thư mục `android` (xem `android/README.md`).
4. **Phần mềm trên máy tính** (nhập số liệu thất thoát, cấu trúc mạng lưới, kế hoạch, vùng DMA, nhập Excel…):
   Cài đặt → Máy chủ dữ liệu → **Kết nối máy chủ…** → nhập địa chỉ (vd `192.168.1.10`, `tenmien.vn/thatthoat`;
   cổng khác 80 thì ghi kèm, vd `tenmien.vn:8081`) → Kiểm tra → tài khoản quản trị → lần đầu chọn đưa dữ liệu trên máy này lên.
   Từ đó mỗi lần sửa vẫn lưu ngay trên máy và tự gửi lên máy chủ sau ~1 giây; số nhập trên web / app tự tải về
   (trạng thái ● ở chân thanh menu). Mất mạng: thay đổi được giữ lại và tự gửi khi có mạng.
   Hai máy tính cùng sửa: máy gửi sau được báo và tải bản mới nhất (bản của máy đó được giữ trong SaoLuu).
5. **Ngắt kết nối**: phần mềm quay lại dùng bản dữ liệu trên máy này; trang web / app vẫn dùng dữ liệu máy chủ.

**Nâng cấp từ bản 1.0 (HTTPS cổng 8080, có "mã nhận dạng" chứng chỉ)**: chạy `CaiDat-IIS.bat` của gói mới trên máy chủ —
giữ nguyên dữ liệu, tài khoản; chuyển sang HTTP cổng 80, gỡ chứng chỉ tự ký và site / ứng dụng con cũ ở cổng 8080.
Thay `ThatThoatNuoc.exe` trên các máy tính bằng bản mới (bản mới tự đổi địa chỉ cũ `x:8080` thành `x`; sai thì
"Kết nối lại / đổi máy chủ…"). Điện thoại: gỡ app cũ, cài app mới từ `http://<máy chủ>/tai-app`.

**Bảo mật**: HTTP không mã hoá — mật khẩu và số liệu đi qua mạng ở dạng thường. Nên dùng trong mạng nội bộ / VPN.
Khi có chứng chỉ thật cho tên miền, thêm binding https cho site trong IIS Manager: trang web, app và phần mềm máy tính
đều dùng được địa chỉ `https://…` mà không cần sửa gì.

## Cài đặt

- Tên công ty, địa danh ghi ngày lập, người ký mặc định, ngưỡng nhắc sản lượng tăng / giảm.
- **Nhập từ file Excel báo cáo…**: nhập thêm file khác (chỉ đọc .xlsx; file .xls cũ thì mở bằng Excel và lưu thành .xlsx trước).
  Danh sách cho chọn: các trang tháng (tháng đã có sẽ được thay bằng số trong file, vùng DMA của tháng đó vẫn giữ),
  trang kế hoạch, bảng TỔNG HỢP có vùng DMA.

## Dữ liệu và sao lưu

- Toàn bộ số liệu nằm trong `DuLieu\thatthoat.xml` cạnh file `ThatThoatNuoc.exe`.
  Chép cả thư mục `ThatThoatNuoc` sang máy khác là mang theo đủ dữ liệu.
- Mỗi lần sửa đều tự lưu. Bản trước đó giữ ở `thatthoat.xml.bak`; mỗi ngày giữ 1 bản trong `DuLieu\SaoLuu` (90 ngày gần nhất).
  Nút "Sao lưu ngay" ở trang Cài đặt tạo thêm 1 bản bất kỳ lúc nào.
- Muốn bắt đầu lại từ đầu: đóng phần mềm, đổi tên thư mục `DuLieu`, mở lại rồi nhập file Excel.

## Biên dịch lại (khi sửa mã nguồn)

Chạy `build.bat`: biên dịch `ThatThoatNuoc.exe` bằng trình biên dịch C# có sẵn trong Windows (.NET Framework 4,
không cần Visual Studio) rồi tạo lại gói cài IIS `ThatThoatNuoc-MayChu-IIS` (kèm `ThatThoatNuoc-DienThoai.apk`).
Mã nguồn nằm trong thư mục `src`; trang web trong `web` (nhúng vào file .exe); script cài IIS trong `iis`;
app Android trong `android`.

Mỗi lần đẩy lên GitHub, GitHub Actions (`.github/workflows/build.yml`) tự build `ThatThoatNuoc.exe` + APK,
cài thử website lên IIS thật (Windows Server + Hosting Bundle 9.0) và cho tải gói cài ở tab Actions → Artifacts.
