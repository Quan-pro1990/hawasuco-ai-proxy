import CoreLocation
import UIKit
import WebKit

/// Trang HawaMap đang chạy trên màn hình nào.
enum VaiTro: String {
    case dienThoai = "dienthoai"
    case xe = "xe"
}

/// Phục vụ thư mục `public/` đóng gói trong ứng dụng qua địa chỉ hawamap://app/…
final class BoXuLyTep: NSObject, WKURLSchemeHandler {
    private let goc: URL

    init(goc: URL) {
        self.goc = goc.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        var duong = url.path
        if duong.isEmpty || duong == "/" { duong = "/index.html" }
        let tep = goc.appendingPathComponent(String(duong.dropFirst())).standardizedFileURL
        guard tep.path.hasPrefix(goc.path + "/"), let du = try? Data(contentsOf: tep) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        let dau = [
            "Content-Type": BoXuLyTep.kieu(tep.pathExtension),
            "Content-Length": String(du.count),
            "Cache-Control": "no-cache"
        ]
        guard let phanHoi = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: dau) else { return }
        urlSchemeTask.didReceive(phanHoi)
        urlSchemeTask.didReceive(du)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    static func kieu(_ duoi: String) -> String {
        switch duoi.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        default: return "application/octet-stream"
        }
    }
}

/// Nhận tin từ JavaScript (window.webkit.messageHandlers.hawamap). Giữ tham chiếu yếu để không giữ vòng TrangWeb.
private final class CauJs: NSObject, WKScriptMessageHandler {
    weak var trang: TrangWeb?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let than = message.body as? [String: Any], let loai = than["loai"] as? String else { return }
        trang?.nhan(loai: loai, du: than["du"] as? [String: Any] ?? [:])
    }
}

/// Một trang HawaMap trong WKWebView, cùng cầu nối JavaScript ↔ Swift (xem public/js/cau-noi.js).
final class TrangWeb: NSObject {
    let webView: WKWebView
    let vaiTro: VaiTro
    private(set) var sanSang = false
    private var hangDoi: [String] = []
    private var choTraLoi: [Int: (Any?, String?) -> Void] = [:]
    private var maLenh = 0
    private let cau: CauJs

    init(vaiTro: VaiTro) {
        self.vaiTro = vaiTro
        let cau = CauJs()
        self.cau = cau
        let cfg = WKWebViewConfiguration()
        let goc = Bundle.main.resourceURL!.appendingPathComponent("public", isDirectory: true)
        cfg.setURLSchemeHandler(BoXuLyTep(goc: goc), forURLScheme: "hawamap")
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let cauHinh = TrangWeb.json(TrungTam.chung.cauHinh(vaiTro))
        cfg.userContentController.addUserScript(
            WKUserScript(source: "window.HAWAMAP_GOC=\(cauHinh);", injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )
        cfg.userContentController.add(cau, name: "hawamap")
        // cấu hình trên biến cục bộ: chưa được đọc thuộc tính của self trước super.init()
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.scrollView.bounces = false
        wv.backgroundColor = UIColor(red: 0.93, green: 0.95, blue: 0.96, alpha: 1)
        webView = wv
        super.init()
        cau.trang = self
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
    }

    func tai() {
        sanSang = false
        let diaChi = "hawamap://app/index.html" + (vaiTro == .xe ? "?xe=1" : "")
        webView.load(URLRequest(url: URL(string: diaChi)!))
    }

    /// Chạy đoạn JavaScript; trang chưa sẵn sàng thì xếp hàng chờ.
    func goi(_ js: String) {
        if sanSang { webView.evaluateJavaScript(js, completionHandler: nil) } else { hangDoi.append(js) }
    }

    /// Gửi lệnh tới trang (LENH_GOC trong main.js); traLoi(kếtQuả, lỗi) chạy trên luồng chính.
    func lenh(_ ten: String, _ thamSo: [String: Any] = [:], traLoi: ((Any?, String?) -> Void)? = nil) {
        maLenh += 1
        let id = maLenh
        if let traLoi = traLoi { choTraLoi[id] = traLoi }
        goi("window.hawamap&&hawamap.goc.lenh(\(id),\(TrangWeb.json(ten)),\(TrangWeb.json(thamSo)))")
    }

    func viTri(_ l: CLLocation) {
        let tocDo = l.speed >= 0 ? String(l.speed) : "null"
        let huong = l.course >= 0 ? String(l.course) : "null"
        let thoiGian = Int64(l.timestamp.timeIntervalSince1970 * 1000)
        goi("window.hawamap&&hawamap.goc.viTri(\(l.coordinate.longitude),\(l.coordinate.latitude),\(tocDo),\(huong),\(l.horizontalAccuracy),\(thoiGian))")
    }

    fileprivate func nhan(loai: String, du: [String: Any]) {
        switch loai {
        case "sanSang":
            sanSang = true
            let ds = hangDoi
            hangDoi.removeAll()
            ds.forEach { webView.evaluateJavaScript($0, completionHandler: nil) }
            TrungTam.chung.nhan(self, loai, du)
        case "traLoi":
            guard let id = (du["id"] as? NSNumber)?.intValue, let f = choTraLoi.removeValue(forKey: id) else { return }
            if let loi = du["loi"] as? String { f(nil, loi) } else { f(du["ketQua"] is NSNull ? nil : du["ketQua"], nil) }
        default:
            TrungTam.chung.nhan(self, loai, du)
        }
    }

    func huy() {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "hawamap")
        choTraLoi.removeAll()
        hangDoi.removeAll()
    }

    /// Giá trị Swift → chuỗi JSON để chèn vào JavaScript.
    static func json(_ v: Any) -> String {
        if let s = v as? String {
            guard let d = try? JSONSerialization.data(withJSONObject: s, options: .fragmentsAllowed) else { return "\"\"" }
            return String(data: d, encoding: .utf8) ?? "\"\""
        }
        guard JSONSerialization.isValidJSONObject(v), let d = try? JSONSerialization.data(withJSONObject: v) else { return "null" }
        return String(data: d, encoding: .utf8) ?? "null"
    }
}
