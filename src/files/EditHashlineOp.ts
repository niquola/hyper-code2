export type EditHashlineOp =
    | { kind: "insert_before" | "insert_after"; anchor: string | "BOF" | "EOF"; lines: string[] }
    | { kind: "delete"; start: string; end?: string }
    | { kind: "replace"; start: string; end?: string; lines: string[] }
    | { kind: "literal_replace"; old: string; replacement: string; all: boolean };
