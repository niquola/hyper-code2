type SnapshotMode = "interactive" | "text" | "a11y" | "markdown" | "html";

type SnapshotChanges = {
    added: string[];
    removed: string[];
    changed: Array<{ before: string; after: string }>;
    truncated: boolean;
};

type SnapshotResult = {
    title: string;
    url: string;
    mode: SnapshotMode;
    revision: string;
    content: string;
    truncated: boolean;
    totalNodes: number;
    returnedNodes: number;
    sinceRevision?: string;
    changes?: SnapshotChanges;
};

type SnapshotRecord = { key: string; signature: string; line: string };
type StoredSnapshot = {
    documentKey: string;
    records: Map<string, SnapshotRecord>;
    refs: Map<string, { backendNodeId: number; frameId?: string }>;
    createdAt: number;
};

type SnapshotSessionState = {
    counter: number;
    documentKey?: string;
    snapshots: Map<string, StoredSnapshot>;
    latestRevision?: string;
};

/**
 * Captures a compact text or accessibility snapshot of the current browser page.
 *
 * Use interactive mode before browser actions to obtain revision-scoped element
 * refs, text or Markdown modes to read main content, html mode for a sanitized
 * content subtree, and a11y mode to inspect the broader accessibility tree.
 *
 * @param opts.session Logical browser session whose current page is inspected. @default main
 * @param opts.mode Snapshot representation: compact actionable elements, visible text, readable Markdown, sanitized content HTML, or the accessibility tree. @default interactive
 * @param opts.selector Optional CSS selector that scopes the snapshot to one DOM subtree.
 * @param opts.readable Prefer article/main content over the full page body in text mode. @default false
 * @param opts.maxChars Maximum characters returned in content and change summaries. @default 12000 @minimum 500 @maximum 50000
 * @param opts.maxNodes Maximum accessibility nodes rendered before character truncation. @default 250 @minimum 1 @maximum 2000
 * @param opts.depth Maximum accessibility-tree depth rendered from the selected root. @default 12 @minimum 1 @maximum 40
 * @param opts.sinceRevision Optional earlier revision from the same logical session to compare explicitly.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Logical browser session whose current page is inspected. @default main */
        session?: string;
        /** Snapshot representation: compact actionable elements, visible text, readable Markdown, sanitized content HTML, or the accessibility tree. @default interactive */
        mode?: "interactive" | "text" | "a11y" | "markdown" | "html";
        /** Optional CSS selector that scopes the snapshot to one DOM subtree. */
        selector?: string;
        /** Prefer article/main content over the full page body in text mode. @default false */
        readable?: boolean;
        /** Maximum characters returned in content and change summaries. @default 12000 @minimum 500 @maximum 50000 */
        maxChars?: number;
        /** Maximum accessibility nodes rendered before character truncation. @default 250 @minimum 1 @maximum 2000 */
        maxNodes?: number;
        /** Maximum accessibility-tree depth rendered from the selected root. @default 12 @minimum 1 @maximum 40 */
        depth?: number;
        /** Optional earlier revision from the same logical session to compare explicitly. */
        sinceRevision?: string;
    } = {},
): Promise<SnapshotResult> {
    const session = String(opts.session || "main");
    const mode: SnapshotMode = opts.mode ?? "interactive";
    if (!(["interactive", "text", "a11y", "markdown", "html"] as string[]).includes(mode)) {
        throw new Error(`browser.snapshot: unsupported mode ${String(opts.mode)}`);
    }
    const selector = String(opts.selector ?? "").trim() || undefined;
    const maxChars = clamp(opts.maxChars, 12_000, 500, 50_000);
    const maxNodes = clamp(opts.maxNodes, 250, 1, 2_000);
    const maxDepth = clamp(opts.depth, 12, 1, 40);

    const readableMode = mode === "text" || mode === "markdown" || mode === "html";
    const preferMain = mode !== "text" || opts.readable === true;
    const [page, frameTree] = await Promise.all([
        readPageState(ctx, session, selector, readableMode ? mode : undefined, preferMain),
        ctx.fns.cdp.send({ session, method: "Page.getFrameTree" }),
    ]);
    const mainFrame = frameTree?.frameTree?.frame ?? {};
    const documentKey = `${String(mainFrame.id ?? "frame")}:${String(mainFrame.loaderId ?? page.url)}`;
    const state = sessionState(ctx, session);
    if (state.documentKey && state.documentKey !== documentKey) state.snapshots.clear();
    state.documentKey = documentKey;
    const revision = `r${++state.counter}`;

    let lines: Array<{ key: string; signature: string; line: string }>;
    let totalNodes: number;
    let sourceTruncated = false;
    let refs = new Map<string, { backendNodeId: number; frameId?: string }>();

    if (readableMode) {
        const source = String(page.content ?? "");
        const rawLines = source ? source.split("\n") : [];
        totalNodes = rawLines.length;
        const nodeBounded = rawLines.slice(0, maxNodes).join("\n");
        const contentBounded = nodeBounded.slice(0, maxChars);
        sourceTruncated = rawLines.length > maxNodes || nodeBounded.length > maxChars;
        lines = (contentBounded ? contentBounded.split("\n") : []).map((line: string, index: number) => ({
            key: `${documentKey}:text:${index}`,
            signature: line,
            line,
        }));
    } else {
        await ctx.fns.cdp.send({ session, method: "Accessibility.enable" });
        const tree = await ctx.fns.cdp.send({ session, method: "Accessibility.getFullAXTree" });
        const allNodes: any[] = Array.isArray(tree?.nodes) ? tree.nodes : [];
        const scopeBackendIds = selector ? await scopedBackendIds(ctx, session, selector) : null;
        const rendered = renderAccessibility(allNodes, {
            documentKey,
            mode,
            revision,
            maxDepth,
            scopeBackendIds,
        });
        totalNodes = rendered.length;
        const bounded = rendered.slice(0, maxNodes);
        lines = bounded.map(item => ({ key: item.key, signature: item.signature, line: item.line }));
        refs = new Map(bounded.filter(item => item.ref && item.backendNodeId).map(item => [
            item.ref!,
            { backendNodeId: item.backendNodeId!, frameId: item.frameId },
        ]));
    }

    const limited = limitLines(lines, maxChars);
    const records = new Map(limited.lines.map(item => [item.key, item]));
    const previous = opts.sinceRevision ? state.snapshots.get(opts.sinceRevision) : undefined;
    if (opts.sinceRevision && !previous) {
        throw new Error(`browser.snapshot: unknown revision ${opts.sinceRevision} for session ${session}`);
    }
    const changes = previous ? diffSnapshots(previous.records, records, maxChars) : undefined;
    const returnedRefs = new Set(limited.lines.flatMap(item => {
        const match = item.line.match(/^\s*@(r\d+e\d+)\b/);
        return match ? [match[1]] : [];
    }));
    refs = new Map([...refs].filter(([ref]) => returnedRefs.has(ref)));

    state.snapshots.set(revision, { documentKey, records, refs, createdAt: Date.now() });
    state.latestRevision = revision;
    trimSnapshots(state.snapshots, 12);

    return {
        title: page.title,
        url: page.url,
        mode,
        revision,
        content: limited.lines.map(item => item.line).join("\n"),
        truncated: sourceTruncated || limited.truncated || totalNodes > maxNodes,
        totalNodes,
        returnedNodes: limited.lines.length,
        ...(opts.sinceRevision ? { sinceRevision: opts.sinceRevision } : {}),
        ...(changes ? { changes } : {}),
    };
}

