// ==========================================================================
// 05m-stack.js — BRIDGE Stack: a preset group of layers, one per role (WP-B1)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A stack is METADATA over ordinary layers [Q10=A]: each stack layer is a normal layer carrying
// L.stack (the stack id) and L.role (a STK_ROLES key), so every existing tool keeps working on it.
// The record lives in the session global `stacks`: {id, name, kind:'bridge', scale:'S-C', layers:[…], phase}.
// Prefix: stk. Everything here is a function or a table read inside functions.

const STK_ROLES=[      // order = panel order = stage order. fam = default conduit family (01_CATALOGUES §7)
 {k:'construct',  n:'Szerkezet',   ph:1, cats:['wall','floor','door','window','stairs','object'], hint:'Padló, falak, ajtók, ablakok, helyiségek.'},
 {k:'mark',       n:'Jelölés',     ph:1, cats:['mark','trace'], hint:'Szabályok, tiltások, preferenciák, mozgásnyomok.'},
 {k:'hw',         n:'Hardver',     ph:1, cats:['device'], hint:'Elosztószekrény, mérőóra, adatbelépés, RBX dobozok.'},
 {k:'base',       n:'BASE',        ph:1, cats:['device'], hint:'NET · COMP · MEDIA.'},
 {k:'channel',    n:'Csatorna',    ph:1, cats:['path'],   hint:'Fizikai összeköttetés két hardverpont között.'},
 // Erősáram is three layers since round 2026-10-10 (WP-M1): dedicated · sockets · lighting (lamps + switches + shutters).
 // All three keep fam:'MAINS', so the fill, the conduit packing and the cabinet see one family as before.
 {k:'sys:DED',    n:'Dedikált körök',         ph:2, fam:'MAINS'},
 {k:'sys:SOC',    n:'Dugaljak',               ph:2, fam:'MAINS'},
 {k:'sys:LIGHT',  n:'Világítás',              ph:2, fam:'MAINS'},
 {k:'sys:LV',     n:'Törpefeszültség — A busz', ph:2, fam:'LV'},
 {k:'sys:BUSB',   n:'Biztosított 24 V — B busz',ph:2, fam:'BUSB'},
 {k:'sys:CONTROL',n:'Vezérlés (BRIDGE_LINK)', ph:2, fam:'CONTROL'},
 {k:'sys:DATA',   n:'Adat / PoE',             ph:2, fam:'DATA'},
 {k:'sys:KNX',    n:'KNX',                    ph:2, fam:'KNX', off:true},   // CLA: not taken
 {k:'sys:SENSOR', n:'Érzékelők',              ph:2, fam:'SENSOR'},
 {k:'sys:RF',     n:'Rádió — lefedettség',    ph:2, fam:null},             // a coverage plan, no conduit (A2 step 9)
 {k:'sys:HMI',    n:'Kezelőfelületek',        ph:2, fam:'CONTROL'},
 {k:'sys:MEDIA',  n:'Média és hang',          ph:2, fam:'MEDIA'},
 {k:'sys:USB',    n:'USB',                    ph:2, fam:'USB'},
 {k:'sys:SECURITY',n:'Biztonságtechnika',     ph:2, fam:'SECURITY', last:true}, // always last [user]
 {k:'cluster',    n:'Klaszterpontok', ph:2, cats:['device'], hint:'Klaszterdobozok (K1 · K2 · K3): több réteg végpontjai egy süllyesztett házban — IDEA-001/002/003.'},
 {k:'arm',        n:'ARM pályák',  ph:2, cats:['path'], hint:'Egyvonalas pályák az RBX-től minden végpontig.'},
 // the top of the stack: the gathered extras and SmartFrame ideas as provisioned endpoints (CLA-ADD-001, IDEA-003)
 {k:'sys:EXTRA',  n:'Extrák és ötletek',      ph:2, fam:'LV', hint:'Előkészített végpontok: CLA extrák (#1–#11) és a SmartFrame slotjai. Az ideális helyek ✦-gal.'}];
const STK_ICONS={construct:'🧱',mark:'🚩',hw:'🗄',base:'🖧',channel:'⛓','sys:MAINS':'⚡','sys:DED':'🔌','sys:SOC':'⚡','sys:LIGHT':'💡','sys:LV':'〰','sys:BUSB':'🔋','sys:CONTROL':'🎛',
  'sys:DATA':'🌐','sys:KNX':'⌘','sys:SENSOR':'📡','sys:RF':'📶','sys:HMI':'🖲','sys:MEDIA':'🔊','sys:USB':'🔌','sys:SECURITY':'🛡',cluster:'▦',arm:'🌿','sys:EXTRA':'✧'};
// One colour per role, fixed [user]: Erősáram is the same red in every project, on the panel, on the
// symbols and in the BRIDGE sheets — a colour has to mean a system, not "the third layer down".
// The sys:* half of this table is what 05s hands to the endpoint symbols (EP_ROLE_COL reads it).
const STK_COL={construct:'#7c7468',mark:'#c0530f',hw:'#4a5a68',base:'#1f6f8b',channel:'#8a7bbf',
  'sys:MAINS':'#d1493f','sys:DED':'#6d4c41','sys:SOC':'#c62828','sys:LIGHT':'#ef7b72','sys:LV':'#e6a800','sys:BUSB':'#b07a2a','sys:CONTROL':'#7a5cc0','sys:DATA':'#16a085',
  'sys:KNX':'#2e7d32','sys:SENSOR':'#2f79c9','sys:RF':'#3fa7a7','sys:HMI':'#5470b0','sys:MEDIA':'#c2638a',
  'sys:USB':'#607d8b','sys:SECURITY':'#444444',cluster:'#9c6b30',arm:'#2e9e5b','sys:EXTRA':'#b0489a'};
