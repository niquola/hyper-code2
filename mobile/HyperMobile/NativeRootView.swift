import SwiftUI

struct NativeRootView: View {
    @AppStorage("hyper.serverURL") private var serverURL = "https://hyper.tunnel.apki.dev"
    @AppStorage("hyper.tunnelDefault.v1") private var tunnelDefaultApplied = false
    @StateObject private var store = AgentListStore()
    @State private var showingSettings = false
    @State private var showingWeb = false
    @State private var showingNewAgent = false
    @State private var query = ""
    @State private var selectedFolder: String?
    @State private var needsLogin = false
    @State private var loginPassword = ""
    @State private var loginError: String?
    @State private var isLoggingIn = false

    private var baseURL: URL? { URL(string: serverURL) }
    private var folders: [String] { Array(Set(store.agents.map { folderName($0.workspaceDir) })).sorted() }
    private var filtered: [AgentSummary] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return store.agents.filter {
            (q.isEmpty || $0.title.lowercased().contains(q) || $0.id.lowercased().contains(q) || $0.workspaceDir.lowercased().contains(q)) &&
            (selectedFolder == nil || folderName($0.workspaceDir) == selectedFolder)
        }.sorted {
            if $0.pinned != $1.pinned { return $0.pinned }
            if ($0.unread > 0) != ($1.unread > 0) { return $0.unread > 0 }
            if $0.isRunning != $1.isRunning { return $0.isRunning }
            return $0.updatedAt > $1.updatedAt
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemBackground).ignoresSafeArea()
                if store.isLoading && store.agents.isEmpty {
                    ProgressView("Connecting…")
                } else if let error = store.error, store.agents.isEmpty {
                    ContentUnavailableView("Can’t connect", systemImage: "wifi.exclamationmark", description: Text(error))
                } else {
                    VStack(spacing: 0) {
                        FolderStrip(folders: folders, selection: $selectedFolder)
                        List {
                            agentSection("Pinned", filtered.filter(\.pinned))
                            agentSection("Unread", filtered.filter { !$0.pinned && $0.unread > 0 })
                            agentSection("Recent", filtered.filter { !$0.pinned && $0.unread == 0 })
                        }
                        .listStyle(.plain)
                        .safeAreaPadding(.bottom, 12)
                        .scrollContentBackground(.hidden)
                        .refreshable { await reload() }
                    }
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search chats")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showingNewAgent = true } label: { Image(systemName: "square.and.pencil") }
                        .accessibilityLabel("New agent")
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showingWeb = true } label: { Image(systemName: "safari") }
                    Button { showingSettings = true } label: { Image(systemName: "gearshape") }
                }
            }
            .navigationDestination(for: AgentSummary.self) { agent in
                if let baseURL {
                    NativeChatView(agent: agent, baseURL: baseURL) { Task { await reload() } }
                        .id(agent.id)
                }
            }
        }
        .task {
            if !tunnelDefaultApplied { serverURL = "https://hyper.tunnel.apki.dev"; tunnelDefaultApplied = true }
            await reload()
        }
        .sheet(isPresented: $showingNewAgent) { if let baseURL { NewAgentView(baseURL: baseURL) { _ in showingNewAgent = false; Task { await reload() } } } }
        .sheet(isPresented: $showingSettings) { NativeSettingsView(serverURL: $serverURL) { Task { await reload() } } }
        .sheet(isPresented: $showingWeb) { NavigationStack { HyperWebViewScreen(urlString: serverURL) } }
        .sheet(isPresented: $needsLogin) { NativeLoginView(password: $loginPassword, error: loginError, isLoading: isLoggingIn) { login() } }
    }

    @ViewBuilder private func agentSection(_ title: String, _ agents: [AgentSummary]) -> some View {
        if !agents.isEmpty {
            Section {
                ForEach(agents) { agent in
                    NavigationLink(value: agent) { AgentRow(agent: agent) }
                        .listRowSeparator(.hidden)
                        .swipeActions(edge: .leading) {
                            Button { pin(agent, !agent.pinned) } label: { Label(agent.pinned ? "Unpin" : "Pin", systemImage: agent.pinned ? "pin.slash" : "pin") }.tint(.orange)
                        }
                        .contextMenu { Button { pin(agent, !agent.pinned) } label: { Label(agent.pinned ? "Unpin" : "Pin", systemImage: agent.pinned ? "pin.slash" : "pin") } }
                }
            } header: {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(nil)
            }
        }
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
    private func folderName(_ path: String) -> String { URL(fileURLWithPath: path).lastPathComponent.isEmpty ? "No workspace" : URL(fileURLWithPath: path).lastPathComponent }
}

