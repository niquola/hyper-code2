// Lists every declared setting (from $setting_*.ts files registered into
// ctx.state.settingsRegistry) with its current resolved value and source.
// Used by the /settings/declared UI route — DB is consulted to detect overrides
// but is never written from here.
type DeclaredItem = {
    module: string;
    key: string;
    descriptor: any;
    currentValue: any;
    source: 'db' | 'env' | 'default';
};

export default function (ctx: Context): DeclaredItem[] {
    const registry: Map<string, any> | undefined = (ctx.state as any).settingsRegistry;
    if (!registry) return [];

    const out: DeclaredItem[] = [];
    for (const [regKey, descriptor] of registry.entries()) {
        const dotIdx = regKey.indexOf('.');
        if (dotIdx <= 0) continue;
        const module = regKey.slice(0, dotIdx);
        const key = regKey.slice(dotIdx + 1);

        // Detect provenance.
        const dbRow = ctx.fns.db.select<{ value: string }>(ctx, {
            sql: "SELECT value FROM settings WHERE module = ? AND scope_type = 'global' AND scope_id = '' AND key = ?",
            params: [module, key],
        })[0];

        let source: 'db' | 'env' | 'default';
        let currentValue: any;
        if (dbRow) {
            source = 'db';
            currentValue = JSON.parse(dbRow.value);
        } else if (descriptor.env && ctx.env[descriptor.env] != null) {
            source = 'env';
            const raw = String(ctx.env[descriptor.env]);
            currentValue = descriptor.type === 'number' ? Number(raw)
                : descriptor.type === 'boolean' ? (raw === 'true' || raw === '1')
                : raw;
        } else {
            source = 'default';
            currentValue = descriptor.default;
        }

        out.push({ module, key, descriptor, currentValue, source });
    }

    out.sort((a, b) => (a.module + a.key).localeCompare(b.module + b.key));
    return out;
}
