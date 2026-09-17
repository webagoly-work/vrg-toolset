// ==========================================================================
// 05i-spans.js — spans: the named unit of a route, box to box
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A route (a data.paths record) is a polyline; its segments are the pieces between consecutive
// nodes. A SPAN is a maximal chain of segments between two terminal nodes, or a route end.
// Nothing can join or leave a run between two boxes, so a span's contents are constant along it
// — which is why the span, not the segment, is what gets named, sized and labelled.
// See docs/wiring_pipeline.md. Derived on demand, never stored.
//
// A node is a terminal node when a device is LINKED to it (dev.link). Drawings made before the
// ghost route tool have no links, so a device within SPAN_JOIN_TOL of a node still counts — that
// fallback is reported by how:'near' so validate() can ask for it to be confirmed.
const SPAN_JOIN_TOL=250;          // mm, 3D; the same tolerance the v1 routing graph merges with
// when two devices share one node, the one a wire is really cut in wins
const SPAN_TERM_RANK={board:0,junction:1,switch:2,socket:2,light:2,box:3};

// {dev, how:'link'|'near'} for the terminal at this node, or null
function terminalAtNode(pa,node){if(!pa||!node)return null;
  let best=null;
  const rank=dv=>{const r=SPAN_TERM_RANK[dv.type];return r==null?9:r;};
  const better=(dv,how,dist)=>!best||(how==='link'&&best.how!=='link')||
    (how===best.how&&(rank(dv)<rank(best.dev)||(rank(dv)===rank(best.dev)&&dist<best.dist)));
  data.devices.forEach(dv=>{if(!dv)return;
    if(dv.link&&dv.link.p===pa.id&&dv.link.n===node.id){if(better(dv,'link',0))best={dev:dv,how:'link',dist:0};return;}
    if(dv.level!==node.level)return;
    let dist;
    if(dv.type==='board'&&typeof pointInBoard==='function')dist=pointInBoard(dv,node.x,node.y,120)?0:Infinity;
    else dist=Math.hypot(dv.x-node.x,dv.y-node.y,(dv.h||0)-(node.h||0));
    if(dist<SPAN_JOIN_TOL&&better(dv,'near',dist))best={dev:dv,how:'near',dist};});
  return best?{dev:best.dev,how:best.how}:null;}

function spanEndRef(end,pa){return end.dev?(end.dev.ref||end.dev.id):(pa.id+'/'+end.node.id);}

// the spans of one route, in drawing order
function routeSpans(pa){const ns=(pa&&pa.nodes)||[];if(ns.length<2)return [];
  const term=ns.map(n=>terminalAtNode(pa,n));
  const out=[];let start=0;
  for(let i=1;i<ns.length;i++){
    if(i<ns.length-1&&!term[i])continue;          // a bend, not a break
    const segs=[];let len=0;
    for(let si=start;si<i;si++){segs.push(si);len+=sectionLen(pa,si);}
    const end=k=>({node:ns[k],dev:term[k]?term[k].dev:null,how:term[k]?term[k].how:null});
    out.push({key:pa.id+':'+ns[start].id+'>'+ns[i].id,path:pa.id,from:end(start),to:end(i),segs,len});
    start=i;}
  return out;}

// every span in the drawing, each with its name. Parallel spans between the same two terminals are
// legal (rare): the first keeps the plain name, the rest get /b, /c … in route order.
function allSpans(){const list=[];
  data.paths.forEach(pa=>routeSpans(pa).forEach(s=>list.push(s)));
  const nat=(a,b)=>String(a).localeCompare(String(b),'hu',{numeric:true});
  const groups={};
  list.forEach(s=>{const pa=pathById(s.path);
    let a=s.from,b=s.to;
    // the board-side end reads first; otherwise natural order, so K3~D1 and D1~K3 are one name
    const aBoard=a.dev&&a.dev.type==='board',bBoard=b.dev&&b.dev.type==='board';
    if(bBoard&&!aBoard)[a,b]=[b,a];
    else if(!aBoard&&!bBoard&&nat(spanEndRef(a,pa),spanEndRef(b,pa))>0)[a,b]=[b,a];
    s.base=spanEndRef(a,pa)+'~'+spanEndRef(b,pa);
    (groups[s.base]=groups[s.base]||[]).push(s);});
  Object.values(groups).forEach(g=>{
    g.sort((x,y)=>(idNum(x.path)-idNum(y.path))||(idNum(x.from.node.id)-idNum(y.from.node.id)));
    g.forEach((s,i)=>{s.name=i?s.base+'/'+String.fromCharCode(97+i):s.base;});});
  return list;}

// the span a segment belongs to
function spanOfSection(pathId,si){return allSpans().find(s=>s.path===pathId&&s.segs.includes(si))||null;}

// test hooks (consts are not global properties)
window.terminalAtNode=terminalAtNode;window.routeSpans=routeSpans;window.allSpans=allSpans;
window.spanOfSection=spanOfSection;window.SPAN_JOIN_TOL=SPAN_JOIN_TOL;
