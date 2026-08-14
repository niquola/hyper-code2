import { resolve } from "node:path";


export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const form = await opts.req.formData();
    const title = String(form.get("title") ?? "").trim().slice(0, 120);
    const requestedWorkspace = String(form.get("workspaceDir") ?? "");
    const createWorkspace = form.get("createWorkspaceDir") === "1";
    let workspaceDir: string;
    try {
        workspaceDir = await ctx.fns.workspace.normalize({ dir: requestedWorkspace, create: createWorkspace });
    } catch (error: any) {
        // The client-side status fragment is advisory: a fast submit can beat
        // its 250ms check. Never turn that race into a raw 500. Ask on the
        // server as the authoritative fallback and preserve the whole form.
        if (!createWorkspace && String(error?.message ?? "").startsWith("workspace directory not found:")) {
            const dir = resolve(requestedWorkspace.trim() || process.cwd());
            return confirmWorkspace(ctx, form, dir);
        }
        return new Response(String(error?.message ?? "Invalid workspace"), { status: 400 });
    }
    const model = (form.get("model") as string)?.trim()
        || (await ctx.fns.settings?.modelDefault?.({}))
        || ctx.env.MODEL
        || "minimax/minimax-m2.7";

    const presets = await ctx.fns.agent.listPromptPresets({});
    const selected = form.getAll("promptPreset")
        .map(x => String(x))
        .filter(id => Object.prototype.hasOwnProperty.call(presets, id));

    const presetText = selected
        .map(id => (presets as Record<string, { text?: string }>)[id]?.text?.trim())
        .filter(Boolean)
        .join("\n\n");

    const systemPromptRaw = (form.get("systemPrompt") as string)?.trim() || "";
    const systemPrompt = [presetText, systemPromptRaw].filter(Boolean).join("\n\n");

    const agent = await ctx.fns.agent.start({ model, title, workspaceDir, systemPrompt });
    // The next "+" preselects this — picking a model once is picking a default.
    await ctx.fns.procs.db.run({
        sql: "INSERT INTO kv (key, value) VALUES ('last-model', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        params: [model],
    }).catch(() => {});
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(agent.id)}` } });
}

function confirmWorkspace(ctx: Context, form: FormData, dir: string) {
    const esc = (value: any) => ctx.fns.procs.ui.escape({ text: value });
    const hidden = [...form.entries()]
        .filter(([name, value]) => name !== "createWorkspaceDir" && typeof value === "string")
        .map(([name, value]) => `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`)
        .join("");
    return {
        title: "create workspace",
        main: `<div class="flex flex-1 items-center justify-center p-6"><div class="w-full max-w-lg rounded-xl border border-amber-200 bg-white p-5 shadow-sm"><div class="flex items-start gap-3"><i class="ph ph-folder-plus mt-0.5 text-xl text-amber-600"></i><div><h1 class="font-semibold text-gray-900">Create workspace directory?</h1><p class="mt-2 text-sm text-gray-600">The directory does not exist:</p><code class="mt-2 block break-all rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-700">${esc(dir)}</code></div></div><form method="POST" action="/agent/new" hx-boost="false" class="mt-5 flex items-center gap-3">${hidden}<input type="hidden" name="createWorkspaceDir" value="1"><button class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">Create directory and agent</button><a href="/agent/new" class="text-sm text-gray-500 hover:text-gray-800">Cancel</a></form></div></div>`,
    };
}
