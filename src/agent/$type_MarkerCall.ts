// One marker-protocol invocation. Three kinds, hardcoded:
//   ///eval         → kind='eval',  content = JS to run (returns result)
//   ///write:<path> → kind='write', path = file path, content = file body
//   ///html         → kind='html',  content = raw HTML rendered as a user-
//                     facing assistant bubble. No execution, no result feedback.
export type MarkerCall =
    | { kind: 'eval'; content: string }
    | { kind: 'write'; path: string; content: string }
    | { kind: 'html'; content: string };
