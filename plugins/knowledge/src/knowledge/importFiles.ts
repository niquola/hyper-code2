import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Imports every legacy knowledge-base Markdown entity and provenance NDJSON observation. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Source repository root. @default ~/knowledge-base */ dir?: string;
    /** Remove entities absent from the source after import. @default false */ prune?: boolean;
} = {}): Promise<{ files: number; entities: number; provenanceFiles: number; observations: number; skipped: string[] }> {
    await ctx.fns.knowledge.ensure({});
    const home = ctx.env.HOME ?? process.env.HOME ?? "";
    const root = (opts.dir ?? join(home, "knowledge-base")).replace(/^~(?=\/)/, home);
    const parse = (text: string) => { const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text); if(!match) return {meta:{},body:text.trim()}; try { return { meta: Bun.YAML.parse(match[1]!) ?? {}, body: (match[2] ?? "").trim() }; } catch { const meta:any={}; for(const line of match[1]!.split(/\r?\n/)){ const cut=line.indexOf(":"); if(cut<1) continue; const key=line.slice(0,cut).trim(),raw=line.slice(cut+1).trim(); meta[key]=raw.startsWith("[")&&raw.endsWith("]") ? raw.slice(1,-1).split(",").map(v=>v.trim()).filter(Boolean) : raw === "true" ? true : raw === "false" ? false : raw; } return {meta,body:(match[2]??"").trim()}; } };
    const seen: string[] = [], skipped: string[] = [];
    let files=0,observations=0,provenanceFiles=0;
    for (const type of await readdir(root)) {
        let names: string[]; try { names=await readdir(join(root,type)); } catch { continue; }
        for (const name of names.filter(name=>name.endsWith(".md"))) {
            const id=`${type}/${name.slice(0,-3)}`;
            try {
                const { meta, body }=parse(await readFile(join(root,type,name),"utf8"));
                const { type: mixin, ...rest }=meta as any;
                const data:any={...rest,base_type:`Entity/${type}`};
                if(Array.isArray(mixin)) data.type=mixin;
                if(body) data.body=body;
                await ctx.fns.knowledge.upsert({id,data,replace:true,rebuild:false});
                seen.push(id); files++;
            } catch(error:any) { skipped.push(`${id}: ${error?.message ?? error}`); }
        }
        for (const name of names.filter(name=>name.endsWith(".provenance.ndjson"))) {
            provenanceFiles++;
            const subject=`${type}/${name.slice(0,-".provenance.ndjson".length)}`;
            await ctx.fns.procs.db.run({sql:"DELETE FROM knowledge.provenance WHERE subject=?",params:[subject]});
            const text=await readFile(join(root,type,name),"utf8");
            for (const line of text.split(/\r?\n/).filter(Boolean)) {
                const item=JSON.parse(line);
                const attribute=String(item.attr ?? item.attribute ?? "").trim();
                if(!attribute) { skipped.push(`${subject}: provenance missing attribute`); continue; }
                await ctx.fns.knowledge.observe({subject,attribute,value:item.value,source:item.source ?? "legacy-file",url:item.url,evidence:item.evidence,confidence:item.confidence,observedAt:item.at ?? item.observed_at,status:item.status});
                observations++;
            }
        }
    }
    if(opts.prune && seen.length) await ctx.fns.procs.db.run({sql:`DELETE FROM knowledge.entities WHERE id NOT IN (${seen.map(()=>"?").join(",")})`,params:seen});
    await ctx.fns.knowledge.resolve({});
    await ctx.fns.knowledge.rebuildSearch({});
    return { files, entities: seen.length, provenanceFiles, observations, skipped };
}
