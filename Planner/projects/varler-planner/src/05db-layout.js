// ==========================================================================
// 05db-layout.js — the fixed frame (UI tidy T2 + T3, docs/ui-tidy/T2-T3_LAYOUT.md)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The 2026-10-14 audit found 20 panels dealt onto two sidebars by 40 picker buttons, re-dealt by Auto-panel on every
// mode change, a stage rail and a workflow bar on the canvas at the same time, and two floating panels covering the
// sidebars. This frame replaces all of that with places that never move — only their contents change:
//
//   left   #phaseNav    the six phases (one navigator: replaces the stage rail and the workflow bar)
//          #phaseTools  always-on tools, then the current phase's tools, then ▸ Régi eszközök
//          #ctxPanel    ONE context panel: the running tool's panel, else the phase's own
//   right  #rInsp       the inspector (the selection), docked — it no longer covers the canvas
//          #rTabs       Rétegek · Kimutatás · Nézet · Projekt
//
// Every existing panel (.grp) keeps its markup and its handlers; PANEL_HOME says where it lives. A phase's tools are
// action ids (05c), so a button and the ⌘K palette run the same thing. The buttons are generated HERE, at load, before
// the modules that bind some of them by id (08d–08j, 11-controls), so those bindings still attach.
// The inspector's content still comes from 05d (stages / stack roles); a phase only tells it which stage to use.

const PH_LIST=[
 {k:'alap',n:'Alapozás',stage:'build',ctx:'levels',tools:[
   {a:'mode.room',n:'⬚ Helyiség-toll',mode:'room'},{a:'wf.walls',n:'🧱 Falak létrehozása',id:'wfWallsBtn'},
   {a:'wf.floors',n:'▦ Padló létrehozása',id:'wfFloorsBtn'},{a:'slab.level',n:'▬ Födém',id:'slbBtn'},{a:'mode.wall',n:'▤ Fal',mode:'wall'},{a:'mode.object',n:'🪑 Objektum',mode:'object'}]},
 {k:'nyil',n:'Nyílászárók',stage:'build',ctx:'openings',tools:[
   {a:'wf.door',n:'🚪 Ajtó',id:'opnDoorBtn'},{a:'wf.window',n:'🪟 Ablak',id:'opnWinBtn'},{a:'wf.stairs',n:'🪜 Lépcső'},{a:'pt.place',n:'⛩ Portál'}]},
 {k:'szab',n:'Szabályok',stage:'rooms',ctx:'rules',tools:[
   {a:'wf.roomType',n:'🏷 Helyiségtípus'},{a:'wf.routeWalls',n:'🟩 Vezethető fal',id:'rwlBtn'},{a:'wf.rules',n:'📐 Szabályok',id:'rbBtn'},
   {a:'wf.standards',n:'📏 Szabványok',id:'stdBtn'},{a:'mark.wall',n:'🚩 Fal jelölése'},{a:'mark.plane',n:'◩ Padló / menny. jelölés'},
   {a:'wf.ceilLine',n:'〰 Mennyezeti út'},{a:'wf.floorLine',n:'▭ Padló út'}]},              // the user: the two reach lines belong with Jelölések
 {k:'vill',n:'Villamosság',stage:'circuits',ctx:'circuits',tools:[
   {a:'wf.layer.SOC',n:'⚡ Dugaljak',role:'sys:SOC'},{a:'wf.layer.LIGHT',n:'💡 Lámpák + kapcsolók',role:'sys:LIGHT'},
   {a:'wf.layer.DED',n:'🔌 Dedikált',role:'sys:DED'},{a:'ep.place',n:'◉ Végpont…'},{a:'wf.switches',n:'🔀 Kapcsolások'},
   {a:'wf.switchSuggest',n:'✨ Javaslat'},{a:'wf.boxSzoba',n:'▣ Szobadoboz'},{a:'wf.boxKot',n:'⊡ Kötődoboz'},
   {a:'wf.board',n:'🗃 Elosztó'},{a:'wf.subBoard',n:'🗂 Alosztó'},{a:'circuit.suggest',n:'🧮 Áramkörök javaslata'},
   {a:'circuit.pick',n:'K Végpontok kijelölése'}]},
 {k:'paly',n:'Pályák',stage:'paths',ctx:'path',tools:[
   {a:'bl.routes',n:'⚒ Pályák kiszámítása'},{a:'bl.wires',n:'🧶 Vezetékek'},
   {a:'mode.path',n:'➰ Pálya',mode:'path'},{a:'chn.route',n:'⛓ Csatorna'},{a:'rail.route',n:'═ Ezüst sín'},{a:'arm.route',n:'↗ ARM pálya'},
   {a:'fill.room',n:'🧵 Helyiség feltöltése'},{a:'fill.all',n:'🪡 Teljes feltöltés'}]},
 {k:'ki',n:'Kimenet',stage:'doc',ctx:'doc',tools:[
   {a:'check.list',n:'✔ Ellenőrzés'},{a:'doc.totals',n:'📋 Anyagkimutatás'},{a:'doc.print',n:'🖨 Nyomtatás / PDF'},
   {a:'doc.png',n:'🖼 Kép (PNG)'},{a:'view.export.menu',n:'🔷 Axonometria lap'}]}];
