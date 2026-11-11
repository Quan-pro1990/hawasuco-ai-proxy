# Phần mềm Nhân sự – Chấm công – Tiền lương

Mở file **`ChamCong_TinhLuong.html`** bằng trình duyệt (Chrome, Edge, Cốc Cốc, Firefox) là dùng được ngay:
không cần cài đặt, không cần Internet, không cần máy chủ. Có thể chép file này sang máy khác, USB.

**Dùng chung trên máy chủ IIS** (nhiều phòng, đội cùng làm, tài khoản đăng nhập, phân quyền, sao lưu tự động sang ổ D):
nhấp đúp **`CaiDat-MayChu-IIS.bat`** trên máy chủ – xem [`iis/HUONG_DAN_IIS.txt`](iis/HUONG_DAN_IIS.txt).
Địa chỉ mặc định: **https://qlns.capnuochaugiang.vn/**

Lần mở đầu tiên phần mềm nạp **dữ liệu mẫu** (17 nhân viên, 13 tháng chấm công) để xem thử mọi chức năng.
Khi dùng thật: trang **Tổng quan** → bấm **Xoá dữ liệu mẫu, bắt đầu nhập thật** (giữ lại cài đặt, ký hiệu, phụ cấp, ngày lễ).

> Dữ liệu lưu trong trình duyệt của máy đang dùng. Vào **Cài đặt & dữ liệu → Sao lưu dữ liệu** mỗi tuần để có file `.json`
> dự phòng; muốn chuyển sang máy khác thì sao lưu ở máy cũ rồi **Khôi phục từ file** ở máy mới.

## Trợ lý ảo Hawasuco

Linh vật robot ở góc phải dưới (giống trợ lý ảo trên web.capnuochaugiang.vn) – bấm vào hoặc nhấn **Ctrl + K** để hỏi.
Trợ lý chạy ngay trong phần mềm, **không gửi dữ liệu ra ngoài**, trả lời theo quyền của tài khoản đang dùng:
- **Hướng dẫn cách làm**: "cách chấm công", "nâng bậc lương thế nào", "sao lưu dữ liệu", "sửa tỷ lệ bảo hiểm ở đâu"… – trả lời từ
  hướng dẫn sử dụng này, kèm nút mở đúng trang / thẻ cài đặt.
- **Tìm nhanh**: gõ tên, mã NV, số điện thoại, số hợp đồng, quyết định, tên phòng / đội ("đội 1").
- **Hỏi số liệu**: ai sắp hết hạn hợp đồng (trong 60 ngày, tháng 12…), ai đang thử việc, hôm nay ai nghỉ, đơn nghỉ chờ duyệt,
  ô chấm công còn trống, sinh nhật tháng này, sắp nghỉ hưu, số nhân viên từng đơn vị, lương / chấm công / hợp đồng của một người,
  lương cơ sở, tiền cơm, tạm ứng kỳ I, ngày lễ sắp tới, tỷ lệ bảo hiểm, giảm trừ gia cảnh, ký hiệu chấm công, quyền của tôi.
- **Mở trang**: "mở bảng lương", "vào chấm công".
Gõ không dấu cũng được. Mũi tên lên / xuống để gọi lại câu đã hỏi; Esc để đóng.

**Cảm xúc, cử chỉ của linh vật**: robot chớp mắt, nghiêng đầu và đưa mắt nhìn theo con trỏ chuột, vẫy chào khi rê chuột vào
(để lâu thì cười khúc khích), thỉnh thoảng nhắc một câu, ngủ gật 💤 khi lâu không ai thao tác và thức dậy khi có người dùng.
Khi trả lời, robot biểu lộ theo nội dung: gật đầu khi tra được thông tin, ngạc nhiên ⚠️ khi có hợp đồng quá hạn, mừng ✅ khi
không có việc phải lo, nhảy múa 🎂 khi có sinh nhật, mắt tim 💙 khi được cảm ơn, lắc đầu 😥 khi không tìm thấy hoặc không có quyền…
Trò chuyện vui: “bạn là ai”, “bạn khỏe không”, “nhảy đi”, “xoay đi”, “kể chuyện cười”. Tắt chuyển động ở nút cài đặt giọng nói
(ô *Linh vật chuyển động, chào hỏi, ngủ gật khi rảnh*); máy đặt *giảm chuyển động* trong hệ điều hành thì robot tự đứng yên.

**Giao tiếp bằng giọng nói** (Chrome, Edge):
- Bấm **micro** 🎤 cạnh ô nhập rồi nói câu hỏi tiếng Việt – nói xong trợ lý tự gửi và **đọc câu trả lời** (robot há miệng khi nghe,
  nhép miệng khi nói). Lần đầu trình duyệt hỏi quyền dùng micro: chọn *Cho phép*.
- Nút **loa** 🔊 trên đầu khung: bật để đọc cả câu trả lời của câu hỏi gõ tay; bấm khi đang đọc để dừng. Nút loa nhỏ trên từng câu trả lời: đọc lại.
- Nút **cài đặt giọng nói**: chọn giọng đọc, tốc độ, **nói chuyện liên tục** (đọc xong tự nghe câu tiếp theo).
  Lệnh nói: “dừng”, “đọc lại”, “kết thúc”.
- Đọc câu trả lời dùng **giọng tiếng Việt cài trên máy**. Máy chưa có: Windows → Cài đặt → Thời gian & ngôn ngữ → Giọng nói →
  Thêm giọng nói → Tiếng Việt (hoặc chọn giọng “trực tuyến” của Edge – văn bản câu trả lời được gửi tới dịch vụ đọc của trình duyệt).
