// Markdown as html, if anybody in this process can. The framework does not ship
// a markdown renderer and should not: it would be a second set of rules beside
// whichever one the host already uses for its READMEs and its chat. So a page
// that has markdown to show asks, and a host that has a renderer answers.
//
// Unanswered is not a failure — the caller falls back to text, which is
// worse-looking and not wrong.
export default {
    calledWith: "{ text: string } — the markdown source",
    answerWith: "string — html, styled the way this host styles prose",
};
