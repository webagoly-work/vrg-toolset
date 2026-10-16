// ==========================================================================
// 06d-view-export.js — the Exportálás menu: the Tiszta axo sheet (Views V4) and the Alaprajz paper sheet (V9c)
//                     as SVG / PNG / print
//
// docs/views/DECISIONS.md D-V4-2: a new Exportálás menu; the camera is picked from the named views
// (Felülnézet = the default, then the V2 presets); the export keeps the zoom currently on screen but
// always frames the whole drawing, centred, whatever the pan. The camera is the Planner's own
// (planToBase at the chosen pitch and the quadrant nearest the current yaw), so a preset exports
// exactly what the 3D view shows with that preset on. The level is the active one; the sheet frame
// (title, legend, wall rows) is viewSheetSvg. The state is borrowed for the render and restored.
// ==========================================================================

const VEXP_VIEWS=[{k:'top',n:'Felülnézet',pitch:90,phase:null}].concat(CAM_PRESETS.map(p=>({k:p.k,n:p.n,pitch:p.pitch,phase:p.phase})));
function vexpView(k){return VEXP_VIEWS.find(v=>v.k===k)||VEXP_VIEWS[0];}

// {svg, W, H, R, view}: the sheet for view `k` at the current zoom and view scale
// opts.rot: Felülnézet only (D-V4-3, the menu's Forgatás 0/90/180/270, default 0 = plan as drawn); the presets keep
// the quadrant nearest the current yaw (D-V4-2). opts.explode: V5, passed through to viewRender.
const VEXP_ROTS=[0,90,180,270];
function vexpSheet(k,title,opts){const o=opts||{};const v=vexpView(k),rot0=state.rot,pitch0=state.pitch,L=state.active,f=vsK(),cut=state.cutH||1500,nearCut=state.cutNearH||1000;let R;
  try{state.pitch=v.pitch;if(v.phase!=null)state.rot=camQuadRot(state.rot,v.pitch,v.phase);else state.rot=VEXP_ROTS.includes(+o.rot)?+o.rot:0;
    const [cx,cy]=cutCamSides(),prj=(x,y,z)=>{const b=planToBase(x,y,dz(L,z));return [b[0]/f,b[1]/f];};
    R=viewRender({level:L,camera:{prj,cx,cy},cut,nearCut,yaw:camNorm(state.rot),pitch:Math.round(state.pitch),explode:o.explode||null,plates:o.plates||null});}
  finally{state.rot=rot0;state.pitch=pitch0;}
  const sub=`${v.n} · vágás ${cut} / ${nearCut} mm · ${R.stats.devices} végpont`+(R.stats.plates?` · rétegek ${R.stats.plates.length}, lépcső ${R.stats.step} mm`:R.stats.step?` · szétszedve, lépcső ${R.stats.step} mm`:'');
  const S=viewSheetSvg(R,{title:title||'',sub,scale:f*state.zoom});
  return {svg:S.svg,W:S.W,H:S.H,R,view:v};}

// V5: the menu's Szétszedve + Emelés lépcsője → {step} or null
function vexpExplode(){const c=$('expExplode');if(!c||!c.checked)return null;return {step:viewExplodeStep(state.active,($('expStep')||{}).value||'900')};}
// V6: the menu's Rétegek (+ minden elemhez vezetővonal) → {step, leaders} or null; the step is the V5 menu's
function vexpPlates(){const c=$('expPlates');if(!c||!c.checked)return null;
  return {step:viewExplodeStep(state.active,($('expStep')||{}).value||'900'),leaders:($('expLeadAll')||{}).checked?'all':'key'};}
function vexpName(ext){const t=(($('expTitle')||{}).value||'').trim(),v=vexpView(($('expView')||{}).value);
  if(vexpPlanOn()){const [p,N]=vexpPlanArgs();return ('alaprajz_'+(t||state.active)+'_'+p+'_1-'+N).replace(/[^\wÀ-ž-]+/g,'_')+'.'+ext;}
  return ('axo_'+(t||state.active)+'_'+v.k+(vexpPlates()?'_retegek':vexpExplode()?'_szet':'')).replace(/[^\wÀ-ž-]+/g,'_')+'.'+ext;}
function vexpCur(){if(vexpPlanOn()){const [p,N,r]=vexpPlanArgs();return vexpPlanSheet(p,N,(($('expTitle')||{}).value||'').trim(),{rot:r});}
  return vexpSheet(($('expView')||{}).value||'top',(($('expTitle')||{}).value||'').trim(),{rot:+(($('expRot')||{}).value||0),explode:vexpExplode(),plates:vexpPlates()});}