const PH_ALWAYS=[{a:'mode.select',n:'▖ Kijelölés',mode:'select'},{a:'mode.grab',n:'✥',mode:'grab',t:'Mozgatás (M)'},
 {a:'mode.measure',n:'↔',mode:'measure',t:'Mérés'},{n:'📌',mode:'note',t:'Jegyzet'},{a:'mode.format',n:'🖌',mode:'format',t:'Formátummásoló'}];
// where every existing panel lives (pid = 12-boot pslug of its heading). ctx:<keys> = the context panel, tab:<k> = a right tab
const PANEL_HOME={projektek:'el:projBody',buildinglayout:'el:projBody',layers:'tab:lay',cabletotalsm:'tab:kim',devicesdb:'tab:kim',rajnlatbom:'tab:kim',
 view:'el:mgjBody',floorlabels:'el:mgjBody',activelevelnewitem:'ctx:levels',showlevelsheightmm:'ctx:levels',pathplyaelsdleges:'ctx:path',
 heightguidelines:'ctx:path cable device',cablemsodlagos:'ctx:cable',device:'ctx:device',ramkrk:'ctx:circuits',dokumentci:'ctx:doc',
 objects:'ctx:object',buildsnapstowall:'ctx:build',falrajzolsa:'ctx:wall'};
const R_TABS=[{k:'lay',n:'Rétegek'},{k:'kim',n:'Kimutatás'}];   // T5: Nézet → ⚙ Megjelenés · T7: Projekt → the header
// the running tool → its context panel (anything not listed shows the phase's own panel)
const CTX_OF_TOOL={'mode.path':'path','chn.route':'path','rail.route':'path','arm.route':'path','mode.cable':'cable','mode.device':'device',
 'mode.build':'build','mode.object':'object','mode.wall':'wall','wf.rules':'rules','wf.routeWalls':'rules','mark.wall':'rules','mark.plane':'rules',
 'circuit.pick':'circuits'};
const CTX={pin:null};
if(state.wfPhase==null||!PH_LIST.some(p=>p.k===state.wfPhase))state.wfPhase='alap';
if(state.phLayout!=='list')state.phLayout='grid';
if(!R_TABS.some(t=>t.k===state.rTab))state.rTab='lay';

function phByKey(k){return PH_LIST.find(p=>p.k===k)||PH_LIST[0];}
function phBtnHtml(t){const at=['class="tool"'];if(t.mode)at.push(`data-mode="${t.mode}"`);if(t.a)at.push(`data-a="${t.a}"`);
  if(t.id)at.push(`id="${t.id}"`);if(t.role)at.push(`data-role="${t.role}"`);if(t.t)at.push(`title="${esc(t.t)}"`);
  return `<button ${at.join(' ')}>${esc(t.n)}</button>`;}
