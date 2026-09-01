/** Returns Pipedrive pipelines with their ordered stages for resolving filter IDs. */
export default async function (
    ctx: Context,
    _session: Session | null,
    _opts: {},
): Promise<Array<{ id: number; name: string; stages: Array<{ id: number; name: string }> }>> {
    const [pipelines, stages] = await Promise.all([
        ctx.fns.pipedrive.api({ path: "/pipelines" }),
        ctx.fns.pipedrive.api({ path: "/stages" }),
    ]);
    return (pipelines ?? []).map((pipeline: any) => ({
        id: pipeline.id,
        name: pipeline.name,
        stages: (stages ?? []).filter((stage: any) => stage.pipeline_id === pipeline.id).map((stage: any) => ({ id: stage.id, name: stage.name })),
    }));
}
