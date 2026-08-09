import { describe, test, expect } from "bun:test";
import markerKind from "./markerKind";

const ctx = {} as Context;
const k = (content: any) => markerKind(ctx, null, { content });

describe("agent.markerKind", () => {
    test("classifies assistant invocations", () => {
        expect(k("§eval\nconsole.log(1)")).toBe("invocation");
        expect(k("§eval")).toBe("invocation");
        expect(k("§write:src/x.ts\nbody")).toBe("invocation");
        expect(k("§bash\nls")).toBe("invocation");
        expect(k("§bash")).toBe("invocation");
        expect(k("§html\n<div/>")).toBe("invocation");
        expect(k("§html")).toBe("invocation");
    });

    test("classifies synthetic results", () => {
        expect(k("§result:eval\n42")).toBe("result");
        expect(k("§result:bash\nok")).toBe("result");
        expect(k("§error:marker-misplaced\nhint")).toBe("result");
    });

    test("ordinary prose / empty / null is null", () => {
        expect(k("just talking about §eval in prose")).toBe(null);
        expect(k("")).toBe(null);
        expect(k(null)).toBe(null);
        expect(k(undefined)).toBe(null);
    });
});
