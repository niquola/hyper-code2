# Боковая панель Hyper: проверка платформы и старого расширения

Исследование без реализации. Проверены исходники uniskill и официальные страницы Chrome/Chromium. Живой `http://127.0.0.1:9222/json/version` ответил `Chrome/151.0.7922.109`, CDP `1.3`; браузер не перезапускался, расширения не устанавливались. Это проверка доступности CDP, не функциональный тест панели.

## Вывод

Atlas-подобный интерфейс рядом с текущей страницей реализуем через MV3 `chrome.sidePanel`. Отдельный **постоянный агент Hyper на вкладку** должен жить на сервере, а не в iframe или service worker. Расширение связывает числовой Chrome `tabId` с CDP `targetId`, сервер продолжает управлять страницей через существующий порт 9222. Принудительно закрепить панель справа публичный API не позволяет: сторону выбирает пользователь Chrome; `getLayout()` только читает её. Не следует обещать автоматическое восстановление связи «та же вкладка → тот же агент» после полного рестарта браузера без отдельно проверенного механизма идентичности.

## Что действительно есть в uniskill

- `/Users/niquola/uniskill/skills/browser/extensions/arc-sidebar/manifest.json`: MV3, только permission `sidePanel`, `side_panel.default_path = panel.html`, background `bg.js`. Нет `debugger`, `tabs`, `storage`, host permissions и явного CSP. Название и описание говорят о старом менеджере вкладок, не о Hyper-агентах.
- `/Users/niquola/uniskill/skills/browser/extensions/arc-sidebar/bg.js`: единственное действие — `setPanelBehavior({openPanelOnActionClick:true})`; ошибка скрывается через пустой catch. Никакого отслеживания активной вкладки, восстановления или маршрутизации агентов.
- `/Users/niquola/uniskill/skills/browser/extensions/arc-sidebar/panel.html`: полноразмерный iframe `http://localhost:2229/bar`. Это только оболочка, весь старый UI предполагался на внешнем сервере. Private key не читался и в исследование не включён.
- `/Users/niquola/uniskill/skills/browser/src/chrome/start.ts`: отдельный tmux-процесс, CDP 9222, нестандартный постоянный user-data-dir `skills/browser/chrome-profile`, фиксированный профиль; попытка загрузки расширения через `--load-extension`, также передаётся `--silent-debugger-extension-api`. Последний флаг не нужен для простого `getTargets`, и на него нельзя опираться как на обход пользовательских разрешений.
- `/Users/niquola/uniskill/skills/browser/src/browser/tabs.ts`: `/json` → только `type === page`, поле `id` — CDP target, **не Chrome tabId**.
- `/Users/niquola/uniskill/skills/browser/src/session/create.ts`: WebSocket `/devtools/page/<targetId>`, именованные сессии хранятся только в `ctx.state.sessions`. Это оперативные CDP-подключения, не долговечные Hyper-агенты.
- `/Users/niquola/uniskill/skills/browser/src/browser/recover.ts`: при зависании может закрыть управляемую вкладку, при недоступном Chrome — перезапустить браузер. Такой recovery нельзя переносить без изменений на пользовательские вкладки панели.
- `/Users/niquola/uniskill/skills/browser/src/window/dockLeft.ts`: запасной вариант — отдельное узкое окно с тем же `/bar`; это не настоящая встроенная боковая панель.
- Поиск `2229`, `/bar`, `sidebar` по доступным индексируемым файлам uniskill не обнаружил реализации сервера `/bar`. `/Users/niquola/uniskill/MIGRATION.md` прямо относит sidebar на 2229 к standalone services. **Не установлено**, где находится этот отдельный сервер и работает ли он сейчас; Hyper не должен зависеть от него. Игнорируемые/внешние деревья этим поиском не покрыты.

## Проверенные возможности Chrome

### Панель, переключение вкладок, правая сторона

Официальный API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

