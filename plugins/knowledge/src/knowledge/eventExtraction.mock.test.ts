import { test, expect } from "bun:test";
// Standalone in-memory fixture for data-driven (Event / EventParticipation) extraction. No runtime, no database.
const load = async (name: string) => {
    const source = await Bun.file(new URL(`./${name}.ts`, import.meta.url)).text();
    return new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(source).replace("export default", "return"))();
};
const writer = await load("setObservedMentions");
const schemaFn = await load("extractionSchema");
const updater = await load("updateSidecar");
const matcher = await load("matchAnonymous");

const rows = [
    { id: "Entity/Person", type: "Entity", data: { extract: true, description: "A human", required: ["title"] } },
    { id: "Entity/Organization", type: "Entity", data: { extract: true, description: "A company", required: ["title"] } },
    { id: "Entity/Event", type: "Entity", data: { extract: true, anonymous: true, description: "Something at a time", required: ["title", "kind", "start"], extract_hint: "External events only." } },
    { id: "Entity/EventParticipation", type: "Entity", data: { extract: true, anonymous: true, description: "Who took part", required: ["event", "participant"] } },
    { id: "Entity/SamuraiEmployee", type: "Entity", data: { extract: true, mixin: true } },
    { id: "Attribute/kind", type: "Attribute", data: { datatype: "ref", range: "Entity/Concept", domain: ["Entity/Event"], vocabulary: "Concept/EventKind", body: "kind" } },
    { id: "Attribute/start", type: "Attribute", data: { datatype: "datetime", domain: ["Entity/Event"], body: "start" } },
    { id: "Attribute/event", type: "Attribute", data: { datatype: "ref", range: "Entity/Event", domain: ["Entity/EventParticipation"] } },
    { id: "Attribute/participant", type: "Attribute", data: { datatype: "ref", range: "Entity/Entity", domain: ["Entity/EventParticipation"] } },
    { id: "Attribute/participation_role", type: "Attribute", data: { datatype: "ref", range: "Entity/Concept", domain: ["Entity/EventParticipation"], vocabulary: "Concept/ParticipationRole" } },
    { id: "Attribute/headline", type: "Attribute", data: { datatype: "string", domain: ["Entity/Organization"] } },
    { id: "Attribute/title", type: "Attribute", data: { datatype: "string", domain: ["Entity/Entity"] } },
    { id: "Concept/EventKind", type: "Concept", data: { title: "EventKind" } },
    { id: "Concept/Meeting", type: "Concept", data: { title: "Meeting", isA: ["Concept/EventKind"] } },
    { id: "Concept/Conference", type: "Concept", data: { title: "Conference", isA: ["Concept/EventKind"] } },
    { id: "Concept/ParticipationRole", type: "Concept", data: { title: "ParticipationRole" } },
    { id: "Concept/Speaker", type: "Concept", data: { title: "Speaker", subClassOf: ["Concept/ParticipationRole"] } },
    { id: "Concept/CEO", type: "Concept", data: { title: "CEO", subClassOf: ["Concept/Role"] } },
];

