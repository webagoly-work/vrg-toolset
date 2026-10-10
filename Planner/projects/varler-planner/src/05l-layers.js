// ==========================================================================
// 05l-layers.js — layer model v2: sixteen sub-layer categories, per-category opacity
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// LAYER_CATS / LAYER_CATS_V1 / layerCatsAll() live in 02-state.js (the default layer is built from
// them at load time). Prefix here: lyr. Everything below is a function, so call order is free.

// the category of a device: sockets, switches and lights are their own; every other box is 'device'
function lyrDevCat(d){const t=d&&d.type;
  if(t==='socket'||t==='switch'||t==='light')return t;
  if(t==='ep'){const c=d.code;return (c==='LMP'||c==='LNR')?'light':c==='SWI'?'switch':c==='SOC'?'socket':'device';}
  return 'device';}
// a call site may still say the v1 names 'device' / 'build'; map them onto the v2 category of THIS item
function lyrCat(item,cat){
  if(cat==='device')return (item&&item.type)?lyrDevCat(item):'device';
  if(cat==='build'){const t=item&&item.type;
    if(t==='door'||t==='window'||t==='stairs')return t;
    return (item&&item.poly)?'floor':'roof';}
  return cat;}
// the category a record of a collection belongs to (coll 'walls' = a wall rect)
function lyrCatOf(coll,rec){
  switch(coll){
    case 'devices':return lyrDevCat(rec);
    case 'openings':return (rec&&rec.type)||'door';
    case 'floors':return 'floor';
    case 'roofs':return 'roof';
    case 'objects':return 'object';
    case 'paths':return 'path';
    case 'cables':return 'cable';
    case 'notes':case 'wallNotes':return 'note';
    case 'walls':return 'wall';
    case 'marks':return 'mark';
    case 'traces':return 'trace';}
  return null;}
function lyrKnown(k){return LAYER_CATS.some(c=>c.k===k);}

// ---- the colour code -------------------------------------------------------------------------
// Every layer has a colour, whether or not anything is painted with it. A stack layer takes its
// ROLE's fixed colour (STK_COL, 05m), so the same system reads the same colour in every project;
// an ordinary layer gets an evenly spaced hue from its position, which is only ever a tie-breaker
// between layers that mean nothing in particular. `L.tint` set by hand still wins over both.
const LYR_HUES=[205,28,145,275,48,330,180,95,255,15,120,300];
function lyrAutoCol(L){
  if(!L)return '#8a857b';
  if(L.stack&&L.role&&typeof stkRoleCol==='function'){const c=stkRoleCol(L.role);if(c)return c;}
  const i=Math.max(0,layers.indexOf(L));
  return hslHex(LYR_HUES[i%LYR_HUES.length],0.42,0.46);}
