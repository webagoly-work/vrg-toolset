// ==========================================================================
// 05d-shell.js — the workflow shell: stage rail + contextual inspector
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The side panel is organised by implementation category (Tools, Layers, Build…).
// This shell is organised by the JOB: five stages in the order the work happens,
// and one inspector showing whatever is selected. Both are GENERATED from the
// action registry, so a new action appears here without touching this file.
//
// It sits ON TOP of the existing panel rather than replacing it — `state.shell`
// turns it off and nothing else depends on it.

const STAGES=[
 {k:'build', n:'Épület',       icon:'🧱', groups:['Fal','Nyílászáró','Szint','Rajz'],
  hint:'Falak, nyílászárók, szintek, padlók.',
  check:()=>{const out=[];let w=0;for(const l of ORD)w+=(WALLS[l]||[]).length;
    if(!w)out.push({sev:'info',msg:'Még nincs fal — kezdd a Fal eszközzel.'});
    if(!data.floors.length)out.push({sev:'info',msg:'Nincs padló felvéve.'});
    return out;}},
 {k:'rooms', n:'Helyiségek',   icon:'🏷', groups:['Helyiség'],
  hint:'Elnevezés, rendeltetés, környezet (IP), burkolatok, alapmagasságok.',
  check:()=>{const out=[];
    const un=data.floors.filter(f=>!f.name).length;
    if(un)out.push({sev:'warn',msg:un+' helyiségnek nincs neve.'});
    const noEnv=data.floors.filter(f=>f.name&&!f.env).length;
    if(noEnv)out.push({sev:'info',msg:noEnv+' helyiségnél nincs megadva a környezet (IP).'});
    return out;}},
 {k:'devices',n:'Kiosztás',    icon:'🔌', groups:['Készülék'],
  hint:'Aljzatok, kapcsolók, lámpák, dobozok és a magasságuk.',
  check:()=>{const out=[];
    if(!data.devices.length)out.push({sev:'info',msg:'Még nincs készülék elhelyezve.'});
    const noRef=data.devices.filter(d=>!d.ref).length;
    if(noRef)out.push({sev:'warn',msg:noRef+' készüléknek nincs jelölése.'});
    const lamps=data.devices.filter(d=>d.type==='light'&&!d.lampName).length;
    if(lamps)out.push({sev:'info',msg:lamps+' lámpa nincs meghatározva (adatlap).'});
    return out;}},
 {k:'circuits',n:'Áramkörök',  icon:'⚡', groups:['Áramkör'],
  hint:'Végpontok: dedikált vagy több pontos áramkörök, kismegszakító. K = kijelölés a rajzon.',
  check:()=>cktChecks()},
 {k:'paths', n:'Pályák',       icon:'〰', groups:['Véset','Pálya'],
  hint:'Kábelpályák, vésetek, áramkörök.',
  check:()=>{const out=[];
    if(!data.paths.length)out.push({sev:'info',msg:'Még nincs pálya rajzolva.'});
    const empty=data.paths.filter(p=>(p.sections||[]).every(s=>!s.circuit&&!(s.circuits||[]).length)).length;
    if(empty)out.push({sev:'info',msg:empty+' pálya üres (nincs benne áramkör).'});
    const unlinked=data.devices.filter(d=>d.type!=='board'&&!devLinks(d).length).length;
    if(unlinked)out.push({sev:'info',msg:unlinked+' készülék nincs pályához kötve.'});
    return out;}},
 {k:'doc',   n:'Dokumentáció', icon:'📄', groups:['Dokumentáció','Ellenőrzés','Projekt'],
  hint:'Hivatalos rajz, anyagkimutatás, nyomtatás, mentés.',
  check:()=>{const v=validateSummary(),out=[];
    if(v.error)out.push({sev:'error',msg:v.error+' hiba van a tervben — nézd meg az Ellenőrzést.'});
    if(v.warn)out.push({sev:'warn',msg:v.warn+' figyelmeztetés.'});
    if(!v.error&&!v.warn)out.push({sev:'ok',msg:'Az ellenőrzés nem talált kifogásolni valót.'});
    return out;}}
];
// With a BRIDGE Stack active (05m) the rail shows the stack's steps instead of the general stages [Q11=A].
// shellStages()/shellKey() are the ONLY places that decide which list the rail, the inspector and the
// next/previous actions read.
function shellStages(){const S=(typeof stkActive==='function')?stkActive():null,L=S?stkStages(S):null;
  return (L&&L.length)?L:STAGES;}            // a stack with no role layer left (all deleted) falls back to the general stages
