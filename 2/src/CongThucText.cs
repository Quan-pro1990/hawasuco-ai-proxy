using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace ThatThoatNuoc
{
    /// <summary>
    /// Viết / đọc công thức bằng số thứ tự (STT) như cột "Chỉ số" của báo cáo:
    /// "1 + 2 - 3", "A1 - A1.1 - A1.2 + A2", "2.1 + BB + 2.2 - V.1.2".
    /// STT tìm trước trong cùng nhóm (A, B, I, II...), rồi toàn bảng; trùng thì ghi kèm nhóm: "V.1.2".
    /// </summary>
    public static class CongThucText
    {
        /// <summary>Vị trí dòng đầu nhóm (cấp 0) chứa dòng [index]; -1 nếu không có.</summary>
        public static int DauNhom(List<Muc> list, int index)
        {
            for (int i = index; i >= 0; i--) if (list[i].Cap == 0) return i;
            return -1;
        }

        static bool CungMa(Muc m, string ma)
        {
            return string.Equals(m.Stt.Trim(), ma, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>Các dòng thuộc nhóm bắt đầu tại [head] (kể cả dòng đầu nhóm).</summary>
        static IEnumerable<int> TrongNhom(List<Muc> list, int head)
        {
            if (head < 0) yield break;
            yield return head;
            for (int i = head + 1; i < list.Count && list[i].Cap != 0; i++) yield return i;
        }

        /// <summary>Chữ tham chiếu ngắn nhất để chỉ đúng dòng [target] khi đứng trong công thức của [owner].</summary>
        public static string MaThamChieu(ThangBaoCao t, Muc owner, Muc target)
        {
            List<Muc> list = t.Muc;
            string stt = target.Stt.Trim();
            if (stt.Length == 0 || stt.IndexOf(' ') >= 0) return "#" + target.Id;
            int oi = t.ViTri(owner.Id), ti = t.ViTri(target.Id);
            int og = oi >= 0 ? DauNhom(list, oi) : -1;
            int tg = ti >= 0 ? DauNhom(list, ti) : -1;
            if (og >= 0 && og == tg && TrongNhom(list, og).Count(i => CungMa(list[i], stt)) == 1) return stt;
            if (og != tg || og < 0)
            {
                if (list.Count(m => CungMa(m, stt)) == 1 && !(og >= 0 && TrongNhom(list, og).Any(i => CungMa(list[i], stt))))
                    return stt;
            }
            if (tg >= 0 && tg != ti)
            {
                string g = list[tg].Stt.Trim();
                if (g.Length > 0 && g.IndexOf('.') < 0 && TrongNhom(list, tg).Count(i => CungMa(list[i], stt)) == 1)
                    return g + "." + stt;
            }
            return "#" + target.Id;
        }

        public static string HienThi(ThangBaoCao t, Muc owner, List<SoHang> terms)
        {
            var sb = new StringBuilder();
            foreach (SoHang s in terms)
            {
                Muc target = t.Tim(s.Id);
                string ma = target == null ? "#" + s.Id + "?" : MaThamChieu(t, owner, target);
                double k = Math.Abs(s.HeSo);
                string phan = Math.Abs(k - 1) < 1e-12 ? ma : k.ToString("0.######", CultureInfo.InvariantCulture) + "*" + ma;
                if (sb.Length == 0) sb.Append(s.HeSo < 0 ? "- " : "").Append(phan);
                else sb.Append(s.HeSo < 0 ? " - " : " + ").Append(phan);
            }
            return sb.ToString();
        }

        /// <summary>Tìm dòng theo chữ tham chiếu; trả lỗi rõ ràng khi không thấy hoặc trùng.</summary>
        public static Muc Tim(ThangBaoCao t, Muc owner, string ma, out string loi)
        {
            loi = null;
            List<Muc> list = t.Muc;
            ma = ma.Trim();
            if (ma.StartsWith("#"))
            {
                int id;
                Muc m = int.TryParse(ma.Substring(1), out id) ? t.Tim(id) : null;
                if (m == null) loi = "Không có dòng " + ma;
                return m;
            }
            int oi = t.ViTri(owner.Id);
            int og = oi >= 0 ? DauNhom(list, oi) : -1;
            if (og >= 0)
            {
                var local = TrongNhom(list, og).Where(i => CungMa(list[i], ma)).ToList();
                if (local.Count == 1) return list[local[0]];
                if (local.Count > 1)
                {
                    loi = "Nhóm " + list[og].Stt + " có " + local.Count + " dòng cùng STT \"" + ma + "\"";
                    return null;
                }
            }
            var all = list.Where(m => CungMa(m, ma)).ToList();
            if (all.Count == 1) return all[0];
            if (all.Count > 1)
            {
                var groups = all.Select(m => { int gi = DauNhom(list, t.ViTri(m.Id)); return gi >= 0 ? list[gi].Stt.Trim() : "?"; });
                loi = "STT \"" + ma + "\" có ở nhiều nhóm (" + string.Join(", ", groups) + ") — ghi kèm nhóm, vd: " +
                      groups.First() + "." + ma;
                return null;
            }
            int dot = ma.IndexOf('.');
            if (dot > 0)
            {
                string g = ma.Substring(0, dot), rest = ma.Substring(dot + 1);
                for (int gi = 0; gi < list.Count; gi++)
                {
                    if (list[gi].Cap != 0 || !CungMa(list[gi], g)) continue;
                    var inGroup = TrongNhom(list, gi).Where(i => CungMa(list[i], rest)).ToList();
                    if (inGroup.Count == 1) return list[inGroup[0]];
                }
            }
            loi = "Không tìm thấy dòng có STT \"" + ma + "\"";
            return null;
        }

        /// <summary>Đọc công thức dạng "a + b - c", "0.5*X". Cho phép 1 cặp ngoặc bao ngoài cùng.</summary>
        public static bool Doc(ThangBaoCao t, Muc owner, string text, out List<SoHang> terms, out string loi)
        {
            terms = new List<SoHang>();
            loi = null;
            string s = (text ?? "").Trim().Replace('−', '-').Replace('–', '-');
            if (s.StartsWith("(") && s.EndsWith(")")) s = s.Substring(1, s.Length - 2).Trim();
            if (s.IndexOf('(') >= 0 || s.IndexOf(')') >= 0)
            {
                loi = "Công thức chỉ gồm các dòng cộng (+) trừ (-), không dùng dấu ngoặc bên trong";
                return false;
            }
            if (s.Length == 0)
            {
                loi = "Chưa nhập công thức";
                return false;
            }
            int i = 0;
            bool first = true;
            while (i < s.Length)
            {
                while (i < s.Length && s[i] == ' ') i++;
                if (i >= s.Length) break;
                double sign = 1;
                if (s[i] == '+' || s[i] == '-')
                {
                    sign = s[i] == '-' ? -1 : 1;
                    i++;
                }
                else if (!first)
                {
                    loi = "Thiếu dấu + hoặc - trước \"" + s.Substring(i) + "\"";
                    return false;
                }
                while (i < s.Length && s[i] == ' ') i++;
                int start = i;
                while (i < s.Length && s[i] != '+' && s[i] != '-') i++;
                string tok = s.Substring(start, i - start).Trim();
                if (tok.Length == 0)
                {
                    loi = "Công thức thiếu STT sau dấu " + (sign < 0 ? "-" : "+");
                    return false;
                }
                double k = 1;
                int star = tok.IndexOf('*');
                if (star >= 0)
                {
                    string ks = tok.Substring(0, star).Trim().Replace(',', '.');
                    if (!double.TryParse(ks, NumberStyles.Float, CultureInfo.InvariantCulture, out k))
                    {
                        loi = "Hệ số \"" + ks + "\" không hợp lệ";
                        return false;
                    }
                    tok = tok.Substring(star + 1).Trim();
                }
                if (tok.IndexOf(' ') >= 0)
                {
                    loi = "Thiếu dấu + hoặc - giữa \"" + tok + "\"";
                    return false;
                }
                string e;
                Muc m = Tim(t, owner, tok, out e);
                if (m == null)
                {
                    loi = e;
                    return false;
                }
                if (m.Id == owner.Id)
                {
                    loi = "Công thức không được dùng chính dòng này (" + tok + ")";
                    return false;
                }
                terms.Add(new SoHang(m.Id, sign * k));
                first = false;
            }
            return true;
        }
    }
}
