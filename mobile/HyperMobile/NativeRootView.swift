import SwiftUI

struct NativeRootView: View {
    @AppStorage("hyper.serverURL") private var serverURL = "http://localhost:3010"
    @StateObject private var store = AgentListStore()
    @State private var showingSettings = false
    @State private var showingWeb = false

    private var baseURL: URL? { URL(string: serverURL) }

    var body: some View {
        NavigationStack {
            Group {
                if store.isLoading && store.agents.isEmpty { ProgressView("Connecting to Hyper…") }
                else if let error = store.error, store.agents.isEmpty { ContentUnavailableView("Can’t reach Hyper", systemImage: "bolt.horizontal.circle", description: Text(error)) }
                else {
                    List(store.agents) { agent in
                        NavigationLink(value: agent) { AgentRow(agent: agent) }
                    }
                    .listStyle(.plain)
                    .refreshable { await reload() }
                }
            }
            .navigationTitle("Hyper")
            .navigationDestination(for: AgentSummary.self) { agent in
                if let baseURL { NativeChatView(agent: agent, baseURL: baseURL) }
            }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { showingWeb = true } label: { Image(systemName: "safari") }.accessibilityLabel("Open web interface")
                    Button { showingSettings = true } label: { Image(systemName: "gearshape") }.accessibilityLabel("Connection settings")
                }
            }
        }
        .task { await reload() }
        .sheet(isPresented: $showingSettings) { NativeSettingsView(serverURL: $serverURL) { Task { await reload() } } }
        .sheet(isPresented: $showingWeb) { NavigationStack { HyperWebViewScreen(urlString: serverURL) } }
    }

    private func reload() async {
        guard let baseURL else { store.error = "Invalid server URL"; return }
        await store.load(baseURL: baseURL)
    }
}

private struct AgentRow: View {
    let agent: AgentSummary
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(agent.isRunning ? Color.green.opacity(0.16) : Color.secondary.opacity(0.12)).frame(width: 42, height: 42)
                Image(systemName: agent.isRunning ? "sparkles" : "bubble.left.and.bubble.right").foregroundStyle(agent.isRunning ? .green : .secondary)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack { Text(agent.title).font(.headline).lineLimit(1); if agent.unread > 0 { Text("\(agent.unread)").font(.caption2.bold()).padding(.horizontal, 7).padding(.vertical, 3).background(.blue, in: Capsule()).foregroundStyle(.white) } }
                Text(agent.model).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            if agent.isRunning { ProgressView().controlSize(.small) }
        }.padding(.vertical, 5)
    }
}

struct NativeSettingsView: View {
    @Binding var serverURL: String
    let connected: () -> Void
    @State private var draft: String
    @Environment(\.dismiss) private var dismiss
    init(serverURL: Binding<String>, connected: @escaping () -> Void) { _serverURL = serverURL; self.connected = connected; _draft = State(initialValue: serverURL.wrappedValue) }
    var body: some View {
        NavigationStack {
            Form {
                Section("Hyper server") {
                    TextField("http://192.168.1.2:3010", text: $draft)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }
                Section {
                    Button("Connect") {
                        serverURL = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                        connected()
                        dismiss()
                    }
                    .disabled(URL(string: draft)?.scheme == nil)
                } footer: {
                    Text("Use localhost in Simulator, or the Mac’s LAN address on iPhone.")
                }
            }
            .navigationTitle("Connection")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}
