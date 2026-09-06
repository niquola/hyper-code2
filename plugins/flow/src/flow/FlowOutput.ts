/** Declaration output. Preview must return gaps; effects describe action results, not need closure. */
export type FlowOutput = {gaps?: types.flow.Gap[]; effects?: Array<{reference: string; label?: string}>; explanation?: string};
