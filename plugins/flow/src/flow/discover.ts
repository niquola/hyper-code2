/**
 * Computes and validates current gaps for one declaration
 *
 * Use before displaying or applying a gap. Calls the trusted declaration in preview mode; purity is the declaration author responsibility, not a sandbox.
 * @param opts.flow Registered gap declaration name.
 * @param opts.now ISO clock shared across reconciliation phases.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Registered gap declaration name. */
        flow: string;
        /** ISO clock shared across reconciliation phases. */
        now: string;
    },
): Promise<types.flow.Gap[]> {
    const declaration = ctx.state.flow?.declarations?.[opts.flow];
    if (!declaration) throw new Error('Unknown flow: '+opts.flow);
    const output = await declaration.fn(ctx, session, {mode:'preview',now:opts.now});
    if (!output || !Array.isArray(output.gaps)) throw new Error('Preview must return {gaps: []}');
    const ids = new Set<string>();
    for (const gap of output.gaps) {
     if (!gap || typeof gap.id !== 'string' || !gap.id.trim() || gap.id.length>1024 || typeof gap.revision !== 'string' || !gap.revision.trim() || gap.revision.length>1024 || typeof gap.summary !== 'string' || !gap.summary.trim()) throw new Error('Gap requires bounded id/revision and summary');
     if (ids.has(gap.id)) throw new Error('Duplicate gap id: '+gap.id);
     if (gap.will !== undefined && (typeof gap.will !== 'string' || !gap.will.trim())) throw new Error('Action label must be nonempty');
     ids.add(gap.id);
    }
    return output.gaps;
}
