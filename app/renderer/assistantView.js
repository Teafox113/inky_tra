/**
 * assistantView.js
 * 即時 AI 助理 — 浮動視窗 UI + 對話引擎
 * 不修改翻譯核心，以 AssistantContextBridge 讀取編輯器狀態
 */

const ipc  = require('electron').ipcRenderer;
const path = require('path');
const fs   = require('fs');

// ── 狀態 ─────────────────────────────────────────────────
let _asPanel       = null;
let _asMessages    = [];
let _asActivePersonas = new Set(['editor']); // 目前啟用的 persona 集合

// 可複選群組（前3個）vs 單選互斥群組（後2個）
const MULTI_PERSONAS  = new Set(['editor', 'actor', 'nsfw']);
const SINGLE_PERSONAS = new Set(['ink_debug', 'consistency']);
let _asMemory      = '';
let _asSoul        = '';
let _asCost        = { inputTokens: 0, outputTokens: 0, usdCost: 0 };
let _asIsTyping    = false;
let _editorRef     = null;
let _inkProjectRef = null;
let _asSettingsOpen = false;  // memory/soul 設定面板開關
let _asProjectFiles = [];     // 目前專案的 ink 檔清單

// ── Persona 預設 ─────────────────────────────────────────
const PERSONAS = {
    editor: {
        name: '劇情編輯',
        icon: '✍️',
        desc: '審視劇情節奏、角色動機與台詞自然度',
        temperature: 0.5,
        system: '你是互動小說劇情編輯，專門協助審視劇情節奏、角色動機、台詞自然度與中文在地化品質。請以專業但友善的方式給出建議，並可直接指出問題所在。',
    },
    actor: {
        name: '角色扮演',
        icon: '🎭',
        desc: '以指定角色第一人稱回應，測試情緒張力',
        temperature: 0.8,
        system: '你是角色扮演觀察者。當使用者指定角色後，你以第一人稱從該角色視角閱讀劇情、回應台詞、測試角色反應是否合理。保持角色設定一致，不要跳脫。',
    },
    nsfw: {
        name: '成人語氣',
        icon: '🔞',
        desc: '確保成人段落語氣強度與原文一致',
        temperature: 0.7,
        system: '你是成人向遊戲在地化編輯。你的任務是確保成人內容翻譯的語氣自然、強度與原文一致、情緒張力不流失，同時避免過度文青化或機翻感。可以直接、露骨地討論內容。',
    },
    ink_debug: {
        name: 'Ink 除錯',
        icon: '🔧',
        desc: '找語法錯誤與翻譯後可能破壞的 ink 語法',
        temperature: 0.2,
        system: '你是 Ink 劇本語法專家。你熟悉 ink 的 knot、stitch、divert、choice、conditional、gather、VAR、LIST 等所有語法。協助使用者找出語法錯誤、邏輯漏洞、或翻譯後可能破壞語法的地方。絕對保護 ink 語法不被修改。',
    },
    consistency: {
        name: '一致性',
        icon: '🔍',
        desc: '找用詞不統一、殘留英文與前後矛盾',
        temperature: 0.4,
        system: '你是翻譯一致性稽核員。你的任務是找出用詞不統一（人名、地名、術語多種譯法）、殘留英文詞彙、不符合台灣用語習慣、或前後文矛盾的地方，並給出統一建議。',
    },
};

