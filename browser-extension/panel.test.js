import {test, expect} from 'bun:test';

test('close/revoke invalidation unloads frame and link, and ignores stale responses', async () => {
  const old = {document: globalThis.document, chrome: globalThis.chrome, location: globalThis.location};
  const nodes = new Map();
  for (const id of ['source', 'status', 'error', 'chat', 'open', 'retry', 'settings']) {
    nodes.set(`#${id}`, {hidden: true, attributes: {}, addEventListener(name, fn) { this[name] = fn; }, removeAttribute(name) { delete this[name]; }});
  }
  const identity = {tabId: 11, windowId: 2, nonce: 'test'};
  let listener;
  let resolveOpen;
  try {
    globalThis.document = {querySelector: selector => nodes.get(selector)};
    globalThis.location = {search: '?tabId=11&windowId=2&nonce=test'};
    globalThis.chrome = {runtime: {
      sendMessage: () => new Promise(resolve => { resolveOpen = resolve; }),
      onMessage: {addListener: fn => { listener = fn; }}, openOptionsPage() {},
    }};
    await import(`./panel.js?test=${Date.now()}`);
    const record = {...identity, agentId: 'ab', status: 'Connected'};
    resolveOpen({ok: true, data: {base: 'http://localhost:3010', record}});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(nodes.get('#chat').src).toBe('http://localhost:3010/agent/ab?presentation=sidebar');
    expect(nodes.get('#open').hidden).toBe(false);
    listener({type: 'state', record: {...record, label: 'Changed title'}});
    expect(nodes.get('#chat').src).toBe('http://localhost:3010/agent/ab?presentation=sidebar');
    nodes.get('#retry').click(); // Pending old identity response must not remount.
    const pending = resolveOpen;
    listener({type: 'state', record: {...record, closed: true, status: 'Pairing revoked'}});
    expect(nodes.get('#chat').hidden).toBe(true);
    expect(nodes.get('#chat').src).toBeUndefined();
    expect(nodes.get('#open').hidden).toBe(true);
    expect(nodes.get('#open').href).toBeUndefined();
    pending({ok: true, data: {base: 'http://localhost:3010', record}});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(nodes.get('#chat').src).toBeUndefined();
    listener({type: 'state', record});
    expect(nodes.get('#chat').hidden).toBe(true);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
