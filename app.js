const KEY='assetnote-v1';
const seed={assets:[{id:'a1',name:'신한',active:true},{id:'a2',name:'카뱅',active:true},{id:'a3',name:'K뱅',active:true},{id:'a4',name:'사이다(sbi)',active:true},{id:'a5',name:'국민',active:true},{id:'a6',name:'지역화폐 및 현금',active:true}],snapshots:[],incomes:[]};
let db=load(), year=new Date().getFullYear(), expanded={};
function load(){try{return JSON.parse(localStorage.getItem(KEY))||seed}catch{return seed}}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
const won=n=>new Intl.NumberFormat('ko-KR').format(Math.round(n||0))+'원';
const num=n=>new Intl.NumberFormat('ko-KR').format(Math.round(n||0));
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function snapTotal(s){return Object.values(s.balances||{}).reduce((a,b)=>a+(Number(b)||0),0)}
function sortedSnaps(){return [...db.snapshots].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))}
function incomesIn(y){return db.incomes.filter(x=>x.date.startsWith(String(y)+'-')).reduce((a,x)=>a+Number(x.amount||0),0)}
function monthly(y){
 const all=sortedSnaps(); const inYear=all.filter(s=>s.date.startsWith(String(y)+'-'));
 const by={}; inYear.forEach(s=>{const m=s.date.slice(0,7);(by[m]??=[]).push(s)});
 return Object.keys(by).sort().map(m=>{
   const recs=by[m].sort((a,b)=>a.date.localeCompare(b.date)); const end=recs[recs.length-1];
   const idx=all.findIndex(s=>s.id===end.id); const prev=idx>0?all[idx-1]:null;
   const inc=db.incomes.filter(x=>x.date> (prev?prev.date:'0000-00-00') && x.date<=end.date).reduce((a,x)=>a+Number(x.amount||0),0);
   const change=prev==null?null:snapTotal(end)-snapTotal(prev); const spend=change==null?null:inc-change;
   const latest=end.id===all[all.length-1]?.id; const status=latest?'progress':'done';
   return {month:m,recs,end,prev,inc,change,spend,status};
 })
}
function annual(y){const ms=monthly(y); return {income:incomesIn(y),spend:ms.filter(x=>x.spend!=null).reduce((a,x)=>a+x.spend,0),latest:sortedSnaps().filter(s=>s.date.startsWith(String(y)+'-')).sort((a,b)=>b.date.localeCompare(a.date))[0]};}
function render(){const a=annual(year), ms=monthly(year), latest=a.latest; document.getElementById('app').innerHTML=`
<header class="top"><div><div class="brand">자산노트</div><div class="sub">내 돈의 흐름을 기록하고 관찰합니다.</div></div><div class="actions"><button class="btn" id="incomeBtn">＋ 수입</button><button class="btn secondary" id="exportBtn">내보내기</button><button class="btn" id="importBtn">가져오기</button></div></header>
<div class="yearnav"><button class="iconbtn" id="prevY">‹</button><div class="year">${year}년</div><button class="iconbtn" id="nextY">›</button></div>
<section class="summary" style="margin-top:12px"><div class="card"><div class="label">올해 수입</div><div class="money">${won(a.income)}</div></div><div class="card"><div class="label">올해 지출</div><div class="money">${won(a.spend)}</div></div><div class="card"><div class="label">현재 가진돈</div><div class="money">${latest?won(snapTotal(latest)):'—'}</div></div></section>
<div class="sectionhead"><div class="sectiontitle">월별 흐름</div><div class="hint">기록이 없는 달은 비워둡니다.</div></div>
<section class="card timeline">${renderMonths(ms)}</section>
<div class="sectionhead"><div class="sectiontitle">원본 데이터</div><div class="hint">${db.snapshots.length}개 기록 · ${db.incomes.length}개 수입</div></div>
<section class="card"><div class="emptybox">원본 기록은 월을 펼치면 확인할 수 있습니다. 입력값은 로컬에 저장됩니다.</div></section>`;
 bind();}
