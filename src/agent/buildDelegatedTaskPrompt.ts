/**
 * Format the response contract instructions based on responseFormat option.
 */
function describeResponseFormat(responseFormat: any): string {
    if (!responseFormat || responseFormat === "text") {
        return [
            "Return a short parent-facing summary string.",
            "You may include a concise text result if useful.",
        ].join("\n");
    }
    if (responseFormat === "json") {
        return [
            "Call finishTask with:",
            "- summary: short parent-facing summary string",
            "- result: JSON-compatible object/array/value",
        ].join("\n");
    }
    if (responseFormat === "report") {
        return [
            "Call finishTask with:",
            "- summary: short parent-facing summary string",
            "- result: object with fields such as scope, result, files, issues",
        ].join("\n");
    }
    if (typeof responseFormat === "object") {
        const kind = responseFormat.kind ?? "json";
        const fields = Array.isArray(responseFormat.fields) && responseFormat.fields.length > 0
            ? responseFormat.fields.map((f: any) => String(f)).join(", ")
            : null;
        return [
            `Call finishTask with kind: ${kind}.`,
            "Always include a short parent-facing summary string.",
            fields ? `Preferred result fields: ${fields}` : "Return a concise structured result object.",
        ].join("\n");
    }
    return "Always include a short parent-facing summary string and a concise result if useful.";
}

export default function (ctx: Context, opts: { task: string; instructions?: string; responseFormat?: any }) {
    const extra = String(opts.instructions ?? "").trim();
/**
 * Build the system prompt for a delegated task child agent.
 * Constructs instructions about task scope, response format, and finishTask contract.
 */
    const lines = [
        "You are executing a delegated task for a parent agent.",
        "",
        "Rules:",
        "- Stay strictly within the assigned task.",
        "- Do not ask the user questions.",
        "- Do not fork/delegate further unless explicitly instructed.",
        "- Keep your work focused and concise.",
        "- When done, call ctx.fns.agent.finishTask(ctx, { agent, summary, result? }) via evalCode.",
        "- Do not dump large raw outputs into the transcript if a concise summary is enough.",
        "",
        "Task:",
        String(opts.task ?? "").trim(),
        "",
    ];
    if (extra) {
        lines.push("Additional instructions:");
        lines.push(extra);
        lines.push("");
    }
    lines.push("Required response contract:");
    lines.push(describeResponseFormat(opts.responseFormat));
    return lines.join("\n");
}
