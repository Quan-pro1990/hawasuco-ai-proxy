using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Mục chọn đơn vị (đội / khu vực / DMA) trong ô chọn.</summary>
    class MucDonViNl
    {
        public DonViNl DonVi;
        public string TenRieng;     // dòng "Tất cả" / "Chưa xếp"
        public int Id { get { return DonVi != null ? DonVi.Id : -1; } }
        public override string ToString() { return DonVi != null ? DonVi.ToString() : TenRieng; }

        public static void Nap(ComboBox c, DuLieu dl, string dongDau, int chon)
        {
            c.Items.Clear();
            c.Items.Add(new MucDonViNl { TenRieng = dongDau });
            foreach (DonViNl dv in DonViNlOps.DanhSach(dl)) c.Items.Add(new MucDonViNl { DonVi = dv });
            MucDonViNl m = c.Items.Cast<MucDonViNl>().FirstOrDefault(x => x.DonVi != null && x.DonVi.Id == chon);
            if (m == null && chon >= 0)
            {
                // đơn vị không còn trong cấu trúc tháng mới nhất: vẫn giữ để không mất
                string ten = DonViNlOps.Ten(dl, chon);
                m = new MucDonViNl { DonVi = new DonViNl { Id = chon, Ten = (ten.Length > 0 ? ten : "Đơn vị #" + chon) + " (đã bỏ)" } };
                c.Items.Add(m);
            }
            c.SelectedItem = m ?? c.Items[0];
            c.DropDownWidth = Math.Max(c.Width, Ui.S(360));
        }
    }

    /// <summary>Thêm / sửa điểm đặt logger.</summary>
    class DiemNlForm : HopThoaiCap1
    {
        readonly TextBox txtTen, txtOng, txtToaDo, txtGhiChu;
        readonly ComboBox cboLoai, cboDonVi;
        readonly CheckBox chkNgung;
        readonly DuLieuNl d;
        readonly DiemNl diem;

        public DiemNlForm(DuLieu dl, DiemNl diem, int donViMacDinh)
            : base(diem == null ? "Thêm điểm đặt noise logger" : "Sửa điểm đặt noise logger", 720, diem == null ? 390 : 420)
        {
            d = dl.Nl;
            this.diem = diem;
            txtTen = O(460, diem != null ? diem.Ten : "", "vd Van D150 ngã ba Trần Hưng Đạo – 30/4");
            Dong("Tên điểm", txtTen);
            cboLoai = Ui.MakeCombo(200);
            foreach (LoaiDiemNl l in Enum.GetValues(typeof(LoaiDiemNl))) cboLoai.Items.Add(DuLieuNl.TenLoai(l));
            cboLoai.SelectedIndex = (int)(diem != null ? diem.Loai : LoaiDiemNl.Van);
            Dong("Gắn logger vào", cboLoai);
            cboDonVi = Ui.MakeCombo(360);
            MucDonViNl.Nap(cboDonVi, dl, "(chưa xếp đội / DMA)", diem != null ? diem.DonViId : donViMacDinh);
            Dong("Thuộc đội / khu vực / DMA", cboDonVi);
            GhiChu("Danh sách lấy theo cấu trúc báo cáo thất thoát tháng mới nhất (dòng Đội, Khu vực, DMA) — để lọc và tổng hợp theo đội / vùng DMA.");
            txtOng = O(200, diem != null ? diem.DuongOng : "", "vd PVC D110");
            Dong("Đường ống", Hang(txtOng, Ui.MakeLabel("vật liệu, cỡ ống (ống nhựa truyền tiếng ồn kém hơn)", Ui.Small, Ui.Muted)));
            txtToaDo = O(240, diem != null ? diem.ToaDo : "", "vd 9.7845, 105.4712");
            Dong("Toạ độ", Hang(txtToaDo, Ui.MakeLabel("chép từ Google Maps (không bắt buộc)", Ui.Small, Ui.Muted)));
            txtGhiChu = O(460, diem != null ? diem.GhiChu : "", "hố van sâu, cần chìa khoá…");
            Dong("Ghi chú", txtGhiChu);
            if (diem != null)
            {
                chkNgung = new CheckBox { Text = "Ngừng dùng điểm này (ẩn khỏi danh sách, số đo cũ vẫn giữ)", AutoSize = true, Checked = diem.Ngung };
                Dong("", chkNgung);
            }
            Shown += (s, e) => { txtTen.Focus(); txtTen.SelectionStart = txtTen.Text.Length; };
        }

        protected override bool KiemTra()
        {
            string ten = NhapExcel.ChuanHoa(txtTen.Text);
            if (ten.Length == 0) { Ui.Error(this, "Nhập tên điểm."); txtTen.Focus(); return false; }
            string k = NhapExcel.BoDau(ten);
            if (d.Diem.Any(x => x != diem && NhapExcel.BoDau(x.Ten) == k))
            {
                Ui.Error(this, "Đã có điểm tên \"" + ten + "\". Đặt tên khác (thêm số nhà, đường) để nhập số đo theo tên điểm không bị nhầm.");
                txtTen.Focus();
                return false;
            }
            return true;
        }

        public void GhiVao(DiemNl p)
        {
            p.Ten = NhapExcel.ChuanHoa(txtTen.Text);
            p.Loai = (LoaiDiemNl)cboLoai.SelectedIndex;
            var dv = cboDonVi.SelectedItem as MucDonViNl;
            p.DonViId = dv != null ? dv.Id : -1;
            p.DuongOng = NhapExcel.ChuanHoa(txtOng.Text);
            p.ToaDo = NhapExcel.ChuanHoa(txtToaDo.Text);
            p.GhiChu = NhapExcel.ChuanHoa(txtGhiChu.Text);
            if (chkNgung != null) p.Ngung = chkNgung.Checked;
        }
    }

    /// <summary>Thêm / sửa 1 logger trong danh mục thiết bị.</summary>
    class ThietBiNlForm : HopThoaiCap1
    {
        readonly TextBox txtMa, txtLoai, txtGhiChu;
        readonly CheckBox chkHong;
        readonly DuLieuNl d;
        readonly ThietBiNl tb;

        public ThietBiNlForm(DuLieuNl d, ThietBiNl tb) : base(tb == null ? "Thêm noise logger" : "Sửa noise logger", 640, 300)
        {
            this.d = d;
            this.tb = tb;
            txtMa = O(220, tb != null ? tb.Ma : "", "vd 22-1045");
            Dong("Mã / số seri", txtMa);
            GhiChu("Ghi đúng mã như trong file xuất từ phần mềm của hãng — phần mềm dựa vào mã này để biết số đo của logger nào.");
            string[] goiY = d.ThietBi.Select(x => x.Loai).Where(x => x.Length > 0).Distinct().OrderBy(x => x).ToArray();
            txtLoai = O(320, tb != null ? tb.Loai : (goiY.Length == 1 ? goiY[0] : ""), "vd Gutermann ZONESCAN 820");
            if (goiY.Length > 0)
            {
                txtLoai.AutoCompleteMode = AutoCompleteMode.SuggestAppend;
                txtLoai.AutoCompleteSource = AutoCompleteSource.CustomSource;
                txtLoai.AutoCompleteCustomSource.AddRange(goiY);
            }
            Dong("Hãng / model", txtLoai);
            txtGhiChu = O(380, tb != null ? tb.GhiChu : "", "ngày mua, hạn pin…");
            Dong("Ghi chú", txtGhiChu);
            chkHong = new CheckBox { Text = "Hỏng / thanh lý (không lắp được nữa)", AutoSize = true, Checked = tb != null && tb.Hong };
            Dong("", chkHong);
            Shown += (s, e) => txtMa.Focus();
        }

        protected override bool KiemTra()
        {
            string ma = txtMa.Text.Trim();
            if (ma.Length == 0) { Ui.Error(this, "Nhập mã / số seri của logger."); txtMa.Focus(); return false; }
            string k = DuLieuNl.ChuanMa(ma);
            if (d.ThietBi.Any(x => x != tb && DuLieuNl.ChuanMa(x.Ma) == k)) { Ui.Error(this, "Đã có logger mã \"" + ma + "\"."); txtMa.Focus(); return false; }
            if (chkHong.Checked && tb != null && d.DangLapCuaThietBi(tb.Id) != null)
            {
                Ui.Error(this, "Logger đang lắp ở hiện trường — thu logger về trước (nút \"Lắp / thu logger…\") rồi mới đánh dấu hỏng.");
                return false;
            }
            return true;
        }

        public void GhiVao(ThietBiNl t)
        {
            t.Ma = txtMa.Text.Trim();
            t.Loai = NhapExcel.ChuanHoa(txtLoai.Text);
            t.GhiChu = NhapExcel.ChuanHoa(txtGhiChu.Text);
            t.Hong = chkHong.Checked;
        }
    }

    /// <summary>Lắp logger vào điểm / thu logger về / chuyển logger sang điểm khác.</summary>
    class LapDatNlForm : HopThoaiCap1
    {
        class MucTb
        {
            public ThietBiNl Tb;
            public LapDatNl DangO;
            public DuLieuNl D;
            public override string ToString()
            {
                if (Tb == null) return "— không lắp logger mới —";
                DiemNl p = DangO != null ? D.TimDiem(DangO.DiemId) : null;
                return Tb + (p != null ? "   — đang ở " + p.Ten + " (sẽ chuyển sang đây)" : "");
            }
        }

        readonly DuLieuNl d;
        readonly DiemNl diem;
        readonly LapDatNl dangLap;
        readonly CheckBox chkThu;
        readonly DateTimePicker dtThu, dtLap;
        readonly ComboBox cboTb;
        readonly TextBox txtGhiChu;

        public bool DaThemThietBi { get; private set; }

        public LapDatNlForm(DuLieuNl d, DiemNl diem, DateTime ngayMacDinh) : base("Lắp / thu logger — " + diem.Ten, 800, 470)
        {
            this.d = d;
            this.diem = diem;
            dangLap = d.DangLapTaiDiem(diem.Id);
            if (dangLap != null)
            {
                ThietBiNl tb = d.TimThietBi(dangLap.ThietBiId);
                var l = Ui.MakeLabel((tb != null ? tb.ToString() : "Logger #" + dangLap.ThietBiId) + "  — lắp từ " + So.Ngay(dangLap.TuNgay), Ui.BaseBold, Ui.Text);
                l.UseMnemonic = false;
                Dong("Đang lắp", l);
                chkThu = new CheckBox { Text = "Thu logger này về ngày", AutoSize = true };
                dtThu = Ui.MakeDatePicker(false);
                dtThu.Value = ngayMacDinh;
                dtThu.Enabled = false;
                chkThu.CheckedChanged += (s, e) => dtThu.Enabled = chkThu.Checked;
                Dong("", Hang(chkThu, dtThu));
            }
            else Dong("Đang lắp", Ui.MakeLabel("Chưa có logger nào ở điểm này", Ui.Base, Ui.Muted));

            cboTb = Ui.MakeCombo(400);
            var bMoi = Ui.MakeButton("+ Logger mới…", false);
            bMoi.Click += (s, e) => ThemThietBi();
            Dong("Lắp logger", Hang(cboTb, bMoi));
            dtLap = Ui.MakeDatePicker(false);
            dtLap.Value = ngayMacDinh;
            Dong("Lắp từ ngày", Hang(dtLap, Ui.MakeLabel("số đo từ rạng sáng hôm sau thuộc điểm này", Ui.Small, Ui.Muted)));
            txtGhiChu = O(440, "", "vd đợt dò DMA Long Mỹ 1 tháng 10");
            Dong("Ghi chú lần lắp", txtGhiChu);
            GhiChu("Chọn logger đang ở điểm khác = chuyển logger (\"lift & shift\"): phần mềm tự ghi ngày thu ở điểm cũ bằng ngày lắp ở đây. " +
                   "Lắp logger khác khi điểm đang có logger = thay logger (logger cũ thu về cùng ngày).");
            var ls = d.LapDatCuaDiem(diem.Id).ToList();
            if (ls.Count > 0)
            {
                var lich = Ui.MakeLabel(string.Join("\n", ls.Skip(Math.Max(0, ls.Count - 5)).Select(x =>
                {
                    ThietBiNl t = d.TimThietBi(x.ThietBiId);
                    return "• " + (t != null ? t.Ma : "#" + x.ThietBiId) + ": " + So.Ngay(x.TuNgay) + " → " + (x.DenNgay.HasValue ? So.Ngay(x.DenNgay) : "đang lắp");
                })), Ui.Small, Ui.Muted);
                lich.UseMnemonic = false;
                Dong("Các lần lắp" + (ls.Count > 5 ? " (5 gần nhất)" : ""), lich);
            }
            NapThietBi(null);
        }

        void NapThietBi(ThietBiNl chon)
        {
            cboTb.Items.Clear();
            cboTb.Items.Add(new MucTb());
            foreach (ThietBiNl t in d.ThietBi.Where(x => !x.Hong).OrderBy(x => d.DangLapCuaThietBi(x.Id) != null).ThenBy(x => x.Ma))
            {
                LapDatNl o = d.DangLapCuaThietBi(t.Id);
                if (o != null && o.DiemId == diem.Id) continue;
                cboTb.Items.Add(new MucTb { Tb = t, DangO = o, D = d });
            }
            MucTb m = cboTb.Items.Cast<MucTb>().FirstOrDefault(x => x.Tb != null && x.Tb == chon);
            cboTb.SelectedItem = m ?? cboTb.Items[0];
            cboTb.DropDownWidth = Math.Max(cboTb.Width, Ui.S(560));
        }

        void ThemThietBi()
        {
            using (var f = new ThietBiNlForm(d, null))
            {
                if (f.ShowDialog(this) != DialogResult.OK) return;
                var t = new ThietBiNl { Id = d.CapId() };
                f.GhiVao(t);
                d.ThietBi.Add(t);
                DaThemThietBi = true;
                NapThietBi(t);
            }
        }

        MucTb Chon { get { return cboTb.SelectedItem as MucTb; } }

        protected override bool KiemTra()
        {
            MucTb m = Chon;
            bool thu = chkThu != null && chkThu.Checked;
            if (!thu && (m == null || m.Tb == null))
            {
                Ui.Error(this, dangLap != null ? "Chọn \"Thu logger này về ngày\" hoặc chọn logger để lắp thay." : "Chọn logger để lắp vào điểm này.");
                return false;
            }
            if (thu && dtThu.Value.Date < dangLap.TuNgay.Date)
            {
                Ui.Error(this, "Ngày thu phải từ ngày lắp (" + So.Ngay(dangLap.TuNgay) + ") trở đi.");
                return false;
            }
            if (m != null && m.Tb != null)
            {
                DateTime ngay = dtLap.Value.Date;
                if (m.DangO != null && ngay < m.DangO.TuNgay.Date)
                {
                    Ui.Error(this, "Logger " + m.Tb.Ma + " lắp ở điểm cũ từ " + So.Ngay(m.DangO.TuNgay) + " — ngày chuyển sang đây phải từ ngày đó trở đi.");
                    return false;
                }
                if (dangLap != null && !thu && ngay < dangLap.TuNgay.Date)
                {
                    Ui.Error(this, "Ngày lắp logger thay phải từ ngày lắp logger đang có (" + So.Ngay(dangLap.TuNgay) + ") trở đi.");
                    return false;
                }
                LapDatNl trung = d.LapDat.FirstOrDefault(x => x.ThietBiId == m.Tb.Id && !x.DangLap && x.DenNgay.Value.Date > ngay && x.TuNgay.Date <= ngay);
                if (trung != null)
                {
                    DiemNl p = d.TimDiem(trung.DiemId);
                    Ui.Error(this, "Logger " + m.Tb.Ma + " đã ghi lắp ở " + (p != null ? p.Ten : "điểm khác") + " đến " + So.Ngay(trung.DenNgay) + " — chọn ngày lắp sau ngày đó.");
                    return false;
                }
            }
            return true;
        }

        /// <summary>Ghi thay đổi vào dữ liệu; trả lời mô tả ngắn.</summary>
        public string ApDung()
        {
            var parts = new List<string>();
            MucTb m = Chon;
            DateTime ngayLap = dtLap.Value.Date;
            if (dangLap != null)
            {
                if (chkThu.Checked)
                {
                    dangLap.DenNgay = dtThu.Value.Date;
                    parts.Add("thu logger về ngày " + So.Ngay(dangLap.DenNgay));
                }
                else if (m != null && m.Tb != null)
                {
                    dangLap.DenNgay = ngayLap;
                    parts.Add("thu logger cũ ngày " + So.Ngay(ngayLap));
                }
            }
            if (m != null && m.Tb != null)
            {
                if (m.DangO != null)
                {
                    m.DangO.DenNgay = ngayLap;
                    DiemNl cu = d.TimDiem(m.DangO.DiemId);
                    parts.Add("chuyển logger " + m.Tb.Ma + " từ " + (cu != null ? cu.Ten : "điểm cũ"));
                }
                else parts.Add("lắp logger " + m.Tb.Ma);
                d.LapDat.Add(new LapDatNl { Id = d.CapId(), ThietBiId = m.Tb.Id, DiemId = diem.Id, TuNgay = ngayLap, GhiChu = NhapExcel.ChuanHoa(txtGhiChu.Text) });
                parts[parts.Count - 1] += " từ ngày " + So.Ngay(ngayLap);
            }
            string s = string.Join(", ", parts);
            return s.Length > 0 ? char.ToUpper(s[0]) + s.Substring(1) : s;
        }
    }

    /// <summary>Thêm / sửa ca rò rỉ.</summary>
    class RoRiNlForm : HopThoaiCap1
    {
        class MucDiem
        {
            public DiemNl Diem;
            public string DonVi;
            public override string ToString() { return Diem.Ten + (DonVi.Length > 0 ? "   (" + DonVi + ")" : ""); }
        }

        readonly ComboBox cboDiem, cboTrangThai, cboHangMuc;
        readonly DateTimePicker dtPhatHien, dtSua;
        readonly TextBox txtViTri, txtLuuLuong, txtGhiChu;
        readonly Label lblTietKiem;
        double? luuLuong;

        public RoRiNlForm(DuLieu dl, RoRiNl r, DiemNl diemMacDinh, DateTime ngayMacDinh)
            : base(r == null ? "Thêm ca rò rỉ" : "Sửa ca rò rỉ", 760, 430)
        {
            DuLieuNl d = dl.Nl;
            cboDiem = Ui.MakeCombo(460);
            DiemNl chon = r != null ? d.TimDiem(r.DiemId) : diemMacDinh;
            foreach (DiemNl p in d.Diem.Where(x => !x.Ngung || x == chon))
                cboDiem.Items.Add(new MucDiem { Diem = p, DonVi = DonViNlOps.Ten(dl, p.DonViId) });
            foreach (MucDiem m in cboDiem.Items) if (m.Diem == chon) cboDiem.SelectedItem = m;
            cboDiem.DropDownWidth = Math.Max(cboDiem.Width, Ui.S(560));
            Dong("Điểm logger báo", cboDiem);
            dtPhatHien = Ui.MakeDatePicker(false);
            dtPhatHien.Value = r != null ? r.NgayPhatHien : ngayMacDinh;
            Dong("Ngày phát hiện", dtPhatHien);
            cboTrangThai = Ui.MakeCombo(240);
            foreach (TrangThaiRoRi t in Enum.GetValues(typeof(TrangThaiRoRi))) cboTrangThai.Items.Add(DuLieuNl.TenTrangThai(t));
            cboTrangThai.SelectedIndex = (int)(r != null ? r.TrangThai : TrangThaiRoRi.ChoDoTim);
            Dong("Trạng thái", cboTrangThai);
            txtViTri = O(460, r != null ? r.ViTri : "", "vd trước số nhà 125 đường 3/2, cách van 40 m");
            Dong("Vị trí rò (sau khi dò)", txtViTri);
            cboHangMuc = new ComboBox { Font = Ui.Base, Width = Ui.S(300), DropDownStyle = ComboBoxStyle.DropDown };
            cboHangMuc.Items.AddRange(DuLieuNl.GoiYHangMuc);
            cboHangMuc.Text = r != null ? r.HangMuc : "";
            Dong("Hạng mục rò", cboHangMuc);
            dtSua = Ui.MakeDatePicker(true);
            if (r != null && r.NgaySua.HasValue) { dtSua.Value = r.NgaySua.Value; dtSua.Checked = true; }
            else { dtSua.Value = DateTime.Today; dtSua.Checked = false; }
            Dong("Ngày sửa xong", dtSua);
            txtLuuLuong = O(110, So.Nhap(r != null ? r.LuuLuong : null), "m³/h");
            lblTietKiem = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            txtLuuLuong.TextChanged += (s, e) => CapNhatTietKiem();
            Dong("Lưu lượng rò ước tính", Hang(txtLuuLuong, Ui.MakeLabel("m³/h", Ui.Base, Ui.Text), lblTietKiem));
            txtGhiChu = O(460, r != null ? r.GhiChu : "", "người dò, thiết bị dò, vật tư sửa…");
            Dong("Ghi chú", txtGhiChu);
            cboTrangThai.SelectedIndexChanged += (s, e) =>
            {
                if (cboTrangThai.SelectedIndex == (int)TrangThaiRoRi.DaSua && !dtSua.Checked) { dtSua.Value = DateTime.Today; dtSua.Checked = true; }
                CapNhatTietKiem();
            };
            dtSua.ValueChanged += (s, e) =>
            {
                if (dtSua.Checked && cboTrangThai.SelectedIndex != (int)TrangThaiRoRi.DaSua) cboTrangThai.SelectedIndex = (int)TrangThaiRoRi.DaSua;
            };
            CapNhatTietKiem();
            Shown += (s, e) => (cboDiem.SelectedItem == null ? (Control)cboDiem : txtViTri).Focus();
        }

        void CapNhatTietKiem()
        {
            double? v;
            if (!So.TryDoc(txtLuuLuong.Text, out v) || !v.HasValue) { lblTietKiem.Text = ""; return; }
            lblTietKiem.Text = "≈ " + So.M3(v.Value * 24 * 30) + " m³/tháng" + (cboTrangThai.SelectedIndex == (int)TrangThaiRoRi.DaSua ? " tiết kiệm được" : " đang mất");
        }

        protected override bool KiemTra()
        {
            if (!(cboDiem.SelectedItem is MucDiem)) { Ui.Error(this, "Chọn điểm logger báo rò."); cboDiem.Focus(); return false; }
            if (!DocSo(txtLuuLuong, "Lưu lượng rò", out luuLuong)) return false;
            if (luuLuong.HasValue && luuLuong.Value < 0) { Ui.Error(this, "Lưu lượng rò không âm."); txtLuuLuong.Focus(); return false; }
            var tt = (TrangThaiRoRi)cboTrangThai.SelectedIndex;
            if (tt == TrangThaiRoRi.DaSua && !dtSua.Checked) { Ui.Error(this, "Đã sửa: chọn ngày sửa xong."); dtSua.Focus(); return false; }
            if (dtSua.Checked && dtSua.Value.Date < dtPhatHien.Value.Date) { Ui.Error(this, "Ngày sửa phải từ ngày phát hiện trở đi."); dtSua.Focus(); return false; }
            return true;
        }

        public void GhiVao(RoRiNl x)
        {
            x.DiemId = ((MucDiem)cboDiem.SelectedItem).Diem.Id;
            x.NgayPhatHien = dtPhatHien.Value.Date;
            x.TrangThai = (TrangThaiRoRi)cboTrangThai.SelectedIndex;
            x.ViTri = NhapExcel.ChuanHoa(txtViTri.Text);
            x.HangMuc = NhapExcel.ChuanHoa(cboHangMuc.Text);
            x.NgaySua = dtSua.Checked && x.TrangThai == TrangThaiRoRi.DaSua ? dtSua.Value.Date : (DateTime?)null;
            x.LuuLuong = luuLuong;
            x.GhiChu = NhapExcel.ChuanHoa(txtGhiChu.Text);
        }
    }

    /// <summary>Ngưỡng phân loại tiếng ồn.</summary>
    class NguongNlForm : HopThoaiCap1
    {
        readonly TextBox txtRo, txtTheoDoi, txtTrai, txtTang;
        readonly NumericUpDown numDem;
        readonly NguongNl g;
        double? ro, theoDoi, trai, tang;

        public NguongNlForm(NguongNl g) : base("Ngưỡng phân tích tiếng ồn — noise logger", 820, 420)
        {
            this.g = g;
            GhiChu("Rò rỉ phát ra tiếng ồn đều, liên tục suốt đêm: mức ồn tối thiểu cao, độ trải (spread) nhỏ, lặp lại nhiều đêm. " +
                   "Mỗi hãng logger dùng thang số khác nhau — chỉnh theo hướng dẫn của hãng và kinh nghiệm các điểm đã dò thấy rò.");
            txtRo = O(80, So.Nhap(g.RoRi), null);
            Dong("Nghi rò rỉ khi mức ồn ≥", Hang(txtRo, Ui.MakeLabel("dB", Ui.Base, Ui.Text)));
            txtTrai = O(80, So.Nhap(g.DoTrai), null);
            Dong("… và độ trải ≤", Hang(txtTrai, Ui.MakeLabel("lớn hơn = tiếng ồn lúc có lúc không (dùng nước, bơm) → chỉ \"cần theo dõi\"", Ui.Small, Ui.Muted)));
            numDem = new NumericUpDown { Minimum = 1, Maximum = 7, Value = Math.Max(1, Math.Min(7, g.SoDem)), Width = Ui.S(60), Font = Ui.Base };
            Dong("… liên tiếp", Hang(numDem, Ui.MakeLabel("đêm (1 đêm vượt ngưỡng chưa đủ để kết luận)", Ui.Small, Ui.Muted)));
            txtTheoDoi = O(80, So.Nhap(g.TheoDoi), null);
            Dong("Cần theo dõi khi mức ồn ≥", Hang(txtTheoDoi, Ui.MakeLabel("dB", Ui.Base, Ui.Text)));
            txtTang = O(80, So.Nhap(g.Tang), null);
            Dong("… hoặc tăng so với mức nền ≥", Hang(txtTang, Ui.MakeLabel("dB (mức nền = trung vị 30 ngày trước tuần gần nhất — báo rò mới xuất hiện)", Ui.Small, Ui.Muted)));
            var bMacDinh = Ui.MakeButton("Về mặc định", false);
            bMacDinh.Click += (s, e) =>
            {
                txtRo.Text = So.Nhap(NguongNl.MacDinhRoRi);
                txtTrai.Text = So.Nhap(NguongNl.MacDinhDoTrai);
                numDem.Value = NguongNl.MacDinhSoDem;
                txtTheoDoi.Text = So.Nhap(NguongNl.MacDinhTheoDoi);
                txtTang.Text = So.Nhap(NguongNl.MacDinhTang);
            };
            Nut.Controls.Add(bMacDinh);
            bMacDinh.Margin = Ui.Pad(0, 0, 200, 0);
        }

        protected override bool KiemTra()
        {
            if (!DocSo(txtRo, "Ngưỡng nghi rò rỉ", out ro) || !DocSo(txtTrai, "Độ trải", out trai) ||
                !DocSo(txtTheoDoi, "Ngưỡng theo dõi", out theoDoi) || !DocSo(txtTang, "Mức tăng", out tang)) return false;
            if (!ro.HasValue || !trai.HasValue || !theoDoi.HasValue || !tang.HasValue) { Ui.Error(this, "Nhập đủ các ngưỡng."); return false; }
            if (theoDoi.Value > ro.Value) { Ui.Error(this, "Ngưỡng theo dõi phải nhỏ hơn hoặc bằng ngưỡng nghi rò rỉ."); txtTheoDoi.Focus(); return false; }
            return true;
        }

        public void GhiVao()
        {
            g.RoRi = ro.Value;
            g.DoTrai = trai.Value;
            g.SoDem = (int)numDem.Value;
            g.TheoDoi = theoDoi.Value;
            g.Tang = tang.Value;
        }
    }

    /// <summary>Nhập số đo từ file CSV / Excel xuất từ phần mềm của hãng logger.</summary>
    class NhapSoDoNlForm : Form
    {
        readonly PhienLam phien;
        readonly TextBox txtFile, txtKetQua;
        readonly ComboBox cboBang, cboTieuDe;
        readonly ComboBox[] cboCot = new ComboBox[NhapSoDoNl.SoTruong];
        readonly DataGridView xem;
        readonly CheckBox chkGhiDe;
        readonly Button btnNhap;
        List<NhapSoDoNl.Bang> bangs = new List<NhapSoDoNl.Bang>();
        NhapSoDoNl.KeHoach keHoach;
        bool dangNap;

        public DateTime? DenNgay { get; private set; }

        public NhapSoDoNlForm(PhienLam phien)
        {
            this.phien = phien;
            Text = "Nhập số đo noise logger từ file";
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(980), Ui.S(720));
            MinimumSize = new Size(Ui.S(820), Ui.S(600));
            MinimizeBox = false;
            ShowInTaskbar = false;
            BackColor = Ui.Surface;

            var top = new TableLayoutPanel { Dock = DockStyle.Top, AutoSize = true, ColumnCount = 4, Padding = Ui.Pad(16, 10, 16, 4) };
            top.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(150)));
            top.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(300)));
            top.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(150)));
            top.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            var huong = Ui.MakeLabel("File CSV / TXT / Excel (.xlsx) xuất từ phần mềm của hãng logger, mỗi dòng 1 đêm (hoặc 1 lần ghi) của 1 logger: mã logger (hoặc tên điểm), ngày, mức ồn, " +
                                     "độ trải, tần số. Số đo gán vào điểm logger đang lắp vào đêm đó (nút \"Lắp / thu logger…\"). Ngày của đêm = ngày buổi sáng; giờ ghi từ 12h trưa trở đi " +
                                     "tính cho đêm rạng sáng hôm sau. Nhiều lần ghi trong 1 đêm: mức ồn lấy số nhỏ nhất, độ trải = chênh lệch giữa các lần ghi.", Ui.Small, Ui.Muted);
            huong.MaximumSize = new Size(Ui.S(940), 0);
            huong.Margin = Ui.Pad(0, 0, 0, 8);
            top.Controls.Add(huong, 0, 0);
            top.SetColumnSpan(huong, 4);
            txtFile = new TextBox { Font = Ui.Base, ReadOnly = true, Width = Ui.S(640) };
            var bChon = Ui.MakeButton("Chọn file…", true);
            bChon.Click += (s, e) => ChonFile();
            var hangFile = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            hangFile.Controls.Add(txtFile);
            hangFile.Controls.Add(bChon);
            txtFile.Margin = Ui.Pad(0, 4, 8, 0);
            ThemO(top, 1, 0, "File", hangFile, 3);
            cboBang = Ui.MakeCombo(280);
            cboBang.SelectedIndexChanged += (s, e) => { if (!dangNap) ChonBang(); };
            ThemO(top, 2, 0, "Trang / bảng", cboBang, 1);
            cboTieuDe = Ui.MakeCombo(220);
            cboTieuDe.SelectedIndexChanged += (s, e) => { if (!dangNap) DoiTieuDe(); };
            ThemO(top, 2, 2, "Dòng tiêu đề", cboTieuDe, 1);
            for (int i = 0; i < NhapSoDoNl.SoTruong; i++)
            {
                cboCot[i] = Ui.MakeCombo(280);
                cboCot[i].SelectedIndexChanged += (s, e) => { if (!dangNap) KiemTra(); };
                ThemO(top, 3 + i / 2, (i % 2) * 2, NhapSoDoNl.TenTruong[i], cboCot[i], 1);
            }
            chkGhiDe = new CheckBox { Text = "Ghi đè số đo đã có của cùng điểm, cùng đêm", AutoSize = true, Checked = true };
            chkGhiDe.CheckedChanged += (s, e) => { if (Bang != null) KiemTra(); };
            ThemO(top, 7, 0, "", chkGhiDe, 3);

            xem = new DataGridView { Dock = DockStyle.Fill, ReadOnly = true };
            Ui.StyleGrid(xem);
            xem.ColumnHeadersHeight = Ui.S(30);
            xem.RowTemplate.Height = Ui.S(24);
            xem.DefaultCellStyle.Font = Ui.Small;
            var xemHost = new Panel { Dock = DockStyle.Fill, Padding = Ui.Pad(16, 4, 16, 4) };
            var khung = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            khung.Controls.Add(xem);
            xemHost.Controls.Add(khung);
            txtKetQua = new TextBox { Dock = DockStyle.Fill, Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Font = Ui.Small, BackColor = Ui.Computed };
            var kqHost = new Panel { Dock = DockStyle.Bottom, Height = Ui.S(150), Padding = Ui.Pad(16, 4, 16, 4) };
            kqHost.Controls.Add(txtKetQua);

            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var dong = Ui.MakeButton("Đóng", false);
            dong.DialogResult = DialogResult.Cancel;
            btnNhap = Ui.MakeButton("Nhập số đo", true);
            btnNhap.Enabled = false;
            btnNhap.Click += (s, e) => Nhap();
            var bMau = Ui.MakeButton("Lưu file mẫu…", false);
            bMau.Click += (s, e) => LuuFileMau();
            new ToolTip().SetToolTip(bMau, "File CSV mẫu (mở bằng Excel được) để tự ghi số đo khi phần mềm của hãng không xuất được file");
            buttons.Controls.Add(dong);
            buttons.Controls.Add(btnNhap);
            buttons.Controls.Add(bMau);
            bMau.Margin = Ui.Pad(0, 0, 200, 0);
            Controls.Add(xemHost);
            Controls.Add(kqHost);
            Controls.Add(top);
            Controls.Add(buttons);
            CancelButton = dong;
            txtKetQua.Text = "Chọn file số đo. Logger phải có trong danh mục (mục Thiết bị) và đã ghi lắp ở điểm nào, từ ngày nào.";
        }

        static void ThemO(TableLayoutPanel t, int r, int c, string nhan, Control o, int span)
        {
            while (t.RowStyles.Count <= r) t.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Ui.MakeLabel(nhan, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 8, 4);
            t.Controls.Add(l, c, r);
            o.Margin = Ui.Pad(0, 4, 12, 4);
            t.Controls.Add(o, c + 1, r);
            if (span > 1) t.SetColumnSpan(o, span);
        }

        void ChonFile()
        {
            using (var dlg = new OpenFileDialog())
            {
                dlg.Filter = "Số đo logger (*.csv;*.txt;*.xlsx)|*.csv;*.txt;*.tsv;*.xlsx;*.xlsm|Tất cả|*.*";
                dlg.Title = "Chọn file số đo noise logger";
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                MoFile(dlg.FileName);
            }
        }

        public void MoFile(string path)
        {
            txtFile.Text = path;
            bangs.Clear();
            XoaKetQua();
            try
            {
                Cursor = Cursors.WaitCursor;
                bangs = NhapSoDoNl.DocFile(path);
            }
            catch (Exception ex)
            {
                txtKetQua.Text = "Không đọc được file: " + ex.Message;
                return;
            }
            finally
            {
                Cursor = Cursors.Default;
            }
            dangNap = true;
            cboBang.Items.Clear();
            foreach (NhapSoDoNl.Bang b in bangs) cboBang.Items.Add(b);
            dangNap = false;
            if (bangs.Count == 0) { txtKetQua.Text = "File không có dữ liệu."; return; }
            // nhiều trang: chọn trang đoán được cột mức ồn
            int chon = 0;
            for (int i = 0; i < bangs.Count; i++)
                if (NhapSoDoNl.DoanCot(bangs[i])[NhapSoDoNl.Truong.MucOn] >= 0) { chon = i; break; }
            cboBang.SelectedIndex = chon;
        }

        NhapSoDoNl.Bang Bang { get { return cboBang.SelectedItem as NhapSoDoNl.Bang; } }

        void ChonBang()
        {
            NhapSoDoNl.Bang b = Bang;
            if (b == null) return;
            NhapSoDoNl.CotNhap cot = NhapSoDoNl.DoanCot(b);
            dangNap = true;
            cboTieuDe.Items.Clear();
            cboTieuDe.Items.Add("(không có — dữ liệu từ dòng 1)");
            for (int r = 0; r < Math.Min(20, b.Dong.Count); r++) cboTieuDe.Items.Add("Dòng " + (r + 1));
            cboTieuDe.SelectedIndex = cot.DongTieuDe + 1;
            dangNap = false;
            NapCot(cot);
        }

        void DoiTieuDe()
        {
            NhapSoDoNl.Bang b = Bang;
            if (b == null) return;
            var cot = new NhapSoDoNl.CotNhap { DongTieuDe = cboTieuDe.SelectedIndex - 1 };
            for (int i = 0; i < NhapSoDoNl.SoTruong; i++) cot.Cot[i] = cboCot[i].SelectedIndex - 1;
            NapCot(cot);
        }

        void NapCot(NhapSoDoNl.CotNhap cot)
        {
            NhapSoDoNl.Bang b = Bang;
            dangNap = true;
            int n = b.SoCot;
            for (int i = 0; i < NhapSoDoNl.SoTruong; i++)
            {
                ComboBox c = cboCot[i];
                c.Items.Clear();
                c.Items.Add("(không có)");
                for (int k = 0; k < n; k++)
                {
                    string h = cot.DongTieuDe >= 0 ? b.Chu(cot.DongTieuDe, k) : b.Chu(0, k);
                    if (h.Length > 30) h = h.Substring(0, 30) + "…";
                    c.Items.Add("Cột " + XlsxReader.TenCot(k + 1) + (h.Length > 0 ? ": " + h : ""));
                }
                c.SelectedIndex = Math.Min(c.Items.Count - 1, cot.Cot[i] + 1);
                c.DropDownWidth = Math.Max(c.Width, Ui.S(320));
            }
            dangNap = false;
            NapXem(cot.DongTieuDe);
            KiemTra();
        }

        void NapXem(int tieuDe)
        {
            NhapSoDoNl.Bang b = Bang;
            xem.Rows.Clear();
            xem.Columns.Clear();
            int n = Math.Min(b.SoCot, 40);
            for (int k = 0; k < n; k++)
            {
                string h = tieuDe >= 0 ? b.Chu(tieuDe, k) : "";
                xem.Columns.Add(Ui.Col(XlsxReader.TenCot(k + 1) + (h.Length > 0 ? ": " + h : ""), 120, false));
            }
            if (n == 0) return;
            int dau = tieuDe + 1;
            int soDong = Math.Min(b.Dong.Count - dau, 200);
            for (int r = 0; r < soDong; r++)
            {
                var vals = new object[n];
                for (int k = 0; k < n; k++)
                {
                    object o = b.O(dau + r, k);
                    vals[k] = o is double ? So.Nhap((double)o) : (o != null ? Convert.ToString(o) : "");
                }
                xem.Rows.Add(vals);
            }
        }

        NhapSoDoNl.CotNhap CotDangChon()
        {
            var cot = new NhapSoDoNl.CotNhap { DongTieuDe = cboTieuDe.SelectedIndex - 1 };
            for (int i = 0; i < NhapSoDoNl.SoTruong; i++) cot.Cot[i] = cboCot[i].SelectedIndex - 1;
            return cot;
        }

        void XoaKetQua()
        {
            keHoach = null;
            btnNhap.Enabled = false;
        }

        void KiemTra()
        {
            NhapSoDoNl.Bang b = Bang;
            if (b == null) return;
            keHoach = NhapSoDoNl.LapKeHoach(b, CotDangChon(), phien.Dl.Nl, chkGhiDe.Checked);
            var lines = new List<string>();
            lines.Add("Đọc " + keHoach.SoDongDoc + " dòng số đo" + (keHoach.SoDongBo > 0 ? ", bỏ qua " + keHoach.SoDongBo + " dòng" : "") + ".");
            if (keHoach.SoDo.Count > 0)
                lines.Add("Sẽ nhập " + keHoach.SoDo.Count + " đêm-điểm của " + keHoach.SoDiem + " điểm, từ đêm " + So.Ngay(keHoach.Tu) + " đến " + So.Ngay(keHoach.Den) +
                          ": " + keHoach.SoMoi + " mới" + (keHoach.SoThay > 0 ? ", " + keHoach.SoThay + " thay số cũ" : "") + ". Kiểm tra các cột đã chọn rồi bấm \"Nhập số đo\".");
            else lines.Add("Không có số đo nào nhập được — kiểm tra lại các cột đã chọn ở trên.");
            lines.AddRange(keHoach.ThongBao.Select(x => "• " + x));
            txtKetQua.Text = string.Join("\r\n", lines);
            btnNhap.Enabled = keHoach.SoDo.Count > 0;
        }

        /// <summary>File CSV mẫu: các logger đang lắp, đêm hôm nay, cột như phần mềm đọc được.</summary>
        void LuuFileMau()
        {
            using (var dlg = new SaveFileDialog())
            {
                dlg.Filter = "CSV (*.csv)|*.csv";
                dlg.FileName = "mau-so-do-noise-logger.csv";
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                DuLieuNl d = phien.Dl.Nl;
                var sb = new System.Text.StringBuilder();
                sb.Append("sep=;\r\n");
                sb.Append("Mã logger;Ngày;Giờ;Mức ồn (dB);Độ trải;Tần số (Hz);Ghi chú\r\n");
                var dang = d.ThietBi.Where(t => d.DangLapCuaThietBi(t.Id) != null).Take(5).ToList();
                string ngay = DateTime.Today.ToString("dd/MM/yyyy");
                if (dang.Count == 0) sb.Append("22-1001;" + ngay + ";02:00;32,5;4,2;620;ví dụ — xoá dòng này\r\n");
                foreach (ThietBiNl t in dang)
                {
                    DiemNl p = d.TimDiem(d.DangLapCuaThietBi(t.Id).DiemId);
                    sb.Append(t.Ma + ";" + ngay + ";02:00;;;;" + (p != null ? p.Ten.Replace(";", ",") : "") + "\r\n");
                }
                try
                {
                    File.WriteAllText(dlg.FileName, sb.ToString(), new System.Text.UTF8Encoding(true));
                }
                catch (Exception ex)
                {
                    Ui.Error(this, "Không lưu được file: " + ex.Message);
                    return;
                }
                Ui.OpenFile(this, dlg.FileName);
            }
        }

        void Nhap()
        {
            if (keHoach == null || keHoach.SoDo.Count == 0) return;
            try { phien.Kho.SaoLuuNgay(); } catch (Exception) { }
            NhapSoDoNl.ApDung(keHoach, phien.Dl.Nl);
            DenNgay = keHoach.Den;
            phien.Luu(this);
            txtKetQua.Text = "Đã nhập " + keHoach.SoDo.Count + " đêm-điểm (" + keHoach.SoDiem + " điểm, đêm " + So.Ngay(keHoach.Tu) + " – " + So.Ngay(keHoach.Den) + "). " +
                             "Bản dữ liệu trước khi nhập được sao lưu trong thư mục SaoLuu." + (keHoach.ThongBao.Count > 0 ? "\r\n" : "") +
                             string.Join("\r\n", keHoach.ThongBao.Select(x => "• " + x));
            keHoach = null;
            btnNhap.Enabled = false;
        }
    }
}
