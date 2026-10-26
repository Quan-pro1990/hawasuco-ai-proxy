package vn.com.hawasuco.taisan;

import android.app.Activity;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.SurfaceTexture;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.Camera;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Màn hình quét tem QR bằng camera của app, đè lên trang web. Dùng được cả khi máy chủ chạy HTTP (trình duyệt và
 * WebView chỉ cho trang https mở camera). Đọc mã bằng ZXing ngay trên điện thoại, không cần mạng.
 * Quét 1 lần: đọc được mã là đóng, đưa mã cho trang web. Quét liên tục (kiểm kê, điều chuyển): ở lại camera,
 * trang web xử lý xong từng tem thì báo kết quả (ketQua) để hiện ở đây.
 */
@SuppressWarnings("deprecation")
final class ManQuet extends FrameLayout implements TextureView.SurfaceTextureListener, Camera.PreviewCallback {

    interface NguoiNghe {
        /** Đọc được mã (luồng giao diện). */
        void daDoc(String noiDung);

        /** Người dùng bấm Xong. */
        void dong();
    }

    static final int MAU_OK = 0xE61E7B34, MAU_LOI = 0xE6C02626, MAU_CHO = 0xCC1F2937;

    final Activity a;
    final NguoiNghe nghe;
    final boolean lienTuc;
    final Handler ui = new Handler(Looper.getMainLooper());
    final TextureView tv;
    final KhungNgam khung;
    final TextView tieuDe, goiY, thongBao, dem;
    final Button nutDen;

    // luồng camera: mở / đóng camera, nhận khung hình, đọc mã
    HandlerThread luong;
    Handler cam;
    Camera camera;
    Camera.Size co;
    int xoay;
    boolean den, dangChay;
    SurfaceTexture be;
    volatile float canhKhungAnh;      // cạnh khung ngắm tính theo điểm ảnh của camera
    final DocQR doc = new DocQR();

    // chống đọc lại 1 tem còn nằm trong khung hình
    final Map<String, Long> ganDay = new HashMap<String, Long>();
    long lucBaoTrung;
    volatile boolean dangCho;          // đã đưa mã cho trang web, đang chờ kết quả
    int soDaGhi;

    final Runnable hetCho = new Runnable() {
        @Override
        public void run() {
            dangCho = false;
            bao("Chưa thấy máy chủ trả lời — kiểm tra mạng rồi quét lại.", MAU_LOI);
        }
    };

    ManQuet(Activity a, boolean lienTuc, String tieuDeChu, String goiYChu, NguoiNghe nghe) {
        super(a);
        this.a = a;
        this.nghe = nghe;
        this.lienTuc = lienTuc;
        setBackgroundColor(Color.BLACK);
        setClickable(true);

        tv = new TextureView(a);
        tv.setSurfaceTextureListener(this);
        addView(tv, new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        khung = new KhungNgam(a);
        addView(khung, new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // thanh trên: tiêu đề, đèn, xong
        LinearLayout tren = new LinearLayout(a);
        tren.setOrientation(LinearLayout.HORIZONTAL);
        tren.setGravity(Gravity.CENTER_VERTICAL);
        tren.setPadding(dp(16), dp(10), dp(8), dp(10));
        tren.setBackgroundColor(0x99000000);
        tieuDe = chu(tieuDeChu, 18, true);
        tren.addView(tieuDe, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        nutDen = nut("Đèn");
        nutDen.setVisibility(View.GONE);
        nutDen.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) { batDen(!den); }
        });
        tren.addView(nutDen);
        Button xong = nut(lienTuc ? "Xong" : "Đóng");
        xong.setOnClickListener(new OnClickListener() {
            @Override
            public void onClick(View v) { ManQuet.this.nghe.dong(); }
        });
        tren.addView(xong);
        addView(tren, new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP));

