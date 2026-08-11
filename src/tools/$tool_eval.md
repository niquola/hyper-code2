---
description: >-
  Run TypeScript/JavaScript inside the running server process. `ctx` is in scope, so every
  ctx.fns.<module>.<fn>({ ... }) is callable. Jupyter-style — console.log/print are captured
  and the last expression is returned.
marker: eval
promptSnippet: "run JS/TS in-process, with ctx in scope"
promptGuidelines:
  - "Prefer ONE eval that composes several ctx.fns calls (loops, Promise.all) for mechanical work — reading N files, a series of selects. Keep DECISIONS (edits, commits, anything a human should see) as separate calls."
parameters:
  type: object
  properties:
    code:
      type: string
      description: "Code to evaluate. Top-level await is allowed."
  required: [code]
  additionalProperties: false
---
### `§eval`

- Runs JavaScript or TypeScript as the body of an async function.
- Top-level await works.
- Use `console.log(...)` or `print(...)` to produce output.
- Return values are ignored.
