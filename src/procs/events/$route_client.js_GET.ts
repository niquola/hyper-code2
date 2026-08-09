// Inlined at build time (text import) so the prod bundle serves it with no
// filesystem read — a single dist/app.js is fully self-contained.
import clientJs from "./client.js" with { type: "text" };

export default function (_ctx: Context, _session: Session, _opts: { req: Request }) {
    return new Response(clientJs as unknown as string, { headers: { "content-type": "application/javascript; charset=utf-8" } });
}
