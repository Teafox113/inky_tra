const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function generate() {
    const seen = new Set(), entries = [];
    function visit(name, parent) {
        let folder = parent;
        let file;
        while (folder.startsWith(root)) {
            const candidate = path.join(folder, 'node_modules', name, 'package.json');
            if (fs.existsSync(candidate)) { file = candidate; break; }
            const next = path.dirname(folder); if (next === folder) break; folder = next;
        }
        if (!file || seen.has(file)) return;
        seen.add(file);
        const p = JSON.parse(fs.readFileSync(file, 'utf8')), dir = path.dirname(file);
        const licenses = fs.readdirSync(dir).filter(n => /^(licen[sc]e|copying|notice)(\.|$)/i.test(n) && fs.statSync(path.join(dir,n)).isFile());
        const out = path.join(root, 'third_party/npm', p.name.replace(/\//g,'__') + '-' + p.version);
        fs.mkdirSync(out, { recursive: true });
        if (!licenses.length && p.name === 'randombytes') { fs.copyFileSync(path.join(root,'third_party/randombytes-LICENSE.txt'),path.join(out,'LICENSE')); licenses.push('LICENSE'); }
        for (const name of licenses.filter(n => fs.existsSync(path.join(dir,n)))) fs.copyFileSync(path.join(dir,name),path.join(out,name));
        entries.push({name:p.name,version:p.version,license:p.license || '需檢查',source:typeof p.repository === 'string' ? p.repository : p.repository?.url,notices:licenses});
        for (const dep of Object.keys({...p.dependencies,...p.optionalDependencies})) visit(dep,dir);
    }
    for (const name of Object.keys(require('../app/package.json').dependencies)) visit(name,path.join(root,'app'));
    if (!entries.length) throw new Error('請先安裝 app 依賴');
    if (entries.some(e => !e.notices.length)) throw new Error('仍有缺少授權文字的執行期依賴');
    fs.writeFileSync(path.join(root,'third_party/npm-inventory.json'),JSON.stringify(entries.sort((a,b)=>a.name.localeCompare(b.name)),null,2)+'\n');
    console.log('已保存 '+entries.length+' 個執行期 npm 套件的版本與授權檔。');
}
if (require.main === module) generate();
module.exports = { generate };
