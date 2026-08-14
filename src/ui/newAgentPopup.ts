export default async function (ctx: Context, session: Session | null, _opts: {}): Promise<Response> {
    const url = new URL(session?.req?.url ?? 'http://localhost/');
    url.pathname = '/agent/new';
    url.search = '?popup=1';
    const req = new Request(url, { headers: session?.req?.headers });
    const route = (ctx.state.procs.http.routes as any)?.['/agent/new']?.GET;
    if (typeof route !== 'function') return new Response('new agent popup unavailable', { status: 404 });
    const value = await route(ctx, session, { req, params: {} });
    return value instanceof Response ? value : new Response(String(value), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
