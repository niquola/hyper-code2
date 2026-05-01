import { describe, test, expect } from "bun:test";
import classify from "./classify";

describe("project.classify", () => {
    test("classifies function files", () => {
        expect(classify('db/connect.ts')).toMatchObject({ kind: 'fn', moduleDir: 'db', runtimeName: 'connect' });
        expect(classify('$layout.ts')).toMatchObject({ kind: 'fn', moduleDir: '.', runtimeName: 'layout' });
    });

    test("classifies type files", () => {
        expect(classify('agent/$type_Agent.ts')).toMatchObject({ kind: 'type', moduleDir: 'agent', typeName: 'Agent' });
    });

    test("classifies route files", () => {
        expect(classify('agent/$route_$id_POST.ts')).toMatchObject({ kind: 'route', routePath: '/agent/:id', method: 'POST' });
        expect(classify('$route_GET.ts')).toMatchObject({ kind: 'route', routePath: '/', method: 'GET' });
    });

    test("classifies script files", () => {
        expect(classify('agent/$script_chat.js')).toMatchObject({ kind: 'script', routePath: '/agent/chat.js' });
    });

    test("skips tests and declarations", () => {
        expect(classify('db/connect.test.ts')).toMatchObject({ kind: 'skip', reason: 'test' });
        expect(classify('ctx_ns.d.ts')).toMatchObject({ kind: 'skip', reason: 'dts' });
    });

    test("classifies declared settings", () => {
        expect(classify('llm/$setting_defaultModel.ts')).toMatchObject({
            kind: 'setting', moduleDir: 'llm', settingModule: 'llm', settingKey: 'defaultModel',
        });
        expect(classify('agent/$setting_debounceMs.ts')).toMatchObject({
            kind: 'setting', settingModule: 'agent', settingKey: 'debounceMs',
        });
    });

    test("rejects setting at root (no module folder)", () => {
        expect(classify('$setting_foo.ts')).toMatchObject({ kind: 'skip', reason: 'setting-needs-module-folder' });
    });

    test("rejects setting with empty key", () => {
        expect(classify('llm/$setting_.ts')).toMatchObject({ kind: 'skip' });
    });
});
