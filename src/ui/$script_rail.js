// Which agent is selected — decided in ONE place, from the URL.
//
// It used to be rendered by the server AND patched by the chat client, because
// switching agents swaps only the conversation and leaves the rail standing.
// Two renderers of one fact drift: the rail refreshed itself with a stale
// `current` and quietly moved the highlight back to the previous agent.
//
// The address bar already says who you are talking to (/a/<id>, /agent/<id>),
// so that is the source of truth. Everything else — a swap, a rail refresh,
// Back/Forward — just re-applies it.
(() => {
    if (window.__hyperRailInstalled) return;
    window.__hyperRailInstalled = true;

    const currentAgent = () => {
        const m = /^\/(?:a|agent)\/([A-Za-z0-9_-]+)/.exec(location.pathname);
        return m && m[1] !== "new" ? m[1] : null;
    };

    function sync() {
        const rail = document.getElementById("agents-rail");
        const id = currentAgent();
        if (!rail || !id) return;

        // Toasts are filtered by the agent the body says we are on. Switching
        // agents no longer reloads the page, so that attribute has to follow
        // the URL or notifications keep arriving for the agent you left.
        document.body.dataset.agentId = id;

        // The rail refetches itself by URL, so that URL carries everything its
        // request needs: who is current, and whether archived agents are shown.
        //
        // The archived flag used to be an hx-vals expression on the rail — and
        // htmx merges a parent's hx-vals into every child's request, so it rode
        // along on each agent link and landed in the address bar as
        // `?archived=`. hx-inherit does not stop that; not declaring it there
        // does.
        const archived = localStorage.getItem("rail-archived") ? "&archived=1" : "";
        rail.setAttribute("hx-get", "/ui/rail?current=" + encodeURIComponent(id) + archived);

        for (const link of rail.querySelectorAll('a[href^="/agent/"]')) {
            // Archived rows sit inside a wrapper and have no selected state.
            if (link.classList.contains("flex-1")) continue;
            const on = link.getAttribute("href") === "/agent/" + encodeURIComponent(id);

            link.classList.toggle("bg-white", on);
            link.classList.toggle("shadow-sm", on);
            link.classList.toggle("hover:bg-gray-200/70", !on);
            link.setAttribute("data-status", on ? "current" : link.dataset.runState || "idle");

            const title = link.querySelector("span.truncate");
            title?.classList.toggle("text-gray-900", on);
            title?.classList.toggle("font-semibold", on);
            title?.classList.toggle("text-gray-700", !on);

            // Unread belongs to the agents you are NOT reading.
            link.querySelector('[data-role="unread"]')?.classList.toggle("hidden", on);
        }
    }

    window.__hyperRailSync = sync;
    sync();
    document.body.addEventListener("htmx:afterSwap", sync);
    document.body.addEventListener("htmx:afterSettle", sync);
    window.addEventListener("popstate", sync);
})();
