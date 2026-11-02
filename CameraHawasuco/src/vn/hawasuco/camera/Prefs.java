package vn.hawasuco.camera;

import android.content.Context;
import android.content.SharedPreferences;

/** Cài đặt của người dùng, lưu trong SharedPreferences. */
final class Prefs {
    static final int ADDR_FULL = 0, ADDR_SHORT = 1, ADDR_MANUAL = 2;
    static final int MAP_SATELLITE = 0, MAP_STREET = 1;
    static final int SIZE_LARGE = 0, SIZE_MEDIUM = 1;
    static final int FLASH_OFF = 0, FLASH_AUTO = 1, FLASH_ON = 2;

    private static final String FILE = "caidat";

    String company = "HAWASUCO";
    String employee = "";
    String team = "";
    String workplace = "";
    String note = "";
    int addressMode = ADDR_FULL;
    String manualAddress = "";
    boolean showMap = true;
    boolean showAddress = true;
    boolean showCoords = true;
    boolean showEmployee = true;
    boolean showTeam = true;
    boolean showWorkplace = true;
    boolean showNote = true;
    boolean showPhotoId = true;
    int mapType = MAP_SATELLITE;
    int photoSize = SIZE_LARGE;
    boolean saveOriginal;
    boolean shutterSound = true;
    int flashMode = FLASH_OFF;
    boolean frontCamera;
    String lastPhoto = "";
    boolean introShown;

    static Prefs load(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE);
        Prefs p = new Prefs();
        p.company = sp.getString("company", p.company);
        p.employee = sp.getString("employee", p.employee);
        p.team = sp.getString("team", p.team);
        p.workplace = sp.getString("workplace", p.workplace);
        p.note = sp.getString("note", p.note);
        p.addressMode = sp.getInt("addressMode", p.addressMode);
        p.manualAddress = sp.getString("manualAddress", p.manualAddress);
        p.showMap = sp.getBoolean("showMap", p.showMap);
        p.showAddress = sp.getBoolean("showAddress", p.showAddress);
        p.showCoords = sp.getBoolean("showCoords", p.showCoords);
        p.showEmployee = sp.getBoolean("showEmployee", p.showEmployee);
        p.showTeam = sp.getBoolean("showTeam", p.showTeam);
        p.showWorkplace = sp.getBoolean("showWorkplace", p.showWorkplace);
        p.showNote = sp.getBoolean("showNote", p.showNote);
        p.showPhotoId = sp.getBoolean("showPhotoId", p.showPhotoId);
        p.mapType = sp.getInt("mapType", p.mapType);
        p.photoSize = sp.getInt("photoSize", p.photoSize);
        p.saveOriginal = sp.getBoolean("saveOriginal", p.saveOriginal);
        p.shutterSound = sp.getBoolean("shutterSound", p.shutterSound);
        p.flashMode = sp.getInt("flashMode", p.flashMode);
        p.frontCamera = sp.getBoolean("frontCamera", p.frontCamera);
        p.lastPhoto = sp.getString("lastPhoto", p.lastPhoto);
        p.introShown = sp.getBoolean("introShown", p.introShown);
        // Bản 1.0 chưa có ô "Đội": ai đã gõ đội vào ô "Nơi làm việc" thì chuyển sang ô "Đội".
        String wp = p.workplace.trim().toLowerCase(java.util.Locale.ROOT);
        if (!sp.contains("team") && (wp.startsWith("đội") || wp.startsWith("doi "))) {
            p.team = p.workplace.trim();
            p.workplace = "";
        }
        return p;
    }

    void save(Context ctx) {
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
                .putString("company", company)
                .putString("employee", employee)
                .putString("team", team)
                .putString("workplace", workplace)
                .putString("note", note)
                .putInt("addressMode", addressMode)
                .putString("manualAddress", manualAddress)
                .putBoolean("showMap", showMap)
                .putBoolean("showAddress", showAddress)
                .putBoolean("showCoords", showCoords)
                .putBoolean("showEmployee", showEmployee)
                .putBoolean("showTeam", showTeam)
                .putBoolean("showWorkplace", showWorkplace)
                .putBoolean("showNote", showNote)
                .putBoolean("showPhotoId", showPhotoId)
                .putInt("mapType", mapType)
                .putInt("photoSize", photoSize)
                .putBoolean("saveOriginal", saveOriginal)
                .putBoolean("shutterSound", shutterSound)
                .putInt("flashMode", flashMode)
                .putBoolean("frontCamera", frontCamera)
                .putString("lastPhoto", lastPhoto)
                .putBoolean("introShown", introShown)
                .apply();
    }

    /** Bản sao để luồng lưu ảnh dùng, không bị thay đổi khi người dùng sửa cài đặt. */
    Prefs copy() {
        Prefs p = new Prefs();
        p.company = company;
        p.employee = employee;
        p.team = team;
        p.workplace = workplace;
        p.note = note;
        p.addressMode = addressMode;
        p.manualAddress = manualAddress;
        p.showMap = showMap;
        p.showAddress = showAddress;
        p.showCoords = showCoords;
        p.showEmployee = showEmployee;
        p.showTeam = showTeam;
        p.showWorkplace = showWorkplace;
        p.showNote = showNote;
        p.showPhotoId = showPhotoId;
        p.mapType = mapType;
        p.photoSize = photoSize;
        p.saveOriginal = saveOriginal;
        p.shutterSound = shutterSound;
        p.flashMode = flashMode;
        p.frontCamera = frontCamera;
        p.lastPhoto = lastPhoto;
        p.introShown = introShown;
        return p;
    }
}
