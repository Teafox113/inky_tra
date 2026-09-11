const forkInfo = require('../version.json');
/**
 * translationView.js
 * Inky 翻譯功能 UI — 支援 OpenRouter 登入、模型選擇、計費追蹤
 */

const ipc = require('electron').ipcRenderer;

let _inkProject    = null;
let _editorView    = null;
let _isTranslating = false;

// OpenRouter 登入狀態
let _orModels      = [];      // 完整模型陣列
let _orLoggedIn    = false;
let _sessionApiKey = '';      // 本次工作階段用的 key（可能未持久化）

// 計費追蹤
let _lastCost    = { inputTokens: 0, outputTokens: 0, usdCost: 0 };
let _sessionCost = { inputTokens: 0, outputTokens: 0, usdCost: 0 };

// ── UI i18n ─────────────────────────────────────────────
let _uiLang = 'zh-TW';

const _STRINGS = {
    'zh-TW': {
        'settings.title':       '翻譯設定',
        'tab.or':               'OpenRouter',
        'tab.other':            '其他 API',
        'or.key.label':         'OpenRouter API Key',
        'or.remember':          '記住 API Key（將加密存於本機設定，不會上傳至任何伺服器）',
        'or.login':             '取得模型清單 / 登入',
        'or.provider':          '提供商',
        'or.all.providers':     '全部提供商',
        'or.model':             '模型',
        'or.logout':            '登出',
        'other.url':            'API URL',
        'other.key':            'API Key',
        'other.model':          '模型名稱',
        'other.test':           '測試連線',
        'section.trans':        '翻譯設定',
        'max.tokens':           '每次請求 Max Tokens',
        'glossary':             '詞彙表路徑（CSV）',
        'browse':               '瀏覽',
        'output.dir':           '翻譯輸出目錄（整個專案翻譯時使用）',
        'lang.label':           '翻譯語言',
        'lang.from':            '從',
        'lang.to':              '至',
        'prompt.label':         '系統提示詞',
        'prompt.regen':         '↻ 依語言重新生成',
        'adult.consent':        '我確認我的 API 服務接受成人 / 限制級內容，且我已年滿 18 歲',
        'adult.warn':           '⚠️ 此遊戲包含成人內容。未勾選此項目將無法啟動翻譯。',
        'cost.title':           '💰 費用追蹤',
        'cost.last':            '上次請求',
        'cost.session':         '本次工作階段',
        'cost.total':           '累計總計',
        'cost.input':           '輸入 tokens',
        'cost.output':          '輸出 tokens',
        'cost.usd':             '費用 (USD)',
        'cost.reset':           '重置本次工作階段計費',
        'ui.lang':              '介面語言',
        'cancel':               '取消',
        'save':                 '儲存設定',
        'fr.search.ph':         '搜尋...',
        'fr.replace.ph':        '取代為...',
        'fr.replace.btn':       '取代',
        'fr.replace.all':       '全部取代',
        'fr.case.lbl':          'Aa 大小寫',
        'fr.regex.lbl':         '.* 正則',
        'fr.not.found':         '找不到',
        'fr.regex.err':         '正則錯誤',
        'fr.replaced.n':        n => `已取代 ${n} 處`,
        'progress.cancel':      '取消',
        'progress.ready':       '準備中...',
        'progress.n.lines':     (d,tot,p) => `${d} / ${tot} 行 (${p}%)`,
        'progress.file.n':      (i,tot,f) => `檔案 ${i}/${tot}：${f}`,
        'about.title':          'Inky 翻譯強化版',
        'about.tab.features':   '🛠 功能說明',
        'about.tab.llm':        '🤖 接 LLM',
        'about.tab.shortcuts':  '⌨️ 快捷鍵',
        'about.tab.creator':    '👤 製作者',
        'sc.trans.file':        '翻譯目前檔案',
        'sc.trans.project':     '翻譯整個專案',
        'sc.trans.sel':         '翻譯選取文字',
        'sc.find.replace':      '開啟搜尋 &amp; 取代',
        'sc.settings':          '翻譯設定',
        'sc.about':             '使用說明（此頁面）',
        'sc.orig.header':       '—— 原版 Inky 快捷鍵 ——',
        'sc.orig.compile':      '編譯 ink 檔',
        'sc.orig.save':         '儲存檔案',
        'sc.orig.new':          '新增 ink 檔',
        'sc.orig.open':         '開啟 ink 檔',
        'sc.orig.replay':       '重新播放故事',
        'sc.orig.sidebar':      '切換側欄',
        'creator.added':        '此版本新增功能：',
        'creator.original':     '原始 Inky 編輯器：',
        'creator.original.by':  '由 inkle Ltd 開發，MIT 授權開源。',
        'creator.ink.lang':     'ink 腳本語言：',
        'creator.ink.by':       '由 inkle Ltd 開發，用於互動敘事遊戲創作。',
        'alert.no_project':     '請先開啟一個 ink 專案',
        'alert.no_editor':      '無法存取編輯器，請確認 Inky 編輯器已開啟',
        'alert.no_sel':         '請先用滑鼠拖曳選取要翻譯的文字，再按「譯選」。',
        'confirm.no_consent':   '請先到翻譯設定確認 API 接受成人內容。\n是否現在開啟設定？',
        'confirm.no_key':       '尚未設定 API Key。是否現在開啟設定？',
        'confirm.no_output':    '尚未設定翻譯輸出目錄。是否現在開啟設定？',
        'confirm.project':      (n,dir) => `翻譯整個專案 (${n} 個 .ink 檔)？\n輸出目錄：${dir}\n\n原始檔案不會被修改。`,
        'toast.saved':          '翻譯設定已儲存 ✓',
        'toast.translating':    '翻譯中...',
        'save.failed':          '儲存設定失敗，請確認路徑權限',
        'testing':              '測試中...',
        'model.selected':       '已選：',
    },
    'en': {
        'settings.title':       'Translation Settings',
        'tab.or':               'OpenRouter',
        'tab.other':            'Other API',
        'or.key.label':         'OpenRouter API Key',
        'or.remember':          'Remember API Key (encrypted locally, never uploaded to any server)',
        'or.login':             'Fetch Models / Login',
        'or.provider':          'Provider',
        'or.all.providers':     'All Providers',
        'or.model':             'Model',
        'or.logout':            'Logout',
        'other.url':            'API URL',
        'other.key':            'API Key',
        'other.model':          'Model Name',
        'other.test':           'Test Connection',
        'section.trans':        'Translation Settings',
        'max.tokens':           'Max Tokens per Request',
        'glossary':             'Glossary Path (CSV)',
        'browse':               'Browse',
        'output.dir':           'Output Directory (for full project translation)',
        'lang.label':           'Translation Language',
        'lang.from':            'From',
        'lang.to':              'To',
        'prompt.label':         'System Prompt',
        'prompt.regen':         '↻ Regenerate by Language',
        'adult.consent':        'I confirm my API accepts adult/explicit content and I am 18+',
        'adult.warn':           '⚠️ This game contains adult content. Translation disabled until checked.',
        'cost.title':           '💰 Cost Tracker',
        'cost.last':            'Last Request',
        'cost.session':         'This Session',
        'cost.total':           'All Time',
        'cost.input':           'Input tokens',
        'cost.output':          'Output tokens',
        'cost.usd':             'Cost (USD)',
        'cost.reset':           'Reset Session Cost',
        'ui.lang':              'UI Language',
        'cancel':               'Cancel',
        'save':                 'Save Settings',
        'fr.search.ph':         'Search...',
        'fr.replace.ph':        'Replace with...',
        'fr.replace.btn':       'Replace',
        'fr.replace.all':       'Replace All',
        'fr.case.lbl':          'Aa Case',
        'fr.regex.lbl':         '.* Regex',
        'fr.not.found':         'Not found',
        'fr.regex.err':         'Regex error',
        'fr.replaced.n':        n => `Replaced ${n}`,
        'progress.cancel':      'Cancel',
        'progress.ready':       'Preparing...',
        'progress.n.lines':     (d,tot,p) => `${d} / ${tot} lines (${p}%)`,
        'progress.file.n':      (i,tot,f) => `File ${i}/${tot}: ${f}`,
        'about.title':          'Inky Translation Enhanced',
        'about.tab.features':   '🛠 Features',
        'about.tab.llm':        '🤖 Connect LLM',
        'about.tab.shortcuts':  '⌨️ Shortcuts',
        'about.tab.creator':    '👤 Creator',
        'sc.trans.file':        'Translate Current File',
        'sc.trans.project':     'Translate Entire Project',
        'sc.trans.sel':         'Translate Selection',
        'sc.find.replace':      'Find &amp; Replace',
        'sc.settings':          'Translation Settings',
        'sc.about':             'About / Help (this page)',
        'sc.orig.header':       '—— Original Inky shortcuts ——',
        'sc.orig.compile':      'Compile ink',
        'sc.orig.save':         'Save file',
        'sc.orig.new':          'New ink file',
        'sc.orig.open':         'Open ink file',
        'sc.orig.replay':       'Restart story',
        'sc.orig.sidebar':      'Toggle sidebar',
        'creator.added':        'Features added in this fork:',
        'creator.original':     'Original Inky editor:',
        'creator.original.by':  'Developed by inkle Ltd, MIT license.',
        'creator.ink.lang':     'ink scripting language:',
        'creator.ink.by':       'Developed by inkle Ltd for interactive narrative.',
        'alert.no_project':     'Please open an ink project first',
        'alert.no_editor':      'Cannot access editor, please ensure Inky is open',
        'alert.no_sel':         'Please select text in the editor before translating.',
        'confirm.no_consent':   'Please confirm your API accepts adult content in settings.\nOpen settings now?',
        'confirm.no_key':       'No API Key set. Open settings now?',
        'confirm.no_output':    'No output directory set. Open settings now?',
        'confirm.project':      (n,dir) => `Translate entire project (${n} .ink files)?\nOutput: ${dir}\n\nOriginal files will not be modified.`,
        'toast.saved':          'Settings saved ✓',
        'toast.translating':    'Translating...',
        'save.failed':          'Failed to save settings, check path permissions',
        'testing':              'Testing...',
        'model.selected':       'Selected: ',
    }
};