function hslHex(h,s,l){                                   // h in degrees, s/l in 0..1
  const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
  const t=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return '#'+t.map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');}
function lyrColor(L){return (L&&/^#[0-9a-f]{6}$/i.test(L.tint||''))?L.tint:lyrAutoCol(L);}
function lyrColorOf(id){return lyrColor(lyrLayer(id)||layers[0]);}
// `L.paint` is the per-layer switch the panel offers: draw this layer's devices in its colour.
function lyrPaints(L){return !!(L&&L.paint);}
function lyrTogglePaint(id){const L=lyrLayer(id);if(!L)return false;
  if(L.paint)delete L.paint;else L.paint=true;renderLayers();draw();return true;}

// ---- the spotlight ---------------------------------------------------------------------------
// With it on, touching one device lights up every device that shares its layer, and the layer's
// block in the panel glows the same colour — one gesture answers "what else is on this run?".
// It is a VIEW state: never saved with the drawing, never undoable.
var lyrSpot=null;                                          // the layer id currently lit
function lyrSpotOn(){return state.lyrSpot===true;}
function lyrSpotSet(id){
  if(!lyrSpotOn())id=null;
  if(id===lyrSpot)return false;
  lyrSpot=id||null;lyrSpotPanel();drawSoon();return true;}
function lyrSpotOfDevice(di){const d=(di!=null)?data.devices[di]:null;return d?(d.layer||'L0'):null;}
function lyrSpotIs(item){return !!(lyrSpot&&item&&(item.layer||'L0')===lyrSpot);}
// the panel half: a glow on the lit layer's block, in that layer's own colour
function lyrSpotPanel(){const el=$('layerList');if(!el)return;
  el.querySelectorAll('.lblock').forEach(b=>{
    const on=(b.dataset.lb===lyrSpot);
    b.classList.toggle('lspot',on);
    b.style.setProperty('--lspot',on?lyrColorOf(b.dataset.lb):'transparent');});}
// the drawing half: a halo in the layer's colour, behind the symbol, on every device of that layer
function lyrSpotRing(d,x,y,k){const c=lyrColorOf(d&&d.layer||'L0');
  const u=(typeof icoRingU==='function')?icoRingU(d,k||0.72):(k||0.72);   // the symbol's own unit (05z)
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(13*u).toFixed(2)}" fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-opacity="0.75" stroke-width="${+(u*2.2).toFixed(2)}"/>`;}
function lyrSpotToggle(){state.lyrSpot=!lyrSpotOn();
  if(!lyrSpotOn())lyrSpot=null;
  renderLayers();draw();
  lyrHud(lyrSpotOn()?'Réteg-kiemelés be — vidd a kurzort egy készülékre: a rétegtársai és a réteg sora is felvillan.'
                    :'Réteg-kiemelés ki.');
  return lyrSpotOn();}
// opacity step: one decimal, 0.1…1
function lyrClampOp(v){v=+v;if(!isFinite(v))return 1;return Math.min(1,Math.max(0.1,Math.round(v*10)/10));}
// idempotent: v1 layers (device / build keys) become v2, every category present, op cleaned
function lyrMigrate(L){if(!L)return L;
  const c=L.cats||(L.cats={});
  if(!('socket' in c)&&!('switch' in c)&&!('light' in c)&&('device' in c)){const v=c.device!==false;
    LAYER_CATS_V1.device.forEach(k=>{c[k]=v;});}
  if('build' in c){const v=c.build!==false;LAYER_CATS_V1.build.forEach(k=>{c[k]=v;});delete c.build;}
  LAYER_CATS.forEach(k=>{if(c[k.k]===undefined)c[k.k]=true;});
  if(L.op&&typeof L.op==='object'){
    Object.keys(L.op).forEach(k=>{if(!lyrKnown(k)){delete L.op[k];return;}
      const v=lyrClampOp(L.op[k]);if(v>=1)delete L.op[k];else L.op[k]=v;});
    if(!Object.keys(L.op).length)delete L.op;}
  else if('op' in L)delete L.op;
  return L;}
function lyrMigrateAll(){layers.forEach(lyrMigrate);}
// the layer opacity of an item in a category, 1 when none is set
function lyrOp(item,cat){const L=layerById((item&&item.layer)||'L0'),k=lyrCat(item,cat);
  const v=L.op&&L.op[k];let op=(typeof v==='number'&&v>=0.1&&v<1)?v:1;
  if(state.stkView&&typeof armFade==='function')op=Math.round(op*armFade(item)*100)/100;   // E1: the stack drawn as one, other layers faded
  return op;}
function lyrOpStr(v){return String(+v.toFixed(1));}
function lyrOpAttr(item,cat){const v=lyrOp(item,cat);return v===1?'':` opacity="${lyrOpStr(v)}"`;}
function lyrWrap(item,cat,svg){const v=lyrOp(item,cat);return v===1?svg:`<g opacity="${lyrOpStr(v)}">`+svg+`</g>`;}
// wrap what a loop appended to `s` since index `i` — for sites that build one long string
function lyrWrapFrom(s,i,item,cat){return lyrWrapOp(s,i,lyrOp(item,cat));}
function lyrWrapOp(s,i,v){return (!v||v>=1)?s:s.slice(0,i)+`<g opacity="${lyrOpStr(v)}">`+s.slice(i)+`</g>`;}
// data records handed to the wall / plane views carry `op` only when it is below 1 (no change at 100 %)
function lyrTagOp(rec,item,cat){const v=lyrOp(item,cat);if(v<1)rec.op=v;return rec;}
// depth-sorted face lists (3D views): tag the faces pushed since index `from` with the layer opacity
function lyrFaces(faces,from,item,cat){const v=lyrOp(item,cat);if(v===1)return;
  for(let i=from;i<faces.length;i++)faces[i].lop=v;}
function lyrSetOp(layerId,cat,v){const L=layerById(layerId);if(!L||!lyrKnown(cat))return;
  v=lyrClampOp(v);
  if(v>=1){if(L.op){delete L.op[cat];if(!Object.keys(L.op).length)delete L.op;}}
  else{(L.op||(L.op={}))[cat]=v;}
  draw();}
// every layer / stack operation is undoable as one step: all collections + walls + layers + stacks
function lyrPushUndo(){pushUndo(['__walls','__layers']);}

// ---- the items of a (layer, category) set -------------------------------------------------
// one iterator for everything that lives on a layer: the data collections and the walls of every level
function lyrEachItem(fn){
  UKEYS.forEach(k=>{(data[k]||[]).forEach(r=>{if(!r||typeof r!=='object')return;const c=lyrCatOf(k,r);if(c)fn(k,r,c);});});
  if(WALLS)for(const l of ORD)(WALLS[l]||[]).forEach(r=>{if(r)fn('walls',r,'wall');});}   // WALLS is still unset when the first panel render runs at boot
function lyrItemsOf(layerId,cat){const out=[];
  lyrEachItem((k,r,c)=>{if(c===cat&&(r.layer||'L0')===layerId)out.push({coll:k,rec:r});});return out;}
function lyrCounts(layerId){const o={};
  lyrEachItem((k,r,c)=>{if((r.layer||'L0')===layerId)o[c]=(o[c]||0)+1;});return o;}
function lyrCount(layerId,cat){return lyrCounts(layerId)[cat]||0;}
function lyrCatName(cat){const c=LAYER_CATS.find(x=>x.k===cat);return c?c.n:cat;}
function lyrLayer(id){return layers.find(l=>l.id===id)||null;}
function lyrHud(msg){const h=$('hud');if(h)h.textContent=msg;}
function lyrRefresh(){renderLayers();draw();}
// opacity of one layer for one category, 1 when none is set
function lyrOpOf(L,cat){const v=L&&L.op&&L.op[cat];return (typeof v==='number'&&v>=0.1&&v<1)?v:1;}
function lyrPutOp(L,cat,v){
  if(v==null||v>=1){if(L.op){delete L.op[cat];if(!Object.keys(L.op).length)delete L.op;}}
  else(L.op||(L.op={}))[cat]=v;}
// a wall rect changed layer: its snap lines are rebuilt for every level that holds one
function lyrSnapWalls(items){const w=new Set(items.filter(x=>x.coll==='walls').map(x=>x.rec));if(!w.size)return;
  for(const l of ORD)if((WALLS[l]||[]).some(r=>w.has(r)))SNAP[l]=centerlines(WALLS[l]);}

// Swap the (a,cat) and (b,cat) sets. Both lists are collected BEFORE anything is assigned, or the
// first half would ping-pong straight back. Visibility and opacity travel with their set.
function lyrSwapCat(a,b,cat){
  const A=lyrLayer(a),B=lyrLayer(b);if(!A||!B||a===b||!lyrKnown(cat))return false;
  const ia=lyrItemsOf(a,cat),ib=lyrItemsOf(b,cat);
  if(!ia.length){lyrHud('Nincs mit cserélni: '+lyrCatName(cat)+' — '+A.name+' (üres)');return false;}
  lyrPushUndo();
  ia.forEach(x=>{x.rec.layer=b;});ib.forEach(x=>{x.rec.layer=a;});
  const ca=A.cats[cat]!==false,cb=B.cats[cat]!==false,oa=lyrOpOf(A,cat),ob=lyrOpOf(B,cat);
  A.cats[cat]=cb;B.cats[cat]=ca;lyrPutOp(A,cat,ob);lyrPutOp(B,cat,oa);
  lyrSnapWalls(ia.concat(ib));
  lyrRefresh();
  lyrHud('Csere: '+lyrCatName(cat)+' — '+A.name+' ↔ '+B.name+' ('+ia.length+' ↔ '+ib.length+' elem)');
  return true;}
function lyrMoveCat(a,b,cat){
  const A=lyrLayer(a),B=lyrLayer(b);if(!A||!B||a===b||!lyrKnown(cat))return false;
  const ia=lyrItemsOf(a,cat);
  if(!ia.length){lyrHud('Nincs mit áthelyezni: '+lyrCatName(cat)+' — '+A.name+' (üres)');return false;}
  lyrPushUndo();
  ia.forEach(x=>{x.rec.layer=b;});B.cats[cat]=true;
  lyrSnapWalls(ia);
  lyrRefresh();
  lyrHud('Áthelyezve: '+lyrCatName(cat)+' — '+A.name+' → '+B.name+' ('+ia.length+' elem)');
  return true;}
// "only this one": every other category of the layer off
function lyrSolo(layerId,cat){const L=lyrLayer(layerId);if(!L)return;
  LAYER_CATS.forEach(c=>{L.cats[c.k]=(c.k===cat);});lyrRefresh();}
function lyrStepOp(layerId,cat,dir){const L=lyrLayer(layerId);if(!L)return;
  const v=Math.round((lyrOpOf(L,cat)+dir*0.1)*10)/10;
  lyrGroupOf(layerId).forEach(x=>lyrSetOp(x.id,cat,v));renderLayers();}   // a link group steps together

// ---- the panel -----------------------------------------------------------------------------
// default: only the active layer is open; the user's own fold choice (L.collapsed) wins [Q08=A]
function lyrFolded(L){return L.collapsed===undefined?(L.id!==state.activeLayer):!!L.collapsed;}
function renderLayers(){const el=$('layerList');if(!el)return;lyrDragEnd();
  const block=L=>{const open=!lyrFolded(L),cnt=open?lyrCounts(L.id):{},act=L.id===state.activeLayer;
    let h=`<div class="lblock ${act?'lactive':''}" data-lb="${L.id}"><div class="lrow">`
      +`<button data-lf="${L.id}" title="összecsukás / kinyitás">${open?'▾':'▸'}</button>`
      +`<input type="radio" name="alayer" ${act?'checked':''} data-la="${L.id}" title="aktív">`
      +`<button data-lv="${L.id}" title="show/hide">${L.visible?'👁':'🚫'}</button>`
      +`<button data-lk="${L.id}" title="zárolás: a réteg elemei nem jelölhetők ki és nem húzhatók">${L.lock?'🔒':'🔓'}</button>`
      +((typeof idealCap==='function'&&idealCap(L))?`<button data-lid="${L.id}" class="lideal${L.ideal===false?'':' on'}" title="ideális helyek mutatása / elrejtése (✦) — jobb klikk egy ✦ helyen: elhelyezés">${L.ideal===false?'✧':'✦'}</button>`:'')
      +`<button class="lswatch${lyrPaints(L)?' on':''}" data-lp="${L.id}" style="--lc:${lyrColor(L)}"`
      +` title="${esc(lyrColorTitle(L))}">●</button>`
      +`<input class="lname" data-ln="${L.id}" value="${L.name.replace(/"/g,'')}">`
      +(L.link?`<span class="llink" title="csatolt réteg: a láthatóság, átlátszóság és zár közös">🔗</span>`:'')
      +(L.id!=='L0'?`<button data-lx="${L.id}" title="törlés">✕</button>`:'')+`</div>`
      +((L.stack&&L.role&&typeof stkRole==='function')?`<div class="lrole">${esc((stkRole(L.role)||{n:L.role}).n)}</div>`:'');
    if(open){h+=`<div class="lsubs">`+LAYER_CATS.filter(c=>!c.opt||cnt[c.k]>0).map(c=>{
        const on=L.cats[c.k]!==false,op=lyrOpOf(L,c.k),n=cnt[c.k]||0,key=L.id+':'+c.k;
        return `<div class="lsub${on?'':' off'}${n?'':' none'}" data-sl="${key}">`
          +`<button data-sv="${key}" title="látható / rejtett">${on?'👁':'🚫'}</button>`
          +`<span class="lsn" title="tartsd nyomva és húzd másik rétegre · jobb klikk: csere / áthelyezés">${c.n}</span><span class="lsc">${n||''}</span>`
          +`<button data-so="${key}:-1" title="átlátszóbb (−10 %)" ${op<=0.1?'disabled':''}>−</button><span class="lsp">${Math.round(op*100)}%</span>`
          +`<button data-so="${key}:1" title="átlátszatlanabb (+10 %)" ${op>=1?'disabled':''}>+</button></div>`;}).join('')+`</div>`
      +`<div class="lcats"><input type="color" class="ltint" data-lt="${L.id}" value="${L.tint||'#ffffff'}" title="Készülékek színezése ezen a rétegen (régi / új kiosztás elkülönítése)">`
      +(L.tint?`<button data-ltx="${L.id}" class="lcat" title="színezés ki">⊘</button>`:'')+`</div>`;}
    return h+`</div>`;};
  // a BRIDGE Stack's layers sit in a block under its header (role order); everything else renders below, as before
  const stackIds=new Set(stacks.map(s=>s.id));let html='';
  stacks.forEach(S=>{html+=`<div class="lstack" data-ls="${S.id}"><button data-lsf="${S.id}" title="összecsukás / kinyitás">${S.collapsed?'▸':'▾'}</button>`
      +`<span class="lsname" title="${esc(S.name).replace(/"/g,'&quot;')}">▤ ${stkShort(S)} · ${esc(S.name)}</span><span class="lph">${S.phase===2?'2. fázis':'1. fázis'}</span>`
      +`<button data-lsm="${S.id}" title="Stack menü">⋯</button></div>`
      +(S.collapsed?'':`<div class="lstkbody">`+stkLayersOf(S.id).map(block).join('')+`</div>`);});
  html+=layers.filter(L=>!L.stack||!stackIds.has(L.stack)).map(block).join('');
  el.innerHTML=html;
  const q=(sel,fn)=>el.querySelectorAll(sel).forEach(fn);
  q('[data-lsf]',b=>b.onclick=()=>{const S=stkById(b.dataset.lsf);S.collapsed=!S.collapsed;renderLayers();});
  q('[data-lsm]',b=>b.onclick=e=>stkMenu(e,b.dataset.lsm));
  q('.lstack',h=>h.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();stkMenu(e,h.dataset.ls);}));
  q('[data-lf]',b=>b.onclick=()=>{const L=lyrLayer(b.dataset.lf);L.collapsed=!lyrFolded(L);renderLayers();});
  q('[data-lt]',i=>i.onchange=()=>{layerById(i.dataset.lt).tint=i.value;renderLayers();draw();});
  q('[data-ltx]',b=>b.onclick=()=>{delete layerById(b.dataset.ltx).tint;renderLayers();draw();});
  q('[data-lp]',b=>b.onclick=()=>lyrTogglePaint(b.dataset.lp));
  q('[data-la]',r=>r.onchange=()=>{state.activeLayer=r.dataset.la;const L=lyrLayer(r.dataset.la);
    if(L&&L.stack){state.stkOff=false;state.stack=L.stack;}      // picking a stack layer enters its stack
    renderLayers();if(typeof renderShell==='function')renderShell();});
  q('[data-lv]',b=>b.onclick=()=>{const L=layerById(b.dataset.lv),v=!L.visible;lyrGroupOf(L.id).forEach(x=>{x.visible=v;});renderLayers();draw();});
  q('[data-lk]',b=>b.onclick=()=>lyrToggleLock(b.dataset.lk));
  q('[data-lid]',b=>b.onclick=()=>{const L=lyrLayer(b.dataset.lid);L.ideal=(L.ideal===false);renderLayers();draw();});
  q('.lrow',r=>r.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();lyrLayerMenu(e,r.parentNode.dataset.lb);}));
  q('[data-ln]',i=>i.onchange=()=>{lyrPushUndo();layerById(i.dataset.ln).name=i.value;});
  q('[data-sv]',b=>b.onclick=()=>{const p=b.dataset.sv.split(':'),L=lyrLayer(p[0]),v=(L.cats[p[1]]===false);lyrGroupOf(L.id).forEach(x=>{x.cats[p[1]]=v;});renderLayers();draw();});
  q('[data-so]',b=>b.onclick=()=>{const p=b.dataset.so.split(':');lyrStepOp(p[0],p[1],+p[2]);});
  q('[data-lx]',b=>b.onclick=()=>lyrDelete(b.dataset.lx));
  q('.lsub',row=>{
    row.addEventListener('pointerdown',e=>{if((e.button||0)>0||(e.target.closest&&e.target.closest('button')))return;lyrDragArm(e,row);});
    row.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();lyrSubMenu(e,row.dataset.sl);});});
  lyrSpotPanel();                                   // re-apply the glow after the panel is rebuilt
  if($('lyrSpot'))$('lyrSpot').checked=lyrSpotOn();
  if($('lyrPaintAll'))$('lyrPaintAll').checked=layers.length>0&&layers.every(lyrPaints);}
