/** Creates or updates one RSS/Atom feed subscription. */
export default async function(ctx:Context,_session:Session|null,opts:{
 /** Stable short feed key used as the News source. */ key:string;
 /** Absolute RSS or Atom URL. */ url:string;
 /** Human-readable feed label. */ label:string;
 /** Short badge displayed in UIs. */ badge?:string;
 /** Optional grouping category. */ category?:string;
 /** Whether explicit bulk loading includes this feed. @default true */ enabled?:boolean;
}):Promise<{key:string}>{await ctx.fns.rss.ensure({});const key=String(opts.key??"").trim();if(!/^[a-z0-9][a-z0-9_-]*$/.test(key))throw new Error("rss.add: key must be lowercase letters, digits, underscore or hyphen");const url=new URL(opts.url);if(!/^https?:$/.test(url.protocol))throw new Error("rss.add: URL must be HTTP(S)");await ctx.fns.procs.db.run({sql:`INSERT INTO rss.feeds(key,url,label,badge,category,enabled,updated_at) VALUES(?,?,?,?,?,?,now()) ON CONFLICT(key) DO UPDATE SET url=excluded.url,label=excluded.label,badge=excluded.badge,category=excluded.category,enabled=excluded.enabled,updated_at=now()`,params:[key,url.href,opts.label,opts.badge??null,opts.category??null,opts.enabled!==false]});return {key};}