// the switch inside the lighting layer is orange (the user's words: barna, vörös, világospiros lámpa, narancs kapcsoló)
const EP_CODE_COL={'sys:LIGHT':{SWI:'#f08c2e'}};
// grey-safe print palette (answer M04, MATERIAL §4b): c = colour for colour print, L = CIE L* it greys to, p = line
// pattern (s solid · d dash · o dot · x dash-dot). Used only while printing / exporting PNG grey (prnActive), never on screen.
const STK_PRINT={
 'sys:DED':{c:'#5f3f34',L:30,p:'s'},  'sys:SOC':{c:'#ca2c2b',L:45,p:'s'},
 SWI:{c:'#d87817',L:60,p:'s'},        'sys:LIGHT':{c:'#fea096',L:75,p:'s'},   // lamp
 'sys:CONTROL':{c:'#4d3593',L:30,p:'d'},'sys:BUSB':{c:'#92600c',L:45,p:'d'},
 'sys:DATA':{c:'#1ca388',L:60,p:'d'}, 'sys:LV':{c:'#edae10',L:75,p:'d'},
 'sys:USB':{c:'#2e4b57',L:30,p:'o'},  'sys:HMI':{c:'#4c69a8',L:45,p:'o'},
 'sys:SENSOR':{c:'#5392e5',L:60,p:'o'},'sys:MEDIA':{c:'#ff9ac1',L:75,p:'o'},
 'sys:SECURITY':{c:'#474747',L:30,p:'x'},'sys:KNX':{c:'#2a7a2f',L:45,p:'x'},
 arm:{c:'#35a460',L:60,p:'x'},        'sys:RF':{c:'#64c8c8',L:75,p:'x'},
 // phase 1 — boxes and walls, told apart by kind, so levels may repeat
 hw:{c:'#394956',L:30,p:'s'}, base:{c:'#25738f',L:45,p:'s'}, channel:{c:'#9687cc',L:60,p:'s'},
 mark:{c:'#e3702e',L:60,p:'x'}, construct:{c:'#7e766a',L:50,p:'s'}};
const STK_PRINT_DASH={s:'',d:'6 3',o:'1.2 2.4',x:'7 2 1.5 2'};
let prnOn=false;                                   // true only around exportPNG(true) and between beforeprint / afterprint
function prnActive(){return prnOn&&state.printPal!==false;}
function prnSet(on){const was=prnActive();prnOn=!!on;if(was!==prnActive()&&typeof draw==='function')draw();return prnActive();}
// the legend a printed / exported sheet carries: every role (and the switch) actually used by a visible device
function prnLegendSvg(x,y){const used=[],seen={};
  data.devices.forEach(d=>{if(!d||!state.levels[d.level]||(typeof layerShows==='function'&&!layerShows(d)))return;
    const r=typeof epRoleOf==='function'?epRoleOf(d):null;if(!r||!STK_PRINT[r])return;
    const c=typeof epCodeOf==='function'?epCodeOf(d):null,k=(r==='sys:LIGHT'&&c==='SWI')?'SWI':r;
    if(!seen[k]){seen[k]=1;used.push(k);}});
  if(!used.length)return '';
  used.sort((a,b)=>(stkRoleIx(a==='SWI'?'sys:LIGHT':a)-stkRoleIx(b==='SWI'?'sys:LIGHT':b))||(a==='SWI'?1:-1));
  const nm=k=>k==='SWI'?'Kapcsoló':((stkRole(k)||{n:k}).n);
  let s=`<g id="prnLegend" font-family="Arial,sans-serif" font-size="11"><rect x="${x}" y="${y}" width="190" height="${18+used.length*16}" fill="#fff" stroke="#888" stroke-width="0.6"/>`
    +`<text x="${x+8}" y="${y+13}" font-weight="700">Rendszerek (nyomtatási paletta)</text>`;
  used.forEach((k,i)=>{const p=STK_PRINT[k],yy=y+28+i*16,dash=STK_PRINT_DASH[p.p]?` stroke-dasharray="${STK_PRINT_DASH[p.p]}"`:'';
    s+=`<line x1="${x+8}" y1="${yy-4}" x2="${x+34}" y2="${yy-4}" stroke="${p.c}" stroke-width="3"${dash}/>`
      +`<text x="${x+42}" y="${yy}">${esc(nm(k))}</text>`;});
  return s+'</g>';}
function stkPrintOf(k,code){return (code&&k==='sys:LIGHT'&&STK_PRINT[code])||STK_PRINT[k]||null;}
function stkPrintCol(k,code){const p=stkPrintOf(k,code);return p?p.c:null;}
// one colour lookup for a role (and optionally the device code): the print palette while printing, else the screen colours
function stkRoleCol(k,code){if(prnActive()){const c=stkPrintCol(k,code);if(c)return c;}
  return (code&&EP_CODE_COL[k]&&EP_CODE_COL[k][code])||STK_COL[k]||null;}
// ---- the Erősáram split (WP-M1) ----
const MNS_ROLES=['sys:DED','sys:SOC','sys:LIGHT'];
function mnsIs(role){return role==='sys:MAINS'||MNS_ROLES.indexOf(role)>=0;}
// which of the three a MAINS endpoint belongs to — MATERIAL §4 table (SHU is a switched load: lighting, Q-M03)
function mnsRoleOf(code,type){
  if(code==='DED')return 'sys:DED';
  if(code==='LMP'||code==='SWI'||code==='SHU')return 'sys:LIGHT';
  if(code==='SOC')return 'sys:SOC';
  if(type==='light'||type==='switch')return 'sys:LIGHT';
  if(type==='socket')return 'sys:SOC';
  return 'sys:SOC';}
function stkSysCols(){const o={};Object.keys(STK_COL).forEach(k=>{if(k.indexOf('sys:')===0)o[k]=STK_COL[k];});return o;}
// the action groups the inspector offers per role. A work package that adds actions to one system role
// pushes into STK_GROUPS['+sys:MAINS'] etc.; groups that do not exist yet simply show nothing.
const STK_GROUPS={construct:['Fal','Nyílászáró','Szint','Rajz','Helyiség'],mark:['Jelölés'],hw:['Hardver','Rádió'],
  base:['Hardver'],channel:['Csatorna'],cluster:['Klaszter'],arm:['ARM','Feltöltés'],'sys:*':['Végpont','Szükséglet']};
function stkGroupsOf(roleKey){return STK_GROUPS[roleKey]||(roleKey.indexOf('sys:')===0?STK_GROUPS['sys:*'].concat(STK_GROUPS['+'+roleKey]||[]):[]);}

