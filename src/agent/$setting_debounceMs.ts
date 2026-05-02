export default {
    type: 'number',
    default: 1000,
    min: 0,
    max: 60000,
    title: 'POST debounce (ms)',
    description: 'Default delay before workerLoop picks up a new message. Per-agent override via settings.set(module=ui, scopeType=agent, scopeId=agent.id, key=debounceMs).',
};
