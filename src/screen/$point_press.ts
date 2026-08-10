// `screen.press` — a live step was answered by the person on the screen, and
// the step asked for the answer to be delivered (`to: "agent"`). Answered by
// whoever guides conversations in this host — the workspace hands it to the
// chat agent's queue. Nobody answering is fine: the press stays readable at
// `screen.pressed` for a guide outside the process.
export default {
    calledWith: "{ pressed: 'next' | 'did-it' | 'shown' | 'skipped' | 'stop' | 'failed', say: string, stuck?: string, url: string, at: string }",
    answerWith: "void",
};
