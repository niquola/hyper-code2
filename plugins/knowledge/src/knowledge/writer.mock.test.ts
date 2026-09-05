import { test, expect } from "bun:test";

// Load standalone procedures without bootstrapping Hyper or opening any database connection.
const load = async (name: string) => {
    const source = await Bun.file(new URL(`./${name}.ts`, import.meta.url)).text();
    return new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(source).replace("export default", "return"))();
};
const mention = { id: "m1", type: "Organization", name: "日本会社", confidence: 1, evidence: "日本会社" };
const fixture = (scratchpad: object = {}, fail = false) => {
    let committed: string[] = [], pending: string[] = [];
    const tx = { unsafe: async (sql: string) => {
        if (sql.includes("SELECT scratchpad")) return [{ scratchpad }];
        if (sql.includes("WHERE type='Attribute'")) return [];
        if (sql.startsWith("SELECT id FROM")) return [];
        if (sql.startsWith("SELECT data FROM")) return [{ data: { title: mention.name } }];
        if (/^(INSERT|UPDATE)/.test(sql)) { pending.push(sql); if (fail && sql.includes("knowledge.provenance")) throw new Error("injected failure"); }
        return [];
    } };
    const ctx = { state: { agent: { parent: { scratchpad: {} } } }, fns: {
        procs: { db: {
            select: async () => [{ parent_id: null, fork_offset: null }],
            conn: async () => ({ begin: async (fn: (t: typeof tx) => Promise<unknown>) => { pending = []; try { const result = await fn(tx); committed.push(...pending); return result; } catch (e) { pending = []; throw e; } } }),
        } },
        session: { getMessages: async () => [{ role: "user", idx: 7, content: mention.name }] },
        knowledge: { resolveMentions: async ({ mentions }: { mentions: object[] }) => mentions.map(m => ({ mention: m, resolution: { status: "new", candidates: [] } })) },
        events: { refreshAgentMeta: () => {} },
    } };
    const session = { agent: { id: "child", parentId: "parent", scratchpad: { knowledgeSidecarFor: "parent", sourceMessageIdx: 7 } } };
    return { ctx, session, committed: () => committed };
};
test("writer duplicate checkpoint rejects before any mutation", async () => {
    const f = fixture({ knowledgeSidecar: { sourceMessageIdx: 7, status: "ready", sidecarId: "child" } });
    const r = await (await load("setObservedMentions"))(f.ctx, f.session, { mentions: [mention] });
    expect(r.written).toBe(0); expect(f.committed()).toEqual([]);
});
test("writer rejects fabricated evidence and duplicate IDs without writes", async () => {
    for (const mentions of [[{ ...mention, evidence: "fabricated" }], [mention, mention]]) {
        const f = fixture();
        await expect((await load("setObservedMentions"))(f.ctx, f.session, { mentions })).rejects.toThrow();
        expect(f.committed()).toEqual([]);
    }
});
test("writer rollback covers entity creation when provenance fails", async () => {
    const f = fixture({}, true);
    await expect((await load("setObservedMentions"))(f.ctx, f.session, { mentions: [mention] })).rejects.toThrow("injected failure");
    expect(f.committed()).toEqual([]);
});
test("writer Unicode IDs are stable ASCII-safe and source indices are verified", async () => {
    const f = fixture();
    await expect((await load("setObservedMentions"))(f.ctx, f.session, { mentions: [{ ...mention, sourceMessageIdx: 999 }] })).rejects.toThrow("Evidence must locate");
    expect(f.committed()).toEqual([]);
    const r = await (await load("setObservedMentions"))(f.ctx, f.session, { mentions: [mention] });
    expect(r.created[0]).toMatch(/^Organization\/entity-[a-f0-9]{20}$/);
    expect(r.mentions[0].sourceMessageIdx).toBe(7);
    expect(r.mentions[0].sourceAgentId).toBe("parent");
});
test("resolver preserves Unicode, exact aliases and single-person ambiguity", async () => {
    const rows = [{ id: "Organization/jp", type: "Organization", data: { title: "日本会社", aka: ["JP"] } }, { id: "Person/alex", type: "Person", data: { title: "Alex" } }];
    const ctx = { fns: { procs: { db: { select: async () => rows } } } };
    const r = await (await load("resolveMentions"))(ctx, null, { mentions: [mention, { ...mention, name: "JP" }, { ...mention, name: "Alex", type: "Person" }] });
    expect(r.map((x: { resolution: { status: string } }) => x.resolution.status)).toEqual(["matched", "matched", "ambiguous"]);
});
