// A tiny line — a trend in the space of a word. Points are plotted edge to edge;
// the tone tints the stroke. No axes, no labels — the number lives elsewhere.
export default function (_ctx: Context, _session: Session | null, opts: { values: number[]; tone?: "info" | "success" | "warning" | "danger"; class?: string }): string {
    const v = opts.values.filter(n => typeof n === "number");
    if (v.length < 2) return `<svg class="${opts.class ?? "h-8 w-24"}" aria-hidden="true"></svg>`;
    const [min, max] = [Math.min(...v), Math.max(...v)];
    const span = max - min || 1;
    const step = 100 / (v.length - 1);
    const d = v.map((n, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(28 - ((n - min) / span) * 26).toFixed(1)}`).join(" ");
    const stroke = opts.tone ? `var(--color-state-${opts.tone}-fg)` : "var(--color-brand)";
    return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" class="${opts.class ?? "h-8 w-24"}" aria-hidden="true"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}
