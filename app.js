const KEY = 'bfc_v108_store';
const OLD_KEYS = ['bfc_v107_store','bfc_v106_store','bfc_v105_store','bfc_v104_store','bfc_v102_store','bfc_v101_store','bfc_v1_store'];
const state = {
  view: 'home', mode: 'add', viewMode: 'fit', image: null, imageName: '', points: [], center: null,
  selectedPoint: null, dragHitRadius: false, targetRadius: null, targetCircle: null,
  ringDraft: null,
  store: { athletes: [], reports: [], settings: { aiEndpoint: '', ring1Radius: 45, proneRadius: 80, ring3Radius: 120, standingRadius: 170, clickPx: 12, edgeTolerance: 6 } },
  deferredPrompt: null
};
const $ = (id) => document.getElementById(id);
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function load(){
  try{
    const current = localStorage.getItem(KEY);
    if(current){ state.store = mergeStore(JSON.parse(current)); return; }
    for(const k of OLD_KEYS){
      const old = localStorage.getItem(k);
      if(old){ state.store = mergeStore(JSON.parse(old)); localStorage.setItem(KEY, JSON.stringify(state.store)); return; }
    }
  }catch(e){}
}
function mergeStore(s){
  const base={ athletes: [], reports: [], settings: { aiEndpoint:'', ring1Radius:45, proneRadius:80, ring3Radius:120, standingRadius:170, clickPx:12, edgeTolerance:6 } };
  return { ...base, ...(s||{}), settings:{...base.settings, ...((s||{}).settings||{})} };
}
function save(){
  syncCalibrationFromInputs();
  localStorage.setItem(KEY, JSON.stringify(state.store));
  renderAll();
}
function go(view){
  document.body.classList.remove('analysis-focus');
  if(view !== 'reports'){ document.body.classList.remove('report-open'); }
  state.view=view;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===view));
  if(view==='reports') renderReports();
  window.scrollTo({top:0,behavior:'smooth'});
}
function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10); setTimeout(()=>{t.classList.remove('show'); setTimeout(()=>t.remove(),250);},2400);
}
function getAthlete(id){ return state.store.athletes.find(a=>a.id===id); }
function currentType(){ return $('shootType')?.value || '복사'; }
function ringSettings(){
  return {
    ring1Radius: Math.max(5, Number($('ring1Radius')?.value || state.store.settings.ring1Radius || 45)),
    proneRadius: Math.max(5, Number($('proneRadius')?.value || state.store.settings.proneRadius || 80)),
    ring3Radius: Math.max(5, Number($('ring3Radius')?.value || state.store.settings.ring3Radius || 120)),
    standingRadius: Math.max(5, Number($('standingRadius')?.value || state.store.settings.standingRadius || 170))
  };
}
function activeRadius(){
  const r = ringSettings();
  return currentType()==='입사' ? r.standingRadius : r.proneRadius;
}
function activeJudgeName(){ return currentType()==='입사' ? '④ 입사 기준선' : '② 복사 기준선'; }
function syncCalibrationToInputs(){
  if($('ring1Radius')) $('ring1Radius').value = Math.round(state.store.settings.ring1Radius || 45);
  if($('proneRadius')) $('proneRadius').value = Math.round(state.store.settings.proneRadius || 80);
  if($('ring3Radius')) $('ring3Radius').value = Math.round(state.store.settings.ring3Radius || 120);
  if($('standingRadius')) $('standingRadius').value = Math.round(state.store.settings.standingRadius || 170);
  if($('clickPx')) $('clickPx').value = Math.round(state.store.settings.clickPx || 12);
}
function syncCalibrationFromInputs(){
  if($('ring1Radius')) state.store.settings.ring1Radius = Math.max(5, Number($('ring1Radius').value || 45));
  if($('proneRadius')) state.store.settings.proneRadius = Math.max(5, Number($('proneRadius').value || 80));
  if($('ring3Radius')) state.store.settings.ring3Radius = Math.max(5, Number($('ring3Radius').value || 120));
  if($('standingRadius')) state.store.settings.standingRadius = Math.max(5, Number($('standingRadius').value || 170));
  if($('clickPx')) state.store.settings.clickPx = Math.max(1, Number($('clickPx').value || 12));
}
function renderAll(){
  $('dataStatus').textContent = `${state.store.athletes.length}명 / ${state.store.reports.length}건`;
  $('offlineStatus').textContent = navigator.onLine ? '온라인 / 오프라인 준비' : '오프라인 실행 중';
  $('aiStatus').textContent = navigator.onLine ? '자동+수동 분석 가능' : '오프라인 직접 마킹';
  renderAthleteSelect(); renderAthletes(); renderCounts(); syncCalibrationToInputs();
}
function renderAthleteSelect(){
  const sel=$('athleteSelect'); if(!sel) return; sel.innerHTML='';
  if(!state.store.athletes.length){ sel.innerHTML='<option value="">선수 없음</option>'; return; }
  state.store.athletes.forEach(a=>{ const o=document.createElement('option'); o.value=a.id; o.textContent=a.name; sel.appendChild(o); });
}
function renderAthletes(){
  const box=$('athleteList'); if(!box) return; box.innerHTML='';
  if(!state.store.athletes.length){ box.innerHTML='<div class="mini-card"><h3>등록된 선수가 없습니다.</h3><p>선수명을 입력하고 저장하세요.</p></div>'; return; }
  state.store.athletes.forEach(a=>{
    const count=state.store.reports.filter(r=>r.athleteId===a.id).length;
    const card=document.createElement('article'); card.className='mini-card';
    card.innerHTML=`<h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.team||'소속 없음')} · ${escapeHtml(a.discipline||'바이애슬론')}</p><p>저장 결과 ${count}건</p><button class="ghost small" data-del-athlete="${a.id}">삭제</button>`;
    box.appendChild(card);
  });
}
function renderReports(){
  const box=$('reportList'); box.innerHTML=''; $('reportPaper').hidden=true; document.body.classList.remove('report-open');
  if(!state.store.reports.length){ box.innerHTML='<div class="mini-card"><h3>저장된 결과가 없습니다.</h3><p>분석 화면에서 세트를 저장하세요.</p></div>'; return; }
  state.store.reports.slice().reverse().forEach(r=>{
    const a=getAthlete(r.athleteId) || {name:'선수 미상'};
    const hitText = r.metrics?.hitRateText || '-';
    const card=document.createElement('article'); card.className='mini-card';
    card.innerHTML=`<h3>${escapeHtml(a.name)} · ${escapeHtml(r.shootType)}</h3><p>${new Date(r.createdAt).toLocaleString()} · ${r.points.length}/${r.shotCount}발 · 세트 ${escapeHtml(r.setNo)}</p><p>명중률: ${hitText} · 중심 편차: ${formatOffset(r.metrics.avgX)} / ${formatOffset(r.metrics.avgY)}</p><button class="primary small" data-open-report="${r.id}">결과지 열기</button> <button class="ghost small" data-del-report="${r.id}">삭제</button>`;
    box.appendChild(card);
  });
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function formatOffset(v){ if(v==null || isNaN(v)) return '-'; return `${v>0?'+':''}${v.toFixed(1)}px`; }
function renderCounts(){ if($('pointCount')) $('pointCount').textContent=state.points.length; if($('requiredCount')) $('requiredCount').textContent=$('shotCount')?.value||5; drawCanvas(); }
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
function normalizePoint(p){ return { x:p.x, y:p.y, hitOverride:p.hitOverride ?? null, source:p.source || 'manual' }; }
function setMode(mode){
  state.mode=mode; state.selectedPoint=null; state.dragHitRadius=false;
  const names={add:'직접 마킹',move:'점 이동',del:'점 삭제',center:'중앙 지정',ring1:'① 가는 점선 설정',proneLine:'② 복사 기준선 설정',ring3:'③ 가는 실선 설정',standingLine:'④ 입사 기준선 설정',toggleHit:'판정 수정'};
  $('modeText').textContent=`현재 모드: ${names[mode]}`;
  ['addPointModeBtn','movePointModeBtn','deletePointModeBtn','centerModeBtn','ring1ModeBtn','proneLineModeBtn','ring3ModeBtn','standingLineModeBtn','toggleHitModeBtn'].forEach(id=>$(id)?.classList.remove('active-tool'));
  const map={add:'addPointModeBtn',move:'movePointModeBtn',del:'deletePointModeBtn',center:'centerModeBtn',ring1:'ring1ModeBtn',proneLine:'proneLineModeBtn',ring3:'ring3ModeBtn',standingLine:'standingLineModeBtn',toggleHit:'toggleHitModeBtn'};
  $(map[mode])?.classList.add('active-tool');
}
function handleCanvasDown(evt){
  if(!state.image) return; evt.preventDefault(); const pos=canvasPos(evt);
  if(state.mode==='center'){
    state.center=pos;
    if(!state.targetRadius) estimateTargetFromImage();
    drawCanvas(); toast('중앙점 지정 완료'); setMode('add'); return;
  }
  if(['ring1','proneLine','ring3','standingLine'].includes(state.mode)){
    if(!state.center){ toast('먼저 중앙점을 지정하세요.'); return; }
    setRingRadiusFromPoint(state.mode,pos); state.dragHitRadius=true; state.ringDraft=state.mode; drawCanvas(); return;
  }
  if(state.mode==='add'){
    const max=parseInt($('shotCount').value||'5',10); if(state.points.length>=max){ toast(`현재 발수는 ${max}발입니다. 추가하려면 발수를 변경하세요.`); return; }
    state.points.push(normalizePoint(pos)); renderCounts(); toast(`${state.points.length}번 탄착점 입력`); return;
  }
  const near=nearestPoint(pos); if(!near || near.d>45) return;
  if(state.mode==='del'){ state.points.splice(near.i,1); renderCounts(); toast('탄착점 삭제'); return; }
  if(state.mode==='move'){ state.selectedPoint=near.i; return; }
  if(state.mode==='toggleHit'){
    const p=state.points[near.i]; const current=isHit(p); p.hitOverride=!current; renderCounts(); toast(p.hitOverride ? '명중으로 수정' : '불명중으로 수정'); return;
  }
}
function handleCanvasMove(evt){
  if(state.dragHitRadius && state.ringDraft){ evt.preventDefault(); setRingRadiusFromPoint(state.ringDraft, canvasPos(evt)); drawCanvas(); return; }
  if(state.selectedPoint==null || state.mode!=='move') return; evt.preventDefault();
  const p=state.points[state.selectedPoint]; const pos=canvasPos(evt); state.points[state.selectedPoint]={...p,x:pos.x,y:pos.y}; drawCanvas();
}
function handleCanvasUp(){ state.selectedPoint=null; state.dragHitRadius=false; state.ringDraft=null; }
function setRingRadiusFromPoint(mode,pos){
  if(!state.center) return; const r=Math.max(5, Math.hypot(pos.x-state.center.x,pos.y-state.center.y));
  const map={ring1:['ring1Radius','① 가는 점선'], proneLine:['proneRadius','② 복사 기준선'], ring3:['ring3Radius','③ 가는 실선'], standingLine:['standingRadius','④ 입사 기준선']};
  const item=map[mode]; if(!item) return;
  const [inputId,label]=item; if($(inputId)) $(inputId).value=Math.round(r); state.store.settings[inputId]=Math.round(r);
  toast(`${label} 반경 ${Math.round(r)}px`);
}
function edgeTolerance(){ return Math.max(0, Number(state.store.settings.edgeTolerance || 6)); }
function circleDistance(p, center){ return Math.hypot(p.x-center.x,p.y-center.y); }
function isHit(p, radiusOverride=null){
  if(p.hitOverride !== null && p.hitOverride !== undefined) return !!p.hitOverride;
  if(!state.center) return false;
  const r=radiusOverride ?? activeRadius();
  return circleDistance(p,state.center) <= r + edgeTolerance();
}
function pointHitForReport(p, center, radius, tolerance=null){
  if(p.hitOverride !== null && p.hitOverride !== undefined) return !!p.hitOverride;
  if(!center) return false;
  const tol = tolerance == null ? 6 : Math.max(0, Number(tolerance));
  return Math.hypot(p.x-center.x,p.y-center.y) <= radius + tol;
}
function drawCanvas(targetCanvas=$('shotCanvas'), report=null){
  const canvas=targetCanvas; if(!canvas) return; const ctx=canvas.getContext('2d');
  const img = report ? report.imageObj : state.image;
  const pts = report ? report.points.map(normalizePoint) : state.points.map(normalizePoint);
  const center = report ? report.center : state.center;
  const radius = report ? report.hitRadius : activeRadius();
  const rings = report ? (report.rings || {ring1Radius:report.ring1Radius, proneRadius:report.proneRadius||report.hitRadius, ring3Radius:report.ring3Radius, standingRadius:report.standingRadius}) : ringSettings();
  if(!img){ canvas.width=1; canvas.height=1; return; }
  canvas.width=img.naturalWidth || img.width; canvas.height=img.naturalHeight || img.height;
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  if(center){ drawFourRings(ctx,center,rings,canvas, report?.shootType || currentType()); drawCenter(ctx,center,canvas); }
  pts.forEach((p,i)=>drawPoint(ctx,p,i+1,canvas, center ? pointHitForReport(p,center,radius, report?.edgeTolerance ?? edgeTolerance()) : true));
}
function drawFourRings(ctx,p,rings,canvas,type){
  if(!p || !rings) return; ctx.save();
  const scale=Math.max(1, canvas.width/900);
  const defs=[
    {key:'ring1Radius', label:'① 가는 점선', color:'rgba(255,255,255,.85)', width:1.5*scale, dash:[3*scale,7*scale]},
    {key:'proneRadius', label:'② 복사 기준선', color:'rgba(255,77,103,.98)', width:4.5*scale, dash:[14*scale,8*scale]},
    {key:'ring3Radius', label:'③ 가는 실선', color:'rgba(255,255,255,.95)', width:2.2*scale, dash:[]},
    {key:'standingRadius', label:'④ 입사 기준선', color:'rgba(255,214,0,.98)', width:4*scale, dash:[]}
  ];
  defs.forEach(d=>{
    const r=Number(rings[d.key]); if(!r) return;
    ctx.strokeStyle=d.color; ctx.lineWidth=d.width; ctx.setLineDash(d.dash);
    ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
  });
  ctx.setLineDash([]);
  const judge = type==='입사' ? {r:rings.standingRadius, txt:'입사: ④ 안쪽 명중'} : {r:rings.proneRadius, txt:'복사: ② 선 포함 명중'};
  if(judge.r){
    const lx=Math.min(canvas.width-230, p.x+judge.r+10), ly=Math.max(12, p.y-26);
    ctx.fillStyle='rgba(0,0,0,.78)'; roundRect(ctx,lx,ly,220,34,10); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font=`bold ${Math.max(16,canvas.width/62)}px sans-serif`; ctx.fillText(judge.txt,lx+12,ly+23);
  }
  ctx.restore();
}
function drawCenter(ctx,p,canvas){
  const r=Math.max(18, canvas.width/40); ctx.save();
  ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(p.x-r,p.y); ctx.lineTo(p.x+r,p.y); ctx.moveTo(p.x,p.y-r); ctx.lineTo(p.x,p.y+r); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.95)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x-r,p.y); ctx.lineTo(p.x+r,p.y); ctx.moveTo(p.x,p.y-r); ctx.lineTo(p.x,p.y+r); ctx.stroke();
  ctx.restore();
}
function drawPoint(ctx,p,num,canvas,hit=true){
  const r=Math.max(14, canvas.width/58), cross=Math.max(9, canvas.width/100); ctx.save();
  const color = hit ? '#19e7f2' : '#ff4d67';
  ctx.strokeStyle='rgba(0,0,0,.95)'; ctx.lineWidth=6; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.98)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=color; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(0,0,0,.95)'; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(p.x-cross,p.y); ctx.lineTo(p.x+cross,p.y); ctx.moveTo(p.x,p.y-cross); ctx.lineTo(p.x,p.y+cross); ctx.stroke();
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(p.x-cross,p.y); ctx.lineTo(p.x+cross,p.y); ctx.moveTo(p.x,p.y-cross); ctx.lineTo(p.x,p.y+cross); ctx.stroke();
  const label = hit ? String(num) : `${num}×`; const lx=p.x+r+8, ly=p.y-r-8; ctx.fillStyle='rgba(0,0,0,.85)'; roundRect(ctx,lx,ly, hit?30:42,28,8); ctx.fill(); ctx.fillStyle='#fff'; ctx.font=`bold ${Math.max(15,canvas.width/55)}px sans-serif`; ctx.fillText(label,lx+8,ly+20); ctx.restore();
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function calcMetrics(points,center,hitRadius){
  points=points.map(normalizePoint);
  if(!points.length || !center) return {avgX:null,avgY:null,group:null,meanDist:null,hitCount:0,hitRateText:'-'};
  const dx=points.map(p=>p.x-center.x), dy=points.map(p=>center.y-p.y);
  const avgX=dx.reduce((a,b)=>a+b,0)/points.length, avgY=dy.reduce((a,b)=>a+b,0)/points.length;
  let group=0; for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++) group=Math.max(group,Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y));
  const meanDist=points.reduce((s,p)=>s+Math.hypot(p.x-center.x,p.y-center.y),0)/points.length;
  const hitCount=points.filter(p=>pointHitForReport(p,center,hitRadius, edgeTolerance())).length;
  const clickPx=Math.max(1, Number($('clickPx')?.value || state.store.settings.clickPx || 12));
  const clickX = avgX / clickPx; const clickY = avgY / clickPx;
  const clickText = `${clickX>0?'좌':'우'} ${Math.abs(clickX).toFixed(1)}클릭 / ${clickY>0?'하':'상'} ${Math.abs(clickY).toFixed(1)}클릭`;
  return {avgX,avgY,group,meanDist,hitCount,hitRateText:`${hitCount}/${points.length} (${Math.round(hitCount/points.length*100)}%)`,clickX,clickY,clickText,hitRadius,clickPx};
}
function saveAnalysis(){
  const athleteId=$('athleteSelect').value; if(!athleteId){ toast('선수를 먼저 등록하거나 선택하세요.'); return; }
  if(!state.image){ toast('사진을 먼저 촬영하거나 업로드하세요.'); return; }
  if(!state.center){ toast('보드판 중앙을 지정하세요.'); return; }
  syncCalibrationFromInputs();
  const shotCount=parseInt($('shotCount').value,10); if(state.points.length<1){ toast('탄착점을 1개 이상 입력하세요.'); return; }
  const type=currentType(); const rings=ringSettings(); const hitRadius=activeRadius(); const points=state.points.map(normalizePoint);
  const r={id:uid(), athleteId, shootType:type, shotCount, setNo:$('setNo').value||'1', weather:$('weather').value, memo:$('sessionMemo').value||'', createdAt:new Date().toISOString(), imageData:state.image.src, imageName:state.imageName, points, center:state.center, hitRadius, rings, targetRadius:state.targetRadius, targetCircle:state.targetCircle, edgeTolerance:edgeTolerance(), clickPx:state.store.settings.clickPx, metrics:calcMetrics(points,state.center,hitRadius)};
  state.store.reports.push(r); save(); toast('세트가 저장되었습니다.'); go('reports'); openReport(r.id);
}
function openReport(id){
  document.body.classList.add('report-open'); document.body.classList.remove('analysis-focus');
  const r=state.store.reports.find(x=>x.id===id); if(!r) return; const a=getAthlete(r.athleteId)||{name:'선수 미상'};
  $('reportPaper').hidden=false; $('reportTitle').textContent=`${a.name} ${r.shootType} 사격 결과`;
  $('reportMeta').innerHTML=`<div class="metric"><b>선수</b><br>${escapeHtml(a.name)}</div><div class="metric"><b>일시</b><br>${new Date(r.createdAt).toLocaleString()}</div><div class="metric"><b>구분</b><br>${escapeHtml(r.shootType)}</div><div class="metric"><b>발수</b><br>${r.points.length}/${r.shotCount}발</div><div class="metric"><b>명중률</b><br>${r.metrics.hitRateText}</div><div class="metric"><b>세트</b><br>${escapeHtml(r.setNo)}</div><div class="metric"><b>날씨</b><br>${escapeHtml(r.weather)}</div>`;
  $('reportMetrics').innerHTML=`<div class="metric"><b>좌우 평균 편차</b><br>${formatOffset(r.metrics.avgX)}</div><div class="metric"><b>상하 평균 편차</b><br>${formatOffset(r.metrics.avgY)}</div><div class="metric"><b>탄착군 크기</b><br>${r.metrics.group? r.metrics.group.toFixed(1)+'px':'-'}</div><div class="metric"><b>중앙 평균 거리</b><br>${r.metrics.meanDist? r.metrics.meanDist.toFixed(1)+'px':'-'}</div><div class="metric"><b>판정 기준</b><br>${r.shootType==='입사'?'④ 입사 기준선':'② 복사 기준선'} · ${Math.round(r.hitRadius||0)}px</div><div class="metric"><b>4개 기준선</b><br>① ${Math.round(r.rings?.ring1Radius||0)} / ② ${Math.round(r.rings?.proneRadius||0)} / ③ ${Math.round(r.rings?.ring3Radius||0)} / ④ ${Math.round(r.rings?.standingRadius||0)}px</div><div class="metric"><b>클릭 보정 참고</b><br>${r.metrics.clickText||'-'}</div><div class="metric"><b>메모</b><br>${escapeHtml(r.memo||'-')}</div>`;
  const img=new Image(); img.onload=()=>{ r.imageObj=img; drawCanvas($('reportCanvas'),r); }; img.src=r.imageData;
  window.scrollTo({top:$('reportPaper').offsetTop-20,behavior:'smooth'});
}
function resetAnalysis(){
  state.points=[]; state.center=null; state.selectedPoint=null; state.image=null; state.imageName=''; state.targetRadius=null; state.targetCircle=null; state.ringDraft=null;
  if($('cameraInput')) $('cameraInput').value=''; if($('albumInput')) $('albumInput').value='';
  $('emptyCanvas').style.display='flex'; setMode('add'); renderCounts();
}
async function shareReportImage(){
  const canvas=$('reportCanvas'); if(!canvas.width) return toast('먼저 결과지를 여세요.');
  canvas.toBlob(async blob=>{ try{ const file=new File([blob],'biathlon-result.png',{type:'image/png'}); if(navigator.canShare?.({files:[file]})){ await navigator.share({files:[file],title:'Biathlon Field Coach 결과'}); } else { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='biathlon-result.png'; a.click(); } }catch(e){ toast('공유를 취소했거나 지원되지 않습니다.'); } },'image/png');
}
function exportData(){ const blob=new Blob([JSON.stringify(state.store,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='biathlon-field-coach-backup.json'; a.click(); }
function toggleFocus(){ document.body.classList.toggle('analysis-focus'); $('focusModeBtn').textContent = document.body.classList.contains('analysis-focus') ? '↩ 일반 화면' : '🔍 분석 크게'; }
function toggleFill(){
  const wrap=document.querySelector('.canvas-wrap'); wrap.classList.toggle('fill-mode'); state.viewMode=wrap.classList.contains('fill-mode')?'fill':'fit'; $('fillModeBtn').textContent= state.viewMode==='fill' ? '□ 전체 맞춤' : '▣ 화면 채움';
}

// v1.0.8: 표준 사격판 직접 마킹 + 보드판 자동 보정
function createTemplateBoard(){
  const W=1200, H=1500;
  const c=document.createElement('canvas'), ctx=c.getContext('2d');
  c.width=W; c.height=H;
  ctx.fillStyle='#f5f7fb'; ctx.fillRect(0,0,W,H);
  // 보드판 배경
  ctx.save();
  ctx.fillStyle='#ffffff'; ctx.strokeStyle='#cfd8e3'; ctx.lineWidth=8;
  roundRect(ctx,90,60,W-180,H-130,44); ctx.fill(); ctx.stroke();
  ctx.restore();
  const cx=W/2, cy=780, R=470;
  ctx.fillStyle='#101820'; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
  // 사격판 선: 중앙 십자와 4개 기준선
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,.92)'; ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(cx-R,cy); ctx.lineTo(cx+R,cy); ctx.moveTo(cx,cy-R); ctx.lineTo(cx,cy+R); ctx.stroke();
  const rings={ring1:R*.26, prone:R*.46, ring3:R*.67, standing:R};
  ctx.setLineDash([4,10]); ctx.strokeStyle='rgba(255,255,255,.78)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,cy,rings.ring1,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle='rgba(255,255,255,.96)'; ctx.lineWidth=9; ctx.beginPath(); ctx.arc(cx,cy,rings.prone,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.90)'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(cx,cy,rings.ring3,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,R*.83,0,Math.PI*2); ctx.stroke();
  ctx.restore();
  ctx.fillStyle='#d82331'; ctx.font='bold 54px sans-serif'; ctx.textAlign='center'; ctx.fillText('BIATHLON FIELD COACH',cx,H-135);
  ctx.fillStyle='#64748b'; ctx.font='bold 32px sans-serif'; ctx.fillText('표준 보드판 직접 마킹 모드',cx,H-90);
  const img=new Image();
  img.onload=()=>{
    state.image=img; state.imageName='표준 사격 보드판'; state.points=[];
    state.center={x:cx,y:cy}; state.targetRadius=R; state.targetCircle={x:cx,y:cy,r:R,source:'template'};
    if($('ring1Radius')) $('ring1Radius').value=Math.round(rings.ring1);
    if($('proneRadius')) $('proneRadius').value=Math.round(rings.prone);
    if($('ring3Radius')) $('ring3Radius').value=Math.round(rings.ring3);
    if($('standingRadius')) $('standingRadius').value=Math.round(rings.standing);
    syncCalibrationFromInputs(); $('emptyCanvas').style.display='none'; go('analysis'); setMode('add'); drawCanvas(); renderCounts(); toast('표준 보드판 직접 마킹 모드입니다. 맞은 위치를 바로 찍으세요.');
  };
  img.src=c.toDataURL('image/png');
}
function lightLinePixel(data,W,x,y){
  const i=(y*W+x)*4; const r=data[i], g=data[i+1], b=data[i+2];
  const max=Math.max(r,g,b), min=Math.min(r,g,b); const sat=max? (max-min)/max : 0;
  return max>135 && sat<0.28;
}
function detectCrossAndRings(data,W,H,cx,cy,R){
  let bestX=cx, bestXS=-1, bestY=cy, bestYS=-1;
  const xMin=Math.max(2,Math.round(cx-R*.35)), xMax=Math.min(W-3,Math.round(cx+R*.35));
  const yMin=Math.max(2,Math.round(cy-R*.35)), yMax=Math.min(H-3,Math.round(cy+R*.35));
  // 세로 실선 찾기: 표적판 안에서 밝은 선이 가장 길게 이어지는 x
  for(let x=xMin;x<=xMax;x++){
    let s=0;
    for(let y=Math.max(2,Math.round(cy-R*.85)); y<=Math.min(H-3,Math.round(cy+R*.85)); y+=2){
      const d=Math.hypot(x-cx,y-cy); if(d>R*.96||d<R*.12) continue;
      if(lightLinePixel(data,W,x,y)) s++;
    }
    if(s>bestXS){bestXS=s; bestX=x;}
  }
  // 가로 실선 찾기
  for(let y=yMin;y<=yMax;y++){
    let s=0;
    for(let x=Math.max(2,Math.round(cx-R*.85)); x<=Math.min(W-3,Math.round(cx+R*.85)); x+=2){
      const d=Math.hypot(x-cx,y-cy); if(d>R*.96||d<R*.12) continue;
      if(lightLinePixel(data,W,x,y)) s++;
    }
    if(s>bestYS){bestYS=s; bestY=y;}
  }
  const centerOk = bestXS>R*.16 && bestYS>R*.16;
  const ncx=centerOk ? bestX : cx, ncy=centerOk ? bestY : cy;
  // 원 기준선은 대각선 방향의 밝은 링을 우선 탐색한다. 십자선 영향 제거 목적.
  const angles=[Math.PI/6,Math.PI/3,2*Math.PI/3,5*Math.PI/6,7*Math.PI/6,4*Math.PI/3,5*Math.PI/3,11*Math.PI/6];
  const profile=[];
  for(let rr=Math.max(15,Math.round(R*.15)); rr<Math.round(R*.9); rr+=2){
    let score=0;
    for(const a of angles){
      const x=Math.round(ncx+Math.cos(a)*rr), y=Math.round(ncy+Math.sin(a)*rr);
      if(x<2||y<2||x>=W-2||y>=H-2) continue;
      if(lightLinePixel(data,W,x,y)) score++;
    }
    profile.push({r:rr,score});
  }
  const peaks=[]; const minSep=Math.max(20,R*.08);
  for(let i=2;i<profile.length-2;i++){
    const p=profile[i];
    if(p.score>=2 && p.score>=profile[i-1].score && p.score>=profile[i+1].score && p.score>=profile[i-2].score && p.score>=profile[i+2].score){
      if(!peaks.length || Math.abs(p.r-peaks[peaks.length-1].r)>minSep) peaks.push({...p});
      else if(p.score>peaks[peaks.length-1].score) peaks[peaks.length-1]={...p};
    }
  }
  peaks.sort((a,b)=>a.r-b.r);
  let ring1=R*.26, prone=R*.46, ring3=R*.67;
  if(peaks.length>=3){ ring1=peaks[0].r; prone=peaks[1].r; ring3=peaks[2].r; }
  else if(peaks.length>=2){ ring1=peaks[0].r; prone=peaks[1].r; ring3=R*.67; }
  // 복사 기준선이 너무 안쪽으로 잡히면 두 번째 굵은 실선 기준에 가깝게 보정
  prone=Math.max(prone, R*.40); prone=Math.min(prone, R*.58);
  ring1=Math.min(ring1, prone*.75); ring3=Math.max(ring3, prone*1.25); ring3=Math.min(ring3, R*.82);
  return {center:{x:ncx,y:ncy}, rings:{ring1Radius:ring1, proneRadius:prone, ring3Radius:ring3, standingRadius:R}, confidence:{centerOk,bestXS,bestYS,peaks}};
}

function estimateTargetFromImage_original_unused(){
  if(!state.image) return null;
  const srcW=state.image.naturalWidth||state.image.width, srcH=state.image.naturalHeight||state.image.height;
  const maxDim=520, scale=Math.min(1,maxDim/Math.max(srcW,srcH));
  const W=Math.max(1,Math.round(srcW*scale)), H=Math.max(1,Math.round(srcH*scale));
  const c=document.createElement('canvas'), ctx=c.getContext('2d'); c.width=W; c.height=H; ctx.drawImage(state.image,0,0,W,H);
  const data=ctx.getImageData(0,0,W,H).data, visited=new Uint8Array(W*H);
  function isDark(x,y){
    const i=(y*W+x)*4; const r=data[i],g=data[i+1],b=data[i+2];
    const max=Math.max(r,g,b), min=Math.min(r,g,b), sat=max? (max-min)/max:0;
    // 검은 표적판: 어두우면서 지나치게 채도가 높은 자석/로고는 제외
    return max<105 && sat<0.62;
  }
  const comps=[];
  for(let y=1;y<H-1;y+=2){
    for(let x=1;x<W-1;x+=2){
      const idx=y*W+x; if(visited[idx]||!isDark(x,y)) continue;
      const stack=[[x,y]]; visited[idx]=1; let n=0,sx=0,sy=0,minX=x,maxX=x,minY=y,maxY=y;
      while(stack.length){
        const [cx,cy]=stack.pop(); n++; sx+=cx; sy+=cy; minX=Math.min(minX,cx); maxX=Math.max(maxX,cx); minY=Math.min(minY,cy); maxY=Math.max(maxY,cy);
        for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){ const nx=cx+dx, ny=cy+dy, ni=ny*W+nx; if(nx<1||ny<1||nx>=W-1||ny>=H-1||visited[ni]) continue; visited[ni]=1; if(isDark(nx,ny)) stack.push([nx,ny]); }
      }
      const bw=maxX-minX, bh=maxY-minY; const touchesEdge=minX<8||minY<8||maxX>W-8||maxY>H-8; const ratio=bw/Math.max(1,bh);
      if(n>120 && !touchesEdge && ratio>0.45 && ratio<2.2 && bw>60 && bh>60){ comps.push({n,sx,sy,minX,maxX,minY,maxY,bw,bh}); }
    }
  }
  if(!comps.length){ return null; }
  comps.sort((a,b)=>b.n-a.n);
  const comp=comps[0];
  const cx=(comp.minX+comp.maxX)/2/scale, cy=(comp.minY+comp.maxY)/2/scale;
  // 실제 입사 기준선 = 검은 표적판이 흰 배경과 만나는 외곽선. 원근/사진각도 때문에 평균 반경 사용.
  const R=(comp.bw+comp.bh)/4/scale;
  state.targetCircle={x:cx,y:cy,r:R,source:'dark-target-component'};
  if(!state.center) state.center={x:cx,y:cy};
  state.targetRadius=R;
  if($('ring1Radius')) $('ring1Radius').value=Math.round(R*0.24);
  if($('proneRadius')) $('proneRadius').value=Math.round(R*0.43);
  if($('ring3Radius')) $('ring3Radius').value=Math.round(R*0.64);
  if($('standingRadius')) $('standingRadius').value=Math.round(R*0.99);
  syncCalibrationFromInputs();
  return state.targetCircle;
}

function estimateTargetFromImage(){
  if(!state.image) return null;
  const srcW=state.image.naturalWidth||state.image.width, srcH=state.image.naturalHeight||state.image.height;
  const maxDim=720, scale=Math.min(1,maxDim/Math.max(srcW,srcH));
  const W=Math.max(1,Math.round(srcW*scale)), H=Math.max(1,Math.round(srcH*scale));
  const c=document.createElement('canvas'), ctx=c.getContext('2d'); c.width=W; c.height=H; ctx.drawImage(state.image,0,0,W,H);
  const data=ctx.getImageData(0,0,W,H).data, visited=new Uint8Array(W*H);
  function isDark(x,y){
    const i=(y*W+x)*4; const r=data[i],g=data[i+1],b=data[i+2];
    const max=Math.max(r,g,b), min=Math.min(r,g,b), sat=max? (max-min)/max:0;
    return max<112 && sat<0.68;
  }
  const comps=[];
  for(let y=1;y<H-1;y+=2){
    for(let x=1;x<W-1;x+=2){
      const idx=y*W+x; if(visited[idx]||!isDark(x,y)) continue;
      const stack=[[x,y]]; visited[idx]=1; let n=0,sx=0,sy=0,minX=x,maxX=x,minY=y,maxY=y;
      while(stack.length){
        const [cx,cy]=stack.pop(); n++; sx+=cx; sy+=cy; minX=Math.min(minX,cx); maxX=Math.max(maxX,cx); minY=Math.min(minY,cy); maxY=Math.max(maxY,cy);
        for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){ const nx=cx+dx, ny=cy+dy, ni=ny*W+nx; if(nx<1||ny<1||nx>=W-1||ny>=H-1||visited[ni]) continue; visited[ni]=1; if(isDark(nx,ny)) stack.push([nx,ny]); }
      }
      const bw=maxX-minX, bh=maxY-minY; const touchesEdge=minX<8||minY<8||maxX>W-8||maxY>H-8; const ratio=bw/Math.max(1,bh);
      if(n>180 && !touchesEdge && ratio>0.55 && ratio<1.85 && bw>90 && bh>90){ comps.push({n,sx,sy,minX,maxX,minY,maxY,bw,bh}); }
    }
  }
  if(!comps.length){ toast('표적판 외곽을 자동으로 찾지 못했습니다. 중앙/기준선을 직접 지정하세요.'); return null; }
  comps.sort((a,b)=>b.n-a.n); const comp=comps[0];
  const rawCx=(comp.minX+comp.maxX)/2, rawCy=(comp.minY+comp.maxY)/2, rawR=(comp.bw+comp.bh)/4;
  const detected=detectCrossAndRings(data,W,H,rawCx,rawCy,rawR);
  const cx=detected.center.x/scale, cy=detected.center.y/scale, R=rawR/scale;
  state.targetCircle={x:cx,y:cy,r:R,source:detected.confidence.centerOk?'cross-lines':'outer-circle'};
  state.center={x:cx,y:cy}; state.targetRadius=R;
  const rings=detected.rings;
  if($('ring1Radius')) $('ring1Radius').value=Math.round(rings.ring1Radius/scale);
  if($('proneRadius')) $('proneRadius').value=Math.round(rings.proneRadius/scale);
  if($('ring3Radius')) $('ring3Radius').value=Math.round(rings.ring3Radius/scale);
  if($('standingRadius')) $('standingRadius').value=Math.round(rings.standingRadius/scale);
  syncCalibrationFromInputs(); drawCanvas();
  toast(detected.confidence.centerOk ? '중앙 십자와 기준선을 자동 보정했습니다.' : '외곽원 기준으로 중앙/기준선을 추정했습니다. 필요 시 수동 보정하세요.');
  return state.targetCircle;
}