function fixture(content: string) {
    const state = {
        entities: new Map<string, any>(rows.map(r => [r.id, { type: r.type, data: structuredClone(r.data) }])),
        provenance: [] as any[], edges: [] as any[], scratchpad: {} as any,
    };
    state.entities.set("Organization/acme", { type: "Organization", data: { title: "Acme" } });
    const tx = { unsafe: async (sql: string, p: any[] = []) => {
        if (sql.includes("SELECT scratchpad")) return [{ scratchpad: structuredClone(state.scratchpad) }];
        if (sql.includes("WHERE type='Attribute'")) return [...state.entities].filter(([, v]) => v.type === "Attribute").map(([id, v]) => ({ id, data: v.data }));
        if (sql.includes("WHERE type IN ('Entity','Attribute','Concept')")) return [...state.entities].filter(([, v]) => ["Entity", "Attribute", "Concept"].includes(v.type)).map(([id, v]) => ({ id, type: v.type, data: v.data }));
        if (sql.startsWith("SELECT value FROM")) return [];
        if (sql.includes("data @> $2::jsonb")) { const want = JSON.parse(p[1]); return [...state.entities].filter(([, v]) => v.type === p[0] && Object.entries(want).every(([k, val]) => JSON.stringify(v.data[k]) === JSON.stringify(val))).map(([id, v]) => ({ id, data: v.data })); }
        if (sql.startsWith("SELECT subject,predicate,object")) { const ids = JSON.parse(p[0]); const both = sql.includes("OR object"); return state.edges.filter(e => ids.includes(e[0]) || (both && ids.includes(e[2]))).map(e => ({ subject: e[0], predicate: e[1], object: e[2] })); }
        if (sql.startsWith("SELECT type,data") || sql.startsWith("SELECT data FROM")) return state.entities.has(p[0]) ? [structuredClone(state.entities.get(p[0]))] : [];
        if (sql.startsWith("SELECT id FROM")) return state.entities.has(p[0]) ? [{ id: p[0] }] : [];
        if (sql.startsWith("INSERT INTO knowledge.entities")) state.entities.set(p[0], { type: p[1], data: JSON.parse(p[2]) });
        else if (sql.startsWith("INSERT INTO knowledge.provenance")) state.provenance.push({ subject: p[0], attribute: p[1], value: JSON.parse(p[2]) });
        else if (sql.startsWith("UPDATE knowledge.entities")) state.entities.get(p[0]).data = JSON.parse(p[1]);
        else if (sql.startsWith("DELETE FROM knowledge.relations")) state.edges = state.edges.filter(x => x[0] !== p[0] || x[1] !== p[1]);
        else if (sql.startsWith("INSERT INTO knowledge.relations")) state.edges.push(p);
        else if (sql.startsWith("UPDATE agents")) state.scratchpad = JSON.parse(p[1]);
        return [];
    } };
    const ctx: any = { state: { agent: { parent: { scratchpad: {} } } }, fns: {
        procs: { db: { select: async ({ sql }: any) => sql.includes("Entity','Attribute','Concept") ? tx.unsafe(sql) : sql.includes("FROM agents") ? [{ parent_id: null, fork_offset: null }] : [...state.entities].filter(([, v]) => !["Entity", "Attribute", "Concept"].includes(v.type)).map(([id, v]) => ({ id, type: v.type, data: v.data })), conn: async () => ({ begin: async (fn: any) => fn(tx) }) } },
        session: { getMessages: async () => [{ idx: 3, role: "user", content }] },
        events: { refreshAgentMeta: () => {} },
    } };
    ctx.fns.knowledge = { extractionSchema: (o: any) => schemaFn(ctx, null, o ?? {}), resolveMentions: (o: any) => load("resolveMentions").then(f => f(ctx, null, o)), matchAnonymous: (o: any) => matcher(ctx, null, o) };
    const child = { id: "child", parentId: "parent", scratchpad: { knowledgeSidecarFor: "parent", sourceMessageIdx: 3 } };
    return { state, ctx, tx, run: (mentions: any[]) => writer(ctx, { agent: child }, { mentions }) };
}

test("extractionSchema derives types, attributes and vocabularies from records; mixins excluded", async () => {
    const f = fixture("x");
    const s = await schemaFn(f.ctx, null, {});
    expect(s.types.map((t: any) => t.type).sort()).toEqual(["Event", "EventParticipation", "Organization", "Person"]);
    expect(s.types.find((t: any) => t.type === "Event")).toMatchObject({ anonymous: true, required: ["kind", "start"], hint: "External events only." });
    expect(s.attributes.map((a: any) => a.name)).not.toContain("title");
    expect(s.vocabularies["Concept/EventKind"].map((v: any) => v.id).sort()).toEqual(["Concept/Conference", "Concept/Meeting"]);
    expect(s.vocabularies["Concept/ParticipationRole"].map((v: any) => v.id)).toEqual(["Concept/Speaker"]);
});

test("anonymous Event with participation is created without its label in evidence; dates evidenced by day/year", async () => {
    const q = "Вчера, 5 марта 2026, был созвон с Acme — Иван Петров рассказывал про их roadmap.";
    const f = fixture(q);
    const r = await f.run([
        { id: "o", type: "Organization", name: "Acme", entityId: "Organization/acme", evidence: q, confidence: 1, sourceMessageIdx: 3 },
        { id: "p", type: "Person", name: "Иван Петров", evidence: q, confidence: 0.9, sourceMessageIdx: 3 },
        { id: "e", type: "Event", name: "Call with Acme 2026-03-05", evidence: q, confidence: 0.9, sourceMessageIdx: 3,
          attributes: { start: "2026-03-05" }, attributeEvidence: { start: q },
          relations: [{ predicate: "kind", target: "Concept/Meeting", evidence: q }] },
        { id: "ep", type: "EventParticipation", name: "Иван Петров @ Call with Acme", evidence: q, confidence: 0.9, sourceMessageIdx: 3,
          relations: [{ predicate: "event", target: "e", evidence: q }, { predicate: "participant", target: "p", evidence: q }, { predicate: "participation_role", target: "Concept/Speaker", evidence: q }] },
    ]);
    expect(r.skipped).toEqual([]);
    const ev = r.created.find((id: string) => id.startsWith("Event/"))!; const ep = r.created.find((id: string) => id.startsWith("EventParticipation/"))!;
    expect(ev && ep).toBeTruthy();
    expect(f.state.entities.get(ev).data).toMatchObject({ start: "2026-03-05", kind: "Concept/Meeting" });
    expect(f.state.edges).toContainEqual([ep, "event", ev]);
    expect(f.state.edges).toContainEqual([ep, "participation_role", "Concept/Speaker"]);
    expect(f.state.edges.some(e => e[0] === ep && e[1] === "participant" && e[2].startsWith("Person/"))).toBe(true);
});

