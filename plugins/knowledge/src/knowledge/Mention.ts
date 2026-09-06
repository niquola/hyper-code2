/** One entity mention reported by an extractor before it is written into the graph. */
export type Mention = {
    /** Stable id within one extraction source (e.g. `m1`), kept across re-runs. */
    id: string;
    /** Canonical entity type; must be an `Entity/*` record flagged `extract: true` (see knowledge.extractionSchema). */
    type: string;
    /** Display name as mentioned. For anonymous types (Event, EventParticipation) a short synthesized label that need not appear in the evidence. */
    name: string;
    /** Other surface forms seen for the same entity. */
    /** Existing canonical ID from this chat's context; writer verifies type and canonical name/alias. */
    entityId?: string;
    /** Add fills an empty scalar or unions multi-values. Correct replaces only chat-owned fields with a verified user quote explicitly correcting the fact in ordinary language, naming the subject and new values. Ref values are canonical IDs; quote uses target titles. */
    attributeUpdates?: Array<{ attribute: string; value: string | string[]; evidence: string; operation: "add" | "correct" }>;
    aliases?: string[];
    /** Explicitly stated facts keyed by Knowledge attribute name (e.g. work_email, headline, url). */
    attributes?: Record<string, string | string[]>;
    /** Verbatim quote per attribute, containing the subject name and every stated value. */
    attributeEvidence?: Record<string, string>;
    /** Optional explicit persisted source owner; validated with sourceMessageIdx and quote. Defaults to parent with an index. */
    sourceAgentId?: string;
    /** Explicit relations to other mentions or existing entities, by mention id or `Type/slug`. */
    relations?: Array<{ predicate: string; target: string; evidence?: string }>;
    /** Verbatim quote supporting the mention. */
    evidence: string;
    /** Extractor confidence 0..1. */
    confidence: number;
    /** Durable index of the message the mention came from. */
    sourceMessageIdx?: number;
};
