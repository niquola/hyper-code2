export type Filters = {
    /** Restrict results to study designs such as `rct`, `meta-analysis`, or `cohort study`. */
    study_types?: string[];
    /** Earliest publication year, inclusive. */
    year_min?: number;
    /** Latest publication year, inclusive. */
    year_max?: number;
    /** Minimum reported participant/sample count. */
    sample_size_min?: number;
    /** Best allowed SJR journal quartile, where 1 is highest. */
    sjr_min?: number;
    /** Worst allowed SJR journal quartile. */
    sjr_max?: number;
    /** Exclude preprints when true. */
    exclude_preprints?: boolean;
    /** Require an open-access result when true. */
    open_access?: boolean;
    /** Restrict to human research when true. */
    human?: boolean;
    /** Restrict to controlled studies when true. */
    controlled?: boolean;
    /** Consensus research domain filter. */
    domain?: string;
    /** Restrict to clinical guidelines when true. */
    clinical_guideline?: boolean;
    /** Enable Consensus medical-mode filtering. */
    medical_mode?: boolean;
    /** Allow forward-compatible Consensus filter fields. */
    [key: string]: string | number | boolean | string[] | undefined;
};
