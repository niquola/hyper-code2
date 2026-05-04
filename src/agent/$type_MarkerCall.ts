// One marker-protocol invocation.
//   §eval                 → kind='eval',  content = JS/TS to run
//   §write:<path>         → kind='write', path = file path, content = file body
//   §bash                 → kind='bash',  content = shell script run via `bash -c`
//   §html                 → kind='html',  content = raw HTML rendered as a bubble
//   §read[:format]        → kind='read',  path = file path, format? = plain|hashline
//   §grep[:format]        → kind='grep',  query string with path/pattern/glob kv lines
//   §edit[:format]        → kind='edit',  body = edit payload
export type MarkerCall =
    | { kind: 'eval'; content: string }
    | { kind: 'write'; path: string; content: string }
    | { kind: 'bash'; content: string }
    | { kind: 'html'; content: string }
    | { kind: 'read'; path: string; format?: 'plain' | 'hashline' }
    | { kind: 'grep'; format?: 'plain' | 'hashline'; content: string }
    | { kind: 'edit'; format?: 'hashline'; content: string };