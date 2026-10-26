package vn.com.hawasuco.taisan;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.PlanarYUVLuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/**
 * Đọc mã QR trong khung hình camera (NV21: w×h điểm sáng Y rồi tới màu) bằng ZXing. Java thuần, không dùng Android
 * (kiểm thử được trên máy tính: tools/thu-doc-qr.sh). Một đối tượng chỉ dùng trên 1 luồng.
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
     * Đọc vùng vuông cạnh canh ở giữa khung hình (khung ngắm); cứ 4 khung thì đọc cả khung hình (tem nằm lệch khung ngắm).
     * Trả nội dung mã, hoặc null nếu không thấy.
     */
    String doc(byte[] du, int w, int h, int canh) {
        boolean caKhung = ++soKhung % 4 == 0 || canh <= 0;
        int cw = caKhung ? w : Math.min(w, canh), ch = caKhung ? h : Math.min(h, canh);
        try {
            PlanarYUVLuminanceSource nguon = new PlanarYUVLuminanceSource(du, w, h, (w - cw) / 2, (h - ch) / 2, cw, ch, false);
            return doc.decode(new BinaryBitmap(new HybridBinarizer(nguon)), goiY).getText();
        } catch (ReaderException e) {
            return null;
        } catch (RuntimeException e) {
            return null;
        } finally {
            doc.reset();
        }
    }
}
