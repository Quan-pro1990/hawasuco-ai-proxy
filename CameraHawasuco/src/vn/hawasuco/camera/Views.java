package vn.hawasuco.camera;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;

/** Các view vẽ tay (không cần tệp ảnh): nút biểu tượng, nút chụp, ảnh nhỏ, lớp watermark, bố cục màn hình. */
final class Views {
    private Views() {
    }

    /** Nút tròn có biểu tượng: đèn flash, cài đặt, đổi camera. */
    static final class IconView extends View {
        static final int FLASH = 0, GEAR = 1, SWITCH = 2;
        private final int type;
        private int state;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path path = new Path();
        private final RectF rf = new RectF();

        IconView(Context c, int type) {
            super(c);
            this.type = type;
            setClickable(true);
        }

        void setState(int s) {
            state = s;
            invalidate();
        }

        @Override
        protected void drawableStateChanged() {
            super.drawableStateChanged();
            invalidate();
        }

        @Override
        public void setEnabled(boolean enabled) {
            super.setEnabled(enabled);
            invalidate();
        }

        @Override
        protected void onDraw(Canvas c) {
            float w = getWidth(), h = getHeight(), s = Math.min(w, h), cx = w / 2, cy = h / 2;
            p.setStyle(Paint.Style.FILL);
            p.setColor(isPressed() ? 0x55FFFFFF : 0x2EFFFFFF);
            c.drawCircle(cx, cy, s / 2, p);
            int fg = isEnabled() ? Color.WHITE : 0x66FFFFFF;
            p.setColor(fg);
            if (type == FLASH) drawFlash(c, cx, cy, s, fg);
            else if (type == GEAR) drawGear(c, cx, cy, s);
            else drawSwitch(c, cx, cy, s);
        }

        private void drawFlash(Canvas c, float cx, float cy, float s, int fg) {
            float[] pts = {0.62f, 0f, 0.18f, 0.58f, 0.46f, 0.58f, 0.36f, 1f, 0.84f, 0.38f, 0.56f, 0.38f, 0.70f, 0f};
            float box = s * 0.46f, x0 = cx - box / 2, y0 = cy - box / 2;
            path.reset();
            for (int i = 0; i < pts.length; i += 2) {
                float x = x0 + pts[i] * box, y = y0 + pts[i + 1] * box;
                if (i == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            path.close();
            p.setColor(state == Prefs.FLASH_ON && isEnabled() ? 0xFFFFD54F : fg);
            c.drawPath(path, p);
            if (state == Prefs.FLASH_OFF) {
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeWidth(s * 0.06f);
                p.setStrokeCap(Paint.Cap.ROUND);
                p.setColor(fg);
                c.drawLine(cx - box * 0.55f, cy - box * 0.55f, cx + box * 0.55f, cy + box * 0.55f, p);
                p.setStyle(Paint.Style.FILL);
            } else if (state == Prefs.FLASH_AUTO) {
                p.setColor(fg);
                p.setTextSize(s * 0.26f);
                p.setFakeBoldText(true);
                c.drawText("A", cx + box * 0.42f, cy + box * 0.55f, p);
                p.setFakeBoldText(false);
            }
        }

        private void drawGear(Canvas c, float cx, float cy, float s) {
            float r = s * 0.2f;
            c.save();
            for (int i = 0; i < 8; i++) {
                c.drawRect(cx - s * 0.05f, cy - r * 1.45f, cx + s * 0.05f, cy - r * 0.8f, p);
                c.rotate(45, cx, cy);
            }
            c.restore();
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(r * 0.5f);
            c.drawCircle(cx, cy, r * 0.82f, p);
            p.setStyle(Paint.Style.FILL);
        }

        private void drawSwitch(Canvas c, float cx, float cy, float s) {
            float r = s * 0.24f;
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(s * 0.065f);
            p.setStrokeCap(Paint.Cap.ROUND);
            rf.set(cx - r, cy - r, cx + r, cy + r);
            c.drawArc(rf, 200, 130, false, p);
            c.drawArc(rf, 20, 130, false, p);
            p.setStyle(Paint.Style.FILL);
            arrowHead(c, cx, cy, r, 330, s * 0.11f);
            arrowHead(c, cx, cy, r, 150, s * 0.11f);
        }

        private void arrowHead(Canvas c, float cx, float cy, float r, float deg, float size) {
            double a = Math.toRadians(deg);
            float px = cx + (float) (r * Math.cos(a)), py = cy + (float) (r * Math.sin(a));
            float tx = (float) -Math.sin(a), ty = (float) Math.cos(a);
            float nx = (float) Math.cos(a), ny = (float) Math.sin(a);
            path.reset();
            path.moveTo(px + tx * size, py + ty * size);
            path.lineTo(px + nx * size * 0.75f, py + ny * size * 0.75f);
            path.lineTo(px - nx * size * 0.75f, py - ny * size * 0.75f);
            path.close();
            c.drawPath(path, p);
        }
    }

    /** Nút chụp tròn trắng. */
    static final class ShutterView extends View {
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);

        ShutterView(Context c) {
            super(c);
            setClickable(true);
        }

        @Override
        protected void drawableStateChanged() {
            super.drawableStateChanged();
            invalidate();
        }

        @Override
        public void setEnabled(boolean enabled) {
            super.setEnabled(enabled);
            invalidate();
        }

        @Override
        protected void onDraw(Canvas c) {
            float d = getResources().getDisplayMetrics().density;
            float cx = getWidth() / 2f, cy = getHeight() / 2f, r = Math.min(cx, cy) - 2 * d;
            int alpha = isEnabled() ? 255 : 110;
            p.setStyle(Paint.Style.STROKE);
            p.setStrokeWidth(4 * d);
            p.setColor(Color.WHITE);
            p.setAlpha(alpha);
            c.drawCircle(cx, cy, r - 2 * d, p);
            p.setStyle(Paint.Style.FILL);
            p.setColor(isPressed() ? 0xFFBDBDBD : Color.WHITE);
            p.setAlpha(alpha);
            c.drawCircle(cx, cy, r - (isPressed() ? 12 : 9) * d, p);
        }
    }