test("anonymous mentions missing required fields are skipped, cascading to dependants; vocabulary is enforced", async () => {
    const q = "Созвон с Acme прошёл хорошо.";
    const f = fixture(q);
    const r = await f.run([
        { id: "e", type: "Event", name: "Call with Acme", evidence: q, confidence: 0.9, sourceMessageIdx: 3, relations: [{ predicate: "kind", target: "Concept/Meeting", evidence: q }] },
        { id: "ep", type: "EventParticipation", name: "Acme @ call", evidence: q, confidence: 0.9, sourceMessageIdx: 3, relations: [{ predicate: "event", target: "e", evidence: q }, { predicate: "participant", target: "Organization/acme", evidence: q }] },
    ]);
    expect(r.created).toEqual([]); expect(r.skipped.sort()).toEqual(["e", "ep"]);
    await expect(fixture(q).run([{ id: "e", type: "Event", name: "x", evidence: q, confidence: 1, sourceMessageIdx: 3, attributes: { start: "2026-03-05" }, attributeEvidence: { start: q }, relations: [{ predicate: "kind", target: "Concept/Meeting", evidence: q }] }])).rejects.toThrow("Unverified fact start");
    await expect(fixture("Созвон с Acme 5 марта.").run([{ id: "e", type: "Event", name: "x", evidence: "Созвон с Acme 5 марта.", confidence: 1, sourceMessageIdx: 3, attributes: { start: "2026-03-05T25:00" }, attributeEvidence: { start: "Созвон с Acme 5 марта." }, relations: [{ predicate: "kind", target: "Concept/Meeting", evidence: "Созвон с Acme 5 марта." }] }])).rejects.toThrow("Invalid datetime");
    const q2 = "Созвон с Acme 5 марта.";
    await expect(fixture(q2).run([{ id: "e", type: "Event", name: "x", evidence: q2, confidence: 1, sourceMessageIdx: 3, attributes: { start: "2026-03-05" }, attributeEvidence: { start: q2 }, relations: [{ predicate: "kind", target: "Concept/CEO", evidence: q2 }] }])).rejects.toThrow("outside vocabulary");
    const g = fixture(q2);
    await expect(g.run([{ id: "e", type: "Unknown", name: "x", evidence: q2, confidence: 1, sourceMessageIdx: 3 }])).rejects.toThrow("Unsupported mention type");
    await expect(fixture(q2).run([{ id: "o", type: "Organization", name: "Zeta", evidence: q2, confidence: 1, sourceMessageIdx: 3 }])).rejects.toThrow("verbatim");
});

test("sidecar prompt is generated from the schema", async () => {
    const f = fixture("x");
    let prompt = "";
    const parent: any = { id: "parent", scratchpad: { knowledgeSidecar: { appliedSourceMessageIdx: 0 } } };
    f.ctx.fns.session = { getMessages: async () => [{ idx: 1, role: "user", content: "hello" }], fork: async () => ({ id: "fork", scratchpad: {} }), save: async () => {}, archive: async () => {},
        mutateScratchpad: async ({ mutate }: any) => ({ result: mutate(parent.scratchpad, 1), scratchpad: parent.scratchpad }) };
    f.ctx.fns.settings = { getNumber: async () => 1000 };
    f.ctx.fns.agent = { run: async ({ userText }: any) => { prompt = userText; parent.scratchpad.knowledgeSidecar = { status: "ready", appliedSourceMessageIdx: 1, sidecarId: "fork", mentions: [] }; } };
    expect((await updater(f.ctx, null, { agent: parent, messageIdx: 1 })).status).toBe("ready");
    expect(prompt).toContain("- Event (anonymous): Something at a time Required at creation: kind, start. External events only.");
    expect(prompt).toContain("ANONYMOUS TYPES (Event, EventParticipation)");
    expect(prompt).toContain("Concept/EventKind: Concept/Meeting (Meeting), Concept/Conference (Conference)");
    expect(prompt).not.toContain("SamuraiEmployee");
    expect(prompt).toContain('"vocabulary":"Concept/EventKind"');
});

