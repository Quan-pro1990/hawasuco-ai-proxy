package vn.hawasuco.camera;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.RectF;
import android.graphics.SurfaceTexture;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.location.Location;
import android.location.LocationManager;
import android.media.MediaActionSound;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.OrientationEventListener;
import android.view.ScaleGestureDetector;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Màn hình chụp ảnh: khung ngắm có watermark, nút chụp, flash, đổi camera, cài đặt. */
public final class MainActivity extends Activity
        implements CameraController.Listener, LocationTracker.Listener, Views.OverlayView.Source {
    private static final int REQ_PERMS = 7;
    private static final int GREEN = 0xE01E9E4A, ORANGE = 0xE0E08A00, RED = 0xE0D33A2C;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService saver = Executors.newSingleThreadExecutor();

    private Prefs prefs;
    private Watermark saveMark;
    private CameraController camera;
    private LocationTracker tracker;
    private MapTiles maps;
    private MediaActionSound sound;
    private OrientationEventListener orientation;
    private volatile int deviceOrientation;

    private TextureView texture;
    private Views.OverlayView overlay;
    private View flashFx;
    private TextView gpsChip, zoomChip, message;
    private Views.IconView btnFlash, btnSwitch;
    private Views.ShutterView shutter;
    private Views.ThumbView thumb;
    private Runnable messageAction;

    private boolean resumed, askedPermissions, cameraReady;
    private int previewW, previewH;
    private float maxZoom = 1f, zoom = 1f;
    private StampData pendingShot;
    private int saving;
    private Uri lastUri;

    private MapTiles.MapImage map;
    private boolean mapBusy;
    private long mapRetryAt;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            overlay.invalidate();
            updateGpsChip();
            main.postDelayed(this, 1000 - System.currentTimeMillis() % 1000);
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = Prefs.load(this);
        Bitmap logo = BitmapFactory.decodeResource(getResources(), R.drawable.logo);
        saveMark = new Watermark(logo);
        camera = new CameraController(this, this);
        tracker = new LocationTracker(this, this);
        tracker.frontCamera = prefs.frontCamera;
        maps = new MapTiles(this);
        sound = new MediaActionSound();
        sound.load(MediaActionSound.SHUTTER_CLICK);
        orientation = new OrientationEventListener(this) {
            @Override
            public void onOrientationChanged(int o) {
                if (o != ORIENTATION_UNKNOWN) deviceOrientation = o;
            }
        };
        buildUi(logo);
        restoreLastPhoto();
    }

    // ----- Giao diện

    private void buildUi(Bitmap logo) {
        Views.RootLayout root = new Views.RootLayout(this);
        root.setBackgroundColor(Color.BLACK);

        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12), 0, dp(12), 0);
        btnFlash = new Views.IconView(this, Views.IconView.FLASH);
        btnFlash.setState(prefs.flashMode);
        top.addView(btnFlash, new LinearLayout.LayoutParams(dp(42), dp(42)));
        FrameLayout mid = new FrameLayout(this);
        gpsChip = chip();
        mid.addView(gpsChip, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        top.addView(mid, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f));
        Views.IconView btnSettings = new Views.IconView(this, Views.IconView.GEAR);
        top.addView(btnSettings, new LinearLayout.LayoutParams(dp(42), dp(42)));

        FrameLayout frame = new FrameLayout(this);
        texture = new TextureView(this);
        frame.addView(texture, matchParent());
        overlay = new Views.OverlayView(this, logo, this);
        frame.addView(overlay, matchParent());
        flashFx = new View(this);
        flashFx.setBackgroundColor(Color.WHITE);
        flashFx.setAlpha(0f);
        frame.addView(flashFx, matchParent());
        zoomChip = chip();
        zoomChip.setVisibility(View.GONE);
        FrameLayout.LayoutParams zl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.RIGHT);
        zl.topMargin = dp(14);
        zl.rightMargin = dp(14);
        frame.addView(zoomChip, zl);
        message = new TextView(this);
        message.setTextColor(Color.WHITE);
        message.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        message.setGravity(Gravity.CENTER);
        message.setBackgroundColor(0xDD000000);
        message.setPadding(dp(24), dp(20), dp(24), dp(20));
        message.setVisibility(View.GONE);
        frame.addView(message, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        FrameLayout bottom = new FrameLayout(this);
        shutter = new Views.ShutterView(this);
        shutter.setEnabled(false);
        bottom.addView(shutter, new FrameLayout.LayoutParams(dp(78), dp(78), Gravity.CENTER));
        thumb = new Views.ThumbView(this);
        FrameLayout.LayoutParams tl = new FrameLayout.LayoutParams(dp(54), dp(54), Gravity.CENTER_VERTICAL | Gravity.LEFT);
        tl.leftMargin = dp(32);
        bottom.addView(thumb, tl);
        btnSwitch = new Views.IconView(this, Views.IconView.SWITCH);
        FrameLayout.LayoutParams sl = new FrameLayout.LayoutParams(dp(54), dp(54), Gravity.CENTER_VERTICAL | Gravity.RIGHT);
        sl.rightMargin = dp(32);
        bottom.addView(btnSwitch, sl);

        root.setParts(top, frame, bottom, dp(56), dp(120));
        setContentView(root);

        btnFlash.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                prefs.flashMode = (prefs.flashMode + 1) % 3;
                prefs.save(MainActivity.this);
                btnFlash.setState(prefs.flashMode);
                camera.setFlash(prefs.flashMode);
                String[] names = {"Tắt đèn flash", "Đèn flash tự động", "Luôn bật đèn flash"};
                Dialogs.toast(MainActivity.this, names[prefs.flashMode]);
            }
        });
        btnSettings.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSettings();
            }
        });
        btnSwitch.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                switchCamera();
            }
        });
        shutter.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                shoot();
            }
        });
        thumb.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openLastPhoto();
            }
        });
        gpsChip.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                onGpsChipClick();
            }
        });
        message.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (messageAction != null) messageAction.run();
            }
        });

        texture.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override
            public void onSurfaceTextureAvailable(SurfaceTexture st, int w, int h) {
                startCameraIfPossible();
            }

            @Override
            public void onSurfaceTextureSizeChanged(SurfaceTexture st, int w, int h) {
                applyTransform();
            }

            @Override
            public boolean onSurfaceTextureDestroyed(SurfaceTexture st) {
                cameraReady = false;
                camera.close();
                return true;
            }

            @Override
            public void onSurfaceTextureUpdated(SurfaceTexture st) {
            }
        });

        final ScaleGestureDetector pinch = new ScaleGestureDetector(this,
                new ScaleGestureDetector.SimpleOnScaleGestureListener() {
                    @Override
                    public boolean onScale(ScaleGestureDetector d) {
                        setZoom(zoom * d.getScaleFactor());
                        return true;
                    }
                });
        final GestureDetector taps = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onSingleTapUp(MotionEvent e) {
                onPreviewTap(e.getX(), e.getY());
                return true;
            }
        });
        overlay.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent e) {
                pinch.onTouchEvent(e);
                if (!pinch.isInProgress() && e.getPointerCount() == 1) taps.onTouchEvent(e);
                return true;
            }
        });
    }

    private TextView chip() {
        TextView t = new TextView(this);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(dp(12), dp(5), dp(12), dp(5));
        t.setSingleLine(true);
        setChipColor(t, 0x99000000);
        return t;
    }

    private void setChipColor(TextView t, int color) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(16));
        t.setBackground(g);
    }

    private FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private int dp(float v) {
        return Dialogs.dp(this, v);
    }

    private void showMessage(String text, Runnable action) {
        message.setText(text);
        messageAction = action;
        message.setVisibility(View.VISIBLE);
    }

    // ----- Vòng đời & quyền

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        if (orientation.canDetectOrientation()) orientation.enable();
        main.removeCallbacks(tick);
        main.post(tick);
        if (granted(Manifest.permission.CAMERA)) {
            message.setVisibility(View.GONE);
            startCameraIfPossible();
        } else if (askedPermissions) {
            showCameraPermissionMessage();
        }
        if (tracker.hasPermission()) tracker.start();
        if (!askedPermissions) {
            String[] need = missingPermissions();
            askedPermissions = true;
            if (need.length > 0) requestPermissions(need, REQ_PERMS);
        }
    }

    @Override
    protected void onPause() {
        resumed = false;
        cameraReady = false;
        shutter.setEnabled(false);
        camera.close();
        tracker.stop();
        orientation.disable();
        main.removeCallbacks(tick);
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        camera.release();
        saver.shutdown();
        sound.release();
        super.onDestroy();
    }

    private String[] missingPermissions() {
        List<String> need = new ArrayList<String>();
        need.add(Manifest.permission.CAMERA);
        need.add(Manifest.permission.ACCESS_FINE_LOCATION);
        need.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (Build.VERSION.SDK_INT < 29) need.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        List<String> out = new ArrayList<String>();
        for (String p : need) if (!granted(p)) out.add(p);
        return out.toArray(new String[0]);
    }

    private boolean granted(String perm) {
        return checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode != REQ_PERMS) return;
        if (granted(Manifest.permission.CAMERA)) {
            message.setVisibility(View.GONE);
            startCameraIfPossible();
        } else {
            showCameraPermissionMessage();
        }
        if (tracker.hasPermission()) {
            tracker.stop();
            tracker.start();
        }
        updateGpsChip();
    }

    private void showCameraPermissionMessage() {
        showMessage("Ứng dụng cần quyền Camera để chụp ảnh.\nBấm vào đây để cấp quyền.", new Runnable() {
            @Override
            public void run() {
                if (shouldShowRequestPermissionRationale(Manifest.permission.CAMERA)) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_PERMS);
                } else {
                    openAppSettings();
                }
            }
        });
    }

    private void openAppSettings() {
        try {
            startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", getPackageName(), null)));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    // ----- Camera

    private void startCameraIfPossible() {
        if (!resumed || !granted(Manifest.permission.CAMERA) || !texture.isAvailable()) return;
        cameraReady = false;
        shutter.setEnabled(false);
        camera.open(texture.getSurfaceTexture(), prefs.frontCamera, prefs.photoSize == Prefs.SIZE_LARGE, prefs.flashMode);
    }

    @Override
    public void onCameraReady(final int pw, final int ph, final boolean hasFlash, final float maxZ) {
        main.post(new Runnable() {
            @Override
            public void run() {
                if (!resumed) return;
                cameraReady = true;
                previewW = pw;
                previewH = ph;
                maxZoom = maxZ;
                zoom = 1f;
                zoomChip.setVisibility(View.GONE);
                applyTransform();
                btnFlash.setEnabled(hasFlash);
                shutter.setEnabled(true);
                message.setVisibility(View.GONE);
                if (!prefs.introShown) {
                    // Lần đầu mở app: mời nhập tên nhân viên và đội
                    prefs.introShown = true;
                    prefs.save(MainActivity.this);
                    if (prefs.employee.isEmpty() || prefs.team.isEmpty()) showSettings();
                }
            }
        });
    }

    @Override
    public void onCameraError(final String msg) {
        main.post(new Runnable() {
            @Override
            public void run() {
                cameraReady = false;
                shutter.setEnabled(false);
                if (!resumed) return;
                showMessage(msg + "\nBấm vào đây để thử lại.", new Runnable() {
                    @Override
                    public void run() {
                        message.setVisibility(View.GONE);
                        startCameraIfPossible();
                    }
                });
            }
        });
    }

    /** Khung ngắm luôn phủ kín khung 3:4 (cắt bớt nếu tỉ lệ camera khác), quay đúng chiều màn hình. */
    private void applyTransform() {
        int vw = texture.getWidth(), vh = texture.getHeight();
        if (vw == 0 || vh == 0 || previewW == 0 || previewH == 0) return;
        Matrix m = new Matrix();
        float cx = vw / 2f, cy = vh / 2f;
        int rotation = getWindowManager().getDefaultDisplay().getRotation();
        if (rotation == Surface.ROTATION_90 || rotation == Surface.ROTATION_270) {
            RectF view = new RectF(0, 0, vw, vh);
            RectF buf = new RectF(0, 0, previewH, previewW);
            buf.offset(cx - buf.centerX(), cy - buf.centerY());
            m.setRectToRect(view, buf, Matrix.ScaleToFit.FILL);
            float s = Math.max((float) vh / previewH, (float) vw / previewW);
            m.postScale(s, s, cx, cy);
            m.postRotate(90 * (rotation - 2), cx, cy);
        } else {
            float contentW = Math.min(previewW, previewH), contentH = Math.max(previewW, previewH);
            float viewAspect = (float) vw / vh, contentAspect = contentW / contentH;
            if (contentAspect > viewAspect) m.setScale(contentAspect / viewAspect, 1f, cx, cy);
            else m.setScale(1f, viewAspect / contentAspect, cx, cy);
            if (rotation == Surface.ROTATION_180) m.postRotate(180, cx, cy);
        }
        texture.setTransform(m);
    }

    private void switchCamera() {
        prefs.frontCamera = !prefs.frontCamera;
        prefs.save(this);
        tracker.frontCamera = prefs.frontCamera;
        startCameraIfPossible();
    }

    private void setZoom(float z) {
        if (!cameraReady || maxZoom <= 1f) return;
        zoom = camera.setZoom(z);
        if (zoom > 1.01f) {
            zoomChip.setText(String.format(Locale.US, "%.1f×", zoom));
            zoomChip.setVisibility(View.VISIBLE);
        } else {
            zoomChip.setVisibility(View.GONE);
        }
    }

    private void onPreviewTap(float x, float y) {
        if (overlay.infoBounds().contains(x, y)) {
            showSettings();
            return;
        }
        if (!cameraReady) return;
        overlay.showFocus(x, y);
        camera.focusAt(x / overlay.getWidth(), y / overlay.getHeight());
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP
                || keyCode == KeyEvent.KEYCODE_CAMERA) {
            if (event.getRepeatCount() == 0) shoot();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    // ----- Chụp & lưu

    private void shoot() {
        if (!cameraReady) {
            Dialogs.toast(this, "Camera chưa sẵn sàng");
            return;
        }
        if (pendingShot != null) return;
        if (saving >= 3) {
            Dialogs.toast(this, "Đang lưu ảnh, chờ một chút…");
            return;
        }
        StampData d = stamp();
        if (!camera.takePicture(deviceOrientation)) return;
        pendingShot = d;
        saving++;
        thumb.setBusy(true);
        if (prefs.shutterSound) sound.play(MediaActionSound.SHUTTER_CLICK);
        flashFx.setAlpha(0.85f);
        flashFx.animate().alpha(0f).setDuration(220).start();
    }

    @Override
    public void onPhoto(final byte[] jpeg) {
        main.post(new Runnable() {
            @Override
            public void run() {
                final StampData d = pendingShot != null ? pendingShot : stamp();
                pendingShot = null;
                final Prefs snapshot = prefs.copy();
                saver.execute(new Runnable() {
                    @Override
                    public void run() {
                        processPhoto(jpeg, d, snapshot);
                    }
                });
            }
        });
    }

    @Override
    public void onCaptureFailed() {
        main.post(new Runnable() {
            @Override
            public void run() {
                if (pendingShot == null) return;
                pendingShot = null;
                saving--;
                thumb.setBusy(saving > 0);
                if (resumed) Dialogs.toast(MainActivity.this, "Chụp không thành công, vui lòng thử lại");
            }
        });
    }

    private void processPhoto(byte[] jpeg, StampData d, Prefs snapshot) {
        PhotoSaver.Result r = null;
        String err = null;
        try {
            r = PhotoSaver.save(this, jpeg, d, snapshot, saveMark);
        } catch (Throwable t) {
            err = t.getMessage() != null ? t.getMessage() : t.toString();
        }
        final PhotoSaver.Result result = r;
        final String error = err;
        main.post(new Runnable() {
            @Override
            public void run() {
                saving--;
                thumb.setBusy(saving > 0);
                if (result != null) {
                    lastUri = result.uri;
                    thumb.setImage(result.thumb);
                    prefs.lastPhoto = result.uri.toString();
                    prefs.save(MainActivity.this);
                    Dialogs.toast(MainActivity.this, "Đã lưu ảnh vào Thư viện (DCIM/HAWASUCO)");
                } else {
                    Dialogs.toast(MainActivity.this, "Lỗi lưu ảnh: " + error);
                }
            }
        });
    }

    private void restoreLastPhoto() {
        if (prefs.lastPhoto == null || prefs.lastPhoto.isEmpty()) return;
        final Uri uri = Uri.parse(prefs.lastPhoto);
        saver.execute(new Runnable() {
            @Override
            public void run() {
                final Bitmap b = PhotoSaver.loadScaled(MainActivity.this, uri, 200);
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        if (b != null) {
                            lastUri = uri;
                            thumb.setImage(b);
                        } else {
                            prefs.lastPhoto = "";
                            prefs.save(MainActivity.this);
                        }
                    }
                });
            }
        });
    }

    private void openLastPhoto() {
        if (lastUri == null) {
            Dialogs.toast(this, "Chưa có ảnh nào");
            return;
        }
        Dialogs.review(this, lastUri, new Dialogs.ReviewCallback() {
            @Override
            public void onDeleted() {
                lastUri = null;
                prefs.lastPhoto = "";
                prefs.save(MainActivity.this);
                thumb.setImage(null);
            }
        });
    }

    private void showSettings() {
        final int oldSize = prefs.photoSize, oldMap = prefs.mapType;
        final boolean oldShowMap = prefs.showMap;
        Dialogs.settings(this, prefs, new Runnable() {
            @Override
            public void run() {
                prefs.save(MainActivity.this);
                if (prefs.photoSize != oldSize) startCameraIfPossible();
                if (prefs.mapType != oldMap || (prefs.showMap && !oldShowMap)) {
                    mapRetryAt = 0;
                    requestMap();
                }
                overlay.invalidate();
            }
        });
    }

    // ----- Dữ liệu watermark

    @Override
    public StampData stamp() {
        StampData d = new StampData();
        d.time = tracker.now();
        Location loc = tracker.best();
        if (loc != null) {
            d.hasLocation = true;
            d.lat = loc.getLatitude();
            d.lon = loc.getLongitude();
            d.accuracy = loc.hasAccuracy() ? loc.getAccuracy() : -1;
            if (loc.hasAltitude()) {
                d.hasAltitude = true;
                d.altitude = loc.getAltitude();
            }
        }
        d.addressFull = tracker.addressFull();
        d.addressShort = tracker.addressShort();
        d.heading = tracker.heading();
        if (map != null && map.type == prefs.mapType) d.map = map;
        d.photoId = PhotoId.make(d.time / 1000, d);
        return d;
    }

    @Override
    public Prefs prefs() {
        return prefs;
    }

    @Override
    public void onLocationUpdate() {
        requestMap();
        overlay.invalidate();
        updateGpsChip();
    }

    @Override
    public void onAddressUpdate() {
        overlay.invalidate();
    }

    @Override
    public void onHeadingUpdate() {
        overlay.invalidate();
    }

    private void requestMap() {
        if (!prefs.showMap || mapBusy) return;
        Location loc = tracker.best();
        if (loc == null) return;
        if (map != null && map.type == prefs.mapType && map.complete
                && map.distanceTo(loc.getLatitude(), loc.getLongitude()) < 15) return;
        if (SystemClock.elapsedRealtime() < mapRetryAt) return;
        mapBusy = true;
        maps.request(loc.getLatitude(), loc.getLongitude(), prefs.mapType, new MapTiles.Callback() {
            @Override
            public void onResult(MapTiles.MapImage m) {
                mapBusy = false;
                if (m != null) {
                    map = m;
                    overlay.invalidate();
                }
                mapRetryAt = m != null && m.complete ? 0 : SystemClock.elapsedRealtime() + 20000;
            }
        });
    }

    private void updateGpsChip() {
        String text;
        int color;
        if (!tracker.hasPermission()) {
            text = "Chưa cấp quyền vị trí";
            color = RED;
        } else if (!tracker.anyProviderEnabled()) {
            text = "Vị trí (GPS) đang tắt";
            color = RED;
        } else {
            Location l = tracker.best();
            if (l == null) {
                text = "Đang tìm vị trí…";
                color = ORANGE;
            } else {
                String acc = l.hasAccuracy() ? " ±" + Math.round(l.getAccuracy()) + " m" : "";
                boolean gps = LocationManager.GPS_PROVIDER.equals(l.getProvider());
                if (LocationTracker.ageMs(l) > 60000) {
                    text = "Vị trí cũ" + acc;
                    color = ORANGE;
                } else if (!tracker.hasFinePermission()) {
                    text = "Vị trí gần đúng" + acc;
                    color = ORANGE;
                } else {
                    text = (gps ? "GPS" : "Định vị mạng") + acc;
                    color = GREEN;
                }
            }
        }
        if (!text.contentEquals(gpsChip.getText())) {
            gpsChip.setText(text);
            setChipColor(gpsChip, color);
        }
    }

    private void onGpsChipClick() {
        if (!tracker.hasPermission() || !tracker.hasFinePermission()) {
            if (!granted(Manifest.permission.ACCESS_FINE_LOCATION)
                    && shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)) {
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_PERMS);
            } else {
                openAppSettings();
            }
        } else if (!tracker.gpsEnabled()) {
            try {
                startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
            } catch (ActivityNotFoundException ignored) {
            }
        }
    }
}
