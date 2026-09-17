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
             cables:'C',measures:'M',notes:'N',wallNotes:'W'};

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
  const next=p=>p+(++seq);
  UKEYS.forEach(k=>{const pre=IDPRE[k]||'X';
    (d[k]||[]).forEach(r=>{if(!r||typeof r!=='object')return;
      if(!r.id)r.id=next(pre);
      if(k==='paths'&&Array.isArray(r.nodes))r.nodes.forEach(n=>{if(n&&!n.id)n.id=next('n');});});});
  // walls live outside `data` but still need a stable identity: the selection and the
  // gizmo hold a wall REFERENCE, and applySnap rebuilds every wall object.
  for(const l of ORD)(WALLS[l]||[]).forEach(r=>{if(r&&!r.id)r.id=next('W');});
  d.seq=seq;return d;}

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
// device ↔ path-node link, by id. Returns null when either end is gone, which is
// what makes deletion safe: a dangling link simply resolves to nothing.
function linkTarget(dv){if(!dv||!dv.link)return null;
  const p=pathById(dv.link.p);if(!p)return null;
  const ix=(p.nodes||[]).findIndex(n=>n.id===dv.link.n);if(ix<0)return null;
  return {path:p,node:p.nodes[ix],pi:indexById('paths',p.id),ni:ix};}
function linkLabel(dv){const t=linkTarget(dv);if(!t)return '';
  return t.path.id+'/'+t.node.id;}
function setLink(dv,pathId,nodeId){if(!dv)return;
  if(pathId&&nodeId)dv.link={p:pathId,n:nodeId};else delete dv.link;}
// drop links whose target no longer exists (called after any deletion)
function pruneLinks(){data.devices.forEach(dv=>{if(dv.link&&!linkTarget(dv))delete dv.link;});}
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
  ensureIds(d);
  d.v=SCHEMA_VERSION;
  return d;}

// ---- CONNECTIVITY: derived, never stored (geometry stays the single truth) ----
// terminals = devices that terminate a run; segments = one drawn span between two
// nodes. The 1.1 Rendezés editor and the cable-occupancy layer read this.
function graphKeyOf(n){return Math.round(n.x)+','+Math.round(n.y)+','+Math.round(n.h||0)+'@'+(n.level||'');}
function connectivity(){
  const terminals=[],segments=[],byPlace={};
  data.devices.forEach(dv=>{if(dv.type==='light'&&false)return;
    const t={id:dv.id,kind:(dv.type==='board'?'board':dv.type==='junction'?'junction':'device'),
      ref:dv.ref||dv.id,x:dv.x,y:dv.y,h:dv.h||0,level:dv.level,link:(dv.link||null)};
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
  terminals.forEach(t=>{if(t.link){const key=t.link.p+'/'+t.link.n;(at[key]=at[key]||[]).push(t.id);}});
  data.paths.forEach(p=>{(p.nodes||[]).forEach(n=>{const k=graphKeyOf(n);
    (byPlace[k]||[]).forEach(t=>{const key=p.id+'/'+n.id;
      if(!(at[key]||[]).includes(t.id))(at[key]=at[key]||[]).push(t.id);});});});
  return {terminals,segments,at};}

// ---- VALIDATION: one place for every "this looks wrong" rule ----
// sev: 'error' | 'warn' | 'info'. The UI will surface these; for now they are
// available to the console and the tests.
function validate(){const out=[];
  const add=(sev,code,msg,ref)=>out.push({sev,code,msg,ref});
  data.devices.forEach(dv=>{if(dv.link&&!linkTarget(dv))
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
  return out;}
function validateSummary(){const v=validate();
  const n=s=>v.filter(x=>x.sev===s).length;
  return {issues:v,error:n('error'),warn:n('warn'),info:n('info')};}

// test hooks (consts are not global properties)
window.SCHEMA_VERSION=SCHEMA_VERSION;window.ensureIds=ensureIds;window.migrate=migrate;
window.byId=byId;window.pathById=pathById;window.nodeById=nodeById;window.linkTarget=linkTarget;
window.linkLabel=linkLabel;window.setLink=setLink;window.pruneLinks=pruneLinks;
window.connectivity=connectivity;window.validate=validate;window.validateSummary=validateSummary;
window.devByRef=devByRef;window.devIdOf=devIdOf;
