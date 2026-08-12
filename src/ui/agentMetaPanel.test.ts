import { expect, test } from "bun:test";
import render from "./agentMetaPanel";

test("agent meta panel is a topic-addressed live region", () => {
    const ctx: any = { fns: {
        procs: { ui: { escape: ({ text }: any) => String(text) } },
        ui: { live: (o: any) => `<${o.tag} id="${o.id}" hx-get="${o.url}" data-live-topic="${o.topic}" ${o.attrs}>${o.html}</${o.tag}>` },
    } };
    const html = render(ctx, null, { agent: { id: "eh", goal: null } as any });
    expect(html).toContain('id="agent-meta-eh"');
    expect(html).toContain('hx-get="/ui/agent/eh/meta"');
    expect(html).toContain('data-live-topic="agent-meta:eh"');
});
