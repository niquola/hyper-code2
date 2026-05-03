// Render an §html body. The body is treated as a TSX expression.
// Bun.Transpiler turns it into calls to h(...) / Fragment, then we evaluate
// that with `ctx` and `agent` in scope and render the resulting node tree
// to a string. Auto-escapes text and attribute values. Plain HTML fragments
// without {expr} parse identically (the transpiler just passes them through),
// so static markup just works.
//
// Throws on parse / transpile / render error — caller (executeMarker) is
// responsible for catching and feeding it back to the model via
// describeTsxError + appendErrorEvent.

const Fragment = Symbol('Fragment');

function h(tag: any, props: any, ...children: any[]): any {
    return { tag, props: props ?? {}, children: children.flat(Infinity) };
}

const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function jsxRender(node: any): string {
    if (node == null || node === false || node === true) return '';
    if (typeof node === 'string' || typeof node === 'number') return Bun.escapeHTML(String(node));
    if (Array.isArray(node)) return node.map(jsxRender).join('');
    const { tag, props, children } = node;
    if (tag === Fragment) return (children ?? []).map(jsxRender).join('');
    if (typeof tag === 'function') return jsxRender(tag({ ...(props ?? {}), children: children ?? [] }));
    const attrs = Object.entries(props ?? {})
        .filter(([_, v]) => v != null && v !== false)
        .map(([k, v]) => v === true ? ` ${k}` : ` ${Bun.escapeHTML(k)}="${Bun.escapeHTML(String(v))}"`)
        .join('');
    if (VOID_TAGS.has(tag as string)) return `<${tag}${attrs}/>`;
    return `<${tag}${attrs}>${(children ?? []).map(jsxRender).join('')}</${tag}>`;
}

const TSX_TRANSPILER = new Bun.Transpiler({
    loader: 'tsx',
    tsconfig: JSON.stringify({
        compilerOptions: { jsx: 'react', jsxFactory: 'h', jsxFragmentFactory: 'Fragment' },
    }),
});

export default function (ctx: Context, body: string, agent: any): string {
    // Wrap in a Fragment so the body can be: a single element, multiple
    // siblings, or even an element followed by trailing prose. That last
    // shape happens often — Haiku writes a card then adds a comment after,
    // and a bare TSX `return (<div/> text);` would refuse.
    const js = TSX_TRANSPILER.transformSync(`return (<>${body}</>);`);
    const fn = new Function('h', 'Fragment', 'render', 'ctx', 'agent', js);
    const tree = fn(h, Fragment, jsxRender, ctx, agent);
    return jsxRender(tree);
}
