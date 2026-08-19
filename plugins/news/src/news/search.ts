/** Searches prepared headlines and stored news text in the durable archive. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Natural-language or keyword text to find in stored news. */ query:string;
    /** Restrict results to one producer source label. */ source?:string;
    /** Maximum matching items returned. @default 20 @minimum 1 @maximum 100 */ limit?:number;
}): Promise<any[]> {
    return ctx.fns.news.list({query:opts.query,source:opts.source,limit:opts.limit});
}
