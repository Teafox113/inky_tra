const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Story } = require('../app/node_modules/inkjs');
const { createExampleCopy } = require('../app/main-process/examples');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.local/test-output');
fs.mkdirSync(output, { recursive: true });
let compiled;
function advance(s) {
    let text = '';
    while (s.canContinue) text += s.Continue();
    assert.ok(!s.hasError, JSON.stringify(s.currentErrors));
    return text;
}
function choose(s, prefix) {
    const found = s.currentChoices.filter(c => c.text.startsWith(prefix));
    assert.equal(found.length, 1, prefix + ': ' + s.currentChoices.map(c => c.text).join(' / '));
    s.ChooseChoiceIndex(found[0].index);
    return advance(s);
}
function has(s, prefix) { return s.currentChoices.some(c => c.text.startsWith(prefix)); }
function fresh() {
    if (!compiled) {
        const copied = createExampleCopy('mist', fs.mkdtempSync(path.join(output, 'mist-copy-')));
        const target = path.join(output, 'mist-compiled.json');
        const diagnostics = execFileSync(path.join(root, 'app/main-process/ink/inklecate_win.exe'), ['-o', target, copied], { encoding: 'utf8' });
        assert.doesNotMatch(diagnostics, /WARNING|ERROR/);
        compiled = fs.readFileSync(target, 'utf8').replace(/^\uFEFF/, '');
    }
    const s = new Story(compiled);
    assert.match(advance(s), /霧港十三夜/);
    return s;
}
function invariant(s) {
    const v = s.variablesState;
    assert.equal(v.vigor + v.insight + v.empathy + v.attribute_points, 8);
    assert.equal(v.observation + v.ritual + v.persuasion + v.skill_points, 4);
    for (const key of ['vigor', 'insight', 'empathy']) assert.ok(v[key] >= 1 && v[key] <= 4);
    for (const key of ['observation', 'ritual', 'persuasion']) assert.ok(v[key] >= 0 && v[key] <= 3);
    assert.ok(v.attribute_points >= 0 && v.attribute_points <= 5);
    assert.ok(v.skill_points >= 0 && v.skill_points <= 4);
}
function setup(type = 'ritual', background = '港口跑腿人') {
    const s = fresh();
    choose(s, '開始建立'); choose(s, '改名為林晚'); choose(s, background);
    for (let i = 0; i < 3; i++) choose(s, type === 'weak' ? '體魄 +1' : '洞察 +1');
    for (let i = 0; i < 2; i++) choose(s, '共感 +1');
    choose(s, '屬性分配完成');
    for (let i = 0; i < 3; i++) choose(s, type === 'ritual' ? '儀式 +1' : type === 'record' ? '觀察 +1' : '交涉 +1');
    choose(s, type === 'record' ? '儀式 +1' : '觀察 +1');
    choose(s, '檢查角色設定'); invariant(s);
    choose(s, '確認，');
    assert.equal(s.variablesState.original_name, '林晚');
    return s;
}
function protect(s) { choose(s, '和來客交談'); choose(s, '追問藍皮書'); choose(s, '答應保護'); }
function tower(s, gate = '用銅鑰匙') { choose(s, '帶著藍皮書'); choose(s, '向沈月坦白'); choose(s, gate); }
function end(s, prefix, id) {
    const text = choose(s, prefix);
    assert.match(text, new RegExp('結局代碼：' + id));
    assert.equal(s.variablesState.ending_id, id);
    assert.equal(s.currentChoices.length, 0); assert.equal(s.canContinue, false);
}

test('五檔中文路徑副本編譯無警告，說明分支可進角色建立', () => {
    const s = fresh(); choose(s, '先看操作說明');
    assert.match(choose(s, '我知道了'), /目前名字：林晝/);
    assert.equal(s.variablesState.inventory.Count, 0);
});

