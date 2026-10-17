import CarPlay
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        if connectingSceneSession.role == UISceneSession.Role.carTemplateApplication {
            let cauHinh = UISceneConfiguration(name: "CarPlay", sessionRole: connectingSceneSession.role)
            cauHinh.delegateClass = CarPlaySceneDelegate.self
            return cauHinh
        }
        let cauHinh = UISceneConfiguration(name: "DienThoai", sessionRole: connectingSceneSession.role)
        cauHinh.delegateClass = SceneDelegate.self
        return cauHinh
    }
}

/// Cửa sổ trên iPhone.
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let manHinh = scene as? UIWindowScene else { return }
        let cuaSo = UIWindow(windowScene: manHinh)
        let vc = ManHinhWeb(vaiTro: .dienThoai)
        TrungTam.chung.ngheDienThoai = { [weak vc] loai, du in vc?.xuLyTin(loai, du) }
        cuaSo.rootViewController = vc
        cuaSo.makeKeyAndVisible()
        window = cuaSo
    }
}
