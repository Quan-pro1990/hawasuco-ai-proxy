package vn.hawasuco.camera;

import android.content.Context;
import android.location.Address;
import android.location.Geocoder;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Tra địa chỉ từ tọa độ: dùng Geocoder của máy (Google), không được thì dùng OpenStreetMap (Nominatim).
 * Kết quả: {địa chỉ đầy đủ, địa chỉ rút gọn "Huyện, Tỉnh"}.
 */
final class AddressLookup {
    private static final Locale VI = new Locale("vi", "VN");
    private static final String[] PREFIXES = {
            "Thành phố ", "Thành Phố ", "Tỉnh ", "Huyện ", "Quận ", "Thị xã ", "Thị Xã ",
            "Thị trấn ", "Thị Trấn ", "Phường ", "Xã ", "TP. ", "TP ", "Tp. "};

    private AddressLookup() {
    }

    static String[] lookup(Context ctx, double lat, double lon) {
        String[] r = null;
        if (Geocoder.isPresent()) {
            try {
                r = fromGeocoder(ctx, lat, lon);
            } catch (Exception e) {
                r = null;
            }
        }
        if (r == null) {
            try {
                r = fromNominatim(lat, lon);
            } catch (Exception e) {
                r = null;
            }
        }
        return r;
    }

    private static String[] fromGeocoder(Context ctx, double lat, double lon) throws Exception {
        List<Address> list = new Geocoder(ctx, VI).getFromLocation(lat, lon, 1);
        if (list == null || list.isEmpty()) return null;
        Address a = list.get(0);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i <= a.getMaxAddressLineIndex(); i++) {
            String l = a.getAddressLine(i);
            if (l == null || l.trim().isEmpty()) continue;
            if (sb.length() > 0) sb.append(", ");
            sb.append(l.trim());
        }
        String full = clean(sb.toString());
        String brief = joinShort(first(a.getSubAdminArea(), a.getLocality(), a.getSubLocality()), a.getAdminArea());
        return result(full, brief);
    }

    private static String[] fromNominatim(double lat, double lon) throws Exception {
        String url = String.format(Locale.US,
                "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=%.6f&lon=%.6f&zoom=18&addressdetails=1&accept-language=vi",
                lat, lon);
        JSONObject o = new JSONObject(new String(Net.get(url, 10000), "UTF-8"));
        JSONObject a = o.optJSONObject("address");
        if (a == null) return null;
        String street = (a.optString("house_number", "") + " " + a.optString("road", "")).trim();
        String ward = firstOf(a, "quarter", "suburb", "village", "hamlet", "neighbourhood");
        String district = firstOf(a, "city_district", "county", "district", "town", "municipality");
        String province = firstOf(a, "city", "state", "province");
        String full = clean(join(street, ward, district, province));
        String brief = joinShort(first(district, ward), province);
        return result(full, brief);
    }

    private static String[] result(String full, String brief) {
        if (full.isEmpty()) full = brief;
        if (brief.isEmpty()) brief = full;
        if (full.isEmpty()) return null;
        return new String[]{full, brief};
    }

    /** Bỏ mã Plus Code đầu chuỗi, mã bưu chính, chữ "Việt Nam" cuối và các phần lặp. */
    static String clean(String s) {
        s = s.replaceAll("^[23456789CFGHJMPQRVWX]{4,8}\\+[23456789CFGHJMPQRVWX]{0,3}[ ,]*", "");
        s = s.replaceAll("\\s+\\d{5,6}(?=\\s*,|\\s*$)", "");
        s = s.replaceAll(",?\\s*(Việt Nam|Viet Nam|Vietnam)\\s*$", "");
        List<String> parts = new ArrayList<String>();
        for (String part : s.split(",")) {
            String t = part.trim().replaceAll("\\s{2,}", " ");
            if (t.isEmpty()) continue;
            if (!parts.isEmpty() && parts.get(parts.size() - 1).equalsIgnoreCase(t)) continue;
            parts.add(t);
        }
        return join(parts.toArray(new String[0]));
    }

    private static String joinShort(String area, String province) {
        String a = stripPrefix(area), b = stripPrefix(province);
        if (a.equalsIgnoreCase(b)) return a;
        return join(a, b);
    }

    private static String stripPrefix(String s) {
        if (s == null) return "";
        s = s.trim();
        for (String p : PREFIXES) {
            if (s.startsWith(p) && s.length() > p.length()) return s.substring(p.length()).trim();
        }
        return s;
    }

    private static String join(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.trim().isEmpty()) continue;
            if (sb.length() > 0) sb.append(", ");
            sb.append(p.trim());
        }
        return sb.toString();
    }

    private static String first(String... values) {
        for (String v : values) if (v != null && !v.trim().isEmpty()) return v.trim();
        return "";
    }

    private static String firstOf(JSONObject o, String... keys) {
        for (String k : keys) {
            String v = o.optString(k, "");
            if (!v.trim().isEmpty()) return v.trim();
        }
        return "";
    }
}
