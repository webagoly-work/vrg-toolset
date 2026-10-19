// ==========================================================================
// 05v-graph.js — the route graph and the three connection algorithms (WP-E2)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Pure functions over the routes the user DREW — no geometry is ever invented:
//   home run / star    → a shortest-path tree (Dijkstra)
//   daisy chain        → nearest-neighbour order by graph distance, shortest paths between consecutive members
//   branching tree     → the Steiner tree problem in graphs, approximated by KMB (Kou–Markowsky–Berman)
// Connections are EXPLICIT: consecutive nodes of a route, joins (n.j), device links; plus exact coincidence
// (≤ 1 mm, same level) as the only fallback — never the old 250 mm union (wiring pipeline F1).
// Every tie is broken by key order, so the same drawing always gives the same answer. Prefix: rg.

function rgEid(a,b){return a<b?a+'|'+b:b+'|'+a;}
// G = {nodes: Map key → {key, kind:'node'|'dev', x,y,h,level, p?,n?, dev?}, adj: Map key → [{to, w, e}]}
//   route node 'P12/n40' · device terminal 'D:D7'.  e = {k:'seg',p,a,b,si} | {k:'join'} | {k:'drop',dev}
function rgBuild(opt){opt=opt||{};const routes=opt.routes||['arm','channel'];
  const G={nodes:new Map(),adj:new Map()};
  const addN=(k,o)=>{if(!G.nodes.has(k)){o.key=k;G.nodes.set(k,o);G.adj.set(k,[]);}};
  const addE=(a,b,w,e)=>{if(a===b||!G.adj.has(a)||!G.adj.has(b))return;G.adj.get(a).push({to:b,w,e});G.adj.get(b).push({to:a,w,e});};
  const ps=data.paths.filter(p=>p&&p.id&&routes.indexOf(p.route)>=0);
  ps.forEach(p=>(p.nodes||[]).forEach(n=>{if(n&&n.id)addN(p.id+'/'+n.id,{kind:'node',x:n.x,y:n.y,h:n.h||0,level:n.level,p:p.id,n:n.id});}));
  ps.forEach(p=>{const ns=p.nodes||[];for(let i=1;i<ns.length;i++){const a=ns[i-1],b=ns[i];
    addE(p.id+'/'+a.id,p.id+'/'+b.id,Math.hypot(b.x-a.x,b.y-a.y,(b.h||0)-(a.h||0)),{k:'seg',p:p.id,a:a.id,b:b.id,si:i-1});}});
  ps.forEach(p=>(p.nodes||[]).forEach(n=>{if(!n||!n.j)return;const k2=n.j.p+'/'+n.j.n,t=G.nodes.get(k2);if(!t)return;
    addE(p.id+'/'+n.id,k2,Math.abs((n.h||0)-t.h),{k:'join'});}));
  data.devices.forEach(d=>{if(!d||!d.id)return;const ls=devLinks(d).filter(l=>G.nodes.has(l.p+'/'+l.n));if(!ls.length)return;
    const dk='D:'+d.id;addN(dk,{kind:'dev',x:d.x,y:d.y,h:d.h||0,level:d.level,dev:d.id});
    ls.forEach(l=>{const t=G.nodes.get(l.p+'/'+l.n);addE(dk,l.p+'/'+l.n,l.glue?0:Math.abs(t.h-(d.h||0)),{k:'drop',dev:d.id});});});
  const byPos={};G.nodes.forEach((o,k)=>{if(o.kind!=='node')return;const pk=Math.round(o.x)+','+Math.round(o.y)+'@'+o.level;(byPos[pk]=byPos[pk]||[]).push(k);});
  Object.keys(byPos).forEach(pk=>{const ks=byPos[pk];for(let i=0;i<ks.length;i++)for(let j=i+1;j<ks.length;j++){
    const a=G.nodes.get(ks[i]),b=G.nodes.get(ks[j]);if(a.p!==b.p&&Math.abs(a.h-b.h)<=1)addE(ks[i],ks[j],0,{k:'join'});}});
  // round 2026-10-18 S3: through the slab — a node drawn down to the Födém alja meets the lower level's node at the same
  // world point (08p slbThru, ±5 mm); exact coincidence again, only across two levels
  if(typeof slbThru==='function')slbThru().forEach(t=>addE(t.up.p+'/'+t.up.n,t.down.p+'/'+t.down.n,0,{k:'join',slab:true}));
  G.adj.forEach(l=>l.sort((x,y)=>x.to<y.to?-1:x.to>y.to?1:x.w-y.w));
  return G;}
