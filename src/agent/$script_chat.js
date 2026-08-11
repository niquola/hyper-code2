// Minimal chat client. Everything else is htmx:
//   - new events arrive via #msg-tail long-poll on /agent/:id/events.html
//   - form submit posts via hx-post; ack is 204
//   - delete buttons are htmx-confirmed posts (see renderEventHtml.deleteControls)
//   - status bar polls /agent/:id/statusbar
//   - sidebar polls itself every 10s via x-hyper-fragment header
const { agentId, inheritedCount = 0 } = window.__init;

const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');

const STICKY_BOTTOM_PX = 48;
let shouldStickToBottom = true;

function isNearBottom() {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <= STICKY_BOTTOM_PX;
}

function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateStickiness() {
    shouldStickToBottom = isNearBottom();
}

messagesEl.addEventListener('scroll', updateStickiness, { passive: true });

// Initial scroll-to-bottom + after message-list swaps when user was already near bottom.
document.body.addEventListener('htmx:beforeSwap', (e) => {
    const target = e.detail?.target;
    if (target === messagesEl || target?.id === 'msg-tail') {
        updateStickiness();
    }
});

document.body.addEventListener('htmx:afterSwap', (e) => {
    const target = e.detail?.target;
    if ((target === messagesEl || target?.id === 'msg-tail') && shouldStickToBottom) {
        scrollBottom();
    }
});

requestAnimationFrame(() => {
    scrollBottom();
    updateStickiness();
});

if (inheritedCount > 0) {
    const note = document.createElement('div');
    note.className = 'bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3';
    note.textContent = 'inherited context: ' + inheritedCount + ' msgs';
    messagesEl.prepend(note);
}

// Enter (without Shift) submits the form.
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
    }
});
input.focus();

// ── Tool cards age out ────────────────────────────────────────────────────
// A call is loud exactly while it is news: open while it happens, one line for
// a few seconds more, then tucked into an icon that joins its neighbours in a
// tray. Touch a card and it stops aging — a human took an interest, so the
// timers have no business overruling that.
const OPEN_MS = 5_000;
const TUCK_MS = 20_000;

function toolTray(card) {
    const prev = card.previousElementSibling;
    if (prev && prev.classList.contains('tool-tray')) return prev;
    const tray = document.createElement('div');
    tray.className = 'tool-tray';
    card.parentNode.insertBefore(tray, card);
    return tray;
}

function tuck(card) {
    if (card.dataset.pinned) return;
    card.open = false;
    card.classList.add('tool-tucked');
    moveToTray(card);
}

// A card that arrived already tucked (rendered old by the server) still has to
// join the tray — otherwise a reloaded transcript shows a column of lone icons
// instead of a row.
function moveToTray(card) {
    if (card.parentElement && card.parentElement.classList.contains('tool-tray')) return;
    const tray = toolTray(card);
    tray.appendChild(card);
    // A tray that ends up next to another tray is one tray.
    const next = tray.nextElementSibling;
    if (next && next.classList.contains('tool-tray')) {
        while (next.firstChild) tray.appendChild(next.firstChild);
        next.remove();
    }
}

function ageTool(card) {
    if (card.dataset.aging) return;
    card.dataset.aging = '1';
    const born = Number(card.dataset.ts) || Date.now();
    const since = Date.now() - born;

    card.addEventListener('click', () => { card.dataset.pinned = '1'; }, { once: true });
    // A tucked card opens as a real centered dialog: immediately expanded,
    // scrollable, and explicitly dismissible. Tool detail is something a human
    // asked to inspect, not a transient notification in the corner.
    card.addEventListener('click', (e) => {
        if (!card.classList.contains('tool-tucked')) return;
        e.preventDefault();
        const label = card.querySelector('.tool-label')?.textContent ?? 'tool';
        const subject = card.querySelector('.tool-subject')?.textContent ?? '';
        const args = card.querySelector('.tool-code')?.innerHTML ?? '';
        const result = card.querySelector('.tool-result')?.innerHTML ?? '';
        openToolDialog({
            title: (label + ' ' + subject).trim(),
            bodyHtml: args + result || '<div class="text-sm text-gray-400">No output</div>',
            isError: card.classList.contains('bg-red-50/40'),
        });
    });

    if (card.dataset.pinned) return;
    if (card.classList.contains('tool-tucked')) { moveToTray(card); return; }
    if (since < OPEN_MS) setTimeout(() => { if (!card.dataset.pinned) card.open = false; }, OPEN_MS - since);
    else card.open = false;
    if (since < TUCK_MS) setTimeout(() => tuck(card), TUCK_MS - since);
    else tuck(card);
}

function ageTools(root) {
    (root || document).querySelectorAll('.tool[data-ts]').forEach(ageTool);
}

ageTools();
document.body.addEventListener('htmx:afterSwap', () => ageTools());


function openToolDialog({ title, bodyHtml, isError }) {
    document.getElementById('tool-dialog')?.remove();
    const root = document.createElement('div');
    root.id = 'tool-dialog';
    root.className = 'fixed inset-0 z-[1100] flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-[1px]';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');

    const panel = document.createElement('div');
    panel.className = 'flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl ' + (isError ? 'border-red-200' : 'border-gray-200');
    const header = document.createElement('div');
    header.className = 'flex shrink-0 items-center gap-3 border-b border-gray-200 px-5 py-3.5';
    const heading = document.createElement('h2');
    heading.className = 'min-w-0 flex-1 truncate font-mono text-sm font-semibold ' + (isError ? 'text-red-700' : 'text-gray-800');
    heading.textContent = title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300';
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = '<i class="ph ph-x text-lg" aria-hidden="true"></i>';
    const body = document.createElement('div');
    body.className = 'tool-dialog-body min-h-0 flex-1 overflow-auto bg-gray-50/60 p-5 text-xs text-gray-700';
    body.innerHTML = bodyHtml;

    const dismiss = () => { document.removeEventListener('keydown', onKey); root.remove(); };
    const onKey = (event) => { if (event.key === 'Escape') dismiss(); };
    close.addEventListener('click', dismiss);
    root.addEventListener('mousedown', (event) => { if (event.target === root) dismiss(); });
    document.addEventListener('keydown', onKey);
    header.append(heading, close);
    panel.append(header, body);
    root.appendChild(panel);
    document.body.appendChild(root);
    close.focus();
}
