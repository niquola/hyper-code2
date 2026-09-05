/** How a mention maps onto the existing graph. */
export type MentionResolution = {
    status: "matched" | "ambiguous" | "new";
    /** Chosen entity id when matched. */
    id?: string;
    /** Ranked alternatives (matched: the winner first; ambiguous: all contenders). */
    candidates: Array<{ id: string; title: string | null; score: number; via: string }>;
};
