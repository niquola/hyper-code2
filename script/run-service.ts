#!/usr/bin/env bun
/** Runs Hyper under launchd while keeping bounded stdout/stderr log files. */
import { appendFileSync, existsSync, renameSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const runtime = resolve(root, ".runtime");
const maxBytes = Math.max(1_048_576, Number(process.env.LOG_MAX_BYTES ?? 25 * 1024 * 1024));
const keep = Math.max(1, Math.min(10, Number(process.env.LOG_KEEP ?? 3)));

function rotate(path: string, incoming = 0): void {
    let size = 0;
    try { size = statSync(path).size; } catch {}
    if (size + incoming <= maxBytes) return;
    rmSync(`${path}.${keep}`, { force: true });
    for (let n = keep - 1; n >= 1; n--) {
        if (existsSync(`${path}.${n}`)) renameSync(`${path}.${n}`, `${path}.${n + 1}`);
    }
    if (existsSync(path)) renameSync(path, `${path}.1`);
}

async function pump(stream: ReadableStream<Uint8Array>, path: string): Promise<void> {
    for await (const chunk of stream) {
        rotate(path, chunk.byteLength);
        appendFileSync(path, chunk);
    }
}

const out = resolve(runtime, "server.log");
const err = resolve(runtime, "server.error.log");
rotate(out);
rotate(err);
const child = Bun.spawn([process.execPath, "src/$main.ts"], {
    cwd: root,
    env: process.env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
});
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => child.kill(signal));
await Promise.all([pump(child.stdout, out), pump(child.stderr, err), child.exited]);
process.exit(child.exitCode ?? 1);