function shellKey(){const L=shellStages();
  return L===STAGES?(state.stage||'build'):stkCurrentKey(stkActive());}
function stageByKey(k){const L=shellStages();return L.find(s=>s.k===k)||L[0];}
// stage names and hints run through the seam, so the rail follows the language
function stageName(s){return t('stage.'+s.k,s.n);}
function stageHint(s){return t('stage.'+s.k+'.hint',s.hint);}
function setStage(k){state.stage=k;
  if(k.indexOf('stk:')===0&&typeof stkEnterRole==='function')stkEnterRole(k.slice(4));   // the role's layer becomes the active layer
  const st=stageByKey(k);
  $('hud').textContent=stageName(st)+' — '+stageHint(st);renderShell();}
function shellOn(){return state.shell!==false;}

// draw() calls renderShell() on every pointermove. Rebuilding the rail and the inspector
// there threw away whatever the user was doing in them: an <input> being typed into lost
// its focus and its half-typed value, the inspector scrolled back to the top, and every
// stage re-ran its check() over the whole model. Both are now built as strings and only
// written to the DOM when they actually differ, with the checks cached per scene version.
let _chkVer=-1,_chkMap=null,_railHtml=null,_inspHtml=null;
function stageChecks(st){const key=shellModelKey();if(_chkVer!==key||!_chkMap){_chkVer=key;_chkMap={};}
  if(!(st.k in _chkMap)){try{_chkMap[st.k]=st.check()||[];}catch(_){_chkMap[st.k]=[];}}
  return _chkMap[st.k];}
function invalidateShell(){_chkVer=-1;_chkMap=null;_railHtml=null;_inspHtml=null;
  if(typeof _sbHtml!=='undefined')_sbHtml=null;}
const RAIL_MIN=330,INSP_MIN=520;      // px of stage needed before each overlay earns its place (at the default widths)
// A width of 0 means the page has not been laid out yet (or we are in jsdom) — that is not
// a narrow screen, so nothing is hidden on the strength of it.
function stageW(){const el=document.querySelector('.stage-wrap');if(!el)return 9999;
  const wpx=el.getBoundingClientRect().width;return wpx>0?wpx:9999;}
function railRoom(){return stageW()>=RAIL_MIN-PNL_DEF.rail+pnlW('rail');}   // the thresholds move with the panels (U5)
function inspRoom(){return stageW()>=INSP_MIN-PNL_DEF.insp+pnlW('insp');}

// ---- panel widths + wide work mode (round 2026-10-10, WP-U5) ----
// The rail and the inspector are resized by a 6 px grip on their inner edge. The grips live in .stage-wrap, not in
// the panels: both panels are rebuilt from cached HTML, which would throw a grip — and its pointer capture — away.
const PNL_DEF={rail:104,insp:238},PNL_LIM={rail:[80,260],insp:[200,520]};
function pnlW(p){const v=+state[p==='rail'?'railW':'inspW'],L=PNL_LIM[p];return v?Math.max(L[0],Math.min(L[1],v)):PNL_DEF[p];}
function pnlSetW(p,w){const L=PNL_LIM[p];w=Math.round(Math.max(L[0],Math.min(L[1],+w||PNL_DEF[p])));
  state[p==='rail'?'railW':'inspW']=w;pnlApply();return w;}
