// ==========================================================================
// 01-schema.js — document schema: ids, migrations, references, graph + validation seams
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
// ---------------------------------------------------------------------------
// DOCUMENT SCHEMA — ids, migrations, reference resolution, and the two seams
// (connectivity graph + validation) that the 1.1 work will build on.
//
// Why ids: every cross-reference used to be an ARRAY INDEX, so deleting a path
// silently repointed somebody else's reference at a different object. Ids are
// assigned from a per-document counter (data.seq), so they are stable, human
// readable (D7 / P3 / n12) and deterministic for a given creation order.
// ---------------------------------------------------------------------------
const SCHEMA_VERSION=2;
const IDPRE={devices:'D',paths:'P',objects:'O',openings:'B',floors:'F',roofs:'R',
             cables:'C',measures:'M',notes:'N',wallNotes:'W',circuits:'A',marks:'J',traces:'T',runs:'H'};

function idNum(id){const m=/(\d+)$/.exec(String(id||''));return m?+m[1]:0;}
function maxIdNum(d){let n=0;
  UKEYS.forEach(k=>{(d[k]||[]).forEach(r=>{n=Math.max(n,idNum(r&&r.id));
    if(k==='paths'&&r&&Array.isArray(r.nodes))r.nodes.forEach(q=>{n=Math.max(n,idNum(q&&q.id));});});});
  return n;}
// Assign ids to anything that lacks one. Cheap and idempotent; called wherever a
// document is snapshotted, saved or loaded rather than at every creation site.
function ensureIds(d){d=d||data;
  let seq=Math.max(+d.seq||0,maxIdNum(d));
  for(const l of ORD)(WALLS[l]||[]).forEach(r=>{seq=Math.max(seq,idNum(r&&r.id));});
  for(const l of ORD)(ROOMSB[l]||[]).forEach(r=>{seq=Math.max(seq,idNum(r&&r.id));});   // building rooms carry Y ids too
  const next=p=>p+(++seq);
  UKEYS.forEach(k=>{const pre=IDPRE[k]||'X';
    (d[k]||[]).forEach(r=>{if(!r||typeof r!=='object')return;
      if(!r.id)r.id=next(pre);
      if(k==='paths'&&Array.isArray(r.nodes))r.nodes.forEach(n=>{if(n&&!n.id)n.id=next('n');});});});
  // walls live outside `data` but still need a stable identity: the selection and the
  // gizmo hold a wall REFERENCE, and applySnap rebuilds every wall object.
  for(const l of ORD)(WALLS[l]||[]).forEach(r=>{if(r&&!r.id)r.id=next('W');});
  // building rooms too: a stack's room checklists point at a room by id, never by index. They persist
  // because sessionObj already writes B.rooms[l]=ROOMSB[l].
  for(const l of ORD)(ROOMSB[l]||[]).forEach(rm=>{if(rm&&!rm.id)rm.id=next('Y');});
  d.seq=seq;return d;}
// A copy is a NEW record. ensureIds() only fills in MISSING ids, so a copy that kept the original's
// id stayed a second answer to it for good: byId(), the circuit end points and the Behúzás entries
// then only ever found the first. A device copy also leaves behind what ties the original to its
// place: its links to route nodes and its clip row.
function copyRecord(coll,r){const c=JSON.parse(JSON.stringify(r));
  if(c&&typeof c==='object'){delete c.id;if(coll==='devices'){delete c.link;delete c.links;delete c.clip;}}
  return c;}

// ---- lookups (linear, but memoised per call site where it matters) ----
function byId(coll,id){if(!id)return null;const a=data[coll]||[];
  for(let i=0;i<a.length;i++)if(a[i]&&a[i].id===id)return a[i];return null;}
function indexById(coll,id){if(!id)return -1;const a=data[coll]||[];
  for(let i=0;i<a.length;i++)if(a[i]&&a[i].id===id)return i;return -1;}
function pathById(id){return byId('paths',id);}
function nodeById(pathId,nodeId){const p=pathById(pathId);if(!p)return null;
  for(const n of (p.nodes||[]))if(n.id===nodeId)return n;return null;}
function nodeIndexById(pathId,nodeId){const p=pathById(pathId);if(!p)return -1;
  return (p.nodes||[]).findIndex(n=>n.id===nodeId);}
