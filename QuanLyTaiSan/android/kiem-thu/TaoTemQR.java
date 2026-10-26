package vn.com.hawasuco.taisan;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;

import java.awt.image.BufferedImage;
import java.io.File;
import java.util.EnumMap;
import java.util.Map;

import javax.imageio.ImageIO;

/** Tạo ảnh tem QR (PNG) để thử camera máy ảo Android: java TaoTemQR <nội dung> <tệp.png> [cỡ=600] */
public class TaoTemQR {
    public static void main(String[] a) throws Exception {
        int co = a.length > 2 ? Integer.parseInt(a[2]) : 600;
        Map<EncodeHintType, Object> h = new EnumMap<EncodeHintType, Object>(EncodeHintType.class);
        h.put(EncodeHintType.MARGIN, 4);
        BitMatrix m = new QRCodeWriter().encode(a[0], BarcodeFormat.QR_CODE, co, co, h);
        BufferedImage anh = new BufferedImage(co, co, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < co; y++)
            for (int x = 0; x < co; x++) anh.setRGB(x, y, m.get(x, y) ? 0x000000 : 0xFFFFFF);
        ImageIO.write(anh, "png", new File(a[1]));
    }
}