// ---- shared hooks: the only render / pointer edits any later stack work package needs ----
const STK_SCENE=[];    // fn() → svg string, appended to the SCENE (persisted drawing: marks, traces, zones)
const STK_OVERLAY=[];  // fn() → svg string, appended to the OVERLAY (ghosts, coverage, pick highlights)
const STK_TOOLS=[];    // {k, active()→bool, down(e)?, move(e)?, up(e)?, key(e)?, esc(e)?, mode({mode})? — told before setMode switches} — first active tool that returns true eats the event
const STK_CTX=[];      // fn(e) → [{label,act}…] or null — first non-empty wins the stage right-click
const STK_WV=[];       // fn(WV) → svg in Wall View elevation coords (u,v mm) — B2 adds the anchor in 06
const STK_PV=[];       // fn(PV) → svg in Plane View coords — B3 adds the anchor in 07
const STK_CHECKS={};   // roleKey → [fn(stack) → [{sev,msg}]]
function stkHookSvg(list,arg){let s='';for(const f of (list||[])){try{s+=f(arg)||'';}catch(_){}}return s;}   // arg: the view's own context (STK_WV gets the elevation scales)
function stkToolEvent(ph,e){for(const t of STK_TOOLS){try{if(t.active()&&t[ph]&&t[ph](e))return true;}catch(_){}}return false;}
function stkCtxItems(e){for(const f of STK_CTX){try{const r=f(e);if(r&&r.length)return r;}catch(_){}}return null;}
// extensions of the EXISTING right-click menus (they add items, they never replace the menu):
const STK_DEVMENU=[];   // fn(di, items) — the device menu (10-lamps deviceExtraItems)
const STK_PATHMENU=[];  // fn(ps={pi,si}, items) — the route-section menu
const STK_ROOMMENU=[];  // fn(rh={rm,src,i,level}, items) — the room menu
function stkMenuHook(list,a,items){for(const f of list){try{f(a,items);}catch(_){}}return items;}
function stkDevMenu(di,items){return stkMenuHook(STK_DEVMENU,di,items);}
function stkPathMenu(ps,items){return stkMenuHook(STK_PATHMENU,ps,items);}
function stkRoomMenu(rh,items){return stkMenuHook(STK_ROOMMENU,rh,items);}
// device symbols and 3D boxes of the stack's own device types (hardware nodes, endpoints)
const STK_DEVSYM=[];   // fn(d,x,y,k,back) → svg | null — the plan symbol (first non-null wins)
const STK_WVBOX=[];    // fn(dv,x,y,sc,col,back) → svg | null — the Wall View / Plane View box
const STK_BOXES=[];    // fn() → [object-like {level,x,y,z,w,d,ht,ang,color,layer}] — 3D boxes, derived at draw time
function stkFirst(list,args){for(const f of list){try{const r=f.apply(null,args);if(r)return r;}catch(_){}}return null;}
function stkDevSym(d,x,y,k,back){return stkFirst(STK_DEVSYM,[d,x,y,k,back]);}
function stkWvBox(dv,x,y,sc,col,back){return stkFirst(STK_WVBOX,[dv,x,y,sc,col,back]);}
function stkBoxes(){const out=[];for(const f of STK_BOXES){try{(f()||[]).forEach(o=>out.push(o));}catch(_){}}return out;}

// ---- model ----
function stkById(id){return id?stacks.find(s=>s.id===id)||null:null;}
function stkOfLayer(layerId){const L=lyrLayer(layerId);return L&&L.stack?stkById(L.stack):null;}
// the stack of the active layer; otherwise the one the user last entered. `state.stkOff` is "◂ Általános":
// it holds the rail on the general stages even when the active layer still belongs to a stack.
function stkActive(){if(state.stkOff)return null;
  return stkOfLayer(state.activeLayer)||stkById(state.stack);}
function stkLayer(stackId,roleKey){return layers.find(l=>l.stack===stackId&&l.role===roleKey)||null;}
function stkLayersOf(stackId){return layers.filter(l=>l.stack===stackId)
  .sort((a,b)=>stkRoleIx(a.role)-stkRoleIx(b.role));}
function stkRoleIx(k){const i=STK_ROLES.findIndex(r=>r.k===k);return i<0?999:i;}
function stkRole(k){const r=STK_ROLES.find(x=>x.k===k);if(r)return r;
  // read-only alias: an old saved plan or an old link still resolves 'sys:MAINS' while it migrates
  if(k==='sys:MAINS')return {k:'sys:MAINS',n:'Erősáram',ph:2,fam:'MAINS',alias:MNS_ROLES};
  return null;}
// ---- load-time role migrations (idempotent; run after the data is in, before the panel renders) ----
// WP-M1: a stack's one sys:MAINS layer becomes three. The old layer keeps its id (and its visibility, lock, opacity)
// as sys:SOC; sys:DED and sys:LIGHT are new layers copying those; devices move by code; room checklists split by code.
function stkMigrateRoles(){let n=0;
  layers.filter(L=>L.stack&&L.role==='sys:MAINS').forEach(L=>{n++;
    const base={visible:L.visible!==false,cats:Object.assign({},L.cats||{}),stack:L.stack};
    if(L.lock)base.lock=true;if(L.op)base.op=Object.assign({},L.op);
    const nm=s=>/Erősáram/.test(L.name||'')?L.name.replace(/Erősáram/,s):s;
    const mk=(role,name)=>{const id=stkMigrateId();return Object.assign({id,name:nm(name),role},JSON.parse(JSON.stringify(base)));};
    // each new layer joins the list BEFORE the next id is made — two ids minted in the same millisecond would collide
    const G=mk('sys:LIGHT','Világítás');layers.splice(layers.indexOf(L)+1,0,G);
    const D=mk('sys:DED','Dedikált körök');layers.splice(layers.indexOf(L),0,D);
    L.role='sys:SOC';L.name=nm('Dugaljak');
    data.devices.forEach(d=>{if(!d||d.layer!==L.id)return;const r=mnsRoleOf(d.code||(typeof EP_FROM_TYPE!=='undefined'?EP_FROM_TYPE[d.type]:null),d.type);
      if(r==='sys:DED')d.layer=D.id;else if(r==='sys:LIGHT')d.layer=G.id;});
    const S=stkById(L.stack);if(S)stkSync(S);});
  // room checklists: split rm.needs['sys:MAINS'] by code (floors and building rooms)
  const split=rm=>{if(!rm||!rm.needs||!rm.needs['sys:MAINS'])return;const old=rm.needs['sys:MAINS'];delete rm.needs['sys:MAINS'];
    Object.keys(old).forEach(c=>{const r=mnsRoleOf(c);(rm.needs[r]=rm.needs[r]||{})[c]=old[c];});};
  (data.floors||[]).forEach(split);if(typeof ROOMSB!=='undefined')for(const l of ORD)(ROOMSB[l]||[]).forEach(split);
  return n;}