/** i18n 查詢：支援函式型字串（t('key', arg1, arg2)） */
function t(key, ...args) {
    const dict = _STRINGS[_uiLang] || _STRINGS['zh-TW'];
    const s = dict[key] !== undefined ? dict[key] : (_STRINGS['zh-TW'][key] ?? key);
    return typeof s === 'function' ? s(...args) : s;
}

/** 語言切換後重建所有 UI 元件 */
function _rebuildUI() {
    ['trans-overlay', 'about-overlay', 'trans-progress-panel', 'trans-fr-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    _frPanel = null;
    _buildProgressPanel();
    _buildSettingsModal();
    _buildFindReplace();
    _buildAboutModal();
}

// ── 初始化 ─────────────────────────────────────────────
async function init(inkProject, editorView) {
    _inkProject = inkProject;
    _editorView = editorView;

    // 讀取上次儲存的介面語言
    try {
        const s = await ipc.invoke('translation-get-settings');
        if (s && s.uiLanguage) _uiLang = s.uiLanguage;
    } catch(e) { /* 保持預設 zh-TW */ }

    ipc.on('translation-translate-current',  () => translateCurrentFile());
    ipc.on('translation-translate-project',  () => translateProject());
    ipc.on('translation-open-settings',      () => openSettingsDialog());
    ipc.on('translation-show-usage',         () => openSettingsDialog());
    ipc.on('translation-progress',   (event, data) => updateProgress(data));
    ipc.on('translation-file-start', (event, data) => updateFileProgress(data));
    ipc.on('translation-find-replace',       () => openFindReplace());
    ipc.on('translation-open-about',         () => openAboutModal());

    _injectStyles();
    _buildProgressPanel();
    _buildSettingsModal();
    _buildFindReplace();
    _buildAboutModal();

    // 鍵盤快捷鍵
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            translateSelection();
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'T') {
            e.preventDefault();
            translateCurrentFile();
        }
        // Ctrl+H：開啟搜尋取代
        if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'h') {
            e.preventDefault();
            openFindReplace();
        }
    });
}

