const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function hash(data) { return crypto.createHash('sha256').update(data.toString('utf8').replace(/\r\n/g, '\n')).digest('hex'); }
function auditFiles(base, names, allowed) {
    const errors = [];
    for (const name of [...new Set(names)]) {
        const normalized = name.replace(/\\/g, '/');
        const full = path.resolve(base, name);
        if (!full.startsWith(path.resolve(base) + path.sep)) { errors.push('範圍外路徑：' + normalized); continue; }
        if (!fs.existsSync(full)) continue;
        if (fs.lstatSync(full).isSymbolicLink()) { errors.push('不允許符號連結：' + normalized); continue; }
        if (!fs.statSync(full).isFile()) continue;
        if (/(^|\/)(\.local|node_modules|dist)(\/|$)|(^|\/)(\.env(?:\..*)?|memory\.md|soul\.md|translation-settings\.json|translation-usage\.json)$|\.(bak(?:_.*)?|asar|zip|rar|7z|arcd|arci)$/i.test(normalized)) errors.push('私人資料或封存檔：' + normalized);
        if (/allure|wanton|核對區|翻譯完成beta/i.test(normalized)) errors.push('遊戲相關路徑：' + normalized);
        if (/\.(ink|ink\.json)$/i.test(normalized)) {
            if (!allowed[normalized]) errors.push('未列入允許清單的劇本：' + normalized);
            else if (hash(fs.readFileSync(full)) !== allowed[normalized].sha256) errors.push('劇本來源雜湊已變更：' + normalized);
        }
        if (/\.(js|json|md|html|txt|csv|ink|ya?ml)$/i.test(normalized)) {
            const data = fs.readFileSync(full, 'utf8');
            if (/sk-(?:or-v1-)?[A-Za-z0-9_-]{24,}/.test(data) || /gh[pousr]_[A-Za-z0-9]{30,}/.test(data)) errors.push('疑似憑證（不顯示內容）：' + normalized);
            if (normalized.startsWith('app/') && /Wanton Cove|Zal'chaas|MorichiDaughter|allure_ink/i.test(data)) errors.push('疑似第三方遊戲內容：' + normalized);
            if (/\.(json)$/i.test(normalized) && !normalized.endsWith('package-lock.json')) {
                try { const obj = JSON.parse(data); if (obj && obj.inkVersion && Array.isArray(obj.root)) errors.push('不得提交編譯故事 JSON：' + normalized); } catch (_) {}
            }
        }
    }
    return errors;
}
function candidates() {
    const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root }).toString().split('\0').filter(Boolean);
    // Also inspect ignored files inside the packaged application, except installed dependencies.
    function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full); else names.push(path.relative(root, full).replace(/\\/g, '/'));
    } }
    walk(path.join(root, 'app'));
    return names;
}
function check() {
    const allowed = require('./ink-allowlist.json');
    const errors = auditFiles(root, candidates(), allowed);
    for (const name of Object.keys(allowed)) if (!fs.existsSync(path.join(root, name))) errors.push('允許清單檔案遺失：' + name);
    if (errors.length) { console.error(errors.join('\n')); return false; }
    console.log('發布範圍檢查通過：' + Object.keys(allowed).length + ' 個已核對來源的 Ink 檔案；未偵測到禁止檔案或憑證模式。');
    return true;
}
if (require.main === module && !check()) process.exitCode = 1;
module.exports = { auditFiles, check, hash };