function stkMigrateId(){let k=Date.now(),id;do{id='L'+(k++).toString(36)+'m';}while(layers.some(l=>l.id===id));return id;}
function stkShort(S){return 'B'+(stacks.indexOf(S)+1);}
function stkSync(S){S.layers=stkLayersOf(S.id).map(l=>l.id);}
function stkNewId(){let n=Date.now(),id;do{id='S'+n.toString(36);n++;}while(stacks.some(s=>s.id===id));return id;}
// room identity for the later checklists: F ids for data.floors, Y ids for building rooms (ensureIds)
function stkRoomId(entry){return entry&&entry.rm?entry.rm.id:null;}
function stkRooms(level){return allRooms(level).map(e=>({id:stkRoomId(e),name:e.rm.name||'',num:e.rm.num||'',kind:e.rm.kind||null,poly:e.rm.poly,rm:e.rm}));}

function stkMakeLayer(S,role){
  return {id:lyrNewId(),name:stkShort(S)+' · '+role.n,visible:true,cats:layerCatsAll(),stack:S.id,role:role.k};}
// opts: {name, construct:{mode:'new'|'adopt', layers:[ids], merge:bool}, roles:[phase-2 keys] (default: every ph:2 role that is not off), phase}
function stkCreate(opts){opts=opts||{};
  ensureIds(data);lyrPushUndo();
  const S={id:stkNewId(),name:(opts.name||'').trim()||('BRIDGE Stack '+(stacks.length+1)),kind:'bridge',scale:'S-C',layers:[],phase:opts.phase===2?2:1};
  stacks.push(S);
  const want=opts.roles||STK_ROLES.filter(r=>r.ph===2&&!r.off).map(r=>r.k);
  const c=opts.construct||{mode:'new'};
  // Szerkezet: an existing layer takes the role [Q12=A: by reference, nothing is copied]
  let cl=null;
  if(c.mode==='adopt'){
    let ids=(c.layers||[]).filter((x,i,a)=>{const L=lyrLayer(x);return L&&!L.stack&&a.indexOf(x)===i;});
    if(ids.length>1&&c.merge!==false){
      const into=ids.indexOf('L0')>=0?'L0':ids[0];     // L0 may be a target, never a source
      lyrMerge(into,ids.filter(x=>x!==into),{noUndo:true});ids=[into];}
    cl=ids.length?lyrLayer(ids[0]):null;
    if(cl){cl.stack=S.id;cl.role='construct';}}
  // new layers: one contiguous block after the last existing layer, in STK_ROLES order
  STK_ROLES.forEach(r=>{
    if(r.k==='construct'){if(!cl){cl=stkMakeLayer(S,r);layers.push(cl);}return;}
    if((r.ph===1&&!r.opt)||want.indexOf(r.k)>=0)layers.push(stkMakeLayer(S,r));});   // opt: added on demand (08q Igények)
  stkSync(S);
  state.stack=S.id;state.stkOff=false;state.activeLayer=cl.id;state.stage='stk:construct';
  lyrRefresh();
  const odd=stkNonConstruct(cl.id);
  lyrHud(odd.n?'A Szerkezet rétegen '+odd.n+' nem szerkezeti elem is van — áthelyezheted (jobb klikk a rétegen).'
                :'Új BRIDGE Stack: '+S.name+' ('+S.layers.length+' réteg)');
  return S;}
// existing layers take a role: the layer itself is referenced, nothing is copied [Q12=A].
// several ids + merge → merged into the first (L0 wins as target), then referenced.
function stkAdopt(stackId,roleKey,layerIds,opt){opt=opt||{};
  const S=stkById(stackId),role=stkRole(roleKey);if(!S||!role)return false;
  let ids=(layerIds||[]).filter((x,i,a)=>{const L=lyrLayer(x);return L&&a.indexOf(x)===i&&(!L.stack||L.stack===stackId);});
  if(!ids.length)return false;
  lyrPushUndo();
  if(ids.length>1&&opt.merge){const into=ids.indexOf('L0')>=0?'L0':ids[0];
    if(!lyrMerge(into,ids.filter(x=>x!==into),{noUndo:true}))return false;ids=[into];}
  const L=lyrLayer(ids[0]);
  const prev=stkLayer(stackId,roleKey);if(prev&&prev!==L){delete prev.stack;delete prev.role;}   // the old holder becomes an ordinary layer
  L.stack=stackId;L.role=roleKey;stkSync(S);
  lyrRefresh();
  if(roleKey==='construct'){const odd=stkNonConstruct(L.id);
    if(odd.n)lyrHud('A Szerkezet rétegen '+odd.n+' nem szerkezeti elem is van — áthelyezheted (jobb klikk a rétegen).');}
  return true;}
// the stack record goes; layers and items stay as ordinary layers
function stkDissolve(id){const S=stkById(id);if(!S)return false;
  lyrPushUndo();
  layers.forEach(l=>{if(l.stack===id){delete l.stack;delete l.role;}});
  stacks=stacks.filter(s=>s.id!==id);
  if(state.stack===id)state.stack=null;
  if(/^stk:/.test(state.stage||''))state.stage='build';
  lyrRefresh();lyrHud('Stack feloldva: '+S.name+' (a rétegek megmaradtak)');
  return true;}
function stkRename(id,name){const S=stkById(id);name=(name||'').trim();if(!S||!name)return false;
  lyrPushUndo();S.name=name;renderLayers();return true;}
function stkSetPhase(id,ph){const S=stkById(id);if(!S)return false;lyrPushUndo();S.phase=ph===2?2:1;renderLayers();return true;}

// non-construct items on a Szerkezet layer: {n, cats:{cat:count}}
function stkNonConstruct(layerId){const ok=stkRole('construct').cats,cnt=lyrCounts(layerId),cats={};let n=0;
  Object.keys(cnt).forEach(k=>{if(ok.indexOf(k)<0){cats[k]=cnt[k];n+=cnt[k];}});return {n,cats};}
