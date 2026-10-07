package vn.com.hawasuco.thatthoat;

import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** In file PDF báo cáo qua dịch vụ in của Android (máy in Wi-Fi / mạng, hoặc "Lưu dưới dạng PDF"). */
class InPdf extends PrintDocumentAdapter {
    final File tep;
    final String ten;

    InPdf(File tep, String ten) {
        this.tep = tep;
        this.ten = ten;
    }

    @Override
    public void onLayout(PrintAttributes cu, PrintAttributes moi, CancellationSignal huy, LayoutResultCallback kq, Bundle them) {
        if (huy.isCanceled()) {
            kq.onLayoutCancelled();
            return;
        }
        PrintDocumentInfo info = new PrintDocumentInfo.Builder(ten + ".pdf")
            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
            .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
            .build();
        kq.onLayoutFinished(info, !moi.equals(cu));
    }

    @Override
    public void onWrite(PageRange[] trang, ParcelFileDescriptor dich, CancellationSignal huy, WriteResultCallback kq) {
        try {
            InputStream in = new FileInputStream(tep);
            OutputStream ra = new FileOutputStream(dich.getFileDescriptor());
            try {
                byte[] b = new byte[65536];
                int n;
                while ((n = in.read(b)) > 0) {
                    if (huy.isCanceled()) {
                        kq.onWriteCancelled();
                        return;
                    }
                    ra.write(b, 0, n);
                }
            } finally {
                in.close();
                ra.close();
            }
            kq.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
        } catch (Exception e) {
            kq.onWriteFailed(e.getMessage());
        }
    }
}
