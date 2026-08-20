import SwiftUI

struct NativeRootView: View {
    @AppStorage("hyper.serverURL") private var serverURL = "https://hyper.tunnel.apki.dev"
    @AppStorage("hyper.tunnelDefault.v1") private var tunnelDefaultApplied = false
    @StateObject private var store = AgentListStore()
    @State private var selected: AgentSummary?
    @State private var sidebarOpen = true
    @State private var showingSettings = false
    @State private var showingWeb = false
    @State private var query = ""
    @State private var needsLogin = false
    @State private var loginPassword = ""
    @State private var loginError: String?
    @State private var isLoggingIn = false
    @State private var selectedFolder: String?
    private var baseURL: URL? { URL(string: serverURL) }

    private var filtered: [AgentSummary] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return store.agents.filter {
            let matchesQuery = q.isEmpty || $0.title.lowercased().contains(q) || $0.id.lowercased().contains(q) || $0.workspaceDir.lowercased().contains(q)
            let matchesFolder = selectedFolder == nil || folderName($0.workspaceDir) == selectedFolder
            return matchesQuery && matchesFolder
        }
            .sorted { lhs, rhs in
                if lhs.pinned != rhs.pinned { return lhs.pinned }
                if (lhs.unread > 0) != (rhs.unread > 0) { return lhs.unread > 0 }
                if lhs.isRunning != rhs.isRunning { return lhs.isRunning }
                return lhs.updatedAt > rhs.updatedAt
            }
    }

    var body: some View {
        ZStack(alignment: .leading) {
            Group {
                if let selected, let baseURL {
                    NavigationStack { NativeChatView(agent: selected, baseURL: baseURL) { Task { await reload() } }.id(selected.id).toolbar { ToolbarItem(placement: .topBarLeading) { glassButton("line.3.horizontal", "Open chats") { withAnimation(.snappy(duration: 0.28)) { sidebarOpen = true } } } } }
                } else { EmptyHome { withAnimation(.snappy(duration: 0.28)) { sidebarOpen = true } } }
            }
            .scaleEffect(sidebarOpen ? 0.965 : 1, anchor: .trailing)
            .offset(x: sidebarOpen ? min(350, UIScreen.main.bounds.width * 0.92) : 0)
            .overlay { if sidebarOpen { Color.black.opacity(0.16).ignoresSafeArea().onTapGesture { withAnimation(.snappy(duration: 0.28)) { sidebarOpen = false } } } }

            if sidebarOpen {
                AgentSidebar(agents: filtered, allAgents: store.agents, selectedID: selected?.id, selectedFolder: $selectedFolder, query: $query, loading: store.isLoading, error: store.error, select: select, pin: pin, refresh: reload, settings: { showingSettings = true }, web: { showingWeb = true })
                    .frame(width: min(350, UIScreen.main.bounds.width * 0.92))
                    .transition(.move(edge: .leading).combined(with: .opacity))
                    .zIndex(2)
            }
        }
        .background(Color(.systemGroupedBackground))
        .task { if !tunnelDefaultApplied { serverURL = "https://hyper.tunnel.apki.dev"; tunnelDefaultApplied = true }; await reload() }
        .sheet(isPresented: $showingSettings) { NativeSettingsView(serverURL: $serverURL) { Task { await reload() } } }
        .sheet(isPresented: $showingWeb) { NavigationStack { HyperWebViewScreen(urlString: serverURL) } }
        .sheet(isPresented: $needsLogin) { NativeLoginView(password: $loginPassword, error: loginError, isLoading: isLoggingIn) { login() } }
    }

    private func select(_ agent: AgentSummary) { selected = agent; UIImpactFeedbackGenerator(style: .light).impactOccurred(); withAnimation(.snappy(duration: 0.28)) { sidebarOpen = false } }
    private func reload() async { guard let baseURL else { store.error = "Invalid server URL"; return }; await store.load(baseURL: baseURL); if store.error?.localizedCaseInsensitiveContains("authentication") == true || store.error?.localizedCaseInsensitiveContains("unauthorized") == true { needsLogin = true } }
    private func login() { guard let baseURL, !loginPassword.isEmpty else { return }; isLoggingIn = true; loginError = nil; Task { do { try await APIClient(baseURL: baseURL).login(password: loginPassword); loginPassword = ""; needsLogin = false; await reload() } catch { loginError = error.localizedDescription }; isLoggingIn = false } }
    private func pin(_ agent: AgentSummary, _ pinned: Bool) { guard let baseURL else { return }; Task { await store.setPinned(agent, pinned: pinned, baseURL: baseURL) } }
    private func glassButton(_ icon: String, _ label: String, action: @escaping () -> Void) -> some View { Button(action: action) { Image(systemName: icon).frame(width: 38, height: 38).hyperGlass(Circle(), interactive: true) }.accessibilityLabel(label) }
    private func folderName(_ path: String) -> String { URL(fileURLWithPath: path).lastPathComponent.isEmpty ? "No workspace" : URL(fileURLWithPath: path).lastPathComponent }
}

