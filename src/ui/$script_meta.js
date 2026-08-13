// Only interactions with unsaved task rows need JavaScript. Adding and saving
// rows are ordinary HTMX + form operations; delegation survives live swaps.
(() => {
    if (window.__hyperMetaInstalled) return;
    window.__hyperMetaInstalled = true;

    document.addEventListener('click', event => {
        const button = event.target.closest?.('[data-plan-remove], [data-plan-move]');
        if (!button) return;
        const form = button.closest('[data-plan-editor]');
        const tasks = form?.querySelector('[data-plan-tasks]');
        const row = button.closest('[data-plan-task]');
        if (!tasks || !row || row.dataset.taskStatus !== 'pending') return;
        event.preventDefault();
        if (button.matches('[data-plan-remove]')) return row.remove();
        const rows = [...tasks.querySelectorAll('[data-plan-task][data-task-status="pending"]')];
        const index = rows.indexOf(row);
        if (button.matches('[data-plan-move="up"]') && index > 0) tasks.insertBefore(row, rows[index - 1]);
        if (button.matches('[data-plan-move="down"]') && index >= 0 && index < rows.length - 1) tasks.insertBefore(rows[index + 1], row);
    });
})();
