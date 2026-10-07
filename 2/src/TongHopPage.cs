using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Bảng tổng hợp năm (như trang "TỔNG HỢP" của Excel) + biểu đồ tỷ lệ thất thoát theo tháng.</summary>
    public class TongHopPage : UserControl, ITrang
    {
        readonly PhienLam phien;
        readonly ComboBox cboNam;
        readonly DataGridView grid;
        readonly BieuDoThang chart;
        readonly Label lblSub;
        List<Muc> dong = new List<Muc>();
        int nam;
        bool dangNap;

        public TongHopPage(PhienLam phien)
        {
            this.phien = phien;
            BackColor = Ui.Background;
            Font = Ui.Base;

            var top = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = false, Padding = Ui.Pad(0, 0, 0, 4) };
            var title = Ui.MakeLabel("Tổng hợp năm", Ui.Title, Ui.Text);
            title.Margin = Ui.Pad(0, 0, 16, 0);
            top.Controls.Add(title);
            cboNam = Ui.MakeCombo(110);
            cboNam.Margin = Ui.Pad(0, 7, 10, 0);
            cboNam.SelectedIndexChanged += (s, e) => { if (!dangNap && cboNam.SelectedItem != null) { nam = (int)cboNam.SelectedItem; Nap(); } };
            top.Controls.Add(cboNam);
            var btnXuat = QuyenUi.ChoXem(Ui.MakeButton("Xuất Excel bảng tổng hợp", false));
            btnXuat.Margin = Ui.Pad(0, 4, 8, 0);
            btnXuat.Click += (s, e) => XuatPage.XuatTongHop(this, phien, nam);
            top.Controls.Add(btnXuat);
            var btnIn = XuatPage.NutIn();
            btnIn.Margin = Ui.Pad(0, 4, 8, 0);
            btnIn.Click += (s, e) => XuatPage.XuatTongHop(this, phien, nam, true);
            top.Controls.Add(btnIn);
            lblSub = Ui.MakeLabel("", Ui.Small, Ui.Muted);
            lblSub.Dock = DockStyle.Top;
            lblSub.Padding = Ui.Pad(2, 0, 0, 8);

            grid = new DataGridView { Dock = DockStyle.Fill };
            Ui.StyleGrid(grid);
            grid.ReadOnly = true;
            grid.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
            grid.MultiSelect = false;
            grid.Columns.Add(Ui.Col("STT", 50, false));
            grid.Columns.Add(Ui.Col("Tên đơn vị", 230, false));
            for (int th = 1; th <= 12; th++) grid.Columns.Add(Ui.Col("T" + th, 58, true));
            grid.Columns.Add(Ui.Col("Lũy kế\nphát ra", 110, true));
            grid.Columns.Add(Ui.Col("Lũy kế\nchuẩn thu", 110, true));
            grid.Columns.Add(Ui.Col("Nước\nthất thoát", 100, true));
            grid.Columns.Add(Ui.Col("TT lũy\nkế %", 64, true));
            grid.Columns.Add(Ui.Col("So\ncùng kỳ", 64, true));
            grid.Columns.Add(Ui.Col("So\nKH", 64, true));
            grid.Columns.Add(Ui.Col("Kế\nhoạch", 64, true));
            grid.Columns[0].DefaultCellStyle.Alignment = DataGridViewContentAlignment.MiddleCenter;
            grid.Columns[0].Frozen = grid.Columns[1].Frozen = true;
            grid.SelectionChanged += (s, e) => VeBieuDo();

            chart = new BieuDoThang { Dock = DockStyle.Bottom, Height = Ui.S(250) };
            var gap = new Panel { Dock = DockStyle.Bottom, Height = Ui.S(10) };
            var host = new Panel { Dock = DockStyle.Fill, BackColor = Ui.Border, Padding = new Padding(1) };
            host.Controls.Add(grid);
            Controls.Add(host);
            Controls.Add(gap);
            Controls.Add(chart);
            Controls.Add(lblSub);
            Controls.Add(top);
            phien.DaDoi += (s, e) => { if (Visible) KhiHien(); };
        }

        public void KhiHien()
        {
            dangNap = true;
            List<int> years = phien.Dl.CacNam();
            cboNam.Items.Clear();
            foreach (int y in years.AsEnumerable().Reverse()) cboNam.Items.Add(y);
            if (!years.Contains(nam)) nam = phien.ThangChon != null ? phien.ThangChon.Nam : (years.Count > 0 ? years.Last() : DateTime.Today.Year);
            if (cboNam.Items.Contains(nam)) cboNam.SelectedItem = nam;
            dangNap = false;
            Nap();
        }

        void Nap()
        {
            grid.Rows.Clear();
            dong.Clear();
            var bc = new BaoCao(phien.Dl, phien.Bt);
            ThangBaoCao cuoi = bc.ThangCuoiCuaNam(nam);
            if (cuoi == null)
            {
                lblSub.Text = "Chưa có số liệu năm này.";
                chart.Dat(null, null, null);
                return;
            }
            var kqThang = new KetQuaThang[13];
            int coThang = 0;
            for (int th = 1; th <= 12; th++)
            {
                ThangBaoCao t = phien.Dl.TimThang(nam, th);
                if (t != null) { kqThang[th] = phien.Bt.Tinh(t); coThang++; }
            }
            lblSub.Text = "Năm " + nam + ": có số liệu " + coThang + " tháng, lũy kế đến " + cuoi.Ten.ToLower() +
                          ". Chữ đỏ = cao hơn kế hoạch. Chọn 1 dòng để xem biểu đồ của đơn vị đó.";
            KetQuaThang kc = phien.Bt.Tinh(cuoi);
            dong = phien.Bt.DongTongHopNam(nam);
            int sttDma = 0;
            foreach (Muc m in dong)
            {
                bool dma = m.VaiTro == VaiTro.Dma;
                sttDma = dma ? sttDma + 1 : 0;
                var vals = new List<object> { dma ? sttDma.ToString() : m.Stt, dma ? "     " + m.TenTongHop : m.TenTongHop };
                double? kh = phien.Dl.LayKeHoach(nam, m.Id);
                for (int th = 1; th <= 12; th++)
                {
                    KetQua k = kqThang[th] != null ? kqThang[th][m.Id] : null;
                    string tinhTrang = dma && k != null && !k.TyLe.HasValue ? BoTinh.TinhTrangDma(kqThang[th].Thang.Tim(m.Id)) : "";
                    vals.Add(k != null ? (tinhTrang.Length > 0 ? tinhTrang : So.P2(k.TyLe)) : "");
                }
                KetQua r = kc[m.Id];
                for (int th = 12; r == null && th >= 1; th--) if (kqThang[th] != null) r = kqThang[th][m.Id];
                if (r == null) r = new KetQua();
                vals.Add(So.M3(r.LkPhatRa));
                vals.Add(So.M3(r.LkChuanThu));
                vals.Add(r.LkChuanThu.HasValue ? So.M3(r.LkPhatRa - r.LkChuanThu.Value) : "");
                vals.Add(So.P2(r.LkTyLe));
                vals.Add(So.Lech(r.LkSoCungKy));
                vals.Add(r.LkTyLe.HasValue && kh.HasValue ? So.Lech(r.LkTyLe - kh) : "");
                vals.Add(So.P2(kh));
                int i = grid.Rows.Add(vals.ToArray());
                DataGridViewRow row = grid.Rows[i];
                if (m.VaiTro == VaiTro.Doi || m.VaiTro == VaiTro.ToanCongTy)
                {
                    row.DefaultCellStyle.Font = Ui.BaseBold;
                    row.DefaultCellStyle.BackColor = m.VaiTro == VaiTro.ToanCongTy ? Ui.Selection : Ui.GroupRow;
                }
                if (dma)
                {
                    row.DefaultCellStyle.ForeColor = Ui.Muted;
                    row.Cells[1].ToolTipText = "Vùng DMA — nhập ở trang Vùng DMA";
                    for (int th = 1; th <= 12; th++)
                    {
                        string v = Convert.ToString(row.Cells[1 + th].Value);
                        double x;
                        if (v.Length > 0 && !double.TryParse(v, System.Globalization.NumberStyles.Float, So.VN, out x))
                        {
                            row.Cells[1 + th].Style.Font = Ui.BaseItalic;
                            row.Cells[1 + th].ToolTipText = v;
                        }
                    }
                }
                if (kh.HasValue)
                {
                    for (int th = 1; th <= 12; th++)
                    {
                        KetQua k = kqThang[th] != null ? kqThang[th][m.Id] : null;
                        if (k != null && k.TyLe.HasValue) row.Cells[1 + th].Style.ForeColor = k.TyLe > kh ? Ui.Danger : Ui.Success;
                    }
                    if (r.LkTyLe.HasValue) row.Cells[17].Style.ForeColor = r.LkTyLe > kh ? Ui.Danger : Ui.Success;
                }
                row.Cells[18].Style.ForeColor = Ui.MauLech(r.LkSoCungKy);
                row.Cells[19].Style.ForeColor = Ui.MauLech(r.LkTyLe.HasValue && kh.HasValue ? r.LkTyLe - kh : null);
            }
            int idx = dong.FindIndex(m => m.VaiTro == VaiTro.ToanCongTy);
            if (idx >= 0 && grid.Rows.Count > 0) grid.Rows[idx].Selected = true;
            VeBieuDo();
        }

        void VeBieuDo()
        {
            if (grid.SelectedRows.Count == 0 || dong.Count == 0)
            {
                chart.Dat(null, null, null);
                return;
            }
            int r = grid.SelectedRows[0].Index;
            if (r < 0 || r >= dong.Count) return;
            Muc m = dong[r];
            var v = new double?[12];
            var truoc = new double?[12];
            for (int th = 1; th <= 12; th++)
            {
                ThangBaoCao t = phien.Dl.TimThang(nam, th);
                if (t != null && phien.Bt.Tinh(t)[m.Id] != null) v[th - 1] = phien.Bt.Tinh(t)[m.Id].TyLe;
                ThangBaoCao n = phien.Dl.TimThang(nam - 1, th);
                if (n != null && phien.Bt.Tinh(n)[m.Id] != null) truoc[th - 1] = phien.Bt.Tinh(n)[m.Id].TyLe;
            }
            chart.TieuDe = "Tỷ lệ thất thoát từng tháng năm " + nam + " — " + m.TenTongHop;
            chart.Dat(v, truoc.Any(x => x.HasValue) ? truoc : null, phien.Dl.LayKeHoach(nam, m.Id));
        }
    }

    /// <summary>Biểu đồ cột 12 tháng + đường kế hoạch + chấm cùng kỳ năm trước.</summary>
    class BieuDoThang : Control
    {
        double?[] giaTri, namTruoc;
        double? keHoach;
        public string TieuDe = "";

        public BieuDoThang()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
            BackColor = Ui.Surface;
        }

        public void Dat(double?[] v, double?[] truoc, double? kh)
        {
            giaTri = v;
            namTruoc = truoc;
            keHoach = kh;
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(Ui.Surface);
            using (var pen = new Pen(Ui.Border)) g.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
            if (giaTri == null) return;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            TextRenderer.DrawText(g, TieuDe, Ui.SmallBold, new Point(Ui.S(14), Ui.S(10)), Ui.Text);
            int left = Ui.S(48), right = Width - Ui.S(20), top = Ui.S(40), bottom = Height - Ui.S(34);
            if (right <= left || bottom <= top) return;
            var all = giaTri.Where(x => x.HasValue).Select(x => x.Value).ToList();
            if (namTruoc != null) all.AddRange(namTruoc.Where(x => x.HasValue).Select(x => x.Value));
            if (keHoach.HasValue) all.Add(keHoach.Value);
            double max = all.Count > 0 ? Math.Max(5, all.Max()) : 30, min = all.Count > 0 ? Math.Min(0, all.Min()) : 0;
            double step = max - min > 40 ? 10 : 5;
            max = Math.Ceiling(max / step) * step;
            min = Math.Floor(min / step) * step;
            Func<double, float> y = v => (float)(bottom - (v - min) / (max - min) * (bottom - top));
            using (var grid = new Pen(Color.FromArgb(0xEC, 0xEF, 0xF3)))
            {
                for (double v = min; v <= max + 1e-9; v += step)
                {
                    g.DrawLine(grid, left, y(v), right, y(v));
                    TextRenderer.DrawText(g, v.ToString("0") + "%", Ui.Small, new Rectangle(0, (int)y(v) - Ui.S(9), left - Ui.S(6), Ui.S(18)), Ui.Muted,
                                          TextFormatFlags.Right | TextFormatFlags.VerticalCenter);
                }
            }
            float slot = (right - left) / 12f, bw = slot * 0.56f;
            for (int i = 0; i < 12; i++)
            {
                float cx = left + slot * i + slot / 2;
                TextRenderer.DrawText(g, "T" + (i + 1), Ui.Small, new Rectangle((int)(cx - slot / 2), bottom + Ui.S(6), (int)slot, Ui.S(18)), Ui.Muted,
                                      TextFormatFlags.HorizontalCenter);
                if (!giaTri[i].HasValue) continue;
                double v = giaTri[i].Value;
                bool vuot = keHoach.HasValue && v > keHoach;
                float y0 = y(Math.Max(0, min)), y1 = y(v);
                var rect = new RectangleF(cx - bw / 2, Math.Min(y0, y1), bw, Math.Max(1, Math.Abs(y1 - y0)));
                using (var b = new SolidBrush(vuot ? Color.FromArgb(0xD9, 0x5C, 0x5C) : Ui.Primary)) g.FillRectangle(b, rect);
                TextRenderer.DrawText(g, So.P2(v), Ui.Small, new Rectangle((int)(cx - slot / 2), (int)Math.Min(y0, y1) - Ui.S(18), (int)slot, Ui.S(16)), Ui.Text,
                                      TextFormatFlags.HorizontalCenter);
            }
            if (namTruoc != null)
            {
                using (var b = new SolidBrush(Color.FromArgb(0x9A, 0xA4, 0xB1)))
                    for (int i = 0; i < 12; i++)
                    {
                        if (!namTruoc[i].HasValue) continue;
                        float cx = left + slot * i + slot / 2;
                        float d = Ui.S(7);
                        g.FillEllipse(b, cx + bw / 2 + Ui.S(2), y(namTruoc[i].Value) - d / 2, d, d);
                    }
            }
            if (keHoach.HasValue)
            {
                using (var pen = new Pen(Ui.Warning, Ui.S(2)) { DashStyle = DashStyle.Dash })
                    g.DrawLine(pen, left, y(keHoach.Value), right, y(keHoach.Value));
                TextRenderer.DrawText(g, "Kế hoạch " + So.P2(keHoach) + "%", Ui.SmallBold, new Point(right - Ui.S(130), (int)y(keHoach.Value) - Ui.S(20)), Ui.Warning);
            }
            string legend = "■ Thực hiện (đỏ = vượt kế hoạch)" + (namTruoc != null ? "    ● Cùng kỳ năm trước" : "");
            TextRenderer.DrawText(g, legend, Ui.Small, new Point(Width - Ui.S(420), Ui.S(10)), Ui.Muted);
        }
    }
}
