// One marker-protocol invocation. Four kinds, hardcoded:
//   §eval         → kind='eval',  content = JS/TS to run (returns stdout)
//   §write:<path> → kind='write', path = file path, content = file body
//   §bash         → kind='bash',  content = shell script run via `bash -c`
//   §html         → kind='html',  content = raw HTML rendered as a user-
//                     facing assistant bubble. No execution, no result feedback.
export type MarkerCall =
    | { kind: 'eval'; content: string }
    | { kind: 'write'; path: string; content: string }
    | { kind: 'bash'; content: string }
    | { kind: 'html'; content: string };
