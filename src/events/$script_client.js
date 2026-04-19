// SSE client: navigates / refreshes sidebar when server pushes file events.
// Injected on every page via ui/layout.ts.
(function () {
    if (window.__eventsClientOpened) return;
    window.__eventsClientOpened = true;

    const es = new EventSource("/events");
    es.onmessage = (e) => {
        let ev;
        try { ev = JSON.parse(e.data); } catch { return; }
        if (!ev || !ev.type) return;

        if (ev.type === "files.open" && ev.path) {
            const cur = new URLSearchParams(location.search).get("path");
            const onFiles = location.pathname === "/files";
            if (onFiles && cur !== ev.path) {
                location.href = "/files?path=" + encodeURIComponent(ev.path);
            } else if (!onFiles) {
                // Stay on agent page, just refresh the sidebar silently.
                refreshSidebar();
            }
        } else if (ev.type === "files.close") {
            refreshSidebar();
        }
    };
    es.onerror = () => { /* auto-reconnects */ };

    async function refreshSidebar() {
        try {
            const url = location.pathname + location.search;
            const html = await (await fetch(url)).text();
            const dom = new DOMParser().parseFromString(html, "text/html");
            const next = dom.querySelector("aside");
            const cur = document.querySelector("aside");
            if (next && cur) cur.replaceWith(next);
        } catch { /* ignore */ }
    }
})();