- Nói câu hỏi: trình duyệt chuyển giọng nói thành chữ (Chrome, Edge gửi âm thanh câu hỏi tới dịch vụ nhận dạng giọng nói của
  Google / Microsoft, cần Internet). Dữ liệu nhân sự vẫn chỉ xử lý trên máy. Đơn vị có thể tắt micro ở
  **Cài đặt & dữ liệu → Đơn vị & chữ ký → Trợ lý ảo**. Micro cần trang mở bằng https (máy chủ) hoặc mở file trực tiếp trên máy.

## Thiết lập ban đầu (làm 1 lần)

1. **Cài đặt & dữ liệu → Đơn vị & chữ ký**: tên đơn vị, địa danh (vd *Cần Thơ*), mẫu biểu theo TT 133 hay TT 200,
   tiêu đề bảng lương (vd *BẢNG THANH TOÁN TIỀN LƯƠNG VĂN PHÒNG CÔNG TY*), người ký.
2. **Kỳ công & giờ làm**: chọn **kỳ công bắt đầu từ ngày** – vd *ngày 21* thì bảng chấm công tháng 10 tính từ 21/9 đến 20/10.
   Chọn ngày nghỉ hằng tuần chung, giờ vào – ra (dùng khi đọc máy chấm công).
3. **Danh mục**:
   - **Loại lao động & công chuẩn**: mặc định *Nhân viên văn phòng* = **22 công** (nghỉ thứ 7, chủ nhật) và
     *Công nhân* = **26 công** (nghỉ chủ nhật). Công chuẩn là số cố định, không đổi theo tháng; để trống thì phần mềm
     đếm số ngày làm việc thực tế trong kỳ. Thêm loại khác được (vd bảo vệ, trực ca).
   - **Sản phẩm (lương SP)**: tên, đơn vị tính, đơn giá – vd *Hoá đơn ghi thu 1.200 đ/HĐ*, *Lắp đặt đồng hồ … đ/cái*.
   - **Phụ cấp**: *Cơm trưa* mặc định **50.000 đ/ngày** áp dụng cho mọi nhân viên (cột *Mức chung*).
   - **Phòng, đội**: cột *Bảng lương* cho biết phòng / đội in chung bảng lương nào (Văn phòng công ty gồm Ban GĐ và các phòng;
     mỗi đội 1 bảng); thẻ *Bảng lương và ngân hàng chi lương*: tiêu đề in, ngân hàng chi lương, số tài khoản công ty.
   - **Phòng, đội**: thêm / đổi tên / sắp xếp (thứ tự in trên bảng), chọn loại *Phòng, Đội, Ban, Tổ, Xí nghiệp*.
   - **Thang, bảng lương**: các bảng lương, chức danh và từng bậc (mức tiền hoặc hệ số × lương cơ sở) – xem mục *Xếp lương, nâng bậc*.
   - Ký hiệu chấm công, ngày lễ (bấm *Tạo tự động* cho từng năm).
4. **Hồ sơ nhân viên**: thêm từng người hoặc **Nhập từ Excel** (bấm *Tải file mẫu* để có đúng các cột). Mỗi người cần:
   - **Loại lao động** (văn phòng 22 công / công nhân 26 công). Ai khác thì nhập *Công chuẩn riêng*.
   - **Sản phẩm chính** nếu có lương sản phẩm (có thể đặt đơn giá riêng cho người đó).
   - **Mức lương/HĐ**, phụ cấp riêng nếu có, có tham gia BH không, đoàn viên công đoàn, số người phụ thuộc.
     Tiền cơm **50.000 đ/ngày** đã là mức chung cho mọi người, không cần nhập; ai khác mức thì nhập mức riêng, nhập 0 = không hưởng.
   - **Tài khoản ngân hàng nhận lương**: số tài khoản, ngân hàng, chi nhánh (dùng cho danh sách đề nghị chi lương gửi ngân hàng).
     Danh sách nhân viên có cột tài khoản, đánh dấu ai *Chưa có*; tìm được theo số tài khoản.
   - **Mã chấm công** = số ID của người đó trên máy chấm công vân tay (nếu dùng).

## Quản lý nhân sự

Menu **Nhân sự** dùng chung dữ liệu với chấm công và tiền lương: sửa hồ sơ, hợp đồng, quyết định, đơn nghỉ là bảng
chấm công, bảng lương tự cập nhật theo.

### Hồ sơ nhân viên
Bấm 1 người trong danh sách để mở hồ sơ gồm các tab:
- **Thông tin cá nhân**: ảnh 3×4, ngày sinh, nơi sinh, quê quán, dân tộc, tôn giáo, CCCD (ngày cấp, nơi cấp), địa chỉ thường trú,
  chỗ ở, liên hệ khẩn cấp, trình độ học vấn – chuyên môn – ngoại ngữ – tin học – lý luận chính trị, Đảng viên.
- **Công việc & lương**: phòng / đội (nút *Điều chuyển* lập quyết định), chức vụ, bảng lương – chức danh – bậc, loại lao động, trạng thái, ngày vào / nghỉ, mức lương, phụ cấp, sản phẩm, ngân hàng, phép năm.
- **Bảo hiểm, thuế & người phụ thuộc**: lương đóng BH, số sổ BHXH, mã thẻ BHYT, nơi KCB; MST; danh sách **người phụ thuộc**
  có *từ tháng – đến tháng* để giảm trừ gia cảnh đúng từng tháng.