    /** Ảnh nhỏ của tấm vừa chụp, có vòng quay khi đang lưu. */
    static final class ThumbView extends View {
        private Bitmap bmp;
        private BitmapShader shader;
        private boolean busy;
        private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final Paint sp = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF rf = new RectF();
        private final Matrix m = new Matrix();

        ThumbView(Context c) {
            super(c);
            setClickable(true);
        }

        void setImage(Bitmap b) {
            bmp = b;
            shader = b == null ? null : new BitmapShader(b, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP);
            invalidate();
        }

        void setBusy(boolean b) {
            busy = b;
            invalidate();
        }

        @Override
        protected void onDraw(Canvas c) {
            float d = getResources().getDisplayMetrics().density;
            rf.set(2 * d, 2 * d, getWidth() - 2 * d, getHeight() - 2 * d);
            float rad = 12 * d;
            if (shader != null) {
                float s = Math.max(rf.width() / bmp.getWidth(), rf.height() / bmp.getHeight());
                m.setScale(s, s);
                m.postTranslate(rf.centerX() - bmp.getWidth() * s / 2, rf.centerY() - bmp.getHeight() * s / 2);
                shader.setLocalMatrix(m);
                p.setShader(shader);
            } else {
                p.setShader(null);
                p.setColor(0xFF2B2B2B);
            }
            c.drawRoundRect(rf, rad, rad, p);
            sp.setStyle(Paint.Style.STROKE);
            sp.setStrokeWidth(2 * d);
            sp.setColor(Color.WHITE);
            c.drawRoundRect(rf, rad, rad, sp);
            if (busy) {
                sp.setStyle(Paint.Style.FILL);
                sp.setColor(0x80000000);
                c.drawRoundRect(rf, rad, rad, sp);
                sp.setStyle(Paint.Style.STROKE);
                sp.setStrokeWidth(3 * d);
                sp.setStrokeCap(Paint.Cap.ROUND);
                sp.setColor(Color.WHITE);
                float start = (SystemClock.uptimeMillis() % 1000) * 0.36f;
                float r = Math.min(rf.width(), rf.height()) * 0.28f;
                c.drawArc(new RectF(rf.centerX() - r, rf.centerY() - r, rf.centerX() + r, rf.centerY() + r),
                        start, 270, false, sp);
                postInvalidateOnAnimation();
            }
        }
    }

