# External coding harnesses

Hyper can expose its live procedural runtime to local coding harnesses such as Claude Code and Codex. The integration has three surfaces:

1. capability and function discovery through the `hyper` CLI;
2. schema-validated calls to declared tools;
3. a privileged arbitrary REPL for trusted local automation.

Mounted plugins can also be published as managed `hyper-*` agent skills. All calls go to the already-running Hyper process, so they use its current function registry, hot reloads, Postgres pool, settings, OAuth sessions, browser state, and plugins.

## Install the CLI

Run it from the repository:

```sh
bun script/hyper.ts status
```

For a global command, link the script somewhere on `PATH`:

```sh
chmod +x "$HOME/hyper-code2/script/hyper.ts"
ln -s "$HOME/hyper-code2/script/hyper.ts" "$HOME/.local/bin/hyper"
```

The client finds the process through `$WORKDIR/.runtime/port`. If `WORKDIR` is unset, it uses the current directory. Run it from the Hyper workspace or set `WORKDIR` explicitly:

```sh
WORKDIR="$HOME/hyper-code2" hyper status
```

Output is JSON on stdout. Errors use a non-zero exit status.

## Discover plugins and runtime functions

Search plugin workflows with concise English capability terms, then read the selected plugin's human-written workflow and generated live API documentation:

```sh
hyper plugin search "GitHub pull request review"
hyper plugin read gh
```

List or search the complete live function catalogue:

```sh
hyper functions --namespace gh --limit 100
hyper function search "inspect pull request files and reviews"
hyper function read gh.pr
```

`function search` uses Hyper's runtime documentation search. `function read` returns the current summary, JSDoc, signature, option schema, return type, and source path. These commands reflect hot-reloaded code rather than a static catalogue.

## Call declared tools

Declared tools are the constrained external execution surface. Their JSON Schemas are listed by `hyper tools`, and calls go through the same `tools.validate` and `tools.call` path used by Hyper agents:

```sh
hyper tools
hyper tool call find --json '{"path":"src","pattern":"*.ts","limit":20}'
```

Unknown arguments and schema violations are rejected before the implementation runs. Tool output has the standard shape:

```json
{
  "output": "...",
  "isError": false
}
```

Plugin functions are discoverable through `plugin` and `function` commands, but they are not automatically promoted to declared tools. Use the privileged REPL when a workflow intentionally needs an arbitrary documented runtime function.

## Privileged arbitrary REPL

`hyper repl` evaluates Bun JavaScript or TypeScript with the live `ctx` in scope:

```sh
hyper repl 'return await ctx.fns.gh.repo({owner:"niquola", repo:"hyper-code2"})'

echo 'return Object.keys(ctx.fns)' | hyper repl
```

This is intentionally as powerful as direct runtime access. It can call internal functions, query Postgres, edit files, and trigger external writes. Use it only from a trusted local harness, never print secrets, and preserve each plugin's confirmation requirements.

The REPL is disabled when `NODE_ENV=production`.

## Publish plugins as agent skills

Publish a generated `hyper-runtime` bridge skill and every mounted plugin with a collision-resistant `hyper-` prefix:

```sh
hyper skills mount --dry-run
hyper skills mount
```

Hyper writes only missing symlinks and never replaces an existing file, directory, or link. Repeated runs are idempotent and report three groups:

- `linked`: links created by this run;
- `existing`: links already pointing at the expected source;
- `collisions`: names owned by something else and left untouched.

Existing skill roots are detected under:

```text
~/.agent/skills
~/.claude/skills
~/.codex/skills
```

Equivalent roots reached through symlinks are deduplicated. A typical mounted name is `hyper-gh`, leaving an older `gh` skill untouched.

## Security model

Hyper uses two separate bearer tokens stored with mode `0600` in the runtime directory:

```text
.runtime/external-token       capability discovery and declared tools
.runtime/external-repl-token  privileged arbitrary REPL
```

The tokens are not interchangeable. External routes:

- accept only a socket peer with a loopback address;
- reject `x-forwarded-for` and `x-forwarded-host` requests;
- require a token with the route's exact JWT `kind`;
- cap request bodies at 256 KB.

The browser-oriented `/rpc` route is not an external harness API. It requires an authenticated browser session in addition to same-origin checks. Use `/external/*` through the CLI instead.

## Command reference

```text
hyper status
hyper plugin search <English capability query>
hyper plugin read <name>
hyper functions [--namespace <name>] [--limit <n>]
hyper function search <English capability query>
hyper function read <namespace.function>
hyper tools
hyper tool call <name> --json '{...}'
hyper skills mount [--dry-run]
hyper repl '<arbitrary code>'
```
