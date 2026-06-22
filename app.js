const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const S={view:'home',mode:'center',img:null,imgName:'',center:null,rProne:null,rStanding:null,points:[],results:JSON.parse(localStorage.bfcResults||'[]'),players:JSON.parse(localStorage.bfcPlayers||'[]'),fit:false,direct:false,board:null,boardSource:null,autoAssistUsed:false,coachEdited:false};
const cv=$('#canvas'),ctx=cv.getContext('2d');let deferredPrompt=null,dragIdx=-1;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').style.display='inline-flex'});$('#installBtn').onclick=()=>deferredPrompt?.prompt();
function go(v){S.view=v;$$('.view').forEach(x=>x.classList.toggle('active',x.id===v));$$('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.go===v));if(v==='results')renderResults();if(v==='players')renderPlayers();draw();}
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
function updateCounts(){let n=new Set(S.results.map(r=>r.athlete)).size;$('#countState').textContent=`${n}명 / ${S.results.length}건`;$('#onlineState').textContent=navigator.onLine?'온라인 / 오프라인 준비':'오프라인 실행 중'};window.addEventListener('online',updateCounts);window.addEventListener('offline',updateCounts);updateCounts();
$$('.tool[data-mode]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.mode;$$('.tool[data-mode]').forEach(t=>t.classList.toggle('active',t===b));if(typeof setFitControls==='function')setFitControls();});
$('#fitBtn').onclick=()=>{$('#stage').classList.toggle('fill');S.fit=!S.fit;draw();};
$('#cameraInput').onchange=e=>loadFile(e.target.files[0]);$('#albumInput').onchange=e=>loadFile(e.target.files[0]);
function loadFile(file){if(!file)return;const r=new FileReader();r.onload=()=>{let im=new Image();im.onload=()=>{S.img=im;S.imgName=file.name;S.direct=false;S.center=null;S.rProne=null;S.rStanding=null;S.points=[];S.board=null;S.boardSource=null;S.coachEdited=false;S.autoAssistUsed=false;fallbackDetectBoard(im);if(S.board){S.boardSource='fallback';S.autoAssistUsed=true;}setMode('center');setFitControls();draw();};im.src=r.result};r.readAsDataURL(file)}
function setMode(m){S.mode=m;$$('.tool[data-mode]').forEach(t=>t.classList.toggle('active',t.dataset.mode===m));setFitControls();}
$('#directBoardBtn').onclick=()=>{go('analysis');S.img=null;S.direct=true;S.center=null;S.rProne=null;S.rStanding=null;S.points=[];S.board=null;S.boardSource=null;S.coachEdited=false;S.autoAssistUsed=false;setMode('mark');draw();};

// === v1.2 Cost-Free Auto Board · 무료 자동 보조 ===
// 외부 API/클라우드 없이 순수 JS로 보드판 '가이드 후보'만 표시한다.
// 가짜 탄착점을 만들지 않는다. 탄착점은 지도자가 직접 마킹한다.
function runAutoAssist(){
  if(!S.img){alert('먼저 사진을 업로드하세요.');return;}
  fallbackDetectBoard(S.img);
  if(S.board){S.boardSource='fallback';S.autoAssistUsed=true;}
  else alert('보드판 후보를 찾지 못했습니다. 보드 맞춤 보정 또는 기준선 보정으로 직접 지정하세요.');
  draw();
}
$('#autoAssistBtn').onclick=runAutoAssist;
// 보드 맞춤 보정 컨트롤(◎ 모드)에서만 표시
function setFitControls(){const el=$('#boardFitControls');if(!el)return;el.style.display=(S.mode==='boardFit'&&S.img)?'flex':'none';}
function setupCanvas(){const st=$('#stage');const rect=st.getBoundingClientRect();const dpr=window.devicePixelRatio||1;cv.width=rect.width*dpr;cv.height=rect.height*dpr;cv.style.width=rect.width+'px';cv.style.height=rect.height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);}
window.addEventListener('resize',draw);
// === 좌표계 통일 ===
// 모든 분석 좌표(S.points / S.center / S.rProne / S.rStanding / S.board)는 '콘텐츠 좌표'로 저장한다.
//  - 사진 분석: 원본 이미지 픽셀 좌표
//  - 보드판 직접 마킹: 논리 정사각 공간(DIRECT_SIZE) 좌표 (화면 크기와 무관)
// 화면(CSS px)에 그릴 때만 imageToScreen으로 변환하므로 회전/화면 채움/리사이즈에도 어긋나지 않는다.
const DIRECT_SIZE=1000;
function contentSize(){return S.img?{w:S.img.width,h:S.img.height}:{w:DIRECT_SIZE,h:DIRECT_SIZE};}
// 콘텐츠→화면 변환 파라미터. 사진(가로세로비 유지)·직접(정사각) 모두 단일 배율 s를 써서 왜곡이 없다.
function viewTransform(){const w=cv.clientWidth,h=cv.clientHeight;if(S.img){let ar=S.img.width/S.img.height,rw=w,rh=w/ar;if(rh>h){rh=h;rw=h*ar;}return{ox:(w-rw)/2,oy:(h-rh)/2,s:rw/S.img.width};}const size=Math.min(w,h)*0.92;return{ox:(w-size)/2,oy:(h-size)/2,s:size/DIRECT_SIZE};}
function imageToScreen(x,y){const t=viewTransform();return{x:t.ox+x*t.s,y:t.oy+y*t.s};}
function screenToImage(x,y){const t=viewTransform();return{x:(x-t.ox)/t.s,y:(y-t.oy)/t.s};}
function imageRadiusToScreen(r){return r*viewTransform().s;}
function screenRadiusToImage(r){return r/viewTransform().s;}
// 사진을 그릴 화면 사각형
function imgRect(){const t=viewTransform(),cs=contentSize();return{x:t.ox,y:t.oy,w:cs.w*t.s,h:cs.h*t.s};}
// 표준 보드판(직접 마킹) — 콘텐츠 좌표 기준
function defaultBoard(){const cs=contentSize();const cx=cs.w/2,cy=cs.h/2,outer=Math.min(cs.w,cs.h)*0.40;return{cx,cy,r1:outer*.28,rProne:outer*.50,r3:outer*.72,rStanding:outer};}
// 자동 보조 S.board(타원)를 원형 초안 기준값으로 동기화한다. needsReview는 별도로 유지.
function syncBoardToBaseline(){if(!S.board)return;S.center={x:S.board.cx,y:S.board.cy};S.rStanding=(S.board.rx+S.board.ry)/2;S.rProne=S.rStanding*S.board.rProneNorm;}
// === v1.2 Auto Board · Phase 1-1(하이브리드 재설계): 검은 표적판 타원 자동 캘리브레이션 ===
// 1차로 가장 큰 검은 연결영역의 bbox로 안정적인 타원을 만들고(주 경로),
// ray-matching 결과는 bbox와 충분히 일치할 때만 보조 보정에 사용한다.
// 결과는 원본 이미지 픽셀 좌표계로 S.board에 저장한다. 실패 시 S.board=null.
//
// S.board = { cx, cy, rx, ry, rotation, rStandingNorm:1.0, rProneNorm, confidence }

// Otsu 임계값: 히스토그램 분산 최대화로 어두운(검은 표적)/밝은(흰·파랑 배경) 경계를 자동 결정.
// 파란 배경/흰 배경 모두 적응적으로 검은 원을 분리하기 위함.
function otsuThreshold(lum,N){
  const hist=new Float64Array(256);
  for(let i=0;i<N;i++){let v=lum[i]|0;if(v<0)v=0;else if(v>255)v=255;hist[v]++;}
  let sumAll=0;for(let t=0;t<256;t++)sumAll+=t*hist[t];
  let wB=0,sumB=0,maxVar=-1,thr=127;
  for(let t=0;t<256;t++){
    wB+=hist[t];if(wB===0)continue;const wF=N-wB;if(wF===0)break;
    sumB+=t*hist[t];const mB=sumB/wB,mF=(sumAll-sumB)/wF;
    const v=wB*wF*(mB-mF)*(mB-mF);
    if(v>maxVar){maxVar=v;thr=t;}
  }
  return thr;
}

// 모든 dark 연결영역을 수집(글자/로고/클립 같은 미세 잡음은 minCount로 제거).
function darkComponents(dark,w,h,N,minCount){
  const visited=new Uint8Array(N),stack=new Int32Array(N);const comps=[];
  for(let start=0;start<N;start++){
    if(!dark[start]||visited[start])continue;
    let sp=0;stack[sp++]=start;visited[start]=1;
    let count=0,sx=0,sy=0,minx=w,maxx=0,miny=h,maxy=0;
    while(sp>0){
      const idx=stack[--sp];const x=idx%w,y=(idx/w)|0;
      count++;sx+=x;sy+=y;
      if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;
      if(x>0){const n=idx-1;if(dark[n]&&!visited[n]){visited[n]=1;stack[sp++]=n;}}
      if(x<w-1){const n=idx+1;if(dark[n]&&!visited[n]){visited[n]=1;stack[sp++]=n;}}
      if(y>0){const n=idx-w;if(dark[n]&&!visited[n]){visited[n]=1;stack[sp++]=n;}}
      if(y<h-1){const n=idx+w;if(dark[n]&&!visited[n]){visited[n]=1;stack[sp++]=n;}}
    }
    if(count>=minCount)comps.push({count,cx:sx/count,cy:sy/count,minx,maxx,miny,maxy});
  }
  return comps;
}

// 두 bbox 사이의 빈틈(겹치면 0).
function bboxGap(a,b){
  const sx=Math.max(0,Math.max(a.minx,b.minx)-Math.min(a.maxx,b.maxx));
  const sy=Math.max(0,Math.max(a.miny,b.miny)-Math.min(a.maxy,b.maxy));
  return Math.hypot(sx,sy);
}

// 검은 표적판은 흰 선/점선/반사/자석 때문에 여러 dark 조각으로 갈라진다.
// 중앙 근처의 가장 큰 조각을 앵커로 잡고, 가까운 조각들을 병합해 표적판 전체 bbox를 복원한다.
function mergeTargetBox(comps,w,h){
  if(!comps.length)return null;
  const icx=w/2,icy=h/2,short=Math.min(w,h),diag=Math.hypot(w,h);
  // 앵커: 면적 × 중앙근접성 최대. 너무 가장자리(중앙에서 0.45*short 초과)면 앵커 제외.
  let anchor=null,aScore=-1;
  comps.forEach(c=>{
    const dc=Math.hypot(c.cx-icx,c.cy-icy);
    if(dc>0.45*short)return;
    const central=1-Math.min(1,dc/(diag/2));
    const sc=c.count*(0.5+0.5*central);
    if(sc>aScore){aScore=sc;anchor=c;}
  });
  if(!anchor)anchor=comps.reduce((p,c)=>c.count>p.count?c:p,comps[0]);
  const merge=(gapTol,centralLimit)=>{
    const box={minx:anchor.minx,maxx:anchor.maxx,miny:anchor.miny,maxy:anchor.maxy};
    const used=new Set([anchor]);let changed=true,n=1;
    while(changed){changed=false;
      for(const c of comps){
        if(used.has(c))continue;
        const cx=(box.minx+box.maxx)/2,cy=(box.miny+box.maxy)/2;
        const central=Math.hypot(c.cx-cx,c.cy-cy)<centralLimit*short;
        const big=c.count/(w*h)>0.02;
        if(bboxGap(box,c)<=gapTol*short&&(central||big)){
          box.minx=Math.min(box.minx,c.minx);box.maxx=Math.max(box.maxx,c.maxx);
          box.miny=Math.min(box.miny,c.miny);box.maxy=Math.max(box.maxy,c.maxy);
          used.add(c);changed=true;n++;
        }
      }
    }
    return {box,n};
  };
  let {box,n}=merge(0.05,0.42);
  let bw=box.maxx-box.minx+1,bh=box.maxy-box.miny+1;
  // bbox가 너무 작으면(내부 조각만 잡음) 더 넓은 빈틈/중앙범위로 재병합
  if(Math.min(bw,bh)<0.25*short){
    const r2=merge(0.14,0.40);box=r2.box;n=r2.n;
    bw=box.maxx-box.minx+1;bh=box.maxy-box.miny+1;
  }
  return {minx:box.minx,maxx:box.maxx,miny:box.miny,maxy:box.maxy,bw,bh,n};
}

// ray-matching: bbox 중심에서 바깥→안쪽으로 레이를 쏴 '연속된 검은 픽셀'이 시작되는 외곽선을 찾는다.
// 안쪽 흰 점선/실선 링은 외곽선보다 안쪽이라 자동 무시된다. 결과는 보조 보정용.
function rayEllipse(L,cx0,cy0,w,h,thr){
  const rays=240,capR=Math.min(w,h)*0.62,K=3;const pts=[];
  for(let k=0;k<rays;k++){
    const a=k/rays*Math.PI*2,dx=Math.cos(a),dy=Math.sin(a);
    let edge=-1,run=0;
    for(let r=capR;r>=4;r--){
      const x=cx0+dx*r,y=cy0+dy*r;
      if(x<0||y<0||x>=w||y>=h){run=0;continue;}
      if(L(x,y)<thr){run++;if(run>=K){edge=r+(K-1);break;}}else run=0;
    }
    if(edge>0)pts.push({x:cx0+dx*edge,y:cy0+dy*edge,r:edge});
  }
  if(pts.length<rays*0.4)return null;
  // 반경 이상치 제거(손가락/그림자/자석으로 인한 잘못된 외곽점)
  const rs=pts.map(p=>p.r).sort((a,b)=>a-b);const med=rs[rs.length>>1]||1;
  const good=pts.filter(p=>p.r>med*0.6&&p.r<med*1.5);
  if(good.length<rays*0.35)return null;
  let mx=0,my=0;good.forEach(p=>{mx+=p.x;my+=p.y});const cx=mx/good.length,cy=my/good.length;
  let sxx=0,syy=0,sxy=0;good.forEach(p=>{const ux=p.x-cx,uy=p.y-cy;sxx+=ux*ux;syy+=uy*uy;sxy+=ux*uy;});
  sxx/=good.length;syy/=good.length;sxy/=good.length;
  const rotation=0.5*Math.atan2(2*sxy,sxx-syy);
  const ca=Math.cos(rotation),sa=Math.sin(rotation);
  const uA=[],uB=[];good.forEach(p=>{const ux=p.x-cx,uy=p.y-cy;uA.push(Math.abs(ux*ca+uy*sa));uB.push(Math.abs(-ux*sa+uy*ca));});
  uA.sort((a,b)=>a-b);uB.sort((a,b)=>a-b);
  const pct=arr=>arr[Math.min(arr.length-1,Math.floor(arr.length*0.93))]||1;
  const rx=pct(uA),ry=pct(uB);
  const found=good.length/rays;let resid=0;
  good.forEach(p=>{const ux=p.x-cx,uy=p.y-cy;const u=ux*ca+uy*sa,v=-ux*sa+uy*ca;resid+=Math.abs(Math.hypot(u/rx,v/ry)-1);});
  resid/=good.length;
  const confidence=Math.max(0,Math.min(1,found*(1-Math.min(1,resid))));
  return {cx,cy,rx,ry,rotation,found,confidence};
}

// === 동심원 구조 검증 ===
// 후보 (중심,반경)에서 정규화 반경 rn=0..1.2 의 평균 밝기 프로파일을 계산한다.
function radialProfile(L,w,h,cx,cy,rx,ry,rot,K,A){
  const ca=Math.cos(rot),sa=Math.sin(rot);const prof=new Float32Array(K);
  for(let i=0;i<K;i++){
    const rn=i/(K-1)*1.2;let s=0,n=0;
    for(let a=0;a<A;a++){
      const ang=a/A*Math.PI*2,ex=Math.cos(ang)*rx*rn,ey=Math.sin(ang)*ry*rn;
      const x=cx+ex*ca-ey*sa,y=cy+ex*sa+ey*ca;
      if(x<0||y<0||x>=w||y>=h)continue;s+=L(x,y);n++;
    }
    prof[i]=n?s/n:NaN;
  }
  return prof;
}
// 보드판 구조 점수: 외곽 전이, 내부 어두움, r≈0.5 굵은 실선, r≈0.3/0.75 점선 흔적.
function profileScore(prof,K){
  const at=rn=>{const i=Math.max(0,Math.min(K-1,Math.round(rn/1.2*(K-1))));return prof[i];};
  const rmean=(a,b)=>{let s=0,n=0;for(let rn=a;rn<=b+1e-9;rn+=0.025){const v=at(rn);if(!isNaN(v)){s+=v;n++;}}return n?s/n:0;};
  const rmax=(a,b)=>{let m=-1e9;for(let rn=a;rn<=b+1e-9;rn+=0.025){const v=at(rn);if(!isNaN(v)&&v>m)m=v;}return m;};
  const bg=rmean(1.05,1.2),inEdge=rmean(0.85,0.98),interior=rmean(0.1,0.9);
  const edge=bg-inEdge;                         // 외곽선 바깥(배경)이 안쪽보다 밝아야
  const interiorDark=bg-interior;               // 내부 표적판이 배경보다 어두워야
  const prone=rmax(0.44,0.58)-(rmean(0.35,0.42)+rmean(0.60,0.68))/2; // r≈0.5 굵은 실선 돌출
  const innerDot=rmax(0.27,0.34)-(rmean(0.18,0.26)+rmean(0.36,0.42))/2; // r≈0.3 안쪽 점선
  const outerDot=rmax(0.70,0.80)-(rmean(0.60,0.68)+rmean(0.84,0.92))/2; // r≈0.75 바깥 점선
  const cp=v=>Math.max(0,v);
  const total=1.2*cp(edge)+1.0*cp(interiorDark)+1.1*cp(prone)+0.4*cp(innerDot)+0.4*cp(outerDot);
  return {total,edge,interiorDark,prone,innerDot,outerDot,bg,interior};
}
// 중심 가로/세로 점선 교차 흔적: 축 방향이 대각선 방향보다 밝으면 +.
function crossScore(L,w,h,cx,cy,rx,ry,rot){
  const ca=Math.cos(rot),sa=Math.sin(rot);let ax=0,an=0,dg=0,dn=0;
  const sample=(ang,rn)=>{const ex=Math.cos(ang)*rx*rn,ey=Math.sin(ang)*ry*rn;const x=cx+ex*ca-ey*sa,y=cy+ex*sa+ey*ca;if(x<0||y<0||x>=w||y>=h)return null;return L(x,y);};
  for(let rn=0.04;rn<=0.26;rn+=0.02){
    [0,Math.PI/2,Math.PI,3*Math.PI/2].forEach(a=>{const v=sample(a,rn);if(v!=null){ax+=v;an++;}});
    [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4].forEach(a=>{const v=sample(a,rn);if(v!=null){dg+=v;dn++;}});
  }
  return (an&&dn)?(ax/an-dg/dn):0;
}
// 외곽 경계 대비: 타원 안쪽 띠(rn 0.88~0.97)는 어둡고 바깥 띠(rn 1.04~1.14)는 밝아야 함.
// contrast(바깥-안쪽)가 클수록 검은 원과 배경의 실제 외곽선에 가깝다.
function boundaryContrast(L,w,h,cx,cy,rx,ry,rot){
  const ca=Math.cos(rot),sa=Math.sin(rot),A=96;let inn=0,inN=0,out=0,outN=0;
  for(let a=0;a<A;a++){
    const ang=a/A*Math.PI*2,c=Math.cos(ang),s=Math.sin(ang);
    for(let rn=0.88;rn<=0.971;rn+=0.03){const ex=c*rx*rn,ey=s*ry*rn,x=cx+ex*ca-ey*sa,y=cy+ex*sa+ey*ca;if(x>=0&&y>=0&&x<w&&y<h){inn+=L(x,y);inN++;}}
    for(let rn=1.04;rn<=1.141;rn+=0.03){const ex=c*rx*rn,ey=s*ry*rn,x=cx+ex*ca-ey*sa,y=cy+ex*sa+ey*ca;if(x>=0&&y>=0&&x<w&&y<h){out+=L(x,y);outN++;}}
  }
  const inner=inN?inn/inN:0,outer=outN?out/outN:0;
  return {inner,outer,contrast:outer-inner};
}
// 중심 교차 검증(보조): 검은 원 안쪽의 밝은 가로/세로 점선 위치를 찾아 축 프레임 오프셋을 돌려준다.
// 자석/반사로 불안정하면 prom이 낮아 채택되지 않는다. 중심을 크게 이동시키지 않도록 호출부에서 5% 제한.
function findCenterCross(L,w,h,cx,cy,rx,ry,rot){
  const ca=Math.cos(rot),sa=Math.sin(rot);
  const at=(un,vn)=>{const ex=un*rx,ey=vn*ry,x=cx+ex*ca-ey*sa,y=cy+ex*sa+ey*ca;if(x<0||y<0||x>=w||y>=h)return NaN;return L(x,y);};
  let bestU=0,bU=-1e9,baseU=0,bnU=0;
  for(let u=-0.3;u<=0.3001;u+=0.02){let s=0,n=0;for(let v=-0.6;v<=0.6001;v+=0.05){const g=at(u,v);if(!isNaN(g)){s+=g;n++;}}const m=n?s/n:-1e9;baseU+=m;bnU++;if(m>bU){bU=m;bestU=u;}}
  baseU/=bnU;
  let bestV=0,bV=-1e9,baseV=0,bnV=0;
  for(let v=-0.3;v<=0.3001;v+=0.02){let s=0,n=0;for(let u=-0.6;u<=0.6001;u+=0.05){const g=at(u,v);if(!isNaN(g)){s+=g;n++;}}const m=n?s/n:-1e9;baseV+=m;bnV++;if(m>bV){bV=m;bestV=v;}}
  baseV/=bnV;
  return {offU:bestU*rx,offV:bestV*ry,prom:Math.min(bU-baseU,bV-baseV)};
}

// 순수 JS 무료 자동 보조 검출. 보드판 가이드 후보만 추정하며, 결과는 '자동 보조 후보(확인 필요)'로 표시한다.
function fallbackDetectBoard(img){
  try{
    const maxDim=420;
    const scale=Math.min(1,maxDim/Math.max(img.width,img.height));
    const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
    const oc=document.createElement('canvas');oc.width=w;oc.height=h;
    const octx=oc.getContext('2d',{willReadFrequently:true});octx.drawImage(img,0,0,w,h);
    const px=octx.getImageData(0,0,w,h).data;const N=w*h;
    const lum=new Float32Array(N);let sum=0;
    for(let i=0;i<N;i++){const Lp=0.299*px[i*4]+0.587*px[i*4+1]+0.114*px[i*4+2];lum[i]=Lp;sum+=Lp;}
    const mean=sum/N;
    const short=Math.min(w,h);
    const L=(x,y)=>lum[(y|0)*w+(x|0)];
    // 적응형 임계값(Otsu/mean 절충) — 시드 중심 산출용 dark 마스크.
    const otsu=otsuThreshold(lum,N);
    const thr=Math.min(135,Math.max(45,Math.min(otsu,mean*0.85)));
    const dark=new Uint8Array(N);for(let i=0;i<N;i++)dark[i]=lum[i]<thr?1:0;
    // --- 시드 중심 후보들 수집 ---
    const seeds=[{cx:w/2,cy:h/2}]; // 화면 중앙
    let dsx=0,dsy=0,dn=0;for(let i=0;i<N;i++)if(dark[i]){dsx+=i%w;dsy+=(i/w)|0;dn++;}
    if(dn)seeds.push({cx:dsx/dn,cy:dsy/dn}); // dark 무게중심
    const comps=darkComponents(dark,w,h,N,Math.round(N*0.0008));
    const merged=comps.length?mergeTargetBox(comps,w,h):null;
    if(merged)seeds.push({cx:(merged.minx+merged.maxx)/2,cy:(merged.miny+merged.maxy)/2}); // 병합 bbox 중심
    // --- 후보 (중심,반경) 탐색: 각 시드 주변 격자 × 반경 스윕, 동심원 구조 점수 최대화 ---
    const K=41,A=64,Rmin=0.16*short,Rmax=0.48*short,Rstep=Math.max(2,0.02*short);
    let bestC=null,candCount=0;
    for(const sd of seeds){
      for(let oy=-3;oy<=3;oy++)for(let ox=-3;ox<=3;ox++){
        const cx=sd.cx+ox*0.04*short,cy=sd.cy+oy*0.04*short;
        if(cx<0||cy<0||cx>=w||cy>=h)continue;
        for(let R=Rmin;R<=Rmax;R+=Rstep){
          candCount++;
          const prof=radialProfile(L,w,h,cx,cy,R,R,0,K,A);
          const sc=profileScore(prof,K);
          const cross=crossScore(L,w,h,cx,cy,R,R,0);
          const central=1-Math.min(1,Math.hypot(cx-w/2,cy-h/2)/(short*0.6));
          const total=sc.total+0.5*Math.max(0,cross)+8*central;
          if(!bestC||total>bestC.total)bestC={total,cx,cy,R,sc,cross};
        }
      }
    }
    if(!bestC){S.board=null;console.log('[board] no board: no candidate',{seeds:seeds.length,thr:Math.round(thr)});return;}
    // 구조가 전혀 보드판답지 않으면 no board (외곽 전이/내부 어두움 모두 약함)
    if(bestC.sc.edge<6&&bestC.sc.interiorDark<6){S.board=null;console.log('[board] no board: weak structure',{score:Number(bestC.total.toFixed(1)),edge:Number(bestC.sc.edge.toFixed(1)),interiorDark:Number(bestC.sc.interiorDark.toFixed(1)),thr:Math.round(thr)});return;}
    // --- 외곽 경계 정밀 보정(최우선 기준): 안쪽 어둡고 바깥 밝은 대비가 최대가 되는 (중심,반경)으로 스냅 ---
    // 자석/반사/손가락은 검은 원 '내부'에 있어 외곽 경계에 영향을 주지 않으므로 중심이 자석으로 끌리지 않는다.
    let rc={cx:bestC.cx,cy:bestC.cy,R:bestC.R,con:-1e9};
    for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
      const ccx=bestC.cx+ox*0.02*short,ccy=bestC.cy+oy*0.02*short;
      if(ccx<0||ccy<0||ccx>=w||ccy>=h)continue;
      for(let R=bestC.R*0.8;R<=bestC.R*1.221;R+=Math.max(1,0.008*short)){
        const con=boundaryContrast(L,w,h,ccx,ccy,R,R,0).contrast;
        if(con>rc.con)rc={cx:ccx,cy:ccy,R,con};
      }
    }
    let cx=rc.cx,cy=rc.cy,rx=rc.R,ry=rc.R,rotation=0,method='concentric-boundary';
    // --- 타원/회전 보정: ray로 외곽선을 잡아 기울기·장단축만 반영(중심은 경계기반 rc 유지) ---
    const ray=rayEllipse(L,cx,cy,w,h,thr);
    if(ray){
      const rxOk=ray.rx>rc.R*0.82&&ray.rx<rc.R*1.2;
      const ryOk=ray.ry>rc.R*0.82&&ray.ry<rc.R*1.2;
      const centerOk=Math.hypot(ray.cx-cx,ray.cy-cy)<rc.R*0.12;
      if(ray.found>=0.5&&ray.confidence>=0.4&&centerOk&&rxOk&&ryOk){
        method='concentric-boundary+ellipse';
        rx=0.5*rc.R+0.5*ray.rx;ry=0.5*rc.R+0.5*ray.ry;
        rotation=ray.rotation; // 회전 사진 대응. 중심은 rc 유지.
      }
    }
    // --- 중앙점: 타원 중심이 기본값. 가로/세로 점선 교차는 5% 이내일 때만 보조 적용 ---
    let centerSource='ellipse';
    const rStandingPx=Math.max(rx,ry);
    const cc=findCenterCross(L,w,h,cx,cy,rx,ry,rotation);
    if(cc.prom>=20&&Math.hypot(cc.offU,cc.offV)<=0.05*rStandingPx){
      const crot=Math.cos(rotation),srot=Math.sin(rotation);
      cx=cx+cc.offU*crot-cc.offV*srot;cy=cy+cc.offU*srot+cc.offV*crot;
      centerSource='cross-check';
    }
    // --- 복사 기준선: 0.44~0.58 구간 가장 강한 밝은 링(두 번째 굵은 실선). 불안정하면 0.50 ---
    const fineProf=radialProfile(L,w,h,cx,cy,rx,ry,rotation,K,96);
    let rProneNorm=0.50,bestB=-1,peakS=0.50;
    for(let s=0.44;s<=0.581;s+=0.01){
      const i=Math.round(s/1.2*(K-1)),v=fineProf[i];
      if(!isNaN(v)&&v>bestB){bestB=v;peakS=Number(s.toFixed(2));}
    }
    const proneBase=(fineProf[Math.round(0.38/1.2*(K-1))]+fineProf[Math.round(0.64/1.2*(K-1))])/2;
    if(bestB-proneBase>=12&&peakS>=0.44&&peakS<=0.58)rProneNorm=peakS; // 뚜렷한 돌출일 때만 채택. 0.30 점선 제외.
    const proneSource=(rProneNorm===0.50)?'standard(temp)':'auto-peak';
    // confidence: 구조 점수 + 외곽 경계 대비를 결합
    const conf=Math.max(0,Math.min(1,0.6*(bestC.total/120)+0.4*Math.min(1,Math.max(0,rc.con)/80)));
    const inv=1/scale;
    S.board={cx:cx*inv,cy:cy*inv,rx:rx*inv,ry:ry*inv,rotation,rStandingNorm:1.0,rProneNorm,proneSource,centerSource,method:'auto-assist',confidence:Number(conf.toFixed(2)),needsReview:true};
    syncBoardToBaseline();
    console.log('[board] ellipse detected',{method,candidates:candCount,score:Number(bestC.total.toFixed(1)),outerBoundaryScore:Number(rc.con.toFixed(1)),proneRingScore:Number(bestC.sc.prone.toFixed(1)),outerDottedScore:Number(bestC.sc.outerDot.toFixed(1)),innerDottedScore:Number(bestC.sc.innerDot.toFixed(1)),interiorDark:Number(bestC.sc.interiorDark.toFixed(1)),centerSource,crossProm:Number(cc.prom.toFixed(1)),cx:Math.round(S.board.cx),cy:Math.round(S.board.cy),rx:Math.round(S.board.rx),ry:Math.round(S.board.ry),rotationDeg:Number((rotation*180/Math.PI).toFixed(1)),rProneNorm,proneSource,confidence:S.board.confidence,thr:Math.round(thr)});
  }catch(err){S.board=null;console.log('[board] detection error',err);}
}

// 타원 기반 가이드. 사진 표시 크기가 바뀌어도 imgRect 비율로 환산해 사진에 정확히 붙는다.
// 입사(외곽, 얇은 청록), 복사(두 번째 실선, 흰색 보조선), 중앙 십자만 그린다. 추가 외곽선 없음.
function drawBoardGuide(){
  if(!S.board||!S.img)return;
  const b=S.board,t=viewTransform(),c=imageToScreen(b.cx,b.cy);
  const cx=c.x,cy=c.y,rx=b.rx*t.s,ry=b.ry*t.s,rot=b.rotation,r=imgRect();
  ctx.save();
  ctx.setLineDash([]);
  // 복사 기준선: 두 번째 굵은 실선 타원(밝은 청록) — 항상 표시
  ctx.strokeStyle='rgba(25,229,239,.95)';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.ellipse(cx,cy,rx*b.rProneNorm,ry*b.rProneNorm,rot,0,Math.PI*2);ctx.stroke();
  // 입사 기준선: 검은 원 외곽 타원(얇은 청록)
  ctx.strokeStyle='rgba(24,220,232,.95)';ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(cx,cy,rx*b.rStandingNorm,ry*b.rStandingNorm,rot,0,Math.PI*2);ctx.stroke();
  // 중앙 후보: 타원 중심의 작은 십자
  ctx.strokeStyle='rgba(24,220,232,.95)';ctx.lineWidth=1.5;
  line(cx-10,cy,cx+10,cy);line(cx,cy-10,cx,cy+10);
  // 디버그용 작은 텍스트(현장 UI 방해 최소화)
  ctx.font='11px system-ui';ctx.textAlign='left';
  const tag=b.needsReview?'자동 보조 후보(확인 필요)':'지도자 확인됨';
  ctx.fillStyle=b.needsReview?'rgba(255,196,60,.95)':'rgba(24,220,232,.9)';
  ctx.fillText(`${tag} · ${b.method} · conf ${b.confidence} · 복사 ${Number(b.rProneNorm).toFixed(2)}`,r.x+8,r.y+14);
  ctx.restore();
}
function updateState(){
  const cS=$('#centerState'),pS=$('#proneState'),sS=$('#standingState'),ptS=$('#pointsState');
  if(S.board&&S.img){
    if(cS)cS.textContent=S.board.needsReview?'자동 후보(확인 필요)':'지정됨';
    if(pS)pS.textContent='복사 '+Number(S.board.rProneNorm).toFixed(2);
    if(sS)sS.textContent='입사 외곽(자동)';
  }else{
    if(cS)cS.textContent=S.center?'지정됨':'미지정';
    if(pS)pS.textContent=S.rProne?'지정됨':'미지정';
    if(sS)sS.textContent=S.rStanding?'지정됨':'미지정';
  }
  if(ptS)ptS.textContent=`${S.points.length}개`;
}
function draw(){setupCanvas();ctx.clearRect(0,0,cv.clientWidth,cv.clientHeight);if(S.board)syncBoardToBaseline();$('#emptyHint').style.display=(S.img||S.direct)?'none':'block';if(S.img){let r=imgRect();ctx.drawImage(S.img,r.x,r.y,r.w,r.h);}if(S.board)drawBoardGuide();if(S.direct)drawStandardBoard();drawGuides();drawPoints();updateState();}
// 보드판 직접 마킹: 실제 보드판 구조 — 검은 원 + 중앙 가로/세로 점선 + ①점선 ②굵은실선(복사) ③점선 ④외곽(입사).
// 노란 외곽선/빨간 점선/추가 외곽선/홍보 문구 없음.
function drawStandardBoard(){const b=defaultBoard();
  // 지도자가 중앙/기준선을 옮기면 그에 맞춰 표준 보드도 따라간다.
  const cc=S.center||{x:b.cx,y:b.cy},rsI=S.rStanding||b.rStanding,rpI=S.rProne||b.rProne;
  const c=imageToScreen(cc.x,cc.y),cx=c.x,cy=c.y;
  const rs=imageRadiusToScreen(rsI),r1=imageRadiusToScreen(rsI*0.28),r3=imageRadiusToScreen(rsI*0.72),rp=imageRadiusToScreen(rpI);
  ctx.save();
  // 흰 배경판
  ctx.fillStyle='#f4f6f9';roundRect(ctx,cx-rs*1.3,cy-rs*1.45,rs*2.6,rs*2.9,20,true,false);
  // ④ 검은 표적판 원(외곽선 = 입사 기준선)
  ctx.fillStyle='#0f1620';ctx.beginPath();ctx.arc(cx,cy,rs,0,Math.PI*2);ctx.fill();
  // ① 첫 번째 원: 점선, ③ 세 번째 원: 점선
  ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=1.5;ctx.setLineDash([2,6]);circle(cx,cy,r1);circle(cx,cy,r3);
  // 중앙 가로/세로 점선
  ctx.setLineDash([3,5]);line(cx-rs*.9,cy,cx+rs*.9,cy);line(cx,cy-rs*.9,cx,cy+rs*.9);
  // ② 두 번째 원: 굵은 실선(복사 기준선)
  ctx.setLineDash([]);ctx.lineWidth=4;ctx.strokeStyle='rgba(255,255,255,.95)';circle(cx,cy,rp);
  // 중앙 십자(작게)
  ctx.lineWidth=2;line(cx-10,cy,cx+10,cy);line(cx,cy-10,cx,cy+10);
  ctx.restore();
  if(!S.center){S.center={x:b.cx,y:b.cy};S.rProne=b.rProne;S.rStanding=b.rStanding;}}
// 원형(수동/직접) 가이드. 자동 보조 S.board가 있으면 drawBoardGuide가 표시하므로 생략한다.
function drawGuides(){if(S.board)return;const c=S.center;if(!c&&!S.direct)return;const b=defaultBoard();const ccx=c?c.x:b.cx,ccy=c?c.y:b.cy;const sp=imageToScreen(ccx,ccy),cx=sp.x,cy=sp.y;
  const rpI=S.rProne??(S.direct?b.rProne:null),rsI=S.rStanding??(S.direct?b.rStanding:null);
  const rp=rpI!=null?imageRadiusToScreen(rpI):null,rs=rsI!=null?imageRadiusToScreen(rsI):null;
  ctx.save();
  if(c){ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);line(cx-50,cy,cx+50,cy);line(cx,cy-50,cx,cy+50);ctx.setLineDash([]);ctx.lineWidth=2;line(cx-12,cy,cx+12,cy);line(cx,cy-12,cx,cy+12);}
  // 직접 마킹은 표준 보드가 링을 그리므로 원형 가이드는 생략(중심 십자만)
  if(!S.direct){if(rp){ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=4;ctx.setLineDash([]);circle(cx,cy,rp);}if(rs){ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=2;ctx.setLineDash([2,5]);circle(cx,cy,rs);}}
  ctx.restore();}
