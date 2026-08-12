---
description: >-
  Finish the current turn with programmatically generated HTML. Use only when a tool/eval has
  produced the complete user-facing answer and no further model explanation is needed. The runtime
  stores this tool result first, sanitizes the HTML, appends the final assistant message/event, and
  stops without another LLM call.
promptSnippet: "finish the turn with a sanitized HTML response visible to the user"
promptGuidelines:
  - "Use respondHtml only as the final tool call of a turn, after all data gathering is complete. Put the complete accessible answer in html and a concise plain-text fallback/history representation in text. Do not emit prose alongside the call, and do not call it together with other tools."
  - "respondHtml is terminal: after it succeeds, the runtime records the tool result, sanitizes through agent.sanitizeHtmlBody, publishes the HTML as the assistant answer, and does not ask the model for a follow-up final. Never use session.appendAssistantMessage/Event from a tool to imitate this flow."
parameters:
  type: object
  properties:
    html:
      type: string
      description: Complete HTML fragment to display. Do not include html/head/body, scripts, styles, or event handlers.
    text:
      type: string
      description: Plain-text fallback and durable assistant-message content for history and future LLM context.
  required: [html, text]
  additionalProperties: false
---
### Terminal HTML response

Call this only after gathering all required data. It is a terminal operation, not an HTML renderer:

```json
{"html":"<section><h2>Result</h2><p>Done.</p></section>","text":"Result: Done."}
```

The function itself has no transcript side effects. `agent.run` first writes the corresponding tool
result, then sanitizes the payload with `agent.sanitizeHtmlBody`, appends one final assistant message
using `text`, appends its UI event using the sanitized HTML, and ends the turn. This ordering preserves
a valid native-tool transcript and prevents a duplicate model-generated final response.
