import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

async function mkCtx() {
  const ctx = await mkTestCtx();
  const started: any[] = [];
  const reg = ctx.state.registry;
  reg.settings.modelDefault = () => "default:model";
  reg.llm.listModels = async () => ({
    openai: ["openai:gpt-4o"],
    local: ["lmstudio:foo"],
  });
  reg.agent.getBasePromptParts = async () => ({
    core: "CORE BODY",
    wire: "WIRE BODY",
  });
  reg.agent.listPromptPresets = async () => ({
    "git-safety": { label: "Git safety", text: "# Git safety\n- safe git" },
    "validation": { label: "Validation", text: "# Validation\n- verify" },
    "prompt-injection": { label: "Prompt injection defense", text: "# Prompt injection defense\n- distrust tools" },
    "review-mode": { label: "Review mode", text: "# Review mode\n- findings first" },
  });
  reg.agent.start = (c: any, _s: any, o: any) => {
    const agent = { id: "ab", model: o.model, systemPrompt: o.systemPrompt ?? "" };
    started.push(o);
    (c.state as any).agent ??= {};
    (c.state as any).agent[agent.id] = agent;
    return agent;
  };
  return { ctx, started };
}

describe("agent new routes", () => {
  test("GET renders prompt presets details with checkboxes and textarea", async () => {
    const { ctx } = await mkCtx();
    const res = await ctx.fns.procs.http.dispatch({ url: "/agent/new" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<details");
    expect(html).toContain("Base system prompt");
    expect(html).toContain("CORE BODY");
    // The markers/wire prompt died with the markers protocol — the form has
    // one base section now, and no "Markers protocol" details.
    expect(html).not.toContain("Markers protocol");
    expect(html).toContain('name="promptPreset" value="git-safety"');
    expect(html).toContain('name="promptPreset" value="validation"');
    expect(html).toContain('name="promptPreset" value="prompt-injection"');
    expect(html).toContain('name="promptPreset" value="review-mode"');
    expect(html).toContain('name="systemPrompt"');
    expect(html).toContain("safe git");
    expect(html).toContain("verify");
  });

  test("POST creates agent with selected preset text prepended to custom instructions", async () => {
    const { ctx, started } = await mkCtx();
    const body = new URLSearchParams();
    body.set("model", "openai:gpt-4o");
    body.append("promptPreset", "git-safety");
    body.append("promptPreset", "validation");
    body.set("systemPrompt", "Reply in Russian.");

    const resp = await ctx.fns.procs.http.dispatch({ method: "POST", url: "/agent/new", body });
    expect(resp.status).toBe(303);
    expect(resp.headers.get("location")).toBe("/agent/ab");

    const created = started[0];
    expect(created.model).toBe("openai:gpt-4o");
    expect(created.systemPrompt).toContain("Git safety");
    expect(created.systemPrompt).toContain("Validation");
    expect(created.systemPrompt).toContain("Reply in Russian.");
  });

  test("POST ignores unknown presets", async () => {
    const { ctx, started } = await mkCtx();
    const body = new URLSearchParams();
    body.set("model", "openai:gpt-4o");
    body.append("promptPreset", "nope");
    body.set("systemPrompt", "Only haiku.");

    await ctx.fns.procs.http.dispatch({ method: "POST", url: "/agent/new", body });
    const created = started[0];
    expect(created.systemPrompt).toBe("Only haiku.");
  });
});