// device ↔ path-node links, by id. A device holds a LIST, dev.links = [{p, n, glue?}]: a route
// usually enters a box and leaves it again, and several layers may each carry a routing proposal.
//  - glue:true — the Wall View link: node and box are one point and move together, height included.
//  - no glue   — the route reaches the box from a node above or beside it (auto-link, 05k): the node
//                follows the box in plan only and keeps its own height.
// A link resolves to null when either end is gone, which is what makes deletion safe.
// The single dev.link of older documents is read as a glued link, and migrate() converts it.
function devLinks(dv){if(!dv)return [];
  const out=Array.isArray(dv.links)?dv.links.filter(l=>l&&l.p&&l.n):[];
  if(dv.link&&dv.link.p&&dv.link.n&&!out.some(l=>l.p===dv.link.p&&l.n===dv.link.n))
    out.unshift({p:dv.link.p,n:dv.link.n,glue:true});
  return out;}
function resolveLink(l){const p=l&&pathById(l.p);if(!p)return null;
  const ix=(p.nodes||[]).findIndex(n=>n.id===l.n);if(ix<0)return null;
  return {path:p,node:p.nodes[ix],pi:indexById('paths',p.id),ni:ix,glue:!!l.glue};}
// every live link of a device, glued ones first
function linkTargets(dv){return devLinks(dv).map(resolveLink).filter(Boolean).sort((a,b)=>b.glue-a.glue);}
// the device's primary link — the glued one if it has one
function linkTarget(dv){return linkTargets(dv)[0]||null;}
function linkLabel(dv){return linkTargets(dv).map(t=>t.path.id+'/'+t.node.id).join(', ');}
function hasLinkTo(dv,pathId,nodeId){return devLinks(dv).some(l=>l.p===pathId&&l.n===nodeId);}
// set (or clear) the device's GLUED link; its other links stay
function setLink(dv,pathId,nodeId){if(!dv)return;
  const rest=devLinks(dv).filter(l=>!l.glue&&!(l.p===pathId&&l.n===nodeId));delete dv.link;
  dv.links=(pathId&&nodeId)?[{p:pathId,n:nodeId,glue:true}].concat(rest):rest;
  if(!dv.links.length)delete dv.links;}
// add a plan-only link, unless that node is already linked
function addLink(dv,pathId,nodeId){if(!dv||!pathId||!nodeId||hasLinkTo(dv,pathId,nodeId))return false;
  dv.links=devLinks(dv);delete dv.link;dv.links.push({p:pathId,n:nodeId});return true;}
function removeLinks(dv,pred){if(!dv)return 0;const all=devLinks(dv),keep=all.filter(l=>!pred(l));
  delete dv.link;if(keep.length)dv.links=keep;else delete dv.links;return all.length-keep.length;}
function clearLinks(dv){return removeLinks(dv,()=>true);}
// drop links whose target no longer exists (called after any deletion)
function pruneLinks(){data.devices.forEach(dv=>{if(!dv.link&&!dv.links)return;
  if(devLinks(dv).some(l=>!resolveLink(l)))removeLinks(dv,l=>!resolveLink(l));});}
// A stored reference to a device: an id since schema v2. A bare number is a v1 index and is
// still accepted, so a document that skipped migration degrades instead of crashing.
function devByRef(v){if(v==null)return null;
  if(typeof v==='number')return data.devices[v]||null;
  return byId('devices',v);}
function devIdOf(i){const dv=data.devices[i];if(!dv)return null;if(!dv.id)ensureIds();return dv.id;}

