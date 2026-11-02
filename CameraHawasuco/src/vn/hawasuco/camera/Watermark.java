package vn.hawasuco.camera;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Vẽ watermark kiểu Timemark lên khung ngắm và lên ảnh lưu.
 * Mọi kích thước tính theo đơn vị u = cạnh ngắn / 960, nên khung ngắm và ảnh lưu giống hệt nhau.
 * Paint không an toàn đa luồng: mỗi luồng dùng một đối tượng Watermark riêng.
 */
final class Watermark {
    private static final String[] THU = {"Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"};
    private static final Locale VI = new Locale("vi", "VN");
    private static final int SHADOW = 0xC0000000;

    private final Bitmap logo;
    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private final Path path = new Path();
    private final RectF rf = new RectF();
    private final RectF inner = new RectF();
    private final Rect src = new Rect();
    private final SimpleDateFormat hm = new SimpleDateFormat("HH:mm", Locale.US);
    private final SimpleDateFormat dmy = new SimpleDateFormat("dd/MM/yyyy", Locale.US);
    private final Typeface condensed = Typeface.create("sans-serif-condensed", Typeface.BOLD);
    private final Typeface bold = Typeface.create("sans-serif", Typeface.BOLD);
    private final Typeface medium = Typeface.create("sans-serif-medium", Typeface.NORMAL);

    /** Vùng băng rôn + chữ của lần vẽ gần nhất (pixel), để bấm vào đó mở phần sửa thông tin. */
    final RectF infoBounds = new RectF();

    Watermark(Bitmap logo) {
        this.logo = logo;
    }

    void draw(Canvas c, int w, int h, StampData d, Prefs s, boolean preview) {
        float u = Math.min(w, h) / 960f;
        float m = 26 * u;
        p.setTextAlign(Paint.Align.LEFT);
        p.setStyle(Paint.Style.FILL);
        p.setShader(null);
        noShadow();

        if (s.showMap) drawMap(c, m, m, 262 * u, u, d, preview);

        float brandW = drawBrand(c, w, h, u, m, false);
        drawBrand(c, w, h, u, m, true);
        if (s.showPhotoId && d.photoId != null) drawPhotoId(c, w, h, u, d.photoId);

        // Các dòng thông tin (ngày, địa chỉ, tọa độ, nhân viên...), tự xuống dòng khi dài.
        float textSize = 30 * u;
        float textX = m + 26 * u;
        float maxW = Math.max(260 * u, w - textX - m - brandW - 24 * u);
        p.setTypeface(medium);
        p.setTextSize(textSize);
        List<String> lines = new ArrayList<String>();
        List<Boolean> starts = new ArrayList<Boolean>();
        for (String item : items(d, s, preview)) {
            List<String> wrapped = wrap(item, maxW, 3);
            for (int i = 0; i < wrapped.size(); i++) {
                lines.add(wrapped.get(i));
                starts.add(i == 0);
            }
        }
        float itemPitch = 47 * u, wrapPitch = 37 * u;
        float span = 0;
        for (int i = 1; i < lines.size(); i++) span += starts.get(i) ? itemPitch : wrapPitch;
        float lastBase = h - 36 * u;
        float firstBase = lastBase - span;
        float bannerH = 82 * u;
        float bannerBottom = firstBase - textSize - 16 * u;
        float bannerTop = bannerBottom - bannerH;

        drawStars(c, m + 12 * u, bannerTop - 10 * u, 24 * u, u);
        float bannerRight = drawBanner(c, m, bannerTop, bannerH, u, d.time, s.company);

        // Vạch xanh dọc bên trái các dòng chữ
        p.setShader(null);
        p.setColor(0xFF2F8FE8);
        c.drawRect(m + 6 * u, bannerBottom + 6 * u, m + 11 * u, lastBase + 10 * u, p);

        p.setTypeface(medium);
        p.setTextSize(textSize);
        p.setColor(Color.WHITE);
        p.setShadowLayer(3 * u, 0, 1.5f * u, SHADOW);
        float y = firstBase;
        float textRight = 0;
        for (int i = 0; i < lines.size(); i++) {
            if (i > 0) y += starts.get(i) ? itemPitch : wrapPitch;
            c.drawText(lines.get(i), textX, y, p);
            textRight = Math.max(textRight, textX + p.measureText(lines.get(i)));
        }
        noShadow();
        infoBounds.set(m, bannerTop - 40 * u, Math.max(bannerRight, textRight), lastBase + 12 * u);
    }

