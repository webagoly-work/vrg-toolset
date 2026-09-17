// ==========================================================================
// 01-state.js — the state object, layers, circuits sidebar, legacy shims
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// state ////////////////////
const state={rot:90,zoom:.5,panX:250,panY:180,exploded:true,wallMode:'translucent',style:'normal',
 levels:{basement:true,ground:true,upper:true},active:'ground',mode:'select',
 grid:false,gridSize:250,cableType:'lighting',drawHKey:'s1100',freeHeight:false,freeMm:1100,chaseFactor:1.6,chasePad:4,boxDepth:45,buildType:'door',
 flat:false,showLabels:true,labelSize:1,labelRot:0,
 side:0,wallLock:true,midFree:false,showDropCeil:true,wallThick:100,wallErase:false,pathType:'gege',toolsLoc:'side',
 waste:10,price:{},hoverR:null,hoverL:'ground',stairDef:{w:1000,riser:180,going:250,th:300},isoGrid:false,activeLayer:'L0',showRefs:false,pitch:30,flat:false,soloRoom:null,showRoomText:true,bg:null,bp:{dims:true,title:true,proj:'',addr:'',by:''},hDisp:'hover',objAng:0,gizmoSnap:true,mobile:false,objWallSnap:true,multiSelect:false,circHoverInfo:true,circHidden:{},circHi:null,devScale:0.72,pathScale:1};
const HORDER=['floor','s300','s500','s1100','s1300','s1400','s1900','gerinc','ceiling'];
const DEVORDER=['socket','switch','light','junction'];
const BUILDORDER=['door','window','stairs'];
const BUILDNAME={door:'Ajtó',window:'Ablak',stairs:'Lépcső'};
let layers=[{id:'L0',name:'Alap',visible:true,cats:{path:true,device:true,cable:true,wall:true,build:true,object:true}}];
function curLayer(){return state.activeLayer;}
function layerById(id){return layers.find(l=>l.id===id)||layers[0];}
function layerShows(item,cat){const L=layerById((item&&item.layer)||'L0');return L.visible&&(L.cats[cat]!==false);}
const CIRC={lighting:{c:'#e6a800',dash:'',name:'Világítás'},sockets:{c:'#2f79c9',dash:'',name:'Dugalj'},
 power3:{c:'#d1493f',dash:'7 4',name:'3 fázis'},data:{c:'#16a085',dash:'2 4',name:'Adat'}};
const DEV={socket:'Aljzat',switch:'Kapcsoló',light:'Lámpa',board:'Elosztószekrény',junction:'Kötődoboz',box:'Szerelvénydoboz'};
// EU/HU kapcsolótípusok: each defines terminals. in[] = supply points, out[] = switched outputs (each routable to a Device)
const SWITCH_TYPES=[
  {k:'101',l:'101 – Egypólusú (egysarkú)',        terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'1',kind:'out',l:'kapcsolt kimenet'}]},
  {k:'102',l:'102 – Kétpólusú',                   terms:[{id:'P1',kind:'in',l:'fázis 1'},{id:'P2',kind:'in',l:'fázis 2'},{id:'1',kind:'out',l:'kimenet 1'},{id:'2',kind:'out',l:'kimenet 2'}]},
  {k:'103',l:'103 – Csillár (kétáramkörös)',      terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'1',kind:'out',l:'kimenet 1'},{id:'2',kind:'out',l:'kimenet 2'}]},
  {k:'104',l:'104 – Nyomó (csengő)',              terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'1',kind:'out',l:'nyomó kimenet'}]},
  {k:'105',l:'105 – Váltó (alternatív)',          terms:[{id:'L',kind:'in',l:'közös (érkező)'},{id:'a',kind:'out',l:'járat a'},{id:'b',kind:'out',l:'járat b'}]},
  {k:'106',l:'106 – Kettős váltó',                terms:[{id:'L1',kind:'in',l:'közös 1'},{id:'a1',kind:'out',l:'1/a'},{id:'b1',kind:'out',l:'1/b'},{id:'L2',kind:'in',l:'közös 2'},{id:'a2',kind:'out',l:'2/a'},{id:'b2',kind:'out',l:'2/b'}]},
  {k:'107',l:'107 – Keresztkapcsoló',             terms:[{id:'1',kind:'in',l:'érkező 1'},{id:'2',kind:'in',l:'érkező 2'},{id:'3',kind:'out',l:'menő 1'},{id:'4',kind:'out',l:'menő 2'}]},
  {k:'108',l:'108 – Redőny (fel/le)',             terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'up',kind:'out',l:'fel'},{id:'dn',kind:'out',l:'le'}]}
];
function switchType(k){return SWITCH_TYPES.find(t=>t.k===k)||SWITCH_TYPES[0];}
const PATH_TYPES={gege:'Gégecső',csat:'Kábelcsatorna',mbcu:'MBCu falban',mu:'MŰ cső',custom:'Egyéb'};
const BUILDS=[{k:'sull_gege',l:'Süllyesztett – gégecső'},{k:'sull_mbcu',l:'Süllyesztett – MBCu'},
 {k:'kv_csat_kicsi',l:'Falon kívül – kábelcsatorna kicsi'},{k:'kv_csat_szeles',l:'Falon kívül – kábelcsatorna széles'},
 {k:'kv_mucso',l:'Falon kívül – MŰ csőben'},{k:'sull_custom',l:'Süllyesztett – egyéb'},{k:'kv_custom',l:'Falon kívül – egyéb'}];
