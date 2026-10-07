package vn.com.hawasuco.thatthoat;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintManager;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;

/**
 * App "Thất thoát nước": mở website trên máy chủ IIS của công ty (HTTP cổng 80, vd http://192.168.1.10/ hoặc
 * http://tenmien.vn/thatthoat/) trong WebView. Trang web gọi app qua window.ThatThoatApp:
 * taiVe(url, tên, pdf) tải file báo cáo rồi in / mở / chia sẻ / lưu; doiMayChu() nhập lại địa chỉ máy chủ.
 */
public class MainActivity extends Activity {
    static final String KHOA_DIA_CHI = "diaChi";
    static final int MA_LUU = 7;
    static final int MAU_CHINH = 0xFF1D5F95;
    static final int MAU_DO = 0xFFC02626;
    static final int MAU_MO = 0xFF5F6875;

    final Handler ui = new Handler(Looper.getMainLooper());
    SharedPreferences cauHinh;
    String diaChi = "";          // địa chỉ trang web đã kiểm tra, luôn kết thúc bằng "/"
    FrameLayout goc;
    WebView web;
    ProgressBar thanhTai;
    View manLoi, manKetNoi;
    File tepCho;                 // file đang chờ chọn chỗ lưu (ACTION_CREATE_DOCUMENT)
    boolean dangTai;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        cauHinh = getSharedPreferences("maychu", MODE_PRIVATE);
        goc = new FrameLayout(this);
        setContentView(goc);
        diaChi = cauHinh.getString(KHOA_DIA_CHI, "");
        if (diaChi.length() == 0) hienKetNoi("", null);
        else moTrang();
    }

    int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    String phienBanApp() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
        catch (Exception e) { return ""; }
    }

    // ------------------------------------------------------------------ trang web

    void moTrang() {
        an(manKetNoi);
        manKetNoi = null;
        an(manLoi);
        manLoi = null;
        if (web == null) {
            taoWeb();
            goc.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            thanhTai = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            thanhTai.setMax(100);
            thanhTai.setVisibility(View.GONE);
            goc.addView(thanhTai, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(4), Gravity.TOP));
        }
        web.setVisibility(View.VISIBLE);
        web.loadUrl(diaChi);
    }

    void an(View v) {
        if (v != null) goc.removeView(v);
    }

    void taoWeb() {
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " ThatThoatApp/" + phienBanApp());
        web.addJavascriptInterface(new CauNoi(), "ThatThoatApp");
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
                hienLoi(moTaLoiMang(ma, moTa));
            }

            @Override
            public void onReceivedHttpError(WebView v, WebResourceRequest yc, WebResourceResponse tl) {
                if (yc.isForMainFrame() && tl.getStatusCode() >= 400)
                    hienLoi("Máy chủ trả lỗi " + tl.getStatusCode() + ". Kiểm tra lại địa chỉ (vd thêm /thatthoat) hoặc báo quản trị.");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                thanhTai.setProgress(p);
                thanhTai.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
            }
        });
        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String ua, String cd, String mime, long dai) {
                String ten = URLUtil.guessFileName(url, cd, mime);
                taiVe(url, ten, ten.toLowerCase().endsWith(".pdf"));
            }
        });
    }

    /** Địa chỉ thuộc máy chủ đã chọn: mở trong app; trang khác: mở bằng trình duyệt. */
    boolean moNgoai(String url) {
        if (cungMayChu(url)) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "Không mở được " + url, Toast.LENGTH_LONG).show(); }
        return true;
    }

    boolean cungMayChu(String url) {
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
            case WebViewClient.ERROR_HOST_LOOKUP: return "Không tìm thấy tên máy chủ. Kiểm tra địa chỉ và kết nối mạng (Wi-Fi / 4G).";
            case WebViewClient.ERROR_CONNECT: return "Không kết nối được máy chủ. Kiểm tra mạng; trong công ty dùng IP nội bộ, ở ngoài dùng IP công cộng / tên miền.";
            case WebViewClient.ERROR_TIMEOUT: return "Máy chủ không trả lời kịp. Thử lại sau.";
            default: return moTa;
        }
    }

    void hienLoi(String moTa) {
        an(manLoi);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setGravity(Gravity.CENTER);
        l.setPadding(dp(24), dp(24), dp(24), dp(24));
        l.setBackgroundColor(0xFFF3F5F8);
        l.setClickable(true);
        l.addView(chu("Không mở được trang", 20, MAU_CHINH, true));
        TextView dc = chu(diaChi, 14, MAU_MO, false);
        l.addView(dc);
        TextView t = chu(moTa, 15, MAU_DO, false);
        t.setPadding(0, dp(12), 0, dp(16));
        l.addView(t);
        Button thu = nut("Thử lại", true);
        thu.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { moTrang(); }
        });
        l.addView(thu, rong());
        Button doi = nut("Đổi máy chủ", false);
        doi.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { hienKetNoi(diaChi, null); }
        });
        l.addView(doi, rong());
        manLoi = l;
        goc.addView(l, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    // ------------------------------------------------------------------ nhập địa chỉ máy chủ

    void hienKetNoi(String goiY, String loi) {
        an(manKetNoi);
        an(manLoi);
        manLoi = null;
        if (web != null) {
            web.stopLoading();
            web.setVisibility(View.GONE);
        }
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.setBackgroundColor(0xFFF3F5F8);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(dp(24), dp(40), dp(24), dp(24));
        sv.addView(l);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.ic_launcher);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(84), dp(84));
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        l.addView(logo, lp);
        TextView td = chu("Quản lý thất thoát nước", 21, 0xFF174E7B, true);
        td.setGravity(Gravity.CENTER_HORIZONTAL);
        td.setPadding(0, dp(10), 0, dp(4));
        l.addView(td);
        TextView mo = chu("Nhập địa chỉ máy chủ do quản trị cung cấp (địa chỉ mở bằng trình duyệt).", 14, MAU_MO, false);
        mo.setGravity(Gravity.CENTER_HORIZONTAL);
        mo.setPadding(0, 0, 0, dp(18));
        l.addView(mo);

        l.addView(chu("Địa chỉ máy chủ", 13, MAU_MO, false));
        final EditText o = new EditText(this);
        o.setSingleLine(true);
        o.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        o.setImeOptions(EditorInfo.IME_ACTION_GO);
        o.setHint("vd 192.168.1.10 hoặc tenmien.vn/thatthoat");
        o.setText(goiY == null ? "" : goiY.replaceFirst("^http://", "").replaceAll("/+$", ""));
        o.setSelection(o.getText().length());
        l.addView(o, rong());
        final TextView tb = chu(loi == null ? "" : loi, 14, MAU_DO, false);
        tb.setPadding(0, dp(6), 0, dp(6));
        l.addView(tb);
        final Button nut = nut("Kết nối", true);
        l.addView(nut, rong());
        TextView ghiChu = chu("Website chạy HTTP cổng 80 trên máy chủ IIS của công ty. Trong mạng nội bộ dùng IP của máy chủ " +
                              "(vd 192.168.1.10); ở ngoài dùng IP công cộng hoặc tên miền. Cài thành ứng dụng con thì thêm /thatthoat.", 13, MAU_MO, false);
        ghiChu.setPadding(0, dp(18), 0, 0);
        l.addView(ghiChu);
        String pb = phienBanApp();
        if (pb.length() > 0) {
            TextView v = chu("App phiên bản " + pb, 12, MAU_MO, false);
            v.setPadding(0, dp(12), 0, 0);
            l.addView(v);
        }

        final View.OnClickListener ketNoi = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                final String dc = chuanHoa(o.getText().toString());
                if (dc.length() == 0) { tb.setText("Nhập địa chỉ máy chủ."); return; }
                ((InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(o.getWindowToken(), 0);
                nut.setEnabled(false);
                nut.setText("Đang kết nối…");
                tb.setText("");
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        String loiKq = null, dung = null;
                        try { dung = timMayChu(dc); }
                        catch (Exception e) { loiKq = e.getMessage(); }
                        final String kq = dung, loiCuoi = loiKq;
                        ui.post(new Runnable() {
                            @Override
                            public void run() {
                                nut.setEnabled(true);
                                nut.setText("Kết nối");
                                if (kq == null) { tb.setText(loiCuoi); return; }
                                diaChi = kq;
                                cauHinh.edit().putString(KHOA_DIA_CHI, kq).apply();
                                moTrang();
                            }
                        });
                    }
                }).start();
            }
        };
        nut.setOnClickListener(ketNoi);
        o.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int id, KeyEvent e) {
                ketNoi.onClick(v);
                return true;
            }
        });
        manKetNoi = sv;
        goc.addView(sv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        o.requestFocus();
    }

    /** "192.168.1.10" → "http://192.168.1.10/"; giữ https:// nếu người dùng ghi. */
    static String chuanHoa(String s) {
        s = s.trim().replace('\\', '/').replace(" ", "");
        if (s.length() == 0) return "";
        if (!s.matches("(?i)^https?://.*")) s = "http://" + s;
        int q = s.indexOf('?');
        if (q >= 0) s = s.substring(0, q);
        q = s.indexOf('#');
        if (q >= 0) s = s.substring(0, q);
        if (s.toLowerCase().endsWith("/index.html")) s = s.substring(0, s.length() - 10);
        if (!s.endsWith("/")) s += "/";
        return s;
    }

    /** Gọi api/ping: đúng máy chủ Thất thoát nước thì trả địa chỉ; không ghi đường dẫn thì thử thêm /thatthoat/. */
    static String timMayChu(String dc) throws IOException {
        IOException loi;
        try {
            ping(dc);
            return dc;
        } catch (IOException e) {
            loi = e;
        }
        Uri u = Uri.parse(dc);
        if (u.getPath() == null || u.getPath().equals("/")) {
            String thu = dc + "thatthoat/";
            try {
                ping(thu);
                return thu;
            } catch (IOException e) {
                // giữ lỗi của địa chỉ người dùng gõ
            }
        }
        throw loi;
    }

    static void ping(String dc) throws IOException {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(dc + "api/ping").openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setRequestProperty("Accept", "application/json");
            int ma = c.getResponseCode();
            if (ma != 200) throw new IOException("Máy chủ trả lỗi " + ma + " ở " + dc + " — kiểm tra lại đường dẫn (vd thêm /thatthoat).");
            String t = new String(docHet(c.getInputStream()), "UTF-8");
            JSONObject j;
            try { j = new JSONObject(t); }
            catch (Exception e) { throw new IOException(dc + " không phải máy chủ Thất thoát nước (trả về trang khác)."); }
            if (!"ThatThoatNuoc".equals(j.optString("ungDung"))) throw new IOException(dc + " không phải máy chủ Thất thoát nước.");
        } catch (UnknownHostException e) {
            throw new IOException("Không tìm thấy tên máy chủ trong " + dc + ". Kiểm tra địa chỉ và mạng.");
        } catch (ConnectException e) {
            throw new IOException("Không kết nối được " + dc + ". Kiểm tra mạng, địa chỉ, máy chủ có đang chạy.");
        } catch (SocketTimeoutException e) {
            throw new IOException("Máy chủ " + dc + " không trả lời kịp.");
        } finally {
            if (c != null) c.disconnect();
        }
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

    void hoiDoiMayChu() {
        new AlertDialog.Builder(this)
            .setTitle("Đổi máy chủ?")
            .setMessage("Đang dùng: " + diaChi + "\nNhập địa chỉ máy chủ khác (đăng nhập lại ở máy chủ mới).")
            .setNegativeButton("Huỷ", null)
            .setPositiveButton("Đổi máy chủ", new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface d, int w) { hienKetNoi(diaChi, null); }
            })
            .show();
    }

    // ------------------------------------------------------------------ tải báo cáo: in, mở, chia sẻ, lưu

    /** Cầu nối cho trang web (window.ThatThoatApp). */
    class CauNoi {
        @JavascriptInterface
        public void taiVe(final String url, final String ten, final boolean pdf) {
            ui.post(new Runnable() {
                @Override
                public void run() { MainActivity.this.taiVe(url, ten, pdf); }
            });
        }

        @JavascriptInterface
        public void doiMayChu() {
            ui.post(new Runnable() {
                @Override
                public void run() { hoiDoiMayChu(); }
            });
        }

        @JavascriptInterface
        public String phienBan() {
            return phienBanApp();
        }
    }

    void taiVe(final String url, String ten, final boolean pdf) {
        if (!cungMayChu(url)) { Toast.makeText(this, "Chỉ tải file từ máy chủ đang dùng.", Toast.LENGTH_LONG).show(); return; }
        if (dangTai) return;
        dangTai = true;
        final String tenTep = TepProvider.tenAnToan(ten == null || ten.length() == 0 ? "bao-cao" + (pdf ? ".pdf" : ".xlsx") : ten);
        final ProgressDialog cho = ProgressDialog.show(this, null, "Đang tải " + tenTep + "…", true, false);
        new Thread(new Runnable() {
            @Override
            public void run() {
                File f = null;
                String loi = null;
                HttpURLConnection c = null;
                try {
                    c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(120000);
                    int ma = c.getResponseCode();
                    if (ma != 200) throw new IOException(ma == 404 ? "Liên kết tải đã hết hạn — bấm tải lại." : "Máy chủ trả lỗi " + ma + ".");
                    f = TepProvider.tep(MainActivity.this, tenTep);
                    InputStream in = c.getInputStream();
                    OutputStream ra = new FileOutputStream(f);
                    try { chep(in, ra); }
                    finally { in.close(); ra.close(); }
                } catch (Exception e) {
                    loi = e instanceof IOException && e.getMessage() != null ? e.getMessage() : "Không tải được: " + e;
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
                        if (loiCuoi != null) { Toast.makeText(MainActivity.this, loiCuoi, Toast.LENGTH_LONG).show(); return; }
                        hoiMoTep(kq, pdf);
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

    void hoiMoTep(final File f, final boolean pdf) {
        final String[] chon = pdf
            ? new String[] { "In (máy in của điện thoại / lưu PDF)", "Mở bằng ứng dụng khác", "Chia sẻ (Zalo, email…)", "Lưu vào máy…" }
            : new String[] { "Mở (Excel, WPS…)", "Chia sẻ (Zalo, email…)", "Lưu vào máy…" };
        new AlertDialog.Builder(this)
            .setTitle(f.getName())
            .setItems(chon, new DialogInterface.OnClickListener() {
                @Override
                public void onClick(DialogInterface d, int i) {
                    int k = pdf ? i : i + 1;
                    if (k == 0) inPdf(f);
                    else if (k == 1) moTep(f);
                    else if (k == 2) chiaSe(f);
                    else luuVaoMay(f);
                }
            })
            .setNegativeButton("Đóng", null)
            .show();
    }

    void inPdf(File f) {
        PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
        String ten = f.getName().replaceAll("\\.pdf$", "");
        pm.print(ten, new InPdf(f, ten), null);
    }

    void moTep(File f) {
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(TepProvider.uri(f), TepProvider.loai(f.getName()));
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivity(Intent.createChooser(i, "Mở " + f.getName())); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "Chưa có ứng dụng mở được file này. Chọn Chia sẻ hoặc Lưu vào máy.", Toast.LENGTH_LONG).show(); }
    }

    void chiaSe(File f) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType(TepProvider.loai(f.getName()));
        i.putExtra(Intent.EXTRA_STREAM, TepProvider.uri(f));
        i.putExtra(Intent.EXTRA_SUBJECT, f.getName());
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivity(Intent.createChooser(i, "Chia sẻ " + f.getName())); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "Không có ứng dụng để chia sẻ.", Toast.LENGTH_LONG).show(); }
    }

    void luuVaoMay(File f) {
        tepCho = f;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(TepProvider.loai(f.getName()));
        i.putExtra(Intent.EXTRA_TITLE, f.getName());
        try { startActivityForResult(i, MA_LUU); }
        catch (ActivityNotFoundException e) { Toast.makeText(this, "Điện thoại không hỗ trợ chọn nơi lưu. Dùng Chia sẻ.", Toast.LENGTH_LONG).show(); }
    }

    @Override
    protected void onActivityResult(int ma, int kq, Intent data) {
        super.onActivityResult(ma, kq, data);
        if (ma != MA_LUU || kq != RESULT_OK || data == null || data.getData() == null || tepCho == null) return;
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
                    public void run() { Toast.makeText(MainActivity.this, s, Toast.LENGTH_LONG).show(); }
                });
            }
        }).start();
    }

    // ------------------------------------------------------------------ vòng đời, phím Back

    @Override
    public void onBackPressed() {
        if (manKetNoi != null && diaChi.length() > 0 && web != null) {
            // đang nhập địa chỉ mới: Back = quay lại máy chủ đang dùng
            moTrang();
            return;
        }
        if (web == null || manKetNoi != null || manLoi != null) {
            super.onBackPressed();
            return;
        }
        // trang web đang mở hộp thoại: Back đóng hộp thoại; không thì lùi trang / thoát app
        web.evaluateJavascript("(function(){var h=document.querySelectorAll('.hop');if(h.length){h[h.length-1].remove();return 1}return 0})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String v) {
                    if ("1".equals(v)) return;
                    if (web.canGoBack()) web.goBack();
                    else finish();
                }
            });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
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