// move them onto a new layer (one undo step) — the layer RCO item on a Szerkezet layer
function stkMoveNonConstruct(layerId){const odd=stkNonConstruct(layerId),L=lyrLayer(layerId);if(!L||!odd.n)return false;
  lyrPushUndo();
  const N={id:lyrNewId(),name:'Nem szerkezeti elemek',visible:true,cats:layerCatsAll()};
  layers.splice(layers.indexOf(L)+1,0,N);
  const moved=[];Object.keys(odd.cats).forEach(k=>lyrItemsOf(layerId,k).forEach(x=>{x.rec.layer=N.id;moved.push(x);}));
  lyrSnapWalls(moved);lyrRefresh();lyrHud('Áthelyezve új rétegre: '+odd.n+' elem');return true;}

// ---- the stage rail ----
function stkStages(S){return STK_ROLES.filter(r=>stkLayer(S.id,r.k)).map(r=>({
  k:'stk:'+r.k,n:r.n,icon:STK_ICONS[r.k]||'•',groups:stkGroupsOf(r.k),
  hint:r.hint||('Rendszer-réteg: '+r.n),check:()=>stkCheck(S,r.k)}));}
// the stage that is current: the role of the active layer, else the last chosen stage, else the first
function stkCurrentKey(S){const L=lyrLayer(state.activeLayer),SL=stkStages(S);
  if(L&&L.stack===S.id&&L.role&&SL.some(s=>s.k==='stk:'+L.role))return 'stk:'+L.role;
  if(SL.some(s=>s.k===state.stage))return state.stage;
  return SL.length?SL[0].k:'build';}
// setStage('stk:<role>') lands here: the role's layer becomes the active layer
function stkEnterRole(roleKey){const S=stkActive()||stkById(state.stack);if(!S)return;
  const L=stkLayer(S.id,roleKey);if(!L)return;
  state.stkOff=false;state.stack=S.id;state.activeLayer=L.id;renderLayers();}
// "◂ Általános": back to the general stages
function stkLeave(){state.stkOff=true;state.stack=null;
  const L=layers.find(l=>!l.stack);if(L)state.activeLayer=L.id;
  state.stage='build';renderLayers();renderShell();}
// "Stack aktiválása"
function stkActivate(id){const S=stkById(id);if(!S)return;
  const L=stkLayer(id,'construct')||stkLayersOf(id)[0];if(!L)return;
  state.stkOff=false;state.stack=id;state.activeLayer=L.id;state.stage='stk:'+L.role;renderLayers();renderShell();}

// ---- checks ----
// construct's own checks, then whatever the role's work packages pushed into STK_CHECKS[roleKey]
function stkCheck(S,roleKey){const out=[];
  if(roleKey==='construct'){const L=stkLayer(S.id,'construct');
    if(L){let walls=0;for(const l of ORD)(WALLS[l]||[]).forEach(r=>{if((r.layer||'L0')===L.id)walls++;});
      if(!walls)out.push({sev:'info',msg:'Még nincs fal a Szerkezet rétegen.'});
      let unnamed=0,noId=0;
      ORD.forEach(l=>stkRooms(l).forEach(r=>{
        const mine=r.rm.layer?r.rm.layer===L.id:true;      // building rooms carry no layer; floors do
        if(!mine)return;if(!r.name)unnamed++;if(!r.id)noId++;}));
      if(unnamed)out.push({sev:'warn',msg:unnamed+' helyiségnek nincs neve.'});
      if(noId)out.push({sev:'error',msg:noId+' helyiségnek nincs azonosítója.'});
      if(!data.openings.some(o=>o.type==='door'&&(o.layer||'L0')===L.id))out.push({sev:'info',msg:'Még nincs ajtó a Szerkezet rétegen.'});}}
  (STK_CHECKS[roleKey]||[]).forEach(f=>{try{(f(S)||[]).forEach(x=>out.push(x));}catch(_){}});
  return out;}

// ---- the wizard ----
function stkWizard(){
  const free=layers.filter(l=>!l.stack);
  const ph2=STK_ROLES.filter(r=>r.ph===2);
  openModal('Új BRIDGE Stack',
    `<div class="mrow">Név <input id="skName" value="BRIDGE Stack ${stacks.length+1}" style="width:200px"></div>`
   +`<div class="mrow"><b>Szerkezet</b></div>`
   +`<div class="mrow"><label><input type="radio" name="skMode" value="new" checked> Új, üres réteg</label></div>`
   +`<div class="mrow"><label><input type="radio" name="skMode" value="adopt" ${free.length?'':'disabled'}> Meglévő réteg(ek)</label></div>`
   +`<div id="skAdopt" style="display:none;margin:0 0 4px 18px">`
   +free.map(l=>`<div><label><input type="checkbox" class="skL" value="${l.id}"> ${esc(l.name)}</label></div>`).join('')
   +`<div id="skMergeRow" style="display:none"><label><input type="checkbox" id="skMerge" checked> egyesítés egy rétegbe</label></div></div>`
   +`<div class="mrow"><b>2. fázis rétegek</b></div>`
   +`<div style="margin:0 0 4px 18px">`+ph2.map(r=>`<div><label><input type="checkbox" class="skR" value="${r.k}" ${r.off?'':'checked'}> ${esc(r.n)}${r.off?' <span style="color:#888">(alapból kikapcsolva)</span>':''}</label></div>`).join('')+`</div>`
   +`<div class="mrow" style="font-size:11px;color:#888">Az 1. fázis rétegei (Szerkezet, Jelölés, Hardver, BASE, Csatorna) mindig létrejönnek. A stack csak jelölés a rétegeken: minden meglévő eszköz ugyanúgy működik rajtuk.</div>`,
    ()=>{const mode=(document.querySelector('input[name=skMode]:checked')||{}).value||'new';
      const ids=[...document.querySelectorAll('.skL')].filter(x=>x.checked).map(x=>x.value);
      if(mode==='adopt'&&!ids.length){lyrHud('Jelölj ki legalább egy meglévő réteget, vagy válaszd az új réteget.');return false;}
      stkCreate({name:$('skName').value,construct:{mode,layers:ids,merge:$('skMerge')?$('skMerge').checked:true},
        roles:[...document.querySelectorAll('.skR')].filter(x=>x.checked).map(x=>x.value)});});
  const sync=()=>{const adopt=(document.querySelector('input[name=skMode]:checked')||{}).value==='adopt';
    $('skAdopt').style.display=adopt?'block':'none';
    $('skMergeRow').style.display=(adopt&&document.querySelectorAll('.skL:checked').length>=2)?'block':'none';};
  document.querySelectorAll('input[name=skMode]').forEach(r=>r.onchange=sync);
  document.querySelectorAll('.skL').forEach(c=>c.onchange=sync);}
