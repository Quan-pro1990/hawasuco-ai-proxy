package vn.karaled;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static vn.karaled.Json.list;
import static vn.karaled.Json.map;
import static vn.karaled.Json.num;
import static vn.karaled.Json.str;
import static vn.karaled.Json.truthy;

/**
 * Máy chủ KaraLED viết bằng Java thuần (không dùng API riêng của Android) để chạy trong app Android.
 * Làm đúng như karaoke/server.js: cùng địa chỉ /api/..., cùng dữ liệu, dùng chung giao diện web trong public/.
 */
public final class KaraServer {

    /** Nguồn file giao diện web (assets của app, hoặc thư mục public khi chạy thử trên máy tính). */
    public interface Assets {
        /** Trả nội dung file, hoặc null nếu không có. */
        byte[] read(String path) throws IOException;
    }

    public static final class Config {
        public int port = 3000;
        public String host = "0.0.0.0";
        public File dataDir;
        public Assets assets;
        public String ytApi = "https://www.googleapis.com/youtube/v3";
        public String oembedUrl = "https://www.youtube.com/oembed";
        public String envKeys = "";
        public String envPin = "";
    }

    /* ------------------------------------------------------------------ */

    private static final int MAX_UPLOAD = 300 * 1024 * 1024;
    private static final long CACHE_TTL = 3L * 24 * 3600 * 1000;
    private static final int CACHE_MAX = 800;
    private static final Pattern VIDEO_ID_RE = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Config cfg;
    private final File uploadDir;
    private final Object lock = new Object();
    private final Map<String, Object> settings;
    private final Map<String, Object> state;
    private final LinkedHashMap<String, Map<String, Object>> searchCache = new LinkedHashMap<>();
    private final Map<String, Long> keyBlockedUntil = new ConcurrentHashMap<>();
    private final List<Client> clients = new CopyOnWriteArrayList<>();

    private ServerSocket serverSocket;
    private ExecutorService pool;
    private ScheduledExecutorService timer;
    private ScheduledFuture<?> saveStateFuture;
    private ScheduledFuture<?> saveCacheFuture;
    private volatile boolean broadcastPending;
    private volatile boolean running;

    private static final class Client {
        final Socket socket;
        final OutputStream out;
        final String role;

        Client(Socket socket, OutputStream out, String role) {
            this.socket = socket;
            this.out = out;
            this.role = role;
        }
    }

    static final class HttpError extends RuntimeException {
        final int status;
        final String code;

        HttpError(int status, String message) { this(status, message, ""); }

        HttpError(int status, String message, String code) {
            super(message);
            this.status = status;
            this.code = code == null ? "" : code;
        }
    }

    public KaraServer(Config cfg) {
        this.cfg = cfg;
        this.uploadDir = new File(cfg.dataDir, "uploads");
        //noinspection ResultOfMethodCallIgnored
        uploadDir.mkdirs();

        settings = defaultSettings();
        settings.putAll(map(readJson(new File(cfg.dataDir, "settings.json"))));
        state = mergeState(map(readJson(new File(cfg.dataDir, "state.json"))));
        for (Map.Entry<String, Object> e : map(readJson(new File(cfg.dataDir, "cache.json"))).entrySet()) {
            searchCache.put(e.getKey(), map(e.getValue()));
        }
    }

    /* ------------------------------------------------------------------ */
    /* Cấu hình + trạng thái                                               */
    /* ------------------------------------------------------------------ */

