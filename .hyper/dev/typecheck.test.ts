import { describe, test, expect } from "bun:test";
import typecheck from "./typecheck";

describe("dev.typecheck", () => {
    test("returns compact success summary", async () => {
        const agent = { scratchpad: {} as any };
        const res = await typecheck({} as Context, { files: ['-p', 'tsconfig.json'], agent });
        expect(typeof res.ok).toBe('boolean');
        expect(res.logPath).toContain('.hyper/_runtime/logs/typecheck-');
        expect((agent as any).scratchpad.dev.lastTypecheckRun.logPath).toBe(res.logPath);
    });

    test("verbose mode returns tails only", async () => {
        const res = await typecheck({} as Context, { files: ['-p', 'tsconfig.json'], verbose: true });
        expect((res as any).stdout).toBeUndefined();
        expect((res as any).stderr).toBeUndefined();
        expect(typeof (res as any).stdoutTail).toBe('string');
        expect(typeof (res as any).stderrTail).toBe('string');
    });
});
