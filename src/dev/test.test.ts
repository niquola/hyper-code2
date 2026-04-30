import { describe, test, expect } from "bun:test";
import devTest from "./test";
import readLog from "./readLog";
import testSummary from "./testSummary";

describe("dev test helpers", () => {
    test("returns compact summary for passing test file", async () => {
        const agent = { scratchpad: {} };
        const res = await devTest({} as Context, { files: ['./src/project/classify.test.ts'], agent });
        expect(res.ok).toBe(true);
        expect(res.pass).toBeGreaterThan(0);
        expect(res.fail).toBe(0);
        expect(res.logPath).toContain('.hyper/_runtime/logs/test-');
        expect((agent as any).scratchpad.dev.lastTestRun.logPath).toBe(res.logPath);
        expect((res as any).stdout).toBeUndefined();
        expect((res as any).stderr).toBeUndefined();
    });

    test("readLog reads last run tail", async () => {
        const agent = { scratchpad: {} as any };
        const run = await devTest({} as Context, { files: ['./src/project/classify.test.ts'], agent });
        const log = await readLog({} as Context, { run: 'last', tail: 5, agent });
        expect(log.path).toBe(run.logPath);
        expect(log.text).toContain('pass');
        expect(log.totalLines).toBeGreaterThan(0);
    });

    test("testSummary returns concise parsed result", async () => {
        const agent = { scratchpad: {} as any };
        await devTest({} as Context, { files: ['./src/project/classify.test.ts'], agent });
        const summary = await testSummary({} as Context, 'last', { agent });
        expect(summary.ok).toBe(true);
        expect(summary.fail).toBe(0);
        expect(summary.failedTests).toEqual([]);
    });

    test("verbose mode returns tails, not full logs", async () => {
        const res = await devTest({} as Context, { files: ['./src/project/classify.test.ts'], verbose: true });
        expect(res.ok).toBe(true);
        expect((res as any).stdoutTail).toContain('bun test');
        expect(typeof (res as any).stderrTail).toBe('string');
        expect((res as any).stdout).toBeUndefined();
        expect((res as any).stderr).toBeUndefined();
    });
});