- **Hợp đồng lao động**, **Quá trình công tác**, **Nghỉ phép** (phép năm theo tháng, đơn nghỉ), **Lương các kỳ** (12 kỳ gần nhất).
- **Hồ sơ scan**: lưu trữ bản scan hợp đồng, quyết định, CCCD, sơ yếu lý lịch, bằng cấp, giấy khám sức khoẻ, sổ BHXH…
  để khi cần thì xem, tải xuống. Kéo thả hoặc **Chọn tệp…** (PDF, ảnh, Word, Excel; tối đa 25 MB/tệp; nhiều tệp một lần), chọn loại
  và hợp đồng gắn kèm; sửa loại, ghi chú (vd *bản gốc lưu tủ 2*); **Xem**, **Tải về**, **Tải tất cả (.zip)** (chia thư mục theo loại).
  Ở tab Hợp đồng lao động mỗi hợp đồng có cột *Bản scan* và nút tải bản scan lên; trang Hợp đồng lao động cho biết hợp đồng nào chưa có bản scan.
  Trên máy chủ, tệp lưu ở thư mục dữ liệu (`D:\ChamCongData\TepHoSo`) và chép thêm 1 bản vào thư mục sao lưu (xoá trong phần mềm thì bản sao lưu vẫn giữ);
  tài khoản chấm công không xem được. Chạy 1 file trên máy: tệp lưu trong trình duyệt của máy đó (không nằm trong file sao lưu .json).
- **In sơ yếu lý lịch** (A4, có ảnh). Sửa xong bấm **Lưu hồ sơ** (rời trang thì phần mềm tự lưu).

### Hợp đồng lao động
- Thêm hợp đồng ở hồ sơ hoặc trang **Hợp đồng lao động**: giai đoạn, số, loại (thử việc, xác định / không xác định thời hạn, thời vụ),
  ngày ký, hiệu lực, chức danh, mức lương, phụ cấp, địa điểm, công việc.

### Giai đoạn ký hợp đồng
- Mặc định 4 giai đoạn: **Hợp đồng thử việc 1 tháng → Hợp đồng chính thức 1 năm → Hợp đồng chính thức 3 năm → Hợp đồng không xác định
  thời hạn**. Sửa tên, thời hạn, thứ tự, thêm / bớt ở **Danh mục → Giai đoạn hợp đồng** (số tháng của giai đoạn thử việc cũng là số tháng
  thử việc mặc định).
- **Ký hợp đồng tiếp theo** (hồ sơ → tab Hợp đồng, trang Hợp đồng lao động hoặc trang Theo dõi hợp đồng): phần mềm chọn sẵn giai đoạn kế tiếp,
  ngày hiệu lực = ngày sau ngày hết hạn HĐ trước, tự tính ngày hết hạn (vd 01/12/2026 + 1 năm → 30/11/2027). Người chưa có HĐ: mới vào thì
  bắt đầu từ HĐ thử việc, đã làm lâu thì từ HĐ chính thức 1 năm.
- Phần mềm nhắc (không chặn lưu) theo Bộ luật Lao động 2019: HĐ xác định thời hạn quá 36 tháng; đã ký 2 lần HĐ xác định thời hạn thì lần sau
  phải ký HĐ không xác định thời hạn (Điều 20) – trường hợp này phần mềm tự chọn giai đoạn không xác định thời hạn; thử việc lần 2 (Điều 25);
  HĐ mới trùng thời gian HĐ cũ.
- Hồ sơ → tab **Hợp đồng lao động** có **lộ trình**: giai đoạn đã kết thúc, đang hiệu lực (còn bao nhiêu ngày), dự kiến các giai đoạn sau.
  Hợp đồng cũ chưa ghi giai đoạn được tự nhận theo loại và thời hạn (12 tháng → 1 năm, 36 tháng → 3 năm).

### Theo dõi hợp đồng (bảng điều khiển)
Menu **Nhân sự → Theo dõi hợp đồng** – dành cho người phụ trách hợp đồng:
- **Thẻ số liệu** (bấm để lọc danh sách): đã hết hạn chưa ký lại · hết hạn trong 30 ngày · 31 – 90 ngày · đang thử việc ·
  chưa có hợp đồng · đã ký hợp đồng tiếp theo trước khi HĐ cũ hết hạn.
- **Biểu đồ** hợp đồng hết hạn theo tháng (quá hạn + 12 tháng tới, chia theo giai đoạn; rê chuột xem số, bấm cột để lọc danh sách tháng đó),
  hợp đồng đang hiệu lực theo giai đoạn, số HĐ cần ký lại theo phòng / đội.
- **Danh sách cần ký lại**: HĐ hiện tại, ngày hết hạn, còn bao nhiêu ngày, giai đoạn ký tiếp, ngày hiệu lực dự kiến; cột **Theo dõi**
  (Chưa xử lý / Đang trình ký / Không ký tiếp) và **Ghi chú** để ghi tiến độ (lưu ngày, người cập nhật); nút **Ký tiếp** mở sẵn form hợp đồng
  giai đoạn sau – ký xong thì dòng tự chuyển "Đã ký". Lọc theo khoảng 30 / 60 / 90 ngày, 6 – 12 tháng, theo phòng / đội; **Xuất Excel**, **In danh sách**.
- Cùng danh sách này ở **Báo cáo nhân sự → Hợp đồng cần ký lại**; trang **Tổng quan** nhắc số HĐ đã hết hạn / hết hạn trong 30 ngày.
- Đánh dấu *Cập nhật hồ sơ* thì loại HĐ, ngày hết hạn, chức danh được cập nhật; HĐ thử việc ghi luôn thời gian thử việc và % lương thử việc
  vào hồ sơ; HĐ chính thức thì tự chuyển "Đang làm việc", hưởng 100% lương (ký trước ngày hết thử việc thì thử việc kết thúc ngày trước
  ngày HĐ có hiệu lực; người chưa tham gia BH được bật tham gia BH). Nếu mức lương trong HĐ khác hiện tại có thể *áp dụng từ ngày hiệu lực*
  (tự tạo quyết định điều chỉnh lương).

