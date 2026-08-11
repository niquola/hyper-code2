import { describe, expect, test } from "bun:test";
import send from "./send";
import sendFile from "./sendFile";
import createFolder from "./createFolder";
import leave from "./leave";

const ctx: any = {};

describe("Telegram write guards", () => {
    test("send requires explicit confirmation before connecting", async () => {
        await expect(send(ctx, null, { chat: "me", text: "hello" })).rejects.toThrow("confirm: true");
    });
    test("sendFile requires explicit confirmation before connecting", async () => {
        await expect(sendFile(ctx, null, { chat: "me", path: "/tmp/x" })).rejects.toThrow("confirm: true");
    });
    test("createFolder requires explicit confirmation before connecting", async () => {
        await expect(createFolder(ctx, null, { title: "x", chats: ["me"] })).rejects.toThrow("confirm: true");
    });
    test("leave requires explicit confirmation before connecting", async () => {
        await expect(leave(ctx, null, { chat: "me" })).rejects.toThrow("confirm: true");
    });
});
