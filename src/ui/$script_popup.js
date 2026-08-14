// One permanent popup host for the whole application. Page/agent HTMX swaps
// replace content, never the host, so tools, create-agent and secure prompts do
// not lose their target while navigating.
(() => {
    if (window.__hyperPopupInstalled) return;
    window.__hyperPopupInstalled = true;

    window.hyperPopup = {
        open(title = '', kind = '') {
            const dialog = document.getElementById('app-popup');
            const heading = document.getElementById('app-popup-title');
            if (heading) heading.textContent = title;
            if (dialog && kind) dialog.dataset.popupKind = kind;
            if (dialog && !dialog.open) dialog.showModal();
        },
        close() {
            const dialog = document.getElementById('app-popup');
            if (dialog?.open) dialog.close();
            if (dialog) delete dialog.dataset.popupKind;
        },
        loading(title = '', kind = '') {
            this.open(title, kind);
            const body = document.getElementById('app-popup-body');
            if (body) body.innerHTML = '<div class="text-sm text-gray-400">loading…</div>';
        },
    };

    // Server fragments can ask to open the permanent host without shipping
    // scripts or creating/removing overlays.
    document.body.addEventListener('htmx:afterSwap', event => {
        if (event.detail?.target?.id !== 'app-popup-body') return;
        const body = event.detail.target;
        const content = body.querySelector('[data-popup-content], [data-secure-input]');
        if (content) {
            window.hyperPopup.open(content.dataset.popupTitle || 'Details', content.dataset.popupKind || '');
            content.querySelector('[autofocus], input, textarea, select')?.focus();
            return;
        }
        const dialog = document.getElementById('app-popup');
        if (!body.innerHTML.trim() && dialog?.dataset.popupKind) window.hyperPopup.close();
    });
})();
