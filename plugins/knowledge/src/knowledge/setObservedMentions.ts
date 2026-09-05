/**
 * Atomically writes source-verified entity mentions, facts and reference relations from a hidden sidecar.
 * Use only from a knowledge sidecar fork. Quotes are located in actual inherited user/tool messages;
 * explicit source references are validated against persisted eligible messages. Invalid batches roll back completely. A locked
 * parent checkpoint rejects stale/duplicate runs before graph writes. Ambiguous identities are not written.
 * Persists last successful turn counters atomically: distinct matched/new entities and submitted fact outcomes (not provenance inserts).
 * Journals actual per-field create/add/correct transitions in knowledge.entity_changes in the same transaction.
 * Repeated fields follow submitted mention/field order, retaining each real transition; no-ops and conflicts retain observations only.
 * @param opts.mentions Up to 40 strictly typed mentions with verbatim evidence and per-fact quotes.
 */
export default async function (ctx: Context, session: Session | null, opts: {
    /** Up to 40 mentions; facts require attributeEvidence and relations require their own evidence. */
    mentions: types.knowledge.Mention[];
}): Promise<{ parentId: string; written: number; created: string[]; skipped: string[]; mentions: Array<Omit<types.knowledge.Mention, "entityId"> & { status: string; entityId: string | null }> }> {
    const me = session?.agent ?? (session?.agentId ? ctx.state.agent[session.agentId] : null);
    const parentId = me?.parentId;
    if (!me || !parentId || me.scratchpad?.knowledgeSidecarFor !== parentId) throw new Error("Only the parent's knowledge sidecar may write");
    const cutoff = Number(me.scratchpad.sourceMessageIdx);
    if (!Number.isSafeInteger(cutoff) || cutoff < 0) throw new Error("Missing source checkpoint");
    if (!Array.isArray(opts.mentions) || opts.mentions.length > 40) throw new Error("Expected at most 40 mentions");
    const text = (v: unknown, limit: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= limit && !v.includes("\u0000");
    const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : [];
    // getFullMessages drops source agent IDs. Assemble the identical inherited prefix while retaining ownership.
    const seen = new Set<string>();
    const sourceMessages: Array<{ agentId: string; idx: number; role: string; content: string }> = [];
    const inherited = async (id: string): Promise<typeof sourceMessages> => {
        if (seen.has(id)) throw new Error("Cyclic message lineage");
        seen.add(id);
        const row = (await ctx.fns.procs.db.select({ sql: "SELECT parent_id,fork_offset FROM agents WHERE id=?", params: [id] }))[0];
        if (!row) throw new Error("Missing source agent");
        const prefix = row.parent_id ? await inherited(row.parent_id) : [];
        const own = await ctx.fns.session.getMessages({ id });
        return [...(row.fork_offset == null ? prefix : prefix.slice(0, row.fork_offset)), ...own.map(m => ({ agentId: id, idx: Number(m.idx), role: String(m.role), content: typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.filter((p: { type: string; text?: string }) => p.type === "text").map((p: { text?: string }) => p.text).join("\n") : "" }))];
    };
    sourceMessages.push(...(await inherited(parentId)).filter(m => m.agentId !== parentId || m.idx <= cutoff));
    const locate = (quote: string, ref?: { sourceAgentId?: string; sourceMessageIdx?: number }) => {
        if (!text(quote, 4000)) throw new Error("Missing verbatim evidence");
        if (ref?.sourceAgentId != null && ref.sourceMessageIdx == null) throw new Error("Source owner requires index");
        if (ref?.sourceMessageIdx != null && (!Number.isSafeInteger(ref.sourceMessageIdx) || ref.sourceMessageIdx < 0)) throw new Error("Invalid source index");
        const matches = sourceMessages.filter(m => ["user", "tool"].includes(m.role) && m.content.includes(quote) && (ref?.sourceMessageIdx == null || (m.idx === ref.sourceMessageIdx && m.agentId === (ref.sourceAgentId ?? parentId))));
        if (matches.length !== 1) throw new Error("Evidence must locate exactly one inherited user/tool message");
        return matches[0]!;
    };
    const ids = new Set<string>();
    const mentions = opts.mentions.map(m => {
        if (!m || !text(m.id, 40) || ids.has(m.id) || !["Person", "Organization", "Product", "Concept", "Standard"].includes(m.type) || !text(m.name, 200) || !Number.isFinite(m.confidence) || m.confidence < 0 || m.confidence > 1) throw new Error("Invalid mention or duplicate mention id");
        ids.add(m.id);
        const source = locate(m.evidence, m);
        if (!m.evidence.includes(m.name)) throw new Error("Mention name must occur verbatim in evidence");
        if (m.aliases && (!Array.isArray(m.aliases) || m.aliases.length > 10 || m.aliases.some(a => !text(a, 200) || !m.evidence.includes(a)))) throw new Error("Aliases require literal evidence");
        if (m.attributes && (typeof m.attributes !== "object" || Array.isArray(m.attributes) || Object.keys(m.attributes).length > 20)) throw new Error("Invalid attributes");
        if (m.attributeUpdates && (!Array.isArray(m.attributeUpdates) || m.attributeUpdates.length > 20 || new Set(m.attributeUpdates.map(u => u.attribute)).size !== m.attributeUpdates.length)) throw new Error("Invalid updates");
        if (m.relations && (!Array.isArray(m.relations) || m.relations.length > 10)) throw new Error("Invalid relations");
        return { ...m, sourceAgentId: source.agentId, sourceMessageIdx: source.idx };
    });
    // Framework-owned pool, never a new/default Bun.sql connection. Every mutation uses this transaction.
    const db = await ctx.fns.procs.db.conn({});
    const result = await db.begin(async tx => {
        await tx.unsafe("SELECT pg_advisory_xact_lock(734281991)");
        const rows = await tx.unsafe("SELECT scratchpad FROM agents WHERE id=$1 FOR UPDATE", [parentId]);
        if (!rows.length) throw new Error("Parent disappeared");
        const scratchpad = typeof rows[0].scratchpad === "string" ? JSON.parse(rows[0].scratchpad) : rows[0].scratchpad ?? {};
        const current = scratchpad.knowledgeSidecar ?? {};
        const empty = { parentId, written: 0, created: [] as string[], skipped: ["stale-or-duplicate"], mentions: [] as Array<Omit<types.knowledge.Mention, "entityId"> & { status: string; entityId: string | null }> };
        if (scratchpad.knowledgeTracking === false || Number(current.appliedSourceMessageIdx ?? -1) >= cutoff || Number(current.sourceMessageIdx ?? -1) > cutoff || (Number(current.sourceMessageIdx ?? -1) === cutoff && current.status === "ready") || (current.sidecarId && current.sidecarId !== me.id && Number(current.sourceMessageIdx) >= cutoff)) return { answer: empty, scratchpad: null };
        // Serialize with ordinary entity updates as well as other sidecar writers.
        await tx.unsafe("LOCK TABLE knowledge.entities IN SHARE ROW EXCLUSIVE MODE");
        const definitions = await tx.unsafe("SELECT id,data FROM knowledge.entities WHERE type='Attribute'");
        const defs = new Map<string, { domain?: string | string[]; range?: string | string[]; datatype: string; cardinality?: string }>(definitions.map((d: { id: string; data: { domain?: string | string[]; range?: string | string[]; datatype: string; cardinality?: string } }) => [String(d.id).slice(10), d.data]));
        const definition = (type: string, key: string) => {
            const d = defs.get(key);
            if (!/^[a-z][a-z0-9_]*$/.test(key) || ["base_type", "type", "title", "aka"].includes(key) || !d || !list(d.domain).includes(`Entity/${type}`)) throw new Error(`Unsupported attribute ${type}.${key}`);
            return d;
        };
        for (const m of mentions) {
            for (const [key, value] of Object.entries(m.attributes ?? {})) {
                const d = definition(m.type, key);
                const values = list(value);
                if ((Array.isArray(value) && value.some(v => typeof v !== "string")) || (!Array.isArray(value) && typeof value !== "string")) throw new Error(`Invalid value type for ${key}`);
                if (!values.length || values.length > 10 || (Array.isArray(value) && d.cardinality !== "multi") || values.some(v => !text(v, 500))) throw new Error(`Invalid value for ${key}`);
                if (!["string", "url", "date"].includes(d.datatype)) throw new Error(`Use relations for refs; unsupported datatype ${key}`);
                const quote = m.attributeEvidence?.[key];
                if (!quote || !quote.includes(m.name) || values.some(v => !quote.includes(v))) throw new Error(`Unverified fact ${key}`);
                locate(quote, m);
                if (d.datatype === "url" && values.some(v => { try { return !["https:", "http:"].includes(new URL(v).protocol); } catch { return true; } })) throw new Error("Invalid URL");
                if (d.datatype === "date" && values.some(v => !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) throw new Error("Invalid date");
            }
            for (const r of m.relations ?? []) {
                const d = definition(m.type, r.predicate);
                if (d.datatype !== "ref" || !text(r.target, 240) || !r.evidence || !r.evidence.includes(m.name)) throw new Error("Invalid reference relation");
                locate(r.evidence, m);
            }
        }
        const resolved = await ctx.fns.knowledge.resolveMentions({ mentions });
        // Identity IDs give a stable tie-breaker within equal transaction timestamps. History survives entity deletion.
        const equalValue = (a: unknown, b: unknown) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a ?? null) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b ?? null);
        const journal = async (subject: string, attribute: string, before: string | string[] | null | undefined, after: string | string[], operation: "create" | "add" | "correct", quote: string, ref: types.knowledge.Mention) => {
            if (equalValue(before, after)) return;
            const source = locate(quote, ref);
            await tx.unsafe(`INSERT INTO knowledge.entity_changes(subject,attribute,operation,before_value,after_value,source_agent_id,source_message_idx,url,evidence) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8,$9)`, [subject, attribute, operation, JSON.stringify(before ?? null), JSON.stringify(after), source.agentId, source.idx, `hyper://agent/${source.agentId}/message/${source.idx}`, quote]);
        };
        const entityOf = new Map<string, string>();
        const newNames = new Map<string, string>();
        const created: string[] = [], skipped: string[] = [];
        let written = 0;
        const facts = { added: 0, changed: 0, noop: 0, conflict: 0, skipped: 0 };
        const countFact = (before: string | string[] | null | undefined, after: string | string[] | null | undefined, proposed: string | string[]) => {
            const equal = (a: typeof before, b: typeof before) => JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b);
            if (!equal(before, after)) {
                if (before == null || before === "" || (Array.isArray(before) && !before.length)) facts.added++;
                else facts.changed++;
            } else if (equal(after, proposed) || (Array.isArray(after) && (Array.isArray(proposed) ? proposed : [proposed]).every(v => after.includes(v)))) facts.noop++;
            else facts.conflict++;
        };
        for (const { mention: m, resolution: r } of resolved) {
            let id = r.id;
            if (m.entityId != null) {
                if (!text(m.entityId, 240)) throw new Error("Invalid canonical ID");
                const row = (await tx.unsafe("SELECT type,data FROM knowledge.entities WHERE id=$1", [m.entityId]))[0];
                if (!row || row.type !== m.type || ![row.data.title, ...list(row.data.aka)].some(n => typeof n === "string" && n.normalize("NFKC").toLocaleLowerCase("und") === m.name.normalize("NFKC").toLocaleLowerCase("und"))) throw new Error("Unverified canonical identity");
                id = m.entityId;
            } else if (r.status === "ambiguous") { skipped.push(m.id); facts.skipped += Object.keys(m.attributes ?? {}).length + (m.attributeUpdates?.length ?? 0) + (m.relations?.length ?? 0); continue; }
            if (!id) {
                const identity = `${m.type}/${m.name.normalize("NFKC").toLocaleLowerCase("und").replace(/\s+/gu, " ").trim()}`;
                id = newNames.get(identity);
                if (!id) {
                    const ascii = m.name.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "entity";
                    // Hash retains all Unicode identity information while complying with canonical ASCII ID grammar.
                    const hash = new Bun.CryptoHasher("sha256").update(identity).digest("hex").slice(0, 20);
                    id = `${m.type}/${ascii}-${hash}`;
                    const collision = await tx.unsafe("SELECT id FROM knowledge.entities WHERE id=$1", [id]);
                    if (collision.length) throw new Error("Canonical ID collision requires explicit resolution");
                    await tx.unsafe("INSERT INTO knowledge.entities(id,type,data) VALUES($1,$2,$3::jsonb)", [id, m.type, JSON.stringify({ title: m.name, base_type: `Entity/${m.type}` })]);
                    await journal(id, "title", null, m.name, "create", m.evidence, m);
                    await journal(id, "base_type", null, `Entity/${m.type}`, "create", m.evidence, m);
                    created.push(id); newNames.set(identity, id);
                }
            }
            entityOf.set(m.id, id);
        }
        const observe = async (subject: string, attribute: string, value: string | string[], quote: string, confidence: number, ref: types.knowledge.Mention) => {
            const source = locate(quote, ref);
            await tx.unsafe(`INSERT INTO knowledge.provenance(subject,attribute,value,source,url,evidence,confidence,observed_at,status) VALUES($1,$2,$3::jsonb,'agent-chat',$4,$5,$6,now(),'observed') ON CONFLICT(subject,attribute,source,url,evidence) DO NOTHING`, [subject, attribute, JSON.stringify(value), `hyper://agent/${source.agentId}/message/${source.idx}`, quote, confidence]);
            written++;
        };
        for (const m of mentions) {
            const subject = entityOf.get(m.id);
            if (!subject) continue;
            await observe(subject, "mention", m.name, m.evidence, m.confidence, m);
            const data = (await tx.unsafe("SELECT data FROM knowledge.entities WHERE id=$1 FOR UPDATE", [subject]))[0].data;
            const fill = async (key: string, value: string | string[], quote: string) => {
                await observe(subject, key, value, quote, m.confidence, m);
                const before = data[key];
                if (data[key] == null || data[key] === "" || (Array.isArray(data[key]) && !data[key].length)) data[key] = value;
                countFact(before, data[key], value);
                await journal(subject, key, before, data[key], "add", quote, m);
            };
            for (const [key, value] of Object.entries(m.attributes ?? {})) await fill(key, value, m.attributeEvidence![key]!);
            for (const r of m.relations ?? []) {
                const target = entityOf.get(r.target) ?? (r.target.includes("/") ? r.target : null);
                if (!target) { skipped.push(`${m.id}.${r.predicate}`); facts.skipped++; continue; }
                const row = (await tx.unsafe("SELECT type,data FROM knowledge.entities WHERE id=$1", [target]))[0];
                const d = definition(m.type, r.predicate);
                const targetMention = mentions.find(x => x.id === r.target);
                const targetName = targetMention?.name ?? row?.data?.title;
                if (!row || !list(d.range).includes(`Entity/${row.type}`) || !text(targetName, 200) || !r.evidence!.includes(targetName)) throw new Error("Unverified relation target or invalid range");
                await fill(r.predicate, d.cardinality === "multi" ? [target] : target, r.evidence!);
                // Only canonical refs are projected; conflicting observations must not create contradictory edges.
                await tx.unsafe("DELETE FROM knowledge.relations WHERE subject=$1 AND predicate=$2", [subject, r.predicate]);
                for (const object of list(data[r.predicate])) await tx.unsafe("INSERT INTO knowledge.relations(subject,predicate,object) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [subject, r.predicate, object]);
            }
            for (const u of m.attributeUpdates ?? []) {
                const d = definition(m.type, u.attribute);
                if (!["add", "correct"].includes(u.operation) || !["string", "url", "date", "ref"].includes(d.datatype) || Object.hasOwn(m.attributes ?? {}, u.attribute) || m.relations?.some(r => r.predicate === u.attribute)) throw new Error("Invalid or overlapping update");
                const values = list(u.value);
                if ((typeof u.value !== "string" && !Array.isArray(u.value)) || (Array.isArray(u.value) && (d.cardinality !== "multi" || u.value.some(v => typeof v !== "string"))) || !values.length || values.length > 10 || values.some(v => !text(v, 500))) throw new Error("Invalid update value");
                const source = locate(u.evidence, m);
                let labels = values;
                if (d.datatype === "ref") {
                    labels = [];
                    for (const target of values) {
                        const row = (await tx.unsafe("SELECT type,data FROM knowledge.entities WHERE id=$1", [target]))[0];
                        if (!row || !list(d.range).includes(`Entity/${row.type}`) || !text(row.data.title, 200)) throw new Error("Invalid update reference");
                        labels.push(row.data.title);
                    }
                }
                if (!u.evidence.includes(m.name) || labels.some(v => !u.evidence.includes(v))) throw new Error("Unverified update");
                if (d.datatype === "url" && values.some(v => { try { return !["https:", "http:"].includes(new URL(v).protocol); } catch { return true; } })) throw new Error("Invalid URL");
                if (d.datatype === "date" && values.some(v => !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) throw new Error("Invalid date");
                const old = data[u.attribute];
                if (u.operation === "correct") {
                    // Require explicit correction intent in the verified user quote,
                    // not a special command grammar. Name/value containment is checked
                    // above; ownership below prevents replacing imported facts.
                    const correctionIntent = /(?:\b(?:correction|correct|actually|instead)\b|(?:^|[\s,.:;!?])(?:исправь|исправьте|исправление|поправка|поправь|на самом деле)(?=$|[\s,.:;!?]))/iu.test(u.evidence);
                    if (source.role !== "user" || source.agentId !== parentId || source.idx <= Number(current.appliedSourceMessageIdx ?? current.lastSuccessfulMessageIdx ?? -1) || !correctionIntent) throw new Error("Explicit correction directive required");
                    const owned = await tx.unsafe("SELECT value FROM knowledge.provenance WHERE subject=$1 AND attribute=$2 AND source='agent-chat' AND url LIKE $3", [subject, u.attribute, `hyper://agent/${parentId}/message/%`]);
                    if (old == null || !owned.some((p: { value: string | string[] }) => JSON.stringify(p.value) === JSON.stringify(old))) throw new Error("Correction requires current field ownership by this chat");
                    data[u.attribute] = u.value;
                } else if (old == null || old === "" || (Array.isArray(old) && !old.length)) data[u.attribute] = u.value;
                else if (d.cardinality === "multi") data[u.attribute] = [...new Set([...list(old), ...values])];
                // Multi-valued fields are sets: reordered equivalent submissions are not canonical changes.
                if (equalValue(old, data[u.attribute])) data[u.attribute] = old;
                countFact(old, data[u.attribute], u.value);
                await journal(subject, u.attribute, old, data[u.attribute], u.operation, u.evidence, m);
                await observe(subject, u.attribute, u.value, u.evidence, m.confidence, m);
                if (d.datatype === "ref") {
                    await tx.unsafe("DELETE FROM knowledge.relations WHERE subject=$1 AND predicate=$2", [subject, u.attribute]);
                    for (const object of list(data[u.attribute])) await tx.unsafe("INSERT INTO knowledge.relations(subject,predicate,object) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [subject, u.attribute, object]);
                }
            }
            await tx.unsafe("UPDATE knowledge.entities SET data=$2::jsonb,updated_at=now() WHERE id=$1", [subject, JSON.stringify(data)]);
            const body = JSON.stringify(data);
            await tx.unsafe(`INSERT INTO knowledge.search(id,type,title,body,search_vector) VALUES($1,$2,$3,$4,to_tsvector('simple',$4)) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,search_vector=excluded.search_vector,updated_at=now()`, [subject, m.type, data.title ?? m.name, body]);
        }
        const preview = resolved.map(({ mention, resolution }) => ({ ...mention, status: resolution.status, entityId: entityOf.get(mention.id) ?? null, candidates: resolution.candidates }));
        const lastTurn = { sourceMessageIdx: cutoff, matched: [...new Set(entityOf.values())].filter(id => !created.includes(id)).length, created: created.length, skippedMentions: resolved.filter(({ mention }) => !entityOf.has(mention.id)).length, facts };
        scratchpad.knowledgeSidecar = { ...current, lastTurn, status: "ready", error: undefined, lastSuccessfulMessageIdx: cutoff, appliedSourceMessageIdx: cutoff, sourceMessageIdx: cutoff, sidecarId: me.id, updatedAt: Date.now(), mentions: [...preview, ...(current.mentions ?? []).filter((m: { sourceAgentId?: string; sourceMessageIdx?: number }) => !preview.some(p => p.sourceAgentId === m.sourceAgentId && p.sourceMessageIdx === m.sourceMessageIdx))].slice(0, 80) };
        await tx.unsafe("UPDATE agents SET scratchpad=$2,updated_at=$3 WHERE id=$1", [parentId, JSON.stringify(scratchpad), Date.now()]);
        return { answer: { parentId, written, created, skipped, mentions: preview }, scratchpad };
    });
    if (result.scratchpad) {
        const parent = ctx.state.agent[parentId];
        if (parent) parent.scratchpad = { ...parent.scratchpad, knowledgeSidecar: result.scratchpad.knowledgeSidecar };
        ctx.fns.events.refreshAgentMeta({ agentId: parentId, section: "knowledge" as any, reason: "knowledge-sidecar" });
    }
    return result.answer;
}
