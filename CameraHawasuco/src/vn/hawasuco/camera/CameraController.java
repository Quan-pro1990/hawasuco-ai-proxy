package vn.hawasuco.camera;

import android.content.Context;
import android.graphics.ImageFormat;
import android.graphics.Rect;
import android.graphics.SurfaceTexture;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraDevice;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.hardware.camera2.params.MeteringRectangle;
import android.hardware.camera2.params.StreamConfigurationMap;
import android.media.Image;
import android.media.ImageReader;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.Size;
import android.view.OrientationEventListener;
import android.view.Surface;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Điều khiển camera bằng Camera2: khung ngắm, lấy nét, đèn flash, zoom, chụp JPEG.
 * Mọi thao tác chạy trên luồng nền riêng; Listener được gọi trên luồng nền đó.
 */
final class CameraController {
    interface Listener {
        void onCameraReady(int previewW, int previewH, boolean hasFlash, float maxZoom);

        void onCameraError(String message);

        void onPhoto(byte[] jpeg);

        void onCaptureFailed();
    }

    private static final int IDLE = 0, PREVIEW = 1, WAIT_LOCK = 2, WAIT_PRECAPTURE = 3,
            WAIT_NON_PRECAPTURE = 4, TAKEN = 5;

    private final CameraManager manager;
    private final Listener listener;
    private final HandlerThread thread;
    private final Handler bg;

    private int generation;
    private CameraDevice device;
    private CameraCaptureSession session;
    private ImageReader reader;
    private Surface previewSurface;
    private CaptureRequest.Builder preview;

    private boolean front;
    private int sensorOrientation;
    private boolean flashAvailable;
    private boolean canAutoFocus;
    private int defaultAfMode, afMode;
    private int maxAfRegions, maxAeRegions;
    private Rect active;
    private Rect crop;
    private volatile float maxZoom = 1f;
    private int flashMode;
    private int state = IDLE;
    private long sequenceStart;
    private int jpegOrientation;
    private Integer lastAeState;
    private volatile boolean ready;
    private volatile boolean busy;

    CameraController(Context ctx, Listener listener) {
        this.manager = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
        this.listener = listener;
        thread = new HandlerThread("camera");
        thread.start();
        bg = new Handler(thread.getLooper());
    }

    void release() {
        close();
        thread.quitSafely();
    }

    boolean isReady() {
        return ready && !busy;
    }

    void open(final SurfaceTexture st, final boolean wantFront, final boolean largePhoto, final int flash) {
        bg.post(new Runnable() {
            @Override
            public void run() {
                doClose();
                openInternal(st, wantFront, largePhoto, flash);
            }
        });
    }

    void close() {
        bg.post(new Runnable() {
            @Override
            public void run() {
                doClose();
            }
        });
    }

    private void doClose() {
        generation++;
        ready = false;
        state = IDLE;
        bg.removeCallbacks(resumeContinuousAf);
        bg.removeCallbacks(captureTimeout);
        if (busy) {
            busy = false;
            listener.onCaptureFailed();
        }
        if (session != null) {
            try {
                session.close();
            } catch (Exception ignored) {
            }
            session = null;
        }
        if (device != null) {
            device.close();
            device = null;
        }
        if (reader != null) {
            reader.close();
            reader = null;
        }
        if (previewSurface != null) {
            previewSurface.release();
            previewSurface = null;
        }
        preview = null;
    }

