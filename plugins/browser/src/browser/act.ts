type ActTarget =
    | { ref: string; css?: never; text?: never; exact?: never }
    | { css: string; ref?: never; text?: never; exact?: never }
    | { text: string; exact?: boolean; ref?: never; css?: never };

type BrowserAction =
    | { kind: "click"; target: ActTarget; button?: "left" | "middle" | "right"; count?: number }
    | { kind: "fill"; target: ActTarget; value: string }
    | { kind: "press"; target?: ActTarget; key: string }
    | { kind: "select"; target: ActTarget; values: string[] }
    | { kind: "check"; target: ActTarget; value: boolean }
    | { kind: "hover"; target: ActTarget }
    | { kind: "scroll"; target?: ActTarget; dx?: number; dy?: number };

type ActionStepResult = {
    index: number;
    kind: BrowserAction["kind"];
    target?: ActTarget;
    value?: unknown;
};

type ActionFailure = {
    index: number;
    kind: string;
    code: string;
    message: string;
    retryable: boolean;
    hint?: string;
};

type ActResult = {
    ok: boolean;
    completed: number;
    results: ActionStepResult[];
    url: string;
    title: string;
    failed?: ActionFailure;
};

class ActionError extends Error {
    code: string;
    retryable: boolean;
    hint?: string;

    constructor(code: string, message: string, retryable = false, hint?: string) {
        super(message);
        this.name = "ActionError";
        this.code = code;
        this.retryable = retryable;
        this.hint = hint;
    }
}

/**
 * Executes one or more browser actions sequentially in a named Chrome session.
 *
 * Actions are fail-fast and run in array order under a per-session mutation
 * queue. Targets may use a revision-scoped ref from browser.snapshot, a strict
 * CSS selector, or strict visible-text matching. Each target is auto-waited for
 * attachment, visibility and actionability before the action runs. A failed
 * batch returns completed step results plus a structured failed step instead of
 * hiding partial execution.
 *
 * @param opts.session Logical browser session whose page receives the actions. @default main
 * @param opts.actions Ordered non-empty action list; execution stops at the first failure. @minimum 1 @maximum 50
 * @param opts.timeoutMs Maximum wait for each target to become actionable. @default 5000 @minimum 100 @maximum 60000
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Logical browser session whose page receives the actions. @default main */
        session?: string;
        /** Ordered non-empty action list; execution stops at the first failure. @minimum 1 @maximum 50 */
        actions: BrowserAction[];
        /** Maximum wait for each target to become actionable. @default 5000 @minimum 100 @maximum 60000 */
        timeoutMs?: number;
    },
): Promise<ActResult> {
    const scope = await ctx.fns.cdp.scope({ session: opts.session });
    const session = String(scope.session || "main");
    if (!Array.isArray(opts.actions) || opts.actions.length === 0) {
        throw new TypeError("browser.act: actions must be a non-empty array");
    }
    if (opts.actions.length > 50) throw new TypeError("browser.act: at most 50 actions are allowed per call");
    const timeoutMs = clamp(opts.timeoutMs, 5_000, 100, 60_000);

    return await inMutationQueue(ctx, session, async () => {
        const results: ActionStepResult[] = [];
        for (let index = 0; index < opts.actions.length; index++) {
            const action = opts.actions[index]!;
            try {
                const value = await executeAction(ctx, session, action, timeoutMs);
                results.push({
                    index,
                    kind: action.kind,
                    ...(action.target ? { target: action.target } : {}),
                    ...(value === undefined ? {} : { value }),
                });
            } catch (error: any) {
                const failure = normalizeFailure(error, index, String(action?.kind ?? "unknown"));
                const page = await pageMeta(ctx, session);
                return { ok: false, completed: results.length, results, ...page, failed: failure };
            }
        }
        const page = await pageMeta(ctx, session);
        return { ok: true, completed: results.length, results, ...page };
    });
}