    /** Lớp vẽ watermark phủ lên khung ngắm, kèm vòng lấy nét khi chạm. */
    static final class OverlayView extends View {
        interface Source {
            StampData stamp();

            Prefs prefs();
        }

        private final Watermark mark;
        private final Source source;
        private final Paint fp = new Paint(Paint.ANTI_ALIAS_FLAG);
        private float focusX, focusY;
        private long focusAt;

        OverlayView(Context c, Bitmap logo, Source source) {
            super(c);
            this.mark = new Watermark(logo);
            this.source = source;
            fp.setStyle(Paint.Style.STROKE);
        }

        RectF infoBounds() {
            return mark.infoBounds;
        }

        void showFocus(float x, float y) {
            focusX = x;
            focusY = y;
            focusAt = SystemClock.uptimeMillis();
            invalidate();
        }

        @Override
        protected void onDraw(Canvas c) {
            if (getWidth() == 0 || getHeight() == 0) return;
            mark.draw(c, getWidth(), getHeight(), source.stamp(), source.prefs(), true);
            long dt = SystemClock.uptimeMillis() - focusAt;
            if (focusAt > 0 && dt < 1200) {
                float d = getResources().getDisplayMetrics().density;
                float r = (dt < 200 ? 46 - 10 * dt / 200f : 36) * d;
                fp.setStrokeWidth(2 * d);
                fp.setColor(0xFFFFD54F);
                if (dt > 900) fp.setAlpha((int) (255 * (1200 - dt) / 300f));
                c.drawCircle(focusX, focusY, r, fp);
                postInvalidateOnAnimation();
            }
        }
    }

    /**
     * Bố cục màn hình: thanh trên, khung ngắm 3:4, vùng nút bên dưới.
     * Màn hình ngắn thì thanh trên / vùng nút đè lên khung ngắm (nền mờ).
     */
    static final class RootLayout extends ViewGroup {
        private View top, frame, bottom;
        private int topH, minBottom;
        private int fx, fy, fw, fh, by;

        RootLayout(Context c) {
            super(c);
        }

        void setParts(View top, View frame, View bottom, int topH, int minBottom) {
            this.top = top;
            this.frame = frame;
            this.bottom = bottom;
            this.topH = topH;
            this.minBottom = minBottom;
            addView(frame);
            addView(bottom);
            addView(top);
        }

        @Override
        protected void onMeasure(int ws, int hs) {
            int w = MeasureSpec.getSize(ws), h = MeasureSpec.getSize(hs);
            setMeasuredDimension(w, h);
            fw = w;
            fh = w * 4 / 3;
            if (fh > h) {
                fh = h;
                fw = h * 3 / 4;
            }
            fx = (w - fw) / 2;
            fy = h - fh >= topH + minBottom ? topH : 0;
            by = Math.min(fy + fh, h - minBottom);
            top.measure(exactly(w), exactly(topH));
            frame.measure(exactly(fw), exactly(fh));
            bottom.measure(exactly(w), exactly(Math.max(0, h - by)));
        }

        @Override
        protected void onLayout(boolean changed, int l, int t, int r, int b) {
            int w = r - l, h = b - t;
            frame.layout(fx, fy, fx + fw, fy + fh);
            bottom.layout(0, by, w, h);
            top.layout(0, 0, w, topH);
            top.setBackgroundColor(fy == 0 ? 0x66000000 : 0);
            bottom.setBackgroundColor(by < fy + fh ? 0x66000000 : 0);
        }

        private static int exactly(int size) {
            return MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY);
        }
    }
}