### Thử việc – lương thử việc, số tháng thử việc
- Hồ sơ → tab **Công việc & lương** → mục **Thử việc**: đánh dấu *Có thời gian thử việc*, nhập **từ ngày**, **số tháng thử việc**
  (tự tính **đến ngày**: 01/10 + 1 tháng → 31/10; sửa được khi thử việc tính theo số ngày) và **lương thử việc (% lương chính thức)** –
  mặc định **85%** (mức tối thiểu theo Điều 26 BLLĐ 2019). Dòng bên dưới hiện ngay lương thử việc, ví dụ 85% × 7.000.000 = 5.950.000 đ/tháng.
- Chọn trạng thái *Thử việc* hoặc thêm HĐ loại *Thử việc* thì phần mềm tự điền thời gian thử việc theo mặc định ở
  **Cài đặt → Lương → Thử việc** (lương thử việc 85%; số tháng theo giai đoạn HĐ thử việc – mặc định 1 tháng, thời gian thử việc không đóng BHXH, BHYT, BHTN).
- Tính lương: những ngày nằm trong thời gian thử việc hưởng lương thử việc. Kỳ có cả ngày thử việc và ngày chính thức được tính
  theo số công của từng phần: mức lương ÷ công chuẩn × (công thử việc × 85% + công chính thức). Bảng lương hiện nhãn **TV 85%**
  cạnh tên, chi tiết và phiếu lương ghi rõ số công thử việc.
- Bảo hiểm: kỳ nằm trọn trong thời gian thử việc không đóng BH; kỳ hết thử việc giữa chừng thì công thử việc tính như ngày không thuộc
  hợp đồng lao động – từ 14 ngày trở lên thì kỳ đó chưa đóng BH. Bỏ đánh dấu ở Cài đặt nếu thử việc ghi trong hợp đồng lao động (vẫn đóng BH).
- Trang **Tổng quan** nhắc *Hết thử việc* trước 30 ngày để đánh giá và ký HĐ chính thức. Danh sách nhân viên, Excel có cột thử việc
  từ ngày / đến ngày / % lương thử việc. Dữ liệu cũ (trạng thái Thử việc, "% hưởng lương" 85) được tự chuyển sang mục Thử việc.
- Trang **Hợp đồng lao động** đếm và lọc: sắp hết hạn (30 ngày), đã hết hạn, chưa có hợp đồng; **In hợp đồng** theo mẫu tham khảo
  (Bộ luật Lao động 2019) – kiểm tra điều khoản theo quy chế công ty trước khi ký.

### Quyết định
Tiếp nhận, bổ nhiệm, điều chuyển, **nâng lương**, **khen thưởng**, **kỷ luật**, **thôi việc**:
- **Nâng lương**: nhập mức lương mới và ngày hiệu lực. Kỳ lương nào kết thúc trước ngày hiệu lực vẫn tính **lương cũ**, từ kỳ
  có ngày hiệu lực trở đi tính lương mới (không phải sửa tay từng tháng).
- **Khen thưởng / kỷ luật** có số tiền và *kỳ lương*: tiền thưởng tự cộng vào thu nhập (chịu thuế), tiền phạt / bồi thường
  tự vào khấu trừ của bảng lương kỳ đó (kỳ đã chốt thì cần mở khoá).
- **Nâng lương / chuyển chức danh** cho người đã xếp bảng lương: chọn *chức danh* (vd từ Trưởng phòng sang Đội trưởng) và *bậc mới*,
  phần mềm tự điền mức lương theo bảng của kỳ đó. **Ngày hiệu lực quyết định quyết định kỳ bắt đầu áp dụng** (phần mềm ghi rõ
  "Áp dụng từ kỳ lương tháng …"): các kỳ trước vẫn tính chức danh, bậc, lương cũ. Chỉ đổi chức danh thì thời gian hưởng bậc giữ nguyên.
  Trang *Xếp lương, nâng bậc* có nút **Nâng / chuyển bậc…** trên từng người.
- **Bổ nhiệm, điều chuyển** cập nhật phòng / đội, chức vụ; **Thôi việc** đặt ngày nghỉ việc = ngày trước ngày hiệu lực.
- Xoá quyết định mới nhất thì lương, bậc / phòng, đội / trạng thái trở về như trước.

### Phòng, đội – chuyển nhân viên qua lại
- Mỗi nhân viên trực thuộc 1 phòng hoặc đội. Thêm, đổi tên, xoá ở **Danh mục → Phòng, đội**.
- Chuyển nhân viên: trang **Hồ sơ nhân viên** đánh dấu nhiều người → **Chuyển phòng / đội**; hoặc ở dòng đơn vị bấm *Chuyển NV*;
  hoặc trong hồ sơ bấm *Điều chuyển*. Nên để đánh dấu *Lập quyết định điều chuyển* với ngày hiệu lực: **các kỳ trước ngày
  hiệu lực vẫn tính ở đơn vị cũ** (bảng chấm công, mẫu 01a, bảng lương nhóm theo đơn vị của từng kỳ). Bỏ đánh dấu khi chỉ sửa sai.
- **Xoá phòng / đội còn nhân viên**: phần mềm cảnh báo và **bắt buộc chuyển hết nhân viên sang đơn vị khác rồi mới xoá**.
  Đơn vị còn trong lịch sử (quyết định cũ, người đã nghỉ, bảng lương đã chốt) được chuyển vào mục *Đã giải thể* (khôi phục được).

