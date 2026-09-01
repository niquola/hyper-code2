import SwiftUI

struct NativePadRootView: View {
    @AppStorage("hyper.serverURL") private var serverURL = "https://hyper.tunnel.apki.dev"
    @StateObject private var store = AgentListStore()
    @State private var selection: AgentSummary?
    @State private var query = ""
    @State private var selectedFolder: String?
    @State private var showingSettings = false
    @State private var showingNews = false
    @State private var showingWeb = false
    @State private var showingNewAgent = false
    @State private var needsLogin = false
    @State private var loginPassword = ""
    @State private var loginError: String?
    @State private var loggingIn = false
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    private var baseURL: URL? { URL(string: serverURL) }
    private var folders: [String] { Array(Set(store.agents.map { folder($0.workspaceDir) })).sorted() }
    private var filtered: [AgentSummary] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return store.agents.filter { agent in
            (needle.isEmpty || agent.title.lowercased().contains(needle) || agent.workspaceDir.lowercased().contains(needle)) &&
            (selectedFolder == nil || folder(agent.workspaceDir) == selectedFolder)
        }.sorted {
            if $0.pinned != $1.pinned { return $0.pinned }
            if ($0.unread > 0) != ($1.unread > 0) { return $0.unread > 0 }
            if $0.isRunning != $1.isRunning { return $0.isRunning }
            return $0.updatedAt > $1.updatedAt
        }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            List(selection: $selectedFolder) {
                Section("Workspace") {
                    Label("All chats", systemImage: "bubble.left.and.bubble.right").tag(String?.none)
                    ForEach(folders, id: \.self) { value in Label(value, systemImage: "folder").tag(Optional(value)) }
                }
                Section("Explore") {
                    Button { showingWeb = true } label: { Label("Web Hyper", systemImage: "safari") }
                }
            }
            .navigationTitle("Hyper Code")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showingNews = true } label: { Image(systemName: "newspaper") }.accessibilityLabel("News")
                    Button { showingSettings = true } label: { Image(systemName: "gearshape") }.accessibilityLabel("Connection")
                }
            }
        } content: {
            List(filtered, selection: $selection) { agent in
                AgentRow(agent: agent).tag(agent)
                    .contextMenu { Button { pin(agent, !agent.pinned) } label: { Label(agent.pinned ? "Unpin" : "Pin", systemImage: "pin") } }
            }
            .navigationTitle(selectedFolder ?? "Chats")
            .searchable(text: $query, prompt: "Search chats")
            .refreshable { await reload() }
            .overlay { if store.isLoading && store.agents.isEmpty { ProgressView("Connecting…") } }
            .toolbar {
                ToolbarItem(placement: .primaryAction) { Button { showingNewAgent = true } label: { Label("New chat", systemImage: "square.and.pencil") } }
            }
        } detail: {
            if let agent = selection, let baseURL {
                NativeChatView(agent: agent, baseURL: baseURL) { Task { await reload() } }
                    .id(agent.id)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .toolbar { panelToggle }
            } else {
                ContentUnavailableView("Select a chat", systemImage: "bubble.left.and.bubble.right", description: Text("Choose a conversation from the middle column."))
                    .background(DotGridBackground())
                    .toolbar { panelToggle }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .task { await reload(); if let baseURL { store.startRefreshing(baseURL: baseURL) } }
        .onDisappear { store.stopRefreshing() }
        .sheet(isPresented: $showingSettings) { NativeSettingsView(serverURL: $serverURL) { Task { await reload() } } }
        .fullScreenCover(isPresented: $showingNews) { if let baseURL { NativePadNewsView(baseURL: baseURL) } }
        .sheet(isPresented: $showingWeb) { NavigationStack { HyperWebViewScreen(urlString: serverURL) } }
        .sheet(isPresented: $showingNewAgent) { if let baseURL { NewAgentView(baseURL: baseURL) { created in showingNewAgent = false; Task { await reload(); selection = store.agents.first { $0.id == created.id } } } } }
        .sheet(isPresented: $needsLogin) { NativeLoginView(password: $loginPassword, error: loginError, isLoading: loggingIn) { login() } }
    }

    @ToolbarContentBuilder private var panelToggle: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button {
                withAnimation(.snappy) { columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly }
            } label: {
                Image(systemName: columnVisibility == .detailOnly ? "sidebar.left" : "sidebar.left")
            }
            .accessibilityLabel(columnVisibility == .detailOnly ? "Show chat panels" : "Hide chat panels")
        }
    }

    private func reload() async {
        guard let baseURL else { store.error = "Invalid server URL"; return }
        await store.load(baseURL: baseURL)
        if store.error?.localizedCaseInsensitiveContains("auth") == true || store.error?.localizedCaseInsensitiveContains("unauthorized") == true { needsLogin = true }
    }
    private func login() { guard let baseURL, !loginPassword.isEmpty else { return }; loggingIn = true; Task { do { try await APIClient(baseURL: baseURL).login(password: loginPassword); loginPassword = ""; needsLogin = false; await reload() } catch { loginError = error.localizedDescription }; loggingIn = false } }
    private func pin(_ agent: AgentSummary, _ value: Bool) { guard let baseURL else { return }; Task { await store.setPinned(agent, pinned: value, baseURL: baseURL) } }
    private func folder(_ path: String) -> String { let value = URL(fileURLWithPath: path).lastPathComponent; return value.isEmpty ? "No workspace" : value }
}
