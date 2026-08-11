# Tool-call протоколы: OpenAI, Anthropic, Kimi

Исследование нативных tool-call протоколов трёх провайдеров: wire-форматы, streaming, strict-режимы, параллельные вызовы, кэширование и грабли. Источники: официальные доки, адаптеры pi-agent (`~/tmp/pi-agent/packages/ai/src/api/*` — боевой код, который гоняет все три протокола), наш собственный опыт (`src/llm/stream*.ts`, бенчи в `scratchpad/ab/`).

Компаньон: `~/docs/research/toolcall-formats.md` (академическая часть — Bitter Lesson, NLT, Format Tax) и результаты нашего A/B-бенча (markers vs JSON, gpt-5.4 / gpt-5.6-sol).

---

## 1. OpenAI

У OpenAI **два живых протокола** — Chat Completions (стандарт де-факто, все его копируют) и Responses API (преемник, item-ориентированный).

### 1.1 Chat Completions (классика)

**Запрос:**
```jsonc
{
  "tools": [{ "type": "function", "function": {
    "name": "read_file",
    "description": "...",
    "parameters": { /* JSON Schema */ },
    "strict": true            // constrained decoding
  }}],
  "tool_choice": "auto",       // auto | none | required | {type:"function",function:{name}}
  "parallel_tool_calls": true
}
```

**Ответ:** assistant-сообщение с `tool_calls: [{id: "call_*", type: "function", function: {name, arguments: "<json-строка>"}}]`, `finish_reason: "tool_calls"`. Результат возвращается как отдельное сообщение `role: "tool"` + `tool_call_id` — по одному на каждый вызов.

**Streaming:** `delta.tool_calls[]` c полем `index` — аргументы прилетают кусками JSON-строки, клиент конкатенирует по index (см. `openai-completions.ts:521` в pi). `arguments` — это строка, парсить её надо самому и она *может* быть невалидным JSON (без strict).

**Strict mode:** `strict: true` включает constrained decoding через structured outputs — модель физически не может сгенерить токен вне схемы. Требования: `additionalProperties: false` на каждом объекте, все поля в `required` (опциональность — через `["string","null"]`). Первый вызов каждой схемы платит latency за компиляцию грамматики. OpenAI рекомендует strict всегда; **parallel + strict теперь совместимы** (с 2025; исключение — fine-tuned модели).

### 1.2 Responses API

Вместо messages — **items**. Вызов инструмента — отдельный item:
```jsonc
{ "type": "function_call", "call_id": "fc_*", "name": "read_file", "arguments": "{...}" }
```
Ответ клиента — item `{ "type": "function_call_output", "call_id", "output" }`. Никакого `role:"tool"` — плоский список items.

**Streaming-события** (semantic events, не сырые deltas): `response.output_item.added` → `response.function_call_arguments.delta` → `...arguments.done` → `response.output_item.done`. Удобнее Chat Completions: не надо самому склеивать по index.

**Custom tools** — уникальная фича: `{type: "custom"}` инструмент принимает **свободный текст** вместо JSON (`custom_tool_call` / `custom_tool_call_output`, события `custom_tool_call_input.delta/done`). Опционально ограничивается **грамматикой (CFG/Lark или regex)**. Это официальное признание, что JSON — не всегда лучший транспорт (наш вывод из бенча: escaping-hell в JSON модель проходит хуже, чем в raw-тексте).

**Состояние:** либо stateful через `previous_response_id`, либо stateless с полным реплеем items. При реплее **reasoning items надо возвращать как есть** — иначе ломается кэш и качество (Codex так и делает). Грабля из pi (`openai-responses-shared.ts:255`): id у custom-вызовов — `ctc_*`, а `function_call` item принимает только `fc_*` — при конвертации id надо выбрасывать.

**Наш опыт (streamCodex):** ChatGPT-подписочный endpoint (`chatgpt.com/backend-api/codex`) — это Responses API + обязательные заголовки `originator: codex_cli_rs`, `version: 0.146.0`; без них закрыты топ-модели (gpt-5.6-sol). Инструменты — `strict: true`, батч независимых вызовов в одном ответе — да (несколько `function_call` items), зависимая цепочка за один ответ — нет.

## 2. Anthropic

Один протокол — Messages API. Философия: tool-вызовы — это **типизированные блоки контента**, а не отдельный слой.

**Запрос:** `tools: [{name, description, input_schema}]` (схема называется `input_schema`, не `parameters`). `tool_choice: {type: "auto" | "any" | "tool" | "none"}` + флаг `disable_parallel_tool_use`.