### Xếp lương, nâng bậc
- **Danh mục → Thang, bảng lương**: tạo bảng (vd *Thang lương, bảng lương của công ty*), chọn kiểu **mức tiền** hoặc **hệ số ×
  mức lương cơ sở**, *Dùng cho* mức lương, lương đóng BH hoặc cả hai, thời gian nâng bậc (năm). Thêm chức danh / nhóm công việc
  rồi nhập từng bậc. **Số bậc riêng từng chức danh**: cột *Số bậc* bấm **−** / **+** (vd từ Đội trưởng trở lên 2 bậc, còn lại 3 bậc);
  ô bậc thừa bị khoá. Không bớt được bậc đang có người xếp; bớt bậc đã có giá trị thì phần mềm hỏi lại (xoá giá trị ở mọi mức áp dụng).
  **Tách…**: tách 1 chức danh thành 2 (vd *Trưởng phòng, Đội trưởng* → *Trưởng phòng* và *Đội trưởng*): chức danh mới chép số bậc và giá trị
  các bậc, đánh dấu nhân viên chuyển sang (tự gợi ý theo chức vụ), giữ nguyên bậc, và chọn **áp dụng từ kỳ lương** nào (phần mềm lập
  quyết định chuyển chức danh, các kỳ trước tính theo chức danh cũ; để trống = áp dụng cho mọi kỳ chưa chốt); sau đó sửa giá trị riêng.
  Sửa giá trị bậc hoặc lương cơ sở thì lương người đang xếp bậc đó cập nhật ngay.
- Menu **Xếp lương, nâng bậc**: chọn bảng – chức danh – bậc, ngày hưởng bậc cho từng người; tab **Đến hạn nâng bậc** liệt kê
  người đã / sắp đến hạn (kỷ luật *kéo dài thời hạn nâng lương* cộng 6 tháng), bấm **Nâng bậc…** để lập quyết định, xuất Excel, in.

### Đơn nghỉ phép
Tạo đơn (nhân viên, loại nghỉ `P`, `P/2`, `Ô`, `Cô`, `TS`, `KL`, `R`…, từ ngày – đến ngày, lý do); phần mềm báo số ngày làm việc và
số phép năm còn lại. **Duyệt** thì tự chấm ký hiệu vào bảng chấm công cho các ngày làm việc trong khoảng (bỏ ngày nghỉ tuần, ngày lễ;
thay ô đang chấm `+`, giữ nguyên ô đã chấm nghỉ khác). **Huỷ duyệt** hoặc **xoá đơn** thì xoá lại các ô đó.

### Báo cáo nhân sự
Cơ cấu lao động (phòng / đội, giới tính, độ tuổi, trình độ, loại HĐ, loại lao động, thâm niên), biến động lao động 12 tháng
(tăng, giảm, đầu – cuối tháng), danh sách trích ngang, sinh nhật theo tháng, hợp đồng cần ký lại,
lao động đến tuổi nghỉ hưu trong 24 tháng (lộ trình Nghị định 135/2020/NĐ-CP), khen thưởng – kỷ luật trong năm. Xuất Excel, in.

Trang **Tổng quan** nhắc: đơn nghỉ chờ duyệt, hợp đồng sắp / đã hết hạn, nhân viên chưa có hợp đồng, sắp đến tuổi nghỉ hưu, sinh nhật.

## Chấm công – tiền lương hằng tháng

### 1. Bảng chấm công
- Chọn kỳ ở góc trên bên phải. Bấm **Chấm đủ công…** để điền `+` cho mọi ngày làm việc (theo lịch của từng người), rồi chỉ sửa ngày khác.
- Chọn ô (kéo chuột để chọn nhiều ô, nhiều người) → bấm ký hiệu trên thanh màu. Hoặc gõ thẳng: `+` (hoặc `x`), `sp`, `p`, `o` (= Ô), `kl`… rồi Enter.
- Phím: mũi tên di chuyển, Shift + mũi tên chọn vùng, Delete xoá, Ctrl+Z hoàn tác, Ctrl+C / Ctrl+V chép – dán (dán được cả vùng ký hiệu từ Excel).
- Chế độ **Làm thêm (giờ)** và **Đi muộn / về sớm (phút)** dùng chung lưới.
- **Xuất Excel (mẫu 01a)**: mỗi bộ phận 1 trang tính theo mẫu 01a-LĐTL, có phần *Quy ra công*:
  32 công lương sản phẩm · 33 công lương thời gian (*Lương*, gồm cả ngày nghỉ lễ) và ngày tính cơm (*Cơm*, chỉ ngày có đi làm) · 34 nghỉ hưởng 100% lương ·
  35 nghỉ không hưởng lương · 36 hưởng BHXH, kèm ký hiệu chấm công và chữ ký *Người chấm công – Phụ trách bộ phận – Người duyệt*.

Ký hiệu mặc định (sửa được ở Danh mục):

| Ký hiệu | Ý nghĩa | Tính lương |
|---|---|---|
| `+` | Lương thời gian (đi làm cả ngày) | 1 công lương thời gian, 1 ngày cơm (ngày lễ 2 công, Tết 3 công, cơm vẫn 1 ngày) |
| `+/2` | Đi làm nửa ngày | 0,5 công |
| `SP` | Lương sản phẩm | **chỉ hưởng lương sản phẩm** (số lượng × đơn giá): không hưởng lương thời gian, không nhân hệ số ngày lễ; vẫn tính ngày cơm |
| `CT`, `H` | Công tác; hội nghị, học tập | như đi làm |
| `P`, `P/2` | Nghỉ phép (trừ phép năm) | hưởng lương thời gian |
| `L`, `NB`, `R` | Nghỉ lễ Tết (1 công, không cơm); nghỉ bù; việc riêng có lương | hưởng lương thời gian |
| `N` | Ngừng việc hưởng lương | cột 34, % lương đặt trong Cài đặt |
| `Ô`, `Cô`, `TS`, `T` | Ốm; con ốm; thai sản; tai nạn | BHXH trả (cột 36) |
| `KL`, `KP` | Nghỉ không lương; không phép | không hưởng lương (cột 35) |

