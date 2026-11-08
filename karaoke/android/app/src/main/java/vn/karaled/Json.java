package vn.karaled;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Đọc / ghi JSON gọn nhẹ: Map (object), List (array), String, Long/Double, Boolean, null. */
final class Json {
    private Json() {}

    static Object parse(String s) {
        Parser p = new Parser(s);
        p.ws();
        Object v = p.value();
        p.ws();
        if (p.i != s.length()) throw new IllegalArgumentException("JSON thừa ký tự ở vị trí " + p.i);
        return v;
    }

    static String stringify(Object o) {
        StringBuilder sb = new StringBuilder();
        write(sb, o, 0, 0);
        return sb.toString();
    }

    static String stringify(Object o, int indent) {
        StringBuilder sb = new StringBuilder();
        write(sb, o, indent, 0);
        return sb.toString();
    }

    private static void nl(StringBuilder sb, int indent, int level) {
        if (indent <= 0) return;
        sb.append('\n');
        for (int i = 0; i < indent * level; i++) sb.append(' ');
    }

    @SuppressWarnings("unchecked")
    private static void write(StringBuilder sb, Object o, int indent, int level) {
        if (o == null) {
            sb.append("null");
        } else if (o instanceof String) {
            quote(sb, (String) o);
        } else if (o instanceof Boolean) {
            sb.append(((Boolean) o) ? "true" : "false");
        } else if (o instanceof Double || o instanceof Float) {
            double d = ((Number) o).doubleValue();
            if (Double.isNaN(d) || Double.isInfinite(d)) sb.append("null");
            else if (d == Math.rint(d) && Math.abs(d) < 1e15) sb.append((long) d);
            else sb.append(d);
        } else if (o instanceof Number) {
            sb.append(((Number) o).longValue());
        } else if (o instanceof Map) {
            Map<String, Object> m = (Map<String, Object>) o;
            sb.append('{');
            boolean first = true;
            for (Map.Entry<String, Object> e : m.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                nl(sb, indent, level + 1);
                quote(sb, e.getKey());
                sb.append(indent > 0 ? ": " : ":");
                write(sb, e.getValue(), indent, level + 1);
            }
            if (!first) nl(sb, indent, level);
            sb.append('}');
        } else if (o instanceof List) {
            List<Object> l = (List<Object>) o;
            sb.append('[');
            boolean first = true;
            for (Object v : l) {
                if (!first) sb.append(',');
                first = false;
                nl(sb, indent, level + 1);
                write(sb, v, indent, level + 1);
            }
            if (!first) nl(sb, indent, level);
            sb.append(']');
        } else {
            quote(sb, String.valueOf(o));
        }
    }