// ── 注入樣式 ─────────────────────────────────────────────
function _injectStyles() {
    if (document.getElementById('as-styles')) return;
    const style = document.createElement('style');
    style.id = 'as-styles';
    style.textContent = `
#as-panel {
    position: fixed;
    bottom: 80px; right: 20px;
    width: 390px; height: 580px;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.55);
    display: flex; flex-direction: column;
    z-index: 9999;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #cdd6f4;
    overflow: hidden;
    resize: both;
    min-width: 300px; min-height: 380px;
    max-width: 680px; max-height: 88vh;
}
#as-panel.as-hidden { display: none !important; }

/* 標題列 */
#as-titlebar {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 10px 7px 12px;
    background: #181825;
    border-radius: 10px 10px 0 0;
    cursor: move; user-select: none; flex-shrink: 0;
    border-bottom: 1px solid #313244;
}
#as-titlebar .as-title { flex: 1; font-weight: 600; font-size: 13px; }
#as-cost-badge {
    font-size: 11px; color: #a6e3a1;
    background: rgba(166,227,161,0.12);
    padding: 2px 7px; border-radius: 8px;
    cursor: default;
}
.as-titlebar-btn {
    background: none; border: none; color: #6c7086;
    cursor: pointer; font-size: 14px; padding: 2px 5px;
    border-radius: 4px; line-height: 1;
}
.as-titlebar-btn:hover { color: #cdd6f4; background: #313244; }
#as-close-btn { color: #f38ba8; }
#as-close-btn:hover { color: #fff; background: rgba(243,139,168,0.2); }

/* 身份卡 */
#as-identity-card {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    background: #181825;
    border-bottom: 1px solid #313244;
    flex-shrink: 0;
}
#as-identity-icon {
    font-size: 22px; line-height: 1;
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    background: #313244; border-radius: 8px; flex-shrink: 0;
}
#as-identity-info { flex: 1; min-width: 0; }
#as-identity-name { font-weight: 700; font-size: 13px; color: #cdd6f4; }
#as-identity-desc { font-size: 11px; color: #6c7086; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Persona 切換列 */
#as-persona-bar {
    display: flex; gap: 3px; padding: 6px 10px;
    background: #1e1e2e;
    border-bottom: 1px solid #313244;
    flex-shrink: 0; flex-wrap: wrap;
}
.as-persona-btn {
    padding: 3px 7px; border-radius: 10px;
    border: 1px solid #45475a; background: #313244;
    color: #a6adc8; cursor: pointer; font-size: 11px;
    white-space: nowrap; transition: all 0.12s;
}
.as-persona-btn:hover { background: #45475a; color: #cdd6f4; }
.as-persona-btn.active {
    background: #45475a; border-color: #7287fd;
    color: #cdd6f4; font-weight: 600;
}
.as-persona-btn.multi { position: relative; }
.as-persona-btn.multi::after {
    content: '+'; position: absolute;
    top: -5px; right: -5px;
    width: 12px; height: 12px; font-size: 9px; line-height: 12px; text-align: center;
    background: #a6e3a1; color: #1e1e2e;
    border-radius: 50%; font-weight: 900; opacity: 0.85;
}

/* 上下文列（檔案選取） */
#as-ctx-bar {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 8px;
    background: #181825;
    border-bottom: 1px solid #313244;
    flex-shrink: 0; flex-wrap: wrap;
}
.as-ctx-btn {
    padding: 2px 8px; font-size: 11px;
    border: 1px solid #45475a; border-radius: 8px;
    background: #313244; color: #a6adc8;
    cursor: pointer; white-space: nowrap;
}
.as-ctx-btn:hover { background: #45475a; color: #cdd6f4; }
.as-ctx-btn.active { border-color: #89b4fa; color: #89b4fa; background: rgba(137,180,250,0.1); }
#as-ctx-label {
    font-size: 11px; color: #6c7086;
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#as-file-select {
    font-size: 11px; padding: 2px 4px;
    background: #313244; border: 1px solid #45475a;
    border-radius: 6px; color: #cdd6f4;
    max-width: 160px;
}

/* 對話區 */
#as-messages {
    flex: 1; overflow-y: auto;
    padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
}
.as-msg {
    padding: 8px 12px; border-radius: 10px;
    line-height: 1.5; max-width: 96%;
    word-break: break-word; white-space: pre-wrap;
}
.as-msg.user {
    align-self: flex-end;
    background: #45475a; color: #cdd6f4;
    border-bottom-right-radius: 3px;
}
.as-msg.assistant {
    align-self: flex-start;
    background: #313244; color: #cdd6f4;
    border-bottom-left-radius: 3px;
}
.as-msg.system-note {
    align-self: center; font-size: 11px;
    color: #6c7086; background: transparent; padding: 2px 0;
}
.as-typing { font-style: italic; color: #6c7086; }

/* 輸入列 */
#as-input-row {
    display: flex; align-items: flex-end; gap: 6px;
    padding: 7px 10px;
    background: #181825;
    border-top: 1px solid #313244;
    flex-shrink: 0;
}
#as-input {
    flex: 1; resize: none; padding: 7px 10px;
    background: #313244; border: 1px solid #45475a;
    border-radius: 8px; color: #cdd6f4;
    font-size: 13px; outline: none;
    min-height: 36px; max-height: 100px;
    font-family: inherit; line-height: 1.4;
}
#as-input:focus { border-color: #7287fd; }
#as-send-btn {
    padding: 6px 14px;
    background: #45475a; color: #cdd6f4;
    border: 1px solid #585b70; border-radius: 8px;
    cursor: pointer; font-size: 13px;
    font-weight: 600; height: 36px; flex-shrink: 0;
    transition: background 0.12s;
}
#as-send-btn:hover { background: #585b70; }
#as-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Memory/Soul 設定面板 */
#as-settings-panel {
    position: absolute; top: 0; right: 0; bottom: 0;
    width: 100%; background: #1e1e2e;
    display: flex; flex-direction: column;
    z-index: 10; border-radius: 10px;
}
#as-settings-panel.as-hidden { display: none; }
#as-settings-header {
    display: flex; align-items: center; padding: 9px 12px;
    background: #181825; border-bottom: 1px solid #313244;
    border-radius: 10px 10px 0 0; flex-shrink: 0;
    font-weight: 600;
}
#as-settings-header span { flex: 1; }
.as-settings-tab-bar {
    display: flex; border-bottom: 1px solid #313244; flex-shrink: 0;
}
.as-stab {
    flex: 1; padding: 6px; text-align: center;
    font-size: 12px; cursor: pointer;
    color: #6c7086; border-bottom: 2px solid transparent;
    background: none; border-top: none; border-left: none; border-right: none;
}
.as-stab.active { color: #cdd6f4; border-bottom-color: #7287fd; }
.as-stab-content { display: none; flex: 1; flex-direction: column; padding: 8px; }
.as-stab-content.active { display: flex; }
.as-stab-content textarea {
    flex: 1; resize: none;
    background: #313244; border: 1px solid #45475a;
    border-radius: 6px; color: #cdd6f4;
    font-size: 12px; padding: 8px; font-family: monospace;
    line-height: 1.5; outline: none;
}
.as-stab-content textarea:focus { border-color: #7287fd; }
.as-stab-hint { font-size: 11px; color: #6c7086; margin-bottom: 5px; }
#as-settings-footer {
    display: flex; justify-content: flex-end; gap: 6px;
    padding: 8px 12px; border-top: 1px solid #313244; flex-shrink: 0;
}
.as-btn-save {
    padding: 5px 16px; border-radius: 6px;
    background: #7287fd; color: #fff; border: none;
    cursor: pointer; font-size: 12px; font-weight: 600;
}
.as-btn-save:hover { background: #89b4fa; }
.as-btn-cancel {
    padding: 5px 12px; border-radius: 6px;
    background: #313244; color: #cdd6f4; border: 1px solid #45475a;
    cursor: pointer; font-size: 12px;
}
`;
    document.head.appendChild(style);
}

