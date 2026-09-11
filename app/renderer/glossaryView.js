const {ipcRenderer: ipc} = require('electron');
const model = require('../main-process/glossary');
let panel;
module.exports.open = async function open(context) {
    if(panel){panel.focus();return;}
    let rows=[],filePath='',dirty=false,busy=false,cancel=false;
    panel=document.createElement('div'); panel.tabIndex=-1;panel.id='glossary-manager';
    panel.innerHTML=`<style>
    #glossary-manager{position:fixed;inset:35px 24px 20px;background:#202126;color:#eee;z-index:100000;padding:20px;display:flex;flex-direction:column;gap:10px;box-shadow:0 0 0 100vmax #0009;font:14px sans-serif}
    #glossary-manager h2{margin:0;font-size:22px} #glossary-manager p{margin:0;line-height:1.5}
    #glossary-manager .gm-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    #glossary-manager button,#glossary-manager input,#glossary-manager select{font:inherit;color:#eee;background:#30323a;border:1px solid #747780;border-radius:4px;padding:7px}
    #glossary-manager button{cursor:pointer} #glossary-manager button:disabled{opacity:.5;cursor:default}
    #glossary-manager input:focus,#glossary-manager button:focus,#glossary-manager select:focus{outline:2px solid #8fcaff}
    #glossary-manager .gm-table{overflow:auto;flex:1;min-height:100px} #glossary-manager table{width:100%;border-collapse:collapse}
    #glossary-manager th{text-align:left;position:sticky;top:0;background:#202126;padding:8px}
    #glossary-manager td{padding:4px;border-bottom:1px solid #42454f} #glossary-manager td input:not([type=checkbox]){width:100%;box-sizing:border-box;min-width:95px}
    #glossary-manager .gm-path{overflow-wrap:anywhere;color:#b7d7ff} #gm-message{min-height:22px;white-space:pre-wrap}
    </style>
    <div class="gm-bar"><h2>專案詞彙表</h2><button id="gm-close" style="margin-left:auto">關閉</button></div>
    <p>固定角色與世界觀的譯名。AI 建議先列為待確認；勾選「採用」並儲存後才會用於翻譯。</p>
    <p class="gm-path" id="gm-path"></p>
    <div class="gm-bar"><button id="gm-new">新建表格</button><button id="gm-open">開啟 CSV</button><button id="gm-add">新增詞彙</button><button id="gm-save">儲存並套用</button></div>
    <div class="gm-bar"><label>掃描範圍 <select id="gm-scope"><option value="current">目前編輯檔案</option><option value="selection">選取文字</option><option value="project">目前專案已載入檔案</option></select></label><button id="gm-scan">AI 擷取專有詞彙</button><button id="gm-stop" disabled>停止後續批次</button></div>
    <p>使用已儲存的翻譯 API 與模型設定；開始前顯示傳送範圍。掃描可能產生 API 費用，不會修改劇本。</p>
    <div class="gm-bar"><label>搜尋 <input id="gm-search" placeholder="原文、譯文或備註"></label><label>分類 <select id="gm-filter"><option value="">全部分類</option></select></label><label>狀態 <select id="gm-status"><option value="">全部</option><option value="pending">待確認</option><option value="approved">已採用</option></select></label><span id="gm-count"></span></div>
    <div class="gm-table"><table><thead><tr><th>採用</th><th>原文</th><th>譯文</th><th>分類</th><th>備註</th><th>操作</th></tr></thead><tbody id="gm-rows"></tbody></table></div>
    <datalist id="gm-categories"></datalist><p id="gm-message" role="status" aria-live="polite"></p>`;
    document.body.appendChild(panel);panel.focus();
    const el=id=>panel.querySelector('#gm-'+id);
    const message=text=>{el('message').textContent=text;};
    const attempt=fn=>async()=>{try{await fn();}catch(e){message(e.message);}};
    function render() {
        const old=el('filter').value;
        const categories=[...new Set([...model.CATEGORIES,...rows.map(r=>r.category).filter(Boolean)])];
        el('filter').replaceChildren(new Option('全部分類',''),...categories.map(c=>new Option(c,c)));el('filter').value=old;
        el('categories').replaceChildren(...categories.map(c=>new Option(c,c)));
        const search=el('search').value.toLocaleLowerCase(),category=el('filter').value,status=el('status').value;
        el('rows').replaceChildren();
        let visible=0;
        rows.forEach((row,index)=>{
            if(category && row.category!==category || status && row.status!==status || search && ![row.source,row.target,row.notes].join(' ').toLocaleLowerCase().includes(search))return;
            visible++;
            const tr=document.createElement('tr');const td=document.createElement('td');
            const check=document.createElement('input');check.type='checkbox';check.checked=row.status==='approved';check.disabled=busy;check.setAttribute('aria-label','採用 '+row.source);
            check.onchange=()=>{if(check.checked && !row.target.trim()){check.checked=false;message('請先填入譯文再採用。');return;}row.status=check.checked?'approved':'pending';dirty=true;render();};td.append(check);tr.append(td);
            for(const key of ['source','target','category','notes']){
                const cell=document.createElement('td'),input=document.createElement('input');input.value=row[key];input.disabled=busy;input.setAttribute('aria-label',({source:'原文',target:'譯文',category:'分類',notes:'備註'})[key]);input.maxLength=key==='notes'?2000:250;
                if(key==='category')input.setAttribute('list','gm-categories');
                input.oninput=()=>{row[key]=input.value;dirty=true;};input.onchange=()=>{if(key==='category')render();};cell.append(input);tr.append(cell);
            }
            const cell=document.createElement('td'),remove=document.createElement('button');remove.textContent='移除';remove.disabled=busy;remove.onclick=()=>{rows.splice(index,1);dirty=true;render();};cell.append(remove);tr.append(cell);el('rows').append(tr);
        });
        if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='尚無詞彙。開啟既有 CSV、手動新增，或用 AI 建立基礎表。';tr.append(td);el('rows').append(tr);}
        el('count').textContent=`顯示 ${visible}／共 ${rows.length} 筆；已採用 ${rows.filter(r=>r.status==='approved').length} 筆`;
        el('path').textContent=filePath || '尚未儲存；每個專案可建立自己的 glossary.csv。';
    }
    function setBusy(value){busy=value;for(const id of ['new','open','add','save','scan','scope','close'])el(id).disabled=value;el('stop').disabled=!value;render();}
    const discard=()=>!dirty || confirm('有尚未儲存的詞彙修改，確定放棄？');
    el('close').onclick=()=>{if(!busy && discard()){panel.remove();panel=null;}};
    el('new').onclick=()=>{if(discard()){rows=[];filePath='';dirty=false;render();message('新表格尚未套用；儲存後才會取代目前使用的詞彙表。');}};
    el('add').onclick=()=>{rows.push({source:'',target:'',category:'其他',notes:'',status:'pending'});dirty=true;el('search').value='';el('filter').value='';el('status').value='';render();};
    el('open').onclick=attempt(async()=>{if(!discard())return;const r=await ipc.invoke('glossary-open',false);if(r.canceled)return;if(!r.ok)throw Error(r.error);rows=r.rows;filePath=r.filePath;dirty=false;render();message('已載入。儲存並套用後，翻譯功能才會使用這份表格。');});
    el('save').onclick=attempt(async()=>{const clean=model.normalize(rows);const r=await ipc.invoke('glossary-save',clean,filePath);if(r.canceled)return;if(!r.ok)throw Error(r.error);rows=clean;filePath=r.filePath;dirty=false;context.onSaved(filePath);render();message('已儲存並套用。待確認項目不會送入翻譯詞彙表。');});
    for(const id of ['search','filter','status'])el(id).addEventListener(id==='search'?'input':'change',render);
    el('stop').onclick=()=>{cancel=true;el('stop').disabled=true;message('目前請求完成後停止；已取得的候選詞會保留。');};
    el('scan').onclick=attempt(async()=>{
        model.normalize(rows);
        const documents=context.getDocuments(el('scope').value);
        const text=documents.map(d=>d.text).join('\n\n');
        if(!text.trim())throw Error('此範圍沒有文字。請先開啟劇本或選取文字。');
        const batches=model.chunks(text),settings=await ipc.invoke('translation-get-settings');
        const endpoint=new URL(settings.apiUrl);
        if(!confirm(`AI 將讀取以下範圍的完整文字（含未儲存內容），建議譯名與分類。\n${documents.map(d=>d.name).join('\n')}\n共 ${text.length.toLocaleString()} 字元／${batches.length} 批\n服務：${endpoint.origin}\n模型：${settings.model}\n可能產生 API 費用。現在開始？`))return;
        let added=0,duplicates=0,completed=0;cancel=false;setBusy(true);
        try {
            for(const batch of batches){
                if(cancel)break;
                message(`正在掃描 ${completed+1}/${batches.length} 批；已新增 ${added} 筆待確認詞彙。`);
                const r=await ipc.invoke('glossary-extract',batch,context.getApiKey());
                if(r.costData)context.onCost(r.costData);
                if(!r.ok)throw Error(r.error);
                const merged=model.mergeCandidates(rows,r.rows);rows=merged.rows;added+=merged.added;duplicates+=merged.duplicates;completed++;if(merged.added)dirty=true;render();
            }
            message(`${cancel?'已停止':'掃描完成'}：${completed}/${batches.length} 批，新增 ${added} 筆待確認；略過 ${duplicates} 筆重複詞（保留既有譯文）。請檢查後勾選採用並儲存。`);
        }catch(e){message(`已完成 ${completed}/${batches.length} 批，保留 ${added} 筆候選詞。${e.message}`);}
        finally{setBusy(false);}
    });
    setBusy(true);
    try{const r=await ipc.invoke('glossary-open',true);if(!r.ok)throw Error(r.error);rows=r.rows;filePath=r.filePath;render();}
    catch(e){message('無法載入目前詞彙表：'+e.message+'。可另開 CSV 或建立新表。');}
    finally{setBusy(false);}
};