    static void quote(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                default:
                    if (c < 0x20 || c == ' ' || c == ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
    }

    private static final class Parser {
        final String s;
        int i;

        Parser(String s) { this.s = s; }

        void ws() {
            while (i < s.length()) {
                char c = s.charAt(i);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == (char) 0xFEFF) i++;
                else break;
            }
        }

        IllegalArgumentException err(String m) {
            return new IllegalArgumentException("JSON không hợp lệ: " + m + " ở vị trí " + i);
        }

        Object value() {
            if (i >= s.length()) throw err("hết dữ liệu");
            char c = s.charAt(i);
            if (c == '{') return object();
            if (c == '[') return array();
            if (c == '"') return string();
            if (c == 't' && s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (c == 'f' && s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (c == 'n' && s.startsWith("null", i)) { i += 4; return null; }
            if (c == '-' || (c >= '0' && c <= '9')) return number();
            throw err("ký tự lạ '" + c + "'");
        }

        Map<String, Object> object() {
            Map<String, Object> m = new LinkedHashMap<>();
            i++;
            ws();
            if (i < s.length() && s.charAt(i) == '}') { i++; return m; }
            while (true) {
                ws();
                if (i >= s.length() || s.charAt(i) != '"') throw err("cần tên trường");
                String k = string();
                ws();
                if (i >= s.length() || s.charAt(i) != ':') throw err("cần dấu :");
                i++;
                ws();
                m.put(k, value());
                ws();
                if (i >= s.length()) throw err("hết dữ liệu");
                char c = s.charAt(i++);
                if (c == '}') return m;
                if (c != ',') throw err("cần dấu ,");
            }
        }

        List<Object> array() {
            List<Object> l = new ArrayList<>();
            i++;
            ws();
            if (i < s.length() && s.charAt(i) == ']') { i++; return l; }
            while (true) {
                ws();
                l.add(value());
                ws();
                if (i >= s.length()) throw err("hết dữ liệu");
                char c = s.charAt(i++);
                if (c == ']') return l;
                if (c != ',') throw err("cần dấu ,");
            }
        }

        String string() {
            i++;
            StringBuilder sb = new StringBuilder();
            while (true) {
                if (i >= s.length()) throw err("chuỗi chưa đóng");
                char c = s.charAt(i++);
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                if (i >= s.length()) throw err("chuỗi chưa đóng");
                char e = s.charAt(i++);
                switch (e) {
                    case '"': sb.append('"'); break;
                    case '\\': sb.append('\\'); break;
                    case '/': sb.append('/'); break;
                    case 'b': sb.append('\b'); break;
                    case 'f': sb.append('\f'); break;
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    case 't': sb.append('\t'); break;
                    case 'u':
                        if (i + 4 > s.length()) throw err("\\u thiếu ký tự");
                        sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                        i += 4;
                        break;
                    default: throw err("ký tự thoát lạ");
                }
            }
        }

        Object number() {
            int start = i;
            if (s.charAt(i) == '-') i++;
            boolean frac = false;
            while (i < s.length()) {
                char c = s.charAt(i);
                if (c >= '0' && c <= '9') i++;
                else if (c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') { frac = true; i++; }
                else break;
            }
            String t = s.substring(start, i);
            try {
                if (!frac && t.length() < 18) return Long.parseLong(t);
                return Double.parseDouble(t);
            } catch (NumberFormatException e) {
                throw err("số không hợp lệ");
            }
        }
    }

    /* ---- Tiện ích đọc giá trị kiểu JavaScript ---- */

    @SuppressWarnings("unchecked")
    static Map<String, Object> map(Object o) {
        return o instanceof Map ? (Map<String, Object>) o : new LinkedHashMap<String, Object>();
    }

    @SuppressWarnings("unchecked")
    static List<Object> list(Object o) {
        return o instanceof List ? (List<Object>) o : new ArrayList<Object>();
    }

    static String str(Object o) {
        if (o == null) return "";
        if (o instanceof String) return (String) o;
        if (o instanceof Double) {
            double d = (Double) o;
            if (d == Math.rint(d) && Math.abs(d) < 1e15) return String.valueOf((long) d);
        }
        return String.valueOf(o);
    }

    static double num(Object o, double def) {
        if (o instanceof Number) {
            double d = ((Number) o).doubleValue();
            return Double.isNaN(d) ? def : d;
        }
        if (o instanceof String) {
            try { return Double.parseDouble(((String) o).trim()); } catch (NumberFormatException e) { return def; }
        }
        if (o instanceof Boolean) return ((Boolean) o) ? 1 : 0;
        return def;
    }

    /** Giống parseInt của JavaScript: lấy phần số nguyên ở đầu, không có thì trả def. */
    static long parseInt(Object o, long def) {
        if (o instanceof Number) {
            double d = ((Number) o).doubleValue();
            return Double.isNaN(d) || Double.isInfinite(d) ? def : (long) d;
        }
        String s = str(o).trim();
        int j = 0;
        if (j < s.length() && (s.charAt(j) == '-' || s.charAt(j) == '+')) j++;
        int k = j;
        while (k < s.length() && Character.isDigit(s.charAt(k))) k++;
        if (k == j) return def;
        try { return Long.parseLong(s.substring(0, k)); } catch (NumberFormatException e) { return def; }
    }

    /** Giá trị "đúng" theo JavaScript (!!x). */
    static boolean truthy(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean) return (Boolean) o;
        if (o instanceof Number) {
            double d = ((Number) o).doubleValue();
            return d != 0 && !Double.isNaN(d);
        }
        if (o instanceof String) return !((String) o).isEmpty();
        return true;
    }

    @SuppressWarnings("unchecked")
    static Object deepCopy(Object o) {
        if (o instanceof Map) {
            Map<String, Object> m = new LinkedHashMap<>();
            for (Map.Entry<String, Object> e : ((Map<String, Object>) o).entrySet()) m.put(e.getKey(), deepCopy(e.getValue()));
            return m;
        }
        if (o instanceof List) {
            List<Object> l = new ArrayList<>();
            for (Iterator<Object> it = ((List<Object>) o).iterator(); it.hasNext(); ) l.add(deepCopy(it.next()));
            return l;
        }
        return o;
    }
}
