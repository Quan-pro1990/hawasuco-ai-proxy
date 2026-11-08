package vn.karaled;

import android.app.Presentation;
import android.content.Context;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

/** Màn hình LED hiện trên màn hình ngoài (cáp HDMI, Miracast) trong khi máy này làm bàn điều khiển. */
final class LedPresentation extends Presentation {
    private final String url;
    private WebView web;

    LedPresentation(Context outer, Display display, String url) {
        super(outer, display);
        this.url = url;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(getContext());
        web.setBackgroundColor(Color.BLACK);
        MainActivity.setupWebView(web, getContext());
        web.setWebChromeClient(new WebChromeClient());
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION);
        setContentView(web);
        web.loadUrl(url);
    }

    @Override
    public void onDetachedFromWindow() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDetachedFromWindow();
    }
}
