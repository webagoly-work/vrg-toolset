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
 {k:'sys:MAINS',  n:'Erősáram',               ph:2, fam:'MAINS'},
 {k:'sys:LV',     n:'Törpefeszültség — A busz', ph:2, fam:'LV'},
 {k:'sys:BUSB',   n:'Biztosított 24 V — B busz',ph:2, fam:'BUSB'},
 {k:'sys:CONTROL',n:'Vezérlés (BRIDGE_LINK)', ph:2, fam:'CONTROL'},
 {k:'sys:DATA',   n:'Adat / PoE',             ph:2, fam:'DATA'},
 {k:'sys:KNX',    n:'KNX',                    ph:2, fam:'KNX', off:true},   // P33: not taken
 {k:'sys:SENSOR', n:'Érzékelők',              ph:2, fam:'SENSOR'},
 {k:'sys:RF',     n:'Rádió — lefedettség',    ph:2, fam:null},             // a coverage plan, no conduit (A2 step 9)
 {k:'sys:HMI',    n:'Kezelőfelületek',        ph:2, fam:'CONTROL'},
 {k:'sys:MEDIA',  n:'Média és hang',          ph:2, fam:'MEDIA'},
 {k:'sys:USB',    n:'USB',                    ph:2, fam:'USB'},
 {k:'sys:SECURITY',n:'Biztonságtechnika',     ph:2, fam:'SECURITY', last:true}, // always last [user]
 {k:'cluster',    n:'Klaszterpontok', ph:2, cats:['device'], hint:'Klaszterdobozok (K1 · K2 · K3): több réteg végpontjai egy süllyesztett házban — IDEA-001/002/003.'},
 {k:'arm',        n:'ARM pályák',  ph:2, cats:['path'], hint:'Egyvonalas pályák az RBX-től minden végpontig.'},
 // the top of the stack: the gathered extras and SmartFrame ideas as provisioned endpoints (P33-ADD-001, IDEA-003)
 {k:'sys:EXTRA',  n:'Extrák és ötletek',      ph:2, fam:'LV', hint:'Előkészített végpontok: P33 extrák (#1–#11) és a SmartFrame slotjai. Az ideális helyek ✦-gal.'}];
const STK_ICONS={construct:'🧱',mark:'🚩',hw:'🗄',base:'🖧',channel:'⛓','sys:MAINS':'⚡','sys:LV':'〰','sys:BUSB':'🔋','sys:CONTROL':'🎛',
  'sys:DATA':'🌐','sys:KNX':'⌘','sys:SENSOR':'📡','sys:RF':'📶','sys:HMI':'🖲','sys:MEDIA':'🔊','sys:USB':'🔌','sys:SECURITY':'🛡',cluster:'▦',arm:'🌿','sys:EXTRA':'✧'};
// One colour per role, fixed [user]: Erősáram is the same red in every project, on the panel, on the
// symbols and in the BRIDGE sheets — a colour has to mean a system, not "the third layer down".
// The sys:* half of this table is what 05s hands to the endpoint symbols (EP_ROLE_COL reads it).
const STK_COL={construct:'#7c7468',mark:'#c0530f',hw:'#4a5a68',base:'#1f6f8b',channel:'#8a7bbf',
  'sys:MAINS':'#d1493f','sys:LV':'#e6a800','sys:BUSB':'#b07a2a','sys:CONTROL':'#7a5cc0','sys:DATA':'#16a085',
  'sys:KNX':'#2e7d32','sys:SENSOR':'#2f79c9','sys:RF':'#3fa7a7','sys:HMI':'#5470b0','sys:MEDIA':'#c2638a',
  'sys:USB':'#607d8b','sys:SECURITY':'#444444',cluster:'#9c6b30',arm:'#2e9e5b','sys:EXTRA':'#b0489a'};
function stkRoleCol(k){return STK_COL[k]||null;}
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
function stkRole(k){return STK_ROLES.find(r=>r.k===k)||null;}
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
    if(r.ph===1||want.indexOf(r.k)>=0)layers.push(stkMakeLayer(S,r));});
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

// test hooks
window.STK_ROLES=STK_ROLES;window.STK_COL=STK_COL;window.STK_GROUPS=STK_GROUPS;window.STK_SCENE=STK_SCENE;window.STK_OVERLAY=STK_OVERLAY;window.STK_TOOLS=STK_TOOLS;
window.STK_CTX=STK_CTX;window.STK_WV=STK_WV;window.STK_PV=STK_PV;window.STK_CHECKS=STK_CHECKS;window.VALIDATORS=VALIDATORS;
window.stkById=stkById;window.stkOfLayer=stkOfLayer;window.stkActive=stkActive;window.stkLayer=stkLayer;window.stkLayersOf=stkLayersOf;window.stkRole=stkRole;
window.stkCreate=stkCreate;window.stkAdopt=stkAdopt;window.stkDissolve=stkDissolve;window.stkRename=stkRename;window.stkRoomId=stkRoomId;window.stkRooms=stkRooms;
window.stkStages=stkStages;window.stkCheck=stkCheck;window.stkGroupsOf=stkGroupsOf;window.stkLeave=stkLeave;window.stkActivate=stkActivate;
window.stkNonConstruct=stkNonConstruct;window.stkMoveNonConstruct=stkMoveNonConstruct;window.stkHookSvg=stkHookSvg;window.stkToolEvent=stkToolEvent;
window.stkCtxItems=stkCtxItems;window.stkMenu=stkMenu;window.stkSetPhase=stkSetPhase;
window.STK_DEVMENU=STK_DEVMENU;window.STK_PATHMENU=STK_PATHMENU;window.STK_ROOMMENU=STK_ROOMMENU;window.STK_DEVSYM=STK_DEVSYM;window.STK_WVBOX=STK_WVBOX;window.STK_BOXES=STK_BOXES;
window.stkDevMenu=stkDevMenu;window.stkPathMenu=stkPathMenu;window.stkRoomMenu=stkRoomMenu;window.stkDevSym=stkDevSym;window.stkWvBox=stkWvBox;window.stkBoxes=stkBoxes;
