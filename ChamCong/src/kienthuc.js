/* Trợ lý ảo Hawasuco – phần "hiểu biết rộng":
   - banThan(q, goc): trả lời về bản thân trợ lý (tên, ai tạo, làm được gì, bảo mật, giọng nói…) và về công ty
   - tinh(q, goc):   máy tính nhanh – thuế TNCN, bảo hiểm, lương thực lĩnh, làm thêm giờ, trợ cấp thôi việc / thất nghiệp,
                     phép năm theo thâm niên, tuổi nghỉ hưu, thâm niên, âm lịch, ngày Tết, đọc số tiền bằng chữ, hôm nay
   - tim(q):         kho kiến thức lao động – tiền lương (Bộ luật Lao động 2019, Luật BHXH 2024, thuế TNCN…), có dẫn điều luật
   Mỗi hàm trả { html, cx } (cx = cử chỉ của linh vật) hoặc null. Số liệu (tỷ lệ BH, giảm trừ, biểu thuế, lương cơ sở…) lấy từ Cài đặt
   của phần mềm để khớp với bảng lương. */
(function () {
  'use strict';
  var h = App.h;
  function cn(s) { return App.boDau(String(s == null ? '' : s)).toLowerCase().replace(/[^a-z0-9\/+%]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function co(q, cum) { return (' ' + q + ' ').indexOf(' ' + cum + ' ') >= 0; }
  function tien(v) { return App.tien(Math.round(v)) + ' đ'; }
  function so(v) { return App.so(Math.round(v * 100) / 100); }
  function CD() { return App.db.caiDat; }
  function kyHT() { return TL.kyHienHanh(App.db); }
  function lcs() { return TL.luongCoSoKy(App.db, kyHT()); }
  function ltv() { return +CD().luongToiThieuVung || 0; }
  function tenCT() { return (App.db.congTy && App.db.congTy.ten) || 'công ty'; }
  function homNay() { var d = new Date(); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), dt: d }; }
  var THU = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  function canChi(y) { return ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'][y % 10] + ' ' + ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'][y % 12]; }
  function amLich(d, m, y) { var a = AmLich.duongSangAm(d, m, y, 7); return { d: a[0], m: a[1], y: a[2], nhuan: a[3] }; }
  function ghiChu(nguon) { return '<div class="mo nho tl-nguon">📚 ' + nguon + ' – thông tin tham khảo; khi áp dụng nên đối chiếu văn bản hiện hành và quy chế của công ty.</div>'; }
  function nutTrang(id, ten) { return App.duocXem(id) ? '<button class="nut nho" data-tl="trang:' + id + '">' + h(ten) + '</button>' : ''; }
  function nutHoi(cau) { return '<button class="tl-chip" data-tl="hoi:' + h(cau) + '">' + h(cau) + '</button>'; }
  function hang(html) { return html ? '<div class="tl-nuts">' + html + '</div>' : ''; }

  /* ================= Đọc số trong câu hỏi ================= */
  function chuThuong(goc) { return App.boDau(String(goc || '')).toLowerCase(); }
  /** Số tiền đầu tiên: "10 triệu", "8,5tr", "10.000.000 đ", "12 triệu 500", "500 nghìn" */
  function docTien(goc, tu) {
    var t = chuThuong(goc), m;
    if (tu) { var vt = t.indexOf(tu); if (vt < 0) return null; t = t.slice(vt + tu.length); }
    var dsKq = [], re;
    re = /(\d+(?:[.,]\d+)?)\s*(trieu|tr|cu)(?![a-z])(?:\s*(\d{1,3})(?!\d|\s*(?:nam|thang|ngay|gio|nguoi|con)))?/g;
    while ((m = re.exec(t))) dsKq.push({ vt: m.index, v: parseFloat(m[1].replace(',', '.')) * 1e6 + (m[3] ? +m[3] * (m[3].length === 1 ? 100000 : m[3].length === 2 ? 10000 : 1000) : 0) });
    re = /(\d{1,3}(?:[.,]\d{3})+|\d{5,})(?!\s*(?:trieu|tr\b))/g;
    while ((m = re.exec(t))) dsKq.push({ vt: m.index, v: +m[1].replace(/[.,]/g, '') });
    re = /(\d+(?:[.,]\d+)?)\s*(nghin|ngan|k)(?![a-z])/g;
    while ((m = re.exec(t))) dsKq.push({ vt: m.index, v: parseFloat(m[1].replace(',', '.')) * 1000 });
    dsKq = dsKq.filter(function (x) { return x.v >= 1000 && x.v < 1e12; }).sort(function (a, b) { return a.vt - b.vt; });
    return dsKq.length ? dsKq[0].v : null;
  }
  function docSoTruoc(q, tu) { var m = new RegExp('(\\d+(?:[.,]\\d+)?) ?(?:' + tu + ')(?![a-z])').exec(chuThuong(q)); return m ? parseFloat(m[1].replace(',', '.')) : null; }
  function docNgay(goc) {
    var t = chuThuong(goc), m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(t);
    if (m) return { d: +m[1], m: +m[2], y: +m[3] };
    m = /ngay (\d{1,2}) thang (\d{1,2}) nam (\d{4})/.exec(t);
    if (m) return { d: +m[1], m: +m[2], y: +m[3] };
    return null;
  }

  /* ================= Bản thân trợ lý, công ty ================= */
  var TEN = 'Trợ lý ảo Hawasuco';
  function lamDuocGi() {
    return 'Tôi là <b>' + TEN + '</b>, tôi có thể:<ul>' +
      '<li><b>Tra cứu dữ liệu</b>: nhân viên, phòng / đội, hợp đồng sắp hết hạn, người thử việc, ai nghỉ hôm nay, đơn nghỉ chờ duyệt, lương, công, phép… (theo quyền tài khoản)</li>' +
      '<li><b>Hướng dẫn dùng phần mềm</b>: “cách chấm công”, “nâng bậc lương thế nào”, “sửa tỷ lệ bảo hiểm ở đâu”…</li>' +
      '<li><b>Giải đáp lao động – tiền lương</b>: hợp đồng, thử việc, phép năm, nghỉ lễ, làm thêm giờ, thai sản, ốm đau, BHXH, thuế TNCN, trợ cấp thôi việc, tuổi nghỉ hưu, kỷ luật…</li>' +
      '<li><b>Tính nhanh</b>: “thuế TNCN thu nhập 25 triệu 1 người phụ thuộc”, “lương 10 triệu thực lĩnh bao nhiêu”, “làm thêm 4 giờ chủ nhật lương 8 triệu”, ' +
      '“trợ cấp thôi việc 6 năm lương 9 triệu”, “nữ sinh tháng 5/1975 bao giờ nghỉ hưu”, “âm lịch hôm nay”, “còn bao nhiêu ngày đến Tết”, “đọc 2.530.000 bằng chữ”</li>' +
      '<li><b>Mở trang</b> (“mở bảng lương”), <b>nói chuyện bằng giọng nói</b> và <b>đọc câu trả lời</b> bằng giọng AI tiếng Việt.</li></ul>';
  }
  var BAN_THAN = [
    [/(^| )(ban|em|tro ly|robot|may)( la)? (ten (la )?gi|ten chi|la ai|ten gi)|^(ban|em) la (ai|gi)|(ten|danh tinh) (cua )?(?:^| )(ban|em|tro ly)|gioi thieu (ve )?(ban than|ban|em)|^ai (day|do|vay)( |$)/, function () {
      return { cx: ['vay', 1600, '🤖'], html: 'Xin chào! Tôi là <b>' + TEN + '</b> – trợ lý ảo của phần mềm Nhân sự – Chấm công – Tiền lương, ' + h(tenCT()) + '. ' +
        'Tôi giúp mọi người tra cứu thông tin, hướng dẫn dùng phần mềm, giải đáp chế độ lao động – tiền lương và tính nhanh các khoản lương, thuế, bảo hiểm. ' +
        'Bạn có thể gõ hoặc nói câu hỏi, tôi sẽ trả lời và đọc to bằng giọng tiếng Việt.' + hang(nutHoi('Bạn làm được gì?') + nutHoi('Hawasuco là gì?')) };
    }],
    [/(hawasuco|ha oa su co|ha wa su co) (la gi|nghia la gi|co nghia|nghia gi|viet tat|la ten gi|la cong ty gi)|^(hawasuco|ha oa su co)$|(vi sao|tai sao) (ban |em )?(ten|goi la|co ten)/, function () {
      return { cx: ['then', 1500, '😊'], html: '<b>Hawasuco</b> là tên gọi tắt của ' + h(tenCT()) + ' (ghép từ tiếng Anh <i>Hau Giang Water Supply Company</i> – Công ty Cấp nước Hậu Giang). ' +
        'Tôi mang tên công ty nên gọi là <b>' + TEN + '</b>. Trang thông tin của công ty: <b>web.capnuochaugiang.vn</b>.' };
    }],
    [/(?:^| )(ban|em|tro ly) (lam|giup) (duoc )?(gi|nhung gi|viec gi|duoc gi)|(?:^| )(ban|em) (biet|co the) (lam )?(gi|nhung gi)|chuc nang (cua )?(ban|tro ly)|tinh nang (cua )?(ban|tro ly)|giup (duoc )?(gi|nhung gi)|huong dan (dung|su dung) tro ly|tro ly (dung|lam) the nao/, function () {
      return { cx: ['gat', 1500, '💡'], html: lamDuocGi() + '<div class="tl-goi">' + ['Ai sắp hết hạn hợp đồng?', 'Nghỉ phép năm bao nhiêu ngày?', 'Lương 10 triệu thực lĩnh bao nhiêu?', 'Âm lịch hôm nay'].map(nutHoi).join('') + '</div>' };
    }],
    [/(ai (tao|lam|viet|lap trinh|thiet ke|phat trien|che tao) ra (?:^| )(ban|em|tro ly)|(?:^| )(ban|em) (do|duoc) ai (tao|lam|viet|phat trien)|nguoi (tao|lam) ra (ban|em)|cha me (cua )?(ban|em)|(?:^| )(ban|em) (tu dau|o dau) (ra|den))/, function () {
      return { cx: ['then', 1500, '🛠️'], html: 'Tôi được xây dựng cùng phần mềm Nhân sự – Chấm công – Tiền lương, dành riêng cho ' + h(tenCT()) + '. ' +
        'Tôi “sống” ngay trong phần mềm, học từ hướng dẫn sử dụng, dữ liệu nhân sự – tiền lương (theo quyền của bạn) và kiến thức về Bộ luật Lao động, bảo hiểm, thuế.' };
    }],
    [/(?:^| )(ban|em) (bao nhieu|may) tuoi|tuoi (cua )?(ban|em)|(?:^| )(ban|em) sinh (nam|ngay|thang) (nao|may)|sinh nhat (cua )?(ban|em)|(?:^| )(ban|em) ra doi (khi nao|nam nao|luc nao)/, function () {
      return { cx: ['then', 1500, '🎂'], html: 'Tôi ra đời năm 2026 cùng phiên bản phần mềm này – tính ra vẫn còn “nhỏ tuổi” lắm, nhưng ngày nào cũng được học thêm 😄' };
    }],
    [/(?:^| )(ban|em) (o|song|lam viec) (o )?dau|(?:^| )(ban|em) (dang )?o dau/, function () {
      return { cx: ['vay', 1400, '🏠'], html: 'Tôi “ở” ngay trong phần mềm, chạy trên trình duyệt của máy bạn – bấm vào robot góc phải dưới (hoặc Ctrl + K) là gặp tôi.' };
    }],
    [/(?:^| )(ban|em) (co phai|la) (nguoi|con nguoi|nguoi that)|(?:^| )(ban|em) (la )?(nguoi|robot|may) (hay|that)|(?:^| )(ban|em) co (that|song) khong|(?:^| )(ban|em) co cam xuc/, function () {
      return { cx: ['nhay', 1200, '🤖'], html: 'Tôi là trợ lý ảo (một robot phần mềm), không phải người thật. Tôi không có cảm xúc thật, nhưng có thể vui, buồn, ngạc nhiên… trên gương mặt để trò chuyện thân thiện hơn 😊' };
    }],
    [/(^| )(chatgpt|chat gpt|gpt|gemini|copilot|tri tue nhan tao|(?:^| )(ban|em) (la|dung) ai gi|(?:^| )(ban|em) co phai (la )?ai|ket noi internet|ket noi mang|can internet|online|hoc may)( |$)/, function () {
      return { cx: ['gat', 1400, '🧠'], html: 'Tôi không phải ChatGPT hay dịch vụ trên Internet. Tôi chạy ngay trong phần mềm: hiểu câu hỏi bằng bộ quy tắc và kho kiến thức riêng, ' +
        'trả lời từ dữ liệu, hướng dẫn sử dụng và kiến thức lao động – tiền lương, <b>không gửi câu hỏi hay dữ liệu ra ngoài</b>. ' +
        'Giọng đọc của tôi dùng mô hình AI tiếng Việt chạy ngay trên máy bạn.' };
    }],
    [/(bao mat|an toan (du lieu|thong tin)|lo (du lieu|thong tin)|(du lieu|thong tin|cau hoi)( [a-z]+){0,3} (gui|dua|truyen|chuyen) (ra|di|len)|(gui|dua|truyen) (du lieu|thong tin|cau hoi) (ra|di|len)|(?:^| )(ban|em) (co )?luu (cau hoi|lich su|tro chuyen)|nghe len|ghi am|nghe trom|rieng tu)/, function () {
      return { cx: ['gat', 1400, '🔒'], html: 'Về bảo mật:<ul><li>Câu hỏi và câu trả lời xử lý ngay trên máy bạn; tôi chỉ đọc dữ liệu tài khoản của bạn được phép xem.</li>' +
        '<li>Đọc câu trả lời bằng giọng AI chạy trên máy, văn bản không gửi ra ngoài.</li>' +
        '<li>Nói câu hỏi bằng micro: trình duyệt Chrome / Edge gửi âm thanh câu hỏi tới dịch vụ nhận dạng giọng nói của Google / Microsoft để chuyển thành chữ. Không muốn thì gõ câu hỏi; đơn vị có thể tắt micro trong Cài đặt.</li>' +
        '<li>Tôi không lưu lịch sử trò chuyện; bấm ⟲ là xoá khung chat.</li></ul>' };
    }],
    [/(giong (doc |noi )?(cua )?(ban|em)( |$)|(?:^| )(ban|em) (noi|doc) (giong|bang giong)|(?:^| )(ban|em) la (con trai|con gai|nam hay nu|nu hay nam)|gioi tinh (cua )?(ban|em))/, function () {
      return { cx: ['then', 1400, '🎙️'], html: 'Tôi đọc câu trả lời bằng <b>giọng AI tiếng Việt</b> (giọng nữ, tự nhiên). Bạn đổi giọng, tốc độ đọc ở nút <b>cài đặt giọng nói</b> trên đầu khung chat; bật nút <b>loa</b> 🔊 để tôi tự đọc mọi câu trả lời.' };
    }],
    [/(?:^| )(ban|em) (co )?(an|uong) (gi|chua|khong|com)|(?:^| )(ban|em) (co )?(ngu|met) (khong|chua)|(?:^| )(ban|em) (co )?buon ngu|(?:^| )(ban|em) thich (gi|lam gi)|so thich (cua )?(ban|em)/, function () {
      return { cx: ['cuoi', 1500, '😄'], html: 'Tôi chỉ “ăn” dữ liệu và “uống” điện thôi 🔋. Lúc rảnh lâu tôi hay ngủ gật – bạn rê chuột qua là tôi tỉnh ngay. Sở thích của tôi là được giúp bạn tính lương cho đúng!' };
    }],
    [/(?:^| )(ban|em) (co )?(thong minh|gioi|biet nhieu) (khong|ko|chua)|tin (ban|em) (duoc )?khong|(?:^| )(ban|em) co (hay )?(sai|nham|nham lan)( khong)?$/, function () {
      return { cx: ['then', 1400, '🤓'], html: 'Tôi cố gắng trả lời chính xác theo dữ liệu trong phần mềm và văn bản pháp luật hiện hành, nhưng vẫn có thể chưa hiểu hết câu hỏi. ' +
        'Với việc quan trọng (ký hợp đồng, xử lý kỷ luật, quyết toán thuế…) bạn nên đối chiếu văn bản gốc hoặc hỏi phòng Tổ chức – Hành chính, Kế toán nhé.' };
    }],
    [/^(tam biet|bye|goodbye|hen gap lai|chao nhe|chao tam biet|ngu ngon|di day)( nhe| nha| ban| em)?$/, function () {
      return { cx: ['tambiet', 1500, '👋'], html: 'Tạm biệt! Khi cần, bạn cứ bấm vào tôi hoặc nhấn Ctrl + K nhé. Chúc bạn làm việc hiệu quả!' };
    }],
    [/^(chao buoi (sang|trua|chieu|toi)|buoi (sang|chieu|toi) tot lanh)/, function () {
      var g = new Date().getHours(), buoi = g < 11 ? 'buổi sáng' : g < 14 ? 'buổi trưa' : g < 18 ? 'buổi chiều' : 'buổi tối';
      return { cx: ['vay', 1500, '👋'], html: 'Chào ' + buoi + '! Chúc bạn một ' + buoi + ' làm việc thật hiệu quả. Tôi có thể giúp gì?' };
    }],
    // công ty
    [/(cong ty|don vi)( (minh|ta|chung ta|cua toi|nay))? (ten (la )?gi|la gi|ten day du)|ten (cong ty|don vi)( (minh|ta))? la gi/, function () { return { cx: ['gat', 1200, '🏢'], html: thongTinCT('ten') }; }, 1],
    [/(dia chi|tru so)( cua)? (cong ty|don vi)|(cong ty|don vi)( minh| ta)? (o dau|dia chi|tru so|nam o dau)/, function () { return { cx: ['gat', 1200, '📍'], html: thongTinCT('diachi') }; }, 1],
    [/(ma so thue|mst) (cua )?(cong ty|don vi)|(so dien thoai|dien thoai|hotline|lien he)( cua)? (cong ty|don vi)/, function () { return { cx: ['gat', 1200, '☎️'], html: thongTinCT('lienhe') }; }, 1],
    [/(website|trang web|web)( cua)? (cong ty|don vi|hawasuco)|(cong ty|hawasuco) (co )?(website|trang web)/, function () {
      return { cx: ['gat', 1200, '🌐'], html: 'Trang thông tin của công ty: <b>web.capnuochaugiang.vn</b>.' };
    }]
  ];
  function thongTinCT(loai) {
    var ct = App.db.congTy || {}, s = [];
    s.push('<b>' + h(ct.ten || 'Chưa nhập tên đơn vị') + '</b>');
    if (loai !== 'ten' || ct.diaChi) s.push(ct.diaChi ? 'Địa chỉ: ' + h(ct.diaChi) : 'Chưa nhập địa chỉ');
    if (ct.mst) s.push('Mã số thuế: ' + h(ct.mst));
    if (ct.dienThoai) s.push('Điện thoại: ' + h(ct.dienThoai));
    var thieu = !ct.diaChi || !ct.mst || !ct.dienThoai;
    return s.join('<br>') + (thieu ? '<div class="mo nho">Thông tin lấy từ Cài đặt & dữ liệu → Đơn vị & chữ ký' + (App.duocXem('caidat') ? ' (bổ sung ở đó nếu còn thiếu)' : '') + '.</div>' : '') +
      hang(App.duocXem('caidat') ? '<button class="nut nho" data-tl="cd:cty">Mở Cài đặt → Đơn vị</button>' : '');
  }
  function banThan(q) {
    var hoiPM = /(sua|doi|o dau|cai dat|cach|nhap)( |$)/.test(q);
    for (var i = 0; i < BAN_THAN.length; i++) {
      var r = BAN_THAN[i];
      if (r[2] && hoiPM) continue;   // "sửa tên đơn vị ở đâu" là hỏi cách dùng phần mềm
      if (r[0].test(q)) return r[1](q);
    }
    return null;
  }

  /* ================= Máy tính nhanh ================= */
  function bhNV(luongBH) {
    var b = CD().bh, tran = 20 * lcs(), tranTN = 20 * ltv();
    var bhxh = Math.min(luongBH, tran) * b.nv.bhxh / 100, bhyt = Math.min(luongBH, tran) * b.nv.bhyt / 100, bhtn = Math.min(luongBH, tranTN || luongBH) * b.nv.bhtn / 100;
    return { bhxh: bhxh, bhyt: bhyt, bhtn: bhtn, tong: bhxh + bhyt + bhtn, chamTran: luongBH > tran };
  }
  function bhDN(luongBH) {
    var b = CD().bh, tran = 20 * lcs(), tranTN = 20 * ltv(), l = Math.min(luongBH, tran);
    return { bhxh: l * b.dn.bhxh / 100, bhyt: l * b.dn.bhyt / 100, bhtn: Math.min(luongBH, tranTN || luongBH) * b.dn.bhtn / 100, kpcd: l * (b.dn.kpcd || 0) / 100 };
  }
  function soNPT(q) {
    if (/(khong co|chua co|khong) (nguoi phu thuoc|npt)/.test(q)) return 0;
    var m = /(\d+) (nguoi phu thuoc|npt|con nho|con|nguoi)/.exec(q);
    if (m && +m[1] < 15) return +m[1];
    var chu = { mot: 1, hai: 2, ba: 3, bon: 4 }, m2 = /(mot|hai|ba|bon) (nguoi phu thuoc|npt|con)/.exec(q);
    return m2 ? chu[m2[1]] : 0;
  }
  function tinhThue(tntt) { return TL.thueLuyTien(Math.max(0, tntt), CD().bieuThue); }
  function dongBang(ds) { return '<table class="tl-bangtinh">' + ds.map(function (r) { return '<tr' + (r[2] ? ' class="tong"' : '') + '><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>'; }

  var MAY_TINH = [
    // lương thực lĩnh (gross -> net)
    { dk: function (q) { return /(thuc linh|thuc nhan|nhan ve|luong net|net|con lai|cam ve|duoc nhan|nhan duoc|linh duoc|gross)/.test(q); }, chay: function (q, goc) {
      var l = docTien(goc); if (!l) return null;
      var lbh = docTien(goc, 'dong bao hiem') || docTien(goc, 'luong bao hiem') || docTien(goc, 'dong bh') || l, npt = soNPT(q), cd = CD();
      var bh = bhNV(lbh), gt = +cd.giamTruBanThan + npt * cd.giamTruNPT, tntt = Math.max(0, l - bh.tong - gt), thue = tinhThue(tntt);
      return { cx: ['gat', 1500, '🧮'], html: 'Ước tính lương thực lĩnh với thu nhập <b>' + tien(l) + '</b>/tháng' + (lbh !== l ? ', lương đóng BH ' + tien(lbh) : '') + ', ' + npt + ' người phụ thuộc:' +
        dongBang([['Tổng thu nhập', tien(l)], ['Trừ BHXH ' + so(cd.bh.nv.bhxh) + '%, BHYT ' + so(cd.bh.nv.bhyt) + '%, BHTN ' + so(cd.bh.nv.bhtn) + '%', '−' + tien(bh.tong)],
          ['Giảm trừ gia cảnh (bản thân' + (npt ? ' + ' + npt + ' NPT' : '') + ')', tien(gt)], ['Thu nhập tính thuế', tien(tntt)], ['Thuế TNCN', '−' + tien(thue)],
          ['<b>Thực lĩnh</b>', '<b>' + tien(l - bh.tong - thue) + '</b>', 1]]) +
        '<div class="mo nho">Chưa trừ đoàn phí công đoàn (' + so(cd.bh.doanPhi) + '% nếu là đoàn viên), chưa tính phần tiền ăn giữa ca / làm thêm giờ được miễn thuế.' + (bh.chamTran ? ' Lương đóng BH vượt trần 20 lần lương cơ sở nên BHXH, BHYT tính trên mức trần.' : '') + '</div>' +
        hang(nutHoi('Tỷ lệ đóng bảo hiểm bao nhiêu') + nutHoi('Biểu thuế TNCN')) };
    } },
    // thuế TNCN
    { dk: function (q) { return /(thue|tncn)/.test(q) && !/(giam tru|bieu thue|quyet toan|ma so thue|mst)( |$)/.test(q); }, chay: function (q, goc) {
      var l = docTien(goc); if (!l) return null;
      var cd = CD(), npt = soNPT(q), daTinh = /(tinh thue|thu nhap tinh thue)/.test(q) && !/chiu thue/.test(q);
      if (daTinh) {
        var t0 = tinhThue(l);
        return { cx: ['gat', 1500, '🧮'], html: 'Thu nhập tính thuế <b>' + tien(l) + '</b>/tháng → thuế TNCN <b>' + tien(t0) + '</b> (biểu lũy tiến trong Cài đặt).' };
      }
      var coBH = !/(da tru bao hiem|khong dong bao hiem|khong co bao hiem|sau bao hiem)/.test(q), bh = coBH ? bhNV(docTien(goc, 'dong bao hiem') || l).tong : 0;
      var gt = +cd.giamTruBanThan + npt * cd.giamTruNPT, tntt = Math.max(0, l - bh - gt), thue = tinhThue(tntt);
      return { cx: ['gat', 1500, '🧮'], html: 'Thuế TNCN ước tính với thu nhập chịu thuế <b>' + tien(l) + '</b>/tháng, ' + npt + ' người phụ thuộc:' +
        dongBang([['Thu nhập chịu thuế', tien(l)], ['Bảo hiểm bắt buộc (NLĐ đóng)', coBH ? '−' + tien(bh) : 'không trừ'], ['Giảm trừ bản thân', '−' + tien(cd.giamTruBanThan)],
          ['Giảm trừ người phụ thuộc', npt ? '−' + tien(npt * cd.giamTruNPT) : '0 đ'], ['Thu nhập tính thuế', tien(tntt)], ['<b>Thuế TNCN phải nộp / tháng</b>', '<b>' + tien(thue) + '</b>', 1]]) +
        (tntt <= 0 ? '<div class="mo nho">Thu nhập sau giảm trừ không dương nên không phải nộp thuế.</div>' : '') +
        hang(nutHoi('Biểu thuế TNCN') + nutHoi('Người phụ thuộc cần điều kiện gì')) };
    } },
    // bảo hiểm phải đóng
    { dk: function (q) { return /(bao hiem|bhxh|bhyt|bhtn|dong bh)/.test(q) && /(dong|tru|bao nhieu|tinh)/.test(q); }, chay: function (q, goc) {
      var l = docTien(goc); if (!l) return null;
      var cd = CD(), nv = bhNV(l), dn = bhDN(l);
      return { cx: ['gat', 1500, '🧮'], html: 'Bảo hiểm bắt buộc với lương đóng BH <b>' + tien(l) + '</b>/tháng:' +
        dongBang([['Người lao động: BHXH ' + so(cd.bh.nv.bhxh) + '%', tien(nv.bhxh)], ['BHYT ' + so(cd.bh.nv.bhyt) + '%', tien(nv.bhyt)], ['BHTN ' + so(cd.bh.nv.bhtn) + '%', tien(nv.bhtn)],
          ['<b>Người lao động đóng</b>', '<b>' + tien(nv.tong) + '</b>', 1],
          ['Doanh nghiệp: BHXH ' + so(cd.bh.dn.bhxh) + '%, BHYT ' + so(cd.bh.dn.bhyt) + '%, BHTN ' + so(cd.bh.dn.bhtn) + '%, KPCĐ ' + so(cd.bh.dn.kpcd) + '%', tien(dn.bhxh + dn.bhyt + dn.bhtn + dn.kpcd)]]) +
        '<div class="mo nho">Trần đóng BHXH, BHYT ' + tien(20 * lcs()) + ' (20 × lương cơ sở), BHTN ' + tien(20 * ltv()) + ' (20 × lương tối thiểu vùng ' + h(cd.vung || '') + '). Đoàn viên công đoàn đóng thêm ' + so(cd.bh.doanPhi) + '%.</div>' };
    } },
    // tiền làm thêm giờ
    { dk: function (q) { return /(lam them|tang ca|ngoai gio|( |^)ot( |$))/.test(q) && !/(toi da|bao nhieu gio|quy dinh)/.test(q); }, chay: function (q, goc) {
      var l = docTien(goc), gio = docSoTruoc(goc, 'gio|tieng|h'); if (!l || !gio) return null;
      var cd = CD(), hs = cd.heSoOT || { thuong: 150, nghi: 200, le: 300 };
      var loai = /(le|tet)( |$)/.test(q) ? 'le' : /(chu nhat|thu bay|ngay nghi|cuoi tuan|nghi hang tuan)/.test(q) ? 'nghi' : 'thuong';
      var cc = docSoTruoc(goc, 'cong') || (/cong nhan/.test(q) ? 26 : /van phong/.test(q) ? 22 : ((cd.loaiLD || [])[0] || {}).congChuan || 26);
      var gioNgay = +cd.gioLamNgay || 8, donGia = l / cc / gioNgay, tienOT = donGia * gio * hs[loai] / 100;
      return { cx: ['gat', 1500, '🧮'], html: 'Tiền làm thêm ' + so(gio) + ' giờ vào <b>' + ({ thuong: 'ngày thường', nghi: 'ngày nghỉ hằng tuần', le: 'ngày lễ, Tết' })[loai] + '</b> (hệ số ' + hs[loai] + '%):' +
        dongBang([['Lương giờ = ' + tien(l) + ' ÷ ' + cc + ' công ÷ ' + gioNgay + ' giờ', tien(donGia)], ['× ' + so(gio) + ' giờ × ' + hs[loai] + '%', ''], ['<b>Tiền làm thêm</b>', '<b>' + tien(tienOT) + '</b>', 1]]) +
        '<div class="mo nho">Theo Điều 98 BLLĐ 2019 và hệ số trong Cài đặt. Làm thêm ban đêm (22h–6h) được cộng thêm. Phần trả cao hơn giờ làm bình thường (' + tien(donGia * gio * (hs[loai] - 100) / 100) + ') được miễn thuế TNCN.</div>' +
        hang(nutHoi('Làm thêm giờ tối đa bao nhiêu')) };
    } },
    // trợ cấp thôi việc / mất việc
    { dk: function (q) { return /(tro cap )?(thoi viec|mat viec)/.test(q) && /(tro cap|duoc bao nhieu|tinh|tien)/.test(q); }, chay: function (q, goc) {
      var l = docTien(goc), nam = docSoTruoc(goc, 'nam'); if (!l || !nam || nam > 60) return null;
      var thang = docSoTruoc(goc, 'thang') || 0, tg = nam + (thang && thang < 12 ? thang / 12 : 0);
      // thời gian lẻ: dưới 6 tháng = 1/2 năm, từ 6 tháng = 1 năm (Điều 8 NĐ 145/2020)
      var le = Math.round((tg % 1) * 12), tgTinh = Math.floor(tg) + (le === 0 ? 0 : le <= 6 ? 0.5 : 1), matViec = /mat viec/.test(q);
      var tc = matViec ? Math.max(2 * l, tgTinh * l) : tgTinh * l / 2;
      return { cx: ['gat', 1500, '🧮'], html: 'Trợ cấp ' + (matViec ? 'mất việc làm' : 'thôi việc') + ' ước tính: ' + so(tgTinh) + ' năm × ' + (matViec ? '1 tháng' : '1/2 tháng') + ' lương ' + tien(l) + ' = <b>' + tien(tc) + '</b>' +
        (matViec ? ' (ít nhất 2 tháng lương)' : '') + '.<div class="mo nho">Thời gian tính = thời gian làm việc thực tế <b>trừ thời gian đã tham gia bảo hiểm thất nghiệp</b> và thời gian đã được chi trả trợ cấp; ' +
        'tiền lương = bình quân 6 tháng liền kề theo hợp đồng. Tháng lẻ đến 6 tháng tính 1/2 năm, trên 6 tháng tính 1 năm.</div>' + ghiChu('Điều ' + (matViec ? '47' : '46') + ' Bộ luật Lao động 2019, Nghị định 145/2020/NĐ-CP') };
    } },
    // trợ cấp thất nghiệp
    { dk: function (q) { return /(that nghiep)/.test(q) && /(tro cap|huong|duoc bao nhieu|tinh|bao lau|may thang)/.test(q); }, chay: function (q, goc) {
      var l = docTien(goc); if (!l) return null;
      var th = docSoTruoc(goc, 'thang'), nam = docSoTruoc(goc, 'nam'), dong = th && th < 600 ? th : nam && nam < 50 ? nam * 12 : null;
      var muc = Math.min(0.6 * l, 5 * ltv()), soThang = dong == null ? null : dong < 12 ? 0 : Math.min(12, 3 + Math.max(0, Math.floor((dong - 36) / 12)));
      return { cx: ['gat', 1500, '🧮'], html: 'Trợ cấp thất nghiệp ước tính với lương đóng BHTN bình quân <b>' + tien(l) + '</b>:<ul><li>Mỗi tháng: 60% = <b>' + tien(muc) + '</b>' + (0.6 * l > 5 * ltv() ? ' (đã giới hạn tối đa 5 lần lương tối thiểu vùng)' : '') + '</li>' +
        (soThang == null ? '<li>Số tháng hưởng: đóng đủ 12–36 tháng được 3 tháng, sau đó mỗi 12 tháng đóng thêm được thêm 1 tháng, tối đa 12 tháng (cho tôi biết số tháng đã đóng để tính).</li>'
          : soThang ? '<li>Đã đóng ' + dong + ' tháng → hưởng <b>' + soThang + ' tháng</b>, tổng khoảng ' + tien(muc * soThang) + '</li>' : '<li>Đóng chưa đủ 12 tháng – chưa đủ điều kiện hưởng.</li>') + '</ul>' +
        '<div class="mo nho">Nộp hồ sơ tại Trung tâm dịch vụ việc làm trong 3 tháng kể từ ngày chấm dứt hợp đồng.</div>' + ghiChu('Luật Việc làm và văn bản hướng dẫn về bảo hiểm thất nghiệp') };
    } },
    // phép năm theo thâm niên
    { dk: function (q) { return /(phep nam|ngay phep|nghi phep|nghi hang nam)/.test(q) && /(\d+) nam/.test(q) && !/nam (19|20)\d\d/.test(q); }, chay: function (q, goc) {
      var nam = docSoTruoc(goc, 'nam'); if (nam == null || nam > 60) return null;
      var co = /(nang nhoc|doc hai|nguy hiem|khuyet tat|chua thanh nien)/.test(q) ? (/dac biet/.test(q) ? 16 : 14) : (+CD().phepNam || 12), them = Math.floor(nam / 5);
      return { cx: ['gat', 1500, '🏖️'], html: 'Làm việc ' + so(nam) + ' năm cho cùng một người sử dụng lao động: phép năm <b>' + (co + them) + ' ngày</b>/năm (' + co + ' ngày cơ bản + ' + them + ' ngày thâm niên, cứ đủ 5 năm thêm 1 ngày).' +
        ghiChu('Điều 113, 114 Bộ luật Lao động 2019') };
    } },
    // tuổi nghỉ hưu theo ngày sinh
    { dk: function (q) { return /(nghi huu|ve huu|tuoi huu|huu tri)/.test(q) && /(sinh|19\d\d|20\d\d)/.test(q); }, chay: function (q, goc) {
      var t = chuThuong(goc), ns = docNgay(goc), m;
      if (!ns && (m = /thang (\d{1,2})[\/ ](?:nam )?(\d{4})/.exec(t))) ns = { d: 1, m: +m[1], y: +m[2] };
      if (!ns && (m = /(\d{1,2})\/(\d{4})/.exec(t))) ns = { d: 1, m: +m[1], y: +m[2] };
      var chiNam = false;
      if (!ns && (m = /(19\d\d|20\d\d)/.exec(t))) { ns = { d: 1, m: 1, y: +m[1] }; chiNam = true; }
      if (!ns || ns.y < 1940 || ns.y > 2010) return null;
      var g = String(goc || '').toLowerCase(), nu = /(nữ|chị|bà|phụ nữ|cô )/.test(g), nam = /(^| )(nam|anh|ông|chú)( |$|,)/.test(g);
      var iso = ns.y + '-' + TL.pad(ns.m) + '-' + TL.pad(ns.d);
      function dong(gt) { var d = TL.ngayNghiHuu(gt, iso); return d ? '<li>' + (gt === 'Nữ' ? 'Nữ' : 'Nam') + ': đủ tuổi nghỉ hưu ngày <b>' + TL.hienNgay(d) + '</b> → nghỉ hưu từ tháng liền kề sau đó</li>' : ''; }
      return { cx: ['gat', 1500, '🧓'], html: 'Người sinh ' + (chiNam ? 'năm ' + ns.y + ' (tính với tháng 1)' : TL.pad(ns.d) + '/' + TL.pad(ns.m) + '/' + ns.y) + ', làm việc trong điều kiện bình thường:<ul>' +
        (nu || !nam ? dong('Nữ') : '') + (nam || !nu ? dong('Nam') : '') + '</ul>' +
        '<div class="mo nho">Lộ trình: nam 60 tuổi 3 tháng (2021), mỗi năm thêm 3 tháng đến 62 tuổi (2028); nữ 55 tuổi 4 tháng (2021), mỗi năm thêm 4 tháng đến 60 tuổi (2035). Nghề nặng nhọc, độc hại, suy giảm khả năng lao động… được nghỉ sớm hơn.</div>' +
        ghiChu('Điều 169 Bộ luật Lao động 2019, Nghị định 135/2020/NĐ-CP') };
    } },
    // thâm niên
    { dk: function (q) { return /(tham nien|lam (duoc )?bao lau|bao nhieu nam (lam|cong tac))/.test(q) && /\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(q + ' '); }, chay: function (q, goc) {
      var ns = docNgay(goc); if (!ns) return null;
      var hn = homNay(), tn = TL.thamNien(ns.y + '-' + TL.pad(ns.m) + '-' + TL.pad(ns.d), hn.y + '-' + TL.pad(hn.m) + '-' + TL.pad(hn.d));
      return { cx: ['gat', 1200, '📅'], html: 'Từ ' + TL.pad(ns.d) + '/' + TL.pad(ns.m) + '/' + ns.y + ' đến hôm nay: <b>' + tn.nam + ' năm ' + tn.thang + ' tháng</b> (' + tn.tongThang + ' tháng). Phép năm được cộng thêm ' + Math.floor(tn.nam / 5) + ' ngày thâm niên.' };
    } },
    // ngày Tết
    { dk: function (q) { return /((^| )tet( |$)|giao thua|mung (1|mot) tet)/.test(q) && /(ngay nao|khi nao|bao gio|con bao nhieu|con may|luc nao|ngay may|ngay bao nhieu|vao ngay|la ngay|thu may|may ngay nua)/.test(q) && !/(nghi tet|duoc nghi)/.test(q); }, chay: function (q, goc) {
      var hn = homNay(), m = /(20\d\d)/.exec(chuThuong(goc)), y = m ? +m[1] : hn.y;
      function ngayTet(nam) { var d = AmLich.amSangDuong(1, 1, nam, 0, 7); return new Date(d[2], d[1] - 1, d[0]); }
      var tet = ngayTet(y), homNay0 = new Date(hn.y, hn.m - 1, hn.d);
      if (!m && tet < homNay0) { y++; tet = ngayTet(y); }
      var con = Math.round((tet - homNay0) / 864e5), giaoThua = new Date(tet.getTime() - 864e5);
      return { cx: ['mung', 1600, '🧧'], html: 'Tết Nguyên đán năm <b>' + canChi(y) + ' ' + y + '</b>: mùng 1 Tết là <b>' + THU[tet.getDay()] + ', ' + TL.pad(tet.getDate()) + '/' + TL.pad(tet.getMonth() + 1) + '/' + tet.getFullYear() + '</b>; ' +
        'giao thừa đêm ' + TL.pad(giaoThua.getDate()) + '/' + TL.pad(giaoThua.getMonth() + 1) + '.' + (con > 0 ? ' Còn <b>' + con + ' ngày</b> nữa là Tết! 🎉' : con === 0 ? ' Hôm nay là mùng 1 Tết – chúc mừng năm mới! 🎉' : '') +
        hang(nutHoi('Nghỉ Tết bao nhiêu ngày')) };
    } },
    // âm lịch
    { dk: function (q) { return /(am lich|ngay am|lich am|ngay ta|duong lich)/.test(q); }, chay: function (q, goc) {
      var t = chuThuong(goc), hn = homNay(), m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))? ?(am|al)( |$)/.exec(t);
      if (m && /(bao nhieu|may) (am|al)|am lich (la )?(ngay )?(bao nhieu|may|gi)|ngay am (la )?(bao nhieu|may)/.test(q)) m = null;   // dương -> âm
      if (m) {   // âm -> dương
        var y = m[3] ? +m[3] : hn.y, d = AmLich.amSangDuong(+m[1], +m[2], y, 0, 7), dt = new Date(d[2], d[1] - 1, d[0]);
        return { cx: ['gat', 1200, '🌙'], html: 'Ngày ' + m[1] + '/' + m[2] + ' âm lịch năm ' + canChi(y) + ' là <b>' + THU[dt.getDay()] + ', ' + TL.pad(d[0]) + '/' + TL.pad(d[1]) + '/' + d[2] + '</b> dương lịch.' };
      }
      var nd = docNgay(goc) || hn, a = amLich(nd.d, nd.m, nd.y), dt2 = new Date(nd.y, nd.m - 1, nd.d);
      return { cx: ['gat', 1200, '🌙'], html: (nd === hn ? 'Hôm nay ' : 'Ngày ') + THU[dt2.getDay()].toLowerCase() + ', ' + TL.pad(nd.d) + '/' + TL.pad(nd.m) + '/' + nd.y + ' là ngày <b>' + a.d + ' tháng ' + a.m + (a.nhuan ? ' (nhuận)' : '') + ' năm ' + canChi(a.y) + '</b> âm lịch.' };
    } },
    // hôm nay
    { dk: function (q) { return /(hom nay (la )?(ngay|thu) (may|bao nhieu|gi|nao)|hom nay ngay may|hom nay thu may|ngay may roi|bay gio (la )?may gio|may gio roi|hom nay la ngay gi)/.test(q); }, chay: function () {
      var hn = homNay(), a = amLich(hn.d, hn.m, hn.y);
      return { cx: ['gat', 1200, '📅'], html: 'Hôm nay là <b>' + THU[hn.dt.getDay()] + ', ' + TL.pad(hn.d) + '/' + TL.pad(hn.m) + '/' + hn.y + '</b> (âm lịch ' + a.d + '/' + a.m + ' năm ' + canChi(a.y) + '), bây giờ là ' + TL.pad(hn.dt.getHours()) + ':' + TL.pad(hn.dt.getMinutes()) + '.' };
    } },
    // còn bao nhiêu ngày đến 1 ngày
    { dk: function (q) { return /(con (bao nhieu|may) ngay|bao nhieu ngay nua|may ngay nua)/.test(q) && /\d{1,2}\/\d{1,2}/.test(q + ''); }, chay: function (q, goc) {
      var t = chuThuong(goc), m = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/.exec(t); if (!m) return null;
      var hn = homNay(), y = m[3] ? +m[3] : hn.y, dich = new Date(y, +m[2] - 1, +m[1]), nay = new Date(hn.y, hn.m - 1, hn.d);
      if (!m[3] && dich < nay) dich = new Date(y + 1, +m[2] - 1, +m[1]);
      var n = Math.round((dich - nay) / 864e5);
      return { cx: ['gat', 1200, '📅'], html: 'Từ hôm nay đến ' + THU[dich.getDay()].toLowerCase() + ' ' + TL.pad(dich.getDate()) + '/' + TL.pad(dich.getMonth() + 1) + '/' + dich.getFullYear() + ' còn <b>' + n + ' ngày</b>.' };
    } },
    // đọc số tiền bằng chữ
    { dk: function (q) { return /(bang chu|doc so|viet (thanh )?chu|doc thanh chu)/.test(q); }, chay: function (q, goc) {
      var v = docTien(goc); if (!v) { var m = /(\d+)/.exec(chuThuong(goc)); v = m ? +m[1] : null; }
      if (v == null) return null;
      return { cx: ['gat', 1200, '✍️'], html: App.tien(v) + ' đ viết bằng chữ: <b>' + h(TL.docSo(v)) + '</b>' };
    } }
  ];
  function tinh(q, goc) {
    for (var i = 0; i < MAY_TINH.length; i++) {
      var mt = MAY_TINH[i];
      if (!mt.dk(q)) continue;
      var kq = mt.chay(q, goc);
      if (kq) return kq;
    }
    return null;
  }

  /* ================= Kho kiến thức lao động – tiền lương ================= */
  // tu: các cụm từ khoá (không dấu); điểm = tổng số từ của các cụm khớp
  var KT = [
    { ma: 'hd_loai', pm: 1, td: 'Các loại hợp đồng lao động', tu: 'loai hop dong|hop dong lao dong|hop dong khong xac dinh|khong xac dinh thoi han|xac dinh thoi han|hop dong co thoi han|ky may lan|ky toi da|36 thang|ky hop dong|ky lai hop dong|hop dong het han|het han hop dong|tai ky',
      nd: function () { return 'Theo Điều 20 Bộ luật Lao động 2019 có 2 loại hợp đồng lao động:<ul><li><b>Không xác định thời hạn</b>: không ấn định thời điểm chấm dứt.</li><li><b>Xác định thời hạn</b>: tối đa <b>36 tháng</b>.</li></ul>' +
        'Hết hạn hợp đồng xác định thời hạn mà người lao động vẫn làm việc: trong <b>30 ngày</b> phải ký hợp đồng mới; không ký thì hợp đồng đã giao kết trở thành hợp đồng không xác định thời hạn. ' +
        'Chỉ được ký thêm <b>1 lần</b> hợp đồng xác định thời hạn; sau đó nếu tiếp tục làm việc thì phải ký hợp đồng <b>không xác định thời hạn</b> (trừ một số trường hợp như người cao tuổi, người nước ngoài…).' +
        '<div class="mo nho">Ở công ty: thử việc 1 tháng → chính thức 1 năm → chính thức 3 năm → không xác định thời hạn (Danh mục → Giai đoạn hợp đồng).</div>'; },
      ng: 'Điều 20 Bộ luật Lao động 2019', lk: ['hopdong', 'theodoihd'] },
    { ma: 'thu_viec', pm: 1, td: 'Thử việc', tu: 'thu viec|thoi gian thu viec|luong thu viec|thu viec bao lau|thu viec toi da|thu viec may lan|het thu viec|85%',
      nd: function () { return 'Theo Điều 24–27 Bộ luật Lao động 2019:<ul><li>Chỉ thử việc <b>1 lần</b> với 1 công việc; không thử việc nếu hợp đồng dưới 1 tháng.</li>' +
        '<li>Thời gian tối đa: <b>180 ngày</b> (người quản lý doanh nghiệp), <b>60 ngày</b> (chức danh cần trình độ cao đẳng trở lên), <b>30 ngày</b> (trung cấp, công nhân kỹ thuật, nhân viên nghiệp vụ), <b>6 ngày làm việc</b> (công việc khác).</li>' +
        '<li>Lương thử việc ít nhất <b>85%</b> lương của công việc đó (công ty đang áp dụng ' + so(CD().thuViec ? CD().thuViec.tiLe : 85) + '%).</li>' +
        '<li>Hết thời gian thử việc phải báo kết quả; đạt thì tiếp tục thực hiện / ký hợp đồng lao động. Trong thời gian thử việc mỗi bên được huỷ thoả thuận không cần báo trước, không phải bồi thường.</li></ul>'; },
      ng: 'Điều 24–27 Bộ luật Lao động 2019', lk: ['hopdong'] },
    { ma: 'nghi_viec', td: 'Xin nghỉ việc phải báo trước bao lâu', tu: 'nghi viec|xin nghi viec|bao truoc|don phuong cham dut|cham dut hop dong|thoi viec|xin thoi viec|bo viec|nghi ngang',
      nd: function () { return 'Người lao động đơn phương chấm dứt hợp đồng phải <b>báo trước</b> (Điều 35 BLLĐ 2019):<ul><li>Ít nhất <b>45 ngày</b> – hợp đồng không xác định thời hạn</li>' +
        '<li>Ít nhất <b>30 ngày</b> – hợp đồng từ 12 đến 36 tháng</li><li>Ít nhất <b>3 ngày làm việc</b> – hợp đồng dưới 12 tháng</li></ul>' +
        'Được nghỉ <b>không cần báo trước</b> khi: không được bố trí đúng công việc, địa điểm, điều kiện đã thoả thuận; không được trả đủ lương, trả đúng hạn; bị ngược đãi, quấy rối; lao động nữ mang thai phải nghỉ theo chỉ định của bác sĩ; đủ tuổi nghỉ hưu; bị cung cấp thông tin không trung thực.' +
        '<div class="mo nho">Người sử dụng lao động đơn phương chấm dứt cũng phải báo trước 45 / 30 / 3 ngày (Điều 36), trừ trường hợp người lao động tự ý bỏ việc 5 ngày liên tục không lý do chính đáng. Khi nghỉ việc, các khoản tiền phải thanh toán trong 14 ngày làm việc (Điều 48).</div>'; },
      ng: 'Điều 35, 36, 48 Bộ luật Lao động 2019' },
    { ma: 'gio_lam', td: 'Thời giờ làm việc, nghỉ giữa giờ', tu: 'thoi gio lam viec|gio lam viec|lam may tieng|lam bao nhieu gio|8 gio|48 gio|nghi giua gio|nghi trua|nghi hang tuan|gio hanh chinh|ca dem|lam dem',
      nd: function () { var cd = CD(); return 'Theo Bộ luật Lao động 2019:<ul><li>Thời giờ làm việc bình thường không quá <b>8 giờ/ngày</b> và <b>48 giờ/tuần</b>; nếu làm theo tuần thì không quá 10 giờ/ngày (Điều 105).</li>' +
        '<li>Làm việc từ 6 giờ/ngày trở lên được nghỉ giữa giờ ít nhất <b>30 phút</b> liên tục, làm ban đêm ít nhất 45 phút (Điều 109).</li><li>Mỗi tuần được nghỉ ít nhất <b>24 giờ liên tục</b> (Điều 111).</li>' +
        '<li>Giờ làm việc ban đêm: từ 22 giờ đến 6 giờ sáng hôm sau, được trả thêm ít nhất 30% (Điều 98, 106).</li></ul>' +
        '<div class="mo nho">Ở công ty (Cài đặt → Kỳ công & giờ làm): vào ' + h(cd.gioVao || '') + ', ra ' + h(cd.gioRa || '') + ', nghỉ trưa ' + h(cd.nghiTruaTu || '') + '–' + h(cd.nghiTruaDen || '') + '.</div>'; },
      ng: 'Điều 105–111 Bộ luật Lao động 2019' },
    { ma: 'lam_them', td: 'Làm thêm giờ', tu: 'lam them gio|lam them|tang ca|ngoai gio|lam them toi da|gio lam them|tien lam them|ot',
      nd: function () { var hs = CD().heSoOT || { thuong: 150, nghi: 200, le: 300 }; return '<ul><li>Phải được người lao động đồng ý. Không quá <b>50%</b> số giờ làm bình thường trong 1 ngày (tổng không quá 12 giờ/ngày), không quá <b>40 giờ/tháng</b>, ' +
        'không quá <b>200 giờ/năm</b> (một số ngành, nghề được đến 300 giờ/năm) – Điều 107.</li>' +
        '<li>Tiền làm thêm (Điều 98): ngày thường ít nhất <b>150%</b>, ngày nghỉ hằng tuần ít nhất <b>200%</b>, ngày lễ, Tết, ngày nghỉ có hưởng lương ít nhất <b>300%</b>; làm thêm ban đêm được trả thêm 20%.</li>' +
        '<li>Phần tiền làm thêm trả cao hơn so với giờ làm bình thường được <b>miễn thuế TNCN</b>.</li></ul>' +
        '<div class="mo nho">Công ty đang áp dụng: ngày thường ' + hs.thuong + '%, ngày nghỉ ' + hs.nghi + '%, lễ Tết ' + hs.le + '%. Hỏi “làm thêm 4 giờ chủ nhật lương 8 triệu” để tôi tính tiền.</div>'; },
      ng: 'Điều 98, 107 Bộ luật Lao động 2019', lk: ['vaora', 'chamcong'] },
    { ma: 'phep_nam', td: 'Nghỉ phép năm', tu: 'phep nam|nghi phep|ngay phep|nghi hang nam|phep tham nien|phep con lai|chua nghi het phep|thanh toan phep',
      nd: function () { return 'Theo Điều 113, 114 Bộ luật Lao động 2019, làm đủ 12 tháng được nghỉ hằng năm hưởng nguyên lương:<ul><li><b>12 ngày</b> làm việc – điều kiện bình thường</li>' +
        '<li><b>14 ngày</b> – người chưa thành niên, người khuyết tật, nghề nặng nhọc, độc hại, nguy hiểm</li><li><b>16 ngày</b> – nghề đặc biệt nặng nhọc, độc hại, nguy hiểm</li></ul>' +
        'Chưa đủ 12 tháng thì tính theo tỷ lệ số tháng làm việc. Cứ đủ <b>5 năm</b> làm việc cho một người sử dụng lao động được thêm <b>1 ngày</b>. ' +
        'Thôi việc, mất việc mà chưa nghỉ hết phép thì được thanh toán tiền lương những ngày chưa nghỉ.' +
        '<div class="mo nho">Trong phần mềm: phép năm mặc định ' + (+CD().phepNam || 12) + ' ngày; xem phép còn lại ở hồ sơ → tab Nghỉ phép hoặc Báo cáo lương → Theo dõi phép năm.</div>'; },
      ng: 'Điều 113, 114 Bộ luật Lao động 2019', lk: ['nghiphep'] },
    { ma: 'nghi_le', td: 'Nghỉ lễ, Tết theo luật', tu: 'nghi le|nghi tet|ngay le|le tet|tet nghi may ngay|nghi le bao nhieu ngay|nghi bu|quoc khanh|30 4|1 5|gio to|tet duong lich|tet am lich',
      nd: function () {
        var y = new Date().getFullYear(), ds = (App.db.ngayLe || []).filter(function (x) { return x.ngay.slice(0, 4) === String(y); });
        return 'Theo Điều 112 Bộ luật Lao động 2019, người lao động được nghỉ làm việc, hưởng nguyên lương:<ul><li>Tết Dương lịch: 1 ngày (1/1)</li><li>Tết Âm lịch: <b>5 ngày</b></li>' +
          '<li>Ngày Chiến thắng 30/4: 1 ngày</li><li>Ngày Quốc tế lao động 1/5: 1 ngày</li><li>Quốc khánh: <b>2 ngày</b> (2/9 và 1 ngày liền kề trước hoặc sau)</li><li>Giỗ Tổ Hùng Vương 10/3 âm lịch: 1 ngày</li></ul>' +
          'Ngày lễ trùng ngày nghỉ hằng tuần thì được nghỉ bù vào ngày làm việc kế tiếp. Đi làm vào ngày lễ, Tết được trả ít nhất 300% (chưa kể lương ngày lễ).' +
          (ds.length ? '<div class="mo nho">Danh mục ngày lễ năm ' + y + ' trong phần mềm có ' + ds.length + ' ngày (kể cả ngày nghỉ bù, ngày lễ mới được bổ sung) – xem Danh mục → Ngày lễ, Tết.</div>' : '');
      }, ng: 'Điều 112 Bộ luật Lao động 2019' },
    { ma: 'viec_rieng', td: 'Nghỉ việc riêng (cưới, tang)', tu: 'viec rieng|nghi cuoi|ket hon|cuoi vo|cuoi chong|lay vo|lay chong|dam cuoi|con cuoi|dam tang|nghi tang|bo mat|me mat|cha mat|ong ba mat|ma chay|hieu hi',
      nd: function () { return 'Theo Điều 115 Bộ luật Lao động 2019:<ul><li><b>Có hưởng lương</b> (báo cho người sử dụng lao động): bản thân kết hôn <b>3 ngày</b>; con đẻ, con nuôi kết hôn <b>1 ngày</b>; ' +
        'cha, mẹ (đẻ, nuôi) của mình hoặc của vợ / chồng chết, vợ / chồng chết, con đẻ, con nuôi chết: <b>3 ngày</b>.</li>' +
        '<li><b>Không hưởng lương 1 ngày</b>: ông bà nội ngoại, anh chị em ruột chết; cha hoặc mẹ kết hôn; anh chị em ruột kết hôn.</li><li>Ngoài ra có thể thoả thuận nghỉ không hưởng lương.</li></ul>' +
        '<div class="mo nho">Chấm công: ký hiệu R (việc riêng có lương), KL (không lương).</div>'; },
      ng: 'Điều 115 Bộ luật Lao động 2019', lk: ['nghiphep'] },
    { ma: 'thai_san', td: 'Chế độ thai sản', tu: 'thai san|sinh con|nghi sinh|mang thai|co thai|vo sinh|chong nghi vo sinh|nghi de|de con|nuoi con|tro cap sinh con|khám thai|kham thai',
      nd: function () { return 'Theo Luật Bảo hiểm xã hội 2024 (hiệu lực 01/7/2025):<ul><li>Lao động nữ sinh con nghỉ <b>6 tháng</b> (trước khi sinh tối đa 2 tháng); sinh đôi trở lên thì từ con thứ hai mỗi con thêm 1 tháng.</li>' +
        '<li>Lao động nam khi vợ sinh con: <b>5 ngày làm việc</b>; 7 ngày nếu vợ sinh mổ hoặc sinh con dưới 32 tuần tuổi; sinh đôi 10 ngày, từ sinh ba mỗi con thêm 3 ngày; sinh đôi trở lên phải mổ 14 ngày – nghỉ trong 60 ngày kể từ ngày vợ sinh.</li>' +
        '<li>Mức hưởng mỗi tháng = <b>100%</b> bình quân tiền lương đóng BHXH của 6 tháng gần nhất; kèm trợ cấp một lần <b>2 lần mức tham chiếu</b> (hiện bằng lương cơ sở ' + tien(lcs()) + ') cho mỗi con.</li>' +
        '<li>Điều kiện chung: đóng BHXH từ đủ 6 tháng trong 12 tháng trước khi sinh. Ngoài ra còn nghỉ khám thai (5 lần, mỗi lần 1 ngày), sảy thai…</li></ul>' +
        '<div class="mo nho">Không được sa thải, đơn phương chấm dứt hợp đồng vì lý do kết hôn, mang thai, nghỉ thai sản, nuôi con dưới 12 tháng (Điều 137 BLLĐ). Chấm công: ký hiệu TS.</div>'; },
      ng: 'Luật Bảo hiểm xã hội 2024; Điều 137 Bộ luật Lao động 2019' },
    { ma: 'om_dau', td: 'Chế độ ốm đau, con ốm', tu: 'om dau|nghi om|bi om|che do om|con om|giay nghi om|nam vien|benh vien|nghi benh|om bao nhieu ngay',
      nd: function () { return 'Theo Luật Bảo hiểm xã hội 2024:<ul><li>Bản thân ốm: tối đa <b>30 ngày/năm</b> (đóng BHXH dưới 15 năm), <b>40 ngày</b> (15 đến dưới 30 năm), <b>60 ngày</b> (từ 30 năm); làm nghề nặng nhọc, độc hại được thêm 10 ngày. Tính theo ngày làm việc.</li>' +
        '<li>Con ốm: con dưới 3 tuổi tối đa <b>20 ngày/năm</b>, từ 3 đến dưới 7 tuổi <b>15 ngày/năm</b> (cho mỗi con).</li>' +
        '<li>Mức hưởng: <b>75%</b> tiền lương làm căn cứ đóng BHXH của tháng gần nhất trước khi nghỉ; cần giấy chứng nhận nghỉ việc hưởng BHXH của cơ sở khám chữa bệnh.</li></ul>' +
        '<div class="mo nho">Chấm công: Ô (ốm), Cô (con ốm) – những ngày này BHXH trả, công ty không trả lương.</div>'; },
      ng: 'Luật Bảo hiểm xã hội 2024' },
    { ma: 'bhxh', td: 'Đóng bảo hiểm xã hội bắt buộc', tu: 'bao hiem xa hoi|bhxh|dong bao hiem|luong dong bao hiem|tran dong|muc dong toi da|doi tuong dong|bat buoc|bhyt|bao hiem y te|so bhxh|bao hiem that nghiep',
      nd: function () { var cd = CD(), b = cd.bh; return '<ul><li>Người làm việc theo hợp đồng lao động từ đủ <b>1 tháng</b> trở lên thuộc diện đóng BHXH bắt buộc (Luật BHXH 2024).</li>' +
        '<li>Tỷ lệ công ty đang áp dụng: người lao động BHXH ' + so(b.nv.bhxh) + '% + BHYT ' + so(b.nv.bhyt) + '% + BHTN ' + so(b.nv.bhtn) + '% = <b>' + so(b.nv.bhxh + b.nv.bhyt + b.nv.bhtn) + '%</b>; ' +
        'doanh nghiệp BHXH ' + so(b.dn.bhxh) + '% + BHYT ' + so(b.dn.bhyt) + '% + BHTN ' + so(b.dn.bhtn) + '% (+ KPCĐ ' + so(b.dn.kpcd) + '%).</li>' +
        '<li>Tiền lương đóng = mức lương + phụ cấp lương + các khoản bổ sung xác định được mức tiền; không thấp hơn lương tối thiểu vùng (vùng ' + h(cd.vung || '') + ': ' + tien(ltv()) + ').</li>' +
        '<li>Mức trần: BHXH, BHYT ' + tien(20 * lcs()) + ' (20 × lương cơ sở); BHTN ' + tien(20 * ltv()) + ' (20 × lương tối thiểu vùng).</li>' +
        '<li>Tháng nghỉ không hưởng lương từ <b>' + (cd.nguongNghiKhongDongBH || 14) + ' ngày làm việc</b> trở lên thì không đóng BHXH tháng đó.</li></ul>'; },
      ng: 'Luật Bảo hiểm xã hội 2024, Luật Bảo hiểm y tế, Luật Việc làm', lk: ['bangluong'] },
    { ma: 'luong_toi_thieu', td: 'Lương tối thiểu vùng', tu: 'luong toi thieu|toi thieu vung|luong vung|vung i|vung 1|muc luong toi thieu',
      nd: function () { var cd = CD(); return 'Lương tối thiểu vùng áp dụng từ 01/01/2026 (đồng/tháng):<ul><li>Vùng I: <b>5.310.000</b></li><li>Vùng II: <b>4.730.000</b></li><li>Vùng III: <b>4.140.000</b></li><li>Vùng IV: <b>3.700.000</b></li></ul>' +
        'Lương trả cho người lao động làm đủ thời giờ, hoàn thành định mức không được thấp hơn mức này; lương đóng BHXH cũng không thấp hơn.' +
        '<div class="mo nho">Công ty đang khai báo vùng ' + h(cd.vung || '') + ' – ' + tien(ltv()) + ' (Cài đặt → Bảo hiểm & công đoàn).</div>'; },
      ng: 'Điều 91 Bộ luật Lao động 2019 và nghị định lương tối thiểu hiện hành' },
    { ma: 'thue', td: 'Thuế thu nhập cá nhân từ tiền lương', tu: 'thue thu nhap ca nhan|thue tncn|thue|giam tru gia canh|quyet toan thue|uy quyen quyet toan|khau tru thue|thu nhap chiu thue|mien thue|bieu thue',
      nd: function () { var cd = CD(); return '<ul><li>Thu nhập tính thuế = thu nhập chịu thuế − bảo hiểm bắt buộc − giảm trừ gia cảnh (bản thân <b>' + tien(cd.giamTruBanThan) + '</b>, mỗi người phụ thuộc <b>' + tien(cd.giamTruNPT) + '</b>/tháng).</li>' +
        '<li>Không tính thuế: tiền ăn giữa ca trong mức quy định (công ty: tối đa ' + tien(TL.mienThueAnCaKy(App.db, kyHT())) + '/tháng), phần tiền làm thêm giờ trả cao hơn giờ bình thường, trợ cấp BHXH (ốm đau, thai sản…), trợ cấp thôi việc theo luật…</li>' +
        '<li>Thuế tính theo biểu lũy tiến từng phần (xem “Biểu thuế TNCN”). Người không ký hợp đồng hoặc hợp đồng dưới 3 tháng, thu nhập từ ' + tien(cd.nguongKhauTru || 2000000) + '/lần trở lên: khấu trừ ' + so(cd.thueKhauTru || 10) + '%.</li>' +
        '<li>Quyết toán năm: người chỉ có thu nhập tiền lương ở công ty có thể <b>uỷ quyền</b> cho công ty quyết toán thay; tự quyết toán thì nộp hồ sơ chậm nhất ngày cuối cùng của tháng thứ 4 kể từ khi kết thúc năm.</li></ul>' +
        '<div class="mo nho">Hỏi “thuế TNCN thu nhập 25 triệu 1 người phụ thuộc” để tôi tính. Báo cáo: Báo cáo lương → Thuế TNCN cả năm.</div>'; },
      ng: 'Luật Thuế thu nhập cá nhân và văn bản hướng dẫn', lk: ['baocao'] },
    { ma: 'npt', td: 'Người phụ thuộc (giảm trừ gia cảnh)', tu: 'nguoi phu thuoc|npt|dang ky nguoi phu thuoc|giam tru con|giam tru cha me|ma so nguoi phu thuoc',
      nd: function () { return 'Người phụ thuộc được giảm trừ ' + tien(CD().giamTruNPT) + '/tháng mỗi người, gồm:<ul><li>Con dưới 18 tuổi; con từ 18 tuổi bị khuyết tật, không có khả năng lao động; con đang học đại học, cao đẳng, trung cấp, học nghề không có thu nhập hoặc thu nhập thấp.</li>' +
        '<li>Vợ / chồng, cha mẹ (đẻ, vợ / chồng, nuôi dưỡng hợp pháp), người khác không nơi nương tựa mà người nộp thuế phải trực tiếp nuôi dưỡng – ngoài độ tuổi lao động, hoặc trong độ tuổi lao động nhưng khuyết tật, không có khả năng lao động – và không có thu nhập hoặc thu nhập bình quân tháng không vượt mức quy định.</li>' +
        '<li>Mỗi người phụ thuộc chỉ được tính giảm trừ cho 1 người nộp thuế; phải đăng ký (có mã số thuế người phụ thuộc).</li></ul>' +
        '<div class="mo nho">Trong phần mềm: hồ sơ nhân viên → tab Bảo hiểm, thuế & người phụ thuộc (khai từ tháng – đến tháng).</div>'; },
      ng: 'Luật Thuế thu nhập cá nhân và văn bản hướng dẫn', lk: ['nhanvien'] },
    { ma: 'thoi_viec', td: 'Trợ cấp thôi việc, mất việc', tu: 'tro cap thoi viec|tro cap mat viec|thoi viec|mat viec|nghi viec duoc gi|nghi viec duoc tro cap',
      nd: function () { return '<ul><li><b>Trợ cấp thôi việc</b> (Điều 46): làm việc thường xuyên từ đủ 12 tháng trở lên, mỗi năm làm việc được <b>1/2 tháng tiền lương</b>; thời gian tính = thời gian làm việc thực tế trừ thời gian đã tham gia <b>bảo hiểm thất nghiệp</b> và thời gian đã được trả trợ cấp. Không áp dụng khi đủ điều kiện hưởng lương hưu hoặc tự ý bỏ việc 5 ngày liên tục.</li>' +
        '<li><b>Trợ cấp mất việc làm</b> (Điều 47): khi công ty thay đổi cơ cấu, công nghệ, vì lý do kinh tế, chia tách, sáp nhập…: mỗi năm làm việc <b>1 tháng tiền lương</b>, ít nhất 2 tháng.</li>' +
        '<li>Tiền lương tính trợ cấp = bình quân 6 tháng liền kề theo hợp đồng trước khi nghỉ.</li></ul>' +
        '<div class="mo nho">Hỏi “trợ cấp thôi việc 6 năm lương 9 triệu” để tôi tính.</div>'; },
      ng: 'Điều 46, 47 Bộ luật Lao động 2019' },
    { ma: 'that_nghiep', td: 'Trợ cấp thất nghiệp', tu: 'that nghiep|tro cap that nghiep|bao hiem that nghiep|bhtn|huong that nghiep',
      nd: function () { return '<ul><li>Điều kiện chính: chấm dứt hợp đồng (không phải tự ý nghỉ trái luật, không phải đang hưởng lương hưu), đã đóng BHTN đủ <b>12 tháng</b> trong khoảng thời gian luật định trước khi nghỉ, nộp hồ sơ tại Trung tâm dịch vụ việc làm trong <b>3 tháng</b>.</li>' +
        '<li>Mức hưởng mỗi tháng: <b>60%</b> bình quân tiền lương đóng BHTN 6 tháng liền kề, tối đa 5 lần lương tối thiểu vùng.</li>' +
        '<li>Thời gian hưởng: đóng đủ 12–36 tháng được <b>3 tháng</b>; sau đó cứ đóng thêm đủ 12 tháng được thêm 1 tháng, tối đa <b>12 tháng</b>.</li></ul>' +
        '<div class="mo nho">Hỏi “trợ cấp thất nghiệp lương 8 triệu đóng 60 tháng” để tôi tính.</div>'; },
      ng: 'Luật Việc làm và văn bản hướng dẫn' },
    { ma: 'nghi_huu', td: 'Tuổi nghỉ hưu, lương hưu', tu: 'nghi huu|ve huu|tuoi nghi huu|tuoi huu|luong huu|huu tri|bao nhieu tuoi nghi huu',
      nd: function () {
        var y = new Date().getFullYear(), tNam = Math.min(744, 720 + 3 * (y - 2020)), tNu = Math.min(720, 660 + 4 * (y - 2020));
        function tuoi(t) { return Math.floor(t / 12) + ' tuổi' + (t % 12 ? ' ' + (t % 12) + ' tháng' : ''); }
        return 'Tuổi nghỉ hưu (điều kiện lao động bình thường) theo Điều 169 BLLĐ 2019 và Nghị định 135/2020: nam tăng dần đến <b>62 tuổi</b> (năm 2028), nữ đến <b>60 tuổi</b> (năm 2035). ' +
          'Người nghỉ hưu trong năm ' + y + ': nam <b>' + tuoi(tNam) + '</b>, nữ <b>' + tuoi(tNu) + '</b>.' +
          '<ul><li>Điều kiện hưởng lương hưu: đủ tuổi và đóng BHXH từ đủ <b>15 năm</b> trở lên (Luật BHXH 2024).</li>' +
          '<li>Tỷ lệ lương hưu: nữ 45% ứng với 15 năm đóng, nam 45% ứng với 20 năm đóng; mỗi năm đóng thêm cộng 2%, tối đa 75%.</li></ul>' +
          '<div class="mo nho">Hỏi “nữ sinh tháng 5/1975 bao giờ nghỉ hưu” để tôi tính ngày cụ thể; danh sách sắp nghỉ hưu: Báo cáo nhân sự → Đến tuổi nghỉ hưu.</div>';
      }, ng: 'Điều 169 Bộ luật Lao động 2019, Nghị định 135/2020/NĐ-CP, Luật BHXH 2024', lk: ['bcnhansu'] },
    { ma: 'ky_luat', td: 'Kỷ luật lao động', tu: 'ky luat|khien trach|keo dai thoi han nang luong|cach chuc|sa thai|vi pham noi quy|xu ly ky luat|phat tien|tru luong|cat luong|boi thuong thiet hai',
      nd: function () { return 'Theo Bộ luật Lao động 2019:<ul><li>Hình thức kỷ luật (Điều 124): <b>khiển trách</b>; <b>kéo dài thời hạn nâng lương</b> không quá 6 tháng; <b>cách chức</b>; <b>sa thải</b>.</li>' +
        '<li>Thời hiệu xử lý (Điều 123): 6 tháng kể từ ngày vi phạm; 12 tháng với vi phạm liên quan tài chính, tài sản, bí mật công nghệ, kinh doanh.</li>' +
        '<li>Phải có nội quy lao động, chứng minh lỗi, có sự tham gia của tổ chức đại diện người lao động, lập biên bản (Điều 122).</li>' +
        '<li>Cấm: xâm phạm thân thể, danh dự; <b>phạt tiền, cắt lương thay cho xử lý kỷ luật</b> (Điều 127). Bồi thường thiệt hại tài sản thì khấu trừ lương không quá 30% lương thực trả hằng tháng (Điều 102, 129).</li></ul>' +
        '<div class="mo nho">Trong phần mềm: lập quyết định Kỷ luật (trang Quyết định); kỷ luật kéo dài thời hạn nâng lương tự cộng 6 tháng ở “Đến hạn nâng bậc”.</div>'; },
      ng: 'Điều 122–129 Bộ luật Lao động 2019', lk: ['quyetdinh'] },
    { ma: 'tra_luong', pm: 1, td: 'Trả lương, tạm ứng, phiếu lương', tu: 'tra luong|ngay tra luong|cham luong|no luong|tre luong|tam ung luong|phieu luong|bang ke tra luong|hinh thuc tra luong|chuyen khoan luong',
      nd: function () { return 'Theo Bộ luật Lao động 2019:<ul><li>Trả lương trực tiếp, đầy đủ, đúng hạn cho người lao động, bằng tiền mặt hoặc chuyển khoản (Điều 94, 96); mỗi lần trả phải gửi <b>bảng kê</b> ghi rõ lương, làm thêm, các khoản khấu trừ (Điều 95) – chính là phiếu lương.</li>' +
        '<li>Người hưởng lương tháng được trả tháng một lần hoặc nửa tháng một lần (Điều 97); trả chậm từ 15 ngày trở lên phải đền bù thêm tiền lãi.</li>' +
        '<li>Không được ép người lao động chi tiêu lương vào hàng hoá, dịch vụ của công ty; không giữ lương để ràng buộc.</li></ul>' +
        '<div class="mo nho">Ở công ty: tạm ứng kỳ I giữa tháng, kỳ II cuối tháng (Bảng lương → Chi lương kỳ I, kỳ II…); phiếu lương in ở trang Phiếu lương.</div>'; },
      ng: 'Điều 94–97 Bộ luật Lao động 2019', lk: ['bangluong', 'phieuluong'] },
    { ma: 'quy_che', td: 'Quy chế trả lương của công ty', tu: 'quy che tra luong|quy che luong|quy che|nguyen tac tra luong|tra luong may lan|may lan mot thang|tam ung bao nhieu|luong thang 13|hieu qua cong viec|nang luong truoc han|dieu kien nang luong|nien han nang luong|bao lau nang luong|bao lau duoc nang|may nam nang|xep luong|chuyen xep|16 qd cnhg',
      nd: function () { var QC = TL.QUY_CHE_LUONG; return '<b>' + h(QC.ten) + '</b> (Quyết định ' + h(QC.so) + ' ngày ' + TL.hienNgay(QC.ngay) + ', áp dụng từ kỳ lương tháng ' + QC.tuKy.slice(5) + '/' + QC.tuKy.slice(0, 4) + ', thay QĐ ' + h(QC.thay) + '):<ul>' +
        '<li><b>Hình thức trả lương</b>: khoán sản phẩm (ghi chỉ số thủy lượng kế, thu hoá đơn tiền nước × đơn giá khoán) và theo thời gian: lương = mức lương theo công việc (ghi trên HĐLĐ) ÷ số ngày công quy định × ngày công thực tế.</li>' +
        '<li><b>Thanh toán 2 lần / tháng</b>: lần 1 tạm ứng không quá 50% lương từ ngày 10 đến 15; lần 2 thanh toán phần còn lại từ ngày 25 đến 30.</li>' +
        '<li>Thử việc hưởng <b>85%</b> mức lương của công việc. Mức lương trong thang, bảng lương là mức ghi trên hợp đồng và là <b>căn cứ đóng BHXH, BHYT, BHTN</b>.</li>' +
        '<li><b>Thang, bảng lương</b>: bảng quản lý, chuyên môn, nghiệp vụ thừa hành, phục vụ (C01–C03, D01–D06) và bảng công nhân, nhân viên trực tiếp (A01–A03) – xếp theo đúng chức danh, công việc; đổi chức danh thì đổi lương theo chức danh mới.</li>' +
        '<li><b>Nâng lương</b>: đủ <b>3 năm</b> ở một mức, hoàn thành tốt nhiệm vụ, không vi phạm nội quy, không bị kỷ luật từ khiển trách bằng văn bản trở lên còn hiệu lực; nâng trước hạn khi có thành tích đặc biệt. Phòng Hành chính – Quản trị rà soát hằng tháng, trình Chủ tịch kiêm Giám đốc quyết định.</li>' +
        '<li><b>Làm thêm giờ</b>: trả theo Điều 98 BLLĐ; chỉ tính cho công nhân được huy động sửa chữa sự cố ống bể ngoài khung 7 giờ – 17 giờ và người làm ngày Lễ, Tết theo danh sách được duyệt; công việc cá nhân phụ trách (lương trọn gói) không tính làm thêm.</li>' +
        '<li>Nghỉ phép năm hưởng nguyên lương; nghỉ ốm, thai sản do BHXH trả; đi học theo kế hoạch của công ty hưởng lương như ngày làm việc. Cuối năm có thể chi lương theo hiệu quả công việc (lương tháng 13…) nếu đạt kế hoạch.</li></ul>' +
        '<div class="mo nho">Hỏi “lương trưởng phòng bao nhiêu”, “bậc lương A01” để xem mức từng chức danh.</div>'; },
      ng: 'Quy chế trả lương của công ty (QĐ 16/QĐ-CNHG ngày 26/5/2026)', lk: ['nangbac', 'danhmuc'] },
    { ma: 'thang_luong', pm: 1, td: 'Thang lương, bảng lương, nâng lương', tu: 'thang luong|bang luong|nang luong|nang bac|xay dung thang bang luong|dinh muc lao dong|che do nang luong|bac luong',
      nd: function () { return 'Doanh nghiệp tự xây dựng <b>thang lương, bảng lương, định mức lao động</b> làm cơ sở tuyển dụng, trả lương, đóng BHXH; phải tham khảo ý kiến tổ chức đại diện người lao động và công bố công khai tại nơi làm việc (Điều 93 BLLĐ 2019). ' +
        'Điều kiện, thời hạn nâng bậc, nâng lương thực hiện theo quy chế của công ty và thoả thuận trong hợp đồng.' +
        '<div class="mo nho">Trong phần mềm: Danh mục → Thang, bảng lương; trang Xếp lương, nâng bậc (tab Đến hạn nâng bậc); thay đổi giá trị bậc từ một tháng ở Mức lương theo kỳ.</div>'; },
      ng: 'Điều 93 Bộ luật Lao động 2019', lk: ['nangbac', 'mucluong'] },
    { ma: 'cong_doan', td: 'Kinh phí, đoàn phí công đoàn', tu: 'cong doan|doan phi|kinh phi cong doan|kpcd|doan vien',
      nd: function () { var b = CD().bh; return '<ul><li><b>Kinh phí công đoàn</b>: doanh nghiệp đóng ' + so(b.dn.kpcd) + '% quỹ tiền lương làm căn cứ đóng BHXH.</li>' +
        '<li><b>Đoàn phí</b>: đoàn viên đóng hằng tháng theo quy định của Tổng Liên đoàn (luật quy định tối đa 1% tiền lương đóng BHXH); công ty đang trừ ' + so(b.doanPhi) + '%.</li></ul>'; },
      ng: 'Luật Công đoàn 2024' },
    { ma: 'lao_dong_nu', td: 'Quyền lợi lao động nữ', tu: 'lao dong nu|phu nu|nu mang thai|nuoi con nho|cho con bu|hanh kinh|ky kinh|nghi 60 phut|nghi 30 phut',
      nd: function () { return 'Theo Điều 137, 138 Bộ luật Lao động 2019:<ul><li>Mang thai từ tháng thứ 7 (hoặc tháng thứ 6 ở vùng khó khăn) và nuôi con dưới 12 tháng: không làm thêm giờ, làm đêm, đi công tác xa (trừ khi người lao động đồng ý).</li>' +
        '<li>Trong thời gian hành kinh được nghỉ <b>30 phút/ngày</b>; nuôi con dưới 12 tháng được nghỉ <b>60 phút/ngày</b> – vẫn hưởng đủ lương.</li>' +
        '<li>Không được sa thải, đơn phương chấm dứt hợp đồng vì kết hôn, mang thai, nghỉ thai sản, nuôi con dưới 12 tháng.</li></ul>'; },
      ng: 'Điều 137, 138 Bộ luật Lao động 2019' },
    { ma: 'tnld', td: 'Tai nạn lao động', tu: 'tai nan lao dong|tai nan|bi tai nan|an toan lao dong|tnld|bi thuong|benh nghe nghiep|tai nan khi di lam|tai nan tren duong di lam',
      nd: function () { return '<ul><li>Bị tai nạn lao động (kể cả trên tuyến đường đi – về hợp lý giữa nơi ở và nơi làm việc): công ty phải sơ cứu, cấp cứu kịp thời, thanh toán chi phí y tế phần BHYT không chi trả, ' +
        '<b>trả đủ tiền lương</b> trong thời gian điều trị; bồi thường / trợ cấp khi không do lỗi của người lao động.</li>' +
        '<li>Quỹ bảo hiểm tai nạn lao động, bệnh nghề nghiệp (doanh nghiệp đóng) chi trợ cấp khi suy giảm khả năng lao động từ 5% trở lên.</li><li>Phải khai báo, điều tra, lập biên bản theo quy định.</li></ul>'; },
      ng: 'Luật An toàn, vệ sinh lao động 2015' },
    { ma: 'cong_chuan', pm: 1, td: 'Ngày công chuẩn, cách tính lương thời gian', tu: 'cong chuan|ngay cong|cach tinh luong|luong thoi gian|tinh luong the nao|22 cong|26 cong|luong ngay|luong san pham',
      nd: function () { var ds = CD().loaiLD || []; return 'Ở công ty, lương thời gian = <b>mức lương ÷ công chuẩn × số công</b> hưởng lương thời gian (gồm ngày đi làm, phép, lễ…). Công chuẩn theo loại lao động: ' +
        (ds.length ? ds.map(function (l) { return h(l.ten) + ' ' + l.congChuan + ' công'; }).join(', ') : 'văn phòng 22 công, công nhân 26 công') + '. ' +
        'Lương sản phẩm = số lượng × đơn giá. Đi làm ngày lễ, Tết được nhân công theo Danh mục → Ngày lễ, Tết.' +
        '<div class="mo nho">Bấm tên một người trên Bảng lương để xem chi tiết cách tính từng khoản.</div>'; },
      ng: 'Quy chế trả lương của công ty (cài đặt trong phần mềm)', lk: ['bangluong'] }
  ];
  function tim(q) {
    var t = ' ' + q + ' ';
    return KT.map(function (k) {
      var d = 0, td = cn(k.td);
      k.tu.split('|').forEach(function (p) { if (t.indexOf(' ' + p + ' ') >= 0) d += p.split(' ').length; });
      if (t.indexOf(' ' + td + ' ') >= 0) d += 3;
      return { k: k, d: d };
    }).filter(function (x) { return x.d >= 2; }).sort(function (a, b) { return b.d - a.d; });
  }
  function veKT(k, khac) {
    return { cx: ['gat', 1300, '📚'], html: '<div class="tl-muc">' + h(k.td) + '</div>' + k.nd() + ghiChu(k.ng) +
      hang((k.lk || []).map(function (id) { var m = App.MENU.filter(function (x) { return x.id === id; })[0]; return m ? nutTrang(id, 'Mở ' + m.ten) : ''; }).join('')) +
      (khac && khac.length ? '<div class="tl-lq">Liên quan: ' + khac.map(function (x) { return '<a href="#" data-tl="hoi:' + h(x.k.td) + '">' + h(x.k.td) + '</a>'; }).join(' · ') + '</div>' : '') };
  }

  /* ================= Mức lương theo chức danh trong thang, bảng lương ================= */
  function boHai(s) { var w = cn(s).split(' '), kq = []; for (var i = 0; i + 1 < w.length; i++) if (!/^(cong ty|da bao|bao gom|ma so)$/.test(w[i] + ' ' + w[i + 1])) kq.push(w[i] + ' ' + w[i + 1]); return kq; }
  function bacLuong(q) {
    var ds = (App.db && App.db.thangLuong) || [];
    if (!ds.length || !/(^| )(luong|bac|muc luong|he so|thang luong|bang luong|ma so)( |$)/.test(q)) return null;
    var duocXem = typeof App.quyen !== 'function' || App.quyen('lg') >= 1 || App.quyen('tl') >= 1;
    var ky = kyHT(), t = ' ' + q + ' ', tot = [];
    ds.forEach(function (b) {
      (b.ngach || []).forEach(function (g) {
        if (t.indexOf(' ' + cn(g.ma) + ' ') >= 0) { tot.push({ b: b, g: g, ti: 2, khop: 9 }); return; }
        String(g.ten).split(/[;,(]/).forEach(function (cum) {
          var hai = boHai(cum); if (!hai.length) return;
          var khop = hai.filter(function (x) { return t.indexOf(' ' + x + ' ') >= 0; }).length;
          if (khop) tot.push({ b: b, g: g, ti: khop / hai.length, khop: khop });
        });
      });
    });
    var chung = /(thang luong|bang luong|bac luong|cac bac|muc luong)( (cua )?(cong ty|hien nay|hien tai|theo quy che|moi))/.test(q) || /^(thang|bang) (bang )?luong( cong ty)?$/.test(q);
    if (!tot.length && !chung) return null;
    if (!duocXem) return { cx: ['lac', 1200, '🔒'], html: 'Tài khoản của bạn không xem được thang, bảng lương (cần quyền Tiền lương hoặc Thiết lập).' };
    function dongBac(b, g) {
      var n = TL.soBacNgach(g), s = [];
      for (var k = 1; k <= n; k++) { var v = TL.giaTriBac(App.db, b, g, k, ky); if (v) s.push('Bậc ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][k - 1] + ': <b>' + App.tien(v.tien) + '</b>'); }
      return s.join(' · ');
    }
    if (!tot.length || chung) {
      return { cx: ['gat', 1300, '📊'], html: 'Thang, bảng lương đang áp dụng (kỳ ' + ky.slice(5) + '/' + ky.slice(0, 4) + ', đồng/tháng):' + ds.map(function (b) {
        return '<div class="tl-muc" style="margin-top:6px">' + h(b.ten) + '</div><ul>' + b.ngach.map(function (g) { return '<li><b>' + h(g.ma) + '</b> ' + h(g.ten) + ': ' + dongBac(b, g) + '</li>'; }).join('') + '</ul>';
      }).join('') + hang(nutTrang('nangbac', 'Mở Xếp lương, nâng bậc')) };
    }
    tot.sort(function (a, b) { return b.ti - a.ti || b.khop - a.khop; });
    var dau = tot[0], cung = tot.filter(function (x) { return x.ti === dau.ti && x.khop === dau.khop && x.g !== dau.g; });
    var chon = [dau].concat(cung).filter(function (x, i, a) { return a.findIndex(function (y) { return y.g === x.g; }) === i; }).slice(0, 3);
    return { cx: ['gat', 1300, '📊'], html: chon.map(function (x) {
      var dang = App.db.nhanVien.filter(function (nv) { return nv.trangThai !== 'nghi_viec' && nv.xepLuong && nv.xepLuong.bang === x.b.ma && nv.xepLuong.ngach === x.g.ma; }).length;
      return '<div class="tl-muc">' + h(x.g.ma) + ' – ' + h(x.g.ten) + '</div><div>' + dongBac(x.b, x.g) + ' đ/tháng</div>' +
        '<div class="mo nho">' + h(x.b.ten) + ' · nâng bậc ' + (+x.g.namNang || +x.b.namNang || 3) + ' năm · dùng cho ' + ({ cb: 'mức lương', bh: 'lương đóng BH', ca_hai: 'mức lương và lương đóng BH' })[x.b.apDung] + (dang ? ' · ' + dang + ' người đang xếp' : '') + '</div>';
    }).join('') + (dau.b.quyChe ? '<div class="mo nho tl-nguon">📚 Theo Quy chế trả lương (QĐ ' + h(dau.b.quyChe) + ').</div>' : '') + hang(nutTrang('nangbac', 'Mở Xếp lương, nâng bậc')) };
  }

  App.KienThuc = {
    ten: TEN, banThan: banThan, tinh: tinh, tim: tim, ve: veKT, bacLuong: bacLuong, chuDe: function () { return KT.map(function (k) { return k.td; }); },
    lamDuocGi: lamDuocGi, docTien: docTien
  };
})();
