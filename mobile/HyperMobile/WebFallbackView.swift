import SwiftUI

struct HyperWebViewScreen: View {
    let urlString: String
    @Environment(\.dismiss) private var dismiss
    @State private var isLoading = true
    @State private var canGoBack = false
    @State private var canGoForward = false
    @State private var command: WebNavigationCommand?

    var body: some View {
        HyperWebView(urlString: urlString, command: command, isLoading: $isLoading, canGoBack: $canGoBack, canGoForward: $canGoForward)
            .navigationTitle("Web Hyper")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Done") { dismiss() } }
                ToolbarItemGroup(placement: .bottomBar) {
                    Button { command = .init(action: .back) } label: { Image(systemName: "chevron.backward") }.disabled(!canGoBack)
                    Button { command = .init(action: .forward) } label: { Image(systemName: "chevron.forward") }.disabled(!canGoForward)
                    Spacer()
                    if isLoading { ProgressView() }
                    Button { command = .init(action: .reload) } label: { Image(systemName: "arrow.clockwise") }
                }
            }
    }
}
