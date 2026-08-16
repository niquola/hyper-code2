// The data-* markers that make a page drivable. Emit them with this rather than
// by hand, so every module spells them the same way and the agent's helpers can
// find anything on the screen.
//
//   `<section ${ctx.fns.procs.ui.attr({ page: "questionnaire" })}>`
//   `<tr ${ctx.fns.procs.ui.attr({ entity: "Patient", id: "pt-1", status: "active" })}>`
//   `<td ${ctx.fns.procs.ui.attr({ role: "name" })}>`
//   `ctx.fns.procs.ui.button({ action: "delete", id: "pt-1", label: "Delete" })`
//   `<form ${ctx.fns.procs.ui.attr({ form: "search" })}>`
//
// The eight keys, and what each promises:
//   page    the root of a module's page — one per page, names what is on screen
//   section a named region of the page — a panel, a group: what a tour points
//           at when it explains PARTS of a screen. Chrome, not a record thing
//   entity  a thing: a row, a card, a tab. `id` identifies which one
//   id      the entity's identity, or the subject of an action
//   status  the entity's state, when it has one (running, draft, error)
//   role    a part of an entity — the cell the agent reads a value out of
//   form    a form (or the container of one), addressable by fill/submit
//   action  a control that does something. The verb, not the label
//
// Empty values are dropped, so optional fields can be passed straight through.
const KEYS = ["page", "section", "entity", "id", "status", "role", "form", "action"] as const;

/**
 * Renders escaped `data-*` attributes used to identify drivable UI elements.
 * Null, undefined, and empty-string values are omitted.
 * @param opts Marker values to render.
 * @param opts.page Identifier for the page root.
 * @param opts.section Identifier for a named page region.
 * @param opts.entity Entity type represented by the element.
 * @param opts.id Entity or action target identifier.
 * @param opts.status Current entity status.
 * @param opts.role Role of the element within an entity.
 * @param opts.form Identifier for a form or form container.
 * @param opts.action Action verb represented by a control.
 */
export default function (ctx: Context, _session: Session | null, opts: Partial<Record<(typeof KEYS)[number], string | number | null | undefined>> & Record<string, any>): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const out: string[] = [];
    for (const key of Object.keys(opts)) {
        const value = opts[key];
        if (value === null || value === undefined || value === "") continue;
        out.push(`data-${key}="${esc(String(value))}"`);
    }
    return out.join(" ");
}