async function executeAction(ctx: Context, session: string, action: BrowserAction, timeoutMs: number): Promise<unknown> {
    if (!action || typeof action !== "object" || !String((action as any).kind ?? "")) {
        throw new ActionError("INVALID_ACTION", "browser.act: every action requires a kind");
    }
    switch (action.kind) {
        case "click": {
            const count = clamp(action.count, 1, 1, 3);
            const button = action.button ?? "left";
            return await withActionableTarget(ctx, session, action.target, timeoutMs, "pointer", async (objectId, state) => {
                await ctx.fns.cdp.send({ session, method: "Runtime.callFunctionOn", params: {
                    objectId,
                    functionDeclaration: "function() { this.focus?.({ preventScroll: true }); return true; }",
                    returnByValue: true,
                    userGesture: true,
                } });

                await ctx.fns.cdp.send({ session, method: "Input.dispatchMouseEvent", params: { type: "mouseMoved", x: state.x, y: state.y } });
                for (let clickCount = 1; clickCount <= count; clickCount++) {
                    await ctx.fns.cdp.send({ session, method: "Input.dispatchMouseEvent", params: { type: "mousePressed", x: state.x, y: state.y, button, buttons: mouseButtonMask(button), clickCount } });
                    await ctx.fns.cdp.send({ session, method: "Input.dispatchMouseEvent", params: { type: "mouseReleased", x: state.x, y: state.y, button, buttons: 0, clickCount } });
                }
                return { clicked: true, button, count, tag: state.tag };
            });
        }
        case "fill":
            return await withActionableTarget(ctx, session, action.target, timeoutMs, "editable", async objectId => {
                return await callOn(ctx, session, objectId, `function(value) {
                  const el = this;
                  const tag = String(el.tagName || "").toLowerCase();
                  const type = String(el.type || "").toLowerCase();
                  if (tag === "select" || type === "checkbox" || type === "radio" || type === "file") throw new Error("INVALID_FILL_TARGET: use select, check, or upload semantics for this element");
                  el.focus();
                  if (el.isContentEditable) el.textContent = String(value);
                  else {
                    const proto = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
                    setter ? setter.call(el, String(value)) : (el.value = String(value));
                  }
                  el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                  return { value: el.isContentEditable ? el.textContent : el.value };
                }`, [action.value]);
            });
        case "press": {
            if (action.target) {
                await withActionableTarget(ctx, session, action.target, timeoutMs, "visible", async objectId => {
                    await callOn(ctx, session, objectId, "function() { this.focus(); return { focused: document.activeElement === this }; }");
                });
            }
            const tabDirection = tabFocusDirection(action.key);
            if (tabDirection) await rememberFocusedElement(ctx, session);
            await dispatchKey(ctx, session, action.key);
            const focus = tabDirection ? await ensureTabTraversal(ctx, session, tabDirection) : undefined;
            return { key: action.key, ...(focus ? { focus } : {}) };
        }
        case "select":
            return await withActionableTarget(ctx, session, action.target, timeoutMs, "editable", async objectId => {
                return await callOn(ctx, session, objectId, `function(values) {
                  if (!(this instanceof HTMLSelectElement)) throw new Error("INVALID_SELECT_TARGET: target is not a select element");
                  const requested = Array.from(values, String);
                  const selected = [];
                  for (const option of this.options) {
                    const matches = requested.includes(option.value) || requested.includes((option.textContent || "").trim());
                    option.selected = matches;
                    if (matches) selected.push(option.value);
                  }
                  const missing = requested.filter(value => !Array.from(this.options).some(option => option.value === value || (option.textContent || "").trim() === value));
                  if (missing.length) throw new Error("OPTION_NOT_FOUND: " + missing.join(", "));
                  if (!this.multiple && selected.length > 1) throw new Error("INVALID_SELECT_VALUE: single-select accepts one value");
                  this.dispatchEvent(new Event("input", { bubbles: true }));
                  this.dispatchEvent(new Event("change", { bubbles: true }));
                  return { values: Array.from(this.selectedOptions).map(option => option.value) };
                }`, [action.values]);
            });
        case "check":
            return await withActionableTarget(ctx, session, action.target, timeoutMs, "check", async (objectId, state) => {
                const before = await callOn(ctx, session, objectId, `function(desired) {
                  const type = String(this.type || "").toLowerCase();
                  if (!(this instanceof HTMLInputElement) || (type !== "checkbox" && type !== "radio")) throw new Error("INVALID_CHECK_TARGET: target is not a checkbox or radio");
                  if (type === "radio" && desired === false) throw new Error("INVALID_CHECK_VALUE: a radio cannot be unchecked directly");
                  return { checked: this.checked, desired: Boolean(desired), visuallyHidden: getComputedStyle(this).opacity === "0" || this.getBoundingClientRect().width <= 1 || this.getBoundingClientRect().height <= 1 };
                }`, [action.value]);
                if (before.checked !== before.desired) {
                    if (before.visuallyHidden) {
                        await callOn(ctx, session, objectId, `function(desired) {
                          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
                          setter ? setter.call(this, Boolean(desired)) : (this.checked = Boolean(desired));
                          this.dispatchEvent(new Event("input", { bubbles: true }));
                          this.dispatchEvent(new Event("change", { bubbles: true }));
                          return { checked: this.checked };
                        }`, [action.value]);
                    } else {
                        await ctx.fns.cdp.send({ session, method: "Input.dispatchMouseEvent", params: { type: "mousePressed", x: state.x, y: state.y, button: "left", buttons: 1, clickCount: 1 } });
                        await ctx.fns.cdp.send({ session, method: "Input.dispatchMouseEvent", params: { type: "mouseReleased", x: state.x, y: state.y, button: "left", buttons: 0, clickCount: 1 } });
                    }
                }
                const afterPointer = await callOn(ctx, session, objectId, "function() { return { checked: Boolean(this.checked) }; }");
                if (afterPointer.checked !== action.value) {
                    await callOn(ctx, session, objectId, `function(desired) {
                      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
                      setter ? setter.call(this, Boolean(desired)) : (this.checked = Boolean(desired));
                      this.dispatchEvent(new Event("input", { bubbles: true }));
                      this.dispatchEvent(new Event("change", { bubbles: true }));
                      return { checked: Boolean(this.checked) };
                    }`, [action.value]);
                }
                const after = await callOn(ctx, session, objectId, "function() { return { checked: Boolean(this.checked) }; }");
                if (after.checked !== action.value) throw new ActionError("CHECK_FAILED", `target remained checked=${after.checked}`, true);
                return after;
            });
        case "hover":
            return await withActionableTarget(ctx, session, action.target, timeoutMs, "pointer", async (_objectId, state) => {
                await ctx.fns.cdp.send({ session, method: "Input.dispatchMouseEvent", params: { type: "mouseMoved", x: state.x, y: state.y } });
                return { hovered: true, x: state.x, y: state.y };
            });
        case "scroll": {
            const dx = finite(action.dx, 0);
            const dy = finite(action.dy, 0);
            if (!action.target) {
                return await ctx.fns.browser.evaluate({
                    session,
                    expression: `(() => { window.scrollBy(${JSON.stringify(dx)}, ${JSON.stringify(dy)}); return { x: window.scrollX, y: window.scrollY }; })()`,
                });
            }
            return await withActionableTarget(ctx, session, action.target, timeoutMs, "attached", async objectId => {
                return await callOn(ctx, session, objectId, `function(delta) {
                  this.scrollIntoView({ block: "center", inline: "center" });
                  if (delta.dx || delta.dy) this.scrollBy?.(delta.dx, delta.dy);
                  return { x: this.scrollLeft || 0, y: this.scrollTop || 0 };
                }`, [{ dx, dy }]);
            });
        }
        default:
            throw new ActionError("UNSUPPORTED_ACTION", `browser.act: unsupported action kind ${(action as any).kind}`);
    }
}

