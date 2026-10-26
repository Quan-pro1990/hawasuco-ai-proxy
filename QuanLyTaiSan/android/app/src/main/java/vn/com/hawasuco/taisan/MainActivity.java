package vn.com.hawasuco.taisan;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.net.http.SslCertificate;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import android.os.SystemClock;
import android.os.Vibrator;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URLDecoder;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.text.SimpleDateFormat;
import java.util.Locale;

/**
 * App "Quản lý tài sản": kết nối máy chủ Quản lý tài sản của công ty (IIS), mở trang web trong WebView và làm thêm
 * những việc trình duyệt trên điện thoại không làm được / không tiện:
 * - quét tem QR bằng camera của app (chạy cả khi máy chủ dùng HTTP), quét liên tục khi kiểm kê / điều chuyển;
 * - máy chủ chưa có tên miền (chứng chỉ tự ký): hỏi một lần theo mã nhận dạng rồi ghim chứng chỉ;
 * - tải file Excel / ảnh rồi mở, chia sẻ (Zalo, email…), lưu vào máy; chụp ảnh tài sản; in tem; lấy vị trí GPS;
 * - tự báo khi máy chủ có bản app mới.
 * Trang web gọi app qua window.QuanLyTaiSanApp (xem lớp CauNoi); app gọi lại trang qua window.ungDung…(…).
 */
public class MainActivity extends Activity {
    static final String KHOA_DIA_CHI = "diaChi", KHOA_VAN_TAY = "vanTay";
    static final int MA_CHON_TEP = 11, MA_LUU = 12;
    static final int XIN_QUET = 21, XIN_CHUP = 22, XIN_CAMERA_WEB = 23, XIN_VI_TRI = 24, XIN_VI_TRI_WEB = 25;
    static final int MAU_CHINH = 0xFF1D5F95, MAU_CHINH_DAM = 0xFF174E7B, MAU_DO = 0xFFC02626, MAU_MO = 0xFF5F6875, MAU_NEN = 0xFFF3F5F8;
    static final String TEN_APK = "QuanLyTaiSan-DienThoai.apk";

    final Handler ui = new Handler(Looper.getMainLooper());
    SharedPreferences cauHinh;
    String diaChi = "";          // địa chỉ gốc máy chủ đã kiểm tra, luôn kết thúc bằng "/"
    String vanTay = "";          // SHA-256 chứng chỉ tự ký đã tin (rỗng: chỉ tin chứng chỉ hệ thống)
    FrameLayout goc;
    WebView web;
    ProgressBar thanhTai;
    View manLoi, manKetNoi;
    ManQuet quet;
    boolean quetChoWeb;          // màn hình quét mở từ trang web (không phải từ màn hình kết nối)
    String[] quetCho;            // { chế độ, tiêu đề, gợi ý } chờ cấp quyền camera
    EditText oDiaChi;
    Runnable ketNoiNgay;

