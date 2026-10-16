// Workflow round WP-F1 + WP-F2 — the room pen (src/08c-wf-pen.js).
//
// What must hold (docs/workflow/WP-F1_room-pen.md, WP-F2_shared-edges.md): 45° lock + 100 mm steps; a closed draft
// makes ONE outline-stage, clear (inner-size) floor record with the right Terület / Kerület; the rectangle gesture;
// vertex / edge snapping; shared edges derived from geometry; the Sims drag moves every room on the line and clamps
// at 300 mm; a pen line across a room splits it (the bigger part keeps the id); undo; outline rooms draw no slab.
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
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();
  const st=w.__state,D=w.__data;st.active='ground';
  const WFP=w.eval('WFP');
  const fresh=()=>{D.floors.length=0;WFP.draft=null;WFP.typed='';};
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const add=P=>{WFP.draft=P.map(p=>p.slice());w.wfpClose();return D.floors[D.floors.length-1];};
  const width=fl=>Math.max(...fl.poly.map(p=>p[0]))-Math.min(...fl.poly.map(p=>p[0]));
  const m2=fl=>Math.round(w.polyAreaMM(fl.poly)/1e4)/100;

  // ---------- 1. the 45° lock and the 100 mm step ----------
  ok('axis: (1234,40) → (1200,0)',JSON.stringify(w.wfpLock([0,0],[1234,40],100).p)==='[1200,0]');
  ok('diagonal: (1010,1030) → (1000,1000)',JSON.stringify(w.wfpLock([0,0],[1010,1030],100).p)==='[1000,1000]');
  ok('straight down: (30,-2560) → (0,-2600)',JSON.stringify(w.wfpLock([0,0],[30,-2560],100).p)==='[0,-2600]');
  ok('the tool is registered with its hint',typeof w.eval('HINTS.room')==='string'&&!!w.document.querySelector('.tool[data-mode="room"]'));

  // ---------- 2. closing a draft → one outline room ----------
  fresh();const A=add(rect(0,0,3600,3000));
  ok('one floor record',D.floors.length===1);
  ok('stage outline + clear',A.stage==='outline'&&A.clear===true&&A.level==='ground');
  ok('area 10,80 m²',m2(A)===10.8,m2(A));
  ok('perimeter 13,20 m',Math.round(w.polyPerimMM(A.poly,true))===13200);
  ok('it has an id',/^F\d+$/.test(A.id||''),A.id);

  // ---------- 3. the rectangle gesture ----------
  fresh();const g=w.wfpGrid;
  ok('drag 0,0 → 3610,2990 = 3600 × 3000',w.wfpRectRoom(g([0,0],100),g([3610,2990],100))===0&&m2(D.floors[0])===10.8);
  ok('a 200 × 200 drag makes nothing',w.wfpRectRoom([0,0],[200,200])===-1&&D.floors.length===1);

  // ---------- 4. snapping to an existing room ----------
  st.zoom=1;
  let sn=w.wfpSnapPt([3605,1500],false);
  ok('near an edge → the foot point on it',sn.kind==='edge'&&sn.p[0]===3600&&sn.p[1]===1500,JSON.stringify(sn));
  sn=w.wfpSnapPt([3590,2992],false);
  ok('near a corner → the corner',sn.kind==='vertex'&&sn.p[0]===3600&&sn.p[1]===3000,JSON.stringify(sn));
  sn=w.wfpSnapPt([5049,7020],false);
  ok('open space, no draft → the 100 mm grid',sn.kind==='grid'&&sn.p[0]===5000&&sn.p[1]===7000,JSON.stringify(sn));

  // ---------- 5. shared edges + the Sims drag ----------
  fresh();const RA=add(rect(0,0,3600,3000)),RB=add(rect(3600,0,7200,3000));
  const groups=w.wfpSharedAll('ground');
  ok('one shared group of 2 edges',groups.length===1&&groups[0].length===2,groups.map(x=>x.length).join(','));
  const eA=w.wfpEdges('ground').find(e=>e.room===0&&e.a[0]===3600&&e.b[0]===3600);
  let G=w.wfpDragStart(eA);let r=w.wfpDragApply(G,200/G.n[0]);
  ok('drag +200 → A 3800 wide, B 3400 wide',width(RA)===3800&&width(RB)===3400,width(RA)+'/'+width(RB));
  ok('areas 11,40 / 10,20 m²',m2(RA)===11.4&&m2(RB)===10.2);
  ok('both still closed 4-gons',RA.poly.length===4&&RB.poly.length===4);
  G=w.wfpDragStart(w.wfpEdges('ground').find(e=>e.room===0&&e.a[0]===3800&&e.b[0]===3800));
  r=w.wfpDragApply(G,3200/G.n[0]);   // asks for B = 200
  ok('clamp: B stops at 300 mm',r.clamped&&width(RB)===300&&width(RA)===6900,width(RA)+'/'+width(RB));

  // ---------- 6. split ----------
  fresh();const S=add(rect(0,0,6000,3000));const sid=S.id;
  WFP.draft=[[3600,0]];w.wfpAddNode({p:[3600,3000],kind:'edge'});
  ok('a line across splits it into two rooms',D.floors.length===2);
  ok('10,80 + 7,20 m²',m2(D.floors[0])===10.8&&m2(D.floors[1])===7.2,m2(D.floors[0])+' + '+m2(D.floors[1]));
  ok('the bigger part keeps the id',D.floors[0].id===sid&&D.floors[1].id&&D.floors[1].id!==sid);
  ok('the new part is an outline, clear room',D.floors[1].stage==='outline'&&D.floors[1].clear===true);
  fresh();add(rect(0,0,6000,3000));
  ok('a line along one edge is not a split',w.wfpSplitPolys(D.floors[0],[[1000,0],[4000,0]])===null);
  ok('a line leaving the room is not a split',w.wfpSplitPolys(D.floors[0],[[3600,0],[3600,-500],[3600,3000]])===null);
  // L-shaped cut through a corner region
  fresh();const L=add([[0,0],[6000,0],[6000,4000],[0,4000]]);
  const parts=w.wfpSplitPolys(L,[[2000,0],[2000,2000],[6000,2000]]);
  ok('an L-cut gives 8 + 16 m²',parts&&Math.round(w.polyAreaMM(parts[0])/1e4)/100+Math.round(w.polyAreaMM(parts[1])/1e4)/100===24
    &&[parts[0],parts[1]].map(p=>Math.round(w.polyAreaMM(p)/1e6)).sort((a,b)=>a-b).join()==='8,16');

  // ---------- 7. undo + drawing ----------
  fresh();add(rect(0,0,3600,3000));w.doUndo();
  ok('undo removes the room',D.floors.length===0);
  fresh();add(rect(0,0,3600,3000));st.pitch=90;w.draw();
  const scene=$('vp').firstChild.innerHTML;
  ok('the outline draws (class wfp-outline)',scene.includes('wfp-outline'));
  ok('Terület label with a decimal comma',scene.includes('Terület 10,80 m²'));
  ok('no slab fill for an outline room',!scene.includes('#e2ddd0'));
  D.floors[0].stage='floor';w.draw();
  ok('stage floor draws the slab again',$('vp').firstChild.innerHTML.includes('#e2ddd0'));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