async function withActionableTarget<T>(
    ctx: Context,
    session: string,
    target: ActTarget,
    timeoutMs: number,
    requirement: "attached" | "visible" | "editable" | "pointer" | "check",
    run: (objectId: string, state: any) => Promise<T>,
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last: ActionError | null = null;
    while (Date.now() <= deadline) {
        let objectId: string | null = null;
        try {
            objectId = await resolveTarget(ctx, session, target, requirement);
            const state = await inspectActionability(ctx, session, objectId, requirement);
            if (!state.ok) throw new ActionError(state.code || "NOT_ACTIONABLE", state.message || "target is not actionable", true, state.hint);
            return await run(objectId, state);
        } catch (error: any) {
            const normalized = asActionError(error);
            last = normalized;
            if (!normalized.retryable || normalized.code === "TARGET_AMBIGUOUS" || normalized.code === "STALE_REF") throw normalized;
        } finally {
            if (objectId) await ctx.fns.cdp.send({ session, method: "Runtime.releaseObject", params: { objectId } }).catch(() => {});
        }
        await Bun.sleep(Math.min(100, Math.max(10, deadline - Date.now())));
    }
    throw new ActionError("TIMEOUT", `target did not become actionable within ${timeoutMs}ms: ${last?.message ?? "not found"}`, true, last?.hint);
}

