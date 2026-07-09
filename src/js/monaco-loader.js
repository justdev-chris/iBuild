// ─── MONACO-LOADER.JS ──────────────────────────────────────────
// Loads Monaco editor from CDN and configures Swift support.

(function() {
    const CDNS = [
        'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.53.0/min/vs/loader.js',
        'https://cdn.jsdelivr.net/npm/monaco-editor@0.54.0/min/vs/loader.js',
        'https://unpkg.com/monaco-editor@0.39.0/min/vs/loader.js'
    ];

    function loadMonaco() {
        return new Promise((resolve, reject) => {
            if (window.monaco) {
                resolve(window.monaco);
                return;
            }

            let attempts = 0;
            const maxAttempts = CDNS.length;

            function tryLoad() {
                if (attempts >= maxAttempts) {
                    reject(new Error('All CDN attempts failed'));
                    return;
                }
                const url = CDNS[attempts];
                attempts++;
                const script = document.createElement('script');
                script.src = url;
                script.onload = () => {
                    const baseUrl = url.replace('loader.js', '');
                    require.config({
                        paths: { vs: baseUrl }
                    });
                    require(['vs/editor/editor.main'], function() {
                        resolve(window.monaco);
                    });
                };
                script.onerror = () => {
                    console.warn('CDN failed:', url);
                    tryLoad();
                };
                document.head.appendChild(script);
            }

            tryLoad();
        });
    }

    // ─── CONFIGURE SWIFT ──────────────────────────────────────
    function configureSwift() {
        if (!window.monaco) return;
        window.monaco.languages.register({ id: 'swift' });
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

    function createEditor(container, options = {}) {
        if (!window.monaco) {
            throw new Error('Monaco not loaded');
        }
        configureSwift();
        return window.monaco.editor.create(document.getElementById(container), {
            value: options.value || '',
            language: 'swift',
            theme: 'dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            tabSize: 4,
            insertSpaces: true,
            ...options,
        });
    }

    window.MonacoLoader = {
        load: loadMonaco,
        createEditor: createEditor,
        configureSwift: configureSwift,
    };
})();