// ── CSS 注入 ────────────────────────────────────────────
function _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
/* ===== 翻譯設定 Modal ===== */
#trans-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; align-items: center; justify-content: center;
    z-index: 9000; display: none;
}
#trans-modal {
    background: #1c1c1e; border: 1px solid #3a3a3c; border-radius: 10px;
    width: 560px; max-width: 96vw; max-height: 90vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.tm-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px 10px; border-bottom: 1px solid #3a3a3c;
}
.tm-header h2 { margin: 0; font-size: 15px; font-weight: 700; color: #f0f0f0; }
.tm-close { background: none; border: none; color: #999; font-size: 18px;
    cursor: pointer; padding: 2px 6px; border-radius: 4px; line-height: 1; }
.tm-close:hover { color: #fff; background: #3a3a3c; }

.tm-body { flex: 1; overflow-y: auto; padding: 14px 18px; }

/* ── API 切換 Tabs ── */
.tm-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.tm-tab {
    padding: 5px 14px; border-radius: 20px; font-size: 12px; cursor: pointer;
    border: 1px solid #3a3a3c; color: #aaa; background: transparent;
    transition: all 0.15s;
}
.tm-tab.active { background: #0a84ff; border-color: #0a84ff; color: #fff; }

/* ── OpenRouter 登入面板 ── */
.or-login-panel, .or-loggedin-panel { display: none; }
.or-login-panel.visible, .or-loggedin-panel.visible { display: block; }

.or-key-row { position: relative; margin-bottom: 8px; }
.or-key-row input[type="password"],
.or-key-row input[type="text"] {
    width: 100%; padding: 9px 40px 9px 10px;
    background: #2c2c2e; border: 1px solid #3a3a3c; color: #f0f0f0;
    border-radius: 6px; font-size: 13px; font-family: monospace;
    box-sizing: border-box;
}
.or-key-row input:focus { outline: none; border-color: #0a84ff; }
.or-eye-btn {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: #888; cursor: pointer; font-size: 14px;
}
.or-eye-btn:hover { color: #ccc; }

.or-remember-row {
    display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px;
    border: 1px solid rgba(255,170,61,0.3); background: rgba(255,170,61,0.05);
    border-radius: 6px; margin-bottom: 10px;
}
.or-remember-row input[type="checkbox"] { margin-top: 2px; accent-color: #0a84ff; flex-shrink: 0; }
.or-remember-row label { font-size: 11px; color: #ffaa3d; line-height: 1.5; cursor: pointer; }

.or-login-btn {
    width: 100%; padding: 10px; background: #0a84ff; border: none;
    border-radius: 6px; color: #fff; font-size: 13px; font-weight: 700;
    cursor: pointer; transition: background 0.15s;
}
.or-login-btn:hover { background: #0070d8; }
.or-login-btn:disabled { background: #555; cursor: not-allowed; }

/* ── 提供商 + 模型選擇 ── */
.or-filter-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.or-filter-row label { font-size: 11px; color: #aaa; flex-shrink: 0; }
.or-filter-row select, .or-model-select {
    flex: 1; padding: 7px 10px; background: #2c2c2e; border: 1px solid #3a3a3c;
    color: #f0f0f0; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.or-filter-row select:focus, .or-model-select:focus {
    outline: none; border-color: #0a84ff;
}
.or-model-row { margin-bottom: 10px; }
.or-model-row label { font-size: 11px; color: #aaa; display: block; margin-bottom: 4px; }
.or-logout-btn {
    padding: 5px 14px; background: transparent;
    border: 1px solid #ff453a; color: #ff453a; border-radius: 4px;
    font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.or-logout-btn:hover { background: rgba(255,69,58,0.15); }

/* ── 其他 API 面板 ── */
.other-api-panel { display: none; }
.other-api-panel.visible { display: block; }

/* ── 通用設定區 ── */
.tm-section { margin-bottom: 16px; }
.tm-section-title {
    font-size: 11px; color: #888; text-transform: uppercase;
    letter-spacing: 0.8px; margin-bottom: 8px; font-weight: 600;
}
.tm-field { margin-bottom: 8px; }
.tm-field label { display: block; font-size: 12px; color: #bbb; margin-bottom: 4px; }
.tm-field input[type="text"],
.tm-field input[type="password"],
.tm-field input[type="number"],
.tm-field textarea {
    width: 100%; padding: 8px 10px; background: #2c2c2e;
    border: 1px solid #3a3a3c; color: #f0f0f0;
    border-radius: 6px; font-size: 12px; box-sizing: border-box;
}
.tm-field textarea { font-family: monospace; resize: vertical; }
.tm-field input:focus, .tm-field textarea:focus {
    outline: none; border-color: #0a84ff;
}
.tm-field-row { display: flex; gap: 6px; align-items: center; }
.tm-field-row input { flex: 1; }
.tm-field-row button {
    padding: 7px 12px; background: #2c2c2e; border: 1px solid #3a3a3c;
    color: #ccc; border-radius: 6px; font-size: 11px; cursor: pointer; white-space: nowrap;
}
.tm-field-row button:hover { border-color: #0a84ff; color: #0a84ff; }

.tm-consent-box {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px; border: 1px solid #3a3a3c;
    background: #2c2c2e; border-radius: 6px;
}
.tm-consent-box input { margin-top: 2px; accent-color: #0a84ff; flex-shrink: 0; }
.tm-consent-box label { font-size: 12px; color: #ccc; cursor: pointer; line-height: 1.5; }
.tm-adult-warn { font-size: 11px; color: #ff9f0a; margin-top: 6px; }

/* ── 語言選擇器 ── */
.tm-lang-row {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.tm-lang-row label { font-size: 11px; color: #aaa; flex-shrink: 0; min-width: 40px; }
.tm-lang-row select {
    flex: 1; padding: 7px 10px; background: #2c2c2e; border: 1px solid #3a3a3c;
    color: #f0f0f0; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.tm-lang-row select:focus { outline: none; border-color: #0a84ff; }
.tm-lang-arrow { font-size: 16px; color: #555; flex-shrink: 0; }
.tm-regen-btn {
    padding: 5px 10px; background: transparent; border: 1px solid #3a3a3c;
    color: #0a84ff; border-radius: 5px; font-size: 11px; cursor: pointer;
    white-space: nowrap; transition: all 0.15s;
}
.tm-regen-btn:hover { background: rgba(10,132,255,0.1); border-color: #0a84ff; }

/* ── 計費追蹤 ── */
.tm-cost-section { margin-top: 4px; margin-bottom: 2px; }
.tm-cost-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
}
.tm-cost-col { background: #2c2c2e; border: 1px solid #3a3a3c; border-radius: 6px; padding: 8px; }
.tm-cost-col-title { font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 4px; text-align: center; }
.tm-cost-item { display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; color: #bbb; margin-bottom: 2px; }
.tm-cost-item .cost-val {
    font-family: monospace; font-size: 11px; color: #f0f0f0; font-weight: 600;
}
.tm-cost-item.cost-usd .cost-val { color: #30d158; }
.tm-reset-btn {
    margin-top: 8px; padding: 4px 10px; font-size: 11px;
    background: transparent; border: 1px solid #3a3a3c; color: #888;
    border-radius: 4px; cursor: pointer;
}
.tm-reset-btn:hover { border-color: #ff9f0a; color: #ff9f0a; }

/* ── Modal 底部 ── */
.tm-footer {
    display: flex; justify-content: flex-end; gap: 8px;
    padding: 12px 18px; border-top: 1px solid #3a3a3c;
}
.tm-btn-cancel {
    padding: 8px 18px; background: transparent;
    border: 1px solid #3a3a3c; color: #bbb; border-radius: 6px;
    font-size: 13px; cursor: pointer;
}
.tm-btn-cancel:hover { border-color: #888; color: #fff; }
.tm-btn-save {
    padding: 8px 20px; background: #0a84ff;
    border: none; color: #fff; border-radius: 6px;
    font-size: 13px; font-weight: 700; cursor: pointer;
}
.tm-btn-save:hover { background: #0070d8; }

.tm-test-result { font-size: 11px; margin-top: 5px; }
.tm-test-result.ok  { color: #30d158; }
.tm-test-result.err { color: #ff453a; }

/* ===== 翻譯進度面板 ===== */
#trans-progress-panel {
    position: fixed; bottom: 16px; right: 16px; width: 320px;
    background: #1c1c1e; border: 1px solid #3a3a3c; border-radius: 10px;
    padding: 12px 14px; z-index: 8000; display: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.tp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.tp-title  { font-size: 13px; font-weight: 700; color: #f0f0f0; }
.tp-cancel { background: none; border: 1px solid #555; color: #bbb; padding: 3px 10px;
    border-radius: 4px; font-size: 11px; cursor: pointer; }
.tp-cancel:hover { background: #ff453a; border-color: #ff453a; color: #fff; }
.tp-bar-wrap { height: 4px; background: #3a3a3c; border-radius: 2px; overflow: hidden; margin-bottom: 8px; }
.tp-bar { height: 100%; background: #0a84ff; border-radius: 2px; width: 0%; transition: width 0.3s; }
.tp-status { font-size: 11px; color: #888; }
.tp-line { font-size: 10px; color: #666; margin-top: 3px; word-break: break-all; }

/* ===== About / Help Modal ===== */
#about-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    display: none; align-items: center; justify-content: center;
    z-index: 9100;
}
#about-overlay.visible { display: flex; }
#about-modal {
    background: #1c1c1e; border: 1px solid #3a3a3c; border-radius: 12px;
    width: 620px; max-width: 96vw; max-height: 88vh;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
}
.ab-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 12px; border-bottom: 1px solid #3a3a3c;
    background: linear-gradient(135deg, #1a1a2e 0%, #1c1c1e 100%);
}
.ab-title-wrap { display: flex; align-items: center; gap: 10px; }
.ab-logo { font-size: 24px; line-height: 1; }
.ab-title { margin: 0; font-size: 16px; font-weight: 700; color: #f0f0f0; }
.ab-subtitle { font-size: 11px; color: #888; margin-top: 2px; }
.ab-close { background: none; border: none; color: #666; font-size: 20px;
    cursor: pointer; padding: 2px 8px; border-radius: 4px; line-height: 1; }
.ab-close:hover { color: #fff; background: #3a3a3c; }

.ab-tabs { display: flex; border-bottom: 1px solid #3a3a3c; }
.ab-tab {
    padding: 9px 18px; font-size: 12px; color: #888; cursor: pointer;
    border-bottom: 2px solid transparent; transition: all 0.15s;
    background: none; border-top: none; border-left: none; border-right: none;
}
.ab-tab:hover { color: #ccc; }
.ab-tab.active { color: #0a84ff; border-bottom-color: #0a84ff; }

.ab-body { flex: 1; overflow-y: auto; padding: 20px; }
.ab-panel { display: none; }
.ab-panel.active { display: block; }

/* Features list */
.ab-feat-list { list-style: none; margin: 0; padding: 0; }
.ab-feat-list li {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; border-radius: 8px; margin-bottom: 6px;
    background: #2c2c2e; border: 1px solid #3a3a3c;
}
.ab-feat-icon { font-size: 18px; flex-shrink: 0; width: 24px; text-align: center; margin-top: 1px; }
.ab-feat-body {}
.ab-feat-title { font-size: 13px; font-weight: 600; color: #f0f0f0; margin-bottom: 2px; }
.ab-feat-desc { font-size: 11px; color: #888; line-height: 1.5; }
.ab-kbd {
    display: inline-block; padding: 1px 6px; background: #3a3a3c;
    border-radius: 4px; font-size: 10px; font-family: monospace;
    color: #ccc; border: 1px solid #555; white-space: nowrap;
}

/* LLM connection guide */
.ab-llm-card {
    background: #2c2c2e; border: 1px solid #3a3a3c; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 12px;
}
.ab-llm-card h4 {
    margin: 0 0 10px; font-size: 13px; color: #f0f0f0;
    display: flex; align-items: center; gap: 8px;
}
.ab-llm-badge {
    font-size: 10px; padding: 2px 7px; border-radius: 10px;
    font-weight: 600; letter-spacing: 0.5px;
}
.ab-llm-badge.local { background: rgba(48,209,88,0.15); color: #30d158; border: 1px solid rgba(48,209,88,0.3); }
.ab-llm-badge.cloud { background: rgba(10,132,255,0.15); color: #0a84ff; border: 1px solid rgba(10,132,255,0.3); }
.ab-llm-step { font-size: 11px; color: #aaa; margin-bottom: 5px; line-height: 1.6; }
.ab-llm-code {
    display: block; font-family: monospace; font-size: 11px;
    background: #1c1c1e; border: 1px solid #444; border-radius: 5px;
    padding: 6px 10px; color: #30d158; margin: 4px 0 8px;
    user-select: all; word-break: break-all;
}
.ab-llm-note { font-size: 10px; color: #666; margin-top: 6px; line-height: 1.5; }

/* Shortcuts table */
.ab-shortcut-table { width: 100%; border-collapse: collapse; }
.ab-shortcut-table tr:not(:last-child) td { border-bottom: 1px solid #2c2c2e; }
.ab-shortcut-table td { padding: 8px 4px; font-size: 12px; }
.ab-shortcut-table td:first-child { width: 55%; color: #bbb; }
.ab-shortcut-table td:last-child { text-align: right; }

/* About creator */
.ab-creator-section { text-align: center; padding: 10px 0; }
.ab-creator-avatar { font-size: 48px; margin-bottom: 10px; line-height: 1; }
.ab-creator-name { font-size: 18px; font-weight: 700; color: #f0f0f0; margin-bottom: 4px; }
.ab-creator-email { font-size: 12px; color: #0a84ff; margin-bottom: 16px; }
.ab-divider { border: none; border-top: 1px solid #3a3a3c; margin: 16px 0; }
.ab-credit { font-size: 12px; color: #888; line-height: 1.8; text-align: left; }
.ab-credit a { color: #0a84ff; text-decoration: none; }
.ab-version-badge {
    display: inline-block; padding: 3px 10px; background: rgba(10,132,255,0.15);
    border: 1px solid rgba(10,132,255,0.3); border-radius: 12px;
    font-size: 11px; color: #0a84ff; margin-bottom: 16px;
}

/* ===== Toast ===== */
#trans-toast {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    padding: 9px 20px; background: #30d158; color: #fff;
    border-radius: 20px; font-size: 13px; font-weight: 600;
    opacity: 0; transition: opacity 0.3s; z-index: 9999; pointer-events: none;
    white-space: pre-line; text-align: center;
}
#trans-toast.show { opacity: 1; }

/* ===== 搜尋取代面板 ===== */
#trans-fr-panel {
    position: fixed; top: 42px; right: 16px; z-index: 8500;
    background: #1c1c1e; border: 1px solid #3a3a3c; border-radius: 8px;
    padding: 8px 10px; width: 380px; box-shadow: 0 8px 24px rgba(0,0,0,0.55);
    display: none; flex-direction: column; gap: 6px; font-size: 13px;
}
#trans-fr-panel.visible { display: flex; }
.fr-row { display: flex; align-items: center; gap: 6px; }
.fr-icon { font-size: 13px; width: 18px; text-align: center; color: #888; flex-shrink: 0; }
.fr-input {
    flex: 1; background: #2c2c2e; border: 1px solid #444; border-radius: 5px;
    color: #f0f0f0; padding: 5px 8px; font-size: 12px; outline: none;
}
.fr-input:focus { border-color: #0a84ff; }
.fr-count { font-size: 11px; color: #888; width: 52px; text-align: center; flex-shrink: 0; }
.fr-btn {
    background: #2c2c2e; border: 1px solid #444; color: #ccc; border-radius: 5px;
    padding: 4px 9px; font-size: 12px; cursor: pointer; flex-shrink: 0;
}
.fr-btn:hover { background: #3a3a3c; color: #fff; }
.fr-btn.primary { background: #0a84ff; border-color: #0a84ff; color: #fff; }
.fr-btn.primary:hover { background: #0070d8; }
.fr-btn.close-btn { background: none; border: none; color: #888; font-size: 15px; padding: 2px 5px; }
.fr-btn.close-btn:hover { color: #fff; }
.fr-options { gap: 12px; padding: 2px 0 0 24px; }
.fr-options label { display: flex; align-items: center; gap: 4px; color: #aaa;
    font-size: 11px; cursor: pointer; user-select: none; }
.fr-options input[type=checkbox] { cursor: pointer; }
.fr-replace-all-result { font-size: 11px; color: #30d158; display: none; }
    `;
    document.head.appendChild(style);
}

// ── 搜尋取代面板 ────────────────────────────────────────
let _frPanel = null;

function _buildFindReplace() {
    const panel = document.createElement('div');
    panel.id = 'trans-fr-panel';
    panel.innerHTML = `
        <div class="fr-row">
            <span class="fr-icon">🔍</span>
            <input class="fr-input" id="fr-search" type="text" placeholder="${t('fr.search.ph')}" />
            <span class="fr-count" id="fr-count">–</span>
            <button class="fr-btn" id="fr-prev" title="▲ (Shift+Enter)">▲</button>
            <button class="fr-btn" id="fr-next" title="▼ (Enter)">▼</button>
            <button class="fr-btn close-btn" id="fr-close" title="✕ (Esc)">✕</button>
        </div>
        <div class="fr-row">
            <span class="fr-icon">⇄</span>
            <input class="fr-input" id="fr-replace" type="text" placeholder="${t('fr.replace.ph')}" />
            <button class="fr-btn" id="fr-replace-one">${t('fr.replace.btn')}</button>
            <button class="fr-btn primary" id="fr-replace-all">${t('fr.replace.all')}</button>
        </div>
        <div class="fr-row fr-options">
            <label><input type="checkbox" id="fr-case" /> ${t('fr.case.lbl')}</label>
            <label><input type="checkbox" id="fr-regex" /> ${t('fr.regex.lbl')}</label>
            <span class="fr-replace-all-result" id="fr-replace-result"></span>
        </div>
    `;
    document.body.appendChild(panel);
    _frPanel = panel;

    const searchInput  = panel.querySelector('#fr-search');
    const replaceInput = panel.querySelector('#fr-replace');
    const countEl      = panel.querySelector('#fr-count');
    const resultEl     = panel.querySelector('#fr-replace-result');

    function _getEditor() { return ace.edit('editor'); }

    function _getOpts() {
        return {
            caseSensitive: panel.querySelector('#fr-case').checked,
            regExp:        panel.querySelector('#fr-regex').checked,
            wrap:          true,
            preventScroll: false
        };
    }

    function _updateCount() {
        const needle = searchInput.value;
        if (!needle) { countEl.textContent = '–'; return; }
        const editor = _getEditor();
        try {
            const Search = ace.require('ace/search').Search;
            const ranges = new Search().set(Object.assign({}, _getOpts(), { needle })).findAll(editor.session);
            const total  = ranges ? ranges.length : 0;
            // 找出目前游標在第幾個
            const cursor = editor.getSelectionRange();
            let cur = 0;
            if (cursor && total > 0) {
                for (let i = 0; i < ranges.length; i++) {
                    if (ranges[i].start.row < cursor.start.row ||
                        (ranges[i].start.row === cursor.start.row && ranges[i].start.column <= cursor.start.column)) {
                        cur = i + 1;
                    }
                }
            }
            countEl.textContent = total === 0 ? t('fr.not.found') : `${cur}/${total}`;
        } catch(e) {
            countEl.textContent = '–';
        }
    }

    function doFind(backward) {
        const needle = searchInput.value;
        if (!needle) return;
        const editor = _getEditor();
        resultEl.style.display = 'none';
        try {
            const opts = Object.assign({}, _getOpts(), { needle, backwards: !!backward });
            editor.find(needle, opts);
            _updateCount();
        } catch(e) {
            countEl.textContent = t('fr.regex.err');
        }
    }

    function doReplace() {
        const needle  = searchInput.value;
        const replace = replaceInput.value;
        if (!needle) return;
        const editor = _getEditor();
        resultEl.style.display = 'none';
        try {
            const opts = Object.assign({}, _getOpts(), { needle });
            // 若目前選取剛好是一個搜尋結果才取代，否則先找
            editor.replace(replace, opts);
            _updateCount();
        } catch(e) {
            countEl.textContent = t('fr.regex.err');
        }
    }

    function doReplaceAll() {
        const needle  = searchInput.value;
        const replace = replaceInput.value;
        if (!needle) return;
        const editor = _getEditor();
        try {
            const opts = Object.assign({}, _getOpts(), { needle });
            // 計算取代前的數量
            const Search = ace.require('ace/search').Search;
            const ranges = new Search().set(Object.assign({}, opts)).findAll(editor.session);
            const total  = ranges ? ranges.length : 0;
            editor.replaceAll(replace, opts);
            countEl.textContent = '–';
            if (total > 0) {
                resultEl.textContent = t('fr.replaced.n', total);
                resultEl.style.display = 'inline';
                setTimeout(() => { resultEl.style.display = 'none'; }, 3000);
            }
        } catch(e) {
            countEl.textContent = t('fr.regex.err');
        }
    }

    // 事件綁定
    searchInput.addEventListener('input', () => {
        resultEl.style.display = 'none';
        doFind(false);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) doFind(true); else doFind(false);
        }
        if (e.key === 'Escape') closeFindReplace();
    });

    replaceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doReplace(); }
        if (e.key === 'Escape') closeFindReplace();
    });

    panel.querySelector('#fr-prev').addEventListener('click', () => doFind(true));
    panel.querySelector('#fr-next').addEventListener('click', () => doFind(false));
    panel.querySelector('#fr-close').addEventListener('click', closeFindReplace);
    panel.querySelector('#fr-replace-one').addEventListener('click', doReplace);
    panel.querySelector('#fr-replace-all').addEventListener('click', doReplaceAll);
    panel.querySelector('#fr-case').addEventListener('change', () => doFind(false));
    panel.querySelector('#fr-regex').addEventListener('change', () => doFind(false));

    // Esc 關閉
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && _frPanel && _frPanel.classList.contains('visible')) {
            closeFindReplace();
        }
    });
}

function openFindReplace() {
    if (!_frPanel) return;
    _frPanel.classList.add('visible');
    // 若編輯器有選取文字，帶入搜尋框
    const editor = ace.edit('editor');
    const sel = editor.getSelectedText();
    if (sel && sel.length < 200 && !sel.includes('\n')) {
        const input = _frPanel.querySelector('#fr-search');
        input.value = sel;
    }
    const input = _frPanel.querySelector('#fr-search');
    input.focus();
    input.select();
}

function closeFindReplace() {
    if (!_frPanel) return;
    _frPanel.classList.remove('visible');
    // 清除 ACE 的搜尋高亮
    try {
        const editor = ace.edit('editor');
        editor.clearSelection();
        editor.focus();
    } catch(e) {}
}

// ── 設定 Modal HTML ─────────────────────────────────────
function _buildSettingsModal() {
    const overlay = document.createElement('div');
    overlay.id = 'trans-overlay';
    overlay.innerHTML = `
<div id="trans-modal">
  <!-- 標題列 -->
  <div class="tm-header">
    <h2>${t('settings.title')}</h2>
    <button class="tm-close" id="tm-close-btn">✕</button>
  </div>

  <!-- 滾動主體 -->
  <div class="tm-body">

    <!-- ── API 切換 Tabs ── -->
    <div class="tm-tabs">
      <button class="tm-tab active" data-tab="openrouter">${t('tab.or')}</button>
      <button class="tm-tab" data-tab="other">${t('tab.other')}</button>
    </div>

    <!-- ── OpenRouter 面板 ── -->
    <div class="tm-section or-tab-content">

      <!-- 登入前 -->
      <div class="or-login-panel visible" id="or-login-panel">
        <div class="tm-field">
          <label>${t('or.key.label')}</label>
          <div class="or-key-row">
            <input type="password" id="or-key-input" placeholder="sk-or-...">
            <button class="or-eye-btn" id="or-eye-btn" title="👁">👁</button>
          </div>
        </div>
        <div class="or-remember-row">
          <input type="checkbox" id="or-remember-check">
          <label for="or-remember-check">${t('or.remember')}</label>
        </div>
        <button class="or-login-btn" id="or-login-btn">${t('or.login')}</button>
        <div id="or-login-status" style="font-size:11px;margin-top:6px;color:#888;"></div>
      </div>

      <!-- 登入後 -->
      <div class="or-loggedin-panel" id="or-loggedin-panel">
        <div class="or-filter-row">
          <label>${t('or.provider')}</label>
          <select id="or-provider-filter">
            <option value="all">${t('or.all.providers')}</option>
          </select>
          <button class="or-logout-btn" id="or-logout-btn">${t('or.logout')}</button>
        </div>
        <div class="or-model-row">
          <label>${t('or.model')}</label>
          <select class="or-model-select" id="or-model-select"></select>
        </div>
        <div id="or-model-info" style="font-size:11px;color:#888;margin-bottom:4px;"></div>
      </div>
    </div>

    <!-- ── 其他 API 面板 ── -->
    <div class="tm-section other-api-panel" id="other-api-panel">
      <div class="tm-field">
        <label>${t('other.url')}</label>
        <input type="text" id="other-api-url" placeholder="https://api.openai.com/v1/chat/completions">
      </div>
      <div class="tm-field">
        <label>${t('other.key')}</label>
        <input type="password" id="other-api-key" placeholder="sk-...">
      </div>
      <div class="tm-field">
        <label>${t('other.model')}</label>
        <input type="text" id="other-model" placeholder="gpt-4o">
      </div>
      <button id="tm-test-btn" style="padding:7px 14px;background:#2c2c2e;border:1px solid #3a3a3c;color:#ccc;border-radius:6px;font-size:12px;cursor:pointer;">
        ${t('other.test')}
      </button>
      <div id="tm-test-result" class="tm-test-result"></div>
    </div>

    <hr style="border:none;border-top:1px solid #3a3a3c;margin:4px 0 14px;">

    <!-- ── 翻譯設定 ── -->
    <div class="tm-section">
      <div class="tm-section-title">${t('section.trans')}</div>
      <div class="tm-field">
        <label>${t('max.tokens')}</label>
        <input type="number" id="tm-max-tokens" min="256" max="16384" step="256" value="4096" style="width:120px;">
      </div>
      <div class="tm-field">
        <label>${t('glossary')}</label>
        <div class="tm-field-row">
          <input type="text" id="tm-glossary-path" placeholder="glossary.csv">
          <button id="tm-glossary-browse">${t('browse')}</button>
        </div>
      </div>
      <div class="tm-field">
        <label>${t('output.dir')}</label>
        <div class="tm-field-row">
          <input type="text" id="tm-output-dir" placeholder="">
          <button id="tm-output-browse">${t('browse')}</button>
        </div>
      </div>
      <div class="tm-field">
        <label>${t('lang.label')}</label>
        <div class="tm-lang-row">
          <label>${t('lang.from')}</label>
          <select id="tm-source-lang"></select>
          <span class="tm-lang-arrow">→</span>
          <label>${t('lang.to')}</label>
          <select id="tm-target-lang"></select>
        </div>
      </div>
      <div class="tm-field">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <label style="margin:0;">${t('prompt.label')}</label>
          <button class="tm-regen-btn" id="tm-regen-prompt">${t('prompt.regen')}</button>
        </div>
        <textarea id="tm-system-prompt" rows="6" style="font-size:11px;"></textarea>
      </div>
    </div>

    <!-- ── 成人內容確認 ── -->
    <div class="tm-section">
      <div class="tm-consent-box">
        <input type="checkbox" id="tm-adult-consent">
        <label for="tm-adult-consent">${t('adult.consent')}</label>
      </div>
      <p class="tm-adult-warn">${t('adult.warn')}</p>
    </div>

    <!-- ── 計費追蹤 ── -->
    <div class="tm-section tm-cost-section">
      <div class="tm-section-title">${t('cost.title')}</div>
      <div class="tm-cost-grid" id="tm-cost-grid"></div>
      <button class="tm-reset-btn" id="tm-reset-session-btn">${t('cost.reset')}</button>
    </div>

    <!-- ── 介面語言 ── -->
    <div class="tm-section" style="border-top:1px solid #3a3a3c;padding-top:12px;">
      <div class="tm-section-title">${t('ui.lang')}</div>
      <div style="display:flex;gap:8px;">
        <button id="tm-lang-zhtw" class="tm-tab${_uiLang === 'zh-TW' ? ' active' : ''}" style="border-radius:6px;">繁中</button>
        <button id="tm-lang-en"   class="tm-tab${_uiLang === 'en'    ? ' active' : ''}" style="border-radius:6px;">English</button>
      </div>
    </div>

  </div><!-- end tm-body -->

  <!-- 底部按鈕 -->
  <div class="tm-footer">
    <button class="tm-btn-cancel" id="tm-cancel-btn">${t('cancel')}</button>
    <button class="tm-btn-save"   id="tm-save-btn">${t('save')}</button>
  </div>
</div>
    `;
    overlay.style.display = 'none';
    document.body.appendChild(overlay);

    // ── 事件綁定 ──────────────────────────────────────
    document.getElementById('tm-close-btn').addEventListener('click', closeSettingsDialog);
    document.getElementById('tm-cancel-btn').addEventListener('click', closeSettingsDialog);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeSettingsDialog(); });
    document.getElementById('tm-save-btn').addEventListener('click', _saveSettings);

    // 介面語言切換（同時切換翻譯面板 + 整體選單）
    document.getElementById('tm-lang-zhtw').addEventListener('click', async () => {
        if (_uiLang === 'zh-TW') return;
        _uiLang = 'zh-TW';
        // 整體 UI 切換（選單 + 儲存偏好），翻譯面板由 _rebuildUI() 處理
        await ipc.invoke('ui-switch-language', 'zh-TW');
        _rebuildUI();
    });
    document.getElementById('tm-lang-en').addEventListener('click', async () => {
        if (_uiLang === 'en') return;
        _uiLang = 'en';
        await ipc.invoke('ui-switch-language', 'en');
        _rebuildUI();
    });

    // Tab 切換
    overlay.querySelectorAll('.tm-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.tm-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _switchApiTab(btn.dataset.tab);
        });
    });

    // OpenRouter 眼睛按鈕
    document.getElementById('or-eye-btn').addEventListener('click', () => {
        const inp = document.getElementById('or-key-input');
        inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // OpenRouter 登入
    document.getElementById('or-login-btn').addEventListener('click', _doOpenRouterLogin);

    // OpenRouter 登出
    document.getElementById('or-logout-btn').addEventListener('click', _doOpenRouterLogout);

    // 提供商篩選
    document.getElementById('or-provider-filter').addEventListener('change', () => {
        _renderModelDropdown(_orModels, document.getElementById('or-provider-filter').value);
    });

    // 模型選擇更新 info
    document.getElementById('or-model-select').addEventListener('change', () => {
        _updateModelInfo();
    });

    // 測試連線（其他 API）
    document.getElementById('tm-test-btn').addEventListener('click', _testOtherApi);

    // 瀏覽詞彙表
    document.getElementById('tm-glossary-browse').addEventListener('click', async () => {
        const result = await ipc.invoke('showOpenDialog', {
            title: '選擇詞彙表 CSV',
            filters: [{ name: 'CSV', extensions: ['csv'] }],
            properties: ['openFile']
        }).catch(() => null);
        if (result && result.filePaths && result.filePaths[0]) {
            document.getElementById('tm-glossary-path').value = result.filePaths[0];
        }
    });

    // 瀏覽輸出目錄
    document.getElementById('tm-output-browse').addEventListener('click', async () => {
        const result = await ipc.invoke('showOpenDialog', {
            title: '選擇翻譯輸出目錄',
            properties: ['openDirectory', 'createDirectory']
        }).catch(() => null);
        if (result && result.filePaths && result.filePaths[0]) {
            document.getElementById('tm-output-dir').value = result.filePaths[0];
        }
    });

    // 重置本次工作階段費用
    document.getElementById('tm-reset-session-btn').addEventListener('click', () => {
        _sessionCost = { inputTokens: 0, outputTokens: 0, usdCost: 0 };
        _renderCostGrid();
        _showToast('本次工作階段費用已重置');
    });

    // 依語言重新生成 system prompt
    document.getElementById('tm-regen-prompt').addEventListener('click', async () => {
        const src = document.getElementById('tm-source-lang').value;
        const tgt = document.getElementById('tm-target-lang').value;
        const btn = document.getElementById('tm-regen-prompt');
        btn.disabled = true;
        btn.textContent = '生成中...';
        const prompt = await ipc.invoke('translation-generate-prompt', src, tgt);
        document.getElementById('tm-system-prompt').value = prompt;
        btn.disabled = false;
        btn.textContent = '↻ 依語言重新生成';
        _showToast('提示詞已依語言更新 ✓');
    });
}

// ── Tab 切換 ─────────────────────────────────────────
function _switchApiTab(tab) {
    const orContent    = document.querySelector('.or-tab-content');
    const otherContent = document.getElementById('other-api-panel');
    if (tab === 'openrouter') {
        orContent.style.display    = '';
        otherContent.classList.remove('visible');
        otherContent.style.display = 'none';
    } else {
        orContent.style.display    = 'none';
        otherContent.classList.add('visible');
        otherContent.style.display = '';
    }
}

// ── OpenRouter 登入 ──────────────────────────────────
async function _doOpenRouterLogin() {
    const key = document.getElementById('or-key-input').value.trim();
    if (!key) { _showStatus('or-login-status', '請輸入 API Key', 'err'); return; }

    const btn = document.getElementById('or-login-btn');
    const status = document.getElementById('or-login-status');
    btn.disabled = true;
    btn.textContent = '載入中...';
    _showStatus('or-login-status', '正在連線 OpenRouter...', '');

    const result = await ipc.invoke('translation-fetch-models', key);

    btn.disabled = false;
    btn.textContent = '取得模型清單 / 登入';

    if (!result.ok) {
        _showStatus('or-login-status', '❌ ' + result.error, 'err');
        return;
    }

    _orModels      = result.models;
    _orLoggedIn    = true;
    _sessionApiKey = key;

    // 填入提供商清單
    _renderProviderDropdown(_orModels);

    // 填入模型清單
    _renderModelDropdown(_orModels, 'all');

    // 嘗試恢復上次選擇的模型
    const settings = await ipc.invoke('translation-get-settings');
    if (settings.model) {
        const sel = document.getElementById('or-model-select');
        const opt = Array.from(sel.options).find(o => o.value === settings.model);
        if (opt) sel.value = settings.model;
    }
    _updateModelInfo();

    // 切換至已登入面板
    document.getElementById('or-login-panel').classList.remove('visible');
    document.getElementById('or-loggedin-panel').classList.add('visible');
    _showStatus('or-login-status', '', '');

    _showToast(`✓ ${_orModels.length} 個模型已載入`);
}

// ── OpenRouter 登出 ──────────────────────────────────
function _doOpenRouterLogout() {
    _orLoggedIn    = false;
    _sessionApiKey = '';
    _orModels      = [];
    document.getElementById('or-login-panel').classList.add('visible');
    document.getElementById('or-loggedin-panel').classList.remove('visible');
    document.getElementById('or-key-input').value = '';
    document.getElementById('or-login-status').textContent = '';
}

// ── 渲染提供商下拉 ────────────────────────────────────
function _renderProviderDropdown(models) {
    const sel = document.getElementById('or-provider-filter');
    // 計算每個提供商的模型數量
    const countMap = new Map();
    models.forEach(m => {
        const p = m.id.split('/')[0];
        countMap.set(p, (countMap.get(p) || 0) + 1);
    });
    // 依數量排序
    const sorted = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]);

    sel.innerHTML = `<option value="all">全部提供商 (${models.length})</option>`;
    sorted.forEach(([p, cnt]) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = `${p}  (${cnt})`;
        sel.appendChild(opt);
    });
}

// ── 渲染模型下拉 ──────────────────────────────────────
function _renderModelDropdown(models, filterProvider) {
    const sel      = document.getElementById('or-model-select');
    const oldValue = sel.value;

    const filtered = (filterProvider && filterProvider !== 'all')
        ? models.filter(m => m.id.startsWith(filterProvider + '/'))
        : models;

    sel.innerHTML = '';
    filtered.forEach(m => {
        const inPpm  = _fmtPrice(m.pricing && m.pricing.prompt);
        const outPpm = _fmtPrice(m.pricing && m.pricing.completion);
        const opt    = document.createElement('option');
        opt.value    = m.id;
        opt.textContent = `${m.name || m.id}  ·  IN:${inPpm}/M  OUT:${outPpm}/M`;
        opt.dataset.inPrice  = m.pricing ? m.pricing.prompt      : '0';
        opt.dataset.outPrice = m.pricing ? m.pricing.completion  : '0';
        sel.appendChild(opt);
    });

    // 嘗試恢復舊選擇
    if (oldValue && Array.from(sel.options).some(o => o.value === oldValue)) {
        sel.value = oldValue;
    }
    _updateModelInfo();
}

// ── 模型詳細資訊 ──────────────────────────────────────
function _updateModelInfo() {
    const sel = document.getElementById('or-model-select');
    const opt = sel.options[sel.selectedIndex];
    const info = document.getElementById('or-model-info');
    if (!opt) { info.textContent = ''; return; }
    const inPpm  = _fmtPrice(opt.dataset.inPrice);
    const outPpm = _fmtPrice(opt.dataset.outPrice);
    info.innerHTML = `<span style="color:#30d158;">✓</span> ${t('model.selected')}<b style="color:#f0f0f0;">${opt.value}</b>　IN: <b>${inPpm}/M token</b>　OUT: <b>${outPpm}/M token</b>`;
}

// ── OpenRouter 定價格式化 ─────────────────────────────
// OpenRouter 回傳 per-token USD；乘 1,000,000 即 per-million
function _fmtPrice(perTokenStr) {
    const v = parseFloat(perTokenStr || '0') * 1_000_000;
    if (v === 0) return 'FREE';
    if (v < 0.01) return '$' + v.toFixed(4);
    return '$' + v.toFixed(2);
}

// ── 計費格子渲染 ──────────────────────────────────────
async function _renderCostGrid() {
    const grid  = document.getElementById('tm-cost-grid');
    if (!grid) return;
    const usage = await ipc.invoke('translation-get-usage');

    function col(title, inp, out, usd) {
        const fmtN = n => Number.isFinite(n) ? n.toLocaleString() : '—';
        const fmtU = u => (typeof u === 'number' && u > 0) ? '$' + u.toFixed(4) : '$0.0000';
        return `
        <div class="tm-cost-col">
          <div class="tm-cost-col-title">${title}</div>
          <div class="tm-cost-item"><span>${t('cost.input')}</span><span class="cost-val">${fmtN(inp)}</span></div>
          <div class="tm-cost-item"><span>${t('cost.output')}</span><span class="cost-val">${fmtN(out)}</span></div>
          <div class="tm-cost-item cost-usd"><span>${t('cost.usd')}</span><span class="cost-val">${fmtU(usd)}</span></div>
        </div>`;
    }

    grid.innerHTML =
        col(t('cost.last'),    _lastCost.inputTokens,      _lastCost.outputTokens,      _lastCost.usdCost) +
        col(t('cost.session'), _sessionCost.inputTokens,   _sessionCost.outputTokens,   _sessionCost.usdCost) +
        col(t('cost.total'),   usage.totalInputTokens || 0, usage.totalOutputTokens || 0, usage.totalUsdCost || 0);
}

// ── 測試連線（其他 API）──────────────────────────────
async function _testOtherApi() {
    const resultEl = document.getElementById('tm-test-result');
    resultEl.textContent = t('testing');
    resultEl.className   = 'tm-test-result';

    const tempSettings = {
        apiUrl:  document.getElementById('other-api-url').value.trim(),
        apiKey:  document.getElementById('other-api-key').value.trim(),
        model:   document.getElementById('other-model').value.trim()
    };
    const r = await ipc.invoke('translation-test-api', tempSettings);
    resultEl.textContent = r.message;
    resultEl.className   = 'tm-test-result ' + (r.ok ? 'ok' : 'err');
}

// ── 開啟設定對話框 ────────────────────────────────────
async function openSettingsDialog() {
    const overlay  = document.getElementById('trans-overlay');
    const settings = await ipc.invoke('translation-get-settings');

    // 預設 tab
    const isOR = settings.apiProvider !== 'other';
    document.querySelectorAll('.tm-tab').forEach(t => t.classList.remove('active'));
    if (isOR) {
        document.querySelector('[data-tab="openrouter"]').classList.add('active');
        _switchApiTab('openrouter');
    } else {
        document.querySelector('[data-tab="other"]').classList.add('active');
        _switchApiTab('other');
    }

    // 填入其他 API 欄位（使用分開儲存的 key，向下相容舊格式）
    document.getElementById('other-api-url').value = (settings.apiProvider === 'other' || !settings.apiUrl.includes('openrouter'))
        ? settings.apiUrl : 'https://api.openai.com/v1/chat/completions';
    document.getElementById('other-api-key').value = settings.otherApiKey || (settings.apiProvider === 'other' ? settings.apiKey : '');
    document.getElementById('other-model').value   = settings.apiProvider === 'other' ? settings.model  : 'gpt-4o';

    // 語言選擇器：填入選項（如果尚未填）
    const srcSel = document.getElementById('tm-source-lang');
    const tgtSel = document.getElementById('tm-target-lang');
    if (srcSel.options.length === 0) {
        const langs = await ipc.invoke('translation-get-languages');
        langs.source.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.value; opt.textContent = l.label;
            srcSel.appendChild(opt);
        });
        langs.target.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.value; opt.textContent = l.label;
            tgtSel.appendChild(opt);
        });
    }
    srcSel.value = settings.sourceLanguage || 'auto';
    tgtSel.value = settings.targetLanguage || 'zh-tw';

    // 通用設定
    document.getElementById('tm-max-tokens').value      = settings.maxTokens     || 4096;
    document.getElementById('tm-glossary-path').value   = settings.glossaryPath  || '';
    document.getElementById('tm-output-dir').value      = settings.outputDir     || '';
    document.getElementById('tm-system-prompt').value   = settings.systemPrompt  || '';
    document.getElementById('tm-adult-consent').checked = !!settings.adultConsent;

    // OpenRouter：優先用 openrouterApiKey，向下相容舊 apiKey
    const orKey = settings.openrouterApiKey || (settings.apiProvider !== 'other' ? settings.apiKey : '');
    if (isOR && settings.rememberApiKey && orKey) {
        document.getElementById('or-key-input').value     = orKey;
        document.getElementById('or-remember-check').checked = true;
        // 若尚未載入模型，可在此觸發自動登入
        if (!_orLoggedIn && orKey) {
            // 靜默載入
            _sessionApiKey = orKey;
            try {
                const r = await ipc.invoke('translation-fetch-models', orKey);
                if (r.ok && r.models.length > 0) {
                    _orModels   = r.models;
                    _orLoggedIn = true;
                    _renderProviderDropdown(_orModels);
                    _renderModelDropdown(_orModels, 'all');
                    // 恢復上次選的模型
                    if (settings.model) {
                        const sel = document.getElementById('or-model-select');
                        const opt = Array.from(sel.options).find(o => o.value === settings.model);
                        if (opt) sel.value = settings.model;
                    }
                    _updateModelInfo();
                    document.getElementById('or-login-panel').classList.remove('visible');
                    document.getElementById('or-loggedin-panel').classList.add('visible');
                }
            } catch(e) { /* 靜默失敗，讓使用者手動登入 */ }
        } else if (_orLoggedIn) {
            // 已登入，確保顯示已登入面板
            document.getElementById('or-login-panel').classList.remove('visible');
            document.getElementById('or-loggedin-panel').classList.add('visible');
            // 恢復選擇
            if (settings.model) {
                const sel = document.getElementById('or-model-select');
                const opt = Array.from(sel.options).find(o => o.value === settings.model);
                if (opt) sel.value = settings.model;
            }
            _updateModelInfo();
        }
    } else if (isOR && _orLoggedIn) {
        // 已登入但未記住 key
        document.getElementById('or-login-panel').classList.remove('visible');
        document.getElementById('or-loggedin-panel').classList.add('visible');
        if (settings.model) {
            const sel = document.getElementById('or-model-select');
            const opt = Array.from(sel.options).find(o => o.value === settings.model);
            if (opt) sel.value = settings.model;
        }
        _updateModelInfo();
    }

    // 費用格子
    await _renderCostGrid();

    overlay.style.display = 'flex';
}

function closeSettingsDialog() {
    document.getElementById('trans-overlay').style.display = 'none';
}

// ── 儲存設定 ─────────────────────────────────────────
async function _saveSettings() {
    const activeTabs = document.querySelector('.tm-tab.active');
    const tab = activeTabs ? activeTabs.dataset.tab : 'openrouter';

    // 載入現有設定以保留另一個 provider 的 key（兩組 key 互不覆蓋）
    const existingSettings = await ipc.invoke('translation-get-settings');

    let settings;
    if (tab === 'openrouter') {
        const sel = document.getElementById('or-model-select');
        const opt = sel.options[sel.selectedIndex];
        const inPrice  = opt ? parseFloat(opt.dataset.inPrice  || '0') : 0;
        const outPrice = opt ? parseFloat(opt.dataset.outPrice || '0') : 0;
        const modelId  = sel.value || '';
        const currentOrKey = _sessionApiKey || document.getElementById('or-key-input').value.trim();

        settings = {
            apiProvider:             'openrouter',
            apiUrl:                  'https://openrouter.ai/api/v1/chat/completions',
            apiKey:                  currentOrKey,
            openrouterApiKey:        currentOrKey,
            otherApiKey:             existingSettings.otherApiKey || '',
            rememberApiKey:          document.getElementById('or-remember-check').checked,
            model:                   modelId,
            modelDisplayName:        opt ? (opt.value || '') : '',
            promptPricePerToken:     inPrice,
            completionPricePerToken: outPrice,
        };
    } else {
        const currentOtherKey = document.getElementById('other-api-key').value.trim();

        settings = {
            apiProvider:             'other',
            apiUrl:                  document.getElementById('other-api-url').value.trim(),
            apiKey:                  currentOtherKey,
            openrouterApiKey:        existingSettings.openrouterApiKey || '',
            otherApiKey:             currentOtherKey,
            rememberApiKey:          true,
            model:                   document.getElementById('other-model').value.trim(),
            modelDisplayName:        document.getElementById('other-model').value.trim(),
            promptPricePerToken:     0,
            completionPricePerToken: 0,
        };
    }

    // 通用欄位
    settings.maxTokens      = parseInt(document.getElementById('tm-max-tokens').value)    || 4096;
    settings.glossaryPath   = document.getElementById('tm-glossary-path').value.trim();
    settings.outputDir      = document.getElementById('tm-output-dir').value.trim();
    settings.systemPrompt   = document.getElementById('tm-system-prompt').value;
    settings.adultConsent   = document.getElementById('tm-adult-consent').checked;
    settings.sourceLanguage = document.getElementById('tm-source-lang').value || 'auto';
    settings.targetLanguage = document.getElementById('tm-target-lang').value || 'zh-tw';

    const ok = await ipc.invoke('translation-save-settings', settings);
    if (ok) {
        closeSettingsDialog();
        _showToast(t('toast.saved'));
    } else {
        alert(t('save.failed'));
    }
}

// ── 輔助：狀態訊息 ───────────────────────────────────
function _showStatus(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = type === 'err' ? '#ff453a' : type === 'ok' ? '#30d158' : '#888';
}

// ── 翻譯選取文字 ──────────────────────────────────────
async function translateSelection() {
    if (_isTranslating) return;

    // 取得 ACE 編輯器選取文字
    let selectedText = '';
    let aceEditor = null;
    try {
        aceEditor = ace.edit('editor');
        selectedText = aceEditor.getSelectedText().trim();
    } catch(err) {
        alert(t('alert.no_editor')); return;
    }

    if (!selectedText) {
        alert(t('alert.no_sel')); return;
    }

    const settings = await ipc.invoke('translation-get-settings');
    if (!settings.adultConsent) {
        const go = confirm(t('confirm.no_consent'));
        if (go) openSettingsDialog(); return;
    }
    if (!settings.apiKey && !_sessionApiKey) {
        const go = confirm(t('confirm.no_key'));
        if (go) openSettingsDialog(); return;
    }

    _isTranslating = true;
    _showToast('翻譯中...');

    const activeKey = _sessionApiKey || settings.apiKey;
    const result = await ipc.invoke(
        'translation-translate-selection',
        selectedText,
        settings.glossaryPath || '',
        activeKey
    );

    _isTranslating = false;

    if (result.ok) {
        // 直接替換編輯器中的選取範圍
        aceEditor.session.replace(aceEditor.selection.getRange(), result.translated);
        _accumulateCost(result.costData);
        const costStr = result.costData && result.costData.usdCost > 0
            ? `（費用：$${result.costData.usdCost.toFixed(4)}）` : '';
        _showToast(`選取文字翻譯完成 ✓ ${costStr}`);
    } else {
        alert('翻譯失敗：' + result.error);
    }
}

// ── 翻譯目前檔案 ──────────────────────────────────────
async function translateCurrentFile() {
    if (_isTranslating) return;
    if (!_inkProject || !_inkProject.currentProject) {
        alert(t('alert.no_project')); return;
    }
    const settings = await ipc.invoke('translation-get-settings');
    if (!settings.adultConsent) {
        const go = confirm(t('confirm.no_consent'));
        if (go) openSettingsDialog(); return;
    }
    if (!settings.apiKey && !_sessionApiKey) {
        const go = confirm(t('confirm.no_key'));
        if (go) openSettingsDialog(); return;
    }
    // 若 sessionKey 存在但設定中沒有，補上
    if (_sessionApiKey && !settings.apiKey) settings.apiKey = _sessionApiKey;

    const confirmed = confirm(
        '翻譯目前檔案？\n翻譯結果將取代編輯器現有內容（可用 Ctrl+Z 還原）。'
    );
    if (!confirmed) return;

    _isTranslating = true;
    showProgress('翻譯目前檔案...');

    const inkContent = _editorView ? _editorView.getValue() : '';
    // 傳入 activeKey，確保主程序也能使用 session key（即使磁碟設定未存 key）
    const activeKey = _sessionApiKey || settings.apiKey;
    const result = await ipc.invoke('translation-translate-content', inkContent, settings.glossaryPath || '', activeKey);

    hideProgress();
    _isTranslating = false;

    if (result.ok) {
        if (_editorView) _editorView.setValue(result.translated);
        _accumulateCost(result.costData);
        const costStr = result.costData && result.costData.usdCost > 0
            ? `（費用：$${result.costData.usdCost.toFixed(4)}）` : '';
        _showToast(`翻譯完成 ✓ ${costStr}`);
    } else {
        alert('翻譯失敗：' + result.error);
    }
}

// ── 翻譯整個專案 ──────────────────────────────────────
async function translateProject() {
    if (_isTranslating) return;
    if (!_inkProject || !_inkProject.currentProject) {
        alert(t('alert.no_project')); return;
    }
    const settings = await ipc.invoke('translation-get-settings');
    if (!settings.adultConsent) {
        const go = confirm(t('confirm.no_consent'));
        if (go) openSettingsDialog(); return;
    }
    if (!settings.apiKey && !_sessionApiKey) {
        const go = confirm(t('confirm.no_key'));
        if (go) openSettingsDialog(); return;
    }
    if (_sessionApiKey && !settings.apiKey) settings.apiKey = _sessionApiKey;
    if (!settings.outputDir) {
        const go = confirm(t('confirm.no_output'));
        if (go) openSettingsDialog(); return;
    }

    const project  = _inkProject.currentProject;
    const inkFiles = project.inkFiles ? project.inkFiles.map(f => f.absolutePath()).filter(Boolean) : [];
    if (inkFiles.length === 0) {
        alert('找不到專案 ink 檔案，請確認已開啟正確的主 .ink 檔'); return;
    }

    const confirmed = confirm(t('confirm.project', inkFiles.length, settings.outputDir));
    if (!confirmed) return;

    _isTranslating = true;
    showProgress(`翻譯專案中 (共 ${inkFiles.length} 個檔案)...`);

    const activeKey = _sessionApiKey || settings.apiKey;
    const result = await ipc.invoke('translation-translate-project', inkFiles, settings.outputDir, settings.glossaryPath || '', activeKey);

    hideProgress();
    _isTranslating = false;

    if (result.ok) {
        if (result.costData) _accumulateCost(result.costData);
        const failed = result.results.filter(r => !r.ok);
        if (failed.length > 0) {
            alert(`翻譯完成，但有 ${failed.length} 個檔案失敗：\n${failed.map(f => f.file + ': ' + f.error).join('\n')}`);
        } else {
            _showToast(`全部 ${inkFiles.length} 個檔案翻譯完成 ✓\n輸出至：${settings.outputDir}`);
        }
    } else {
        alert('翻譯失敗：' + result.error);
    }
}

// ── 費用累計 ─────────────────────────────────────────
function _accumulateCost(costData) {
    if (!costData) return;
    _lastCost = {
        inputTokens:  costData.inputTokens  || 0,
        outputTokens: costData.outputTokens || 0,
        usdCost:      costData.usdCost      || 0
    };
    _sessionCost.inputTokens  += _lastCost.inputTokens;
    _sessionCost.outputTokens += _lastCost.outputTokens;
    _sessionCost.usdCost      += _lastCost.usdCost;
}

// ── 進度面板 ─────────────────────────────────────────
function _buildProgressPanel() {
    const panel = document.createElement('div');
    panel.id = 'trans-progress-panel';
    panel.innerHTML = `
        <div class="tp-header">
            <span class="tp-title" id="tp-title">${t('toast.translating')}</span>
            <button class="tp-cancel" id="tp-cancel-btn">${t('progress.cancel')}</button>
        </div>
        <div class="tp-bar-wrap"><div class="tp-bar" id="tp-bar"></div></div>
        <div class="tp-status" id="tp-status">${t('progress.ready')}</div>
        <div class="tp-line" id="tp-line"></div>
    `;
    panel.style.display = 'none';
    document.body.appendChild(panel);
    document.getElementById('tp-cancel-btn').addEventListener('click', () => {
        _isTranslating = false;
        hideProgress();
    });
}

function showProgress(title) {
    const panel = document.getElementById('trans-progress-panel');
    document.getElementById('tp-title').textContent  = title;
    document.getElementById('tp-bar').style.width    = '0%';
    document.getElementById('tp-status').textContent = t('progress.ready');
    document.getElementById('tp-line').textContent   = '';
    panel.style.display = 'block';
}

function hideProgress() {
    const panel = document.getElementById('trans-progress-panel');
    if (panel) panel.style.display = 'none';
}

function updateProgress(data) {
    const bar    = document.getElementById('tp-bar');
    const status = document.getElementById('tp-status');
    const line   = document.getElementById('tp-line');
    if (!bar) return;
    const pct = data.total > 0 ? Math.round(data.done / data.total * 100) : 0;
    bar.style.width      = pct + '%';
    status.textContent   = t('progress.n.lines', data.done, data.total, pct);
    if (data.currentLine) {
        line.textContent = data.currentLine.substring(0, 80) + (data.currentLine.length > 80 ? '...' : '');
    }
}

function updateFileProgress(data) {
    const status = document.getElementById('tp-status');
    if (status) status.textContent = t('progress.file.n', data.index+1, data.total, data.filename);
}

// ── Toast ─────────────────────────────────────────────
function _showToast(msg) {
    let toast = document.getElementById('trans-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'trans-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className   = 'show';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.className = ''; }, 3500);
}

// ── About / Help Modal ────────────────────────────────
function _buildAboutModal() {
    const overlay = document.createElement('div');
    overlay.id = 'about-overlay';
    overlay.innerHTML = `
<div id="about-modal">
  <div class="ab-header">
    <div class="ab-title-wrap">
      <div class="ab-logo">🖋️</div>
      <div>
        <h2 class="ab-title">${t('about.title')}</h2>
        <div class="ab-subtitle">Inky Translation Fork — by FloofyFox</div>
      </div>
    </div>
    <button class="ab-close" id="about-close">✕</button>
  </div>

  <div class="ab-tabs">
    <button class="ab-tab active" data-panel="features">${t('about.tab.features')}</button>
    <button class="ab-tab" data-panel="llm">${t('about.tab.llm')}</button>
    <button class="ab-tab" data-panel="shortcuts">${t('about.tab.shortcuts')}</button>
    <button class="ab-tab" data-panel="creator">${t('about.tab.creator')}</button>
  </div>

  <div class="ab-body">

    <!-- ── 功能說明 ── -->
    <div class="ab-panel active" id="ab-panel-features">
      <ul class="ab-feat-list">
        <li>
          <div class="ab-feat-icon">🌐</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">OpenRouter 整合</div>
            <div class="ab-feat-desc">一鍵登入 OpenRouter，自動載入數百個模型清單，顯示即時 IN/OUT 定價。支援 GPT-4o、Claude、Gemini、Llama 等所有主流模型。<br>→ 翻譯選單 &gt; 翻譯設定</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">📄</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">翻譯目前檔案 <span class="ab-kbd">Ctrl+Shift+T</span></div>
            <div class="ab-feat-desc">智能解析 ink 語法，只翻譯純文字與對話，完整保留所有語法（===、->、VAR、{條件}、*、+、#TAG 等）不變。支援 HTML 標籤保護（&lt;i&gt;、&lt;b&gt; 不會被誤譯）。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">📁</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">翻譯整個專案 <span class="ab-kbd">Ctrl+Shift+Alt+T</span></div>
            <div class="ab-feat-desc">批次翻譯專案內所有 .ink 檔案，翻譯結果輸出至指定資料夾，不覆蓋原始檔案。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">✂️</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">翻譯選取文字 <span class="ab-kbd">Ctrl+Shift+S</span></div>
            <div class="ab-feat-desc">在編輯器中拖曳選取任意文字後，使用快捷鍵或右鍵選單「翻譯選取文字」，結果直接替換選取內容。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">🔍</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">搜尋 &amp; 取代 <span class="ab-kbd">Ctrl+H</span></div>
            <div class="ab-feat-desc">浮動搜尋面板，支援逐一取代、全部取代、▲▼ 上下導覽，以及大小寫切換和正則表達式模式。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">💰</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">費用追蹤</div>
            <div class="ab-feat-desc">自動計算並顯示每次翻譯的 input/output token 數量與 USD 費用，分為「上次請求」「本次工作階段」「累計總計」三格。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">🔄</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">自動重試</div>
            <div class="ab-feat-desc">遇到 ECONNRESET、ETIMEDOUT、Rate Limit (429) 等網路錯誤時，自動重試最多 3 次，delay 時間漸增。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">📖</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">詞彙表支援（glossary.csv）</div>
            <div class="ab-feat-desc">在翻譯設定中指定 CSV 詞彙表路徑，讓 AI 依照固定對照翻譯專有名詞（角色名、地點名等）。格式：<code>原文,譯文</code>，UTF-8 編碼。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">🤖</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">AI 助理 <span class="ab-kbd">工具列 🤖</span></div>
            <div class="ab-feat-desc">浮動 AI 對話視窗，5 種 Persona 可選：劇情編輯、角色扮演、成人語氣（前三者可<strong>複選合併</strong>）、Ink 除錯、一致性稽核。可附加當前編輯器內容或選取文字作為上下文。支援 Memory（持久記憶）與 Soul（人格設定）自訂。使用與翻譯相同的 API 設定。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">🔑</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">雙組 API Key 分開儲存</div>
            <div class="ab-feat-desc">OpenRouter Key 與本地/其他 API Key 分開儲存，切換 provider 時兩組 key 互不覆蓋，無需重複貼上。</div>
          </div>
        </li>
        <li>
          <div class="ab-feat-icon">📂</div>
          <div class="ab-feat-body">
            <div class="ab-feat-title">開啟 .lua / .txt 檔案</div>
            <div class="ab-feat-desc">開啟對話框支援 .lua、.txt 及任意格式檔案。.lua 檔案自動套用 Lua 語法高亮，.txt 顯示純文字模式。非 .ink 檔案不觸發 Ink 編譯器，翻譯與 AI 助理功能完全可用。</div>
          </div>
        </li>
      </ul>
    </div>

    <!-- ── 接 LLM ── -->
    <div class="ab-panel" id="ab-panel-llm">
      <p style="font-size:12px;color:#888;margin:0 0 14px;">
        在翻譯設定中切換到「其他 API」頁籤，填入以下資訊即可接本地或自架的 LLM。
      </p>

      <div class="ab-llm-card">
        <h4>🦙 Ollama <span class="ab-llm-badge local">本地</span></h4>
        <div class="ab-llm-step">① 安裝 <strong>Ollama</strong>（ollama.com），執行拉取模型：</div>
        <code class="ab-llm-code">ollama pull qwen2.5:7b</code>
        <div class="ab-llm-step">② 在「其他 API」頁籤填入：</div>
        <code class="ab-llm-code">API URL：http://localhost:11434/v1/chat/completions
API Key：ollama（隨便填）
Model：qwen2.5:7b（你拉取的模型名）</code>
        <div class="ab-llm-note">💡 推薦繁中翻譯模型：qwen2.5:7b、llama3.1:8b、mistral:7b<br>翻譯品質依模型而異，7B 以上建議選擇。</div>
      </div>

      <div class="ab-llm-card">
        <h4>🖥 LM Studio <span class="ab-llm-badge local">本地</span></h4>
        <div class="ab-llm-step">① 開啟 LM Studio → 載入模型 → 點左側「Local Server」→「Start Server」</div>
        <div class="ab-llm-step">② 填入：</div>
        <code class="ab-llm-code">API URL：http://localhost:1234/v1/chat/completions
API Key：lmstudio（隨便填）
Model：（填 LM Studio 中載入的模型識別碼）</code>
        <div class="ab-llm-note">💡 LM Studio 預設 port 1234，可在 Server 設定中修改。</div>
      </div>

      <div class="ab-llm-card">
        <h4>☁️ 其他 OpenAI 相容 API <span class="ab-llm-badge cloud">雲端</span></h4>
        <div class="ab-llm-step">任何符合 OpenAI Chat Completions API 格式的服務都可以接，例如：</div>
        <code class="ab-llm-code">Groq：     https://api.groq.com/openai/v1/chat/completions
Together： https://api.together.xyz/v1/chat/completions
自架 vLLM：http://your-server:8000/v1/chat/completions</code>
        <div class="ab-llm-note">⚠️ 確保 system prompt 語言設定正確，本地模型對繁體中文的支援度因模型而異。</div>
      </div>

      <div class="ab-llm-card">
        <h4>🔗 OpenRouter <span class="ab-llm-badge cloud">雲端（推薦）</span></h4>
        <div class="ab-llm-step">使用「OpenRouter」頁籤（預設），在 <strong>openrouter.ai</strong> 註冊取得 API Key 即可存取數百個模型，按用量計費，無需安裝任何本地軟體。</div>
        <div class="ab-llm-note">💡 新帳號通常有免費額度可試用。推薦翻譯模型：gpt-4o-mini（便宜）、claude-3-haiku（速度快）。</div>
      </div>
    </div>

    <!-- ── 快捷鍵 ── -->
    <div class="ab-panel" id="ab-panel-shortcuts">
      <table class="ab-shortcut-table">
        <tr><td>${t('sc.trans.file')}</td><td><span class="ab-kbd">Ctrl+Shift+T</span></td></tr>
        <tr><td>${t('sc.trans.project')}</td><td><span class="ab-kbd">Ctrl+Shift+Alt+T</span></td></tr>
        <tr><td>${t('sc.trans.sel')}</td><td><span class="ab-kbd">Ctrl+Shift+S</span></td></tr>
        <tr><td>${t('sc.find.replace')}</td><td><span class="ab-kbd">Ctrl+H</span></td></tr>
        <tr><td>${t('sc.settings')}</td><td><span class="ab-kbd">Ctrl+Shift+,</span></td></tr>
        <tr><td>${t('sc.about')}</td><td><span class="ab-kbd">F1</span></td></tr>
        <tr><td style="color:#666;padding-top:12px;font-style:italic;" colspan="2">${t('sc.orig.header')}</td></tr>
        <tr><td>${t('sc.orig.compile')}</td><td><span class="ab-kbd">Ctrl+B</span></td></tr>
        <tr><td>${t('sc.orig.save')}</td><td><span class="ab-kbd">Ctrl+S</span></td></tr>
        <tr><td>${t('sc.orig.new')}</td><td><span class="ab-kbd">Ctrl+N</span></td></tr>
        <tr><td>${t('sc.orig.open')}</td><td><span class="ab-kbd">Ctrl+O</span></td></tr>
        <tr><td>${t('sc.orig.replay')}</td><td><span class="ab-kbd">Ctrl+Shift+R</span></td></tr>
        <tr><td>${t('sc.orig.sidebar')}</td><td><span class="ab-kbd">Ctrl+\\</span></td></tr>
      </table>
    </div>

    <!-- ── 製作者 ── -->
    <div class="ab-panel" id="ab-panel-creator">
      <div class="ab-creator-section">
        <div class="ab-creator-avatar">
          <span style="font-size:48px;" aria-label="狐狸">🦊</span>
        </div>
        <div class="ab-creator-name">FloofyFox</div>
        <div class="ab-creator-email">
          <a href="#" onclick="require('electron').shell.openExternal('https://github.com/Teafox113');return false;"
             style="color:#0a84ff;text-decoration:none;font-size:12px;">
            github.com/Teafox113
          </a>
        </div>
        <div class="ab-version-badge">${forkInfo.appName} v${forkInfo.version}<br>修改日期：${forkInfo.modifiedDate}</div>
      </div>
      <hr class="ab-divider">
      <div class="ab-credit">
        <strong style="color:#f0f0f0;">${t('creator.added')}</strong><br>
        OpenRouter 整合 · 本地 LLM 接入（LM Studio / Ollama）· 多模型選擇與定價顯示 · ink 語法智能解析翻譯 · 批次翻譯專案 · 選取文字翻譯 · 搜尋 &amp; 取代面板 · HTML 標籤保護 · 費用追蹤 · 自動重試 · 詞彙表支援（glossary.csv）· 翻譯語言選擇（9 種）· i18n 繁中/英文介面 · AI 助理（5 個 Persona，可複選合併，記憶/人格設定）· 兩組 API Key 分開儲存 · 支援開啟 .lua / .txt 檔案（Lua 語法高亮，跳過 Ink 編譯）<br><br>
        <strong style="color:#f0f0f0;">${t('creator.original')}</strong><br>
        ${t('creator.original.by')}<br>
        GitHub：github.com/inkle/inky<br><br>
        <strong style="color:#f0f0f0;">${t('creator.ink.lang')}</strong><br>
        ${t('creator.ink.by')}<br>
        Docs：www.inklestudios.com/ink
      </div>
    </div>

  </div><!-- .ab-body -->
</div><!-- #about-modal -->
`;
    document.body.appendChild(overlay);

    // 關閉按鈕
    document.getElementById('about-close').addEventListener('click', closeAboutModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAboutModal(); });

    // Tab 切換
    overlay.querySelectorAll('.ab-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.querySelectorAll('.ab-tab').forEach(b => b.classList.remove('active'));
            overlay.querySelectorAll('.ab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('ab-panel-' + btn.dataset.panel).classList.add('active');
        });
    });

    // F1 開啟
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F1') { e.preventDefault(); openAboutModal(); }
    });
}

function openAboutModal() {
    const overlay = document.getElementById('about-overlay');
    if (overlay) overlay.classList.add('visible');
}

function closeAboutModal() {
    const overlay = document.getElementById('about-overlay');
    if (overlay) overlay.classList.remove('visible');
}

// ── Exports ───────────────────────────────────────────
module.exports = {
    TranslationView: {
        init,
        openSettingsDialog,
        closeSettingsDialog,
        translateCurrentFile,
        translateSelection,
        translateProject,
        openFindReplace,
        closeFindReplace,
        openAboutModal,
        closeAboutModal
    }
};