async function resolveTarget(ctx: Context, session: string, target: ActTarget, requirement: "attached" | "visible" | "editable" | "pointer" | "check"): Promise<string> {
    const kind = validateTarget(target);
    if (kind === "ref") {
        const ref = String((target as any).ref).replace(/^@/, "");
        const match = ref.match(/^(r\d+)e\d+$/);
        if (!match) throw new ActionError("INVALID_TARGET", `invalid snapshot ref ${ref}`);
        const state = (ctx.state as any).browserSnapshot?.sessions?.get(session);
        const snapshot = state?.snapshots?.get(match[1]);
        if (!snapshot) throw new ActionError("STALE_REF", `snapshot revision ${match[1]} is unavailable for session ${session}`, false, "capture a new interactive snapshot");
        const frameTree = await ctx.fns.cdp.send({ session, method: "Page.getFrameTree" });
        const frame = frameTree?.frameTree?.frame ?? {};
        const currentDocumentKey = `${String(frame.id ?? "frame")}:${String(frame.loaderId ?? "")}`;
        if (snapshot.documentKey !== currentDocumentKey) {
            throw new ActionError("STALE_REF", `ref @${ref} belongs to a previous document`, false, "capture a new interactive snapshot");
        }
        const entry = snapshot.refs?.get(ref);
        if (!entry?.backendNodeId) throw new ActionError("STALE_REF", `ref @${ref} is not available`, false, "capture a new interactive snapshot");
        try {
            const resolved = await ctx.fns.cdp.send({ session, method: "DOM.resolveNode", params: { backendNodeId: entry.backendNodeId, objectGroup: "browser-act" } });
            const objectId = resolved?.object?.objectId;
            if (!objectId) throw new Error("Chrome returned no objectId");
            return String(objectId);
        } catch (error: any) {
            throw new ActionError("STALE_REF", `ref @${ref} is detached: ${String(error?.message ?? error)}`, false, "capture a new interactive snapshot");
        }
    }

    const expression = kind === "css"
        ? cssResolverExpression(String((target as any).css), requirement === "check")
        : textResolverExpression(String((target as any).text), (target as any).exact !== false);
    const result = await ctx.fns.cdp.send({
        session,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: false, awaitPromise: true, objectGroup: "browser-act" },
    });
    if (result?.exceptionDetails) throw locatorException(result.exceptionDetails);
    const objectId = result?.result?.objectId;
    if (!objectId || result?.result?.subtype === "null") throw new ActionError("TARGET_NOT_FOUND", `${kind} target was not found`, true);
    return String(objectId);
}

function validateTarget(target: ActTarget): "ref" | "css" | "text" {
    if (!target || typeof target !== "object") throw new ActionError("INVALID_TARGET", "target must be an object");
    const kinds = ["ref", "css", "text"].filter(key => clean((target as any)[key]));
    if (kinds.length !== 1) throw new ActionError("INVALID_TARGET", "target must contain exactly one of ref, css, or text");
    return kinds[0] as "ref" | "css" | "text";
}

function cssResolverExpression(css: string, allowHiddenCheck = false): string {
    return `(() => {
      const selector = ${JSON.stringify(css)};
      const allowHiddenCheck = ${JSON.stringify(allowHiddenCheck)};
      let all;
      try { all = Array.from(document.querySelectorAll(selector)); }
      catch (error) { throw new Error("INVALID_SELECTOR: " + error.message); }
      const visible = el => {
        const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
      };
      const matches = all.filter(el => visible(el) || (allowHiddenCheck && el instanceof HTMLInputElement && ["checkbox", "radio"].includes(String(el.type).toLowerCase())));
      if (!matches.length) throw new Error("TARGET_NOT_FOUND: " + selector);
      if (matches.length > 1) throw new Error("TARGET_AMBIGUOUS: " + matches.length + " actionable matches for " + selector);
      return matches[0];
    })()`;
}

