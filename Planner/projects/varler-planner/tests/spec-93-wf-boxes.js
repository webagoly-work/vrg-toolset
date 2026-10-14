// Workflow round WP-E3 — Dobozok (src/08n-wf-boxes.js).
// What must hold (docs/workflow/WP-E3_junction-boxes.md; E06 own answer, Q-E08 = C): service points = Elosztó + derived
// portal boxes (L4 of a door face that has an Erősáram device in a slot) + szobadobozok; where a lamp leg meets
// (chosen box → the room's szobadoboz → the switch's portal box); sockets never meet in a box (classic chain); the
// szobadoboz is 150×150 for one job and 200×200 for two or more (feed · crossing · switching), a hand size stays;
// "Kötődoboz ehhez a kapcsoláshoz" puts a ⌀80 ceiling box for the leg (on its ceiling line) and pins the leg to it.
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
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};st.zoom=1;
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.devices.length=0;D.openings.length=0;D.marks=[];
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  D.floors.push({level:'ground',poly:rect(0,0,4000,3000),name:'Nappali',kinds:['nappali'],kind:'nappali',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(4000,0,6000,3000),name:'Fürdő',kinds:['furdo'],kind:'furdo',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(0,3000,6000,5000),name:'Előszoba',kinds:['eloszoba'],kind:'eloszoba',stage:'floor',clear:true,layer:'L0'});
  w.wfwApply(w.wfwPlan('ground'),'ground');w.wfPhase('vill');
  const [A,B,C]=D.floors;
  const door=(x,y,a)=>{D.openings.push({type:'door',level:'ground',x,y,ang:a,variant:0,w:900,h:2100,layer:'L0'});w.ensureIds(D);return D.openings[D.openings.length-1];};
  const D1=door(2000,3100,0);
  const Lid=w.epRoleLayer('sys:LIGHT').id;
  const lamp=(x,y)=>{D.devices.push({type:'light',code:'LMP',var:'230',level:'ground',x,y,h:2700,layer:Lid});w.ensureIds(D);return D.devices[D.devices.length-1];};
  const L1=lamp(2000,1500),L2=lamp(1000,1000);w.lswGroup([L1.id,L2.id]);
  // a box on the room side of a wall: try both faces, keep the one whose room is the target
  const onFace=(kind,x,y,rm)=>{for(const side of [1,0]){const d=w.jbPlace(kind,{level:'ground',x,y,side});if(!rm||w.jbRoomOf(d)===rm)return d;D.devices.splice(D.devices.indexOf(d),1);}return null;};
  // 1. service points
  ok('nothing yet: no service points',w.jbServicePoints('ground').length===0);
  const el=onFace('board',-150,2500,A);ok('Elosztó placed (type board) → a service point',el&&el.type==='board'&&w.jbServicePoints('ground').some(p=>p.kind==='board'));
  const slotA=w.ptSlots(D1).find(s=>s.k==='L1'&&s.room===A.id);w.lswLink([L1.id],{slot:slotA});
  const pb=w.jbPortalBoxes('ground');ok('a switch in D1 → its portal box (L4, 2450) appears, derived',pb.length===1&&pb[0].door===D1.id&&pb[0].h===2450&&!D.devices.some(d=>d.jb==='portal'));
  // 2. meeting
  let m=w.jbMeet(L1);ok('no szobadoboz yet → the leg meets in the switch\'s portal box',m&&m.kind==='portal'&&m.portal.door===D1.id,JSON.stringify(m&&m.kind));
  const sock={type:'socket',code:'SOC',var:'s04',level:'ground',x:500,y:500,h:300,layer:w.epRoleLayer('sys:SOC').id};D.devices.push(sock);w.ensureIds(D);
  ok('a socket never meets in a box (classic chain)',w.jbMeet(sock).kind==='chain');
  // 3. szobadoboz on an outer wall of the nappali
  const sz=onFace('szoba',1000,-150,A);
  ok('szobadoboz in the nappali, at 2150 (RBX position)',sz&&w.jbRoomOf(sz)===A&&sz.h===2150);
  m=w.jbMeet(L1);ok('now the leg meets in the szobadoboz',m.kind==='szoba'&&m.box===sz);
  ok('jobs: feed + switching → 200×200',w.jbJobs(sz).length===2&&sz.jbSize===200,w.jbJobs(sz).join(', ')+' '+sz.jbSize);
  // 4. szobadoboz on the A|B partition (crossing), no legs
  const part=W.ground.find(r=>r.x0===4000&&r.x1===4200);
  const sz2=onFace('szoba',4100,2500,B);
  ok('on the partition: both rooms on its faces → crossing',w.jbFaces(sz2).length===2);
  ok('fürdő box: feed + crossing → 200',sz2.jbSize===200&&w.jbJobs(sz2).indexOf('faláttörés')>=0);
  const sz3=onFace('szoba',1000,4950,C);
  ok('előszoba box on an outer wall, no legs → one job → 150',sz3&&sz3.jbSize===150,sz3&&sz3.jbSize);
  w.jbSetSize(sz3,200);ok('a hand size stays (sizeFix)',sz3.jbSize===200&&sz3.sizeFix);w.jbResize();ok('… even after a resize',sz3.jbSize===200);
  w.jbSetSize(sz3,null);ok('back to automatic → 150',sz3.jbSize===150&&!sz3.sizeFix);
  ok('szobadobozok are service points',w.jbServicePoints('ground').filter(p=>p.kind==='szoba').length===3);
  // 5. the ceiling box for a leg
  const top=W.ground.find(r=>r.y0===-300);w.rwlToggleWall(top,'ground');w.clnCommit([[1500,-150],[1500,1250]],{wall:top.id,u:1800},L1);
  const cb=w.jbCeilBox(L1.id);
  ok('a ⌀80 ceiling box at the ceiling',cb&&cb.jb==='ceiling'&&cb.jbShape==='circle'&&cb.jbSize===80&&cb.h===w.roomCeilH(A,'ground'));
  ok('it sits on the leg\'s ceiling line (x 1500)',Math.abs(cb.x-1500)<=1,cb.x+','+cb.y);
  ok('both lamps of the leg are pinned to it',L1.meet===cb.id&&L2.meet===cb.id&&w.jbMeet(L2).box===cb);
  ok('the szobadoboz lost its switching job → 150',sz.jbSize===150,sz.jbSize);
  // 6. checks, bar, tool
  lamp(3000,4000);const msgs=(w.STK_CHECKS['sys:LIGHT']||[]).flatMap(f=>{try{return f()||[];}catch(_){return [];}});
  ok('an előszoba lamp still meets (its room has a szobadoboz)',!msgs.some(x=>x.code==='jb.none'));
  D.devices.splice(D.devices.indexOf(sz3),1);const msgs2=(w.STK_CHECKS['sys:LIGHT']||[]).flatMap(f=>{try{return f()||[];}catch(_){return [];}});
  ok('… without it: jb.none',msgs2.some(x=>x.code==='jb.none'));
  w.wfBarDraw();ok('the bar offers Szobadoboz / Kötődoboz / Elosztó; only 4.4 and 4.5 greyed',/4\.3 Szobadoboz/.test($('wfBar').innerHTML)&&$('wfBar').querySelectorAll('button[disabled]').length===2);
  w.jbToolStart('kot');ok('the tool runs',w.eval('JB_T.on')&&w.eval('JB_T.kind')==='kot');w.setMode('wall');ok('another tool ends it',!w.eval('JB_T.on'));
  st.pitch=90;st.style='normal';st.wfPhase='vill';w.draw();ok('draws without errors',$('vp').firstChild.innerHTML.length>0);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
