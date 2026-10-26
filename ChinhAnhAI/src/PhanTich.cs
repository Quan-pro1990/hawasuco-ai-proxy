using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace ChinhAnhAI
{
    /// <summary>Kết quả phân tích một ảnh: thông số chỉnh tự động, loại cảnh, các số đo dùng cho AI.</summary>
    public class KetQuaPhanTich
    {
        public ThongSo TuDong;          // chỉnh tự nhiên: sửa phơi sáng, cân bằng trắng, vùng sáng / tối, độ nét…
        public bool ChanDung, PhongCanh, Dem, NguocSang, SuongMu;
        public double Nhieu;            // độ lệch chuẩn nhiễu đo trên ảnh gốc, thang 0..255
        public double DoSangTrungVi;    // 0..1 (giá trị hiển thị)
        public double TiLeDa, TiLeTroi, TiLeCay, BaoHoaTB, KenhToiTB;
        public double LechNhietDo, LechSacDo;   // ám màu đo được (thanh Nhiệt độ / Sắc độ cần để trung hoà hoàn toàn)
        public System.Drawing.RectangleF[] KhuonMat = new System.Drawing.RectangleF[0];
        public double DoSangMat = -1;
        public int RongGoc, CaoGoc;
        public string MoTa = "";

        public string LoaiCanh
        {
            get
            {
                if (ChanDung) return "chân dung";
                if (Dem) return "cảnh đêm";
                if (PhongCanh) return "phong cảnh";
                return "ảnh thường";
            }
        }

        public Dictionary<string, object> ThongKe()
        {
            Func<double, double> l = v => Math.Round(v, 3);
            return new Dictionary<string, object>
            {
                { "kich_thuoc_goc", RongGoc + "x" + CaoGoc },
                { "do_sang_trung_vi", l(DoSangTrungVi) },
                { "nhieu_8bit", Math.Round(Nhieu, 2) },
                { "ty_le_mau_da", l(TiLeDa) },
                { "ty_le_bau_troi", l(TiLeTroi) },
                { "ty_le_cay_co", l(TiLeCay) },
                { "bao_hoa_trung_binh", l(BaoHoaTB) },
                { "kenh_toi_trung_binh", l(KenhToiTB) },
                { "am_mau_nhiet_do", Math.Round(LechNhietDo) },
                { "am_mau_sac_do", Math.Round(LechSacDo) },
                { "nguoc_sang", NguocSang },
                { "suong_mu", SuongMu },
                { "canh_dem", Dem },
                { "so_khuon_mat", KhuonMat.Length },
                { "do_sang_mat", DoSangMat < 0 ? (object)null : l(DoSangMat) },
            };
        }
    }

    /// <summary>Phân tích ảnh và tính thông số chỉnh tự động — chạy trên máy, không cần mạng.</summary>
    public static class PhanTich
    {
        public const int CanhPhanTich = 512;

        /// <summary>
        /// Phân tích ảnh <paramref name="goc"/> (cỡ thật, để đo nhiễu); <paramref name="xemTruoc"/> là bản thu nhỏ có sẵn
        /// (để đỡ thu nhỏ lại từ ảnh lớn). Ghi khuôn mặt tìm được vào cả hai.
        /// </summary>
        public static KetQuaPhanTich Chay(AnhNguon goc, AnhNguon xemTruoc)
        {
            AnhNguon nguon = xemTruoc ?? goc;
            AnhNguon choMat = nguon.ThuNho(640);
            AnhNguon nho = choMat.ThuNho(CanhPhanTich);
            var kq = new KetQuaPhanTich { RongGoc = goc.W, CaoGoc = goc.H };
            kq.Nhieu = DoNhieu(goc);
            // bộ nhận diện Haar đôi khi bắt nhầm hoa văn: chỉ giữ khung có đủ màu da ở giữa
            kq.KhuonMat = NhanDienMat.Tim(choMat).Where(f => TiLeDaTrong(choMat, f) > 0.2).ToArray();
            goc.KhuonMat = kq.KhuonMat;
            if (xemTruoc != null) xemTruoc.KhuonMat = kq.KhuonMat;
            nho.KhuonMat = kq.KhuonMat;

            int w = nho.W, h = nho.H, n = w * h;
            float[] r = new float[n], g = new float[n], b = new float[n];
            for (int i = 0; i < n; i++)
            {
                b[i] = Mau.Lin8[nho.Bgr[i * 3]]; g[i] = Mau.Lin8[nho.Bgr[i * 3 + 1]]; r[i] = Mau.Lin8[nho.Bgr[i * 3 + 2]];
            }
            var t = new ThongSo();

            // --- Cân bằng trắng: "shades of gray" (p = 6) chỉ trên các điểm gần trung tính (tường, mây, áo trắng…),
            // bỏ điểm cháy / quá tối / có màu rõ — để con mèo vàng hay bãi cỏ xanh không bị coi là ám màu.
            double sr = 0, sg = 0, sb = 0, sw = 0;
            for (int i = 0; i < n; i++)
            {
                float mx = Math.Max(r[i], Math.Max(g[i], b[i]));
                float y = 0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i];
                if (mx > 0.92f || y < 0.008f) continue;
                float R = Mau.MaHoa(r[i]), G = Mau.MaHoa(g[i]), B = Mau.MaHoa(b[i]);
                float mxg = Math.Max(R, Math.Max(G, B)), mng = Math.Min(R, Math.Min(G, B));
                float bh = (mxg - mng) / Math.Max(1e-3f, mxg);
                if (bh > 0.3f) continue;
                double u = 1 - bh / 0.3;
                double wt = u * u * Math.Sqrt(y);
                sr += wt * Math.Pow(r[i], 6); sg += wt * Math.Pow(g[i], 6); sb += wt * Math.Pow(b[i], 6);
                sw += wt;
            }
            double nhietDo = 0, sacDo = 0;
            double swCan = 0;
            for (int i = 0; i < n; i++) swCan += Math.Sqrt(Math.Max(0, 0.2126f * r[i] + 0.7152f * g[i] + 0.0722f * b[i]));
            if (sw > swCan * 0.02 && sr > 0 && sg > 0 && sb > 0)
            {
                double er = Math.Pow(sr / sw, 1 / 6.0), eg = Math.Pow(sg / sw, 1 / 6.0), eb = Math.Pow(sb / sw, 1 / 6.0);
                XuLyAnh.TuHeSo(1 / er, 1 / eg, 1 / eb, out nhietDo, out sacDo);
                kq.LechNhietDo = nhietDo; kq.LechSacDo = sacDo;
                // Không trung hoà hết: ánh nắng chiều, đèn vàng trong nhà vẫn nên còn chút ấm như mắt người thấy.
                nhietDo *= nhietDo < 0 ? 0.5 : 0.75;
                sacDo *= 0.65;
                if (Math.Abs(kq.LechNhietDo) > 60) nhietDo *= 0.5;      // lệch quá nhiều: nhiều khả năng là màu chủ ý (hoàng hôn, sân khấu)
                if (sw < swCan * 0.08) { nhietDo *= 0.6; sacDo *= 0.6; }    // ít điểm trung tính để tin
                if (Math.Abs(nhietDo) < 4) nhietDo = 0;
                if (Math.Abs(sacDo) < 3) sacDo = 0;
                nhietDo = Math.Max(-30, Math.Min(30, nhietDo));
                sacDo = Math.Max(-20, Math.Min(20, sacDo));
            }
            t[TS.NhietDo] = Math.Round(nhietDo);
            t[TS.SacDo] = Math.Round(sacDo);

            // --- Nhận diện cảnh: da người, bầu trời, cây cỏ, độ bão hòa
            double da = 0, daGiua = 0, troi = 0, cay = 0, bhTong = 0; int nGiua = 0, nTren = 0;
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    int i = y * w + x;
                    float R = Mau.MaHoa(r[i]), G = Mau.MaHoa(g[i]), B = Mau.MaHoa(b[i]);
                    float mx = Math.Max(R, Math.Max(G, B)), mn = Math.Min(R, Math.Min(G, B));
                    float bh = mx - mn;
                    bhTong += bh;
                    float d = Mau.DoDa(R, G, B);
                    da += d;
                    bool giua = x > w * 0.15 && x < w * 0.85 && y < h * 0.85;
                    if (giua) { daGiua += d; nGiua++; }
                    double sac = SacDo(R, G, B);
                    if (y < h * 0.45)
                    {
                        nTren++;
                        if (sac >= 185 && sac <= 250 && bh > 0.08f && mx > 0.35f) troi++;
                        else if (bh < 0.08f && mx > 0.75f) troi += 0.4;    // trời trắng / mây
                    }
                    if (sac >= 65 && sac <= 165 && bh > 0.12f && mx > 0.12f) cay++;
                }
            kq.TiLeDa = da / n;
            kq.TiLeTroi = nTren > 0 ? troi / nTren : 0;
            kq.TiLeCay = cay / n;
            kq.BaoHoaTB = bhTong / n;
            // chân dung khi có khuôn mặt đủ lớn (≥ ~0,6% diện tích ảnh, tức mặt rộng ≥ 8% ảnh vuông)
            double matLonNhat = kq.KhuonMat.Length == 0 ? 0 : kq.KhuonMat.Max(f => (double)f.Width * f.Height);
            kq.ChanDung = matLonNhat >= 0.006;
            kq.PhongCanh = !kq.ChanDung && (kq.TiLeTroi > 0.25 || kq.TiLeCay > 0.30);

            // --- Phơi sáng
            double gr, gg, gb;
            XuLyAnh.HeSoCanBangTrang(t[TS.NhietDo], t[TS.SacDo], out gr, out gg, out gb);
            float[] Y = new float[n];
            double logTong = 0;
            for (int i = 0; i < n; i++)
            {
                Y[i] = (float)(0.2126 * r[i] * gr + 0.7152 * g[i] * gg + 0.0722 * b[i] * gb);
                logTong += Math.Log(Y[i] + 1e-4);
            }
            double logTB = Math.Exp(logTong / n);
            float[] P = Y.Select(v => Mau.MaHoa(v)).ToArray();
            int[] hist = XuLyAnh.BieuDo(P, 0, 1.0001f, 1024);
            double p50 = XuLyAnh.PhanVi(hist, 0.5, 0, 1.0001), p99 = XuLyAnh.PhanVi(hist, 0.99, 0, 1.0001);
            kq.DoSangTrungVi = p50;
            kq.Dem = logTB < 0.012 && p99 > 0.35;

            double ev1 = Math.Log(0.18 / Math.Max(1e-4, logTB), 2);
            double ev2 = Math.Log(Mau.GiaiMaChinhXac(0.48) / Math.Max(1e-4, Mau.GiaiMaChinhXac(p50)), 2);
            double ev = (0.5 * ev1 + 0.5 * ev2) * 0.75;
            if (kq.ChanDung)
            {
                // đo sáng theo mặt như thợ ảnh: da sáng vừa (≈ 0,58), không phụ thuộc phông nền sáng / tối
                var daMat = new List<float>();
                foreach (var f in kq.KhuonMat)
                    for (int y = (int)((f.Y + f.Height * 0.25) * h); y < (int)((f.Y + f.Height * 0.85) * h); y++)
                        for (int x = (int)((f.X + f.Width * 0.2) * w); x < (int)((f.X + f.Width * 0.8) * w); x++)
                            if (x >= 0 && y >= 0 && x < w && y < h) daMat.Add(P[y * w + x]);
                if (daMat.Count > 20)
                {
                    daMat.Sort();
                    double pMat = daMat[daMat.Count / 2];
                    kq.DoSangMat = pMat;
                    double evMat = Math.Log(Mau.GiaiMaChinhXac(0.58) / Math.Max(1e-4, Mau.GiaiMaChinhXac(pMat)), 2);
                    ev = 0.45 * ev + 0.55 * Math.Max(-1.0, Math.Min(1.2, evMat)) * 0.85;
                }
            }
            if (p50 > 0.62 && ev < 0) ev *= 0.4;            // ảnh chủ ý sáng (tuyết, nền trắng): không kéo tối nhiều
            if (kq.Dem) ev = Math.Min(ev * 0.4, 0.6);       // đêm phải còn là đêm
            ev = Math.Max(-1.2, Math.Min(2.0, ev));

            // --- Vùng tối / vùng sáng sau khi đã chỉnh phơi sáng
            double toi = 0, sang = 0, chay = 0;
            float kEv = (float)Math.Pow(2, ev);
            for (int i = 0; i < n; i++)
            {
                float pp = Mau.MaHoa(Y[i] * kEv);
                if (pp < 0.2f) toi++;
                if (pp > 0.85f) sang++;
                if (pp > 0.98f) chay++;
            }
            toi /= n; sang /= n; chay /= n;
            kq.NguocSang = toi > 0.22 && sang > 0.06 && !kq.Dem;
            if (kq.NguocSang) ev *= 0.7;
            if (Math.Abs(ev) < 0.08) ev = 0;
            t[TS.PhoiSang] = Math.Round(ev, 2);

            double vt = Math.Min(60, 8 + 110 * toi) + (kq.NguocSang ? 12 : 0);
            if (kq.Dem) vt = Math.Min(vt, 25);
            double vs = -Math.Min(70, 10 + 160 * sang + 200 * chay);
            t[TS.VungToi] = Math.Round(vt);
            t[TS.VungSang] = Math.Round(vs);

            // --- Sương mù: kênh tối trung bình cao và điểm đen bị bạc
            var mnArr = new float[n];
            for (int i = 0; i < n; i++) mnArr[i] = Mau.MaHoa(Math.Min(r[i], Math.Min(g[i], b[i])));
            float[] kenhToi = BoLoc.LocMin(mnArr, w, h, Math.Max(2, Math.Max(w, h) / 70));
            kq.KenhToiTB = kenhToi.Average();
            double p02 = XuLyAnh.PhanVi(hist, 0.02, 0, 1.0001);
            kq.SuongMu = kq.KenhToiTB > 0.22 && p02 > 0.12;
            t[TS.KhuSuongMu] = kq.SuongMu ? Math.Round(Math.Min(45, (kq.KenhToiTB - 0.17) * 140)) : 0;

            // --- Màu sắc, độ rõ
            t[TS.SongDong] = Math.Round(Math.Max(0, Math.Min(40, 10 + (0.30 - kq.BaoHoaTB) * 120)));
            t[TS.BaoHoa] = kq.BaoHoaTB < 0.12 ? 5 : 0;
            t[TS.RoNet] = kq.ChanDung ? 0 : (kq.PhongCanh ? 18 : (kq.Dem ? 5 : 10));
            if (kq.SuongMu) t[TS.RoNet] += 5;

            // --- Nhiễu: nhiễu thật sau khi kéo sáng sẽ lớn hơn
            double nhieuSau = kq.Nhieu * Math.Pow(2, Math.Max(0, ev) * 0.5) * (1 + vt / 100 * 0.6);
            double gn = Math.Max(0, Math.Min(70, (nhieuSau - 1.6) * 14));
            if (kq.Dem && kq.Nhieu > 1.5) gn = Math.Max(gn, 20);
            t[TS.GiamNhieu] = Math.Round(gn);

            double ln = kq.ChanDung ? 28 : 40;
            if ((double)goc.W * goc.H < 1.5e6) ln = 25;
            ln -= gn * 0.25;
            t[TS.LamNet] = Math.Round(Math.Max(10, ln));
            t[TS.LamMinDa] = kq.ChanDung ? 22 : 0;

            // --- Tương phản, điểm đen / trắng: dựng thử ảnh nhỏ với thông số hiện có rồi đo
            ThongSo thu = t.Sao();
            thu[TS.LamNet] = 0; thu[TS.GiamNhieu] = 0; thu[TS.LamMinDa] = 0;
            DoTong(nho, thu, t);

            t.Kep();
            kq.TuDong = t;
            kq.MoTa = MoTaCanh(kq, t);
            return kq;
        }

        /// <summary>Dựng thử rồi đặt Tương phản, Điểm trắng, Điểm đen để ảnh đủ "đậm đà" mà không cháy / bết.</summary>
        static void DoTong(AnhNguon nho, ThongSo thu, ThongSo t)
        {
            byte[] ra = XuLyAnh.Ve(nho, thu);
            int n = nho.W * nho.H;
            float[] y = new float[n];
            for (int i = 0; i < n; i++)
                y[i] = (0.0722f * ra[i * 3] + 0.7152f * ra[i * 3 + 1] + 0.2126f * ra[i * 3 + 2]) / 255f;
            int[] hist = XuLyAnh.BieuDo(y, 0, 1.0001f, 1024);
            double p005 = XuLyAnh.PhanVi(hist, 0.005, 0, 1.0001), p995 = XuLyAnh.PhanVi(hist, 0.995, 0, 1.0001);
            double p25 = XuLyAnh.PhanVi(hist, 0.25, 0, 1.0001), p75 = XuLyAnh.PhanVi(hist, 0.75, 0, 1.0001);

            double tp = 10 + (0.30 - (p75 - p25)) * 110;
            t[TS.TuongPhan] = Math.Round(Math.Max(-15, Math.Min(35, tp)));

            double diemTrang = 0;
            if (p995 < 0.95) diemTrang = (1 - p995 / 0.97) / XuLyAnh.HeSoDiemTrang * 100;
            t[TS.DiemTrang] = Math.Round(Math.Max(-20, Math.Min(80, diemTrang)));
            double wp = 1 - t[TS.DiemTrang] / 100 * XuLyAnh.HeSoDiemTrang;
            double bp = (p005 - 0.025 * wp) / (1 - 0.025);
            t[TS.DiemDen] = Math.Round(Math.Max(-100, Math.Min(5, -bp / XuLyAnh.HeSoDiemDen * 100)));
        }

        static double TiLeDaTrong(AnhNguon a, System.Drawing.RectangleF f)
        {
            int x0 = (int)((f.X + f.Width * 0.25) * a.W), x1 = (int)((f.X + f.Width * 0.75) * a.W);
            int y0 = (int)((f.Y + f.Height * 0.3) * a.H), y1 = (int)((f.Y + f.Height * 0.8) * a.H);
            double tong = 0; int dem = 0;
            for (int y = Math.Max(0, y0); y < Math.Min(a.H, y1); y++)
                for (int x = Math.Max(0, x0); x < Math.Min(a.W, x1); x++)
                {
                    int j = (y * a.W + x) * 3;
                    tong += Mau.DoDa(a.Bgr[j + 2] / 255f, a.Bgr[j + 1] / 255f, a.Bgr[j] / 255f);
                    dem++;
                }
            return dem > 0 ? tong / dem : 0;
        }

        static double SacDo(float r, float g, float b)
        {
            float mx = Math.Max(r, Math.Max(g, b)), mn = Math.Min(r, Math.Min(g, b));
            float d = mx - mn;
            if (d < 1e-4f) return -1;
            double h;
            if (mx == r) h = 60 * (((g - b) / d) % 6);
            else if (mx == g) h = 60 * ((b - r) / d + 2);
            else h = 60 * ((r - g) / d + 4);
            return h < 0 ? h + 360 : h;
        }

        /// <summary>
        /// Ước lượng nhiễu (Immerkær 1996) trên vùng giữa ảnh gốc, không thu nhỏ — thu nhỏ sẽ làm mất nhiễu.
        /// Dùng trung vị nên ít bị cạnh vật thể ảnh hưởng.
        /// </summary>
        public static double DoNhieu(AnhNguon a)
        {
            int cw = Math.Min(a.W, 1200), ch = Math.Min(a.H, 1200);
            int x0 = (a.W - cw) / 2, y0 = (a.H - ch) / 2;
            if (cw < 16 || ch < 16) return 0;
            var xam = new float[cw * ch];
            for (int y = 0; y < ch; y++)
                for (int x = 0; x < cw; x++)
                {
                    int j = ((y0 + y) * a.W + x0 + x) * 3;
                    xam[y * cw + x] = 0.114f * a.Bgr[j] + 0.587f * a.Bgr[j + 1] + 0.299f * a.Bgr[j + 2];
                }
            var gt = new List<float>(cw * ch);
            for (int y = 1; y < ch - 1; y++)
                for (int x = 1; x < cw - 1; x++)
                {
                    int i = y * cw + x;
                    float v = xam[i];
                    if (v < 6 || v > 249) continue;     // vùng cháy / đen kịt không có nhiễu để đo
                    float s = xam[i - cw - 1] - 2 * xam[i - cw] + xam[i - cw + 1]
                            - 2 * xam[i - 1] + 4 * v - 2 * xam[i + 1]
                            + xam[i + cw - 1] - 2 * xam[i + cw] + xam[i + cw + 1];
                    gt.Add(Math.Abs(s));
                }
            if (gt.Count < 100) return 0;
            gt.Sort();
            return gt[gt.Count / 2] / (0.6745 * 6);
        }

        static string MoTaCanh(KetQuaPhanTich kq, ThongSo t)
        {
            var ds = new List<string>();
            ds.Add(char.ToUpper(kq.LoaiCanh[0]) + kq.LoaiCanh.Substring(1));
            if (kq.NguocSang) ds.Add("ngược sáng");
            if (kq.SuongMu) ds.Add("mờ sương");
            double ev = t[TS.PhoiSang];
            if (ev >= 0.3) ds.Add("hơi tối (+" + ev.ToString("0.0", CultureInfo.InvariantCulture) + " EV)");
            else if (ev <= -0.3) ds.Add("hơi sáng (" + ev.ToString("0.0", CultureInfo.InvariantCulture) + " EV)");
            if (kq.LechNhietDo <= -12) ds.Add("ám vàng");
            else if (kq.LechNhietDo >= 12) ds.Add("ám xanh lạnh");
            if (kq.LechSacDo >= 10) ds.Add("ám xanh lá");
            else if (kq.LechSacDo <= -10) ds.Add("ám hồng tím");
            ds.Add(kq.Nhieu < 2 ? "nhiễu thấp" : (kq.Nhieu < 4 ? "nhiễu vừa" : "nhiễu nhiều"));
            return string.Join(" · ", ds);
        }
    }

    public class PhongCach
    {
        public string Ma, Ten, MoTa;
        public PhongCach(string ma, string ten, string moTa) { Ma = ma; Ten = ten; MoTa = moTa; }

        public const string AI = "ai";

        public static readonly PhongCach[] DanhSach =
        {
            new PhongCach("tu_dong", "Tự động", "Tự chọn kiểu hợp với cảnh"),
            new PhongCach("tu_nhien", "Tự nhiên", "Chỉ sửa lỗi sáng, màu"),
            new PhongCach("song_dong", "Sống động", "Màu tươi, rõ nét"),
            new PhongCach("chan_dung", "Chân dung", "Da mịn, ấm, nền dịu"),
            new PhongCach("phong_canh", "Phong cảnh", "Trời xanh, cây tươi, trong"),
            new PhongCach("sang_trong", "Sáng trong", "Sáng, nhẹ, trong trẻo"),
            new PhongCach("am_ap", "Ấm áp", "Nắng vàng, hoài niệm"),
            new PhongCach("dien_anh", "Điện ảnh", "Xanh ngọc - cam, phim"),
            new PhongCach("den_trang", "Đen trắng", "Tương phản, cổ điển"),
        };

        public static PhongCach Tim(string ma)
        {
            return DanhSach.FirstOrDefault(p => p.Ma == ma);
        }

        /// <summary>Thông số của phong cách = chỉnh tự động (sửa lỗi kỹ thuật) + cá tính của phong cách.</summary>
        public static ThongSo Ap(KetQuaPhanTich kq, string ma)
        {
            ThongSo t = kq.TuDong.Sao();
            switch (ma)
            {
                case "tu_dong":
                    if (kq.ChanDung) return Ap(kq, "chan_dung");
                    if (kq.PhongCanh) return Ap(kq, "phong_canh");
                    if (!kq.Dem) { t[TS.SongDong] += 6; t[TS.RoNet] += 5; t[TS.TuongPhan] += 5; }
                    break;
                case "song_dong":
                    t[TS.SongDong] += 20; t[TS.BaoHoa] += 8; t[TS.RoNet] += 12; t[TS.TuongPhan] += 12;
                    t[TS.KhuSuongMu] += 6; t[TS.DiemDen] -= 6;
                    break;
                case "chan_dung":
                    t[TS.NhietDo] += 6; t[TS.SongDong] = Math.Min(t[TS.SongDong], 12); t[TS.BaoHoa] -= 3;
                    t[TS.RoNet] -= 8; t[TS.LamMinDa] = Math.Max(t[TS.LamMinDa], 35); t[TS.TuongPhan] -= 4;
                    t[TS.VungToi] += 8; t[TS.VienToi] -= 15; t[TS.LamNet] *= 0.75;
                    break;
                case "phong_canh":
                    t[TS.KhuSuongMu] += 12; t[TS.RoNet] += 18; t[TS.SongDong] += 22; t[TS.VungSang] -= 15;
                    t[TS.NhietDo] += 3; t[TS.VienToi] -= 10; t[TS.TuongPhan] += 6;
                    break;
                case "sang_trong":
                    t[TS.PhoiSang] += 0.25; t[TS.VungToi] += 15; t[TS.TuongPhan] -= 12; t[TS.VungSang] -= 10;
                    t[TS.SongDong] += 8; t[TS.BaoHoa] -= 4; t[TS.NhietDo] -= 4; t[TS.DiemDen] += 6; t[TS.RoNet] -= 4;
                    break;
                case "am_ap":
                    t[TS.NhietDo] += 18; t[TS.SacDo] += 4; t[TS.SongDong] += 8; t[TS.LamPhai] += 6;
                    t[TS.MauSangSac] = 40; t[TS.MauSangDo] = 22; t[TS.VienToi] -= 12; t[TS.VungSang] -= 8;
                    break;
                case "dien_anh":
                    t[TS.MauToiSac] = 190; t[TS.MauToiDo] = 40; t[TS.MauSangSac] = 32; t[TS.MauSangDo] = 32;
                    t[TS.BaoHoa] -= 14; t[TS.TuongPhan] += 18; t[TS.LamPhai] += 14; t[TS.VienToi] -= 20;
                    t[TS.NhietDo] += 4; t[TS.VungSang] -= 10;
                    break;
                case "den_trang":
                    t.DenTrang = true; t[TS.TuongPhan] += 22; t[TS.RoNet] += 15; t[TS.DiemDen] -= 10;
                    t[TS.VienToi] -= 14; t[TS.VungSang] -= 10;
                    break;
            }
            return t.Kep();
        }
    }
}
