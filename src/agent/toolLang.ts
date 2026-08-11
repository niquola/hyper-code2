// Which grammar a tool call's arguments and result should be highlighted with.
//
// The card knows the tool and its arguments, so it can say this properly
// instead of guessing: a read of a .py file is Python, a bash command is shell,
// its output is plain text, grep rows are plain text. Highlighting everything
// non-JSON as JavaScript (what we did before) mis-colours every one of those —
// `def` reads as an identifier, a shell flag reads as a regex.
const BY_EXT: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "jsx",
    json: "json", md: "markdown", css: "css", html: "html", xml: "xml", svg: "xml",
    sql: "sql", py: "python", rs: "rust", go: "go", java: "java",
    yaml: "yaml", yml: "yaml", toml: "toml", sh: "bash", bash: "bash", zsh: "bash",
    dockerfile: "dockerfile", diff: "diff", patch: "diff",
};

export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { name: string; args?: any; part: "args" | "result" },
): string {
    const name = String(opts.name ?? "");
    const args = opts.args ?? {};

    if (opts.part === "args") {
        // The interesting argument is code or a file body; everything else is
        // the JSON envelope, which is honestly JSON.
        if (name === "eval") return "typescript";
        if (name === "bash") return "bash";
        if (name === "write") return byPath(args.path) ?? "text";
        return "json";
    }

    if (name === "read") return byPath(args.path) ?? "text";
    if (name === "eval") return "typescript";
    // bash output, grep rows, "edited x (3 edits)" — prose and paths, not code.
    return "text";
}

function byPath(path: any): string | null {
    const ext = String(path ?? "").split(".").pop()?.toLowerCase() ?? "";
    const base = String(path ?? "").split("/").pop()?.toLowerCase() ?? "";
    if (base === "dockerfile") return "dockerfile";
    return BY_EXT[ext] ?? null;
}
