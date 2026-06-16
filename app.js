const KEY = 'bfc_v102_store';
const OLD_KEYS = ['bfc_v101_store','bfc_v1_store'];
const state = {
  view: 'home', mode: 'add', image: null, imageName: '', points: [], center: null, selectedPoint: null,
  store: { athletes: [], reports: [], settings: { aiEndpoint: '' } }, deferredPrompt: null
};
const $ = (id) => document.getElementById(id);
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function load(){
  try{
    const current = localStorage.getItem(KEY);
    if(current){ state.store = JSON.parse(current) || state.store; return; }
    for(const k of OLD_KEYS){
      const old = localStorage.getItem(k);
      if(old){ state.store = JSON.parse(old) || state.store; localStorage.setItem(KEY, JSON.stringify(state.store)); return; }
    }
  }catch(e){}
}
function save(){ localStorage.setItem(KEY, JSON.stringify(state.store)); renderAll(); }
function go(view){
  if(view !== 'reports'){ document.body.classList.remove('report-open'); } state.view=view; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view)); document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view)); if(view==='reports') renderReports(); }
function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),250);},2200);
}
function getAthlete(id){ return state.store.athletes.find(a=>a.id===id); }

function renderAll(){
  $('dataStatus').textContent = `${state.store.athletes.length}명 / ${state.store.reports.length}건`;
  $('offlineStatus').textContent = navigator.onLine ? '온라인 / 오프라인 준비' : '오프라인 실행 중';
  $('aiStatus').textContent = state.store.settings.aiEndpoint ? 'AI 주소 메모됨' : (navigator.onLine ? '온라인 연결 가능' : '오프라인 수동 모드');
  renderAthleteSelect(); renderAthletes(); renderCounts();
}
function renderAthleteSelect(){
  const sel=$('athleteSelect'); sel.innerHTML='';
  if(!state.store.athletes.length){ sel.innerHTML='<option value="">선수 없음</option>'; return; }
  state.store.athletes.forEach(a=>{ const o=document.createElement('option'); o.value=a.id; o.textContent=a.name; sel.appendChild(o); });
}
function renderAthletes(){
  const box=$('athleteList'); if(!box) return; box.innerHTML='';
  if(!state.store.athletes.length){ box.innerHTML='<div class="mini-card"><h3>등록된 선수가 없습니다.</h3><p>선수명을 입력하고 저장하세요.</p></div>'; return; }
  state.store.athletes.forEach(a=>{
    const count=state.store.reports.filter(r=>r.athleteId===a.id).length;
    const card=document.createElement('article'); card.className='mini-card';
    card.innerHTML=`<h3>${a.name}</h3><p>${a.team||'소속 없음'} · ${a.discipline||'바이애슬론'}</p><p>저장 결과 ${count}건</p><button class="ghost small" data-del-athlete="${a.id}">삭제</button>`;
    box.appendChild(card);
  });
}
function renderReports(){
  const box=$('reportList'); box.innerHTML=''; $('reportPaper').hidden=true;
  if(!state.store.reports.length){ box.innerHTML='<div class="mini-card"><h3>저장된 결과가 없습니다.</h3><p>분석 화면에서 세트를 저장하세요.</p></div>'; return; }
  state.store.reports.slice().reverse().forEach(r=>{
    const a=getAthlete(r.athleteId) || {name:'선수 미상'};
    const card=document.createElement('article'); card.className='mini-card';
    card.innerHTML=`<h3>${a.name} · ${r.shootType}</h3><p>${new Date(r.createdAt).toLocaleString()} · ${r.points.length}/${r.shotCount}발 · 세트 ${r.setNo}</p><p>중심 편차: ${formatOffset(r.metrics.avgX)} / ${formatOffset(r.metrics.avgY)}</p><button class="primary small" data-open-report="${r.id}">결과지 열기</button> <button class="ghost small" data-del-report="${r.id}">삭제</button>`;
    box.appendChild(card);
  });
}
function formatOffset(v){ if(v==null || isNaN(v)) return '-'; return `${v>0?'+':''}${v.toFixed(1)}px`; }
function renderCounts(){ $('pointCount').textContent=state.points.length; $('requiredCount').textContent=$('shotCount').value||5; drawCanvas(); }

function addAthlete(name, team='', discipline='바이애슬론'){
  name=(name||'').trim(); if(!name) return null;
  const existing=state.store.athletes.find(a=>a.name===name); if(existing) return existing;
  const a={id:uid(), name, team, discipline, createdAt:new Date().toISOString()};
  state.store.athletes.push(a); save(); return a;
}

