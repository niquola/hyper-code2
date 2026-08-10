export default function (
    _ctx: Context,
    session: Session | null,
    _opts?: {},
): { dir: string; agentId?: string } {
    return {
        dir: session?.agent?.workspaceDir ?? process.cwd(),
        agentId: session?.agent?.id,
    };
} 