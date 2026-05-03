// Resolution chain:
//   1. DB row (explicit override).
//   2. Declared default — only for scope='global':
//        a. descriptor.env  → ctx.env[<that>] (parsed by descriptor.type)
//        b. descriptor.default
//   3. undefined (caller may use its own fallback).
type GetOpts = {
    module: string;
    scopeType: string;
    scopeId?: string | null;
    key: string;
};

function parseEnv(raw: string, type?: string): any {
    if (type === 'number')  return Number(raw);
    if (type === 'boolean') return raw === 'true' || raw === '1';
    return raw;
}

export default function (ctx: Context, opts: GetOpts): any {
    const row = ctx.fns.db.select<{ value: string }>(ctx, {
        sql: `SELECT value
           FROM settings
          WHERE module = ?
            AND scope_type = ?
            AND scope_id = ?
            AND key = ?`,
        params: [opts.module, opts.scopeType, opts.scopeId ?? '', opts.key],
    })[0];
    if (row) return JSON.parse(row.value);

    // Declared default — only consulted for scope='global'. Per-instance scopes
    // (per-agent / per-provider) by definition can't be pre-declared.
    if ((opts.scopeType ?? 'global') === 'global') {
        const desc = (ctx.state as any).settingsRegistry?.get(`${opts.module}.${opts.key}`);
        if (desc) {
            if (desc.env && ctx.env[desc.env] != null) {
                return parseEnv(String(ctx.env[desc.env]), desc.type);
            }
            if (desc.default !== undefined) return desc.default;
        }
    }

    return undefined;
}
