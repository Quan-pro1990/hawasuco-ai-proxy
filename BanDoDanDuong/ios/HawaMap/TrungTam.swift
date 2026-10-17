import CoreLocation
import Foundation

/// Nối trang trên iPhone và trang trên CarPlay: chuyển vị trí GPS, chỉ đọc giọng nói từ một nơi,
/// bắt đầu / kết thúc dẫn đường ở màn hình này thì màn hình kia làm theo. Chạy trên luồng chính.
final class TrungTam {
    static let chung = TrungTam()

    private(set) weak var dienThoai: TrangWeb?
    private(set) weak var xe: TrangWeb?

    /// Bộ điều khiển CarPlay nhận tin từ trang trên xe.
    var ngheXe: ((String, [String: Any]) -> Void)?
    /// Màn hình iPhone nhận tin từ trang trên điện thoại (giữ sáng màn hình, lưu tệp…).
    var ngheDienThoai: ((String, [String: Any]) -> Void)?

    /// Tuyến đang dẫn (tin "batDau" gần nhất, dạng JSON) để chuyển cho màn hình mở sau.
    private var phien: String?
    private(set) var dangDanDuong = false
    private var maNghe: [ObjectIdentifier: UUID] = [:]

    var mayChuBaoCao: String { Bundle.main.object(forInfoDictionaryKey: "HawaMapMayChuBaoCao") as? String ?? "" }

    func cauHinh(_ vaiTro: VaiTro) -> [String: Any] {
        // CarPlay: thẻ chỉ hướng ở bên trái nên đồng hồ tốc độ đặt bên phải
        ["vaiTro": vaiTro.rawValue, "nenTang": "ios", "hud": vaiTro == .xe ? "phai" : "trai", "mayChuBaoCao": mayChuBaoCao]
    }

    func dangKy(_ t: TrangWeb) {
        if t.vaiTro == .xe { xe = t } else { dienThoai = t }
        maNghe[ObjectIdentifier(t)] = NguonViTri.chung.them { [weak t] l in t?.viTri(l) }
    }

    func huyDangKy(_ t: TrangWeb) {
        if xe === t { xe = nil }
        if dienThoai === t { dienThoai = nil }
        if let m = maNghe.removeValue(forKey: ObjectIdentifier(t)) { NguonViTri.chung.bo(m) }
    }

    private func khac(_ t: TrangWeb) -> TrangWeb? { t.vaiTro == .xe ? dienThoai : xe }

    /// CarPlay đang kết nối thì chỉ đọc câu từ trang trên xe, tránh đọc hai lần.
    private func laNguonGiongNoi(_ t: TrangWeb) -> Bool { t.vaiTro == .xe || xe == nil }

    func nhan(_ tu: TrangWeb, _ loai: String, _ du: [String: Any]) {
        switch loai {
        case "sanSang":
            if let l = NguonViTri.chung.cuoi { tu.viTri(l) }
            if dangDanDuong, let p = phien { tu.goi("hawamap.goc.dongBoBatDau(\(TrangWeb.json(p)))") }
            bao(tu, loai, du)
        case "noi":
            if laNguonGiongNoi(tu) {
                GiongNoi.chung.noi(
                    du["chu"] as? String ?? "", chen: du["chen"] as? Bool ?? false,
                    amLuong: (du["amLuong"] as? NSNumber)?.floatValue ?? 1, toc: (du["toc"] as? NSNumber)?.floatValue ?? 1
                )
            }
        case "imLang":
            if laNguonGiongNoi(tu) { GiongNoi.chung.imLang() }
        case "batDau":
            guard let d = try? JSONSerialization.data(withJSONObject: du), let s = String(data: d, encoding: .utf8) else { return }
            phien = s
            dangDanDuong = true
            khac(tu)?.goi("hawamap.goc.dongBoBatDau(\(TrangWeb.json(s)))")
        case "ketThuc":
            phien = nil
            dangDanDuong = false
            khac(tu)?.goi("hawamap.goc.dongBoKetThuc()")
        default:
            bao(tu, loai, du)
        }
    }

    private func bao(_ tu: TrangWeb, _ loai: String, _ du: [String: Any]) {
        if tu.vaiTro == .xe { ngheXe?(loai, du) } else { ngheDienThoai?(loai, du) }
    }
}