function pnlApply(){const rail=$('stageRail'),insp=$('inspector'),wrap=document.querySelector('.stage-wrap');if(!rail||!insp||!wrap)return;
  const rw=pnlW('rail')+'px',iw=pnlW('insp')+'px';if(rail.style.width!==rw)rail.style.width=rw;if(insp.style.width!==iw)insp.style.width=iw;
  [['rail',rail],['insp',insp]].forEach(([p,el])=>{let g=wrap.querySelector(`.pnlGrip[data-p="${p}"]`);
    if(!g){g=document.createElement('div');g.className='pnlGrip';g.dataset.p=p;g.title='Húzd: szélesség · dupla kattintás: alapméret';wrap.appendChild(g);pnlBindGrip(g);}
    const on=el.style.display==='flex'||el.style.display==='block',d=on?'block':'none';if(g.style.display!==d)g.style.display=d;
    const pos=(pnlW(p)-3)+'px';if(p==='rail'){if(g.style.left!==pos)g.style.left=pos;}else if(g.style.right!==pos)g.style.right=pos;});}
function pnlBindGrip(g){let d=null;const p=g.dataset.p;
  g.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();d={x:e.clientX,w:pnlW(p)};try{g.setPointerCapture(e.pointerId);}catch(_){}});
  g.addEventListener('pointermove',e=>{if(!d)return;const dx=e.clientX-d.x;pnlSetW(p,p==='rail'?d.w+dx:d.w-dx);});
  g.addEventListener('pointerup',()=>{if(!d)return;d=null;renderShell();});
  g.addEventListener('dblclick',()=>{pnlSetW(p,PNL_DEF[p]);renderShell();});}
// Tab: hide both sidebars, the rail and the inspector; Tab again restores EXACTLY what was showing — a sidebar the user
// had already closed stays closed. The stage SVG is xMidYMid-fitted, so the plan point at its centre stays put.
function pnlWideOn(){return !!state.wideWork;}
function pnlSides(){return {l:document.querySelector('.side:not(.r)'),r:document.querySelector('.side.r')};}
function pnlSyncArrows(){const S=pnlSides(),hl=$('hideL'),hr=$('hideR'),bp=$('bPanels');
  if(hl&&S.l)hl.textContent=S.l.classList.contains('hide')?'▶':'◀';if(hr&&S.r)hr.textContent=S.r.classList.contains('hide')?'◀':'▶';
  if(bp)bp.textContent=document.querySelector('.side:not(.hide)')?'⤢ Full view':'⤡ Panels';}
function pnlWide(){const S=pnlSides();
  if(!state.wideWork){state.wideWork={l:!!(S.l&&S.l.classList.contains('hide')),r:!!(S.r&&S.r.classList.contains('hide')),rail:shellOn(),insp:shellOn()};
    if(S.l)S.l.classList.add('hide');if(S.r)S.r.classList.add('hide');state.shell=false;}
  else{const s=state.wideWork;state.wideWork=null;
    if(S.l)S.l.classList.toggle('hide',!!s.l);if(S.r)S.r.classList.toggle('hide',!!s.r);state.shell=!!(s.rail||s.insp);}
  pnlSyncArrows();renderShell();setTransform();$('hud').textContent=pnlWideOn()?'Széles munkanézet — Tab: vissza':'Panelek vissza.';return pnlWideOn();}