function canvasPos(evt){
  const canvas=$('shotCanvas'); const rect=canvas.getBoundingClientRect();
  const touch=evt.touches?.[0] || evt.changedTouches?.[0]; const x0=touch?touch.clientX:evt.clientX; const y0=touch?touch.clientY:evt.clientY;
  return { x:(x0-rect.left)*canvas.width/rect.width, y:(y0-rect.top)*canvas.height/rect.height };
}
function nearestPoint(pos){
  let best=null, dist=Infinity; state.points.forEach((p,i)=>{ const d=Math.hypot(p.x-pos.x,p.y-pos.y); if(d<dist){dist=d;best={p,i,d};} }); return best;
}
function setMode(mode){
  state.mode=mode; state.selectedPoint=null;
  const names={add:'수동 마킹',move:'점 이동',del:'점 삭제',center:'중앙 지정'};
  $('modeText').textContent=`현재 모드: ${names[mode]}`;
  ['addPointModeBtn','movePointModeBtn','deletePointModeBtn','centerModeBtn'].forEach(id=>$(id)?.classList.remove('active-tool'));
  const map={add:'addPointModeBtn',move:'movePointModeBtn',del:'deletePointModeBtn',center:'centerModeBtn'};
  $(map[mode])?.classList.add('active-tool');
}
function handleCanvasDown(evt){
  if(!state.image) return; evt.preventDefault(); const pos=canvasPos(evt);
  if(state.mode==='center'){ state.center=pos; drawCanvas(); toast('중앙점 지정 완료'); setMode('add'); return; }
  if(state.mode==='add'){
    const max=parseInt($('shotCount').value||'5',10); if(state.points.length>=max){ toast(`현재 발수는 ${max}발입니다. 추가하려면 발수를 변경하세요.`); return; }
    state.points.push(pos); renderCounts(); toast(`${state.points.length}번 탄착점 입력`); return;
  }
  const near=nearestPoint(pos); if(!near || near.d>35) return;
  if(state.mode==='del'){ state.points.splice(near.i,1); renderCounts(); toast('탄착점 삭제'); return; }
  if(state.mode==='move'){ state.selectedPoint=near.i; }
}
function handleCanvasMove(evt){ if(state.selectedPoint==null || state.mode!=='move') return; evt.preventDefault(); state.points[state.selectedPoint]=canvasPos(evt); drawCanvas(); }
function handleCanvasUp(){ state.selectedPoint=null; }

