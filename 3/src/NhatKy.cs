using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace ToolkitIT
{
    public enum LoaiDong { Thuong, TieuDe, Tot, Loi, Canh, Lenh }

    /// <summary>
    /// Nhật ký dùng chung: mọi luồng ghi vào hàng đợi, bộ hẹn giờ trên luồng giao diện đổ ra ô nhật ký
    /// (và ghi thêm vào tệp C:\ProgramData\ITToolkit\NhatKy\yyyy-MM-dd.log).
    /// </summary>
    public class NhatKy
    {
        public static readonly NhatKy Chung = new NhatKy();

        struct Dong
        {
            public string Chu;
            public LoaiDong Loai;
            public DateTime Luc;
        }

        readonly ConcurrentQueue<Dong> hang = new ConcurrentQueue<Dong>();
        RichTextBox o;
        System.Windows.Forms.Timer hen;

        [DllImport("user32.dll")]
        static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

        public void GanVao(RichTextBox box)
        {
            o = box;
            hen = new System.Windows.Forms.Timer { Interval = 120 };
            hen.Tick += (s, e) => DoRa();
            hen.Start();
        }

        public void Ghi(string s) { Them(s, LoaiDong.Thuong); }
        public void TieuDe(string s) { Them(s, LoaiDong.TieuDe); }
        public void Tot(string s) { Them(s, LoaiDong.Tot); }
        public void Loi(string s) { Them(s, LoaiDong.Loi); }
        public void Canh(string s) { Them(s, LoaiDong.Canh); }
        public void Lenh(string s) { Them("> " + s, LoaiDong.Lenh); }

        void Them(string s, LoaiDong loai)
        {
            if (s == null) return;
            foreach (string dong in s.Replace("\r\n", "\n").Split('\n'))
            {
                if (dong.Length == 0 && loai == LoaiDong.Thuong) continue;
                var d = new Dong();
                d.Chu = dong;
                d.Loai = loai;
                d.Luc = DateTime.Now;
                hang.Enqueue(d);
            }
        }

        static Color MauCua(LoaiDong l)
        {
            switch (l)
            {
                case LoaiDong.TieuDe: return Color.FromArgb(0x7D, 0xB9, 0xFF);
                case LoaiDong.Tot: return Color.FromArgb(0x5E, 0xE0, 0x8C);
                case LoaiDong.Loi: return Color.FromArgb(0xFF, 0x7B, 0x72);
                case LoaiDong.Canh: return Color.FromArgb(0xFF, 0xC8, 0x57);
                case LoaiDong.Lenh: return Color.FromArgb(0xC3, 0xA6, 0xFF);
                default: return Ui.LogChu;
            }
        }

        void DoRa()
        {
            if (o == null || o.IsDisposed || hang.IsEmpty) return;
            var tep = new StringBuilder();
            VeLai(false);
            try
            {
                int n = 0;
                Dong d;
                while (n < 400 && hang.TryDequeue(out d))
                {
                    n++;
                    string gio = d.Luc.ToString("HH:mm:ss") + "  ";
                    string tienTo = d.Loai == LoaiDong.TieuDe ? "══ " : d.Loai == LoaiDong.Tot ? "[OK] " : d.Loai == LoaiDong.Loi ? "[LỖI] " : d.Loai == LoaiDong.Canh ? "[!] " : "";
                    o.SelectionStart = o.TextLength;
                    o.SelectionLength = 0;
                    o.SelectionColor = Color.FromArgb(0x5C, 0x6B, 0x80);
                    o.AppendText(gio);
                    o.SelectionColor = MauCua(d.Loai);
                    o.AppendText(tienTo + d.Chu + "\n");
                    tep.Append(gio).Append(tienTo).Append(d.Chu).Append("\r\n");
                }
                if (o.TextLength > 400000)
                {
                    o.Select(0, o.TextLength - 300000);
                    o.SelectedText = "";
                }
                o.SelectionStart = o.TextLength;
                o.SelectionLength = 0;
            }
            finally
            {
                VeLai(true);
                o.Invalidate();
            }
            o.ScrollToCaret();
            GhiTep(tep.ToString());
        }

        /// <summary>Tạm ngừng / bật lại vẽ ô nhật ký khi đổ nhiều dòng (WM_SETREDRAW).</summary>
        void VeLai(bool bat)
        {
            try { SendMessage(o.Handle, 0x000B, bat ? (IntPtr)1 : IntPtr.Zero, IntPtr.Zero); }
            catch (Exception) { }
        }

        static void GhiTep(string s)
        {
            if (s.Length == 0) return;
            try
            {
                string d = Path.Combine(HeThong.ThuMucDuLieu, "NhatKy");
                Directory.CreateDirectory(d);
                File.AppendAllText(Path.Combine(d, DateTime.Now.ToString("yyyy-MM-dd") + ".log"), s, Encoding.UTF8);
            }
            catch (Exception)
            {
                // không ghi được tệp nhật ký thì bỏ qua, vẫn hiện trên màn hình
            }
        }
    }

    /// <summary>Lỗi có chủ đích để dừng tác vụ (đã giải thích rõ cho người dùng).</summary>
    public class LoiTacVu : Exception
    {
        public LoiTacVu(string msg) : base(msg) { }
    }

    /// <summary>Chạy các tác vụ nền song song (không treo giao diện), đếm số tác vụ đang chạy.</summary>
    static class TacVu
    {
        static int dem;
        static readonly HashSet<string> dangChay = new HashSet<string>();
        public static Control GiaoDien;
        public static event EventHandler DoiSoLuong;

        public static int SoLuong { get { return dem; } }

        public static bool Chay(string ten, Action<NhatKy> viec)
        {
            return Chay(ten, viec, null);
        }

        /// <summary>Chạy việc trên luồng nền; xong (nếu có) được gọi lại trên luồng giao diện.</summary>
        public static bool Chay(string ten, Action<NhatKy> viec, Action xong)
        {
            lock (dangChay)
            {
                if (!dangChay.Add(ten))
                {
                    MessageBox.Show("Tác vụ \"" + ten + "\" đang chạy, vui lòng chờ xong.", UngDung.Ten,
                        MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return false;
                }
            }
            NhatKy log = NhatKy.Chung;
            Interlocked.Increment(ref dem);
            BaoDoi();
            log.TieuDe("BẮT ĐẦU: " + ten);
            Stopwatch dongHo = Stopwatch.StartNew();
            var luong = new Thread(() =>
            {
                bool loi = false;
                try
                {
                    viec(log);
                }
                catch (LoiTacVu ex)
                {
                    loi = true;
                    log.Loi(ex.Message);
                }
                catch (Exception ex)
                {
                    loi = true;
                    log.Loi(HeThong.ThongDiep(ex));
                }
                finally
                {
                    lock (dangChay) dangChay.Remove(ten);
                    Interlocked.Decrement(ref dem);
                    string tg = dongHo.Elapsed.TotalSeconds < 60
                        ? dongHo.Elapsed.TotalSeconds.ToString("0.0") + " giây"
                        : ((int)dongHo.Elapsed.TotalMinutes) + " phút " + dongHo.Elapsed.Seconds + " giây";
                    if (loi) log.Canh("DỪNG: " + ten + " (" + tg + ")");
                    else log.Tot("XONG: " + ten + " (" + tg + ")");
                    BaoDoi();
                    if (xong != null && GiaoDien != null && GiaoDien.IsHandleCreated && !GiaoDien.IsDisposed)
                    {
                        try { GiaoDien.BeginInvoke(xong); } catch (Exception) { }
                    }
                }
            });
            luong.IsBackground = true;
            luong.SetApartmentState(ApartmentState.STA);
            luong.Start();
            return true;
        }

        static void BaoDoi()
        {
            EventHandler h = DoiSoLuong;
            if (h != null) h(null, EventArgs.Empty);
        }

        /// <summary>Lấy dữ liệu trên luồng nền rồi cập nhật giao diện (không ghi nhật ký, không đếm tác vụ).</summary>
        public static void Nen<T>(Control chu, Func<T> lay, Action<T> xong)
        {
            ThreadPool.QueueUserWorkItem(_ =>
            {
                T kq = default(T);
                Exception loi = null;
                try { kq = lay(); }
                catch (Exception ex) { loi = ex; }
                // control chưa tạo handle (trang đang ẩn) thì nhờ cửa sổ chính chuyển về luồng giao diện
                Control dich = chu.IsHandleCreated ? chu : GiaoDien;
                if (dich == null || dich.IsDisposed || !dich.IsHandleCreated) return;
                try
                {
                    dich.BeginInvoke((Action)(() =>
                    {
                        if (chu.IsDisposed) return;
                        if (loi != null) NhatKy.Chung.Loi(HeThong.ThongDiep(loi));
                        else xong(kq);
                    }));
                }
                catch (Exception) { }
            });
        }
    }
}
