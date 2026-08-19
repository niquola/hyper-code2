/** Hourly scan that wakes the persistent calendar master agent. */
export default {
    fn: "calendar.wakeMaster",
    every: "1h",
    args: { account: "niquola@health-samurai.io" },
};