function vexpSvg(){const S=vexpCur();if(!S.svg){vexpFitSync();return null;}const u=URL.createObjectURL(new Blob([S.svg],{type:'image/svg+xml'})),a=document.createElement('a');
  a.href=u;a.download=vexpName('svg');a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return S;}
// PNG at 2× the sheet, held under 8192 px a side (the canvas limit with headroom)
function vexpPngK(S){return S.mm?150/25.4:Math.min(2,8192/Math.max(S.W,S.H));}   // V9c: a paper sheet at 150 dpi
function vexpPng(){const S=vexpCur();if(!S.svg){vexpFitSync();return null;}const k=vexpPngK(S);svgToPng(S.svg,Math.round(S.W*k),Math.round(S.H*k),vexpName('png'));return S;}
function vexpPrint(){const S=vexpCur();if(!S.svg){vexpFitSync();return null;}
  if(S.mm)printSVG(S.svg,'Alaprajz',S.fit.paper.name+' '+(S.fit.orient==='álló'?'portrait':'landscape'));else printSVG(S.svg,'Axonometria');return S;}

// ---- V9c: the Alaprajz on ISO paper at a true scale (docs/views/WORKPLAN.md § V9c) ----
// The plan is the live Alaprajz scene (draw() with the state borrowed: style, pitch 90, the Forgatás rotation, bpScale = N),
// mapped by 1 / (SC · N) mm per base unit, so 1000 mm of plan = 1000 / N mm of paper and the pens are paper mm. Framed: the
// level box + the annotation ring (2600 on −x / −y for the dimension chains, 2900 on +x and 300 on +y for the north arrow).
// Landscape if it fits, else portrait, else no sheet and a Hungarian line in the menu — never a silent shrink.
const VEXP_PAPERS={A3:{w:420,h:297},A4:{w:297,h:210}},VEXP_SCALES=[50,100];
function vexpPlanBox(rot){const L=state.active,bb=bpBBox(L);if(!bb)return null;const p0=state.pitch,r0=state.rot,z=dz(L,0);
  try{state.pitch=90;state.rot=VEXP_ROTS.includes(+rot)?+rot:0;
    const P=[[bb.x0-2600,bb.y0-2600],[bb.x1+2900,bb.y0-2600],[bb.x1+2900,bb.y1+300],[bb.x0-2600,bb.y1+300]].map(q=>planToBase(q[0],q[1],z));
    return [Math.min(...P.map(q=>q[0])),Math.min(...P.map(q=>q[1])),Math.max(...P.map(q=>q[0])),Math.max(...P.map(q=>q[1]))];}
  finally{state.pitch=p0;state.rot=r0;}}
// {ok, orient 'fekvő'|'álló', paper {w,h,name}, draw [w,h] mm, area, msg}
function vexpPlanFit(paper,N,rot){const Pp=VEXP_PAPERS[paper]||VEXP_PAPERS.A3,name=VEXP_PAPERS[paper]?paper:'A3',box=vexpPlanBox(rot);
  if(!box)return {ok:false,msg:'Nincs mit kiadni: az aktív szinten nincs fal.'};
  const k=1/(SC*N),dw=(box[2]-box[0])*k,dh=(box[3]-box[1])*k,r=v=>Math.round(v);
  const land=viewPaperArea(Pp.w,Pp.h),port=viewPaperArea(Pp.h,Pp.w),fits=a=>dw<=a.w+1e-6&&dh<=a.h+1e-6;
  const base={k,box,draw:[dw,dh],N};
  if(fits(land))return Object.assign(base,{ok:true,orient:'fekvő',paper:{w:Pp.w,h:Pp.h,name},area:land,msg:`${name} fekvő · 1:${N} · rajz ${r(dw)} × ${r(dh)} mm`});
  if(fits(port))return Object.assign(base,{ok:true,orient:'álló',paper:{w:Pp.h,h:Pp.w,name},area:port,msg:`${name} álló · 1:${N} · rajz ${r(dw)} × ${r(dh)} mm`});
  return Object.assign(base,{ok:false,msg:`Nem fér el: ${name} 1:${N} → a rajz ${r(dw)} × ${r(dh)} mm, a rajzterület ${r(land.w)} × ${r(land.h)} mm (álló: ${r(port.w)} × ${r(port.h)} mm). Válassz nagyobb lapot vagy kisebb léptéket.`});}
