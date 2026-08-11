// Typecheck one eval body against the live project's declarations before it runs.
// This is an in-process TypeScript Language Service (not an LSP process): the
// first call builds the project graph, subsequent virtual-file revisions reuse it.
import { join } from "node:path";

export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { code: string; bindings?: Record<string, any> },
): Promise<{ ok: boolean; errors: string[] }> {
    const root = ctx.fns.procs.project.projectRoot({});
    const procs = ctx.state.procs as any;
    const state = (procs.repl ??= {});
    let holder = state.typecheck as {
        root: string; configPath: string; configMtime: number;
        service: any; ts: any; evalFile: string; source: string; version: number;
    } | undefined;
    const currentConfigPath = holder?.root === root && holder.configPath
        ? holder.configPath
        : join(root, "tsconfig.json");
    const currentConfigMtime = Bun.file(currentConfigPath).lastModified;

    if (!holder || holder.root !== root || holder.configMtime !== currentConfigMtime) {
        holder?.service?.dispose();
        const ts = await import("typescript");
        const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
        if (!configPath) return { ok: false, errors: [`typecheck: no tsconfig.json under ${root}`] };
        const config = ts.readConfigFile(configPath, ts.sys.readFile);
        if (config.error) return { ok: false, errors: [formatDiagnostic(ts, config.error, 0)] };
        const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
        const evalFile = join(root, ".hyper", "_runtime", "eval", "__virtual_eval.ts");
        holder = { root, configPath, configMtime: Bun.file(configPath).lastModified, ts, evalFile, source: "", version: 0, service: null };
        const h = holder;
        const projectFiles = parsed.fileNames.filter((file: string) => file !== evalFile);
        const host = {
            getCompilationSettings: () => parsed.options,
            getScriptFileNames: () => [...projectFiles, evalFile],
            getScriptVersion: (file: string) => file === evalFile
                ? String(h.version)
                : String(ts.sys.getModifiedTime?.(file)?.getTime() ?? 0),
            getScriptSnapshot: (file: string) => {
                if (file === evalFile) return ts.ScriptSnapshot.fromString(h.source);
                const text = ts.sys.readFile(file);
                return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
            },
            getCurrentDirectory: () => root,
            getDefaultLibFileName: (options: any) => ts.getDefaultLibFilePath(options),
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            readDirectory: ts.sys.readDirectory,
            directoryExists: ts.sys.directoryExists,
            getDirectories: ts.sys.getDirectories,
        };
        h.service = ts.createLanguageService(host, ts.createDocumentRegistry());
        state.typecheck = holder;
    }

    const bindingParams = Object.keys(opts.bindings ?? {}).map(name => {
        if (!/^[$A-Z_a-z][$\w]*$/.test(name)) throw new TypeError(`eval: invalid binding name ${JSON.stringify(name)}`);
        return `${name}: ${name === "agent" ? "types.agent.Agent" : "any"}`;
    });
    const standardParams = [
        "ctx: Context",
        "session: Session | null",
        "console: Console",
        "print: (...args: any[]) => void",
    ];
    const headerLines = 2;
    holder.source = `export {};\nasync function __repl(${[...standardParams, ...bindingParams].join(", ")}) {\n${opts.code}\n}`;
    holder.version++;

    const syntactic = holder.service.getSyntacticDiagnostics(holder.evalFile)
        .filter((d: any) => d.category === holder.ts.DiagnosticCategory.Error);
    if (syntactic.length) {
        const errors = syntactic.map((d: any) => formatDiagnostic(holder!.ts, d, headerLines));
        return { ok: false, errors };
    }
    const errors = holder.service.getSemanticDiagnostics(holder.evalFile)
        .filter((d: any) => d.category === holder.ts.DiagnosticCategory.Error)
        .map((d: any) => formatDiagnostic(holder!.ts, d, headerLines));
    return { ok: errors.length === 0, errors };
}

function formatDiagnostic(ts: any, diagnostic: any, headerLines: number): string {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (!diagnostic.file || diagnostic.start == null) return message;
    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${Math.max(1, pos.line + 1 - headerLines)}:${pos.character + 1} ${message}`;
}
