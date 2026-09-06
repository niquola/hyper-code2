# Hyper Sidebar — результаты реализации и живых проверок

Дата: 2026-09-06. Статус: работающий приватный MVP, не security sandbox.

## Что реализовано

- `browser-extension/` рядом с `mobile/`: unpacked Manifest V3, native side panel, settings/pairing, per-tab identity, iframe существующего Hyper UI. Без отдельного чата и сборки.
- `src/sidebar/`: narrow loopback API, hashed bearer credentials, explicit approval в обычном authenticated Hyper UI, durable Postgres bindings, live target/process/context validation, close/revoke.
- `src/ui/layout.ts`: `presentation=sidebar`, скрывает навигацию/Meta, сохраняет chat, popup и secure input.
- `plugins/browser/src/cdp/` и browser wrappers: привязанный agent context, fail-closed guard, reconnect только прежнего target, без автоматического повторения команды.
- `src/agent/fullSystemPrompt.ts`: актуальный browser context из durable lookup перед запросом, сохраняется смысл после compaction.

## Реальная установка и browser smoke

Установлено через `Extensions.loadUnpacked` из `/Users/niquola/hyper-code2/browser-extension`, extension ID `gnhpompepbopbbacjgonbkkhjjfdenco`. Обычная ручная установка описана в README.

Проверено не только DOM-моком, но в настоящей native панели Chrome:

1. Extension options открывается, localhost:3010 настроен по умолчанию.
2. `chrome.debugger.getTargets()` сопоставил две вкладки одинакового URL с разными Chrome tabId и точными CDP page targetId, без attach.
3. Native панель реально открылась, ширина 360px. Для automation `Extensions.triggerAction` требует target типа `tab`, не CDP `page`; перед действием активировали нужный Chrome tab.
4. Pairing из настоящего extension origin → pending credential → отдельная Hyper approval page → нажата Approve → extension status Approved. Секреты не выводились и не передавались в URL.
5. В iframe реально загрузился `/agent/:id?presentation=sidebar` с включённым password gate и существующей сессией пользователя. Composer и popup host присутствуют, Meta скрыт, horizontal overflow отсутствует. Это подтверждение выбранной конфигурации Chrome, не всех cookie policies.
6. Переключение двух одинаковых URL создало разных агентов (`byqr/byqs`, после restart — `byqt/byqu`). Переключение возвращало соответствующий чат.
7. Сообщение отправлено через настоящий iframe composer (`#input`, Enter). Агент `byqt` вызвал browser.click без session override на `#change`. Текст A изменился на `Changed in /same`; B остался `Not changed`, хотя во время исполнения активной была B.
8. Ответ агента появился в существующем чате. Это end-to-end message → LLM → browser tool → результат → UI, не только прямой вызов API родителем.
9. Навигация A `/same` → `/next` сохранила agentId и target, обновила URL/title/revision.
10. Принудительно закрыт только CDP websocket тестового агента. Через тот же iframe composer отправлена новая задача чтения. Агент прочитал `/next`, `Not changed` и ответил в чате: reconnect произошёл на прежний target.
11. Закрытие тестовой вкладки сначала дало unavailable, после события расширения durable state стал closed; история сохранена. Соседняя B не изменилась.
12. Оба созданных тестовых source tab закрыты после проверки. Установленное расширение и pairing оставлены для пользователя; тестовые истории сохранены.

## Сбой окружения во время теста

Первоначально Chrome 151 перестал отвечать и процесс исчез. До этого сообщение из iframe было принято Hyper, но agent browser calls корректно вернули `Browser binding is unavailable`; другую вкладку агент не выбрал. Причина исчезновения процесса не установлена.

Chrome затем запущен с прежним CDP/profile, без удаления профиля/данных. `/json/version` уже показал Chrome 152. Старые page target не использованы повторно; новые тестовые вкладки получили новые агенты. Успешный action/reconnect smoke выполнен на Chrome 152. Не утверждаем, что остановка была вызвана расширением или что проверен restart с восстановлением всех вкладок.

## Автоматические тесты — перепроверены родителем

| Набор | Тесты | Assertions | Результат |
|---|---:|---:|---|
| browser-extension helpers + panel invalidation | 10 | 47 | pass |
| ui.layout | 8 | 58 | pass |
| sidebar bridge | 2 | 33 | pass |
| sidebar approval | 2 | 4 | pass |
| auth middleware | 3 | 5 | pass |
| browser/CDP binding, prompt, actions, snapshot и regression | 36 | 98 | pass |
| **Итого** | **61** | **245** | **0 failures** |

Запускать из соответствующей папки, например `cd browser-extension && bun test`; JUnit использовался для проверки фактического числа tests. Некоторые root invocations локального Bun выводили только заголовок без исполнения; такие запуски НЕ засчитаны.

Runtime functions hot-reloaded, strict metadata/typecheck validated исполнителями. Middleware подключён через loadRoutes. Общий full-repo suite не запускался; другие незакоммиченные изменения пользователя не включались и не коммитились.

## Известные ограничения

- Trusted-local-user prototype: generic eval/bash/runtime capabilities не изолированы. Browser API guards не являются полноценным sandbox.
- Сторону панели выбирает пользователь Chrome; принудительный right setter отсутствует.
- Автоматическое соответствие старых вкладок старым агентам после полного browser restart не обещается. Старые чаты сохраняются, новые живые связи создаются отдельно.
- Crash между созданием idle agent и закреплением mapping может оставить orphan idle agent; mapping защищён unique key/lease. Это не exactly-once создание при crash.
- Pairing истекает через 30 дней; pending/expired credential разрешено узко отзывать, не использовать для bind.
- Обычные popup/tool details сохранены структурно; полный ручной сценарий secure input и все настройки privacy/cookies не протестированы.
- Часть режимов lifecycle (worker suspension, multi-window, extension reload после pairing) покрыта кодом/моками, но не полным живым acceptance suite.
- Временный fixture HTTP server использовался только локально на случайном порту; он не является частью расширения и не нужен для работы.
