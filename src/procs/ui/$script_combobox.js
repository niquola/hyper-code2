// Keyboard + open/close behaviour for `ui.combobox`. The list itself is rendered
// on the server (htmx drops `[role=option]` rows into the `[role=listbox]`); this
// only adds the parts htmx can't: showing the list, arrow-key movement, Enter to
// pick, and closing it — on Escape, on focus leaving the widget, and on a pointer
// press anywhere outside it. It works by delegation on the semantic markers the
// kit emits — the combobox root is `[data-field]` holding a `[role=listbox]` — so
// it needs no per-widget wiring and survives every htmx swap. No CSS selectors,
// no fragment JS: everything is found by role/data markers from an event target.
const ROOT = "[data-field]";
const LIST = "[role=listbox]";
const OPTION = "[role=option]";
const HL = "bg-bg-tertiary"; // the same token the option's :hover uses

// The combobox `[data-field]` an event happened inside — but only if it actually
// carries a listbox, so a plain `data-field` container isn't mistaken for one.
function comboOf(node) {
    const root = node && node.closest ? node.closest(ROOT) : null;
    return root && root.querySelector(LIST) ? root : null;
}
const listOf = (root) => root.querySelector(LIST);
const optionsOf = (root) => Array.from(listOf(root).querySelectorAll(OPTION));
const activeOf = (root) => listOf(root).querySelector("[data-active]");

function open(root) { listOf(root).classList.remove("hidden"); root.querySelector("input")?.setAttribute("aria-expanded", "true"); }
function clearActive(root) { const a = activeOf(root); if (a) { a.removeAttribute("data-active"); a.classList.remove(HL); a.removeAttribute("aria-selected"); } }
function close(root) { listOf(root).classList.add("hidden"); root.querySelector("input")?.setAttribute("aria-expanded", "false"); clearActive(root); }

function setActive(root, el) {
    clearActive(root);
    if (!el) return;
    el.setAttribute("data-active", "");
    el.setAttribute("aria-selected", "true");
    el.classList.add(HL);
    el.scrollIntoView({ block: "nearest" });
}
function move(root, dir) {
    const opts = optionsOf(root);
    if (!opts.length) return;
    const cur = activeOf(root);
    const i = cur ? opts.indexOf(cur) : (dir > 0 ? -1 : 0);
    setActive(root, opts[(i + dir + opts.length) % opts.length]);
}

// Focus on the input opens the list (its own `focus` htmx trigger fills it).
document.addEventListener("focusin", (e) => {
    const root = comboOf(e.target);
    if (root && e.target.matches("input")) open(root);
});

// Leaving the widget closes it — after a tick so a click on an option lands first
// (Tab away, focus another field, the browser blurring the input).
document.addEventListener("focusout", (e) => {
    const root = comboOf(e.target);
    if (!root) return;
    setTimeout(() => { if (!root.contains(document.activeElement)) close(root); }, 150);
});

// A pointer press anywhere outside an open combobox closes it — the reliable
// "click outside" path, in case focusout doesn't fire (e.g. pressing a non-
// focusable area). Runs over every open list, so a second combobox closes the first.
document.addEventListener("pointerdown", (e) => {
    for (const root of document.querySelectorAll(ROOT)) {
        const l = root.querySelector(LIST);
        if (l && !l.classList.contains("hidden") && !root.contains(e.target)) close(root);
    }
});

// Keep focus on the input when the pointer picks an option (don't blur-then-click).
document.addEventListener("mousedown", (e) => {
    if (comboOf(e.target) && e.target.closest(OPTION)) e.preventDefault();
});
// Hovering an option makes it the active one, so mouse and keyboard agree.
document.addEventListener("mousemove", (e) => {
    const root = comboOf(e.target);
    const opt = root && e.target.closest(OPTION);
    if (opt && opt !== activeOf(root)) setActive(root, opt);
});

document.addEventListener("keydown", (e) => {
    const root = comboOf(e.target);
    if (!root || !e.target.matches("input")) return;
    if (e.key === "ArrowDown") { e.preventDefault(); open(root); move(root, 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); open(root); move(root, -1); }
    else if (e.key === "Enter") { const a = activeOf(root); if (a) { e.preventDefault(); a.click(); } }
    else if (e.key === "Escape") { close(root); }
});

// Fresh rows arrived from the server: show the list and preselect the first row,
// so the very next ArrowDown/Enter has a target.
document.addEventListener("htmx:after:swap", (e) => {
    const list = e.target.matches?.(LIST) ? e.target : e.target.closest?.(LIST);
    if (!list) return;
    const root = list.closest(ROOT);
    if (!root) return;
    open(root);
    const first = list.querySelector(OPTION);
    if (first) setActive(root, first);
});