function drawCanvas(targetCanvas=$('shotCanvas'), report=null){
  const canvas=targetCanvas; const ctx=canvas.getContext('2d');
  const img = report ? report.imageObj : state.image;
  const pts = report ? report.points : state.points;
  const center = report ? report.center : state.center;
  if(!img){ canvas.width=1; canvas.height=1; return; }
  canvas.width=img.naturalWidth || img.width; canvas.height=img.naturalHeight || img.height;
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  ctx.lineWidth=Math.max(2, canvas.width/380);
  if(center){ drawCenter(ctx,center,canvas); }
  pts.forEach((p,i)=>drawPoint(ctx,p,i+1,canvas));
}
function drawCenter(ctx,p,canvas){
  const r=Math.max(18, canvas.width/40); ctx.save();
  ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(p.x-r,p.y); ctx.lineTo(p.x+r,p.y); ctx.moveTo(p.x,p.y-r); ctx.lineTo(p.x,p.y+r); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.95)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x-r,p.y); ctx.lineTo(p.x+r,p.y); ctx.moveTo(p.x,p.y-r); ctx.lineTo(p.x,p.y+r); ctx.stroke();
  ctx.restore();
}
function drawPoint(ctx,p,num,canvas){
  const r=Math.max(16, canvas.width/52), cross=Math.max(10, canvas.width/90); ctx.save();
  ctx.strokeStyle='rgba(0,0,0,.95)'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.98)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='#19e7f2'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.95)'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(p.x-cross,p.y); ctx.lineTo(p.x+cross,p.y); ctx.moveTo(p.x,p.y-cross); ctx.lineTo(p.x,p.y+cross); ctx.stroke();
  ctx.strokeStyle='#19e7f2'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x-cross,p.y); ctx.lineTo(p.x+cross,p.y); ctx.moveTo(p.x,p.y-cross); ctx.lineTo(p.x,p.y+cross); ctx.stroke();
  const lx=p.x+r+8, ly=p.y-r-8; ctx.fillStyle='rgba(0,0,0,.85)'; roundRect(ctx,lx,ly,28,26,8); ctx.fill(); ctx.fillStyle='#fff'; ctx.font=`bold ${Math.max(15,canvas.width/55)}px sans-serif`; ctx.fillText(num,lx+9,ly+19); ctx.restore();
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function calcMetrics(points,center){
  if(!points.length || !center) return {avgX:null,avgY:null,group:null,meanDist:null};
  const dx=points.map(p=>p.x-center.x), dy=points.map(p=>center.y-p.y);
  const avgX=dx.reduce((a,b)=>a+b,0)/points.length, avgY=dy.reduce((a,b)=>a+b,0)/points.length;
  let group=0; for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) group=Math.max(group,Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y));
  const meanDist=points.reduce((s,p)=>s+Math.hypot(p.x-center.x,p.y-center.y),0)/points.length;
  return {avgX,avgY,group,meanDist};
}
function saveAnalysis(){
  const athleteId=$('athleteSelect').value; if(!athleteId){ toast('선수를 먼저 등록하거나 선택하세요.'); return; }
  if(!state.image){ toast('사진을 먼저 촬영하거나 업로드하세요.'); return; }
  if(!state.center){ toast('보드판 중앙을 지정하세요.'); return; }
  const shotCount=parseInt($('shotCount').value,10); if(state.points.length<1){ toast('탄착점을 1개 이상 입력하세요.'); return; }
  const r={id:uid(), athleteId, shootType:$('shootType').value, shotCount, setNo:$('setNo').value||'1', weather:$('weather').value, memo:$('sessionMemo').value||'', createdAt:new Date().toISOString(), imageData:state.image.src, imageName:state.imageName, points:state.points, center:state.center, metrics:calcMetrics(state.points,state.center)};
  state.store.reports.push(r); save(); toast('세트가 저장되었습니다.'); go('reports'); openReport(r.id);
}
function openReport(id){
  document.body.classList.add('report-open');
  const r=state.store.reports.find(x=>x.id===id); if(!r) return; const a=getAthlete(r.athleteId)||{name:'선수 미상'};
  $('reportPaper').hidden=false; $('reportTitle').textContent=`${a.name} ${r.shootType} 사격 결과`;
  $('reportMeta').innerHTML=`<div class="metric"><b>선수</b><br>${a.name}</div><div class="metric"><b>일시</b><br>${new Date(r.createdAt).toLocaleString()}</div><div class="metric"><b>구분</b><br>${r.shootType}</div><div class="metric"><b>발수</b><br>${r.points.length}/${r.shotCount}발</div><div class="metric"><b>세트</b><br>${r.setNo}</div><div class="metric"><b>날씨</b><br>${r.weather}</div>`;
  $('reportMetrics').innerHTML=`<div class="metric"><b>좌우 평균 편차</b><br>${formatOffset(r.metrics.avgX)}</div><div class="metric"><b>상하 평균 편차</b><br>${formatOffset(r.metrics.avgY)}</div><div class="metric"><b>탄착군 크기</b><br>${r.metrics.group? r.metrics.group.toFixed(1)+'px':'-'}</div><div class="metric"><b>중앙 평균 거리</b><br>${r.metrics.meanDist? r.metrics.meanDist.toFixed(1)+'px':'-'}</div><div class="metric"><b>메모</b><br>${r.memo||'-'}</div>`;
  const img=new Image(); img.onload=()=>{ r.imageObj=img; drawCanvas($('reportCanvas'),r); }; img.src=r.imageData;
  window.scrollTo({top:$('reportPaper').offsetTop-20,behavior:'smooth'});
}
function resetAnalysis(){
  state.points=[]; state.center=null; state.selectedPoint=null; state.image=null; state.imageName='';
  if($('cameraInput')) $('cameraInput').value=''; if($('albumInput')) $('albumInput').value='';
  $('emptyCanvas').style.display='flex'; setMode('add'); renderCounts();
}
async function shareReportImage(){
  const canvas=$('reportCanvas'); if(!canvas.width) return toast('먼저 결과지를 여세요.');
  canvas.toBlob(async blob=>{ try{ const file=new File([blob],'biathlon-result.png',{type:'image/png'}); if(navigator.canShare?.({files:[file]})){ await navigator.share({files:[file],title:'Biathlon Field Coach 결과'}); } else { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='biathlon-result.png'; a.click(); } }catch(e){ toast('공유를 취소했거나 지원되지 않습니다.'); } },'image/png');
}
function exportData(){ const blob=new Blob([JSON.stringify(state.store,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='biathlon-field-coach-backup.json'; a.click(); }

function init(){
  load();
  document.querySelectorAll('[data-go],.tab').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go||b.dataset.view)));
  window.addEventListener('online',renderAll); window.addEventListener('offline',renderAll);
  window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); state.deferredPrompt=e; $('installBtn').hidden=false; });
  $('installBtn').addEventListener('click',async()=>{ if(state.deferredPrompt){ state.deferredPrompt.prompt(); state.deferredPrompt=null; $('installBtn').hidden=true; }});
  $('quickAddBtn').addEventListener('click',()=>{ const a=addAthlete($('quickAthlete').value); if(a){ $('athleteSelect').value=a.id; $('quickAthlete').value=''; }});
  $('athleteForm').addEventListener('submit',e=>{ e.preventDefault(); addAthlete($('athleteName').value,$('athleteTeam').value,$('athleteDiscipline').value); e.target.reset(); });
  document.addEventListener('click',e=>{
    const da=e.target.dataset.delAthlete; if(da && confirm('선수를 삭제할까요? 저장된 결과는 유지됩니다.')){ state.store.athletes=state.store.athletes.filter(a=>a.id!==da); save(); }
    const or=e.target.dataset.openReport; if(or) openReport(or);
    const dr=e.target.dataset.delReport; if(dr && confirm('결과를 삭제할까요?')){ state.store.reports=state.store.reports.filter(r=>r.id!==dr); save(); renderReports(); }
  });
  $('shotCount').addEventListener('change',()=>{ const max=parseInt($('shotCount').value,10); if(state.points.length>max) state.points=state.points.slice(0,max); renderCounts(); });
  function loadPhotoFile(file){
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        state.image=img; state.imageName=file.name || '촬영 사진'; state.points=[]; state.center=null;
        $('emptyCanvas').style.display='none'; setMode('center'); drawCanvas(); renderCounts();
        toast('사진 불러오기 완료. 먼저 중앙을 지정하세요.');
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  }
  $('cameraInput')?.addEventListener('change',e=>loadPhotoFile(e.target.files[0]));
  $('albumInput')?.addEventListener('change',e=>loadPhotoFile(e.target.files[0]));
  $('shotCanvas').addEventListener('mousedown',handleCanvasDown); $('shotCanvas').addEventListener('mousemove',handleCanvasMove); window.addEventListener('mouseup',handleCanvasUp);
  $('shotCanvas').addEventListener('touchstart',handleCanvasDown,{passive:false}); $('shotCanvas').addEventListener('touchmove',handleCanvasMove,{passive:false}); $('shotCanvas').addEventListener('touchend',handleCanvasUp);
  $('addPointModeBtn').addEventListener('click',()=>setMode('add')); $('movePointModeBtn').addEventListener('click',()=>setMode('move')); $('deletePointModeBtn').addEventListener('click',()=>setMode('del')); $('centerModeBtn').addEventListener('click',()=>setMode('center'));
  $('resetAnalysisBtn').addEventListener('click',resetAnalysis); $('saveAnalysisBtn').addEventListener('click',saveAnalysis); $('goReportsBtn').addEventListener('click',()=>go('reports'));
  $('printReportBtn').addEventListener('click',()=>window.print()); $('shareImageBtn').addEventListener('click',shareReportImage); $('closeReportBtn').addEventListener('click',()=>{ $('reportPaper').hidden=true; document.body.classList.remove('report-open'); }); $('exportDataBtn').addEventListener('click',exportData);
  $('saveSettingsBtn').addEventListener('click',()=>{ state.store.settings.aiEndpoint=$('aiEndpoint').value.trim(); save(); toast('설정이 저장되었습니다.'); });
  $('checkOfflineBtn').addEventListener('click',()=>{ $('offlineDetail').textContent = navigator.serviceWorker ? 'Service Worker 지원: 가능. 홈 화면에 추가 후 오프라인 실행을 테스트하세요.' : '이 브라우저는 오프라인 앱 기능을 지원하지 않습니다.'; });
  $('clearDataBtn').addEventListener('click',()=>{ if(confirm('기기 저장 데이터를 모두 삭제할까요?')){ localStorage.removeItem(KEY); location.reload(); }});
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js').catch(()=>{}); }
  setMode('add'); renderAll();
}
init();
