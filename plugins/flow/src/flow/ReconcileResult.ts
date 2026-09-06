/** Computed result; apply results are stored as receipts, not as gaps. */
export type ReconcileResult = {
 id: string; flow: string; now: string; mode: 'preview'|'explain'|'apply';
 target?: {id:string; revision:string}; gaps: types.flow.Gap[];
 status: 'preview'|'explained'|'closed'|'remains'|'stale'|'failed';
 actionCalled: boolean; verified: boolean; converged: boolean;
 before: number; after: number;
 effects: Array<{reference:string;label?:string}>;
 explanation?: string; error?: string;
 trace: Array<{phase:string; error?:string}>;
};
