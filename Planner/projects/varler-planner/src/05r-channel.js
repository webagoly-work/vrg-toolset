// ==========================================================================
// 05r-channel.js — the channel topology between hardware nodes (WP-C5)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A channel route is an ordinary path (data.paths) drawn with the Path tool while CHN_T is on:
//   {route:'channel', rule:'sull'|'csat', carrier?:<override>}
// Its ends link to hardware devices through the Path tool's own node-on-box snapping (05k), so the route knows
// what it joins. WHAT it carries is derived from the two end types (CHN_CARRIERS) [Q25=A] — the fill (E4)
// turns that into pipes and cables. Several routes between the same pair are legal and named /b, /c.
// Prefix: chn.

const CHN_CARRIERS=[
 {pair:['meter','board'], k:'feed',    n:'Fővezeték'},
 {pair:['entry','base'],  k:'isp',     n:'Szolgáltatói belépés'},
 {pair:['board','base'],  k:'panel',   n:'PANEL LINK + rendszerkörök'},
 {pair:['base','rbx'],    k:'channel', n:'CHANNEL köteg'},
 {pair:['rbx','rbx'],     k:'channel', n:'CHANNEL köteg (lánc)'},
 {pair:['board','rbx'],   k:'mains',   n:'Erősáramú szobakörök'},
 {pair:['board','ssc'],   k:'mains',   n:'SSC körök'},
 {pair:['ssc','rbx'],     k:'security',n:'Biztonsági törzs'},
 {pair:['base','ssc'],    k:'data',    n:'SSC adat (VLAN 50)'}];
// the CHANNEL bundle, STD-001 §3.1 — fixed order, fixed sizes
const CHN_BUNDLE=[
 {k:'C1', fam:'DATA',   w:'M25', cab:[{c:'CAT6A_U',n:2}]},
 {k:'C2', fam:'MEDIA',  w:'M40', cab:[{c:'AOC_FIX'},{c:'CAT6A_U'}]},
 {k:'C3', fam:'CONTROL',w:'M20', cab:[{c:'CAT6A_S'}]},
 {k:'C4', fam:null,     w:'M25', cab:[{c:'SPARE'}]},
 {k:'C4b',fam:'BUSB',   w:'M20', cab:[{c:'H05_2x25'}]},
 {k:'C5', fam:'KNX',    w:'M20', cab:[{c:'SPARE'}], note:'KNX / DALI tartalék, üresen beépítve'}];
const CHN_COL={channel:'#2f6fb0',mains:'#d1493f',panel:'#7a5cc0',security:'#555555',feed:'#8a3a2a',isp:'#16a085',data:'#16a085'};
const CHN_RANK={meter:0,entry:1,board:2,base:3,ssc:4,rbx:5};

let CHN_T={on:false,rule:'sull'};
// routes finished by the Path tool pass through these (E1's ARM routes use the same hook)
const CHN_PATH_HOOKS=[];
function chnPathFinished(p){CHN_PATH_HOOKS.forEach(f=>{try{f(p);}catch(_){}});}
function chnBuild(rule){return rule==='csat'?'kv_csat_szeles':'sull_gege';}
function chnApplyRule(p,rule){p.rule=rule==='csat'?'csat':'sull';p.ptype=p.rule==='csat'?'csat':'gege';
  (p.sections||[]).forEach(s=>{if(s)s.build=chnBuild(p.rule);});}
CHN_PATH_HOOKS.push(p=>{if(!CHN_T.on||!p)return;p.route='channel';chnApplyRule(p,CHN_T.rule);
  const k=chnCarrier(p);if(CHN_COL[k])p.color=CHN_COL[k];
  const e=chnEnds(p);lyrHud('Csatorna: '+chnName(p)+' — '+chnCarrierName(k)+(e[0]&&e[1]?'':' · figyelem: nyitott vég (nincs hardverponton)'));});

