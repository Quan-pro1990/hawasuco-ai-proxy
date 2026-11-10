package vn.com.hawasuco.taisan;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.util.EnumMap;
import java.util.Map;
import java.util.Random;

/**
 * Kiểm thử DocQR trên máy tính (không cần điện thoại): dựng khung hình camera giả (NV21 1280×720, nền nhiễu, tem QR
 * xoay 0/90/180/270°, lệch tâm, nhỏ / to, mờ tương phản) rồi đọc như ManQuet. Chạy: kiem-thu/thu-doc-qr.sh
 */
public class ThuDocQR {
    static int hong;

    public static void main(String[] a) throws Exception {
        String noiDung = "https://taisan.congty.vn/t/MB-00012";
        Map<EncodeHintType, Object> h = new EnumMap<EncodeHintType, Object>(EncodeHintType.class);
        h.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
        h.put(EncodeHintType.MARGIN, 2);
        BitMatrix qr = new QRCodeWriter().encode(noiDung, BarcodeFormat.QR_CODE, 0, 0, h);
        int w = 1280, hh = 720, canh = 520;   // canh: cạnh khung ngắm theo điểm ảnh camera
        //        cỡ tem, lệch x, lệch y, xoay, tương phản (0..1), cần đọc được trong khung ngắm
        Object[][] ca = {
            { 300, 0, 0, 0, 1.0, true }, { 300, 0, 0, 90, 1.0, true }, { 260, 30, -20, 180, 0.6, true }, { 200, 0, 0, 270, 0.45, true },
            { 460, 0, 0, 90, 1.0, true }, { 140, 0, 0, 0, 0.8, true }, { 260, 420, 150, 0, 1.0, false },   // lệch hẳn khung: đọc nhờ lượt cả khung
        };
        for (Object[] c : ca) {
            byte[] khung = dung(qr, w, hh, (Integer) c[0], (Integer) c[1], (Integer) c[2], (Integer) c[3], (Double) c[4]);
            DocQR d = new DocQR();
            String kq = null;
            int lan = 0;
            while (kq == null && lan < 4) { kq = d.doc(khung, w, hh, canh); lan++; }
            boolean dung = noiDung.equals(kq);
            String ten = "tem " + c[0] + "px lệch (" + c[1] + "," + c[2] + ") xoay " + c[3] + "° tương phản " + c[4];
            System.out.println((dung ? "OK  " : "SAI ") + ten + " → " + kq + " (lượt " + lan + ")");
            if (!dung || ((Boolean) c[5] && lan == 4)) hong++;
        }
        // khung hình 1920×1080 (cỡ xem trước app chọn), tem nhỏ nghiêng, ánh sáng không đều, hơi mờ
        //        cỡ tem, góc nghiêng (độ), sáng trái → phải
        Object[][] ca2 = { { 150, 20.0, true }, { 110, -35.0, true }, { 220, 8.0, false } };
        for (Object[] c : ca2) {
            int W = 1920, H = 1080;
            int[] xam = anh(qr, W, H, (Integer) c[0], (Double) c[1], (Boolean) c[2]);
            byte[] khung = new byte[W * H * 3 / 2];
            for (int i = 0; i < W * H; i++) khung[i] = (byte) xam[i];
            for (int i = W * H; i < khung.length; i++) khung[i] = (byte) 128;
            DocQR d = new DocQR();
            String kq = null;
            int lan = 0;
            while (kq == null && lan < 12) { kq = d.doc(khung, W, H, 800); lan++; }
            boolean dung = noiDung.equals(kq);
            System.out.println((dung ? "OK  " : "SAI ") + "khung 1920×1080, tem " + c[0] + "px nghiêng " + c[1] + "° sáng lệch, mờ → " + kq + " (lượt " + lan + ")");
            if (!dung) hong++;
        }
        // ảnh chụp (nút "Chụp để đọc"): 2000×1500 ARGB, tem nhỏ ở xa, nghiêng, mờ, sáng lệch
        Object[][] ca3 = { { 120, 15.0, true }, { 90, -50.0, true }, { 300, 3.0, false } };
        for (Object[] c : ca3) {
            int W = 2000, H = 1500;
            int[] xam = anh(qr, W, H, (Integer) c[0], (Double) c[1], (Boolean) c[2]);
            int[] argb = new int[W * H];
            for (int i = 0; i < argb.length; i++) argb[i] = 0xFF000000 | (xam[i] << 16) | (xam[i] << 8) | (int) (xam[i] * 0.9);
            String kq = new DocQR().docAnh(argb, W, H);
            boolean dung = noiDung.equals(kq);
            System.out.println((dung ? "OK  " : "SAI ") + "ảnh chụp 2000×1500, tem " + c[0] + "px nghiêng " + c[1] + "° → " + kq);
            if (!dung) hong++;
        }
        // khung hình không có tem: không được đọc bừa
        byte[] trong = dung(null, w, hh, 0, 0, 0, 0, 1);
        DocQR d = new DocQR();
        String kq = null;
        for (int i = 0; i < 8 && kq == null; i++) kq = d.doc(trong, w, hh, canh);
        System.out.println((kq == null ? "OK  " : "SAI ") + "khung hình không có tem → " + kq);
        if (kq != null) hong++;
        System.out.println(hong == 0 ? "TẤT CẢ ĐẠT" : hong + " TRƯỜNG HỢP SAI");
        System.exit(hong == 0 ? 0 : 1);
    }

