/** Matches a candidate to a known Person using normalized phone or tolerant name forms. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Candidate display name. */ name?: string;
    /** Candidate phone number. */ phone?: string;
    /** Return every ranked match rather than only the best. @default false */ all?: boolean;
}): Promise<any> {
    await ctx.fns.knowledge.ensure({});
    const array = (value: any) => value == null ? [] : Array.isArray(value) ? value : [value];
    const phone = (value: any) => { const digits = String(value ?? "").replace(/\D/g, ""); return /^[78]\d{10}$/.test(digits) ? `+7${digits.slice(1)}` : digits ? `+${digits}` : null; };
    const words = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zа-яё ]/gi, " ").split(/\s+/).filter(Boolean);
    const sameName = (left: string, right: string) => { const a=words(left),b=words(right); if(!a.length||!b.length)return false; return a.every(word=>b.some(other=>other===word||other.startsWith(word)||word.startsWith(other))); };
    const wanted = phone(opts.phone);
    const matches: any[] = [];
    for (const row of await ctx.fns.procs.db.select({ sql: "SELECT id,data FROM knowledge.entities WHERE type='Person'", params: [] })) {
        const names = [row.data?.title, ...array(row.data?.human_name), ...array(row.data?.aka)].filter(Boolean);
        const phones = array(row.data?.phone).map(phone);
        let score=0,via="",matched:any=null;
        if (wanted && phones.includes(wanted)) { score=1; via="phone"; matched=wanted; }
        const hit = opts.name ? names.find((name: string)=>sameName(opts.name!,name)) : null;
        if (hit) { score=Math.max(score,score ? .97 : .82); via=via ? "phone+name" : "name"; matched=hit; }
        if(score) matches.push({ id:row.id,slug:String(row.id).split("/")[1],score,via,matched });
    }
    matches.sort((a,b)=>b.score-a.score);
    return opts.all ? matches : matches[0] ?? null;
}
