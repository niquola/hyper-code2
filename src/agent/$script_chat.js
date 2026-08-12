// One disposable controller per #chat-panel. HTMX owns markup; this controller
// owns only local interaction (scroll anchoring, composer keys and lazy tools).
(() => {
    if (window.__hyperChatControllerInstalled) return;
    window.__hyperChatControllerInstalled = true;

    const STICKY_BOTTOM_PX = 48;
    let current = null;

    class ChatController {
        constructor(panel) {
            this.panel = panel;
            this.messages = panel.querySelector('#messages');
            this.form = panel.querySelector('#form');
            this.input = panel.querySelector('#input');
            this.agentId = this.messages?.dataset.agentId || panel.dataset.agentId || '';
            this.inheritedCount = Number(this.messages?.dataset.inheritedCount || 0);
            this.abort = new AbortController();
            this.detailAbort = null;
            this.toolCache = new Map();
            this.shouldStick = true;
            this.historyAnchor = null;
            this.historyAnchorTop = null;
            this.loadingOlder = false;
        }

        mount() {
            if (!this.messages || !this.form || !this.input) return false;
            const { signal } = this.abort;
            this.messages.addEventListener('scroll', () => {
                this.shouldStick = this.isNearBottom();
                if (this.messages.scrollTop < 80) this.loadOlder();
            }, { passive: true, signal });
            this.input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    this.form.requestSubmit();
                }
            }, { signal });
            this.panel.addEventListener('click', event => this.onClick(event), { signal });
            this.arrangeTools(this.messages);
            this.addInheritedNote();
            document.body.dataset.agentId = this.agentId;
            requestAnimationFrame(() => {
                if (!this.alive()) return;
                this.scrollBottom();
                this.shouldStick = this.isNearBottom();
                this.input.focus();
            });
            return true;
        }

        alive() { return current === this && this.panel.isConnected && !this.abort.signal.aborted; }
        isNearBottom() { return this.messages.scrollHeight - this.messages.scrollTop - this.messages.clientHeight <= STICKY_BOTTOM_PX; }
        scrollBottom() { this.messages.scrollTop = this.messages.scrollHeight; }

        addInheritedNote() {
            if (this.inheritedCount <= 0 || this.messages.querySelector('[data-inherited]')) return;
            const note = document.createElement('div');
            note.className = 'bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3';
            note.dataset.inherited = '1';
            note.textContent = `inherited context: ${this.inheritedCount} msgs`;
            this.messages.prepend(note);
        }

        loadOlder() {
            const head = this.messages.querySelector('#msg-head');
            if (!head || this.loadingOlder) return;
            this.loadingOlder = true;
            this.historyAnchor = head.nextElementSibling;
            this.historyAnchorTop = this.historyAnchor?.getBoundingClientRect().top ?? null;
            htmx.trigger(head, 'load-older');
        }

        beforeSwap(target) {
            if (target === this.messages || target?.id === 'msg-tail') this.shouldStick = this.isNearBottom();
            if (target?.id === 'msg-head' && this.messages.contains(target)) {
                this.historyAnchor = target.nextElementSibling;
                this.historyAnchorTop = this.historyAnchor?.getBoundingClientRect().top ?? null;
                this.loadingOlder = true;
            }
        }

        afterSwap(target) {
            if (!this.alive()) return;
            if ((target === this.messages || target?.id === 'msg-tail') && this.shouldStick) this.scrollBottom();
            if (target?.id === 'msg-head') {
                if (this.historyAnchor?.isConnected && this.historyAnchorTop != null) {
                    const drift = this.historyAnchor.getBoundingClientRect().top - this.historyAnchorTop;
                    if (Math.abs(drift) > 0.5) this.messages.scrollTop += drift;
                }
                this.historyAnchor = null;
                this.historyAnchorTop = null;
                this.loadingOlder = false;
            }
            if (target === this.messages || this.messages.contains(target) || target?.id === 'msg-tail' || target?.id === 'msg-head') {
                this.arrangeTools(this.messages);
            }
        }

        arrangeTools(root) {
            root?.querySelectorAll('.tool[data-tool]').forEach(card => this.moveToTray(card));
        }

        moveToTray(card) {
            if (card.parentElement?.classList.contains('tool-tray')) return;
            const prev = card.previousElementSibling;
            const tray = prev?.classList.contains('tool-tray') ? prev : document.createElement('div');
            if (!tray.isConnected) {
                tray.className = 'tool-tray';
                card.parentNode.insertBefore(tray, card);
            }
            tray.appendChild(card);
            const next = tray.nextElementSibling;
            if (next?.classList.contains('tool-tray')) {
                while (next.firstChild) tray.appendChild(next.firstChild);
                next.remove();
            }
        }

        onClick(event) {
            const card = event.target.closest?.('.tool[data-tool]');
            if (!card || !this.panel.contains(card)) return;
            event.preventDefault();
            void this.openTool(card);
        }

        async openTool(card) {
            const title = card.dataset.title || card.title || card.dataset.tool || 'tool';
            const url = card.dataset.body;
            const isError = card.dataset.error === '1';
            const cached = url ? this.toolCache.get(url) : '';
            if (cached) return openToolDialog({ title, bodyHtml: cached, isError, returnFocus: card });
            openToolDialog({ title, bodyHtml: '<div class="text-sm text-gray-400">loading…</div>', isError, returnFocus: card });
            if (!url) return;
            this.detailAbort?.abort();
            const request = new AbortController();
            this.detailAbort = request;
            try {
                const response = await fetch(url, { signal: request.signal });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const html = await response.text();
                if (!this.alive() || request.signal.aborted) return;
                this.toolCache.set(url, html);
                openToolDialog({ title, bodyHtml: html || '<div class="text-sm text-gray-400">No output</div>', isError, returnFocus: card });
            } catch (error) {
                if (request.signal.aborted || !this.alive()) return;
                openToolDialog({ title, bodyHtml: `<div class="text-sm text-red-600">Could not load tool details</div>`, isError: true, returnFocus: card });
            }
        }

        destroy() {
            this.detailAbort?.abort();
            this.abort.abort();
            document.getElementById('tool-dialog')?.remove();
        }
    }

    function mount() {
        const panel = document.getElementById('chat-panel');
        if (!panel) return;
        if (current?.panel === panel) return;
        current?.destroy();
        const next = new ChatController(panel);
        current = next;
        if (!next.mount()) { next.destroy(); current = null; }
    }

    document.body.addEventListener('htmx:beforeCleanupElement', event => {
        const target = event.detail?.elt || event.target;
        if (current && (target === current.panel || target?.contains?.(current.panel))) {
            current.destroy();
            current = null;
        }
    });
    document.body.addEventListener('htmx:beforeSwap', event => current?.beforeSwap(event.detail?.target));
    document.body.addEventListener('htmx:afterSwap', event => {
        current?.afterSwap(event.detail?.target);
        mount();
    });
    mount();

    function openToolDialog({ title, bodyHtml, isError, returnFocus }) {
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
        const dismiss = () => {
            document.removeEventListener('keydown', onKey);
            root.remove();
            if (returnFocus?.isConnected) returnFocus.focus();
        };
        const onKey = event => { if (event.key === 'Escape') dismiss(); };
        close.addEventListener('click', dismiss);
        root.addEventListener('mousedown', event => { if (event.target === root) dismiss(); });
        document.addEventListener('keydown', onKey);
        header.append(heading, close);
        panel.append(header, body);
        root.appendChild(panel);
        document.body.appendChild(root);
        close.focus();
    }
})();