// a saved project that was left in wide mode opens in wide mode (the sidebars' hidden state lives in the DOM, not state)
function pnlWideSync(){if(!state.wideWork)return;const S=pnlSides();if(S.l)S.l.classList.add('hide');if(S.r)S.r.classList.add('hide');pnlSyncArrows();}
function renderShell(fromDraw){if(!fromDraw)_chkMap=null;   // an explicit call recomputes the checks; draw() passes true and keeps the cache
  const rail=$('stageRail'),insp=$('inspector');
  if(!rail||!insp)return;
  if(!shellOn()){rail.style.display='none';insp.style.display='none';pnlApply();
    const mh0=$('modeHint');if(mh0)mh0.style.left='12px';return;}   // no rail to keep clear of (wide mode, Elrejt)
  const showRail=railRoom();
  rail.style.display=showRail?'flex':'none';
  const mh=$('modeHint');if(mh)mh.style.left=showRail?(pnlW('rail')+12)+'px':'12px';   // clear of the rail

  const cur=shellKey(),SL=shellStages(),inStack=SL!==STAGES;
  const railHtml=(inStack?`<button class="stg stk" id="stgBack" title="Vissza az általános szakaszokhoz"><span class="stgIc">◂</span><span class="stgN">Általános</span></button>`:'')
   +SL.map((s,i)=>
    `<button class="stg${inStack?' stk':''}${s.k===cur?' on':''}" data-k="${s.k}" title="${esc(stageHint(s))}">`
    +`<span class="stgIc">${s.icon}</span><span class="stgN">${i+1}. ${esc(stageName(s))}</span>`
    +stageBadge(s)+`</button>`).join('')
   +`<div style="flex:1"></div>`
   +`<button class="stg" id="stgPal" title="Minden parancs (Ctrl+K)"><span class="stgIc">⌘</span><span class="stgN">Parancsok</span></button>`
   +`<button class="stg" id="stgOff" title="A munkafolyamat-sáv elrejtése"><span class="stgIc">✕</span><span class="stgN">Elrejt</span></button>`;
  if(railHtml!==_railHtml){_railHtml=railHtml;rail.innerHTML=railHtml;
    rail.querySelectorAll('.stg[data-k]').forEach(b=>{b.onclick=()=>setStage(b.dataset.k);
      // S1: a stack stage's button opens its role layer's menu (the same one as the Layers panel row)
      b.addEventListener('contextmenu',e=>{const k=b.dataset.k;if(k.indexOf('stk:')!==0||typeof stkActive!=='function')return;
        const S=stkActive(),L=S&&stkLayer(S.id,k.slice(4));if(!L)return;e.preventDefault();e.stopPropagation();lyrLayerMenu(e,L.id);});});
    if($('stgBack'))$('stgBack').onclick=()=>stkLeave();
    $('stgPal').onclick=()=>paletteOpen();
    $('stgOff').onclick=()=>{state.shell=false;renderShell();};}
  renderInspector();pnlApply();}
function stageBadge(s){let bad=0,warn=0;
  stageChecks(s).forEach(i=>{if(i.sev==='error')bad++;else if(i.sev==='warn')warn++;});
  if(bad)return `<span class="stgB err">${bad}</span>`;
  if(warn)return `<span class="stgB wrn">${warn}</span>`;
  return '';}

// ---- inspector ----
function inspectorTitle(sel){
  if(!sel)return {t:t('insp.none','Nincs kijelölés'),s:''};
  const o=pieceRef(sel);if(!o)return {t:'—',s:''};
  if(sel.t==='wall'){const g=wallGeom(o);return {t:(o.name||t('insp.wall','Fal')),s:Math.round(g.len)+' × '+Math.round(g.th)+' mm'};}
  if(sel.t==='devices')return {t:(o.ref||t('insp.device','Készülék')),s:(DEV[o.type]||o.type)+(o.kind&&DEVKIND[o.kind]?' · '+DEVKIND[o.kind].s:'')};
  if(sel.t==='floors')return {t:(o.name||t('insp.room','Helyiség')),s:(polyArea(o.poly)/1e6).toFixed(2)+' m²'};
  if(sel.t==='openings')return {t:(o.type==='door'?doorName(o):o.type==='window'?'Ablak':'Lépcső'),s:(o.w||0)+'×'+(o.h||0)+' mm'};
  if(sel.t==='objects')return {t:(o.name||t('insp.object','Objektum')),s:(o.w||0)+'×'+(o.d||0)+'×'+(o.ht||0)+' mm'};
  return {t:sel.t,s:''};}