    static String address(StampData d, Prefs s) {
        if (s.addressMode == Prefs.ADDR_MANUAL) {
            String a = s.manualAddress == null ? "" : s.manualAddress.trim();
            return a.isEmpty() ? null : a;
        }
        if (s.addressMode == Prefs.ADDR_SHORT && d.addressShort != null) return d.addressShort;
        return d.addressFull;
    }

    private List<String> items(StampData d, Prefs s, boolean preview) {
        List<String> out = new ArrayList<String>();
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(d.time);
        out.add(dmy.format(new Date(d.time)) + "  " + THU[cal.get(Calendar.DAY_OF_WEEK) - 1]);
        if (s.showAddress) {
            String a = address(d, s);
            if (a != null) out.add(a);
            else if (preview) out.add(d.hasLocation ? "Đang lấy địa chỉ…" : "Đang chờ vị trí GPS…");
        }
        if (s.showCoords) {
            if (d.hasLocation) out.add(String.format(Locale.US, "Tọa độ: %.6f, %.6f", d.lat, d.lon));
            else if (preview && !s.showAddress) out.add("Tọa độ: đang chờ GPS…");
        }
        if (s.showEmployee && notEmpty(s.employee)) out.add("Nhân viên: " + s.employee.trim());
        if (s.showWorkplace && notEmpty(s.workplace)) out.add("Nơi làm việc: " + s.workplace.trim());
        if (s.showNote && notEmpty(s.note)) out.add("Nội dung: " + s.note.trim());
        return out;
    }

    private static boolean notEmpty(String v) {
        return v != null && !v.trim().isEmpty();
    }

    /** Ngắt chữ theo từ để vừa bề rộng; quá maxLines dòng thì cắt và thêm dấu "…". */
    private List<String> wrap(String text, float maxW, int maxLines) {
        List<String> out = new ArrayList<String>();
        StringBuilder line = new StringBuilder();
        for (String word : text.split(" ")) {
            if (word.isEmpty()) continue;
            String tryLine = line.length() == 0 ? word : line + " " + word;
            if (p.measureText(tryLine) <= maxW) {
                line.setLength(0);
                line.append(tryLine);
                continue;
            }
            if (line.length() > 0) {
                out.add(line.toString());
                line.setLength(0);
            }
            while (p.measureText(word) > maxW) {
                int n = Math.max(1, p.breakText(word, true, maxW, null));
                out.add(word.substring(0, n));
                word = word.substring(n);
            }
            line.append(word);
        }
        if (line.length() > 0) out.add(line.toString());
        if (out.isEmpty()) out.add("");
        if (out.size() > maxLines) {
            List<String> cut = new ArrayList<String>(out.subList(0, maxLines));
            String last = cut.get(maxLines - 1);
            while (last.length() > 1 && p.measureText(last + "…") > maxW) last = last.substring(0, last.length() - 1);
            cut.set(maxLines - 1, last + "…");
            return cut;
        }
        return out;
    }

    /** Băng rôn: [tên đơn vị | giờ | logo]. Trả về mép phải. */
    private float drawBanner(Canvas c, float x, float top, float bh, float u, long time, String companyRaw) {
        String company = companyRaw == null ? "" : companyRaw.trim();
        if (company.isEmpty()) company = "HAWASUCO";
        company = company.toUpperCase(VI);

        p.setTypeface(condensed);
        p.setTextSize(50 * u);
        float tw = p.measureText(company);
        float maxTw = 400 * u;
        if (tw > maxTw) {
            p.setTextSize(50 * u * maxTw / tw);
            tw = maxTw;
        }
        float cw = Math.max(tw + 40 * u, 160 * u);
        p.setShader(new LinearGradient(0, top, 0, top + bh,
                new int[]{0xFF2A64B8, 0xFF123E85, 0xFF0B2C66}, null, Shader.TileMode.CLAMP));
        c.drawRect(x, top, x + cw, top + bh, p);
        p.setShader(null);
        p.setColor(Color.WHITE);
        p.setShadowLayer(2 * u, 0, u, 0x80000000);
        Paint.FontMetrics fm = p.getFontMetrics();
        c.drawText(company, x + (cw - tw) / 2, top + bh / 2 - (fm.ascent + fm.descent) / 2, p);
        noShadow();

        float x2 = x + cw;
        String t = hm.format(new Date(time));
        p.setTypeface(bold);
        p.setTextSize(54 * u);
        float timeW = p.measureText(t) + 40 * u;
        p.setShader(new LinearGradient(0, top, 0, top + bh, 0xFF45A8F2, 0xFF1C7BD6, Shader.TileMode.CLAMP));
        c.drawRect(x2, top, x2 + timeW, top + bh, p);
        p.setShader(null);
        p.setColor(Color.WHITE);
        p.setShadowLayer(2 * u, 0, u, 0x80000000);
        fm = p.getFontMetrics();
        c.drawText(t, x2 + 20 * u, top + bh / 2 - (fm.ascent + fm.descent) / 2, p);
        noShadow();

        float x3 = x2 + timeW;
        p.setColor(Color.WHITE);
        c.drawRect(x3, top, x3 + bh, top + bh, p);
        if (logo != null) {
            float in = 5 * u;
            rf.set(x3 + in, top + in, x3 + bh - in, top + bh - in);
            c.drawBitmap(logo, null, rf, p);
        }
        return x3 + bh;
    }