// a button without a data-mode runs its action; data-mode ones are bound by 08-interaction (setMode), id ones may be
// re-bound by their module — .onclick is assigned, so a later binding replaces this one instead of running twice
function phBind(root){root.querySelectorAll('.tool[data-a]:not([data-mode])').forEach(b=>{b.onclick=()=>{runAction(b.dataset.a);layoutSync(true);};});}
// built at load ($ of 08 is not defined yet), before the modules that bind some of these buttons by id
(function phBuild(){const al=document.getElementById('phAlways'),bd=document.getElementById('phBody');if(!al||!bd)return;
  al.innerHTML=PH_ALWAYS.map(phBtnHtml).join('');
  bd.innerHTML=PH_LIST.map(p=>`<div class="phGrid" data-ph="${p.k}">${p.tools.map(phBtnHtml).join('')}</div>`).join('');
  phBind(al);phBind(bd);})();

// ---- the context panel ----
function ctxKeyNow(){if(typeof STD_UI!=='undefined'&&STD_UI.on)return 'std';
  const cur=typeof toolCurrent==='function'?toolCurrent():null;
  if(cur&&CTX_OF_TOOL[cur.id])return CTX_OF_TOOL[cur.id];
  if(cur&&cur.id==='mode.build'&&state.buildType!=='stairs')return 'openings';
  return CTX.pin||phByKey(state.wfPhase).ctx;}
function ctxItem(keys){const body=$('ctxBody');if(!body)return null;const w=document.createElement('div');w.className='ctxItem';w.dataset.ctx=keys;body.appendChild(w);return w;}
// the floating panels of 08i / 08j are created on first use and appended to <body>: adopt them into their slot
function ctxAdopt(){[['rbPanel','rules'],['stdPanel','std']].forEach(([id,k])=>{const el=$(id);if(!el||el.parentElement.classList.contains('ctxItem'))return;
  const w=document.querySelector(`.ctxItem[data-ctx="${k}"]`)||ctxItem(k);w.appendChild(el);});}
function ctxRender(){const k=ctxKeyNow();
  if(k==='rules'&&typeof RB!=='undefined'){if(typeof rbPanelHost==='function')rbPanelHost();if(!RB.panel)rbPanel(true);}
  if(k==='std'&&typeof stdPanelHost==='function')stdPanelHost();
  ctxAdopt();
  document.querySelectorAll('#ctxBody > .ctxItem').forEach(w=>w.classList.toggle('on',(' '+w.dataset.ctx+' ').indexOf(' '+k+' ')>=0));
  return k;}

// ---- the phase navigator ----
let _phChk={key:null,map:{}};
function phCheck(p){const key=typeof shellModelKey==='function'?shellModelKey()+'|'+state.active:'';if(_phChk.key!==key)_phChk={key,map:{}};
  if(!(p.k in _phChk.map)){let bad=0,warn=0;const st=STAGES.find(s=>s.k===p.stage);
    try{(st?stageChecks(st):[]).forEach(i=>{if(i.sev==='error')bad++;else if(i.sev==='warn')warn++;});}catch(_){}
    _phChk.map[p.k]={bad,warn,txt:typeof wfCheck==='function'?wfCheck(p.k):''};}
  return _phChk.map[p.k];}
function phNavHtml(){return PH_LIST.map((p,i)=>{const c=phCheck(p);
  return `<button class="phB${p.k===state.wfPhase?' on':''}" data-ph="${p.k}" title="${esc(c.txt||'')}"><span class="no">${i+1}</span>${esc(t('phase.'+p.k,p.n))}`
   +(c.bad?`<span class="bd err">${c.bad}</span>`:c.warn?`<span class="bd">${c.warn}</span>`:'')+`</button>`;}).join('')
  +`<button id="phLayout" title="Fázisok: rács ↔ lista">${state.phLayout==='list'?'▦':'☰'}</button>`;}