// "Meglévő réteg felvétele szerepbe…"
function stkAdoptDialog(stackId){const S=stkById(stackId);if(!S)return;
  const free=layers.filter(l=>!l.stack||l.stack===stackId);
  openModal('Meglévő réteg felvétele szerepbe',
    `<div class="mrow">Szerep <select id="saRole" style="width:220px">${STK_ROLES.map(r=>`<option value="${r.k}">${esc(r.n)}</option>`).join('')}</select></div>`
   +`<div class="mrow">Réteg <select id="saLayer" style="width:220px">${free.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>`
   +`<div class="mrow" style="font-size:11px;color:#888">A réteg maga kerül a szerepbe (nem másolat). Aki eddig a szerepet viselte, sima réteg lesz.</div>`,
    ()=>{stkAdopt(stackId,$('saRole').value,[$('saLayer').value]);});}
function stkRenameDialog(id){const S=stkById(id);if(!S)return;
  openModal('Stack átnevezése',`<div class="mrow">Név <input id="srName" value="${esc(S.name).replace(/"/g,'&quot;')}" style="width:220px"></div>`,
    ()=>{stkRename(id,$('srName').value);});}
function stkMenu(e,id){const S=stkById(id);if(!S)return;
  ctxMenu(e,[
    {label:'Stack aktiválása',act:()=>stkActivate(id)},
    {label:'Átnevezés…',act:()=>stkRenameDialog(id)},
    {label:'Fázis: '+(S.phase===2?'2 → 1':'1 → 2'),act:()=>stkSetPhase(id,S.phase===2?1:2)},
    {label:'Meglévő réteg felvétele szerepbe…',act:()=>stkAdoptDialog(id)},
    {label:'Stack feloldása (rétegek maradnak)',act:()=>stkDissolve(id)}]);}

registerActions([
 {id:'stack.create',alias:'uj bridge stack reteg csoport new stack wizard',label:'Új BRIDGE Stack…',icon:'▤',group:'Stack',
  hint:'Előre beállított rétegcsoport: Szerkezet, Jelölés, Hardver, BASE, Csatorna + a 2. fázis rendszerrétegei. Meglévő réteg is szerepet kaphat.',
  run:()=>stkWizard()},
 {id:'stack.dissolve',alias:'stack feloldasa dissolve',label:'Stack feloldása (rétegek maradnak)',icon:'▤',group:'Stack',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>stkDissolve(stkActive().id)},
 {id:'stack.leave',alias:'altalanos szakaszok vissza general stages leave stack',label:'Vissza az általános szakaszokhoz',icon:'◂',group:'Stack',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>stkLeave()}
]);

// ---- the stack layer right-click menu + Info (round 2026-10-10, WP-S1) ----
// A role layer's row in the Layers panel and its stage button in the rail open the same menu: the layer's
// own items (05l lyrLayerMenu), then — after a separator — what a work package pushed into STK_LAYERMENU.
const STK_LAYERMENU=[];   // fn(L, items) — extra items for a stack role layer's menu
function stkLayerMenu(L,items){return stkMenuHook(STK_LAYERMENU,L,items);}
// the items S1 itself adds (every role layer)
STK_LAYERMENU.push((L,items)=>{const n=rliCount(L.id),role=stkRole(L.role),solo=state.rliSolo&&state.rliSolo.stack===L.stack;
  items.push({label:'ℹ Info — '+esc(role?role.n:L.role),act:()=>rliDialog(L.role,L.stack)});
  items.push({label:'Aktiválás',act:()=>rliActivate(L.id)});
  items.push({label:solo?'Mind látszik':'Csak ez látszik',act:()=>solo?rliSoloOff():rliSolo(L.id)});
  items.push({label:'Kiemelés (Réteg-kiemelés)',act:()=>{if(!lyrSpotOn())lyrSpotToggle();lyrSpotSet(L.id);}});
  items.push({label:'Elemek kijelölése ('+rliSelectable(L.id).length+')',act:()=>rliSelect(L.id)});
  items.push({label:'Ellenőrzés…',act:()=>rliCheckDialog(L.role,L.stack)});
  if(L.role.indexOf('sys:')===0)items.push({label:'Helyiség-igények…',act:()=>rliNeedsDialog(L.role,L.stack)});
  items.push({label:'🗑 Tartalom törlése… ('+n+' elem)',act:()=>rliClear(L.id)});});
// everything that lives on the layer: the UKEYS collections and the walls of every level
function rliItems(layerId){const out=[];lyrEachItem((k,r)=>{if((r.layer||'L0')===layerId)out.push({coll:k,rec:r});});return out;}
function rliCount(layerId){return rliItems(layerId).length;}
function rliActivate(id){const L=lyrLayer(id);if(!L)return;state.activeLayer=id;
  if(L.stack){state.stkOff=false;state.stack=L.stack;if(L.role)state.stage='stk:'+L.role;}
  renderLayers();if(typeof renderShell==='function')renderShell();lyrHud('Aktív réteg: '+L.name);}
// solo inside the stack: the other layers of the same stack hide; their visibility is remembered for "Mind látszik"
function rliSolo(id){const L=lyrLayer(id);if(!L||!L.stack)return false;
  const prev={};stkLayersOf(L.stack).forEach(x=>{prev[x.id]=x.visible!==false;x.visible=(x.id===id);});
  state.rliSolo={stack:L.stack,layer:id,prev};lyrRefresh();lyrHud('Csak ez látszik: '+L.name+' — jobb klikk → Mind látszik visszaállítja.');return true;}
