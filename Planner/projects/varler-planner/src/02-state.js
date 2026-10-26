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
 waste:10,price:{},hoverR:null,hoverL:'ground',stairDef:{w:1000,riser:180,going:250,th:300},isoGrid:false,activeLayer:'L0',showRefs:false,pitch:30,flat:false,soloRoom:null,showRoomText:true,bg:null,bp:{dims:true,title:true,proj:'',addr:'',by:''},bpScale:50,bpFine:1,hDisp:'hover',objAng:0,gizmoSnap:true,mobile:false,objWallSnap:true,multiSelect:false,circHoverInfo:true,circHidden:{},circHi:null,devScale:0.72,pathScale:1,viewScale:1,camPreset:null,camLock:false,camLockPitch:null,cutH:1500,cutNearH:1000,planCutH:1200,printPal:true};
// ---- keyboard layouts (round 2026-10-10, WP-U4) ----
// Plain W A S D / Q E are the camera, always — they used to move the selection in Move mode and a selected object in
// Select mode, so the same key panned or nudged depending on what happened to be selected. The selection now moves
// with Shift + the same keys in both layouts; 'ijkl' adds plain I J K L / U O and so moves two tool keys off J and K.
// Lives this early because every module's hint text names these keys through kbdKey() — never a hard-coded letter.
const KBD_LAYOUTS={
  shift:{n:'Shift + WASD',move:null,rot:null,markWall:'j',circuit:'k'},
  ijkl:{n:'IJKL',move:{i:[0,-1],j:[-1,0],k:[0,1],l:[1,0]},rot:{u:-1,o:1},markWall:'t',circuit:'n'}};   // T / N: M and C are Move and Cable
const KBD_SHIFT={move:{w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]},rot:{q:-1,e:1}};   // Shift + these, in both layouts
function kbdLayout(){return KBD_LAYOUTS[state.kbdLayout]?state.kbdLayout:'shift';}
function kbdKey(k){return String(KBD_LAYOUTS[kbdLayout()][k]||'').toUpperCase();}
const HORDER=['floor','s300','s500','s1100','s1300','s1400','s1900','gerinc','ceiling'];
const DEVORDER=['socket','switch','light','junction'];
const BUILDORDER=['door','window','stairs'];
const BUILDNAME={door:'Ajtó',window:'Ablak',stairs:'Lépcső'};
// Sub-layer categories (panel order). opt:true = shown only when the layer has such items.
// Sits ABOVE `let layers` because the default layer is built from it at load time (TDZ otherwise).
const LAYER_CATS=[
 {k:'path',  n:'Pályák'},
 {k:'socket',n:'Dugaljak'},
 {k:'switch',n:'Kapcsolók'},
 {k:'light', n:'Lámpák'},
 {k:'device',n:'Eszközök'},                 // every other device: dobozok, elosztó, RBX, BASE, végpontok
 {k:'wall',  n:'Falak'},
 {k:'door',  n:'Ajtók'},
 {k:'window',n:'Ablakok'},
 {k:'stairs',n:'Lépcsők'},
 {k:'object',n:'Tárgyak'},
 {k:'floor', n:'Padló / helyiség',opt:true},
 {k:'roof',  n:'Tetők',opt:true},
 {k:'note',  n:'Jegyzetek',opt:true},
 {k:'cable', n:'Kábelek (régi)',opt:true},
 {k:'mark',  n:'Jelölések',opt:true},
 {k:'trace', n:'Mozgásnyomok',opt:true}];
const LAYER_CATS_V1={device:['socket','switch','light','device'],build:['door','window','stairs','floor','roof']};
function layerCatsAll(on){const o={};LAYER_CATS.forEach(c=>o[c.k]=on!==false);return o;}
let layers=[{id:'L0',name:'Alap',visible:true,cats:layerCatsAll()}];
let stacks=[];
function curLayer(){return state.activeLayer;}
function layerById(id){return layers.find(l=>l.id===id)||layers[0];}
function layerShows(item,cat){const L=layerById((item&&item.layer)||'L0');cat=lyrCat(item,cat);
  return L.visible&&(L.cats[cat]!==false);}
