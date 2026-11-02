package vn.hawasuco.camera;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** Hộp thoại Cài đặt watermark và màn hình xem lại ảnh vừa chụp. */
final class Dialogs {
    private Dialogs() {
    }

    // ----- Cài đặt

    static void settings(final Activity a, final Prefs p, final Runnable onSaved) {
        ScrollView sv = new ScrollView(a);
        LinearLayout box = new LinearLayout(a);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(a, 22), dp(a, 4), dp(a, 22), dp(a, 8));
        sv.addView(box);

        header(box, "Thông tin trên ảnh");
        label(box, "Tên đơn vị trên băng rôn");
        final EditText company = field(box, "HAWASUCO", p.company);
        label(box, "Tên nhân viên");
        final EditText employee = field(box, "vd: Trần Văn Nam", p.employee);
        employee.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS
                | InputType.TYPE_TEXT_VARIATION_PERSON_NAME);
        label(box, "Đội");
        final EditText team = teamField(a, box, p.team);
        label(box, "Nơi làm việc (không bắt buộc)");
        final EditText workplace = field(box, "vd: Khu vực Châu Thành", p.workplace);
        label(box, "Nội dung công việc (không bắt buộc)");
        final EditText note = field(box, "vd: Lắp đặt đồng hồ nước", p.note);

        header(box, "Địa chỉ");
        final RadioGroup addr = radios(box, new String[]{
                "Tự động – đầy đủ", "Tự động – rút gọn (huyện, tỉnh)", "Tự nhập"}, p.addressMode);
        final EditText manual = field(box, "Địa chỉ tự nhập", p.manualAddress);
        manual.setEnabled(p.addressMode == Prefs.ADDR_MANUAL);
        addr.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup g, int id) {
                manual.setEnabled(checked(g) == Prefs.ADDR_MANUAL);
            }
        });

        header(box, "Hiển thị trên ảnh");
        final CheckBox cMap = check(box, "Bản đồ vị trí", p.showMap);
        final CheckBox cAddr = check(box, "Địa chỉ", p.showAddress);
        final CheckBox cCoord = check(box, "Tọa độ GPS", p.showCoords);
        final CheckBox cEmp = check(box, "Tên nhân viên", p.showEmployee);
        final CheckBox cTeam = check(box, "Đội", p.showTeam);
        final CheckBox cWork = check(box, "Nơi làm việc", p.showWorkplace);
        final CheckBox cNote = check(box, "Nội dung / ghi chú", p.showNote);
        final CheckBox cId = check(box, "Mã ảnh (chữ dọc mép phải)", p.showPhotoId);

        header(box, "Kiểu bản đồ");
        final RadioGroup mapType = radios(box, new String[]{"Vệ tinh", "Bản đồ đường phố"}, p.mapType);

        header(box, "Ảnh chụp");
        final RadioGroup size = radios(box, new String[]{
                "Ảnh lớn – nét nhất", "Ảnh vừa – nhẹ, gửi Zalo nhanh"}, p.photoSize);
        final CheckBox cOrig = check(box, "Lưu thêm ảnh gốc (không watermark)", p.saveOriginal);
        final CheckBox cSound = check(box, "Âm thanh khi chụp", p.shutterSound);

        TextView info = new TextView(a);
        info.setText("Ảnh lưu trong Thư viện ảnh, thư mục DCIM/HAWASUCO.\n"
                + "Bấm vào phần chữ trên khung ngắm để mở lại cài đặt này.\n"
                + "Phím âm lượng cũng dùng để chụp.\nPhiên bản " + version(a));
        info.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        info.setTextColor(0xFF6B7785);
        info.setPadding(0, dp(a, 14), 0, 0);
        box.addView(info);

        new AlertDialog.Builder(a, android.R.style.Theme_Material_Light_Dialog_Alert)
                .setTitle("Cài đặt watermark")
                .setView(sv)
                .setNegativeButton("Huỷ", null)
                .setPositiveButton("Lưu", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface di, int which) {
                        p.company = text(company);
                        p.employee = text(employee);
                        p.team = text(team);
                        p.workplace = text(workplace);
                        p.note = text(note);
                        p.addressMode = checked(addr);
                        p.manualAddress = text(manual);
                        p.showMap = cMap.isChecked();
                        p.showAddress = cAddr.isChecked();
                        p.showCoords = cCoord.isChecked();
                        p.showEmployee = cEmp.isChecked();
                        p.showTeam = cTeam.isChecked();
                        p.showWorkplace = cWork.isChecked();
                        p.showNote = cNote.isChecked();
                        p.showPhotoId = cId.isChecked();
                        p.mapType = checked(mapType);
                        p.photoSize = checked(size);
                        p.saveOriginal = cOrig.isChecked();
                        p.shutterSound = cSound.isChecked();
                        onSaved.run();
                    }
                })
                .show();
    }

    private static void header(LinearLayout box, String title) {
        TextView t = new TextView(box.getContext());
        t.setText(title);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setTextColor(0xFF1D5F95);
        t.setPadding(0, dp(box.getContext(), 16), 0, dp(box.getContext(), 2));
        box.addView(t);
    }

    private static void label(LinearLayout box, String text) {
        TextView t = new TextView(box.getContext());
        t.setText(text);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setTextColor(0xFF4A5663);
        t.setPadding(dp(box.getContext(), 4), dp(box.getContext(), 8), 0, 0);
        box.addView(t);
    }

    /** Ô "Đội": gõ tay hoặc bấm "Chọn" để lấy từ danh sách các đội cấp nước. */
    private static EditText teamField(final Activity a, LinearLayout box, String value) {
        LinearLayout row = new LinearLayout(a);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        final EditText e = new EditText(a);
        e.setHint("vd: Đội Cấp nước số 5");
        e.setText(value);
        e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        row.addView(e, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView pick = new TextView(a);
        pick.setText("Chọn ▾");
        pick.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        pick.setTypeface(Typeface.DEFAULT_BOLD);
        pick.setTextColor(0xFF1D5F95);
        pick.setPadding(dp(a, 12), dp(a, 10), dp(a, 4), dp(a, 10));
        pick.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                new AlertDialog.Builder(a, android.R.style.Theme_Material_Light_Dialog_Alert)
                        .setTitle("Chọn đội")
                        .setItems(TEAMS, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface di, int which) {
                                e.setText(TEAMS[which]);
                                e.setSelection(e.length());
                            }
                        })
                        .show();
            }
        });
        row.addView(pick);
        box.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private static final String[] TEAMS = {
            "Đội Cấp nước số 1", "Đội Cấp nước số 2", "Đội Cấp nước số 3",
            "Đội Cấp nước số 4", "Đội Cấp nước số 5", "Đội Cấp nước số 6"};

    private static EditText field(LinearLayout box, String hint, String value) {
        EditText e = new EditText(box.getContext());
        e.setHint(hint);
        e.setText(value);
        e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        box.addView(e, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private static CheckBox check(LinearLayout box, String label, boolean value) {
        CheckBox c = new CheckBox(box.getContext());
        c.setText(label);
        c.setChecked(value);
        c.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        box.addView(c);
        return c;
    }

    private static RadioGroup radios(LinearLayout box, String[] labels, int selected) {
        RadioGroup g = new RadioGroup(box.getContext());
        g.setOrientation(RadioGroup.VERTICAL);
        for (int i = 0; i < labels.length; i++) {
            RadioButton b = new RadioButton(box.getContext());
            b.setId(View.generateViewId());
            b.setText(labels[i]);
            b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
            g.addView(b);
            if (i == selected) g.check(b.getId());
        }
        if (g.getCheckedRadioButtonId() == View.NO_ID && g.getChildCount() > 0) g.check(g.getChildAt(0).getId());
        box.addView(g);
        return g;
    }

    private static int checked(RadioGroup g) {
        View v = g.findViewById(g.getCheckedRadioButtonId());
        int i = v == null ? 0 : g.indexOfChild(v);
        return Math.max(0, i);
    }

    private static String text(EditText e) {
        return e.getText().toString().trim();
    }

    private static String version(Activity a) {
        try {
            return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    // ----- Xem lại ảnh

    interface ReviewCallback {
        void onDeleted();
    }

    static void review(final Activity a, final Uri uri, final ReviewCallback cb) {
        final Dialog dlg = new Dialog(a, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        FrameLayout root = new FrameLayout(a);
        root.setBackgroundColor(Color.BLACK);
        final ImageView iv = new ImageView(a);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        root.addView(iv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout bar = new LinearLayout(a);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setBackgroundColor(0xCC000000);
        bar.setPadding(dp(a, 6), dp(a, 6), dp(a, 6), dp(a, 6));
        bar.addView(button(a, "Chia sẻ", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("image/jpeg");
                i.putExtra(Intent.EXTRA_STREAM, uri);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    a.startActivity(Intent.createChooser(i, "Chia sẻ ảnh"));
                } catch (ActivityNotFoundException e) {
                    toast(a, "Không có ứng dụng để chia sẻ");
                }
            }
        }));
        bar.addView(button(a, "Thư viện", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "image/jpeg");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    a.startActivity(i);
                } catch (ActivityNotFoundException e) {
                    toast(a, "Không mở được Thư viện ảnh");
                }
            }
        }));
        bar.addView(button(a, "Xoá", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                new AlertDialog.Builder(a, android.R.style.Theme_Material_Light_Dialog_Alert)
                        .setMessage("Xoá ảnh này khỏi máy?")
                        .setNegativeButton("Không", null)
                        .setPositiveButton("Xoá", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface di, int which) {
                                int n;
                                try {
                                    n = a.getContentResolver().delete(uri, null, null);
                                } catch (Exception e) {
                                    n = 0;
                                }
                                if (n > 0) {
                                    cb.onDeleted();
                                    dlg.dismiss();
                                    toast(a, "Đã xoá ảnh");
                                } else {
                                    toast(a, "Không xoá được ảnh này, hãy xoá trong ứng dụng Thư viện");
                                }
                            }
                        })
                        .show();
            }
        }));
        bar.addView(button(a, "Đóng", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dlg.dismiss();
            }
        }));
        root.addView(bar, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));
        dlg.setContentView(root);
        dlg.show();

        final int side = Math.max(a.getResources().getDisplayMetrics().widthPixels,
                a.getResources().getDisplayMetrics().heightPixels);
        new Thread(new Runnable() {
            @Override
            public void run() {
                final Bitmap b = PhotoSaver.loadScaled(a, uri, side);
                a.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (b != null) iv.setImageBitmap(b);
                        else toast(a, "Không đọc được ảnh (có thể đã bị xoá)");
                    }
                });
            }
        }).start();
    }

    private static View button(Activity a, String label, View.OnClickListener l) {
        TextView t = new TextView(a);
        t.setText(label);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, dp(a, 14), 0, dp(a, 14));
        t.setClickable(true);
        t.setOnClickListener(l);
        TypedValue tv = new TypedValue();
        if (a.getTheme().resolveAttribute(android.R.attr.selectableItemBackground, tv, true)) {
            t.setBackgroundResource(tv.resourceId);
        }
        t.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        return t;
    }

    static void toast(Activity a, String msg) {
        Toast.makeText(a, msg, Toast.LENGTH_SHORT).show();
    }

    static int dp(android.content.Context c, float v) {
        return Math.round(v * c.getResources().getDisplayMetrics().density);
    }
}
