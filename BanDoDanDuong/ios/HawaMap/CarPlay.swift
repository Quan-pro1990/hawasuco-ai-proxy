import CarPlay
import MapKit
import UIKit

/// Điểm vào CarPlay (khai báo trong Info.plist, vai trò CPTemplateApplicationSceneSessionRoleApplication).
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var dieuKhien: DieuKhienCarPlay?

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController, to window: CPWindow) {
        dieuKhien = DieuKhienCarPlay(giaoDien: interfaceController, cuaSo: window)
    }

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene,
                                  didDisconnect interfaceController: CPInterfaceController, from window: CPWindow) {
        dieuKhien?.ngat()
        dieuKhien = nil
    }
}

/// Giao diện CarPlay: bản đồ HawaMap làm nền (WKWebView trong cửa sổ CarPlay), CPMapTemplate cho nút bấm,
/// xem trước tuyến, thẻ chỉ hướng; danh sách / tìm kiếm bằng mẫu của CarPlay.
final class DieuKhienCarPlay: NSObject, CPMapTemplateDelegate, CPSearchTemplateDelegate {
    private let giaoDien: CPInterfaceController
    private let cuaSo: CPWindow
    private let manHinh: ManHinhWeb
    private let banDo = CPMapTemplate()
    private var chuyenDi: CPTrip?
    private var phien: CPNavigationSession?
    private var thaoTacCuoi: String?
    private var canhBaoCuoi: String?
    private var ketQuaTim: [[String: Any]] = []

    init(giaoDien: CPInterfaceController, cuaSo: CPWindow) {
        self.giaoDien = giaoDien
        self.cuaSo = cuaSo
        manHinh = ManHinhWeb(vaiTro: .xe)
        super.init()
        cuaSo.rootViewController = manHinh
        manHinh.khiDoiLe = { [weak self] le in self?.guiLe(le) }
        banDo.mapDelegate = self
        banDo.guidanceBackgroundColor = UIColor(red: 0.04, green: 0.42, blue: 0.24, alpha: 1)
        banDo.tripEstimateStyle = .dark
        datNutBanDo()
        datNutChinh()
        TrungTam.chung.ngheXe = { [weak self] loai, du in self?.nhanTin(loai, du) }
        giaoDien.setRootTemplate(banDo, animated: false, completion: nil)
    }

    func ngat() {
        phien?.cancelTrip()
        phien = nil
        TrungTam.chung.ngheXe = nil
        cuaSo.rootViewController = nil
    }

    private func lenh(_ ten: String, _ thamSo: [String: Any] = [:], traLoi: ((Any?, String?) -> Void)? = nil) {
        manHinh.trang.lenh(ten, thamSo, traLoi: traLoi)
    }

    /// Báo cho trang phần màn hình bị che; chừa thêm cột nút bản đồ bên phải.
    private func guiLe(_ le: UIEdgeInsets) {
        lenh("le", ["tren": le.top, "duoi": le.bottom, "trai": le.left, "phai": le.right + 64])
    }

    // MARK: - Nút bấm

    private func anh(_ ten: String) -> UIImage? { UIImage(named: ten)?.withRenderingMode(.alwaysTemplate) }

    private func datNutBanDo() {
        func nut(_ tenAnh: String, _ bam: @escaping () -> Void) -> CPMapButton {
            let b = CPMapButton { _ in bam() }
            b.image = anh(tenAnh)
            return b
        }
        banDo.mapButtons = [
            nut("ic_cong") { [weak self] in self?.lenh("banDo", ["loai": "phongTo"]) },
            nut("ic_tru") { [weak self] in self?.lenh("banDo", ["loai": "thuNho"]) },
            nut("ic_vitri") { [weak self] in self?.lenh("banDo", ["loai": "veGiua"]) },
            nut("ic_keo") { [weak self] in self?.banDo.showPanningInterface(animated: true) }
        ]
    }

    private func datNutChinh() {
        banDo.leadingNavigationBarButtons = [
            CPBarButton(title: "Tìm") { [weak self] _ in self?.moTimKiem() },
            CPBarButton(title: "Đã lưu") { [weak self] _ in self?.moDaLuu() }
        ]
        banDo.trailingNavigationBarButtons = [
            CPBarButton(title: "Quanh đây") { [weak self] _ in self?.moDanhMuc() },
            CPBarButton(title: "Báo cáo") { [weak self] _ in self?.moBaoCao() }
        ]
    }

