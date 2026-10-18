// Wireway rebuild T1 (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.4–4.6, GO-WIRE.md) — the `up` field (src/08od):
// 1. ⚙ Betáp-fa javaslat fills every node's upstream from today's engine run: a socket hangs on its drop's service
//    point (a door's L4 = {id: door, room}), a switched lamp on the box its leg meets in, a szobadoboz on the board;
// 2. derived roles: master = a junction fed from the board, leader = the first node below a master / door / board;
// 3. states: javasolt (no fix) / rögzített (fix) / none / unreached; a re-fill keeps the rögzített ones; Elfogadom mind;
// 4. invariants: one upstream (one field), no loops, not itself, the board is the root — refused with a reason;
// 5. checks: a dangling id, a chain into another circuit, nodes with none; the overlay draws dashed vs solid; saved.
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
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  WL.ground.push({x0:-100,y0:-100,x1:8100,y1:0,id:'W1'},{x0:-100,y0:0,x1:0,y1:3000,id:'W2'},{x0:4000,y0:0,x1:4100,y1:3000,id:'W3'},
    {x0:8000,y0:0,x1:8100,y1:3000,id:'W4'},{x0:-100,y0:3000,x1:8100,y1:3100,id:'W5'});
  D.floors.length=0;D.devices.length=0;D.circuits=[];D.paths.length=0;D.openings.length=0;D.marks=[];
  D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali',kinds:['nappali'],kind:'nappali',num:'RA',layer:'L0'},
    {level:'ground',poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'Háló',kinds:['halo'],kind:'halo',num:'RB',layer:'L0'});
  D.openings.push({type:'door',level:'ground',x:4050,y:1500,w:900,ang:Math.PI/2,variant:0});
  ['W1','W3','W4'].forEach(id=>D.marks.push({kind:'wall',wall:id,level:'ground',tags:['vezetheto'],pol:'plus',layer:'L0'}));
  const dev=(code,x,y,h,o)=>{const d=Object.assign({type:w.epTypeFor(code),code,level:'ground',x,y,h,layer:'L0'},o||{});D.devices.push(d);return d;};
  D.devices.push({type:'board',level:'ground',x:1000,y:60,h:1600,layer:'L0'});
  const sA=dev('SOC',2500,0,300),sA2=dev('SOC',2550,0,1100),sC=dev('SOC',2520,0,700),sB=dev('SOC',6500,0,300),lamp=dev('LMP',6000,1500,2700),lamp2=dev('LMP',7000,1500,2700);
  w.ensureIds(D);const sw=dev('SWI',4100,800,1100,{ctl:[lamp.id,lamp2.id]});lamp2.grp=lamp.grp='G1';w.ensureIds(D);
  const sz=w.jbMake('szoba',{level:'ground',x:8000,y:2000,h:2150,side:0});
  const board=D.devices.find(d=>d.type==='board');
  const cA=w.cktCreate({name:'Dugalj',mcb:{curve:'C',amps:16,poles:1,n:false},members:[sA.id,sA2.id,sB.id]});
  const cC=w.cktCreate({name:'Másik dugaljkör',mcb:{curve:'C',amps:16,poles:1,n:false},members:[sC.id]});
  const cV=w.cktCreate({name:'Világítás',mcb:{curve:'B',amps:10,poles:1,n:false},members:[lamp.id,lamp2.id,sw.id]});cV.ref='V1';cV.preset='vil';
  const id=x=>x.id,live=d=>w.byId('devices',d.id);
  // ---- 1. auto-fill ----
  const f=w.upFill('ground');
  ok('1 the fill runs and sets suggestions',!f.err&&f.set>=6,JSON.stringify({err:f.err,set:f.set,refused:f.refused}));
  // the drop box sits at 2450: its chain runs down — the 1100 socket first, the 300 one below it
  ok('1 the first socket of a drop hangs on the door L4 of its room',live(sA2).up&&live(sA2).up.id===D.openings[0].id&&live(sA2).up.room==='RA',JSON.stringify(live(sA2).up));
  ok('1 the socket below it in the same drop hangs on it, past the other circuit socket between them',live(sA).up&&live(sA).up.id===sA2.id,JSON.stringify(live(sA).up));
  ok('1 the other circuit socket in that drop hangs on the service point, not on the chain',live(sC).up&&live(sC).up.id===D.openings[0].id,JSON.stringify(live(sC).up));
  ok('1 the first switched lamp hangs on the box its leg meets in (the room szobadoboz), the next on it (the ceiling chain)',live(lamp).up&&live(lamp).up.id===sz.id&&live(lamp2).up&&live(lamp2).up.id===lamp.id,JSON.stringify([live(lamp).up,live(lamp2).up]));
  ok('1 the szobadoboz hangs on the board',live(sz).up&&live(sz).up.id===board.id);
  ok('1 every suggestion is javasolt (no fix)',[sA,sB,lamp,sz].every(d=>live(d).up&&!live(d).up.fix));
  // ---- 2. roles ----
  ok('2 the szobadoboz is a master, the lamp a leader, the board the root',w.upRole(sz.id)==='master'&&w.upRole(lamp.id)==='leader'&&w.upRole(board.id)==='board');
  ok('2 the chain of a lamp: lamp → szobadoboz → board',JSON.stringify(w.upChain(lamp.id).ids)===JSON.stringify([lamp.id,sz.id,board.id]));
  // ---- 3. states ----
  ok('3 state javasolt',w.upState(live(lamp))==='auto');
  w.upFix(lamp.id,true);ok('3 one fix → rögzített',w.upState(live(lamp))==='fix');
  w.upSet(sB.id,{id:sz.id},{fix:true});const f2=w.upFill('ground');
  ok('3 a re-fill keeps every rögzített link',live(sB).up.id===sz.id&&live(sB).up.fix&&live(lamp).up.fix&&f2.kept>=2,JSON.stringify({kept:f2.kept}));
  const n=w.upAcceptRoom('RB','ground');ok('3 Elfogadom mind in Háló fixes the rest there',n>=1&&live(lamp2).up.fix&&live(sz).up.fix,n);
  ok('3 … and leaves Nappali alone',!live(sA).up.fix);
  // ---- 4. invariants ----
  const r1=w.upSet(sz.id,{id:lamp.id});ok('4 a loop is refused with the chain spelled out',r1.err&&/Hurok/.test(r1.err)&&live(sz).up.id===board.id,r1.err);
  ok('4 a node cannot feed itself',/önmagát/.test(w.upSet(sA.id,{id:sA.id}).err||''));
  ok('4 the board has no upstream',/gyökér/.test(w.upSet(board.id,{id:sz.id}).err||''));
  ok('4 an unknown source is refused',/nincs a tervben/.test(w.upSet(sA.id,{id:'NOPE'}).err||''));
  // ---- 5. checks, drawing, saving ----
  w.upSet(sA2.id,{id:lamp.id},{fix:true});
  ok('5 a chain into another circuit is a warning',w.upCheck('ground').some(x=>x.code==='up.circuit'&&x.id===sA2.id));
  D.devices.find(d=>d.id===lamp.id).up=null;delete D.devices.find(d=>d.id===lamp.id).up;
  w.upSet(sA2.id,{id:sA.id},{fix:true});const dl=D.devices.find(d=>d.id===lamp2.id);dl.up={id:'GONE1'};
  ok('5 a dangling source is a warning',w.upCheck('ground').some(x=>x.code==='up.dangling'&&x.id===lamp2.id));
  ok('5 nodes with no upstream are counted (info)',w.upCheck('ground').some(x=>x.code==='up.none'));
  dl.up={id:sz.id};D.devices.find(d=>d.id===lamp.id).up={id:sz.id};
  w.UP.view=true;const ov=w.eval('STK_OVERLAY').map(fn=>{try{return fn()||'';}catch(_){return '';}}).join('');
  ok('5 the overlay draws dashed (javasolt) and solid (rögzített) links with arrows',/upArr/.test(ov)&&/stroke-dasharray/.test(ov)&&(ov.match(/marker-end="url\(#upArr\)"/g)||[]).length>=5);
  const saved=w.sessionObj().data.devices.find(d=>d.id===sB.id);
  ok('5 up is saved with the plan',saved&&saved.up&&saved.up.id===sz.id&&saved.up.fix===true);
  const before=JSON.stringify(D.devices.map(d=>d.up||null));w.upFill('ground');w.doUndo();
  ok('5 a fill is one undo step',JSON.stringify(w.__data.devices.map(d=>d.up||null))===before);
  {const D2=w.__data,g=id=>D2.devices.find(d=>d.id===id);delete g(sA.id).up;const fixedB=JSON.stringify(g(sB.id).up);
    const ar=w.blApplyRoutes(w.blRun('ground'),{confirm:true});
    ok('5 Pályák refreshes the javasolt links (same undo step) and keeps the rögzített',!ar.err&&ar.up>0&&g(sA.id).up&&!g(sA.id).up.fix&&JSON.stringify(g(sB.id).up)===fixedB,JSON.stringify(ar).slice(0,160));}
  ok('5 the actions are registered',['up.fill','up.tool','up.view'].every(k=>w.eval('ACTIONS').some(a=>a.id===k)));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
