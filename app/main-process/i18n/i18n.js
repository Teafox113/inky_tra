const electron = require('electron');
const fs = require('fs');
const path = require('path');

class i18n {
    constructor() {
        this.currentLocale = null;
        this.msgs = {}
        this.switch('zh-TW');

        electron.app.on('ready', () => {
            // 先用系統語系初始化，main.js 的 ready handler 之後會用儲存的偏好覆蓋
            this.switch(require('../translationManager.js').loadSettings().uiLanguage || 'zh-TW');
        });

        electron.ipcMain.on('i18n._', (event, msgid) => {
            event.returnValue = this._(msgid);
        });
    }

    _(msgid) {
        const key = Object.prototype.hasOwnProperty.call(this.msgs, msgid) ? msgid : msgid.replace(/&/g, '');
        return this.msgs[key] || msgid;
    }

    switch(lang) {
        this.currentLocale = lang;

        // 英文模式：清空 msgs，_() 會直接回傳 key（key 本身就是英文字串）
        if (lang === 'en') {
            this.msgs = {};
            return;
        }

        const file = path.join(__dirname, `${lang}.json`);
        if (fs.existsSync(file)) {
            // 清除 require 快取，確保重新載入（熱切換時有效）
            const resolved = require.resolve(file);
            if (require.cache[resolved]) delete require.cache[resolved];
            this.msgs = require(file);
        } else {
            const defaultLocale = electron.app.getLocale();
            if (lang !== defaultLocale) {
                this.switch(defaultLocale);
            } else {
                // 找不到任何語言檔，清空讓 key 直接顯示（英文）
                this.msgs = {};
            }
        }
    }
}

module.exports = new i18n();