    /** Ảnh xám w×h: nền nhiễu (sáng lệch trái → phải nếu sangLech), tem QR cạnh co ở giữa nghiêng goc độ, làm mờ 3×3. */
    static int[] anh(BitMatrix qr, int w, int h, int co, double goc, boolean sangLech) {
        int[] a = new int[w * h];
        Random r = new Random(11);
        int n = qr.getWidth();
        double cs = Math.cos(Math.toRadians(goc)), sn = Math.sin(Math.toRadians(goc));
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++) {
                double dx = x - w / 2.0, dy = y - h / 2.0;
                double u = (dx * cs + dy * sn) / co + 0.5, v = (-dx * sn + dy * cs) / co + 0.5;
                int g;
                if (u >= 0 && u < 1 && v >= 0 && v < 1) g = qr.get((int) (u * n), (int) (v * n)) ? 40 : 215;
                else g = 100 + r.nextInt(50);
                if (sangLech) g = (int) (g * (0.55 + 0.6 * x / w));
                a[y * w + x] = Math.max(0, Math.min(255, g + r.nextInt(20) - 10));
            }
        int[] m = new int[w * h];
        for (int y = 1; y < h - 1; y++)
            for (int x = 1; x < w - 1; x++) {
                int t = 0;
                for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) t += a[(y + j) * w + x + i];
                m[y * w + x] = t / 9;
            }
        return m;
    }

    /** Khung NV21: nền xám nhiễu, tem QR (nền trắng, chấm đen) ở giữa + lệch, xoay, giảm tương phản. */
    static byte[] dung(BitMatrix qr, int w, int h, int co, int dx, int dy, int xoay, double tuongPhan) {
        byte[] b = new byte[w * h * 3 / 2];
        Random r = new Random(7);
        for (int i = 0; i < w * h; i++) b[i] = (byte) (90 + r.nextInt(60));
        for (int i = w * h; i < b.length; i++) b[i] = (byte) 128;
        if (qr == null) return b;
        int n = qr.getWidth(), x0 = (w - co) / 2 + dx, y0 = (h - co) / 2 + dy;
        int trang = (int) (128 + 110 * tuongPhan), den = (int) (128 - 110 * tuongPhan);
        for (int y = 0; y < co; y++)
            for (int x = 0; x < co; x++) {
                int u = x * n / co, v = y * n / co, uu = u, vv = v;
                if (xoay == 90) { uu = v; vv = n - 1 - u; }
                else if (xoay == 180) { uu = n - 1 - u; vv = n - 1 - v; }
                else if (xoay == 270) { uu = n - 1 - v; vv = u; }
                int px = x0 + x, py = y0 + y;
                if (px < 0 || py < 0 || px >= w || py >= h) continue;
                b[py * w + px] = (byte) ((qr.get(uu, vv) ? den : trang) + r.nextInt(16) - 8);
            }
        return b;
    }
}
