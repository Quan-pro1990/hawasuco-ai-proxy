package vn.hawasuco.camera;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.media.ExifInterface;
import android.media.ThumbnailUtils;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Xoay ảnh camera cho đúng chiều, vẽ watermark, ghi EXIF (GPS, giờ) và lưu vào Thư viện ảnh. */
final class PhotoSaver {
    static final String FOLDER = "HAWASUCO";

    static final class Result {
        Uri uri;
        Bitmap thumb;
    }

    private PhotoSaver() {
    }

    static Result save(Context ctx, byte[] jpeg, StampData d, Prefs s, Watermark mark) throws IOException {
        File cache = ctx.getCacheDir();
        File in = new File(cache, "chup.jpg");
        writeFile(in, jpeg);
        int rotation = exifRotation(in.getPath());

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(in.getPath(), bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("ảnh từ camera bị hỏng");
        int maxLong = s.photoSize == Prefs.SIZE_MEDIUM ? 2048 : 4608;
        int srcLong = Math.max(bounds.outWidth, bounds.outHeight);
        int sample = 1;
        while (srcLong / (sample * 2) >= maxLong) sample *= 2;

        Bitmap src = decode(in, sample);
        float scale = Math.min(1f, (float) maxLong / Math.max(src.getWidth(), src.getHeight()));
        Bitmap out = orient(src, rotation, scale);
        src.recycle();
        in.delete();
        int ow = out.getWidth(), oh = out.getHeight();
        Canvas c = new Canvas(out);

        String base = "HAWASUCO_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date(d.time));
        if (s.saveOriginal) {
            File f = new File(cache, "goc.jpg");
            compress(out, f);
            writeExif(f, d);
            insert(ctx, f, base + "_goc.jpg", d.time, FOLDER + "/Anh goc");
            f.delete();
        }

        mark.draw(c, ow, oh, d, s, false);
        File f = new File(cache, "luu.jpg");
        compress(out, f);
        writeExif(f, d);
        Result r = new Result();
        r.uri = insert(ctx, f, base + ".jpg", d.time, FOLDER);
        f.delete();
        r.thumb = ThumbnailUtils.extractThumbnail(out, 200, 200);
        out.recycle();
        return r;
    }

    /** Ảnh mới (có thể vẽ lên) đã xoay theo chiều kim đồng hồ `rotation` độ và thu nhỏ theo `scale`. */
    static Bitmap orient(Bitmap src, int rotation, float scale) {
        int sw = Math.round(src.getWidth() * scale), sh = Math.round(src.getHeight() * scale);
        boolean swap = rotation == 90 || rotation == 270;
        int ow = swap ? sh : sw, oh = swap ? sw : sh;
        Bitmap out = Bitmap.createBitmap(ow, oh, Bitmap.Config.ARGB_8888);
        Matrix m = new Matrix();
        m.postTranslate(-src.getWidth() / 2f, -src.getHeight() / 2f);
        m.postScale(scale, scale);
        m.postRotate(rotation);
        m.postTranslate(ow / 2f, oh / 2f);
        new Canvas(out).drawBitmap(src, m, new Paint(Paint.FILTER_BITMAP_FLAG));
        return out;
    }

    private static Bitmap decode(File f, int sample) throws IOException {
        for (int attempt = 0; attempt < 3; attempt++) {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inSampleSize = sample;
            o.inPreferredConfig = Bitmap.Config.ARGB_8888;
            try {
                Bitmap b = BitmapFactory.decodeFile(f.getPath(), o);
                if (b != null) return b;
            } catch (OutOfMemoryError e) {
                // thử lại với ảnh nhỏ hơn
            }
            sample *= 2;
        }
        throw new IOException("không đủ bộ nhớ để xử lý ảnh");
    }

    private static int exifRotation(String path) {
        try {
            switch (new ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, 1)) {
                case 6:
                case 5:
                    return 90;
                case 3:
                case 4:
                    return 180;
                case 8:
                case 7:
                    return 270;
                default:
                    return 0;
            }
        } catch (IOException e) {
            return 0;
        }
    }

    private static void compress(Bitmap b, File f) throws IOException {
        FileOutputStream os = new FileOutputStream(f);
        try {
            if (!b.compress(Bitmap.CompressFormat.JPEG, 92, os)) throw new IOException("không nén được ảnh");
        } finally {
            os.close();
        }
    }