function textResolverExpression(text: string, exact: boolean): string {
    return `(() => {
      const needle = ${JSON.stringify(clean(text))};
      const exact = ${JSON.stringify(exact)};
      const normalize = value => String(value || "").replace(/\\s+/g, " ").trim();
      const visible = el => {
        const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
      };
      const preferred = Array.from(document.querySelectorAll("button,a,input,textarea,select,[role],[tabindex],label,summary"));
      const all = preferred.length ? preferred : Array.from(document.body?.querySelectorAll("*") || []);
      const matches = all.filter(el => {
        if (!visible(el)) return false;
        const value = normalize(el.innerText || el.getAttribute("aria-label") || el.value || el.textContent);
        return exact ? value === needle : value.includes(needle);
      });
      if (!matches.length) throw new Error("TARGET_NOT_FOUND: text " + needle);
      if (matches.length > 1) throw new Error("TARGET_AMBIGUOUS: " + matches.length + " matches for text " + needle);
      return matches[0];
    })()`;
}

async function inspectActionability(ctx: Context, session: string, objectId: string, requirement: string): Promise<any> {
    return await callOn(ctx, session, objectId, `function(requirement) {
      const el = this;
      if (!(el instanceof Element) || !el.isConnected) return { ok: false, code: "TARGET_DETACHED", message: "target is detached" };
      if (requirement === "attached") return { ok: true, tag: String(el.tagName || "").toLowerCase() };
      el.scrollIntoView({ block: "center", inline: "center" });
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visuallyHiddenCheck = requirement === "check" && el instanceof HTMLInputElement && ["checkbox", "radio"].includes(String(el.type).toLowerCase());
      if (!visuallyHiddenCheck && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0 || rect.width <= 0 || rect.height <= 0)) {
        return { ok: false, code: "TARGET_HIDDEN", message: "target is not visible" };
      }
      if (el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") return { ok: false, code: "TARGET_DISABLED", message: "target is disabled" };
      if (requirement === "editable") {
        const tag = String(el.tagName || "").toLowerCase();
        if (!(tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable)) return { ok: false, code: "TARGET_NOT_EDITABLE", message: "target is not editable" };
        if (el.readOnly) return { ok: false, code: "TARGET_READONLY", message: "target is read-only" };
      }
      let pointerElement = el;
      if (visuallyHiddenCheck) {
        const label = el.id ? document.querySelector('label[for="' + CSS.escape(el.id) + '"]') : el.closest("label") || el.parentElement?.querySelector("label");
        if (label) pointerElement = label;
      }
      const pointerRect = pointerElement.getBoundingClientRect();
      const x = Math.max(0, Math.min(innerWidth - 1, pointerRect.left + pointerRect.width / 2));
      const y = Math.max(0, Math.min(innerHeight - 1, pointerRect.top + pointerRect.height / 2));
      if (requirement === "pointer") {
        const hit = document.elementFromPoint(x, y);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
          return { ok: false, code: "TARGET_OBSCURED", message: "target is obscured by " + String(hit.tagName || "element").toLowerCase() };
        }
      }
      return { ok: true, x, y, tag: String(el.tagName || "").toLowerCase() };
    }`, [requirement]);
}

async function callOn(ctx: Context, session: string, objectId: string, functionDeclaration: string, args: unknown[] = []): Promise<any> {
    const result = await ctx.fns.cdp.send({
        session,
        method: "Runtime.callFunctionOn",
        params: {
            objectId,
            functionDeclaration,
            arguments: args.map(value => ({ value })),
            returnByValue: true,
            awaitPromise: true,
            userGesture: true,
        },
    });
    if (result?.exceptionDetails) {
        const message = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "page action failed";
        throw pageActionException(String(message));
    }
    return result?.result?.value;
}

function tabFocusDirection(input: string): 1 | -1 | null {
    const parts = String(input || "").split("+").map(part => part.trim().toLowerCase()).filter(Boolean);
    if (parts.at(-1) !== "tab") return null;
    return parts.includes("shift") ? -1 : 1;
}