    private func datNutXemTruoc() {
        banDo.leadingNavigationBarButtons = [
            CPBarButton(title: "Huỷ") { [weak self] _ in
                self?.banDo.hideTripPreviews()
                self?.chuyenDi = nil
                self?.lenh("huyXemTruoc")
                self?.datNutChinh()
            }
        ]
        banDo.trailingNavigationBarButtons = [
            CPBarButton(title: "Chạy thử") { [weak self] _ in
                self?.banDo.hideTripPreviews()
                self?.lenh("batDau", ["moPhong": true])
            }
        ]
    }

    private func datNutDanDuong() {
        banDo.leadingNavigationBarButtons = [CPBarButton(title: "Báo cáo") { [weak self] _ in self?.moBaoCao() }]
        banDo.trailingNavigationBarButtons = [CPBarButton(title: "Kết thúc") { [weak self] _ in self?.lenh("ketThuc") }]
    }

    // MARK: - Tìm kiếm & danh sách

    private func moTimKiem() {
        let t = CPSearchTemplate()
        t.delegate = self
        giaoDien.pushTemplate(t, animated: true, completion: nil)
    }

    func searchTemplate(_ searchTemplate: CPSearchTemplate, updatedSearchText searchText: String,
                        completionHandler: @escaping ([CPListItem]) -> Void) {
        let chuoi = searchText.trimmingCharacters(in: .whitespaces)
        guard chuoi.count >= 2 else { completionHandler([]); return }
        lenh("timKiem", ["chuoi": chuoi]) { [weak self] kq, _ in
            let ds = kq as? [[String: Any]] ?? []
            self?.ketQuaTim = ds
            completionHandler(ds.enumerated().map { i, d in
                let muc = CPListItem(text: d["ten"] as? String, detailText: DieuKhienCarPlay.moTa(d))
                muc.userInfo = i
                return muc
            })
        }
    }

    func searchTemplate(_ searchTemplate: CPSearchTemplate, selectedResult item: CPListItem, completionHandler: @escaping () -> Void) {
        if let i = item.userInfo as? Int, i < ketQuaTim.count { xemTruoc(ketQuaTim[i]) }
        completionHandler()
    }

    private struct Muc {
        let ten: String
        var phu: String? = nil
        var anh: String? = nil
        let bam: () -> Void
    }

    private func moDanhSach(_ tieuDe: String, _ ds: [Muc]) {
        let items = ds.prefix(CPListTemplate.maximumItemCount).map { m -> CPListItem in
            let muc = CPListItem(text: m.ten, detailText: m.phu, image: m.anh.flatMap { UIImage(named: $0) })
            muc.handler = { _, xong in m.bam(); xong() }
            return muc
        }
        let t = CPListTemplate(title: tieuDe, sections: [CPListSection(items: Array(items))])
        giaoDien.pushTemplate(t, animated: true, completion: nil)
    }

