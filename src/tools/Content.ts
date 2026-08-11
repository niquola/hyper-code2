export type Content =
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string };
