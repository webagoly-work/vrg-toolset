// Workflow round WP-R2 — Vezethető fal, the routing-walls tool (src/08h-wf-routewalls.js).
// What must hold (docs/workflow/WP-R2_routing-walls.md; Q-R03 = A): whole-wall toggle; spans; rwlAllowed merges per
// wall and clamps to the wall; rwlCovers; the box gesture; marks are Jelölés marks (undo, layer); the band draws;
// a Create Walls re-run keeps the wall ids, so the marks still resolve.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.marks=[];
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  D.floors.push({level:'ground',poly:rect(0,0,3600,3000),name:'A',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(3600,0,7200,3000),name:'B',stage:'floor',clear:true,layer:'L0'});
  w.wfwApply(w.wfwPlan('ground'),'ground');
  const top=W.ground.find(r=>r.y0===-300&&r.y1===0),part=W.ground.find(r=>r.x0===3600&&r.x1===3800);
  ok('fixture: top wall 8000 long, partition 3000',w.mrkWallLen(top)===8000&&w.mrkWallLen(part)===3000);
  ok('the button exists',!!$('rwlBtn'));
  // whole wall
  ok('click → the whole wall is vezethető',w.rwlToggleWall(part,'ground')===true&&w.rwlMarks('ground').length===1);
  const m0=w.rwlMarks('ground')[0];ok('it is a plus wall mark tagged vezetheto',m0.kind==='wall'&&m0.pol==='plus'&&m0.tags[0]==='vezetheto'&&m0.wall===part.id);
  let A=w.rwlAllowed('ground');ok('allowed = the partition 0–3000',A.length===1&&A[0].wall===part.id&&A[0].u0===0&&A[0].u1===3000);
  ok('click again → removed',w.rwlToggleWall(part,'ground')===false&&w.rwlMarks('ground').length===0);
  w.doUndo();ok('undo brings it back',w.rwlMarks('ground').length===1);
  // spans
  w.rwlAddSpan(top,'ground',1000,2600);w.rwlAddSpan(top,'ground',3200,2400);
  A=w.rwlAllowed('ground').filter(a=>a.wall===top.id);
  ok('two overlapping spans merge to 1000–3200',A.length===1&&A[0].u0===1000&&A[0].u1===3200,JSON.stringify(A));
  ok('a 60 mm drag is refused',w.rwlAddSpan(top,'ground',5000,5060)===null);
  w.rwlAddSpan(top,'ground',6000,9000);A=w.rwlAllowed('ground').filter(a=>a.wall===top.id);
  ok('a span past the end is clamped to 8000',A.length===2&&A[1].u1===8000);
  ok('covers 1500',w.rwlCovers(top.id,1500));ok('does not cover 3500',!w.rwlCovers(top.id,3500));
  ok('the partition is covered anywhere',w.rwlCovers(part.id,2999));
  // box
  ok('a box over everything finds all 5 walls',w.rwlBoxWalls('ground',-1000,-1000,9000,4000).length===5);
  ok('a box over the left half finds the left wall and the partition, not the right wall',
    (()=>{const b=w.rwlBoxWalls('ground',-1000,-1000,4000,4000).map(r=>r.x0);return b.indexOf(-300)>=0&&b.indexOf(3600)>=0&&b.indexOf(7400)<0;})());
  // drawing
  st.pitch=90;st.style='normal';w.draw();const sc=$('vp').firstChild.innerHTML;
  ok('the bands draw (3 merged intervals)',(sc.match(/rwl-band/g)||[]).length===3,(sc.match(/rwl-band/g)||[]).length);
  ok('the marks list knows the wspan kind',w.eval('MRK_KINDS.wspan')==='Falszakasz (mindkét oldal)');
  // re-run keeps ids
  const ids=W.ground.map(r=>r.id).sort().join();w.wfwApply(w.wfwPlan('ground'),'ground');
  ok('a Create Walls re-run keeps the wall ids',W.ground.map(r=>r.id).sort().join()===ids);
  ok('… so the marks still resolve',w.rwlAllowed('ground').length===3);
  // the tool switches on and off
  w.rwlToolStart();ok('the tool is on in Select (since R5: the marker pen with the Vezethető fal ink)',w.MKP.on&&w.MKP.ink==='vezetheto'&&st.mode==='select');
  w.setMode('wall');ok('another tool turns it off',!w.MKP.on);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
