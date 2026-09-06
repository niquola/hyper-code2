const status = document.querySelector('#status');
async function request(type, fields = {}) {
  const result = await chrome.runtime.sendMessage({type, ...fields});
  if (!result?.ok) throw new Error(result?.error || 'Extension worker unavailable');
  return result.data;
}
async function action(fn) {
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  status.textContent = 'Working…';
  try { await fn(); } catch (error) { status.textContent = error.message; }
  finally { for (const button of document.querySelectorAll('button')) button.disabled = false; }
}
async function load() {
  const cfg = await request('config');
  document.querySelector('#base').value = cfg.base;
  document.querySelector('#extension').textContent = cfg.extensionId;
  document.querySelector('#installation').textContent = cfg.installationId;
  status.textContent = cfg.paired ? 'Credential stored. Check approval to verify server status.' : 'Not paired.';
}
document.querySelector('#pair-form').addEventListener('submit', event => {
  event.preventDefault();
  action(async () => { await request('pair', {base: document.querySelector('#base').value}); status.textContent = 'Approval page opened in Hyper. Approve there, then check approval.'; });
});
document.querySelector('#check').addEventListener('click', () => action(async () => {
  const result = await request('pairStatus');
  status.textContent = result.revoked ? 'Pairing revoked.' : result.approved ? 'Approved. Reopen the sidebar on your source tab.' : 'Awaiting explicit approval in Hyper.';
}));
document.querySelector('#revoke').addEventListener('click', () => action(async () => {
  await request('revoke'); status.textContent = 'Pairing and browser bindings revoked. Hyper chat history is retained.';
}));
action(load);
