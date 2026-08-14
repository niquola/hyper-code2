// One-shot HTMX sink for secureInput.prompt. Never log or echo the value.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: { id: string } }) {
    const id = String(opts.params.id ?? "");
    const prompt = (ctx.state as any).secureInput?.prompts?.get(id);
    // An old tab may submit after another tab already answered. Empty 200 makes
    // the stale modal disappear without exposing lifecycle details.
    if (!prompt) return new Response("", { status: 200 });

    const form = await opts.req.formData();
    if (form.get("cancel")) {
        (ctx.state as any).secureInput.prompts.delete(id);
        prompt.reject(new Error("transient input prompt cancelled"));
        return new Response("", { status: 200 });
    }

    let value = String(form.get("value") ?? "");
    if (prompt.kind !== "password") value = value.trim();
    if (!value) return new Response(ctx.fns.secureInput.render({ prompt, error: "Value is required" }), { status: 200 });
    if (prompt.kind === "otp" && !/^[0-9 -]{3,16}$/.test(value)) return new Response(ctx.fns.secureInput.render({ prompt, error: "Enter the numeric code" }), { status: 200 });

    (ctx.state as any).secureInput.prompts.delete(id);
    prompt.resolve(prompt.kind === "otp" ? value.replace(/[ -]/g, "") : value);
    return new Response("", { status: 200 });
}
