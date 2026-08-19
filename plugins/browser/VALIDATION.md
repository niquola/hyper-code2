# Browser API empirical validation

Validated on 2026-08-19 against a real Chrome CDP endpoint. All interactions were reversible. No credentials, bookings, purchases, passenger data, payment data, repository writes, account changes, or form submissions were performed.

## Matrix

| Site | Observe | Target and act | Verify | Friction / outcome |
| --- | --- | --- | --- | --- |
| MyCUF (`cuf.pt/mycuf/login`) | Interactive snapshot produced revision-scoped refs for Email and Senha | Batched `fill` populated both fields; `press(Tab)` moved focus from email to password | Page values and active element were read back; both fields were cleared; URL remained the login page | Styled login form worked with refs. Tab required the deterministic focus fallback implemented in `browser.act`. |
| Kiwi (`kiwi.com`) | Interactive/text snapshots exposed destination UI and autocomplete text | `type(clear:true)` entered Copenhagen using CDP `Input.insertText` | Suggestions included “Copenhagen, Denmark”, “250 km around Copenhagen”, and CPH-related results; field was cleared | `fill` alone does not trigger React autocomplete reliably; `type` is the correct semantic operation. |
| Kiwi results | Text snapshot read a dated results URL for Lisbon → Copenhagen | Read-only observation of one-way results for 2026-08-29 | Route/title matched LIS–CPH; best, cheapest and fastest were each €137 / 3h25; first result was direct 22:55–03:20 | Date is within the explicitly recorded next-week range 2026-08-24 through 2026-08-30. No “Select” action was invoked. |
| Booking.com | Interactive snapshot captured the stay search UI | `type` entered Copenhagen; `press(Tab)` moved focus; `fill` cleared the field | Input value and next focused button were read back; URL stayed on the home page | Autocomplete text was not exposed in the bounded text snapshot during the test. Visually hidden styled checkbox controls motivated hardened idempotent `check` support. |
| GitHub public repository search | Interactive snapshot produced a ref for `vercel-labs/agent-browser` | `hover` and target-centering `scroll` used the ref | Link presence, URL and title were verified; no login or write operation occurred | Ref targeting was concise and stable. Page-level `scrollY` is not always meaningful on layouts with nested scroll containers. |
| Wikipedia main page | Interactive snapshot exposed the searchbox | `type` entered Copenhagen; `press(Tab)` moved focus to the Search button; revision diff captured page-state changes | Input, focused button, URL and snapshot delta were verified; field was cleared | Trusted form navigation is site-specific; validation deliberately stopped before submission. |
| Native controls fixture in real Chrome | Snapshot inspected a CDP-created `about:blank` document | `select` chose Denmark by visible label; `check` set true twice then false; `scroll` centered the bottom target | Selected value was `dk`, final checkbox state was false, and the target moved into the viewport | Confirms select/check semantics separately from framework-specific styling. Fixture was installed through public CDP. |

## Public CDP and lifecycle

A named public `cdp.session` created a tab. Public `cdp.send` navigated it to `https://example.com` and evaluated `{ title, url, readyState }`, yielding “Example Domain”, the final URL, and `complete`. `browser.tabClose` then removed both the Chrome target and runtime session entry.

All validation sessions (`val-cuf`, `val-kiwi`, `val-booking`, `val-github`, `val-wiki`, `val-select`, `val-kiwi-ui`, `val-cdp`) were closed. A final tab listing and runtime-state check confirmed every recorded target absent and every named session removed.

## Regression evidence

The browser test suite covers snapshots, explicit diffs, stale refs, strict ambiguity, hidden duplicate filtering, fail-fast action batches and partial results, Tab fallback, hidden styled controls, native select labels, typed CDP input, legacy click compatibility, research composition, and Google-search behavior.

Run:

```sh
bun test plugins/browser/src/browser/*.test.ts
```
