import SwiftUI
import UIKit

struct CameraPicker: UIViewControllerRepresentable {
    let completion: (Result<PendingAttachment, Error>) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: CameraPicker
        init(parent: CameraPicker) { self.parent = parent }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            defer { parent.dismiss() }
            guard let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.88) else {
                parent.completion(.failure(NSError(domain: "Hyper", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not read captured photo"])))
                return
            }
            parent.completion(.success(.init(id: UUID(), name: "camera-\(Int(Date().timeIntervalSince1970)).jpg", contentType: "image/jpeg", data: data)))
        }
    }
}
