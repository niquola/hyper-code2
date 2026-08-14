/**
 * Renders a task detail page.
 *
 * @param ctx - Runtime context used to load the task and escape HTML.
 * @param _session - Unused request session.
 * @param opts - HTTP route options.
 * @param opts.req - Incoming request (currently unused).
 * @param opts.params - Route parameters containing the task identifier.
 * @returns The task HTML response or a 404 response.
 */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const task = await ctx.fns.tasks.get({ id: opts.params.id! });
    if (!task) return new Response('Not found', { status: 404 });
    const esc = (value: unknown) => ctx.fns.procs.ui.escape({ text: String(value ?? '') });
    const lines = task.description.split(/\r?\n/);
    const titleIndex = lines.findIndex((line) => line.trim());
    const title = titleIndex >= 0 ? lines[titleIndex]!.trim() : 'Untitled task';
    const body = lines.slice(titleIndex + 1).join('\n').trim();
    const isDone = task.status === 'done';
    const stateBadge = isDone
        ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-sm font-medium text-white"><i class="ph ph-check"></i>Closed</span>'
        : `<span class="inline-flex items-center gap-1.5 rounded-full ${task.status === 'running' ? 'bg-amber-600' : 'bg-green-600'} px-3 py-1 text-sm font-medium text-white"><i class="ph ph-dot-outline"></i>${task.status === 'running' ? 'In progress' : 'Open'}</span>`;
    const statusAction = (status: 'todo' | 'running' | 'done', label: string, icon: string) => `<button name="status" value="${status}" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${task.status === status ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700 hover:bg-gray-100'}"><i class="ph ${icon}"></i>${label}${task.status === status ? '<i class="ph ph-check ml-auto"></i>' : ''}</button>`;
    return {
        title,
        main: `<main class="mx-auto w-full max-w-5xl px-5 py-7">
          <a href="/tasks" class="mb-5 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><i class="ph ph-arrow-left"></i>Back to tasks</a>
          <header class="border-b border-gray-300 pb-5">
            <h1 class="break-words text-3xl font-normal leading-tight text-gray-900">${esc(title)} <span class="font-light text-gray-400">#${esc(task.id.slice(0, 8))}</span></h1>
            <div class="mt-3 flex items-center gap-2">${stateBadge}<span class="text-sm text-gray-500">created ${esc(new Date(Number(task.createdAt)).toLocaleString())}</span></div>
          </header>

          <div class="mt-6 grid gap-7 md:grid-cols-[minmax(0,1fr)_260px]">
            <section class="min-w-0">
              <div class="flex gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 font-semibold text-white"><i class="ph ph-robot"></i></div>
                <div class="min-w-0 flex-1 overflow-hidden rounded-md border border-gray-300 bg-white">
                  <div class="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600"><strong class="text-gray-900">Task</strong> described this work</div>
                  <div class="min-h-32 whitespace-pre-wrap break-words px-4 py-4 text-sm leading-6 text-gray-800">${esc(body || title)}</div>
                </div>
              </div>

              <div class="ml-5 mt-4 h-8 border-l-2 border-gray-200"></div>
              <div class="flex gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${task.agentId ? 'bg-blue-600' : 'bg-gray-300'} text-white"><i class="ph ph-chat-circle"></i></div>
                <div class="flex-1 rounded-md border border-gray-300 bg-white p-4">
                  ${task.agentId
                    ? `<div class="flex flex-wrap items-center justify-between gap-3"><div><p class="font-semibold text-gray-900">Agent chat ${esc(task.agentId)}</p><p class="mt-1 text-sm text-gray-500">Workspace: <code class="rounded bg-gray-100 px-1 py-0.5 text-xs">${esc(task.workspaceDir)}</code></p></div><a href="/agent/${encodeURIComponent(task.agentId)}" class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-gray-50"><i class="ph ph-arrow-square-out mr-1"></i>Open chat</a></div>`
                    : `<div class="flex flex-wrap items-center justify-between gap-3"><div><p class="font-semibold text-gray-900">No agent started</p><p class="mt-1 text-sm text-gray-500">Start a dedicated chat in the selected workspace.</p></div><form method="POST" action="/tasks/${encodeURIComponent(task.id)}/start"><button class="rounded-md border border-green-700 bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"><i class="ph ph-play mr-1"></i>Start agent</button></form></div>`}
                </div>
              </div>
            </section>

            <aside class="space-y-5 text-sm">
              <section><h2 class="mb-2 border-b border-gray-200 pb-2 font-semibold text-gray-700">Status</h2><form method="POST" action="/tasks/${encodeURIComponent(task.id)}/status" class="space-y-1">${statusAction('todo', 'Open', 'ph-dot-outline')}${statusAction('running', 'In progress', 'ph-spinner')}${statusAction('done', 'Closed', 'ph-check-circle')}</form></section>
              <section><h2 class="mb-2 border-b border-gray-200 pb-2 font-semibold text-gray-700">Workspace</h2><p class="text-gray-600"><i class="ph ph-folder mr-1"></i>${esc(task.workspaceMode === 'isolated' ? 'Isolated' : 'Shared')}</p><p class="mt-1 break-all text-xs text-gray-500">${esc(task.workspaceDir || (task.workspaceMode === 'isolated' ? '~/.hyper/tasks/<task-id>' : '~/.hyper/tasks'))}</p></section>
              <section><h2 class="mb-2 border-b border-gray-200 pb-2 font-semibold text-gray-700">Development</h2><p class="text-gray-600"><i class="ph ph-chat-circle mr-1"></i>${task.agentId ? `<a href="/agent/${encodeURIComponent(task.agentId)}" class="text-blue-600 hover:underline">Attached chat</a>` : 'No chat yet'}</p></section>
            </aside>
          </div>
        </main>`,
    };
}
