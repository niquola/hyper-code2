// Render a tool-call result as a synthetic user message that the model sees
// on its next turn. Mirrors role:tool semantics but in plain text — markers
// don't carry call-IDs the way function-calling does.
//
// Output format:
//   ///result:eval[:error]
//   ...output...
//
//   ///result:write:<path>[:error]
//   ok / error message
export default function (
    call: types.agent.MarkerCall,
    output: string,
    isError: boolean,
): string {
    const head = call.kind === 'write'
        ? `///result:write:${call.path}`
        : `///result:eval`;
    const status = isError ? ':error' : '';
    return `${head}${status}\n${output}`;
}
