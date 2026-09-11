const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const info = require('../app/version.json');
async function build() {
    if (process.platform !== 'win32') throw new Error('目前只驗證 Windows x64 建置流程。');
    execFileSync(process.execPath, [path.join(root, 'scripts/check-publish.js')], { cwd: root, stdio: 'inherit' });
    execFileSync(process.execPath, ['--test', ...fs.readdirSync(path.join(root, 'tests')).filter(n => n.endsWith('.test.js')).map(n => 'tests/' + n)], { cwd: root, stdio: 'inherit' });
    require('./dependency-notices.js').generate();
    const packager = require('../app/node_modules/@electron/packager');
    const target = path.join(root, 'dist', 'Inky-Translation-Fork-v' + info.version + '-windows-x64');
    if (fs.existsSync(target) || fs.existsSync(target + '.zip')) throw new Error('此版本輸出已存在，請先備份或更新版本。');
    const buildOut = path.join(root, '.local', 'build-' + Date.now());
    const numeric = info.version.split('-')[0];
    const outputs = await packager({
        dir: path.join(root, 'app'), out: buildOut, tmpdir: path.join(root, '.local', 'packager-temp'), name: 'Inky-Translation-Fork', platform: 'win32', arch: 'x64',
        appVersion: numeric, buildVersion: numeric, appCopyright: 'Original Inky: inkle Ltd. Fork maintained by FloofyFox.',
        icon: path.join(root, 'resources/Icon1024.png.ico'), prune: true,
        asar: { unpackDir: 'main-process/ink' },
        ignore: [/^\/test(?:\/|$)/, /^\/build-package\.js$/, /inklecate_mac$/, /inklecate_linux$/],
        win32metadata: { CompanyName: info.creator, FileDescription: info.appName + ' ' + info.version,
            ProductName: info.appName, OriginalFilename: 'Inky-Translation-Fork.exe', InternalName: 'Inky-Translation-Fork' }
    });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    // Copy to avoid directory rename failures caused by transient Windows file locks.
    fs.cpSync(outputs[0], target, { recursive: true, errorOnExist: true, force: false });
    for (const name of ['LICENSE', 'README.md', 'CHANGELOG.md', 'THIRD_PARTY_LICENSES.md']) {
        // Electron's existing LICENSE must stay intact.
        fs.copyFileSync(path.join(root, name), path.join(target, name === 'LICENSE' ? 'LICENSE-Inky.txt' : name));
    }
    // The packaged examples live beside the executable, not under app/.
    const packagedReadme = path.join(target, 'README.md');
    fs.writeFileSync(packagedReadme, fs.readFileSync(packagedReadme, 'utf8').replaceAll('app/examples/', '範例/'));
    fs.cpSync(path.join(root, 'third_party'), path.join(target, 'third_party'), { recursive: true });
    fs.cpSync(path.join(root, 'docs'), path.join(target, 'docs'), { recursive: true });
    fs.cpSync(path.join(root, 'app/examples'), path.join(target, '範例'), { recursive: true });
    fs.writeFileSync(path.join(target, '開始使用.txt'), '請雙擊 Inky-Translation-Fork.exe。首次啟動預設繁體中文，並開啟霧港十三夜（角色與分支教學）。\r\n可由上方「範例」選單再次開啟，或直接開啟本資料夾的「範例」子資料夾。\r\n', 'utf8');
    const pack = require('../app/node_modules/@electron/asar');
    const archive = path.join(target, 'resources/app.asar');
    const names = pack.listPackage(archive).map(p => p.replace(/\\/g, '/').replace(/^\//, ''));
    const allowed = require('./ink-allowlist.json');
    for (const name of names) {
        if (/\.(ink|ink\.json)$/i.test(name) && !allowed['app/' + name]) throw new Error('封裝出現未知劇本：' + name);
        if (/allure|wanton|avatar\.png|translation-settings\.json|translation-usage\.json|memory\.md|soul\.md/i.test(name)) throw new Error('封裝出現禁止檔案：' + name);
    }
    const archiveInfo = JSON.parse(pack.extractFile(archive, 'version.json'));
    if (archiveInfo.version !== info.version) throw new Error('封裝版本不一致');
    const env = { ...process.env, INKY_TRA_ZIP_SOURCE: target, INKY_TRA_ZIP_TARGET: target + '.zip' };
    execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Compress-Archive -LiteralPath $env:INKY_TRA_ZIP_SOURCE -DestinationPath $env:INKY_TRA_ZIP_TARGET'], { env, stdio: 'inherit' });
    console.log('建置完成：' + target + '.zip');
}
if (require.main === module) build().catch(e => { console.error(e.stack || e.message); process.exitCode = 1; });
module.exports = { build };