let _layKey=null;
// called from statusBar() on every draw: cheap when nothing changed
function layoutSync(force){const nav=$('phaseNav');if(!nav)return;
  const tk=typeof toolKeyNow==='function'?toolKeyNow():state.mode;
  const key=[tk,state.wfPhase,(typeof STD_UI!=='undefined'&&STD_UI.on)?1:0,CTX.pin,state.activeLayer,state.phLayout,
    typeof shellModelKey==='function'?shellModelKey():'',state.active,state.rTab,state.lang||''].join('|');
  if(!force&&key===_layKey)return;_layKey=key;
  const html=phNavHtml();if(nav.__h!==html){nav.innerHTML=html;nav.__h=html;}
  nav.classList.toggle('list',state.phLayout==='list');
  document.querySelectorAll('#phBody > .phGrid').forEach(g=>g.classList.toggle('on',g.dataset.ph===state.wfPhase));
  const L=typeof lyrLayer==='function'?lyrLayer(state.activeLayer):null,role=L&&L.role;
  document.querySelectorAll('#phaseTools .tool[data-role]').forEach(b=>b.classList.toggle('on',b.dataset.role===role));
  document.querySelectorAll('#phaseTools .tool[data-a]').forEach(b=>{if(b.title)return;const a=actionById(b.dataset.a);if(a&&a.hint)b.title=a.hint;});
  if(!document.querySelector('#rTabs .rTab.on[data-k="'+state.rTab+'"]'))rTabSet(state.rTab);   // a loaded project brings its tab
  ctxRender();}
function phSet(k){if(!PH_LIST.some(p=>p.k===k))return false;CTX.pin=null;
  if(typeof wfPhase==='function')wfPhase(k);else state.wfPhase=k;
  const S=typeof stkActive==='function'?stkActive():null;if(!S)setStage(phByKey(k).stage);   // the inspector follows the phase
  layoutSync(true);draw();return true;}
function phLayoutToggle(){state.phLayout=state.phLayout==='list'?'grid':'list';layoutSync(true);return state.phLayout;}

// ---- the right column ----
function rTabSet(k){if(!R_TABS.some(t=>t.k===k))return;state.rTab=k;
  document.querySelectorAll('#rTabs .rTab').forEach(b=>b.classList.toggle('on',b.dataset.k===k));
  document.querySelectorAll('#rTabBody > .rTabPane').forEach(p=>p.classList.toggle('on',p.dataset.k===k));}

// Called once by 12-boot (buildDashboard) with every panel: put each in its home, dock the inspector, wire the clicks.
function layoutBuild(panels){const tabs=$('rTabs'),tb=$('rTabBody'),ins=$('inspector'),ri=$('rInsp');
  if(tabs&&tb){tabs.innerHTML=R_TABS.map(x=>`<button class="rTab" data-k="${x.k}">${esc(x.n)}</button>`).join('');
    tb.innerHTML=R_TABS.map(x=>`<div class="rTabPane" data-k="${x.k}"></div>`).join('');
    tabs.onclick=e=>{const b=e.target.closest('.rTab');if(b){rTabSet(b.dataset.k);if(typeof scheduleSave==='function')scheduleSave();}};}
  if(ins&&ri)ri.appendChild(ins);
  const hint=ctxItem('openings');if(hint)hint.innerHTML='<div class="ctxHint"><b>Ajtó / ablak</b><br>←/→: típus · ↑/↓: nyitásirány.<br>'
    +'A kilincs oldali helyek (kapcsoló, dugalj) nem látszanak: ha 300 mm-en belül teszel oda szerelvényt, a helyére pattan.</div>';
  (panels||[]).forEach(p=>{const home=PANEL_HOME[p.pid]||'el:mgjBody';
    if(home.indexOf('ctx:')===0){const w=ctxItem(home.slice(4));if(w)w.appendChild(p.el);}
    else if(home.indexOf('el:')===0){const el=document.getElementById(home.slice(3));if(el)el.appendChild(p.el);}   // T5 / T7: a menu or a floating panel
    else{const pane=document.querySelector(`#rTabBody > .rTabPane[data-k="${home.slice(4)}"]`);if(pane)pane.appendChild(p.el);}});
  const nav=$('phaseNav');if(nav)nav.onclick=e=>{if(e.target.closest('#phLayout')){phLayoutToggle();return;}const b=e.target.closest('.phB');if(b)phSet(b.dataset.ph);};
  // Szabályok lives in the context panel now: its button and action show it there (08i's toggle would hide it again)
  const rulesShow=()=>{CTX.pin='rules';if(typeof rbPanel==='function')rbPanel(true);layoutSync(true);};
  const rb=$('rbBtn');if(rb)rb.onclick=rulesShow;const ra=actionById('wf.rules');if(ra)registerAction(Object.assign({},ra,{run:rulesShow}));
  rTabSet(state.rTab);layoutSync(true);}