function clamp(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
    const number = Number(value ?? fallback);
    return Math.max(minimum, Math.min(Number.isFinite(number) ? Math.floor(number) : fallback, maximum));
}

function clean(value: unknown): string {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function quoted(value: unknown, maximum = 240): string {
    const text = clean(value).slice(0, maximum);
    return JSON.stringify(text);
}

function sessionState(ctx: Context, session: string): SnapshotSessionState {
    const root = ((ctx.state as any).browserSnapshot ??= { sessions: new Map() });
    const sessions: Map<string, SnapshotSessionState> = (root.sessions ??= new Map());
    let state = sessions.get(session);
    if (!state) {
        state = { counter: 0, snapshots: new Map() };
        sessions.set(session, state);
    }
    return state;
}

async function readPageState(
    ctx: Context,
    session: string,
    selector: string | undefined,
    readableMode: "text" | "markdown" | "html" | undefined,
    preferMain: boolean,
): Promise<{ title: string; url: string; readyState: string; content?: string }> {
    const expression = readableMode
        ? readableExpression(selector, readableMode, preferMain)
        : `(() => {
          const selector = ${JSON.stringify(selector ?? null)};
          const root = selector ? document.querySelector(selector) : document.body || document.documentElement;
          if (!root) throw new Error(selector ? "selector not found: " + selector : "document has no readable root");
          return { title: document.title, url: location.href, readyState: document.readyState };
        })()`;
    const value = await ctx.fns.browser.evaluate({ session, expression });
    return {
        title: String(value?.title ?? ""),
        url: String(value?.url ?? ""),
        readyState: String(value?.readyState ?? ""),
        ...(readableMode ? { content: String(value?.content ?? "") } : {}),
    };
}

function readableExpression(selector: string | undefined, mode: "text" | "markdown" | "html", preferMain: boolean): string {
    if (mode === "text" && !preferMain) {
        return `(() => {
          const selector = ${JSON.stringify(selector ?? null)};
          const root = selector ? document.querySelector(selector) : document.body || document.documentElement;
          if (!root) throw new Error(selector ? "selector not found: " + selector : "document has no readable root");
          return {
            title: document.title,
            url: location.href,
            readyState: document.readyState,
            content: (root.innerText || root.textContent || "").trim()
          };
        })()`;
    }
    return `(() => {
      const selector = ${JSON.stringify(selector ?? null)};
      const root = selector
        ? document.querySelector(selector)
        : ${preferMain ? `document.querySelector("article,main,[role=main]") || ` : ""}document.body || document.documentElement;
      if (!root) throw new Error(selector ? "selector not found: " + selector : "document has no readable root");
      const clone = root.cloneNode(true);
      clone.querySelectorAll("script,style,noscript,nav,footer,header,aside,form,button,svg,canvas,template").forEach(x => x.remove());

      const cleanText = value => String(value || "").replace(/\\u200b/g, "").replace(/\\n{3,}/g, "\\n\\n").trim();
      const escapeMarkdown = value => String(value || "").replace(/([\\\\*_[\\]<>])/g, "\\\\$1");
      const absoluteUrl = value => { try { return new URL(value, location.href).href; } catch { return value || ""; } };
      const inline = node => {
        if (!node) return "";
        if (node.nodeType === Node.TEXT_NODE) return String(node.textContent || "").replace(/\\s+/g, " ");
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const tag = node.tagName.toLowerCase();
        const body = Array.from(node.childNodes).map(inline).join("");
        if (tag === "a") { const href = absoluteUrl(node.getAttribute("href")); return href ? "[" + (body.trim() || href) + "](" + href + ")" : body; }
        if (tag === "code") return "\\x60" + String(node.textContent || "") + "\\x60";
        if (tag === "strong" || tag === "b") return "**" + body.trim() + "**";
        if (tag === "em" || tag === "i") return "*" + body.trim() + "*";
        if (tag === "br") return "\\n";
        if (tag === "img") { const alt = node.getAttribute("alt") || ""; const src = absoluteUrl(node.getAttribute("src")); return src ? "![" + escapeMarkdown(alt) + "](" + src + ")" : ""; }
        return body;
      };
      const blocks = [];
      const renderBlock = (node, depth = 0) => {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag)) { blocks.push("#".repeat(Number(tag[1])) + " " + cleanText(inline(node))); return; }
        if (tag === "pre") { blocks.push("\\x60\\x60\\x60\\n" + String(node.textContent || "").trim() + "\\n\\x60\\x60\\x60"); return; }
        if (tag === "blockquote") { blocks.push(cleanText(inline(node)).split("\\n").map(x => "> " + x).join("\\n")); return; }
        if (tag === "ul" || tag === "ol") {
          Array.from(node.children).filter(x => x.tagName && x.tagName.toLowerCase() === "li").forEach((li, index) => {
            blocks.push("  ".repeat(depth) + (tag === "ol" ? (index + 1) + ". " : "- ") + cleanText(inline(li)));
          });
          return;
        }
        if (tag === "table") {
          const rows = Array.from(node.querySelectorAll("tr")).map(tr => Array.from(tr.querySelectorAll(":scope > th,:scope > td")).map(cell => cleanText(inline(cell)).replace(/\\|/g, "\\\\|"))).filter(r => r.length);
          if (rows.length) {
            const width = Math.max(...rows.map(r => r.length));
            const pad = r => Array.from({ length: width }, (_, i) => r[i] || "");
            blocks.push("| " + pad(rows[0]).join(" | ") + " |\\n| " + Array(width).fill("---").join(" | ") + " |" + rows.slice(1).map(r => "\\n| " + pad(r).join(" | ") + " |").join(""));
          }
          return;
        }
        if (["p", "div", "section", "article", "main", "figure", "figcaption", "details", "summary", "dl"].includes(tag)) {
          const directBlocks = Array.from(node.children).some(x => /^(h[1-6]|p|pre|blockquote|ul|ol|table|section|article|div)$/.test(x.tagName.toLowerCase()));
          if (directBlocks) Array.from(node.children).forEach(child => renderBlock(child, depth));
          else { const value = cleanText(inline(node)); if (value) blocks.push(value); }
          return;
        }
        Array.from(node.children).forEach(child => renderBlock(child, depth));
      };
      renderBlock(clone);
      const text = cleanText(clone.innerText || clone.textContent || "");
      const markdown = cleanText(blocks.join("\\n\\n")) || text;
      const html = String(clone.innerHTML || "").trim();
      const outputMode = ${JSON.stringify(mode)};
      const content = outputMode === "markdown" ? markdown : outputMode === "html" ? html : text;
      return { title: document.title, url: location.href, readyState: document.readyState, content };
    })()`;
}

async function scopedBackendIds(ctx: Context, session: string, selector: string): Promise<Set<number>> {
    await ctx.fns.cdp.send({ session, method: "DOM.enable" });
    const document = await ctx.fns.cdp.send({ session, method: "DOM.getDocument", params: { depth: 1, pierce: true } });
    const rootNodeId = Number(document?.root?.nodeId ?? 0);
    const match = await ctx.fns.cdp.send({ session, method: "DOM.querySelector", params: { nodeId: rootNodeId, selector } });
    const nodeId = Number(match?.nodeId ?? 0);
    if (!nodeId) throw new Error(`browser.snapshot: selector not found: ${selector}`);
    const described = await ctx.fns.cdp.send({ session, method: "DOM.describeNode", params: { nodeId, depth: -1, pierce: true } });
    const ids = new Set<number>();
    collectBackendIds(described?.node, ids);
    return ids;
}

function collectBackendIds(node: any, ids: Set<number>): void {
    if (!node || typeof node !== "object") return;
    if (Number(node.backendNodeId) > 0) ids.add(Number(node.backendNodeId));
    for (const key of ["children", "shadowRoots", "pseudoElements"]) {
        for (const child of Array.isArray(node[key]) ? node[key] : []) collectBackendIds(child, ids);
    }
    collectBackendIds(node.contentDocument, ids);
    collectBackendIds(node.templateContent, ids);
}

function axValue(value: any): any {
    return value && typeof value === "object" && "value" in value ? value.value : value;
}

function axProperties(node: any): Map<string, any> {
    return new Map((Array.isArray(node?.properties) ? node.properties : []).map((property: any) => [property.name, axValue(property.value)]));
}

function renderAccessibility(
    nodes: any[],
    options: {
        documentKey: string;
        mode: "interactive" | "a11y";
        revision: string;
        maxDepth: number;
        scopeBackendIds: Set<number> | null;
    },
): Array<{ key: string; signature: string; line: string; ref?: string; backendNodeId?: number; frameId?: string }> {
    const byId = new Map(nodes.map(node => [String(node.nodeId), node]));
    const depthMemo = new Map<string, number>();
    const depthOf = (node: any): number => {
        const id = String(node?.nodeId ?? "");
        if (depthMemo.has(id)) return depthMemo.get(id)!;
        const parent = byId.get(String(node?.parentId ?? ""));
        const depth = parent ? Math.min(depthOf(parent) + 1, 100) : 0;
        depthMemo.set(id, depth);
        return depth;
    };
    const scopeIds = options.scopeBackendIds;
    const includedAxIds = new Set<string>();
    if (scopeIds) {
        for (const node of nodes) {
            if (scopeIds.has(Number(node.backendDOMNodeId))) includedAxIds.add(String(node.nodeId));
        }
        let changed = true;
        while (changed) {
            changed = false;
            for (const node of nodes) {
                if (includedAxIds.has(String(node.parentId)) && !includedAxIds.has(String(node.nodeId))) {
                    includedAxIds.add(String(node.nodeId));
                    changed = true;
                }
            }
        }
    }
    const candidates = nodes.filter(node => {
        if (node?.ignored) return false;
        if (scopeIds && !includedAxIds.has(String(node.nodeId))) return false;
        const role = clean(axValue(node.role));
        if (!role || role === "InlineTextBox") return false;
        if (depthOf(node) > options.maxDepth) return false;
        return options.mode === "a11y" || isCompactNode(node, role);
    });
    const baseDepth = candidates.length ? Math.min(...candidates.map(depthOf)) : 0;
    let refIndex = 0;
    return candidates.map(node => {
        const role = clean(axValue(node.role)) || "generic";
        const name = clean(axValue(node.name));
        const value = clean(axValue(node.value));
        const properties = axProperties(node);
        const backendNodeId = Number(node.backendDOMNodeId ?? 0) || undefined;
        const referenceable = Boolean(backendNodeId) && !["RootWebArea", "StaticText", "LineBreak", "generic", "none", "presentation"].includes(role);
        const ref = referenceable ? `${options.revision}e${++refIndex}` : undefined;
        const states = stateLabels(properties);
        const attributes: string[] = [];
        if (value && value !== name) attributes.push(`value=${quoted(value, 160)}`);
        const level = properties.get("level");
        if (level != null) attributes.push(`level=${String(level)}`);
        if (states.length) attributes.push(states.join(" "));
        const indent = "  ".repeat(Math.max(0, Math.min(depthOf(node) - baseDepth, options.maxDepth)));
        const line = `${indent}${ref ? `@${ref} ` : ""}[${role}]${name ? ` ${quoted(name)}` : ""}${attributes.length ? ` ${attributes.join(" ")}` : ""}`;
        const stable = `${options.documentKey}:${backendNodeId ? `dom:${backendNodeId}` : `ax:${String(node.nodeId)}`}`;
        return {
            key: stable,
            signature: `${role}|${name}|${value}|${attributes.join("|")}`,
            line,
            ...(ref ? { ref } : {}),
            ...(backendNodeId ? { backendNodeId } : {}),
            ...(node.frameId ? { frameId: String(node.frameId) } : {}),
        };
    });
}

function isCompactNode(node: any, role: string): boolean {
    const properties = axProperties(node);
    if (["RootWebArea", "WebArea"].includes(role)) return false;
    if (properties.get("focusable") === true || properties.get("editable") === true) return true;
    return new Set([
        "button", "link", "textbox", "searchbox", "checkbox", "radio", "combobox", "listbox", "option",
        "menuitem", "menuitemcheckbox", "menuitemradio", "tab", "switch", "slider", "spinbutton", "treeitem",
        "heading", "img", "dialog", "alert", "status",
    ]).has(role);
}

function stateLabels(properties: Map<string, any>): string[] {
    const out: string[] = [];
    for (const name of ["checked", "expanded", "selected", "pressed", "required", "readonly", "disabled", "invalid"]) {
        const value = properties.get(name);
        if (value === true) out.push(name);
        else if (value === false && ["checked", "expanded", "selected", "pressed"].includes(name)) out.push(`${name}=false`);
        else if (value != null && value !== false && value !== "false") out.push(`${name}=${clean(value)}`);
    }
    return out;
}

function limitLines(lines: SnapshotRecord[], maxChars: number): { lines: SnapshotRecord[]; truncated: boolean } {
    const kept: SnapshotRecord[] = [];
    let size = 0;
    for (const line of lines) {
        const extra = line.line.length + (kept.length ? 1 : 0);
        if (size + extra > maxChars) break;
        kept.push(line);
        size += extra;
    }
    return { lines: kept, truncated: kept.length < lines.length };
}

function diffSnapshots(previous: Map<string, SnapshotRecord>, current: Map<string, SnapshotRecord>, maxChars: number): SnapshotChanges {
    const added: string[] = [];
    const removed: string[] = [];
    const changed: Array<{ before: string; after: string }> = [];
    let size = 0;
    let truncated = false;
    const take = (value: string): boolean => {
        if (size + value.length + 1 > maxChars) { truncated = true; return false; }
        size += value.length + 1;
        return true;
    };
    for (const [key, record] of current) {
        const before = previous.get(key);
        if (!before) {
            if (take(record.line)) added.push(record.line);
        } else if (before.signature !== record.signature) {
            const serialized = `${before.line}\n${record.line}`;
            if (take(serialized)) changed.push({ before: before.line, after: record.line });
        }
    }
    for (const [key, record] of previous) {
        if (!current.has(key) && take(record.line)) removed.push(record.line);
    }
    return { added, removed, changed, truncated };
}

function trimSnapshots(snapshots: Map<string, StoredSnapshot>, maximum: number): void {
    while (snapshots.size > maximum) snapshots.delete(snapshots.keys().next().value as string);
}