// ---- migrations: an old file must still open ----
function migrate(d){if(!d||typeof d!=='object')return d;
  const from=+d.v||0;
  if(from<1){
    // v0 → v1: links held array indices; convert them to ids while the indices
    // are still meaningful, then give everything an id.
    const pend=[];
    (d.devices||[]).forEach(dv=>{if(dv&&dv.link&&dv.link.p===undefined&&dv.link.pi!=null)
      pend.push([dv,dv.link.pi,dv.link.ni]);});
    ensureIds(d);
    pend.forEach(([dv,pi,ni])=>{const p=(d.paths||[])[pi],n=p&&(p.nodes||[])[ni];
      if(p&&n)dv.link={p:p.id,n:n.id};else delete dv.link;});
    if(!d.noteHide||typeof d.noteHide!=='object')d.noteHide={};
  }
  repairDupIds(d);                    // before v1→v2: a device index must still map to ONE id
  if(from<2){
    // v1 → v2: wiring held device INDICES (sec.circuits[].dev, swMap values), so deleting a
    // device re-pointed its wiring at the neighbour. Resolve them while the indices still mean
    // what they meant, then store ids.
    ensureIds(d);
    const devs=d.devices||[];
    const toId=v=>{if(typeof v!=='number')return v;const dv=devs[v];return dv?dv.id:null;};
    (d.paths||[]).forEach(p=>(p.sections||[]).forEach(sec=>{if(!sec||!Array.isArray(sec.circuits))return;
      sec.circuits.forEach(c=>{if(c&&c.dev!=null)c.dev=toId(c.dev);});
      sec.circuits=sec.circuits.filter(c=>!c||c.dev!==null);}));
    devs.forEach(dv=>{if(!dv||!dv.swMap||typeof dv.swMap!=='object')return;
      Object.keys(dv.swMap).forEach(k=>{const id=toId(dv.swMap[k]);if(id==null)delete dv.swMap[k];else dv.swMap[k]=id;});});
  }
  // one dev.link → a dev.links list (the old link was glued). No version step: it is idempotent,
  // so it simply runs on every load.
  (d.devices||[]).forEach(dv=>{if(!dv||!dv.link)return;const l=dv.link;delete dv.link;
    if(!l.p||!l.n)return;
    dv.links=Array.isArray(dv.links)?dv.links:[];
    if(!dv.links.some(x=>x.p===l.p&&x.n===l.n))dv.links.unshift({p:l.p,n:l.n,glue:true});});
  ensureIds(d);
  if(typeof swNumMigrate==='function')swNumMigrate(d);   // HU switch codes corrected 2026-10-14 (02-state.js) — once per device
  d.v=SCHEMA_VERSION;
  return d;}

// ---- repair: several records under one id ----
// Files saved before copyRecord() existed can hold them (NV4: three sockets all "D131"). On load
// the FIRST keeps the id and every later one gets a fresh id from the counter. What pointed at it:
//  - a device's links live on the device itself, so they simply travel with it;
//  - a Behúzás entry (sec.circuits[].dev) moves to a copy only when that is unambiguous, for the
//    whole group at once: its wire data matches exactly one of them; or the devices' own board
//    routes account for every entry (a route crosses a section once, so a section on k of the routes
//    carries k entries); or the devices hang on the same route node — so routing any of them writes
//    the same entries — and every section carries exactly one entry per device;
//  - anything else (a switch output, a circuit end point, an entry nothing explains) stays with the
//    first and is reported — idRepairReport(), the console, and the HUD after loading.
// Idempotent, and not a schema step: a document without repeats is left untouched.
let idRepairLast=null;
function repairDupIds(d){d=d||data;idRepairLast=null;
  const dups=[];
  UKEYS.forEach(k=>{const seen=new Map();(d[k]||[]).forEach(r=>{if(!r||typeof r!=='object'||!r.id)return;
    if(seen.has(r.id))dups.push({k,r,id:r.id,first:seen.get(r.id)});else seen.set(r.id,r);});});
  if(!dups.length)return null;
  let seq=Math.max(+d.seq||0,maxIdNum(d));
  for(const l of ORD)(WALLS[l]||[]).forEach(r=>{seq=Math.max(seq,idNum(r&&r.id));});
  const rep={reid:[],moved:0,split:[],kept:[]},groups=new Map();  // old device id → [first, copy…]
  dups.forEach(x=>{const nid=(IDPRE[x.k]||'X')+(++seq);
    rep.reid.push({coll:x.k,from:x.id,to:nid,ref:String(x.r.ref||x.r.name||x.r.text||'').slice(0,30)});
    if(x.k==='devices'){if(!groups.has(x.id))groups.set(x.id,[x.first]);groups.get(x.id).push(x.r);}
    x.r.id=nid;});
  d.seq=seq;
  const wires=o=>JSON.stringify(Object.keys(o||{}).filter(k=>k!=='dev').sort().map(k=>[k,o[k]]));
  const live=d===data&&typeof routeSections==='function';        // routes are read from the open document
  let graph=null;
  groups.forEach((G,X)=>{
    const es=[];
    (d.paths||[]).forEach((p,pi)=>(p.sections||[]).forEach((sec,si)=>{if(!sec)return;
      (Array.isArray(sec.circuits)?sec.circuits:[]).concat(sec.circuit?[sec.circuit]:[])
        .forEach(c=>{if(c&&c.dev===X)es.push({p,pi,si,c});});}));
    const req=G.filter(dv=>dv.req),unsure=[],to={};
    const move=(e,dv)=>{if(dv.id===X)return;e.c.dev=dv.id;rep.moved++;to[dv.id]=(to[dv.id]||0)+1;};
    es.forEach(e=>{const m=req.filter(dv=>wires(dv.req)===wires(e.c)),cands=m.length?m:req;
      if(cands.length===1)move(e,cands[0]);else{e.cands=cands;unsure.push(e);}});
    if(unsure.length){let plan=null;
      if(live){if(!graph)graph=buildGraph();
        const at={};                                                // one list per section and candidate set
        unsure.forEach(e=>{const k=e.pi+':'+e.si+'|'+e.cands.map(dv=>G.indexOf(dv)).join();(at[k]=at[k]||[]).push(e);});
        const keys=Object.keys(at),routes=new Map(G.map(dv=>[dv,dv.req?routeSections(graph,dv):null]));
        plan=[];
        for(const k of keys){const list=at[k],sk=k.split('|')[0];
          const S=list[0].cands.filter(dv=>{const r=routes.get(dv);return !!r&&r.has(sk);});
          if(S.length!==list.length){plan=null;break;}
          list.forEach((e,i)=>plan.push([e,S[i]]));}
        const oneNode=cs=>{const a=cs.map(dv=>anchorNode(graph,dv.x,dv.y));return a[0]>=0&&a.every(x=>x===a[0]);};
        if(!plan&&keys.every(k=>at[k].length===at[k][0].cands.length&&oneNode(at[k][0].cands))){
          plan=[];keys.forEach(k=>at[k].forEach((e,i)=>plan.push([e,e.cands[i]])));}}
      if(plan)plan.forEach(([e,dv])=>move(e,dv));
      else rep.kept.push({what:'behúzás',id:X,n:unsure.length,by:[...new Set(unsure.map(e=>e.p.id))].join(' ')});}
    Object.keys(to).forEach(t=>rep.split.push({from:X,to:t,n:to[t]}));
    (d.devices||[]).forEach(sw=>{if(sw&&sw.swMap)Object.keys(sw.swMap).forEach(t=>{
      if(sw.swMap[t]===X)rep.kept.push({what:'kapcsoló',id:X,n:1,by:(sw.ref||sw.id)+' / '+t});});});
    (d.circuits||[]).forEach(c=>{if(c&&(c.members||[]).indexOf(X)>=0)
      rep.kept.push({what:'áramkör végpont',id:X,n:1,by:c.ref||c.id});});
  });
  idRepairLast=rep;
  try{console.warn('Kettőzött azonosítók javítva: '+rep.reid.map(r=>r.from+'→'+r.to).join(', ')
    +(rep.moved?' · behúzás-bejegyzés átkötve: '+rep.split.map(s=>s.from+'→'+s.to+' ×'+s.n).join(', '):'')
    +(rep.kept.length?' · az elsőnél maradt: '+rep.kept.map(k=>k.id+' '+k.what+' ×'+k.n+' ('+k.by+')').join('; '):''));}catch(_){}
  return rep;}
