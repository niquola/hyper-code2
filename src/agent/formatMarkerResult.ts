// Render a tool-call result as a synthetic user message.
export default function (
    _ctx: Context,
    opts: { call: types.agent.MarkerCall; output: string; isError: boolean },
): string {
    const { call, output, isError } = opts;
    let head = `§result:eval`;
    if (call.kind === 'write') head = `§result:write:${call.path}`;
    else if (call.kind === 'bash') head = `§result:bash`;
    else if (call.kind === 'read') head = `§result:read${call.format && call.format !== 'plain' ? ':' + call.format : ''}:${call.path}`;
    else if (call.kind === 'grep') head = `§result:grep${call.format && call.format !== 'plain' ? ':' + call.format : ''}`;
    else if (call.kind === 'edit') head = `§result:edit${call.format ? ':' + call.format : ''}`;
    const status = isError ? ':error' : '';
    return `${head}${status}\n${output}`;
}