async function rememberFocusedElement(ctx: Context, session: string): Promise<void> {
    await ctx.fns.browser.evaluate({
        session,
        expression: `(() => {
          const root = globalThis;
          const active = document.activeElement;
          root.__browserActTabFocus = active instanceof HTMLElement ? active : null;
          return true;
        })()`,
    });
}

async function ensureTabTraversal(ctx: Context, session: string, direction: 1 | -1): Promise<{ moved: boolean; tag: string; id: string; label: string }> {
    const value = await ctx.fns.browser.evaluate({
        session,
        expression: `(() => {
          const root = globalThis;
          const before = root.__browserActTabFocus;
          delete root.__browserActTabFocus;
          const describe = el => ({
            tag: String(el?.tagName || "").toLowerCase(),
            id: String(el?.id || ""),
            label: String(el?.getAttribute?.("aria-label") || el?.getAttribute?.("name") || el?.innerText || el?.value || "").replace(/\\s+/g, " ").trim().slice(0, 160)
          });
          if (document.activeElement && document.activeElement !== before) return { moved: true, ...describe(document.activeElement) };
          const selector = [
            "a[href]", "button:not([disabled])", "input:not([disabled]):not([type=hidden])",
            "select:not([disabled])", "textarea:not([disabled])", "summary", "[contenteditable=true]", "[tabindex]"
          ].join(",");
          const visible = el => {
            if (!(el instanceof HTMLElement)) return false;
            const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0 || rect.width <= 0 || rect.height <= 0) return false;
            const tabIndex = Number(el.getAttribute("tabindex") ?? el.tabIndex);
            return tabIndex >= 0 && el.getAttribute("aria-hidden") !== "true";
          };
          const items = Array.from(document.querySelectorAll(selector)).filter(visible);
          if (!items.length) return { moved: false, ...describe(document.activeElement) };
          const active = before instanceof HTMLElement ? before : document.activeElement;
          let index = items.indexOf(active);
          if (index < 0) index = ${direction > 0 ? -1 : 0};
          const next = items[(index + ${direction} + items.length) % items.length];
          next.focus({ preventScroll: false });
          return { moved: document.activeElement === next, ...describe(document.activeElement) };
        })()`,
    });
    return {
        moved: Boolean(value?.moved),
        tag: String(value?.tag ?? ""),
        id: String(value?.id ?? ""),
        label: String(value?.label ?? ""),
    };
}


async function dispatchKey(ctx: Context, session: string, input: string): Promise<void> {
    const parts = String(input || "").split("+").map(part => part.trim()).filter(Boolean);
    if (!parts.length) throw new ActionError("INVALID_KEY", "press action requires a key");
    const key = parts.pop()!;
    const modifierMap: Record<string, number> = { alt: 1, control: 2, ctrl: 2, meta: 4, command: 4, shift: 8 };
    const modifiers = parts.reduce((mask, modifier) => mask | (modifierMap[modifier.toLowerCase()] ?? 0), 0);
    const normalized = keyName(key);
    const params: Record<string, any> = {
        key: normalized.key,
        code: normalized.code,
        windowsVirtualKeyCode: normalized.keyCode,
        nativeVirtualKeyCode: normalized.keyCode,
        modifiers,
    };
    if (normalized.text && !(modifiers & (1 | 2 | 4))) params.text = normalized.text;
    const keyEventType = normalized.text && !(modifiers & (1 | 2 | 4)) ? "keyDown" : "rawKeyDown";
    await ctx.fns.cdp.send({ session, method: "Input.dispatchKeyEvent", params: { ...params, type: keyEventType } });
    await ctx.fns.cdp.send({ session, method: "Input.dispatchKeyEvent", params: { ...params, type: "keyUp", text: undefined } });
}

