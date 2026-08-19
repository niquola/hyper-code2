import { createHash } from "node:crypto";
/** Computes the stable normalized content hash used for incremental RSS entry updates. */
export default function(_ctx:Context,_session:Session|null,opts:{
 /** Stable external entry identifier. */ id:string;
 /** Entry headline. */ title:string;
 /** Canonical entry URL. */ url:string;
 /** Optional author. */ author?:string;
 /** Optional ISO publication timestamp. */ publishedAt?:string;
 /** Feed-provided description. */ description?:string;
 /** Feed-provided content. */ content?:string;
}):string{const normalized={id:opts.id.trim(),title:opts.title.trim(),url:opts.url.trim(),author:(opts.author??"").trim(),publishedAt:opts.publishedAt??"",description:(opts.description??"").trim(),content:(opts.content??"").trim()};return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");}