private struct AgentSidebar: View {
    let agents: [AgentSummary]
    let allAgents: [AgentSummary]
    let selectedID: String?
    @Binding var selectedFolder: String?
    @Binding var query: String
    let loading: Bool
    let error: String?
    let select: (AgentSummary) -> Void
    let pin: (AgentSummary, Bool) -> Void
    let refresh: () async -> Void
    let settings: () -> Void
    let web: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack { Button(action: web) { Image(systemName: "square.and.pencil").frame(width: 40, height: 40).background(Color(uiColor: .secondarySystemBackground), in: Circle()) }.accessibilityLabel("New agent in web interface"); Spacer(); Button(action: web) { Image(systemName: "safari").frame(width: 40, height: 40).background(Color(uiColor: .secondarySystemBackground), in: Circle()) }; Button(action: settings) { Image(systemName: "gearshape").frame(width: 40, height: 40).background(Color(uiColor: .secondarySystemBackground), in: Circle()) } }.padding(.horizontal, 12).padding(.top, 4).padding(.bottom, 8)
            HStack(spacing: 9) { Image(systemName: "magnifyingglass").foregroundStyle(.secondary); TextField("Search chats", text: $query).textInputAutocapitalization(.never); if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) } } }.padding(.horizontal, 13).frame(height: 44).background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.primary.opacity(0.10), lineWidth: 0.5)).padding(.horizontal, 12).padding(.bottom, 6)
            folderStrip
            if loading && agents.isEmpty { Spacer(); ProgressView(); Spacer() }
            else if let error, agents.isEmpty { Spacer(); ContentUnavailableView("Can’t connect", systemImage: "wifi.exclamationmark", description: Text(error)); Spacer() }
            else {
                List {
                    let pinned = agents.filter(\.pinned)
                    let unread = agents.filter { !$0.pinned && $0.unread > 0 }
                    let recent = agents.filter { !$0.pinned && $0.unread == 0 }
                    if !pinned.isEmpty { agentSection("Pinned", pinned) }
                    if !unread.isEmpty { agentSection("Unread", unread) }
                    agentSection("Recent", recent)
                }.listStyle(.plain).scrollContentBackground(.hidden).refreshable { await refresh() }
            }
        }
        .background(Color(uiColor: .systemBackground))
        .overlay(alignment: .trailing) { Rectangle().fill(Color.primary.opacity(0.13)).frame(width: 0.5) }
        .shadow(color: .black.opacity(0.22), radius: 20, x: 6)
        .ignoresSafeArea(edges: .bottom)
    }

    @ViewBuilder private var folderStrip: some View {
        let folders = Array(Set(allAgents.map { URL(fileURLWithPath: $0.workspaceDir).lastPathComponent.isEmpty ? "No workspace" : URL(fileURLWithPath: $0.workspaceDir).lastPathComponent })).sorted()
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                folderChip("All", selected: selectedFolder == nil) { selectedFolder = nil }
                ForEach(folders, id: \.self) { folder in folderChip(folder, selected: selectedFolder == folder) { selectedFolder = folder } }
            }.padding(.horizontal, 12)
        }.frame(height: 38).padding(.bottom, 4)
    }
    private func folderChip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) { Label(title, systemImage: title == "All" ? "tray.full" : "folder").font(.caption.weight(.medium)).lineLimit(1).padding(.horizontal, 11).frame(height: 30).background(selected ? Color.accentColor : Color(uiColor: .secondarySystemBackground), in: Capsule()).foregroundStyle(selected ? Color.white : Color.primary) }.buttonStyle(.plain)
    }

    @ViewBuilder private func agentSection(_ title: String, _ items: [AgentSummary]) -> some View {
        if !items.isEmpty {
            Section {
                ForEach(items) { agent in
                    Button { select(agent) } label: { SidebarAgentRow(agent: agent) }.buttonStyle(.plain)
                        .listRowBackground(agent.id == selectedID ? Color.accentColor.opacity(0.12) : Color.clear)
                        .listRowSeparator(.hidden)
                        .swipeActions(edge: .leading) { Button { pin(agent, !agent.pinned) } label: { Label(agent.pinned ? "Unpin" : "Pin", systemImage: agent.pinned ? "pin.slash" : "pin") }.tint(.orange) }
                        .contextMenu { Button { pin(agent, !agent.pinned) } label: { Label(agent.pinned ? "Unpin" : "Pin", systemImage: agent.pinned ? "pin.slash" : "pin") } }
                }
            } header: { Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary).textCase(nil) }
        }
    }
}

