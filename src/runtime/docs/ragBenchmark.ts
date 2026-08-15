type Case = { query: string; expected: string[]; relevant?: string[]; noResult?: boolean };

const CASES: Case[] = [
    { query: "send a telegram message", expected: ["telegram.send"], relevant: ["telegram.sendFile", "telegram.messages"] },
    { query: "read only duckdb sql", expected: ["duckdb.query"], relevant: ["duckdb.run", "duckdb.ndjson"] },
    { query: "wait until a condition becomes true then resume the agent", expected: ["agent.wakeUpWhen", "agent.waitForEvent"] },
    { query: "list unread gmail messages", expected: ["gmail.list"], relevant: ["gmail.get"] },
    { query: "create a GitHub issue", expected: ["gh.createIssue"], relevant: ["gh.issues", "gh.issue"] },
    { query: "find a place near me", expected: ["gplaces.nearby", "gplaces.search"] },
    { query: "read a file with line anchors", expected: ["files.readHashline"], relevant: ["files.formatHashline"] },
    { query: "schedule agent wake up tomorrow", expected: ["agent.wakeAt", "agent.wakeIn"], relevant: ["agent.wakeUpWhen"] },
    { query: "thanks, continue", expected: [], noResult: true },
    { query: "make this prettier", expected: [], noResult: true },
    { query: "hello how are you", expected: [], noResult: true },
    { query: "спасибо продолжай", expected: [], noResult: true },
    { query: "проверить почту", expected: ["gmail.list", "gmail.get"] },
];

/** Evaluates cosine thresholds against labelled runtime-function intents. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Cosine thresholds to evaluate. */
        thresholds?: number[];
    } = {},
): Promise<any> {
    const thresholds = opts.thresholds ?? [0.20, 0.25, 0.28, 0.30, 0.32, 0.35, 0.38, 0.40, 0.45];
    const evaluated = [];
    for (const test of CASES) {
        const hits = await ctx.fns.runtime.docs.search({ query: test.query, mode: "hybrid", limit: 20 });
        evaluated.push({ test, hits });
    }
    const rows = thresholds.map(threshold => {
        let trueQueries = 0, falseQueries = 0, expectedFound = 0, expectedTotal = 0;
        for (const { test, hits } of evaluated) {
            const selected = hits.filter((hit: any) => hit.similarity != null && Number(hit.similarity) >= threshold && !String(hit.name).startsWith("tmp.")).slice(0, 5);
            if (test.noResult) {
                if (selected.length) falseQueries++; else trueQueries++;
                continue;
            }
            expectedTotal++;
            if (selected.some((hit: any) => test.expected.includes(hit.name))) { expectedFound++; trueQueries++; }
            else falseQueries++;
        }
        return {
            threshold,
            queryAccuracy: trueQueries / (trueQueries + falseQueries),
            recallAt5: expectedTotal ? expectedFound / expectedTotal : 0,
            noResultPrecision: CASES.filter(test => test.noResult).length
                ? CASES.filter(test => test.noResult).filter(test => {
                    const row: any = evaluated.find(item => item.test === test);
                    return !row.hits.some((hit: any) => hit.similarity != null && Number(hit.similarity) >= threshold && !String(hit.name).startsWith("tmp."));
                }).length / CASES.filter(test => test.noResult).length
                : 1,
        };
    });
    return {
        model: await ctx.fns.settings.getString({ module: "embeddings", scopeType: "global", key: "model" }),
        cases: CASES.length,
        thresholds: rows,
        observations: evaluated.map(({ test, hits }) => ({
            query: test.query,
            expected: test.expected,
            noResult: test.noResult === true,
            top: hits.slice(0, 8).map((hit: any) => ({ name: hit.name, rrf: hit.score, bm25: hit.bm25, cosine: hit.similarity })),
        })),
    };
}