registerActions([
 {id:'wf.roomType',label:'Helyiségtípus',icon:'🏷',group:'Helyiség',alias:'room type kind helyiseg tipus kerek',
  hint:'Kattints egy helyiség belsejébe: a típus-kerék (Kijelölésben: dupla kattintás).',when:c=>!c.inEditor,
  run:()=>{setMode('room');$('hud').textContent='Helyiségtípus: kattints egy helyiség belsejébe (Kijelölésben: dupla kattintás).';}},
 {id:'wf.stairs',label:'Lépcső',icon:'🪜',group:'Nyílászáró',alias:'stairs lepcso',hint:'Lépcső a falhoz illesztve.',when:c=>!c.inEditor,
  run:()=>{setMode('build');state.buildType='stairs';const s=$('buildType');if(s)s.value='stairs';draw();}},
 {id:'wf.layer.SOC',label:'Dugaljak réteg',icon:'⚡',group:'Készülék',alias:'sockets dugalj reteg',hint:'Az Erősáram dugalj rétege lesz aktív.',run:()=>wfLayer('sys:SOC')},
 {id:'wf.layer.LIGHT',label:'Világítás réteg',icon:'💡',group:'Készülék',alias:'lights lamps switches kapcsolo reteg',hint:'A világítás rétege lesz aktív.',run:()=>wfLayer('sys:LIGHT')},
 {id:'wf.layer.DED',label:'Dedikált réteg',icon:'🔌',group:'Készülék',alias:'dedicated dedikalt reteg',hint:'A dedikált körök rétege lesz aktív.',run:()=>wfLayer('sys:DED')},
 {id:'view.phaseLayout',label:'Fázisok: rács ↔ lista',icon:'☰',group:'Nézet',alias:'phases grid list fazis racs lista',
  hint:'A bal felső fázisgombok két oszlopban vagy egy listában.',run:()=>phLayoutToggle()},
 {id:'phase.next',label:'Következő fázis',icon:'▶',group:'Nézet',alias:'next phase kovetkezo fazis',
  run:()=>{const i=PH_LIST.findIndex(p=>p.k===state.wfPhase);phSet(PH_LIST[Math.min(i+1,PH_LIST.length-1)].k);}},
 {id:'phase.prev',label:'Előző fázis',icon:'◀',group:'Nézet',alias:'previous phase elozo fazis',
  run:()=>{const i=PH_LIST.findIndex(p=>p.k===state.wfPhase);phSet(PH_LIST[Math.max(i-1,0)].k);}}]);

window.PH_LIST=PH_LIST;window.phSet=phSet;window.layoutSync=layoutSync;window.ctxKeyNow=ctxKeyNow;window.rTabSet=rTabSet;
window.phLayoutToggle=phLayoutToggle;window.layoutBuild=layoutBuild;window.CTX=CTX;
