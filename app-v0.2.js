const $=id=>document.getElementById(id),C=StatsCore,KEY='poker-stats-lab.records.v1';let records=[],editing=null,originalDate=null,pending=null,mode='all',storageOK=true;
const newId=()=>globalThis.crypto?.randomUUID?.()||'record-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
const preferencesKey=KEY+'.choices';
const choices={
 venue:{initial:'Bell Quads（釧路）',add:'＋新しい店舗を追加'},
 event:{initial:'Daily トーナメント',add:'＋新しい大会を追加'}
};
let savedChoices={};
try{savedChoices=JSON.parse(localStorage.getItem(preferencesKey))||{};}catch{}
function updateChoices(field,selected=choices[field].initial){
 const {initial,add}=choices[field], select=$(field);
 const stored=Array.isArray(savedChoices[field])?savedChoices[field]:[];
 const values=new Set([initial,...stored.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()),...records.map(r=>r[field]),selected]);
 select.replaceChildren(...Array.from(values,value=>new Option(value,value)),new Option(add,''));
 select.value=selected;
 toggleNew(field);
}
function toggleNew(field){
 const isNew=$(field).value==='';
 $(field+'NewLabel').hidden=!isNew;
 $(field+'New').disabled=!isNew;
 $(field+'New').required=isNew;
}
for(const field of Object.keys(choices)) $(field).onchange=()=>{
 toggleNew(field);
 if(!$(field).value) $(field+'New').focus();
};
function rememberChoices(){
 for(const field of Object.keys(choices)){
  const stored=Array.isArray(savedChoices[field])?savedChoices[field]:[];
  savedChoices[field]=[...new Set([...stored,...records.map(r=>r[field])])];
 }
 try{localStorage.setItem(preferencesKey,JSON.stringify(savedChoices));}catch{}
}
const selectedName=field=>$(field).value||$(field+'New').value;
function migrateRecords(data){
 const ids=new Set();
 return data.map(item=>{
  const r=C.validate(item);
  if(!r.id||ids.has(r.id)) r.id=newId();
  ids.add(r.id);
  return r;
 });
}
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function notify(s){$('notice').textContent=s;}
try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(!Array.isArray(data))throw Error();records=migrateRecords(data);if(data.some((r,i)=>r.id!==records[i].id))localStorage.setItem(KEY,JSON.stringify(records));}}catch(e){storageOK=false;notify('保存データを読み込めません。上書きを停止しました。バックアップを保管して再読み込みしてください。');}
function commit(next){if(!storageOK)throw Error('保存領域を確認できないため変更を停止しています');localStorage.setItem(KEY,JSON.stringify(next));records=next;rememberChoices();render();}
function show(name){for(const s of ['entry','list','data']){$(s).hidden=s!==name;$(s+'Tab').classList.toggle('active',s===name);}if(name==='list')render();}
for(const s of ['entry','list','data'])$(s+'Tab').onclick=()=>show(s);
function reset(){editing=null;originalDate=null;$('form').reset();for(const field of Object.keys(choices))updateChoices(field);$('date').value=today();$('date').required=true;$('partial').hidden=true;$('formTitle').textContent='今日の戦績';$('cancel').hidden=true;}
$('cancel').onclick=reset;
$('form').onsubmit=e=>{e.preventDefault();try{const old=records.find(r=>r.id===editing);const date=$('date').value||originalDate;const r=C.validate({id:editing||newId(),date,venue:selectedName('venue'),event:selectedName('event'),previous:old?(old.previous||C.key(old)):undefined,players:Number($('players').value),rank:Number($('rank').value),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});if(records.some(a=>a.id!==editing&&C.key(a)===C.key(r)))throw Error('同じ戦績がすでに登録されています');commit(editing?records.map(a=>a.id===editing?r:a):[...records,r]);reset();notify('戦績を保存しました');show('list');void synchronize();}catch(e){notify('保存できませんでした：'+e.message);}};
function edit(r){reset();editing=r.id;originalDate=r.date;$('date').value=r.date.length===10?r.date:'';$('date').required=r.date.length===10;if(r.date.length===7){$('partial').hidden=false;$('partial').textContent=r.date+'（日付不明）。日付を選ばなければ月のみを維持します。';}for(const f of ['venue','event'])updateChoices(f,r[f]);for(const f of ['players','rank'])$(f).value=r[f];$('formTitle').textContent='戦績を編集';$('cancel').hidden=false;show('entry');window.scrollTo(0,0);}
function render(){const rs=records.filter(r=>mode==='all'||r.date.slice(0,7)===$('month').value).sort((a,b)=>b.date.localeCompare(a.date)||(b.createdAt||'').localeCompare(a.createdAt||''));const v=C.stats(rs);$('stats').replaceChildren();['参加回数','優勝回数','優勝率','3位以内率','平均順位'].forEach((t,i)=>{const el=document.createElement('div');const num=document.createElement('strong');num.textContent=i<2?v[i]+'回':!rs.length?'—':v[i].toFixed(1)+(i<4?'%':'位');const label=document.createElement('span');label.textContent=t;el.append(num,label);$('stats').append(el);});$('records').replaceChildren();if(!rs.length){$('records').textContent='まだ戦績がありません。最初の1戦を記録しましょう。';return;}for(const r of rs){const row=document.createElement('article');row.className='record';const info=document.createElement('div');const date=document.createElement('strong');date.textContent=r.date.replaceAll('-','/')+(r.date.length===7?'（日付不明）':'');const title=document.createElement('small');title.textContent=r.venue+' · '+r.event;info.append(date,title);const rank=document.createElement('b');rank.className=r.rank===1?'winner':'';rank.textContent=`${r.rank}位 / ${r.players}人`;const actions=document.createElement('div');actions.className='actions';const eb=document.createElement('button');eb.textContent='編集';eb.onclick=()=>edit(r);const db=document.createElement('button');db.textContent='削除';db.onclick=()=>{if(confirm(`${r.date} ${r.rank}位 / ${r.players}人の戦績を削除しますか？`))try{commit(records.filter(a=>a.id!==r.id));if(editing===r.id)reset();notify('削除しました');}catch(e){notify('削除できません：'+e.message);}};actions.append(eb,db);row.append(info,rank,actions);$('records').append(row);}}
$('all').onclick=()=>{mode='all';$('monthLabel').hidden=true;$('all').classList.add('active');$('monthly').classList.remove('active');render();};$('monthly').onclick=()=>{mode='month';$('monthLabel').hidden=false;$('all').classList.remove('active');$('monthly').classList.add('active');render();};$('month').value=today().slice(0,7);$('month').onchange=render;
$('export').onclick=()=>{if(!storageOK){notify('読み込みエラーのため書き出せません');return;}const b=new Blob([JSON.stringify({app:'POKER STATS LAB',schemaVersion:1,exportedAt:new Date().toISOString(),records},null,2)],{type:'application/json'});const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=`poker-stats-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);notify('バックアップを書き出しました');};
$('import').onchange=async e=>{pending=null;$('preview').hidden=true;try{const f=e.target.files[0];if(!f)return;if(f.size>5e6)throw Error('5MB以下のJSONを選んでください');const d=JSON.parse(await f.text());if(d.schemaVersion!==1||!Array.isArray(d.records)||d.records.length>10000)throw Error('対応するバックアップ形式ではありません');pending=d.records.map(r=>C.validate({...r,id:r.id||newId()}));const m=C.merge(records,pending);$('previewText').textContent=`${pending.length}戦を確認。追加 ${m.records.length-records.length}戦 / 重複 ${m.skipped}戦。現在の記録は保持します。`;$('preview').hidden=false;}catch(e){notify('読み込めません：'+e.message);}e.target.value='';};$('confirmImport').onclick=()=>{try{if(!pending)return;const m=C.merge(records,pending);commit(m.records);pending=null;$('preview').hidden=true;notify('移行・復元が完了しました');show('list');}catch(e){notify('復元できません：'+e.message);}};$('cancelImport').onclick=()=>{pending=null;$('preview').hidden=true;};
const connectionKey=KEY+'.connection';
let connection=null,syncActive=false,syncAgain=false;
try{connection=JSON.parse(localStorage.getItem(connectionKey));}catch{}
function syncStatus(message){$('syncResult').textContent=message;$('entrySyncResult').textContent=message;}
if(connection?.url) $('syncUrl').value=connection.url;
$('sync').onclick=()=>synchronize();
$('saveConnection').onclick=()=>{
 try{
  const url=StatsSync.endpoint($('syncUrl').value.trim());
  const token=$('syncToken').value.trim()||connection?.token;
  if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('64文字の接続キーを入力してください');
  localStorage.setItem(connectionKey,JSON.stringify({url,token}));
  connection={url,token};
  $('syncToken').value='';
  syncStatus('接続設定を保存しました。');
 }catch(e){syncStatus(e.message);}
};
async function synchronize(){
 if(!storageOK){syncStatus('端末の戦績を読み込めないため同期を停止しました。');return;}
 if(!connection){syncStatus('Googleスプレッドシートは未接続です。データ管理で接続設定を入力してください。');return;}
 if(syncActive){syncAgain=true;return;}
 syncActive=true;
 $('sync').disabled=true;
 try{
  do{
   syncAgain=false;
   syncStatus('Googleスプレッドシートを照合中…');
   try{
    const result=await StatsSync.send(connection,records);
    const summary=result.added?result.added+'件追加しました':'未登録の戦績はありません';
    syncStatus(summary+(result.existing?'。'+result.existing+'件は登録済みです':'')+'。');
   }catch(e){syncStatus(e.message+'：端末データは保持されています。');}
  }while(syncAgain);
 }finally{
  syncActive=false;
  $('sync').disabled=false;
 }
}
rememberChoices();reset();render();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>notify('オフライン準備に失敗しました。オンラインで再度開いてください。'));

// Private migration data travels in the URL fragment, never in the public repository.
try {
 const fragment=new URLSearchParams(location.hash.slice(1));const packed=fragment.get('migrate');
 if(packed){
  if(packed.length>20000)throw Error('移行データが大きすぎます');
  const bytes=Uint8Array.from(atob(packed.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const payload=JSON.parse(new TextDecoder().decode(bytes));
  if(payload.version!==1||!Array.isArray(payload.rows)||payload.rows.length>10000||typeof payload.batch!=='string'||!/^[a-z0-9-]{1,80}$/.test(payload.batch))throw Error('移行データの形式が不正です');
  const marker=KEY+'.migration.'+payload.batch;
  if(!localStorage.getItem(marker)){
   const incoming=payload.rows.map((r,i)=>C.validate({id:payload.batch+'-'+String(i+1).padStart(3,'0'),date:r[0],rank:r[1],players:r[2],venue:payload.venue,event:payload.events[r[3]]}));
   const merged=C.merge(records,incoming);const added=merged.records.length-records.length;commit(merged.records);localStorage.setItem(marker,'done');
   notify(incoming.length+'戦を引き継ぎました（追加 '+added+'戦）。');
  } else notify('既存戦績の引き継ぎは完了しています');
  show('list');
 }
} catch(e){notify('自動引き継ぎに失敗しました：'+e.message+'。JSONから復元できます。');}
