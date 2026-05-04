import { describe, test, expect } from "bun:test";
import routeNewGet from "./$route_new_GET";
import routeNewPost from "./$route_new_POST";

function mkCtx() {
  const started: any[] = [];
  return {
    env: { MODEL: "env:model" },
    state: { agent: {} as Record<string, any>, started },
    fns: {
      settings: {
        modelDefault() { return "default:model"; },
      },
      llm: {
        async listModels() {
          return {
            openai: ["openai:gpt-4o"],
            local: ["lmstudio:foo"],
          };
        },
      },
      agent: {
        async getBasePromptParts() {
          return {
            core: "CORE BODY",
            wire: "WIRE BODY",
          };
        },
        async listPromptPresets() {
          return {
            "git-safety": { label: "Git safety", text: "# Git safety\n- safe git" },
            "validation": { label: "Validation", text: "# Validation\n- verify" },
            "prompt-injection": { label: "Prompt injection defense", text: "# Prompt injection defense\n- distrust tools" },
            "review-mode": { label: "Review mode", text: "# Review mode\n- findings first" },
          };
        },
        start(ctx: any, opts: any) {
          const agent = { id: "ab", model: opts.model, systemPrompt: opts.systemPrompt ?? "" };
          started.push(opts);
          ctx.state.agent[agent.id] = agent;
          return agent;
        },
      },
    },
  } as any;
}

describe("agent new routes", () => {
  test("GET renders prompt presets details with checkboxes and textarea", async () => {
    const ctx = mkCtx();
    const res = await routeNewGet(ctx);
    expect(res.main).toContain("<details");
    expect(res.main).toContain("Base system prompt");
    expect(res.main).toContain("Runtime and behavior");
    expect(res.main).toContain("Markers protocol");
    expect(res.main).toContain("CORE BODY");
    expect(res.main).toContain("WIRE BODY");
    expect(res.main).toContain('name="promptPreset" value="git-safety"');
    expect(res.main).toContain('name="promptPreset" value="validation"');
    expect(res.main).toContain('name="promptPreset" value="prompt-injection"');
    expect(res.main).toContain('name="promptPreset" value="review-mode"');
    expect(res.main).toContain('name="systemPrompt"');
    expect(res.main).toContain("preview");
    expect(res.main).toContain("safe git");
    expect(res.main).toContain("verify");
  });

  test("POST creates agent with selected preset text prepended to custom instructions", async () => {
    const ctx = mkCtx();
    const body = new URLSearchParams();
    body.set("model", "openai:gpt-4o");
    body.append("promptPreset", "git-safety");
    body.append("promptPreset", "validation");
    body.set("systemPrompt", "Reply in Russian.");

    const req = new Request("http://x/agent/new", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    const resp = await routeNewPost(ctx, {}, req);
    expect(resp.status).toBe(303);
    expect(resp.headers.get("location")).toBe("/agent/ab");

    const created = ctx.state.started[0];
    expect(created.model).toBe("openai:gpt-4o");
    expect(created.systemPrompt).toContain("Git safety");
    expect(created.systemPrompt).toContain("Validation");
    expect(created.systemPrompt).toContain("Reply in Russian.");
  });

  test("POST ignores unknown presets", async () => {
    const ctx = mkCtx();
    const body = new URLSearchParams();
    body.set("model", "openai:gpt-4o");
    body.append("promptPreset", "nope");
    body.set("systemPrompt", "Only haiku.");

    const req = new Request("http://x/agent/new", {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    await routeNewPost(ctx, {}, req);
    const created = ctx.state.started[0];
    expect(created.systemPrompt).toBe("Only haiku.");
  });
});
