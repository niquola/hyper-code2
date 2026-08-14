// Compact popup RPC:
//   <button hx-popup="agent.toolDetails" hx-popup-params='{"agentId":"ef","idx":7}'>
//   <form hx-popup="secureInput.submit">…named controls…</form>
// htmx owns POST and swap; this extension only supplies the RPC envelope.
(() => {
    const install = () => {
        if (!window.htmx || window.__hyperRpcInstalled) return false;
        window.__hyperRpcInstalled = true;
        htmx.defineExtension('popup-rpc', {
            init() {
                document.addEventListener('click', event => {
                    const elt = event.target.closest?.('[hx-popup]');
                    if (!elt || (elt.tagName === 'FORM' && event.target.closest('button[type="submit"],input[type="submit"]'))) return;
                    event.preventDefault();
                    send(elt);
                });
                document.addEventListener('submit', event => {
                    const form = event.target.closest?.('form[hx-popup]');
                    if (!form) return;
                    event.preventDefault();
                    send(form);
                });
                document.body.addEventListener('secure-input-refresh', () => {
                    const host = document.getElementById('secure-input-host');
                    if (host) send(host);
                });
                const host = document.getElementById('secure-input-host');
                // A pending secure prompt survives a full page reload; check
                // once on boot, but do not open an empty loading dialog.
                if (host && host.dataset.pending === '1') send(host);
            },
        });
        function send(elt) {
            let params = {};
            try { params = JSON.parse(elt.getAttribute('hx-popup-params') || '{}'); } catch { return; }
            if (elt.tagName === 'FORM') for (const [key, value] of new FormData(elt)) {
                if (params[key] === undefined) params[key] = value;
                else if (Array.isArray(params[key])) params[key].push(value);
                else params[key] = [params[key], value];
            }
            const method = elt.getAttribute('hx-popup');
            const title = elt.getAttribute('title') || elt.getAttribute('aria-label') || method;
            const secureSubmit = method === 'secureInput.submit';
            if (!secureSubmit) window.hyperPopup?.loading(title, 'rpc');
            htmx.ajax('POST', '/rpc', { source: elt, target: '#app-popup-body', swap: 'innerHTML', values: { method, params: JSON.stringify(params) } });
        }
    };
    if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
