// Compile one `$style_<name>.css` with Tailwind into a cached file and return
// its path. The input carries theme tokens and rules; this wraps it with the
// framework import, the typography module and an `@source` per scan root — so the
// same file compiles whether it lives in the workspace or in a project under
// WORKDIR, and it is scanned against every class the whole workspace can render.
//
// Both the wrapper and the output live inside this repo (next to node_modules),
// because the Tailwind CLI resolves `tailwindcss` from the input file's
// directory — a style file under WORKDIR could not resolve it on its own. It is
// compiled once per run and cached for the rest of it; `styles.rebuild` forces
// another after a hot reload.
import { mkdir } from "node:fs/promises";

/**
 * Build the styles subsystem operation.
 * @param opts.abs The abs value used by the operation.
 * @param opts.key The lookup key.
 * @param opts.force Whether to bypass normal safety checks.
 */
export default async function (ctx: Context, _session: Session | null, opts: { abs: string; key: string; force?: boolean }): Promise<string> {
    const repo = ctx.fns.procs.project.projectRoot({});
    // What this run already compiled. Not a file check: the sheet is generated
    // from every class in the tree, so one left over from an earlier run is only
    // right by accident — and being right by accident is how a workspace served
    // a stylesheet with no `flex-col-reverse` in it and laid a conversation out
    // sideways. Once per process, and `styles.rebuild` asks for another.
    const record = (ctx.state.procs.styles ?? []).find((s: any) => s.key === opts.key);
    const modules = await ctx.fns.procs.modules.discover({});
    const sources = [...new Set(modules.map((r: any) => r.dir))].map(dir => `@source ${JSON.stringify(dir)};`).join("\n");

    // Tailwind resolves `@import "tailwindcss"` from the INPUT FILE's directory
    // upward — not from the process's cwd — so the generated input lives inside
    // the framework's own package, where the dependency is. Keyed by the app, so
    // two apps built by one framework never share a file.
    const framework = new URL("../../..", import.meta.url).pathname.replace(/\/$/, "");
    const dir = `${framework}/.runtime-tw/${repo.split("/").pop()}`;
    await mkdir(dir, { recursive: true });
    const input = `${dir}/${opts.key}.in.css`;
    const output = `${dir}/${opts.key}.css`;
    // `@plugin`, not `@module`: the latter is not a Tailwind directive, so it
    // compiled to nothing and every `prose` class in the tree — the chat's
    // markdown, the file browser's — had no rules behind it.
    // daisyUI is the design system: it ships the component classes (`btn`,
    // `card`, `alert`) and the `base-*`/`primary`/`info`… theme variables every
    // `$style` file then names. A framework-level plugin like typography, so a
    // stylesheet gets it wherever it lives.
    const wrapper = `@import "tailwindcss";\n@plugin "@tailwindcss/typography";\n@plugin "daisyui" {\n  themes: light --default, dark --prefersdark;\n}\n${sources}\n@import ${JSON.stringify(opts.abs)};\n`;
    if (!opts.force && record?.built === output && await Bun.file(output).exists()) return output;
    await Bun.write(input, wrapper);

    // Tailwind resolves `@import "tailwindcss"` from the input file's directory
    // upward, so the build runs where the dependency actually is — the framework's
    // own package. (An app that installs procs has it hoisted above both, and an
    // app whose node_modules is elsewhere would otherwise fail with "can't
    // resolve tailwindcss" and no stylesheet at all.)
    // `--bun` runs the CLI on bun rather than whatever `node` is on PATH: the
    // native lightningcss it loads is the one bun installed, for bun's own
    // architecture. (An x64 node on an arm64 mac otherwise fails to resolve it,
    // and the only symptom is a 500 on the stylesheet.)
    const proc = Bun.spawn(["bunx", "--bun", "@tailwindcss/cli", "-i", input, "-o", output, "--minify"], { cwd: framework, stdout: "pipe", stderr: "pipe" });
    const err = await new Response(proc.stderr).text();
    if (await proc.exited !== 0) throw new Error(`tailwind build failed for ${opts.abs}:\n${err.trim()}`);
    if (record) record.built = output;
    return output;
}
