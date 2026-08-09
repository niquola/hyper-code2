// The `ui.chrome` extension point: what rides along with an htmx fragment.
//
// A handler is called with `{ path, oob: true }` and returns markup with
// `hx-swap-oob` — a tab strip that must follow a swap, a patient band, a status
// line. The framework knows nothing about any of them; it only appends what the
// answers return, so a host adds one by shipping `$hook_ui.chrome.ts`.
export default {
    calledWith: "{ path: string, oob: true }",
    answerWith: "html with hx-swap-oob, or \"\"",
};