    private static func moTa(_ d: [String: Any]) -> String {
        [d["kcChu"] as? String, d["diaChi"] as? String].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private func mucDiaDiem(_ d: [String: Any], anh: String, ten: String? = nil) -> Muc {
        Muc(ten: ten ?? (d["ten"] as? String ?? ""), phu: DieuKhienCarPlay.moTa(d), anh: anh) { [weak self] in self?.xemTruoc(d) }
    }

    private func moDaLuu() {
        lenh("daLuu") { [weak self] kq, loi in
            guard let self = self else { return }
            guard let o = kq as? [String: Any] else { self.baoLoi(loi ?? "Không đọc được địa điểm đã lưu"); return }
            var ds: [Muc] = []
            if let nha = o["nha"] as? [String: Any] { ds.append(self.mucDiaDiem(nha, anh: "ic_nha", ten: "Nhà riêng")) }
            if let cq = o["coQuan"] as? [String: Any] { ds.append(self.mucDiaDiem(cq, anh: "ic_coquan", ten: "Cơ quan")) }
            (o["yeuThich"] as? [[String: Any]] ?? []).forEach { ds.append(self.mucDiaDiem($0, anh: "ic_saodac")) }
            (o["ganDay"] as? [[String: Any]] ?? []).forEach { ds.append(self.mucDiaDiem($0, anh: "ic_dongho")) }
            if ds.isEmpty { self.baoLoi("Chưa có địa điểm đã lưu. Hãy lưu địa điểm trên iPhone."); return }
            self.moDanhSach("Đã lưu", ds)
        }
    }

    private func moDanhMuc() {
        lenh("danhMuc") { [weak self] kq, _ in
            guard let self = self else { return }
            let ds = (kq as? [[String: Any]] ?? []).map { d -> Muc in
                let id = d["id"] as? String ?? ""
                let ten = d["ten"] as? String ?? ""
                return Muc(ten: ten, anh: "ic_" + (d["icon"] as? String ?? "ghim")) { [weak self] in self?.moQuanhDay(id, ten) }
            }
            self.moDanhSach("Quanh đây", ds)
        }
    }

    private func moQuanhDay(_ id: String, _ ten: String) {
        lenh("quanhDay", ["danhMuc": id]) { [weak self] kq, loi in
            guard let self = self else { return }
            let ds = (kq as? [[String: Any]] ?? []).map { self.mucDiaDiem($0, anh: "ic_ghim") }
            if ds.isEmpty { self.baoLoi(loi ?? "Không có \(ten) nào gần đây"); return }
            self.moDanhSach(ten, ds)
        }
    }

    private func moBaoCao() {
        lenh("loaiBaoCao") { [weak self] kq, _ in
            guard let self = self else { return }
            let ds = (kq as? [[String: Any]] ?? []).map { b -> Muc in
                let id = b["id"] as? String ?? ""
                return Muc(ten: b["ten"] as? String ?? id, anh: "ic_" + id) { [weak self] in
                    self?.lenh("baoCao", ["loai": id]) { ten, loi in
                        self?.giaoDien.popToRootTemplate(animated: true, completion: nil)
                        self?.baoLoi(loi ?? "Đã báo cáo \(ten as? String ?? ""). Cảm ơn bạn!")
                    }
                }
            }
            self.moDanhSach("Báo cáo giao thông", ds)
        }
    }

    private func baoLoi(_ thongDiep: String) {
        let hop = CPAlertTemplate(titleVariants: [thongDiep], actions: [
            CPAlertAction(title: "Đóng", style: .cancel) { [weak self] _ in self?.giaoDien.dismissTemplate(animated: true, completion: nil) }
        ])
        giaoDien.presentTemplate(hop, animated: true, completion: nil)
    }

    // MARK: - Xem trước & dẫn đường

    private static func toaDo(_ v: Any?) -> CLLocationCoordinate2D? {
        guard let a = v as? [NSNumber], a.count == 2 else { return nil }
        return CLLocationCoordinate2D(latitude: a[1].doubleValue, longitude: a[0].doubleValue)
    }

    private func xemTruoc(_ dd: [String: Any]) {
        giaoDien.popToRootTemplate(animated: true, completion: nil)
        lenh("xemTruoc", ["diem": dd]) { [weak self] kq, loi in
            guard let self = self else { return }
            guard let ds = kq as? [[String: Any]], let dau = ds.first,
                  let viTri = DieuKhienCarPlay.toaDo(dau["diemCuoi"]) ?? DieuKhienCarPlay.toaDo(dd["viTri"]) else {
                self.baoLoi(loi ?? "Không tìm được đường đi")
                return
            }
            let den = MKMapItem(placemark: MKPlacemark(coordinate: viTri))
            den.name = dd["ten"] as? String
            let luaChon = ds.enumerated().map { (i, t) -> CPRouteChoice in
                var tomTat = t["duongChinh"] as? String ?? ""
                tomTat = tomTat.isEmpty ? (t["quangDuongChu"] as? String ?? "") : "Qua " + tomTat
                var them: [String] = [t["quangDuongChu"] as? String ?? ""]
                if t["coThuPhi"] as? Bool == true { them.append("Có trạm thu phí") }
                let c = CPRouteChoice(summaryVariants: [tomTat], additionalInformationVariants: [them.joined(separator: " · ")],
                                      selectionSummaryVariants: [t["thoiGianChu"] as? String ?? ""])
                c.userInfo = i
                return c
            }
            let trip = CPTrip(origin: MKMapItem.forCurrentLocation(), destination: den, routeChoices: luaChon)
            self.chuyenDi = trip
            self.banDo.showTripPreviews([trip], textConfiguration: CPTripPreviewTextConfiguration(
                startButtonTitle: "Bắt đầu", additionalRoutesButtonTitle: "Tuyến khác", overviewButtonTitle: "Tổng quan"))
            self.datNutXemTruoc()
        }
    }

    func mapTemplate(_ mapTemplate: CPMapTemplate, selectedPreviewFor trip: CPTrip, using routeChoice: CPRouteChoice) {
        if let i = routeChoice.userInfo as? Int { lenh("chonTuyen", ["i": i]) }
    }

    func mapTemplate(_ mapTemplate: CPMapTemplate, startedTrip trip: CPTrip, using routeChoice: CPRouteChoice) {
        mapTemplate.hideTripPreviews()
        lenh("batDau", ["moPhong": false])
    }

    func mapTemplateDidCancelNavigation(_ mapTemplate: CPMapTemplate) {
        phien = nil
        lenh("ketThuc")
    }

    func mapTemplate(_ mapTemplate: CPMapTemplate, panWith direction: CPMapTemplate.PanDirection) {
        var dx = 0.0, dy = 0.0
        if direction.contains(.left) { dx = -120 }
        if direction.contains(.right) { dx = 120 }
        if direction.contains(.up) { dy = -120 }
        if direction.contains(.down) { dy = 120 }
        lenh("banDo", ["loai": "keo", "dx": dx, "dy": dy])
    }

    func mapTemplateDidShowPanningInterface(_ mapTemplate: CPMapTemplate) {
        mapTemplate.leadingNavigationBarButtons = [
            CPBarButton(title: "Xong") { [weak mapTemplate] _ in mapTemplate?.dismissPanningInterface(animated: true) }
        ]
        mapTemplate.trailingNavigationBarButtons = []
    }

    func mapTemplateDidDismissPanningInterface(_ mapTemplate: CPMapTemplate) {
        if phien != nil { datNutDanDuong() } else { datNutChinh() }
    }

    private func nhanTin(_ loai: String, _ du: [String: Any]) {
        switch loai {
        case "sanSang": guiLe(manHinh.view.safeAreaInsets)
        case "danDuong": capNhatDanDuong(du)
        default: break
        }
    }

    /// Làm tròn như trên trang: 10 m dưới 100 m, 50 m dưới 1 km.
    private static func khoangCach(_ m: Double) -> Measurement<UnitLength> {
        let r = m < 100 ? (m / 10).rounded() * 10 : m < 1000 ? (m / 50).rounded() * 50 : (m / 100).rounded() * 100
        return Measurement(value: r, unit: .meters)
    }

    private static func so(_ v: Any?) -> Double { (v as? NSNumber)?.doubleValue ?? 0 }

    private static func tenMuiTen(_ b: [String: Any]) -> String {
        let loai = b["loai"] as? String ?? ""
        let huong = b["huong"] as? String ?? ""
        if loai == "arrive" { return "mt_den_noi" }
        if huong == "uturn" { return "mt_quay_dau" }
        let ten: [String: String] = [
            "slight right": "cheo_phai", "right": "re_phai", "sharp right": "gat_phai",
            "slight left": "cheo_trai", "left": "re_trai", "sharp left": "gat_trai"
        ]
        if loai == "roundabout" || loai == "rotary" {
            let vx: [String: String] = [
                "slight right": "cheo_phai", "right": "phai", "sharp right": "gat_phai",
                "slight left": "cheo_trai", "left": "trai", "sharp left": "gat_trai"
            ]
            return vx[huong].map { "mt_vong_xuyen_" + $0 } ?? "mt_vong_xuyen"
        }
        return ten[huong].map { "mt_" + $0 } ?? "mt_thang"
    }

    private func thaoTac(_ b: [String: Any], giay: Double) -> CPManeuver {
        let m = CPManeuver()
        m.instructionVariants = [b["chiDan"] as? String ?? ""]
        m.symbolImage = anh(DieuKhienCarPlay.tenMuiTen(b))
        m.initialTravelEstimates = CPTravelEstimates(distanceRemaining: DieuKhienCarPlay.khoangCach(DieuKhienCarPlay.so(b["kc"])), timeRemaining: giay)
        return m
    }

    private func capNhatDanDuong(_ du: [String: Any]) {
        guard du["dangDanDuong"] as? Bool == true else {
            if let p = phien {
                if du["daDen"] as? Bool == true { p.finishTrip() } else { p.cancelTrip() }
            }
            phien = nil
            chuyenDi = nil
            thaoTacCuoi = nil
            datNutChinh()
            return
        }
        if phien == nil {
            // bắt đầu từ CarPlay (đã có chuyến đi xem trước) hoặc từ iPhone (tạo chuyến đi mới)
            let trip = chuyenDi ?? taoChuyenDi(du)
            banDo.hideTripPreviews()
            phien = banDo.startNavigationSession(for: trip)
            chuyenDi = trip
            datNutDanDuong()
        }
        guard let p = phien else { return }
        if du["dangTinhLai"] as? Bool == true {
            p.pauseTrip(for: .rerouting, description: "Đang tính lại đường")
            thaoTacCuoi = nil
            return
        }
        guard let ke = du["ke"] as? [String: Any] else { return }
        let conLai = DieuKhienCarPlay.so(du["conLai"])
        let giay = DieuKhienCarPlay.so(du["thoiGianConLai"])
        let kc = DieuKhienCarPlay.so(ke["kc"])
        let giayToiRe = conLai > 0 ? giay * kc / conLai : 0
        let khoa = "\(ke["chiDan"] as? String ?? "")|\(ke["loai"] as? String ?? "")|\(du["sau"] != nil)"
        if khoa != thaoTacCuoi {
            thaoTacCuoi = khoa
            var ds = [thaoTac(ke, giay: giayToiRe)]
            if let sau = du["sau"] as? [String: Any] { ds.append(thaoTac(sau, giay: 0)) }
            p.upcomingManeuvers = ds
        }
        if let m = p.upcomingManeuvers.first {
            p.updateEstimates(CPTravelEstimates(distanceRemaining: DieuKhienCarPlay.khoangCach(kc), timeRemaining: giayToiRe), for: m)
        }
        if let trip = chuyenDi {
            banDo.updateEstimates(CPTravelEstimates(distanceRemaining: DieuKhienCarPlay.khoangCach(conLai), timeRemaining: giay), for: trip)
        }
        if let cb = du["canhBao"] as? [String: Any], let id = cb["id"] as? String, id != canhBaoCuoi {
            canhBaoCuoi = id
            hienCanhBao(cb)
        }
    }

    private func taoChuyenDi(_ du: [String: Any]) -> CPTrip {
        let ten = du["tenDen"] as? String ?? "Điểm đến"
        let viTri = DieuKhienCarPlay.toaDo(du["diemDen"]) ?? NguonViTri.chung.cuoi?.coordinate ?? CLLocationCoordinate2D(latitude: 21.0287, longitude: 105.8522)
        let den = MKMapItem(placemark: MKPlacemark(coordinate: viTri))
        den.name = ten
        let luaChon = CPRouteChoice(summaryVariants: [ten], additionalInformationVariants: [], selectionSummaryVariants: [])
        return CPTrip(origin: MKMapItem.forCurrentLocation(), destination: den, routeChoices: [luaChon])
    }

    /// Cảnh báo camera / đường sắt / trạm thu phí / báo cáo phía trước (giọng nói do trang đọc).
    private func hienCanhBao(_ cb: [String: Any]) {
        var phu = MeasurementFormatter().string(from: DieuKhienCarPlay.khoangCach(DieuKhienCarPlay.so(cb["kc"])))
        if let gh = cb["gioiHan"] as? NSNumber { phu += " · tối đa \(gh.intValue) km/h" }
        let canhBao = CPNavigationAlert(
            titleVariants: [cb["ten"] as? String ?? "Cảnh báo"], subtitleVariants: [phu], image: anh("ic_canhbao"),
            primaryAction: CPAlertAction(title: "Đóng", style: .cancel) { _ in }, secondaryAction: nil, duration: 8
        )
        if banDo.currentNavigationAlert != nil {
            banDo.dismissNavigationAlert(animated: false) { [weak self] _ in self?.banDo.present(navigationAlert: canhBao, animated: true) }
        } else {
            banDo.present(navigationAlert: canhBao, animated: true)
        }
    }
}
