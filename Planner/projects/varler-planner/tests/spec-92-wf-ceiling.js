// Workflow round WP-E2 — Mennyezeti út, ceiling reach lines (src/08m-wf-ceiling.js).
// What must hold (docs/workflow/WP-E2_ceiling-reach.md): a line may start only on a Vezethető fal point, a door's MAINS
// slot, a box or a switch; it ends on a ceiling lamp; one line per lamp (a new one replaces it); the height is the room's
// ceiling, and above the álmennyezet where the room has one (void); the other mark code tolerates the new kind.
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
  D.floors.push({level:'ground',poly:rect(0,0,4000,3000),name:'Nappali',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(4000,0,7000,3000),name:'Háló',stage:'floor',clear:true,layer:'L0',dropC:300});
  w.wfwApply(w.wfwPlan('ground'),'ground');w.wfPhase('vill');
  const top=W.ground.find(r=>r.y0===-300),left=W.ground.find(r=>r.x0===-300);
  w.rwlToggleWall(top,'ground');                                     // the top wall is vezethető, the left one is not
  D.openings.push({type:'door',level:'ground',x:4100,y:1500,ang:Math.PI/2,variant:0,w:900,h:2100,layer:'L0'});w.ensureIds(D);
  const Lid=w.epRoleLayer('sys:LIGHT').id;
  const lamp=(x,y)=>{D.devices.push({type:'light',code:'LMP',var:'230',level:'ground',x,y,h:2850,layer:Lid});w.ensureIds(D);return D.devices[D.devices.length-1];};
  const A=lamp(2000,1500),B=lamp(5700,1500);
  // 1. where a line may start
  let s=w.clnStartAt([2000,-140],'ground');ok('a point on the Vezethető fal → start, on its centreline',s&&s.from.wall===top.id&&s.p[1]===-150,JSON.stringify(s));
  ok('a point on an unmarked wall → refused',w.clnStartAt([-150,1500],'ground')===null);
  const L4=w.ptSlots(D.openings[0]).find(x=>x.k==='L4');
  s=w.clnStartAt([L4.x+20,L4.y],'ground');ok('a door MAINS slot → start (portál)',s&&s.from.door===D.openings[0].id&&/portál/.test(s.why),JSON.stringify(s));
  ok('a ceiling lamp is found near the pointer',w.clnLampAt([2030,1490],'ground')===A);
  // 2. commit
  const m=w.clnCommit([[2000,-150],[2000,800]],{wall:top.id,u:2300},A);
  ok('a cline mark from the wall to the lamp',m&&m.kind==='cline'&&m.lamp===A.id&&m.pts.length===3&&m.pts[2][0]===2000&&m.pts[2][1]===1500);
  ok('nappali: on the room ceiling, not void',m.h===w.roomCeilH(D.floors[0],'ground')&&m.void===false,m.h+'/'+m.void);
  ok('length 1650 mm',Math.round(w.clnLen(m))===1650);
  ok('clineFor finds it',w.clineFor(A.id)===m);
  const m2=w.clnCommit([[4100,1500]],{door:D.openings[0].id,face:1,k:'L4'},B);
  ok('háló has an álmennyezet → the route runs above it (void)',m2.void===true);
  // 3. one per lamp
  w.clnCommit([[3000,-150]],{wall:top.id,u:3300},A);
  ok('a new line for the same lamp replaces the old one',w.clnMarks('ground').filter(x=>x.lamp===A.id).length===1&&w.clineFor(A.id).pts[0][0]===3000);
  w.doUndo();ok('undo brings back the first line',w.clineFor(A.id)&&w.clineFor(A.id).pts[0][0]===2000);
  // 4. checks, drawing, the rest of the mark code
  lamp(1000,2500);const msgs=(w.STK_CHECKS['sys:LIGHT']||[]).flatMap(f=>{try{return f()||[];}catch(_){return [];}});
  ok('a ceiling lamp without a line is reported (cln.none)',msgs.some(x=>x.code==='cln.none')&&!msgs.some(x=>x.code==='cln.none'&&x.msg.indexOf(A.ref||A.id)===0));
  st.pitch=90;st.style='normal';w.draw();const sc=$('vp').firstChild.innerHTML;
  ok('both lines draw',(sc.match(/class="cln cln-ceil"/g)||[]).length===2);
  let err=null;try{w.mrkListDialog();w.closeModal&&w.closeModal();}catch(e){err=e.message;}ok('the marks list tolerates the new kind',!err,err);
  ok('the Szabályok phase offers Mennyezeti út',/wf.ceilLine/.test([...w.document.querySelectorAll('#phBody .phGrid[data-ph="szab"] .tool')].map(b=>b.dataset.a).join()));
  w.clnToolStart();ok('the tool runs',w.eval('CLN.on'));w.setMode('wall');ok('another tool ends it',!w.eval('CLN.on'));
  // 5. colours: ceiling blue, floor brown (the user's choice)
  w.draw();let sc2=$('vp').firstChild.innerHTML;
  ok('ceiling lines draw blue (#2f79c9)',/class="cln cln-ceil"[^>]*stroke="#2f79c9"/.test(sc2));
  // 6. Padló út
  const soc={type:'socket',code:'SOC',var:'s04',level:'ground',x:2500,y:2000,h:300,layer:w.epRoleLayer('sys:SOC').id};D.devices.push(soc);w.ensureIds(D);
  ok('floor target: a socket (not a ceiling lamp)',w.clnTargetAt([2510,2000],'ground','floor')===soc&&w.clnTargetAt([2000,1500],'ground','floor')!==A);
  ok('ceiling target never a socket',w.clnTargetAt([2510,2000],'ground','ceil')!==soc);
  const f1=w.clnCommit([[2500,-150],[2500,1000]],{wall:top.id,u:2800},soc,'floor');
  ok('a floor line: plane floor, tag padlo-ut, h 0, not void',f1&&f1.plane==='floor'&&f1.tags[0]==='padlo-ut'&&f1.h===0&&f1.void===false);
  ok('flineFor finds it; clineFor (ceiling) does not',w.flineFor(soc.id)===f1&&!w.clineFor(soc.id));
  ok('a ceiling line and a floor line are counted per plane',w.clnMarks('ground','floor').length===1&&w.clnMarks('ground','ceil').length===2);
  w.draw();sc2=$('vp').firstChild.innerHTML;ok('the floor line draws brown (#8a5a2b)',/class="cln cln-floor"[^>]*stroke="#8a5a2b"/.test(sc2));
  // padlófűtés zone (R3) blocks the floor, not the ceiling
  w.rbZoneCommit(w.rbPreset('padlofutes'),'ground',[1000,500],[1500,2800]);
  const soc2={type:'socket',code:'SOC',var:'s04',level:'ground',x:500,y:2000,h:300,layer:soc.layer};D.devices.push(soc2);w.ensureIds(D);
  const n0=D.marks.length;
  ok('a floor line across a Padlófűtés zone is refused',w.clnCommit([[2000,-150],[2000,2000]],{wall:top.id,u:2300},soc2,'floor')===null&&D.marks.length===n0);
  ok('… around it is fine',!!w.clnCommit([[600,-150]],{wall:top.id,u:900},soc2,'floor'));
  ok('the ceiling ignores floor heating',!!w.clnCommit([[1200,-150],[1200,1500]],{wall:top.id,u:1500},A));
  ok('the Szabályok phase offers Padló út',/wf.floorLine/.test([...w.document.querySelectorAll('#phBody .phGrid[data-ph="szab"] .tool')].map(b=>b.dataset.a).join()));
  w.clnToolStart('floor');ok('the floor tool runs',w.eval('CLN.on')&&w.eval('CLN.plane')==='floor');w.setMode('wall');
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
