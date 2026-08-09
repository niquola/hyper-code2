(() => {
  if (window.__hyperEventsInstalled) return;
  window.__hyperEventsInstalled = true;

  let es;
  let retryMs = 1000;

  function emitDomEvent(data) {
    document.dispatchEvent(new CustomEvent('hyper-events', { detail: data }));
  }

  // Track the server's start timestamp so a reload broadcast that happens
  // before the page even fully wired up still triggers a refresh, and so
  // we ignore stale `hello` echoes when reconnecting to the same process.
  let serverStart = null;

  function handle(data) {
    emitDomEvent(data);
    // Server restarted under us — reload to pick up the new process.
    if (data?.type === 'hello') sawServer(data.serverStart);
    // `reload` is NOT handled here. emitDomEvent already dispatched it as a
    // `hyper-events` DOM event, and whoever wants to re-render says so with an
    // hx-trigger on that event — the same way #chat and #chat-who do. A page
    // that cannot express it that way (no htmx) still has the DOM event.
    // location.reload() would drop this stream, the chat and every open tab.
  }

  // The same fact, off the request path — and this is the one that fires.
  //
  // A tab that has been sitting in the background is exactly the tab that
  // outlives a restart, and its stream is the first casualty: Chrome throttles
  // the retry timer of a hidden tab to minutes and freezes a discarded one
  // outright, so `hello` never arrives. Meanwhile its htmx requests work
  // perfectly the moment somebody clicks — old javascript against new markup,
  // which is how `window.chat.compose is not a function` gets to a console.
  // Every answer carries the process that gave it, so the first click after a
  // restart is what reloads the page.
  function sawServer(start) {
    if (typeof start !== 'number' || !start) return;
    if (serverStart !== null && serverStart !== start) { location.reload(); return; }
    serverStart = start;
  }

  function connect() {
    es = new EventSource('/procs/events');   // the stream lives under the framework's own name
    es.onmessage = (e) => {
      try { handle(JSON.parse(e.data)); retryMs = 1000; } catch {}
    };
    es.onerror = () => {
      try { es.close(); } catch {}
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 10000);
    };
  }

  // Coming back to the tab is a better moment to retry than any timer a hidden
  // tab is allowed to run.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (es && es.readyState !== 2 /* CLOSED */) return;
    retryMs = 1000;
    connect();
  });

  connect();
})();