- Side Panel доступен с Chrome 114, только MV3. `default_path`/`setOptions.path` — локальная страница пакета расширения, не адрес Hyper.
- `setPanelBehavior({openPanelOnActionClick:true})` открывает панель по кнопке расширения. `open()` доступен с Chrome 116 и требует пользовательского действия: нельзя рассчитывать на открытие из произвольного события старта, таймера или серверного push.
- `setOptions({tabId,path,enabled:true})` задаёт панель конкретной вкладки. Документация прямо отличает экземпляр tab-specific панели от default-панели даже при одинаковом path. При переходе на вкладку, где панель выключена, Chrome скрывает её и показывает вновь при возвращении к ранее открытой.
- Альтернатива — общая панель, переключающая серверный agentId при `tabs.onActivated`; придётся отдельно учитывать окно и гонки событий. Для требуемой изоляции предпочтительнее tab-specific конфигурация, но долговечность состояния всё равно серверная.
- Chrome позволяет пользователю выбрать левую/правую сторону. `getLayout()` появился в Chrome 140; setter стороны отсутствует. `onOpened` — Chrome 141, `onClosed` — Chrome 142: их нельзя использовать без minimum version или feature detection.
- Документация не обещает вечную жизнь DOM каждой панели или сохранение её открытого состояния после рестарта. Историю чата нельзя хранить только там.

### Надёжное соответствие Chrome tabId ↔ CDP targetId

API: https://developer.chrome.com/docs/extensions/reference/api/debugger

Исходник Chromium: https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/api/debugger/debugger_api.cc

- `chrome.debugger.getTargets()` возвращает `TargetInfo[]`: `id: string` (target id), `tabId?: number` (для page), `type`, `attached`, URL и заголовок. Нужен permission `debugger`; это чувствительное разрешение, требующее понятного объяснения пользователю.
- В Chromium `SerializeTarget()` берёт `id` через `DevToolsAgentHost::GetId()`, а `tabId` — через `ExtensionTabUtil::GetTabId(host->GetWebContents())`. Это прямое соответствие идентификаторов, а не поиск по URL. `getTargets()` перечисляет цели; **attach не требуется**. Не нужно подключать extension-debugger к вкладке поверх существующего CDP только ради идентификации.
- Брать только `type === 'page'` с валидным `tabId`; у workers/iframe/служебных целей соответствия может не быть. Пересекать результат с живыми целями того же Chrome на 9222 и с ожидаемой вкладкой. `attached:true` не означает, что идентификатор нельзя использовать.
- Не сопоставлять по URL/заголовку: дубликаты вкладок и SPA делают это неоднозначным. Перед действием проверять, что целевая вкладка ещё существует; обрабатывать закрытие и `tabs.onReplaced`.
- Исходник подтверждает механизм; реальный вызов `getTargets()` из установленного расширения и сравнение с `/json` ещё не выполнялись. Это обязательный smoke test, особенно при нескольких профилях/браузерах.

### Iframe localhost, CSP и разрешения

Источники:
- https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy
- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- https://developer.chrome.com/blog/local-network-access

- Сохранять локальную packaged оболочку, а не подключать удалённый JS напрямую в privileged extension page. MV3 запрещает произвольный remote hosted code; официальная миграционная документация отдельно допускает изолированные sandboxed iframe. Работоспособность обычного localhost iframe в unpacked-режиме не является гарантией публикации в Chrome Web Store.
- Стандартный extension CSP ограничивает `script-src`/`object-src`; добавление собственного `default-src 'self'` без `frame-src` заблокирует внешний iframe. Для embed-пути нужна явная узкая политика `frame-src` на фактический loopback origin; для fetch/WebSocket оболочки — соответствующий `connect-src`. Не ослаблять `script-src` через unsafe-eval/удалённые источники.
- `host_permissions` разрешает cross-origin сетевые запросы **кода расширения** к указанным хостам; это не универсальное разрешение iframe и не обход серверного `frame-ancestors`/`X-Frame-Options`. Сам факт iframe-навигации и extension fetch — разные механизмы.
- Сервер Hyper должен разрешать embed выбранному `chrome-extension://<id>` через `frame-ancestors`; конфликтующий `X-Frame-Options: DENY/SAMEORIGIN` надо учесть. CSP/headers самого Hyper в этом задании не проверялись. `localhost` и `127.0.0.1` — разные origins: выбрать один и согласовать порт, cookies, CORS и CSP.
- У localhost iframe собственный web origin, он не получает привилегии оболочки автоматически. Если нужен `postMessage`-мост: проверять `event.origin`, `event.source`, формат сообщения и белый список операций; запрещать произвольный JS/CDP через такой мост. Передавать agentId/binding, но не долговечные секреты в URL.
- С Chrome 142 действует Local Network Access permission для запросов сайтов в локальную сеть/loopback. Нельзя без теста утверждать, как именно эта политика затронет выбранную комбинацию extension top-level, iframe, sandbox и fetch. Проверить на используемой сборке; host permission не следует считать универсальным обходом.
- Рекомендуемый минимальный набор разрешений зависит от варианта: `sidePanel`, `storage`, `debugger`; `tabs` — если нужны URL/title через Tabs API (само отслеживание tabId и основных событий не требует широкого `tabs`). Loopback host permission нужен, если сеть вызывает оболочка/service worker. `<all_urls>` для самой панели не требуется.

