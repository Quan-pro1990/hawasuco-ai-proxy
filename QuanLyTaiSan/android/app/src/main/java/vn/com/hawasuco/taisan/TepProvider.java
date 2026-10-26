package vn.com.hawasuco.taisan;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;

/**
 * File trong bộ nhớ đệm của app cho ứng dụng khác dùng:
 * content://vn.com.hawasuco.taisan.tep/tai/<tên>  — file Excel, ảnh, bản cập nhật APK vừa tải (chỉ đọc);
 * content://vn.com.hawasuco.taisan.tep/chup/<tên> — ứng dụng Camera ghi ảnh vừa chụp vào đây (đọc, ghi).
 */
public class TepProvider extends ContentProvider {
    static final String QUYEN = "vn.com.hawasuco.taisan.tep";
    static final String TAI = "tai", CHUP = "chup";

    static File thuMuc(Context c, String loai) {
        File d = new File(c.getCacheDir(), loai);
        if (!d.isDirectory()) d.mkdirs();
        return d;
    }

    /** Xoá file tải / ảnh chụp cũ hơn 1 ngày. */
    static void donDep(Context c) {
        long han = System.currentTimeMillis() - 24L * 3600 * 1000;
        for (String loai : new String[] { TAI, CHUP }) {
            File[] ds = thuMuc(c, loai).listFiles();
            if (ds == null) continue;
            for (File f : ds) if (f.isFile() && f.lastModified() < han) f.delete();
        }
    }

    /** Tên file không có ký tự cấm, không chứa thư mục. */
    static String tenAnToan(String ten) {
        String s = (ten == null ? "" : ten).replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]", "_").trim();
        if (s.startsWith(".")) s = "_" + s;
        if (s.length() > 150) s = s.substring(s.length() - 150);
        return s.length() == 0 ? "tep" : s;
    }

    static File tep(Context c, String loai, String ten) {
        return new File(thuMuc(c, loai), tenAnToan(ten));
    }

    static Uri uri(File f) {
        return new Uri.Builder().scheme("content").authority(QUYEN).appendPath(f.getParentFile().getName()).appendPath(f.getName()).build();
    }

    static String loai(String ten) {
        String t = ten.toLowerCase();
        if (t.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (t.endsWith(".pdf")) return "application/pdf";
        if (t.endsWith(".jpg") || t.endsWith(".jpeg")) return "image/jpeg";
        if (t.endsWith(".png")) return "image/png";
        if (t.endsWith(".apk")) return "application/vnd.android.package-archive";
        return "application/octet-stream";
    }

    File timTep(Uri uri) throws FileNotFoundException {
        List<String> p = uri.getPathSegments();
        if (p.size() != 2 || !(TAI.equals(p.get(0)) || CHUP.equals(p.get(0)))) throw new FileNotFoundException(uri.toString());
        File d = thuMuc(getContext(), p.get(0)), f = new File(d, p.get(1));
        try {
            if (!f.getCanonicalFile().getParentFile().equals(d.getCanonicalFile())) throw new FileNotFoundException(p.get(1));
        } catch (IOException e) {
            throw new FileNotFoundException(p.get(1));
        }
        return f;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File f = timTep(uri);
        boolean ghi = mode != null && mode.indexOf('w') >= 0;
        if (ghi) {
            // chỉ thư mục ảnh chụp được ghi (ứng dụng Camera ghi ảnh vào file app đã tạo sẵn)
            if (!CHUP.equals(f.getParentFile().getName())) throw new FileNotFoundException("chỉ đọc");
            return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_WRITE_ONLY | ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE);
        }
        if (!f.isFile()) throw new FileNotFoundException(f.getName());
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public String getType(Uri uri) {
        String ten = uri.getLastPathSegment();
        return ten == null ? null : loai(ten);
    }

    @Override
    public Cursor query(Uri uri, String[] cot, String chon, String[] thamSo, String sapXep) {
        File f;
        try { f = timTep(uri); } catch (FileNotFoundException e) { return null; }
        if (cot == null) cot = new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };
        MatrixCursor c = new MatrixCursor(cot, 1);
        Object[] dong = new Object[cot.length];
        for (int i = 0; i < cot.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cot[i])) dong[i] = f.getName();
            else if (OpenableColumns.SIZE.equals(cot[i])) dong[i] = f.length();
        }
        c.addRow(dong);
        return c;
    }

    @Override
    public Uri insert(Uri uri, ContentValues v) {
        throw new UnsupportedOperationException();
    }

    @Override
    public int delete(Uri uri, String chon, String[] thamSo) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues v, String chon, String[] thamSo) {
        return 0;
    }
}
