import { describe, expect, test } from "bun:test";
import matchPerson from "./matchPerson";

describe("knowledge.matchPerson", () => {
    test("prefers exact normalized phone matches", async () => {
        const ctx: any = { fns: { knowledge: { ensure: async () => {} }, procs: { db: { select: async () => [{ id: "Person/max", data: { title: "Max Test", phone: "+7 911 123-45-67" } }] } } } };
        expect((await matchPerson(ctx,null,{phone:"8 (911) 123-45-67"})).id).toBe("Person/max");
    });
});
