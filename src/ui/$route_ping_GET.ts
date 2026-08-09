export default async function (_ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    return Response.json({ ok: true, ui: 'control' });
}
