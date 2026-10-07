using System;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Đồng bộ phần mềm trên máy tính với máy chủ IIS (dữ liệu chính nằm trên máy chủ):
    /// - mỗi lần sửa vẫn lưu ngay vào DuLieu\thatthoat.xml trên máy (bản đệm), rồi ~1 giây sau gửi cả bộ lên máy chủ
    ///   kèm phiên bản gốc; máy chủ tự gộp số điện thoại nhập trong lúc đó;
    /// - cứ 15 giây hỏi phiên bản trên máy chủ, có bản mới (điện thoại nhập, máy khác sửa) thì tải về thay;
    /// - mất mạng: giữ thay đổi trên máy (đánh dấu ChuaGui), tự gửi lại khi có mạng.
    /// Gọi trên luồng giao diện; việc mạng chạy nền.
    /// </summary>
    public class DongBoMayChu : IDisposable
    {
        readonly PhienLam phien;
        public readonly MayChuKetNoi Kn;
        readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer { Interval = 700 };
        readonly SynchronizationContext ui;
        bool dangBan, boQuaLuu, canTai, daBaoXungDot;
        DateTime lanSua = DateTime.MinValue, lanHoi = DateTime.MinValue, choDen = DateTime.MinValue;
        int loiLienTiep;

        public string TrangThai = "Đang kết nối máy chủ…";
        public bool Loi;                 // trạng thái đang là lỗi (tô màu cảnh báo)
        public bool CanDangNhap;         // mã đăng nhập hết hạn
        public DateTime? LanDongBo;
        public event EventHandler DoiTrangThai;
        /// <summary>Máy khác ghi đè trước, thay đổi trên máy này không gộp được (cửa sổ chính hiện thông báo).</summary>
        public event Action<string> BaoXungDot;

        /// <summary>Có được thay dữ liệu lúc này không (không mở hộp thoại, không đang gõ dở ô).</summary>
        public Func<bool> DuocThay = () => true;

        public DongBoMayChu(PhienLam phien, MayChuKetNoi kn)
        {
            this.phien = phien;
            Kn = kn;
            ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
            phien.Kho.DaLuu += KhoDaLuu;
            timer.Tick += (s, e) => Nhip();
            canTai = !kn.ChuaGui;   // mở phần mềm: lấy bản mới nhất (nếu còn thay đổi chưa gửi thì gửi trước)
        }

        public void BatDau()
        {
            timer.Start();
            Nhip();
        }

        public void Dispose()
        {
            timer.Stop();
            timer.Dispose();
            phien.Kho.DaLuu -= KhoDaLuu;
        }

        public bool CoThayDoiChuaGui { get { return Kn.ChuaGui; } }

        void KhoDaLuu(object sender, EventArgs e)
        {
            if (boQuaLuu) return;
            lanSua = DateTime.Now;
            if (!Kn.ChuaGui)
            {
                Kn.ChuaGui = true;
                LuuCauHinh();
            }
        }

        void LuuCauHinh()
        {
            try { Kn.Ghi(phien.Kho.ThuMuc); } catch (Exception) { }
        }

        void Bao(string s, bool loi)
        {
            TrangThai = s;
            Loi = loi;
            EventHandler h = DoiTrangThai;
            if (h != null) h(this, EventArgs.Empty);
        }

        void Nhip()
        {
            if (dangBan || CanDangNhap || DateTime.Now < choDen) return;
            if (Kn.ChuaGui && !Kn.LaQuanTri)
            {
                // tài khoản chỉ xem không gửi lên được: bỏ cờ, lấy bản máy chủ
                Kn.ChuaGui = false;
                LuuCauHinh();
                canTai = true;
            }
            if (Kn.ChuaGui)
            {
                if ((DateTime.Now - lanSua).TotalMilliseconds >= 900) Gui();
                return;
            }
            if (canTai) { Tai(); return; }
            if ((DateTime.Now - lanHoi).TotalSeconds >= 15) Hoi();
        }

        void Loi_(Exception ex)
        {
            var lm = ex as LoiMayChu;
            if (lm != null && lm.Status == 401)
            {
                CanDangNhap = true;
                Bao("Máy chủ: cần đăng nhập lại (Cài đặt → Máy chủ dữ liệu).", true);
                return;
            }
            loiLienTiep++;
            choDen = DateTime.Now.AddSeconds(Math.Min(60, 5 * loiLienTiep));
            Bao((lm != null && lm.MatKetNoi ? "Mất kết nối máy chủ" : "Máy chủ báo lỗi") + (Kn.ChuaGui ? " — thay đổi đang giữ trên máy, sẽ gửi lại" : "") + ". " + ex.Message, true);
        }

        void ThanhCong(string s)
        {
            loiLienTiep = 0;
            LanDongBo = DateTime.Now;
            Bao(s, false);
        }

        // ------------------------------------------------------------------ gửi lên

        void Gui()
        {
            byte[] xml = KhoDuLieu.GhiBytes(phien.Dl);
            long goc = Kn.PhienBan;
            DateTime moc = lanSua;
            dangBan = true;
            Bao("Đang gửi lên máy chủ…", false);
            Task.Factory.StartNew(() => Kn.GuiDuLieu(xml, goc, false)).ContinueWith(t => ui.Post(_ =>
            {
                dangBan = false;
                if (t.IsFaulted)
                {
                    Exception ex = t.Exception.GetBaseException();
                    var lm = ex as LoiMayChu;
                    if (lm != null && lm.Status == 409) { XungDot(lm.Message); return; }
                    Loi_(ex);
                    return;
                }
                Kn.PhienBan = t.Result.PhienBan;
                if (lanSua == moc) Kn.ChuaGui = false;     // không sửa thêm trong lúc gửi
                LuuCauHinh();
                if (t.Result.DaGop > 0) canTai = true;      // máy chủ đã gộp số điện thoại → tải bản gộp về
                lanHoi = DateTime.Now;
                ThanhCong("Đã lưu lên máy chủ lúc " + DateTime.Now.ToString("HH:mm:ss"));
            }, null));
        }

        /// <summary>Máy khác đã gửi cả bộ sau bản máy này có: không gộp được → giữ bản máy này vào SaoLuu rồi tải bản máy chủ.</summary>
        void XungDot(string ly)
        {
            string luu = "";
            try { luu = phien.Kho.SaoLuuNgay(); } catch (Exception) { }
            Kn.ChuaGui = false;
            LuuCauHinh();
            canTai = true;
            Bao("Máy khác vừa sửa dữ liệu — đang tải bản mới nhất.", true);
            Action<string> h = BaoXungDot;
            if (h != null && !daBaoXungDot)
            {
                daBaoXungDot = true;
                try { h(ly + "\n\nPhần mềm sẽ tải dữ liệu mới nhất từ máy chủ. Bản trên máy này (gồm thay đổi chưa gửi được) đã lưu tại:\n" + luu); }
                finally { daBaoXungDot = false; }
            }
        }

        // ------------------------------------------------------------------ hỏi / tải về

        void Hoi()
        {
            dangBan = true;
            lanHoi = DateTime.Now;
            Task.Factory.StartNew(() => Kn.LayPhienBan()).ContinueWith(t => ui.Post(_ =>
            {
                dangBan = false;
                if (t.IsFaulted) { Loi_(t.Exception.GetBaseException()); return; }
                if (t.Result != Kn.PhienBan) canTai = true;
                else ThanhCong("Đã đồng bộ máy chủ" + (LanDongBo.HasValue ? " · " + LanDongBo.Value.ToString("HH:mm") : ""));
                if (canTai) Nhip();
            }, null));
        }

        void Tai()
        {
            if (!DuocThay()) return;    // đang gõ / mở hộp thoại: để lần sau
            dangBan = true;
            Bao("Đang tải dữ liệu mới từ máy chủ…", false);
            Task.Factory.StartNew(() =>
            {
                long pb;
                byte[] b = Kn.TaiDuLieu(out pb);
                return Tuple.Create(KhoDuLieu.DocBytes(b), pb);
            }).ContinueWith(t => ui.Post(_ =>
            {
                dangBan = false;
                if (t.IsFaulted) { Loi_(t.Exception.GetBaseException()); return; }
                if (Kn.ChuaGui || !DuocThay()) return;      // vừa sửa / đang gõ: gửi trước, tải lại sau
                canTai = false;
                boQuaLuu = true;
                try
                {
                    phien.ThayDuLieu(t.Result.Item1);
                    try { phien.Kho.Luu(); } catch (Exception) { }   // bản đệm trên máy
                }
                finally { boQuaLuu = false; }
                Kn.PhienBan = t.Result.Item2;
                LuuCauHinh();
                ThanhCong("Đã tải bản mới từ máy chủ lúc " + DateTime.Now.ToString("HH:mm:ss"));
            }, null));
        }

        /// <summary>Đăng nhập lại xong (mã mới): chạy tiếp.</summary>
        public void DaDangNhapLai()
        {
            CanDangNhap = false;
            loiLienTiep = 0;
            choDen = DateTime.MinValue;
            LuuCauHinh();
            Nhip();
        }

        /// <summary>Gửi ngay những gì chưa gửi (đóng phần mềm). Trả false nếu chưa gửi được.</summary>
        public bool GuiNgay(int choMs)
        {
            if (!Kn.ChuaGui || CanDangNhap) return !Kn.ChuaGui;
            try
            {
                var t = Task.Factory.StartNew(() => Kn.GuiDuLieu(KhoDuLieu.GhiBytes(phien.Dl), Kn.PhienBan, false));
                if (!t.Wait(choMs)) return false;
                Kn.PhienBan = t.Result.PhienBan;
                Kn.ChuaGui = false;
                LuuCauHinh();
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }
    }
}
