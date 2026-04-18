import { test, expect, describe } from "bun:test";
import match from "./match";

const h = () => new Response();

describe("server.match", () => {
    const routes = {
        "/": { GET: h },
        "/api": { GET: h, POST: h },
        "/user/:id": { GET: h },
        "/user/:id/posts/:pid": { GET: h },
    };

    test("exact match", () => {
        const m = match(routes, "GET", "/");
        expect(m).not.toBeNull();
        expect(m!.params).toEqual({});
        expect(m!.handler).toBe(h);
    });

    test("method dispatch", () => {
        expect(match(routes, "POST", "/api")).not.toBeNull();
        expect(match(routes, "DELETE", "/api")).toBeNull();
    });

    test("single param", () => {
        const m = match(routes, "GET", "/user/42");
        expect(m!.params).toEqual({ id: "42" });
    });

    test("multiple params", () => {
        const m = match(routes, "GET", "/user/42/posts/99");
        expect(m!.params).toEqual({ id: "42", pid: "99" });
    });

    test("404 on unknown path", () => {
        expect(match(routes, "GET", "/nope")).toBeNull();
    });

    test("404 on wrong segment count", () => {
        expect(match(routes, "GET", "/user")).toBeNull();
        expect(match(routes, "GET", "/user/42/extra")).toBeNull();
    });
});
