export type Content =
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "document"; data: string; mimeType: "application/pdf"; fileName: string; extractedText?: string; path?: string }
    | { type: "image_ref"; attachmentId: string; fileName: string; mimeType: string; size: number }
    | { type: "document_ref"; attachmentId: string; fileName: string; mimeType: string; size: number };
