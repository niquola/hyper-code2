// Global keyboard shortcuts. Ctrl+J opens the next unread chat; Ctrl+K
// returns through this tab's chat jump history. ⌘J/⌘K retain chat scrolling.
// The global menu owns both pairs while it is open.
(() => {
    if (window.__hyperAgentHotkeysInstalled) return;
    window.__hyperAgentHotkeysInstalled = true;

    const HISTORY_KEY = 'hyper:chat-jump-history';
    let navigating = false;
    const currentAgentId = () => document.querySelector('#chat-panel')?.dataset.agentId || location.pathname.match(/^\/agent\/([^/]+)/)?.[1] || null;
    const history = () => {
        try { const value = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(value) ? value.filter(x => typeof x === 'string').slice(-20) : []; }
        catch { return []; }
    };
    const saveHistory = value => sessionStorage.setItem(HISTORY_KEY, JSON.stringify(value.slice(-20)));
    const visit = id => { if (id) location.href = `/agent/${encodeURIComponent(id)}`; };

    async function nextUnread() {
        if (navigating) return;
        navigating = true;
        try {
            const current = currentAgentId();
            const response = await fetch(`/nav/next/unread?current=${encodeURIComponent(current || '')}`, { cache: 'no-store' });
            if (!response.ok) return;
            const { id } = await response.json();
            if (!id || id === current) return;
            const stack = history();
            if (current && stack.at(-1) !== current) stack.push(current);
            saveHistory(stack);
            visit(id);
        } finally { navigating = false; }
    }

    function jumpBack() {
        const current = currentAgentId();
        const stack = history();
        let id;
        while (stack.length && (!id || id === current)) id = stack.pop();
        saveHistory(stack);
        visit(id);
    }

    window.addEventListener('keydown', (event) => {
        if (event.key === '/' && !event.altKey && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            window.__navOpen?.();
            return;
        }

        if (event.isComposing || event.altKey || event.shiftKey) return;
        if (window.__navIsOpen?.()) return;

        const key = event.key.toLowerCase();
        if (key !== 'j' && key !== 'k') return;

        if (event.metaKey && !event.ctrlKey) {
            const messages = document.querySelector('#chat-panel #messages');
            if (!messages) return;
            event.preventDefault();
            messages.scrollBy({
                top: (key === 'j' ? 1 : -1) * Math.max(160, messages.clientHeight * 0.7),
                behavior: 'auto',
            });
            return;
        }

        if (!event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        if (key === 'j') void nextUnread();
        else jumpBack();
    });
})();