### 2. Giờ vào / ra (máy chấm công vân tay, thẻ, khuôn mặt)
Xuất dữ liệu từ phần mềm máy chấm công ra `.xlsx` / `.csv` / `.txt` → chọn file → kiểm tra cột *Mã chấm công*, *Ngày*, *Giờ*
→ **Đọc dữ liệu**. Phần mềm lấy lần chấm đầu tiên làm giờ vào, lần cuối làm giờ ra, tính giờ làm, đi muộn, về sớm, làm thêm.
Sửa giờ trực tiếp nếu ai quên chấm, rồi **Áp dụng vào bảng chấm công**.

### 3. Bảng lương
Cột theo mẫu *Bảng thanh toán tiền lương*: Mức lương/HĐ · Lương sản phẩm (số HĐ, số tiền) · Lương thời gian (số công, số tiền) ·
Phụ cấp cơm trưa (số công, số tiền) · phụ cấp khác · Thưởng · Tổng thu nhập · Tạm ứng kỳ I ·
BHXH 8% · BHYT 1,5% · BHTN 1% · Công đoàn 0,5% · Thuế TNCN · Khấu trừ khác · Cộng · **Lãnh kỳ II** · Ký nhận.

- Ô nền vàng nhập trực tiếp: **số lượng sản phẩm chính**, thưởng, khoản cộng khác, khấu trừ khác, ghi chú.
  **Tạm ứng kỳ I** tự điền theo chức vụ (chữ nghiêng); gõ số khác để nhập tay cho kỳ này (kể cả 0), xoá trống để trở về tự động.
  Người làm nhiều loại sản phẩm trong tháng: bấm nút **…** cạnh ô số lượng để nhập từng loại.
- Chọn **bảng lương** (Văn phòng công ty, từng đội), lọc theo **phòng / đội** và **loại lao động**; bảng chấm công cũng lọc được.
  Xuất Excel khi chọn *Tất cả bảng lương* thì mỗi bảng lương 1 sheet, tiêu đề riêng (vd *BẢNG THANH TOÁN TIỀN LƯƠNG ĐỘI CẤP NƯỚC SỐ 1*).
- Bấm tên nhân viên để xem **chi tiết cách tính** từng con số.
- **Xuất Excel** (kèm trang *Bảo hiểm*), **In**.
- **Chi lương kỳ I, kỳ II…**: tóm tắt từng bảng lương (số người, tổng kỳ I, kỳ II, làm thêm giờ, ai thiếu số tài khoản) và xuất:
  *Danh sách tạm ứng lương kỳ I (ký nhận)*, *Đề nghị chi lương kỳ I / kỳ II / tiền làm thêm giờ – gửi ngân hàng*
  (mẫu: BỘ PHẬN, Kính gửi ngân hàng, Số tài khoản công ty, STT – số tài khoản – tên chủ tài khoản – số tiền ghi có – ghi chú,
  tổng số, bằng chữ, ký), *Bảng thanh toán tiền làm thêm giờ*. Ngân hàng chi lương và số tài khoản công ty của từng bảng lương
  khai báo ở Danh mục → Phòng, đội (thẻ *Bảng lương và ngân hàng chi lương*).
- **Chốt lương tháng**: khoá chấm công và bảng lương của kỳ, lưu cố định số liệu (không đổi khi sau này sửa mức lương,
  tỷ lệ BH, biểu thuế). Mở khoá được khi cần sửa.

Cách tính chính:
- Lương thời gian = Mức lương × tỷ lệ hưởng ÷ công chuẩn × số công lương thời gian
  (văn phòng: 8.000.000 ÷ 22 × 19 = 6.909.091; công nhân: 8.040.000 ÷ 26 × 23 = 7.112.308).
  Đi làm nhiều hơn công chuẩn thì được trả theo số công thực tế; muốn tối đa bằng mức lương thì bật
  *Không trả lương thời gian quá công chuẩn* trong Cài đặt → Kỳ công.
- Lương sản phẩm = Σ số lượng × đơn giá từng sản phẩm (vd 2.490 HĐ × 1.200 đ = 2.988.000).
  Ngày chấm `SP` không tính vào lương thời gian nhưng vẫn tính ngày cơm.
- **Ngày lễ, Tết** (theo Danh mục → Ngày lễ, cột *Loại*): nghỉ lễ `L` = 1 công; **đi làm (`+`) vào ngày lễ = 2 công,
  vào ngày Tết = 3 công** (Tết Nguyên đán tự đặt loại *Tết*). Trên bảng chấm công các ô này có dấu ×2 / ×3.
  Làm `SP` vào ngày lễ, Tết **không nhân**: chỉ hưởng lương sản phẩm.
  Hệ số sửa ở Cài đặt → Lương & làm thêm. Tiền cơm không nhân: mỗi ngày đi làm vẫn 1 suất.
- Cơm trưa = 50.000 đ × số ngày có đi làm: ngày `+`, `SP`, công tác, học tập, **kể cả đi làm hoặc làm sản phẩm
  vào ngày lễ**; nửa ngày `+/2` tính 0,5. Ngày **nghỉ lễ `L`** vẫn tính công nhưng **không tính cơm**; nghỉ phép, ốm… cũng không tính cơm.
  Tiền cơm thay đổi từ tháng nào thì sửa ở trang **Mức lương theo kỳ**. Phần tiền ăn giữa ca vượt **1.200.000 đ/tháng**
  (Nghị định 253/2026, từ 01/7/2026; trước đó 730.000) tính vào thu nhập chịu thuế TNCN – vd 26 ngày × 50.000 = 1.300.000 thì 100.000 chịu thuế.
