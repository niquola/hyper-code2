// fetch with a connect deadline that does NOT kill a long stream: the race
// covers only fetch() itself (it resolves at response headers); body streaming
// is watched by parseSSE's idle timeout instead. Composing AbortSignal.timeout
// into the fetch signal aborted legitimate generations mid-stream at 45s.
/** Performs the llm.connectFetch runtime operation. */
/**
 * fetch with a connect deadline that does NOT kill a long stream: the race.
 * @param opts.url URL to fetch or connect to.
 * @param opts.init Value for init.
 * @param opts.ms Connection timeout in milliseconds.
 */
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: {
        /** Endpoint URL. */ url: string;
        /** Fetch request options. */ init: RequestInit;
        /** Value used for the ms option. */ ms?: number },
): Promise<Response> {
    const ms = opts.ms ?? 45_000;
    return Promise.race([
        fetch(opts.url, opts.init),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no response from provider in ${ms / 1000}s`)), ms)),
    ]);
}