    ValueCallback<Uri[]> choTep;            // trang web đang chờ chọn ảnh / file
    WebChromeClient.FileChooserParams thamSoChon;
    File anhChup;                           // ảnh ứng dụng Camera sẽ ghi vào
    PermissionRequest yeuCauWeb;            // trang web xin camera (getUserMedia)
    GeolocationPermissions.Callback goiViTriWeb;
    String nguonViTriWeb;
    File tepCho;                            // file chờ chọn nơi lưu (ACTION_CREATE_DOCUMENT)
    File apkCho;                            // bản cập nhật chờ người dùng cho phép cài
    boolean dangTai, daKiemTraCapNhat;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        cauHinh = getSharedPreferences("maychu", MODE_PRIVATE);
        goc = new FrameLayout(this);
        setContentView(goc);
        diaChi = cauHinh.getString(KHOA_DIA_CHI, "");
        vanTay = cauHinh.getString(KHOA_VAN_TAY, "");
        new Thread(new Runnable() {
            @Override
            public void run() { TepProvider.donDep(MainActivity.this); }
        }).start();
        if (xuLyLink(getIntent())) return;
        if (diaChi.length() == 0) hienKetNoi("", null, false);
        else moTrang();
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        xuLyLink(i);
    }

    int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    PackageInfo goi() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0); }
        catch (Exception e) { return null; }
    }

    String phienBanApp() {
        PackageInfo p = goi();
        return p == null || p.versionName == null ? "" : p.versionName;
    }

    int maPhienBanApp() {
        PackageInfo p = goi();
        return p == null ? 0 : p.versionCode;
    }

    boolean coQuyen(String q) {
        return checkPermission(q, Process.myPid(), Process.myUid()) == PackageManager.PERMISSION_GRANTED;
    }

    void xinQuyen(String[] ds, int ma) {
        if (Build.VERSION.SDK_INT >= 23) requestPermissions(ds, ma);
        else onRequestPermissionsResult(ma, ds, new int[ds.length]);   // Android 5: quyền đã cấp lúc cài
    }

    void bao(String s) {
        Toast.makeText(this, s, Toast.LENGTH_LONG).show();
    }

    // ------------------------------------------------------------------ link qltaisan://ketnoi?may=… (nút "Mở bằng app" trên trang web)

    boolean xuLyLink(Intent i) {
        if (i == null || !Intent.ACTION_VIEW.equals(i.getAction()) || i.getData() == null || !"qltaisan".equals(i.getData().getScheme())) return false;
        final String may = i.getData().getQueryParameter("may");
        if (may == null || may.trim().length() == 0) return false;
        if (may.equals(diaChi) && web != null) return true;
        if (diaChi.length() == 0 || may.equals(diaChi)) {
            hienKetNoi(may, null, true);
            return true;
        }
        if (web == null) moTrang();
        new AlertDialog.Builder(this)
            .setTitle("Đổi máy chủ?")
            .setMessage("Đang dùng: " + diaChi + "\nChuyển sang: " + may)
            .setNegativeButton("Giữ máy chủ cũ", null)
            .setPositiveButton("Chuyển", new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface d, int w) { hienKetNoi(may, null, true); }
            })
            .show();
        return true;
    }

    // ------------------------------------------------------------------ trang web

    void moTrang() {
        an(manKetNoi);
        manKetNoi = null;
        oDiaChi = null;
        an(manLoi);
        manLoi = null;
        if (web == null) {
            taoWeb();
            goc.addView(web, 0, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            thanhTai = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            thanhTai.setMax(100);
            thanhTai.setVisibility(View.GONE);
            goc.addView(thanhTai, 1, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4), Gravity.TOP));
        }
        web.setVisibility(View.VISIBLE);
        web.loadUrl(diaChi);
        kiemTraCapNhat();
    }

    void an(View v) {
        if (v != null) goc.removeView(v);
    }

    void taoWeb() {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setGeolocationEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " QuanLyTaiSanApp/" + phienBanApp());
        web.addJavascriptInterface(new CauNoi(), "QuanLyTaiSanApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                return moNgoai(url);
            }

            @Override
            public void onPageStarted(WebView v, String url, Bitmap icon) {
                an(manLoi);
                manLoi = null;
            }

            @Override
            public void onReceivedError(WebView v, int ma, String moTa, String url) {
                // chỉ gọi cho trang chính (không gọi cho ảnh, api…)
                hienLoi(moTaLoiMang(ma, moTa), false);
            }

            @Override
            public void onReceivedHttpError(WebView v, WebResourceRequest yc, WebResourceResponse tl) {
                if (yc.isForMainFrame() && tl.getStatusCode() >= 500)
                    hienLoi("Máy chủ trả lỗi " + tl.getStatusCode() + " — phần mềm trên máy chủ chưa chạy hoặc đang khởi động lại. Thử lại sau ít phút, " +
                            "nếu vẫn lỗi hãy báo quản trị.", false);
            }

            @Override
            public void onReceivedSslError(WebView v, SslErrorHandler h, SslError e) {
                X509Certificate c = chungChi(e.getCertificate());
                if (c != null && vanTay.length() > 0 && vanTay.equals(KetNoi.vanTay(c)) && cungMayChu(e.getUrl())) {
                    h.proceed();
                    return;
                }
                h.cancel();
                hienLoi("Chứng chỉ bảo mật của máy chủ đã thay đổi hoặc chưa được tin cậy (máy chủ vừa cài lại / đổi chứng chỉ?). " +
                        "Bấm \"Kết nối lại\" để xem mã nhận dạng chứng chỉ mới và so với quản trị.", true);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                thanhTai.setProgress(p);
                thanhTai.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (choTep != null) choTep.onReceiveValue(null);
                choTep = cb;
                thamSoChon = p;
                if (p.isCaptureEnabled() && coCamera()) {
                    if (coQuyen(Manifest.permission.CAMERA)) chupAnh();
                    else xinQuyen(new String[] { Manifest.permission.CAMERA }, XIN_CHUP);
                } else {
                    moChonTep();
                }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest r) {
                boolean chiCamera = true;
                for (String x : r.getResources()) if (!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x)) chiCamera = false;
                if (!chiCamera || !cungMayChu(r.getOrigin().toString())) {
                    r.deny();
                    return;
                }
                if (coQuyen(Manifest.permission.CAMERA)) {
                    r.grant(r.getResources());
                    return;
                }
                if (yeuCauWeb != null) yeuCauWeb.deny();
                yeuCauWeb = r;
                xinQuyen(new String[] { Manifest.permission.CAMERA }, XIN_CAMERA_WEB);
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String nguon, GeolocationPermissions.Callback cb) {
                if (!cungMayChu(nguon)) {
                    cb.invoke(nguon, false, false);
                    return;
                }
                if (coViTri()) {
                    cb.invoke(nguon, true, false);
                    return;
                }
                goiViTriWeb = cb;
                nguonViTriWeb = nguon;
                xinQuyen(new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, XIN_VI_TRI_WEB);
            }
        });
        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String ua, String cd, String mime, long dai) {
                taiVe(url, tenTuHeader(cd, url, mime), "");
            }
        });
    }

    static X509Certificate chungChi(SslCertificate sc) {
        if (sc == null) return null;
        if (Build.VERSION.SDK_INT >= 29) return sc.getX509Certificate();
        try {
            byte[] der = SslCertificate.saveState(sc).getByteArray("x509-certificate");
            if (der == null) return null;
            return (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(der));
        } catch (Exception e) {
            return null;
        }
    }

    /** Địa chỉ thuộc máy chủ đang dùng: mở trong app; trang khác (bản đồ…): mở bằng ứng dụng khác. */
    boolean moNgoai(String url) {
        if (url.startsWith("qltaisan:")) {
            xuLyLink(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            return true;
        }
        if (cungMayChu(url)) return false;
        try {
            Intent i = url.startsWith("intent:") ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            i.setComponent(null);
            startActivity(i);
        } catch (Exception e) {
            bao("Không mở được " + url);
        }
        return true;
    }

    boolean cungMayChu(String url) {
        if (url == null || diaChi.length() == 0) return false;
        Uri a = Uri.parse(url), b = Uri.parse(diaChi);
        return a.getScheme() != null && a.getScheme().equalsIgnoreCase(b.getScheme()) && a.getHost() != null &&
               a.getHost().equalsIgnoreCase(b.getHost()) && cong(a) == cong(b);
    }

    static int cong(Uri u) {
        if (u.getPort() >= 0) return u.getPort();
        return "https".equalsIgnoreCase(u.getScheme()) ? 443 : 80;
    }

    static String moTaLoiMang(int ma, String moTa) {
        switch (ma) {
            case WebViewClient.ERROR_HOST_LOOKUP: return "Không tìm thấy máy chủ. Kiểm tra kết nối mạng (Wi-Fi / 4G) và địa chỉ máy chủ.";
            case WebViewClient.ERROR_CONNECT: return "Không kết nối được máy chủ. Trong công ty dùng địa chỉ nội bộ (Wi-Fi công ty), ở ngoài dùng tên miền / IP công cộng.";
            case WebViewClient.ERROR_TIMEOUT: return "Máy chủ không trả lời kịp. Thử lại sau.";
            case WebViewClient.ERROR_FAILED_SSL_HANDSHAKE: return "Không thiết lập được kết nối bảo mật (https) với máy chủ.";
            default: return moTa;
        }
    }

    void hienLoi(String moTa, boolean ketNoiLai) {
        an(manLoi);
        dongQuet(false);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setGravity(Gravity.CENTER);
        l.setPadding(dp(24), dp(24), dp(24), dp(24));
        l.setBackgroundColor(MAU_NEN);
        l.setClickable(true);
        l.addView(chu("Không mở được trang", 20, MAU_CHINH, true));
        l.addView(chu(diaChi, 14, MAU_MO, false));
        TextView t = chu(moTa, 15, MAU_DO, false);
        t.setPadding(0, dp(12), 0, dp(16));
        l.addView(t);
        Button thu = nut(ketNoiLai ? "Kết nối lại" : "Thử lại", true);
        thu.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (ketNoiLai) hienKetNoi(diaChi, null, true);
                else moTrang();
            }
        });
        l.addView(thu, rong());
        Button doi = nut("Đổi máy chủ", false);
        doi.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { hienKetNoi(diaChi, null, false); }
        });
        l.addView(doi, rong());
        manLoi = l;
        goc.addView(l, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    void goiJs(String ham, String thamSo) {
        if (web != null) web.evaluateJavascript("window." + ham + "&&window." + ham + "(" + thamSo + ")", null);
    }

    // ------------------------------------------------------------------ màn hình kết nối máy chủ

    /** goiY: địa chỉ điền sẵn; tuKetNoi: kết nối luôn (link "Mở bằng app", kết nối lại sau khi đổi chứng chỉ). */
    void hienKetNoi(String goiY, String loi, boolean tuKetNoi) {
        an(manKetNoi);
        an(manLoi);
        manLoi = null;
        dongQuet(false);
        if (web != null) {
            web.stopLoading();
            web.setVisibility(View.GONE);
        }
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.setBackgroundColor(MAU_NEN);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(24), dp(36), dp(24), dp(24));
        sv.addView(l);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(88), dp(88));
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        l.addView(logo, lp);
        TextView td = chu("Quản lý tài sản", 22, MAU_CHINH_DAM, true);
        td.setGravity(Gravity.CENTER_HORIZONTAL);
        td.setPadding(0, dp(10), 0, dp(4));
        l.addView(td);
        TextView mo = chu("Kết nối máy chủ Quản lý tài sản của công ty. Nhập địa chỉ quản trị cung cấp (địa chỉ mở trang web), " +
                          "hoặc quét tem QR dán trên một tài sản bất kỳ.", 14, MAU_MO, false);
        mo.setGravity(Gravity.CENTER_HORIZONTAL);
        mo.setPadding(0, 0, 0, dp(18));
        l.addView(mo);

        l.addView(chu("Địa chỉ máy chủ", 13, MAU_MO, false));
        final EditText o = new EditText(this);
        o.setSingleLine(true);
        o.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        o.setImeOptions(EditorInfo.IME_ACTION_GO);
        o.setHint("vd taisan.congty.vn hoặc 192.168.1.10:8443");
        o.setText(goiY == null ? "" : goiY.replaceAll("/+$", ""));
        o.setSelection(o.getText().length());
        o.setContentDescription("Địa chỉ máy chủ");
        l.addView(o, rong());
        oDiaChi = o;
        final TextView tb = chu(loi == null ? "" : loi, 14, MAU_DO, false);
        tb.setPadding(0, dp(6), 0, dp(6));
        l.addView(tb);
        final Button nut = nut("Kết nối", true);
        l.addView(nut, rong());
        if (coCamera()) {
            Button q = nut("Quét tem QR để lấy địa chỉ", false);
            q.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    an2(o);
                    moQuet("diachi", "Quét tem tài sản", "Đưa tem QR dán trên tài sản vào khung — app lấy địa chỉ máy chủ ghi trong tem");
                }
            });
            l.addView(q, rong());
        }
        if (web != null && diaChi.length() > 0) {
            Button quay = nut("Quay lại " + KetNoi.diaChiNgan(diaChi), false);
            quay.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) { moTrang(); }
            });
            l.addView(quay, rong());
        }
        TextView ghiChu = chu("• Máy chủ có tên miền: gõ tên miền, vd taisan.congty.vn.\n" +
                              "• Máy chủ chưa có tên miền: gõ IP của máy chủ, vd 192.168.1.10 (trong công ty) — app tự thử cổng 8443 / 8080. " +
                              "Lần đầu app hiện \"mã nhận dạng chứng chỉ\": so với mã quản trị cung cấp rồi bấm Tin cậy.", 13, MAU_MO, false);
        ghiChu.setPadding(0, dp(18), 0, 0);
        l.addView(ghiChu);
        String pb = phienBanApp();
        if (pb.length() > 0) {
            TextView v = chu("App phiên bản " + pb, 12, MAU_MO, false);
            v.setPadding(0, dp(12), 0, 0);
            l.addView(v);
        }

        ketNoiNgay = new Runnable() {
            @Override
            public void run() {
                String nhap = o.getText().toString().trim();
                if (nhap.length() == 0) {
                    tb.setText("Nhập địa chỉ máy chủ.");
                    return;
                }
                an2(o);
                ketNoi(nhap, nhap.equals(diaChi.replaceAll("/+$", "")) || nhap.equals(diaChi) ? vanTay : "", nut, tb);
            }
        };
        nut.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { ketNoiNgay.run(); }
        });
        o.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int id, KeyEvent e) {
                ketNoiNgay.run();
                return true;
            }
        });
        manKetNoi = sv;
        goc.addView(sv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        if (tuKetNoi && o.getText().length() > 0) ketNoiNgay.run();
        else o.requestFocus();
    }

    void an2(View o) {
        ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(o.getWindowToken(), 0);
    }

    /** Tìm máy chủ ở địa chỉ người dùng gõ (luồng nền); chứng chỉ tự ký thì hỏi tin cậy. */
    void ketNoi(final String nhap, final String vanTayThu, final Button nut, final TextView tb) {
        nut.setEnabled(false);
        nut.setText("Đang kết nối…");
        tb.setText("");
        new Thread(new Runnable() {
            @Override
            public void run() {
                KetNoi.MayChu m = null;
                IOException loi = null;
                try { m = KetNoi.tim(nhap, vanTayThu); }
                catch (IOException e) { loi = e; }
                final KetNoi.MayChu kq = m;
                final IOException loiCuoi = loi;
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        if (manKetNoi == null) return;
                        nut.setEnabled(true);
                        nut.setText("Kết nối");
                        if (loiCuoi instanceof KetNoi.LoiChungChi) {
                            hoiTinChungChi((KetNoi.LoiChungChi) loiCuoi, nut, tb);
                            return;
                        }
                        if (kq == null) {
                            tb.setText(loiCuoi == null ? "Không kết nối được." : loiCuoi.getMessage());
                            return;
                        }
                        boolean doiMay = !kq.diaChi.equals(diaChi);
                        diaChi = kq.diaChi;
                        vanTay = kq.diaChi.startsWith("https:") ? vanTayThu : "";
                        cauHinh.edit().putString(KHOA_DIA_CHI, diaChi).putString(KHOA_VAN_TAY, vanTay).apply();
                        if (doiMay) daKiemTraCapNhat = false;
                        moTrang();
                        Toast.makeText(MainActivity.this, "Đã kết nối " + kq.ping.optString("congTy", KetNoi.diaChiNgan(diaChi)), Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }).start();
    }

    void hoiTinChungChi(final KetNoi.LoiChungChi e, final Button nut, final TextView tb) {
        final String vt = KetNoi.vanTay(e.chungChi);
        String ten = e.chungChi.getSubjectX500Principal().getName();
        int i = ten.indexOf("CN=");
        if (i >= 0) {
            ten = ten.substring(i + 3);
            int j = ten.indexOf(',');
            if (j >= 0) ten = ten.substring(0, j);
        }
        String han = new SimpleDateFormat("dd/MM/yyyy", Locale.US).format(e.chungChi.getNotAfter());
        TextView noiDung = chu("Máy chủ " + KetNoi.diaChiNgan(e.diaChi) + " dùng chứng chỉ chưa được xác thực (chứng chỉ tự ký của máy chủ " +
                               "chưa có tên miền, hoặc tên không khớp địa chỉ).\n\nChứng chỉ cấp cho: " + ten + "\nHết hạn: " + han +
                               "\n\nMã nhận dạng chứng chỉ:", 15, 0xFF1F2937, false);
        TextView ma = chu(KetNoi.maNhanDang(vt), 22, MAU_CHINH_DAM, true);
        ma.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        ma.setGravity(Gravity.CENTER);
        ma.setPadding(0, dp(8), 0, dp(8));
        TextView sau = chu("So với mã quản trị cung cấp (bộ cài máy chủ in ra ở bước cuối). Chỉ bấm Tin cậy khi trùng khớp.", 14, MAU_MO, false);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(24), dp(8), dp(24), 0);
        l.addView(noiDung);
        l.addView(ma);
        l.addView(sau);
        new AlertDialog.Builder(this)
            .setTitle("Tin cậy máy chủ này?")
            .setView(l)
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Tin cậy", new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface d, int w) { ketNoi(e.diaChi, vt, nut, tb); }
            })
            .show();
    }

    void hoiDoiMayChu() {
        new AlertDialog.Builder(this)
            .setTitle("Đổi máy chủ?")
            .setMessage("Đang dùng: " + diaChi + "\nNhập địa chỉ máy chủ khác (đăng nhập lại ở máy chủ mới).")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Đổi máy chủ", new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface d, int w) { hienKetNoi(diaChi, null, false); }
            })
            .show();
    }

    // ------------------------------------------------------------------ quét tem QR bằng camera của app

    boolean coCamera() {
        return getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY);
    }

    /** cheDo: "mot" (quét 1 tem), "lientuc" (kiểm kê, điều chuyển), "diachi" (màn hình kết nối: lấy địa chỉ máy chủ trong tem). */
    void moQuet(String cheDo, String tieuDe, String goiY) {
        if (!coQuyen(Manifest.permission.CAMERA)) {
            quetCho = new String[] { cheDo, tieuDe, goiY };
            xinQuyen(new String[] { Manifest.permission.CAMERA }, XIN_QUET);
            return;
        }
        if (quet != null) {
            quet.doiChu(tieuDe, goiY);
            return;
        }
        final boolean tuWeb = !"diachi".equals(cheDo);
        quetChoWeb = tuWeb;
        quet = new ManQuet(this, "lientuc".equals(cheDo), tieuDe == null || tieuDe.length() == 0 ? "Quét tem QR" : tieuDe,
                           goiY == null || goiY.length() == 0 ? "Đưa tem QR vào giữa khung" : goiY, new ManQuet.NguoiNghe() {
            @Override
            public void daDoc(String noiDung) {
                if (tuWeb) {
                    if (!quet.lienTuc) dongQuet(false);
                    goiJs("ungDungQuet", JSONObject.quote(noiDung));
                } else {
                    rung("40");
                    dongQuet(false);
                    nhanDiaChiTuTem(noiDung);
                }
            }

            @Override
            public void dong() { dongQuet(true); }
        });
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LOCKED);
        goc.addView(quet, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        quet.batDau();
    }

    /** Đóng màn hình quét; baoWeb: báo trang web (người dùng bấm Xong / Back). */
    void dongQuet(boolean baoWeb) {
        if (quet == null) return;
        quet.dung();
        goc.removeView(quet);
        quet = null;
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        if (baoWeb && quetChoWeb) goiJs("ungDungDongQuet", "");
    }

    /** Tem QR chứa địa chỉ dạng https://taisan.congty.vn/t/MB-00012 → điền địa chỉ máy chủ, kết nối. */
    void nhanDiaChiTuTem(String s) {
        String t = s.trim();
        int i = t.toLowerCase().indexOf("/t/");
        if (!t.matches("(?i)^https?://.+") || i < 0) {
            bao("Tem này không chứa địa chỉ máy chủ (nội dung: " + (t.length() > 60 ? t.substring(0, 60) + "…" : t) + "). Hãy gõ địa chỉ máy chủ.");
            return;
        }
        if (oDiaChi == null || ketNoiNgay == null) return;
        oDiaChi.setText(t.substring(0, i));
        ketNoiNgay.run();
    }

    void rung(String mau) {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        try {
            String[] p = mau.split("[,\\s]+");
            if (p.length == 1) {
                v.vibrate(Math.min(2000, Long.parseLong(p[0])));
                return;
            }
            long[] m = new long[p.length + 1];
            for (int i = 0; i < p.length; i++) m[i + 1] = Math.min(2000, Long.parseLong(p[i]));
            v.vibrate(m, -1);
        } catch (Exception e) {
            // mẫu rung sai: bỏ qua
        }
    }

    // ------------------------------------------------------------------ chọn ảnh, chụp ảnh cho trang web

    void chupAnh() {
        anhChup = TepProvider.tep(this, TepProvider.CHUP, "anh-" + System.currentTimeMillis() + ".jpg");
        Uri u = TepProvider.uri(anhChup);
        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        i.putExtra(MediaStore.EXTRA_OUTPUT, u);
        i.setClipData(ClipData.newRawUri("", u));
        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivityForResult(i, MA_CHON_TEP);
        } catch (ActivityNotFoundException e) {
            anhChup = null;
            moChonTep();
        }
    }

    void moChonTep() {
        anhChup = null;
        String loai = "*/*";
        if (thamSoChon != null && thamSoChon.getAcceptTypes() != null)
            for (String t : thamSoChon.getAcceptTypes()) if (t != null && t.startsWith("image")) loai = "image/*";
        Intent chon = new Intent(Intent.ACTION_GET_CONTENT);
        chon.addCategory(Intent.CATEGORY_OPENABLE);
        chon.setType(loai);
        if (thamSoChon != null && thamSoChon.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)
            chon.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(Intent.createChooser(chon, "image/*".equals(loai) ? "Chọn ảnh" : "Chọn file"), MA_CHON_TEP);
        } catch (ActivityNotFoundException e) {
            traTep(null);
            bao("Điện thoại không có ứng dụng chọn file.");
        }
    }

    void traTep(Uri[] kq) {
        if (choTep != null) choTep.onReceiveValue(kq);
        choTep = null;
        thamSoChon = null;
    }

    @Override
    protected void onActivityResult(int ma, int kq, Intent data) {
        super.onActivityResult(ma, kq, data);
        if (ma == MA_CHON_TEP) {
            Uri[] ds = null;
            if (kq == RESULT_OK) {
                if (anhChup != null) {
                    if (anhChup.length() > 0) ds = new Uri[] { TepProvider.uri(anhChup) };
                } else if (data != null && data.getClipData() != null) {
                    ClipData cd = data.getClipData();
                    ds = new Uri[cd.getItemCount()];
                    for (int i = 0; i < ds.length; i++) ds[i] = cd.getItemAt(i).getUri();
                } else if (data != null && data.getData() != null) {
                    ds = new Uri[] { data.getData() };
                }
            }
            anhChup = null;
            traTep(ds);
            return;
        }
        if (ma == MA_LUU) luuXong(kq, data);
    }

    // ------------------------------------------------------------------ quyền

    @Override
    public void onRequestPermissionsResult(int ma, String[] quyen, int[] kq) {
        boolean dong = kq.length > 0;
        for (int k : kq) if (k != PackageManager.PERMISSION_GRANTED) dong = false;
        if (ma == XIN_QUET) {
            String[] q = quetCho;
            quetCho = null;
            if (q == null) return;
            if (dong) moQuet(q[0], q[1], q[2]);
            else {
                bao("Chưa cho phép dùng camera nên chưa quét được. Vào Cài đặt → Ứng dụng → Tài sản → Quyền → Camera → Cho phép.");
                if (!"diachi".equals(q[0])) goiJs("ungDungDongQuet", "");
            }
        } else if (ma == XIN_CHUP) {
            if (dong) chupAnh();
            else moChonTep();
        } else if (ma == XIN_CAMERA_WEB) {
            if (yeuCauWeb != null) {
                if (dong) yeuCauWeb.grant(yeuCauWeb.getResources());
                else yeuCauWeb.deny();
            }
            yeuCauWeb = null;
        } else if (ma == XIN_VI_TRI) {
            if (coViTri()) layViTri();
            else traViTri(null, "Chưa cho phép app lấy vị trí. Vào Cài đặt → Ứng dụng → Tài sản → Quyền → Vị trí.");
        } else if (ma == XIN_VI_TRI_WEB) {
            if (goiViTriWeb != null) goiViTriWeb.invoke(nguonViTriWeb, coViTri(), false);
            goiViTriWeb = null;
        }
    }

    boolean coViTri() {
        return coQuyen(Manifest.permission.ACCESS_FINE_LOCATION) || coQuyen(Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    // ------------------------------------------------------------------ vị trí GPS (trang web gọi layViTri)

    boolean dangLayViTri;

    void layViTri() {
        if (dangLayViTri) return;
        if (!coViTri()) {
            xinQuyen(new String[] { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }, XIN_VI_TRI);
            return;
        }
        final LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        boolean gps = false, mang = false;
        try { gps = lm.isProviderEnabled(LocationManager.GPS_PROVIDER); } catch (Exception e) { /* không có GPS */ }
        try { mang = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER); } catch (Exception e) { /* không có */ }
        if (!gps && !mang) {
            traViTri(null, "Vị trí (GPS) của điện thoại đang tắt — kéo thanh thông báo xuống, bật Vị trí rồi thử lại.");
            return;
        }
        dangLayViTri = true;
        final Location[] tot = new Location[1];
        final boolean[] xong = new boolean[1];
        final LocationListener nghe = new LocationListener() {
            @Override
            public void onLocationChanged(Location v) {
                if (xong[0]) return;
                if (tot[0] == null || v.getAccuracy() < tot[0].getAccuracy()) tot[0] = v;
                if (v.getAccuracy() <= 25) ketThuc();
            }

            @Override
            public void onStatusChanged(String p, int s, Bundle b) { }

            @Override
            public void onProviderEnabled(String p) { }

            @Override
            public void onProviderDisabled(String p) { }

            void ketThuc() {
                xong[0] = true;
                dangLayViTri = false;
                try { lm.removeUpdates(this); } catch (SecurityException e) { /* đã thu hồi quyền */ }
                if (tot[0] != null) traViTri(tot[0], null);
                else traViTri(null, "Không lấy được vị trí — thử lại ở chỗ thoáng, bật GPS độ chính xác cao.");
            }
        };
        try {
            if (gps) lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000, 0, nghe, Looper.getMainLooper());
            if (mang) lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1000, 0, nghe, Looper.getMainLooper());
        } catch (SecurityException e) {
            dangLayViTri = false;
            traViTri(null, "Chưa cho phép app lấy vị trí.");
            return;
        }
        ui.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!xong[0]) {
                    xong[0] = true;
                    dangLayViTri = false;
                    try { lm.removeUpdates(nghe); } catch (SecurityException e) { /* đã thu hồi quyền */ }
                    if (tot[0] != null) traViTri(tot[0], null);
                    else traViTri(null, "Không lấy được vị trí — thử lại ở chỗ thoáng.");
                }
            }
        }, 20000);
    }

    void traViTri(Location v, String loi) {
        JSONObject j = new JSONObject();
        try {
            if (v != null) {
                j.put("viDo", Math.round(v.getLatitude() * 1e6) / 1e6);
                j.put("kinhDo", Math.round(v.getLongitude() * 1e6) / 1e6);
                j.put("saiSo", Math.round(v.getAccuracy()));
            } else {
                j.put("loi", loi);
            }
        } catch (Exception e) {
            // không xảy ra
        }
        goiJs("ungDungViTri", j.toString());
    }

    // ------------------------------------------------------------------ cầu nối cho trang web: window.QuanLyTaiSanApp

    class CauNoi {
        @JavascriptInterface
        public String phienBan() { return phienBanApp(); }

        @JavascriptInterface
        public int maPhienBan() { return maPhienBanApp(); }

        @JavascriptInterface
        public String mayChu() { return diaChi; }

        /** Mã nhận dạng chứng chỉ tự ký đã tin (rỗng nếu máy chủ dùng chứng chỉ thật / HTTP). */
        @JavascriptInterface
        public String maChungChi() { return vanTay.length() > 0 ? KetNoi.maNhanDang(vanTay) : ""; }

        @JavascriptInterface
        public void doiMayChu() {
            ui.post(new Runnable() {
                @Override
                public void run() { hoiDoiMayChu(); }
            });
        }

        /** Tải file của máy chủ (token: phiên đăng nhập cho địa chỉ cần đăng nhập, vd ảnh) rồi mở / chia sẻ / lưu. */
        @JavascriptInterface
        public void taiVe(final String url, final String ten, final String token) {
            ui.post(new Runnable() {
                @Override
                public void run() { MainActivity.this.taiVe(url, ten, token); }
            });
        }

        @JavascriptInterface
        public boolean coQuet() { return coCamera(); }

        @JavascriptInterface
        public void moQuet(final String cheDo, final String tieuDe, final String goiY) {
            ui.post(new Runnable() {
                @Override
                public void run() { MainActivity.this.moQuet("lientuc".equals(cheDo) ? "lientuc" : "mot", tieuDe, goiY); }
            });
        }

        @JavascriptInterface
        public void dongQuet() {
            ui.post(new Runnable() {
                @Override
                public void run() { if (quetChoWeb) MainActivity.this.dongQuet(false); }
            });
        }

        /** Trang web báo kết quả xử lý tem vừa quét: loai "ok" / "loi" / "". */
        @JavascriptInterface
        public void baoQuet(final String tin, final String loai) {
            ui.post(new Runnable() {
                @Override
                public void run() { if (quet != null && quetChoWeb) quet.ketQua(tin, loai); }
            });
        }

        @JavascriptInterface
        public void rung(final String mau) {
            ui.post(new Runnable() {
                @Override
                public void run() { MainActivity.this.rung(mau); }
            });
        }

        @JavascriptInterface
        public void inTrang(final String ten) {
            ui.post(new Runnable() {
                @Override
                public void run() { MainActivity.this.inTrang(ten); }
            });
        }

        @JavascriptInterface
        public void layViTri() {
            ui.post(new Runnable() {
                @Override
                public void run() { MainActivity.this.layViTri(); }
            });
        }

        @JavascriptInterface
        public void capNhat() {
            ui.post(new Runnable() {
                @Override
                public void run() { MainActivity.this.capNhat(); }
            });
        }
    }

    // ------------------------------------------------------------------ tải file: mở, chia sẻ, lưu

    /** Tên file trong Content-Disposition (ưu tiên filename*=UTF-8''…), không có thì đoán từ địa chỉ. */
    static String tenTuHeader(String cd, String url, String mime) {
        if (cd != null) {
            int i = cd.toLowerCase().indexOf("filename*=utf-8''");
            if (i >= 0) {
                String s = cd.substring(i + 17);
                int j = s.indexOf(';');
                if (j >= 0) s = s.substring(0, j);
                try { return URLDecoder.decode(s.trim().replace("+", "%2B"), "UTF-8"); } catch (Exception e) { /* đoán tên */ }
            }
        }
        return URLUtil.guessFileName(url, cd, mime);
    }

    void taiVe(final String url, String ten, final String token) {
        if (!cungMayChu(url)) {
            bao("Chỉ tải file từ máy chủ đang dùng.");
            return;
        }
        if (dangTai) return;
        dangTai = true;
        final String tenGoi = ten == null ? "" : ten;
        final ProgressDialog cho = ProgressDialog.show(this, null, "Đang tải " + (tenGoi.length() > 0 ? tenGoi : "file") + "…", true, false);
        new Thread(new Runnable() {
            @Override
            public void run() {
                File f = null;
                String loi = null;
                HttpURLConnection c = null;
                try {
                    c = KetNoi.mo(url, new KetNoi.Ghim(vanTay));
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(120000);
                    if (token != null && token.length() > 0) c.setRequestProperty("Authorization", "Bearer " + token);
                    int ma = c.getResponseCode();
                    if (ma != 200) {
                        String tin = "";
                        try { tin = new JSONObject(new String(KetNoi.docHet(c.getErrorStream()), "UTF-8")).optString("loi"); }
                        catch (Exception e) { /* không có nội dung lỗi */ }
                        throw new IOException(tin.length() > 0 ? tin : "Máy chủ trả lỗi " + ma + ".");
                    }
                    String tenTep = tenGoi.length() > 0 ? tenGoi : tenTuHeader(c.getHeaderField("Content-Disposition"), url, c.getContentType());
                    f = TepProvider.tep(MainActivity.this, TepProvider.TAI, tenTep);
                    InputStream in = c.getInputStream();
                    OutputStream ra = new FileOutputStream(f);
                    try { chep(in, ra); }
                    finally { in.close(); ra.close(); }
                } catch (Exception e) {
                    loi = e instanceof IOException && e.getMessage() != null ? e.getMessage() : "Không tải được: " + e;
                    if (f != null) f.delete();
                    f = null;
                } finally {
                    if (c != null) c.disconnect();
                }
                final File kq = f;
                final String loiCuoi = loi;
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        dangTai = false;
                        try { cho.dismiss(); } catch (Exception e) { /* activity đã đóng */ }
                        if (loiCuoi != null) { bao(loiCuoi); return; }
                        if (kq.getName().toLowerCase().endsWith(".apk")) caiDat(kq);
                        else hoiMoTep(kq);
                    }
                });
            }
        }).start();
    }

    static void chep(InputStream in, OutputStream ra) throws IOException {
        byte[] b = new byte[65536];
        int n;
        while ((n = in.read(b)) > 0) ra.write(b, 0, n);
    }

    void hoiMoTep(final File f) {
        boolean anh = TepProvider.loai(f.getName()).startsWith("image/");
        final String[] chon = { anh ? "Mở ảnh" : "Mở (Excel, WPS Office…)", "Chia sẻ (Zalo, email…)", "Lưu vào máy…" };
        new AlertDialog.Builder(this)
            .setTitle(f.getName())
            .setItems(chon, new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface d, int i) {
                    if (i == 0) moTep(f);
                    else if (i == 1) chiaSe(f);
                    else luuVaoMay(f);
                }
            })
            .setNegativeButton("Đóng", null)
            .show();
    }

    void moTep(File f) {
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(TepProvider.uri(f), TepProvider.loai(f.getName()));
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivity(Intent.createChooser(i, "Mở " + f.getName())); }
        catch (ActivityNotFoundException e) { bao("Chưa có ứng dụng mở được file này (cài Excel / WPS Office). Chọn Chia sẻ hoặc Lưu vào máy."); }
    }

    void chiaSe(File f) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType(TepProvider.loai(f.getName()));
        i.putExtra(Intent.EXTRA_STREAM, TepProvider.uri(f));
        i.putExtra(Intent.EXTRA_SUBJECT, f.getName());
        i.setClipData(ClipData.newRawUri("", TepProvider.uri(f)));
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivity(Intent.createChooser(i, "Chia sẻ " + f.getName())); }
        catch (ActivityNotFoundException e) { bao("Không có ứng dụng để chia sẻ."); }
    }

    void luuVaoMay(File f) {
        tepCho = f;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(TepProvider.loai(f.getName()));
        i.putExtra(Intent.EXTRA_TITLE, f.getName());
        try { startActivityForResult(i, MA_LUU); }
        catch (ActivityNotFoundException e) { bao("Điện thoại không hỗ trợ chọn nơi lưu. Dùng Chia sẻ."); }
    }

    void luuXong(int kq, Intent data) {
        if (kq != RESULT_OK || data == null || data.getData() == null || tepCho == null) return;
        final File f = tepCho;
        final Uri dich = data.getData();
        tepCho = null;
        new Thread(new Runnable() {
            @Override
            public void run() {
                String tb;
                try {
                    InputStream in = new FileInputStream(f);
                    OutputStream ra = getContentResolver().openOutputStream(dich);
                    try { chep(in, ra); }
                    finally { in.close(); if (ra != null) ra.close(); }
                    tb = "Đã lưu " + f.getName();
                } catch (Exception e) {
                    tb = "Không lưu được: " + e.getMessage();
                }
                final String s = tb;
                ui.post(new Runnable() {
                    @Override
                    public void run() { bao(s); }
                });
            }
        }).start();
    }

    // ------------------------------------------------------------------ in (tem QR): dịch vụ in của Android

    void inTrang(String ten) {
        if (web == null) return;
        final String tenIn = ten == null || ten.length() == 0 ? "Tem QR" : ten;
        final PrintDocumentAdapter goc = web.createPrintDocumentAdapter(tenIn);
        PrintDocumentAdapter boc = new PrintDocumentAdapter() {
            @Override
            public void onStart() { goc.onStart(); }

            @Override
            public void onLayout(PrintAttributes cu, PrintAttributes moi, CancellationSignal huy, LayoutResultCallback cb, Bundle them) {
                goc.onLayout(cu, moi, huy, cb, them);
            }

            @Override
            public void onWrite(PageRange[] trang, ParcelFileDescriptor dich, CancellationSignal huy, WriteResultCallback cb) {
                goc.onWrite(trang, dich, huy, cb);
            }

            @Override
            public void onFinish() {
                goc.onFinish();
                goiJs("ungDungInXong", "");
            }
        };
        try {
            ((PrintManager) getSystemService(Context.PRINT_SERVICE)).print(tenIn, boc, null);
        } catch (Exception e) {
            bao("Không mở được dịch vụ in: " + e.getMessage());
            goiJs("ungDungInXong", "");
        }
    }

    // ------------------------------------------------------------------ cập nhật app từ máy chủ (địa chỉ /tai-app)

    /** Mỗi lần mở app: máy chủ có bản app mới hơn thì hỏi cập nhật. */
    void kiemTraCapNhat() {
        if (daKiemTraCapNhat || diaChi.length() == 0) return;
        daKiemTraCapNhat = true;
        final String dc = diaChi, vt = vanTay;
        new Thread(new Runnable() {
            @Override
            public void run() {
                final JSONObject app;
                try { app = KetNoi.ping(dc, vt).ping.optJSONObject("app"); }
                catch (Exception e) { return; }
                if (app == null || app.optInt("ma") <= maPhienBanApp()) return;
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        if (isFinishing() || !dc.equals(diaChi)) return;
                        new AlertDialog.Builder(MainActivity.this)
                            .setTitle("Có bản app mới")
                            .setMessage("Máy chủ có app Quản lý tài sản phiên bản " + app.optString("phienBan") + " (đang dùng " + phienBanApp() +
                                        "). Cập nhật ngay? Dữ liệu nằm trên máy chủ nên không mất gì.")
                            .setNegativeButton("Để sau", null)
                            .setPositiveButton("Cập nhật", new DialogInterface.OnClickListener() {
                                @Override
                                public void onClick(DialogInterface d, int w) { capNhat(); }
                            })
                            .show();
                    }
                });
            }
        }).start();
    }

    void capNhat() {
        if (diaChi.length() == 0) return;
        taiVe(diaChi + "tai-app", TEN_APK, "");
    }

    /** Bản cập nhật ký bằng khoá khác bản đang cài (build lại ở máy khác, mất khoá ký): Android không cho cài đè. */
    @SuppressWarnings("deprecation")
    boolean khacChuKy(File f) {
        try {
            PackageManager pm = getPackageManager();
            PackageInfo moi = pm.getPackageArchiveInfo(f.getPath(), PackageManager.GET_SIGNATURES);
            PackageInfo cu = pm.getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
            if (moi == null || moi.signatures == null || moi.signatures.length == 0 || cu.signatures == null || cu.signatures.length == 0) return false;
            return !moi.signatures[0].equals(cu.signatures[0]);
        } catch (Exception e) {
            return false;
        }
    }

    void caiDat(File f) {
        if (khacChuKy(f)) {
            new AlertDialog.Builder(this)
                .setTitle("Cần gỡ app cũ")
                .setMessage("Bản app mới trên máy chủ được ký bằng khoá khác nên Android không cho cài đè. Gỡ app này, rồi mở trình duyệt vào " +
                            diaChi + "tai-app để cài bản mới (chỉ cần nhập lại địa chỉ máy chủ và đăng nhập — dữ liệu nằm trên máy chủ).")
                .setNegativeButton("Để sau", null)
                .setPositiveButton("Gỡ app", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        try { startActivity(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + getPackageName()))); }
                        catch (ActivityNotFoundException e) { bao("Vào Cài đặt → Ứng dụng → Tài sản → Gỡ cài đặt."); }
                    }
                })
                .show();
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            apkCho = f;
            new AlertDialog.Builder(this)
                .setTitle("Cho phép cài bản cập nhật")
                .setMessage("Android cần cho phép app Tài sản cài bản cập nhật: bấm \"Mở cài đặt\" → bật \"Cho phép từ nguồn này\" → bấm Quay lại.")
                .setNegativeButton("Huỷ", null)
                .setPositiveButton("Mở cài đặt", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        try { startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()))); }
                        catch (ActivityNotFoundException e) { bao("Vào Cài đặt → Ứng dụng → Tài sản → Cài ứng dụng không rõ nguồn → Cho phép."); }
                    }
                })
                .show();
            return;
        }
        apkCho = null;
        Intent i = new Intent(Intent.ACTION_VIEW);
        if (Build.VERSION.SDK_INT >= 24) {
            i.setDataAndType(TepProvider.uri(f), "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            // Android 5, 6: trình cài đặt chỉ đọc file:// → chép ra bộ nhớ ngoài của app
            File ngoai = new File(getExternalCacheDir(), TEN_APK);
            try {
                InputStream in = new FileInputStream(f);
                OutputStream ra = new FileOutputStream(ngoai);
                try { chep(in, ra); } finally { in.close(); ra.close(); }
            } catch (IOException e) {
                bao("Không chép được bản cập nhật: " + e.getMessage());
                return;
            }
            ngoai.setReadable(true, false);
            i.setDataAndType(Uri.fromFile(ngoai), "application/vnd.android.package-archive");
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i); }
        catch (Exception e) { bao("Không mở được trình cài đặt: " + e.getMessage()); }
    }

    // ------------------------------------------------------------------ vòng đời, phím Back

    long lucBack;

    @Override
    public void onBackPressed() {
        if (quet != null) {
            dongQuet(true);
            return;
        }
        if (manKetNoi != null && diaChi.length() > 0 && web != null) {
            // đang nhập địa chỉ mới: Back = quay lại máy chủ đang dùng
            moTrang();
            return;
        }
        if (web == null || manKetNoi != null || manLoi != null) {
            super.onBackPressed();
            return;
        }
        // trang web đang mở hộp thoại / xem ảnh: Back đóng nó; không thì lùi trang; trang đầu: bấm 2 lần để thoát
        web.evaluateJavascript("(function(){try{return window.ungDungQuayLai?window.ungDungQuayLai():0}catch(e){return 0}})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String v) {
                    if ("1".equals(v) || "true".equals(v) || web == null) return;
                    if (web.canGoBack()) {
                        web.goBack();
                        return;
                    }
                    long bay = SystemClock.elapsedRealtime();
                    if (bay - lucBack < 2500) finish();
                    else {
                        lucBack = bay;
                        Toast.makeText(MainActivity.this, "Bấm Back lần nữa để thoát", Toast.LENGTH_SHORT).show();
                    }
                }
            });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        if (quet != null) quet.batDau();
        if (apkCho != null && (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls())) caiDat(apkCho);
    }

    @Override
    protected void onPause() {
        if (quet != null) quet.dung();
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (quet != null) quet.dung();
        if (web != null) {
            goc.removeView(web);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    // ------------------------------------------------------------------ dựng giao diện

    TextView chu(String s, float sp, int mau, boolean dam) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(mau);
        if (dam) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    Button nut(String s, boolean chinh) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        if (chinh) {
            b.setTextColor(Color.WHITE);
            b.getBackground().mutate().setTint(MAU_CHINH);
        }
        return b;
    }

    LinearLayout.LayoutParams rong() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = dp(4);
        return p;
    }
}
