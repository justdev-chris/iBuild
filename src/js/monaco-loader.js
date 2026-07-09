// ─── MONACO-LOADER.JS ──────────────────────────────────────────
// Loads Monaco editor from CDN and configures Swift support.

(function() {
    // ─── LOAD MONACO ──────────────────────────────────────────
    function loadMonaco() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.monaco) {
                resolve(window.monaco);
                return;
            }

            // Load from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.39.0/min/vs/loader.js';
            script.onload = () => {
                require.config({
                    paths: {
                        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.39.0/min/vs'
                    }
                });

                require(['vs/editor/editor.main'], function() {
                    resolve(window.monaco);
                });
            };
            script.onerror = () => reject(new Error('Failed to load Monaco'));
            document.head.appendChild(script);
        });
    }

    // ─── CONFIGURE SWIFT ──────────────────────────────────────
    function configureSwift() {
        if (!window.monaco) return;

        // Register Swift as a language
        window.monaco.languages.register({ id: 'swift' });

        // Add basic syntax highlighting (simplified)
        window.monaco.languages.setMonarchTokensProvider('swift', {
            keywords: [
                'import', 'class', 'struct', 'func', 'var', 'let', 'if', 'else',
                'for', 'while', 'return', 'guard', 'switch', 'case', 'default',
                'break', 'continue', 'in', 'self', 'super', 'nil', 'true', 'false'
            ],
            typeKeywords: [
                'Int', 'String', 'Double', 'Float', 'Bool', 'Array', 'Dictionary',
                'Set', 'Any', 'Void', 'UIView', 'UIViewController', 'UIApplication'
            ],
            operators: [
                '=', '==', '!=', '>', '<', '>=', '<=', '&&', '||', '!', '+', '-',
                '*', '/', '%', '?', '??', '...', '..<'
            ],
            tokenizer: {
                root: [
                    [/\b(import|class|struct|func|var|let|if|else|for|while|return|guard|switch|case|default|break|continue|in|self|super|nil|true|false)\b/, 'keyword'],
                    [/\b(Int|String|Double|Float|Bool|Array|Dictionary|Set|Any|Void|UIView|UIViewController|UIApplication)\b/, 'type'],
                    [/\/\/.*$/, 'comment'],
                    [/\/\*/, 'comment', '@comment'],
                    [/".*?"/, 'string'],
                    [/\d+/, 'number'],
                    [/[=!<>]=?/, 'operator'],
                    [/[+\-*/%]/, 'operator'],
                    [/[(){}[\]]/, 'delimiter'],
                ],
                comment: [
                    [/\*\//, 'comment', '@pop'],
                    [/./, 'comment'],
                ],
            },
        });

        // Set default theme
        window.monaco.editor.defineTheme('dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'keyword', foreground: '569CD6' },
                { token: 'type', foreground: '4EC9B0' },
                { token: 'string', foreground: 'CE9178' },
                { token: 'comment', foreground: '6A9955' },
                { token: 'number', foreground: 'B5CEA8' },
                { token: 'operator', foreground: 'D4D4D4' },
            ],
            colors: {},
        });
    }

    // ─── CREATE EDITOR ──────────────────────────────────────────
    function createEditor(container, options = {}) {
        if (!window.monaco) {
            throw new Error('Monaco not loaded');
        }

        configureSwift();

        return window.monaco.editor.create(document.getElementById(container), {
            value: options.value || '',
            language: 'swift',
            theme: options.theme || 'dark',
            automaticLayout: true,
            minimap: { enabled: options.minimap !== false },
            fontSize: options.fontSize || 14,
            tabSize: options.tabSize || 4,
            insertSpaces: true,
            readOnly: options.readOnly || false,
            ...options,
        });
    }

    // ─── EXPOSE ──────────────────────────────────────────────────
    window.MonacoLoader = {
        load: loadMonaco,
        createEditor: createEditor,
        configureSwift: configureSwift,
    };
})();