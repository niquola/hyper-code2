---
description: >-
  Run TypeScript/JavaScript inside the running server process. `ctx` is in scope, so every
  ctx.fns.<module>.<fn>({ ... }) is callable. The code is typechecked against the live project
  before execution when repl.typecheckEval is enabled. Jupyter-style — console.log/print are
  captured and the last expression is returned.
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
### Native `eval` tool

- The JSON `code` argument runs as the body of an async function.
- By default it is checked by an in-process TypeScript Language Service before execution; type errors prevent all side effects.
- Disable globally with the declared setting `repl.typecheckEval=false` or `EVAL_TYPECHECK=false`. Internal callers may override one call with `procs.repl.eval({ code, typecheck: false })`.
- Top-level await works.
- Use `console.log(...)` or `print(...)` to produce output.
- Return values are ignored.
