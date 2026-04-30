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
