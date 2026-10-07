package vn.com.hawasuco.thatthoat;

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

/** Cho ứng dụng khác (Excel, trình xem PDF, Zalo, email…) đọc file báo cáo vừa tải trong bộ nhớ đệm của app. */
public class TepProvider extends ContentProvider {
    static final String QUYEN = "vn.com.hawasuco.thatthoat.tep";

    static File thuMuc(Context c) {
        File d = new File(c.getCacheDir(), "tai");
        if (!d.isDirectory()) d.mkdirs();
        return d;
    }

    /** Tên file không có ký tự cấm, không chứa thư mục. */
    static String tenAnToan(String ten) {
        String s = ten.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]", "_").trim();
        if (s.startsWith(".")) s = "_" + s;
        if (s.length() > 150) s = s.substring(s.length() - 150);
        return s.length() == 0 ? "bao-cao" : s;
    }

    static File tep(Context c, String ten) {
        return new File(thuMuc(c), tenAnToan(ten));
    }

    static Uri uri(File f) {
        return new Uri.Builder().scheme("content").authority(QUYEN).appendPath(f.getName()).build();
    }

    static String loai(String ten) {
        String t = ten.toLowerCase();
        if (t.endsWith(".pdf")) return "application/pdf";
        if (t.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (t.endsWith(".apk")) return "application/vnd.android.package-archive";
        return "application/octet-stream";
    }

    File timTep(Uri uri) throws FileNotFoundException {
        String ten = uri.getLastPathSegment();
        if (ten == null) throw new FileNotFoundException();
        File d = thuMuc(getContext()), f = new File(d, ten);
        try {
            if (!f.getCanonicalFile().getParentFile().equals(d.getCanonicalFile()) || !f.isFile()) throw new FileNotFoundException(ten);
        } catch (IOException e) {
            throw new FileNotFoundException(ten);
        }
        return f;
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(timTep(uri), ParcelFileDescriptor.MODE_READ_ONLY);
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