private struct SidebarAgentRow: View {
    let agent: AgentSummary
    private var folder: String { URL(fileURLWithPath: agent.workspaceDir).lastPathComponent.isEmpty ? "No workspace" : URL(fileURLWithPath: agent.workspaceDir).lastPathComponent }
    var body: some View { HStack(spacing: 11) { ZStack { Circle().fill(agent.isRunning ? Color.green.opacity(0.16) : Color.primary.opacity(0.07)).frame(width: 38, height: 38); Image(systemName: agent.isRunning ? "sparkles" : "bubble.left").foregroundStyle(agent.isRunning ? .green : .secondary) }; VStack(alignment: .leading, spacing: 3) { HStack(spacing: 5) { if agent.pinned { Image(systemName: "pin.fill").font(.caption2).foregroundStyle(.orange) }; Text(agent.title).font(.subheadline.weight(.medium)).lineLimit(1).layoutPriority(1); Spacer(minLength: 4); if agent.unread > 0 { Circle().fill(.blue).frame(width: 9, height: 9) } }; Text(folder).font(.caption).foregroundStyle(.secondary).lineLimit(1) } }.contentShape(Rectangle()).padding(.vertical, 4) }
}

private struct EmptyHome: View { let open: () -> Void; var body: some View { NavigationStack { DotLoginBackground().overlay { VStack(spacing: 12) { Image(systemName: "chevron.left.2").font(.largeTitle).foregroundStyle(.secondary); Text("Choose a chat").font(.headline); Button("Open chats", action: open).buttonStyle(.borderedProminent) } }.toolbar { ToolbarItem(placement: .topBarLeading) { Button(action: open) { Image(systemName: "line.3.horizontal").frame(width: 38, height: 38).hyperGlass(Circle(), interactive: true) } } }.navigationTitle("").navigationBarTitleDisplayMode(.inline) } } }

private struct NativeLoginView: View { @Binding var password: String; let error: String?; let isLoading: Bool; let submit: () -> Void; @FocusState private var focused: Bool; var body: some View { VStack(spacing: 18) { Spacer(); Image(systemName: "lock.shield.fill").font(.system(size: 46)).foregroundStyle(.indigo); VStack(spacing: 5) { Text("Sign in").font(.title2.bold()); Text("Enter the tunnel access password.").foregroundStyle(.secondary) }; SecureField("Password", text: $password).textContentType(.password).submitLabel(.go).onSubmit(submit).focused($focused).padding(14).hyperGlass(RoundedRectangle(cornerRadius: 14), interactive: true); if let error { Text(error).font(.caption).foregroundStyle(.red) }; Button(action: submit) { HStack { if isLoading { ProgressView().tint(.white) }; Text("Sign in").fontWeight(.semibold) }.frame(maxWidth: .infinity).frame(height: 48).background(.indigo, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white) }.disabled(password.isEmpty || isLoading); Spacer() }.padding(24).background(DotLoginBackground()).task { focused = true } } }
struct DotLoginBackground: View { var body: some View { Color(.systemGroupedBackground).overlay(Canvas { context, size in var path = Path(); for y in stride(from: 8.0, to: size.height, by: 16) { for x in stride(from: 8.0, to: size.width, by: 16) { path.addEllipse(in: .init(x: x-1, y: y-1, width: 2, height: 2)) } }; context.fill(path, with: .color(.secondary.opacity(0.13))) }).ignoresSafeArea() } }

struct NativeSettingsView: View { @Binding var serverURL: String; let connected: () -> Void; @State private var draft: String; @Environment(\.dismiss) private var dismiss; init(serverURL: Binding<String>, connected: @escaping () -> Void) { _serverURL = serverURL; self.connected = connected; _draft = State(initialValue: serverURL.wrappedValue) }; var body: some View { NavigationStack { Form { Section("Server") { TextField("https://hyper.tunnel.apki.dev", text: $draft).textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL) }; Section { Button("Connect") { serverURL = draft.trimmingCharacters(in: .whitespacesAndNewlines); connected(); dismiss() }.disabled(URL(string: draft)?.scheme == nil) } }.navigationTitle("Connection").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } } } } }
