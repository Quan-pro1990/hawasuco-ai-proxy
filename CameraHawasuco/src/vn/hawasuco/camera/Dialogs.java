package vn.hawasuco.camera;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.StateListDrawable;
import android.net.Uri;
import android.text.InputType;
import android.util.TypedValue;
import android.view.ContextThemeWrapper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
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

/** Trang Thông tin & cài đặt và màn hình xem lại ảnh vừa chụp. */
final class Dialogs {
    private Dialogs() {
    }

    // ----- Cài đặt

    private static final int BLUE = 0xFF1D5F95;
    private static final int TEXT = 0xFF14212E;
    private static final int TEXT_SOFT = 0xFF4A5868;
    private static final String[] TEAMS = {
            "Đội Cấp nước số 1", "Đội Cấp nước số 2", "Đội Cấp nước số 3",
            "Đội Cấp nước số 4", "Đội Cấp nước số 5", "Đội Cấp nước số 6"};
    private static final String[] EQUIPMENT = {
            "Đồng hồ nước khách hàng", "Thủy lượng kế (TLK)", "Đồng hồ cấp 1", "SCADA", "Van", "Trụ cứu hỏa",
            "Đường ống", "Bể ống", "Máy bơm", "Giếng", "Bể chứa"};

    /** Trang cài đặt toàn màn hình, nền sáng, chữ to. */
    static void settings(final Activity a, final Prefs p, final Runnable onSaved) {
        final Context c = new ContextThemeWrapper(a, android.R.style.Theme_Material_Light_NoActionBar);
        final Dialog dlg = new Dialog(c, android.R.style.Theme_Material_Light_NoActionBar);

        LinearLayout root = new LinearLayout(c);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFFEEF2F6);

