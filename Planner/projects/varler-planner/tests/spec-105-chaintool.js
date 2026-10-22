// Wireway rebuild T5 (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.2, Q3 = A) — src/08og, the chain tool (⛓ Betáp-lánc):
// 1. each click sets up = the previously clicked node, rögzített; the board / a hub / a door start a chain;
// 2. a click on a node already in this chain starts a branch (two nodes with the same up); Shift + click too;
// 3. no revisits: a loop is refused with the reason, and the chain keeps its place; every link is one undo step;
// 4. the engine follows the drawn chain (T2).
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
  D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali',num:'RA',layer:'L0'},{level:'ground',poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'Háló',num:'RB',layer:'L0'});
  D.openings.push({type:'door',level:'ground',x:4050,y:1500,w:900,ang:Math.PI/2,variant:0});const door=D.openings[0];w.ensureIds(D);
  ['W1','W2','W3','W4','W5'].forEach(id=>D.marks.push({kind:'wall',wall:id,level:'ground',tags:['vezetheto'],pol:'plus',layer:'L0'}));
  const dev=(code,x,y,h)=>{const d={type:w.epTypeFor(code),code,level:'ground',x,y,h,layer:'L0'};D.devices.push(d);return d;};
  D.devices.push({type:'board',level:'ground',x:1000,y:60,h:1600,layer:'L0'});const board=D.devices[D.devices.length-1];
  const s1=dev('SOC',2500,0,300),s2=dev('SOC',3500,0,300),s3=dev('SOC',0,1500,300),s4=dev('SOC',6500,0,300),s5=dev('SOC',7500,0,300);w.ensureIds(D);
  w.cktCreate({name:'Dugalj',mcb:{curve:'C',amps:16,poles:1,n:false},members:[s1.id,s2.id,s3.id,s4.id,s5.id]});
  const L=d=>w.byId('devices',d.id),C=w.BFL;
  w.bflStart();ok('1 the tool starts empty',C.on&&!C.prev);
  let r=w.bflClick({id:board.id});ok('1 a click on the board: the chain starts there, nothing linked',r.from&&r.from.id===board.id&&!L(board).up);
  r=w.bflClick({id:s1.id});ok('1 the next click: s1 ← board, rögzített',r.linked===s1.id&&L(s1).up.id===board.id&&L(s1).up.fix);
  w.bflClick({id:s2.id});ok('1 then s2 ← s1',L(s2).up.id===s1.id&&L(s2).up.fix);
  // ---- 2. branch ----
  r=w.bflClick({id:s1.id});ok('2 a click on a chain node starts a branch (s1 keeps its up)',r.from&&r.from.id===s1.id&&L(s1).up.id===board.id);
  w.bflClick({id:s3.id});ok('2 … so s3 ← s1: s2 and s3 share their up',L(s3).up.id===s1.id&&L(s2).up.id===s1.id);
  r=w.bflClick({door:door.id,room:'RB'});ok('2 a door starts a chain from its L4',r.from&&r.from.door===door.id);
  w.bflClick({id:s4.id});ok('2 s4 ← the door L4 (Háló side)',L(s4).up.id===door.id&&L(s4).up.room==='RB');
  w.bflClick({id:s5.id},false);w.bflClick({id:s2.id},true);ok('2 Shift + click starts from any node',C.prev.id===s2.id&&L(s2).up.id===s1.id&&L(s5).up.id===s4.id);
  // ---- 3. loops, undo ----
  r=w.bflClick({id:s1.id},true);r=w.bflClick({id:s1.id});   // s1 is a chain node → a branch, not a link
  ok('3 clicking the same node again is a branch start, never a link to itself',r.from&&L(s1).up.id===board.id);
  w.bflOff();w.bflStart();w.bflClick({id:s3.id},true);r=w.bflClick({id:s1.id});
  ok('3 a loop (s1 under its own child s3) is refused with the reason',r.err&&/Hurok/.test(r.err)&&L(s1).up.id===board.id&&C.prev.id===s3.id,r.err);
  const n=C.links;w.bflClick({id:s5.id});const was=L(s5).up.id;w.doUndo();
  ok('3 every link is one undo step',was===s3.id&&w.byId('devices',s5.id).up.id===s4.id);
  // ---- 4. the engine follows ----
  const run=w.blRun('ground'),dp=id=>run.R.drops.find(d=>d.members.some(e=>e.id===id));
  ok('4 the engine follows the drawn chain: s2 and s3 fed from s1, s5 from s4',dp(s2.id).parent===dp(s1.id)&&dp(s3.id).parent===dp(s1.id)&&dp(s5.id).parent===dp(s4.id),[dp(s2.id).parent&&dp(s2.id).parent.key,dp(s1.id).key].join(' '));
  ok('4 s4 hangs on the door from the Háló side',dp(s4.id).sp===door.id&&dp(s4.id).spFace.room==='RB');
  ok('the action is registered',w.eval('ACTIONS').some(a=>a.id==='bfl.tool'));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
