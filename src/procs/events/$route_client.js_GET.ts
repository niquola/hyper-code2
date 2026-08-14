// The browser half of the event stream.
//
// The text import inlines the file at BUILD time, which is what makes a
// production bundle self-contained — but in dev it also freezes the script at
// the moment this module was first imported. Editing client.js then changed
// nothing in the browser: the server kept serving the old snapshot, and hours
// went into chasing a bug that had already been fixed. So in dev the file is
// read from disk, and the inlined copy is the fallback a bundle uses.
import clientJs from "./client.js" with { type: "text" };
import { resolve } from "node:path";

const PATH = resolve(import.meta.dir, "client.js");

/**
 * Handle the GET request for the events route.
 * @param _opts.req The incoming HTTP request.
 */
export default async function (ctx: Context, _session: Session, _opts: { req: Request }) {
    const file = Bun.file(PATH);
    const body = ctx.env.NODE_ENV === "production" || !(await file.exists())
        ? (clientJs as unknown as string)
        : await file.text();
    return new Response(body, {
        headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-cache",
        },
    });
}