**Ответ:** массив content-блоков; вызов — блок `{type: "tool_use", id: "toolu_*", name, input}` (input — уже **объект**, не строка!), `stop_reason: "tool_use"`. Параллельные вызовы = несколько `tool_use` блоков в одном ответе, вперемешку с `text` и `thinking` блоками.

**Результат:** следующее **user**-сообщение с блоками `{type: "tool_result", tool_use_id, content, is_error}`. Нет роли `tool` — результаты живут внутри user-хода. Все tool_result должны идти **в начале** user-сообщения.

**Streaming:** `content_block_start` (объявляет `tool_use` блок) → серия `input_json_delta` с `partial_json` → `content_block_stop`. По умолчанию сервер буферизует так, что префикс — валидный JSON. Beta `fine-grained-tool-streaming-2025-05-14` + пер-инструментный флаг `eager_input_streaming: true` (pi включает по умолчанию, `anthropic-messages.ts:1316`) отдаёт токены сразу — меньше latency на больших аргументах, но **можно получить невалидный/оборванный JSON** — клиент обязан это переживать.

**Strict:** `strict: true` пер-инструмент появился поздно (2026) и pi по умолчанию его **не** включает (`supportsStrictTools ?? false`) — совместимость поддерживают не все прокси (Bedrock/Vertex/копии API).

**Кэш:** явные `cache_control` breakpoints. Tools сериализуются **в начало префикса** (до system) — любое изменение списка инструментов инвалидирует весь кэш. Это главный налог протокола: 50+ инструментов = десятки килотокенов в каждом запросе (ответ Anthropic — Tool Search / dynamic discovery).

**Наши грабли (боевые, из hyper-code2):**
- 400 на пустой text-блок → `toAnthropicMessages` дропает пустые и склеивает соседние;
- 400 `final assistant content cannot end with trailing whitespace` → трим хвоста последнего assistant;
- thinking-блоки надо реплеить с их `signature`, иначе 400;
- interleaved thinking — отдельная beta `interleaved-thinking-2025-05-14` (в adaptive-моделях встроено).

## 3. Kimi (Moonshot)

Kimi интересен тем, что показывает **все три слоя** протокола сразу.

### 3.1 Нативный формат модели — спецтокены-маркеры

K2 обучен эмитить tool-вызовы прямо в тексте спецтокенами:

```
<|tool_calls_section_begin|>
<|tool_call_begin|> functions.get_weather:0 <|tool_call_argument_begin|> {"city": "Beijing"} <|tool_call_end|>
<|tool_call_begin|> functions.get_time:1 <|tool_call_argument_begin|> {"tz": "UTC+8"} <|tool_call_end|>
<|tool_calls_section_end|>
```

Id — `functions.{name}:{index}`; имя достаётся парсингом строки (`id.split('.')[1].split(':')[0]` — из официального гайда). Inference-движку (vLLM/SGLang) нужен специальный K2 tool-parser, чтобы поднять это в OpenAI-совместимый `tool_calls`. Официальная грабля: «`finish_reason` when tool calls end may vary across different engines». Рекомендованная температура — 0.6.

**Это структурно наш §-протокол**, только маркеры — выделенные токены словаря, а не текстовые последовательности, и обучение — RL на agentic-данных, а не системный промпт. Подтверждает вывод бенча: markers-in-text — полноценный первоклассный дизайн, а не хак.

### 3.2 Hosted API — OpenAI-диалект

`api.moonshot.ai/v1` — Chat Completions, работает родным OpenAI SDK (pi: `moonshotaiProvider` → `openAICompletionsApi()`, ноль специального кода). Плюс у Moonshot исторически есть **явный context-caching API** (создаёшь кэш, ссылаешься тегом) — в отличие от неявного префикс-кэша OpenAI.

### 3.3 Kimi For Coding — Anthropic-диалект

Подписочный coding-endpoint `api.kimi.com/coding` — **Anthropic Messages API**: pi гоняет его тем же `anthropicMessagesApi()` адаптером, что и Claude (так K2 подключается к Claude Code). Один вендор шипит оба диалекта поверх одного нативного токен-формата — сами диалекты стали commodity-обёртками.

## 4. Сводная таблица

