/** In-memory declarations, rebuilt from the scanner; no gap state is retained. */
export type State = {declarations: Record<string, {name:string; source:string; fn:(ctx:Context, session:Session|null, opts:types.flow.FlowRequest)=>Promise<types.flow.FlowOutput>}>};
