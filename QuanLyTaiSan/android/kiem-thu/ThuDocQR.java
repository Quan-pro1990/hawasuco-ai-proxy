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
