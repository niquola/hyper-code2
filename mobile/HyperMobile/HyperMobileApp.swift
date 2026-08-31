import SwiftUI

@main
struct HyperMobileApp: App {
    var body: some Scene {
        WindowGroup {
            if UIDevice.current.userInterfaceIdiom == .pad {
                NativePadRootView()
            } else {
                NativeRootView()
            }
        }
    }
}