    private void openInternal(SurfaceTexture st, boolean wantFront, boolean largePhoto, int flash) {
        final int gen = generation;
        try {
            String id = pickCamera(wantFront);
            if (id == null) {
                listener.onCameraError("Không tìm thấy camera");
                return;
            }
            CameraCharacteristics ch = manager.getCameraCharacteristics(id);
            Integer facing = ch.get(CameraCharacteristics.LENS_FACING);
            front = facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT;
            Integer so = ch.get(CameraCharacteristics.SENSOR_ORIENTATION);
            sensorOrientation = so == null ? 90 : so;
            StreamConfigurationMap map = ch.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP);
            if (map == null) {
                listener.onCameraError("Camera không hỗ trợ");
                return;
            }
            Size jpeg = chooseJpeg(map.getOutputSizes(ImageFormat.JPEG), largePhoto);
            Size prev = choosePreview(map.getOutputSizes(SurfaceTexture.class), jpeg);

            active = ch.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE);
            Float mz = ch.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM);
            maxZoom = mz == null ? 1f : Math.max(1f, mz);
            crop = null;
            Boolean fa = ch.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
            flashAvailable = fa != null && fa;
            flashMode = flash;

            int[] afModes = ch.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES);
            Float minFocus = ch.get(CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE);
            boolean focusable = minFocus != null && minFocus > 0;
            canAutoFocus = focusable && contains(afModes, CaptureRequest.CONTROL_AF_MODE_AUTO);
            if (focusable && contains(afModes, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)) {
                defaultAfMode = CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE;
            } else if (canAutoFocus) {
                defaultAfMode = CaptureRequest.CONTROL_AF_MODE_AUTO;
            } else {
                defaultAfMode = CaptureRequest.CONTROL_AF_MODE_OFF;
            }
            afMode = defaultAfMode;
            Integer ra = ch.get(CameraCharacteristics.CONTROL_MAX_REGIONS_AF);
            Integer re = ch.get(CameraCharacteristics.CONTROL_MAX_REGIONS_AE);
            maxAfRegions = ra == null ? 0 : ra;
            maxAeRegions = re == null ? 0 : re;

            reader = ImageReader.newInstance(jpeg.getWidth(), jpeg.getHeight(), ImageFormat.JPEG, 2);
            reader.setOnImageAvailableListener(imageListener, bg);
            st.setDefaultBufferSize(prev.getWidth(), prev.getHeight());
            previewSurface = new Surface(st);

            final int pw = prev.getWidth(), ph = prev.getHeight();
            manager.openCamera(id, new CameraDevice.StateCallback() {
                @Override
                public void onOpened(CameraDevice cd) {
                    if (gen != generation) {
                        cd.close();
                        return;
                    }
                    device = cd;
                    createSession(gen, pw, ph);
                }

                @Override
                public void onDisconnected(CameraDevice cd) {
                    cd.close();
                    if (gen == generation) {
                        device = null;
                        ready = false;
                        listener.onCameraError("Camera đang được ứng dụng khác dùng");
                    }
                }

                @Override
                public void onError(CameraDevice cd, int error) {
                    cd.close();
                    if (gen == generation) {
                        device = null;
                        ready = false;
                        listener.onCameraError("Không mở được camera (mã lỗi " + error + ")");
                    }
                }
            }, bg);
        } catch (CameraAccessException e) {
            listener.onCameraError("Không mở được camera");
        } catch (SecurityException e) {
            listener.onCameraError("Chưa cấp quyền Camera");
        } catch (RuntimeException e) {
            listener.onCameraError("Lỗi camera: " + e.getMessage());
        }
    }

    private void createSession(final int gen, final int pw, final int ph) {
        try {
            preview = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW);
            preview.addTarget(previewSurface);
            device.createCaptureSession(Arrays.asList(previewSurface, reader.getSurface()),
                    new CameraCaptureSession.StateCallback() {
                        @Override
                        public void onConfigured(CameraCaptureSession s) {
                            if (gen != generation || device == null) {
                                s.close();
                                return;
                            }
                            session = s;
                            applyCommon(preview);
                            state = PREVIEW;
                            if (startRepeating()) {
                                ready = true;
                                listener.onCameraReady(pw, ph, flashAvailable, maxZoom);
                            }
                        }

                        @Override
                        public void onConfigureFailed(CameraCaptureSession s) {
                            if (gen == generation) listener.onCameraError("Không khởi động được camera");
                        }
                    }, bg);
        } catch (CameraAccessException e) {
            listener.onCameraError("Không khởi động được camera");
        } catch (RuntimeException e) {
            listener.onCameraError("Lỗi camera: " + e.getMessage());
        }
    }

    /** Chế độ lấy nét, phơi sáng/flash và vùng zoom dùng chung cho khung ngắm và ảnh chụp. */
    private void applyCommon(CaptureRequest.Builder b) {
        b.set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO);
        b.set(CaptureRequest.CONTROL_AF_MODE, afMode);
        if (!flashAvailable || flashMode == Prefs.FLASH_OFF) {
            b.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON);
            b.set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_OFF);
        } else if (flashMode == Prefs.FLASH_AUTO) {
            b.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON_AUTO_FLASH);
        } else {
            b.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON_ALWAYS_FLASH);
        }
        if (crop != null) b.set(CaptureRequest.SCALER_CROP_REGION, crop);
    }

    private boolean startRepeating() {
        if (session == null || preview == null) return false;
        try {
            session.setRepeatingRequest(preview.build(), captureCallback, bg);
            return true;
        } catch (CameraAccessException e) {
            return false;
        } catch (RuntimeException e) {
            return false;
        }
    }

    // ----- Chụp ảnh

    /** Bắt đầu chụp. Trả về false nếu camera chưa sẵn sàng hoặc đang chụp tấm trước. */
    boolean takePicture(final int deviceOrientation) {
        if (!ready || busy) return false;
        busy = true;
        bg.post(new Runnable() {
            @Override
            public void run() {
                if (session == null || state != PREVIEW) {
                    busy = false;
                    listener.onCaptureFailed();
                    return;
                }
                jpegOrientation = computeJpegOrientation(deviceOrientation);
                sequenceStart = SystemClock.elapsedRealtime();
                bg.postDelayed(captureTimeout, 8000);
                try {
                    if (afMode != CaptureRequest.CONTROL_AF_MODE_OFF) {
                        state = WAIT_LOCK;
                        preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_START);
                        session.capture(preview.build(), captureCallback, bg);
                        preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_IDLE);
                    } else if (needsPrecapture(lastAeState)) {
                        runPrecapture();
                    } else {
                        captureStill();
                    }
                } catch (Exception e) {
                    failCapture();
                }
            }
        });
        return true;
    }

    private final Runnable captureTimeout = new Runnable() {
        @Override
        public void run() {
            if (busy) failCapture();
        }
    };

    private void failCapture() {
        bg.removeCallbacks(captureTimeout);
        unlock();
        if (busy) {
            busy = false;
            listener.onCaptureFailed();
        }
    }

    private boolean needsPrecapture(Integer ae) {
        if (!flashAvailable || flashMode == Prefs.FLASH_OFF) return false;
        if (flashMode == Prefs.FLASH_ON) return true;
        return ae == null || ae != CaptureResult.CONTROL_AE_STATE_CONVERGED;
    }

    private void runPrecapture() throws CameraAccessException {
        state = WAIT_PRECAPTURE;
        preview.set(CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER, CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER_START);
        session.capture(preview.build(), captureCallback, bg);
        preview.set(CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER, CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER_IDLE);
    }

    private void captureStill() {
        state = TAKEN;
        try {
            CaptureRequest.Builder b = device.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE);
            b.addTarget(reader.getSurface());
            applyCommon(b);
            if (maxAfRegions > 0 && preview.get(CaptureRequest.CONTROL_AF_REGIONS) != null) {
                b.set(CaptureRequest.CONTROL_AF_REGIONS, preview.get(CaptureRequest.CONTROL_AF_REGIONS));
            }
            if (maxAeRegions > 0 && preview.get(CaptureRequest.CONTROL_AE_REGIONS) != null) {
                b.set(CaptureRequest.CONTROL_AE_REGIONS, preview.get(CaptureRequest.CONTROL_AE_REGIONS));
            }
            b.set(CaptureRequest.JPEG_ORIENTATION, jpegOrientation);
            b.set(CaptureRequest.JPEG_QUALITY, (byte) 95);
            session.capture(b.build(), new CameraCaptureSession.CaptureCallback() {
                @Override
                public void onCaptureCompleted(CameraCaptureSession s, CaptureRequest r, TotalCaptureResult result) {
                    unlock();
                }

                @Override
                public void onCaptureFailed(CameraCaptureSession s, CaptureRequest r,
                                            android.hardware.camera2.CaptureFailure failure) {
                    failCapture();
                }
            }, bg);
        } catch (Exception e) {
            failCapture();
        }
    }

    /** Trả khung ngắm về trạng thái bình thường sau khi chụp. */
    private void unlock() {
        if (session == null || preview == null) return;
        try {
            if (afMode != CaptureRequest.CONTROL_AF_MODE_OFF) {
                preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_CANCEL);
                session.capture(preview.build(), captureCallback, bg);
            }
        } catch (Exception ignored) {
        }
        preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_IDLE);
        preview.set(CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER, CaptureRequest.CONTROL_AE_PRECAPTURE_TRIGGER_IDLE);
        state = PREVIEW;
        startRepeating();
    }

    private final CameraCaptureSession.CaptureCallback captureCallback = new CameraCaptureSession.CaptureCallback() {
        @Override
        public void onCaptureProgressed(CameraCaptureSession s, CaptureRequest r, CaptureResult partial) {
            process(partial);
        }

        @Override
        public void onCaptureCompleted(CameraCaptureSession s, CaptureRequest r, TotalCaptureResult result) {
            process(result);
        }
    };

    private void process(CaptureResult r) {
        Integer ae = r.get(CaptureResult.CONTROL_AE_STATE);
        if (ae != null) lastAeState = ae;
        long elapsed = SystemClock.elapsedRealtime() - sequenceStart;
        try {
            switch (state) {
                case WAIT_LOCK: {
                    Integer af = r.get(CaptureResult.CONTROL_AF_STATE);
                    boolean locked = af == null
                            || af == CaptureResult.CONTROL_AF_STATE_FOCUSED_LOCKED
                            || af == CaptureResult.CONTROL_AF_STATE_NOT_FOCUSED_LOCKED
                            || (af == CaptureResult.CONTROL_AF_STATE_INACTIVE && elapsed > 300);
                    if (locked || elapsed > 1800) {
                        if (needsPrecapture(ae)) runPrecapture();
                        else captureStill();
                    }
                    break;
                }
                case WAIT_PRECAPTURE:
                    if (ae == null || ae == CaptureResult.CONTROL_AE_STATE_PRECAPTURE
                            || ae == CaptureResult.CONTROL_AE_STATE_FLASH_REQUIRED) {
                        state = WAIT_NON_PRECAPTURE;
                    } else if (elapsed > 3000) {
                        captureStill();
                    }
                    break;
                case WAIT_NON_PRECAPTURE:
                    if (ae == null || ae != CaptureResult.CONTROL_AE_STATE_PRECAPTURE || elapsed > 4000) {
                        captureStill();
                    }
                    break;
                default:
                    break;
            }
        } catch (Exception e) {
            failCapture();
        }
    }

    private final ImageReader.OnImageAvailableListener imageListener = new ImageReader.OnImageAvailableListener() {
        @Override
        public void onImageAvailable(ImageReader r) {
            Image img = null;
            try {
                img = r.acquireNextImage();
                if (img == null) return;
                ByteBuffer buf = img.getPlanes()[0].getBuffer();
                byte[] data = new byte[buf.remaining()];
                buf.get(data);
                if (busy) {
                    busy = false;
                    bg.removeCallbacks(captureTimeout);
                    listener.onPhoto(data);
                }
            } catch (Exception ignored) {
            } finally {
                if (img != null) img.close();
            }
        }
    };

    private int computeJpegOrientation(int deviceOrientation) {
        if (deviceOrientation == OrientationEventListener.ORIENTATION_UNKNOWN) deviceOrientation = 0;
        int d = ((deviceOrientation + 45) / 90 * 90) % 360;
        if (front) d = -d;
        return (sensorOrientation + d + 360) % 360;
    }

    // ----- Đèn flash, lấy nét, zoom

    void setFlash(final int mode) {
        bg.post(new Runnable() {
            @Override
            public void run() {
                flashMode = mode;
                if (preview == null || state != PREVIEW) return;
                applyCommon(preview);
                startRepeating();
            }
        });
    }

    /** Lấy nét / đo sáng tại điểm (nx, ny) tính theo tỉ lệ 0..1 của khung ngắm dọc. */
    void focusAt(final float nx, final float ny) {
        bg.post(new Runnable() {
            @Override
            public void run() {
                if (session == null || preview == null || state != PREVIEW || active == null) return;
                if (maxAfRegions == 0 && maxAeRegions == 0) return;
                float x = front ? 1 - nx : nx, y = ny;
                int rot = front ? (360 - sensorOrientation) % 360 : sensorOrientation;
                float u, v;
                switch (rot) {
                    case 90:
                        u = y;
                        v = 1 - x;
                        break;
                    case 180:
                        u = 1 - x;
                        v = 1 - y;
                        break;
                    case 270:
                        u = 1 - y;
                        v = x;
                        break;
                    default:
                        u = x;
                        v = y;
                        break;
                }
                Rect base = crop != null ? crop : new Rect(0, 0, active.width(), active.height());
                int cx = base.left + (int) (u * base.width()), cy = base.top + (int) (v * base.height());
                int half = (int) (0.08f * Math.min(base.width(), base.height()));
                Rect area = new Rect(
                        Math.max(0, cx - half), Math.max(0, cy - half),
                        Math.min(active.width() - 1, cx + half), Math.min(active.height() - 1, cy + half));
                if (area.width() <= 0 || area.height() <= 0) return;
                MeteringRectangle[] regions = {new MeteringRectangle(area, MeteringRectangle.METERING_WEIGHT_MAX - 1)};
                if (maxAfRegions > 0) preview.set(CaptureRequest.CONTROL_AF_REGIONS, regions);
                if (maxAeRegions > 0) preview.set(CaptureRequest.CONTROL_AE_REGIONS, regions);
                try {
                    if (canAutoFocus) {
                        afMode = CaptureRequest.CONTROL_AF_MODE_AUTO;
                        preview.set(CaptureRequest.CONTROL_AF_MODE, afMode);
                        preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_CANCEL);
                        session.capture(preview.build(), captureCallback, bg);
                        preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_IDLE);
                        startRepeating();
                        preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_START);
                        session.capture(preview.build(), captureCallback, bg);
                        preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_IDLE);
                        bg.removeCallbacks(resumeContinuousAf);
                        bg.postDelayed(resumeContinuousAf, 5000);
                    } else {
                        startRepeating();
                    }
                } catch (Exception ignored) {
                }
            }
        });
    }

    /** Sau khi chạm lấy nét 5 giây thì quay lại lấy nét tự động liên tục. */
    private final Runnable resumeContinuousAf = new Runnable() {
        @Override
        public void run() {
            if (session == null || preview == null) return;
            if (state != PREVIEW) {
                bg.postDelayed(this, 1000);
                return;
            }
            if (defaultAfMode != CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE) return;
            try {
                preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_CANCEL);
                session.capture(preview.build(), captureCallback, bg);
            } catch (Exception ignored) {
            }
            preview.set(CaptureRequest.CONTROL_AF_TRIGGER, CaptureRequest.CONTROL_AF_TRIGGER_IDLE);
            afMode = defaultAfMode;
            preview.set(CaptureRequest.CONTROL_AF_MODE, afMode);
            startRepeating();
        }
    };

    /** Đặt mức zoom (1 = không zoom); trả về mức đã giới hạn trong khả năng của camera. */
    float setZoom(float z) {
        final float zoom = Math.max(1f, Math.min(maxZoom, z));
        bg.post(new Runnable() {
            @Override
            public void run() {
                if (preview == null || active == null) return;
                int w = active.width(), h = active.height();
                int cw = (int) (w / zoom), chh = (int) (h / zoom);
                crop = new Rect((w - cw) / 2, (h - chh) / 2, (w + cw) / 2, (h + chh) / 2);
                preview.set(CaptureRequest.SCALER_CROP_REGION, crop);
                if (state == PREVIEW) startRepeating();
            }
        });
        return zoom;
    }

    // ----- Chọn camera và kích thước

    private String pickCamera(boolean wantFront) throws CameraAccessException {
        String[] ids = manager.getCameraIdList();
        int want = wantFront ? CameraCharacteristics.LENS_FACING_FRONT : CameraCharacteristics.LENS_FACING_BACK;
        for (String id : ids) {
            Integer f = manager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING);
            if (f != null && f == want) return id;
        }
        return ids.length > 0 ? ids[0] : null;
    }

    private static boolean is4by3(Size s) {
        int w = Math.max(s.getWidth(), s.getHeight()), h = Math.min(s.getWidth(), s.getHeight());
        return Math.abs(w * 3 - h * 4) <= w * 0.02f;
    }

    private static final Comparator<Size> BY_AREA_DESC = new Comparator<Size>() {
        @Override
        public int compare(Size a, Size b) {
            return Long.signum((long) b.getWidth() * b.getHeight() - (long) a.getWidth() * a.getHeight());
        }
    };

    /** Ảnh lớn: khung 4:3 lớn nhất không quá ~13 MP; ảnh vừa: khung 4:3 nhỏ nhất có cạnh dài ≥ 2048. */
    static Size chooseJpeg(Size[] sizes, boolean large) {
        List<Size> pool = new ArrayList<Size>();
        for (Size s : sizes) if (is4by3(s)) pool.add(s);
        if (pool.isEmpty()) pool.addAll(Arrays.asList(sizes));
        Collections.sort(pool, BY_AREA_DESC);
        if (large) {
            for (Size s : pool) if ((long) s.getWidth() * s.getHeight() <= 13500000L) return s;
            return pool.get(pool.size() - 1);
        }
        Size best = null;
        for (Size s : pool) if (Math.max(s.getWidth(), s.getHeight()) >= 2048) best = s;
        return best != null ? best : pool.get(0);
    }

    static Size choosePreview(Size[] sizes, Size jpeg) {
        float target = (float) jpeg.getWidth() / jpeg.getHeight();
        Size best = null;
        for (Size s : sizes) {
            if (s.getWidth() > 1920 || s.getHeight() > 1440) continue;
            if (Math.abs((float) s.getWidth() / s.getHeight() - target) > 0.02f) continue;
            if (best == null || s.getWidth() * s.getHeight() > best.getWidth() * best.getHeight()) best = s;
        }
        if (best != null) return best;
        for (Size s : sizes) {
            if (s.getWidth() > 1920 || s.getHeight() > 1080) continue;
            if (best == null || s.getWidth() * s.getHeight() > best.getWidth() * best.getHeight()) best = s;
        }
        return best != null ? best : sizes[0];
    }

    private static boolean contains(int[] arr, int v) {
        if (arr == null) return false;
        for (int a : arr) if (a == v) return true;
        return false;
    }
}