test("anonymous mention with a searched entityId reuses the record without label matching or required-field check", async () => {
    const q = "На созвоне с Acme 5 марта также был Пётр Сидоров.";
    const f = fixture(q);
    f.state.entities.set("Event/existing", { type: "Event", data: { title: "Call with Acme 2026-03-05", kind: "Concept/Meeting", start: "2026-03-05" } });
    const r = await f.run([
        { id: "e", type: "Event", name: "Созвон с Acme", entityId: "Event/existing", evidence: q, confidence: 0.9, sourceMessageIdx: 3 },
        { id: "p", type: "Person", name: "Пётр Сидоров", evidence: q, confidence: 0.9, sourceMessageIdx: 3 },
        { id: "ep", type: "EventParticipation", name: "Пётр Сидоров @ созвон", evidence: q, confidence: 0.9, sourceMessageIdx: 3, relations: [{ predicate: "event", target: "e", evidence: q }, { predicate: "participant", target: "p", evidence: q }] },
    ]);
    expect(r.skipped).toEqual([]);
    expect(r.created.filter((id: string) => id.startsWith("Event/"))).toEqual([]);
    expect(f.state.edges.some(e => e[0].startsWith("EventParticipation/") && e[1] === "event" && e[2] === "Event/existing")).toBe(true);
    await expect(fixture(q).run([{ id: "e", type: "Event", name: "x", entityId: "Organization/acme", evidence: q, confidence: 1, sourceMessageIdx: 3 }])).rejects.toThrow("Unverified canonical identity");
});

// ---- anonymous dedup (matchAnonymous)
const seed = (f: ReturnType<typeof fixture>, extra: Record<string, any> = {}) => {
    f.state.entities.set("Person/ivan", { type: "Person", data: { title: "Иван Петров" } });
    f.state.entities.set("Person/olga", { type: "Person", data: { title: "Ольга Смирнова" } });
    f.state.entities.set("Event/ev1", { type: "Event", data: { title: "Call with Acme", kind: "Concept/Meeting", start: "2026-03-05", ...extra } });
    f.state.edges.push(["Event/ev1", "kind", "Concept/Meeting"]);
    f.state.entities.set("EventParticipation/ep1", { type: "EventParticipation", data: { event: "Event/ev1", participant: "Person/ivan" } });
    f.state.edges.push(["EventParticipation/ep1", "event", "Event/ev1"], ["EventParticipation/ep1", "participant", "Person/ivan"]);
};
const eventMention = (q: string, extra: any = {}) => ({ id: "e", type: "Event", name: "Созвон с Acme", evidence: q, confidence: 0.9, sourceMessageIdx: 3, attributes: { start: "2026-03-05" }, attributeEvidence: { start: q }, relations: [{ predicate: "kind", target: "Concept/Meeting", evidence: q }], ...extra });
const partMention = (q: string, target: string, id = "ep") => ({ id, type: "EventParticipation", name: `${target} @ созвон`, evidence: q, confidence: 0.9, sourceMessageIdx: 3, relations: [{ predicate: "event", target: "e", evidence: q }, { predicate: "participant", target, evidence: q }] });

