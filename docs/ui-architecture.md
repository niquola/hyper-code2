## Popup RPC contract

The application shell owns one permanent native `<dialog id="app-popup">`. It is outside `#main`, survives navigation, and must never be created or removed by page fragments.

A server-backed popup trigger has one behavior attribute and optional JSON params:

```html
<button hx-popup="agent.toolDetails"
        hx-popup-params='{"agentId":"ef","idx":7}'>Open</button>
```

`hx-popup` is a trusted RPC function name resolved under `ctx.fns`; `hx-popup-params` is its opts object. The `popup-rpc` HTMX extension owns `POST /rpc`, the RPC envelope, loading state, target and swap. Do not add `hx-post`, `hx-rpc`, `hx-target`, `hx-swap`, manual `fetch`, or a local dialog to popup triggers.

Popup forms use the same contract. Named controls are merged into params:

```html
<form hx-popup="secureInput.submit">
  <input name="id" type="hidden" value="p1">
  <input name="value">
</form>
```

RPC popup functions return `ui.popupContent({ title, kind, html })`; an empty successful response closes the popup. Standalone resources should keep ordinary routes—`hx-popup` is for procedural popup partials.


# UI architecture

> Status: working document. This captures the current mental model; details are expected to change as we discuss and prototype it.

## Mental model

Hyper-code is an addressable, programmable workspace:

- **URL is a resource (noun).** Anything durable and openable should have a URL: an agent chat, file, task, tool result, settings screen, or plugin-defined view.
- **Function is an action (verb).** Anything executable should be a named runtime function. Buttons, shortcuts, the global menu, HTTP routes, agents, and plugins should converge on the same function.
- **Pane displays a URL.** A pane does not own domain state; it renders an addressable resource.
- **Workspace stores a composition of panes.** Layout is presentation state over resources, not part of the resources themselves.

In short:

```text
noun       = URL
verb       = function
view       = renderer(URL)
window     = pane(URL)
session    = workspace(layout<URL>)
navigation = open URL
action     = call function
live update = invalidate/refetch URL
```

Postgres remains the source of truth. UI events carry invalidation signals, not copies of application state.

## Pages

Every durable UI surface is a page with its own URL. This includes core screens and plugin-defined views. A page can be opened directly, reloaded, shared, restored through browser history, and rendered in any pane.

The URL identifies the page and its meaningful state; the page is rendered on the server as full HTML or an HTML fragment. Temporary presentation details such as focus, hover, and panel size do not need to be encoded in the URL.

One core page type is **agent chat**, addressed as `/agent/:id`. It represents the durable conversation and current state of one agent. The global menu can search and open these pages directly.


## Global menu

The global menu is the primary navigation and command interface. It searches two spaces:

1. **Resources** — agents/chats, files, tasks, tool results, settings, and plugin-defined URLs. Selecting one opens its URL.
2. **Commands** — named functions available in the current context. Selecting one calls the function.

Chats in the menu are grouped by project/workspace folder and expose running, pinned and unread state. `Cmd+/` opens the menu. When it is closed, `Ctrl+J` opens the next unread chat and `Ctrl+K` returns through this tab's chat jump history; `Cmd+J/K` retain chat scrolling.

## Navigation shell

The shell contains the current URL-addressed page and the full-screen global menu. The menu's Quick section shows New agent plus the ten most recently opened chats; pinned and unread chats are rendered separately, followed by workspace-grouped chats and project/plugin/system columns.

## Plugins

Plugins may contribute:

- addressable resources and their renderers;
- named functions;
- global and contextual menu entries;
- search providers;
- suggested display policies.

A plugin can therefore provide arbitrary windows—for example a Telegram dialog, GitHub pull request, calendar, terminal, table, or map—without modifying the global shell.

The shell owns placement. A resource may be displayed in the current pane, split, popup, drawer, inspector, or browser tab. A plugin may suggest a default display policy but must not own or mutate the global layout directly.

## Boundary

Not every runtime function is public UI or HTTP API. Functions and resources must be explicitly contributed to the UI registry, with metadata such as title, context conditions, arguments, permissions, and preferred display policy.

Not every transient UI detail needs a URL. A state deserves an address when it should survive reload, participate in browser history, or be shareable. Hover, focus, menu prefixes, and temporary resize state remain local presentation state.