// The handful of fields worth changing without opening a dialog. Anything deeper
// stays an action, so there is exactly one implementation of each property sheet.
function inspectorFields(sel){
  const o=sel?pieceRef(sel):null;if(!o)return [];
  const N=(id,label,val,set,step)=>({id,label,val,set,step:step||10});
  if(sel.t==='devices')return [
    {id:'ins_ref',label:'Jelölés',text:true,val:o.ref||'',set:v=>{o.ref=v;}},
    N('ins_h',t('f.height','Magasság (mm)'),Math.round(o.h||0),v=>{o.h=Math.max(0,v);
      if(o.type==='light'&&lampObjIndex(sel.i)>=0)lampGenObject(sel.i);})];
  if(sel.t==='wall'){const g=wallGeom(o),lvl=pieceLevel(sel);return [
    N('ins_th',t('f.thickness','Vastagság (mm)'),Math.round(g.th),v=>setWallGeom(o,lvl,{th:v})),
    N('ins_len',t('f.length','Hossz (mm)'),Math.round(g.len),v=>setWallGeom(o,lvl,{len:v}),50),
    N('ins_wh',t('f.wallH','Magasság (0 = teljes)'),Math.round(o.h||0),v=>setWallGeom(o,lvl,{h:v}),50),
    N('ins_z0',t('f.z0','Indul a padlótól (mm)'),Math.round(o.z0||0),v=>setWallGeom(o,lvl,{z0:v}),50)];}
  if(sel.t==='floors')return [
    {id:'ins_nm',label:'Név',text:true,val:o.name||'',set:v=>{o.name=v;}},
    {id:'ins_num',label:'Szám',text:true,val:o.num||'',set:v=>{if(v)o.num=v;else delete o.num;}},
    N('ins_ch',t('f.ceilH','Belmagasság (0 = szint)'),Math.round(o.ch||0),v=>{if(v>0)o.ch=v;else delete o.ch;},50)];
  if(sel.t==='openings')return [
    N('ins_ow',t('f.width','Szélesség (mm)'),Math.round(o.w||0),v=>{o.w=Math.max(100,v);},50),
    N('ins_oh',t('f.height','Magasság (mm)'),Math.round(o.h||0),v=>{o.h=Math.max(100,v);},50),
    N('ins_os',t('f.sill','Parapet / küszöb (mm)'),Math.round(o.sill||0),v=>{if(v>0)o.sill=v;else delete o.sill;},50)];
  if(sel.t==='objects')return [
    {id:'ins_on',label:'Név',text:true,val:o.name||'',set:v=>{o.name=v;}},
    N('ins_ow2',t('f.width','Szélesség (mm)'),Math.round(o.w||0),v=>{o.w=Math.max(10,v);},50),
    N('ins_od',t('f.depth','Mélység (mm)'),Math.round(o.d||0),v=>{o.d=Math.max(10,v);},50),
    N('ins_oht',t('f.height','Magasság (mm)'),Math.round(o.ht||0),v=>{o.ht=Math.max(10,v);},50),
    N('ins_oz',t('f.base','Alja a padlótól (mm)'),Math.round(o.z||0),v=>{o.z=Math.max(0,v);},50)];
  return [];}
function inspectorActions(sel){
  const ctx=actionCtx(),st=stageByKey(shellKey());
  const selGroups=['Fal','Készülék','Helyiség','Nyílászáró','Szerkesztő'];
  return actionsFor(ctx).filter(a=>st.groups.indexOf(a.group)>=0||(sel&&selGroups.indexOf(a.group)>=0));}
