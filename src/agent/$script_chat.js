// Minimal chat client. Everything else is htmx:
//   - new events arrive on the shared stream (see procs/events/client.js)
//   - form submit posts via hx-post; ack is 204
//   - delete buttons are htmx-confirmed posts (see renderEventHtml.deleteControls)
//
// Switching agents swaps the frame instead of reloading the page, so this file
// must be RE-ENTRANT: everything below is bound per chat panel and re-bound
// when a new one arrives. Binding once at load meant the second agent got a
// client still holding the first agent's elements.
let agentId = '';
let inheritedCount = 0;
let messagesEl = null;
let form = null;
let input = null;

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

let historyHeight = null;
let loadingOlder = false;

function loadOlder() {
    const head = document.getElementById('msg-head');
    if (!head || loadingOlder) return;
    loadingOlder = true;
    historyHeight = messagesEl.scrollHeight;
    htmx.trigger(head, 'load-older');
}

function onMessagesScroll() {
    updateStickiness();
    if (messagesEl.scrollTop < 80) loadOlder();
}

// Body-level listeners are bound ONCE — they look elements up through the
// module variables, which initChat re-points at the current panel.
document.body.addEventListener('htmx:beforeSwap', (e) => {
    if (!messagesEl) return;
    const target = e.detail?.target;
    if (target === messagesEl || target?.id === 'msg-tail') {
        updateStickiness();
    }
    // Loading OLDER history grows the list upwards: remember the height now so
    // the scroll position can be corrected once the rows land.
    if (target?.id === 'msg-head') {
        historyHeight = messagesEl.scrollHeight;
        loadingOlder = true;
    }
});

document.body.addEventListener('htmx:afterSwap', (e) => {
    if (!messagesEl) return;
    const target = e.detail?.target;
    if ((target === messagesEl || target?.id === 'msg-tail') && shouldStickToBottom) {
        scrollBottom();
    }
    // Keep the reader where they were: add exactly the height the new rows took.
    if (target?.id === 'msg-head') {
        if (historyHeight != null) messagesEl.scrollTop += messagesEl.scrollHeight - historyHeight;
        historyHeight = null;
        loadingOlder = false;
    }
});

// Bind to the chat panel that is on screen right now. Called at load and
// again after a frame swap, because switching agents no longer reloads the
// page — the panel is replaced under a client that is already running.
function initChat() {
    const panel = document.getElementById('chat-panel');
    messagesEl = document.getElementById('messages');
    form = document.getElementById('form');
    input = document.getElementById('input');
    if (!panel || !messagesEl || !form || !input) return;

    // The swapped markup carries a fresh window.__init; the panel's own
    // attribute is the fallback, so the client can never be one agent behind.
    agentId = (window.__init && window.__init.agentId) || panel.dataset.agentId || '';
    inheritedCount = (window.__init && window.__init.inheritedCount) || 0;

    if (messagesEl.dataset.bound !== '1') {
        messagesEl.dataset.bound = '1';
        messagesEl.addEventListener('scroll', onMessagesScroll, { passive: true });
    }

    shouldStickToBottom = true;
    historyHeight = null;
    loadingOlder = false;

    requestAnimationFrame(() => {
        scrollBottom();
        updateStickiness();
    });

    if (inheritedCount > 0 && !messagesEl.querySelector('[data-inherited]')) {
        const note = document.createElement('div');
        note.className = 'bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3';
        note.dataset.inherited = '1';
        note.textContent = 'inherited context: ' + inheritedCount + ' msgs';
        messagesEl.prepend(note);
    }

    if (input.dataset.bound !== '1') {
        input.dataset.bound = '1';
        // Enter (without Shift) submits the form.
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                document.getElementById('form')?.requestSubmit();
            }
        });
    }
    input.focus();
}

// Re-executing this file (it used to ship inside the swapped panel) must not
// bind a second copy of every listener: the later runs only re-point at the
// panel on screen.
if (window.__hyperChatInstalled) { initChat(); }
else {
    window.__hyperChatInstalled = true;
    initChat();
}
// A frame swap brings a whole new chat panel — re-point at it.
document.body.addEventListener('htmx:afterSwap', (e) => {
    const t = e.detail?.target;
    if (t && (t.id === 'chat-panel' || t.id === 'agent-view' || t.id === 'frame' || t.querySelector?.('#chat-panel'))) initChat();
});

// ── Compact lazy tool links ────────────────────────────────────────────────
const toolBodyCache = new Map();

function toolTray(card) {
    const prev = card.previousElementSibling;
    if (prev && prev.classList.contains('tool-tray')) return prev;
    const tray = document.createElement('div');
    tray.className = 'tool-tray';
    card.parentNode.insertBefore(tray, card);
    return tray;
}

function moveToTray(card) {
    if (card.parentElement?.classList.contains('tool-tray')) return;
    const tray = toolTray(card);
    tray.appendChild(card);
    const next = tray.nextElementSibling;
    if (next?.classList.contains('tool-tray')) {
        while (next.firstChild) tray.appendChild(next.firstChild);
        next.remove();
    }
}

function bindTool(card) {
    if (card.dataset.bound === '1') return;
    card.dataset.bound = '1';
    card.addEventListener('click', async () => {
        const title = card.dataset.title || card.title || card.dataset.tool || 'tool';
        const url = card.dataset.body;
        const isError = card.dataset.error === '1';
        let bodyHtml = url ? toolBodyCache.get(url) : '';
        if (!bodyHtml && url) {
            openToolDialog({ title, bodyHtml: '<div class="text-sm text-gray-400">loading…</div>', isError });
            try {
                const response = await fetch(url);
                bodyHtml = response.ok ? await response.text() : '';
            } catch { bodyHtml = ''; }
            if (bodyHtml) toolBodyCache.set(url, bodyHtml);
        }
        openToolDialog({
            title,
            bodyHtml: bodyHtml || '<div class="text-sm text-gray-400">No output</div>',
            isError,
        });
    });
    moveToTray(card);
}

function bindTools(root) {
    (root || document).querySelectorAll('.tool[data-tool]').forEach(bindTool);
}

bindTools();
document.body.addEventListener('htmx:afterSwap', () => bindTools(document.getElementById('messages') || document));


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