function idRepairReport(){return idRepairLast;}
// one line for the HUD after a load, '' when nothing was repaired
function idRepairNote(){const r=idRepairLast;if(!r)return '';
  return ' · Kettőzött azonosító javítva: '+r.reid.length+' elem új azonosítót kapott'
    +(r.moved?', '+r.moved+' behúzás átkötve':'')
    +(r.kept.length?', '+r.kept.reduce((n,k)=>n+k.n,0)+' hivatkozás az elsőnél maradt (részletek a konzolon)':'');}

// ---- CONNECTIVITY: derived, never stored (geometry stays the single truth) ----
// terminals = devices that terminate a run; segments = one drawn span between two
// nodes. The 1.1 Rendezés editor and the cable-occupancy layer read this.
function graphKeyOf(n){return Math.round(n.x)+','+Math.round(n.y)+','+Math.round(n.h||0)+'@'+(n.level||'');}
function connectivity(){
  const terminals=[],segments=[],byPlace={};
  data.devices.forEach(dv=>{if(dv.type==='light'&&false)return;
    const t={id:dv.id,kind:(dv.type==='board'?'board':dv.type==='junction'?'junction':'device'),
      ref:dv.ref||dv.id,x:dv.x,y:dv.y,h:dv.h||0,level:dv.level,links:devLinks(dv)};
    t.link=t.links[0]||null;                               // the primary link, for older readers
    terminals.push(t);
    const k=graphKeyOf(dv);(byPlace[k]=byPlace[k]||[]).push(t);});
  data.paths.forEach(p=>{const ns=p.nodes||[];
    for(let i=0;i<ns.length-1;i++){const sec=(p.sections||[])[i]||{};
      segments.push({id:p.id+':'+i,path:p.id,a:ns[i].id,b:ns[i+1].id,
        build:sec.build||'sull_gege',dia:chaseDia(sec.build,sec),
        len:Math.round(Math.hypot(ns[i+1].x-ns[i].x,ns[i+1].y-ns[i].y,(ns[i+1].h||0)-(ns[i].h||0))),
        circuit:sec.circuit||null});}});
  // which terminal sits on which node (by link first, then by coincidence)
  const at={};
  terminals.forEach(t=>t.links.forEach(l=>{const key=l.p+'/'+l.n;(at[key]=at[key]||[]).push(t.id);}));
  data.paths.forEach(p=>{(p.nodes||[]).forEach(n=>{const k=graphKeyOf(n);
    (byPlace[k]||[]).forEach(t=>{const key=p.id+'/'+n.id;
      if(!(at[key]||[]).includes(t.id))(at[key]=at[key]||[]).push(t.id);});});});
  return {terminals,segments,at};}

