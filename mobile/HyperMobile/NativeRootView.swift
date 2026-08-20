import SwiftUI

struct NativeRootView: View {
    @AppStorage("hyper.serverURL") private var serverURL = "https://hyper.tunnel.apki.dev"
    @AppStorage("hyper.tunnelDefault.v1") private var tunnelDefaultApplied = false
    @StateObject private var store = AgentListStore()
    @State private var showingSettings = false
    @State private var showingWeb = false
    @State private var query = ""
    @State private var needsLogin = false
    @State private var loginPassword = ""
    @State private var loginError: String?
    @State private var isLoggingIn = false
    private var baseURL: URL? { URL(string: serverURL) }

    private var filtered: [AgentSummary] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return store.agents.filter { q.isEmpty || $0.title.lowercased().contains(q) || $0.id.lowercased().contains(q) || $0.workspaceDir.lowercased().contains(q) }
            .sorted { lhs, rhs in
                if lhs.pinned != rhs.pinned { return lhs.pinned }
                if (lhs.unread > 0) != (rhs.unread > 0) { return lhs.unread > 0 }
                if lhs.isRunning != rhs.isRunning { return lhs.isRunning }
                return lhs.updatedAt > rhs.updatedAt
            }
    }

    var body: some View {
        NavigationStack {
            Group {
                if store.isLoading && store.agents.isEmpty { ProgressView("Connecting to Hyper…") }
                else if let error = store.error, store.agents.isEmpty { ContentUnavailableView("Can’t reach Hyper", systemImage: "bolt.horizontal.circle", description: Text(error)) }
                else {
                    List(filtered) { agent in
                        NavigationLink(value: agent) { AgentRow(agent: agent) }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) { Button { pin(agent, !agent.pinned) } label: { Label(agent.pinned ? "Unpin" : "Pin", systemImage: agent.pinned ? "pin.slash" : "pin") }.tint(agent.pinned ? .gray : .orange) }
                            .contextMenu { Button { pin(agent, !agent.pinned) } label: { Label(agent.pinned ? "Unpin" : "Pin", systemImage: agent.pinned ? "pin.slash" : "pin") } }
                    }.listStyle(.plain).refreshable { await reload() }
                }
            }
            .navigationTitle("Hyper")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Agents, folders, IDs")
            .navigationDestination(for: AgentSummary.self) { agent in if let baseURL { NativeChatView(agent: agent, baseURL: baseURL) { Task { await reload() } } } }
            .toolbar { ToolbarItemGroup(placement: .topBarTrailing) { Button { showingWeb = true } label: { Image(systemName: "safari") }.accessibilityLabel("Open web interface"); Button { showingSettings = true } label: { Image(systemName: "gearshape") }.accessibilityLabel("Connection settings") } }
        }
        .task {
            if !tunnelDefaultApplied {
                serverURL = "https://hyper.tunnel.apki.dev"
                tunnelDefaultApplied = true
            }
            await reload()
        }
        .sheet(isPresented: $showingSettings) { NativeSettingsView(serverURL: $serverURL) { Task { await reload() } } }
        .sheet(isPresented: $showingWeb) { NavigationStack { HyperWebViewScreen(urlString: serverURL) } }
        .sheet(isPresented: $needsLogin) { NativeLoginView(password: $loginPassword, error: loginError, isLoading: isLoggingIn) { login() } }
    }
    private func reload() async {
        guard let baseURL else { store.error = "Invalid server URL"; return }
        await store.load(baseURL: baseURL)
        if store.error?.localizedCaseInsensitiveContains("authentication") == true || store.error?.localizedCaseInsensitiveContains("unauthorized") == true { needsLogin = true }
    }
    private func login() {
        guard let baseURL, !loginPassword.isEmpty else { return }
        isLoggingIn = true; loginError = nil
        Task { do { try await APIClient(baseURL: baseURL).login(password: loginPassword); loginPassword = ""; needsLogin = false; await reload() } catch { loginError = error.localizedDescription }; isLoggingIn = false }
    }
    private func pin(_ agent: AgentSummary, _ pinned: Bool) { guard let baseURL else { return }; Task { await store.setPinned(agent, pinned: pinned, baseURL: baseURL) } }
}

private struct NativeLoginView: View {
    @Binding var password: String
    let error: String?
    let isLoading: Bool
    let submit: () -> Void
    @FocusState private var focused: Bool
    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "lock.shield.fill").font(.system(size: 46)).foregroundStyle(.indigo)
            VStack(spacing: 5) { Text("Sign in to Hyper").font(.title2.bold()); Text("Enter the tunnel access password.").foregroundStyle(.secondary) }
            SecureField("Password", text: $password).textContentType(.password).submitLabel(.go).onSubmit(submit).focused($focused).padding(14).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
            if let error { Text(error).font(.caption).foregroundStyle(.red) }
            Button(action: submit) { HStack { if isLoading { ProgressView().tint(.white) }; Text("Sign in").fontWeight(.semibold) }.frame(maxWidth: .infinity).frame(height: 48).background(.indigo, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white) }.disabled(password.isEmpty || isLoading)
            Spacer()
        }.padding(24).background(DotLoginBackground()).task { focused = true }
    }
}
private struct DotLoginBackground: View { var body: some View { Color(.systemGroupedBackground).overlay(Canvas { context, size in var path = Path(); for y in stride(from: 8.0, to: size.height, by: 16) { for x in stride(from: 8.0, to: size.width, by: 16) { path.addEllipse(in: .init(x: x-1, y: y-1, width: 2, height: 2)) } }; context.fill(path, with: .color(.secondary.opacity(0.13))) }).ignoresSafeArea() } }


private struct AgentRow: View {
    let agent: AgentSummary
    private var folder: String { URL(fileURLWithPath: agent.workspaceDir).lastPathComponent.isEmpty ? "No workspace" : URL(fileURLWithPath: agent.workspaceDir).lastPathComponent }
    var body: some View {
        HStack(spacing: 12) {
            ZStack { Circle().fill(agent.isRunning ? Color.green.opacity(0.16) : Color.secondary.opacity(0.12)).frame(width: 42, height: 42); Image(systemName: agent.isRunning ? "sparkles" : "bubble.left.and.bubble.right").foregroundStyle(agent.isRunning ? .green : .secondary) }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) { if agent.pinned { Image(systemName: "pin.fill").font(.caption2).foregroundStyle(.orange) }; Text(agent.title).font(.headline).lineLimit(1); if agent.unread > 0 { Text("\(agent.unread)").font(.caption2.bold()).padding(.horizontal, 7).padding(.vertical, 3).background(.blue, in: Capsule()).foregroundStyle(.white) } }
                Label(folder, systemImage: "folder").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(); if agent.isRunning { ProgressView().controlSize(.small) }
        }.padding(.vertical, 4)
    }
}

struct NativeSettingsView: View {
    @Binding var serverURL: String; let connected: () -> Void; @State private var draft: String; @Environment(\.dismiss) private var dismiss
    init(serverURL: Binding<String>, connected: @escaping () -> Void) { _serverURL = serverURL; self.connected = connected; _draft = State(initialValue: serverURL.wrappedValue) }
    var body: some View { NavigationStack { Form { Section("Hyper server") { TextField("http://192.168.1.2:3010", text: $draft).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL) }; Section { Button("Connect") { serverURL = draft.trimmingCharacters(in: .whitespacesAndNewlines); connected(); dismiss() }.disabled(URL(string: draft)?.scheme == nil) } footer: { Text("Use localhost in Simulator, or the Mac’s LAN address on iPhone.") } }.navigationTitle("Connection").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } } } }
}