function rgDevKey(id){return 'D:'+id;}

// ---- Dijkstra (binary heap, lazy deletion; ties by key) ----------------------------------------------------------------
function rgLess(x,y){return x.d<y.d||(x.d===y.d&&x.k<y.k);}
function rgHeap(){const a=[];return {get size(){return a.length;},
  push(x){a.push(x);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(rgLess(a[i],a[p])){const t=a[i];a[i]=a[p];a[p]=t;i=p;}else break;}},
  pop(){const top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;
      if(l<a.length&&rgLess(a[l],a[m]))m=l;if(r<a.length&&rgLess(a[r],a[m]))m=r;if(m===i)break;const t=a[i];a[i]=a[m];a[m]=t;i=m;}}
    return top;}};}
function rgDijkstra(G,src){const dist=new Map(),prev=new Map();if(!G.nodes.has(src))return {dist,prev};
  const H=rgHeap();dist.set(src,0);H.push({d:0,k:src});
  while(H.size){const c=H.pop();if(c.d>dist.get(c.k))continue;
    for(const e of G.adj.get(c.k)){const nd=c.d+e.w,old=dist.get(e.to);
      if(old===undefined||nd<old-1e-9){dist.set(e.to,nd);prev.set(e.to,c.k);H.push({d:nd,k:e.to});}}}
  return {dist,prev};}
function rgPath(prev,src,dst){if(src===dst)return [src];if(!prev.has(dst))return null;const out=[dst];let k=dst,guard=0;
  while(k!==src&&guard++<1e6){k=prev.get(k);if(k===undefined)return null;out.unshift(k);}return out;}
// the edges along a key list (the lightest edge between each consecutive pair)
function rgPathEdges(G,keys){const out=[];if(!keys)return out;
  for(let i=1;i<keys.length;i++){let best=null;for(const e of G.adj.get(keys[i-1])||[])if(e.to===keys[i]&&(!best||e.w<best.w))best=e;
    if(best)out.push({a:keys[i-1],b:keys[i],w:best.w,e:best.e});}
  return out;}
function rgLen(G,keys){return rgPathEdges(G,keys).reduce((s,x)=>s+x.w,0);}

// ---- the three topologies ------------------------------------------------------------------------------------------------
// star: one shortest path per member → [{to, keys|null, len}]
function rgStar(G,origin,members){const D=rgDijkstra(G,origin);
  return members.map(m=>{const keys=D.dist.has(m)?rgPath(D.prev,origin,m):null;return {to:m,keys,len:keys?D.dist.get(m):null};});}
// chain: from the origin, always to the nearest unvisited member by graph distance → {order, legs, unreached}
function rgChain(G,origin,members){let cur=origin;const rest=members.slice(),order=[origin],legs=[];
  while(rest.length){const D=rgDijkstra(G,cur);let best=null,bd=Infinity;
    rest.forEach(m=>{const d=D.dist.get(m);if(d!==undefined&&(d<bd-1e-9||(Math.abs(d-bd)<=1e-9&&best&&m<best))){bd=d;best=m;}});
    if(best===null)break;
    legs.push({from:cur,to:best,keys:rgPath(D.prev,cur,best),len:bd});order.push(best);rest.splice(rest.indexOf(best),1);cur=best;}
  return {order,legs,unreached:rest};}