const CIRC={lighting:{c:'#e6a800',dash:'',name:'Világítás'},sockets:{c:'#2f79c9',dash:'',name:'Dugalj'},
 power3:{c:'#d1493f',dash:'7 4',name:'3 fázis'},data:{c:'#16a085',dash:'2 4',name:'Adat'}};
const DEV={socket:'Aljzat',switch:'Kapcsoló',light:'Lámpa',board:'Elosztószekrény',junction:'Kötődoboz',box:'Szerelvénydoboz'};
// HU kapcsolótípusok: each defines terminals. in[] = supply points, out[] = switched outputs (each routable to a Device)
// ⚠ DO NOT CHANGE THESE NUMBERS. They are the Hungarian switch codes in current use, given by the user (2026-10-14) after
// the SECOND time an assistant got them wrong. The code has GAPS — the numbers are not a 1, 2, 3 … list of kinds:
//   100 impulzuskapcsoló · 101 egypólusú · 102 kétpólusú (+N) · 103 háromfázisú · 104 régi szabvány, nem használt ·
//   105 CSILLÁR ("101+1") · 106 VÁLTÓ · 107 keresztkapcsoló · 108 dupla váltó ("106+6")
// 105 is the csillár, NOT the váltó; 106 is the váltó, NOT a double. The shutter switch has no number here ('redony').
// Until 2026-10-14 this table had 103 csillár / 104 nyomó / 105 váltó / 106 kettős váltó / 108 redőny — swNumMigrate()
// maps a device saved with those keys once (marked swNum:2). See docs/workflow/01_MATERIAL.md §5.
const SWITCH_TYPES=[
  {k:'100',l:'100 – Impulzuskapcsoló (nyomó)',    terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'1',kind:'out',l:'nyomó kimenet'}]},
  {k:'101',l:'101 – Egypólusú',                   terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'1',kind:'out',l:'kapcsolt kimenet'}]},
  {k:'102',l:'102 – Kétpólusú (+N)',              terms:[{id:'P1',kind:'in',l:'fázis 1'},{id:'P2',kind:'in',l:'fázis 2'},{id:'1',kind:'out',l:'kimenet 1'},{id:'2',kind:'out',l:'kimenet 2'}]},
  {k:'103',l:'103 – Háromfázisú',                 terms:[{id:'L1',kind:'in',l:'L1'},{id:'L2',kind:'in',l:'L2'},{id:'L3',kind:'in',l:'L3'},{id:'1',kind:'out',l:'L1 ki'},{id:'2',kind:'out',l:'L2 ki'},{id:'3',kind:'out',l:'L3 ki'}]},
  {k:'105',l:'105 – Csillárkapcsoló (101+1)',     terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'1',kind:'out',l:'kimenet 1'},{id:'2',kind:'out',l:'kimenet 2'}]},
  {k:'106',l:'106 – Váltókapcsoló',               terms:[{id:'L',kind:'in',l:'közös (érkező)'},{id:'a',kind:'out',l:'járat a'},{id:'b',kind:'out',l:'járat b'}]},
  {k:'107',l:'107 – Keresztkapcsoló',             terms:[{id:'1',kind:'in',l:'érkező 1'},{id:'2',kind:'in',l:'érkező 2'},{id:'3',kind:'out',l:'menő 1'},{id:'4',kind:'out',l:'menő 2'}]},
  {k:'108',l:'108 – Dupla váltókapcsoló (106+6)', terms:[{id:'L1',kind:'in',l:'közös 1'},{id:'a1',kind:'out',l:'1/a'},{id:'b1',kind:'out',l:'1/b'},{id:'L2',kind:'in',l:'közös 2'},{id:'a2',kind:'out',l:'2/a'},{id:'b2',kind:'out',l:'2/b'}]},
  {k:'redony',l:'Redőnykapcsoló (fel/le)',        terms:[{id:'P',kind:'in',l:'fázis (bemenet)'},{id:'up',kind:'out',l:'fel'},{id:'dn',kind:'out',l:'le'}]},
  // 2026-10-26: a switch-sensor (mozgás / jelenlét) — it needs N; a normal switch on its leg is Kizárás or Szabotázs (08s)
  {k:'erzekelo',l:'Kapcsoló-érzékelő (mozgás / jelenlét)',terms:[{id:'L',kind:'in',l:'fázis'},{id:'N',kind:'in',l:'nulla'},{id:'1',kind:'out',l:'kapcsolt kimenet'}]}
];
function switchType(k){return SWITCH_TYPES.find(t=>t.k===k)||SWITCH_TYPES.find(t=>t.k==='101');}
// a switch saved under the OLD (wrong) keys gets the right one, once — swNum:2 marks a device already on the new code
const SW_OLD_TO_NEW={'103':'105','104':'100','105':'106','106':'108','108':'redony'};
// only a switch that HAS a type and no marker is touched — a current file passes through unchanged
function swNumMigrate(d){let n=0;((d&&d.devices)||[]).forEach(x=>{if(!x||x.type!=='switch'||!x.swType||x.swNum===2)return;
  if(SW_OLD_TO_NEW[x.swType]){x.swType=SW_OLD_TO_NEW[x.swType];n++;}x.swNum=2;});return n;}
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
const OBJLIB=[   // generated from docs/views/OBJECTS-CATALOGUE.md by tools/objlib-gen.js — edit the catalogue, not this
 {cat:'Egyedi',items:[
  {n:'Egyedi méret…',custom:true,w:1000,d:600,h:800}
 ]},
 {cat:'Nappali',items:[
  {n:'Kanapé 3ü',w:2200,d:900,h:850,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Kanapé 2ü',w:1600,d:900,h:850,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Sarokkanapé L',w:2700,d:1700,h:850,room:'Nappali',art:['F','L','R','T']},
  {n:'Fotel',w:800,d:800,h:850,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Dohányzóasztal',w:1100,d:600,h:420,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Kisasztal Ø50',w:500,d:500,h:600,room:'Nappali',art:['F','T']},
  {n:'TV szekrény',w:1600,d:400,h:500,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'TV 65" (falon)',w:1450,d:60,h:830,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Médiafal / beépített',w:3000,d:450,h:2400,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Könyvespolc',w:800,d:300,h:1800,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Komód / polc',w:2800,d:300,h:800,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Polc',w:800,d:300,h:800,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Vitrin',w:900,d:400,h:1900,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Állólámpa',w:400,d:400,h:1600,room:'Nappali',art:['F','T']},
  {n:'Hangfal álló',w:250,d:300,h:1000,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Kandalló',w:900,d:500,h:1200,room:'Nappali',art:['F','L','T'],sym:true},
  {n:'Zongora (pianínó)',w:1500,d:600,h:1250,room:'Nappali',art:['F','L','T'],sym:true}
 ]},
 {cat:'Hálószoba',items:[
  {n:'Ágy 200×160',w:1600,d:2000,h:550,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Ágy 200×180',w:1800,d:2000,h:550,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Ágy 200×90',w:900,d:2000,h:550,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Ágy fejvéggel (1100)',w:1700,d:2100,h:1100,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Éjjeliszekrény',w:450,d:400,h:550,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Szekrény 120',w:1200,d:600,h:2100,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Gardrób 240',w:2400,d:600,h:2400,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Tolóajtós gardrób 300',w:3000,d:650,h:2600,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Komód',w:1000,d:450,h:800,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Fésülködőasztal',w:1000,d:450,h:750,room:'Hálószoba',art:['F','L','T'],sym:true},
  {n:'Tükör álló',w:600,d:50,h:1700,room:'Hálószoba',art:['F','L'],sym:true}
 ]},
 {cat:'Gyerekszoba',items:[
  {n:'Emeletes ágy',w:1000,d:2000,h:1600,room:'Gyerekszoba',art:['F','L','T'],sym:true},
  {n:'Kiságy',w:700,d:1300,h:900,room:'Gyerekszoba',art:['F','L','T'],sym:true},
  {n:'Pelenkázó',w:900,d:550,h:950,room:'Gyerekszoba',art:['F','L','T'],sym:true},
  {n:'Játéktároló',w:1000,d:400,h:900,room:'Gyerekszoba',art:['F','L','T'],sym:true}
 ]},
 {cat:'Dolgozó',items:[
  {n:'Íróasztal',w:1400,d:700,h:750,room:'Dolgozó',art:['F','L','T'],sym:true},
  {n:'Állítható íróasztal',w:1600,d:800,h:650,room:'Dolgozó',art:['F','L','T'],sym:true},
  {n:'Irodai szék',w:650,d:650,h:1100,room:'Dolgozó',art:['F','L','T'],sym:true},
  {n:'Monitor 27"',w:620,d:200,h:520,room:'Dolgozó',art:['F','L','T'],sym:true},
  {n:'Iratszekrény',w:800,d:400,h:1200,room:'Dolgozó',art:['F','L','T'],sym:true}
 ]},
 {cat:'Étkező',items:[
  {n:'Étkezőasztal 160',w:1600,d:900,h:750,room:'Étkező',art:['F','L','T'],sym:true},
  {n:'Étkezőasztal 120',w:1200,d:800,h:750,room:'Étkező',art:['F','L','T'],sym:true},
  {n:'Kerek asztal Ø110',w:1100,d:1100,h:750,room:'Étkező',art:['F','T']},
  {n:'Szék',w:450,d:450,h:900,room:'Étkező',art:['F','L','T'],sym:true},
  {n:'Bárszék',w:400,d:400,h:750,room:'Étkező',art:['F','L','T'],sym:true},
  {n:'Tálalószekrény',w:1600,d:450,h:850,room:'Étkező',art:['F','L','T'],sym:true},
  {n:'Függeszték (asztal fölé)',w:1200,d:300,h:600,room:'Étkező',art:['F','L','T'],sym:true}
 ]},
 {cat:'Konyha',items:[
  {n:'Konyhapult 60',w:600,d:600,h:900,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Konyhapult 120',w:1200,d:600,h:900,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Konyhapult',w:1100,d:600,h:900,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Konyhapult (sarok)',w:600,d:600,h:900,room:'Konyha',art:['F','L','R','T']},
  {n:'Fiókos alsó 60',w:600,d:600,h:900,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Felsőszekrény',w:600,d:350,h:700,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Magas szekrény (beépítő)',w:600,d:600,h:2200,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Kamrapolc',w:860,d:400,h:1800,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Konyhasziget',w:1800,d:900,h:900,room:'Konyha',art:['F','L','R','T']},
  {n:'Mosogató',w:600,d:500,h:900,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Tűzhely 60',w:600,d:600,h:900,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Indukciós főzőlap (sziget)',w:770,d:520,h:60,room:'Konyha',art:['F','T']},
  {n:'Sütő beépített',w:600,d:600,h:600,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Mikró beépített',w:600,d:400,h:380,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Hűtő 60',w:600,d:650,h:1850,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Amerikai hűtő',w:900,d:700,h:1780,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Mosogatógép 60',w:600,d:600,h:850,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Páraelszívó',w:600,d:500,h:600,room:'Konyha',art:['F','L','T'],sym:true},
  {n:'Kávégép (pult)',w:300,d:450,h:380,room:'Konyha',art:['F','L','T'],sym:true}
 ]},
 {cat:'Fürdő / WC',items:[
  {n:'WC csésze',w:400,d:700,h:800,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Fali WC + tartály (beépített)',w:360,d:540,h:400,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Bidé',w:400,d:600,h:400,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Mosdó 60',w:600,d:450,h:850,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Mosdó 40',w:350,d:400,h:850,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Kézmosó',w:450,d:300,h:850,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Mosdószekrény 80',w:800,d:460,h:850,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Tükrös szekrény',w:800,d:150,h:700,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Kád 170×75',w:1700,d:750,h:600,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Zuhanytálca 90×90',w:900,d:900,h:150,room:'Fürdő / WC',art:['F','T']},
  {n:'Zuhanytálca 80×80',w:800,d:800,h:150,room:'Fürdő / WC',art:['F','T']},
  {n:'Zuhanyfal (walk-in)',w:1200,d:10,h:2000,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Mosógép 60',w:600,d:600,h:850,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Szárítógép 60',w:600,d:600,h:850,room:'Fürdő / WC',art:['F','L','T'],sym:true},
  {n:'Törölközőradiátor',w:500,d:100,h:1200,room:'Fürdő / WC',art:['F','L'],sym:true}
 ]},
 {cat:'Előszoba',items:[
  {n:'Cipősszekrény',w:1400,d:300,h:900,room:'Előszoba',art:['F','L','T'],sym:true},
  {n:'Fogas / előszobafal',w:1200,d:350,h:1900,room:'Előszoba',art:['F','L','T'],sym:true},
  {n:'Pad',w:1000,d:350,h:450,room:'Előszoba',art:['F','L','T'],sym:true}
 ]},
 {cat:'Gépészet / BRIDGE',items:[
  {n:'Elosztószekrény',w:600,d:150,h:800,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'BASE szekrény (NET/COMP/MEDIA)',w:600,d:400,h:900,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'RBX doboz',w:400,d:120,h:300,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Rack 19" 12U (fali)',w:600,d:450,h:640,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Villanyóra szekrény',w:400,d:200,h:600,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Kazán fali',w:450,d:350,h:800,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'HMV tároló 200l',w:600,d:600,h:1500,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Hőszivattyú kültéri',w:1000,d:400,h:900,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Klíma beltéri',w:900,d:220,h:300,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Klíma kültéri',w:800,d:300,h:550,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Szellőzőgép',w:800,d:600,h:1200,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Radiátor 1000',w:1000,d:100,h:600,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Padlófűtés osztó',w:600,d:110,h:450,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Napelem inverter',w:450,d:200,h:600,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true},
  {n:'Akkumulátor (otthoni)',w:600,d:200,h:1000,room:'Gépészet / BRIDGE',art:['F','L','T'],sym:true}
 ]},
 {cat:'Kültér / terasz',items:[
  {n:'Kerti asztal 70×70',w:700,d:700,h:740,room:'Kültér / terasz',art:['F','L','T'],sym:true},
  {n:'Kerti szék',w:450,d:450,h:850,room:'Kültér / terasz',art:['F','L','T'],sym:true},
  {n:'Napozóágy',w:700,d:1900,h:350,room:'Kültér / terasz',art:['F','L','T'],sym:true},
  {n:'Növény (cserepes)',w:500,d:500,h:1200,room:'Kültér / terasz',art:['F','T']},
  {n:'Kaputelefon kültéri',w:120,d:40,h:300,room:'Kültér / terasz',art:['F','L'],sym:true}
 ]},
 {cat:'Építészeti / egyéb',items:[
  {n:'Oszlop 30×30',w:300,d:300,h:2700,room:'Építészeti / egyéb',art:['F','T']},
  {n:'Beépített szekrény',w:2000,d:600,h:2700,room:'Építészeti / egyéb',art:['F','L','T'],sym:true},
  {n:'Doboz / raklap',w:1200,d:800,h:1000,room:'Építészeti / egyéb',art:['F','T']},
  {n:'Függöny / roló (ablak)',w:1400,d:100,h:2400,room:'Építészeti / egyéb',art:['F','L'],sym:true}
 ]}
];
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
function guideByKey(k){return GUIDES.find(x=>x.k===k)||(k==='slab'&&typeof SLB_GUIDE!=='undefined'?SLB_GUIDE:undefined);}   // 08p: the födém-alja pseudo guide
// T6 (docs/ui-tidy): ONE height source. A guide line that stands for a Standards row (08j STD_H) takes that row's height
// — the project's value, else the table's — so the guide, the draw height (↑/↓) and the placed devices never disagree.
// 'gerinc' is the trunk height the E5 engine uses: the project's PATH trunk value, else the ceiling − 250 (E5-Q3).
// A guide the user made keeps its own number. The numbers in the default labels follow the value (guideLabel).
const GUIDE_STD={s300:['SOC','alap'],s500:['SOC','garazs'],s1100:['SWI','alap'],s1300:['PAN','alap'],s1400:['SOC','borotva'],s1900:['LMP','fali']};
function guideStd(def){return def&&GUIDE_STD[def.k]&&typeof stdH==='function'?GUIDE_STD[def.k]:null;}
function resolveMm(def,level){if(def.mm==='ceil')return wallH(level);
  if(def.mm==='slab')return -slbT(level);
  if(def.mm==='gerinc'){const o=typeof stdList==='function'?stdList().find(x=>x.code==='PATH'&&x.hv==='trunk'&&x.scope==='project'):null;return o?+o.h:Math.max(0,wallH(level)-250);}
  if(def.mm==='alcell')return dropCeilOrDefault(level,null);
  const sd=guideStd(def);if(sd){const h=stdH(sd[0],sd[1]);if(typeof h==='number'&&isFinite(h))return h;}
  if(def.mm!=null)return def.mm;return 0;}
function guideLabel(def,level){if(!def)return '';if(!guideStd(def))return def.l;
  return resolveMm(def,level==null?state.active:level)+' '+String(def.l||'').replace(/^\s*\d+\s*/,'');}
function isFreeHeight(){if(state.freeHeight)return true;
  if(state.drawHKey==='floor'||state.drawHKey==='ceiling')return true;
  // optional: nothing between Padló and Mennyezet is bound to a wall either
  if(state.midFree){const l=state.active,mm=drawHmm(l);
    if(mm>1&&mm<wallH(l)-1)return true;}
  return false;}
function drawHmm(level){if(state.freeHeight)return Math.max(-slbT(level),state.freeMm||0);
  const d=guideByKey(state.drawHKey);return d?resolveMm(d,level):0;}
// which preset (if any) does the current free-mode height coincide with?
function freeCoincides(level){if(!state.freeHeight)return null;const mm=drawHmm(level);
  return GUIDES.find(g=>Math.abs(resolveMm(g,level)-mm)<1)||null;}
function jumpList(level){const L=GUIDES.filter(g=>g.jump!==false).map(g=>({g,mm:resolveMm(g,level)}));
  if(slbT(level)>0&&typeof SLB_GUIDE!=='undefined')L.push({g:SLB_GUIDE,mm:-slbT(level)});   // 08p: through the slab, down to the lower ceiling
  return L.sort((a,b)=>a.mm-b.mm);}
function stepHeight(dir){const level=state.active;
  if(state.freeHeight){state.freeMm=Math.max(-slbT(level),Math.round(((state.freeMm||0)+dir*100)/100)*100);
    const co=freeCoincides(level);$('hud').textContent='Szabad magasság → '+state.freeMm+' mm'+(co?(' (= '+guideLabel(co,level)+')'):'');draw();syncHeightUI();return;}
  const list=jumpList(level);if(!list.length)return;
  const cur=drawHmm(level);let idx=list.findIndex(x=>x.g.k===state.drawHKey);
  if(idx<0){ // current key not in jump list — snap to nearest by mm in the step direction
    idx=0;let best=1e9;list.forEach((x,i)=>{const dd=Math.abs(x.mm-cur);if(dd<best){best=dd;idx=i;}});}
  else idx=Math.max(0,Math.min(list.length-1,idx+dir));
  state.drawHKey=list[idx].g.k;const sel=$('drawH');if(sel)sel.value=state.drawHKey;
  $('hud').textContent='Rajz magasság → '+guideLabel(list[idx].g,level)+' ('+list[idx].mm+' mm)';draw();syncHeightUI();}
function syncHeightUI(){const sel=$('drawH');if(sel&&!state.freeHeight)sel.value=state.drawHKey;
  const fc=$('freeHeightChk');if(fc)fc.checked=!!state.freeHeight;
  const fm=$('freeMmBox');if(fm)fm.style.display=state.freeHeight?'flex':'none';
  const fv=$('freeMmVal');if(fv)fv.textContent=(state.freeMm||0)+' mm';}
const data={v:SCHEMA_VERSION,seq:0,cables:[],paths:[],devices:[],notes:[],measures:[],openings:[],floors:[],objects:[],roofs:[],wallNotes:[],circuits:[],marks:[],traces:[],runs:[],noteHide:{}};
let draft=null,pathDraft=null,measureDraft=null,cursor=null,lock=null,wallStart=null,floorDraft=null,roofStart=null,dragItem=null,bothPan=false,objGhost=null,buildGhost=null;const undo=[],redo=[];

