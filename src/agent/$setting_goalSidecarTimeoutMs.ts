export default {
    type: 'number',
    default: 120000,
    min: 10000,
    max: 900000,
    title: 'Goal sidecar timeout (ms)',
    description: 'Wall-clock bound for one hidden goal-observation fork run; on expiry the in-flight provider request is aborted and the preview is marked as an error.',
};