function autoDetectMagnets(){
  if(!state.image){ toast('사진을 먼저 촬영하거나 업로드하세요.'); return; }
  estimateTargetFromImage(); if(!state.center){ toast('중앙점을 먼저 지정하세요.'); return; }
  const maxPts=parseInt($('shotCount').value||'5',10);
  const c=document.createElement('canvas'), ctx=c.getContext('2d'); c.width=state.image.naturalWidth||state.image.width; c.height=state.image.naturalHeight||state.image.height; ctx.drawImage(state.image,0,0,c.width,c.height); const img=ctx.getImageData(0,0,c.width,c.height); const data=img.data;
  const W=c.width,H=c.height, visited=new Uint8Array(W*H); const comps=[]; const searchR=(state.targetRadius||Math.min(W,H)*0.35)*1.45;
  function isColor(x,y){ const k=(y*W+x)*4; const r=data[k],g=data[k+1],b=data[k+2]; const max=Math.max(r,g,b), min=Math.min(r,g,b); const sat=max? (max-min)/max : 0; const bright=max; const d=Math.hypot(x-state.center.x,y-state.center.y); return d<searchR && sat>0.28 && bright>80 && !(r>220&&g>220&&b>220) && !(r<70&&g<70&&b<70); }
  for(let y=2;y<H-2;y+=2){ for(let x=2;x<W-2;x+=2){ const idx=y*W+x; if(visited[idx]||!isColor(x,y)) continue; const stack=[[x,y]]; visited[idx]=1; let n=0,sx=0,sy=0,minX=x,maxX=x,minY=y,maxY=y; while(stack.length){ const [cx,cy]=stack.pop(); n++; sx+=cx; sy+=cy; minX=Math.min(minX,cx); maxX=Math.max(maxX,cx); minY=Math.min(minY,cy); maxY=Math.max(maxY,cy); for(const [dx,dy] of [[2,0],[-2,0],[0,2],[0,-2]]){ const nx=cx+dx, ny=cy+dy, ni=ny*W+nx; if(nx<2||ny<2||nx>=W-2||ny>=H-2||visited[ni]) continue; visited[ni]=1; if(isColor(nx,ny)) stack.push([nx,ny]); } }
      const bw=maxX-minX, bh=maxY-minY; if(n>18 && bw>8 && bh>8 && bw<180 && bh<180){ comps.push({x:sx/n,y:sy/n,n,w:bw,h:bh,area:bw*bh}); }
  }}
  comps.sort((a,b)=>b.n-a.n); const merged=[];
  for(const comp of comps){ const close=merged.find(m=>Math.hypot(m.x-comp.x,m.y-comp.y)<70); if(close){ const total=close.n+comp.n; close.x=(close.x*close.n+comp.x*comp.n)/total; close.y=(close.y*close.n+comp.y*comp.n)/total; close.n=total; } else merged.push({...comp}); }
  const pts=merged.sort((a,b)=>b.n-a.n).slice(0,maxPts).map(p=>normalizePoint({x:p.x,y:p.y,source:'auto'}));
  if(!pts.length){ toast('자동 분석 후보를 찾지 못했습니다. 직접 마킹을 사용하세요.'); return; }
  state.points=pts; setMode('move'); renderCounts(); toast(`자동 분석 후보 ${pts.length}개 표시. 필요 시 이동/삭제/직접 마킹으로 보정하세요.`);
}
function init(){
  load(); syncCalibrationToInputs();
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
  $('shootType').addEventListener('change',()=>{ drawCanvas(); toast(`${currentType()} 명중 기준으로 전환`); });
  ['ring1Radius','proneRadius','ring3Radius','standingRadius','clickPx'].forEach(id=>$(id)?.addEventListener('change',()=>{syncCalibrationFromInputs(); save(); drawCanvas();}));
  function loadPhotoFile(file){
    if(!file) return; const reader=new FileReader();
    reader.onload=()=>{ const img=new Image(); img.onload=()=>{ state.image=img; state.imageName=file.name || '촬영 사진'; state.points=[]; state.center=null; state.targetRadius=null; state.targetCircle=null; $('emptyCanvas').style.display='none'; setMode('center'); drawCanvas(); renderCounts(); toast('사진 불러오기 완료. 먼저 중앙을 지정하거나 자동 분석을 누르세요.'); }; img.src=reader.result; };
    reader.readAsDataURL(file);
  }
  $('cameraInput')?.addEventListener('change',e=>loadPhotoFile(e.target.files[0]));
  $('albumInput')?.addEventListener('change',e=>loadPhotoFile(e.target.files[0]));
  $('shotCanvas').addEventListener('mousedown',handleCanvasDown); $('shotCanvas').addEventListener('mousemove',handleCanvasMove); window.addEventListener('mouseup',handleCanvasUp);
  $('shotCanvas').addEventListener('touchstart',handleCanvasDown,{passive:false}); $('shotCanvas').addEventListener('touchmove',handleCanvasMove,{passive:false}); $('shotCanvas').addEventListener('touchend',handleCanvasUp);
  $('addPointModeBtn').addEventListener('click',()=>setMode('add')); $('movePointModeBtn').addEventListener('click',()=>setMode('move')); $('deletePointModeBtn').addEventListener('click',()=>setMode('del')); $('centerModeBtn').addEventListener('click',()=>setMode('center')); $('ring1ModeBtn').addEventListener('click',()=>setMode('ring1')); $('proneLineModeBtn').addEventListener('click',()=>setMode('proneLine')); $('ring3ModeBtn').addEventListener('click',()=>setMode('ring3')); $('standingLineModeBtn').addEventListener('click',()=>setMode('standingLine')); $('toggleHitModeBtn').addEventListener('click',()=>setMode('toggleHit'));
  $('autoDetectBtn').addEventListener('click',autoDetectMagnets); $('autoBoardBtn')?.addEventListener('click',()=>{ if(!state.image){ toast('사진을 먼저 불러오세요.'); return; } estimateTargetFromImage(); }); $('templateBoardBtn')?.addEventListener('click',createTemplateBoard); $('directBoardBtn')?.addEventListener('click',createTemplateBoard); $('focusModeBtn').addEventListener('click',toggleFocus); $('fillModeBtn').addEventListener('click',toggleFill); $('applyCalibrationBtn').addEventListener('click',()=>{syncCalibrationFromInputs(); save(); drawCanvas(); toast('판정 기준을 다시 반영했습니다.');});
  $('resetAnalysisBtn').addEventListener('click',resetAnalysis); $('saveAnalysisBtn').addEventListener('click',saveAnalysis); $('goReportsBtn').addEventListener('click',()=>go('reports'));
  $('printReportBtn').addEventListener('click',()=>window.print()); $('shareImageBtn').addEventListener('click',shareReportImage); $('closeReportBtn').addEventListener('click',()=>{ $('reportPaper').hidden=true; document.body.classList.remove('report-open'); });
  ['reportToHomeBtn','reportToHomeBtnTop','reportToHomeBtnBottom'].forEach(id=>$(id)?.addEventListener('click',()=>go('home')));
  ['reportToAnalysisBtn','reportToAnalysisBtnTop','reportToAnalysisBtnBottom'].forEach(id=>$(id)?.addEventListener('click',()=>go('analysis')));
  $('exportDataBtn').addEventListener('click',exportData);
  $('saveSettingsBtn').addEventListener('click',()=>{ state.store.settings.aiEndpoint=$('aiEndpoint').value.trim(); save(); toast('설정이 저장되었습니다.'); });
  $('checkOfflineBtn').addEventListener('click',()=>{ $('offlineDetail').textContent = navigator.serviceWorker ? 'Service Worker 지원: 가능. 홈 화면에 추가 후 오프라인 실행을 테스트하세요.' : '이 브라우저는 오프라인 앱 기능을 지원하지 않습니다.'; });
  $('clearDataBtn').addEventListener('click',()=>{ if(confirm('기기 저장 데이터를 모두 삭제할까요?')){ localStorage.removeItem(KEY); location.reload(); }});
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('./service-worker.js').catch(()=>{}); }
  setMode('add'); renderAll();
}
init();