function keyName(input: string): { key: string; code: string; keyCode: number; text?: string } {
    const aliases: Record<string, { key: string; code: string; keyCode: number }> = {
        enter: { key: "Enter", code: "Enter", keyCode: 13 },
        tab: { key: "Tab", code: "Tab", keyCode: 9 },
        escape: { key: "Escape", code: "Escape", keyCode: 27 },
        esc: { key: "Escape", code: "Escape", keyCode: 27 },
        backspace: { key: "Backspace", code: "Backspace", keyCode: 8 },
        delete: { key: "Delete", code: "Delete", keyCode: 46 },
        arrowup: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
        arrowdown: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
        arrowleft: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
        arrowright: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
        home: { key: "Home", code: "Home", keyCode: 36 },
        end: { key: "End", code: "End", keyCode: 35 },
        pageup: { key: "PageUp", code: "PageUp", keyCode: 33 },
        pagedown: { key: "PageDown", code: "PageDown", keyCode: 34 },
        space: { key: " ", code: "Space", keyCode: 32 },
    };
    const alias = aliases[input.toLowerCase()];
    if (alias) return alias;
    if (input.length !== 1) throw new ActionError("INVALID_KEY", `unsupported key ${input}`);
    const upper = input.toUpperCase();
    const code = /[A-Za-z]/.test(input) ? `Key${upper}` : /\d/.test(input) ? `Digit${input}` : input;
    return { key: input, code, keyCode: upper.charCodeAt(0), text: input };
}

async function pageMeta(ctx: Context, session: string): Promise<{ url: string; title: string }> {
    try {
        const value = await ctx.fns.browser.evaluate({ session, expression: "({ url: location.href, title: document.title })" });
        return { url: String(value?.url ?? ""), title: String(value?.title ?? "") };
    } catch {
        return { url: "", title: "" };
    }
}

function locatorException(details: any): ActionError {
    const message = String(details?.exception?.description || details?.text || "target resolution failed");
    if (message.includes("TARGET_AMBIGUOUS:")) return new ActionError("TARGET_AMBIGUOUS", message.split("TARGET_AMBIGUOUS:").pop()!.trim(), false, "use a snapshot ref or a more specific target");
    if (message.includes("TARGET_NOT_FOUND:")) return new ActionError("TARGET_NOT_FOUND", message.split("TARGET_NOT_FOUND:").pop()!.trim(), true);
    if (message.includes("INVALID_SELECTOR:")) return new ActionError("INVALID_SELECTOR", message.split("INVALID_SELECTOR:").pop()!.trim());
    return new ActionError("TARGET_RESOLUTION_FAILED", message);
}

function pageActionException(message: string): ActionError {
    for (const code of ["INVALID_FILL_TARGET", "INVALID_SELECT_TARGET", "OPTION_NOT_FOUND", "INVALID_SELECT_VALUE", "INVALID_CHECK_TARGET", "INVALID_CHECK_VALUE"]) {
        if (message.includes(`${code}:`)) return new ActionError(code, message.split(`${code}:`).pop()!.trim());
    }
    return new ActionError("ACTION_FAILED", message);
}

function asActionError(error: any): ActionError {
    if (error instanceof ActionError) return error;
    return new ActionError("ACTION_FAILED", String(error?.message ?? error));
}

function normalizeFailure(error: any, index: number, kind: string): ActionFailure {
    const normalized = asActionError(error);
    return {
        index,
        kind,
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
        ...(normalized.hint ? { hint: normalized.hint } : {}),
    };
}

async function inMutationQueue<T>(ctx: Context, session: string, run: () => Promise<T>): Promise<T> {
    const state = ((ctx.state as any).browserAct ??= { queues: new Map() });
    const queues: Map<string, Promise<void>> = (state.queues ??= new Map());
    const previous = queues.get(session) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const tail = previous.catch(() => {}).then(() => gate);
    queues.set(session, tail);
    await previous.catch(() => {});
    try {
        return await run();
    } finally {
        release();
        if (queues.get(session) === tail) queues.delete(session);
    }
}

function clamp(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
    const number = Number(value ?? fallback);
    return Math.max(minimum, Math.min(Number.isFinite(number) ? Math.floor(number) : fallback, maximum));
}

function mouseButtonMask(button: "left" | "middle" | "right"): number {
    return button === "left" ? 1 : button === "right" ? 2 : 4;
}


function finite(value: number | undefined, fallback: number): number {
    const number = Number(value ?? fallback);
    return Number.isFinite(number) ? number : fallback;
}

function clean(value: unknown): string {
    return String(value ?? "").trim();
}
