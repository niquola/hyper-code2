// One ⌘K palette destination (nav.items).
export type Item = {
    label: string;
    href: string;
    hint?: string;
    /** Optional Phosphor icon class, for example `ph-clock`. */
    icon?: string;
    /** Menu section such as System, Projects & files, or Plugins. */
    group?: string;
    /** Stable order among declarative app destinations. */
    order?: number;
};
