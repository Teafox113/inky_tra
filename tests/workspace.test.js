const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.local', 'test-output');
fs.mkdirSync(output, { recursive: true });
const managerPath = path.join(root, 'app/main-process/translationManager.js');
const localRequire = createRequire(managerPath);
const moduleMock = { exports: {} };
vm.runInNewContext(fs.readFileSync(managerPath, 'utf8'), {
    module: moduleMock, exports: moduleMock.exports, console, Buffer, setTimeout, clearTimeout,
    require: name => name === 'electron' ? { app: { getPath: () => output } } : localRequire(name)
}, { filename: managerPath });
const manager = moduleMock.exports;

test('版本、README、Change Log 與 About 共用制式資訊', () => {
    const info = require('../app/version.json'), pkg = require('../app/package.json');
    assert.equal(pkg.version, info.version);
    assert.equal(pkg.productName, info.appName);
    for (const file of ['README.md', 'CHANGELOG.md']) assert.ok(fs.readFileSync(path.join(root,file),'utf8').includes(info.version));
    assert.equal(info.fileName, 'Inky-Translation-Fork-v' + info.version + '-windows-x64.zip');
    assert.ok(fs.readFileSync(path.join(root,'app/renderer/translationView.js'),'utf8').includes('forkInfo.version'));
    assert.ok(fs.readFileSync(path.join(root,'app/renderer/about/controller.js'),'utf8').includes('forkInfo.version'));
});

test('匯入與新增的主程式及 renderer JavaScript 語法可解析', () => {
    for (const dir of ['app/main-process','app/renderer','scripts']) {
        for (const name of fs.readdirSync(path.join(root,dir))) {
            if (!name.endsWith('.js')) continue;
            const file=path.join(root,dir,name);
            assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file,'utf8'), { filename:file }));
        }
    }
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(root,'app/main-process/i18n/zh-TW.json'),'utf8')));
});

test('翻譯解析保留變數、跳轉及帶條件的選項結構', () => {
    for (const line of ['VAR cups = 0', '~ cups = cups + 1', '-> bookstore', '=== bookstore ===', 'INCLUDE chapter.ink']) {
        const parsed=manager.parseInkLine(line);
        assert.equal(parsed.type,'skip');assert.equal(parsed.prefix,line);
    }
    const parsed=manager.parseInkLine('+ {cups > 0} [Read a book] -> shelf');
    assert.equal(parsed.translatable,'Read a book');
    assert.equal(parsed.prefix+'看看書'+parsed.suffix,'+ {cups > 0} [看看書] -> shelf');
    const branch=manager.parseInkLine('    - cups == 2: Have another cup.');
    assert.ok(branch.prefix.includes('cups == 2:'));
    assert.equal(branch.translatable,'Have another cup.');
});

test('詞彙表讀取原創範例，且跳過標頭', () => {
    const glossary=manager.loadGlossary(path.join(root,'app/examples/translation-practice/glossary.csv'));
    assert.equal(glossary['Maple Bookshop'],'楓葉書店');assert.equal(glossary.Mira,'米拉');assert.equal(glossary.en_term,undefined);
});

function compile(relative, fileName) {
    const compiler=path.join(root,'app/main-process/ink/inklecate_win.exe');
    const result=path.join(output,fileName);
    execFileSync(compiler,['-o',result,path.join(root,relative)],{cwd:root,stdio:'pipe'});
    return fs.readFileSync(result,'utf8').replace(/^\uFEFF/,'');
}
function advance(story) {let text='';while(story.canContinue)text+=story.Continue();return text;}

test('中文路徑劇本能編譯並完成喝茶、看書與離開流程', {skip:process.platform!=='win32'}, () => {
    const {Story}=require('../app/node_modules/inkjs');
    const story=new Story(compile('app/examples/雨天書店/主程式.ink','雨天書店.json'));
    assert.match(advance(story),/書店/);
    story.ChooseChoiceIndex(1);assert.match(advance(story),/第 1 杯茶/);
    story.ChooseChoiceIndex(0);assert.match(advance(story),/溫暖的開場/);
    story.ChooseChoiceIndex(0);advance(story);
    story.ChooseChoiceIndex(2);assert.match(advance(story),/雨已經停了/);assert.equal(story.currentChoices.length,0);
});

test('英文翻譯練習兩個選项均可到達結尾', {skip:process.platform!=='win32'}, () => {
    const {Story}=require('../app/node_modules/inkjs');
    const json=compile('app/examples/translation-practice/practice.ink','translation-practice.json');
    for(const choice of [0,1]){const story=new Story(json);advance(story);story.ChooseChoiceIndex(choice);assert.match(advance(story),/waves/);assert.equal(story.currentChoices.length,0);}
});

test('發布防線阻擋外來劇本、編譯故事與私人設定', () => {
    const {auditFiles}=require('../scripts/check-publish.js');
    const fixture=fs.mkdtempSync(path.join(output,'publish-fixture-'));
    fs.writeFileSync(path.join(fixture,'unapproved.ink'),'A private story.');
    fs.writeFileSync(path.join(fixture,'story.json'),JSON.stringify({inkVersion:21,root:[]}));
    fs.writeFileSync(path.join(fixture,'translation-settings.json'),'{}');
    const errors=auditFiles(fixture,['unapproved.ink','story.json','translation-settings.json'],{});
    assert.equal(errors.length,3);assert.ok(errors.some(e=>e.includes('劇本')));assert.ok(errors.some(e=>e.includes('私人')));
});


test('首次啟動繁中、快捷鍵標記及明確英文偏好', () => {
    assert.equal(manager.DEFAULT_SETTINGS.uiLanguage,'zh-TW');
    const filename=path.join(root,'app/main-process/i18n/i18n.js');
    const req=createRequire(filename), mod={exports:{}}, events={};let preferred='zh-TW';
    const fakeElectron={app:{on:(name,fn)=>events[name]=fn,getLocale:()=> 'en-US'},ipcMain:{on:()=>{}}};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:mod,exports:mod.exports,__dirname:path.dirname(filename),require:Object.assign(name=>name==='electron'?fakeElectron:name==='../translationManager.js'?{loadSettings:()=>({uiLanguage:preferred})}:req(name),{resolve:req.resolve,cache:require.cache})});
    const i18n=mod.exports;events.ready();
    for(const [key,value] of Object.entries({'&File':'檔案','&Edit':'編輯','&View':'檢視','&Story':'故事','&Help':'說明',Examples:'範例'})) assert.equal(i18n._(key),value);
    preferred='en';events.ready();assert.equal(i18n._('&File'),'&File');
    i18n.switch('zh-TW');assert.equal(i18n._('&File'),'檔案');
});

test('範例可由中文路徑複製，重開不覆蓋編輯，未知 ID 拒絕', () => {
    const {createExampleCopy}=require('../app/main-process/examples');
    const userData=fs.mkdtempSync(path.join(output,'example-copy-'));
    const copied=createExampleCopy('bookshop',userData);
    assert.match(fs.readFileSync(copied,'utf8'),/雨/);
    fs.appendFileSync(copied,'\n// 我的編輯\n');
    assert.equal(createExampleCopy('bookshop',userData),copied);
    assert.match(fs.readFileSync(copied,'utf8'),/我的編輯/);
    const practice=createExampleCopy('translation',userData);
    assert.ok(fs.existsSync(path.join(path.dirname(practice),'glossary.csv')));
    assert.throws(()=>createExampleCopy('../../other',userData));
});