// ---- derived ------------------------------------------------------------------------------------------------------
function chnRoutes(){return data.paths.filter(p=>p&&p.route==='channel');}
function chnIsHw(d){return !!d&&(d.type==='board'||(typeof hwIs==='function'&&hwIs(d)));}
// the hardware device linked to a node of this path, or null
function chnDevAt(p,n){if(!n)return null;return data.devices.find(d=>chnIsHw(d)&&hasLinkTo(d,p.id,n.id))||null;}
function chnEnds(p){const ns=(p&&p.nodes)||[];return [chnDevAt(p,ns[0]),chnDevAt(p,ns[ns.length-1])];}
function chnDerived(a,b){if(!a||!b)return null;
  const c=CHN_CARRIERS.find(x=>(x.pair[0]===a.type&&x.pair[1]===b.type)||(x.pair[0]===b.type&&x.pair[1]===a.type));return c?c.k:null;}
function chnCarrier(p){if(p.carrier)return p.carrier;const e=chnEnds(p);return chnDerived(e[0],e[1])||'ismeretlen';}
function chnCarrierName(k){const c=CHN_CARRIERS.find(x=>x.k===k);return c?c.n:(k==='ismeretlen'?'ismeretlen hordozó':k);}
function chnRank(d){return d?(CHN_RANK[d.type]!=null?CHN_RANK[d.type]:9):99;}
function chnSortEnds(p){const e=chnEnds(p).slice();e.sort((x,y)=>chnRank(x)-chnRank(y)||String((x&&x.ref)||'').localeCompare(String((y&&y.ref)||'')));return e;}
function chnPairKey(p){const e=chnSortEnds(p);return e.map(d=>d?d.id:'?').join('~');}
// '<refA>~<refB>', the lower rank first; the 2nd, 3rd … route between the same pair gets /b, /c (by id order)
function chnName(p){const e=chnSortEnds(p),base=e.map(d=>d?(d.ref||d.id):'?').join('~'),key=chnPairKey(p);
  const same=chnRoutes().filter(q=>chnPairKey(q)===key),i=same.indexOf(p);   // creation order (data.paths order)
  return i>0?base+'/'+String.fromCharCode(97+i):base;}
function chnLen(p){let s=0;const ns=p.nodes||[];for(let i=1;i<ns.length;i++)s+=Math.hypot(ns[i].x-ns[i-1].x,ns[i].y-ns[i-1].y,(ns[i].h||0)-(ns[i-1].h||0));return s;}
// {nodes:[ids], edges:[{a,b,p,carrier,len}]}
function chnGraph(){const edges=[],nodes=new Set();
  chnRoutes().forEach(p=>{const e=chnEnds(p);if(!e[0]||!e[1]||e[0]===e[1])return;
    nodes.add(e[0].id);nodes.add(e[1].id);edges.push({a:e[0].id,b:e[1].id,p:p.id,carrier:chnCarrier(p),len:Math.round(chnLen(p))});});
  return {nodes:[...nodes],edges};}
// shortest 'channel'-carrier paths from the BASE devices (or one of them): {<id>:{parent, root, len, hops, via:[route ids]}}
function chnTree(baseId){const G=chnGraph(),adj={};
  G.edges.filter(e=>e.carrier==='channel').forEach(e=>{(adj[e.a]=adj[e.a]||[]).push(e);(adj[e.b]=adj[e.b]||[]).push(e);});
  const roots=hwList('base').filter(b=>!baseId||b.id===baseId).map(b=>b.id),T={},open=[];
  roots.forEach(r=>{T[r]={parent:null,root:r,len:0,hops:0,via:[]};open.push(r);});
  while(open.length){open.sort((x,y)=>T[x].len-T[y].len||prtIdCmp(x,y));const u=open.shift();
    (adj[u]||[]).forEach(e=>{const v=e.a===u?e.b:e.a,nl=T[u].len+e.len;
      if(!T[v]||nl<T[v].len){T[v]={parent:u,root:T[u].root,len:nl,hops:T[u].hops+1,via:T[u].via.concat([e.p])};
        const vd=byId('devices',v);if(vd&&vd.type==='rbx'&&open.indexOf(v)<0)open.push(v);}});}   // only RoomBoxes pass the chain on
  roots.forEach(r=>{delete T[r];});return T;}
function chnLenToBase(rbxId,baseId){const t=chnTree(baseId)[rbxId];return t?t.len:null;}
function chnChain(rbxId){const t=chnTree()[rbxId];if(!t)return null;const p=byId('devices',t.parent);return p&&p.type==='base'?'direct':'chained';}

