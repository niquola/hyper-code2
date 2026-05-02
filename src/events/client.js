(() => {
  if (window.__hyperEventsInstalled) return;
  window.__hyperEventsInstalled = true;

  let es;
  let retryMs = 1000;

  function emitDomEvent(data) {
    document.dispatchEvent(new CustomEvent('hyper-events', { detail: data }));
  }

  function handle(data) {
    emitDomEvent(data);
    if (data?.type === 'agents.changed') {
      if (window.__hyperRefreshSidebar) window.__hyperRefreshSidebar(data);
    }
    // Per-agent live update: server-pushed agent.event_appended replaces
    // the long-poll on /events.html. Dispatch hyper-tick on <body> so the
    // <div id="msg-tail"> with hx-trigger="hyper-tick from:body" fires its
    // short fetch — only when the event actually targets the open page.
    if (data?.type === 'agent.event_appended' && data.agentId
        && document.body?.dataset?.agentId === data.agentId) {
      document.body.dispatchEvent(new CustomEvent('hyper-tick'));
    }
  }

  function connect() {
    es = new EventSource('/events');
    es.onmessage = (e) => {
      try { handle(JSON.parse(e.data)); retryMs = 1000; } catch {}
    };
    es.onerror = () => {
      try { es.close(); } catch {}
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 10000);
    };
  }

  connect();
})();
