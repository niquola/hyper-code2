import { expect, test } from 'bun:test';
import submit from './submit';

test('secureInput.submit resolves and clears the in-memory prompt', async () => {
    let value = '';
    const prompts = new Map([['p1', { id: 'p1', kind: 'otp', resolve: (v: string) => value = v, reject: () => {} }]]);
    const ctx: any = { state: { secureInput: { prompts } }, fns: { secureInput: { render: () => '' } } };
    const res = submit(ctx, null, { id: 'p1', value: '12 34' });
    expect(res.status).toBe(200);
    expect(value).toBe('1234');
    expect(prompts.has('p1')).toBe(false);
});