// ---- the tool: the Path tool with a flag ----------------------------------------------------------------------------
function chnToolStart(){const S=(typeof stkActive==='function')?stkActive():null,L=S?vstPathLayer(S,'channel'):null;   // V6: route in a Villany Stack
  if(L){state.activeLayer=L.id;renderLayers();}
  if(typeof mrkToolsOff==='function')mrkToolsOff();if(typeof hwToolOff==='function')hwToolOff();
  state.pathType=CHN_T.rule==='csat'?'csat':'gege';setMode('path');CHN_T.on=true;
  const mh=$('modeHint');if(mh)mh.textContent='Csatorna-útvonal: kattints a hardverpontokra (RBX, BASE, Elosztó…) · R: süllyesztett ↔ kábelcsatorna · dupla katt: kész';
  lyrHud('Csatorna-útvonal — '+(CHN_T.rule==='csat'?'kábelcsatorna':'süllyesztett'));}
STK_TOOLS.push({k:'chnRoute',active:()=>{if(!CHN_T.on)return false;if(state.mode!=='path'){CHN_T.on=false;return false;}return true;},
  key(e){if(!((e.key==='r'||e.key==='R')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey))return false;e.preventDefault();CHN_T.rule=CHN_T.rule==='csat'?'sull':'csat';state.pathType=CHN_T.rule==='csat'?'csat':'gege';
    if(typeof pathDraft!=='undefined'&&pathDraft)pathDraft.ptype=state.pathType;
    lyrHud(CHN_T.rule==='csat'?'Kábelcsatorna':'Süllyesztett');return true;},
  mode(){CHN_T.on=false;},     // any tool change ends it (chnToolStart sets the flag AFTER its own setMode)
  esc(){CHN_T.on=false;}});

// ---- labels ----------------------------------------------------------------------------------------------------------------
function chnLabelsSvg(){const S=(typeof stkActive==='function')?stkActive():null,L=S?lyrLayer(state.activeLayer):null;
  if(!state.chnLabels&&!(L&&L.stack===S.id&&L.role==='channel'))return '';let s='';
  chnRoutes().forEach(p=>{const ns=p.nodes||[];if(ns.length<2||!state.levels[ns[0].level]||!layerShows(p,'path'))return;
    let bi=1,bl=-1;for(let i=1;i<ns.length;i++){const l=Math.hypot(ns[i].x-ns[i-1].x,ns[i].y-ns[i-1].y);if(l>bl){bl=l;bi=i;}}
    const a=ns[bi-1],b=ns[bi],k=chnCarrier(p),col=CHN_COL[k]||'#555';
    s+=mrkText((a.x+b.x)/2,(a.y+b.y)/2,dz(a.level,((a.h||0)+(b.h||0))/2),chnName(p)+' · '+chnCarrierName(k),col,9);});
  return s?`<g pointer-events="none">${s}</g>`:'';}
STK_OVERLAY.push(chnLabelsSvg);

// ---- right-click on a channel route (adds to the route menu) ----------------------------------------------------------------
function chnContentText(p){const k=chnCarrier(p);
  if(k==='channel')return CHN_BUNDLE.map(b=>b.k+' '+b.w+' · '+(b.fam||'tartalék')+' · '+b.cab.map(c=>(c.n?c.n+'×':'')+((typeof AFILL_CABLES!=='undefined'&&AFILL_CABLES[c.c])?AFILL_CABLES[c.c].n:c.c)).join(' + ')+(b.note?' ('+b.note+')':'')).join('\n');
  if(k==='feed')return 'A betáp a szolgáltató szabályai szerint (A08) — nem számolt.';
  return 'A tartalmat a Csatorna feltöltése (E4) számolja.';}