    private void drawStars(Canvas c, float x, float bottom, float size, float u) {
        p.setShader(null);
        p.setColor(0xFFFFC107);
        p.setShadowLayer(2 * u, 0, u, 0x99000000);
        float r = size / 2;
        for (int i = 0; i < 5; i++) {
            star(x + r + i * (size + 5 * u), bottom - r, r, r * 0.45f);
            c.drawPath(path, p);
        }
        noShadow();
    }

    private void star(float cx, float cy, float ro, float ri) {
        path.reset();
        for (int i = 0; i < 10; i++) {
            double a = -Math.PI / 2 + i * Math.PI / 5;
            float rr = i % 2 == 0 ? ro : ri;
            float px = cx + (float) (rr * Math.cos(a)), py = cy + (float) (rr * Math.sin(a));
            if (i == 0) path.moveTo(px, py);
            else path.lineTo(px, py);
        }
        path.close();
    }

    /** Chữ "HAWASUCO Camera / Ảnh chụp thực tế" góc phải dưới. Trả về bề rộng. */
    private float drawBrand(Canvas c, int w, int h, float u, float m, boolean draw) {
        String a = "HAWASUCO", b = " Camera", sub = "Ảnh chụp thực tế";
        p.setTypeface(bold);
        p.setTextSize(30 * u);
        float wa = p.measureText(a), wb = p.measureText(b);
        p.setTypeface(medium);
        p.setTextSize(19 * u);
        float ws = p.measureText(sub);
        if (!draw) return Math.max(wa + wb, ws);

        float right = w - m, base2 = h - 36 * u, base1 = base2 - 30 * u;
        p.setShader(null);
        p.setShadowLayer(3 * u, 0, 1.5f * u, SHADOW);
        p.setTypeface(bold);
        p.setTextSize(30 * u);
        p.setColor(Color.WHITE);
        c.drawText(a, right - wa - wb, base1, p);
        p.setColor(0xFFFFC928);
        c.drawText(b, right - wb, base1, p);
        p.setTypeface(medium);
        p.setTextSize(19 * u);
        p.setColor(0xF2FFFFFF);
        c.drawText(sub, right - ws, base2, p);
        noShadow();
        return Math.max(wa + wb, ws);
    }

    /** Mã ảnh viết dọc ở mép phải. */
    private void drawPhotoId(Canvas c, int w, int h, float u, String id) {
        p.setShader(null);
        p.setTypeface(medium);
        p.setTextSize(19 * u);
        p.setColor(0xE6FFFFFF);
        p.setShadowLayer(2 * u, 0, u, 0xA0000000);
        c.save();
        c.translate(w - 14 * u, h * 0.6f);
        c.rotate(-90);
        c.drawText("© " + id + "  ·  HAWASUCO Camera", 0, 0, p);
        c.restore();
        noShadow();
    }

