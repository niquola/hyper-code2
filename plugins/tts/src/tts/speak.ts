// Text → audio file via Google Cloud TTS. Long texts are chunked by sentence
// (~4500 bytes) and concatenated with ffmpeg. Markdown is stripped by default.
// ctx.fns.tts.speak({ text: "Привет", out: "/tmp/hi.ogg" })
// → { saved, seconds?, chunks }
async function accessToken(ctx: Context) {
    const cache = ((ctx.state as any).tts ??= {} as { token?: { access_token: string; expires_at: number } });
    if (cache.token && Date.now() < cache.token.expires_at - 60_000) return cache.token.access_token;
    const [tokenRaw, clientRaw] = await Promise.all([
        ctx.fns.secrets.resolve({ ref: "op://hyper/tts token.json/value" }),
        ctx.fns.secrets.resolve({ ref: "op://hyper/tts client_secret.json/value" }),
    ]);
    if (!tokenRaw || !clientRaw) throw new Error("Google Cloud TTS credentials are not configured");
    const token = JSON.parse(tokenRaw), secret = JSON.parse(clientRaw), creds = secret.installed || secret.web;
    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: token.refresh_token, grant_type: "refresh_token" }),
    });
    const json: any = await res.json();
    if (!res.ok || !json?.access_token) throw new Error(`TTS token refresh failed (${res.status})`);
    cache.token = { access_token: json.access_token, expires_at: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return cache.token.access_token;
}

export default async function (ctx: Context, session: Session | null, opts: {
    text: string;
    out?: string;                 // default /tmp/tts-<ts>.ogg
    voice?: string;               // default Chirp3-HD-Puck of the lang
    lang?: string;                // default ru-RU
    speed?: number;               // 0.25–4.0
    pitch?: number;               // -20…20 semitones
    format?: "OGG_OPUS" | "MP3" | "LINEAR16";
    strip?: boolean;              // strip markdown (default true)
}) {
    if (!opts?.text?.trim()) throw new Error("tts.speak: text is required");
    const access_token = await accessToken(ctx);
    const lang = opts.lang ?? "ru-RU";
    const voice = opts.voice ?? (lang.startsWith("en") ? "en-US-Chirp3-HD-Puck" : "ru-RU-Chirp3-HD-Puck");
    const format = opts.format ?? "OGG_OPUS";
    const ext = format === "MP3" ? "mp3" : format === "LINEAR16" ? "wav" : "ogg";
    const out = opts.out ?? `/tmp/tts-${Date.now()}.${ext}`;

    let text = opts.text;
    if (opts.strip !== false) {
        text = text
            .replace(/```[\s\S]*?```/g, "")
            .replace(/\|[^\n]+\|/g, "")
            .replace(/^#{1,6}\s+/gm, "")
            .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
            .replace(/[*_~`]/g, "")
            .replace(/^[-*]\s+/gm, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    // chunk by sentences, max ~4500 bytes
    const bytes = (s: string) => new TextEncoder().encode(s).length;
    const chunks: string[] = [];
    if (bytes(text) <= 4500) chunks.push(text);
    else {
        let cur = "";
        for (const s of text.split(/(?<=[.!?。\n])\s*/)) {
            const combined = cur ? cur + " " + s : s;
            if (bytes(combined) > 4500) { if (cur) chunks.push(cur); cur = s; }
            else cur = combined;
        }
        if (cur) chunks.push(cur);
    }

    const synth = async (t: string): Promise<Buffer> => {
        const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
            method: "POST",
            headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                input: t.startsWith("<speak>") ? { ssml: t } : { text: t },
                voice: { languageCode: lang, name: voice },
                audioConfig: {
                    audioEncoding: format,
                    ...(opts.speed ? { speakingRate: opts.speed } : {}),
                    ...(opts.pitch ? { pitch: opts.pitch } : {}),
                },
            }),
        });
        const json: any = await res.json();
        if (!res.ok || !json.audioContent) throw new Error(`TTS API error (${res.status}): ${JSON.stringify(json)}`);
        return Buffer.from(json.audioContent, "base64");
    };

    if (chunks.length === 1) {
        await Bun.write(out, await synth(chunks[0]!));
        return { saved: out, chunks: 1 };
    }

    // multi-chunk: synth in parallel, concat with ffmpeg
    const buffers = await Promise.all(chunks.map(synth));
    const tmpBase = `/tmp/tts-chunks-${Date.now()}`;
    const files: string[] = [];
    for (let i = 0; i < buffers.length; i++) {
        const f = `${tmpBase}-${i}.${ext}`;
        await Bun.write(f, buffers[i]!);
        files.push(f);
    }
    const listFile = `${tmpBase}-list.txt`;
    await Bun.write(listFile, files.map(f => `file '${f}'`).join("\n"));
    const proc = Bun.spawn(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", out], { stdout: "ignore", stderr: "pipe" });
    const code = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    for (const f of [...files, listFile]) await Bun.file(f).unlink().catch(() => {});
    if (code !== 0) throw new Error(`ffmpeg concat failed (${code}): ${stderr.slice(-500)}`);
    return { saved: out, chunks: chunks.length };
}
