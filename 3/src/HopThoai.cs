using System;
using System.Collections.Generic;
using System.Drawing;
using System.Windows.Forms;

namespace ToolkitIT
{
    public enum KieuTruong { Chu, MatKhau, Chon, ChonSua, ThuMuc, TepMo, TepLuu, Hop }

    /// <summary>1 ô nhập trong hộp thoại FormNhap.</summary>
    public class TruongNhap
    {
        public string Nhan;
        public KieuTruong Kieu;
        public string GiaTri;
        public string[] LuaChon;
        public string GoiY;
        public bool BatBuoc;
        public string LocTep;      // vd "Tệp ISO (*.iso)|*.iso"
        internal Control O;

        public TruongNhap(string nhan, KieuTruong kieu, string giaTri)
        {
            Nhan = nhan;
            Kieu = kieu;
            GiaTri = giaTri;
        }

        public static TruongNhap Chu(string nhan, string giaTri, bool batBuoc)
        {
            return new TruongNhap(nhan, KieuTruong.Chu, giaTri) { BatBuoc = batBuoc };
        }

        public static TruongNhap MatKhau(string nhan, bool batBuoc)
        {
            return new TruongNhap(nhan, KieuTruong.MatKhau, "") { BatBuoc = batBuoc };
        }

        public static TruongNhap Chon(string nhan, string giaTri, params string[] luaChon)
        {
            return new TruongNhap(nhan, KieuTruong.Chon, giaTri) { LuaChon = luaChon };
        }

        public static TruongNhap Hop(string nhan, bool chon)
        {
            return new TruongNhap(nhan, KieuTruong.Hop, chon ? "1" : "0");
        }
    }

    /// <summary>Hộp thoại nhập liệu dùng chung (nhiều ô), cùng giao diện với phần mềm.</summary>
    public class FormNhap : Form
    {
        readonly TruongNhap[] truong;

        FormNhap(string tieuDe, string moTa, string chuOk, TruongNhap[] truong)
        {
            this.truong = truong;
            Text = tieuDe;
            Font = Ui.Base;
            BackColor = Ui.The;
            ForeColor = Ui.Chu;
            AutoScaleMode = AutoScaleMode.None;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoSize = true;
            AutoSizeMode = AutoSizeMode.GrowAndShrink;

            int rong = Ui.S(540);
            var goc = new TableLayoutPanel
            {
                ColumnCount = 1,
                AutoSize = true,
                AutoSizeMode = AutoSizeMode.GrowAndShrink,
                Padding = Ui.Pad(22, 18, 22, 16),
                MinimumSize = new Size(rong, 0),
                MaximumSize = new Size(rong, 0),
                Location = Point.Empty
            };
            goc.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            int noiDung = rong - goc.Padding.Horizontal;

            var td = Ui.Nhan(tieuDe, Ui.TieuDeThe, Ui.Chu);
            td.MaximumSize = new Size(noiDung, 0);
            td.Margin = Ui.Pad(0, 0, 0, 6);
            goc.Controls.Add(td);
            if (!string.IsNullOrEmpty(moTa))
            {
                var mt = Ui.Nhan(moTa, Ui.Base, Ui.ChuPhu);
                mt.MaximumSize = new Size(noiDung, 0);
                mt.Margin = Ui.Pad(0, 0, 0, 10);
                goc.Controls.Add(mt);
            }

            TableLayoutPanel bang = Ui.BangNhap();
            bang.Dock = DockStyle.Fill;
            bang.Margin = Ui.Pad(0, 4, 0, 12);
            foreach (TruongNhap t in truong) ThemTruong(bang, t);
            goc.Controls.Add(bang);

            var nutOk = new NutBo(chuOk ?? "Đồng ý", Ic.Dung, Tone.Xanh, true) { AutoSize = true, MinimumSize = new Size(Ui.S(110), Ui.S(38)) };
            var nutHuy = NutBo.Phu("Hủy", null);
            nutHuy.AutoSize = true;
            nutHuy.MinimumSize = new Size(Ui.S(90), Ui.S(38));
            nutHuy.DialogResult = DialogResult.Cancel;
            nutOk.Click += (s, e) => { if (HopLe()) { DialogResult = DialogResult.OK; } };
            var hangNut = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.RightToLeft,
                AutoSize = true,
                AutoSizeMode = AutoSizeMode.GrowAndShrink,
                Dock = DockStyle.Fill,
                Margin = new Padding(0)
            };
            hangNut.Controls.Add(nutOk);
            hangNut.Controls.Add(nutHuy);
            goc.Controls.Add(hangNut);
            Controls.Add(goc);
            AcceptButton = nutOk;
            CancelButton = nutHuy;
        }

