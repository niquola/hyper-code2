// Render a marker call back to its wire-format text. Used by run.ts when
// persisting one assistant message per marker invocation, so the saved
// transcript reads identically to what the model originally emitted.
//   §eval\n<content>
//   §write:<path>\n<content>
//   §bash\n<content>
//   §html\n<content>
export default function (call: types.agent.MarkerCall): string {
    if (call.kind === 'write') return `§write:${call.path}\n${call.content}`;
    if (call.kind === 'html') return `§html\n${call.content}`;
    if (call.kind === 'bash') return `§bash\n${call.content}`;
    return `§eval\n${call.content}`;
}
