---
name: pipedrive
description: "Read-only Pipedrive CRM client — inspect deals, people, organizations, pipelines and stages, search CRM records, and read email threads attached to deals or contacts. Use for sales pipeline, customer, lead, contact and CRM questions."
---

# Pipedrive

Live read-only access to one configured Pipedrive company account. The company domain and API token are secret settings (`pipedrive.domain`, `pipedrive.apiToken`) and are never returned by plugin functions. The plugin never creates, updates, deletes, or sends anything.

## Workflow

Use global search to discover records, then fetch the exact deal/person/organization. Resolve pipeline and stage names before filtering deals. Attached email helpers only read messages already synchronized into Pipedrive.

```ts
const matches = await ctx.fns.pipedrive.search({ term: "Acme", limit: 5 });
const deal = await ctx.fns.pipedrive.deals({ id: matches[0].id });
const emails = await ctx.fns.pipedrive.emails({ deal: deal.id, limit: 20 });
```

The low-level `api` function accepts GET requests only. Use it for documented Pipedrive v1 read endpoints not covered by a helper.