STK_PATHMENU.push((ps,items)=>{const p=data.paths[ps.pi];if(!p||p.route!=='channel')return;
  items.unshift({label:'⇋ Csatorna: '+chnName(p)+' — '+chnCarrierName(chnCarrier(p)),act:()=>{}});
  if(p.rule!=='sull')items.push({label:'⇋ Szabály: süllyesztett',act:()=>{pushUndo(['paths']);chnApplyRule(p,'sull');draw();}});
  if(p.rule!=='csat')items.push({label:'⇋ Szabály: kábelcsatorna',act:()=>{pushUndo(['paths']);chnApplyRule(p,'csat');draw();}});
  if(p.carrier)items.push({label:'⇋ Hordozó: automatikus ('+chnCarrierName(chnDerived(...chnEnds(p))||'ismeretlen')+')',act:()=>{pushUndo(['paths']);delete p.carrier;draw();}});
  [...new Set(CHN_CARRIERS.map(c=>c.k))].forEach(k=>{if(k!==chnCarrier(p))items.push({label:'⇋ Hordozó: '+chnCarrierName(k),act:()=>{pushUndo(['paths']);p.carrier=k;if(CHN_COL[k])p.color=CHN_COL[k];draw();}});});
  items.push({label:'⇋ Tartalom megjelenítése',act:()=>openModal('Csatorna tartalma — '+chnName(p),`<pre style="font-size:11.5px;white-space:pre-wrap">${esc(chnContentText(p))}</pre>`,()=>{},'Bezár')});});

// ---- checks -------------------------------------------------------------------------------------------------------------------
(STK_CHECKS.channel=STK_CHECKS.channel||[]).push(S=>{const out=[];
  chnRoutes().forEach(p=>{const e=chnEnds(p);if(!e[0]||!e[1])out.push({sev:'warn',msg:'Nyitott végű csatorna: '+chnName(p)});
    else if(chnCarrier(p)==='ismeretlen')out.push({sev:'info',msg:chnName(p)+': ismeretlen hordozó ('+e[0].type+' – '+e[1].type+')'});});
  const T=chnTree(),G=chnGraph();
  hwList('rbx').forEach(d=>{
    if(!T[d.id])out.push({sev:'warn',msg:(d.ref||d.id)+': nincs CHANNEL kapcsolata BASE-hez.'});
    else{if(T[d.id].len>90000)out.push({sev:'error',msg:(d.ref||d.id)+': '+(T[d.id].len/1000).toFixed(0)+' m a BASE-ig (> 90 m Cat6A).'});
      const par=byId('devices',T[d.id].parent);if(par&&par.type==='rbx'&&par.rb!=='RB-H')out.push({sev:'info',msg:(par.ref||par.id)+' láncpont: '+(d.ref||d.id)+' rajta keresztül — RB-H javasolt (STD-001).'});}
    if(!G.edges.some(e=>e.carrier==='mains'&&(e.a===d.id||e.b===d.id)))out.push({sev:'warn',msg:(d.ref||d.id)+': nincs erősáramú útvonal az Elosztószekrénytől.'});});
  if(hwList('meter').length&&!G.edges.some(e=>e.carrier==='feed'))out.push({sev:'info',msg:'Nincs fővezeték (mérőóra → Elosztószekrény).'});
  if(hwList('entry').length&&!G.edges.some(e=>e.carrier==='isp'))out.push({sev:'info',msg:'Nincs szolgáltatói belépés (adatbelépés → BASE).'});
  return out;});

registerActions([
 {id:'chn.route',alias:'csatorna utvonal channel route path hardware',label:'Csatorna-útvonal',icon:'⇋',group:'Csatorna',
  hint:'A Pálya eszköz egy változata: két hardverpont (BASE, RBX, Elosztó, SSC…) közötti fizikai összeköttetés. R: süllyesztett ↔ kábelcsatorna.',
  run:()=>chnToolStart()},
 {id:'chn.labels',alias:'csatorna feliratok channel labels',label:'Csatorna-feliratok be / ki',icon:'🏷',group:'Csatorna',
  run:()=>{state.chnLabels=!state.chnLabels;draw();}}
]);

// test hooks
window.CHN_CARRIERS=CHN_CARRIERS;window.CHN_BUNDLE=CHN_BUNDLE;window.CHN_T=CHN_T;window.CHN_PATH_HOOKS=CHN_PATH_HOOKS;
window.chnRoutes=chnRoutes;window.chnEnds=chnEnds;window.chnCarrier=chnCarrier;window.chnName=chnName;window.chnGraph=chnGraph;window.chnTree=chnTree;
window.chnLenToBase=chnLenToBase;window.chnChain=chnChain;window.chnToolStart=chnToolStart;window.chnApplyRule=chnApplyRule;window.chnPathFinished=chnPathFinished;
window.chnLen=chnLen;window.chnContentText=chnContentText;
