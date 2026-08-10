// How everything on the screen is addressed: by the data-* markers ui/attr.ts
// emits, never by a CSS selector. Resolution takes the most specific match —
// {form,field} > {form,action} > {form} > {action} narrowed by {entity,id} >
// {entity,id} > {role}.
export type Descriptor = {
    entity?: string;
    id?: string;
    action?: string;
    form?: string;
    field?: string;
    role?: string;
    // A named region of the page (`ui.attr({ section: "problems" })`) — what a
    // tour points at when it explains parts of a screen rather than things in it.
    section?: string;
};
