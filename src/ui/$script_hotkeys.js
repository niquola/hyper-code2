// ⌘J / ⌘K — move to the next or previous agent.
//
// The browser knows two things: which agent it is on (the URL says so) and
// which direction was asked for. Everything else — what the list is, what order
// it has, what happens at the ends — is the server's answer to
// /agent/:id/next, rendered into the same container a click would fill.
//
// It used to scrape the rail for links, filter the invisible ones and wrap
// around by index: a second copy of an ordering that already existed, in a
// place that could not see it change.
(() => {
    if (window.__hyperAgentHotkeysInstalled) return;
    window.__hyperAgentHotkeysInstalled = true;

    const currentAgent = () => {
        const m = /^\/(?:a|agent)\/([A-Za-z0-9_-]+)/.exec(location.pathname);
        return m && m[1] !== 'new' ? m[1] : null;
    };

    window.addEventListener('keydown', (event) => {
        // ⌘/ opens the global menu without colliding with ⌘K, which remains
        // agent navigation outside the menu.
        if (event.key === '/' && !event.altKey && !event.shiftKey && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            window.__navOpen?.();
            return;
        }


        if (event.isComposing || event.altKey || event.shiftKey) return;
        if (!(event.metaKey || event.ctrlKey)) return;


        // While the global menu is open it owns ⌘J/⌘K for result navigation.
        if (window.__navIsOpen?.()) return;
        const key = event.key.toLowerCase();
        if (key !== 'j' && key !== 'k') return;

        const id = currentAgent();
        if (!id || !window.htmx) return;
        event.preventDefault();

        window.htmx.ajax('GET', `/agent/${encodeURIComponent(id)}/next?dir=${key === 'j' ? 1 : -1}`, {
            target: '#main',
            swap: 'innerHTML',
        });
    });
})();
