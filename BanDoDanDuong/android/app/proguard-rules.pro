# Không thu gọn mã: cầu nối JavaScript gọi các hàm @JavascriptInterface theo tên
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
