---
description: >-
  Run a shell command via `bash -c`. Runs in the agent's workspace unless cwd says otherwise.
  Returns stdout; a non-zero exit returns [exit N] with stderr, and a command that outruns
  timeout is killed and reported with whatever it printed.
marker: bash
promptSnippet: "run shell commands (ls, git, tests)"
promptGuidelines:
  - "Give bash a timeout when a command could hang (a server, a watcher, a prompt) — and make it generous: a slow search needs minutes, and a timeout that is too tight kills work that was about to succeed."
  - "To locate files use the find tool and to search contents use grep; `bash find ~` walks every node_modules on the machine and dies on the clock."
parameters:
  type: object
  properties:
    command:
      type: string
      description: "Shell script to run."
    cwd:
      type: string
      description: "Directory to run in. Relative paths resolve against the workspace. Defaults to the workspace."
    env:
      type: object
      description: "Extra environment variables, merged over the server's own environment."
      additionalProperties:
        type: string
    timeout:
      type: integer
      description: "Seconds before the command is killed. No timeout by default."
  required: [command]
  additionalProperties: false
---
### `§bash`

- Runs the body as a shell script via `bash -c`, in the workspace directory.
- stdout comes back as the result; a non-zero exit returns `[exit N]` with stderr.
- The marker form takes no options — use the `bash` tool call for cwd / env / timeout.