    private void drawMap(Canvas c, float x, float y, float size, float u, StampData d, boolean preview) {
        MapTiles.MapImage mi = d.hasLocation ? d.map : null;
        if (mi == null && !preview) return;

        float rad = 12 * u, border = 4 * u;
        p.setShader(null);
        p.setColor(Color.WHITE);
        p.setShadowLayer(4 * u, 0, 2 * u, 0x66000000);
        rf.set(x, y, x + size, y + size);
        c.drawRoundRect(rf, rad, rad, p);
        noShadow();

        inner.set(x + border, y + border, x + size - border, y + size - border);
        c.save();
        path.reset();
        path.addRoundRect(inner, rad - border / 2, rad - border / 2, Path.Direction.CW);
        c.clipPath(path);
        float mx = inner.centerX(), my = inner.centerY();
        if (mi != null) {
            double px = MapTiles.lonToX(d.lon) - mi.originX, py = MapTiles.latToY(d.lat) - mi.originY;
            int full = mi.bmp.getWidth(), view = full * 3 / 4;
            int sx = clamp((int) Math.round(px - view / 2.0), 0, full - view);
            int sy = clamp((int) Math.round(py - view / 2.0), 0, mi.bmp.getHeight() - view);
            src.set(sx, sy, sx + view, sy + view);
            c.drawBitmap(mi.bmp, src, inner, p);
            mx = inner.left + (float) ((px - sx) / view) * inner.width();
            my = inner.top + (float) ((py - sy) / view) * inner.height();
        } else {
            p.setColor(0xFFD9E2EA);
            c.drawRect(inner, p);
            p.setColor(0xFFC3CFDA);
            for (int i = 1; i < 4; i++) {
                float gx = inner.left + inner.width() * i / 4, gy = inner.top + inner.height() * i / 4;
                c.drawRect(gx - u, inner.top, gx + u, inner.bottom, p);
                c.drawRect(inner.left, gy - u, inner.right, gy + u, p);
            }
            p.setColor(0xFF4F6070);
            p.setTypeface(medium);
            p.setTextSize(20 * u);
            p.setTextAlign(Paint.Align.CENTER);
            c.drawText(d.hasLocation ? "Đang tải bản đồ…" : "Đang chờ GPS…", inner.centerX(), inner.bottom - 22 * u, p);
            p.setTextAlign(Paint.Align.LEFT);
        }
        if (d.hasLocation) {
            if (!Float.isNaN(d.heading)) drawCone(c, mx, my, inner.width() * 0.34f, d.heading);
            drawPin(c, mx, my, 40 * u, u);
        }
        c.restore();

        if (mi != null && mi.attribution != null) {
            p.setTypeface(medium);
            p.setTextSize(14 * u);
            p.setColor(Color.WHITE);
            p.setShadowLayer(2 * u, 0, u, SHADOW);
            p.setTextAlign(Paint.Align.RIGHT);
            c.drawText(mi.attribution, inner.right - 6 * u, inner.bottom - 6 * u, p);
            p.setTextAlign(Paint.Align.LEFT);
            noShadow();
        }
    }

    /** Hình quạt xanh chỉ hướng camera. */
    private void drawCone(Canvas c, float cx, float cy, float r, float heading) {
        rf.set(cx - r, cy - r, cx + r, cy + r);
        path.reset();
        path.moveTo(cx, cy);
        path.arcTo(rf, heading - 90 - 27, 54);
        path.close();
        p.setShader(new RadialGradient(cx, cy, r, 0xE639D353, 0x4039D353, Shader.TileMode.CLAMP));
        c.drawPath(path, p);
        p.setShader(null);
    }

    /** Ghim vị trí, mũi ghim ở (tipX, tipY). */
    private void drawPin(Canvas c, float tipX, float tipY, float hgt, float u) {
        float r = hgt * 0.36f, cy = tipY - hgt + r;
        p.setShader(null);
        p.setColor(0x55000000);
        rf.set(tipX - r * 0.6f, tipY - r * 0.2f, tipX + r * 0.6f, tipY + r * 0.2f);
        c.drawOval(rf, p);
        p.setColor(Color.WHITE);
        c.drawCircle(tipX, cy, r + 2 * u, p);
        p.setColor(0xFF1A73E8);
        path.reset();
        path.moveTo(tipX - r * 0.86f, cy + r * 0.5f);
        path.lineTo(tipX, tipY);
        path.lineTo(tipX + r * 0.86f, cy + r * 0.5f);
        path.close();
        c.drawPath(path, p);
        c.drawCircle(tipX, cy, r, p);
        p.setColor(Color.WHITE);
        c.drawCircle(tipX, cy, r * 0.42f, p);
    }

    private void noShadow() {
        p.setShadowLayer(0, 0, 0, 0);
    }

    private static int clamp(int v, int lo, int hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }
}
