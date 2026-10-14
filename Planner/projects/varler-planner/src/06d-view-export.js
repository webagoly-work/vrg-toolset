// ==========================================================================
// 06d-view-export.js — the Exportálás menu: the Tiszta axo sheet as SVG / PNG / print (Views V4)
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
  return ('axo_'+(t||state.active)+'_'+v.k+(vexpPlates()?'_retegek':vexpExplode()?'_szet':'')).replace(/[^\wÀ-ž-]+/g,'_')+'.'+ext;}
function vexpCur(){return vexpSheet(($('expView')||{}).value||'top',(($('expTitle')||{}).value||'').trim(),{rot:+(($('expRot')||{}).value||0),explode:vexpExplode(),plates:vexpPlates()});}
function vexpSvg(){const S=vexpCur(),u=URL.createObjectURL(new Blob([S.svg],{type:'image/svg+xml'})),a=document.createElement('a');
  a.href=u;a.download=vexpName('svg');a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return S;}
// PNG at 2× the sheet, held under 8192 px a side (the canvas limit with headroom)
function vexpPngK(S){return Math.min(2,8192/Math.max(S.W,S.H));}
function vexpPng(){const S=vexpCur(),k=vexpPngK(S);svgToPng(S.svg,Math.round(S.W*k),Math.round(S.H*k),vexpName('png'));return S;}
function vexpPrint(){const S=vexpCur();printSVG(S.svg,'Axonometria');return S;}

function vexpMenuToggle(on){const m=$('expMenu');if(!m)return false;const show=on==null?m.style.display==='none':!!on;
  m.style.display=show?'block':'none';
  if(show){const b=$('bExport');if(b){const r=b.getBoundingClientRect();m.style.left=Math.round(r.left)+'px';m.style.top=Math.round(r.bottom+4)+'px';}}
  return show;}
(function(){const $=id=>document.getElementById(id);   // 08's $ is not defined yet at this point of the build
  const sel=$('expView');if(sel&&!sel.options.length)VEXP_VIEWS.forEach(v=>{const o=document.createElement('option');o.value=v.k;o.textContent=v.n;sel.appendChild(o);});
  const rs=$('expRot');if(rs&&!rs.options.length)VEXP_ROTS.forEach(d=>{const o=document.createElement('option');o.value=d;o.textContent=d+'°';rs.appendChild(o);});
  const ss=$('expStep');if(ss&&!ss.options.length)VIEW_EXPLODE_STEPS.forEach(e=>{const o=document.createElement('option');o.value=e.k;o.textContent=e.n;ss.appendChild(o);});
  const sync=()=>{const r=$('expRotRow');if(r&&sel)r.style.display=sel.value==='top'?'':'none';};if(sel)sel.onchange=sync;sync();
  if($('bExport'))$('bExport').onclick=()=>vexpMenuToggle();
  if($('expSvg'))$('expSvg').onclick=()=>{vexpSvg();vexpMenuToggle(false);};
  if($('expPng'))$('expPng').onclick=()=>{vexpPng();vexpMenuToggle(false);};
  if($('expPrint'))$('expPrint').onclick=()=>{vexpPrint();vexpMenuToggle(false);};})();

window.vexpSheet=vexpSheet;window.VEXP_VIEWS=VEXP_VIEWS;
