package vn.hawasuco.camera;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Theo dõi vị trí (GPS + mạng), tra địa chỉ, hướng camera (la bàn) và giờ chuẩn theo vệ tinh GPS.
 * Mọi hàm gọi trên luồng chính.
 */
final class LocationTracker implements LocationListener, SensorEventListener {
    interface Listener {
        void onLocationUpdate();

        void onAddressUpdate();

        void onHeadingUpdate();
    }

    private final Context ctx;
    private final Listener listener;
    private final LocationManager lm;
    private final SensorManager sm;
    private final Sensor rotationSensor;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService geoExec = Executors.newSingleThreadExecutor();

    private boolean running;
    private Location best;
    private long timeOffset;
    private float declination;

    private String addrFull, addrShort;
    private Location addrAt;
    private boolean geoBusy;
    private long geoNextTry;

    private final float[] rv4 = new float[4];
    private final float[] rv3 = new float[3];
    private final float[] rm = new float[9];
    private double hx, hy;
    private boolean headingInit;
    private float heading = Float.NaN;
    private long lastHeadingNotify;
    boolean frontCamera;

    LocationTracker(Context ctx, Listener listener) {
        this.ctx = ctx.getApplicationContext();
        this.listener = listener;
        lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        sm = (SensorManager) ctx.getSystemService(Context.SENSOR_SERVICE);
        rotationSensor = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
    }

    void start() {
        if (running) return;
        running = true;
        if (hasPermission()) {
            request(LocationManager.GPS_PROVIDER);
            request(LocationManager.NETWORK_PROVIDER);
        }
        if (rotationSensor != null) sm.registerListener(this, rotationSensor, SensorManager.SENSOR_DELAY_UI);
    }

    void stop() {
        running = false;
        try {
            lm.removeUpdates(this);
        } catch (SecurityException ignored) {
        }
        if (sm != null) sm.unregisterListener(this);
    }

    private void request(String provider) {
        try {
            if (lm == null || !lm.getAllProviders().contains(provider)) return;
            lm.requestLocationUpdates(provider, 1000, 0, this, Looper.getMainLooper());
            Location last = lm.getLastKnownLocation(provider);
            if (last != null && ageMs(last) < 10 * 60 * 1000) consider(last);
        } catch (SecurityException ignored) {
            // chỉ có quyền vị trí gần đúng: không dùng được GPS
        } catch (IllegalArgumentException ignored) {
        }
    }

    boolean hasPermission() {
        return granted(Manifest.permission.ACCESS_FINE_LOCATION) || granted(Manifest.permission.ACCESS_COARSE_LOCATION);
    }

    boolean hasFinePermission() {
        return granted(Manifest.permission.ACCESS_FINE_LOCATION);
    }