function rliSoloOff(){const s=state.rliSolo;if(!s)return false;
  stkLayersOf(s.stack).forEach(x=>{x.visible=(s.prev[x.id]!==undefined)?s.prev[x.id]:true;});
  delete state.rliSolo;lyrRefresh();lyrHud('A stack rétegei a korábbi láthatósággal.');return true;}
// the visible, unlocked items of the layer that the selection model can hold
function rliSelectable(id){const L=lyrLayer(id);if(!L||L.lock||L.visible===false)return [];const out=[];
  ['objects','devices','openings','roofs','floors','notes'].forEach(t=>(data[t]||[]).forEach((o,i)=>{
    if(o&&(o.layer||'L0')===id&&(typeof hitOk!=='function'||hitOk(o,{objects:'object',devices:'device',openings:'build',roofs:'build',floors:'build',notes:'note'}[t])))out.push({t,i});}));
  for(const l of ORD)(WALLS[l]||[]).forEach(r=>{if((r.layer||'L0')===id)out.push({t:'wall',ref:r,level:l});});
  return out;}
function rliSelect(id){const hs=rliSelectable(id),L=lyrLayer(id);
  if(!hs.length){lyrHud(L&&L.lock?'Zárolt réteg: '+L.name:'Nincs kijelölhető elem ezen a rétegen.');return 0;}
  clearMulti();hs.forEach(h=>addMulti(h));selected=hs[0];setMode('grab');draw();
  lyrHud(hs.length+' elem kijelölve ('+L.name+') — Mozgatás eszköz.');return hs.length;}
function rliCheckDialog(roleKey,stackId){const S=stkById(stackId)||stkActive();if(!S)return;
  const list=stkCheck(S,roleKey),r=stkRole(roleKey),C={error:'#c62828',warn:'#b26a00',info:'#2f6fb0'};
  openModal('Ellenőrzés — '+esc(r?r.n:roleKey),list.length?list.map(x=>`<div style="padding:3px 0;border-bottom:1px solid #f0f0f0"><b style="color:${C[x.sev]||'#555'}">${x.sev==='error'?'hiba':x.sev==='warn'?'figyelem':'info'}</b> · ${esc(x.msg)}</div>`).join('')
    :'<div class="mrow">Nincs kifogás ezen a rétegen.</div>',()=>{},'Bezár');}
function rliNeedsDialog(roleKey,stackId){const S=stkById(stackId)||stkActive();if(!S)return;const r=stkRole(roleKey);
  const rows=rliRoomCounts(roleKey,S.id);
  openModal('Helyiség-igények — '+esc(r?r.n:roleKey),rows.length?`<table style="border-collapse:collapse;font-size:12px">`
    +rows.map(x=>`<tr><td style="padding:2px 8px 2px 0"><b>${esc(x.num)}</b> ${esc(x.name)}</td><td style="padding:2px 8px;text-align:right">${x.have} / ${x.need}</td>`
      +`<td style="color:#888">${x.missing.length?'hiányzik: '+x.missing.map(esc).join(', '):''}</td></tr>`).join('')+`</table>`
    :'<div class="mrow">Nincs helyiség, vagy ennek a rétegnek nincs igénye.</div>',()=>{},'Bezár');}
// per room: endpoints of this role it has vs the codes its needs ask (needOf / needHave, 05t)
function rliRoomCounts(roleKey,stackId){if(typeof needOf!=='function')return [];const out=[];
  for(const l of ORD)stkRooms(l).forEach(e=>{if(!e.id)return;const need=needOf(e.rm,roleKey),ks=Object.keys(need).filter(k=>need[k]);
    if(!ks.length)return;const have=ks.filter(k=>needHave(e.id,roleKey,k,stackId)>0);
    out.push({num:e.num||'',name:e.name||'',need:ks.length,have:have.length,missing:ks.filter(k=>have.indexOf(k)<0)});});
  return out;}
// the Info dialog
function rliDialog(roleKey,stackId){const r=stkRole(roleKey),T=(typeof RLI_TEXT!=='undefined'&&RLI_TEXT[roleKey])||{},c=STK_COL[roleKey]||'#888';
  openModal(`${STK_ICONS[roleKey]||''} ${esc(r?r.n:roleKey)} <span style="display:inline-block;width:12px;height:12px;background:${c};border-radius:2px;vertical-align:middle"></span>`,
    rliInfoHtml(roleKey,stackId||(stkActive()||{}).id),()=>{},'Bezár');
  const sel=$('rliSecTier'),S=stkById(stackId)||stkActive();
  if(sel&&S){sel.value=S.secTier==='premium'?'premium':'alap';sel.onchange=()=>epSecTierSet(S.id,sel.value);}}
function rliInfoHtml(roleKey,stackId){const r=stkRole(roleKey),T=(typeof RLI_TEXT!=='undefined'&&RLI_TEXT[roleKey])||{};
  const sec=(h,b)=>`<div style="margin:8px 0 2px;font-weight:700">${h}</div><div style="font-size:12px;line-height:1.45">${b}</div>`;
  let types='';const eps=(typeof epOfRole==='function')?epOfRole(roleKey):[];
  if(eps.length)types=eps.map(e=>`<div><b>${esc(e.code)}</b> — ${esc(e.n)}${e.mount==='ceiling'?' · mennyezet':e.h?' · '+e.h+' mm':''}`
    +((e.vars||[]).length?`<div style="color:#777;margin-left:12px">${e.vars.map(v=>esc(v.n)+(v.h?' ('+v.h+' mm)':'')).join(' · ')}</div>`:'')+`</div>`).join('');
  else if(roleKey==='construct'&&r&&r.cats)types=r.cats.map(k=>esc(typeof lyrCatName==='function'?lyrCatName(k):k)).join(', ');
  else if(roleKey==='hw')types=Object.keys(HW_TYPES).filter(k=>HW_DEF[k]&&HW_DEF[k].role==='hw').map(k=>esc(HW_TYPES[k])).join(', ');
  else if(roleKey==='base')types=HW_UNIT_ORDER.map(u=>'<b>'+u+'</b> — '+esc((HW_BASE_UNITS[u].n.split(' — ')[1])||'')).join(' · ');
  else if(roleKey==='cluster')types='Klaszterdobozok K1 · K2 · K3 (06b).';
  else types='<span style="color:#888">—</span>';
  const counts=stackId&&roleKey.indexOf('sys:')===0?rliRoomCounts(roleKey,stackId):[];
  const here=counts.length?`<div style="margin-top:4px;color:#555">Ebben a tervben: `+counts.map(x=>`<span style="white-space:nowrap">${esc(x.num)} ${esc(x.name)} · ${x.have} / ${x.need}</span>`).join(' · ')+`</div>`:'';
  const tier=roleKey==='sys:SECURITY'&&stackId?sec('Biztonsági kivitel',`<select id="rliSecTier"><option value="alap">Alap — vegyes (a belső mozgás és a pánikgomb az RBX-hez)</option>`
    +`<option value="premium">Prémium — csillag (minden behatolás-érzékelő az SSC-ig)</option></select>`):'';
  return sec('Mire való',esc(T.cel||'—'))+sec('Eszköztípusok',types)+sec('Hol és mennyi',esc(T.hol||'—')+here)+sec('Mivel klaszterezhető',esc(T.klaszter||'—'))+tier;}
