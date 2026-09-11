// Shared CSV / review model. No network or file access in this module.
const CATEGORIES = ['角色', '地點', '組織', '物品', '技能', '系統用語', '其他'];
function normalize(rows) {
    if (!Array.isArray(rows) || rows.length > 5000) throw new Error('詞彙表最多 5000 筆。');
    const seen = new Set();
    return rows.map(row => {
        const out = {};
        for (const key of ['source','target','category','notes']) {
            out[key] = String(row[key] || '').trim();
            if (out[key].length > (key === 'notes' ? 2000 : 250)) throw new Error('詞彙欄位過長。');
        }
        out.category ||= '其他';
        out.status = row.status === 'pending' ? 'pending' : 'approved';
        if (!out.source || (out.status === 'approved' && !out.target)) throw new Error('原文不可空白，採用的詞彙必須有譯文。');
        const key = out.source.toLocaleLowerCase();
        if (seen.has(key)) throw new Error('原文重複：' + out.source);
        seen.add(key);
        return out;
    });
}
function parseCSV(text) {
    const records = []; let row = [], cell = '', quoted = false;
    text = String(text).replace(/^\uFEFF/, '');
    for (let i=0;i<text.length;i++) {
        const c=text[i];
        if(c==='"') {
            if(quoted && text[i+1]==='"'){cell+='"';i++;}
            else if(quoted || cell==='')quoted=!quoted;
            else cell+=c;
        } else if(c===',' && !quoted){row.push(cell);cell='';}
        else if((c==='\n'||c==='\r') && !quoted) {
            row.push(cell);records.push(row);row=[];cell='';
            if(c==='\r' && text[i+1]==='\n')i++;
        } else cell+=c;
    }
    if(quoted)throw new Error('CSV 引號未關閉。');
    if(cell || row.length){row.push(cell);records.push(row);}
    return normalize(records.filter(r=>r.some(c=>c.trim()) && !r[0].trim().startsWith('#'))
        .filter((r,i)=>!(i===0 && ['en_term','source','原文'].includes(r[0].trim())))
        .map(r=>({source:r[0],target:r[1],category:r[2],notes:r[3],status:r[4]})));
}
function toCSV(rows) {
    const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
    return '\uFEFFen_term,zh_term,category,notes,status\r\n'+normalize(rows).map(r=>
        [r.source,r.target,r.category,r.notes,r.status].map(quote).join(',')).join('\r\n')+'\r\n';
}
function toDictionary(rows) {
    const result=Object.create(null);
    for(const r of normalize(rows))if(r.status==='approved')result[r.source]=r.target;
    return result;
}
function chunks(text, size=8000) {
    if(typeof text!=='string' || text.length>240000)throw new Error('每次最多掃描 240,000 字元，請縮小範圍。');
    const out=[];
    for(let start=0;start<text.length;) {
        let end=Math.min(start+size,text.length);
        if(end<text.length){const newline=text.lastIndexOf('\n',end);if(newline>start+size/2)end=newline+1;}
        out.push(text.slice(start,end));start=end;
    }
    return out;
}
function parseCandidates(response, sourceText) {
    if(typeof response!=='string')throw new Error('AI 未回傳文字。');
    let parsed;
    try{parsed=JSON.parse(response.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}
    catch{throw new Error('AI 回應不是完整 JSON；請減少掃描文字或增加輸出 token 上限。');}
    const data=Array.isArray(parsed)?parsed:parsed.terms;
    if(!Array.isArray(data)||data.length>200)throw new Error('AI 詞彙格式錯誤或超過 200 筆。');
    const seen=new Set();const result=[];
    for(const r of data){
        if(!r || typeof r.source!=='string' || typeof r.target!=='string')continue;
        const key=r.source.trim().toLocaleLowerCase();
        if(!key||seen.has(key)||!sourceText.toLocaleLowerCase().includes(key))continue;
        seen.add(key);
        result.push({...r,category:CATEGORIES.includes(r.category)?r.category:'其他',status:'pending'});
    }
    return normalize(result);
}
function mergeCandidates(existing, candidates) {
    const rows=normalize(existing).map(r=>({...r}));const keys=new Set(rows.map(r=>r.source.toLocaleLowerCase()));
    let added=0,duplicates=0;
    for(const row of normalize(candidates)){
        const key=row.source.toLocaleLowerCase();
        if(keys.has(key)){duplicates++;continue;}
        rows.push({...row,status:'pending'});keys.add(key);added++;
    }
    return {rows:normalize(rows),added,duplicates};
}
module.exports={CATEGORIES,normalize,parseCSV,toCSV,toDictionary,chunks,parseCandidates,mergeCandidates};