| | OpenAI CC | OpenAI Responses | Anthropic | Kimi native |
|---|---|---|---|---|
| Вызов | `tool_calls[]` в assistant msg | `function_call` item | `tool_use` content-блок | спецтокены в тексте |
| Аргументы | JSON-**строка** | JSON-строка | JSON-**объект** | JSON-текст между токенами |
| Результат | `role:"tool"` msg | `function_call_output` item | `tool_result` блок в **user** msg | текст (движок решает) |
| Id | `call_*` | `fc_*` / `ctc_*` | `toolu_*` | `functions.name:idx` |
| Параллельные вызовы | да (массив) | да (items) | да (блоки) | да (секция) |
| Зависимая цепочка за 1 ответ | нет | нет | нет | нет |
| Strict/constrained | да, рекомендован | да + **CFG-грамматики** у custom tools | `strict` (2026, не везде) | нет (только обучение) |
| Свободный текст вместо JSON | нет | **custom tools** (ниша) | нет | нет — внутри маркеров всё равно JSON |
| Streaming аргументов | deltas по index | semantic events | `input_json_delta` (+eager beta) | сырые токены |
| Кэш | неявный префикс + `prompt_cache_key` | + реплей reasoning items | явный `cache_control`; tools = голова префикса | явный caching API (Moonshot) |

## 5. Выводы для hyper-code2

1. **Batch есть у всех, конвейера нет ни у кого.** Все три протокола умеют несколько *независимых* вызовов за ответ, но ни один — зависимую цепочку «выполни, возьми результат, выполни следующее» внутри одного ответа. Наш fail-fast chain (`§eval → §edit → §bash` в одном сообщении) — реальное отличие, оно экономит round-trips именно на цепочках (бенч: dependent-chain у markers 2 tool-turn'а против 4-5 у JSON).
2. **JSON — универсальный консенсус, различается только обёртка.** Аргументы у всех троих (включая Kimi: внутри `<|tool_call_argument_begin|>` лежит обычный JSON-объект) — это JSON; отличаются лишь контейнеры: поле сообщения / item / content-блок / спецтокены в потоке. Спецтокены K2 решают «где границы вызова», а не «в каком формате параметры». Единственное реальное исключение — OpenAI custom tools (свободный текст + опциональная CFG-грамматика), и это нишевая фича.

   Отсюда честная позиция нашего §-протокола: он отличается от всех троих не обёрткой, а тем, что **аргументы не JSON** — `§write:<path>` + сырое тело файла, `§eval` + сырой код. Это выигрыш на escaping-heavy задачах (бенч: A-full проходит escaping-hell, JSON платит двойным экранированием) и одновременно источник наших parse-ошибок. Custom tools у OpenAI — единственный намёк, что кто-то ещё считает эту нишу существующей.
3. **Strict у OpenAI бесплатен и решает format tax** — если делать `agent.protocol: "json"` режим (zero-infra вариант из бенча), включать `strict: true` обязательно.
4. **Anthropic — самый строгий валидатор транскрипта** (пустые блоки, trailing whitespace, порядок tool_result, реплей thinking-подписей) — любой адаптер обязан иметь санитайзер, как наш `toAnthropicMessages`.
5. **Стоимость инструментов в префиксе** — общая боль: у Anthropic tools стоят в голове кэша, у нас полный SYSTEM_PROMPT даёт ×8 nominal input в бенче. Prompt diet / progressive disclosure — тот же тренд, что Tool Search у Anthropic.

## Источники

- [OpenAI: Function calling](https://developers.openai.com/api/docs/guides/function-calling) · [Responses API tutorial (2026)](https://baeseokjae.github.io/posts/openai-responses-api-tutorial-2026/) · [Morph: OpenAI function calling guide](https://www.morphllm.com/openai-function-calling)
- [Anthropic: Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) · [Fine-grained tool streaming](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/fine-grained-tool-streaming) · [Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) · [Claude tool use: input_schema, stop_reason, parallel](https://renezander.com/guides/claude-api-tool-use/)
- [MoonshotAI/Kimi-K2: tool_call_guidance.md](https://github.com/MoonshotAI/Kimi-K2/blob/main/docs/tool_call_guidance.md) · [Kimi-K2-Instruct model card](https://huggingface.co/moonshotai/Kimi-K2-Instruct) · [Kimi API Platform](https://platform.kimi.ai/docs/api/overview)
- pi-agent: `packages/ai/src/api/{openai-completions,openai-responses-shared,anthropic-messages}.ts`, `providers/{moonshotai,kimi-coding}.ts`
- hyper-code2: `src/llm/{streamCodex,toAnthropicMessages,parseSSE}.ts`, бенчи `scratchpad/ab/`