test('分配上下限、退點、重設與返回調整保持總點數', () => {
    const s = fresh(); choose(s, '開始建立'); choose(s, '使用目前'); choose(s, '書店繼承人');
    assert.ok(!has(s, '屬性分配完成')); assert.ok(!has(s, '退回'));
    for (let i=0;i<3;i++) choose(s, '體魄 +1');
    assert.ok(!has(s, '體魄 +1')); choose(s,'退回 1 點體魄'); invariant(s);
    choose(s,'重設全部屬性'); assert.equal(s.variablesState.attribute_points,5);
    // Deterministic varied edits exercise refunds/resets without modifying runtime state.
    let seed=17;
    for(let i=0;i<120;i++) {
        const choices=s.currentChoices.filter(c=>!c.text.startsWith('屬性分配完成'));
        seed=(seed*1664525+1013904223)>>>0;
        choose(s,choices[seed%choices.length].text); invariant(s);
    }
    choose(s,'重設全部屬性');
    for(let i=0;i<3;i++)choose(s,'洞察 +1');
    for(let i=0;i<2;i++)choose(s,'共感 +1');
    assert.ok(!has(s,'體魄 +1'));choose(s,'屬性分配完成');
    assert.ok(!has(s,'檢查角色'));assert.ok(!has(s,'退回'));
    for(let i=0;i<3;i++)choose(s,'儀式 +1');
    assert.ok(!has(s,'儀式 +1'));choose(s,'退回 1 點儀式');invariant(s);
    choose(s,'重設全部技能');assert.equal(s.variablesState.skill_points,4);
    for(let i=0;i<120;i++) {
        const choices=s.currentChoices.filter(c=>!c.text.startsWith('檢查角色設定'));
        seed=(seed*1664525+1013904223)>>>0;
        choose(s,choices[seed%choices.length].text); invariant(s);
    }
    choose(s,'重設全部技能');for(let i=0;i<3;i++)choose(s,'儀式 +1');choose(s,'觀察 +1');
    choose(s,'檢查角色設定');choose(s,'返回調整屬性');invariant(s);
    choose(s,'屬性分配完成');choose(s,'檢查角色設定');choose(s,'返回調整技能');invariant(s);
});

test('三層對話、一次性事件、共用狀態、鑰匙與儀式結局', () => {
    const s=setup();assert.ok(!has(s,'帶著藍皮書'));
    protect(s);assert.equal(s.variablesState.trust,2);assert.ok(!has(s,'和來客交談'));
    const before=s.state.ToJson();choose(s,'查看角色');
    assert.equal(s.variablesState.trust,2);assert.equal(s.variablesState.hero_name,'林晚');
    choose(s,'嘗試閱讀');assert.ok(!has(s,'嘗試閱讀'));assert.equal(s.variablesState.heard_echo,true);
    tower(s);assert.equal(s.variablesState.pressure,0);
    assert.ok(!has(s,'公開議會記錄'));choose(s,'查看條件');
    end(s,'和沈月一起改寫','restore');
    // Ink runtime can serialize a snapshot; editor does not automatically persist it.
    const restored=new Story(compiled);restored.state.LoadJson(before);
    assert.equal(restored.variablesState.hero_name,'林晚');assert.ok(!has(restored,'和來客交談'));
});

test('調查成功、記憶與公開記錄結局', () => {
    const s=setup('record','書店繼承人');
    assert.equal(s.variablesState.knows_warning,true);
    choose(s,'和來客交談');choose(s,'問他為什麼');
    choose(s,'調查父親');choose(s,'檢查信紙');
    assert.equal(s.variablesState.clues,2);assert.equal(s.variablesState.found_record,true);
    assert.ok(!has(s,'調查父親'));
    tower(s,'嘗試抬起');assert.equal(s.variablesState.pressure,1);
    end(s,'公開議會記錄','record');
});

test('低分失敗仍可前進；名字變更與撤離結局都可完成', () => {
    for(const id of ['name','wait']) {
        const s=setup('weak','議會見習生');assert.equal(s.variablesState.trust,1);
        protect(s);choose(s,'調查父親');choose(s,'檢查信紙');choose(s,'嘗試閱讀');
        assert.equal(s.variablesState.pressure,2);assert.equal(s.variablesState.heard_echo,false);
        tower(s,'請沈月帶路');assert.equal(s.variablesState.pressure,3);
        assert.ok(!has(s,'和沈月一起改寫'));assert.ok(!has(s,'公開議會記錄'));
        end(s,id==='name'?'用自己的名字':'先帶著書撤離',id);
        assert.equal(s.variablesState.hero_name,id==='name'?'無名旅人':'林晚');
        assert.equal(s.variablesState.original_name,'林晚');
    }
});

test('抽屜三層分支、地圖捷徑與交涉檢定', () => {
    for(const item of ['潮汐地圖','銅鑰匙']) {
        const s=setup('weak','書店繼承人');
        choose(s,'調查父親');choose(s,'翻找抽屜');choose(s,'收起'+item);
        choose(s,'和來客交談');choose(s,'追問藍皮書');choose(s,'堅持先核對');
        assert.equal(s.variablesState.found_record,true);
        choose(s,'帶著藍皮書');choose(s,'先請她證明');
        choose(s,item==='潮汐地圖'?'依照潮汐地圖':'用銅鑰匙');
        if(item==='潮汐地圖')assert.equal(s.variablesState.heard_echo,true);
        assert.equal(s.variablesState.pressure,0);end(s,'先帶著書撤離','wait');
    }
});