const BUILDL={};BUILDS.forEach(b=>BUILDL[b.k]=b.l);
function buildSurface(k){return k.indexOf('kv_')===0;}          // falon kívül?
const WIRE_MM2=[0.75,1.5,2.5,4,6,10,16,25,35];
const WIRE_COLORS=['fekete','kék','zöld','barna','szürke'];
const CIRCUIT_COLORS=[ // named palette for circuits (áramkör színek a vizualizációhoz)
  {k:'zold',   l:'zöld',    c:'#1f9d55'},
  {k:'kek',    l:'kék',     c:'#2f6fb0'},
  {k:'piros',  l:'piros',   c:'#d84a3b'},
  {k:'narancs',l:'narancs', c:'#e8801c'},
  {k:'lila',   l:'lila',    c:'#8446c4'},
  {k:'sarga',  l:'sárga',   c:'#d9b400'},
  {k:'turkiz', l:'türkiz',  c:'#159b93'},
  {k:'magenta',l:'magenta', c:'#c43d8f'},
  {k:'barna',  l:'barna',   c:'#8a5a2b'},
  {k:'szurke', l:'szürke',  c:'#6f757d'}];
function circuitColor(c){if(!c)return '#1f9d55';const f=CIRCUIT_COLORS.find(x=>x.k===c.col);return f?f.c:'#1f9d55';}
// ---- circuits sidebar: collect every circuit on the drawing, keyed by num+name ----
function circuitKey(c){return (c.num||'')+'|'+(c.name||'');}
function collectCircuits(){const map=new Map();
  data.paths.forEach((pa,pi)=>{(pa.sections||[]).forEach((sec,si)=>{if(!sec)return;
    const list=(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]);
    list.forEach(c=>{if(!c||(!c.num&&!c.name))return;const k=circuitKey(c);
      if(!map.has(k))map.set(k,{key:k,num:c.num,name:c.name,col:c.col,count:c.count,mm2:c.mm2,segs:[],sample:c});
      map.get(k).segs.push({pi,si,c});});});});
  return [...map.values()].sort((a,b)=>(''+a.num).localeCompare(''+b.num,'hu',{numeric:true}));}
