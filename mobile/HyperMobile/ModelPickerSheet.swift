import SwiftUI

struct ModelPickerSheet: View {
    let baseURL: URL
    let agentID: String
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss
    @State private var options: NewAgentOptions?
    @State private var changing = false
    @State private var error: String?

    private var providers: [String] { Array(Set((options?.models ?? []).map(\.provider))).sorted() }

    var body: some View {
        NavigationStack {
            Group {
                if let options {
                    List {
                        ForEach(providers, id: \.self) { provider in
                            Section(provider) {
                                ForEach(options.models.filter { $0.provider == provider }) { item in
                                    Button { change(item.model) } label: {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(label(item.model)).foregroundStyle(.primary)
                                                Text(provider).font(.caption).foregroundStyle(.secondary)
                                            }
                                            Spacer()
                                            if item.model == selection { Image(systemName: "checkmark").font(.headline).foregroundStyle(.blue) }
                                        }.contentShape(Rectangle())
                                    }.buttonStyle(.plain).disabled(changing)
                                }
                            }
                        }
                    }.listStyle(.insetGrouped)
                } else { ProgressView("Loading models…") }
            }
            .navigationTitle("Select model").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button { dismiss() } label: { Image(systemName: "xmark").frame(width: 36, height: 36).background(Color(.secondarySystemBackground), in: Circle()) } } }
            .overlay { if changing { ProgressView().padding(16).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 13)) } }
            .alert("Model", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) { Button("OK") { error = nil } } message: { Text(error ?? "") }
        }
        .presentationDetents([.medium, .large])
        .task { do { options = try await APIClient(baseURL: baseURL).newAgentOptions() } catch { self.error = error.localizedDescription } }
    }

    private func label(_ model: String) -> String { model.split(separator: ":", maxSplits: 1).last.map(String.init) ?? model }
    private func change(_ model: String) {
        changing = true
        Task {
            do { _ = try await APIClient(baseURL: baseURL).changeModel(agentID: agentID, model: model); selection = model; dismiss() }
            catch { self.error = error.localizedDescription }
            changing = false
        }
    }
}