// {svg, W, H (mm), mm:true, fit, map, stats} or {svg:null, fit} when it does not fit
function vexpPlanSheet(paper,N,title,opts){const o=opts||{},rot=VEXP_ROTS.includes(+o.rot)?+o.rot:0,fit=vexpPlanFit(paper,N,rot);if(!fit.ok)return {svg:null,fit};
  const keep={style:state.style,pitch:state.pitch,rot:state.rot,bpScale:state.bpScale,hoverR:state.hoverR};let scene='',S=null;
  try{state.style='alaprajz';state.pitch=90;state.rot=rot;state.bpScale=N;state.hoverR=null;draw();
    scene=document.getElementById('vp').firstChild.innerHTML;S=AP_LAST;}
  finally{Object.assign(state,keep);draw();}
  const R={def:{level:state.active},stats:{devices:S?S.dev.full:0},roles:[],body:scene};
  const sub=`Alaprajz · vágás ${S?S.cut:apCut()} mm · ${S?S.dev.full:0} végpont a vágás alatt`;
  const sh=viewSheetSvg(R,{paper:fit.paper,k:fit.k,box:fit.box,N,title:title||'',sub,date:o.date||new Date().toISOString().slice(0,10)});
  return Object.assign(sh,{fit,stats:S});}
function vexpPlanOn(){const c=$('expPlan');return !!(c&&c.checked);}
function vexpPlanArgs(){return [(($('expPaper')||{}).value||'A3'),+(($('expScale')||{}).value||50),+(($('expRot')||{}).value||0)];}
// the menu's fit line (and the greyed-out axo controls) for the current Papír / Lépték / Forgatás
function vexpFitSync(){const on=vexpPlanOn(),line=$('expFit');
  ['expView','expExplode','expStep','expPlates','expLeadAll'].forEach(id=>{if($(id))$(id).disabled=on;});
  if($('expPaperRow'))$('expPaperRow').style.display=on?'':'none';
  if($('expRotRow'))$('expRotRow').style.display=(on||(($('expView')||{}).value||'top')==='top')?'':'none';
  if(!line)return null;if(!on){line.textContent='';line.style.display='none';return null;}
  const [p,N,r]=vexpPlanArgs(),F=vexpPlanFit(p,N,r);line.style.display='';line.textContent=F.msg;line.style.color=F.ok?'#2c6e3f':'#b3261e';return F;}

function vexpMenuToggle(on){const m=$('expMenu');if(!m)return false;const show=on==null?m.style.display==='none':!!on;
  m.style.display=show?'block':'none';
  if(show){const b=$('bExport');if(b){const r=b.getBoundingClientRect();m.style.left=Math.round(r.left)+'px';m.style.top=Math.round(r.bottom+4)+'px';}}
  return show;}
(function(){const $=id=>document.getElementById(id);   // 08's $ is not defined yet at this point of the build
  const sel=$('expView');if(sel&&!sel.options.length)VEXP_VIEWS.forEach(v=>{const o=document.createElement('option');o.value=v.k;o.textContent=v.n;sel.appendChild(o);});
  const rs=$('expRot');if(rs&&!rs.options.length)VEXP_ROTS.forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d+'°';rs.appendChild(o);});
  const ss=$('expStep');if(ss&&!ss.options.length)VIEW_EXPLODE_STEPS.forEach(e=>{const o=document.createElement('option');o.value=e.k;o.textContent=e.n;ss.appendChild(o);});
  const sync=()=>{const r=$('expRotRow');if(r&&sel)r.style.display=sel.value==='top'||($('expPlan')&&$('expPlan').checked)?'':'none';};if(sel)sel.onchange=sync;sync();
  ['expPlan','expPaper','expScale','expRot'].forEach(id=>{if($(id))$(id).addEventListener('change',()=>vexpFitSync());});   // V9c
  if($('bExport'))$('bExport').onclick=()=>{if(vexpMenuToggle())vexpFitSync();};
  if($('expSvg'))$('expSvg').onclick=()=>{if(vexpSvg())vexpMenuToggle(false);};   // V9c: no fit → the menu stays open on its line
  if($('expPng'))$('expPng').onclick=()=>{if(vexpPng())vexpMenuToggle(false);};
  if($('expPrint'))$('expPrint').onclick=()=>{if(vexpPrint())vexpMenuToggle(false);};})();

window.vexpSheet=vexpSheet;window.VEXP_VIEWS=VEXP_VIEWS;window.vexpPlanSheet=vexpPlanSheet;window.vexpPlanFit=vexpPlanFit;window.VEXP_PAPERS=VEXP_PAPERS;
