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
            this.shouldStick = true;
            this.historyAnchor = null;
            this.historyAnchorTop = null;
            this.loadingOlder = false;
            this.ownSwaps = new WeakSet();
            this.lastAssistant = this.latestAssistant();
        }

        mount() {
            if (!this.messages || !this.form || !this.input) return false;
            const { signal } = this.abort;
            this.messages.addEventListener('scroll', () => {
                // Once the reader leaves the live edge, background swaps must
                // never reclaim the scroll position. Only an explicit send can
                // opt back into automatic positioning.
                if (!this.isNearBottom()) this.shouldStick = false;
                if (this.messages.scrollTop < 80) this.loadOlder();
            }, { passive: true, signal });
            this.input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (!this.input.value.trim()) return;
                    this.form.requestSubmit();
                }
            }, { signal });
            this.form.addEventListener('submit', event => {
                if (!this.input.value.trim()) return event.preventDefault();
                // Sending is an explicit return to the live edge. Set this
                // before the user event arrives so the next #msg-tail swap also
                // remains pinned to the bottom.
                this.shouldStick = true;
            }, { signal });
            this.form.addEventListener('htmx:afterRequest', event => {
                if (event.detail?.elt !== this.form || !event.detail?.successful) return;
                this.shouldStick = true;
                this.scrollBottom();
                requestAnimationFrame(() => { if (this.alive() && this.shouldStick) this.scrollBottom(); });
            }, { signal });
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

        latestAssistant() {
            const items = this.messages.querySelectorAll('.assistant');
            return items[items.length - 1] || null;
        }

        scrollAssistantTop(element) {
            const messagesTop = this.messages.getBoundingClientRect().top;
            const elementTop = element.getBoundingClientRect().top;
            this.messages.scrollTop += elementTop - messagesTop - 12;
        }
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

        beforeSwap(event) {
            const target = event.detail?.target;
            const source = event.detail?.elt;
            // Ignore late HTMX responses from a chat that has already been
            // replaced by navigation to another agent.
            if (!(target && (target === this.messages || this.panel.contains(target)))
                && !(source && this.panel.contains(source))) return;
            if (target) this.ownSwaps.add(target);
            // Do not infer consent to autoscroll from geometry here: a live
            // fragment can update while the reader happens to be near the end.
            if (target?.id === 'msg-head' && this.messages.contains(target)) {
                this.historyAnchor = target.nextElementSibling;
                this.historyAnchorTop = this.historyAnchor?.getBoundingClientRect().top ?? null;
                this.loadingOlder = true;
            }
        }

        afterSwap(event) {
            if (!this.alive()) return;
            const target = event.detail?.target;
            const source = event.detail?.elt;
            const belongsHere = (target && (this.ownSwaps.has(target) || target === this.messages || this.panel.contains(target)))
                || (source && this.panel.contains(source));
            if (!belongsHere) return;
            const latestAssistant = this.latestAssistant();
            const hasNewAssistant = latestAssistant && latestAssistant !== this.lastAssistant;
            if (hasNewAssistant && this.shouldStick) {
                this.lastAssistant = latestAssistant;
                this.scrollAssistantTop(latestAssistant);
                this.shouldStick = false;
            } else {
                if (hasNewAssistant) this.lastAssistant = latestAssistant;
                if ((target === this.messages || target?.id === 'msg-tail') && this.shouldStick) this.scrollBottom();
            }
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


        destroy() {
            this.abort.abort();
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
    document.body.addEventListener('htmx:beforeSwap', event => current?.beforeSwap(event));
    document.body.addEventListener('htmx:afterSwap', event => {
        current?.afterSwap(event);
        mount();
    });
    mount();

})();