private struct FolderStrip: View {
    let folders: [String]
    @Binding var selection: String?
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                chip("All", icon: "tray.full", selected: selection == nil) { selection = nil }
                ForEach(folders, id: \.self) { folder in chip(folder, icon: "folder", selected: selection == folder) { selection = folder } }
            }.padding(.horizontal, 16).padding(.vertical, 8)
        }
        .background(Color(.systemBackground))
    }
    private func chip(_ title: String, icon: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: icon).font(.caption.weight(.medium)).lineLimit(1)
                .padding(.horizontal, 11).frame(height: 32)
                .background(selected ? Color.accentColor : Color(.secondarySystemBackground), in: Capsule())
                .foregroundStyle(selected ? .white : .primary)
        }.buttonStyle(.plain)
    }
}

private struct AgentRow: View {
    let agent: AgentSummary
    private var folder: String { URL(fileURLWithPath: agent.workspaceDir).lastPathComponent.isEmpty ? "No workspace" : URL(fileURLWithPath: agent.workspaceDir).lastPathComponent }
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(agent.isRunning ? Color.green.opacity(0.15) : Color.secondary.opacity(0.10)).frame(width: 42, height: 42)
                Image(systemName: agent.isRunning ? "sparkles" : "bubble.left").foregroundStyle(agent.isRunning ? .green : .secondary)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if agent.pinned { Image(systemName: "pin.fill").font(.caption2).foregroundStyle(.orange) }
                    Text(agent.title).font(.body.weight(.medium)).lineLimit(1)
                    if agent.unread > 0 { Circle().fill(.blue).frame(width: 9, height: 9) }
                }
                Label(folder, systemImage: "folder").font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            if agent.isRunning { ProgressView().controlSize(.small) }
        }.padding(.vertical, 5)
    }
}

private struct NativeLoginView: View {
    @Binding var password: String; let error: String?; let isLoading: Bool; let submit: () -> Void; @FocusState private var focused: Bool
    var body: some View { VStack(spacing: 18) { Spacer(); Image(systemName: "lock.shield.fill").font(.system(size: 46)).foregroundStyle(.indigo); Text("Sign in").font(.title2.bold()); SecureField("Password", text: $password).onSubmit(submit).focused($focused).padding(14).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14)); if let error { Text(error).font(.caption).foregroundStyle(.red) }; Button("Sign in", action: submit).buttonStyle(.borderedProminent).controlSize(.large).disabled(password.isEmpty || isLoading); Spacer() }.padding(24).background(DotLoginBackground()).task { focused = true } }
}
struct DotLoginBackground: View { var body: some View { Color(.systemGroupedBackground).overlay(Canvas { context, size in var path = Path(); for y in stride(from: 8.0, to: size.height, by: 16) { for x in stride(from: 8.0, to: size.width, by: 16) { path.addEllipse(in: .init(x: x-1, y: y-1, width: 2, height: 2)) } }; context.fill(path, with: .color(.secondary.opacity(0.13))) }).ignoresSafeArea() } }
struct NativeSettingsView: View { @Binding var serverURL: String; let connected: () -> Void; @State private var draft: String; @Environment(\.dismiss) private var dismiss; init(serverURL: Binding<String>, connected: @escaping () -> Void) { _serverURL = serverURL; self.connected = connected; _draft = State(initialValue: serverURL.wrappedValue) }; var body: some View { NavigationStack { Form { TextField("Server", text: $draft).textInputAutocapitalization(.never).autocorrectionDisabled(); Button("Connect") { serverURL = draft; connected(); dismiss() } }.navigationTitle("Connection").toolbar { Button("Cancel") { dismiss() } } } } }