        void ThemTruong(TableLayoutPanel bang, TruongNhap t)
        {
            switch (t.Kieu)
            {
                case KieuTruong.Hop:
                    {
                        CheckBox c = Ui.Hop(t.Nhan, t.GiaTri == "1");
                        t.O = c;
                        int r = bang.RowCount;
                        bang.RowCount = r + 1;
                        bang.RowStyles.Add(new RowStyle(SizeType.AutoSize));
                        bang.Controls.Add(c, 1, r);
                        return;
                    }
                case KieuTruong.Chon:
                case KieuTruong.ChonSua:
                    {
                        ComboBox c = Ui.HopChon();
                        if (t.Kieu == KieuTruong.ChonSua)
                        {
                            c.DropDownStyle = ComboBoxStyle.DropDown;
                            c.FlatStyle = FlatStyle.Standard;
                        }
                        if (t.LuaChon != null) c.Items.AddRange(t.LuaChon);
                        if (!string.IsNullOrEmpty(t.GiaTri))
                        {
                            int i = c.Items.IndexOf(t.GiaTri);
                            if (i >= 0) c.SelectedIndex = i;
                            else if (t.Kieu == KieuTruong.ChonSua) c.Text = t.GiaTri;
                        }
                        if (c.SelectedIndex < 0 && c.Items.Count > 0 && t.Kieu == KieuTruong.Chon) c.SelectedIndex = 0;
                        t.O = c;
                        Ui.DongNhap(bang, t.Nhan, c);
                        return;
                    }
                default:
                    {
                        TextBox o = Ui.O(t.GoiY);
                        o.Text = t.GiaTri ?? "";
                        if (t.Kieu == KieuTruong.MatKhau) o.UseSystemPasswordChar = true;
                        t.O = o;
                        if (t.Kieu == KieuTruong.ThuMuc || t.Kieu == KieuTruong.TepMo || t.Kieu == KieuTruong.TepLuu)
                        {
                            var duyet = NutBo.Phu("", Ic.ThuMuc);
                            duyet.Size = new Size(Ui.S(40), Ui.S(30));
                            duyet.Margin = Ui.Pad(6, 2, 0, 2);
                            duyet.Click += (s, e) => Duyet(t, o);
                            Ui.DongNhap(bang, t.Nhan, Ui.HangNgang(o, duyet));
                        }
                        else Ui.DongNhap(bang, t.Nhan, o);
                        return;
                    }
            }
        }

        void Duyet(TruongNhap t, TextBox o)
        {
            if (t.Kieu == KieuTruong.ThuMuc)
            {
                string d = Ui.ChonThuMuc(this, t.Nhan, o.Text);
                if (d != null) o.Text = d;
                return;
            }
            FileDialog fd = t.Kieu == KieuTruong.TepMo ? (FileDialog)new OpenFileDialog() : new SaveFileDialog();
            using (fd)
            {
                fd.Filter = t.LocTep ?? "Tất cả (*.*)|*.*";
                if (!string.IsNullOrEmpty(o.Text))
                {
                    try { fd.FileName = System.IO.Path.GetFileName(o.Text); } catch (Exception) { }
                }
                if (fd.ShowDialog(this) == DialogResult.OK) o.Text = fd.FileName;
            }
        }