    private boolean granted(String perm) {
        return ctx.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    boolean anyProviderEnabled() {
        return enabled(LocationManager.GPS_PROVIDER) || enabled(LocationManager.NETWORK_PROVIDER);
    }

    boolean gpsEnabled() {
        return enabled(LocationManager.GPS_PROVIDER);
    }

    private boolean enabled(String provider) {
        try {
            return lm != null && lm.isProviderEnabled(provider);
        } catch (Exception e) {
            return false;
        }
    }

    Location best() {
        return best;
    }

    /** Giờ hiện tại; nếu giờ máy lệch quá 1 phút so với giờ vệ tinh GPS thì dùng giờ GPS. */
    long now() {
        return System.currentTimeMillis() + timeOffset;
    }

    float heading() {
        return heading;
    }

    /** Địa chỉ, hoặc null nếu chưa có / đã đi xa hơn 200 m so với nơi tra địa chỉ. */
    String addressFull() {
        return addressFresh() ? addrFull : null;
    }

    String addressShort() {
        return addressFresh() ? addrShort : null;
    }

    private boolean addressFresh() {
        return addrFull != null && (best == null || addrAt == null || best.distanceTo(addrAt) <= 200);
    }

    static long ageMs(Location l) {
        return (SystemClock.elapsedRealtimeNanos() - l.getElapsedRealtimeNanos()) / 1000000L;
    }

    // ----- LocationListener

    @Override
    public void onLocationChanged(Location loc) {
        if (loc != null) consider(loc);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
    }

    @Override
    public void onProviderEnabled(String provider) {
        listener.onLocationUpdate();
    }

    @Override
    public void onProviderDisabled(String provider) {
        listener.onLocationUpdate();
    }

    private void consider(Location loc) {
        if (LocationManager.GPS_PROVIDER.equals(loc.getProvider())) updateTimeOffset(loc);
        if (!isBetter(loc, best)) return;
        best = loc;
        declination = new GeomagneticField((float) loc.getLatitude(), (float) loc.getLongitude(),
                (float) loc.getAltitude(), System.currentTimeMillis()).getDeclination();
        listener.onLocationUpdate();
        maybeGeocode();
    }

    private void updateTimeOffset(Location loc) {
        long age = ageMs(loc);
        if (age < 0 || age > 5000) return;
        long off = loc.getTime() + age - System.currentTimeMillis();
        timeOffset = Math.abs(off) > 60000 ? off : 0;
    }

    private static boolean isBetter(Location loc, Location cur) {
        if (cur == null) return true;
        long dt = (loc.getElapsedRealtimeNanos() - cur.getElapsedRealtimeNanos()) / 1000000L;
        if (dt > 10000) return true;
        if (dt < -10000) return false;
        float accDelta = loc.getAccuracy() - cur.getAccuracy();
        boolean newer = dt > 0;
        if (accDelta < 0) return true;
        if (newer && accDelta <= 0) return true;
        boolean sameProvider = loc.getProvider() != null && loc.getProvider().equals(cur.getProvider());
        return newer && accDelta <= 50 && sameProvider;
    }

    private void maybeGeocode() {
        final Location loc = best;
        if (loc == null || geoBusy) return;
        if (SystemClock.elapsedRealtime() < geoNextTry) return;
        if (addrFull != null && addrAt != null && loc.distanceTo(addrAt) < 30) return;
        geoBusy = true;
        geoExec.execute(new Runnable() {
            @Override
            public void run() {
                final String[] res = AddressLookup.lookup(ctx, loc.getLatitude(), loc.getLongitude());
                main.post(new Runnable() {
                    @Override
                    public void run() {
                        geoBusy = false;
                        if (res != null) {
                            addrFull = res[0];
                            addrShort = res[1];
                            addrAt = loc;
                            geoNextTry = SystemClock.elapsedRealtime() + 5000;
                            listener.onAddressUpdate();
                        } else {
                            geoNextTry = SystemClock.elapsedRealtime() + 15000;
                        }
                    }
                });
            }
        });
    }

    // ----- La bàn

    @Override
    public void onSensorChanged(SensorEvent e) {
        float[] v = e.values.length >= 4 ? rv4 : rv3;
        System.arraycopy(e.values, 0, v, 0, v.length);
        try {
            SensorManager.getRotationMatrixFromVector(rm, v);
        } catch (IllegalArgumentException ex) {
            return;
        }
        // Hướng camera sau = trục -Z của máy; camera trước = +Z.
        float ex = -rm[2], ny = -rm[5];
        if (frontCamera) {
            ex = -ex;
            ny = -ny;
        }
        if (ex * ex + ny * ny < 0.12f) {
            // máy đặt nằm ngang: lấy hướng đỉnh máy
            ex = rm[1];
            ny = rm[4];
        }
        double az = Math.atan2(ex, ny) + Math.toRadians(declination);
        double sx = Math.sin(az), cy = Math.cos(az);
        if (!headingInit) {
            hx = sx;
            hy = cy;
            headingInit = true;
        } else {
            hx += (sx - hx) * 0.15;
            hy += (cy - hy) * 0.15;
        }
        float deg = (float) ((Math.toDegrees(Math.atan2(hx, hy)) + 360) % 360);
        long now = SystemClock.elapsedRealtime();
        if (Float.isNaN(heading) || (angleDiff(deg, heading) > 1.5f && now - lastHeadingNotify > 150)) {
            heading = deg;
            lastHeadingNotify = now;
            listener.onHeadingUpdate();
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
    }

    private static float angleDiff(float a, float b) {
        float d = Math.abs(a - b) % 360;
        return d > 180 ? 360 - d : d;
    }
}
