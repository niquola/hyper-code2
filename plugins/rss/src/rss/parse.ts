/** Parses RSS 2.0 or Atom XML into normalized source-neutral entries. */
export default function(_ctx:Context,_session:Session|null,opts:{
 /** Complete RSS 2.0 or Atom XML document to normalize. */ xml:string;
}):Array<{id:string;title:string;url:string;author?:string;publishedAt?:string;description?:string;content?:string}>{
 const decode=(s:string)=>String(s??"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&#(\d+);/g,(_m,d)=>String.fromCodePoint(+d)).replace(/&amp;/g,"&");
 const text=(html:string)=>decode(html).replace(/<\s*(br|\/p|\/div|\/li)\s*[^>]*>/gi,"\n").replace(/<li[^>]*>/gi,"• ").replace(/<[^>]+>/g,"").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
 const blocks=opts.xml.match(/<item\b[\s\S]*?<\/item>/gi)||opts.xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[];
 return blocks.map(block=>{const tag=(name:string)=>{const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,`i`));return m?m[1]!.trim():""};let url=decode(tag("link"));if(!url)url=block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1]??"";const rawDate=tag("pubDate")||tag("updated")||tag("published"),date=rawDate?new Date(rawDate):null;const description=tag("description")||tag("summary"),content=tag("content:encoded")||tag("content");return {id:decode(tag("guid")||tag("id"))||url,title:text(tag("title")).replace(/\s+/g," ").trim(),url,author:text(tag("author")||tag("dc:creator"))||undefined,publishedAt:date&&!isNaN(+date)?date.toISOString():undefined,description:text(description)||undefined,content:text(content)||undefined}}).filter(item=>item.id&&item.title&&item.url);
}
