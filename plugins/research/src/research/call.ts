/**
 * Executes a same-origin request against Consensus inside the attached logged-in
 * Chrome tab. Use as the transport for research.start/search/ask or to inspect a
 * documented internal endpoint without exposing browser cookies.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Consensus path beginning with `/`, for example `/api/threads/`. */
        path: string;
        /** HTTP method. @default "GET" */
        method?: "GET" | "POST" | "DELETE";
        /** JSON request body for non-GET methods. */
        body?: Record<string, any>;
        /** Logical Chrome session used for Consensus authentication. @default "research-consensus" */
        session?: string;
        /** Return status/headers envelope instead of only parsed JSON. @default false */
        raw?: boolean;
    },
): Promise<any> {
    const session = opts.session ?? "research-consensus";
    const path = String(opts.path ?? "").trim();
    if (!path) throw new Error("research.call: path is required");
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const method = opts.method ?? "GET";

    let href = "";
    try {
        href = String(await ctx.fns.browser.evaluate({ session, expression: "location.href" }) ?? "");
    } catch {
        // A named browser session is created lazily by navigate below.
    }
    if (!href.includes("consensus.app")) {
        await ctx.fns.browser.navigate({ url: "https://consensus.app/search/", session, settleMs: 1500 });
    }

    const payload = JSON.stringify({ path: normalizedPath, method, body: opts.body ?? null });
    const result: any = await ctx.fns.browser.evaluate({
        session,
        awaitPromise: true,
        expression: `(async () => {
            const input = ${payload};
            const headers = { accept: "application/json" };
            let body;
            if (input.method !== "GET" && input.body !== null) {
                headers["content-type"] = "application/json";
                body = JSON.stringify(input.body);
            }
            const response = await fetch("https://consensus.app" + input.path, {
                method: input.method,
                credentials: "include",
                headers,
                body,
            });
            const text = await response.text();
            let json = null;
            try { json = JSON.parse(text); } catch {}
            return { status: response.status, ok: response.ok, json, text: json ? undefined : text.slice(0, 500) };
        })()`,
    });

    if (!result?.ok) {
        const detail = result?.text ?? JSON.stringify(result?.json ?? {}).slice(0, 300);
        throw new Error(`research.call ${method} ${normalizedPath} returned ${result?.status}: ${detail}. Log in at consensus.app in Chrome.`);
    }
    return opts.raw ? result : result.json;
}
