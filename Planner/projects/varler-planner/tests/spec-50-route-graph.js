// spec-50 — the route graph and the three connection algorithms (WP-E2)
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground',D=()=>w.__data,near=(a,b)=>Math.abs(a-b)<1e-6;
  const route=(pts,h)=>{const p={route:'arm',nodes:pts.map(q=>({level:lvl,x:q[0],y:q[1],h:q[2]!=null?q[2]:(h||2600)})),sections:pts.slice(1).map(()=>({build:'sull_gege'}))};D().paths.push(p);w.ensureIds(D());return p;};
  const K=(p,i)=>p.id+'/'+p.nodes[i].id;
  // 1 — joins
  w.newBlankProject();
  const a=route([[0,0],[1000,0]]),b=route([[5000,5000],[6000,5000]]);
  b.nodes[0].j={p:a.id,n:a.nodes[1].id};
  ok('a join connects two routes',w.rgReach(w.rgBuild(),K(a,0)).has(K(b,1)));
  delete b.nodes[0].j;
  ok('…without it they are apart',!w.rgReach(w.rgBuild(),K(a,0)).has(K(b,1)));
  // 2 — device drop
  const d={type:'socket',level:lvl,x:0,y:0,h:300};D().devices.push(d);w.ensureIds(D());w.addLink(d,a.id,a.nodes[0].id);
  ok('a plan-only link weighs the vertical drop (2600 − 300)',(function(){const G=w.rgBuild(),e=G.adj.get('D:'+d.id)[0];return e.w===2300&&e.e.k==='drop';})());
  // 3 — coincidence
  w.newBlankProject();
  const c1=route([[0,0],[1000,0]]),c2=route([[1000,0],[1000,1000]]),c3=route([[1005,0],[1005,-800]]);
  ok('nodes on the same point and height join',w.rgReach(w.rgBuild(),K(c1,0)).has(K(c2,1)));
  ok('5 mm apart they do not (no 250 mm union)',!w.rgReach(w.rgBuild(),K(c1,0)).has(K(c3,1)));
  // 4 — Dijkstra picks the shortcut, deterministically
  w.newBlankProject();
  const sq=route([[0,0],[1000,0],[1000,1000]]),dg=route([[0,0],[1000,1000]]);
  ok('Dijkstra takes the diagonal (√2 km < 2 km)',(function(){const G=w.rgBuild(),Dj=w.rgDijkstra(G,K(sq,0));return near(Dj.dist.get(K(sq,2)),Math.SQRT2*1000);})());
  ok('the same answer on ten reruns',(function(){const s=new Set();for(let i=0;i<10;i++){const G=w.rgBuild(),Dj=w.rgDijkstra(G,K(sq,0));s.add(JSON.stringify(w.rgPath(Dj.prev,K(sq,0),K(sq,2))));}return s.size===1;})());
  // 5 — chain on a line
  w.newBlankProject();
  const ln=route([[0,0],[1000,0],[2000,0],[3000,0]]);
  ok('chain: nearest first along the route, legs sum to the far end',(function(){const G=w.rgBuild(),C=w.rgChain(G,K(ln,0),[K(ln,3),K(ln,1),K(ln,2)]);
    return C.order.join()===[K(ln,0),K(ln,1),K(ln,2),K(ln,3)].join()&&near(C.legs.reduce((s,l)=>s+l.len,0),3000)&&!C.unreached.length;})());
  // 6 — Steiner on a plus
  w.newBlankProject();
  const pa=route([[-1000,0],[0,0],[1000,0]]),pb=route([[0,0],[0,1000]]);
  ok('Steiner on a plus: cost 3000, one branch point at the centre',(function(){const G=w.rgBuild(),ST=w.rgSteiner(G,[K(pa,0),K(pa,2),K(pb,1)]);
    return near(ST.cost,3000)&&ST.branch.length===1&&w.rgReach(G,ST.branch[0]).has(K(pa,1));})());
  ok('the tree cuts into three legs at the branch',(function(){const G=w.rgBuild(),ST=w.rgSteiner(G,[K(pa,0),K(pa,2),K(pb,1)]),legs=w.rgTreeLegs(ST,K(pa,0),[K(pa,0),K(pa,2),K(pb,1)].concat(ST.branch));return legs.length===3;})());
  // 7 — Steiner on a 3×3 grid
  w.newBlankProject();
  const rows=[0,1000,2000].map(y=>route([[0,y],[1000,y],[2000,y]])),cols=[0,1000,2000].map(x=>route([[x,0],[x,1000],[x,2000]]));
  ok('Steiner on a 3×3 grid, terminals on three corners: exactly 4000; every leaf a terminal',(function(){const G=w.rgBuild(),T=[K(rows[0],0),K(rows[0],2),K(rows[2],0)],ST=w.rgSteiner(G,T);
    const leaves=[...ST.adj.keys()].filter(k=>ST.adj.get(k).length===1);
    const isT=k=>T.some(t=>t===k||w.rgReach(w.rgBuild(),t)&&near((w.rgDijkstra(G,t).dist.get(k)),0));
    return near(ST.cost,4000)&&leaves.every(isT);})());
  // 8 — unreachable members
  w.newBlankProject();
  const u1=route([[0,0],[1000,0]]),u2=route([[9000,9000],[9500,9000]]);
  ok('star: an unreachable member has no path',(function(){const r=w.rgStar(w.rgBuild(),K(u1,0),[K(u1,1),K(u2,1)]);return r[0].keys&&r[1].keys===null;})());
  ok('chain: it is listed as unreached',(function(){const C=w.rgChain(w.rgBuild(),K(u1,0),[K(u1,1),K(u2,1)]);return C.unreached.length===1&&C.unreached[0]===K(u2,1);})());
  ok('only arm / channel routes are in the graph',(function(){D().paths.push({nodes:[{level:lvl,x:0,y:0,h:0},{level:lvl,x:1,y:1,h:0}],sections:[{}]});w.ensureIds(D());const G=w.rgBuild();
    const p=D().paths[D().paths.length-1];return !G.nodes.has(p.id+'/'+p.nodes[0].id);})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
