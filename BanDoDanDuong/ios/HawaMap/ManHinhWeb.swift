import UIKit
import WebKit

/// Màn hình chứa một trang HawaMap: toàn bộ giao diện trên iPhone, hoặc bản đồ nền trên CarPlay.
final class ManHinhWeb: UIViewController, WKUIDelegate {
    let trang: TrangWeb
    /// Gọi khi vùng an toàn thay đổi (CarPlay dùng để báo cho trang phần màn hình bị che).
    var khiDoiLe: ((UIEdgeInsets) -> Void)?

    init(vaiTro: VaiTro) {
        trang = TrangWeb(vaiTro: vaiTro)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Không dùng storyboard") }

    override func loadView() {
        view = trang.webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        trang.webView.uiDelegate = self
        TrungTam.chung.dangKy(trang)
        trang.tai()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        khiDoiLe?(view.safeAreaInsets)
    }

    deinit {
        TrungTam.chung.huyDangKy(trang)
        trang.huy()
    }

    /// Camera hành trình trong trang (getUserMedia): iOS đã hỏi quyền camera của ứng dụng.
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    /// Tin từ trang trên iPhone.
    func xuLyTin(_ loai: String, _ du: [String: Any]) {
        switch loai {
        case "giuManHinh":
            UIApplication.shared.isIdleTimerDisabled = du["bat"] as? Bool ?? false
        case "luuTep":
            guard let ten = du["ten"] as? String, let b64 = du["base64"] as? String, let duLieu = Data(base64Encoded: b64) else { return }
            let tep = FileManager.default.temporaryDirectory.appendingPathComponent(ten.replacingOccurrences(of: "/", with: "_"))
            guard (try? duLieu.write(to: tep)) != nil else { return }
            let chiaSe = UIActivityViewController(activityItems: [tep], applicationActivities: nil)
            chiaSe.popoverPresentationController?.sourceView = view
            present(chiaSe, animated: true)
        default:
            break
        }
    }
}
