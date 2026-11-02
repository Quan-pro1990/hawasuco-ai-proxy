package vn.hawasuco.camera;

/** Dữ liệu in lên ảnh tại một thời điểm (giờ, vị trí, địa chỉ, hướng, bản đồ). */
final class StampData {
    long time;
    boolean hasLocation;
    double lat, lon;
    float accuracy = -1;
    boolean hasAltitude;
    double altitude;
    String addressFull;
    String addressShort;
    /** Hướng camera, độ so với phương Bắc; NaN nếu máy không có cảm biến. */
    float heading = Float.NaN;
    MapTiles.MapImage map;
    String photoId;
}
