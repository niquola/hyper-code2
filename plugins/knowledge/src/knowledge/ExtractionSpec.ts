/** Live, data-driven description of what the agent-chat sidecar may extract, derived from `Entity/*`, `Attribute/*` and `Concept/*` records. */
export type ExtractionSpec = {
    /** Entity types flagged `extract: true` (mixins excluded). */
    types: Array<{
        /** Canonical type name, e.g. `Event`. */
        type: string;
        description: string;
        /** Records without a natural surface name; mention `name` is a synthesized label. */
        anonymous: boolean;
        /** Required attributes besides `title`; anonymous types must supply them at creation. */
        required: string[];
        /** Free-text extraction guidance from `Entity.extract_hint`. */
        hint?: string;
    }>;
    /** Attributes whose domain includes at least one extractable type. */
    attributes: Array<{
        name: string;
        /** `string | text | url | date | datetime | boolean | ref | …` */
        datatype: string;
        /** Subject types (without `Entity/` prefix). */
        domain: string[];
        /** Target types for refs (without `Entity/` prefix). */
        range: string[];
        cardinality: "single" | "multi";
        /** Root Concept id when values are restricted to a controlled vocabulary. */
        vocabulary?: string;
        description: string;
    }>;
    /** Vocabulary root → allowed Concept members (descendants via `isA`/`subClassOf`). */
    vocabularies: Record<string, Array<{ id: string; title: string }>>;
};
