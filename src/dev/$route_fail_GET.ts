/**
 * Provides an intentionally failing HTTP endpoint for diagnostics.
 * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
 */
export default async function (_ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) { throw new Error('boom-test-route'); }
