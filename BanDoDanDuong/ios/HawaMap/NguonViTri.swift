import CoreLocation

/// GPS của iPhone, dùng chung cho trang trên điện thoại và trên CarPlay. Chỉ bật khi có nơi đang nghe.
final class NguonViTri: NSObject, CLLocationManagerDelegate {
    static let chung = NguonViTri()

    private let lm = CLLocationManager()
    private var nguoiNghe: [UUID: (CLLocation) -> Void] = [:]
    private(set) var cuoi: CLLocation?

    private override init() {
        super.init()
        lm.delegate = self
        lm.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        lm.activityType = .automotiveNavigation
        lm.pausesLocationUpdatesAutomatically = false
        // cần UIBackgroundModes = location trong Info.plist: tiếp tục dẫn đường khi khoá màn hình
        lm.allowsBackgroundLocationUpdates = true
        lm.showsBackgroundLocationIndicator = true
    }

    @discardableResult
    func them(_ f: @escaping (CLLocation) -> Void) -> UUID {
        let id = UUID()
        nguoiNghe[id] = f
        batDau()
        if let c = cuoi { f(c) }
        return id
    }

    func bo(_ id: UUID) {
        nguoiNghe.removeValue(forKey: id)
        if nguoiNghe.isEmpty { lm.stopUpdatingLocation() }
    }

    private func batDau() {
        switch lm.authorizationStatus {
        case .notDetermined: lm.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse: lm.startUpdatingLocation()
        default: break
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if !nguoiNghe.isEmpty { batDau() }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let l = locations.last, l.horizontalAccuracy >= 0 else { return }
        cuoi = l
        nguoiNghe.values.forEach { $0(l) }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {}
}
