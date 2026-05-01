// One marker-protocol tool invocation. Two kinds, hardcoded:
//   ///eval         → kind='eval',  content = JS to run
//   ///write:<path> → kind='write', path = file path, content = file body
export type MarkerCall =
    | { kind: 'eval'; content: string }
    | { kind: 'write'; path: string; content: string };