        static string GiaTri(TruongNhap t)
        {
            var c = t.O as CheckBox;
            if (c != null) return c.Checked ? "1" : "0";
            var cb = t.O as ComboBox;
            if (cb != null) return cb.DropDownStyle == ComboBoxStyle.DropDownList ? Convert.ToString(cb.SelectedItem) : cb.Text.Trim();
            return t.Kieu == KieuTruong.MatKhau ? t.O.Text : t.O.Text.Trim();
        }

        bool HopLe()
        {
            foreach (TruongNhap t in truong)
            {
                if (t.BatBuoc && string.IsNullOrEmpty(GiaTri(t)))
                {
                    Ui.BaoTin(this, "Vui lòng nhập: " + t.Nhan);
                    t.O.Focus();
                    return false;
                }
            }
            return true;
        }

        /// <summary>Hiện hộp thoại; trả về giá trị các ô theo thứ tự (ô đánh dấu: "1"/"0"), null nếu bấm Hủy.</summary>
        public static string[] Hien(IWin32Window owner, string tieuDe, string moTa, string chuOk, params TruongNhap[] truong)
        {
            using (var f = new FormNhap(tieuDe, moTa, chuOk, truong))
            {
                if (f.ShowDialog(owner) != DialogResult.OK) return null;
                var kq = new string[truong.Length];
                for (int i = 0; i < truong.Length; i++) kq[i] = GiaTri(truong[i]);
                return kq;
            }
        }
    }

    /// <summary>Cửa sổ xem nội dung chữ (file cấu hình, chi tiết...) có nút sao chép / lưu.</summary>
    public class FormXem : Form
    {
        FormXem(string tieuDe, string noiDung, string locLuu)
        {
            Text = tieuDe;
            Font = Ui.Base;
            BackColor = Ui.Nen;
            AutoScaleMode = AutoScaleMode.None;
            StartPosition = FormStartPosition.CenterParent;
            Size = new Size(Ui.S(820), Ui.S(600));
            MinimizeBox = false;
            ShowInTaskbar = false;
            Padding = Ui.Pad(14);

            var o = new TextBox
            {
                Multiline = true,
                ReadOnly = true,
                ScrollBars = ScrollBars.Both,
                WordWrap = false,
                Font = Ui.Mono,
                BackColor = Ui.The,
                ForeColor = Ui.Chu,
                BorderStyle = BorderStyle.FixedSingle,
                Text = noiDung.Replace("\r\n", "\n").Replace("\n", "\r\n")
            };
            var hang = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, AutoSize = true, AutoSizeMode = AutoSizeMode.GrowAndShrink };
            var dong = NutBo.Phu("Đóng", null);
            dong.AutoSize = true;
            dong.DialogResult = DialogResult.Cancel;
            var chep = new NutBo("Sao chép", Ic.ChepLai, Tone.Xanh, false) { AutoSize = true };
            chep.Click += (s, e) => { try { Clipboard.SetText(o.Text); } catch (Exception) { } };
            hang.Controls.Add(dong);
            hang.Controls.Add(chep);
            if (locLuu != null)
            {
                var luu = new NutBo("Lưu ra tệp...", Ic.Luu, Tone.XanhLa, false) { AutoSize = true };
                luu.Click += (s, e) =>
                {
                    using (var d = new SaveFileDialog { Filter = locLuu })
                        if (d.ShowDialog(this) == DialogResult.OK) System.IO.File.WriteAllText(d.FileName, o.Text, new System.Text.UTF8Encoding(true));
                };
                hang.Controls.Add(luu);
            }
            Controls.Add(o);
            o.Dock = DockStyle.Fill;
            Controls.Add(Ui.Khoang(10));
            ((Control)Controls[1]).Dock = DockStyle.Bottom;
            Controls.Add(hang);
            hang.Dock = DockStyle.Bottom;
            CancelButton = dong;
        }

        public static void Hien(IWin32Window owner, string tieuDe, string noiDung, string locLuu)
        {
            using (var f = new FormXem(tieuDe, noiDung, locLuu)) f.ShowDialog(owner);
        }
    }
}
