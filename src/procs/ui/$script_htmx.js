// htmx, served by the framework rather than fetched from a CDN. The partial
// contract in `toResponse` and every `hx-` attribute the ui kit emits assume it,
// so it is a dependency of the framework and belongs in the artifact: pinned to
// the version we tested against, available offline, and with no third-party
// origin in the load path of a clinical page.
import htmx from "htmx.org";
import "htmx.org/dist/ext/hx-sse.js";

// The ESM build does not install a global. Most of our UI is declarative hx-*
// and only needs htmx's event handlers, but page/client and user snippets may
// reasonably use the public imperative API. Publish it explicitly.
window.htmx = htmx;

// The boot hook. htmx 4 fires `htmx:after:init` only on elements that carry a
// request attribute (hx-get/hx-post/…) — an element that just wants to run
// something when it lands (wire a menu, draw a chart, mount a panel) never
// hears it. But `htmx:after:process` fires on the root of everything htmx
// processes — the body at boot, every swapped node, every oob island — so this
// hands each landed `hx-on:hyper-load` element exactly one `hyper-load` event.
// The listener itself was attached by htmx in the same processing pass, before
// this event fires.
const MARK = "[hx-on\\:hyper-load]";
const boot = (el) => el.dispatchEvent(new CustomEvent("hyper-load"));

function bootAll(root) {
  if (!root || root.nodeType !== 1) return;
  if (root.matches?.(MARK)) boot(root);
  for (const el of root.querySelectorAll?.(MARK) ?? []) boot(el);
}

document.addEventListener("htmx:after:process", (e) => bootAll(e.target));

// …and the pass htmx already did before this module finished evaluating. htmx
// processes the document as soon as it is imported, so on a page where the DOM
// was parsed first that `htmx:after:process` fired with nobody listening — and
// the composer, the menus and the charts were never wired. The symptom was
// maddeningly partial: the chat looked fine, but its send button stayed disabled
// no matter what you typed, because `chat.compose` had never run to watch the
// textarea. Whether the race is lost depends on load timing, which is why it
// came and went.
//
// Every consumer guards against being wired twice (a WeakSet in chat/client.js),
// so catching up is safe even when we did hear the first pass.
//
// It has to wait for DOMContentLoaded, not just for a parsed DOM. Every client
// script is `defer`, so they run in document order — this one first, `chat`,
// `charts` and the rest after — and by then `readyState` is already
// "interactive". Booting there would fire `hyper-load` into handlers that say
// `window.chat.compose(this)` before `window.chat` exists; htmx swallows the
// TypeError and the element is silently never wired. DOMContentLoaded fires
// after the last deferred script, which is the first moment every handler this
// event reaches actually has something to call.
if (document.readyState === "complete") bootAll(document.body);
else document.addEventListener("DOMContentLoaded", () => bootAll(document.body));
