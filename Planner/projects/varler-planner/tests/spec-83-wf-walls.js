// Workflow round WP-F3 + WP-F4 — Falak létrehozása / Padló létrehozása (src/08d-wf-walls.js).
//
// What must hold (docs/workflow/WP-F3_create-walls.md, WP-F4_create-floors.md; Q-F01 = A answered 2026-10-14):
// the drawn sizes are INNER sizes and survive; shared lines become 200 mm walls with the neighbour pushed over;
// outer walls 300 outside the outline; joints exact — no two walls overlap and the wall area is exactly envelope − rooms;
// a room spanning a shared line grows and is reported; reflex corners; re-run replaces only gen:'wfw' walls; undo;
// Create Floors turns outline → floor with the kind tint, a user fill stays, the tint toggles.
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
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();
  const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const WALLS=()=>w.__getWalls().ground;
  const room=(P,extra)=>{D.floors.push(Object.assign({level:'ground',poly:P,name:'',stage:'outline',clear:true,layer:'L0'},extra||{}));return D.floors[D.floors.length-1];};
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const fresh=()=>{D.floors.length=0;w.__getWalls().ground.length=0;};
  const bx=fl=>{const X=fl.poly.map(p=>p[0]),Y=fl.poly.map(p=>p[1]);return {x0:Math.min(...X),x1:Math.max(...X),y0:Math.min(...Y),y1:Math.max(...Y)};};
  const area=r=>(r.x1-r.x0)*(r.y1-r.y0);
  const overlaps=L=>{let n=0;for(let i=0;i<L.length;i++)for(let k=i+1;k<L.length;k++){const a=L[i],b=L[k];
    const ix=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),iy=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);if(ix>0.5&&iy>0.5)n++;}return n;};
  const wallArea=L=>L.reduce((s,r)=>s+area(r),0);
  const apply=()=>{const p=w.wfwPlan('ground');w.wfwApply(p,'ground');return p;};

  // ---------- 1. two rooms on one line (WP-F3 test 1) ----------
  fresh();const A=room(rect(0,0,3600,3000)),B=room(rect(3600,0,7200,3000));
  let p=w.wfwPlan('ground');
  ok('dry run writes nothing',WALLS().length===0&&bx(B).x0===3600);
  ok('one room moves, by +200 in x',p.moves.length===1&&p.moves[0].dx===200&&p.moves[0].dw===0,JSON.stringify(p.moves));
  apply();const W1=WALLS().map(r=>({x0:r.x0,y0:r.y0,x1:r.x1,y1:r.y1}));
  ok('room B now 3800 → 7400',bx(B).x0===3800&&bx(B).x1===7400);
  ok('both clear widths still 3600',bx(A).x1-bx(A).x0===3600&&bx(B).x1-bx(B).x0===3600);
  ok('5 walls',W1.length===5,W1.length);
  ok('shared wall x 3600–3800 (centreline 3700)',W1.some(r=>r.x0===3600&&r.x1===3800&&r.y0===0&&r.y1===3000));
  ok('outer left x −300–0 (centreline −150)',W1.some(r=>r.x0===-300&&r.x1===0));
  ok('outer right x 7400–7700 (centreline 7550)',W1.some(r=>r.x0===7400&&r.x1===7700));
  ok('top wall runs through, −300 → 7700',W1.some(r=>r.y0===-300&&r.y1===0&&r.x0===-300&&r.x1===7700));
  ok('no two walls overlap',overlaps(W1)===0);
  ok('wall area = 8000 × 3600 − rooms = 7,20 m²',wallArea(W1)===7.2e6,wallArea(W1));
  ok('walls carry gen:wfw and ids',WALLS().every(r=>r.gen==='wfw'&&/^W/.test(r.id||'')));
  ok('rooms stay outline until F4',A.stage==='outline'&&B.stage==='outline');
  ok('a second run moves nothing more',w.wfwPlan('ground').moves.length===0);

  // ---------- 2. three rooms: a T, and a room spanning both — rigid shift, the misfit shows as a step ----------
  fresh();const a=room(rect(0,0,4000,3000)),b=room(rect(4000,0,7000,3000)),c=room(rect(0,3000,7000,6000));
  p=w.wfwPlan('ground');
  ok('no room changes size',p.moves.every(m=>m.dw===0&&m.dh===0),JSON.stringify(p.moves));
  ok('B +200 x, C +200 y',p.moves.find(m=>m.i===1).dx===200&&p.moves.find(m=>m.i===2).dy===200&&p.moves.find(m=>m.i===2).dx===0);
  ok('the B ↔ C outer line is reported stepped by 200',p.steps.length===1&&p.steps[0].d===200,JSON.stringify(p.steps));
  apply();const W2=WALLS();
  ok('T: no overlaps',overlaps(W2)===0);
  ok('the A|B partition stops on the horizontal partition (y 0–3000)',W2.some(r=>r.x0===4000&&r.x1===4200&&r.y0===0&&r.y1===3000));
  ok('the horizontal partition runs through under A and B',W2.some(r=>r.y0===3000&&r.y1===3200&&r.x0<=0&&r.x1>=7000));

  // ---------- 2b. a real flat: two rows, partitions not in line (nappali | konyha over fürdő | háló) ----------
  fresh();room(rect(3000,2500,7000,6000),{kinds:['nappali']});room(rect(7000,2500,10000,6000),{kinds:['konyha']});
  room(rect(3000,6000,5000,8500),{kinds:['furdo']});room(rect(5000,6000,10000,8500),{kinds:['halo']});
  p=w.wfwPlan('ground');const mv=i=>p.moves.find(m=>m.i===i)||{dx:0,dy:0,dw:0,dh:0};
  ok('flat: every room keeps its size',[0,1,2,3].every(i=>!mv(i).dw&&!mv(i).dh));
  ok('flat: konyha +200, fürdő +200 down, háló +200 / +200',mv(1).dx===200&&mv(1).dy===0&&mv(2).dx===0&&mv(2).dy===200&&mv(3).dx===200&&mv(3).dy===200);
  ok('flat: the rows add up — no step',p.steps.length===0,JSON.stringify(p.steps));
  apply();
  ok('flat: no overlaps',overlaps(WALLS())===0);
  ok('flat: wall area 7800 × 6800 − 42 m² = 11,04 m²',wallArea(WALLS())===11.04e6,wallArea(WALLS()));

  // ---------- 3. one L-shaped room (a reflex corner) ----------
  fresh();room([[0,0],[4000,0],[4000,2000],[2000,2000],[2000,4000],[0,4000]]);apply();
  ok('L: no overlaps',overlaps(WALLS())===0);
  ok('L: wall area 4600² − 2000² − 12 m² = 5,16 m²',wallArea(WALLS())===5.16e6,wallArea(WALLS()));

  // ---------- 4. a 45° edge is skipped, re-run keeps hand walls, undo ----------
  fresh();room([[0,0],[4000,0],[4000,2000],[2000,4000],[0,4000]]);p=w.wfwPlan('ground');
  ok('the 45° edge is listed, not walled',p.skipped.length===1&&/ferde/.test(p.skipped[0].why));
  fresh();room(rect(0,0,3600,3000));apply();WALLS().push({x0:10000,y0:0,x1:10100,y1:2000,layer:'L0'});
  const n0=WALLS().length;apply();
  ok('re-run replaces only its own walls',WALLS().length===n0&&WALLS().some(r=>r.x0===10000&&!r.gen));
  w.doUndo();ok('undo restores the walls before the run',WALLS().length===n0);

  // ---------- 5. Padló létrehozása + tint ----------
  fresh();const k=room(rect(0,0,3600,3000),{kinds:['konyha']}),u=room(rect(5000,0,8000,3000),{fill:'#123456'}),e=room(rect(9000,0,12000,3000));
  st.floorTint=true;
  ok('3 rooms get a floor',w.wfwFloors('ground')===3&&[k,u,e].every(f=>f.stage==='floor'));
  ok('konyha → 35 % of #cfe4c9 over #e2ddd0 = #dbdfce',k.fill==='#dbdfce',k.fill);
  ok('a user fill stays',u.fill==='#123456'&&!u.fillAuto);
  ok('no kind → the default #e2ddd0',e.fill==='#e2ddd0',e.fill);
  w.wfwTintToggle(false);ok('tint off → default',k.fill==='#e2ddd0'&&u.fill==='#123456');
  w.wfwTintToggle(true);ok('tint on again',k.fill==='#dbdfce');
  ok('nothing left to floor',w.wfwFloors('ground')===0);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