- BH trên lương đóng BH (mặc định = mức lương + phụ cấp có đánh dấu đóng BH), có trần 20 × lương cơ sở (BHXH, BHYT)
  và 20 × lương tối thiểu vùng (BHTN). Nghỉ không lương từ 14 ngày trở lên trong kỳ thì không đóng BH.
- Thuế TNCN biểu lũy tiến 5 bậc, giảm trừ bản thân 15,5 triệu, người phụ thuộc 6,2 triệu; phần lương làm thêm vượt
  lương thường và phụ cấp không chịu thuế được loại trừ. Hợp đồng dưới 3 tháng: khấu trừ 10%.
- **Lương 2 kỳ mỗi tháng**: **kỳ I** (giữa tháng) tạm ứng theo chức vụ – mặc định theo bảng lương công ty: Chủ tịch kiêm Giám đốc,
  Giám đốc 6.000.000; Phó Giám đốc, Kế toán trưởng 5.000.000; Trưởng phòng, Phó phòng, Đội trưởng 3.000.000; chức vụ khác 2.000.000
  (sửa ở trang Mức lương theo kỳ; người có mức riêng thì nhập *Tạm ứng kỳ I riêng* trong hồ sơ; không có công hưởng lương thì không tạm ứng).
  **Lãnh kỳ II** (cuối tháng) = Tổng thu nhập − Tạm ứng kỳ I − Cộng các khoản khấu trừ (BH, công đoàn, thuế, khấu trừ khác).
- **Làm thêm giờ**: lương giờ = mức lương ÷ công chuẩn ÷ 8 giờ; ngày thường 150%, ngày nghỉ 200%, lễ Tết 300%.
  Mặc định tiền làm thêm giờ **chi bằng bảng riêng** (Bảng thanh toán tiền làm thêm giờ, đề nghị chi riêng) – không gộp vào lãnh kỳ II;
  thuế TNCN vẫn tính trên thu nhập cả tháng. Bỏ tuỳ chọn ở Cài đặt → Lương & làm thêm nếu muốn gộp.

### Mức lương theo kỳ (bảng lương, bậc lương, lương cơ sở, tiền cơm, tạm ứng thay đổi từ một tháng)
Menu **Thiết lập → Mức lương theo kỳ**. Mỗi lần Nhà nước / công ty thay đổi, bấm **Mức mới áp dụng từ tháng…**:
chọn kỳ lương bắt đầu áp dụng, số quyết định; phần mềm chép toàn bộ mức đang dùng, có thể **tăng đồng loạt % các bậc**, đổi lương cơ sở,
tiền cơm ngay trong hộp. Sau đó sửa tiếp từng số: giá trị từng bậc của thang bảng lương, lương cơ sở, tiền cơm, mức miễn thuế tiền ăn giữa ca,
tạm ứng kỳ I theo chức vụ. Ô nào khác mức trước được tô đậm kèm % thay đổi.
- Bảng lương mỗi kỳ tự lấy đúng mức của kỳ đó: kỳ trước giữ mức cũ, kỳ từ tháng áp dụng trở đi dùng mức mới; kỳ đã chốt không đổi.
- Người đã xếp bậc thì lương mỗi kỳ = giá trị bậc (theo quyết định nâng bậc của kỳ đó) tại mức áp dụng của kỳ đó.
- *Mức ban đầu* là mức dùng cho các kỳ trước mọi lần điều chỉnh. Có thể xem / sửa từng mức, xoá mức nhập nhầm, xuất Excel.

### 4. Phiếu lương, báo cáo
- **Phiếu lương**: in 2 phiếu / trang A4 (hoặc *Lưu thành PDF* để gửi Zalo), xuất Excel.
- **Báo cáo**: tổng hợp theo phòng / đội, bảo hiểm & công đoàn, thuế TNCN cả năm (theo từng tháng, để quyết toán),
  quỹ lương 12 tháng, theo dõi phép năm, đi muộn – nghỉ – làm thêm. Báo cáo nào cũng xuất Excel / in được.

## Dùng chung trên máy chủ, phân quyền

Cài máy chủ: xem [`iis/HUONG_DAN_IIS.txt`](iis/HUONG_DAN_IIS.txt). Tài khoản quản trị vào **Cài đặt & dữ liệu → Dữ liệu → Tài khoản**.

**Cấp của tài khoản**
- **Quản trị**: toàn quyền, quản lý tài khoản, sao lưu, khôi phục, nhật ký.
- **Cấp công ty**: làm việc với mọi phòng, đội.
- **Cấp phòng / đội**: chỉ thấy nhân viên của các phòng / đội được giao (kể cả người vừa chuyển đi trong 62 ngày để chấm nốt kỳ cũ).

**Quyền từng phần** – mỗi phần chọn *Không / Xem / Sửa*:

| Phần | Gồm các trang |
|---|---|
| Chấm công | Bảng chấm công, Giờ vào / ra |
| Nhân sự | Hồ sơ nhân viên, hợp đồng, theo dõi hợp đồng, quyết định, đơn nghỉ phép, báo cáo nhân sự, hồ sơ scan |
| Tiền lương | Bảng lương, phiếu lương, báo cáo lương, xếp lương – nâng bậc, mức lương theo kỳ |
| Thiết lập | Danh mục, cài đặt |

Cấp phòng / đội: tiền lương tối đa *Xem*, không có thiết lập. **Mẫu phân quyền** điền nhanh: nhập liệu công ty, kế toán tiền lương,
cán bộ tổ chức – nhân sự, lãnh đạo (xem tất cả), trưởng phòng / đội trưởng (chấm công, hồ sơ đơn vị, xem lương), chấm công đơn vị,
nhân sự đơn vị (chấm công, xem hồ sơ).

