export type Task = {
    id: string;
    description: string;
    status: "todo" | "running" | "done";
    agentId: string | null;
    workspaceMode: "default" | "isolated";
    workspaceDir: string | null;
    createdAt: number;
    updatedAt: number;
};
