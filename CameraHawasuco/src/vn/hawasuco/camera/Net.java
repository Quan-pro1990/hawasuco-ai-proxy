package vn.hawasuco.camera;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Tải dữ liệu qua HTTPS (bản đồ, tra địa chỉ). */
final class Net {
    static final String USER_AGENT = "HawasucoCamera/1.0 (Android; vn.hawasuco.camera)";

    private Net() {
    }

    static byte[] get(String url, int timeoutMs) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        try {
            con.setConnectTimeout(timeoutMs);
            con.setReadTimeout(timeoutMs);
            con.setRequestProperty("User-Agent", USER_AGENT);
            int code = con.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code);
            InputStream in = con.getInputStream();
            try {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                return out.toByteArray();
            } finally {
                in.close();
            }
        } finally {
            con.disconnect();
        }
    }
}
