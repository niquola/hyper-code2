import { test, expect } from "bun:test";
// Standalone, transaction-aware in-memory fixture. Never imports Hyper or connects to a database.
const source = await Bun.file(new URL("./setObservedMentions.ts", import.meta.url)).text();
const writer = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(source).replace("export default", "return"))();
const schemaOf = (defs: any[]) => async () => ({ types: ['Person','Organization','Product','Concept','Standard'].map(type => ({ type, description: type, anonymous: false, required: [], hint: undefined })), attributes: defs.map(d => ({ name: d.id.slice(10), datatype: d.data.datatype ?? 'string', domain: [].concat(d.data.domain ?? []).map((x: string) => x.slice(7)), range: [].concat(d.data.range ?? []).map((x: string) => x.slice(7)), cardinality: d.data.cardinality === 'multi' ? 'multi' : 'single', vocabulary: d.data.vocabulary, description: '' })), vocabularies: {} });
const base = { id: "a", type: "Organization", name: "Acme", confidence: 1, evidence: "Acme" };
function fixture(content: string, failAt = "") {
    let state = {
        entities: new Map<string, any>([["Organization/acme", { type: "Organization", data: { title: "Acme" } }], ["Organization/other", { type: "Organization", data: { title: "Other" } }]]),
        history: [] as any[], provenance: [] as any[], edges: [] as any[], search: [] as any[], scratchpad: {} as any,
    };
    const defs = [
        { id: "Attribute/headline", data: { domain: "Entity/Organization", datatype: "string" } },
        { id: "Attribute/tags", data: { domain: "Entity/Organization", datatype: "string", cardinality: "multi" } },
        { id: "Attribute/partner", data: { domain: "Entity/Organization", datatype: "ref", range: "Entity/Organization" } },
    ];
    const ctx = { state: { agent: { parent: { scratchpad: {} } } }, fns: {
        session: { getMessages: async () => [{ idx: 7, role: "user", content }] },
        events: { refreshAgentMeta: () => {} },
        knowledge: { extractionSchema: schemaOf(defs), resolveMentions: async ({ mentions }: any) => mentions.map((mention: any) => ({ mention, resolution: { status: mention.name === "Newco" ? "new" : "matched", id: mention.name === "Newco" ? undefined : "Organization/acme", candidates: [] } })) },
        procs: { db: {
            select: async () => [{ parent_id: null, fork_offset: null }],
            conn: async () => ({ begin: async (fn: any) => {
                const pending = structuredClone(state);
                const answer = await fn({ unsafe: async (sql: string, p: any[] = []) => {
                    if (failAt && sql.includes(failAt)) throw new Error("injected failure");
                    if (sql.includes("SELECT scratchpad")) return [{ scratchpad: structuredClone(pending.scratchpad) }];
                    if (sql.includes("WHERE type='Attribute'")) return defs;
                    if (sql.startsWith("SELECT value FROM")) return pending.provenance.filter(x => x.subject === p[0] && x.attribute === p[1] && x.url.startsWith("hyper://agent/parent/message/"));
                    if (sql.startsWith("SELECT type,data") || sql.startsWith("SELECT data FROM")) return pending.entities.has(p[0]) ? [structuredClone(pending.entities.get(p[0]))] : [];
                    if (sql.startsWith("SELECT id FROM")) return pending.entities.has(p[0]) ? [{ id: p[0] }] : [];
                    if (sql.startsWith("INSERT INTO knowledge.entities")) pending.entities.set(p[0], { type: p[1], data: JSON.parse(p[2]) });
                    else if (sql.startsWith("INSERT INTO knowledge.entity_changes")) pending.history.push({ id: pending.history.length + 1, subject: p[0], attribute: p[1], operation: p[2], before: JSON.parse(p[3]), after: JSON.parse(p[4]), sourceAgentId: p[5], sourceMessageIdx: p[6], url: p[7], evidence: p[8] });
                    else if (sql.startsWith("INSERT INTO knowledge.provenance")) pending.provenance.push({ subject: p[0], attribute: p[1], value: JSON.parse(p[2]), url: p[3], evidence: p[4] });
                    else if (sql.startsWith("UPDATE knowledge.entities")) pending.entities.get(p[0]).data = JSON.parse(p[1]);
                    else if (sql.startsWith("DELETE FROM knowledge.relations")) pending.edges = pending.edges.filter(x => x[0] !== p[0] || x[1] !== p[1]);
                    else if (sql.startsWith("INSERT INTO knowledge.relations")) pending.edges.push(p);
                    else if (sql.startsWith("INSERT INTO knowledge.search")) pending.search.push(p);
                    else if (sql.startsWith("UPDATE agents")) pending.scratchpad = JSON.parse(p[1]);
                    else if (!sql.startsWith("SELECT pg_advisory") && !sql.startsWith("LOCK TABLE")) throw new Error(`Unexpected SQL: ${sql}`);
                    return [];
                } });
                state = pending;
                return answer;
            } }),
        } },
    } };
    const session = { agent: { id: "child", parentId: "parent", scratchpad: { knowledgeSidecarFor: "parent", sourceMessageIdx: 7 } } };
    return { state: () => state, ctx, run: (mentions: any[]) => writer(ctx, session, { mentions }) };
}
test("creation journals actual initial fields once, explicit JSON null and verified source", async () => {
    const f = fixture("Newco headline Hello");
    await f.run([{ ...base, name: "Newco", evidence: "Newco", attributes: { headline: "Hello" }, attributeEvidence: { headline: "Newco headline Hello" } }]);
    expect(f.state().history.map(x => [x.attribute, x.operation, x.before, x.after])).toEqual([["title", "create", null, "Newco"], ["base_type", "create", null, "Entity/Organization"], ["headline", "add", null, "Hello"]]);
    for (const row of f.state().history) {
        expect(row.sourceAgentId).toBe("parent"); expect(row.sourceMessageIdx).toBe(7); expect(row.url).toBe("hyper://agent/parent/message/7");
    }
    expect(f.state().scratchpad.knowledgeSidecar.lastTurn.created).toBe(1);
});
test("scalar fill journals once, no-op and unmarked conflict retain provenance only", async () => {
    const f = fixture("Acme Old New");
    await f.run(["Old", "Old", "New"].map((headline, i) => ({ ...base, id: `m${i}`, attributes: { headline }, attributeEvidence: { headline: "Acme Old New" } })));
    expect(f.state().history.map(x => [x.before, x.after])).toEqual([[null, "Old"]]);
    expect(f.state().provenance.filter(x => x.attribute === "headline")).toHaveLength(3);
    expect(f.state().scratchpad.knowledgeSidecar.lastTurn.facts).toMatchObject({ added: 1, noop: 1, conflict: 1 });
});
test("duplicate field updates have deterministic sequential before/after, correction ownership preserved", async () => {
    const f = fixture("Acme Old; correction Acme New; correction Acme Final");
    await f.run([
        { ...base, attributes: { headline: "Old" }, attributeEvidence: { headline: "Acme Old" } },
        { ...base, id: "b", attributeUpdates: [{ attribute: "headline", operation: "correct", value: "New", evidence: "correction Acme New" }] },
        { ...base, id: "c", attributeUpdates: [{ attribute: "headline", operation: "correct", value: "Final", evidence: "correction Acme Final" }] },
    ]);
    expect(f.state().history.map(x => [x.id, x.operation, x.before, x.after])).toEqual([[1, "add", null, "Old"], [2, "correct", "Old", "New"], [3, "correct", "New", "Final"]]);
    expect(f.state().entities.get("Organization/acme").data.headline).toBe("Final");
});
test("multi add journals union; equivalent correction neither reorders canonical data nor journals", async () => {
    const f = fixture("Acme red blue; correction Acme blue red");
    await f.run([
        { ...base, attributeUpdates: [{ attribute: "tags", operation: "add", value: ["red"], evidence: "Acme red blue" }] },
        { ...base, id: "b", attributeUpdates: [{ attribute: "tags", operation: "add", value: ["blue"], evidence: "Acme red blue" }] },
        // Existing ownership rule requires an observation of the whole canonical union.
        { ...base, id: "whole", attributeUpdates: [{ attribute: "tags", operation: "add", value: ["red", "blue"], evidence: "Acme red blue" }] },
        { ...base, id: "c", attributeUpdates: [{ attribute: "tags", operation: "correct", value: ["blue", "red"], evidence: "correction Acme blue red" }] },
    ]);
    expect(f.state().history.map(x => [x.before, x.after])).toEqual([[null, ["red"]], [["red"], ["red", "blue"]]]);
    expect(f.state().entities.get("Organization/acme").data.tags).toEqual(["red", "blue"]);
});
test("reference fill and correction journal canonical IDs and project only current edges", async () => {
    const f = fixture("Acme Other; correction Acme Acme");
    await f.run([
        { ...base, relations: [{ predicate: "partner", target: "Organization/other", evidence: "Acme Other" }] },
        { ...base, id: "b", attributeUpdates: [{ attribute: "partner", operation: "correct", value: "Organization/acme", evidence: "correction Acme Acme" }] },
    ]);
    expect(f.state().history.map(x => [x.before, x.after])).toEqual([[null, "Organization/other"], ["Organization/other", "Organization/acme"]]);
    expect(f.state().edges).toEqual([["Organization/acme", "partner", "Organization/acme"]]);
});
test("checkpoint replay journals nothing and leaves successful part1 summary intact", async () => {
    const f = fixture("Acme Old");
    const mentions = [{ ...base, attributes: { headline: "Old" }, attributeEvidence: { headline: "Acme Old" } }];
    await f.run(mentions); const saved = structuredClone(f.state());
    expect((await f.run(mentions)).skipped).toEqual(["stale-or-duplicate"]);
    expect(f.state()).toEqual(saved);
});
test("transaction failures roll back journal, entities, observations, edges, search and checkpoint", async () => {
    for (const failAt of ["INSERT INTO knowledge.entity_changes", "INSERT INTO knowledge.provenance", "INSERT INTO knowledge.relations", "INSERT INTO knowledge.search", "UPDATE agents"]) {
        const f = fixture("Newco Other", failAt); const saved = structuredClone(f.state());
        await expect(f.run([{ ...base, name: "Newco", evidence: "Newco", relations: [{ predicate: "partner", target: "Organization/other", evidence: "Newco Other" }] }])).rejects.toThrow("injected failure");
        expect(f.state()).toEqual(saved); expect(f.ctx.state.agent.parent.scratchpad).toEqual({});
    }
});
test("unowned correction fails and leaves no partial journal", async () => {
    const f = fixture("correction Acme New");
    f.state().entities.get("Organization/acme").data.headline = "Imported";
    const saved = structuredClone(f.state());
    await expect(f.run([{ ...base, attributeUpdates: [{ attribute: "headline", operation: "correct", value: "New", evidence: "correction Acme New" }] }])).rejects.toThrow("ownership");
    expect(f.state()).toEqual(saved);
});
