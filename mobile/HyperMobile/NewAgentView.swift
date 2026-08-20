import SwiftUI

struct NewAgentView: View {
    let baseURL: URL
    let created: (CreatedAgent) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var options: NewAgentOptions?
    @State private var title = ""
    @State private var workspace = ""
    @State private var model = ""
    @State private var systemPrompt = ""
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Agent") {
                    TextField("Name (optional)", text: $title)
                    Picker("Model", selection: $model) {
                        if model.isEmpty { Text("Default").tag("") }
                        ForEach(options?.models ?? []) { item in Text(item.model).tag(item.model) }
                    }
                }
                Section("Workspace") {
                    Picker("Recent folder", selection: $workspace) {
                        Text("Default workspace").tag("")
                        ForEach(options?.workspaces ?? [], id: \.self) { Text(URL(fileURLWithPath: $0).lastPathComponent).tag($0) }
                    }
                    TextField("Or enter full path", text: $workspace).textInputAutocapitalization(.never).autocorrectionDisabled()
                }
                Section("Instructions") {
                    TextField("Optional system instructions", text: $systemPrompt, axis: .vertical).lineLimit(3...8)
                }
                if let error { Section { Text(error).foregroundStyle(.red).font(.caption) } }
            }
            .navigationTitle("New agent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { create() }.fontWeight(.semibold).disabled(loading || options == nil)
                }
            }
            .overlay { if loading { ProgressView().padding(18).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14)) } }
        }
        .presentationDetents([.large])
        .task { await loadOptions() }
    }

    private func loadOptions() async {
        loading = true; defer { loading = false }
        do { let value = try await APIClient(baseURL: baseURL).newAgentOptions(); options = value; model = value.defaultModel; workspace = value.workspaces.first ?? "" }
        catch { self.error = error.localizedDescription }
    }

    private func create() {
        loading = true; error = nil
        Task {
            do {
                let agent = try await APIClient(baseURL: baseURL).createAgent(title: title, workspaceDir: workspace, model: model, systemPrompt: systemPrompt)
                created(agent)
            } catch { self.error = error.localizedDescription }
            loading = false
        }
    }
}
