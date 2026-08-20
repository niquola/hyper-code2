import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct AttachmentComposer: View {
    @Binding var text: String
    @Binding var attachments: [PendingAttachment]
    var focused: FocusState<Bool>.Binding
    let sending: Bool, running: Bool
    let send: () -> Void, stop: () -> Void
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var showingFiles = false
    @State private var importError: String?

    private var canSend: Bool { (!text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachments.isEmpty) && !sending }

    var body: some View {
        VStack(spacing: 7) {
            if !attachments.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(attachments) { attachment in
                            HStack(spacing: 6) {
                                if attachment.isImage, let image = UIImage(data: attachment.data) { Image(uiImage: image).resizable().scaledToFill().frame(width: 32, height: 32).clipShape(RoundedRectangle(cornerRadius: 7)) }
                                else { Image(systemName: "doc.fill").foregroundStyle(.secondary) }
                                Text(attachment.name).font(.caption).lineLimit(1).frame(maxWidth: 120)
                                Button { attachments.removeAll { $0.id == attachment.id } } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                            }.padding(6).background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 11))
                        }
                    }.padding(.horizontal, 10)
                }
            }
            HStack(alignment: .bottom, spacing: 8) {
                Menu {
                    PhotosPicker(selection: $photoItems, maxSelectionCount: 10, matching: .images) { Label("Photo library", systemImage: "photo.on.rectangle") }
                    Button { showingFiles = true } label: { Label("Choose file", systemImage: "folder") }
                } label: {
                    Image(systemName: "plus").font(.headline).frame(width: 40, height: 40).background(Color(.secondarySystemGroupedBackground), in: Circle())
                }.accessibilityLabel("Add attachment")
                TextField("Message agent…", text: $text, axis: .vertical).lineLimit(1...6).focused(focused).padding(.horizontal, 13).padding(.vertical, 11).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
                if running { Button(action: stop) { Circle().fill(.red).frame(width: 44, height: 44).overlay(Image(systemName: "stop.fill").foregroundStyle(.white)) } }
                Button(action: send) { Circle().fill(canSend ? Color.accentColor : Color.secondary.opacity(0.35)).frame(width: 44, height: 44).overlay { if sending { ProgressView().tint(.white) } else { Image(systemName: "arrow.up").font(.headline.bold()).foregroundStyle(.white) } } }.disabled(!canSend)
            }.padding(.horizontal, 10)
            if let importError { Text(importError).font(.caption2).foregroundStyle(.red).padding(.horizontal) }
        }
        .padding(.vertical, 8).background(.bar)
        .onChange(of: photoItems) { _, items in Task { await loadPhotos(items) } }
        .fileImporter(isPresented: $showingFiles, allowedContentTypes: [.item], allowsMultipleSelection: true) { result in loadFiles(result) }
    }

    private func loadPhotos(_ items: [PhotosPickerItem]) async {
        for item in items.prefix(max(0, 10 - attachments.count)) {
            guard let data = try? await item.loadTransferable(type: Data.self), data.count <= 25 * 1024 * 1024 else { importError = "Each attachment must be at most 25 MB"; continue }
            let type = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            let ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
            attachments.append(.init(id: UUID(), name: "photo-\(attachments.count + 1).\(ext)", contentType: type, data: data))
        }
        photoItems = []
    }

    private func loadFiles(_ result: Result<[URL], Error>) {
        do {
            for url in try result.get().prefix(max(0, 10 - attachments.count)) {
                let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
                let data = try Data(contentsOf: url); guard data.count <= 25 * 1024 * 1024 else { throw NSError(domain: "Hyper", code: 1, userInfo: [NSLocalizedDescriptionKey: "Each attachment must be at most 25 MB"]) }
                let type = (try? url.resourceValues(forKeys: [.contentTypeKey]).contentType?.preferredMIMEType) ?? "application/octet-stream"
                attachments.append(.init(id: UUID(), name: url.lastPathComponent, contentType: type, data: data))
            }
        } catch { importError = error.localizedDescription }
    }
}
