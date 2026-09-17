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
 {k:'paths', n:'Pályák',       icon:'〰', groups:['Véset'],
  hint:'Kábelpályák, vésetek, áramkörök.',
  check:()=>{const out=[];
    if(!data.paths.length)out.push({sev:'info',msg:'Még nincs pálya rajzolva.'});
    const empty=data.paths.filter(p=>(p.sections||[]).every(s=>!s.circuit&&!(s.circuits||[]).length)).length;
    if(empty)out.push({sev:'info',msg:empty+' pálya üres (nincs benne áramkör).'});
    const unlinked=data.devices.filter(d=>d.type!=='board'&&!d.link).length;
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
function stageByKey(k){return STAGES.find(s=>s.k===k)||STAGES[0];}
// stage names and hints run through the seam, so the rail follows the language
function stageName(s){return t('stage.'+s.k,s.n);}
function stageHint(s){return t('stage.'+s.k+'.hint',s.hint);}
function setStage(k){state.stage=k;const st=stageByKey(k);
  $('hud').textContent=stageName(st)+' — '+stageHint(st);renderShell();}
function shellOn(){return state.shell!==false;}

function renderShell(){
  const rail=$('stageRail'),insp=$('inspector');
  if(!rail||!insp)return;
  if(!shellOn()){rail.style.display='none';insp.style.display='none';return;}
  rail.style.display='flex';
  const cur=state.stage||'build';
  rail.innerHTML=STAGES.map((s,i)=>
    `<button class="stg${s.k===cur?' on':''}" data-k="${s.k}" title="${esc(stageHint(s))}">`
    +`<span class="stgIc">${s.icon}</span><span class="stgN">${i+1}. ${esc(stageName(s))}</span>`
    +stageBadge(s)+`</button>`).join('')
   +`<div style="flex:1"></div>`
   +`<button class="stg" id="stgPal" title="Minden parancs (Ctrl+K)"><span class="stgIc">⌘</span><span class="stgN">Parancsok</span></button>`
   +`<button class="stg" id="stgOff" title="A munkafolyamat-sáv elrejtése"><span class="stgIc">✕</span><span class="stgN">Elrejt</span></button>`;
  rail.querySelectorAll('.stg[data-k]').forEach(b=>b.onclick=()=>setStage(b.dataset.k));
  $('stgPal').onclick=()=>paletteOpen();
  $('stgOff').onclick=()=>{state.shell=false;renderShell();};
  renderInspector();}
function stageBadge(s){let bad=0,warn=0;
  try{(s.check()||[]).forEach(i=>{if(i.sev==='error')bad++;else if(i.sev==='warn')warn++;});}catch(_){}
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
  const ctx=actionCtx(),st=stageByKey(state.stage||'build');
  const selGroups=['Fal','Készülék','Helyiség','Nyílászáró','Szerkesztő'];
  return actionsFor(ctx).filter(a=>st.groups.indexOf(a.group)>=0||(sel&&selGroups.indexOf(a.group)>=0));}
function renderInspector(){
  const insp=$('inspector');if(!insp)return;
  if(!shellOn()){insp.style.display='none';return;}
  const sel=(typeof selected!=='undefined')?selected:null;
  const st=stageByKey(state.stage||'build');
  const chk=(()=>{try{return st.check()||[];}catch(_){return [];}})();
  const ttl=inspectorTitle(sel),fields=inspectorFields(sel),acts=inspectorActions(sel);
  insp.style.display='block';
  insp.innerHTML=
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
    +(acts.length?`<div class="insActs">`+acts.map(a=>
        `<button class="insA" data-id="${a.id}" title="${esc(a.hint||'')}">${a.icon||'•'} ${esc(a.label)}</button>`).join('')+`</div>`
      :`<div class="insSub" style="padding:6px 10px">${esc(t('insp.pick','Válassz elemet a rajzon.'))}</div>`);
  fields.forEach(f=>{const el=$(f.id);if(!el)return;
    el.onchange=()=>{pushUndo();f.set(f.text?el.value:(+el.value||0));draw();};
    el.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}};});
  insp.querySelectorAll('.insA').forEach(b=>b.onclick=()=>runAction(b.dataset.id));}

registerActions([
 {id:'shell.toggle',label:'Munkafolyamat-sáv be/ki',icon:'▤',group:'Nézet',alias:'shell rail workflow inspector',
  hint:'A bal oldali szakasz-sáv és a jobb oldali tulajdonság-panel.',
  run:()=>{state.shell=!shellOn();renderShell();}},
 {id:'shell.next',label:'Következő szakasz',icon:'▶',group:'Nézet',keys:['mod+arrowright'],
  run:()=>{const i=STAGES.findIndex(s=>s.k===(state.stage||'build'));setStage(STAGES[Math.min(i+1,STAGES.length-1)].k);}},
 {id:'shell.prev',label:'Előző szakasz',icon:'◀',group:'Nézet',keys:['mod+arrowleft'],
  run:()=>{const i=STAGES.findIndex(s=>s.k===(state.stage||'build'));setStage(STAGES[Math.max(i-1,0)].k);}}
]);

// test hooks
window.STAGES=STAGES;window.setStage=setStage;window.renderShell=renderShell;window.renderInspector=renderInspector;
window.inspectorFields=inspectorFields;window.inspectorTitle=inspectorTitle;window.inspectorActions=inspectorActions;
window.shellOn=shellOn;window.stageByKey=stageByKey;
