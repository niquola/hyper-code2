# TODO

## Problem

- Tool-call failures are recurring when the model tries to embed large code blobs inside `evalCode`.
- The main failure mode is escaping/embedding breakage inside JavaScript strings or template literals:
  - backticks inside generated code
  - `${...}` interpolation sequences
  - backslashes / invalid escapes
  - raw source accidentally leaking out of the intended string container
- This produces errors like:
  - `Unexpected identifier ...`
  - `Invalid escape in identifier ...`
- Secondary issues also happen, but less often:
  - operating on unknown shapes without inspection (`list.filter is not a function`)
  - reading paths that were not verified first (`ENOENT`)

## Why current design encourages this

- We expose only one tool schema to the model: `evalCode`.
- File writing is technically possible via JS inside `evalCode`, but ergonomically unsafe for large content.
- So the model is pushed toward a fragile pattern: generate a large multiline string inside JS and write it from there.
- The system prompt currently reinforces the “one tool only” model and does not provide a safer dedicated write path.

## Proposed solution

- Add a second tool dedicated to writing files, e.g. `writeCode` or `writeFile`.
- Recommended schema:
  - `path: string`
  - `content: string`
  - optional `mkdirParents?: boolean`
  - optional `open?: boolean`
- Runtime behavior:
  - write via `ctx.fns.files.write(ctx, path, content)`
  - optionally `ctx.fns.files.open(ctx, path)`
  - return compact metadata only: `{ ok, path, bytes, lines }`

## Required code changes

- Tool schema definition: currently in `src/agent/$route_new_POST.ts`.
- Tool execution dispatch: currently in `src/agent/run.ts`.
- Tool instructions to the model: currently in `src/agent/SYSTEM_PROMPT.md`.
- Suggested refactor: move default tool schemas into a helper like `src/agent/defaultTools.ts`.

## Prompt update

- Replace “exactly ONE tool: evalCode” with explicit two-tool guidance.
- New rule:
  - use `evalCode` for computation, inspection, reading, tests, shell, DB, transformations
  - use `writeCode` for creating or replacing non-trivial file contents
- Also keep the inspection discipline:
  - inspect shape before transforming
  - verify path before reading when uncertain

## Expected benefit

- Fewer escaping-related tool-call failures.
- Cleaner tool calls.
- Less context wasted on retrying broken inline code-generation attempts.
- Clearer division between “compute” and “write file” actions.
