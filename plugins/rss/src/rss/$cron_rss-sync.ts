/** Loads every enabled RSS feed three times per day and publishes only new or changed entries to News. */
export default { fn: "rss.loadAll", every: "8h", args: {} };
