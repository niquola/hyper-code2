/** POST /news/like — updates liked state and returns the current reader card. */
export default async function(ctx:Context,_session:Session|null,opts:{req:Request;params:Record<string,string>}){
 const form=await opts.req.formData(),id=String(form.get("id")??""),liked=String(form.get("liked")??"")==="true";await ctx.fns.news.setLiked({id,liked});
 const referer=opts.req.headers.get("referer")??"http://localhost/news/reader",url=new URL(referer),params=new URLSearchParams(url.search);params.set("id",id);
 const req=new Request(`${url.origin}/news/reader/at?${params}`,{headers:{accept:"text/html","hx-request":"true","hx-target":"reader"}});
 return (ctx.state.procs.http.routes as any)["/news/reader/at"].GET(ctx,_session,{req,params:{}});
}
