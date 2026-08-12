// One-shot sink for secrets.prompt. Never log the request or echo its value.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: { id: string } }) {
    const id = String(opts.params.id ?? "");
    const prompt = (ctx.state as any).secrets?.prompts?.get(id);
    if (!prompt) return new Response("Prompt expired", { status: 404 });
    const form = await opts.req.formData();
    if (form.get("cancel")) {
        (ctx.state as any).secrets.prompts.delete(id);
        prompt.reject(new Error("secret prompt cancelled"));
        return new Response(null, { status: 204 });
    }
    let value = String(form.get("value") ?? "");
    if (prompt.kind !== "password") value = value.trim();
    if (!value) return new Response("Value is required", { status: 400 });
    if (prompt.kind === "otp" && !/^[0-9 -]{3,16}$/.test(value)) return new Response("Enter the numeric code", { status: 400 });
    // Delete immediately before resolving: duplicate valid submits cannot reuse it.
    (ctx.state as any).secrets.prompts.delete(id);
    prompt.resolve(prompt.kind === "otp" ? value.replace(/[ -]/g, "") : value);
    return new Response(null, { status: 204 });
}