    private static void writeExif(File f, StampData d) {
        try {
            ExifInterface e = new ExifInterface(f.getPath());
            String dt = new SimpleDateFormat("yyyy:MM:dd HH:mm:ss", Locale.US).format(new Date(d.time));
            e.setAttribute(ExifInterface.TAG_DATETIME, dt);
            e.setAttribute("DateTimeOriginal", dt);
            e.setAttribute("DateTimeDigitized", dt);
            e.setAttribute(ExifInterface.TAG_MAKE, Build.MANUFACTURER);
            e.setAttribute(ExifInterface.TAG_MODEL, Build.MODEL);
            e.setAttribute("Software", "HAWASUCO Camera");
            if (d.photoId != null) e.setAttribute("ImageDescription", "HAWASUCO " + d.photoId);
            e.setAttribute(ExifInterface.TAG_ORIENTATION, "1");
            if (d.hasLocation) {
                e.setAttribute(ExifInterface.TAG_GPS_LATITUDE, dms(d.lat));
                e.setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, d.lat >= 0 ? "N" : "S");
                e.setAttribute(ExifInterface.TAG_GPS_LONGITUDE, dms(d.lon));
                e.setAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF, d.lon >= 0 ? "E" : "W");
                if (d.hasAltitude) {
                    e.setAttribute(ExifInterface.TAG_GPS_ALTITUDE, Math.round(Math.abs(d.altitude) * 100) + "/100");
                    e.setAttribute(ExifInterface.TAG_GPS_ALTITUDE_REF, d.altitude >= 0 ? "0" : "1");
                }
                SimpleDateFormat day = new SimpleDateFormat("yyyy:MM:dd", Locale.US);
                SimpleDateFormat time = new SimpleDateFormat("HH'/1,'mm'/1,'ss'/1'", Locale.US);
                TimeZone utc = TimeZone.getTimeZone("UTC");
                day.setTimeZone(utc);
                time.setTimeZone(utc);
                e.setAttribute(ExifInterface.TAG_GPS_DATESTAMP, day.format(new Date(d.time)));
                e.setAttribute(ExifInterface.TAG_GPS_TIMESTAMP, time.format(new Date(d.time)));
            }
            e.saveAttributes();
        } catch (IOException ignored) {
            // thiếu EXIF không làm hỏng ảnh
        }
    }

    private static String dms(double v) {
        v = Math.abs(v);
        int deg = (int) v;
        double minF = (v - deg) * 60;
        int min = (int) minF;
        long sec = Math.round((minF - min) * 60 * 10000);
        return deg + "/1," + min + "/1," + sec + "/10000";
    }

    /** Ghi tệp vào Thư viện ảnh: DCIM/&lt;folder&gt;. */
    private static Uri insert(Context ctx, File f, String name, long time, String folder) throws IOException {
        ContentResolver cr = ctx.getContentResolver();
        ContentValues v = new ContentValues();
        v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
        v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        v.put(MediaStore.Images.Media.DATE_TAKEN, time);
        if (Build.VERSION.SDK_INT < 29) {
            File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), folder);
            if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("không tạo được thư mục " + dir);
            File dst = new File(dir, name);
            copy(new FileInputStream(f), new FileOutputStream(dst));
            v.put(MediaStore.Images.Media.DATA, dst.getAbsolutePath());
            Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IOException("không ghi được vào Thư viện ảnh");
            return uri;
        }
        v.put("relative_path", Environment.DIRECTORY_DCIM + "/" + folder);
        v.put("is_pending", 1);
        Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
        if (uri == null) throw new IOException("không ghi được vào Thư viện ảnh");
        try {
            OutputStream os = cr.openOutputStream(uri);
            if (os == null) throw new IOException("không ghi được vào Thư viện ảnh");
            copy(new FileInputStream(f), os);
            v.clear();
            v.put("is_pending", 0);
            cr.update(uri, v, null, null);
            return uri;
        } catch (IOException e) {
            cr.delete(uri, null, null);
            throw e;
        }
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        try {
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        } finally {
            in.close();
            out.close();
        }
    }

    private static void writeFile(File f, byte[] data) throws IOException {
        FileOutputStream os = new FileOutputStream(f);
        try {
            os.write(data);
        } finally {
            os.close();
        }
    }

    /** Đọc ảnh đã lưu, thu nhỏ để cạnh dài khoảng maxSide; null nếu ảnh không còn. */
    static Bitmap loadScaled(Context ctx, Uri uri, int maxSide) {
        try {
            ContentResolver cr = ctx.getContentResolver();
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            InputStream in = cr.openInputStream(uri);
            if (in == null) return null;
            BitmapFactory.decodeStream(in, null, o);
            in.close();
            if (o.outWidth <= 0) return null;
            int sample = 1;
            while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= maxSide) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            in = cr.openInputStream(uri);
            if (in == null) return null;
            Bitmap b = BitmapFactory.decodeStream(in, null, o2);
            in.close();
            return b;
        } catch (Exception e) {
            return null;
        } catch (OutOfMemoryError e) {
            return null;
        }
    }
}
