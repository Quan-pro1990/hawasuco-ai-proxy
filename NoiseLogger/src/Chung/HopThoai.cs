using System;
using System.Drawing;
using System.Windows.Forms;

namespace NoiseLogger
{
    /// <summary>Khung hộp thoại dùng chung: bảng 2 cột nhãn / ô nhập + hàng nút Lưu, Huỷ.</summary>
    class HopThoai : Form
    {
        protected readonly TableLayoutPanel Bang;
        protected readonly FlowLayoutPanel Nut;
        protected readonly Button BtnLuu, BtnHuy;

        public HopThoai(string title, int w, int h)
        {
            Text = title;
            Font = Ui.Base;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = MinimizeBox = false;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.CenterParent;
            AutoScaleMode = AutoScaleMode.None;
            ClientSize = new Size(Ui.S(w), Ui.S(h));
            BackColor = Ui.Surface;
            Bang = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = Ui.Pad(18, 14, 18, 6), ColumnCount = 2, AutoScroll = true };
            Bang.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, Ui.S(170)));
            Bang.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            Controls.Add(Bang);
            Nut = new FlowLayoutPanel { Dock = DockStyle.Bottom, FlowDirection = FlowDirection.RightToLeft, Height = Ui.S(54), Padding = Ui.Pad(12, 8, 12, 8) };
            BtnLuu = Ui.MakeButton("Lưu", true);
            BtnHuy = Ui.MakeButton("Huỷ", false);
            BtnHuy.DialogResult = DialogResult.Cancel;
            BtnLuu.Click += (s, e) => { if (KiemTra()) DialogResult = DialogResult.OK; };
            Nut.Controls.Add(BtnHuy);
            Nut.Controls.Add(BtnLuu);
            Controls.Add(Nut);
            AcceptButton = BtnLuu;
            CancelButton = BtnHuy;
        }

        protected virtual bool KiemTra() { return true; }

        protected Label Dong(string label, Control c)
        {
            int r = Bang.RowCount++;
            Bang.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            var l = Ui.MakeLabel(label, Ui.Base, Ui.Text);
            l.Margin = Ui.Pad(0, 8, 8, 6);
            Bang.Controls.Add(l, 0, r);
            c.Margin = Ui.Pad(0, 4, 0, 8);
            Bang.Controls.Add(c, 1, r);
            return l;
        }

        protected Label GhiChu(string text)
        {
            var l = Ui.MakeLabel(text, Ui.Small, Ui.Muted);
            l.UseMnemonic = false;
            l.MaximumSize = new Size(ClientSize.Width - Ui.S(230), 0);
            Dong("", l);
            l.Margin = Ui.Pad(0, 0, 0, 8);
            return l;
        }

        protected static Control Hang(params Control[] items)
        {
            var p = new FlowLayoutPanel { AutoSize = true, WrapContents = false, Margin = new Padding(0) };
            foreach (Control c in items)
            {
                c.Margin = Ui.Pad(0, 3, 8, 0);
                p.Controls.Add(c);
            }
            return p;
        }

        protected static TextBox O(int width, string text, string cue)
        {
            var t = Ui.MakeText(width);
            t.Text = text ?? "";
            if (cue != null) Ui.SetCue(t, cue);
            return t;
        }

        /// <summary>Đọc số; sai thì báo và đưa con trỏ về ô.</summary>
        protected bool DocSo(TextBox box, string ten, out double? v)
        {
            if (So.TryDoc(box.Text, out v)) return true;
            Ui.Error(this, ten + ": \"" + box.Text + "\" không phải số hợp lệ.");
            box.Focus();
            box.SelectAll();
            return false;
        }
    }
}
