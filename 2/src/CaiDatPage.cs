using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Thông tin công ty, người ký mặc định, dữ liệu / sao lưu, nhập từ Excel.</summary>
    public class CaiDatPage : UserControl, ITrang
    {
        readonly PhienLam phien;
        readonly TextBox txtCty1, txtCty2, txtDiaDanh, txtNguong;
        readonly TextBox[,] ky = new TextBox[3, 3];
        readonly Label lblThuMuc, lblMayChu, lblNguoiDung;
        readonly Button bKetNoi, bTaiKhoan, bNgat, bNguoiDung, bDoiNguoi;
        public event EventHandler MoKeHoach;

        public CaiDatPage(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;
            var scroll = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true };
            Label sub;
            Controls.Add(scroll);
            Controls.Add(Ui.PageHeader("Cài đặt", "Thông tin in trên báo cáo, dữ liệu và sao lưu.", out sub));

            // ---- dữ liệu
            var cData = Card(scroll, "Dữ liệu", 168);
            lblThuMuc = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblThuMuc.AutoSize = false;
            lblThuMuc.Size = new Size(Ui.S(846), Ui.S(64));
            lblThuMuc.Location = new Point(Ui.S(16), Ui.S(40));
            cData.Controls.Add(lblThuMuc);
            var lineData = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Location = new Point(Ui.S(14), Ui.S(112)) };
            var bNhap = Ui.MakeButton("Nhập từ file Excel báo cáo…", true);
            bNhap.Click += (s, e) => NhapTuExcel();
            var bMo = QuyenUi.ChoXem(Ui.MakeButton("Mở thư mục dữ liệu", false));
            bMo.Click += (s, e) => { try { Process.Start("explorer.exe", phien.Kho.ThuMuc); } catch (Exception ex) { Ui.Error(this, ex.Message); } };
            var bSaoLuu = Ui.MakeButton("Sao lưu ngay", false);
            bSaoLuu.Click += (s, e) =>
            {
                try { Ui.Info(this, "Đã sao lưu:\n" + phien.Kho.SaoLuuNgay()); }
                catch (Exception ex) { Ui.Error(this, "Không sao lưu được: " + ex.Message); }
            };
            lineData.Controls.Add(bNhap);
            lineData.Controls.Add(bMo);
            lineData.Controls.Add(bSaoLuu);
            cData.Controls.Add(lineData);

            // ---- máy chủ dữ liệu IIS
            var cMc = Card(scroll, "Máy chủ dữ liệu (website HTTP trên IIS) — dùng chung với trình duyệt, điện thoại, máy tính khác", 176);
            lblMayChu = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblMayChu.AutoSize = false;
            lblMayChu.UseMnemonic = false;
            lblMayChu.Size = new Size(Ui.S(846), Ui.S(72));
            lblMayChu.Location = new Point(Ui.S(16), Ui.S(40));
            cMc.Controls.Add(lblMayChu);
            var lineMc = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Location = new Point(Ui.S(14), Ui.S(120)) };
            bKetNoi = QuyenUi.ChoXem(Ui.MakeButton("Kết nối máy chủ…", true));
            bKetNoi.Click += (s, e) => { KetNoiMayChuForm.Mo(this, phien); KhiHien(); };
            bTaiKhoan = Ui.MakeButton("Tài khoản người dùng (máy tính, điện thoại)…", false);
            bTaiKhoan.Click += (s, e) => { if (phien.DongBo != null) using (var f = new TaiKhoanMayChuForm(phien.DongBo.Kn)) f.ShowDialog(FindForm()); };
            bNgat = Ui.MakeButton("Ngắt kết nối", false);
            bNgat.Click += (s, e) => NgatMayChu();
            var bGoi = Ui.MakeButton("Tạo gói cài IIS…", false);
            bGoi.Click += (s, e) => GoiIIS.Tao(this);
            foreach (Button b in new[] { bKetNoi, bTaiKhoan, bNgat, bGoi }) lineMc.Controls.Add(b);
            cMc.Controls.Add(lineMc);
            phien.DoiDongBo += (s, e) =>
            {
                if (phien.DongBo != null) phien.DongBo.DoiTrangThai += (s2, e2) => { if (Visible && s2 == phien.DongBo) CapNhatMayChu(); };
                if (Visible) KhiHien();
            };

            // ---- người dùng: Admin toàn quyền, người dùng chỉ xem
            var cNd = Card(scroll, "Người dùng — Admin toàn quyền, người dùng chỉ xem", 150);
            lblNguoiDung = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblNguoiDung.AutoSize = false;
            lblNguoiDung.UseMnemonic = false;
            lblNguoiDung.Size = new Size(Ui.S(846), Ui.S(52));
            lblNguoiDung.Location = new Point(Ui.S(16), Ui.S(40));
            cNd.Controls.Add(lblNguoiDung);
            var lineNd = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Location = new Point(Ui.S(14), Ui.S(96)) };
            bNguoiDung = Ui.MakeButton("Người dùng…", true);
            bNguoiDung.Click += (s, e) => QuanLyNguoiDung();
            bDoiNguoi = QuyenUi.ChoXem(Ui.MakeButton("Đổi người dùng / đăng xuất", false));
            bDoiNguoi.Click += (s, e) => DoiNguoiDung();
            lineNd.Controls.Add(bNguoiDung);
            lineNd.Controls.Add(bDoiNguoi);
            cNd.Controls.Add(lineNd);

            // ---- công ty
            var cCty = Card(scroll, "Thông tin in trên báo cáo", 300);
            txtCty1 = Field(cCty, "Tên công ty (dòng 1)", 60, 300);
            txtCty2 = Field(cCty, "Tên công ty (dòng 2)", 96, 300);
            txtDiaDanh = Field(cCty, "Địa danh ghi ngày lập", 132, 200);
            txtNguong = Field(cCty, "Nhắc khi sản lượng TLK tăng / giảm quá (%)", 168, 80);
            var lk = Ui.MakeLabel("Người ký mặc định cho tháng mới (chức vụ dòng 1 · dòng 2 · họ tên):", Ui.Base, Ui.Text);
            lk.Location = new Point(Ui.S(16), Ui.S(206));
            cCty.Controls.Add(lk);
            // 3 cột người ký (trái, giữa, phải), mỗi cột: chức vụ dòng 1, dòng 2, họ tên.
            var kyBox = new TableLayoutPanel { Location = new Point(Ui.S(16), Ui.S(232)), AutoSize = true, ColumnCount = 3, RowCount = 3 };
            for (int i = 0; i < 3; i++)
                for (int j = 0; j < 3; j++)
                {
                    var t = Ui.MakeText(250);
                    t.Margin = Ui.Pad(0, 0, 12, 4);
                    ky[i, j] = t;
                    kyBox.Controls.Add(t, i, j);
                }
            cCty.Controls.Add(kyBox);
            var bLuuCty = Ui.MakeButton("Lưu thông tin", true);
            bLuuCty.Location = new Point(Ui.S(16), Ui.S(336));
            bLuuCty.Click += (s, e) => LuuCongTy();
            cCty.Controls.Add(bLuuCty);
            cCty.Height = Ui.S(388);

            // ---- kế hoạch: đã chuyển sang trang riêng
            var cKh = Card(scroll, "Kế hoạch tỷ lệ thất thoát năm", 112);
            var lineKh = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Location = new Point(Ui.S(14), Ui.S(50)) };
            var bKh = QuyenUi.ChoXem(Ui.MakeButton("Mở trang Kế hoạch năm", true));
            bKh.Click += (s, e) => { if (MoKeHoach != null) MoKeHoach(this, EventArgs.Empty); };
            lineKh.Controls.Add(bKh);
            var hint = Ui.MakeLabel("Nhập kế hoạch từng năm ở trang \"Kế hoạch năm\" trên thanh menu (Ctrl+4).", Ui.Small, Ui.Muted);
            hint.Margin = Ui.Pad(8, 9, 0, 0);
            lineKh.Controls.Add(hint);
            cKh.Controls.Add(lineKh);

            phien.DaDoi += (s, e) => { if (Visible && s != this) KhiHien(); };
        }

        static Panel Card(FlowLayoutPanel parent, string title, int height)
        {
            var card = Ui.MakeCard();
            card.Width = Ui.S(880);
            card.Height = Ui.S(height);
            card.Margin = Ui.Pad(0, 0, 0, 12);
            var t = Ui.MakeLabel(title, Ui.Section, Ui.Text);
            t.Location = new Point(Ui.S(16), Ui.S(12));
            card.Controls.Add(t);
            parent.Controls.Add(card);
            return card;
        }

        static TextBox Field(Panel card, string label, int y, int width)
        {
            var l = Ui.MakeLabel(label, Ui.Base, Ui.Text);
            l.Location = new Point(Ui.S(16), Ui.S(y + 3));
            card.Controls.Add(l);
            var t = Ui.MakeText(width);
            t.Location = new Point(Ui.S(330), Ui.S(y));
            card.Controls.Add(t);
            return t;
        }

        public void KhiHien()
        {
            CaiDat cd = phien.Dl.CaiDat;
            txtCty1.Text = cd.TenCongTy1;
            txtCty2.Text = cd.TenCongTy2;
            txtDiaDanh.Text = cd.DiaDanh;
            txtNguong.Text = So.Nhap(cd.NguongCanhBao);
            for (int i = 0; i < 3; i++)
            {
                ky[i, 0].Text = cd.KyMacDinh[i].Dong1;
                ky[i, 1].Text = cd.KyMacDinh[i].Dong2;
                ky[i, 2].Text = cd.KyMacDinh[i].Ten;
            }
            DongBoMayChu d = phien.DongBo;
            lblThuMuc.Text = d != null
                ? "Dữ liệu chính nằm trên máy chủ " + d.Kn.GocUrl + " . Bản đệm trên máy này: " + phien.Kho.DuongDan + "\n" + phien.Dl.Thang.Count +
                  " tháng số liệu. Mỗi lần sửa tự lưu và gửi lên máy chủ; máy chủ tự sao lưu mỗi ngày."
                : "File dữ liệu: " + phien.Kho.DuongDan + "\n" + phien.Dl.Thang.Count + " tháng số liệu. Mỗi lần sửa đều tự lưu; mỗi ngày giữ 1 bản sao lưu " +
                  "trong thư mục SaoLuu (90 ngày gần nhất). Chép cả thư mục phần mềm sang máy khác là mang theo đủ dữ liệu.";
            CapNhatMayChu();
            CapNhatNguoiDung();
        }

        void CapNhatMayChu()
        {
            DongBoMayChu d = phien.DongBo;
            if (d == null)
            {
                lblMayChu.Text = "Đang dùng dữ liệu trên máy này (chưa có máy chủ).\nĐể trình duyệt, điện thoại và máy tính khác dùng chung (website HTTP cổng 80, không cần ZeroTier): bấm \"Tạo gói cài IIS…\", " +
                                 "chép gói sang máy chủ IIS và chạy CaiDat-IIS.bat, rồi bấm \"Kết nối máy chủ…\" và đưa dữ liệu trên máy này lên.";
                bKetNoi.Text = "Kết nối máy chủ…";
            }
            else
            {
                MayChuKetNoi kn = d.Kn;
                lblMayChu.Text = "Đang dùng dữ liệu trên máy chủ  " + kn.GocUrl + "   ·   tài khoản " + kn.Ten + (kn.LaQuanTri ? " (quản trị)" : "") +
                                 "\nTrạng thái: " + d.TrangThai +
                                 "\nTrình duyệt / điện thoại: mở địa chỉ trên (hoặc app Android), đăng nhập bằng tài khoản tạo ở \"Tài khoản người dùng…\" hoặc thẻ Quản trị trên web.";
                bKetNoi.Text = d.CanDangNhap ? "Đăng nhập lại…" : "Kết nối lại / đổi máy chủ…";
            }
            bTaiKhoan.Enabled = d != null && d.Kn.LaQuanTri;
            bNgat.Enabled = d != null;
        }

        void CapNhatNguoiDung()
        {
            DongBoMayChu d = phien.DongBo;
            string quyen = phien.ChiXem ? "chỉ xem (không sửa được số liệu)" : "Admin (toàn quyền)";
            if (d != null)
            {
                lblNguoiDung.Text = "Đang đăng nhập máy chủ bằng tài khoản " + phien.NguoiDung + " — " + quyen + ".\n" +
                                    "Khi đã nối máy chủ, người dùng là tài khoản trên máy chủ (dùng chung cho máy tính và điện thoại): " +
                                    "Admin quản lý ở \"Tài khoản người dùng…\" (thẻ Máy chủ dữ liệu).";
                bNguoiDung.Enabled = !phien.ChiXem && d.Kn.LaQuanTri;
                bNguoiDung.Text = "Tài khoản trên máy chủ…";
                bDoiNguoi.Enabled = true;
                return;
            }
            DanhSachNguoiDung ds = DanhSachNguoiDung.Doc(phien.Kho.ThuMuc);
            if (!ds.Co)
                lblNguoiDung.Text = "Chưa đặt người dùng: ai mở phần mềm cũng có toàn quyền.\nBấm \"Người dùng…\" để tạo tài khoản Admin (toàn quyền) và tài khoản chỉ xem cho người khác — từ đó mở phần mềm phải đăng nhập.";
            else if (phien.NguoiDung.Length == 0)
                lblNguoiDung.Text = "Đã có " + ds.Ds.Count + " người dùng. Phiên này mở trước khi đặt người dùng (toàn quyền); lần mở sau phải đăng nhập.";
            else
                lblNguoiDung.Text = "Đang đăng nhập: " + phien.NguoiDung + " — " + quyen + ".\n" + ds.Ds.Count(x => x.Admin) + " Admin, " +
                                    ds.Ds.Count(x => !x.Admin) + " người dùng chỉ xem. Admin thêm / sửa / xoá người dùng ở \"Người dùng…\".";
            bNguoiDung.Text = "Người dùng…";
            bNguoiDung.Enabled = !phien.ChiXem;
            bDoiNguoi.Enabled = ds.Co;
        }

        void QuanLyNguoiDung()
        {
            if (phien.ChiXem) return;
            if (phien.DongBo != null)
            {
                using (var f = new TaiKhoanMayChuForm(phien.DongBo.Kn)) f.ShowDialog(FindForm());
                return;
            }
            using (var f = new NguoiDungForm(phien.Kho.ThuMuc, phien.NguoiDung)) f.ShowDialog(FindForm());
            CapNhatNguoiDung();
        }

        void DoiNguoiDung()
        {
            if (!Ui.Confirm(this, "Đăng xuất và mở lại phần mềm để đăng nhập người dùng khác?")) return;
            DongBoMayChu d = phien.DongBo;
            if (d != null)
            {
                FindForm().Cursor = Cursors.WaitCursor;
                if (d.CoThayDoiChuaGui && !d.CanDangNhap) d.GuiNgay(10000);
                d.Kn.DangXuat();
                try { d.Kn.Ghi(phien.Kho.ThuMuc); } catch (Exception) { }
                FindForm().Cursor = Cursors.Default;
            }
            KhoiDongLai.Chay();
        }

        void NgatMayChu()
        {
            DongBoMayChu d = phien.DongBo;
            if (d == null) return;
            if (!Ui.Confirm(this, "Ngắt kết nối máy chủ " + d.Kn.GocUrl + " ?\n\nPhần mềm sẽ dùng bản dữ liệu hiện có trên máy này (không gửi lên máy chủ nữa). " +
                                  "Điện thoại vẫn dùng dữ liệu trên máy chủ như cũ." + (d.CoThayDoiChuaGui ? "\n\nLưu ý: còn thay đổi CHƯA gửi lên máy chủ." : ""))) return;
            d.Kn.DangXuat();
            try { MayChuKetNoi.Xoa(phien.Kho.ThuMuc); } catch (Exception) { }
            phien.DatDongBo(null);
            KhiHien();
        }

        void LuuCongTy()
        {
            double? nguong;
            if (!So.TryDoc(txtNguong.Text, out nguong) || !nguong.HasValue || nguong <= 0)
            {
                Ui.Error(this, "Ngưỡng nhắc phải là số > 0.");
                return;
            }
            CaiDat cd = phien.Dl.CaiDat;
            cd.TenCongTy1 = txtCty1.Text.Trim();
            cd.TenCongTy2 = txtCty2.Text.Trim();
            cd.DiaDanh = txtDiaDanh.Text.Trim();
            cd.NguongCanhBao = nguong.Value;
            for (int i = 0; i < 3; i++) cd.KyMacDinh[i] = new NguoiKy(ky[i, 0].Text.Trim(), ky[i, 1].Text.Trim(), ky[i, 2].Text.Trim());
            phien.Luu(this);
            Ui.Info(this, "Đã lưu. Người ký của từng tháng đã tạo sửa ở \"Thông tin kỳ báo cáo\" trên trang Nhập số liệu.");
        }

        public void NhapTuExcel()
        {
            using (var f = new NhapExcelForm(phien))
                f.ShowDialog(FindForm());
        }
    }

    /// <summary>Chọn file Excel báo cáo cũ, chọn các trang tháng để nhập, báo kết quả đối chiếu.</summary>
    class NhapExcelForm : Form
    {
        readonly PhienLam phien;
        readonly TextBox txtFile;
        readonly CheckedListBox lst;
        readonly TextBox txtKetQua;
        readonly Button btnNhap;
        List<TrangXls> book;
        List<TrangThang> trang = new List<TrangThang>();
        List<NhapExcel.TrangKeHoach> keHoach = new List<NhapExcel.TrangKeHoach>();
        List<NhapExcel.TrangTongHop> tongHop = new List<NhapExcel.TrangTongHop>();

        public NhapExcelForm(PhienLam phien)
        {
            this.phien = phien;
            Text = "Nhập số liệu từ file Excel báo cáo thất thoát";
            Font = Ui.Base;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(820), Ui.S(640));
            MinimizeBox = false;
            BackColor = Ui.Surface;

            var top = new Panel { Dock = DockStyle.Top, Height = Ui.S(120), Padding = Ui.Pad(16, 12, 16, 0) };
            var l = Ui.MakeLabel("File Excel (.xlsx) có các trang \"Tháng 1-2026\", \"Tháng 2-2026\"… theo mẫu báo cáo tỷ lệ thất thoát. " +
                                 "File cũ dạng .xls: mở bằng Excel rồi Lưu thành .xlsx trước.", Ui.Small, Ui.Muted);
            l.MaximumSize = new Size(Ui.S(780), 0);
            l.Location = new Point(Ui.S(16), Ui.S(10));
            top.Controls.Add(l);
            txtFile = new TextBox { Font = Ui.Base, ReadOnly = true, Location = new Point(Ui.S(16), Ui.S(56)), Width = Ui.S(640) };
            top.Controls.Add(txtFile);
            var bChon = Ui.MakeButton("Chọn file…", false);
            bChon.Location = new Point(Ui.S(668), Ui.S(52));
            bChon.Click += (s, e) => ChonFile();
            top.Controls.Add(bChon);
            var l2 = Ui.MakeLabel("Các trang tháng tìm thấy (tháng đã có trong phần mềm sẽ được thay bằng số liệu trong file):", Ui.Base, Ui.Text);
            l2.Location = new Point(Ui.S(16), Ui.S(94));
            top.Controls.Add(l2);

            lst = new CheckedListBox { Dock = DockStyle.Top, Height = Ui.S(200), CheckOnClick = true, Font = Ui.Base, IntegralHeight = false };
            var lstHost = new Panel { Dock = DockStyle.Top, Height = Ui.S(208), Padding = Ui.Pad(16, 4, 16, 4) };
            lstHost.Controls.Add(lst);

            txtKetQua = new TextBox { Dock = DockStyle.Fill, Multiline = true, ReadOnly = true, ScrollBars = ScrollBars.Vertical, Font = Ui.Small, BackColor = Ui.Computed };
            var kqHost = new Panel { Dock = DockStyle.Fill, Padding = Ui.Pad(16, 4, 16, 4) };
            kqHost.Controls.Add(txtKetQua);

            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var dong = Ui.MakeButton("Đóng", false);
            dong.DialogResult = DialogResult.Cancel;
            btnNhap = Ui.MakeButton("Nhập các tháng đã chọn", true);
            btnNhap.Enabled = false;
            btnNhap.Click += (s, e) => Nhap();
            buttons.Controls.Add(dong);
            buttons.Controls.Add(btnNhap);
            Controls.Add(kqHost);
            Controls.Add(lstHost);
            Controls.Add(top);
            Controls.Add(buttons);
            CancelButton = dong;
        }

        void ChonFile()
        {
            using (var dlg = new OpenFileDialog())
            {
                dlg.Filter = "Excel (*.xlsx)|*.xlsx|Tất cả|*.*";
                dlg.Title = "Chọn file báo cáo thất thoát";
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                txtFile.Text = dlg.FileName;
                lst.Items.Clear();
                trang.Clear();
                keHoach.Clear();
                tongHop.Clear();
                btnNhap.Enabled = false;
                if (dlg.FileName.EndsWith(".xls", StringComparison.OrdinalIgnoreCase))
                {
                    txtKetQua.Text = "File .xls (Excel 97-2003) chưa đọc được. Mở file bằng Excel → File → Save As → chọn \"Excel Workbook (*.xlsx)\" rồi chọn lại.";
                    return;
                }
                try
                {
                    Cursor = Cursors.WaitCursor;
                    book = XlsxReader.Doc(dlg.FileName);
                    trang = NhapExcel.TimTrangThang(book);
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
                keHoach = NhapExcel.TimTrangKeHoach(book, trang);
                foreach (TrangThang t in trang)
                {
                    bool co = phien.Dl.TimThang(t.Nam, t.Thang) != null;
                    lst.Items.Add(t.ToString() + (co ? "   — đã có, sẽ thay" : ""), true);
                }
                foreach (NhapExcel.TrangKeHoach k in keHoach)
                    lst.Items.Add("Kế hoạch: " + k + (k.NamDoan.HasValue && phien.Dl.CoKeHoach(k.NamDoan.Value) ? "   — sẽ cập nhật kế hoạch đã có" : ""), true);
                tongHop = NhapExcel.TimTrangTongHop(book);
                foreach (NhapExcel.TrangTongHop th in tongHop) lst.Items.Add("Vùng DMA: " + th, true);
                int tong = trang.Count + keHoach.Count + tongHop.Count;
                txtKetQua.Text = tong == 0
                    ? "Không thấy trang báo cáo tháng (dòng tiêu đề \"STT\" / \"Sản lượng phát ra\", tên dạng \"Tháng 9-2026\"), trang kế hoạch (tên có chữ \"KẾ HOẠCH\") hay bảng TỔNG HỢP có vùng DMA."
                    : "Tìm thấy " + trang.Count + " trang tháng" + (keHoach.Count > 0 ? ", " + keHoach.Count + " trang kế hoạch" : "") +
                      (tongHop.Count > 0 ? ", vùng DMA trong " + string.Join(", ", tongHop.Select(x => x.Trang.Ten)) : "") +
                      ". Các trang khác (Quý…) không cần nhập — phần mềm tự tính lại từ số liệu tháng.\r\n" +
                      "Nên nhập đủ các tháng từ tháng 1 để lũy kế và so sánh tháng trước tự nối với nhau. Vùng DMA cần có các tháng của năm đó trong phần mềm.";
                btnNhap.Enabled = tong > 0;
            }
        }

        void Nhap()
        {
            var chon = new List<TrangThang>();
            for (int i = 0; i < trang.Count; i++) if (lst.GetItemChecked(i)) chon.Add(trang[i]);
            var chonKh = new List<NhapExcel.TrangKeHoach>();
            for (int i = 0; i < keHoach.Count; i++) if (lst.GetItemChecked(trang.Count + i)) chonKh.Add(keHoach[i]);
            var chonTh = new List<NhapExcel.TrangTongHop>();
            for (int i = 0; i < tongHop.Count; i++) if (lst.GetItemChecked(trang.Count + keHoach.Count + i)) chonTh.Add(tongHop[i]);
            if (chon.Count + chonKh.Count + chonTh.Count == 0) return;
            int thay = chon.Count(t => phien.Dl.TimThang(t.Nam, t.Thang) != null);
            if (thay > 0 && !Ui.Confirm(this, thay + " tháng đã có trong phần mềm sẽ bị thay bằng số liệu trong file Excel. Tiếp tục?")) return;
            KetQuaNhap kq;
            try
            {
                Cursor = Cursors.WaitCursor;
                try { phien.Kho.SaoLuuNgay(); } catch (Exception) { }
                kq = NhapExcel.Nhap(book, chon, chonKh, chonTh, phien.Dl);
            }
            catch (Exception ex)
            {
                txtKetQua.Text = "Lỗi khi nhập: " + ex.Message;
                return;
            }
            finally
            {
                Cursor = Cursors.Default;
            }
            phien.ChonThang(phien.Dl.ThangCuoi);
            phien.Luu(this);
            var lines = new List<string>();
            if (kq.Thang.Count > 0)
                lines.Add("Đã nhập " + kq.Thang.Count + " tháng: " + string.Join(", ", kq.Thang.Select(t => t.Thang + "/" + t.Nam)) + ".");
            lines.AddRange(kq.ThongBao);
            if (kq.SoDongKhop + kq.SaiLech.Count > 0)
            {
                lines.Add("Đối chiếu: phần mềm tính lại " + kq.SoDongKhop + " số khớp với file Excel" +
                          (kq.SaiLech.Count == 0 ? " — không có sai lệch." : ", " + kq.SaiLech.Count + " chỗ khác:"));
                lines.AddRange(kq.SaiLech.Take(200).Select(s => "  • " + s));
            }
            lines.Add("");
            lines.Add("Tiếp theo: vào Nhập số liệu tháng → \"+ Tạo tháng mới\" để bắt đầu tháng kế tiếp.");
            txtKetQua.Text = string.Join("\r\n", lines);
            btnNhap.Enabled = false;
        }
    }
}
