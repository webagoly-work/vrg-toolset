// Round 2026-10-18 WP-S1…S3 — Födém (src/08p-slab.js + 00-core.js SLABS / slbT / slbStep). Answers S1 B, S4 B:
// LH is the inner height, a slab of thickness t is ADDED under a level (the step grows), the lowest level's slab hangs
// below 0 and moves nothing. 1. level step + undo; 2. save / load (absent = off, a file carries SLABS only when on);
// 3. the slab body (union of floors + walls, holes, side faces in 3D); 4. drawing height through the slab + validators.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data,LH=w.__LH(),S=w.SLABS;st.active='ground';st.exploded=false;
  LH.basement=2500;LH.ground=2700;LH.upper=2700;
  const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  // two rooms 4000 × 3000 with a 100 mm wall between them and 100 mm outer walls
  WL.ground.push({x0:-100,y0:-100,x1:8100,y1:0,id:'W1'},{x0:-100,y0:3000,x1:8100,y1:3100,id:'W2'},{x0:-100,y0:0,x1:0,y1:3000,id:'W3'},
    {x0:4000,y0:0,x1:4100,y1:3000,id:'W4'},{x0:8000,y0:0,x1:8100,y1:3000,id:'W5'});
  D.floors.length=0;D.paths.length=0;D.marks=[];
  D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'A',layer:'L0'},
    {level:'ground',poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'B',layer:'L0'});
  w.ensureIds(D);
  // ---- 1. level step ----
  ok('no slab: the levels are 0 / 2500 / 5200 as always',w.floorRealZ('basement')===0&&w.floorRealZ('ground')===2500&&w.floorRealZ('upper')===5200);
  ok('no slab: slbT is 0 everywhere',['basement','ground','upper'].every(l=>w.slbT(l)===0));
  const u0=w.__undoLen();
  w.slbSet(['ground'],true,300);
  ok('a slab under the ground floor is one undo step',w.__undoLen()===u0+1);
  ok('ground slab 300: ground floor at 2500 + 300 = 2800',w.floorRealZ('ground')===2800);
  ok('its underside 2500 = the basement ceiling (0 + LH 2500)',w.slbUnderside('ground')===2500&&w.floorRealZ('basement')+LH.basement===2500);
  ok('the inner height of a level is unchanged (wallH = LH)',w.wallH('ground')===2700&&w.wallH('basement')===2500);
  w.slbSet(['upper'],true,300);
  ok('upper slab 300 too: upper floor at 2500 + 300 + 2700 + 300 = 5800',w.floorRealZ('upper')===5800);
  w.slbSet(['basement'],true,300);
  ok('the lowest level\'s slab (S4 B) moves nothing: basement still 0, upper still 5800',w.floorRealZ('basement')===0&&w.floorRealZ('upper')===5800&&w.slbT('basement')===300);
  ok('the display z follows the same step (not exploded)',!st.exploded&&w.floorDispZ('upper')===5800&&w.dz('ground',100)===2900);
  w.doUndo();
  ok('undo takes the basement slab off again',w.slbT('basement')===0&&S.basement.on===false);
  // ---- 2. save / load ----
  const sess=w.sessionObj();
  ok('a session with a slab carries SLABS',sess.SLABS&&sess.SLABS.ground.on===true&&sess.SLABS.ground.t===300);
  w.slbSet(['ground','upper'],false);
  ok('all off: a session carries no SLABS key (older captures stay identical)',!('SLABS' in w.sessionObj()));
  w.slbGet({SLABS:{ground:{on:true,t:250}}});
  ok('load: the file\'s values are taken',w.slbT('ground')===250&&w.slbT('upper')===0);
  w.slbGet({});
  ok('load: a file without SLABS has no slab',['basement','ground','upper'].every(l=>w.slbT(l)===0));
  // ---- 3. the slab body ----
  w.slbSet(['ground'],true,300);
  const o=w.slbOutline('ground');
  ok('the outline of two rooms + their walls is one rectangle: 4 merged side edges',o.edges.length===4,JSON.stringify(o.edges));
  const xs=o.edges.flatMap(e=>[e.a[0],e.b[0]]),ys=o.edges.flatMap(e=>[e.a[1],e.b[1]]);
  ok('…from the outer wall faces: x −100…8100, y −100…3100',Math.min(...xs)===-100&&Math.max(...xs)===8100&&Math.min(...ys)===-100&&Math.max(...ys)===3100);
  ok('each edge points outward',o.edges.every(e=>{const mx=(e.a[0]+e.b[0])/2,my=(e.a[1]+e.b[1])/2;return (mx-4000)*e.out[0]+(my-1500)*e.out[1]>0;}));
  D.floors.push({level:'ground',poly:[[1000,1000],[2000,1000],[2000,2000],[1000,2000]],name:'lépcső',slab:false,layer:'L0'});
  const o2=w.slbOutline('ground');
  ok('a floor with slab:false is a hole: 4 more edges around it',o2.edges.length===8);
  D.floors.pop();
  st.pitch=30;st.rot=30;const faces=[];w.slbPushFaces(faces,'ground',w.dz('ground',0));
  ok('in 3D, the visible side faces are pushed (2 of 4 from an oblique camera)',faces.length===2,String(faces.length));
  ok('…each from floor − 300 up to the floor',faces.every(f=>{const z=f.pts.map(p=>p[2]);return Math.min(...z)===2500&&Math.max(...z)===2800;}));
  const fz0=[];w.slbSet(['ground'],false);w.slbPushFaces(fz0,'ground',w.dz('ground',0));
  ok('no slab, no faces',fz0.length===0);
  // ---- 4. through the slab ----
  w.slbSet(['upper'],true,300);
  const jl=w.jumpList('upper');
  ok('the upper level\'s height list offers "Födém alja" at −300',jl.some(x=>x.g.k==='slab'&&x.mm===-300)&&jl[0].g.k==='slab');
  ok('the ground level has none (no slab under it)',!w.jumpList('ground').some(x=>x.g.k==='slab'));
  st.active='upper';st.freeHeight=false;st.drawHKey='slab';
  ok('drawing at "Födém alja" gives h = −300',w.drawHmm('upper')===-300);
  st.drawHKey='s300';st.active='ground';
  D.paths.push({level:'upper',nodes:[{level:'upper',x:3900,y:1550,h:-300},{level:'upper',x:3900,y:500,h:300}],sections:[],layer:'L0'},
    {level:'ground',nodes:[{level:'ground',x:3900,y:1550,h:2700},{level:'ground',x:3000,y:1550,h:2700}],sections:[],layer:'L0'});
  w.ensureIds(D);
  const up=D.paths[0].nodes[0],dn=D.paths[1].nodes[0];
  ok('the upper node at −300 and the ground ceiling node are the same world point',w.slbNodeZ('upper',up)===w.slbNodeZ('ground',dn)&&w.slbNodeZ('ground',dn)===5200);
  const th=w.slbThru();
  ok('slbThru joins them (the path between the levels)',th.length===1&&th[0].up.n===up.id&&th[0].down.n===dn.id,JSON.stringify(th));
  let v=w.validate().filter(x=>/^slb\./.test(x.code));
  ok('a crossing without a felszálló mark is an info',v.length===1&&v[0].code==='slb.thru'&&v[0].sev==='info');
  D.marks.push({kind:'vstrip',wall:'W4',side:-1,u0:1400,u1:1700,level:'ground',tags:['felszallo'],pol:'plus',layer:'L0'});
  v=w.validate().filter(x=>/^slb\./.test(x.code));
  ok('a felszálló strip on the wall next to it (ground level) clears it for the level above',v.length===0,JSON.stringify(v));
  up.h=-450;v=w.validate().filter(x=>/^slb\./.test(x.code));
  ok('a node deeper than the slab is an error',v.some(x=>x.code==='slb.deep'&&x.sev==='error'));
  up.h=-300;
  // ---- 5. the other views (the upper slab is on, the path above ends on the ground ceiling) ----
  const wall=WL.ground.find(r=>r.id==="W1");
  let ev=w.wallElevationSVG(w.wallElevationData(wall,"ground"),false,false).svg;
  ok("elevation: a full-height ground wall carries the upper slab band, labelled with the real thickness",/slb-band/.test(ev)&&/Födém 300 mm/.test(ev));
  const room=D.floors[0];
  const pd=w.planeViewData(room,"ground","ceiling");
  ok("Mennyezet plane: the upper node at −300 shows as a through-slab node",pd.thru.length===1&&pd.thru[0].on===true&&pd.thru[0].u===3900);
  const ps=w.planeViewSVG(pd,false).svg;
  ok("…drawn with the level name and the caption names the upper slab",/slb-thru/.test(ps)&&ps.includes("Emelet ⇣")&&ps.includes("a felső födém alja (300 mm)"));
  ok("the Padló plane of the same room has none",!w.planeViewData(room,"ground","floor").thru.length);
  D.paths[0].nodes[0].h=-120;
  ok("a node that stops inside the slab is listed as not reaching the ceiling",w.planeViewData(room,"ground","ceiling").thru[0].on===false);
  D.paths[0].nodes[0].h=-300;
  st.style="alaprajz";st.pitch=90;st.active="ground";
  D.floors.push({level:"upper",poly:[[1000,1000],[2000,1000],[2000,2000],[1000,2000]],name:"lépcsőnyílás",slab:false,layer:"L0"});
  let ap=w.drawAlaprajzGeom();
  ok("Alaprajz, ground: the hole in the slab above is one dashed outline",/slb-edge/.test(ap)&&/slb-edge[^]*stroke-dasharray/.test(ap)&&w.eval("AP_LAST.slabEdges")===1);
  st.active="upper";w.slbSet(["upper"],true,300);ap=w.drawAlaprajzGeom();
  ok("Alaprajz, upper: the same hole in its own floor is a void (outline + cross)",/slb-edge/.test(ap)&&(ap.match(/<polyline/g)||[]).length>=2&&w.eval("AP_LAST.slabEdges")===1);
  D.floors.pop();st.style="normal";st.pitch=30;st.active="ground";
  w.slbSet(["upper"],false);
  ev=w.wallElevationSVG(w.wallElevationData(wall,"ground"),false,false).svg;
  ok("no slab: no band, no void marks, no through nodes",!/slb-band/.test(ev)&&!w.planeViewData(room,"ground","ceiling").thru.length);
  ok("no slab: the free height is clamped at 0 again",(st.freeHeight=true,st.freeMm=-200,w.drawHmm('upper'))===0);
  st.freeHeight=false;
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