function renderCircuitList(){const box=$('circList');if(!box)return;const cs=collectCircuits();
  if(!cs.length){box.innerHTML='<div style="font-size:11px;color:#999;padding:6px">Még nincs áramkör. Rajzolj pályát és állíts be áramkört (jobb klikk a szakaszon → Áramkör).</div>';return;}
  state.circHidden=state.circHidden||{};
  box.innerHTML=cs.map(c=>{const hidden=state.circHidden[c.key],col=circuitColor(c);
    return `<div class="circItem" data-k="${esc(c.key)}" style="border:1px solid ${state.circHi===c.key?'#e8641c':'#e4dfd4'};border-radius:6px;padding:5px 6px;margin-bottom:4px;background:${state.circHi===c.key?'#fff7ef':'#fff'}">`
     +`<div style="display:flex;align-items:center;gap:6px">`
     +`<span style="width:14px;height:14px;border-radius:3px;background:${col};border:1px solid #999;flex:none;opacity:${hidden?0.3:1}"></span>`
     +`<b style="font-size:12px">${esc(c.num||'—')}</b> <span style="font-size:11.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name||'')}</span>`
     +`<button class="cToggle" data-k="${esc(c.key)}" title="láthatóság" style="font-size:12px">${hidden?'🚫':'👁'}</button>`
     +`</div>`
     +`<div style="font-size:10.5px;color:#777;margin-top:2px">${c.segs.length} szakasz · ${c.count||'?'}×${c.mm2||'?'}mm² · <a href="#" class="cHi" data-k="${esc(c.key)}">kiemel</a> · <a href="#" class="cEdit" data-k="${esc(c.key)}">szerkeszt</a> · <a href="#" class="cDel" data-k="${esc(c.key)}" style="color:#b33">töröl</a></div>`
     +`</div>`;}).join('');
  box.querySelectorAll('.cToggle').forEach(b=>b.onclick=()=>{const k=b.dataset.k;state.circHidden[k]=!state.circHidden[k];draw();});
  box.querySelectorAll('.cHi').forEach(a=>a.onclick=ev=>{ev.preventDefault();const k=a.dataset.k;state.circHi=(state.circHi===k?null:k);draw();});
  box.querySelectorAll('.cEdit').forEach(a=>a.onclick=ev=>{ev.preventDefault();editCircuit(a.dataset.k);});
  box.querySelectorAll('.cDel').forEach(a=>a.onclick=ev=>{ev.preventDefault();const k=a.dataset.k;
    openModal('Áramkör törlése','<div class="mrow">Biztosan törlöd ezt az áramkört minden szakaszról? (a pályák megmaradnak)</div>',()=>{pushUndo();
      collectCircuits().find(c=>c.key===k)?.segs.forEach(seg=>{const sec=data.paths[seg.pi].sections[seg.si];
        if(sec.circuit&&circuitKey(sec.circuit)===k)sec.circuit=null;
        if(sec.circuits)sec.circuits=sec.circuits.filter(x=>circuitKey(x)!==k);});renderCircuitList();draw();},'Törlés');});}
function editCircuit(k){const grp=collectCircuits().find(c=>c.key===k);if(!grp)return;
  openModal('Áramkör szerkesztése',circuitForm(grp.sample),()=>{pushUndo();const nc=readCircuit();
    // apply the edited fields to every segment carrying this circuit
    grp.segs.forEach(seg=>{const sec=data.paths[seg.pi].sections[seg.si];
      if(sec.circuit&&circuitKey(sec.circuit)===k)sec.circuit=Object.assign({},sec.circuit,nc);
      if(sec.circuits)sec.circuits=sec.circuits.map(x=>circuitKey(x)===k?Object.assign({},x,nc):x);});
    renderCircuitList();draw();});
  setTimeout(()=>{const sel=$('cCol'),sw=$('cColSw');if(sel&&sw)sel.onchange=()=>{const f=CIRCUIT_COLORS.find(x=>x.k===sel.value);sw.style.background=f?f.c:'#1f9d55';};},30);}
