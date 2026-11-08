package vn.karaled;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.AssetManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Chạy máy chủ KaraLED ở nền (dịch vụ tiền cảnh) để điện thoại trong Wi-Fi luôn kết nối được. */
public final class ServerService extends Service {
    static final String TAG = "KaraLED";
    static final String ACTION_STOP = "vn.karaled.STOP";
    private static final String CHANNEL = "karaled";
    private static final int NOTIFY_ID = 1;
    private static final int FIRST_PORT = 3000;

    /** Máy chủ đang chạy (null nếu chưa sẵn sàng). */
    static volatile KaraServer server;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private static final long WAKE_MS = 10 * 60 * 1000L;
    private final Runnable refresh = new Runnable() {
        public void run() {
            if (wakeLock != null) wakeLock.acquire(WAKE_MS); // gia hạn khi máy chủ còn chạy
            updateNotification();
            handler.postDelayed(this, 15000);
        }
    };

    static void start(Context ctx) {
        Intent i = new Intent(ctx, ServerService.class);
        if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
        else ctx.startService(i);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "KaraLED đang chạy", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
        Notification n = buildNotification("Đang khởi động…");
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFY_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(NOTIFY_ID, n);

        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "karaled:server");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(WAKE_MS);
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
        if (wm != null) {
            //noinspection deprecation
            wifiLock = wm.createWifiLock(Build.VERSION.SDK_INT >= 29 ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF, "karaled:wifi");
            wifiLock.setReferenceCounted(false);
            wifiLock.acquire();
        }

        new Thread(new Runnable() {
            public void run() { startServer(); }
        }, "karaled-start").start();
    }

    private void startServer() {
        final AssetManager am = getAssets();
        final Map<String, byte[]> cache = new ConcurrentHashMap<>();
        KaraServer.Assets assets = new KaraServer.Assets() {
            public byte[] read(String path) throws IOException {
                byte[] b = cache.get(path);
                if (b != null) return b;
                try (InputStream in = am.open("web/" + path)) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[16384];
                    int n;
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                    b = out.toByteArray();
                } catch (FileNotFoundException e) {
                    return null;
                }
                cache.put(path, b);
                return b;
            }
        };
        File data = new File(getFilesDir(), "data");
        for (int port = FIRST_PORT; port < FIRST_PORT + 10; port++) {
            KaraServer.Config c = new KaraServer.Config();
            c.port = port;
            c.dataDir = data;
            c.assets = assets;
            KaraServer s = new KaraServer(c);
            try {
                s.start();
                server = s;
                Log.i(TAG, "Máy chủ chạy ở cổng " + port);
                handler.post(refresh);
                return;
            } catch (IOException e) {
                Log.w(TAG, "Cổng " + port + " bận: " + e);
            }
        }
        handler.post(new Runnable() {
            public void run() { updateNotification("Không mở được cổng mạng 3000–3009"); }
        });
    }

    private Notification buildNotification(String text) {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, flags);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, ServerService.class).setAction(ACTION_STOP), flags);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_notify)
                .setContentTitle("KaraLED đang chạy")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(pi)
                .setOngoing(true)
                .setShowWhen(false)
                .addAction(new Notification.Action.Builder(R.drawable.ic_notify, "Tắt hẳn", stop).build());
        if (Build.VERSION.SDK_INT < 26) {
            //noinspection deprecation
            b.setPriority(Notification.PRIORITY_LOW);
        }
        return b.build();
    }

    private void updateNotification() {
        KaraServer s = server;
        if (s == null) return;
        List<String> urls = s.lanUrls();
        updateNotification("Điện thoại cùng Wi-Fi mở: " + urls.get(0).replace("http://", ""));
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        try {
            nm.notify(NOTIFY_ID, buildNotification(text));
        } catch (RuntimeException ignored) {
            // chưa được quyền hiện thông báo
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            MainActivity.finishRunning();
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        final KaraServer s = server;
        server = null;
        if (s != null) {
            new Thread(new Runnable() {
                public void run() { s.stop(); }
            }).start();
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
