package vn.com.hawasuco.taisan;

import android.net.Uri;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.cert.Certificate;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLException;
import javax.net.ssl.SSLSession;
import javax.net.ssl.TrustManager;
import javax.net.ssl.TrustManagerFactory;
import javax.net.ssl.X509TrustManager;

/**
 * Kết nối máy chủ Quản lý tài sản: tìm đúng địa chỉ (http / https, cổng 8080 / 8443 của máy chủ chưa có tên miền),
 * gọi api/ping, tải file. Máy chủ chưa có tên miền dùng chứng chỉ tự ký: app báo "mã nhận dạng" (4 nhóm đầu của
 * SHA-256, giống bộ cài máy chủ in ra), người dùng đồng ý thì app ghim đúng chứng chỉ đó (lưu đủ 64 ký tự).
 */
final class KetNoi {
    private KetNoi() { }

    /** Máy chủ dùng chứng chỉ chưa được tin (tự ký / không khớp tên): hỏi người dùng có tin chứng chỉ này không. */
    static final class LoiChungChi extends IOException {
        final X509Certificate chungChi;
        final String diaChi;

        LoiChungChi(X509Certificate c, String diaChi) {
            super("Chứng chỉ của máy chủ chưa được tin cậy.");
            chungChi = c;
            this.diaChi = diaChi;
        }
    }

    /** Kết quả tìm máy chủ: địa chỉ gốc (kết thúc bằng "/") và nội dung api/ping. */
    static final class MayChu {
        String diaChi;
        JSONObject ping;
    }

    /** Tin chứng chỉ của hệ thống; không được thì tin chứng chỉ có vân tay đã ghim. Ghi lại chứng chỉ vừa gặp. */
    static final class Ghim implements X509TrustManager, HostnameVerifier {
        final X509TrustManager heThong;
        final String vanTay;
        volatile X509Certificate vuaGap;

        Ghim(String vanTay) {
            this.vanTay = vanTay == null ? "" : vanTay;
            X509TrustManager tm = null;
            try {
                TrustManagerFactory f = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
                f.init((KeyStore) null);
                for (TrustManager t : f.getTrustManagers()) if (t instanceof X509TrustManager) tm = (X509TrustManager) t;
            } catch (Exception e) {
                // không có kho chứng chỉ hệ thống: chỉ tin chứng chỉ đã ghim
            }
            heThong = tm;
        }

        boolean khop(X509Certificate c) {
            return vanTay.length() > 0 && c != null && vanTay.equals(KetNoi.vanTay(c));
        }

        @Override
        public void checkClientTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            throw new CertificateException("không dùng");
        }

        @Override
        public void checkServerTrusted(X509Certificate[] chain, String authType) throws CertificateException {
            if (chain == null || chain.length == 0) throw new CertificateException("Máy chủ không gửi chứng chỉ.");
            vuaGap = chain[0];
            if (khop(chain[0])) return;
            if (heThong == null) throw new CertificateException("Chứng chỉ chưa được tin cậy.");
            heThong.checkServerTrusted(chain, authType);
        }

        @Override
        public X509Certificate[] getAcceptedIssuers() {
            return heThong == null ? new X509Certificate[0] : heThong.getAcceptedIssuers();
        }