// Steiner tree (KMB): 1) Dijkstra from each terminal 2) Prim MST on the metric closure 3) union of the shortest paths
// of the MST edges 4) Prim MST of that subgraph 5) delete non-terminal leaves until none is left
function rgSteiner(G,terminals){const T=[...new Set(terminals)].filter(t=>G.nodes.has(t)),unreached=[...new Set(terminals)].filter(t=>!G.nodes.has(t));
  if(!T.length)return {edges:[],nodes:[],cost:0,branch:[],unreached,adj:new Map()};
  const D={};T.forEach(t=>{D[t]=rgDijkstra(G,t);});
  const inT=new Set([T[0]]),mst=[];
  for(;;){let best=null;
    inT.forEach(a=>T.forEach(b=>{if(inT.has(b))return;const d=D[a].dist.get(b);if(d===undefined)return;
      if(!best||d<best.d-1e-9||(Math.abs(d-best.d)<=1e-9&&(a+'|'+b)<(best.a+'|'+best.b)))best={a,b,d};}));
    if(!best)break;inT.add(best.b);mst.push(best);}
  T.forEach(t=>{if(!inT.has(t))unreached.push(t);});
  const H=new Map();                                        // eid → {a,b,w}
  mst.forEach(m=>rgPathEdges(G,rgPath(D[m.a].prev,m.a,m.b)).forEach(x=>{const id=rgEid(x.a,x.b);if(!H.has(id)||x.w<H.get(id).w)H.set(id,{a:x.a,b:x.b,w:x.w});}));
  // Prim on H
  const hadj=new Map();H.forEach((v,id)=>{[v.a,v.b].forEach(k=>{if(!hadj.has(k))hadj.set(k,[]);});hadj.get(v.a).push({to:v.b,w:v.w,id});hadj.get(v.b).push({to:v.a,w:v.w,id});});
  const keep=new Set(),seen=new Set([T[0]]);
  if(hadj.size){for(;;){let best=null;
      seen.forEach(k=>(hadj.get(k)||[]).forEach(e=>{if(seen.has(e.to))return;if(!best||e.w<best.w-1e-9||(Math.abs(e.w-best.w)<=1e-9&&e.id<best.id))best=e;}));
      if(!best)break;keep.add(best.id);seen.add(best.to);}}
  // prune non-terminal leaves
  const term=new Set(T),deg=new Map();const bump=(k,d)=>deg.set(k,(deg.get(k)||0)+d);
  keep.forEach(id=>{const v=H.get(id);bump(v.a,1);bump(v.b,1);});
  let changed=true;while(changed){changed=false;
    keep.forEach(id=>{const v=H.get(id);if(!keep.has(id))return;
      if((deg.get(v.a)===1&&!term.has(v.a))||(deg.get(v.b)===1&&!term.has(v.b))){keep.delete(id);bump(v.a,-1);bump(v.b,-1);changed=true;}});}
  const edges=[...keep].sort(),nodes=new Set(),adj=new Map();let cost=0;
  edges.forEach(id=>{const v=H.get(id);cost+=v.w;nodes.add(v.a);nodes.add(v.b);
    [[v.a,v.b],[v.b,v.a]].forEach(([x,y])=>{if(!adj.has(x))adj.set(x,[]);adj.get(x).push(y);});});
  if(!edges.length&&T.length)nodes.add(T[0]);
  const branch=[...nodes].filter(k=>(adj.get(k)||[]).length>=3).sort();
  return {edges,nodes:[...nodes].sort(),cost,branch,unreached,adj};}
// cut a Steiner tree into legs between "stops" (terminals and branch nodes): [{from, to, keys}]
function rgTreeLegs(ST,origin,stops){const stop=new Set(stops),legs=[],seen=new Set();
  const walk=(start)=>{(ST.adj.get(start)||[]).slice().sort().forEach(nb=>{const eid=rgEid(start,nb);if(seen.has(eid))return;
      const keys=[start];let prev=start,cur=nb;seen.add(eid);
      while(!stop.has(cur)&&(ST.adj.get(cur)||[]).length===2){keys.push(cur);const nx=ST.adj.get(cur).find(x=>x!==prev);seen.add(rgEid(cur,nx));prev=cur;cur=nx;}
      keys.push(cur);legs.push({from:start,to:cur,keys});walk(cur);});};
  walk(origin);return legs;}
function rgReach(G,src){const seen=new Set([src]),q=[src];while(q.length){const k=q.shift();(G.adj.get(k)||[]).forEach(e=>{if(!seen.has(e.to)){seen.add(e.to);q.push(e.to);}});}return seen;}

// test hooks
window.rgEid=rgEid;window.rgBuild=rgBuild;window.rgDevKey=rgDevKey;window.rgDijkstra=rgDijkstra;window.rgPath=rgPath;window.rgPathEdges=rgPathEdges;window.rgLen=rgLen;
window.rgStar=rgStar;window.rgChain=rgChain;window.rgSteiner=rgSteiner;window.rgTreeLegs=rgTreeLegs;window.rgReach=rgReach;
