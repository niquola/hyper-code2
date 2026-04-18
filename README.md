# hyper-code2

Процедурный TypeScript для AI-агента: функции, данные, REPL. Никаких классов, DI, middleware-цепочек.

Вдохновлено [proc-ts](../proc-ts/README.md), приспособлено под Bun и типизацию через автогенерацию `ctx_ns.d.ts`.

## Быстрый старт

```bash
bun install
tmux new-session -d -s hyper 'bun src/\$main.ts'
bun script/repl.ts '1 + 1'                        # → { success: true, result: 2 }
curl http://localhost:3000/                        # → index.html
```

Порт пишется в `.hyper/port` при старте — `script/repl.ts` читает его оттуда.

## Конвенции

### Функции — одна функция на файл

```
src/
  db/
    $start.ts           → ctx.fns.db.start(ctx)
    query.ts            → ctx.fns.db.query(ctx, sql)
    execute.ts          → ctx.fns.db.execute(ctx, sql)
  server/
    $start.ts           → ctx.fns.server.start(ctx)
    match.ts            → ctx.fns.server.match(routes, method, pathname)
  genTypes.ts           → ctx.genTypes(ctx)           # корневой файл → ctx.<name>
  $main.ts              # entrypoint, не попадает в ctx
```

- `<module>/<fn>.ts` → `ctx.fns.<module>.<fn>`
- `<fn>.ts` в корне → `ctx.<fn>`
- Префикс `$` в имени файла отрезается (`$start.ts` → `ctx.fns.<mod>.start`)
- `export default` — **без имени функции**: `export default async function (ctx: Context) { ... }`

### Routes — через файловую конвенцию

`<module>/$route_<path>_<METHOD>.ts`, где `_` = `/`, `$x` = `:x`.

| Файл | Route |
|------|-------|
| `src/$route_GET.ts` | `GET /` |
| `src/repl/$route__POST.ts` | `POST /repl` |
| `src/ping/$route_$id_GET.ts` | `GET /ping/:id` |

Handler: `export default async function (ctx: Context, session: any, req: Request) { ... }`
Параметры пути — в `req.params`.

Routes собирает `ctx.fns.http.loadRoutes(ctx)` в `ctx.routes: { [path]: { [METHOD]: handler } }`.

### Типы — глобальные, через `$type_` + автогенерацию

Типы пишутся в файлах `$type_<Name>.ts` и автоматически появляются в глобальном пространстве имён:

- `src/$type_Context.ts` → глобальный `Context`
- `src/<module>/$type_<Name>.ts` → `types.<module>.<Name>`

```ts
// src/session/$type_Session.ts
export type Session = {
    id: string;
    options: types.session.SessionOptions;       // из session/$type_SessionOptions.ts
};
```

Функция `ctx.genTypes(ctx)` сканирует `**/$type_*.ts` + все файлы функций и генерит `src/ctx_ns.d.ts`:

```ts
declare global {
    type Context = import("./$type_Context").Context;

    interface FnsRegistry {
        db: {
            start: typeof import("./db/$start").default;
            query: typeof import("./db/query").default;
            execute: typeof import("./db/execute").default;
        };
        // ...
    }
    interface RootFns {
        genTypes: typeof import("./genTypes").default;
    }
    namespace types {
        namespace session {
            type Session = import("./session/$type_Session").Session;
            type SessionOptions = import("./session/$type_SessionOptions").SessionOptions;
        }
    }
}
export {};
```

А `$type_Context.ts` композится из сгенерированных интерфейсов:

```ts
export type Context = RootFns & {
    env: Record<string, string | undefined>;
    state: Record<string, any>;
    routes: Record<string, Record<string, Function>>;
    fns: FnsRegistry;
};
```

Итог:
- Все функции пишутся с `(ctx: Context, ...)` — без импортов
- Опечатка `ctx.fns.ups` → compile error
- `ctx.fns.db.query` — полная сигнатура из реального файла
- `types.session.Session` — доступен глобально

