export default {
    type: 'number',
    default: 60000,
    min: 0,
    max: 2592000000,
    title: 'Completed subagent archive delay (ms)',
    description: 'Inactivity delay before ready delegated agents are automatically archived. Default is one minute; set to 0 to disable automatic archival.',
};