### Service worker и сохранность

Источники:
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/reference/api/tabs
- https://developer.chrome.com/docs/extensions/reference/api/sessions

- Worker обычно останавливается после 30 секунд бездействия; есть ограничения на долгие операции/ответ fetch. Глобальные Map исчезают. API/events могут продлевать жизнь, но держать worker постоянно живым ради чата не следует.
- `chrome.storage.session` переживает остановку worker, но очищается при рестарте браузера, обновлении/перезагрузке/отключении расширения. `storage.local` подходит для локальной долговечной конфигурации; Postgres Hyper — для agentId, истории и серверных связей.
- `runtime.onStartup` приходит при старте профиля. Обработчики событий нужно регистрировать на верхнем уровне worker; после любого пробуждения согласовывать вкладки и связи идемпотентно. Стрим чата может идти в открытой панели; после её пересоздания UI перечитывает историю и подключается заново.
- `tabs.Tab.id` уникален только в рамках browser session. Старые tabId/targetId нельзя считать идентичностью восстановленных вкладок. Chrome `sessions` предоставляет недавние/восстановленные сессии, но не документирует `setTabValue/getTabValue` для пользовательского постоянного токена на вкладке. Не переносить такую возможность из Firefox по памяти.

## Предлагаемый контракт, не реализация

1. Postgres: отдельный Hyper agentId и долговечная история; browser binding хранить отдельно от агента. В рамках запуска: `browserInstance/profile + browserSessionEpoch + tabId → targetId → agentId`. Новый URL в той же вкладке не создаёт нового агента; дубликат вкладки получает отдельного агента.
2. Расширение сообщает актуальные tabId/targetId и активное окно; server get-or-create должен быть атомарным, чтобы worker/panel startup не создали два агента на вкладку. Панель получает конкретный binding, не «последнюю активную вкладку вообще».
3. При закрытии панели агент и история сохраняются. При закрытии вкладки связь помечается closed, история не удаляется автоматически. При рестарте Hyper связи согласовываются с Chrome; при рестарте Chrome старые live-идентификаторы инвалидируются.
4. Сохранить **того же агента после полного рестарта Chrome** — отдельное требование с нерешённой здесь идентичностью. Безопасный первый вариант: сохранить чаты в списке и дать явное переподключение; не молча назначать агент по совпавшему URL. Автоматическое восстановление потребует отдельного механизма и испытаний дубликатов/restore/replace/incognito.
5. Перед CDP-действием агент использует привязанный targetId; при потере target сообщает об этом и не переключается автоматически на другую вкладку. Содержимое посещаемой страницы — недоверенные данные, не команды для Hyper.

## Важные изменения относительно старого launcher

- С Chrome 136 remote debugging требует нестандартного `--user-data-dir`; старый launcher уже использует отдельный каталог, что соответствует этому требованию. Источник: https://developer.chrome.com/blog/remote-debugging-port
- В Chrome 137 убран обычный механизм `--load-extension`; нельзя считать старый запуск подтверждением установки в современном обычном Chrome. Для конкретного дистрибутива проверить manual Load unpacked/поддерживаемый testing workflow, не перезапуская пользовательский профиль без разрешения. Источник: https://developer.chrome.com/blog/extension-news-june-2025

## Что остаётся проверить перед реализацией

1. Загружено ли расширение и разрешены ли developer mode/debugger policy в действительном профиле; запуск старого флага этого не доказывает.
2. `getTargets().id` ↔ `/json.id` на живом Chrome, дубли URL, смена документа/target, restricted tabs и несколько окон.
3. Реальные headers/auth/CSP Hyper, iframe cookies/storage, LNA и sandbox-вариант на текущем Chrome; сервер `/bar` не найден и не нужен как зависимость.
4. Переключение tab-specific панелей, закрытие/открытие, worker suspend, рестарт Hyper и полный restart/restore Chrome. Особенно — отсутствие смешивания чатов и действий между вкладками.
5. Согласовать ограничение «справа — настройка пользователя» и требуемую гарантию восстановления того же агента после полного рестарта браузера. Эти ограничения нельзя скрывать в реализации.