### Динамический роутинг

Сервер использует `Bun.serve({ fetch })` вместо `Bun.serve({ routes })`:

```ts
async fetch(req) {
    const url = new URL(req.url);
    const m = ctx.fns.server.match(ctx.routes, req.method, url.pathname);
    if (!m) return new Response("Not Found", { status: 404 });
    (req as any).params = m.params;
    return m.handler(ctx, null, req);
}
```

Мутации `ctx.routes` подхватываются на следующем запросе — `server.reload()` не нужен. Цена — линейный матчер (`server/match.ts`) вместо нативного uWebSocket-дерева Bun-а. На десятках роутов разницы нет.

## REPL-воркфлоу

Сервер держит state между изменениями. Код вычисляется внутри процесса.

```bash
# произвольный код — единственный биндинг это ctx
bun script/repl.ts '1 + 1'
bun script/repl.ts 'Object.keys(ctx.fns)'
bun script/repl.ts 'await ctx.fns.db.query(ctx, "SELECT 1")'

# горячая перезагрузка функций
bun script/repl.ts 'await ctx.fns.repl.load(ctx, "db.query")'    # одна функция
bun script/repl.ts 'await ctx.fns.repl.load(ctx, "db")'          # вся папка

# добавить route на лету (без файла)
bun script/repl.ts 'ctx.routes["/foo"] = { GET: () => new Response("hi") }; return "ok"'
```

После изменения структуры файлов (новый модуль/функция/тип) — регенерируй типы:

```bash
bun script/repl.ts 'return await ctx.genTypes(ctx)'
```

## Entrypoint

`src/$main.ts` делает один проход:

```ts
const ctx = { env, state: {}, fns: {}, routes: {} } as Context;
await loadFns(ctx);             // src/**/*.ts → ctx.fns.*.* и ctx.*
await ctx.genTypes(ctx);        // регенерация src/ctx_ns.d.ts
await ctx.fns.http.loadRoutes(ctx);  // src/**/$route_*.ts → ctx.routes
await ctx.fns.server.start(ctx);     // Bun.serve с fetch → ctx.fns.server.match
```

## Тесты

```bash
bun test                                    # все тесты
bun test ./src/repl/\$test.ts               # один файл
```

## Type-check

```bash
bunx tsc --noEmit
```

- `ctx.fns.boom` → error (нет в `FnsRegistry`)
- `ctx.fns.db.bum` → error (нет в `db`)
- `ctx.fns.db.query(ctx, 123)` → error (`query` ожидает `string`)

## Что НЕ используем

- Никакого `import { ... } from "..."` между модулями — всё через `ctx`
- Никаких классов, DI-контейнеров, middleware-цепочек
- `export default` — **без имён функций**
- `Bun.serve({ routes: ... })` — взамен `fetch` + свой matcher для динамики

## Архитектура

```
src/
  $main.ts              — entrypoint: load fns → genTypes → loadRoutes → server.start
  $route_GET.ts         — GET /
  $type_Context.ts      — глобальный Context
  genTypes.ts           — ctx.genTypes: сканит src, генерит ctx_ns.d.ts
  ctx_ns.d.ts           — АВТОГЕН: FnsRegistry, RootFns, types.*

  db/
    $start.ts / query.ts / execute.ts

  server/
    $start.ts           — Bun.serve с dynamic dispatch через server.match
    match.ts            — линейный matcher path + params

  http/
    loadRoutes.ts       — сканит $route_*.ts → ctx.routes

  repl/
    eval.ts             — new Function("ctx", code), expression | statement
    load.ts             — горячая перезагрузка функции / папки
    $route__POST.ts     — POST /repl
    $test.ts            — test для eval

  session/
    start.ts / save.ts
    $type_Session.ts / $type_SessionOptions.ts

script/
  repl.ts               — CLI клиент: читает .hyper/port, шлёт POST /repl
```
