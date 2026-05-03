export default async function () {
    const ctx = {
        env: { ...process.env },
        state: {},
        fns: {} as FnsRegistry,
        routes: {},
    } as Context;

    const { default: loadFns } = await import("./loadFns");
    await loadFns(ctx);
    await ctx.genTypes(ctx);
    ctx.fns.db.connect(ctx, { path: ctx.env.DB_PATH ?? ".hyper/_runtime/sessions" });
    await ctx.fns.db.migrate(ctx);
    const rehydrated = ctx.fns.session.loadAll(ctx);
    console.log(`[session] rehydrated ${rehydrated.loaded} agent(s)`);
    await ctx.fns.http.loadRoutes(ctx);
    await ctx.fns.http.start(ctx);

    // Single process-wide worker drains agent_jobs for all agents.
    queueMicrotask(() => {
        ctx.fns.agent.workerLoop(ctx).catch((e: any) => console.error('[workerLoop] crashed:', e?.message ?? e));
    });
    console.log('[worker] started');

    return ctx;
}

if (import.meta.main) {
    const main = (await import("./$main.ts")).default;
    const ctx = await main();
    (globalThis as any).ctx = ctx;
    console.log("\nctx keys:", Object.keys(ctx));
    console.log("ctx.fns:", JSON.stringify(mapShape(ctx.fns), null, 2));
}

function mapShape(obj: any): any {
    if (typeof obj === "function") return "[fn]";
    if (obj && typeof obj === "object") {
        const out: any = {};
        for (const k of Object.keys(obj)) out[k] = mapShape(obj[k]);
        return out;
    }
    return typeof obj;
}