const DATA_KINDS=['UTP','USB','HDMI','koax','kisfeszültség'];
const PATHW=60;   // mm lane offset between parallel paths
const OBJLIB=[
 {cat:'Egyedi',items:[{n:'Egyedi méret…',custom:true,w:1000,d:600,h:800}]},
 {cat:'Bútor',items:[
  {n:'Ágy 200×160',w:1600,d:2000,h:550},{n:'Ágy 200×90',w:900,d:2000,h:550},
  {n:'Éjjeliszekrény',w:450,d:400,h:550},{n:'Szekrény 120',w:1200,d:600,h:2100},
  {n:'Gardrób 240',w:2400,d:600,h:2400},{n:'Komód',w:1000,d:450,h:800},
  {n:'Íróasztal',w:1400,d:700,h:750},{n:'Szék',w:450,d:450,h:900},
  {n:'Étkezőasztal 160',w:1600,d:900,h:750},{n:'Kanapé 3ü',w:2200,d:900,h:850},
  {n:'Fotel',w:800,d:800,h:850},{n:'Dohányzóasztal',w:1100,d:600,h:420},
  {n:'Könyvespolc',w:800,d:300,h:1800},{n:'TV szekrény',w:1600,d:400,h:500}]},
 {cat:'Konyha',items:[
  {n:'Konyhapult 60',w:600,d:600,h:900},{n:'Konyhapult 120',w:1200,d:600,h:900},
  {n:'Mosogató',w:600,d:500,h:900},{n:'Tűzhely 60',w:600,d:600,h:900},
  {n:'Sütő beépített',w:600,d:600,h:600},{n:'Hűtő 60',w:600,d:650,h:1850},
  {n:'Mosogatógép 60',w:600,d:600,h:850},{n:'Páraelszívó',w:600,d:500,h:600},
  {n:'Felsőszekrény',w:600,d:350,h:700}]},
 {cat:'Fürdő / WC',items:[
  {n:'Kád 170×75',w:1700,d:750,h:600},{n:'Zuhanytálca 90×90',w:900,d:900,h:150},
  {n:'Mosdó 60',w:600,d:450,h:850},{n:'WC csésze',w:400,d:700,h:800},
  {n:'Bidé',w:400,d:600,h:400},{n:'Mosógép 60',w:600,d:600,h:850},
  {n:'Szárítógép 60',w:600,d:600,h:850},{n:'Törölközőradiátor',w:500,d:100,h:1200}]},
 {cat:'Gépészet',items:[
  {n:'Elosztószekrény',w:600,d:150,h:800},{n:'Kazán fali',w:450,d:350,h:800},
  {n:'HMV tároló 200l',w:600,d:600,h:1500},{n:'Hőszivattyú kültéri',w:1000,d:400,h:900},
  {n:'Szellőzőgép',w:800,d:600,h:1200},{n:'Radiátor 1000',w:1000,d:100,h:600},
  {n:'Villanyóra szekrény',w:400,d:200,h:600}]},
 {cat:'Egyéb',items:[
  {n:'Oszlop 30×30',w:300,d:300,h:2700},{n:'Kandalló',w:900,d:500,h:1200},
  {n:'Beépített szekrény',w:2000,d:600,h:2700},{n:'Doboz / raklap',w:1200,d:800,h:1000}]}];
let objPick={n:'Egyedi méret…',custom:true,w:1000,d:600,h:800};
const circOn={lighting:true,sockets:true,power3:true,data:true};
let GUIDES=[{k:'floor',mm:0,l:'Padló 0',c:'#8a5a2b',vis:false,jump:true,sys:true},
 {k:'s300',mm:300,l:'300 Dugalj',c:'#d21e1e',vis:false,jump:true},
 {k:'metervonal',mm:1000,l:'Métervonal 1000',c:'#e8641c',vis:false,jump:true},
 {k:'s500',mm:500,l:'500 Gépek',c:'#ef8a12',vis:false,jump:true},
 {k:'s1100',mm:1100,l:'1100 Kapcsoló',c:'#e4c412',vis:false,jump:true},
 {k:'s1300',mm:1300,l:'1300 Panel/termosztát',c:'#9bbf1a',vis:false,jump:true},
 {k:'s1400',mm:1400,l:'1400 IP44',c:'#3fae55',vis:false,jump:true},
 {k:'s1900',mm:1900,l:'1900 Lámpa/vent.',c:'#1f9b9b',vis:false,jump:true},
 {k:'alcell',mm:'alcell',l:'Álmennyezet',c:'#2f9e8f',vis:false,jump:true,sys:true},
 {k:'ceiling',mm:'ceil',l:'Mennyezet',c:'#2f6fb0',vis:false,jump:true,sys:true},
 {k:'gerinc',mm:'gerinc',l:'Süllyesztett gerinc',c:'#16357a',vis:false,jump:true}];
