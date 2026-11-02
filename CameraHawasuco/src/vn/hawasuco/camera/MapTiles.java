package vn.hawasuco.camera;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.location.Location;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Ghép ảnh bản đồ nhỏ quanh vị trí hiện tại từ các ô bản đồ (tile) 256px.
 * Ô đã tải được lưu vào bộ nhớ đệm trên máy để dùng lại khi mất mạng.
 */
final class MapTiles {
    static final int ZOOM = 17;
    static final int SIZE = 512;

    private static final String SATELLITE =
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/%d/%d/%d";
    private static final String STREET = "https://tile.openstreetmap.org/%d/%d/%d.png";

    static final class MapImage {
        Bitmap bmp;
        /** Tọa độ pixel toàn cầu (ở mức ZOOM) của góc trên trái ảnh. */
        double originX, originY;
        double lat, lon;
        int type;
        boolean complete;
        String attribution;

        float distanceTo(double lat2, double lon2) {
            float[] r = new float[1];
            Location.distanceBetween(lat, lon, lat2, lon2, r);
            return r[0];
        }
    }

    interface Callback {
        void onResult(MapImage m);
    }

    private final File dir;
    private final LruCache<String, Bitmap> mem = new LruCache<String, Bitmap>(36);
    private final ExecutorService exec = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG);

    MapTiles(Context ctx) {
        dir = new File(ctx.getCacheDir(), "bando");
        dir.mkdirs();
    }

    static double lonToX(double lon) {
        return (lon + 180.0) / 360.0 * 256.0 * (1 << ZOOM);
    }

    static double latToY(double lat) {
        double s = Math.sin(Math.toRadians(lat));
        s = Math.max(-0.9999, Math.min(0.9999, s));
        return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256.0 * (1 << ZOOM);
    }

    void request(final double lat, final double lon, final int type, final Callback cb) {
        exec.execute(new Runnable() {
            @Override
            public void run() {
                MapImage m = null;
                try {
                    m = build(lat, lon, type);
                } catch (Throwable ignored) {
                    // hết bộ nhớ / lỗi giải mã: bỏ qua bản đồ
                }
                final MapImage result = m;
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        cb.onResult(result);
                    }
                });
            }
        });
    }

    private MapImage build(double lat, double lon, int type) {
        double ox = lonToX(lon) - SIZE / 2.0, oy = latToY(lat) - SIZE / 2.0;
        int tx0 = (int) Math.floor(ox / 256), tx1 = (int) Math.floor((ox + SIZE - 1) / 256);
        int ty0 = (int) Math.floor(oy / 256), ty1 = (int) Math.floor((oy + SIZE - 1) / 256);
        int n = 1 << ZOOM;
        Bitmap out = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(out);
        c.drawColor(0xFFD9E2EA);
        int ok = 0, total = 0;
        for (int ty = ty0; ty <= ty1; ty++) {
            if (ty < 0 || ty >= n) continue;
            for (int tx = tx0; tx <= tx1; tx++) {
                total++;
                Bitmap t = tile(type, ((tx % n) + n) % n, ty);
                if (t == null) continue;
                c.drawBitmap(t, (float) (tx * 256 - ox), (float) (ty * 256 - oy), paint);
                ok++;
            }
        }
        if (ok == 0) {
            out.recycle();
            return null;
        }
        MapImage m = new MapImage();
        m.bmp = out;
        m.originX = ox;
        m.originY = oy;
        m.lat = lat;
        m.lon = lon;
        m.type = type;
        m.complete = ok == total;
        m.attribution = type == Prefs.MAP_STREET ? "© OpenStreetMap" : "© Esri";
        return m;
    }

    private Bitmap tile(int type, int x, int y) {
        String key = type + "_" + ZOOM + "_" + x + "_" + y;
        Bitmap b = mem.get(key);
        if (b != null) return b;
        File f = new File(dir, key);
        byte[] data = null;
        if (f.exists()) data = readFile(f);
        if (data == null) {
            String url = type == Prefs.MAP_STREET
                    ? String.format(Locale.US, STREET, ZOOM, x, y)
                    : String.format(Locale.US, SATELLITE, ZOOM, y, x);
            try {
                data = Net.get(url, 8000);
            } catch (IOException e) {
                return null;
            }
            writeFile(f, data);
        }
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inPreferredConfig = Bitmap.Config.RGB_565;
        b = BitmapFactory.decodeByteArray(data, 0, data.length, o);
        if (b == null) {
            f.delete();
            return null;
        }
        mem.put(key, b);
        return b;
    }

    private static byte[] readFile(File f) {
        try {
            FileInputStream in = new FileInputStream(f);
            try {
                byte[] b = new byte[(int) f.length()];
                int off = 0;
                while (off < b.length) {
                    int n = in.read(b, off, b.length - off);
                    if (n < 0) return null;
                    off += n;
                }
                return b;
            } finally {
                in.close();
            }
        } catch (IOException e) {
            return null;
        }
    }

    private static void writeFile(File f, byte[] data) {
        try {
            FileOutputStream out = new FileOutputStream(f);
            try {
                out.write(data);
            } finally {
                out.close();
            }
        } catch (IOException ignored) {
            f.delete();
        }
    }
}
