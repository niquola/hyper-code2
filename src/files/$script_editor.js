// CodeMirror 6 editor with autosave + optional vim mode.
// Config comes from window.__editor = { saveUrl, content, lang }.
// Lives at /files/editor.js via $script_ convention.
(async function () {
    const CDN = "https://esm.sh";
    const cfg = window.__editor;
    if (!cfg) return;

    const [view, state, lang, cmds, search, autocomplete, lint] = await Promise.all([
        import(CDN + "/@codemirror/view"),
        import(CDN + "/@codemirror/state"),
        import(CDN + "/@codemirror/language"),
        import(CDN + "/@codemirror/commands"),
        import(CDN + "/@codemirror/search"),
        import(CDN + "/@codemirror/autocomplete"),
        import(CDN + "/@codemirror/lint"),
    ]);
    const { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
        drawSelection, dropCursor, rectangularSelection, highlightSpecialChars } = view;
    const { EditorState } = state;
    const { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap } = lang;
    const { defaultKeymap, history, historyKeymap, indentWithTab } = cmds;
    const { searchKeymap, highlightSelectionMatches } = search;
    const { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } = autocomplete;
    const { lintKeymap } = lint;

    const langExt = [];
    if (cfg.lang) {
        try {
            const pkg = cfg.lang === "json" ? "javascript" : cfg.lang;
            const mod = await import(CDN + "/@codemirror/lang-" + pkg);
            if (cfg.lang === "json") langExt.push(mod.javascript({ jsx: false }));
            else if (cfg.lang === "javascript") langExt.push(mod.javascript({ jsx: true, typescript: true }));
            else if (typeof mod[cfg.lang] === "function") langExt.push(mod[cfg.lang]());
        } catch (e) { console.warn("lang load failed:", cfg.lang, e); }
    }

    const theme = EditorView.theme({
        "&": { height: "100%", fontSize: "12.5px" },
        ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
        ".cm-gutters": { background: "#f9fafb", borderRight: "1px solid #e5e7eb" },
        ".cm-activeLineGutter": { background: "#eef2ff" },
        ".cm-activeLine": { background: "#f5f3ff40" },
        ".cm-cursor": { borderLeftColor: "#111827" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { background: "#c7d2fe80" },
    });

    const statusEl = document.getElementById("save-status");
    let timer = null;
    function status(text, cls) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.className = "text-xs " + cls;
        statusEl.classList.remove("hidden");
    }

    const saveExt = EditorView.updateListener.of((u) => {
        if (!u.docChanged) return;
        if (timer) clearTimeout(timer);
        status("modified", "text-amber-600");
        timer = setTimeout(() => {
            const body = u.state.doc.toString();
            fetch(cfg.saveUrl, { method: "PUT", headers: { "content-type": "text/plain" }, body })
                .then(r => status(r.ok ? "saved" : "save failed", r.ok ? "text-green-600" : "text-red-600"))
                .catch(() => status("save failed", "text-red-600"));
        }, 800);
    });

    const extensions = [
        lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(),
        foldGutter(), drawSelection(), dropCursor(),
        EditorState.allowMultipleSelections.of(true), indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(), closeBrackets(), autocompletion(), rectangularSelection(),
        highlightActiveLine(), highlightSelectionMatches(),
        keymap.of([
            ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap,
            ...foldKeymap, ...completionKeymap, ...lintKeymap, indentWithTab,
        ]),
        theme, saveExt, ...langExt,
    ];

    const host = document.getElementById("cm-editor");
    let editor = new EditorView({
        state: EditorState.create({ doc: cfg.content, extensions }),
        parent: host,
    });
    window.__cmView = editor;

    const vimToggle = document.getElementById("vim-toggle");
    const vimStatus = document.getElementById("vim-status");
    let vimExt = null;

    async function enableVim() {
        if (!vimExt) {
            try {
                const m = await import(CDN + "/@replit/codemirror-vim@6");
                vimExt = m.vim();
            } catch (e) { console.warn("vim load failed:", e); return; }
        }
        editor.dispatch({ effects: state.StateEffect.appendConfig.of(vimExt) });
        if (vimStatus) { vimStatus.classList.remove("hidden"); vimStatus.textContent = "-- NORMAL --"; }
    }
    function disableVim() {
        const doc = editor.state.doc.toString();
        editor.destroy();
        editor = new EditorView({ state: EditorState.create({ doc, extensions }), parent: host });
        window.__cmView = editor;
        if (vimStatus) vimStatus.classList.add("hidden");
    }

    if (vimToggle) {
        if (localStorage.getItem("cm-vim") === "1") { vimToggle.checked = true; enableVim(); }
        vimToggle.addEventListener("change", () => {
            localStorage.setItem("cm-vim", vimToggle.checked ? "1" : "0");
            vimToggle.checked ? enableVim() : disableVim();
        });
    }

    editor.focus();
})();
