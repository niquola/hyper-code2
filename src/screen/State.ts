// ctx.state.screen — the browser tabs connected to this process and the
// evaluations they have not answered yet. There is no browser in the server:
// code is injected into whatever page has this process open, and the answer
// comes back over the same stream.
export type State = {
    nextId: number;
    pending: Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer?: any }>;
    // The last thing an open tab said about itself, unasked — see `page.where`.
    here?: { url: string; title: string; page: string | null; at: string };
    ui?: {
        url: string; title: string; page: string | null; agentId: string | null;
        viewport: { width: number; height: number } | null; at: string;
    };
};
