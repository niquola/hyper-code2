---
name: flow
description: Compute current attention gaps from source facts, review them at /gaps, and explicitly apply one revision-bound action with a durable verification receipt.
---
# Gaps / flow

Canonical declarations are **`$gap_<name>.ts`**, plain async functions anywhere in mounted `src/` or `.hyper/` roots. Namespace `flow` is the generic runner, not a workflow engine. Open **/gaps** (global navigation: **Gaps**) to see all current needs, source rules, actions and isolated check errors. GET calls preview only. POST submits one flow/id/revision, rediscovers before apply, verifies afterwards and displays a receipt. No gaps table, scheduler, notifications, medication schedule, task waits or automatic actions exist here.

Use `flow.list({})` for the aggregated list, `flow.reconcile({flow,mode:'preview'})`, or `mode:'explain', target:{id,revision}` for the current rationale. Apply requires an explicit target and current revision. A disappeared target or changed revision is `stale` without an action. Successful verification is `closed` only when the selected need disappeared; an effect such as a reminder can succeed while status remains `remains`. `verified` distinguishes actual verification from failures, `converged` means no remaining gaps following discovery. Apply errors and an initial pending attempt are stored in `flow.receipts`; a crash or failed receipt update leaves an indeterminate attempt, never a proven success.

## Author a trusted declaration

Put private rules in `.hyper/myRules/$gap_intake.ts` (small project-local procedure) or a user plugin's `src/myRules/$gap_intake.ts` (substantial integration). Do not put personal health information into this official plugin. After adding/changing declarations, run `procs.dev.genTypes({})` and **`plugins.reload({})`**; `repl.load({name:'flow'})` reloads ordinary functions only, not custom declaration loaders. The scanner loads src before .hyper, and later declarations override the same name. `$flow_` object/step declarations are deliberately not supported.

Template only — replace the fact/action procedures with your own trusted integration; this is not installed or auto-running:

```ts
// .hyper/myRules/$gap_intake.ts
export default async function(ctx:Context, session:Session|null, opts:types.flow.FlowRequest):Promise<types.flow.FlowOutput> {
  const fact = await ctx.fns.myFacts.readIntake({now:opts.now});
  const gaps:types.flow.Gap[] = fact.complete ? [] : [{
    id:`intake:${fact.id}`, revision:fact.revision,
    summary:'Intake is incomplete', will:'Open intake request',
  }];
  if(opts.mode==='preview') return {gaps};
  const gap=gaps.find(g=>g.id===opts.target.id && g.revision===opts.target.revision);
  if(!gap) throw new Error('Target changed');
  if(opts.mode==='explain') return {explanation:gap.summary};
  // This action must atomically recheck facts and use a unique business key.
  const effect=await ctx.fns.myFacts.openIntake({id:fact.id, revision:gap.revision, idempotencyKey:gap.id});
  return {effects:[{reference:effect.id}]};
}
```

The runner does not accept arbitrary action input. `id` and `revision` are nonempty bounded strings, and preview IDs must be unique within a rule. IDs describe stable business needs; revisions change when relevant facts/action semantics change. Single-action `will` is optional: absent means informational only. Preview/explain purity is a trusted-code contract, **not sandbox enforcement**. Explain uses the fresh preview rationale without invoking declaration explain. Apply is not a transaction spanning facts, external effects and receipts: the declaration/action owns atomic rechecks, authorization and idempotency under concurrent/repeated submissions. Never infer adherence or medical completion from a notification receipt. Discovery has no timeout sandbox; slow trusted rules delay the page. Receipts contain gap summaries: keep sensitive data minimal and use the host's access controls.
