import { describe, test, expect } from 'bun:test';
import respondHtmlFn from './respondHtml';

describe('agent.respondHtml', () => {
    test('returns a side-effect-free terminal payload', () => {
        const result = respondHtmlFn(null as any, null, {
            html: '<p>Hello</p>',
            text: 'Hello',
        });
        expect(result).toEqual({
            output: 'HTML response accepted; it will be sanitized and shown as the final answer.',
            terminal: { type: 'html', html: '<p>Hello</p>', text: 'Hello' },
        });
    });
});