test("matchAnonymous: identity + shared participant matches; disjoint participants are distinct; unknown links are ambiguous", async () => {
    const f = fixture("x"); seed(f);
    const ctx = f.ctx; const tx = f.tx;
    expect(await matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Meeting", start: "2026-03-05" }, linked: ["Person/ivan"], tx })).toMatchObject({ status: "matched", id: "Event/ev1" });
    expect(await matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Meeting", start: "2026-03-05T10:00Z" }, linked: ["Person/ivan"], tx })).toMatchObject({ status: "matched", id: "Event/ev1" });
    expect((await matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Meeting", start: "2026-03-05" }, linked: ["Person/olga"], tx })).status).toBe("new");
    expect((await matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Meeting", start: "2026-03-05" }, linked: [], tx })).status).toBe("ambiguous");
    expect((await matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Conference", start: "2026-03-05" }, linked: ["Person/ivan"], tx })).status).toBe("new");
    expect((await matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Meeting", start: "2026-03-06" }, linked: ["Person/ivan"], tx })).status).toBe("new");
    // all-ref identity: single candidate is matched outright
    expect(await matcher(ctx, null, { type: "EventParticipation", identity: { event: "Event/ev1", participant: "Person/ivan" }, tx })).toMatchObject({ status: "matched", id: "EventParticipation/ep1" });
    expect((await matcher(ctx, null, { type: "EventParticipation", identity: { event: "Event/ev1", participant: "Person/olga" }, tx })).status).toBe("new");
    // event with no links at all is never confirmed nor excluded
    f.state.edges = f.state.edges.filter(e => e[0] !== "EventParticipation/ep1"); f.state.entities.delete("EventParticipation/ep1");
    expect((await matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Meeting", start: "2026-03-05" }, linked: ["Person/ivan"], tx })).status).toBe("ambiguous");
    await expect(matcher(ctx, null, { type: "Person", identity: {} })).rejects.toThrow("Not an anonymous");
    await expect(matcher(ctx, null, { type: "Event", identity: { kind: "Concept/Meeting" } })).rejects.toThrow("Incomplete identity");
});

test("writer reuses an existing Event when a same-batch participation shares a participant; participation itself deduplicates", async () => {
    const q = "На созвоне с Acme 5 марта Иван Петров и Ольга Смирнова обсуждали roadmap.";
    const f = fixture(q); seed(f);
    const r = await f.run([
        { id: "p1", type: "Person", name: "Иван Петров", entityId: "Person/ivan", evidence: q, confidence: 1, sourceMessageIdx: 3 },
        { id: "p2", type: "Person", name: "Ольга Смирнова", entityId: "Person/olga", evidence: q, confidence: 1, sourceMessageIdx: 3 },
        eventMention(q),
        partMention(q, "p1", "ep1"),
        partMention(q, "p2", "ep2"),
    ]);
    expect(r.skipped).toEqual([]);
    expect(r.created).toEqual(expect.not.arrayContaining([expect.stringMatching(/^Event\//)]));
    expect(r.mentions.find((m: any) => m.id === "e").entityId).toBe("Event/ev1");
    expect(r.mentions.find((m: any) => m.id === "ep1").entityId).toBe("EventParticipation/ep1");
    const olga = r.mentions.find((m: any) => m.id === "ep2").entityId;
    expect(olga.startsWith("EventParticipation/")).toBe(true); expect(olga).not.toBe("EventParticipation/ep1");
    expect(f.state.edges).toContainEqual([olga, "event", "Event/ev1"]);
    expect([...f.state.entities].filter(([, v]) => v.type === "Event")).toHaveLength(1);
});

test("writer creates a distinct Event for a same-day meeting with different people and skips an unverifiable one", async () => {
    const q = "5 марта был другой созвон с Acme — там была только Ольга Смирнова.";
    const f = fixture(q); seed(f);
    const r = await f.run([
        { id: "p2", type: "Person", name: "Ольга Смирнова", entityId: "Person/olga", evidence: q, confidence: 1, sourceMessageIdx: 3 },
        eventMention(q), partMention(q, "p2"),
    ]);
    expect(r.created.filter((id: string) => id.startsWith("Event/"))).toHaveLength(1);
    expect([...f.state.entities].filter(([, v]) => v.type === "Event")).toHaveLength(2);
    const q2 = "5 марта был созвон с Acme.";
    const g = fixture(q2); seed(g);
    const r2 = await g.run([eventMention(q2)]);
    expect(r2.skipped).toEqual(["e"]); expect(r2.created).toEqual([]);
});

test("two mentions of the same event inside one batch collapse via pending links", async () => {
    const q = "5 марта созвон с Acme: Иван Петров выступал. Потом на том же созвоне 5 марта Иван Петров отвечал на вопросы.";
    const f = fixture(q);
    f.state.entities.set("Person/ivan", { type: "Person", data: { title: "Иван Петров" } });
    const r = await f.run([
        { id: "p1", type: "Person", name: "Иван Петров", entityId: "Person/ivan", evidence: q, confidence: 1, sourceMessageIdx: 3 },
        eventMention(q, { id: "e" }), partMention(q, "p1", "ep1"),
        { ...eventMention(q, { id: "e2" }), name: "Тот же созвон" },
        { ...partMention(q, "p1", "ep2"), relations: [{ predicate: "event", target: "e2", evidence: q }, { predicate: "participant", target: "p1", evidence: q }] },
    ]);
    expect(r.skipped).toEqual([]);
    expect([...f.state.entities].filter(([, v]) => v.type === "Event")).toHaveLength(1);
    expect([...f.state.entities].filter(([, v]) => v.type === "EventParticipation")).toHaveLength(1);
});
