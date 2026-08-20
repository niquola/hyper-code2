import SwiftUI

struct InjectEditorSheet: View {
    let baseURL: URL
    let agentID: String
    @Binding var text: String
    @Binding var every: Int
    @Environment(\.dismiss) private var dismiss
    @State private var draft = ""
    @State private var draftEvery = 1
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Prompt inject") {
                    TextField("Short instruction applied to the agent", text: $draft, axis: .vertical).lineLimit(4...9)
                    Stepper("Apply every \(draftEvery) turn\(draftEvery == 1 ? "" : "s")", value: $draftEvery, in: 1...100)
                }
                Section { Button("Clear", role: .destructive) { draft = "" } } footer: { Text("This instruction is injected into the model prompt at the selected interval.") }
                if let error { Text(error).font(.caption).foregroundStyle(.red) }
            }
            .navigationTitle("Prompt inject").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.fontWeight(.semibold).disabled(loading) }
            }
            .overlay { if loading { ProgressView() } }
        }
        .presentationDetents([.medium, .large])
        .task { await load() }
    }

    private func load() async {
        loading = true; defer { loading = false }
        do { let value = try await APIClient(baseURL: baseURL).inject(agentID: agentID); draft = value.text; draftEvery = value.every }
        catch { self.error = error.localizedDescription }
    }
    private func save() {
        loading = true
        Task { do { let value = try await APIClient(baseURL: baseURL).setInject(agentID: agentID, text: draft, every: draftEvery); text = value.text; every = value.every; dismiss() } catch { self.error = error.localizedDescription }; loading = false }
    }
}