// 자석 표시: 실제 자석을 큰 색으로 덮지 않는다. 얇은 원 둘레 + 중심 작은 점, 번호는 자석 바깥쪽.
// 좌표는 콘텐츠 좌표 → imageToScreen으로 변환해 그린다(화면 크기/회전과 무관하게 사진에 붙는다).
function drawPoints(){S.points.forEach((p,i)=>{const st=pointStatus(p);const col=st==='hit'?'#19e5ef':st==='miss'?'#ff4964':'#ffc43c';const sp=imageToScreen(p.x,p.y),sx=sp.x,sy=sp.y;const rr=Math.max(8,imageRadiusToScreen(p.r||screenRadiusToImage(14)));const mark=st==='hit'?'':st==='miss'?'×':'?';ctx.save();
  // 얇은 둘레 원(자석 반경)
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.setLineDash(st==='unknown'?[3,4]:[]);ctx.beginPath();ctx.arc(sx,sy,rr,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  // 중심 작은 점 + 십자
  ctx.fillStyle=col;ctx.beginPath();ctx.arc(sx,sy,2.2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=col;ctx.lineWidth=1;line(sx-5,sy,sx+5,sy);line(sx,sy-5,sx,sy+5);
  // 번호는 자석 바깥쪽(우상단), 작은 외곽선 텍스트
  const lx=sx+rr+8,ly=sy-rr-2;ctx.font='bold 13px system-ui';ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.7)';ctx.strokeText(`${i+1}${mark}`,lx,ly);
  ctx.fillStyle=col;ctx.fillText(`${i+1}${mark}`,lx,ly);
  ctx.restore();});}
// 캔버스(화면) 좌표 p → 콘텐츠 좌표
function imgPt(p){return screenToImage(p.x,p.y);}
// S.board가 없을 때 클릭 지점(콘텐츠 좌표) 중심으로 표준 보드 템플릿 생성(수동 템플릿)
function ensureBoard(ip){if(!S.board){const cs=contentSize(),u=Math.min(cs.w,cs.h);S.board={cx:ip.x,cy:ip.y,rx:u*0.30,ry:u*0.30,rotation:0,rStandingNorm:1.0,rProneNorm:0.50,confidence:0,method:'manual-template',needsReview:false};S.boardSource='manual';}}
// 콘텐츠 좌표 화면점 p의 S.board 타원 정규화 거리(외곽선=1.0). 회전 역적용.
function boardNormDist(p){const ip=imgPt(p),dx=ip.x-S.board.cx,dy=ip.y-S.board.cy,rot=S.board.rotation,ca=Math.cos(-rot),sa=Math.sin(-rot);const u=dx*ca-dy*sa,v=dx*sa+dy*ca;return Math.hypot(u/S.board.rx,v/S.board.ry);}
// 판정 상태: 'hit' | 'miss' | 'unknown'. 모든 좌표는 콘텐츠 좌표에서 계산한다.
// 우선순위: 자동 보조 S.board(타원) → 수동/직접(원형 S.center/r). 기준이 없으면 'unknown'(절대 자동 명중 금지).
function pointStatus(p){
  const type=$('#shootType').value;
  if(p.override!==undefined)return p.override?'hit':'miss';
  if(S.board){
    if(type==='zero')return 'hit';
    const base=type==='prone'?S.board.rProneNorm:(S.board.rStandingNorm||1.0);
    const dx=p.x-S.board.cx,dy=p.y-S.board.cy,rot=S.board.rotation,ca=Math.cos(-rot),sa=Math.sin(-rot);
    const u=dx*ca-dy*sa,v=dx*sa+dy*ca;
    const nd=Math.hypot(u/S.board.rx,v/S.board.ry);   // 정규화 거리(외곽선=1.0)
    const magNorm=(p.r||0)/((S.board.rx+S.board.ry)/2); // 자석 반경 정규화
    return (nd-magNorm<=base)?'hit':'miss';            // 선에 걸치면 명중
  }
  // 원형 fallback(수동/직접 마킹)
  if(type==='zero')return S.center?'hit':'unknown';
  const r=type==='prone'?S.rProne:S.rStanding;
  if(!S.center||!r)return 'unknown';                   // 기준 없음 → 판정 전(명중 처리하지 않음)
  const d=Math.hypot(p.x-S.center.x,p.y-S.center.y),allow=p.r||0;
  return (d-allow<=r)?'hit':'miss';
}
function isHit(p){return pointStatus(p)==='hit';} // 호환용 boolean
function clickPos(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left),y:(e.clientY-r.top)}}
let boardDrag=null;
cv.addEventListener('pointerdown',e=>{const p=clickPos(e);const ip=imgPt(p); // ip = 콘텐츠 좌표
  // 기준선 보정: 사진+보드가 있으면 S.board(타원)를 편집, 아니면 원형 S.center/r 편집(직접/수동)
  if(S.mode==='center'){if(S.img){if(!S.board)ensureBoard(ip);else{S.board.cx=ip.x;S.board.cy=ip.y;}S.board.needsReview=false;}else{S.center=ip;}S.coachEdited=true;return draw();}
  if(S.mode==='proneLine'){if(S.img&&S.board){const nd=boardNormDist(p);S.board.rProneNorm=Math.min(0.95,Math.max(0.20,nd));S.board.needsReview=false;}else{if(!S.center)return alert('먼저 중앙을 지정하세요.');S.rProne=Math.hypot(ip.x-S.center.x,ip.y-S.center.y);}S.coachEdited=true;return draw();}
  if(S.mode==='standingLine'){if(S.img&&S.board){const nd=boardNormDist(p);if(nd>0.1){S.board.rx*=nd;S.board.ry*=nd;S.board.needsReview=false;}}else{if(!S.center)return alert('먼저 중앙을 지정하세요.');S.rStanding=Math.hypot(ip.x-S.center.x,ip.y-S.center.y);}S.coachEdited=true;return draw();}
  if(S.mode==='boardFit'){if(S.img){if(!S.board)ensureBoard(ip);boardDrag={px:p.x,py:p.y};S.coachEdited=true;}return;}
  let near=nearest(p);
  if(S.mode==='mark'){let max=Number($('#shotCount').value);if(S.points.length>=max)return alert(`${max}발까지만 입력됩니다.`);S.points.push({x:ip.x,y:ip.y,r:screenRadiusToImage(14)});S.coachEdited=true;return draw();}
  if(S.mode==='move'){dragIdx=near;return;}
  if(S.mode==='delete'&&near>-1){S.points.splice(near,1);S.coachEdited=true;return draw();}
  if(S.mode==='toggle'&&near>-1){const st=pointStatus(S.points[near]);S.points[near].override=(st!=='hit');S.coachEdited=true;return draw();}
});
cv.addEventListener('pointermove',e=>{
  if(dragIdx>-1&&S.mode==='move'){const c=clickPos(e),ip=screenToImage(c.x,c.y);S.points[dragIdx]={...S.points[dragIdx],x:ip.x,y:ip.y};draw();}
  else if(boardDrag&&S.mode==='boardFit'&&S.board){const p=clickPos(e),s=viewTransform().s;S.board.cx+=(p.x-boardDrag.px)/s;S.board.cy+=(p.y-boardDrag.py)/s;S.board.needsReview=false;boardDrag={px:p.x,py:p.y};draw();}
});
window.addEventListener('pointerup',()=>{dragIdx=-1;boardDrag=null;});
// 보드 맞춤 보정 컨트롤: 크기/회전/복사선 조정 (사진 위 표준 템플릿 맞춤)
function fitAdjust(fn){if(!S.img)return;if(!S.board)ensureBoard({x:S.img.width/2,y:S.img.height/2});fn(S.board);S.board.needsReview=false;S.coachEdited=true;draw();}
$('#fitBigger')&&($('#fitBigger').onclick=()=>fitAdjust(b=>{b.rx*=1.04;b.ry*=1.04;}));
$('#fitSmaller')&&($('#fitSmaller').onclick=()=>fitAdjust(b=>{b.rx*=0.96;b.ry*=0.96;}));
$('#fitWider')&&($('#fitWider').onclick=()=>fitAdjust(b=>{b.rx*=1.04;}));
$('#fitTaller')&&($('#fitTaller').onclick=()=>fitAdjust(b=>{b.ry*=1.04;}));
$('#fitRotL')&&($('#fitRotL').onclick=()=>fitAdjust(b=>{b.rotation-=3*Math.PI/180;}));
$('#fitRotR')&&($('#fitRotR').onclick=()=>fitAdjust(b=>{b.rotation+=3*Math.PI/180;}));
$('#fitProneIn')&&($('#fitProneIn').onclick=()=>fitAdjust(b=>{b.rProneNorm=Math.max(0.30,b.rProneNorm-0.02);}));
$('#fitProneOut')&&($('#fitProneOut').onclick=()=>fitAdjust(b=>{b.rProneNorm=Math.min(0.80,b.rProneNorm+0.02);}));
// 화면 클릭(p, 화면좌표)에 가장 가까운 탄착점 인덱스. 탄착점은 콘텐츠 좌표이므로 화면으로 변환해 비교.
function nearest(p){let best=-1,bd=28;S.points.forEach((q,i)=>{const sp=imageToScreen(q.x,q.y);const d=Math.hypot(p.x-sp.x,p.y-sp.y);if(d<bd){bd=d;best=i;}});return best;}
// 결과/리포트용 중심(콘텐츠 좌표): 사진+보드면 보드 중심, 아니면 S.center
function reportCenter(){if(S.board)return{x:S.board.cx,y:S.board.cy};return S.center;}
$('#saveBtn').onclick=()=>{
  const center=reportCenter();
  if(!center)return alert('중앙점을 지정하거나(＋ 중앙) 자동 보조/보드 맞춤 보정을 사용하세요.');
  if(!S.points.length)return alert('탄착점을 입력하세요.');
  const pts=S.points.map((p,i)=>{const st=pointStatus(p);return{...p,status:st,hit:st==='hit',no:i+1};});
  const unknown=pts.filter(p=>p.status==='unknown').length;
  if(unknown>0&&!confirm(`기준이 없어 '판정 전'인 탄착점이 ${unknown}개 있습니다. 그대로 저장할까요?`))return;
  const img=cv.toDataURL('image/jpeg',.88);
  const dxs=pts.map(p=>p.x-center.x),dys=pts.map(p=>p.y-center.y);
  const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
  const avgLR=mean(dxs),avgUD=mean(dys);
  const dists=pts.map((p,i)=>Math.hypot(dxs[i],dys[i]));
  const avgDist=mean(dists);let group=0;
  for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)group=Math.max(group,Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y));
  const res={id:Date.now(),athlete:$('#athlete').value||'무명',type:$('#shootType').value,setNo:$('#setNo').value,weather:$('#weather').value,memo:$('#memo').value,shots:Number($('#shotCount').value),points:pts,unknown,image:img,date:new Date().toLocaleString('ko-KR'),center,rProne:S.rProne,rStanding:S.rStanding,avgLR:Number(avgLR.toFixed(1)),avgUD:Number(avgUD.toFixed(1)),avgDist:Number(avgDist.toFixed(1)),group:Number(group.toFixed(1)),autoAssist:!!S.autoAssistUsed,coachEdited:!!S.coachEdited,needsReview:S.board?!!S.board.needsReview:false,boardMethod:S.board?S.board.method:'manual'};
  S.results.unshift(res);if(!S.players.includes(res.athlete))S.players.push(res.athlete);
  localStorage.bfcResults=JSON.stringify(S.results);localStorage.bfcPlayers=JSON.stringify(S.players);
  updateCounts();renderReport(res);
};
function renderResults(){let box=$('#resultsList');if(!S.results.length){box.innerHTML='<p class="help">저장된 결과가 없습니다.</p>';return}box.innerHTML=S.results.map(r=>`<div class="resultCard"><h3>${r.athlete} · ${typeName(r.type)}</h3><p>${r.date} · ${r.shots}/5발 · 세트 ${r.setNo}</p><p>명중 ${r.points.filter(p=>p.hit).length}/${r.points.length}</p><button class="primary" onclick="openResult(${r.id})">결과지 열기</button> <button class="secondary" onclick="delResult(${r.id})">삭제</button></div>`).join('')}
window.openResult=id=>renderReport(S.results.find(r=>r.id===id));window.delResult=id=>{S.results=S.results.filter(r=>r.id!==id);localStorage.bfcResults=JSON.stringify(S.results);updateCounts();renderResults()};
function renderPlayers(){let box=$('#playerList');box.innerHTML=S.players.length?S.players.map(p=>`<div class="resultCard"><b>${p}</b><p>${S.results.filter(r=>r.athlete===p).length}건</p></div>`).join(''):'<p class="help">등록된 선수가 없습니다.</p>'}
function renderReport(r){if(!r)return;const hit=r.points.filter(p=>p.hit).length;const n=r.points.length;
  const avg=(r.avgDist!=null)?r.avgDist:(r.points.reduce((a,p)=>a+Math.hypot(p.x-r.center.x,p.y-r.center.y),0)/(n||1));
  let group=r.group;if(group==null){group=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)group=Math.max(group,Math.hypot(r.points[i].x-r.points[j].x,r.points[i].y-r.points[j].y));}
  const lr=r.avgLR??0,ud=r.avgUD??0;
  const lrTxt=`${Math.abs(lr).toFixed(1)}px ${lr<=0?'좌':'우'}`,udTxt=`${Math.abs(ud).toFixed(1)}px ${ud<=0?'상':'하'}`;
  const rate=n?Math.round(hit/n*100):0;
  $('#report').innerHTML=`<div class="eyebrow">BIATHLON FIELD COACH v1.2</div><h2>${r.athlete} ${typeName(r.type)} 사격 결과</h2>
  <div class="reportGrid">
  <div class="reportBox"><b>선수</b><br>${r.athlete}</div>
  <div class="reportBox"><b>일시</b><br>${r.date}</div>
  <div class="reportBox"><b>구분</b><br>${typeName(r.type)}</div>
  <div class="reportBox"><b>발수</b><br>${r.shots}발</div>
  <div class="reportBox"><b>세트</b><br>${r.setNo}</div>
  <div class="reportBox"><b>날씨</b><br>${r.weather||'-'}</div>
  <div class="reportBox"><b>명중 수</b><br>${hit}/${n}</div>
  <div class="reportBox"><b>명중률</b><br>${rate}%</div>
  <div class="reportBox"><b>좌우 평균 편차</b><br>${lrTxt}</div>
  <div class="reportBox"><b>상하 평균 편차</b><br>${udTxt}</div>
  <div class="reportBox"><b>탄착군 크기</b><br>${(+group).toFixed(1)}px</div>
  <div class="reportBox"><b>중앙 평균 거리</b><br>${(+avg).toFixed(1)}px</div>
  <div class="reportBox"><b>자동 보조</b><br>${r.autoAssist?'사용':'미사용'}</div>
  <div class="reportBox"><b>지도자 수정</b><br>${r.coachEdited?'있음':'없음'}</div>
  </div>
  <img src="${r.image}" />
  <h3>탄착 판정</h3><p>${r.points.map(p=>{const st=p.status||(p.hit?'hit':'miss');const lbl=st==='hit'?'명중':st==='miss'?'불명중':'판정 전';const cls=st==='hit'?'hit':st==='miss'?'miss':'unknown';return `<span class="${cls}">${p.no}번 ${lbl}</span>`;}).join(' · ')}</p>
  ${(r.needsReview||r.unknown)?`<p class="small" style="color:#b06b00"><b>확인 필요:</b> ${r.needsReview?'자동 보조 기준선이 미확정 상태입니다. ':''}${r.unknown?`판정 기준이 없는 '판정 전' 탄착점 ${r.unknown}개가 있습니다.`:''}</p>`:''}
  <h3>지도자 메모</h3><p>${r.memo||'-'}</p>
  <p class="small">판정 기준: 복사=두 번째 굵은 실선, 입사=검은 원 외곽선. 자석 반경을 고려해 선에 걸치면 명중. (편차/거리 px는 콘텐츠 좌표 기준)</p>`;
  $('#reportModal').classList.remove('hidden');}
