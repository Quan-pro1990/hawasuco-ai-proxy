package vn.com.hawasuco.taisan;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.common.GlobalHistogramBinarizer;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/**
 * Đọc mã QR bằng ZXing: trong khung hình camera (NV21: w×h điểm sáng Y rồi tới màu) hoặc trong ảnh chụp (ARGB).
 * Java thuần, không dùng Android (kiểm thử được trên máy tính và trên máy ảo: kiem-thu/ThuDocQR.java).
 * Một đối tượng chỉ dùng trên 1 luồng.
 */
final class DocQR {
    final QRCodeReader doc = new QRCodeReader();
    final Map<DecodeHintType, Object> goiY = new EnumMap<DecodeHintType, Object>(DecodeHintType.class);
    int soKhung;

    DocQR() {
        goiY.put(DecodeHintType.POSSIBLE_FORMATS, Collections.singletonList(BarcodeFormat.QR_CODE));
        goiY.put(DecodeHintType.CHARACTER_SET, "UTF-8");
        goiY.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
    }

    /**
     * Khung hình camera: đọc vùng vuông cạnh canh ở giữa (khung ngắm); cứ 4 khung thì đọc cả khung hình (tem nằm lệch
     * khung ngắm), cứ 3 khung thì dùng cách tách đen trắng thứ hai (ảnh tối, loá, tem in mờ).
     * Trả nội dung mã, hoặc null nếu không thấy.
     */
    String doc(byte[] du, int w, int h, int canh) {
        soKhung++;
        boolean caKhung = soKhung % 4 == 0 || canh <= 0;
        int cw = caKhung ? w : Math.min(w, canh), ch = caKhung ? h : Math.min(h, canh);
        try {
            return giaiMa(new PlanarYUVLuminanceSource(du, w, h, (w - cw) / 2, (h - ch) / 2, cw, ch, false), soKhung % 3 == 0);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Ảnh chụp (điểm ảnh ARGB): thử cả 2 cách tách đen trắng. */
    String docAnh(int[] diem, int w, int h) {
        try {
            LuminanceSource nguon = new RGBLuminanceSource(w, h, diem);
            String kq = giaiMa(nguon, false);
            return kq != null ? kq : giaiMa(nguon, true);
        } catch (RuntimeException e) {
            return null;
        }
    }

    String giaiMa(LuminanceSource nguon, boolean cachHai) {
        try {
            BinaryBitmap b = new BinaryBitmap(cachHai ? new GlobalHistogramBinarizer(nguon) : new HybridBinarizer(nguon));
            return doc.decode(b, goiY).getText();
        } catch (ReaderException e) {
            return null;
        } finally {
            doc.reset();
        }
    }
}
