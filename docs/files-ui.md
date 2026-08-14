# Files UI

The Files UI is the browser-facing file explorer and previewer served at `GET /files`.
It is intentionally separate from the `ctx.fns.files.*` tool API: the procedures read and
modify files, while the HTTP routes render those files for a person.

## Navigation

```text
GET /files                         current workspace root
GET /files?path=src/ui             directory listing
GET /files?path=src/ui/layout.ts   file view
GET /files?path=README.md&tab=edit file editor
```

`path` may be relative to the current workspace or absolute. Absolute paths are preserved
through directory links and breadcrumbs. `files.resolveSafe` is the source of truth for
resolution; despite its historical name, it permits paths outside the workspace.

The agents rail groups agents by `workspace_dir`. Clicking a project heading opens that
absolute directory in the Files UI and swaps only `#main`, preserving rail state.

To open a file from a server-side procedure, use:

```ts
await ctx.fns.ui.openFile({ path: "src/ui/chatColumn.ts" });
```

`ui.openFile` resolves the path, records it through `files.open`, and emits `ui.navigate`
to `/files?path=...`. Calling `files.open` directly only maintains the server-side open-file
list; it is not the browser navigation API.

## Directory view

Directories use a GitHub-style centered container (`max-w-5xl`, currently 1024 px):

- blue breadcrumb links with caret separators;
- bordered directory card and item count;
- one row per child, with folders first and names sorted alphabetically;
- neutral file-type icons and a type label;
- `node_modules`, `.git`, and `.DS_Store` are omitted by `files.list`.

Keep the content container bounded rather than stretching the table across the entire page.
The layout must remain responsive: `w-full` below the maximum width, centered above it.

## File tabs

Text files provide `Code` and `Edit`. Markdown and HTML also provide `Preview`.
The editor uses CodeMirror, is bootstrapped inside the `#main` fragment so it works after
an htmx navigation, and saves with:

```text
PUT /files?path=<path>
Content-Type: text/plain
```

Binary media never passes through `files.read`, because that procedure decodes content as
UTF-8. Media files show only `Preview` and are loaded through the raw route.

## Media preview

`GET /files/raw?path=...` streams the `Bun.file` response with an explicit MIME type,
`X-Content-Type-Options: nosniff`, and private revalidation caching.

Supported browser-native previews:

| Kind | Extensions | Element |
|---|---|---|
| Images | `png jpg jpeg gif webp avif svg bmp ico` | `<img>` |
| Video | `mp4 webm mov m4v ogv` | `<video controls>` |
| Audio | `mp3 wav ogg oga m4a aac flac opus` | `<audio controls>` |
| Documents | `pdf` | `<iframe>` |

Codec support still depends on the browser. The raw endpoint returns `404` for missing paths
and directories.

## Relevant files

```text
src/files/$route_GET.ts             directory and file page rendering
src/files/$route_raw_GET.ts         binary media streaming
src/files/$route__PUT.ts            editor save endpoint
src/files/$script_editor.js         CodeMirror mount and autosave
src/files/list.ts                    directory enumeration
src/files/open.ts                    server-side open-file state and event
src/ui/openFile.ts                   browser-facing programmatic navigation
src/ui/agentsRail.ts                 project links into Files UI
src/files/routeBreadcrumbs.test.ts   path, fragment, and editor bootstrap tests
src/files/routeMediaPreview.test.ts  media preview and raw response tests
```

After changing a route, reload both the namespace and route table:

```ts
await ctx.fns.procs.repl.load({ name: "files" });
await ctx.fns.procs.http.loadRoutes({});
```
