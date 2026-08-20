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
    @State private var provider = ""
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Agent") {
                    TextField("Name (optional)", text: $title)
                    Picker("Provider", selection: $provider) {
                        ForEach(providers, id: \.self) { Text($0).tag($0) }
                    }
                    Picker("Model", selection: $model) {
                        ForEach(modelsForProvider) { item in Text(modelLabel(item.model)).tag(item.model) }
                    }
                    .disabled(provider.isEmpty)
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
        .onChange(of: provider) { _, newProvider in
            if !modelsForProvider.contains(where: { $0.model == model }) {
                model = (options?.models.first { $0.provider == newProvider })?.model ?? ""
            }
        }
    }

    private var providers: [String] {
        Array(Set((options?.models ?? []).map(\.provider))).sorted()
    }

    private var modelsForProvider: [MobileModel] {
        (options?.models ?? []).filter { $0.provider == provider }
    }

    private func modelLabel(_ value: String) -> String {
        value.split(separator: ":", maxSplits: 1).last.map(String.init) ?? value
    }

    private func loadOptions() async {
        loading = true; defer { loading = false }
        do {
            let value = try await APIClient(baseURL: baseURL).newAgentOptions()
            options = value
            let defaultItem = value.models.first { $0.model == value.defaultModel } ?? value.models.first
            provider = defaultItem?.provider ?? ""
            model = defaultItem?.model ?? ""
            workspace = value.workspaces.first ?? ""
        } catch { self.error = error.localizedDescription }
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
