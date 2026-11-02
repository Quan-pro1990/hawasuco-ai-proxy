package vn.hawasuco.camera;

import android.os.Build;

import java.security.MessageDigest;
import java.util.Locale;

/** Mã ảnh 12 ký tự, tính từ giờ chụp (đến giây), tọa độ và đời máy. */
final class PhotoId {
    private static final char[] ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    private PhotoId() {
    }

    static String make(long seconds, StampData d) {
        String src = seconds + "|"
                + (d.hasLocation ? String.format(Locale.US, "%.5f,%.5f", d.lat, d.lon) : "-")
                + "|" + Build.MANUFACTURER + " " + Build.MODEL;
        byte[] h;
        try {
            h = MessageDigest.getInstance("SHA-1").digest(src.getBytes("UTF-8"));
        } catch (Exception e) {
            return null;
        }
        long bits = 0;
        for (int i = 0; i < 8; i++) bits = (bits << 8) | (h[i] & 0xFF);
        StringBuilder sb = new StringBuilder(12);
        for (int i = 0; i < 12; i++) {
            sb.append(ABC[(int) (bits & 31)]);
            bits >>>= 5;
        }
        return sb.toString();
    }
}