// delete everything ON the layer; the layer, its role and its stack stay. One undo step brings it all back.
function rliClear(layerId,opt){opt=opt||{};const L=lyrLayer(layerId);if(!L)return 0;
  if(L.lock){lyrHud('Zárolt réteg: '+L.name+' — előbb oldd fel a zárolást.');return 0;}   // Q-S02 = A
  const items=rliItems(layerId);if(!items.length){lyrHud('A(z) „'+L.name+'” réteg üres.');return 0;}
  if(!opt.yes&&!confirm(items.length+' elem törlése a(z) „'+L.name+'” rétegről? A réteg megmarad. (Visszavonható)'))return 0;
  pushUndo();
  const gone=new Set(items.map(x=>x.rec)),devIds=new Set(items.filter(x=>x.coll==='devices').map(x=>x.rec.id));
  UKEYS.forEach(k=>{if(Array.isArray(data[k]))data[k]=data[k].filter(r=>!gone.has(r));});
  for(const l of ORD)if((WALLS[l]||[]).some(r=>gone.has(r))){WALLS[l]=WALLS[l].filter(r=>!gone.has(r));SNAP[l]=centerlines(WALLS[l]);}
  (data.circuits||[]).forEach(c=>{if(c.members)c.members=c.members.filter(id=>!devIds.has(id));});
  pruneLinks();selected=null;clearMulti();lyrRefresh();
  lyrHud(items.length+' elem törölve: '+L.name+' (Ctrl+Z visszahozza).');return items.length;}
registerActions([
 {id:'layer.info',alias:'reteg info informacio layer role',label:'Réteg infó',icon:'ℹ',group:'Réteg',
  hint:'Mire való az aktív stack réteg, milyen eszköztípusok, hol és mennyi, mivel klaszterezhető.',
  need:'Egy BRIDGE Stack réteg legyen aktív.',when:()=>{const L=lyrLayer(state.activeLayer);return !!(L&&L.stack&&L.role);},
  run:()=>{const L=lyrLayer(state.activeLayer);rliDialog(L.role,L.stack);}},
 {id:'layer.clear',alias:'reteg tartalom torlese clear layer contents delete',label:'Réteg tartalmának törlése…',icon:'🗑',group:'Réteg',
  hint:'Az aktív réteg minden elemét törli; a réteg megmarad. Visszavonható.',run:()=>rliClear(state.activeLayer)}]);

// test hooks
window.MNS_ROLES=MNS_ROLES;window.mnsIs=mnsIs;window.mnsRoleOf=mnsRoleOf;window.stkMigrateRoles=stkMigrateRoles;window.STK_PRINT=STK_PRINT;window.EP_CODE_COL=EP_CODE_COL;
window.prnLegendSvg=prnLegendSvg;window.prnActive=prnActive;window.prnSet=prnSet;window.stkPrintCol=stkPrintCol;window.stkPrintOf=stkPrintOf;window.STK_PRINT_DASH=STK_PRINT_DASH;
window.STK_LAYERMENU=STK_LAYERMENU;window.rliDialog=rliDialog;window.rliClear=rliClear;window.rliCount=rliCount;window.rliInfoHtml=rliInfoHtml;
window.rliSolo=rliSolo;window.rliSoloOff=rliSoloOff;window.rliSelect=rliSelect;window.rliRoomCounts=rliRoomCounts;
window.STK_ROLES=STK_ROLES;window.STK_COL=STK_COL;window.STK_GROUPS=STK_GROUPS;window.STK_SCENE=STK_SCENE;window.STK_OVERLAY=STK_OVERLAY;window.STK_TOOLS=STK_TOOLS;
window.STK_CTX=STK_CTX;window.STK_WV=STK_WV;window.STK_PV=STK_PV;window.STK_CHECKS=STK_CHECKS;window.VALIDATORS=VALIDATORS;
window.stkById=stkById;window.stkOfLayer=stkOfLayer;window.stkActive=stkActive;window.stkLayer=stkLayer;window.stkLayersOf=stkLayersOf;window.stkRole=stkRole;
window.stkCreate=stkCreate;window.stkAdopt=stkAdopt;window.stkDissolve=stkDissolve;window.stkRename=stkRename;window.stkRoomId=stkRoomId;window.stkRooms=stkRooms;
window.stkStages=stkStages;window.stkCheck=stkCheck;window.stkGroupsOf=stkGroupsOf;window.stkLeave=stkLeave;window.stkActivate=stkActivate;
window.stkNonConstruct=stkNonConstruct;window.stkMoveNonConstruct=stkMoveNonConstruct;window.stkHookSvg=stkHookSvg;window.stkToolEvent=stkToolEvent;
window.stkCtxItems=stkCtxItems;window.stkMenu=stkMenu;window.stkSetPhase=stkSetPhase;
window.STK_DEVMENU=STK_DEVMENU;window.STK_PATHMENU=STK_PATHMENU;window.STK_ROOMMENU=STK_ROOMMENU;window.STK_DEVSYM=STK_DEVSYM;window.STK_WVBOX=STK_WVBOX;window.STK_BOXES=STK_BOXES;
window.stkDevMenu=stkDevMenu;window.stkPathMenu=stkPathMenu;window.stkRoomMenu=stkRoomMenu;window.stkDevSym=stkDevSym;window.stkWvBox=stkWvBox;window.stkBoxes=stkBoxes;
