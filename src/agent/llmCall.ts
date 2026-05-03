export default async function (
    ctx: Context,
    opts: {
        agent: types.agent.Agent;
        user: string;
        system?: string;
        model?: string;
        temperature?: number;
        max_tokens?: number;
        response_format?: any;
    },
): Promise<{ text: string; finishReason: string | null; usage: any; raw: any }> {
    const { agent } = opts;
    const user = String(opts?.user ?? '').trim();
    const system = String(opts?.system ?? '').trim();
    const model = String(opts?.model ?? agent.model ?? '').trim();

    if (!user) throw new Error('llmCall: user is required');
    if (!model) throw new Error('llmCall: model is required');

    const ep = ctx.fns.llm.resolveEndpoint(ctx, { model });

    if (ep.api === 'responses') {
        const apiKey = await ctx.fns.llm.refreshCodex(ctx) ?? ep.apiKey;
        if (!apiKey) throw new Error('codex: no access_token');
        const accountId = extractAccountId(apiKey);

        const body: any = {
            model: ep.modelId,
            store: false,
            stream: true,
            instructions: system || 'You are a helpful assistant.',
            input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: user }] }],
            text: { verbosity: 'low' },
        };

        const res = await fetch(ep.url, {
            method: 'POST',
            headers: {
                authorization: 'Bearer ' + apiKey,
                'chatgpt-account-id': accountId,
                originator: 'hyper-code2',
                'OpenAI-Beta': 'responses=experimental',
                'content-type': 'application/json',
                session_id: agent.id,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(ep.provider + ' ' + res.status + ': ' + await res.text());

        const raw = await readResponsesSSE(res);
        const text = extractResponsesText(raw);
        return {
            text,
            finishReason: mapResponsesFinishReason(raw),
            usage: raw?.usage,
            raw,
        };
    }

    const messages: any[] = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });

    const body: any = {
        model: ep.modelId,
        messages,
        stream: false,
    };

    if (opts?.temperature != null) body.temperature = opts.temperature;
    if (opts?.max_tokens != null) body.max_tokens = opts.max_tokens;
    if (opts?.response_format != null) body.response_format = opts.response_format;

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (ep.apiKey) headers.authorization = 'Bearer ' + ep.apiKey;

    const res = await fetch(ep.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(ep.provider + ' ' + res.status + ': ' + await res.text());

    const raw = await res.json() as any;
    const choice = raw?.choices?.[0] ?? {};
    const text = String(choice?.message?.content ?? '');

    return {
        text,
        finishReason: choice?.finish_reason ?? null,
        usage: raw?.usage,
        raw,
    };
}

function extractResponsesText(raw: any): string {
    if (typeof raw?.output_text === 'string' && raw.output_text) return raw.output_text;
    const out = Array.isArray(raw?.output) ? raw.output : [];
    const parts: string[] = [];
    for (const item of out) {
        if (item?.type === 'message') {
            const content = Array.isArray(item?.content) ? item.content : [];
            for (const block of content) {
                if (typeof block?.text === 'string') parts.push(block.text);
                else if (typeof block?.output_text === 'string') parts.push(block.output_text);
            }
        }
    }
    return parts.join('');
}

function mapResponsesFinishReason(raw: any): string | null {
    const status = raw?.status;
    if (status === 'completed') return 'stop';
    if (status === 'incomplete') {
        const reason = raw?.incomplete_details?.reason;
        if (reason === 'max_output_tokens') return 'length';
        return reason ?? 'incomplete';
    }
    return status ?? null;
}

function extractAccountId(token: string): string {
    try {
        const payload = token.split('.')[1];
        if (!payload) throw new Error('no payload');
        const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
        const id = json?.['https://api.openai.com/auth']?.chatgpt_account_id;
        if (!id) throw new Error('no chatgpt_account_id');
        return id;
    } catch (e: any) {
        throw new Error('codex: cannot read account id from token: ' + e?.message);
    }
}

async function readResponsesSSE(res: Response): Promise<any> {
    if (!res.body) throw new Error('codex: empty response body');
    let response: any = null;
    for await (const ev of parseSSE(res.body)) {
        if (ev?.type === 'response.output_text.delta' && typeof ev.delta === 'string') {
            response ??= { output: [{ type: 'message', content: [{ type: 'output_text', text: '' }] }] };
            const msg = response.output[0];
            msg.content ??= [{ type: 'output_text', text: '' }];
            if (!msg.content[0]) msg.content[0] = { type: 'output_text', text: '' };
            msg.content[0].text = String(msg.content[0].text ?? '') + ev.delta;
        }
        if (ev?.type === 'response.completed' || ev?.type === 'response.incomplete' || ev?.type === 'response.failed') {
            const finalResponse = ev.response ?? {};
            if (response?.output?.[0]?.content?.[0]?.text && (!finalResponse.output || finalResponse.output.length === 0)) {
                finalResponse.output = response.output;
            }
            return finalResponse;
        }
    }
    return response ?? {};
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of body) {
        buf += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataLines: string[] = [];
            for (const line of raw.split('\n')) {
                if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
            }
            if (!dataLines.length) continue;
            const data = dataLines.join('\n').trim();
            if (!data || data === '[DONE]') continue;
            try { yield JSON.parse(data); } catch {}
        }
    }
}
