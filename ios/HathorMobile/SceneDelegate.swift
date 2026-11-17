import UIKit
import React
import React_RCTAppDelegate

/// The app's window scene. iOS 27 doesn't launch an app built with its SDK unless the
/// app uses the scene lifecycle, so the window belongs to this scene, and the scene
/// loads React Native into it.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    // With scenes, a deep link that launches the app arrives here instead of in the
    // app's launch options. Pass it on, so Linking.getInitialURL still returns it.
    var launchOptions: [AnyHashable: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[UIApplication.LaunchOptionsKey.url.rawValue] = url
    }

    let rootView = appDelegate.rootViewFactory.view(
      withModuleName: appDelegate.moduleName ?? "HathorMobile",
      initialProperties: appDelegate.initialProps,
      launchOptions: launchOptions
    )
    let rootViewController = appDelegate.createRootViewController()
    appDelegate.setRootView(rootView, toRootViewController: rootViewController)

    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = rootViewController
    self.window = window
    // Native modules that present UI look the window up on the app delegate.
    appDelegate.window = window
    window.makeKeyAndVisible()
  }

  // A deep link that arrives while the app is running.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else {
      return
    }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }
}
