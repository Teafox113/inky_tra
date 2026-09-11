// ── 頂層未捕獲例外處理 ──────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[Inky Main Process Crash]', err.stack || err.message);
});

const {app, BrowserWindow, ipcMain, dialog, ipcRenderer, Menu} = require('electron')
// Separate fork settings from the original Inky before any module reads userData.
app.setName('Inky Translation Fork');
const forkUserData = process.env.INKY_TRA_USER_DATA || require('path').join(app.getPath('appData'), 'Inky Translation Fork');
require('fs').mkdirSync(forkUserData, { recursive: true });
app.setPath('userData', forkUserData);
const i18n = require("./i18n/i18n.js")
const {ProjectWindow} = require("./projectWindow.js");
const {DocumentationWindow} = require("./documentationWindow.js");
const {AboutWindow} = require("./aboutWindow.js");
const {AppMenus} = require('./appmenus.js');
const {onForceQuit} = require('./forceQuitDetect');
const {Inklecate} = require("./inklecate.js");
const { fstat } = require('original-fs');
const {fs} = require("fs");
const translation = require('./translationManager.js');
const nodePath = require('path');
const nodeFs   = require('fs');
const { createExampleCopy } = require('./examples');
function openExample(id) {
    return ProjectWindow.open(createExampleCopy(id, app.getPath('userData')));
}

// ── 翻譯功能 IPC Handlers ─────────────────────────────

// ── 通用對話框 IPC ────────────────────────────────────
ipcMain.handle('showOpenDialog', async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return dialog.showOpenDialog(win, options || {});
});

ipcMain.handle('showSaveDialog', async (event, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return dialog.showSaveDialog(win, options || {});
});