// ── 建立浮動視窗 ─────────────────────────────────────────
function _buildPanel() {
    if (document.getElementById('as-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'as-panel';
    panel.className = 'as-hidden';
    panel.innerHTML = `
        <!-- 標題列 -->
        <div id="as-titlebar">
            <span>🤖</span>
            <span class="as-title">AI 助理</span>
            <span id="as-cost-badge" title="">$0.0000</span>
            <button class="as-titlebar-btn" id="as-settings-btn" title="Memory / Soul 設定">⚙</button>
            <button class="as-titlebar-btn" id="as-clear-btn" title="清除對話">↺</button>
            <button class="as-titlebar-btn" id="as-close-btn" title="關閉">×</button>
        </div>

        <!-- 身份卡 -->
        <div id="as-identity-card">
            <div id="as-identity-icon">✍️</div>
            <div id="as-identity-info">
                <div id="as-identity-name">劇情編輯</div>
                <div id="as-identity-desc">審視劇情節奏、角色動機與台詞自然度</div>
            </div>
        </div>

        <!-- Persona 切換列 -->
        <div id="as-persona-bar"></div>

        <!-- 上下文列 -->
        <div id="as-ctx-bar">
            <button class="as-ctx-btn" id="as-ctx-selection-btn" title="附加目前選取文字">📋 選取</button>
            <button class="as-ctx-btn" id="as-ctx-curfile-btn" title="附加目前開啟的 ink 檔">📄 目前檔</button>
            <span id="as-ctx-label">（未附加上下文）</span>
        </div>

        <!-- 對話區 -->
        <div id="as-messages"></div>

        <!-- 輸入列 -->
        <div id="as-input-row">
            <textarea id="as-input" rows="1" placeholder="輸入訊息… (Enter 送出，Shift+Enter 換行)"></textarea>
            <button id="as-send-btn">送出</button>
        </div>

        <!-- Memory/Soul 設定面板（覆蓋層） -->
        <div id="as-settings-panel" class="as-hidden">
            <div id="as-settings-header">
                <span>⚙ 助理設定</span>
                <button class="as-titlebar-btn" id="as-settings-close-btn">×</button>
            </div>
            <div class="as-settings-tab-bar">
                <button class="as-stab active" data-stab="memory">🧠 Memory</button>
                <button class="as-stab" data-stab="soul">👤 Soul</button>
            </div>
            <div class="as-stab-content active" id="as-stab-memory">
                <div class="as-stab-hint">記憶（每次對話開始前注入，可手動編輯累積）</div>
                <textarea id="as-memory-edit" placeholder="在此記錄助理需要記住的事項，例如：角色設定、世界觀規則、已確認的譯法…"></textarea>
            </div>
            <div class="as-stab-content" id="as-stab-soul">
                <div class="as-stab-hint">人格設定（soul.md — 補充到選定 Persona 之後）</div>
                <textarea id="as-soul-edit" placeholder="在此定義助理的語氣、態度、稱呼方式等。例如：請以輕鬆友善的方式回應，可以偶爾開個小玩笑…"></textarea>
            </div>
            <div id="as-settings-footer">
                <button class="as-btn-cancel" id="as-settings-cancel-btn">取消</button>
                <button class="as-btn-save" id="as-settings-save-btn">儲存</button>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    _asPanel = panel;

    _buildPersonaBar();
    _makeDraggable(panel, document.getElementById('as-titlebar'));
    _bindEvents();
    _addSystemNote('👋 助理已就緒。選取 Persona 後開始對話，或先附加上下文再發問。');
}

// ── 事件綁定 ─────────────────────────────────────────────
function _bindEvents() {
    document.getElementById('as-close-btn').addEventListener('click', closeAssistant);
    document.getElementById('as-send-btn').addEventListener('click', _sendMessage);
    document.getElementById('as-clear-btn').addEventListener('click', () => {
        _asMessages = [];
        document.getElementById('as-messages').innerHTML = '';
        _addSystemNote('已清除對話紀錄。');
    });

    document.getElementById('as-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendMessage(); }
    });
    document.getElementById('as-input').addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // 上下文按鈕
    document.getElementById('as-ctx-selection-btn').addEventListener('click', _attachSelection);
    document.getElementById('as-ctx-curfile-btn').addEventListener('click', _attachCurrentFile);

    // 設定面板
    document.getElementById('as-settings-btn').addEventListener('click', _openSettings);
    document.getElementById('as-settings-close-btn').addEventListener('click', _closeSettings);
    document.getElementById('as-settings-cancel-btn').addEventListener('click', _closeSettings);
    document.getElementById('as-settings-save-btn').addEventListener('click', _saveSettings);

    // 設定 tab 切換
    document.querySelectorAll('.as-stab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.as-stab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.as-stab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('as-stab-' + btn.dataset.stab).classList.add('active');
        });
    });
}

// ── Persona 切換 ─────────────────────────────────────────
function _buildPersonaBar() {
    const bar = document.getElementById('as-persona-bar');
    bar.innerHTML = '';
    for (const [key, p] of Object.entries(PERSONAS)) {
        const btn = document.createElement('button');
        const isActive = _asActivePersonas.has(key);
        const isMulti  = MULTI_PERSONAS.has(key);
        btn.className = 'as-persona-btn' + (isActive ? ' active' : '') + (isMulti ? ' multi' : '');
        btn.textContent = `${p.icon} ${p.name}`;
        btn.title = isMulti ? '可複選（點擊切換）' : '單選（互斥）';
        btn.dataset.persona = key;
        btn.addEventListener('click', () => _switchPersona(key));
        bar.appendChild(btn);
    }
}

function _updateIdentityCard() {
    const activeKeys = Array.from(_asActivePersonas);
    if (activeKeys.length === 1) {
        const p = PERSONAS[activeKeys[0]];
        document.getElementById('as-identity-icon').textContent = p.icon;
        document.getElementById('as-identity-name').textContent = p.name;
        document.getElementById('as-identity-desc').textContent = p.desc;
    } else {
        const icons = activeKeys.map(k => PERSONAS[k].icon).join('');
        const names = activeKeys.map(k => PERSONAS[k].name).join(' + ');
        const descs  = activeKeys.map(k => PERSONAS[k].desc).join('；');
        document.getElementById('as-identity-icon').textContent = icons;
        document.getElementById('as-identity-name').textContent = names;
        document.getElementById('as-identity-desc').textContent = descs;
    }
}

function _switchPersona(key) {
    const wasActive = _asActivePersonas.has(key);

    if (MULTI_PERSONAS.has(key)) {
        // 複選 toggle
        if (wasActive) {
            _asActivePersonas.delete(key);
            if (_asActivePersonas.size === 0) _asActivePersonas.add('editor');
        } else {
            // 加入複選時清除單選 persona
            for (const sk of SINGLE_PERSONAS) _asActivePersonas.delete(sk);
            _asActivePersonas.add(key);
        }
        // 複選切換不清除對話
    } else {
        // 單選：清除所有，只保留此 persona
        _asActivePersonas.clear();
        _asActivePersonas.add(key);
        _asMessages = [];
        document.getElementById('as-messages').innerHTML = '';
        const p = PERSONAS[key];
        _addSystemNote(`已切換至「${p.icon} ${p.name}」— ${p.desc}`);
    }

    _buildPersonaBar();
    _updateIdentityCard();

    if (MULTI_PERSONAS.has(key)) {
        const activeNames = Array.from(_asActivePersonas).map(k => `${PERSONAS[k].icon} ${PERSONAS[k].name}`).join(' + ');
        _addSystemNote(`Persona：${activeNames}`);
    }
}

// ── 上下文附加 ───────────────────────────────────────────
let _pendingContext = '';  // 下一則訊息要附加的上下文

function _setCtxLabel(label, active) {
    const el = document.getElementById('as-ctx-label');
    el.textContent = label;
    document.getElementById('as-ctx-selection-btn').classList.toggle('active', active === 'sel');
    document.getElementById('as-ctx-curfile-btn').classList.toggle('active', active === 'file');
}

function _attachSelection() {
    const sel = _getEditorSelection();
    if (!sel) { _setCtxLabel('（未選取文字）', ''); return; }
    _pendingContext = sel;
    _setCtxLabel(`📋 選取 ${sel.length} 字元`, 'sel');
}

async function _attachCurrentFile() {
    try {
        const content = _getEditorFullContent();
        if (!content) { _setCtxLabel('（無法讀取目前檔案）', ''); return; }
        _pendingContext = content;
        const lines = content.split('\n').length;
        _setCtxLabel(`📄 目前檔（${lines} 行）`, 'file');
    } catch(e) {
        _setCtxLabel('（讀取失敗）', '');
    }
}

async function _attachSelectedFile() {
    const sel = document.getElementById('as-file-select');
    const fp = sel.value;
    if (!fp) { _pendingContext = ''; _setCtxLabel('（未附加上下文）', ''); return; }
    try {
        const result = await ipc.invoke('assistant-read-ink-file', fp);
        if (result.ok) {
            _pendingContext = result.content;
            _setCtxLabel(`📂 ${path.basename(fp)}（${result.content.split('\n').length} 行）`, 'file');
        } else {
            _setCtxLabel(`（讀取失敗：${result.error}）`, '');
        }
    } catch(e) {
        _setCtxLabel(`（例外：${e.message}）`, '');
    }
}

// ── 讀取編輯器內容 ───────────────────────────────────────
function _getEditorSelection() {
    try {
        if (_editorRef && typeof _editorRef.getSelectedText === 'function') {
            const s = _editorRef.getSelectedText();
            if (s && s.trim()) return s.trim();
        }
    } catch(e) {}
    return '';
}

function _getEditorFullContent() {
    try {
        if (_editorRef && typeof _editorRef.getValue === 'function') {
            return _editorRef.getValue() || '';
        }
    } catch(e) {}
    return '';
}

// ── 建立 system prompt ───────────────────────────────────
function _buildSystemPrompt() {
    const activeKeys = Array.from(_asActivePersonas);
    let prompt;
    if (activeKeys.length === 1) {
        prompt = PERSONAS[activeKeys[0]].system;
    } else {
        // 多個 persona：合併 system prompt
        const combined = activeKeys.map(k => `【${PERSONAS[k].name}】\n${PERSONAS[k].system}`).join('\n\n');
        prompt = `你同時扮演以下多個角色，請綜合所有角色的視角來協助使用者：\n\n${combined}`;
    }
    if (_asSoul && _asSoul.trim()) prompt += `\n\n【助理人格補充（soul）】\n${_asSoul}`;
    if (_asMemory && _asMemory.trim()) prompt += `\n\n【記憶（memory）】\n${_asMemory}`;
    return prompt;
}

// 取目前啟用 persona 的平均 temperature
function _getActiveTemperature() {
    const keys = Array.from(_asActivePersonas);
    return keys.reduce((sum, k) => sum + PERSONAS[k].temperature, 0) / keys.length;
}

// ── 送出訊息 ─────────────────────────────────────────────
async function _sendMessage() {
    if (_asIsTyping) return;
    const input = document.getElementById('as-input');
    const userText = input.value.trim();
    if (!userText) return;

    let fullContent = userText;
    if (_pendingContext) {
        fullContent = `${userText}\n\n【附加上下文】\n\`\`\`ink\n${_pendingContext}\n\`\`\``;
    }

    input.value = '';
    input.style.height = 'auto';
    _addMsg('user', userText + (_pendingContext ? `\n\n📎 已附加上下文（${_pendingContext.length} 字元）` : ''));
    _asMessages.push({ role: 'user', content: fullContent });
    _pendingContext = '';  // 上下文用完清除
    _setCtxLabel('（未附加上下文）', '');

    _asIsTyping = true;
    document.getElementById('as-send-btn').disabled = true;
    const typingEl = _addMsg('assistant', '…');
    typingEl.classList.add('as-typing');

    try {
        const settings = await ipc.invoke('translation-get-settings');
        if (!settings.apiKey) {
            typingEl.textContent = '⚠️ 尚未設定 API Key，請先在翻譯設定中登入。';
            typingEl.classList.remove('as-typing');
            _asIsTyping = false; document.getElementById('as-send-btn').disabled = false;
            return;
        }
        const messages = [{ role: 'system', content: _buildSystemPrompt() }, ..._asMessages];

        const result = await ipc.invoke('assistant-chat', {
            apiUrl:          settings.apiUrl,
            apiKey:          settings.apiKey,
            model:           settings.model,
            temperature:     _getActiveTemperature(),
            messages,
            promptPrice:     settings.promptPricePerToken    || 0,
            completionPrice: settings.completionPricePerToken || 0,
        });

        if (result.ok) {
            typingEl.textContent = result.content;
            typingEl.classList.remove('as-typing');
            _asMessages.push({ role: 'assistant', content: result.content });
            if (result.usage) {
                _asCost.inputTokens  += result.usage.prompt_tokens      || 0;
                _asCost.outputTokens += result.usage.completion_tokens   || 0;
                _asCost.usdCost      += result.costUsd || 0;
                _updateCostBadge();
            }
        } else {
            typingEl.textContent = `⚠️ 錯誤：${result.error}`;
            typingEl.classList.remove('as-typing');
            _asMessages.pop();
        }
    } catch(e) {
        typingEl.textContent = `⚠️ 例外：${e.message}`;
        typingEl.classList.remove('as-typing');
        _asMessages.pop();
    }

    _asIsTyping = false;
    document.getElementById('as-send-btn').disabled = false;
    document.getElementById('as-messages').scrollTop = 999999;
}

// ── Memory/Soul 設定面板 ─────────────────────────────────
function _openSettings() {
    document.getElementById('as-memory-edit').value = _asMemory;
    document.getElementById('as-soul-edit').value   = _asSoul;
    document.getElementById('as-settings-panel').classList.remove('as-hidden');
}

function _closeSettings() {
    document.getElementById('as-settings-panel').classList.add('as-hidden');
}

async function _saveSettings() {
    _asMemory = document.getElementById('as-memory-edit').value;
    _asSoul   = document.getElementById('as-soul-edit').value;
    await ipc.invoke('assistant-write-file', 'memory.md', _asMemory);
    await ipc.invoke('assistant-write-file', 'soul.md',   _asSoul);
    _closeSettings();
    _addSystemNote('✅ Memory / Soul 已儲存並生效。');
}

// ── 訊息顯示 ─────────────────────────────────────────────
function _addMsg(role, content) {
    const div = document.createElement('div');
    div.className = `as-msg ${role}`;
    div.textContent = content;
    const box = document.getElementById('as-messages');
    box.appendChild(div);
    box.scrollTop = 999999;
    return div;
}

function _addSystemNote(text) {
    const div = document.createElement('div');
    div.className = 'as-msg system-note';
    div.textContent = text;
    const box = document.getElementById('as-messages');
    box.appendChild(div);
    box.scrollTop = 999999;
}

// ── 費用顯示 ─────────────────────────────────────────────
function _updateCostBadge() {
    const badge = document.getElementById('as-cost-badge');
    if (!badge) return;
    const usd = _asCost.usdCost;
    badge.textContent = usd < 0.0001
        ? `${_asCost.inputTokens + _asCost.outputTokens} tok`
        : `$${usd.toFixed(4)}`;
    badge.title = `Input: ${_asCost.inputTokens} tok  Output: ${_asCost.outputTokens} tok\n費用: $${usd.toFixed(6)} USD`;
}

// ── 拖曳 ─────────────────────────────────────────────────
function _makeDraggable(panel, handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0;
    handle.addEventListener('mousedown', e => {
        if (e.target.classList.contains('as-titlebar-btn')) return;
        sx = e.clientX; sy = e.clientY;
        const r = panel.getBoundingClientRect();
        ox = r.left; oy = r.top;
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    function onMove(e) {
        panel.style.left   = (ox + e.clientX - sx) + 'px';
        panel.style.top    = (oy + e.clientY - sy) + 'px';
        panel.style.right  = 'auto';
        panel.style.bottom = 'auto';
    }
    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }
}

// ── 更新專案檔案下拉 ─────────────────────────────────────
async function _refreshProjectFiles() {
    try {
        // 從目前專案的 ink 主檔目錄取得所有 .ink 檔
        let dir = '';
        if (_inkProjectRef && _inkProjectRef.activeInkFile) {
            const fp = _inkProjectRef.activeInkFile.fileSystemPath
                    || _inkProjectRef.activeInkFile.filename
                    || '';
            if (fp) dir = path.dirname(fp);
        }
        if (!dir) { _asProjectFiles = []; _buildFileSelect([]); return; }

        const result = await ipc.invoke('assistant-list-ink-files', dir);
        _asProjectFiles = result.ok ? result.files : [];
        _buildFileSelect(_asProjectFiles);
    } catch(e) { _buildFileSelect([]); }
}

function _buildFileSelect(files) {
    const sel = document.getElementById('as-file-select');
    sel.innerHTML = '<option value="">📁 選 ink 檔…</option>';
    for (const fp of files) {
        const opt = document.createElement('option');
        opt.value = fp;
        opt.textContent = path.basename(fp);
        sel.appendChild(opt);
    }
}

// ── 開關 ─────────────────────────────────────────────────
function openAssistant() {
    if (!_asPanel) _buildPanel();
    _asPanel.classList.remove('as-hidden');
    _refreshProjectFiles();
    document.getElementById('as-input').focus();
}

function closeAssistant() {
    if (_asPanel) _asPanel.classList.add('as-hidden');
}

function toggleAssistant() {
    if (!_asPanel || _asPanel.classList.contains('as-hidden')) openAssistant();
    else closeAssistant();
}

// ── 初始化 ───────────────────────────────────────────────
async function init(editorView, inkProject) {
    _editorRef     = editorView;
    _inkProjectRef = inkProject;
    _injectStyles();
    _buildPanel();

    try {
        const mem  = await ipc.invoke('assistant-read-file', 'memory.md');
        const soul = await ipc.invoke('assistant-read-file', 'soul.md');
        if (mem.ok  && mem.content)  _asMemory = mem.content;
        if (soul.ok && soul.content) _asSoul   = soul.content;
    } catch(e) {}
}

module.exports = { init, openAssistant, closeAssistant, toggleAssistant };
