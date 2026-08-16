// Global keyboard shortcuts. ⌘J / ⌘K scroll the active chat while keeping
// focus in the composer; the global menu owns those keys while it is open.
(() => {
    if (window.__hyperAgentHotkeysInstalled) return;
    window.__hyperAgentHotkeysInstalled = true;

    window.addEventListener('keydown', (event) => {
        if (event.key === '/' && !event.altKey && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            window.__navOpen?.();
            return;
        }

        if (event.isComposing || event.altKey || event.shiftKey) return;
        if (!(event.metaKey || event.ctrlKey)) return;
        if (window.__navIsOpen?.()) return;

        const key = event.key.toLowerCase();
        if (key !== 'j' && key !== 'k') return;

        const messages = document.querySelector('#chat-panel #messages');
        if (!messages) return;
        event.preventDefault();
        messages.scrollBy({
            top: (key === 'j' ? 1 : -1) * Math.max(160, messages.clientHeight * 0.7),
            behavior: 'smooth',
        });
    });
})();