// ── 整體 UI 語言切換（選單 + 翻譯面板同步）──────────────
ipcMain.handle('ui-switch-language', async (event, lang) => {
    try {
        // 1. 切換 i18n（選單會用到）
        i18n.switch(lang);

        // 2. 儲存偏好到翻譯設定
        const settings = translation.loadSettings();
        translation.saveSettings(Object.assign(settings, { uiLanguage: lang }));

        // 3. 重建選單（新語言立即生效）
        AppMenus.refresh();

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// 讀取翻譯設定
ipcMain.handle('translation-get-settings', async () => {
    return translation.loadSettings();
});

// 儲存翻譯設定
ipcMain.handle('translation-save-settings', async (event, settings) => {
    return translation.saveSettings(settings);
});

// 取得語言清單
ipcMain.handle('translation-get-languages', async () => {
    return {
        source: translation.SOURCE_LANGUAGES,
        target: translation.TARGET_LANGUAGES
    };
});

// 依語言自動生成 system prompt
ipcMain.handle('translation-generate-prompt', async (event, sourceLang, targetLang) => {
    return translation.generateSystemPrompt(sourceLang, targetLang);
});

// 取得用量統計
ipcMain.handle('translation-get-usage', async () => {
    return translation.loadUsage();
});

// 測試 API 連線
ipcMain.handle('translation-test-api', async (event, settings) => {
    return translation.testApiConnection(settings);
});

// ── 自動偵測 glossary.csv 輔助函式 ───────────────────
function resolveGlossary(explicitPath, nearFilePath) {
    if (explicitPath && nodeFs.existsSync(explicitPath)) return explicitPath;
    // 嘗試在 ink 檔同層目錄找 glossary.csv
    if (nearFilePath) {
        const nearby = nodePath.join(nodePath.dirname(nearFilePath), 'glossary.csv');
        if (nodeFs.existsSync(nearby)) return nearby;
        // 再往上一層尋找共用詞彙表
        const parent = nodePath.join(nodePath.dirname(nodePath.dirname(nearFilePath)), 'glossary.csv');
        if (nodeFs.existsSync(parent)) return parent;
    }
    return '';
}

// 翻譯單一檔案（路徑模式）
ipcMain.handle('translation-translate-file', async (event, filePath, glossaryPath, runtimeApiKey) => {
    try {
        const settings = translation.loadSettings();
        if (runtimeApiKey) settings.apiKey = runtimeApiKey; // 允許 renderer 傳入 session key
        const resolvedGlossary = resolveGlossary(glossaryPath || settings.glossaryPath || '', filePath);
        const glossary = translation.loadGlossary(resolvedGlossary);
        const content  = nodeFs.readFileSync(filePath, 'utf8');

        let lastProgress = null;
        const translated = await translation.translateInkFile(
            content, settings, glossary,
            (done, total, currentLine) => {
                lastProgress = { done, total, currentLine };
                // 發送進度到 renderer
                const win = BrowserWindow.fromWebContents(event.sender);
                if (win) win.webContents.send('translation-progress', { done, total, currentLine });
            }
        );

        const costData = translation.getCurrentCost();
        return { ok: true, translated, costData };
    } catch(e) {
        return { ok: false, error: e.message };
    }
});

// 翻譯文字內容（編輯器內容模式，不讀檔）
ipcMain.handle('translation-translate-content', async (event, inkContent, glossaryPath, runtimeApiKey) => {
    try {
        const settings = translation.loadSettings();
        if (runtimeApiKey) settings.apiKey = runtimeApiKey; // 允許 renderer 傳入 session key
        const glossary = translation.loadGlossary(glossaryPath || '');

        const translated = await translation.translateInkFile(
            inkContent, settings, glossary,
            (done, total, currentLine) => {
                const win = BrowserWindow.fromWebContents(event.sender);
                if (win) win.webContents.send('translation-progress', { done, total, currentLine });
            }
        );
        const costData = translation.getCurrentCost();
        return { ok: true, translated, costData };
    } catch(e) {
        return { ok: false, error: e.message };
    }
});

// 從 OpenRouter 取得模型清單
ipcMain.handle('translation-fetch-models', async (event, apiKey) => {
    try {
        const models = await translation.fetchOpenRouterModels(apiKey);
        return { ok: true, models };
    } catch(e) {
        return { ok: false, error: e.message };
    }
});

// ── 即時 AI 助理 IPC Handlers ─────────────────────────────

// 助理對話（重用翻譯 API 設定，但走獨立流程）
ipcMain.handle('assistant-chat', async (event, { apiUrl, apiKey, model, temperature, messages, promptPrice, completionPrice }) => {
    try {
        // 若 URL 沒有路徑（例如只填 http://127.0.0.1:1234），自動補 /v1/chat/completions
        let url = apiUrl || 'https://openrouter.ai/api/v1/chat/completions';
        if (url && !url.includes('/chat/completions') && !url.includes('/v1/')) {
            url = url.replace(/\/$/, '') + '/v1/chat/completions';
        }
        const isOR = url.includes('openrouter.ai');
        const headers = {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...(isOR ? { 'HTTP-Referer': 'https://inky-translator', 'X-Title': 'Inky AI Assistant' } : {})
        };
        const body = JSON.stringify({
            model,
            temperature: temperature || 0.6,
            max_tokens:  2048,
            messages,
        });
        const lib = url.startsWith('https') ? require('https') : require('http');
        const parsed = require('url').parse(url);

        const raw = await new Promise((resolve, reject) => {
            const req = lib.request({
                hostname: parsed.hostname,
                port:     parsed.port,
                path:     parsed.path,
                method:   'POST',
                headers:  { ...headers, 'Content-Length': Buffer.byteLength(body) }
            }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve({ status: res.statusCode, body: data }));
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });

        const json = JSON.parse(raw.body);
        if (!json.choices || !json.choices[0]) {
            return { ok: false, error: json.error ? json.error.message : '空回應' };
        }
        const content = json.choices[0].message.content;
        const usage   = json.usage || {};
        const costUsd = (usage.prompt_tokens || 0) * promptPrice
                      + (usage.completion_tokens || 0) * completionPrice;
        return { ok: true, content, usage, costUsd };
    } catch(e) {
        return { ok: false, error: e.message };
    }
});

// 助理檔案讀取（memory.md / soul.md）
// 使用 getter 函式避免在 app.ready 前呼叫 app.getPath()
function getAssistantDir() {
    return nodePath.join(app.getPath('userData'), 'assistant');
}

ipcMain.handle('assistant-read-file', async (event, filename) => {
    try {
        const assistantDir = getAssistantDir();
        if (!nodeFs.existsSync(assistantDir)) nodeFs.mkdirSync(assistantDir, { recursive: true });
        const fp = nodePath.join(assistantDir, filename);
        if (!nodeFs.existsSync(fp)) return { ok: false, content: '' };
        return { ok: true, content: nodeFs.readFileSync(fp, 'utf8') };
    } catch(e) { return { ok: false, error: e.message }; }
});

// 助理檔案寫入
ipcMain.handle('assistant-write-file', async (event, filename, content) => {
    try {
        const assistantDir = getAssistantDir();
        if (!nodeFs.existsSync(assistantDir)) nodeFs.mkdirSync(assistantDir, { recursive: true });
        const fp = nodePath.join(assistantDir, filename);
        nodeFs.writeFileSync(fp, content, 'utf8');
        return { ok: true };
    } catch(e) { return { ok: false, error: e.message }; }
});

// 助理：列出目錄下所有 .ink 檔案
ipcMain.handle('assistant-list-ink-files', async (event, dir) => {
    try {
        if (!dir || !nodeFs.existsSync(dir)) return { ok: false, files: [] };
        const results = [];
        const walk = (d) => {
            for (const entry of nodeFs.readdirSync(d, { withFileTypes: true })) {
                const full = nodePath.join(d, entry.name);
                if (entry.isDirectory()) walk(full);
                else if (entry.isFile() && /\.(ink|lua|txt)$/i.test(entry.name)) {
                    results.push(full);
                }
            }
        };
        walk(dir);
        return { ok: true, files: results };
    } catch(e) { return { ok: false, files: [], error: e.message }; }
});

// 助理：讀取指定 .ink 檔案內容
ipcMain.handle('assistant-read-ink-file', async (event, filePath) => {
    try {
        if (!filePath || !nodeFs.existsSync(filePath)) return { ok: false, content: '' };
        const content = nodeFs.readFileSync(filePath, 'utf8');
        return { ok: true, content };
    } catch(e) { return { ok: false, content: '', error: e.message }; }
});

// 翻譯選取的文字（純文字，不做 ink 語法解析）
ipcMain.handle('translation-translate-selection', async (event, selectedText, glossaryPath, runtimeApiKey) => {
    try {
        const settings = translation.loadSettings();
        if (runtimeApiKey) settings.apiKey = runtimeApiKey;
        const glossary = translation.loadGlossary(glossaryPath || '');
        translation.resetCurrentCost();
        const translated = await translation.translateBatch([selectedText], settings, glossary);
        const costData = translation.getCurrentCost();
        return { ok: true, translated: translated[0] || selectedText, costData };
    } catch(e) {
        return { ok: false, error: e.message };
    }
});

// 翻譯整個專案所有 .ink 檔並儲存到輸出目錄
ipcMain.handle('translation-translate-project', async (event, inkFiles, outputDir, glossaryPath, runtimeApiKey) => {
    try {
        const settings = translation.loadSettings();
        if (runtimeApiKey) settings.apiKey = runtimeApiKey; // 允許 renderer 傳入 session key
        const glossary = translation.loadGlossary(glossaryPath || '');

        if (!nodeFs.existsSync(outputDir)) {
            nodeFs.mkdirSync(outputDir, { recursive: true });
        }

        const results = [];
        for (let i = 0; i < inkFiles.length; i++) {
            const filePath = inkFiles[i];
            const filename = nodePath.basename(filePath);
            const outPath  = nodePath.join(outputDir, filename);

            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) win.webContents.send('translation-file-start', { index: i, total: inkFiles.length, filename });

            try {
                const content    = nodeFs.readFileSync(filePath, 'utf8');
                const translated = await translation.translateInkFile(
                    content, settings, glossary,
                    (done, total, currentLine) => {
                        if (win) win.webContents.send('translation-progress', { done, total, currentLine, filename });
                    }
                );
                nodeFs.writeFileSync(outPath, translated, 'utf8');
                results.push({ file: filename, ok: true });
            } catch(e) {
                results.push({ file: filename, ok: false, error: e.message });
            }
        }

        return { ok: true, results };
    } catch(e) {
        return { ok: false, error: e.message };
    }
});

// ─────────────────────────────────────────────────────


function inkJSNeedsUpdating() {
    return false;
    // dialog.showMessageBox({
    //   type: 'error',
    //   buttons: ['Okay'],
    //   title: 'Export for web unavailable',
    //   message: "Sorry, export for web is currently disabled, until inkjs is updated to support the latest version of ink. You can download a previous version of Inky that supports inkjs and use that instead, although some of the latest features of ink may be missing."
    // });
    // return true;
}

// main
let pendingPathToOpen = null;
let hasFinishedLaunch = false;

// main
ipcMain.on('show-context-menu', (event) => {
    const template = [
        {
            label: 'Cut',
            role: 'cut' 
        },
        {
            label: 'Copy',
            role: 'copy' 
        },
        {
            label: 'Paste',
            role: 'paste' 
        },
      { type: 'separator' },
    ]
    const menu = Menu.buildFromTemplate(template)
    menu.popup(BrowserWindow.fromWebContents(event.sender))
})


// showSaveDialog 已在上方（第 37 行）統一定義，此處移除重複

ipcMain.handle("try-close", async (event) =>{
    return dialog.showMessageBox({
        type: "warning",
        message: i18n._("Would you like to save changes before exiting?"),
        detail: i18n._("Your changes will be lost if you don't save."),
        buttons: [
            i18n._("Save"),
            i18n._("Don't save"),
            i18n._("Cancel")
        ],
        defaultId: 0
    })
    
})

app.on('will-finish-launching', function () {
    app.on("open-file", function (event, path) {
        ProjectWindow.open(path);
        event.preventDefault();
    });

});

let isQuitting = false;

app.on("open-file", function (event, path) {

    // e.g. Drag and drop onto app to open it.
    // "open-file" seems to come before "will-finish-launching"
    if( !hasFinishedLaunch ) {
        pendingPathToOpen = path;
    }
    
    // Drag and drop onto app while it's already open
    else {

        // See if this root file is already open in an existing window
        let existingWin = ProjectWindow.withMainkInkPath(path);
        if( existingWin ) {
            existingWin.browserWindow.focus();
            existingWin.browserWindow.webContents.send('open-main-ink');
        } else {
            ProjectWindow.open(path);       
        }
    }
    
    event.preventDefault();
});

app.on('before-quit', function () {
    // We need this to differentiate between pressing quit (which should quit) or closing all windows
    // (which leaves the app open)
    isQuitting = true;
});

ipcMain.on("project-cancelled-close", (event) => {
    isQuitting = false;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
    
    app.on('window-all-closed', function () {
        if (process.platform != 'darwin' || isQuitting) {
            app.quit();
        }
    });
    
    AppMenus.setCallbacks({
        openExample,
        new: () => {
            ProjectWindow.createEmpty();
        },
        newInclude: () => {
            var win = ProjectWindow.focused();
            if (win) win.newInclude();
        },
        open: () => {
            console.log("Test!")
            ProjectWindow.open();
        },
        clearRecent: () => {
            ProjectWindow.clearRecentFiles();
            AppMenus.setRecentFiles([]);
            AppMenus.refresh();
        },
        save: () => {
            var win = ProjectWindow.focused();
            if (win) win.save();
        },
        exportJson: () => {
            var win = ProjectWindow.focused();
            if (win) win.exportJson();
        },
        exportForWeb: () => {
            if( inkJSNeedsUpdating() ) return;
            var win = ProjectWindow.focused();
            if (win) win.exportForWeb();
        },
        exportJSOnly: () => {
            if( inkJSNeedsUpdating() ) return;
            var win = ProjectWindow.focused();
            if (win) win.exportJSOnly();
        },
        toggleTags: (item, focusedWindow, event) => {
            focusedWindow.webContents.send("set-tags-visible", item.checked);
        },
        nextIssue: (item, focusedWindow) => {
            focusedWindow.webContents.send("next-issue");
        },
        gotoAnything: (item, focusedWindow) => {
            focusedWindow.webContents.send("goto-anything");
        },
        addWatchExpression: (item, focusedWindow) => {
            focusedWindow.webContents.send("add-watch-expression");
        },
        showDocs: () => {
            DocumentationWindow.openDocumentation(ProjectWindow.getViewSettings().theme);
        },
        showAbout: () => {
            AboutWindow.showAboutWindow(ProjectWindow.getViewSettings().theme);
        },
        keyboardShortcuts: () => {
            var win = ProjectWindow.focused();
            if (win) win.keyboardShortcuts();
        },
        stats: () => {
            var win = ProjectWindow.focused();
            if (win) win.stats();
        },
        zoomIn: () => {
            var win = ProjectWindow.focused();
            if (win != null) {
                win.zoom(2);
                // Convert change from font size to zoom percentage
                let zoom = ProjectWindow.getViewSettings().zoom;
                zoom = (parseInt(zoom) + Math.floor(2*100/12)).toString();
                ProjectWindow.addOrChangeViewSetting('zoom', zoom);
            }
        },
        zoomOut: () => {
          var win = ProjectWindow.focused();
          if (win != null) {
              win.zoom(-2);
              // Convert change from font size to zoom percentage
              let zoom = ProjectWindow.getViewSettings().zoom
              zoom = (parseInt(zoom) - Math.floor(2*100/12)).toString();
              ProjectWindow.addOrChangeViewSetting('zoom', zoom);
            }
        },
        zoom: (zoom_percent) => {
            var win = ProjectWindow.focused();
            if (win != null) {
                win.zoom(zoom_percent);
                let zoom = zoom_percent.toString();
                ProjectWindow.addOrChangeViewSetting('zoom', zoom)
            }
        },
        toggleAnimation: () => {
            let animEnabled = !ProjectWindow.getViewSettings().animationEnabled;
            ProjectWindow.addOrChangeViewSetting('animationEnabled', animEnabled)

            for(let i=0; i<ProjectWindow.all().length; i++) {
                let eachWindow = ProjectWindow.all()[i];
                eachWindow.browserWindow.webContents.send("set-animation-enabled", animEnabled);
            }
        },
        toggleAutoComplete: () => {
            let autoCompleteDisabled = !ProjectWindow.getViewSettings().autoCompleteDisabled;
            ProjectWindow.addOrChangeViewSetting('autoCompleteDisabled', autoCompleteDisabled)

            for(let i=0; i<ProjectWindow.all().length; i++) {
                let eachWindow = ProjectWindow.all()[i];
                eachWindow.browserWindow.webContents.send("set-autocomplete-disabled", autoCompleteDisabled);
            }
        },
        insertSnippet: (focussedWindow, snippet) => {
            if( focussedWindow )
            focussedWindow.webContents.send('insertSnippet', snippet);
        },
        changeTheme: (newTheme) => {
            AboutWindow.changeTheme(newTheme);
            DocumentationWindow.changeTheme(newTheme);
            ProjectWindow.addOrChangeViewSetting('theme', newTheme)
        }
    });
    
    console.log("Testing!")

    // ── 套用儲存的 UI 語言偏好 ──────────────────────────
    try {
        const savedSettings = translation.loadSettings();
        if (savedSettings && savedSettings.uiLanguage) {
            i18n.switch(savedSettings.uiLanguage);
        }
    } catch(e) { /* 首次啟動尚無設定，忽略 */ }

    AppMenus.setRecentFiles(ProjectWindow.getRecentFiles());
    AppMenus.setTheme(ProjectWindow.getViewSettings().theme);
    AppMenus.setZoom(ProjectWindow.getViewSettings().zoom);
    AppMenus.setAnimationEnabled(ProjectWindow.getViewSettings().animationEnabled);
    AppMenus.setAutoCompleteDisabled(ProjectWindow.getViewSettings().autoCompleteDisabled)

    AppMenus.refresh();
    ProjectWindow.setEvents({
        onRecentFilesChanged: (recentFiles) => {
            AppMenus.setRecentFiles(recentFiles);
            AppMenus.refresh();
        },
        onProjectSettingsChanged: (settings) => {
            settings = settings || {};
            AppMenus.setCustomSnippetMenus(settings.customInkSnippets || []);
            AppMenus.refresh();
        },
        onViewSettingsChanged: (viewSettings) => {
            AppMenus.setTheme(viewSettings.theme);
            AppMenus.setZoom(viewSettings.zoom);
            AppMenus.setAnimationEnabled(viewSettings.animationEnabled);
            AppMenus.setAutoCompleteDisabled(viewSettings.autoCompleteDisabled);
            AppMenus.refresh();
        }
    });

    // Windows passed file to open on command line?
    if (process.platform == "win32" && process.argv.length > 1 && !pendingPathToOpen) {
        for (let i = 1; i < process.argv.length; i++) {
            var arg = process.argv[i].toLowerCase();
            if (arg.endsWith(".ink") || arg.endsWith(".lua") || arg.endsWith(".txt")) {
                pendingPathToOpen = process.argv[i];
                break;
            }
        }
    }

    // Opened Inky with specific file (e.g. drag and drop or windows command line)
    if( pendingPathToOpen ) {
        ProjectWindow.open(pendingPathToOpen);
        pendingPathToOpen = null;
    }
    
    // Show an editable original example on first launch.
    else {
        const welcomeFile = nodePath.join(app.getPath('userData'), 'welcome-mist-v1-seen.json');
        if (!nodeFs.existsSync(welcomeFile)) {
            openExample('mist');
            nodeFs.writeFileSync(welcomeFile, JSON.stringify({ shown: true }), 'utf8');
        } else {
            ProjectWindow.createEmpty();
        }
    }

    // Setup last stored theme
    let theme = ProjectWindow.getViewSettings().theme;
    AboutWindow.changeTheme(theme);
    DocumentationWindow.changeTheme(theme);

    hasFinishedLaunch = true;

    // Debug
    //w.openDevTools();
});

function finalQuit() {
    Inklecate.killSessions();
}

onForceQuit(finalQuit);
app.on("will-quit", finalQuit);
