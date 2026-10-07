using System;
using System.Drawing;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>Thông tin in trên báo cáo tháng: kỳ hoá đơn, thời gian tiêu thụ, ngày lập, ghi chú, người ký.</summary>
    class KyBaoCaoForm : Form
    {
        readonly ThangBaoCao thang;
        readonly TextBox txtKy, txtGhiChu;
        readonly DateTimePicker dtTu, dtDen, dtLap;
        readonly TextBox[,] ky = new TextBox[3, 3];

        public KyBaoCaoForm(DuLieu dl, ThangBaoCao t)
        {
            thang = t;
            Text = "Thông tin kỳ báo cáo — " + t.Ten;
            Font = Ui.Base;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(760), Ui.S(600));
            BackColor = Ui.Surface;

            var tbl = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = Ui.Pad(18, 14, 18, 8), ColumnCount = 2, AutoScroll = true };
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(190)));
            tbl.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(tbl);

            txtKy = Ui.MakeText(120);
            txtKy.Text = t.KyHoaDon;
            Ui.SetCue(txtKy, ThangBaoCao.KyMacDinh(t.Nam, t.Thang));
            Row(tbl, "Hoá đơn kỳ", Line(txtKy, Ui.MakeLabel("in thành \"(HÓA ĐƠN KỲ " + ThangBaoCao.KyMacDinh(t.Nam, t.Thang) + ")\"", Ui.Small, Ui.Muted)));

            dtTu = Ui.MakeDatePicker(true);
            dtDen = Ui.MakeDatePicker(true);
            SetDate(dtTu, t.TuNgay);
            SetDate(dtDen, t.DenNgay);
            Row(tbl, "Nước tiêu thụ từ ngày", Line(dtTu, Ui.MakeLabel("đến ngày", Ui.Base, Ui.Text), dtDen));

            dtLap = Ui.MakeDatePicker(true);
            SetDate(dtLap, t.NgayLap);
            Row(tbl, "Ngày lập báo cáo", Line(dtLap, Ui.MakeLabel("bỏ chọn = lấy ngày xuất file; in kèm địa danh \"" + dl.CaiDat.DiaDanh + "\"", Ui.Small, Ui.Muted)));

            txtGhiChu = new TextBox { Multiline = true, ScrollBars = ScrollBars.Vertical, Font = Ui.Base, Dock = DockStyle.Fill, Height = Ui.S(150), AcceptsReturn = true };
            txtGhiChu.Text = (t.GhiChu ?? "").Replace("\r", "").Replace("\n", "\r\n");
            Row(tbl, "Ghi chú cuối báo cáo\n(giải trình tăng / giảm)", txtGhiChu);
            tbl.RowStyles[tbl.RowCount - 1] = new RowStyle(SizeType.Absolute, Ui.S(160));

            string[] vt = { "Bên trái", "Ở giữa", "Bên phải (lập biểu)" };
            for (int i = 0; i < 3; i++)
            {
                var line = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
                string[] cue = { "Chức vụ dòng 1", "Chức vụ dòng 2", "Họ và tên" };
                string[] val = { t.Ky[i].Dong1, t.Ky[i].Dong2, t.Ky[i].Ten };
                for (int j = 0; j < 3; j++)
                {
                    var box = Ui.MakeText(j == 0 ? 210 : 160);
                    box.Text = val[j];
                    Ui.SetCue(box, cue[j]);
                    box.Margin = Ui.Pad(0, 0, 6, 0);
                    ky[i, j] = box;
                    line.Controls.Add(box);
                }
                Row(tbl, "Người ký — " + vt[i], line);
            }
            var luuMacDinh = new CheckBox { Text = "Dùng người ký này làm mặc định cho tháng mới", AutoSize = true, Checked = false };
            Row(tbl, "", luuMacDinh);

            var buttons = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            var ok = Ui.MakeButton("Lưu", true);
            var cancel = Ui.MakeButton("Huỷ", false);
            cancel.DialogResult = DialogResult.Cancel;
            ok.Click += (s, e) =>
            {
                if (dtTu.Checked && dtDen.Checked && dtDen.Value.Date <= dtTu.Value.Date)
                {
                    Ui.Error(this, "Ngày kết thúc phải sau ngày bắt đầu.");
                    return;
                }
                thang.KyHoaDon = txtKy.Text.Trim();
                thang.TuNgay = dtTu.Checked ? dtTu.Value.Date : (DateTime?)null;
                thang.DenNgay = dtDen.Checked ? dtDen.Value.Date : (DateTime?)null;
                thang.NgayLap = dtLap.Checked ? dtLap.Value.Date : (DateTime?)null;
                thang.GhiChu = txtGhiChu.Text.Replace("\r", "").Trim('\n');
                for (int i = 0; i < 3; i++)
                {
                    thang.Ky[i] = new NguoiKy(ky[i, 0].Text.Trim(), ky[i, 1].Text.Trim(), ky[i, 2].Text.Trim());
                    if (luuMacDinh.Checked) dl.CaiDat.KyMacDinh[i] = thang.Ky[i].Chep();
                }
                DialogResult = DialogResult.OK;
            };
            buttons.Controls.Add(cancel);
            buttons.Controls.Add(ok);
            Controls.Add(buttons);
            CancelButton = cancel;
        }

        static void SetDate(DateTimePicker d, DateTime? v)
        {
            if (v.HasValue)
            {
                d.Value = v.Value;
                d.Checked = true;
            }
            else d.Checked = false;
        }

        static Control Line(params Control[] items)
        {
            var p = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            foreach (Control c in items)
            {
                c.Margin = Ui.Pad(0, 3, 8, 0);
                p.Controls.Add(c);
            }
            return p;
        }

        static void Row(TableLayoutPanel tbl, string label, Control c)
        {
            int r = tbl.RowCount++;
            tbl.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Ui.MakeLabel(label, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 8, 6);
            tbl.Controls.Add(l, 0, r);
            c.Margin = Ui.Pad(0, 4, 0, 6);
            tbl.Controls.Add(c, 1, r);
        }
    }
}
