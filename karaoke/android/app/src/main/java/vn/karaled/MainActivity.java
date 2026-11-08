package vn.karaled;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.UiModeManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.hardware.display.DisplayManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.lang.ref.WeakReference;

/**
 * Màn hình chính của app:
 *  - TV box / máy nối màn hình LED: hiện màn hình LED toàn màn hình, điện thoại quét QR để chọn bài;
 *  - điện thoại / máy tính bảng: hiện trang điều khiển; nếu cắm màn hình ngoài (HDMI, Miracast)
 *    thì màn hình LED tự hiện trên màn hình ngoài.
 * Bấm nút Quay lại (Back) hoặc Menu để đổi chế độ / thoát.
 */
public final class MainActivity extends Activity {
    private static final String MODE_LED = "led";
    private static final String MODE_CONTROLLER = "controller";
    private static final int REQ_FILE = 11;

    private WebView web;
    private String mode;
    private SharedPreferences prefs;
    private DisplayManager displayManager;
    private LedPresentation presentation;
    private ValueCallback<Uri[]> fileCallback;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int waitTries;

    private static WeakReference<MainActivity> running = new WeakReference<>(null);

    /** Gọi khi bấm "Tắt hẳn" trên thông báo. */
    static void finishRunning() {
        MainActivity a = running.get();
        if (a != null && !a.isFinishing()) a.finishAndRemoveTask();
    }

    private final DisplayManager.DisplayListener displayListener = new DisplayManager.DisplayListener() {
        public void onDisplayAdded(int displayId) { updatePresentation(); }
        public void onDisplayRemoved(int displayId) { updatePresentation(); }
        public void onDisplayChanged(int displayId) { updatePresentation(); }
    };

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("karaled", MODE_PRIVATE);
        mode = prefs.getString("mode", isTv() ? MODE_LED : MODE_CONTROLLER);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setupWebView(web, this);
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Máy không có trình chọn file", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });
        setContentView(web);

        running = new WeakReference<>(this);

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
        ServerService.start(this);
        displayManager = (DisplayManager) getSystemService(DISPLAY_SERVICE);
        displayManager.registerDisplayListener(displayListener, handler);
        waitForServer();
    }

    @SuppressLint("SetJavaScriptEnabled")
    static void setupWebView(WebView w, Context ctx) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);  // màn hình LED tự phát có tiếng
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setAllowFileAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        w.setKeepScreenOn(true);
        w.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openOutside(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openOutside(Uri.parse(url));
            }

            private boolean openOutside(Uri u) {
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.equals("127.0.0.1") || host.equals("localhost")) return false;
                // link ngoài (vd trang hướng dẫn lấy khóa API): mở bằng trình duyệt
                try {
                    ctx.startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) { }
                return true;
            }
        });
    }

    static String baseUrl() {
        KaraServer s = ServerService.server;
        return "http://127.0.0.1:" + (s == null ? 3000 : s.port());
    }

    private void waitForServer() {
        if (ServerService.server != null) {
            showMode(mode);
            updatePresentation();
            return;
        }
        if (++waitTries == 20) {
            web.loadData("<body style='background:#000;color:#fff;font:20px sans-serif;padding:24px'>Đang khởi động máy chủ…</body>", "text/html; charset=utf-8", "UTF-8");
        }
        handler.postDelayed(new Runnable() {
            public void run() { waitForServer(); }
        }, 150);
    }

    private boolean isTv() {
        UiModeManager ui = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        if (ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) return true;
        return !getPackageManager().hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
    }

    /** Màn hình ngoài đang chiếu LED? */
    private boolean presenting() {
        return presentation != null && presentation.isShowing();
    }

    private void showMode(String m) {
        if (MODE_LED.equals(m) && presenting()) {
            Toast.makeText(this, "Màn hình LED đang hiện trên màn hình ngoài", Toast.LENGTH_SHORT).show();
            m = MODE_CONTROLLER;
        }
        mode = m;
        if (!presenting()) prefs.edit().putString("mode", m).apply();
        String url = baseUrl() + (MODE_LED.equals(m) ? "/led?auto=1" : "/");
        web.loadUrl(url);
        applyImmersive();
    }

    private void applyImmersive() {
        View d = getWindow().getDecorView();
        if (MODE_LED.equals(mode)) {
            //noinspection deprecation
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        } else {
            //noinspection deprecation
            d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    /** Có màn hình ngoài (HDMI / Miracast): hiện LED trên đó, máy này làm bàn điều khiển. */
    private void updatePresentation() {
        if (ServerService.server == null || isFinishing()) return;
        Display[] ds = displayManager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
        Display target = ds.length > 0 ? ds[0] : null;
        if (presentation != null && (target == null || presentation.getDisplay().getDisplayId() != target.getDisplayId())) {
            presentation.dismiss();
            presentation = null;
            Toast.makeText(this, "Đã rút màn hình ngoài", Toast.LENGTH_SHORT).show();
        }
        if (target != null && presentation == null) {
            try {
                presentation = new LedPresentation(this, target, baseUrl() + "/led?auto=1");
                presentation.show();
                Toast.makeText(this, "Đang chiếu màn hình LED ra " + target.getName(), Toast.LENGTH_LONG).show();
                if (MODE_LED.equals(mode)) showMode(MODE_CONTROLLER);
            } catch (WindowManager.InvalidDisplayException e) {
                presentation = null;
            }
        }
    }

    private void showMenu() {
        final boolean led = MODE_LED.equals(mode);
        String addr = ServerService.server == null ? "" : ServerService.server.lanUrls().get(0).replace("http://", "");
        String[] items = {
                led ? "Trang điều khiển (trên máy này)" : "Màn hình LED (toàn màn hình)",
                "Tải lại trang",
                "Thoát hẳn (tắt máy chủ)",
        };
        new AlertDialog.Builder(this)
                .setTitle("KaraLED · điện thoại vào " + addr)
                .setItems(items, new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        if (which == 0) showMode(led ? MODE_CONTROLLER : MODE_LED);
                        else if (which == 1) web.reload();
                        else quit();
                    }
                })
                .setNegativeButton("Đóng", null)
                .show();
    }

    private void quit() {
        stopService(new Intent(this, ServerService.class));
        finishAndRemoveTask();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU) {
            showMenu();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        // hộp thoại trên trang điều khiển đang mở: để trang tự đóng
        if (MODE_CONTROLLER.equals(mode)) {
            web.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return 1}return 0})()",
                    new ValueCallback<String>() {
                        public void onReceiveValue(String v) {
                            if (!"1".equals(v)) showMenu();
                        }
                    });
            return;
        }
        showMenu();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (displayManager != null) displayManager.unregisterDisplayListener(displayListener);
        if (presentation != null) presentation.dismiss();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Trang web gọi được: window.AndroidApp.openLed() ... */
    private final class Bridge {
        @JavascriptInterface
        public void openLed() {
            handler.post(new Runnable() {
                public void run() { showMode(MODE_LED); }
            });
        }

        @JavascriptInterface
        public void openController() {
            handler.post(new Runnable() {
                public void run() { showMode(MODE_CONTROLLER); }
            });
        }

        @JavascriptInterface
        public void showMenu() {
            handler.post(new Runnable() {
                public void run() { MainActivity.this.showMenu(); }
            });
        }
    }
}