function renderInspector(){
  const insp=$('inspector');if(!insp)return;
  if(!shellOn()||!inspRoom()){insp.style.display='none';return;}
  const sel=(typeof selected!=='undefined')?selected:null;
  const st=stageByKey(shellKey());
  const chk=stageChecks(st);
  const ttl=inspectorTitle(sel),fields=inspectorFields(sel),acts=inspectorActions(sel);
  insp.style.display='block';
  const html=
     `<div class="insHead"><b>${esc(st.icon+' '+stageName(st))}</b><span class="insSub">${esc(stageHint(st))}</span></div>`
    +(chk.length?`<div class="insChk">`+chk.map(i=>
        `<div class="ck ${i.sev}">${i.sev==='error'?'⛔':i.sev==='warn'?'⚠':i.sev==='ok'?'✔':'•'} ${esc(i.msg)}</div>`).join('')+`</div>`:'')
    +`<div class="insSel"><b>${esc(ttl.t)}</b>${ttl.s?`<span class="insSub"> · ${esc(ttl.s)}</span>`:''}</div>`
    +(fields.length?`<div class="insFields">`+fields.map(f=>
        `<label class="insF"><span>${esc(f.label)}</span>`
        +(f.text?`<input id="${f.id}" value="${esc(f.val)}">`
                :`<input id="${f.id}" type="number" step="${f.step}" value="${f.val}">`)+`</label>`).join('')+`</div>`:'')
    +(sel&&sel.t==='floors'&&data.floors[sel.i]
        ?roomBreakdownHtml({rm:data.floors[sel.i],src:'F',i:sel.i,level:data.floors[sel.i].level}):'')
    +cktInspectorHtml(sel,st.k)+linkInspectorHtml(sel)
    +(acts.length?`<div class="insActs">`+acts.map(a=>
        `<button class="insA" data-id="${a.id}" title="${esc(a.hint||'')}">${a.icon||'•'} ${esc(a.label)}</button>`).join('')+`</div>`
      :`<div class="insSub" style="padding:6px 10px">${esc(t('insp.pick','Válassz elemet a rajzon.'))}</div>`);
  if(html===_inspHtml)return;               // leave the panel — and its focused input — alone
  const sc=insp.scrollTop;_inspHtml=html;insp.innerHTML=html;insp.scrollTop=sc;
  fields.forEach(f=>{const el=$(f.id);if(!el)return;
    el.onchange=()=>{pushUndo();f.set(f.text?el.value:(+el.value||0));draw();};
    el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}};});
  insp.querySelectorAll('.insA').forEach(b=>b.onclick=()=>runAction(b.dataset.id));
  cktBindInspector(insp);}

window.addEventListener('resize',()=>{if(typeof renderShell==='function')renderShell();});
registerActions([
 {id:'shell.toggle',label:'Munkafolyamat-sáv be/ki',icon:'▤',group:'Nézet',alias:'shell rail workflow inspector',
  hint:'A bal oldali szakasz-sáv és a jobb oldali tulajdonság-panel.',
  run:()=>{state.shell=!shellOn();renderShell();}},
 // U5: Tab is free since U4 moved the five tool uses to ←/→ and R. A modal or an editor keeps Tab for its own fields.
 {id:'view.wide',alias:'wide full screen focus tab panels sidebars hide szeles teljes',label:'Széles munkanézet',icon:'⛶',group:'Nézet',keys:['tab'],
  hint:'Az oldalsávok, a munkafolyamat-sáv és a jobb oldali panel el / vissza — Tab. Pontosan azt hozza vissza, ami látszott.',
  when:c=>!c.inEditor&&!(modalBg&&modalBg.style.display==='flex'),run:()=>pnlWide()},
 {id:'shell.next',label:'Következő szakasz',icon:'▶',group:'Nézet',keys:['mod+arrowright'],
  run:()=>{const L=shellStages(),i=L.findIndex(s=>s.k===shellKey());setStage(L[Math.min(i+1,L.length-1)].k);}},
 {id:'shell.prev',label:'Előző szakasz',icon:'◀',group:'Nézet',keys:['mod+arrowleft'],
  run:()=>{const L=shellStages(),i=L.findIndex(s=>s.k===shellKey());setStage(L[Math.max(i-1,0)].k);}}
]);

// test hooks
window.STAGES=STAGES;window.setStage=setStage;window.renderShell=renderShell;window.renderInspector=renderInspector;
window.inspectorFields=inspectorFields;window.inspectorTitle=inspectorTitle;window.inspectorActions=inspectorActions;
window.shellOn=shellOn;window.stageByKey=stageByKey;window.shellStages=shellStages;window.shellKey=shellKey;
