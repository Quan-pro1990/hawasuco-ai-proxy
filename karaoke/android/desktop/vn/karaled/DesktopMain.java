package vn.karaled;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

/**
 * Chạy máy chủ Java của app Android ngay trên máy tính để kiểm tra (dùng chung test/test.js với bản Node):
 *   SERVER_CMD="java -cp build/desktop vn.karaled.DesktopMain" node test/test.js
 */
public final class DesktopMain {
    public static void main(String[] args) throws IOException {
        File root = new File(args.length > 0 ? args[0] : "public").getCanonicalFile();
        KaraServer.Config c = new KaraServer.Config();
        c.port = Integer.parseInt(env("PORT", "3000"));
        c.host = env("HOST", "0.0.0.0");
        c.dataDir = new File(env("DATA_DIR", "data"));
        c.envKeys = env("YOUTUBE_API_KEY", "");
        c.envPin = env("CONTROL_PIN", "");
        c.ytApi = env("YT_API_BASE", c.ytApi);
        c.oembedUrl = env("YT_OEMBED_URL", c.oembedUrl);
        c.assets = path -> {
            File f = new File(root, path).getCanonicalFile();
            if (!f.getPath().startsWith(root.getPath() + File.separator) || !f.isFile()) return null;
            return Files.readAllBytes(f.toPath());
        };
        final KaraServer s = new KaraServer(c);
        s.start();
        Runtime.getRuntime().addShutdownHook(new Thread(s::stop));
        System.out.println("KaraLED (Java) dang chay tai cong " + c.port + " " + s.lanUrls());
        System.out.flush();
    }

    private static String env(String k, String def) {
        String v = System.getenv(k);
        return v == null ? def : v;
    }
}
