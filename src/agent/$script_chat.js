// Minimal chat client. Everything else is htmx:
//   - new events arrive via #msg-tail long-poll on /agent/:id/events.html
//   - form submit posts via hx-post; ack is 204
//   - delete buttons are htmx-confirmed posts (see renderEventHtml.deleteControls)
//   - status bar polls /agent/:id/statusbar
//   - sidebar polls itself every 10s via x-hyper-fragment header
const { agentId, inheritedCount = 0 } = window.__init;

const messagesEl = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');

// Initial scroll-to-bottom + after every htmx swap into #messages.
function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
}
document.body.addEventListener('htmx:afterSwap', scrollBottom);
requestAnimationFrame(scrollBottom);

if (inheritedCount > 0) {
    const note = document.createElement('div');
    note.className = 'bg-gray-50 text-gray-500 italic rounded-lg px-4 py-3';
    note.textContent = 'inherited context: ' + inheritedCount + ' msgs';
    messagesEl.prepend(note);
}

// Enter (without Shift) submits the form.
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
    }
});
input.focus();
