/** Serves the live provider/account cards on the LLM connections page. */
export default async function (ctx: Context, _session: Session | null, _opts: { req?: Request }) {
    const [accounts, logins] = await Promise.all([
        ctx.fns.llm.listAccounts({}),
        Promise.resolve(ctx.fns.llm.accountLoginStatus({})),
    ]);
    return new Response(ctx.fns.llms.accountsCard({ accounts, logins }), { headers: { "content-type": "text/html; charset=utf-8" } });
}
