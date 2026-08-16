// The agent chat as ONE self-contained column (header + transcript + composer),
// rendered by the layout into the left panel — the workspace pattern: the chat
// is harness, pages on the right are product. Extracted from the old
// /agent/:id page; the long-poll (#msg-tail), statusbar poll and chat.js
// behaviors are unchanged.
/** Performs the ui.chatColumn runtime operation. */
/**
 * The agent chat as ONE self-contained column (header + transcript + composer),.
 * @param opts.agentId Target agent identifier.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Identifier of the agent whose scoped setting is used. */ agentId: string }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const id = opts.agentId;

    // Entering the chat IS reading it: move the seen watermark before the page
    // ships, so the rail (which fetches itself right after load) already sees
    // zero unread — no badge lingering for a refresh cycle. The events.html
    // poll keeps moving it while the chat stays open.
    await ctx.fns.procs.db.run({
        sql: `INSERT INTO kv (key, value)
              SELECT 'seen:' || ?, COALESCE(MAX(idx), -1)::text FROM messages WHERE agent_id = ?
              ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        params: [id, id],
    }).catch(() => { /* a lingering badge, not a broken page */ });
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = (await ctx.fns.session?.load?.({ id })) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return `<div class="p-4 text-sm text-base-content/45">agent ${esc(id)} not found</div>`;

    const maxIdx = await ctx.fns.session.getMaxEventIdx({ id });
    const events = await ctx.fns.session.getEvents({ id, beforeIdx: maxIdx + 1, limit: 100 });
    const inheritedCount = agent.parentId
        ? (await ctx.fns.session.getFullMessages({ id })).length - (await ctx.fns.session.getMessages({ id })).length
        : 0;

    const historyHead = events.length && Number(events[0]?.idx ?? 0) > 0
        ? `<div id="msg-head" hx-get="/agent/${encodeURIComponent(id)}/events.html?before=${Number(events[0].idx)}&limit=100" hx-trigger="load-older" hx-target="this" hx-swap="outerHTML" class="flex justify-center py-1"><button type="button" onclick="htmx.trigger(this.parentElement, 'load-older')" class="rounded-full border border-ui-border bg-base-100 px-3 py-1 text-[10px] text-base-content/45 hover:text-base-content/65">older messages</button></div>`
        : '';
    const activeSleepForView = ctx.fns.agent.getSleepGeneration({ sleepContext: agent.sleepContext, kind: "active" });
    const eventsHtml = activeSleepForView
        ? await ctx.fns.agent.renderSleepContextHtml({ sleepContext: agent.sleepContext!, events, agentId: id })
        : await ctx.fns.agent.renderEventsHtml({ events, agentId: id });
    const lastEvent = ((await ctx.fns.procs.db.select({
        sql: 'SELECT payload FROM events WHERE agent_id = ? AND type = \'assistant\' ORDER BY idx DESC LIMIT 1',
        params: [id],
    })) as any[])[0];
    const lastUsage = lastEvent ? JSON.parse(lastEvent.payload).usage : null;
    const statusBarHtml = await ctx.fns.agent.renderStatusBar({ agentId: id, initialUsage: lastUsage });
    const stopControlHtml = await ctx.fns.agent.renderStatusBar({ agentId: id, part: 'stop' });
    const stopControlRegion = ctx.fns.ui.live({
        id: 'chat-stop-control',
        url: `/agent/${encodeURIComponent(id)}/statusbar?part=stop`,
        topic: `agent:${id}`,
        every: 5,
        swap: 'innerHTML',
        attrs: 'class="pointer-events-none absolute inset-y-0 right-1.5 z-50 flex items-center [&>button]:pointer-events-auto"',
        html: stopControlHtml,
    });

    const reflectionHtml = await ctx.fns.ui.reflectionDropdown({ agent });
    // Switching and creating agents live in the rail on the far left — the
    const sleep = ctx.fns.agent.normalizeSleepContext({ sleepContext: agent.sleepContext });
    const activeSleep = sleep ? ctx.fns.agent.getSleepGeneration({ sleepContext: sleep, kind: "active" }) : null;
    const draftSleep = sleep ? ctx.fns.agent.getSleepGeneration({ sleepContext: sleep, kind: "draft" }) : null;
    const shownSleep = draftSleep ?? activeSleep;
    const sleepState = shownSleep?.state ?? {};
    const fullCount = (await ctx.fns.session.getFullMessages({ id })).length;
    const tailCount = activeSleep ? Math.max(0, fullCount - Number(activeSleep.sourceOffset ?? 0)) : 0;
    const sleepControl = sleep && shownSleep ? await ctx.fns.ui.inplacePopup({
        id: `sleep-popover-${id}`,
        triggerHtml: `<i class="ph ${sleep.mode === 'compact' ? 'ph-moon-stars' : 'ph-moon'}"></i>${draftSleep ? `<span class="ml-0.5 rounded-full bg-amber-100 px-1 text-[9px] text-amber-700">v${draftSleep.revision}</span>` : ''}`,
        triggerAttrs: `class="px-1 ${sleep.mode === 'compact' ? 'text-indigo-600' : 'text-amber-500'} hover:text-indigo-700" title="${sleep.mode === 'compact' ? `compact v${sleep.activeRevision} · tail ${tailCount}` : `sleep draft v${sleep.draftRevision ?? shownSleep.revision}`}" aria-label="Sleep context"`,
        panelAttrs: 'aria-label="Sleep context"',
        contentHtml: `<div class="font-medium text-base-content/80">${sleep.mode === 'compact' ? `Active v${sleep.activeRevision} · tail ${tailCount}` : 'Full history active'}${draftSleep ? ` · draft v${draftSleep.revision} ready` : ''}</div>
        <div class="mt-2 text-base-content/65">${esc(sleepState.situation ?? 'No situation summary')}</div>
        ${sleepState.nextStep ? `<div class="mt-2 text-base-content/55"><span class="font-medium">Next:</span> ${esc(sleepState.nextStep)}</div>` : ''}
        ${(sleepState.openWork ?? []).length ? `<div class="mt-3 border-t border-gray-100 pt-2 font-medium text-base-content/70">Open work</div><ul class="mt-1 list-disc space-y-1 pl-4 text-base-content/55">${sleepState.openWork.slice(0, 5).map((x: any) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="mt-3 flex flex-wrap gap-2">${draftSleep ? `<form hx-post="/agent/${encodeURIComponent(id)}/sleep" hx-swap="none"><input type="hidden" name="action" value="activate"><input type="hidden" name="revision" value="${draftSleep.revision}"><button class="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700">Use draft v${draftSleep.revision}</button></form>` : ''}${sleep.mode === 'compact' ? `<form hx-post="/agent/${encodeURIComponent(id)}/sleep" hx-swap="none"><input type="hidden" name="action" value="deactivate"><button class="rounded border border-ui-border px-2 py-1 text-xs text-base-content/65">Show full history</button></form>` : ''}<form hx-post="/agent/${encodeURIComponent(id)}/sleep" hx-swap="none"><input type="hidden" name="action" value="prepare"><button class="rounded border border-ui-border px-2 py-1 text-xs text-base-content/55">Build next draft</button></form></div>`,
    }) : `<form hx-post="/agent/${encodeURIComponent(id)}/sleep" hx-swap="none" class="inline"><input type="hidden" name="action" value="prepare"><button title="prepare compact sleep context" class="px-1 text-base-content/45 hover:text-indigo-700"><i class="ph ph-bed"></i></button></form>`;
    // Use the same turn/TTL calculation as the LLM request builder, so the UI
    // shows exactly the reflection instruction that is currently injected.
    const activeInstructions = await ctx.fns.agent.statusLineForTurn({ agent });
    const reflectionNudge = activeInstructions
        .split('\n')
        .find((line: string) => line.startsWith('Reflection nudge: '))
        ?.slice('Reflection nudge: '.length) ?? '';
    const compactPopup = await ctx.fns.ui.inplacePopup({
        id: `compact-popover-${id}`,
        triggerHtml: '<i class="ph ph-arrows-in-line-vertical"></i>',
        triggerAttrs: 'class="px-1 text-base-content/45 hover:text-indigo-600" title="Compact context" aria-label="Compact context"',
        panelAttrs: 'aria-label="Compact context"',
        contentHtml: `<form hx-post="/agent/${encodeURIComponent(id)}/compact" hx-swap="none"><div class="text-sm font-medium">Compact context</div><textarea name="instructions" rows="3" placeholder="Optional focus instructions" class="mt-2 w-full rounded border border-ui-border bg-base-100 p-2 text-xs"></textarea><button type="submit" class="mt-2 rounded bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-700">Compact</button></form>`,
    });

    // header names THIS agent and holds its controls, nothing more.
    return `
<header class="glass-bar absolute inset-x-0 top-0 z-40 mx-auto mt-2 flex h-11 w-[calc(100%-2rem)] max-w-3xl shrink-0 items-center gap-2.5 overflow-visible rounded-[22px] border border-ui-border pl-2 pr-5 text-xs text-base-content/70">
  <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-base-100/25 text-base-content/65">${ctx.fns.ui.modelLogo({ model: agent.model, bare: true })}</span>
  <span class="font-mono font-medium text-base-content/80">${esc(String(agent.title ?? id).slice(0, 40) || id)} <span class="text-base-content/45">(${esc(id)})</span></span>
  ${agent.parentId ? `<span class="text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5" title="fork · inherited ${inheritedCount} msgs">fork</span>` : ""}
  ${statusBarHtml}
  <span class="ml-auto flex items-center gap-1">
  ${reflectionHtml}
    ${compactPopup}

    ${sleepControl}

    ${ctx.fns.ui.popup({ method: 'agent.initialPromptPopup', params: { agentId: id }, html: '<i class="ph ph-scroll" aria-hidden="true"></i>', attrs: 'title="Initial prompt" aria-label="Initial prompt" class="px-1 text-base-content/45 hover:text-indigo-600"' })}

    <form method="POST" action="/agent/${encodeURIComponent(id)}/fork" hx-boost="false" class="inline">
      <button type="submit" title="fork and open" aria-label="Fork and open agent" ${ctx.fns.procs.ui.attr({ action: "fork", entity: "agent", id })} class="px-1 text-base-content/45 transition hover:text-indigo-600"><i class="ph ph-git-fork" aria-hidden="true"></i></button>
    </form>

    <a href="/agent/${encodeURIComponent(id)}" hx-boost="false" title="agent page" class="px-1 text-base-content/45 hover:text-base-content/70">ⓘ</a>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/archive" hx-boost="false" class="inline">
      <button title="archive — hides from the rail, keeps the transcript" ${ctx.fns.procs.ui.attr({ action: "archive", entity: "agent", id })}
        class="px-1 text-base-content/45 hover:text-base-content/70"><i class="ph ph-archive"></i></button>
    </form>
    <form method="POST" action="/agent/${encodeURIComponent(id)}/delete" hx-boost="false" class="inline" onsubmit="return confirm('delete ${esc(id)}? The transcript goes with it.')">
      <button title="delete" ${ctx.fns.procs.ui.attr({ action: "delete", entity: "agent", id })}
        class="px-1 text-base-content/45 hover:text-red-600"><i class="ph ph-trash"></i></button>
    </form>
  </span>
</header>
<div id="messages" data-agent-id="${esc(id)}" data-inherited-count="${inheritedCount}" style="overflow-anchor:none" class="chat-dot-grid flex-1 overflow-y-auto px-3 py-3 space-y-2">${historyHead}${eventsHtml}
${agent.sleepContext?.active === true
  ? `<div id="msg-tail" hx-get="/agent/${encodeURIComponent(id)}/events.html?offset=${maxIdx + 1}&compact=1" hx-trigger="load" hx-target="this" hx-swap="outerHTML"></div>`
  : `<div id="msg-tail" hx-get="/agent/${encodeURIComponent(id)}/events.html?offset=${maxIdx + 1}" hx-trigger="load" hx-target="this" hx-swap="outerHTML"></div>`}
</div>
<form id="form"
      ${ctx.fns.procs.ui.attr({ form: "chat" })}
      class="chat-composer mx-auto w-[calc(100%-2rem)] max-w-3xl pb-2 pt-3"
      hx-post="/agent/${encodeURIComponent(id)}?debounceSeconds=0.1"
      hx-trigger="submit"
      hx-swap="none"
      hx-on::after-request="if (event.detail.elt === this && event.detail.successful) { this.elements.input.value=''; this.elements.input.focus(); }">
  <div class="relative h-11 w-full">
    ${stopControlRegion}
    <textarea id="input" name="text" rows="1" placeholder="Message agent…"
      class="glass-input block h-11 w-full resize-none overflow-y-auto rounded-[22px] border-0 px-4 py-[11px] font-sans text-sm leading-[22px] text-base-content placeholder:text-base-content/35 focus:outline-none"></textarea>
  </div>
  <div class="mt-1.5 text-center text-[10px] leading-none text-base-content/35"><kbd>⌘J</kbd> scroll down · <kbd>⌘K</kbd> scroll up · Enter to send</div>
</form>
<div class="border-t border-ui-border bg-base-200 px-3 py-1.5 text-[11px] text-base-content/45">
  <details class="group">
    <summary class="cursor-pointer list-none truncate hover:text-base-content/65" title="Edit status line"><i class="ph ph-note-pencil"></i> ${agent.statusLine ? esc(agent.statusLine) : 'add status line…'}${agent.statusLine && Number(agent.statusLineEvery ?? 1) > 1 ? ` · every ${Number(agent.statusLineEvery)} turns` : ''}</summary>
    <form hx-post="/agent/${encodeURIComponent(id)}/status-line" hx-swap="none" class="mt-2 flex items-end gap-2 pb-1">
      <label class="min-w-0 flex-1">Instruction
        <input name="text" maxlength="500" value="${esc(agent.statusLine ?? '')}" placeholder="Answer briefly and to the point…" class="mt-1 w-full rounded border border-ui-border bg-base-100 px-2 py-1 text-xs text-base-content/70">
      </label>
      <label class="w-20">Every
        <input name="every" type="number" min="1" max="100" value="${Math.max(1, Number(agent.statusLineEvery ?? 1))}" class="mt-1 w-full rounded border border-ui-border bg-base-100 px-2 py-1 text-xs text-base-content/70">
      </label>
      <button class="rounded border border-ui-border bg-base-100 px-2 py-1 text-xs text-base-content/65 hover:bg-base-200">save</button>
    </form>
  </details>
</div>
  ${reflectionNudge ? `<div class="flex items-start gap-2 border-t border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] leading-4 text-violet-700" title="Active reflection instruction"><i class="ph ph-brain mt-0.5 shrink-0" aria-hidden="true"></i><span class="min-w-0 flex-1">${esc(reflectionNudge)}</span><button hx-post="/agent/${encodeURIComponent(id)}/reflection-nudge/delete" hx-target="closest div" hx-swap="outerHTML" title="Dismiss reflection nudge" aria-label="Dismiss reflection nudge" class="-mr-1 -mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded text-violet-400 hover:bg-violet-100 hover:text-violet-700"><i class="ph ph-x"></i></button></div>` : ''}

`;
}
