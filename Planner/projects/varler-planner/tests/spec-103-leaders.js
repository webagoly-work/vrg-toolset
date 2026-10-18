// Wireway rebuild T3 (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.5 K1, Q5 = A) — src/08oe:
// 1. sockets of one circuit in one room chain from the leader (nearest to the feed, or the clicked one): each hangs on
//    the nearest unvisited one along the walls; the leader hangs on a door L4 / the board, never a szobadoboz;
// 2. 📍 one click makes another socket the leader — one leader per circuit and room — and the chain follows at once;
// 3. the engine routes the chain (box → box runs); a rögzített link stays as the user set it;
// 4. masters: a room with no hub and ≥ 4 drops gets a szobadoboz suggestion; placing it adds the device and refills.
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
  // room A 0–6000 × 0–4000, room B to the right; the door between them at y 3000 on the partition x 6000–6100
  WL.ground.push({x0:-100,y0:-100,x1:10100,y1:0,id:'W1'},{x0:-100,y0:0,x1:0,y1:4000,id:'W2'},{x0:6000,y0:0,x1:6100,y1:4000,id:'W3'},
    {x0:10000,y0:0,x1:10100,y1:4000,id:'W4'},{x0:-100,y0:4000,x1:10100,y1:4100,id:'W5'});
  D.floors.length=0;D.devices.length=0;D.circuits=[];D.paths.length=0;D.openings.length=0;D.marks=[];
  D.floors.push({level:'ground',poly:[[0,0],[6000,0],[6000,4000],[0,4000]],name:'Nappali',num:'RA',layer:'L0'},{level:'ground',poly:[[6100,0],[10000,0],[10000,4000],[6100,4000]],name:'Háló',num:'RB',layer:'L0'});
  D.openings.push({type:'door',level:'ground',x:6050,y:3000,w:900,ang:Math.PI/2,variant:0});
  ['W1','W2','W3','W4','W5'].forEach(id=>D.marks.push({kind:'wall',wall:id,level:'ground',tags:['vezetheto'],pol:'plus',layer:'L0'}));
  const dev=(code,x,y,h,o)=>{const d=Object.assign({type:w.epTypeFor(code),code,level:'ground',x,y,h,layer:'L0'},o||{});D.devices.push(d);return d;};
  D.devices.push({type:'board',level:'ground',x:8000,y:60,h:1600,layer:'L0'});
  // four sockets round room A, one circuit: s1 near the door … s4 far away
  const s1=dev('SOC',6000,2000,300,{side:0}),s2=dev('SOC',4000,0,300),s3=dev('SOC',1000,0,300),s4=dev('SOC',0,2000,300);w.ensureIds(D);
  w.cktCreate({name:'Nappali dugalj',mcb:{curve:'C',amps:16,poles:1,n:false},members:[s1.id,s2.id,s3.id,s4.id]});
  const L=d=>w.byId('devices',d.id),door=D.openings[0].id;
  const f=w.upFill('ground');
  ok('1 the fill works',!f.err&&f.set>=4,f.err||JSON.stringify(f.refused));
  ok('1 the leader (nearest the door) hangs on the door L4',L(s1).up&&L(s1).up.id===door,JSON.stringify(L(s1).up));
  ok('1 the rest chain: s2 ← s1, s3 ← s2, s4 ← s3',L(s2).up.id===s1.id&&L(s3).up.id===s2.id&&L(s4).up.id===s3.id,JSON.stringify([L(s2).up,L(s3).up,L(s4).up]));
  ok('1 the chain links are javasolt',[s2,s3,s4].every(d=>!L(d).up.fix));
  // ---- 3. the engine routes it ----
  const run=w.blRun('ground'),Rr=run.R,boxOf=id=>{const d=Rr.drops.find(d=>d.members.some(e=>e.id===id));return Rr.boxes.find(b=>b.drop===d.key);};
  const lk=(a,b)=>Rr.legs.some(l=>l.kind==='dist'&&((l.from===a.id&&l.to===b.id)||(l.from===b.id&&l.to===a.id)));
  ok('3 the engine draws the chain box to box',lk(boxOf(s1.id),boxOf(s2.id))&&lk(boxOf(s2.id),boxOf(s3.id))&&lk(boxOf(s3.id),boxOf(s4.id)),Rr.legs.filter(l=>l.kind==='dist').map(l=>l.from+'>'+l.to).join(' '));
  // ---- 2. the leader click ----
  const r=w.ldSetLeader(s4.id);
  ok('2 a click makes s4 the leader (one per circuit and room)',r.ok&&r.lead&&L(s4).lead&&!L(s1).lead);
  ok('2 … the leader hangs on the door, and the chain turns round: s3 ← s4, s2 ← s3, s1 ← s2',L(s4).up.id===door&&L(s3).up.id===s4.id&&L(s2).up.id===s3.id&&L(s1).up.id===s2.id,JSON.stringify([L(s4).up,L(s3).up,L(s2).up,L(s1).up]));
  w.ldSetLeader(s1.id);ok('2 another click moves the leader back',L(s1).lead&&!L(s4).lead&&L(s1).up.id===door&&L(s2).up.id===s1.id);
  ok('2 a non-socket cannot lead',!!w.ldSetLeader(D.devices.find(d=>d.type==='board').id).err);
  // a rögzített link stays through the refill
  w.upSet(s4.id,{id:s2.id},{fix:true});w.upFill('ground');ok('3 a rögzített link survives the chain refill',L(s4).up.id===s2.id&&L(s4).up.fix);
  w.upClear(s4.id);
  // ---- 1b. a szobadoboz is never a socket feed ----
  const sz=w.jbMake('szoba',{level:'ground',x:6050,y:1500,h:2150,side:0});w.upFill('ground');
  ok('1 with a szobadoboz on the partition the leader still hangs on the door L4 (or the board)',L(s1).up&&(L(s1).up.id===door||w.byId('devices',L(s1).up.id).type==='board'),JSON.stringify(L(s1).up));
  ok('1 the szobadoboz hangs on the board (a master)',L(sz).up&&w.byId('devices',L(sz).up.id).type==='board');
  D.devices.splice(D.devices.indexOf(L(sz)),1);w.upFill('ground');
  // ---- 4. masters ----
  const M=w.ldMasters('ground');
  ok('4 room A (4 drops, no hub) gets a szobadoboz suggestion on a wall',!M.err&&M.list.length===1&&M.list[0].room==='RA'&&M.list[0].drops===4&&/^W/.test(M.list[0].wall),JSON.stringify(M.list||M.err));
  ok('4 room B (no drops) does not',!M.list.some(m=>m.room==='RB'));
  const n0=D.devices.filter(d=>d.type==='junction'&&d.jb==='szoba').length;M.list[0].on=true;const p=w.ldPlaceMasters(M.list,'ground');
  ok('4 placing it adds one szobadoboz and refills the tree',p.placed===1&&D.devices.filter(d=>d.type==='junction'&&d.jb==='szoba').length===n0+1&&p.links>0);
  const szn=w.byId('devices',p.ids[0]);ok('4 the new szobadoboz is a master (on the board)',szn.up&&w.byId('devices',szn.up.id).type==='board'&&w.upRole(szn.id)==='master');
  ok('4 … and the room now has a hub: no more suggestion there',!w.ldMasters('ground').list.some(m=>m.room==='RA'));
  ok('the actions are registered',['ld.tool','ld.masters'].every(k=>w.eval('ACTIONS').some(a=>a.id===k)));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