        LinearLayout bar = new LinearLayout(c);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(BLUE);
        bar.setPadding(dp(c, 4), 0, dp(c, 4), 0);
        TextView cancel = barButton(c, "Huỷ");
        bar.addView(cancel);
        TextView title = new TextView(c);
        title.setText("Thông tin & cài đặt");
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        title.setSingleLine(true);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView save = barButton(c, "LƯU");
        bar.addView(save);
        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(c, 58)));

        ScrollView sv = new ScrollView(c);
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(c, 12), dp(c, 12), dp(c, 12), dp(c, 24));
        sv.addView(box);
        root.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout info = card(box, "Thông tin trên ảnh");
        final EditText employee = input(info, "Nhân viên", "Nhập họ tên, vd: Trần Văn Nam", p.employee);
        employee.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS
                | InputType.TYPE_TEXT_VARIATION_PERSON_NAME);
        final EditText team = pickInput(info, "Đội", "vd: Đội Cấp nước số 5", p.team, "Chọn đội", TEAMS);
        final EditText equipment = pickInput(info, "Thiết bị (không bắt buộc)", "vd: Đồng hồ nước khách hàng",
                p.equipment, "Chọn thiết bị", EQUIPMENT);
        final EditText workplace = input(info, "Nơi làm việc (không bắt buộc)", "vd: Khu vực Châu Thành", p.workplace);
        final EditText note = input(info, "Nội dung công việc (không bắt buộc)", "vd: Lắp đặt đồng hồ nước", p.note);
        final EditText company = input(info, "Tên đơn vị trên băng rôn", "HAWASUCO", p.company);
        note(info, "Nhân viên và đội được lưu trong máy: lần sau mở app, cài bản cập nhật "
                + "đều tự dùng lại, không cần nhập lại.");

        LinearLayout addrCard = card(box, "Địa chỉ trên ảnh");
        final RadioGroup addr = radios(addrCard, new String[]{
                "Tự động – đầy đủ (ấp, xã, huyện, tỉnh)", "Tự động – rút gọn (huyện, tỉnh)", "Tự nhập"}, p.addressMode);
        final EditText manual = input(addrCard, "Địa chỉ tự nhập", "vd: Ấp Phú Lợi, Châu Thành, Cần Thơ", p.manualAddress);
        manual.setEnabled(p.addressMode == Prefs.ADDR_MANUAL);
        addr.setOnCheckedChangeListener(new RadioGroup.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(RadioGroup g, int id) {
                manual.setEnabled(checked(g) == Prefs.ADDR_MANUAL);
            }
        });

        LinearLayout show = card(box, "Hiển thị trên ảnh");
        final CheckBox cEmp = check(show, "Nhân viên", p.showEmployee);
        final CheckBox cTeam = check(show, "Đội", p.showTeam);
        final CheckBox cEquip = check(show, "Thiết bị", p.showEquipment);
        final CheckBox cAddr = check(show, "Địa chỉ", p.showAddress);
        final CheckBox cCoord = check(show, "Tọa độ GPS", p.showCoords);
        final CheckBox cMap = check(show, "Bản đồ vị trí", p.showMap);
        final CheckBox cWork = check(show, "Nơi làm việc", p.showWorkplace);
        final CheckBox cNote = check(show, "Nội dung công việc", p.showNote);
        final CheckBox cId = check(show, "Mã ảnh (chữ dọc mép phải)", p.showPhotoId);

        LinearLayout mapCard = card(box, "Kiểu bản đồ");
        final RadioGroup mapType = radios(mapCard, new String[]{"Vệ tinh", "Bản đồ đường phố"}, p.mapType);

        LinearLayout photo = card(box, "Ảnh chụp");
        final RadioGroup size = radios(photo, new String[]{
                "Ảnh lớn – nét nhất", "Ảnh vừa – nhẹ, gửi Zalo nhanh"}, p.photoSize);
        final CheckBox cOrig = check(photo, "Lưu thêm ảnh gốc (không watermark)", p.saveOriginal);
        final CheckBox cSound = check(photo, "Âm thanh khi chụp", p.shutterSound);

        TextView about = new TextView(c);
        about.setText("Ảnh lưu trong Thư viện ảnh, thư mục DCIM/HAWASUCO.\n"
                + "Chạm vào phần chữ trên khung ngắm để mở lại trang này. Phím âm lượng cũng dùng để chụp.\n"
                + "Phiên bản " + version(a));
        about.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        about.setTextColor(TEXT_SOFT);
        about.setLineSpacing(0, 1.15f);
        about.setPadding(dp(c, 6), dp(c, 4), dp(c, 6), dp(c, 16));
        box.addView(about);

        TextView saveBig = new TextView(c);
        saveBig.setText("LƯU");
        saveBig.setTextColor(Color.WHITE);
        saveBig.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        saveBig.setTypeface(Typeface.DEFAULT_BOLD);
        saveBig.setGravity(Gravity.CENTER);
        saveBig.setBackground(rounded(BLUE, 0, 0, 12, c));
        box.addView(saveBig, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(c, 54)));

        View.OnClickListener doSave = new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                p.employee = text(employee);
                p.team = text(team);
                p.equipment = text(equipment);
                p.workplace = text(workplace);
                p.note = text(note);
                p.company = text(company);
                p.addressMode = checked(addr);
                p.manualAddress = text(manual);
                p.showEmployee = cEmp.isChecked();
                p.showTeam = cTeam.isChecked();
                p.showEquipment = cEquip.isChecked();
                p.showAddress = cAddr.isChecked();
                p.showCoords = cCoord.isChecked();
                p.showMap = cMap.isChecked();
                p.showWorkplace = cWork.isChecked();
                p.showNote = cNote.isChecked();
                p.showPhotoId = cId.isChecked();
                p.mapType = checked(mapType);
                p.photoSize = checked(size);
                p.saveOriginal = cOrig.isChecked();
                p.shutterSound = cSound.isChecked();
                onSaved.run();
                dlg.dismiss();
                toast(a, "Đã lưu");
            }
        };
        save.setOnClickListener(doSave);
        saveBig.setOnClickListener(doSave);
        cancel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                dlg.dismiss();
            }
        });

        dlg.setContentView(root);
        if (dlg.getWindow() != null) {
            dlg.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
            dlg.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            dlg.getWindow().setStatusBarColor(0xFF154A75);
        }
        dlg.show();
    }

    private static TextView barButton(Context c, String label) {
        TextView t = new TextView(c);
        t.setText(label);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(c, 14), dp(c, 12), dp(c, 14), dp(c, 12));
        t.setClickable(true);
        TypedValue tv = new TypedValue();
        if (c.getTheme().resolveAttribute(android.R.attr.selectableItemBackground, tv, true)) {
            t.setBackgroundResource(tv.resourceId);
        }
        return t;
    }

    /** Khung trắng bo góc có tiêu đề; trả về phần thân để thêm ô nhập. */
    private static LinearLayout card(LinearLayout parent, String title) {
        Context c = parent.getContext();
        LinearLayout card = new LinearLayout(c);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rounded(Color.WHITE, 0, 0, 14, c));
        card.setElevation(dp(c, 1.5f));
        card.setPadding(dp(c, 16), dp(c, 14), dp(c, 16), dp(c, 16));
        TextView t = new TextView(c);
        t.setText(title);
        t.setTextColor(BLUE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(t);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(c, 12);
        parent.addView(card, lp);
        return card;
    }

    private static void label(LinearLayout parent, String text) {
        Context c = parent.getContext();
        TextView t = new TextView(c);
        t.setText(text);
        t.setTextColor(TEXT);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        t.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        t.setPadding(dp(c, 2), dp(c, 14), 0, dp(c, 6));
        parent.addView(t);
    }

    private static void note(LinearLayout parent, String text) {
        Context c = parent.getContext();
        TextView t = new TextView(c);
        t.setText(text);
        t.setTextColor(TEXT_SOFT);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        t.setLineSpacing(0, 1.15f);
        t.setPadding(dp(c, 2), dp(c, 12), 0, 0);
        parent.addView(t);
    }

    /** Ô nhập chữ to, có viền rõ (viền xanh khi đang nhập). */
    private static EditText input(LinearLayout parent, String label, String hint, String value) {
        label(parent, label);
        EditText e = editText(parent.getContext(), hint, value);
        parent.addView(e, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private static EditText editText(Context c, String hint, String value) {
        EditText e = new EditText(c);
        e.setHint(hint);
        e.setText(value);
        e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        e.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        e.setTextColor(TEXT);
        e.setHintTextColor(0xFF98A6B4);
        e.setPadding(dp(c, 14), dp(c, 12), dp(c, 14), dp(c, 12));
        StateListDrawable bg = new StateListDrawable();
        bg.addState(new int[]{android.R.attr.state_focused}, rounded(Color.WHITE, BLUE, 2, 10, c));
        bg.addState(new int[]{-android.R.attr.state_enabled}, rounded(0xFFF1F4F7, 0xFFD3DBE3, 1.5f, 10, c));
        bg.addState(new int[]{}, rounded(Color.WHITE, 0xFFAEBBC8, 1.5f, 10, c));
        e.setBackground(bg);
        return e;
    }

    /** Ô nhập kèm nút "Chọn ▾": gõ tay hoặc chọn nhanh từ danh sách (đội, thiết bị). */
    private static EditText pickInput(LinearLayout parent, String label, String hint, String value,
                                      final String title, final String[] options) {
        final Context c = parent.getContext();
        label(parent, label);
        LinearLayout row = new LinearLayout(c);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        final EditText e = editText(c, hint, value);
        row.addView(e, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView pick = new TextView(c);
        pick.setText("Chọn ▾");
        pick.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        pick.setTypeface(Typeface.DEFAULT_BOLD);
        pick.setTextColor(Color.WHITE);
        pick.setGravity(Gravity.CENTER);
        pick.setBackground(rounded(BLUE, 0, 0, 10, c));
        pick.setPadding(dp(c, 14), 0, dp(c, 14), 0);
        pick.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                new AlertDialog.Builder(c, android.R.style.Theme_Material_Light_Dialog_Alert)
                        .setTitle(title)
                        .setItems(options, new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface di, int which) {
                                e.setText(options[which]);
                                e.setSelection(e.length());
                            }
                        })
                        .show();
            }
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(c, 50));
        lp.leftMargin = dp(c, 8);
        row.addView(pick, lp);
        parent.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private static CheckBox check(LinearLayout parent, String label, boolean value) {
        Context c = parent.getContext();
        CheckBox b = new CheckBox(c);
        b.setText(label);
        b.setChecked(value);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        b.setTextColor(TEXT);
        b.setButtonTintList(ColorStateList.valueOf(BLUE));
        b.setMinHeight(dp(c, 46));
        b.setPadding(dp(c, 6), 0, 0, 0);
        parent.addView(b);
        return b;
    }

    private static RadioGroup radios(LinearLayout parent, String[] labels, int selected) {
        Context c = parent.getContext();
        RadioGroup g = new RadioGroup(c);
        g.setOrientation(RadioGroup.VERTICAL);
        g.setPadding(0, dp(c, 4), 0, 0);
        for (int i = 0; i < labels.length; i++) {
            RadioButton b = new RadioButton(c);
            b.setId(View.generateViewId());
            b.setText(labels[i]);
            b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            b.setTextColor(TEXT);
            b.setButtonTintList(ColorStateList.valueOf(BLUE));
            b.setMinHeight(dp(c, 46));
            b.setPadding(dp(c, 6), 0, 0, 0);
            g.addView(b);
            if (i == selected) g.check(b.getId());
        }
        if (g.getCheckedRadioButtonId() == View.NO_ID && g.getChildCount() > 0) g.check(g.getChildAt(0).getId());
        parent.addView(g);
        return g;
    }

    private static GradientDrawable rounded(int fill, int stroke, float strokeDp, float radiusDp, Context c) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(c, radiusDp));
        if (strokeDp > 0) g.setStroke(dp(c, strokeDp), stroke);
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
