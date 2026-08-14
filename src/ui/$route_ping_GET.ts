/** Handles the HTTP route ping GET endpoint. */
export default async function (_ctx: Context, _session: Session | null, _opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    return Response.json({ ok: true, ui: 'control' });
}