        // dưới: gợi ý, kết quả từng tem, số tem đã ghi nhận
        LinearLayout duoi = new LinearLayout(a);
        duoi.setOrientation(LinearLayout.VERTICAL);
        duoi.setGravity(Gravity.CENTER_HORIZONTAL);
        duoi.setPadding(dp(16), dp(12), dp(16), dp(24));
        goiY = chu(goiYChu, 15, false);
        goiY.setGravity(Gravity.CENTER);
        goiY.setShadowLayer(4, 0, 1, Color.BLACK);
        duoi.addView(goiY);
        thongBao = chu("", 16, true);
        thongBao.setGravity(Gravity.CENTER);
        thongBao.setPadding(dp(14), dp(10), dp(14), dp(10));
        thongBao.setVisibility(View.GONE);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(10);
        duoi.addView(thongBao, lp);
        dem = chu("", 14, false);
        dem.setGravity(Gravity.CENTER);
        dem.setShadowLayer(4, 0, 1, Color.BLACK);
        dem.setPadding(0, dp(8), 0, 0);
        dem.setVisibility(View.GONE);
        duoi.addView(dem);
        addView(duoi, new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));
    }

    // ------------------------------------------------------------------ giao diện

    int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    TextView chu(String s, float sp, boolean dam) {
        TextView t = new TextView(a);
        t.setText(s);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        if (dam) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    Button nut(String s) {
        Button b = new Button(a);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextColor(Color.WHITE);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        GradientDrawable n = new GradientDrawable();
        n.setColor(0x33FFFFFF);
        n.setCornerRadius(dp(20));
        b.setBackground(n);
        b.setMinHeight(dp(40));
        b.setMinimumHeight(dp(40));
        b.setPadding(dp(16), 0, dp(16), 0);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(40));
        lp.leftMargin = dp(8);
        b.setLayoutParams(lp);
        return b;
    }

    /** Hiện 1 dòng kết quả (màu: MAU_OK, MAU_LOI, MAU_CHO). */
    void bao(String tin, int mau) {
        if (tin == null || tin.length() == 0) {
            thongBao.setVisibility(View.GONE);
            return;
        }
        GradientDrawable n = new GradientDrawable();
        n.setColor(mau);
        n.setCornerRadius(dp(12));
        thongBao.setBackground(n);
        thongBao.setText(tin);
        thongBao.setVisibility(View.VISIBLE);
    }

    /** Trang web báo kết quả xử lý tem vừa quét: loai = "ok" / "loi" / "" (thông tin). */
    void ketQua(String tin, String loai) {
        ui.removeCallbacks(hetCho);
        dangCho = false;
        if ("ok".equals(loai)) soDaGhi++;
        bao(tin, "ok".equals(loai) ? MAU_OK : "loi".equals(loai) ? MAU_LOI : MAU_CHO);
        if (lienTuc && soDaGhi > 0) {
            dem.setText("Lần quét này: " + soDaGhi + " tem");
            dem.setVisibility(View.VISIBLE);
        }
    }

    void doiChu(String tieuDeChu, String goiYChu) {
        if (tieuDeChu != null && tieuDeChu.length() > 0) tieuDe.setText(tieuDeChu);
        if (goiYChu != null && goiYChu.length() > 0) goiY.setText(goiYChu);
    }

    // ------------------------------------------------------------------ bật / tắt camera

    /** Mở camera (khi màn hình quét hiện ra, khi app quay lại từ nền). */
    void batDau() {
        if (dangChay) return;
        dangChay = true;
        luong = new HandlerThread("camera");
        luong.start();
        cam = new Handler(luong.getLooper());
        if (be != null) cam.post(moCamera);
    }

    /** Tắt camera (đóng màn hình quét, app xuống nền). */
    void dung() {
        if (!dangChay) return;
        dangChay = false;
        ui.removeCallbacks(hetCho);
        final HandlerThread l = luong;
        cam.post(new Runnable() {
            @Override
            public void run() {
                dongCamera();
                l.quit();
            }
        });
        luong = null;
        cam = null;
        den = false;
    }

    final Runnable moCamera = new Runnable() {
        @Override
        public void run() {
            if (camera != null || be == null) return;
            try {
                int so = Camera.getNumberOfCameras(), id = -1;
                Camera.CameraInfo info = new Camera.CameraInfo();
                for (int i = 0; i < so && id < 0; i++) {
                    Camera.getCameraInfo(i, info);
                    if (info.facing == Camera.CameraInfo.CAMERA_FACING_BACK) id = i;
                }
                if (id < 0 && so > 0) id = 0;
                if (id < 0) throw new RuntimeException("Điện thoại không có camera.");
                Camera.getCameraInfo(id, info);
                Camera c = Camera.open(id);
                camera = c;
                Camera.Parameters p = c.getParameters();
                co = chonCo(p.getSupportedPreviewSizes());
                p.setPreviewSize(co.width, co.height);
                List<String> lay = p.getSupportedFocusModes();
                if (lay != null && lay.contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE)) p.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE);
                else if (lay != null && lay.contains(Camera.Parameters.FOCUS_MODE_AUTO)) p.setFocusMode(Camera.Parameters.FOCUS_MODE_AUTO);
                try { c.setParameters(p); }
                catch (RuntimeException e) {
                    // vài máy không nhận chế độ lấy nét: chỉ đặt cỡ ảnh
                    p = c.getParameters();
                    p.setPreviewSize(co.width, co.height);
                    c.setParameters(p);
                }
                final boolean coDen = p.getSupportedFlashModes() != null && p.getSupportedFlashModes().contains(Camera.Parameters.FLASH_MODE_TORCH);
                xoay = gocXoay(info);
                c.setDisplayOrientation(xoay);
                c.setPreviewTexture(be);
                int dai = co.width * co.height * 3 / 2;
                c.addCallbackBuffer(new byte[dai]);
                c.addCallbackBuffer(new byte[dai]);
                c.setPreviewCallbackWithBuffer(ManQuet.this);
                c.startPreview();
                if (Camera.Parameters.FOCUS_MODE_AUTO.equals(c.getParameters().getFocusMode())) lapLayNet();
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        nutDen.setVisibility(coDen ? View.VISIBLE : View.GONE);
                        bienDoi();
                    }
                });
            } catch (final Exception e) {
                dongCamera();
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        bao("Không mở được camera: " + (e.getMessage() == null ? e.toString() : e.getMessage()) +
                            ". Đóng ứng dụng khác đang dùng camera rồi thử lại.", MAU_LOI);
                    }
                });
            }
        }
    };

    /** Máy chỉ có lấy nét 1 lần (FOCUS_MODE_AUTO): lấy nét lại mỗi 2 giây. */
    void lapLayNet() {
        if (cam == null) return;
        cam.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (camera == null) return;
                try { camera.autoFocus(null); } catch (RuntimeException e) { /* đang lấy nét */ }
                lapLayNet();
            }
        }, 2000);
    }

    void dongCamera() {
        Camera c = camera;
        camera = null;
        if (c == null) return;
        try {
            c.setPreviewCallbackWithBuffer(null);
            c.stopPreview();
        } catch (RuntimeException e) {
            // camera đã lỗi
        }
        c.release();
    }

    /** Cỡ ảnh xem trước: gần 1280×720 nhất, cạnh dài không quá 1920. */
    static Camera.Size chonCo(List<Camera.Size> ds) {
        Camera.Size tot = ds.get(0);
        long lech = Long.MAX_VALUE;
        for (Camera.Size s : ds) {
            if (Math.max(s.width, s.height) > 1920 || Math.min(s.width, s.height) < 480) continue;
            long d = Math.abs((long) s.width * s.height - 1280L * 720);
            if (d < lech) {
                lech = d;
                tot = s;
            }
        }
        return tot;
    }

    int gocXoay(Camera.CameraInfo info) {
        int r = a.getWindowManager().getDefaultDisplay().getRotation(), d = 0;
        if (r == Surface.ROTATION_90) d = 90;
        else if (r == Surface.ROTATION_180) d = 180;
        else if (r == Surface.ROTATION_270) d = 270;
        if (info.facing == Camera.CameraInfo.CAMERA_FACING_FRONT) return (360 - (info.orientation + d) % 360) % 360;
        return (info.orientation - d + 360) % 360;
    }

    /** TextureView kéo giãn ảnh camera cho vừa khung: phóng 1 chiều để giữ đúng tỉ lệ (cắt phần thừa như ứng dụng Camera). */
    void bienDoi() {
        int vw = tv.getWidth(), vh = tv.getHeight();
        if (co == null || vw == 0 || vh == 0) return;
        float cw = xoay % 180 == 0 ? co.width : co.height, ch = xoay % 180 == 0 ? co.height : co.width;
        float tlView = vw / (float) vh, tlAnh = cw / ch;
        Matrix m = new Matrix();
        if (tlAnh > tlView) m.setScale(tlAnh / tlView, 1f, vw / 2f, vh / 2f);
        else m.setScale(1f, tlView / tlAnh, vw / 2f, vh / 2f);
        tv.setTransform(m);
        float k = Math.max(vw / cw, vh / ch);           // 1 điểm ảnh camera = k điểm màn hình
        canhKhungAnh = khung.canh / k * 1.3f;            // rộng hơn khung ngắm một chút
    }

    void batDen(final boolean bat) {
        if (cam == null) return;
        den = bat;
        nutDen.setText(bat ? "Tắt đèn" : "Đèn");
        cam.post(new Runnable() {
            @Override
            public void run() {
                if (camera == null) return;
                try {
                    Camera.Parameters p = camera.getParameters();
                    p.setFlashMode(bat ? Camera.Parameters.FLASH_MODE_TORCH : Camera.Parameters.FLASH_MODE_OFF);
                    camera.setParameters(p);
                } catch (RuntimeException e) {
                    // máy không bật được đèn khi đang quay
                }
            }
        });
    }

    // ------------------------------------------------------------------ TextureView

    @Override
    public void onSurfaceTextureAvailable(SurfaceTexture s, int w, int h) {
        be = s;
        if (dangChay) cam.post(moCamera);
    }

    @Override
    public void onSurfaceTextureSizeChanged(SurfaceTexture s, int w, int h) {
        bienDoi();
    }

    @Override
    public boolean onSurfaceTextureDestroyed(SurfaceTexture s) {
        be = null;
        if (cam != null) {
            // đóng camera trước khi bề mặt bị huỷ
            final Object xong = new Object();
            synchronized (xong) {
                cam.post(new Runnable() {
                    @Override
                    public void run() {
                        dongCamera();
                        synchronized (xong) { xong.notifyAll(); }
                    }
                });
                try { xong.wait(1500); } catch (InterruptedException e) { /* bỏ qua */ }
            }
        }
        return true;
    }

    @Override
    public void onSurfaceTextureUpdated(SurfaceTexture s) {
    }

    // ------------------------------------------------------------------ đọc mã (luồng camera)

    @Override
    public void onPreviewFrame(byte[] du, Camera c) {
        try {
            if (!dangCho && du != null && co != null) {
                final String kq = doc.doc(du, co.width, co.height, Math.round(canhKhungAnh));
                if (kq != null) {
                    ui.post(new Runnable() {
                        @Override
                        public void run() { docDuoc(kq); }
                    });
                }
            }
        } finally {
            if (camera != null) camera.addCallbackBuffer(du);
        }
    }

    void docDuoc(String kq) {
        if (!dangChay || dangCho) return;
        long bay = SystemClock.elapsedRealtime();
        for (Iterator<Map.Entry<String, Long>> it = ganDay.entrySet().iterator(); it.hasNext(); )
            if (bay - it.next().getValue() > 20000) it.remove();
        if (ganDay.containsKey(kq)) {
            // tem vừa quét còn trong khung hình
            ganDay.put(kq, bay);
            if (lienTuc && bay - lucBaoTrung > 4000 && !dangCho) {
                lucBaoTrung = bay;
                goiY.setText("Tem này vừa quét xong — đưa tem tiếp theo vào khung");
            }
            return;
        }
        ganDay.put(kq, bay);
        if (lienTuc) {
            dangCho = true;
            bao("Đang xử lý…", MAU_CHO);
            ui.postDelayed(hetCho, 15000);
        }
        nghe.daDoc(kq);
    }

    // ------------------------------------------------------------------ khung ngắm

    /** Lớp phủ: làm tối ngoài khung ngắm, 4 góc trắng, vạch quét chạy lên xuống. */
    static final class KhungNgam extends View {
        final Paint toi = new Paint(), goc = new Paint(), vach = new Paint();
        final RectF o = new RectF();
        float canh;

        KhungNgam(Context c) {
            super(c);
            toi.setColor(0x8C000000);
            goc.setColor(Color.WHITE);
            goc.setStyle(Paint.Style.STROKE);
            goc.setStrokeWidth(dp(4));
            goc.setStrokeCap(Paint.Cap.ROUND);
            goc.setAntiAlias(true);
            vach.setColor(0xCCEA6C00);
            vach.setStrokeWidth(dp(2));
        }

        float dp(float v) {
            return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
        }

        @Override
        protected void onSizeChanged(int w, int h, int ow, int oh) {
            canh = Math.min(Math.min(w, h) * 0.7f, dp(340));
            o.set((w - canh) / 2, (h - canh) / 2, (w + canh) / 2, (h + canh) / 2);
        }

        @Override
        protected void onDraw(Canvas c) {
            int w = getWidth(), h = getHeight();
            c.drawRect(0, 0, w, o.top, toi);
            c.drawRect(0, o.bottom, w, h, toi);
            c.drawRect(0, o.top, o.left, o.bottom, toi);
            c.drawRect(o.right, o.top, w, o.bottom, toi);
            float d = dp(30);
            c.drawLine(o.left, o.top, o.left + d, o.top, goc);
            c.drawLine(o.left, o.top, o.left, o.top + d, goc);
            c.drawLine(o.right, o.top, o.right - d, o.top, goc);
            c.drawLine(o.right, o.top, o.right, o.top + d, goc);
            c.drawLine(o.left, o.bottom, o.left + d, o.bottom, goc);
            c.drawLine(o.left, o.bottom, o.left, o.bottom - d, goc);
            c.drawLine(o.right, o.bottom, o.right - d, o.bottom, goc);
            c.drawLine(o.right, o.bottom, o.right, o.bottom - d, goc);
            float t = (SystemClock.uptimeMillis() % 2400) / 2400f;
            float y = o.top + canh * 0.08f + canh * 0.84f * (t < 0.5f ? t * 2 : 2 - t * 2);
            c.drawLine(o.left + canh * 0.06f, y, o.right - canh * 0.06f, y, vach);
            postInvalidateDelayed(33, (int) o.left, (int) o.top, (int) o.right + 1, (int) o.bottom + 1);
        }
    }
}