**Máy chủ kiểm tra lại quyền** (không chỉ ẩn trên màn hình):
- Phần *Không* được xem thì máy chủ không gửi về máy – vd tài khoản không có quyền tiền lương không nhận mức lương, phụ cấp, xếp bậc,
  lương trong hợp đồng, quyết định, bảng lương đã chốt.
- Phần *Xem*: sửa trên màn hình thì phần mềm báo "chỉ được xem" và tải lại; máy chủ cũng giữ nguyên phần đó như dữ liệu đang lưu.
- Cấp phòng / đội chỉ gửi lên các ô chấm công, hồ sơ, đơn nghỉ vừa sửa của nhân viên trong đơn vị; máy chủ chặn sửa người ngoài
  đơn vị, chuyển nhân viên sang đơn vị khác (nhờ cán bộ nhân sự công ty), sửa kỳ đã chốt lương, tải hồ sơ scan của người ngoài đơn vị.
  Nhân viên do cấp đội thêm mới không có mức lương – người có quyền sửa tiền lương nhập sau.

**Màn hình riêng của từng đội – Tổng quan đơn vị** (menu đầu tiên; tài khoản cấp phòng / đội và tài khoản không có quyền tiền lương
vào thẳng màn hình này): chọn phòng / đội (tài khoản đội chỉ có đơn vị mình) → số nhân viên, người thử việc, ô chấm công còn trống
tính đến hôm nay, ai nghỉ hôm nay, đơn nghỉ chờ duyệt, hợp đồng hết hạn trong 30 ngày, thực lĩnh kỳ II của đơn vị (theo quyền);
bảng nhân viên với công, nghỉ phép, nghỉ không lương, ô còn trống, hợp đồng; nút **Chấm công đơn vị** mở bảng chấm công đã lọc sẵn đơn vị.

- **Tạo tài khoản cho từng phòng / đội…**: chọn quyền (mặc định trưởng phòng / đội trưởng), mỗi đơn vị 1 tài khoản, mật khẩu
  ngẫu nhiên hiện 1 lần, in danh sách để phát. Tài khoản cũ (Nhập liệu, Chấm công theo phòng / đội) giữ nguyên quyền như trước.
- Dữ liệu tự lưu lên máy chủ; ô chấm công của các đội được ghép từng ô nên không ghi đè lẫn nhau. Máy chủ tự sao lưu mỗi ngày
  vào ổ D (giữ 120 bản).

## Tham số pháp lý mặc định (sửa ở Cài đặt khi Nhà nước thay đổi)

| Tham số | Mặc định |
|---|---|
| BH người lao động | BHXH 8%, BHYT 1,5%, BHTN 1% |
| BH doanh nghiệp | BHXH 17,5%, BHYT 3%, BHTN 1%, KPCĐ 2% |
| Đoàn phí công đoàn | 0,5% lương đóng BH (tối đa 10% lương cơ sở) |
| Lương cơ sở | 2.530.000 đ (từ 01/7/2026) – đổi theo kỳ ở trang Mức lương theo kỳ |
| Tiền ăn giữa ca không tính thuế | 1.200.000 đ/tháng (NĐ 253/2026, từ 01/7/2026) |
| Lương tối thiểu vùng 2026 | I 5.310.000 · II 4.730.000 · III 4.140.000 · IV 3.700.000 |
| Giảm trừ gia cảnh | bản thân 15.500.000 · người phụ thuộc 6.200.000 |
| Biểu thuế (thu nhập tính thuế / tháng) | ≤10 tr 5% · 10–30 tr 10% · 30–60 tr 20% · 60–100 tr 30% · >100 tr 35% |
| Làm thêm giờ | ngày thường 150% · nghỉ tuần 200% · lễ 300% |
| Thử việc | lương ít nhất 85% lương công việc; tối đa 180 ngày (quản lý DN), 60 ngày (cao đẳng trở lên), 30 ngày (trung cấp, CNKT), 6 ngày làm việc (khác) |

Hãy đối chiếu lại với văn bản hiện hành của cơ quan thuế, BHXH trước khi dùng số liệu để nộp.

## Dành cho người sửa phần mềm

- Mã nguồn trong `src/` (mở thẳng `src/index.html` cũng chạy được). Sửa xong chạy `node build.js` để đóng gói lại
  thành `ChamCong_TinhLuong.html` (1 file duy nhất, không dùng thư viện ngoài).
- `src/tinhluong.js`: toàn bộ cách tính (kỳ công, công chuẩn, lương, BH, thuế, lương theo quyết định, người phụ thuộc,
  đơn nghỉ, tuổi nghỉ hưu). `src/amlich.js`: lịch âm để tạo ngày lễ. `src/xlsx.js`: đọc / ghi Excel.
  Các trang giao diện: `src/p-*.js` (`p-hoso.js` hồ sơ nhân viên, `p-nhansu.js` hợp đồng – quyết định – đơn nghỉ – báo cáo nhân sự,
  `p-donvi.js` phòng / đội, `p-thangluong.js` thang bảng lương – nâng bậc). `src/maychu.js`: chế độ máy chủ (đăng nhập, lưu,
  phân quyền, tự ghép chấm công).
- Máy chủ: `iis/MayChuChamCong.cs` (C# 5, biên dịch bằng `csc.exe` của .NET Framework 4 – bộ cài tự làm), chạy sau IIS
  (ASP.NET Core Module V2). Bộ cài: `iis/CaiDat-IIS.ps1` (gọi qua `CaiDat-MayChu-IIS.bat`).
- Đóng gói bộ cài: `node dong-goi.js` → `dist/ChamCong_CaiDat_<ngày>.zip` (dựng lại HTML, chạy kiểm thử, nén các file cần cài).
- Kiểm thử cách tính: `node test/tinhluong.test.js` (có ca đối chiếu đúng 1 dòng bảng lương mẫu tháng 10/2026).