// ---- VALIDATION: one place for every "this looks wrong" rule ----
// sev: 'error' | 'warn' | 'info'. The UI will surface these; for now they are
// available to the console and the tests.
// later work packages register {code, run()→[{sev,code,msg,ref}]} here; validate() runs them last
const VALIDATORS=[];
function validate(){const out=[];
  const add=(sev,code,msg,ref)=>out.push({sev,code,msg,ref});
  data.devices.forEach(dv=>{if(devLinks(dv).some(l=>!resolveLink(l)))
    add('warn','link.dangling','Készülék pályakötése érvénytelen: '+(dv.ref||dv.id),dv.id);});
  data.paths.forEach(p=>{if((p.nodes||[]).length<2)
    add('error','path.stub','Pálya kevesebb mint 2 csomóponttal: '+p.id,p.id);
    if((p.sections||[]).length!==Math.max(0,(p.nodes||[]).length-1))
      add('error','path.sections','Szakaszok száma nem stimmel: '+p.id,p.id);});
  const seen={};UKEYS.forEach(k=>{(data[k]||[]).forEach(r=>{if(!r||!r.id)return;
    if(seen[r.id])add('error','id.duplicate','Kettőzött azonosító: '+r.id,r.id);seen[r.id]=1;});});
  data.devices.forEach(dv=>{if(dv.level&&ORD.indexOf(dv.level)<0)
    add('error','level.unknown','Ismeretlen szint: '+dv.level,dv.id);});
  data.paths.forEach(p=>(p.sections||[]).forEach(sec=>{if(!sec||!sec.circuits)return;
    sec.circuits.forEach(c=>{if(c&&c.dev!=null&&!devByRef(c.dev))
      add('warn','wiring.dangling','Behúzott áramkör törölt készülékre mutat: '+(c.name||c.num||'?'),p.id);});}));
  data.devices.forEach(dv=>{if(!dv.swMap)return;
    Object.keys(dv.swMap).forEach(k=>{if(!devByRef(dv.swMap[k]))
      add('warn','switch.dangling','Kapcsoló kimenete törölt készülékre mutat: '+(dv.ref||dv.id)+' / '+k,dv.id);});});
  VALIDATORS.forEach(v=>{try{(v.run()||[]).forEach(x=>out.push(x));}catch(_){}});
  return out;}
function validateSummary(){const v=validate();
  const n=s=>v.filter(x=>x.sev===s).length;
  return {issues:v,error:n('error'),warn:n('warn'),info:n('info')};}

// test hooks (consts are not global properties)
window.SCHEMA_VERSION=SCHEMA_VERSION;window.ensureIds=ensureIds;window.migrate=migrate;
window.byId=byId;window.pathById=pathById;window.nodeById=nodeById;window.linkTarget=linkTarget;
window.linkLabel=linkLabel;window.setLink=setLink;window.pruneLinks=pruneLinks;
window.devLinks=devLinks;window.linkTargets=linkTargets;window.addLink=addLink;window.removeLinks=removeLinks;
window.clearLinks=clearLinks;window.hasLinkTo=hasLinkTo;
window.connectivity=connectivity;window.validate=validate;window.validateSummary=validateSummary;
window.devByRef=devByRef;window.devIdOf=devIdOf;
window.copyRecord=copyRecord;window.repairDupIds=repairDupIds;window.idRepairReport=idRepairReport;window.idRepairNote=idRepairNote;
