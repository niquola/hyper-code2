export type ReadHashlineResult = {
    path: string;
    content: string;
    lines: types.files.ReadAnchorLine[];
    text: string;
    truncated?: boolean;
    startLine: number;
    endLine: number;
    totalLines: number;
};