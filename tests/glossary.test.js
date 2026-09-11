const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const g=require('../app/main-process/glossary');
test('CSV 保留引號、逗號、換行、分類與待確認狀態',()=>{
    const rows=[{source:'House, "Blue"',target:'藍屋',category:'地點',notes:'第一行\n第二行',status:'approved'},
        {source:'Mira',target:'米拉',category:'角色',notes:'',status:'pending'}];
    assert.deepEqual(g.parseCSV(g.toCSV(rows)),rows);
    assert.equal(g.toDictionary(rows)['House, "Blue"'],'藍屋');
    assert.equal(g.toDictionary(rows).Mira,undefined);
    assert.equal(g.parseCSV('en_term,zh_term\nMira,米拉')[0].status,'approved');
    assert.equal(g.parseCSV('# comment\nMira,米拉')[0].category,'其他');
    assert.throws(()=>g.parseCSV('"unclosed'));
    assert.throws(()=>g.parseCSV('Mira,米拉\nmira,小米'));
    assert.throws(()=>g.toCSV([{source:'Mira',target:'',status:'approved'}]));
});
test('AI 不可信回應只成為待確認詞，不可覆蓋既有譯名或新增未出現術語',()=>{
    const payload=JSON.stringify([{source:'Mira',target:'蜜拉',category:'角色',status:'approved'},
        {source:'Blue House',target:'藍屋',category:'錯誤分類'},
        {source:'InventedName',target:'杜撰'},
        {source:'mira',target:'重複'}]);
    const candidates=g.parseCandidates('```json\n'+payload+'\n```','Mira visits Blue House.');
    assert.equal(candidates.length,2);assert.ok(candidates.every(r=>r.status==='pending'));
    assert.equal(candidates[1].category,'其他');
    const result=g.mergeCandidates([{source:'Mira',target:'米拉',category:'角色'}],candidates);
    assert.equal(result.added,1);assert.equal(result.duplicates,1);assert.equal(result.rows[0].target,'米拉');
    assert.throws(()=>g.parseCandidates('[{"source":','Mira'));
    assert.equal(g.toDictionary(g.parseCSV('__proto__,原型'))['__proto__'],'原型');
});
test('大範圍分批完整保留字元且限制總量',()=>{
    const source=('Mira visits the bookshop.\n').repeat(1000);
    const chunks=g.chunks(source);
    assert.equal(chunks.join(''),source);assert.ok(chunks.every(c=>c.length<=8000));
    assert.throws(()=>g.chunks('a'.repeat(240001)));
});

function manager() {
    const filename=path.resolve(__dirname,'../app/main-process/translationManager.js');
    const req=createRequire(filename),mod={exports:{}};
    const output=path.resolve(__dirname,'../.local/test-output/glossary-api');fs.mkdirSync(output,{recursive:true});
    vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports.setTestPost = fn => { httpPost = fn; };',{
        module:mod,exports:mod.exports,console,Buffer,URL,setTimeout,clearTimeout,
        require:name=>name==='electron'?{app:{getPath:()=>output}}:req(name)
    },{filename});
    return mod.exports;
}
test('AI 掃描使用設定模型，計入用量；截斷／錯誤不產生可用譯名',async()=>{
    const m=manager();let calls=0;
    const settings={apiUrl:'https://example.invalid/v1/chat/completions',apiKey:'test-only-placeholder',model:'test-model',targetLanguage:'zh-TW',maxTokens:1024,promptPricePerToken:.001,completionPricePerToken:.002};
    m.setTestPost(async(url,headers,body)=>{
        calls++;assert.equal(url,settings.apiUrl);assert.equal(body.model,'test-model');
        assert.equal(body.messages[1].content,'Mira opens Blue House.');
        return {status:200,body:{choices:[{finish_reason:'stop',message:{content:'[{"source":"Mira","target":"米拉","category":"角色"}]'}}],usage:{prompt_tokens:100,completion_tokens:20}}};
    });
    const result=await m.extractGlossary('Mira opens Blue House.',settings);
    assert.equal(result.ok,true);assert.equal(result.rows[0].status,'pending');assert.equal(result.costData.usdCost,.14);
    await assert.rejects(m.extractGlossary('Mira',{...settings,apiUrl:'http://remote.invalid'}),/HTTPS/);
    assert.equal(calls,1);
    m.setTestPost(async()=>({status:200,body:{choices:[{finish_reason:'length',message:{content:'[]'}}],usage:{prompt_tokens:1,completion_tokens:1}}}));
    const truncated=await m.extractGlossary('Mira',settings);assert.equal(truncated.ok,false);assert.ok(truncated.costData);
    m.setTestPost(async()=>({status:429,body:{}}));await assert.rejects(m.extractGlossary('Mira',settings),/429/);
    assert.throws(()=>m.loadGlossary(path.join(__dirname,'missing-glossary.csv')));
});
