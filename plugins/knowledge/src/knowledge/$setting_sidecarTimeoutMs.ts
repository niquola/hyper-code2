export default {
    type: 'number',
    default: 180000,
    min: 10000,
    max: 900000,
    title: 'Knowledge sidecar timeout (ms)',
    description: 'Wall-clock bound for one hidden entity-extraction fork run; on expiry the in-flight provider request is aborted and the preview is marked as an error.',
};