function typeName(t){return t==='prone'?'복사':t==='standing'?'입사':'제로'}
$('#closeReportBtn').onclick=()=>$('#reportModal').classList.add('hidden');$('#backAnalysisBtn').onclick=()=>{$('#reportModal').classList.add('hidden');go('analysis')};$('#backHomeBtn').onclick=()=>{$('#reportModal').classList.add('hidden');go('home')};$('#printBtn').onclick=()=>window.print();$('#shareImgBtn').onclick=async()=>{try{let blob=await(await fetch($('#report img').src)).blob();let file=new File([blob],'biathlon-result.jpg',{type:'image/jpeg'});if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:'Biathlon result'});else alert('이 기기에서는 이미지 공유가 제한됩니다. PDF 저장/인쇄를 사용하세요.')}catch(e){alert('공유 실패: PDF 저장/인쇄를 사용하세요.')}};
$('#clearDataBtn').onclick=()=>{if(confirm('전체 데이터를 삭제할까요?')){localStorage.removeItem('bfcResults');localStorage.removeItem('bfcPlayers');location.reload()}};$('#exportBtn').onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({results:S.results,players:S.players},null,2)],{type:'application/json'}));a.download='bfc-backup.json';a.click()};
function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke()}function line(x1,y1,x2,y2){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}function roundRect(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);if(fill)ctx.fill();if(stroke)ctx.stroke()}
// 사격 구분 변경 시 기존 점 판정 재계산 + 작은 안내 표시
function showRecalcNote(){const el=$('#recalcNote');if(!el)return;el.style.display='inline';clearTimeout(showRecalcNote._t);showRecalcNote._t=setTimeout(()=>{el.style.display='none';},2600);}
$('#shootType')&&($('#shootType').onchange=()=>{if(S.points.length)showRecalcNote();draw();});
if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('service-worker.js').catch(()=>{});draw();updateCounts();