function renderMonths(ms){let rows='';for(let m=1;m<=12;m++){const key=`${year}-${String(m).padStart(2,'0')}`,x=ms.find(v=>v.month===key);if(!x){rows+=`<div class="monthrow"><div><div class="mname">${m}월</div></div><div class="num" style="color:#9ca3af">기록 없음</div><div></div><div></div><div class="status empty">공백</div></div>`;continue}const open=expanded[key];rows+=`<div class="month"><div class="monthrow clickable" data-month="${key}"><div><div class="mname">${m}월</div><div class="date">${x.end.date.slice(5)}</div></div><div class="num"><span class="small">가진돈</span>${num(snapTotal(x.end))}원</div><div class="num"><span class="small">수입</span>${x.inc?num(x.inc)+'원':'—'}</div><div class="num"><span class="small">지출</span>${x.spend==null?'—':num(x.spend)+'원'}</div><div class="status ${x.status==='done'?'done':'progress'}">${x.status==='done'?'확정':'진행 중'}</div></div>${open?detail(x):''}</div>`}return rows}
function detail(x){return `<div class="detail">${x.recs.map(s=>`<div class="record"><div class="recordtop"><b>${s.date}</b><span>${won(snapTotal(s))}</span></div><div class="assetgrid">${Object.entries(s.balances||{}).map(([id,v])=>{const aa=db.assets.find(a=>a.id===id);return aa&&aa.active!==false?`<div class="assetpill"><span>${esc(aa.name)}</span><b>${num(v)}원</b></div>`:''}).join('')}</div>${s.memo?`<div class="memo">${esc(s.memo)}</div>`:''}</div>`).join('')}${x.prev?`<div class="notice">분석 구간: ${x.prev.date} → ${x.end.date}${x.status==='progress'?' · 현재 진행 중':''}</div>`:`<div class="notice">이 연도의 첫 자산 기록이라 이전 자산 기준이 없어 지출은 계산하지 않습니다.</div>`}</div>`}
function bind(){document.getElementById('addBtn').onclick=()=>openSnapshot();document.getElementById('incomeBtn').onclick=()=>openIncome();document.getElementById('prevY').onclick=()=>{year--;render()};document.getElementById('nextY').onclick=()=>{year++;render()};document.querySelectorAll('[data-month]').forEach(e=>e.onclick=()=>{expanded[e.dataset.month]=!expanded[e.dataset.month];render()});document.getElementById('exportBtn').onclick=exportData;document.getElementById('importBtn').onclick=importData}
function openSnapshot(){const active=db.assets.filter(a=>a.active!==false);const prev=sortedSnaps().at(-1);const today=new Date().toISOString().slice(0,10);document.getElementById('modal').innerHTML=`<h2>자산 기록</h2><div class="notice">빈칸은 변경하지 않음 · 0은 실제 0원입니다.</div><div class="formrow"><div class="field"><label>날짜</label><input id="sdate" type="date" value="${today}"></div><div class="field"><label>메모</label><input id="smemo" placeholder="선택사항"></div></div><div class="field"><label>자산</label>${active.map(a=>`<div class="assetinput"><span style="padding:10px 4px">${esc(a.name)}</span><input data-asset="${a.id}" inputmode="numeric" placeholder="${prev&&prev.balances[a.id]!=null?num(prev.balances[a.id]):''}"></div>`).join('')}</div><div class="formactions"><button class="btn" id="cancel">취소</button><button class="btn primary" id="saveSnap">저장</button></div>`;openModal();document.getElementById('cancel').onclick=closeModal;document.getElementById('saveSnap').onclick=()=>{const date=document.getElementById('sdate').value;if(!date)return;const balances={...(prev?.balances||{})};document.querySelectorAll('[data-asset]').forEach(i=>{if(i.value!=='')balances[i.dataset.asset]=Number(i.value.replaceAll(',',''))||0});db.snapshots.push({id:crypto.randomUUID(),date,balances,memo:document.getElementById('smemo').value});db.snapshots.sort((a,b)=>a.date.localeCompare(b.date));save();closeModal();year=Number(date.slice(0,4));toast('기록을 저장했습니다');render()}}
function openIncome(){document.getElementById('modal').innerHTML=`<h2>수입 기록</h2><div class="formrow"><div class="field"><label>날짜</label><input id="idate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>종류</label><input id="itype" value="급여"></div></div><div class="field"><label>금액</label><input id="iamount" inputmode="numeric" placeholder="0"></div><div class="formactions"><button class="btn" id="cancel">취소</button><button class="btn primary" id="saveIncome">저장</button></div>`;openModal();document.getElementById('cancel').onclick=closeModal;document.getElementById('saveIncome').onclick=()=>{const amount=Number(document.getElementById('iamount').value.replaceAll(',',''));if(!amount)return;db.incomes.push({id:crypto.randomUUID(),date:document.getElementById('idate').value,type:document.getElementById('itype').value||'기타',amount});save();closeModal();toast('수입을 저장했습니다');render()}}
function openModal(){document.getElementById('modalBack').classList.add('open')}function closeModal(){document.getElementById('modalBack').classList.remove('open')}
function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`assetnote-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(){const i=document.createElement('input');i.type='file';i.accept='.json,application/json';i.onchange=()=>{const f=i.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.assets||!d.snapshots||!d.incomes)throw 0;db=d;save();render();toast('가져왔습니다')}catch{toast('올바른 자산노트 파일이 아닙니다')}};r.readAsText(f)};i.click()}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1800)}
document.getElementById('addBtn').addEventListener('contextmenu',e=>e.preventDefault());
// 기록 버튼 길게/우클릭으로 수입 입력은 v1에서 보조 진입점으로 제공하지 않습니다. 홈 상단에 간단한 키보드 단축키 i를 지원합니다.
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='i'&&e.ctrlKey)openIncome()});
render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
