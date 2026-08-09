// Return the server-side list of "open" file tabs.
export default function (ctx: Context, _session: Session | null, _opts?: {}): string[] {
    return ((ctx.state as any).files?.open ?? []) as string[];
}
