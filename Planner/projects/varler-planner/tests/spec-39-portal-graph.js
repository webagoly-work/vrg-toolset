// spec-39 — portal graph: doors as nodes, line of sight, A* grid distance, 500 mm trace encoding, heat map, overlays, export
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
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const D=()=>w.__data,J=o=>JSON.stringify(o),T=()=>w.trcList();
  const near=(a,b,e)=>Math.abs(a-b)<=(e||1e-6);
  const addDoor=(x,y,ang,w_)=>{D().openings.push({type:'door',level:lvl,x,y,ang,w:w_||900,h:2100,variant:0,layer:'L0'});w.ensureIds(D());return D().openings[D().openings.length-1];};
  const tag=(o,tags)=>{w.MRK_T.tags=tags;w.mrkOpeningCommit(o,{shift:true});};
  const addTrace=(pts,o)=>{T().push(Object.assign({level:lvl,plane:'floor',mode:'free',pts,a:null,b:null,dir:1,tags:['mozgas'],layer:'L0'},o||{}));w.ensureIds(D());return T()[T().length-1];};
  let A={},B={};
  const reset=()=>{w.newBlankProject();w.eval('stacks=[]');w.__state.stkOff=false;w.__state.stack=null;w.__state.activeLayer='L0';w.mrkToolsOff();w.__state.active=lvl;w.__state.prtShow=false;w.__state.prtHeat=false;};
  const fixA=()=>{reset();D().floors.push({level:lvl,name:'Téglalap',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],layer:'L0'});
    A.d1=addDoor(0,1500,Math.PI/2);A.d2=addDoor(4000,1500,Math.PI/2);A.room=D().floors[0];};
  const L=[[0,0],[4000,0],[4000,1500],[1500,1500],[1500,4000],[0,4000]];
  const fixB=()=>{reset();D().floors.push({level:lvl,name:'L-alak',poly:L,layer:'L0'});
    B.d1=addDoor(750,4000,0);B.d2=addDoor(4000,750,Math.PI/2);B.room=D().floors[0];};
  const deepEq=(a,b)=>{if(a===b)return true;if(typeof a!==typeof b||a===null||b===null||typeof a!=='object')return false;
    if(Array.isArray(a)!==Array.isArray(b))return false;const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>deepEq(a[k],b[k]));};

  // 1 — geometry
  ok('prtSegInPoly: along an edge and through the inside is true',w.prtSegInPoly([100,0],[3000,0],L)&&w.prtSegInPoly([200,200],[3800,1000],L));
  ok("prtSegInPoly: a segment cutting the L's inner corner is false",!w.prtSegInPoly([3000,1000],[1000,3000],L)&&!w.prtSegInPoly([3500,1000],[1000,3500],L));
  ok('a segment that only touches a vertex counts as inside',w.prtSegInPoly([1500,1000],[1500,1500],L)&&w.prtSegInPoly([100,100],[1500,1500],L));
  ok('a segment wholly outside is false',!w.prtSegInPoly([5000,5000],[6000,5000],L));
  ok('prtGrid: cells whose centre is inside; the L has no cell in its notch',(function(){const g=w.prtGrid(L,500),has=(i,j)=>g.some(c=>c.i===i&&c.j===j);return has(0,0)&&has(7,0)&&has(0,7)&&!has(5,5)&&!has(7,5)&&g.length===(8*3+3*5);})());
  const pr=w.prtAStar(L,[750,3750],[3750,750],500),pr2=w.prtAStar(L,[750,3750],[3750,750],500);
  ok('prtAStar finds a path in the L and it is deterministic',pr&&pr.cells.length>2&&J(pr)===J(pr2));
  ok('every cell of the path has its centre inside the polygon',pr.cells.every(c=>w.eval('pointInPoly')((c[0]+0.5)*500,(c[1]+0.5)*500,L)));
  ok('the path never cuts a corner: a diagonal step needs both orthogonal neighbours free',(function(){const free=new Set(w.prtGrid(L,500).map(c=>c.i+','+c.j));
    for(let k=1;k<pr.cells.length;k++){const a=pr.cells[k-1],b=pr.cells[k];if(a[0]!==b[0]&&a[1]!==b[1]&&(!free.has(b[0]+','+a[1])||!free.has(a[0]+','+b[1])))return false;}return true;})());
  ok('the path is longer than the straight line (the notch is in the way)',pr.len_mm>trc(750,3750,3750,750));
  function trc(x0,y0,x1,y1){return Math.hypot(x1-x0,y1-y0);}
  ok('a path in an open rectangle is the octile distance',(function(){const r=w.prtAStar([[0,0],[4000,0],[4000,3000],[0,3000]],[250,250],[3750,250],500);return r&&near(r.len_mm,3500,1);})());
  ok("a point outside the polygon starts from the nearest free cell",(function(){const r=w.prtAStar([[0,0],[4000,0],[4000,3000],[0,3000]],[-300,250],[3750,250],500);return !!r&&r.cells[0][0]===0;})());
  ok('prtFrame: origin at the approach point, u along the wall, v into the room',(function(){const F=w.prtFrame(A.d1||{x:0,y:1500,ang:Math.PI/2},[250,1500]);return near(F.ox,250)&&near(F.uy,1)&&near(F.vx,1)&&near(F.vy,0,1e-9);})());
  ok('prtToFrame / prtBearing: straight ahead is 0°, to the side is ±90°',(function(){const F=w.prtFrame({x:0,y:1500,ang:Math.PI/2},[250,1500]);
    const f=w.prtToFrame(F,3750,1500);return near(f[0],0,1e-6)&&near(f[1],3500,1e-6)&&near(w.prtBearing(F,3750,1500),0)&&near(w.prtBearing(F,250,2500),90)&&near(w.prtBearing(F,250,500),-90);})());
  ok('the same door has two frames: v flips with the room side',(function(){const o={x:0,y:1500,ang:Math.PI/2};const a=w.prtFrame(o,[250,1500]),b=w.prtFrame(o,[-250,1500]);return near(a.vx,1)&&near(b.vx,-1)&&near(a.ux,b.ux);})());

  // 2 — fixture A: the rectangle
  fixA();let G=w.prtGraph(lvl);
  ok('A: two doors, each with the room on one side',G.doors.length===2&&G.doors[0].rooms[0]===null&&G.doors[0].rooms[1]===A.room.id&&G.doors[1].rooms[0]===A.room.id&&G.doors[1].rooms[1]===null);
  ok('A: one edge, line of sight, d = 4000 − 2×250 = 3500, dGrid = d',G.edges.length===1&&G.edges[0].los===true&&G.edges[0].d===3500&&G.edges[0].dGrid===3500&&G.edges[0].room===A.room.id);
  ok('A: both bearings are 0 (the doors face each other)',G.edges[0].bearA===0&&G.edges[0].bearB===0);
  ok('A: the edge carries its two approach points',J(G.edges[0].pa)===J([250,1500])&&J(G.edges[0].pb)===J([3750,1500]));
  ok('A: grid is 500',G.grid===500&&G.level===lvl);

  // 3 — fixture B: the L
  fixB();G=w.prtGraph(lvl);
  ok('B: one edge without line of sight',G.edges.length===1&&G.edges[0].los===false);
  ok('B: dGrid > d',G.edges[0].dGrid>G.edges[0].d&&G.edges[0].dGrid!=null);
  ok('B: the bearings point round the corner (not straight ahead)',Math.abs(G.edges[0].bearA)>10&&Math.abs(G.edges[0].bearB)>10);
  ok('B: the result is the same on a re-run',J(w.prtGraph(lvl))===J(G));
  ok('B: the door at the bottom approaches 250 mm inside, the right door 250 mm inside',J(G.edges[0].pa)===J([750,3750])&&J(G.edges[0].pb)===J([3750,750]));

  // 4 — the trace encoding
  fixA();const t4=addTrace([[250,1500],[3750,1500]],{a:A.d1.id,b:A.d2.id});G=w.prtGraph(lvl);
  ok("A: a straight trace D1→D2 encodes in D1's frame to exactly [[0,0],[0,1],…,[0,7]]",J(G.traces[0].cells)===J([[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7]]));
  ok('...and is flagged relative to a door',G.traces[0].rel===true);
  ok('ratio = len / dGrid = 1.0 (±0.02)',near(G.traces[0].ratio,1,0.02)&&G.traces[0].len===3500);
  ok('the trace belongs to the room holding most of its points, with its door ends',G.traces[0].room===A.room.id&&G.traces[0].a===A.d1.id&&G.traces[0].b===A.d2.id&&G.traces[0].dir===1);
  ok('a trace bent sideways encodes the u coordinate along the wall',(function(){T().length=0;addTrace([[250,1500],[1250,1500],[1250,2600],[1250,2600]],{a:A.d1.id});const c=w.prtGraph(lvl).traces[0].cells;
    return c[0][0]===0&&c.some(x=>x[0]===2)&&c[c.length-1][0]===2;})());
  ok('a longer way round gives a ratio above 1',(function(){T().length=0;addTrace([[250,1500],[250,2500],[3750,2500],[3750,1500]],{a:A.d1.id,b:A.d2.id});const r=w.prtGraph(lvl).traces[0].ratio;return r>1.3;})());
  ok('without a door at the start the cells are absolute and rel is false',(function(){T().length=0;addTrace([[250,250],[1250,250]]);const t=w.prtGraph(lvl).traces[0];return t.rel===false&&J(t.cells)===J([[0,0],[1,0],[2,0]])&&t.ratio===null;})());
  ok('a sample on the door wall line (v = −6e-14 from cos(π/2)) does not fall into cell −1 (epsilon)',(function(){T().length=0;addTrace([[250,1500],[250,2500]],{a:A.d1.id});const c=w.prtGraph(lvl).traces[0].cells;return J(c)===J([[0,0],[1,0],[2,0]]);})());
  ok('only floor traces enter the graph',(function(){T().length=0;addTrace([[250,1500],[3750,1500]],{plane:'ceiling'});return w.prtGraph(lvl).traces.length===0;})());
  ok('traces of another level stay out',(function(){T().length=0;addTrace([[250,1500],[3750,1500]],{level:'upper'});return w.prtGraph(lvl).traces.length===0;})());

  // 5 — heat
  fixA();addTrace([[250,1500],[3750,1500]]);addTrace([[250,1500],[3750,1500]]);G=w.prtGraph(lvl);
  const H=G.heat[A.room.id];
  ok('two identical traces: every cell on the way counts 2',(function(){const v=Object.keys(H).map(k=>H[k]);return v.length===8&&v.every(n=>n===2);})());
  ok('the cells are absolute: row 3 (y=1500), columns 0…7',J(Object.keys(H).sort())===J(['0,3','1,3','2,3','3,3','4,3','5,3','6,3','7,3'].sort()));
  ok('a trace looping over the same cell counts 1 there',(function(){T().length=0;addTrace([[100,100],[400,100],[400,400],[100,400],[100,100],[400,100]]);const h=w.prtGraph(lvl).heat[A.room.id];return J(h)===J({'0,0':1});})());
  ok('a trace crossing two rooms feeds the heat of its main room only',(function(){T().length=0;addTrace([[250,1500],[3750,1500]]);return Object.keys(w.prtGraph(lvl).heat).length===1;})());
  ok('without traces there is no heat',(function(){T().length=0;return J(w.prtGraph(lvl).heat)==='{}';})());

  // 6 — door tags
  fixA();tag(A.d1,['nemhasznalt']);
  ok('a door tagged nemhasznalt is absent from the graph (and no edge)',(function(){const g=w.prtGraph(lvl);return g.doors.length===1&&g.doors[0].id===A.d2.id&&g.edges.length===0;})());
  D().marks.length=0;tag(A.d1,['nyitva']);
  ok('nyitva is present with open:true',(function(){const d=w.prtGraph(lvl).doors.find(x=>x.id===A.d1.id);return d&&d.open===true&&d.tags.indexOf('nyitva')>=0;})());
  D().marks.length=0;tag(A.d1,['bejarat']);tag(A.d2,['lepcso']);
  ok('bejarat → anchor house, lepcso → anchor floor, others null',(function(){const g=w.prtGraph(lvl);return g.doors[0].anchor==='house'&&g.doors[1].anchor==='floor';})());
  D().marks.length=0;tag(A.d1,['portal','p2']);
  ok('the tier is read from the door tags',w.prtGraph(lvl).doors[0].tier==='p2'&&w.prtGraph(lvl).doors[1].tier===null);
  ok('doors are listed in id order',(function(){const g=w.prtGraph(lvl);return g.doors[0].id===A.d1.id&&g.doors[1].id===A.d2.id;})());
  ok('a door with the same room on neither side joins no edge',(function(){addDoor(9000,9000,0);const g=w.prtGraph(lvl);return g.doors.length===3&&g.edges.length===1;})());
  ok('three doors in a room give three edges, sorted by id pairs',(function(){fixA();addDoor(2000,0,0);const g=w.prtGraph(lvl);return g.edges.length===3&&J(g.edges.map(e=>e.a+'-'+e.b))===J(g.edges.map(e=>e.a+'-'+e.b).slice().sort((p,q)=>{const[a1,b1]=p.split('-'),[a2,b2]=q.split('-');return (w.idNum(a1)-w.idNum(a2))||(w.idNum(b1)-w.idNum(b2));}));})());

  // 7 — plain data
  fixB();addTrace([[750,3750],[750,1000],[3750,750]],{a:B.d1.id,b:B.d2.id});
  ok('prtGraph output survives JSON.parse(JSON.stringify(x)) unchanged',(function(){const g=w.prtGraph(lvl);return deepEq(g,JSON.parse(JSON.stringify(g)))&&J(g).indexOf('null')>=0;})());
  ok('no NaN or undefined anywhere in the graph',(function(){const s=J(w.prtGraph(lvl));return s.indexOf('NaN')<0&&s.indexOf('undefined')<0;})());

  // 8 — overlays
  fixA();addTrace([[250,1500],[3750,1500]]);w.__state.zoom=1;w.__state.rot=0;w.__state.pitch=90;w.__state.flat=true;
  w.draw();
  ok('overlays are off by default: the overlay carries no graph',w.prtOverlaySvg()===''&&w.eval('_lastOverlay').indexOf('#3b6ea5')<0&&w.eval('_lastOverlay').indexOf('#d0503a')<0);
  w.actionById('portal.graph').run({});
  ok('portal.graph switches the graph on: door nodes (8 px), a dashed edge with its length',(function(){const s=w.prtOverlaySvg();return (s.match(/r="8"/g)||[]).length===2&&/stroke-dasharray="6 4"/.test(s)&&/3\.5 m/.test(s);})());
  ok('the graph is in the overlay of draw(), not in the scene',w.eval('_lastOverlay').indexOf('#3b6ea5')>=0&&w.eval('_lastScene').indexOf('#3b6ea5')<0);
  ok('an anchor door gets a double ring, an open door is hollow',(function(){tag(D().openings[0],['bejarat']);tag(D().openings[1],['nyitva']);const s=w.prtOverlaySvg();D().marks.length=0;return /r="12"/.test(s)&&/r="8" fill="#fff"/.test(s);})());
  ok('without line of sight the edge is a dotted polyline through the grid cells',(function(){fixB();w.__state.prtShow=true;const s=w.prtOverlaySvg();return /stroke-dasharray="1.5 4"/.test(s)&&!/stroke-dasharray="6 4"/.test(s);})());
  w.actionById('portal.graph').run({});
  ok('portal.graph toggles off again',!w.__state.prtShow&&w.prtOverlaySvg()==='');
  fixA();addTrace([[250,1500],[3750,1500]]);addTrace([[250,1500],[1250,1500]]);
  w.actionById('portal.heat').run({});
  ok('portal.heat: a 500 mm square per heat cell, fill #d0503a, opacity 0.08 + 0.42 × count/max',(function(){const s=w.prtOverlaySvg();const ops=(s.match(/fill-opacity="[\d.]+"/g)||[]).map(x=>+x.match(/[\d.]+/)[0]);
    return (s.match(/<polygon/g)||[]).length===8&&s.indexOf('#d0503a')>=0&&Math.max.apply(null,ops)===0.5&&Math.min.apply(null,ops)===0.29;})());
  ok('the heat squares are 500 mm: the first one spans one grid cell',(function(){const s=w.prtOverlaySvg(),pts=s.match(/points="([^"]+)"/)[1].split(' ').map(p=>p.split(',').map(Number));
    const b=w.planToBase(0,1500,w.dz(lvl,0)),c=w.planToBase(500,1500,w.dz(lvl,0));return pts.length===4&&Math.abs(Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1])-Math.hypot(b[0]-c[0],b[1]-c[1]))<0.5;})());
  w.actionById('portal.heat').run({});
  ok('portal.heat toggles off',!w.__state.prtHeat&&w.prtOverlaySvg()==='');

  // 9 — export
  fixA();let got=null;w.download=(n,t)=>{got={n,t};};
  w.actionById('portal.export').run({});
  ok('portal.export downloads portalgraph-<level>.json with the graph',got&&got.n==='portalgraph-ground.json'&&deepEq(JSON.parse(got.t),w.prtGraph(lvl)));
  ok('the actions are in group Jelölés',['portal.graph','portal.heat','portal.export'].every(id=>{const a=w.actionById(id);return a&&a.group==='Jelölés';}));

  // 10 — the check
  fixA();const S=w.stkCreate({});
  ok('a room with two doors and no trace between them → warn',(function(){const c=w.stkCheck(S,'mark');return c.some(x=>x.sev==='warn'&&/Téglalap: nincs mozgásnyom két ajtó között/.test(x.msg));})());
  ok('...quiet once a trace joins two of them',(function(){addTrace([[250,1500],[3750,1500]],{a:A.d1.id,b:A.d2.id});return !w.stkCheck(S,'mark').some(x=>/nincs mozgásnyom/.test(x.msg));})());
  ok('a trace that is not attached to both doors does not count',(function(){T().length=0;addTrace([[250,1500],[3750,1500]],{a:A.d1.id});return w.stkCheck(S,'mark').some(x=>/nincs mozgásnyom/.test(x.msg));})());
  ok('a room with one door is fine (an outside door is skipped)',(function(){fixA();D().openings.splice(1,1);const s=w.stkCreate({});return !w.stkCheck(s,'mark').some(x=>/nincs mozgásnyom/.test(x.msg));})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
