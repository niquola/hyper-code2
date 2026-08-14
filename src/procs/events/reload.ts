// Broadcast a reload event — every connected browser tab does location.reload().
/**
 * Reload the events subsystem operation.
 */
export default function (ctx: Context, _session: Session | null, _opts?: {}): void {
    ctx.fns.procs.events.emit({ event: { type: 'reload' } });
}