        @Override
        public boolean verify(String host, SSLSession s) {
            try {
                Certificate[] cs = s.getPeerCertificates();
                if (cs.length > 0 && cs[0] instanceof X509Certificate) {
                    vuaGap = (X509Certificate) cs[0];
                    if (khop(vuaGap)) return true;
                }
            } catch (Exception e) {
                return false;
            }
            return HttpsURLConnection.getDefaultHostnameVerifier().verify(host, s);
        }
    }

    /** SHA-256 của chứng chỉ (dạng DER), 64 ký tự hex thường. */
    static String vanTay(X509Certificate c) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256").digest(c.getEncoded());
            StringBuilder sb = new StringBuilder();
            for (byte b : h) sb.append(String.format("%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    /** "3a1b9c..." → "3A1B-9C2D-4E5F-6071" (giống "Mã nhận dạng chứng chỉ tự ký" bộ cài máy chủ in ra). */
    static String maNhanDang(String vanTay) {
        String h = vanTay.toUpperCase();
        if (h.length() < 16) return h;
        return h.substring(0, 4) + "-" + h.substring(4, 8) + "-" + h.substring(8, 12) + "-" + h.substring(12, 16);
    }

    /** Mở kết nối: https thì dùng Ghim (tin chứng chỉ hệ thống hoặc chứng chỉ đã ghim). */
    static HttpURLConnection mo(String url, Ghim g) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        if (c instanceof HttpsURLConnection) {
            try {
                SSLContext ctx = SSLContext.getInstance("TLS");
                ctx.init(null, new TrustManager[] { g }, null);
                ((HttpsURLConnection) c).setSSLSocketFactory(ctx.getSocketFactory());
                ((HttpsURLConnection) c).setHostnameVerifier(g);
            } catch (Exception e) {
                throw new IOException("Không khởi tạo được kết nối https: " + e.getMessage());
            }
        }
        c.setInstanceFollowRedirects(false);
        return c;
    }

    static byte[] docHet(InputStream in) throws IOException {
        try {
            ByteArrayOutputStream ms = new ByteArrayOutputStream();
            byte[] b = new byte[16384];
            int n;
            while ((n = in.read(b)) > 0) ms.write(b, 0, n);
            return ms.toByteArray();
        } finally {
            in.close();
        }
    }

    // ------------------------------------------------------------------ tìm máy chủ

    /** Lỗi mạng mà thử cổng / giao thức khác cũng vô ích (sai tên, không tới được máy). */
    static final class LoiMayKhongToi extends IOException {
        LoiMayKhongToi(String s) { super(s); }
    }

    /**
     * Địa chỉ người dùng gõ → các địa chỉ gốc sẽ thử, theo thứ tự.
     * "192.168.1.10" → https://192.168.1.10/, http://192.168.1.10/, https://192.168.1.10:8443/, http://192.168.1.10:8080/
     * "taisan.congty.vn/t/MB-00012" (link trong tem) → https://taisan.congty.vn/, http://taisan.congty.vn/
     */
    static List<String> diaChiThu(String nhap) {
        List<String> ds = new ArrayList<String>();
        String s = nhap == null ? "" : nhap.trim().replace('\\', '/').replace(" ", "");
        if (s.length() == 0) return ds;
        boolean coGiaoThuc = s.matches("(?i)^https?://.*");
        if (!coGiaoThuc) s = "https://" + s;
        Uri u = Uri.parse(s);
        String host = u.getHost();
        if (host == null || host.length() == 0) return ds;
        if (host.indexOf(':') >= 0 && !host.startsWith("[")) host = "[" + host + "]";
        String duong = u.getPath() == null ? "/" : u.getPath();
        int t = duong.toLowerCase().indexOf("/t/");
        if (t >= 0) duong = duong.substring(0, t + 1);
        t = duong.toLowerCase().indexOf("/api/");
        if (t >= 0) duong = duong.substring(0, t + 1);
        if (duong.toLowerCase().endsWith("/index.html")) duong = duong.substring(0, duong.length() - 10);
        if (!duong.endsWith("/")) duong += "/";
        String[] giaoThuc = coGiaoThuc ? new String[] { u.getScheme().toLowerCase() } : new String[] { "https", "http" };
        List<String> cong = new ArrayList<String>();
        cong.add(u.getPort() > 0 ? ":" + u.getPort() : "");
        for (String duongThu : duong.equals("/") ? new String[] { "/" } : new String[] { duong, "/" })
            for (String gt : giaoThuc) themKhongTrung(ds, gt + "://" + host + cong.get(0) + duongThu);
        if (u.getPort() <= 0 && !coGiaoThuc) {
            // máy chủ chưa có tên miền: bộ cài mặc định HTTPS 8443, HTTP 8080
            themKhongTrung(ds, "https://" + host + ":8443/");
            themKhongTrung(ds, "http://" + host + ":8080/");
        }
        return ds;
    }

    static void themKhongTrung(List<String> ds, String s) {
        if (!ds.contains(s)) ds.add(s);
    }

    /**
     * Thử lần lượt các địa chỉ; trả máy chủ đầu tiên trả lời đúng api/ping. Gặp chứng chỉ chưa tin của một máy chủ Quản lý
     * tài sản: ném LoiChungChi (hỏi người dùng); chứng chỉ chưa tin của trang khác cùng IP (vd HawaMap): thử địa chỉ tiếp.
     */
    static MayChu tim(String nhap, String vanTay) throws IOException {
        List<String> ds = diaChiThu(nhap);
        if (ds.isEmpty()) throw new IOException("Địa chỉ không hợp lệ.");
        IOException loiDau = null;
        for (String dc : ds) {
            try {
                return ping(dc, vanTay);
            } catch (LoiChungChi e) {
                try {
                    ping(dc, KetNoi.vanTay(e.chungChi));   // chỉ gọi api/ping (không gửi gì riêng tư) để biết có đúng máy chủ không
                } catch (IOException khac) {
                    if (loiDau == null) loiDau = khac;
                    continue;
                }
                throw e;
            } catch (LoiMayKhongToi e) {
                throw e;
            } catch (IOException e) {
                if (loiDau == null) loiDau = e;
            }
        }
        throw loiDau;
    }

    /** GET <địa chỉ>api/ping (theo chuyển hướng, kể cả http → https); đúng máy chủ Quản lý tài sản thì trả về. */
    static MayChu ping(String diaChi, String vanTay) throws IOException {
        String url = diaChi + "api/ping";
        for (int lan = 0; lan < 5; lan++) {
            Ghim g = new Ghim(vanTay);
            HttpURLConnection c = null;
            try {
                c = mo(url, g);
                c.setConnectTimeout(7000);
                c.setReadTimeout(15000);
                c.setRequestProperty("Accept", "application/json");
                int ma = c.getResponseCode();
                if (ma >= 300 && ma < 400 && c.getHeaderField("Location") != null) {
                    url = new URL(new URL(url), c.getHeaderField("Location")).toString();
                    continue;
                }
                String goc = url.endsWith("api/ping") ? url.substring(0, url.length() - 8) : diaChi;
                if (ma != 200) throw new IOException("Máy chủ " + goc + " trả lỗi " + ma + " — không phải máy chủ Quản lý tài sản, hoặc phần mềm trên máy chủ đang lỗi.");
                String t = new String(docHet(c.getInputStream()), "UTF-8");
                JSONObject j;
                try { j = new JSONObject(t); }
                catch (Exception e) { throw new IOException(goc + " không phải máy chủ Quản lý tài sản (trả về trang khác)."); }
                if (!"QuanLyTaiSan".equals(j.optString("ten")) && !"QuanLyTaiSan".equals(j.optString("ungDung")))
                    throw new IOException(goc + " không phải máy chủ Quản lý tài sản.");
                MayChu m = new MayChu();
                m.diaChi = goc;
                m.ping = j;
                return m;
            } catch (UnknownHostException e) {
                throw new LoiMayKhongToi("Không tìm thấy máy chủ \"" + Uri.parse(url).getHost() + "\". Kiểm tra lại địa chỉ và kết nối mạng (Wi-Fi / 4G).");
            } catch (NoRouteToHostException e) {
                throw new LoiMayKhongToi("Không tới được máy chủ " + Uri.parse(url).getHost() + ". Trong công ty dùng IP nội bộ (Wi-Fi công ty), ở ngoài dùng tên miền / IP công cộng.");
            } catch (SocketTimeoutException e) {
                throw new LoiMayKhongToi("Máy chủ " + Uri.parse(url).getHost() + " không trả lời. Kiểm tra mạng (trong công ty dùng IP nội bộ, ở ngoài dùng tên miền) và tường lửa máy chủ.");
            } catch (ConnectException e) {
                throw new IOException("Không kết nối được " + diaChiNgan(url) + " (máy chủ không mở cổng này). Ghi đúng cổng, vd 192.168.1.10:8443.");
            } catch (SSLException e) {
                if (g.vuaGap != null && !g.khop(g.vuaGap)) throw new LoiChungChi(g.vuaGap, diaChi);
                throw new IOException("Không kết nối https được tới " + diaChiNgan(url) + ".");
            } finally {
                if (c != null) c.disconnect();
            }
        }
        throw new IOException("Máy chủ chuyển hướng quá nhiều lần.");
    }

    static String diaChiNgan(String url) {
        Uri u = Uri.parse(url);
        return u.getScheme() + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
    }
}
