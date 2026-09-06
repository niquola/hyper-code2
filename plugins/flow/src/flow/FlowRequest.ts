/** Input to a trusted $gap declaration; all phases share the same clock. */
export type FlowRequest = {now: string; mode: 'preview'} | {now: string; mode: 'explain' | 'apply'; target: {id: string; revision: string}};
