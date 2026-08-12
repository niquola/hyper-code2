// Fetch a YouTube video transcript via yt-dlp (manual subs preferred, else auto).
//   ctx.fns.youtube.transcript({ id: "orDbkEp2738", lang?: "en" })
// → { id, lang, source: "manual"|"auto"|"none", text, words }
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function cleanVtt(vtt: string): string {
    const lines = vtt.split(/\r?\n/);
    const out: string[] = [];
    let last = "";
    for (let l of lines) {
        if (/^WEBVTT/.test(l) || /^(Kind|Language):/.test(l)) continue;
        if (l.includes("-->")) continue;
        if (/^\s*$/.test(l)) continue;
        if (/^\d+$/.test(l.trim())) continue;            // cue numbers
        l = l.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
        if (!l) continue;
        if (l === last) continue;                         // consecutive dupes (auto-caption rolling)
        // drop if fully contained in the previous line (rolling overlap)
        if (last && (last.endsWith(l) || last.includes(l))) continue;
        out.push(l);
        last = l;
    }
    return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

export default async function (ctx: Context, _session: Session | null, opts: { id: string; lang?: string }) {
    const id = (opts.id || "").match(/[\w-]{11}/)?.[0] || opts.id;
    const lang = opts.lang || "en";
    const dir = mkdtempSync(join(tmpdir(), "yt-"));
    try {
        const url = `https://www.youtube.com/watch?v=${id}`;
        await Bun.$`yt-dlp --skip-download --write-subs --write-auto-subs --sub-langs ${`${lang}.*,${lang}`} --sub-format vtt -o ${join(dir, "%(id)s.%(ext)s")} ${url}`.quiet().nothrow();
        const files = readdirSync(dir).filter(f => f.endsWith(".vtt"));
        if (!files.length) return { id, lang, source: "none", text: "", words: 0 };
        // prefer a manual track (filename like <id>.en.vtt) over auto (<id>.en-orig / a.en)
        const manual = files.find(f => new RegExp(`\\.${lang}\\.vtt$`).test(f));
        const pick = manual || files[0]!;
        const source = manual ? "manual" : "auto";
        const text = cleanVtt(readFileSync(join(dir, pick), "utf8"));
        return { id, lang, source, file: pick, text, words: text ? text.split(/\s+/).length : 0 };
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
