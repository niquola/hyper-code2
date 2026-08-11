// One entry of the `edit` tool's `edits` array — the structured form of what
// the hashline text DSL spells out in a line. Mirrors $tool_edit.md's schema;
// agent.markerArgs produces these from a §edit body, a JSON tool call sends
// them directly.
export type EditOp = {
    /** Defaults to "replace" when oldText is given. */
    op?: "replace" | "replaceLines" | "insertBefore" | "insertAfter" | "delete";
    /** op=replace — exact text to find; must match once unless `all`. */
    oldText?: string;
    /** op=replace — what to put in its place; "" deletes. */
    newText?: string;
    /** op=replace — replace every occurrence. */
    all?: boolean;
    /** Anchored ops — the anchor a hashline read returned (BOF/EOF for inserts). */
    anchor?: string;
    /** Anchored ops — last anchor of the range. */
    endAnchor?: string;
    /** Anchored ops — replacement or inserted lines. */
    text?: string;
};
