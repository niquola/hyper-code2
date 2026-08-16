# UI design system

Hyper-code2 owns its UI component and theme layer. Tailwind supplies utilities and the Typography plugin; there is no external component framework.

## Palette

The default visual language is bichrome: neutral surfaces, text, borders, and controls. Green and red are reserved for semantic success and failure/danger states. Informational UI stays neutral rather than introducing a decorative blue accent.

Themes are selected with `data-theme="light"` or `data-theme="dark"` on `<html>`. The early script in `ui.layout` restores `localStorage.hyper-theme`, falling back to the OS preference before the page paints.

Theme values live in `src/procs/styles/$style_app.css`:

- `--theme-base-100`, `--theme-base-200`, `--theme-base-300` — raised, chrome, and divider surfaces;
- `--theme-base-content` — primary foreground;
- `--theme-primary`, `--theme-primary-content` — high-emphasis neutral action;
- `--theme-success`, `--theme-danger` — semantic states;
- `--ui-border`, `--ui-border-strong`, `--ui-input-border` — structural, emphasized, and form-control borders;
- `--ui-surface`, `--ui-surface-muted` — reusable surfaces.

Use semantic Tailwind classes such as `bg-base-100`, `bg-base-200`, `text-base-content`, `border-ui-border`, `border-ui-input`, `text-success`, and `text-error`. Do not add fixed `gray-*`, `white`, `blue-*`, or theme-specific colors to shared UI.

## Native component primitives

The project stylesheet defines compact component classes used by server renderers:

- buttons: `btn`, `btn-primary`, `btn-ghost`, `btn-xs`, `btn-sm`, `btn-circle`, `btn-square`;
- form controls: `input`, `textarea`, `select`, their `*-sm` variants, and `toggle`;
- status: `badge`, `badge-sm`, `progress`, `status`;
- containers: `card`, `card-border`, `card-body`, `alert`, `table`, `menu`;
- composition: `dropdown`, `join`, `avatar`, `breadcrumbs`, `steps`, `tooltip`.

Prefer runtime renderers for repeated structures:

- `ui.inspectorSection` — inspector accordion sections;
- `ui.statusBadge` — semantic status labels;
- `ui.progressBar` — compact progress;
- `ui.chatEventCard` — chat lifecycle cards;
- `procs.ui.*` — generic button, field, menu, table, badge, toggle, and related primitives.

## Chat conventions

User and assistant messages remain visually distinct, but all text inherits theme foreground tokens. Lifecycle events use `ui.chatEventCard`. Tool calls remain compact circular icon controls and open the shared popup; tool details must label Input and Output explicitly.

Every visible button must have visible text, `title`, or `aria-label`. Inputs must use `--ui-input-border`, which is intentionally stronger than structural separators. Shared controls must be checked in both themes.

## Verification

After changing tokens or component CSS:

1. hot-reload affected renderers;
2. call `procs.styles.rebuild({})`;
3. inspect representative pages in light and dark;
4. verify computed foreground, background, border, overflow, labels, and popup states;
5. close browser tabs created for the check;
6. run focused UI tests and `git diff --check`.