    private static Map<String, Object> defaultSettings() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("appName", "KARALED");
        s.put("slogan", "Karaoke YouTube cho màn hình LED");
        s.put("hotline", "");
        s.put("showQr", true);
        s.put("autoPlay", true);
        s.put("regionCode", "VN");
        s.put("apiKeys", new ArrayList<Object>());
        s.put("pin", "");
        return s;
    }

    private static Map<String, Object> obj(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private static Map<String, Object> defaultState() {
        return obj(
                "queue", new ArrayList<Object>(),
                "current", null,
                "history", new ArrayList<Object>(),
                "playback", obj("status", "stopped", "position", 0.0, "at", 0L, "duration", 0.0),
                "seek", obj("seq", 0L, "to", 0.0),
                "screen", "show",
                "volume", 80L,
                "muted", false,
                "repeatOne", false,
                "loopQueue", false,
                "ticker", obj("text", "", "show", false, "color", "#ffe14d", "speed", "normal", "position", "bottom", "size", "medium"),
                "effect", "none",
                "standby", obj("type", "default", "src", "", "ver", 0L));
    }

    private static Map<String, Object> mergeState(Map<String, Object> saved) {
        Map<String, Object> s = defaultState();
        for (String k : new ArrayList<>(s.keySet())) {
            if (!saved.containsKey(k)) continue;
            Object def = s.get(k);
            Object v = saved.get(k);
            if (def instanceof Map && v instanceof Map) map(def).putAll(map(v));
            else s.put(k, v);
        }
        Map<String, Object> p = map(s.get("playback"));
        if ("playing".equals(p.get("status"))) p.put("status", "paused");
        p.put("at", System.currentTimeMillis());
        p.put("position", num(p.get("position"), 0));
        p.put("duration", num(p.get("duration"), 0));
        Map<String, Object> seek = map(s.get("seek"));
        seek.put("seq", (long) num(seek.get("seq"), 0));
        return s;
    }

    private List<String> envKeys() {
        List<String> out = new ArrayList<>();
        for (String k : String.valueOf(cfg.envKeys == null ? "" : cfg.envKeys).split("[,;\\s]+")) if (!k.isEmpty()) out.add(k);
        return out;
    }

    private List<String> allKeys() {
        LinkedHashSet<String> s = new LinkedHashSet<>(envKeys());
        for (Object k : list(settings.get("apiKeys"))) s.add(str(k));
        s.remove("");
        return new ArrayList<>(s);
    }

    private String controlPin() {
        String p = str(settings.get("pin"));
        return !p.isEmpty() ? p : (cfg.envPin == null ? "" : cfg.envPin);
    }

    private void saveState() {
        if (timer == null) return;
        if (saveStateFuture != null) saveStateFuture.cancel(false);
        saveStateFuture = timer.schedule(new Runnable() {
            public void run() {
                String json;
                synchronized (lock) { json = Json.stringify(state); }
                writeText(new File(cfg.dataDir, "state.json"), json);
            }
        }, 400, TimeUnit.MILLISECONDS);
    }

    private void saveSettings() {
        writeText(new File(cfg.dataDir, "settings.json"), Json.stringify(settings, 2));
    }

    private void saveCache() {
        if (timer == null) return;
        if (saveCacheFuture != null) saveCacheFuture.cancel(false);
        saveCacheFuture = timer.schedule(new Runnable() {
            public void run() { writeCacheNow(); }
        }, 2000, TimeUnit.MILLISECONDS);
    }

    private void writeCacheNow() {
        String json;
        synchronized (searchCache) {
            long now = System.currentTimeMillis();
            for (Iterator<Map.Entry<String, Map<String, Object>>> it = searchCache.entrySet().iterator(); it.hasNext(); ) {
                if (now - (long) num(it.next().getValue().get("t"), 0) > CACHE_TTL) it.remove();
            }
            while (searchCache.size() > CACHE_MAX) {
                Iterator<String> it = searchCache.keySet().iterator();
                it.next();
                it.remove();
            }
            json = Json.stringify(new LinkedHashMap<String, Object>(searchCache));
        }
        writeText(new File(cfg.dataDir, "cache.json"), json);
    }

    /* ------------------------------------------------------------------ */
    /* Khởi động / dừng                                                     */
    /* ------------------------------------------------------------------ */

    public void start() throws IOException {
        serverSocket = new ServerSocket();
        serverSocket.setReuseAddress(true);
        serverSocket.bind(new InetSocketAddress(InetAddress.getByName(cfg.host), cfg.port), 64);
        pool = Executors.newCachedThreadPool();
        timer = Executors.newSingleThreadScheduledExecutor();
        running = true;
        timer.scheduleWithFixedDelay(new Runnable() {
            public void run() {
                for (Client c : clients) write(c, ": ping\n\n");
            }
        }, 20, 20, TimeUnit.SECONDS);
        Thread t = new Thread(new Runnable() {
            public void run() { acceptLoop(); }
        }, "karaled-accept");
        t.setDaemon(true);
        t.start();
    }

    public void stop() {
        running = false;
        try { if (serverSocket != null) serverSocket.close(); } catch (IOException ignored) { }
        for (Client c : clients) closeQuietly(c.socket);
        clients.clear();
        if (timer != null) {
            timer.shutdownNow();
            timer = null;
        }
        if (pool != null) pool.shutdownNow();
        String json;
        synchronized (lock) { json = Json.stringify(state); }
        writeText(new File(cfg.dataDir, "state.json"), json);
        writeCacheNow();
    }

    public int port() { return cfg.port; }

    public String appName() {
        synchronized (lock) { return str(settings.get("appName")); }
    }

    public boolean hasApiKey() { return !allKeys().isEmpty(); }

    public boolean pinRequired() { return !controlPin().isEmpty(); }

    private void acceptLoop() {
        while (running) {
            final Socket s;
            try {
                s = serverSocket.accept();
            } catch (IOException e) {
                if (!running) return;
                continue;
            }
            try {
                pool.execute(new Runnable() {
                    public void run() { handle(s); }
                });
            } catch (RuntimeException e) {
                closeQuietly(s);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Kết nối thời gian thực (SSE)                                        */
    /* ------------------------------------------------------------------ */

    public int displayCount() {
        int n = 0;
        for (Client c : clients) if ("display".equals(c.role)) n++;
        return n;
    }

    private Map<String, Object> publicState() {
        Map<String, Object> out = new LinkedHashMap<>(state);
        Map<String, Object> pb = new LinkedHashMap<>(map(state.get("playback")));
        pb.put("position", currentPosition());
        out.put("playback", pb);
        out.put("serverTime", System.currentTimeMillis());
        int displays = displayCount();
        out.put("displays", displays);
        out.put("controllers", clients.size() - displays);
        out.put("settings", obj(
                "appName", settings.get("appName"),
                "slogan", settings.get("slogan"),
                "hotline", settings.get("hotline"),
                "showQr", settings.get("showQr"),
                "autoPlay", settings.get("autoPlay"),
                "hasApiKey", !allKeys().isEmpty(),
                "pinRequired", !controlPin().isEmpty()));
        out.put("lanUrls", new ArrayList<Object>(lanUrls()));
        return out;
    }

    private String publicStateJson() {
        synchronized (lock) { return Json.stringify(publicState()); }
    }

    private void write(Client c, String text) {
        try {
            synchronized (c) {
                c.out.write(text.getBytes(StandardCharsets.UTF_8));
                c.out.flush();
            }
        } catch (IOException e) {
            clients.remove(c);
            closeQuietly(c.socket);
        }
    }

    private void send(Client c, String event, String json) {
        write(c, "event: " + event + "\ndata: " + json + "\n\n");
    }

    private void broadcastState() {
        saveState();
        if (broadcastPending || timer == null) return;
        broadcastPending = true;
        timer.execute(new Runnable() {
            public void run() {
                broadcastPending = false;
                String data = publicStateJson();
                for (Client c : clients) send(c, "state", data);
            }
        });
    }

    /** Gửi sự kiện cho các thiết bị; việc ghi mạng chạy ở luồng riêng để không giữ khóa trạng thái. */
    private void broadcast(final String event, Object data, final String role) {
        final String json = Json.stringify(data);
        Runnable r = new Runnable() {
            public void run() {
                for (Client c : clients) if (role == null || role.equals(c.role)) send(c, event, json);
            }
        };
        ScheduledExecutorService t = timer;
        if (t != null) t.execute(r);
        else r.run();
    }

    private void notice(String text, String level) {
        broadcast("notice", obj("text", text, "level", level == null ? "info" : level), null);
    }

    /* ------------------------------------------------------------------ */
    /* Điều khiển phát                                                      */
    /* ------------------------------------------------------------------ */

    private Map<String, Object> playback() { return map(state.get("playback")); }

    private Map<String, Object> current() {
        Object c = state.get("current");
        return c instanceof Map ? map(c) : null;
    }

    private List<Object> queue() { return list(state.get("queue")); }

    private List<Object> history() { return list(state.get("history")); }

    private double currentPosition() {
        Map<String, Object> p = playback();
        double pos = num(p.get("position"), 0);
        if (!"playing".equals(p.get("status"))) return pos;
        pos += (System.currentTimeMillis() - (long) num(p.get("at"), 0)) / 1000.0;
        double dur = num(p.get("duration"), 0);
        return dur > 0 ? Math.min(pos, dur) : pos;
    }

    private void setPlayback(String status, Double position) {
        Map<String, Object> p = playback();
        double pos = position == null ? currentPosition() : position;
        p.put("status", status);
        p.put("position", Math.max(0, pos));
        p.put("at", System.currentTimeMillis());
    }

    private void doSeek(double to) {
        Map<String, Object> seek = map(state.get("seek"));
        double t = Math.max(0, to);
        state.put("seek", obj("seq", (long) num(seek.get("seq"), 0) + 1, "to", t));
        playback().put("position", t);
        playback().put("at", System.currentTimeMillis());
    }

    private static String newUid() {
        byte[] b = new byte[6];
        RANDOM.nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x & 0xff));
        return sb.toString();
    }

    private static String cleanText(Object v, int max) {
        String s = v == null ? "" : str(v);
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            sb.append(c < 0x20 ? ' ' : c);
        }
        String t = sb.toString().trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private Map<String, Object> makeItem(Object vo, Object singer) {
        Map<String, Object> v = vo instanceof Map ? map(vo) : null;
        if (v == null || !VIDEO_ID_RE.matcher(str(v.get("videoId"))).matches()) throw new HttpError(400, "Mã video không hợp lệ");
        String id = str(v.get("videoId"));
        String title = cleanText(v.get("title"), 200);
        return obj(
                "uid", newUid(),
                "videoId", id,
                "title", title.isEmpty() ? "Video YouTube" : title,
                "channel", cleanText(v.get("channel"), 100),
                "thumb", "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg",
                "duration", Math.max(0L, Json.parseInt(v.get("duration"), 0)),
                "singer", cleanText(singer != null ? singer : v.get("singer"), 40),
                "addedAt", System.currentTimeMillis());
    }

    private static Map<String, Object> cloneItem(Map<String, Object> item) {
        Map<String, Object> c = new LinkedHashMap<>(item);
        c.put("uid", newUid());
        c.put("addedAt", System.currentTimeMillis());
        return c;
    }

    private void setCurrent(Map<String, Object> item, double startAt) {
        if (item != null) {
            Map<String, Object> cur = new LinkedHashMap<>(item);
            cur.put("playId", newUid());
            cur.put("startedAt", System.currentTimeMillis());
            state.put("current", cur);
            playback().put("duration", num(item.get("duration"), 0));
            if ("standby".equals(state.get("screen"))) state.put("screen", "show");
            setPlayback("playing", startAt);
            doSeek(startAt);
        } else {
            state.put("current", null);
            playback().put("duration", 0.0);
            setPlayback("stopped", 0.0);
        }
    }

    private void toHistory(Map<String, Object> item) {
        if (item == null) return;
        Map<String, Object> h = new LinkedHashMap<>(item);
        h.remove("playId");
        h.remove("startedAt");
        h.put("playedAt", System.currentTimeMillis());
        List<Object> hist = history();
        hist.add(0, h);
        while (hist.size() > 100) hist.remove(hist.size() - 1);
    }

    private void finishCurrent() {
        Map<String, Object> cur = current();
        if (cur == null) return;
        toHistory(cur);
        if (truthy(state.get("loopQueue"))) queue().add(cloneItem(cur));
    }

    private void startNext() {
        List<Object> q = queue();
        Map<String, Object> next = q.isEmpty() ? null : map(q.remove(0));
        setCurrent(next, 0);
    }

    private void onEnded() {
        if (current() == null) return;
        if (truthy(state.get("repeatOne"))) {
            setPlayback("playing", 0.0);
            doSeek(0);
            return;
        }
        finishCurrent();
        startNext();
    }

    private int findQueue(Object uid) {
        List<Object> q = queue();
        for (int i = 0; i < q.size(); i++) if (str(map(q.get(i)).get("uid")).equals(str(uid))) return i;
        throw new HttpError(404, "Bài không còn trong danh sách");
    }

    private Map<String, Object> findHistory(Object uid) {
        for (Object o : history()) if (str(map(o).get("uid")).equals(str(uid))) return map(o);
        throw new HttpError(404, "Bài không còn trong lịch sử");
    }

    private boolean autoPlay() {
        return truthy(settings.get("autoPlay")) && !"blackout".equals(state.get("screen"));
    }

    private static boolean has(Map<String, Object> a, String k) {
        return a.containsKey(k) && a.get(k) != null;
    }

    /** Thực hiện một lệnh; trả kết quả thêm vào câu trả lời (có thể null). */
    private Map<String, Object> runAction(String type, Map<String, Object> a) {
        switch (type) {
            case "add": {
                if (queue().size() >= 500) throw new HttpError(400, "Danh sách đã đủ 500 bài");
                List<Object> src = a.get("videos") instanceof List ? list(a.get("videos")) : Collections.singletonList(a.get("video"));
                List<Object> items = new ArrayList<>();
                for (int i = 0; i < src.size() && i < 200; i++) items.add(makeItem(src.get(i), a.get("singer")));
                if (truthy(a.get("next"))) queue().addAll(0, items);
                else queue().addAll(items);
                if (current() == null && autoPlay()) startNext();
                return obj("added", items.size());
            }
            case "remove":
                queue().remove(findQueue(a.get("uid")));
                return null;
            case "move": {
                int i = findQueue(a.get("uid"));
                List<Object> q = queue();
                Object item = q.remove(i);
                int j = i;
                Object to = a.get("to");
                if ("up".equals(to)) j = Math.max(0, i - 1);
                else if ("down".equals(to)) j = Math.min(q.size(), i + 1);
                else if ("top".equals(to)) j = 0;
                else if ("bottom".equals(to)) j = q.size();
                else if (to instanceof Long) j = (int) Math.max(0, Math.min(q.size(), (Long) to));
                q.add(j, item);
                return null;
            }
            case "clearQueue":
                state.put("queue", new ArrayList<Object>());
                return null;
            case "shuffle": {
                List<Object> q = queue();
                for (int i = q.size() - 1; i > 0; i--) {
                    int j = RANDOM.nextInt(i + 1);
                    Object t = q.get(i);
                    q.set(i, q.get(j));
                    q.set(j, t);
                }
                return null;
            }
            case "playNow": {
                Map<String, Object> item;
                if (truthy(a.get("uid"))) {
                    item = map(queue().remove(findQueue(a.get("uid"))));
                } else if (truthy(a.get("historyUid"))) {
                    item = cloneItem(findHistory(a.get("historyUid")));
                } else {
                    item = makeItem(a.get("video"), a.get("singer"));
                }
                finishCurrent();
                setCurrent(item, 0);
                return null;
            }
            case "requeue":
                queue().add(cloneItem(findHistory(a.get("historyUid"))));
                if (current() == null && autoPlay()) startNext();
                return null;
            case "removeHistory": {
                String uid = str(a.get("historyUid"));
                for (Iterator<Object> it = history().iterator(); it.hasNext(); ) {
                    if (str(map(it.next()).get("uid")).equals(uid)) it.remove();
                }
                return null;
            }
            case "clearHistory":
                state.put("history", new ArrayList<Object>());
                return null;
            case "play":
                if (!"show".equals(state.get("screen"))) state.put("screen", "show");
                if (current() == null) {
                    startNext();
                    return null;
                }
                if ("stopped".equals(playback().get("status"))) {
                    setPlayback("playing", 0.0);
                    doSeek(0);
                } else {
                    setPlayback("playing", null);
                }
                return null;
            case "pause":
                if (current() != null && "playing".equals(playback().get("status"))) setPlayback("paused", null);
                return null;
            case "toggle":
                if (current() != null && "playing".equals(playback().get("status")) && "show".equals(state.get("screen"))) {
                    return runAction("pause", a);
                }
                return runAction("play", a);
            case "restart":
                if (current() == null) return null;
                if (!"show".equals(state.get("screen"))) state.put("screen", "show");
                setPlayback("playing", 0.0);
                doSeek(0);
                return null;
            case "stop":
                if (current() == null) return null;
                setPlayback("stopped", 0.0);
                doSeek(0);
                return null;
            case "seek": {
                if (current() == null) return null;
                double to = num(a.get("to"), Double.NaN);
                if (Double.isNaN(to) || Double.isInfinite(to)) throw new HttpError(400, "Vị trí không hợp lệ");
                String st = str(playback().get("status"));
                setPlayback("stopped".equals(st) ? "paused" : st, to);
                doSeek(to);
                return null;
            }
            case "next":
                finishCurrent();
                startNext();
                return null;
            case "prev": {
                List<Object> h = history();
                if (h.isEmpty()) throw new HttpError(400, "Chưa có bài nào đã phát");
                Map<String, Object> item = map(h.remove(0));
                Map<String, Object> cur = current();
                if (cur != null) {
                    Map<String, Object> back = new LinkedHashMap<>(cur);
                    back.remove("playId");
                    back.remove("startedAt");
                    queue().add(0, back);
                }
                setCurrent(item, 0);
                return null;
            }
            case "volume": {
                long v = Math.round(num(a.get("value"), 0));
                v = Math.max(0, Math.min(100, v));
                state.put("volume", v);
                if (v > 0) state.put("muted", false);
                return null;
            }
            case "mute":
                state.put("muted", has(a, "value") ? truthy(a.get("value")) : !truthy(state.get("muted")));
                return null;
            case "repeatOne":
                state.put("repeatOne", has(a, "value") ? truthy(a.get("value")) : !truthy(state.get("repeatOne")));
                return null;
            case "loopQueue":
                state.put("loopQueue", has(a, "value") ? truthy(a.get("value")) : !truthy(state.get("loopQueue")));
                return null;
            case "screen": {
                String v = str(a.get("value"));
                if (!v.equals("show") && !v.equals("standby") && !v.equals("blackout")) v = "show";
                state.put("screen", v.equals(state.get("screen")) && !v.equals("show") ? "show" : v);
                if (!"show".equals(state.get("screen")) && "playing".equals(playback().get("status"))) setPlayback("paused", null);
                return null;
            }
            case "ticker": {
                Map<String, Object> t = map(state.get("ticker"));
                if (a.containsKey("text")) t.put("text", cleanText(a.get("text"), 300));
                if (a.containsKey("show")) t.put("show", truthy(a.get("show")));
                String color = str(a.get("color"));
                if (color.matches("^#[0-9a-fA-F]{6}$")) t.put("color", color);
                String speed = str(a.get("speed"));
                if (speed.equals("slow") || speed.equals("normal") || speed.equals("fast")) t.put("speed", speed);
                String pos = str(a.get("position"));
                if (pos.equals("top") || pos.equals("bottom")) t.put("position", pos);
                String size = str(a.get("size"));
                if (size.equals("small") || size.equals("medium") || size.equals("large")) t.put("size", size);
                if (truthy(t.get("show")) && str(t.get("text")).isEmpty()) t.put("show", false);
                return null;
            }
            case "effect": {
                String v = str(a.get("value"));
                List<String> allowed = java.util.Arrays.asList("none", "snow", "fireworks", "confetti", "hearts", "stars", "petals", "bubbles", "border");
                state.put("effect", allowed.contains(v) ? v : "none");
                return null;
            }
            case "standbyReset":
                removeUploads(null);
                state.put("standby", obj("type", "default", "src", "", "ver", (long) num(map(state.get("standby")).get("ver"), 0) + 1));
                return null;
            case "announce": {
                String text = cleanText(a.get("text"), 200);
                if (!text.isEmpty()) {
                    long sec = Json.parseInt(a.get("seconds"), 8);
                    if (sec == 0) sec = 8;
                    broadcast("announce", obj("text", text, "seconds", Math.max(3, Math.min(30, sec))), "display");
                }
                return null;
            }
            case "settings": {
                if (a.containsKey("appName")) {
                    String n = cleanText(a.get("appName"), 40);
                    settings.put("appName", n.isEmpty() ? "KARALED" : n);
                }
                if (a.containsKey("slogan")) settings.put("slogan", cleanText(a.get("slogan"), 80));
                if (a.containsKey("hotline")) settings.put("hotline", cleanText(a.get("hotline"), 40));
                if (a.containsKey("showQr")) settings.put("showQr", truthy(a.get("showQr")));
                if (a.containsKey("autoPlay")) settings.put("autoPlay", truthy(a.get("autoPlay")));
                if (truthy(a.get("addApiKey"))) {
                    String k = cleanText(a.get("addApiKey"), 100);
                    if (!k.matches("^[A-Za-z0-9_-]{20,}$")) throw new HttpError(400, "Khóa API không đúng dạng (thường bắt đầu bằng AIza…)");
                    List<Object> keys = new ArrayList<>(list(settings.get("apiKeys")));
                    if (!keys.contains(k)) keys.add(k);
                    settings.put("apiKeys", keys);
                }
                if (truthy(a.get("clearApiKeys"))) settings.put("apiKeys", new ArrayList<Object>());
                if (a.containsKey("newPin")) {
                    String p = cleanText(a.get("newPin"), 20);
                    if (!p.isEmpty() && !p.matches("^\\d{4,8}$")) throw new HttpError(400, "Mã quản lý gồm 4–8 chữ số");
                    settings.put("pin", p);
                }
                saveSettings();
                return null;
            }
            default:
                throw new HttpError(400, "Lệnh không hợp lệ");
        }
    }

    /* ------------------------------------------------------------------ */
    /* YouTube                                                              */
    /* ------------------------------------------------------------------ */

    private static final class HttpResult {
        int status;
        String body;
    }

    private static HttpResult httpGet(String url, int timeoutMs) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(timeoutMs);
        c.setReadTimeout(timeoutMs);
        c.setRequestProperty("Accept", "application/json");
        try {
            HttpResult r = new HttpResult();
            r.status = c.getResponseCode();
            InputStream in = r.status >= 400 ? c.getErrorStream() : c.getInputStream();
            r.body = in == null ? "" : new String(readAll(in, 8 * 1024 * 1024), StandardCharsets.UTF_8);
            return r;
        } finally {
            c.disconnect();
        }
    }

    private static String qs(Map<String, String> params) {
        StringBuilder sb = new StringBuilder();
        try {
            for (Map.Entry<String, String> e : params.entrySet()) {
                if (sb.length() > 0) sb.append('&');
                sb.append(URLEncoder.encode(e.getKey(), "UTF-8")).append('=').append(URLEncoder.encode(e.getValue(), "UTF-8"));
            }
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
        return sb.toString();
    }

    private Map<String, Object> ytApi(String endpoint, Map<String, String> params) {
        List<String> keys = allKeys();
        if (keys.isEmpty()) {
            throw new HttpError(400, "Chưa có khóa YouTube API nên chưa tìm được. Vẫn dán được link YouTube để thêm bài. "
                    + "Xem HUONG_DAN.md mục \"Lấy khóa YouTube API\" (miễn phí).", "nokey");
        }
        HttpError lastErr = null;
        for (String key : keys) {
            Long until = keyBlockedUntil.get(key);
            if (until != null && until > System.currentTimeMillis()) continue;
            Map<String, String> p = new LinkedHashMap<>(params);
            p.put("key", key);
            HttpResult res;
            try {
                res = httpGet(cfg.ytApi + "/" + endpoint + "?" + qs(p), 10000);
            } catch (IOException e) {
                throw new HttpError(502, "Không kết nối được YouTube. Kiểm tra Internet của máy chủ.");
            }
            Map<String, Object> body;
            try { body = map(Json.parse(res.body)); } catch (RuntimeException e) { body = new LinkedHashMap<>(); }
            if (res.status >= 200 && res.status < 300) return body;
            List<Object> errs = list(map(body.get("error")).get("errors"));
            String reason = errs.isEmpty() ? "" : str(map(errs.get(0)).get("reason"));
            if (reason.matches("(?i).*(quota|dailyLimit|rateLimit).*")) {
                keyBlockedUntil.put(key, System.currentTimeMillis() + 30 * 60 * 1000);
                lastErr = new HttpError(429, "Đã hết lượt tìm kiếm miễn phí hôm nay của khóa YouTube API (10.000 đơn vị/ngày). "
                        + "Thêm khóa khác trong Cài đặt, hoặc dán link YouTube để thêm bài. Lượt tìm được cấp lại sau 14–15 giờ chiều (giờ VN).", "quota");
                continue;
            }
            if ((reason + res.body).matches("(?is).*(keyInvalid|badRequest|API_KEY_INVALID).*")) {
                keyBlockedUntil.put(key, System.currentTimeMillis() + 10 * 60 * 1000);
                lastErr = new HttpError(400, "Khóa YouTube API không đúng. Kiểm tra lại khóa trong Cài đặt hoặc file .env.", "keyinvalid");
                continue;
            }
            if (res.status == 403) {
                keyBlockedUntil.put(key, System.currentTimeMillis() + 10 * 60 * 1000);
                lastErr = new HttpError(403, "Khóa YouTube API bị từ chối (chưa bật \"YouTube Data API v3\" cho dự án, hoặc khóa bị giới hạn sai). "
                        + "Xem HUONG_DAN.md.", "forbidden");
                continue;
            }
            throw new HttpError(502, "YouTube báo lỗi " + res.status + (reason.isEmpty() ? "" : " (" + reason + ")"));
        }
        throw lastErr != null ? lastErr : new HttpError(429, "Các khóa YouTube API đang tạm khóa, thử lại sau ít phút.", "quota");
    }

    private static final Pattern DURATION_RE = Pattern.compile("^P(?:(\\d+)D)?T?(?:(\\d+)H)?(?:(\\d+)M)?(?:(\\d+)S)?$");

    static long parseDuration(String iso) {
        Matcher m = DURATION_RE.matcher(iso == null ? "" : iso);
        if (!m.matches()) return 0;
        return g(m, 1) * 86400 + g(m, 2) * 3600 + g(m, 3) * 60 + g(m, 4);
    }

    private static long g(Matcher m, int i) {
        String s = m.group(i);
        return s == null ? 0 : Long.parseLong(s);
    }

    static String decodeEntities(String s) {
        if (s == null) return "";
        StringBuffer sb = new StringBuffer();
        Matcher m = Pattern.compile("&#(\\d+);").matcher(s);
        while (m.find()) m.appendReplacement(sb, Matcher.quoteReplacement(new String(Character.toChars(Integer.parseInt(m.group(1))))));
        m.appendTail(sb);
        return sb.toString().replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'")
                .replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&");
    }

    private List<Map<String, Object>> videoDetails(List<String> ids) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < ids.size(); i += 50) {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("part", "snippet,contentDetails,statistics,status");
            p.put("id", join(ids.subList(i, Math.min(ids.size(), i + 50)), ","));
            p.put("maxResults", "50");
            Map<String, Object> data = ytApi("videos", p);
            for (Object o : list(data.get("items"))) {
                Map<String, Object> v = map(o);
                Map<String, Object> sn = map(v.get("snippet"));
                Map<String, Object> st = v.get("status") instanceof Map ? map(v.get("status")) : null;
                String live = str(sn.get("liveBroadcastContent"));
                out.add(obj(
                        "videoId", str(v.get("id")),
                        "title", decodeEntities(str(sn.get("title"))),
                        "channel", decodeEntities(str(sn.get("channelTitle"))),
                        "duration", parseDuration(str(map(v.get("contentDetails")).get("duration"))),
                        "views", (long) num(map(v.get("statistics")).get("viewCount"), 0),
                        "live", !(live.isEmpty() || live.equals("none")),
                        "embeddable", st == null || !Boolean.FALSE.equals(st.get("embeddable"))));
            }
        }
        return out;
    }

    private Map<String, Object> searchYouTube(String q, String pageToken) {
        String cacheKey = q.toLowerCase(Locale.ROOT) + "|" + (pageToken == null ? "" : pageToken);
        synchronized (searchCache) {
            Map<String, Object> hit = searchCache.get(cacheKey);
            if (hit != null && System.currentTimeMillis() - (long) num(hit.get("t"), 0) < CACHE_TTL) {
                Map<String, Object> r = new LinkedHashMap<>(map(hit.get("data")));
                r.put("cached", true);
                return r;
            }
        }
        Map<String, String> p = new LinkedHashMap<>();
        p.put("part", "snippet");
        p.put("type", "video");
        p.put("q", q);
        p.put("maxResults", "20");
        p.put("videoEmbeddable", "true");
        p.put("videoSyndicated", "true");
        String region;
        synchronized (lock) { region = str(settings.get("regionCode")); }
        p.put("regionCode", region.isEmpty() ? "VN" : region);
        p.put("relevanceLanguage", "vi");
        p.put("safeSearch", "moderate");
        if (pageToken != null && !pageToken.isEmpty()) p.put("pageToken", pageToken);
        Map<String, Object> data = ytApi("search", p);
        List<String> ids = new ArrayList<>();
        for (Object o : list(data.get("items"))) {
            String id = str(map(map(o).get("id")).get("videoId"));
            if (!id.isEmpty()) ids.add(id);
        }
        Map<String, Map<String, Object>> byId = new HashMap<>();
        for (Map<String, Object> d : videoDetails(ids)) byId.put(str(d.get("videoId")), d);
        List<Object> items = new ArrayList<>();
        for (String id : ids) {
            Map<String, Object> d = byId.get(id);
            if (d != null && truthy(d.get("embeddable")) && !truthy(d.get("live"))) items.add(d);
        }
        Map<String, Object> result = obj("items", items,
                "nextPageToken", str(data.get("nextPageToken")),
                "total", (long) num(map(data.get("pageInfo")).get("totalResults"), 0));
        synchronized (searchCache) {
            searchCache.remove(cacheKey);
            searchCache.put(cacheKey, obj("t", System.currentTimeMillis(), "data", result));
        }
        saveCache();
        return result;
    }

    private static final Pattern PATH_ID_RE = Pattern.compile("^/(?:embed|shorts|live|v)/([A-Za-z0-9_-]{11})");

    /** Trả [videoId, listId] (có thể null), hoặc null nếu không phải link YouTube. */
    static String[] parseYouTubeUrl(String input) {
        String s = input == null ? "" : input.trim();
        if (VIDEO_ID_RE.matcher(s).matches()) return new String[]{s, null};
        URI u;
        try {
            u = new URI(s.matches("(?i)^https?://.*") ? s : "https://" + s);
        } catch (Exception e) {
            return null;
        }
        String host = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT).replaceFirst("^(www|m|music)\\.", "");
        Map<String, String> q = parseQuery(u.getRawQuery());
        String path = u.getPath() == null ? "" : u.getPath();
        String videoId = null;
        if (host.equals("youtu.be")) {
            videoId = path.length() > 1 ? path.substring(1, Math.min(path.length(), 12)) : "";
        } else if (host.equals("youtube.com") || host.equals("youtube-nocookie.com")) {
            if (q.containsKey("v") && !q.get("v").isEmpty()) videoId = q.get("v");
            else {
                Matcher m = PATH_ID_RE.matcher(path);
                if (m.find()) videoId = m.group(1);
            }
        } else {
            return null;
        }
        String listId = q.containsKey("list") ? q.get("list") : "";
        return new String[]{
                videoId != null && VIDEO_ID_RE.matcher(videoId).matches() ? videoId : null,
                listId.matches("^[A-Za-z0-9_-]{10,64}$") && !listId.startsWith("RD") ? listId : null};
    }

    private Map<String, Object> oembedInfo(String videoId) {
        try {
            Map<String, String> p = new LinkedHashMap<>();
            p.put("url", "https://www.youtube.com/watch?v=" + videoId);
            p.put("format", "json");
            HttpResult r = httpGet(cfg.oembedUrl + "?" + qs(p), 8000);
            if (r.status == 401 || r.status == 403) throw new HttpError(400, "Video này không cho phát nhúng ngoài YouTube (chủ kênh đã tắt).");
            if (r.status == 404 || r.status == 400) throw new HttpError(404, "Không tìm thấy video (đã xóa hoặc ở chế độ riêng tư).");
            if (r.status >= 300) throw new IOException("oembed " + r.status);
            Map<String, Object> d = map(Json.parse(r.body));
            return obj("videoId", videoId, "title", str(d.get("title")), "channel", str(d.get("author_name")), "duration", 0L);
        } catch (HttpError e) {
            throw e;
        } catch (Exception e) {
            return obj("videoId", videoId, "title", "Video YouTube " + videoId, "channel", "", "duration", 0L);
        }
    }

    private Map<String, Object> linkInfo(String input) {
        String[] p = parseYouTubeUrl(input);
        if (p == null || (p[0] == null && p[1] == null)) throw new HttpError(400, "Link không phải video YouTube");
        boolean hasKey = !allKeys().isEmpty();

        if (p[1] != null && hasKey) {
            List<String> ids = new ArrayList<>();
            String pageToken = "";
            do {
                Map<String, String> params = new LinkedHashMap<>();
                params.put("part", "contentDetails");
                params.put("playlistId", p[1]);
                params.put("maxResults", "50");
                if (!pageToken.isEmpty()) params.put("pageToken", pageToken);
                Map<String, Object> d = ytApi("playlistItems", params);
                for (Object it : list(d.get("items"))) {
                    Map<String, Object> cd = map(map(it).get("contentDetails"));
                    if (!cd.isEmpty()) ids.add(str(cd.get("videoId")));
                }
                pageToken = str(d.get("nextPageToken"));
            } while (!pageToken.isEmpty() && ids.size() < 200);
            List<Object> details = new ArrayList<>();
            for (Map<String, Object> d : videoDetails(ids)) if (truthy(d.get("embeddable")) && !truthy(d.get("live"))) details.add(d);
            if (!details.isEmpty()) {
                String title = "";
                try {
                    Map<String, String> params = new LinkedHashMap<>();
                    params.put("part", "snippet");
                    params.put("id", p[1]);
                    List<Object> pl = list(ytApi("playlists", params).get("items"));
                    if (!pl.isEmpty()) title = decodeEntities(str(map(map(pl.get(0)).get("snippet")).get("title")));
                } catch (RuntimeException ignored) { /* không quan trọng */ }
                return obj("playlist", obj("title", title, "items", details));
            }
        }
        if (p[0] == null) {
            throw new HttpError(400, hasKey ? "Danh sách phát trống hoặc ở chế độ riêng tư."
                    : "Thêm cả danh sách phát cần có khóa YouTube API. Hãy dán link từng bài.");
        }
        if (hasKey) {
            try {
                List<Map<String, Object>> d = videoDetails(Collections.singletonList(p[0]));
                if (d.isEmpty()) throw new HttpError(404, "Không tìm thấy video (đã xóa hoặc ở chế độ riêng tư).");
                if (!truthy(d.get(0).get("embeddable"))) throw new HttpError(400, "Video này không cho phát nhúng ngoài YouTube (chủ kênh đã tắt).");
                return obj("video", d.get(0));
            } catch (HttpError e) {
                if (e.status == 404 || (e.status == 400 && e.code.isEmpty())) throw e;
                // hết lượt API: lấy thông tin bằng oEmbed (không tốn lượt)
            }
        }
        return obj("video", oembedInfo(p[0]));
    }

    /* ------------------------------------------------------------------ */
    /* HTTP                                                                 */
    /* ------------------------------------------------------------------ */

    private static final Map<String, String> MIME = new HashMap<>();
    private static final Map<String, String> UPLOAD_EXT = new HashMap<>();

    static {
        MIME.put(".html", "text/html; charset=utf-8");
        MIME.put(".js", "text/javascript; charset=utf-8");
        MIME.put(".css", "text/css; charset=utf-8");
        MIME.put(".json", "application/json; charset=utf-8");
        MIME.put(".webmanifest", "application/manifest+json; charset=utf-8");
        MIME.put(".svg", "image/svg+xml");
        MIME.put(".png", "image/png");
        MIME.put(".jpg", "image/jpeg");
        MIME.put(".jpeg", "image/jpeg");
        MIME.put(".gif", "image/gif");
        MIME.put(".webp", "image/webp");
        MIME.put(".ico", "image/x-icon");
        MIME.put(".mp4", "video/mp4");
        MIME.put(".webm", "video/webm");
        MIME.put(".mov", "video/quicktime");
        MIME.put(".m4v", "video/mp4");
        MIME.put(".txt", "text/plain; charset=utf-8");
        UPLOAD_EXT.put("image/jpeg", ".jpg");
        UPLOAD_EXT.put("image/png", ".png");
        UPLOAD_EXT.put("image/gif", ".gif");
        UPLOAD_EXT.put("image/webp", ".webp");
        UPLOAD_EXT.put("video/mp4", ".mp4");
        UPLOAD_EXT.put("video/webm", ".webm");
        UPLOAD_EXT.put("video/quicktime", ".mov");
        UPLOAD_EXT.put("video/x-m4v", ".m4v");
    }

    private static final class Request {
        String method;
        String path;
        Map<String, String> query = new HashMap<>();
        Map<String, String> headers = new HashMap<>();
        long contentLength;
        InputStream in;
        OutputStream out;
        Socket socket;
        boolean keepOpen;

        String header(String name) {
            String v = headers.get(name);
            return v == null ? "" : v;
        }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 16384) throw new IOException("Dòng quá dài");
        }
        if (c == -1 && b.size() == 0) return null;
        return new String(b.toByteArray(), StandardCharsets.ISO_8859_1);
    }

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> q = new HashMap<>();
        if (raw == null || raw.isEmpty()) return q;
        for (String part : raw.split("&")) {
            if (part.isEmpty()) continue;
            int i = part.indexOf('=');
            String k = i < 0 ? part : part.substring(0, i);
            String v = i < 0 ? "" : part.substring(i + 1);
            try {
                k = URLDecoder.decode(k, "UTF-8");
                v = URLDecoder.decode(v, "UTF-8");
            } catch (Exception e) {
                continue;
            }
            if (!q.containsKey(k)) q.put(k, v);
        }
        return q;
    }

    private void handle(Socket s) {
        Request req = new Request();
        req.socket = s;
        try {
            s.setSoTimeout(30000);
            req.in = new BufferedInputStream(s.getInputStream());
            req.out = new BufferedOutputStream(s.getOutputStream());
            String line = readLine(req.in);
            if (line == null) return;
            String[] parts = line.split(" ");
            if (parts.length < 2) return;
            req.method = parts[0].toUpperCase(Locale.ROOT);
            String target = parts[1];
            int qi = target.indexOf('?');
            req.path = qi < 0 ? target : target.substring(0, qi);
            req.query = parseQuery(qi < 0 ? "" : target.substring(qi + 1));
            String h;
            while ((h = readLine(req.in)) != null && !h.isEmpty()) {
                int c = h.indexOf(':');
                if (c > 0) req.headers.put(h.substring(0, c).trim().toLowerCase(Locale.ROOT), h.substring(c + 1).trim());
            }
            req.contentLength = Json.parseInt(req.header("content-length"), 0);
            try {
                route(req);
            } catch (HttpError e) {
                sendJson(req, e.status, obj("ok", false, "error", e.getMessage(), "code", e.code));
            } catch (IOException e) {
                throw e;
            } catch (Exception e) {
                e.printStackTrace();
                sendJson(req, 500, obj("ok", false, "error", "Lỗi máy chủ: " + e, "code", ""));
            }
            req.out.flush();
        } catch (IOException ignored) {
            // trình duyệt đóng kết nối giữa chừng
        } finally {
            if (!req.keepOpen) closeQuietly(s);
        }
    }

    private static String reason(int status) {
        switch (status) {
            case 200: return "OK";
            case 206: return "Partial Content";
            case 304: return "Not Modified";
            case 400: return "Bad Request";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 405: return "Method Not Allowed";
            case 413: return "Payload Too Large";
            case 416: return "Range Not Satisfiable";
            case 429: return "Too Many Requests";
            case 502: return "Bad Gateway";
            default: return status >= 500 ? "Server Error" : "OK";
        }
    }

    private static void writeHead(Request req, int status, Map<String, String> headers) throws IOException {
        StringBuilder sb = new StringBuilder();
        sb.append("HTTP/1.1 ").append(status).append(' ').append(reason(status)).append("\r\n");
        for (Map.Entry<String, String> e : headers.entrySet()) sb.append(e.getKey()).append(": ").append(e.getValue()).append("\r\n");
        if (!headers.containsKey("Connection")) sb.append("Connection: close\r\n");
        sb.append("\r\n");
        req.out.write(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static void sendJson(Request req, int status, Object obj) throws IOException {
        byte[] body = Json.stringify(obj).getBytes(StandardCharsets.UTF_8);
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Content-Type", "application/json; charset=utf-8");
        h.put("Cache-Control", "no-store");
        h.put("Content-Length", String.valueOf(body.length));
        writeHead(req, status, h);
        req.out.write(body);
    }

    private static byte[] readAll(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) != -1) {
            b.write(buf, 0, n);
            if (b.size() > limit) throw new HttpError(413, "Dữ liệu quá lớn");
        }
        return b.toByteArray();
    }

    private static byte[] readBody(Request req, int limit) throws IOException {
        if (req.contentLength > limit) throw new HttpError(413, "Dữ liệu quá lớn");
        byte[] buf = new byte[(int) req.contentLength];
        int off = 0;
        while (off < buf.length) {
            int n = req.in.read(buf, off, buf.length - off);
            if (n < 0) break;
            off += n;
        }
        return buf;
    }

    private static Map<String, Object> readJsonBody(Request req) throws IOException {
        byte[] b = readBody(req, 1024 * 1024);
        if (b.length == 0) return new LinkedHashMap<>();
        try {
            Object o = Json.parse(new String(b, StandardCharsets.UTF_8));
            return map(o);
        } catch (RuntimeException e) {
            throw new HttpError(400, "JSON không hợp lệ");
        }
    }

    private boolean pinOk(String given) {
        String pin = controlPin();
        if (pin.isEmpty()) return true;
        try {
            MessageDigest a = MessageDigest.getInstance("SHA-256");
            MessageDigest b = MessageDigest.getInstance("SHA-256");
            return MessageDigest.isEqual(a.digest((given == null ? "" : given).getBytes(StandardCharsets.UTF_8)),
                    b.digest(pin.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return false;
        }
    }

    private void requirePin(Request req) {
        if (!pinOk(req.header("x-pin"))) throw new HttpError(403, "Cần mã quản lý để dùng chức năng này", "pin");
    }

    private volatile List<String> lanCache;
    private volatile long lanCacheAt;

    /** Địa chỉ trong mạng nội bộ để điện thoại vào (đọc lại tối đa 5 giây một lần). */
    public List<String> lanUrls() {
        List<String> c = lanCache;
        if (c != null && System.currentTimeMillis() - lanCacheAt < 5000) return c;
        c = readLanUrls();
        lanCache = c;
        lanCacheAt = System.currentTimeMillis();
        return c;
    }

    private List<String> readLanUrls() {
        List<String> out = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> ifs = NetworkInterface.getNetworkInterfaces();
            while (ifs != null && ifs.hasMoreElements()) {
                NetworkInterface ni = ifs.nextElement();
                try {
                    if (!ni.isUp() || ni.isLoopback()) continue;
                } catch (Exception e) {
                    continue;
                }
                String name = ni.getName() == null ? "" : ni.getName();
                if (name.matches("(?i)^(rmnet|ccmni|dummy|tun|p2p|v4-|clat|ifb|sit|ip6|docker|br-|veth|zt|vEthernet|VirtualBox|VMware).*")) continue;
                for (Enumeration<InetAddress> as = ni.getInetAddresses(); as.hasMoreElements(); ) {
                    InetAddress a = as.nextElement();
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress() || a.isLinkLocalAddress()) continue;
                    out.add("http://" + a.getHostAddress() + ":" + cfg.port);
                }
            }
        } catch (Exception ignored) { }
        Collections.sort(out, (x, y) -> Boolean.compare(y.startsWith("http://192.168."), x.startsWith("http://192.168.")));
        if (out.isEmpty()) out.add("http://localhost:" + cfg.port);
        return out;
    }

    private void removeUploads(String keep) {
        File[] files = uploadDir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.getName().startsWith("standby-") && !f.getName().equals(keep)) //noinspection ResultOfMethodCallIgnored
                f.delete();
        }
    }

    private void handleUpload(Request req) throws IOException {
        requirePin(req);
        String type = req.header("content-type").split(";")[0].trim().toLowerCase(Locale.ROOT);
        String ext = UPLOAD_EXT.get(type);
        if (ext == null) throw new HttpError(400, "Chỉ nhận ảnh (JPG, PNG, GIF, WEBP) hoặc video (MP4, WEBM, MOV)");
        if (req.contentLength > MAX_UPLOAD) throw new HttpError(413, "File quá lớn (tối đa 300 MB)");
        String name = "standby-" + System.currentTimeMillis() + ext;
        File tmp = new File(uploadDir, name + ".part");
        req.socket.setSoTimeout(120000);
        try (OutputStream fo = new FileOutputStream(tmp)) {
            byte[] buf = new byte[65536];
            long left = req.contentLength;
            while (left > 0) {
                int n = req.in.read(buf, 0, (int) Math.min(buf.length, left));
                if (n < 0) throw new IOException("Mất kết nối khi tải lên");
                fo.write(buf, 0, n);
                left -= n;
            }
        } catch (IOException e) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            throw e;
        }
        removeUploads(name + ".part");
        File dest = new File(uploadDir, name);
        if (!tmp.renameTo(dest)) throw new HttpError(500, "Không lưu được file");
        Map<String, Object> standby;
        synchronized (lock) {
            standby = obj("type", type.startsWith("video/") ? "video" : "image", "src", "/uploads/" + name,
                    "ver", (long) num(map(state.get("standby")).get("ver"), 0) + 1);
            state.put("standby", standby);
        }
        broadcastState();
        sendJson(req, 200, obj("ok", true, "standby", standby));
    }

    private static String mimeOf(String name) {
        int i = name.lastIndexOf('.');
        String t = i < 0 ? null : MIME.get(name.substring(i).toLowerCase(Locale.ROOT));
        return t == null ? "application/octet-stream" : t;
    }

    private static final Pattern RANGE_RE = Pattern.compile("^bytes=(\\d*)-(\\d*)$");

    private void serveUpload(Request req, File file) throws IOException {
        if (!file.isFile()) throw new HttpError(404, "Không có");
        long size = file.length();
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Content-Type", mimeOf(file.getName()));
        h.put("Cache-Control", "public, max-age=86400");
        h.put("Accept-Ranges", "bytes");
        h.put("X-Content-Type-Options", "nosniff");
        Matcher m = RANGE_RE.matcher(req.header("range"));
        long start = 0, end = size - 1;
        int status = 200;
        if (m.matches() && !(m.group(1).isEmpty() && m.group(2).isEmpty())) {
            start = !m.group(1).isEmpty() ? Long.parseLong(m.group(1)) : size - Long.parseLong(m.group(2));
            end = !m.group(1).isEmpty() && !m.group(2).isEmpty() ? Long.parseLong(m.group(2)) : size - 1;
            start = Math.max(0, start);
            end = Math.min(end, size - 1);
            if (start > end) {
                Map<String, String> h2 = new LinkedHashMap<>();
                h2.put("Content-Range", "bytes */" + size);
                h2.put("Content-Length", "0");
                writeHead(req, 416, h2);
                return;
            }
            h.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
            status = 206;
        }
        long len = end - start + 1;
        h.put("Content-Length", String.valueOf(Math.max(0, len)));
        writeHead(req, status, h);
        if ("HEAD".equals(req.method) || len <= 0) return;
        req.socket.setSoTimeout(0);
        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            raf.seek(start);
            byte[] buf = new byte[65536];
            long left = len;
            while (left > 0) {
                int n = raf.read(buf, 0, (int) Math.min(buf.length, left));
                if (n < 0) break;
                req.out.write(buf, 0, n);
                left -= n;
            }
        }
    }

    private void serveAsset(Request req, String rel) throws IOException {
        byte[] data = rel == null ? null : cfg.assets.read(rel);
        if (data == null) {
            byte[] body = "Không tìm thấy".getBytes(StandardCharsets.UTF_8);
            Map<String, String> h = new LinkedHashMap<>();
            h.put("Content-Type", "text/plain; charset=utf-8");
            h.put("Content-Length", String.valueOf(body.length));
            writeHead(req, 404, h);
            req.out.write(body);
            return;
        }
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Content-Type", mimeOf(rel));
        h.put("Cache-Control", "no-cache");
        h.put("Content-Length", String.valueOf(data.length));
        h.put("X-Content-Type-Options", "nosniff");
        writeHead(req, 200, h);
        if (!"HEAD".equals(req.method)) req.out.write(data);
    }

    /** Giải mã %XX theo UTF-8; null nếu đường dẫn không an toàn. */
    static String safeRel(String rawPath) {
        String p;
        try {
            p = URLDecoder.decode(rawPath.replace("+", "%2B"), "UTF-8");
        } catch (Exception e) {
            return null;
        }
        if (p.indexOf('\0') >= 0 || p.indexOf('\\') >= 0) return null;
        List<String> out = new ArrayList<>();
        for (String seg : p.split("/")) {
            if (seg.isEmpty() || seg.equals(".")) continue;
            if (seg.equals("..")) return null;
            out.add(seg);
        }
        return out.isEmpty() ? null : join(out, "/");
    }

    private void route(Request req) throws IOException {
        String p = req.path;

        if (p.equals("/api/events") && req.method.equals("GET")) {
            Map<String, String> h = new LinkedHashMap<>();
            h.put("Content-Type", "text/event-stream; charset=utf-8");
            h.put("Cache-Control", "no-cache, no-transform");
            h.put("Connection", "keep-alive");
            h.put("X-Accel-Buffering", "no");
            writeHead(req, 200, h);
            req.out.write("retry: 2000\n\n".getBytes(StandardCharsets.UTF_8));
            req.out.flush();
            String role = "display".equals(req.query.get("role")) ? "display" : "controller";
            Client client = new Client(req.socket, req.out, role);
            clients.add(client);
            send(client, "state", publicStateJson());
            if (role.equals("display")) broadcastState();
            req.keepOpen = true;
            // chờ trình duyệt đóng kết nối
            try {
                req.socket.setSoTimeout(0);
                //noinspection StatementWithEmptyBody
                while (req.in.read() != -1) { }
            } catch (IOException ignored) {
            } finally {
                clients.remove(client);
                closeQuietly(req.socket);
                if (role.equals("display")) broadcastState();
            }
            return;
        }

        if (p.startsWith("/api/")) {
            if (req.method.equals("GET") && p.equals("/api/state")) {
                sendJsonText(req, 200, publicStateJson());
                return;
            }
            if (req.method.equals("GET") && p.equals("/api/search")) {
                String q = cleanText(req.query.get("q"), 100);
                if (q.isEmpty()) throw new HttpError(400, "Nhập tên bài hát cần tìm");
                sendJson(req, 200, searchYouTube(q, cleanText(req.query.get("pageToken"), 100)));
                return;
            }
            if (req.method.equals("GET") && p.equals("/api/link")) {
                sendJson(req, 200, linkInfo(req.query.get("url")));
                return;
            }
            if (req.method.equals("POST") && p.equals("/api/check-pin")) {
                Map<String, Object> body = readJsonBody(req);
                boolean ok = pinOk(str(body.get("pin")));
                sendJson(req, ok ? 200 : 403, obj("ok", ok, "pinRequired", !controlPin().isEmpty()));
                return;
            }
            if (req.method.equals("POST") && p.equals("/api/action")) {
                Map<String, Object> a = readJsonBody(req);
                String type = str(a.get("type"));
                Map<String, Object> result;
                synchronized (lock) {
                    if (!type.equals("add")) requirePin(req);
                    else if (truthy(a.get("next")) && !pinOk(req.header("x-pin"))) a.put("next", false); // khách không được chen lên đầu
                    result = runAction(type, a);
                }
                broadcastState();
                Map<String, Object> resp = obj("ok", true);
                if (result != null) resp.putAll(result);
                sendJson(req, 200, resp);
                return;
            }
            if (req.method.equals("POST") && p.equals("/api/upload")) {
                handleUpload(req);
                return;
            }
            if (req.method.equals("POST") && p.startsWith("/api/display/")) {
                Map<String, Object> a = readJsonBody(req);
                synchronized (lock) {
                    Map<String, Object> cur = current();
                    boolean same = cur != null && str(a.get("playId")).equals(str(cur.get("playId")));
                    switch (p) {
                        case "/api/display/status":
                            if (same) {
                                double dur = num(a.get("duration"), 0);
                                Map<String, Object> pb = playback();
                                if (dur > 0 && Math.abs(dur - num(pb.get("duration"), 0)) > 1) {
                                    pb.put("duration", dur);
                                    if (num(cur.get("duration"), 0) == 0) cur.put("duration", Math.round(dur));
                                }
                                double t = num(a.get("time"), Double.NaN);
                                if (!Double.isNaN(t) && !Double.isInfinite(t) && "playing".equals(pb.get("status")) && truthy(a.get("playing"))) {
                                    pb.put("position", t);
                                    pb.put("at", System.currentTimeMillis());
                                }
                                broadcast("progress", obj("playId", cur.get("playId"), "position", currentPosition(),
                                        "duration", num(pb.get("duration"), 0), "status", pb.get("status"),
                                        "buffering", truthy(a.get("buffering"))), "controller");
                            }
                            break;
                        case "/api/display/ended":
                            if (same) {
                                onEnded();
                                broadcastState();
                            }
                            break;
                        case "/api/display/error":
                            if (same) {
                                long code = Json.parseInt(a.get("code"), 0);
                                String why = code == 101 || code == 150 || code == 153
                                        ? "chủ kênh không cho phát ngoài YouTube"
                                        : code == 100 ? "video đã bị xóa hoặc riêng tư" : "lỗi phát video (mã " + code + ")";
                                notice("Bỏ qua \"" + str(cur.get("title")) + "\": " + why + ".", "warn");
                                state.put("current", null);
                                startNext();
                                broadcastState();
                            }
                            break;
                        default:
                            throw new HttpError(404, "Không có");
                    }
                }
                sendJson(req, 200, obj("ok", true));
                return;
            }
            throw new HttpError(404, "Không có chức năng này");
        }

        if (!req.method.equals("GET") && !req.method.equals("HEAD")) throw new HttpError(405, "Không hỗ trợ");

        if (p.startsWith("/uploads/")) {
            String rel = safeRel(p.substring("/uploads/".length()));
            if (rel == null || rel.contains("/")) throw new HttpError(404, "Không có");
            serveUpload(req, new File(uploadDir, rel));
            return;
        }
        String page = p.equals("/") ? "index.html" : p.equals("/led") || p.equals("/man-hinh") ? "led.html" : safeRel(p);
        serveAsset(req, page);
    }

    private static void sendJsonText(Request req, int status, String json) throws IOException {
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        Map<String, String> h = new LinkedHashMap<>();
        h.put("Content-Type", "application/json; charset=utf-8");
        h.put("Cache-Control", "no-store");
        h.put("Content-Length", String.valueOf(body.length));
        writeHead(req, status, h);
        req.out.write(body);
    }

    /* ------------------------------------------------------------------ */
    /* Tiện ích                                                             */
    /* ------------------------------------------------------------------ */

    private static String join(List<String> l, String sep) {
        StringBuilder sb = new StringBuilder();
        for (String s : l) {
            if (sb.length() > 0) sb.append(sep);
            sb.append(s);
        }
        return sb.toString();
    }

    private static void closeQuietly(Socket s) {
        try { s.close(); } catch (IOException ignored) { }
    }

    private static Object readJson(File f) {
        if (!f.isFile()) return null;
        try (InputStream in = new FileInputStream(f)) {
            return Json.parse(new String(readAll(in, 64 * 1024 * 1024), StandardCharsets.UTF_8));
        } catch (Exception e) {
            return null;
        }
    }

    private static void writeText(File f, String text) {
        try {
            File dir = f.getParentFile();
            //noinspection ResultOfMethodCallIgnored
            if (dir != null) dir.mkdirs();
            File tmp = new File(f.getPath() + ".tmp");
            try (OutputStream o = new FileOutputStream(tmp)) {
                o.write(text.getBytes(StandardCharsets.UTF_8));
            }
            if (!tmp.renameTo(f)) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
                //noinspection ResultOfMethodCallIgnored
                tmp.renameTo(f);
            }
        } catch (IOException e) {
            System.err.println("Khong ghi duoc " + f + ": " + e.getMessage());
        }
    }
}