function lyrColorTitle(L){
  const src=(/^#[0-9a-f]{6}$/i.test(L.tint||''))?'kézi szín'
    :(L.stack&&L.role&&typeof stkRole==='function')?('a szerep rögzített színe · '+((stkRole(L.role)||{n:L.role}).n))
    :'automatikus szín';
  return lyrColor(L)+' — '+src+'. Kattints: a réteg készülékei '+(lyrPaints(L)?'ne legyenek':'legyenek')+' ezzel színezve.';}
// the panel's "Mind színezve": on turns every layer on, off turns every layer off
function lyrPaintAll(on){lyrPushUndo();layers.forEach(L=>{if(on)L.paint=true;else delete L.paint;});
  renderLayers();draw();return on;}

// right-click on a sub-layer row: the menu is flat (ctxMenu has no submenus)
function lyrSubMenu(e,sl){const p=sl.split(':'),L=lyrLayer(p[0]),cat=p[1];if(!L)return;
  const others=layers.filter(x=>x.id!==L.id),items=[];
  others.forEach(o=>items.push({label:'Csere: '+esc(o.name),act:()=>lyrSwapCat(L.id,o.id,cat)}));
  if(others.length){items.push({label:'—',act:()=>{}});
    others.forEach(o=>items.push({label:'Áthelyezés: '+esc(o.name),act:()=>lyrMoveCat(L.id,o.id,cat)}));
    items.push({label:'—',act:()=>{}});}
  items.push({label:'Csak ez látszik',act:()=>lyrSolo(L.id,cat)});
  items.push({label:'Átlátszatlanság visszaállítása',act:()=>{lyrSetOp(L.id,cat,1);renderLayers();}});
  ctxMenu(e,items);}

// ---- hold and drag a sub-layer onto another layer [Q01=A] ------------------------------------
// 350 ms without moving more than 6 px lifts the row; drop on another layer block = swap,
// with Ctrl = move. Release elsewhere, or Esc = nothing. Every exit goes through lyrDragEnd.
let lyrDrag=null;
function lyrBlockAt(e){let t=null;try{t=document.elementFromPoint(e.clientX,e.clientY);}catch(_){}
  if(!t)t=e.target;return (t&&t.closest)?t.closest('[data-lb]'):null;}
function lyrDragArm(e,row){lyrDragEnd();
  const D=lyrDrag={row,sl:row.dataset.sl,x:e.clientX,y:e.clientY,id:e.pointerId,on:false,timer:null};
  D.timer=setTimeout(()=>{D.timer=null;D.on=true;row.classList.add('ldrag');
    try{if(row.setPointerCapture&&D.id!=null)row.setPointerCapture(D.id);}catch(_){}},350);
  document.addEventListener('pointermove',lyrDragMove,true);
  document.addEventListener('pointerup',lyrDragUp,true);
  document.addEventListener('pointercancel',lyrDragEnd,true);
  document.addEventListener('keydown',lyrDragKey,true);}
function lyrDragMove(e){const D=lyrDrag;if(!D)return;
  if(!D.on){if(Math.hypot(e.clientX-D.x,e.clientY-D.y)>6)lyrDragEnd();return;}   // moved early: it is a scroll, not a lift
  const blk=lyrBlockAt(e),from=D.sl.split(':')[0],el=$('layerList');
  if(el)el.querySelectorAll('.ldrop').forEach(n=>n.classList.remove('ldrop'));
  if(blk&&blk.dataset.lb!==from)blk.classList.add('ldrop');}
function lyrDragUp(e){const D=lyrDrag;if(!D)return;
  const was=D.on,sl=D.sl,blk=was?lyrBlockAt(e):null,ctrl=!!(e.ctrlKey||e.metaKey);
  lyrDragEnd();
  if(!was||!blk)return;
  const p=sl.split(':'),to=blk.dataset.lb;if(to===p[0])return;
  (ctrl?lyrMoveCat:lyrSwapCat)(p[0],to,p[1]);}
function lyrDragKey(e){if(e.key!=='Escape'||!lyrDrag||!lyrDrag.on)return;e.stopPropagation();e.preventDefault();lyrDragEnd();}
function lyrDragEnd(){const D=lyrDrag;lyrDrag=null;
  document.removeEventListener('pointermove',lyrDragMove,true);
  document.removeEventListener('pointerup',lyrDragUp,true);
  document.removeEventListener('pointercancel',lyrDragEnd,true);
  document.removeEventListener('keydown',lyrDragKey,true);
  if(!D)return;
  if(D.timer)clearTimeout(D.timer);
  try{if(D.on&&D.row.releasePointerCapture&&D.id!=null)D.row.releasePointerCapture(D.id);}catch(_){}
  try{D.row.classList.remove('ldrag');}catch(_){}
  const el=$('layerList');if(el)el.querySelectorAll('.ldrop').forEach(n=>n.classList.remove('ldrop'));}

// ---- actions (palette) ------------------------------------------------------------------------
function lyrCatDialog(title,go){
  const lo=layers.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join(''),
        co=LAYER_CATS.map(c=>`<option value="${c.k}">${c.n}</option>`).join('');
  openModal(title,`<div class="mrow">Réteg <select id="lcFrom" style="width:150px">${lo}</select></div>`
    +`<div class="mrow">Alréteg <select id="lcCat" style="width:150px">${co}</select></div>`
    +`<div class="mrow">Ide <select id="lcTo" style="width:150px">${lo}</select></div>`,
    ()=>{const a=$('lcFrom').value,b=$('lcTo').value;if(a===b){lyrHud('A két réteg ugyanaz.');return false;}go(a,b,$('lcCat').value);});}
registerActions([
 {id:'layer.swapCat',alias:'reteg csere alreteg swap sublayer layer',label:'Alréteg cseréje másik réteggel',icon:'⇄',group:'Réteg',
  hint:'Két réteg azonos alrétegének (pl. Dugaljak) elemei helyet cserélnek.',
  need:'Legalább két rétegre van szükség.',when:c=>layers.length>1,
  run:()=>lyrCatDialog('Alréteg cseréje',lyrSwapCat)},
 {id:'layer.moveCat',alias:'reteg athelyezes alreteg move sublayer layer',label:'Alréteg áthelyezése másik rétegre',icon:'→',group:'Réteg',
  hint:'Egy réteg alrétegének (pl. Falak) elemei átkerülnek a másik rétegre.',
  need:'Legalább két rétegre van szükség.',when:c=>layers.length>1,
  run:()=>lyrCatDialog('Alréteg áthelyezése',lyrMoveCat)}
]);

// ---- link groups and lock -----------------------------------------------------------------------
// layers of one link group share visibility, opacity and lock; nothing moves together
function lyrGroupOf(id){const L=lyrLayer(id);if(!L)return [];
  return L.link?layers.filter(x=>x.link===L.link):[L];}
function lyrTidyLinks(){const n={};layers.forEach(l=>{if(l.link)n[l.link]=(n[l.link]||0)+1;});
  layers.forEach(l=>{if(l.link&&n[l.link]<2)delete l.link;});}
function lyrLink(ids){ids=(ids||[]).filter((x,i,a)=>lyrLayer(x)&&a.indexOf(x)===i);
  if(ids.length<2){if(ids.length)lyrUnlink(ids[0]);return null;}
  lyrPushUndo();
  let g,n=Date.now();do{g='g'+n.toString(36);n++;}while(layers.some(l=>l.link===g));
  ids.forEach(i=>{lyrLayer(i).link=g;});lyrTidyLinks();
  lyrRefresh();lyrHud('Csatolva: '+ids.map(i=>lyrLayer(i).name).join(' + '));return g;}
function lyrUnlink(id){const L=lyrLayer(id);if(!L||!L.link)return false;
  lyrPushUndo();delete L.link;lyrTidyLinks();lyrRefresh();lyrHud('Csatolás bontva: '+L.name);return true;}
function lyrToggleLock(id){const L=lyrLayer(id);if(!L)return;const v=!L.lock;
  lyrGroupOf(id).forEach(x=>{if(v)x.lock=true;else delete x.lock;});renderLayers();
  lyrHud(v?'Zárolva: '+L.name:'Feloldva: '+L.name);}
// an item on a locked layer is not hit (hitTest and friends call this at the point where it WOULD hit);
// it still draws and snaps. hitTest reports the name when the click found nothing else.
let lyrLockName=null;
function lyrLockHit(item){const L=layerById((item&&item.layer)||'L0');
  if(L&&L.lock){lyrLockName=L.name;return true;}return false;}
function lyrLockReport(hit){const n=lyrLockName;lyrLockName=null;
  if(!hit&&n)lyrHud('Zárolt réteg: '+n);return hit;}

// ---- delete --------------------------------------------------------------------------------------------
// The layer goes; its items move to the base layer L0 (they used to keep a dead layer id and only LOOKED like
// L0's). One undo step brings the layer and the items back. A stack role layer leaves its stack, which is resynced.
function lyrDelete(id){const L=lyrLayer(id);if(!L||id==='L0')return false;
  lyrPushUndo();let n=0;const touched=[];
  lyrEachItem((k,r)=>{if((r.layer||'L0')===id){r.layer='L0';n++;if(k==='walls')touched.push({coll:k,rec:r});}});
  lyrSnapWalls(touched);
  layers=layers.filter(l=>l.id!==id);lyrTidyLinks();
  if(L.stack&&typeof stkById==='function'){const S=stkById(L.stack);if(S)stkSync(S);}
  if(!layers.some(l=>l.id===state.activeLayer))state.activeLayer='L0';
  lyrRefresh();lyrHud('Réteg törölve: '+L.name+(n?' — '+n+' elem az Alap rétegre került':''));
  return true;}
// ---- duplicate -------------------------------------------------------------------------------------
function lyrNewId(){let n=Date.now(),id;do{id='L'+n.toString(36);n++;}while(layers.some(l=>l.id===id));return id;}
// a copy of every item of the layer, fresh ids; links inside the layer are re-pointed at the copies.
// Walls only on request: a copied wall is a second wall on top of the first [Q06=A].
function lyrDuplicate(srcId,opt){opt=opt||{};const S=lyrLayer(srcId);if(!S)return null;
  lyrPushUndo();
  const id=lyrNewId(),N={id,name:S.name+' másolat',visible:S.visible!==false,cats:Object.assign({},S.cats)};
  if(S.op)N.op=Object.assign({},S.op);if(S.tint)N.tint=S.tint;
  layers.splice(layers.indexOf(S)+1,0,N);
  const pairs={};let n=0;
  UKEYS.forEach(k=>{if(k==='runs'||!Array.isArray(data[k]))return;     // runs are derived, they carry no layer
    const add=[];
    data[k].forEach(r=>{if(!r||typeof r!=='object'||!lyrCatOf(k,r)||(r.layer||'L0')!==srcId)return;
      const c=copyRecord(k,r);c.layer=id;
      if(k==='paths'&&Array.isArray(c.nodes))c.nodes.forEach(nd=>{delete nd.id;});   // else the next copy of a copy collides
      add.push([r,c]);});
    pairs[k]=add;add.forEach(p=>data[k].push(p[1]));n+=add.length;});
  ensureIds(data);
  // links: by node INDEX (the copy's nodes have new ids), only to paths that were copied too
  const pp={};(pairs.paths||[]).forEach(p=>{pp[p[0].id]=p;});
  (pairs.devices||[]).forEach(([o,c])=>{devLinks(o).forEach(l=>{const q=pp[l.p];if(!q)return;
    const ni=q[0].nodes.findIndex(x=>x.id===l.n);if(ni<0||!q[1].nodes[ni])return;
    if(l.glue)setLink(c,q[1].id,q[1].nodes[ni].id);else addLink(c,q[1].id,q[1].nodes[ni].id);});});
  // joins of one route onto another's node (j:{p,n}): re-pointed when the target was copied as well
  (pairs.paths||[]).forEach(([o,c])=>{o.nodes.forEach((nd,i)=>{const j=nd&&nd.j,q=j&&pp[j.p];if(!q||!c.nodes[i])return;
    const ni=q[0].nodes.findIndex(x=>x.id===j.n);if(ni>=0&&q[1].nodes[ni])c.nodes[i].j={p:q[1].id,n:q[1].nodes[ni].id};});});
  // clip rows: copies that shared a row share a NEW one (as cloneMulti does)
  const rows={},stamp=Date.now().toString(36);let ri=0;
  (pairs.devices||[]).forEach(([o,c])=>{if(!o.clip)return;if(!rows[o.clip])rows[o.clip]='clip'+stamp+'d'+(ri++);c.clip=rows[o.clip];});
  // a generated lamp object and its device are tied by genId; the copies get a fresh common one
  const gens={};let gi=0;
  ['devices','objects'].forEach(k=>(pairs[k]||[]).forEach(([o,c])=>{if(!o.genId)return;
    if(!gens[o.genId])gens[o.genId]='lamp'+stamp+'d'+(gi++);c.genId=gens[o.genId];}));
  if(opt.walls){for(const l of ORD){const add=[];
      (WALLS[l]||[]).forEach(r=>{if(r&&(r.layer||'L0')===srcId){const c=JSON.parse(JSON.stringify(r));delete c.id;c.layer=id;add.push(c);}});
      if(add.length){add.forEach(c=>WALLS[l].push(c));n+=add.length;}}
    ensureIds(data);for(const l of ORD)SNAP[l]=centerlines(WALLS[l]||[]);}
  lyrRefresh();
  lyrHud('Réteg másolva: '+S.name+' ('+n+' elem)');
  return id;}

// ---- merge ------------------------------------------------------------------------------------------
// every item of the `from` layers moves to `into`; the from layers are removed. `into` keeps its own
// cats and opacity. L0 is the fallback layer: a target, never a source.
function lyrMerge(intoId,fromIds,opt){const I=lyrLayer(intoId);
  const from=(fromIds||[]).filter((x,i,a)=>x!==intoId&&lyrLayer(x)&&a.indexOf(x)===i);
  if(!I||!from.length)return false;
  if(from.indexOf('L0')>=0){lyrHud('Az alap réteg (L0) nem olvasztható be máshová.');return false;}
  if(from.some(x=>lyrLayer(x).stack&&lyrLayer(x).stack!==I.stack)){lyrHud('Stack réteg csak a saját stackjébe olvasztható.');return false;}
  if(!(opt&&opt.noUndo))lyrPushUndo();       // noUndo: the caller (a stack wizard) already took the one undo step
  let n=0;const touched=[];
  lyrEachItem((k,r)=>{if(from.indexOf(r.layer||'L0')>=0){r.layer=intoId;n++;if(k==='walls')touched.push({coll:k,rec:r});}});
  lyrSnapWalls(touched);
  const names=from.map(x=>lyrLayer(x).name);
  layers=layers.filter(l=>from.indexOf(l.id)<0);lyrTidyLinks();
  if(!layers.some(l=>l.id===state.activeLayer))state.activeLayer=intoId;
  lyrRefresh();lyrHud('Egyesítve: '+names.join(', ')+' → '+I.name+' ('+n+' elem)');
  return true;}
function lyrMergeDown(id){const i=layers.findIndex(l=>l.id===id);
  if(i<0)return false;
  if(i===layers.length-1){lyrHud('Nincs alatta réteg, amibe egyesíthető lenne.');return false;}
  return lyrMerge(layers[i+1].id,[id]);}
function lyrMergeLinked(id){const g=lyrGroupOf(id);
  if(g.length<2){lyrHud('Ez a réteg nincs csatolva.');return false;}
  const top=g[0];return lyrMerge(top.id,g.slice(1).map(l=>l.id));}

// ---- the layer's right-click menu and actions ---------------------------------------------------------
function lyrDuplicateDialog(id){const L=lyrLayer(id);if(!L)return;
  openModal('Réteg másolása',`<div class="mrow">„${esc(L.name)}” minden eleméről új réteg készül (új azonosítókkal).</div>`
    +`<div class="mrow"><label><input type="checkbox" id="ldWalls"> falakkal együtt</label></div>`
    +`<div class="mrow" style="font-size:11px;color:#888">Falak nélkül a másolat nem kettőz meg falat az eredeti tetején.</div>`,
    ()=>{lyrDuplicate(id,{walls:$('ldWalls').checked});});}
function lyrLinkDialog(id){
  openModal('Rétegek csatolása',`<div class="mrow" style="font-size:11px;color:#888">A csatolt rétegek láthatósága, átlátszósága és zárolása együtt változik.</div>`
    +layers.map(l=>`<div class="mrow"><label><input type="checkbox" class="llSel" value="${l.id}" ${(l.id===id||(lyrLayer(id)&&lyrLayer(id).link&&l.link===lyrLayer(id).link))?'checked':''}> ${esc(l.name)}</label></div>`).join(''),
    ()=>{lyrLink([...document.querySelectorAll('.llSel')].filter(x=>x.checked).map(x=>x.value));});}
function lyrLayerMenu(e,id){const L=lyrLayer(id);if(!L)return;const i=layers.indexOf(L),items=[];
  items.push({label:'Réteg másolása…',act:()=>lyrDuplicateDialog(id)});
  if(i<layers.length-1&&id!=='L0')items.push({label:'Egyesítés az alatta lévővel',act:()=>lyrMergeDown(id)});
  if(L.role==='construct'&&typeof stkNonConstruct==='function'&&stkNonConstruct(id).n)items.push({label:'Nem szerkezeti elemek áthelyezése új rétegre',act:()=>stkMoveNonConstruct(id)});
  if(L.link){items.push({label:'Csatolt rétegek egyesítése',act:()=>lyrMergeLinked(id)});items.push({label:'Csatolás bontása',act:()=>lyrUnlink(id)});}
  if(layers.length>1)items.push({label:'Csatolás…',act:()=>lyrLinkDialog(id)});
  items.push({label:L.lock?'Zárolás feloldása':'Zárolás',act:()=>lyrToggleLock(id)});
  ctxMenu(e,items);}
registerActions([
 {id:'layer.duplicate',alias:'reteg masolas duplicate layer copy',label:'Réteg másolása…',icon:'⧉',group:'Réteg',
  hint:'Az aktív réteg minden eleméről új réteg (új azonosítókkal; a rétegen belüli kötések az új elemekre mutatnak).',
  run:()=>lyrDuplicateDialog(state.activeLayer)},
 {id:'layer.mergeDown',alias:'reteg egyesites merge down layer',label:'Egyesítés az alatta lévővel',icon:'⤓',group:'Réteg',
  hint:'Az aktív réteg elemei a lista szerint alatta lévő rétegre kerülnek, a réteg megszűnik.',
  need:'Az aktív rétegnek legyen alatta másik, és ne az alap réteg legyen.',
  when:c=>{const i=layers.findIndex(l=>l.id===state.activeLayer);return i>=0&&i<layers.length-1&&state.activeLayer!=='L0';},
  run:()=>lyrMergeDown(state.activeLayer)},
 {id:'layer.mergeLinked',alias:'csatolt retegek egyesitese merge linked layers',label:'Csatolt rétegek egyesítése',icon:'⤓',group:'Réteg',
  hint:'A csatolt csoport minden rétege a legfelsőbe olvad.',
  need:'Az aktív réteg legyen csatolva.',when:c=>lyrGroupOf(state.activeLayer).length>1,
  run:()=>lyrMergeLinked(state.activeLayer)},
 {id:'layer.link',alias:'reteg csatolas link layers',label:'Csatolás…',icon:'🔗',group:'Réteg',
  hint:'A csatolt rétegek láthatósága, átlátszósága és zárolása együtt változik.',
  need:'Legalább két rétegre van szükség.',when:c=>layers.length>1,
  run:()=>lyrLinkDialog(state.activeLayer)},
 {id:'layer.unlink',alias:'reteg csatolas bontasa unlink layer',label:'Csatolás bontása',icon:'⛓',group:'Réteg',
  need:'Az aktív réteg legyen csatolva.',when:c=>lyrGroupOf(state.activeLayer).length>1,
  run:()=>lyrUnlink(state.activeLayer)},
 {id:'layer.lock',alias:'reteg zarolas lock unlock layer',label:'Zárolás be / ki',icon:'🔒',group:'Réteg',
  hint:'A zárolt réteg elemei nem jelölhetők ki, nem húzhatók és nem törölhetők; látszanak és rájuk lehet illeszkedni.',
  run:()=>lyrToggleLock(state.activeLayer)}
]);

// test hooks
window.LAYER_CATS=LAYER_CATS;window.lyrDevCat=lyrDevCat;window.lyrCat=lyrCat;window.lyrCatOf=lyrCatOf;
window.lyrMigrate=lyrMigrate;window.lyrMigrateAll=lyrMigrateAll;window.lyrOp=lyrOp;window.lyrOpAttr=lyrOpAttr;
window.lyrWrap=lyrWrap;window.lyrWrapFrom=lyrWrapFrom;window.lyrWrapOp=lyrWrapOp;window.lyrTagOp=lyrTagOp;window.lyrFaces=lyrFaces;window.lyrSetOp=lyrSetOp;window.lyrPushUndo=lyrPushUndo;window.layerCatsAll=layerCatsAll;
window.layerShows=layerShows;window.lyrEachItem=lyrEachItem;window.lyrItemsOf=lyrItemsOf;window.lyrCounts=lyrCounts;window.lyrCount=lyrCount;
window.lyrSwapCat=lyrSwapCat;window.lyrMoveCat=lyrMoveCat;window.lyrSolo=lyrSolo;window.lyrStepOp=lyrStepOp;window.lyrOpOf=lyrOpOf;window.lyrSubMenu=lyrSubMenu;
window.lyrGroupOf=lyrGroupOf;window.lyrLink=lyrLink;window.lyrUnlink=lyrUnlink;window.lyrToggleLock=lyrToggleLock;window.lyrLockHit=lyrLockHit;window.lyrDuplicate=lyrDuplicate;
window.lyrMerge=lyrMerge;window.lyrDelete=lyrDelete;window.lyrMergeDown=lyrMergeDown;window.lyrMergeLinked=lyrMergeLinked;window.lyrLayerMenu=lyrLayerMenu;
