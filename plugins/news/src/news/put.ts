/** Stores an already prepared source-neutral news item while preserving reader state by default. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Stable source item identifier. */ id:string;
    /** Headline. */ title:string;
    /** Source label. */ source:string;
    /** Original URL. */ url?:string;
    /** Author name. */ author?:string;
    /** Source score. */ points?:number;
    /** Source comment count. */ comments?:number;
    /** Topic labels. */ topics?:string[];
    /** Stored article Markdown supplied by the producer. */ articleMarkdown?:string;
    /** Prepared short summary. */ summary?:string;
    /** Prepared expanded summary. */ summaryLong?:string;
    /** Producer query or grouping key. */ query?:string;
    /** Source fetch timestamp. */ fetchedAt?:string;
    /** Publication/display timestamp. */ shownAt?:string;
}): Promise<{id:string}> {
    await ctx.fns.news.ensure({});
    if(!opts.id?.trim()||!opts.title?.trim()||!opts.source?.trim())throw new Error("news.put requires id, title and source");
    await ctx.fns.procs.db.run({sql:`INSERT INTO news.items(id,title,url,author,points,comments,topics,article_md,summary,summary_long,query,source,fetched_at,shown_at)
      VALUES(?,?,?,?,?,?,?::text[],?,?,?,?,?,coalesce(?::timestamptz,now()),?::timestamptz)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=coalesce(excluded.url,news.items.url),author=coalesce(excluded.author,news.items.author),points=coalesce(excluded.points,news.items.points),comments=coalesce(excluded.comments,news.items.comments),topics=coalesce(excluded.topics,news.items.topics),article_md=coalesce(excluded.article_md,news.items.article_md),summary=coalesce(excluded.summary,news.items.summary),summary_long=coalesce(excluded.summary_long,news.items.summary_long),query=coalesce(excluded.query,news.items.query),source=excluded.source,shown_at=coalesce(excluded.shown_at,news.items.shown_at)`,params:[opts.id,opts.title,opts.url??null,opts.author??null,opts.points??null,opts.comments??null,opts.topics??null,opts.articleMarkdown??null,opts.summary??null,opts.summaryLong??null,opts.query??null,opts.source,opts.fetchedAt??null,opts.shownAt??null]});
    return {id:opts.id};
}