const GUIDES_DEFAULT=JSON.parse(JSON.stringify(GUIDES)); // for per-guide "reset height"
// legacy shims so old code paths keep working while we migrate
const guideOn=new Proxy({},{get:(_,k)=>{const g=GUIDES.find(x=>x.k===k);return g?g.vis:false;},set:(_,k,v)=>{const g=GUIDES.find(x=>x.k===k);if(g)g.vis=!!v;return true;}});
const customG=[];
function guideByKey(k){return GUIDES.find(x=>x.k===k);}
function resolveMm(def,level){if(def.mm==='ceil')return wallH(level);if(def.mm==='gerinc')return Math.max(0,wallH(level)-300);
  if(def.mm==='alcell')return dropCeilOrDefault(level,null);
  if(def.mm!=null)return def.mm;return 0;}
function isFreeHeight(){if(state.freeHeight)return true;
  if(state.drawHKey==='floor'||state.drawHKey==='ceiling')return true;
  // optional: nothing between Padló and Mennyezet is bound to a wall either
  if(state.midFree){const l=state.active,mm=drawHmm(l);
    if(mm>1&&mm<wallH(l)-1)return true;}
  return false;}
function drawHmm(level){if(state.freeHeight)return Math.max(0,state.freeMm||0);
  const d=guideByKey(state.drawHKey);return d?resolveMm(d,level):0;}
// which preset (if any) does the current free-mode height coincide with?
function freeCoincides(level){if(!state.freeHeight)return null;const mm=drawHmm(level);
  return GUIDES.find(g=>Math.abs(resolveMm(g,level)-mm)<1)||null;}
function jumpList(level){return GUIDES.filter(g=>g.jump!==false).map(g=>({g,mm:resolveMm(g,level)})).sort((a,b)=>a.mm-b.mm);}
function stepHeight(dir){const level=state.active;
  if(state.freeHeight){state.freeMm=Math.max(0,Math.round(((state.freeMm||0)+dir*100)/100)*100);
    const co=freeCoincides(level);$('hud').textContent='Szabad magasság → '+state.freeMm+' mm'+(co?(' (= '+co.l+')'):'');draw();syncHeightUI();return;}
  const list=jumpList(level);if(!list.length)return;
  const cur=drawHmm(level);let idx=list.findIndex(x=>x.g.k===state.drawHKey);
  if(idx<0){ // current key not in jump list — snap to nearest by mm in the step direction
    idx=0;let best=1e9;list.forEach((x,i)=>{const dd=Math.abs(x.mm-cur);if(dd<best){best=dd;idx=i;}});}
  else idx=Math.max(0,Math.min(list.length-1,idx+dir));
  state.drawHKey=list[idx].g.k;const sel=$('drawH');if(sel)sel.value=state.drawHKey;
  $('hud').textContent='Rajz magasság → '+list[idx].g.l+' ('+list[idx].mm+' mm)';draw();syncHeightUI();}
function syncHeightUI(){const sel=$('drawH');if(sel&&!state.freeHeight)sel.value=state.drawHKey;
  const fc=$('freeHeightChk');if(fc)fc.checked=!!state.freeHeight;
  const fm=$('freeMmBox');if(fm)fm.style.display=state.freeHeight?'flex':'none';
  const fv=$('freeMmVal');if(fv)fv.textContent=(state.freeMm||0)+' mm';}
const data={v:SCHEMA_VERSION,seq:0,cables:[],paths:[],devices:[],notes:[],measures:[],openings:[],floors:[],objects:[],roofs:[],wallNotes:[],noteHide:{}};
let draft=null,pathDraft=null,measureDraft=null,cursor=null,lock=null,wallStart=null,floorStart=null,roofStart=null,dragItem=null,bothPan=false,objGhost=null,buildGhost=null;const undo=[],redo=[];

