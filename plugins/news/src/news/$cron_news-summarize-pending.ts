/** Retries missed News summaries sequentially every hour. */
export default {fn:"news.summarizePending",every:"1h",args:{limit:20,hours:72}};
