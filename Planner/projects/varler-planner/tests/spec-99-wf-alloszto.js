// Workflow round WP-E6 — an Alosztó on every further level (src/08oc-wf-alloszto.js; E5-Q8: per-floor RCD protection).
// Fixture: two rooms on the ground floor (main Elosztó) and the same two upstairs (a socket, a switch → lamp).
// 1. placing a board upstairs makes it the Alosztó: its feed point below (DED alelo at the ceiling) + the feeder circuit
//    (3C 25A, NYM-J 5×6), one undo; on the main level it stays a plain board;
// 2. circuits are suggested per board level; the engine runs per level — upstairs from the Alosztó, fed through the
//    slab; the feeder's own voltage drop is added upstairs;
// 3. protection (E6-Q3): one main switch, in the main Elosztó; the feeder leaves through its own RCD (the floor's RCD);
//    the Alosztó: no main switch, SPD type 2, plain MCBs; the suggested feeder (Q1 C); the checks; the button, the menu;
// 4. chained feeding (Q4 B): main in the basement → the ground-floor Alosztó → the upstairs one; drops add up.
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
  const walls=(l,p)=>WL[l].push({x0:-100,y0:-100,x1:8100,y1:0,id:p+'1'},{x0:-100,y0:0,x1:0,y1:3000,id:p+'2'},{x0:4000,y0:0,x1:4100,y1:3000,id:p+'3'},
    {x0:8000,y0:0,x1:8100,y1:3000,id:p+'4'},{x0:-100,y0:3000,x1:8100,y1:3100,id:p+'5'});
  walls('ground','W');walls('upper','U');
  D.floors.length=0;D.devices.length=0;D.circuits=[];D.paths.length=0;D.openings.length=0;D.marks=[];
  const rooms=(l,a,b)=>D.floors.push({level:l,poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'A',kinds:['nappali'],kind:'nappali',num:a,layer:'L0'},
    {level:l,poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'B',kinds:['halo'],kind:'halo',num:b,layer:'L0'});
  rooms('ground','GA','GB');rooms('upper','UA','UB');
  ['ground','upper'].forEach(l=>D.openings.push({type:'door',level:l,x:4050,y:1500,w:900}));
  const vz=(l,wall)=>D.marks.push({kind:'wall',wall,level:l,tags:['vezetheto'],pol:'plus',layer:'L0'});
  ['W1','W3','W2'].forEach(x=>vz('ground',x));['U1','U3','U2'].forEach(x=>vz('upper',x));
  const dev=(code,l,x,y,h,o)=>{const d=Object.assign({type:w.epTypeFor(code),code,level:l,x,y,h,layer:'L0'},o||{});D.devices.push(d);return d;};
  w.ensureIds(D);
  const main=w.jbPlace('board',{level:'ground',x:1000,y:0,side:1});
  const gs=dev('SOC','ground',2500,0,300),us=dev('SOC','upper',6500,0,300),ul=dev('LMP','upper',6000,1500,2700);w.ensureIds(D);
  const usw=dev('SWI','upper',4110,800,1100,{ctl:[ul.id]});w.ensureIds(D);
  ok('a board on an empty plan is the main Elosztó, not an Alosztó',!main.sub&&w.alsMain()===main);
  // ---- 1. the Alosztó ----
  const nDev=D.devices.length,nC=w.cktList().length;
  const al=w.jbPlace('board',{level:'upper',x:1000,y:0,side:1,sub:true});
  const ep=w.byId('devices',al.feedEp),fc=w.cktList().find(c=>c.preset==='alelo');
  ok('the upstairs board is the Alosztó (AL1)',al.sub===true&&al.ref==='AL1'&&/Alosztó/.test(al.name));
  ok('its feed point: on the main level, straight below, DED alelo, at the ceiling',!!ep&&ep.level==='ground'&&ep.x===al.x&&ep.y===al.y&&ep.code==='DED'&&ep.var==='alelo'&&ep.h===w.eval('LH').ground-100&&ep.feeds===al.id);
  ok('the feeder circuit: dedicated, 3C 25A, its one member is the feed point',!!fc&&fc.dedicated&&fc.mcb.amps===25&&fc.mcb.poles===3&&fc.members.length===1&&fc.members[0]===ep.id);
  w.doUndo();ok('one undo removes the Alosztó, its feed point and the circuit',D.devices.length===nDev&&w.cktList().length===nC);
  const al2=w.jbPlace('board',{level:'upper',x:1000,y:0,side:1,sub:true});const ep2=w.byId('devices',al2.feedEp);
  const nb=w.jbPlace('board',{level:'ground',x:3000,y:0,side:1,sub:true});
  ok('the Alosztó tool on the main level makes no Alosztó (and says so)',!nb.sub&&/másik szintre/.test(w.document.getElementById('hud').textContent));
  D.devices.splice(D.devices.indexOf(nb),1);
  // ---- 2. circuits per level, the engine per level ----
  const sAl=w.elpSuggest(al2.id),sMain=w.elpSuggest(main.id);
  const lvOf=rows=>new Set(rows.flatMap(r=>r.members).map(id=>w.byId('devices',id).level));
  ok('the Alosztó suggests for its own level only',sAl.length>0&&[...lvOf(sAl)].join()==='upper');
  ok('the main Elosztó for its own level only',sMain.length>0&&[...lvOf(sMain)].join()==='ground');
  w.elpApply(sAl);w.elpApply(sMain);
  const I=w.blInput('upper');
  ok('upstairs: the feeder arrives at the feed point, NYM-J 5×6',I.cfg.subFeed&&I.cfg.subFeed.x===ep2.x&&I.cfg.subFeed.y===ep2.y&&I.cfg.subFeed.cable==='NYM5x6');
  ok('upstairs: only the upstairs circuits go into the engine',I.doc.project.data.circuits.every(c=>c.members.every(id=>w.byId('devices',id).level==='upper'))&&I.doc.project.data.circuits.length>0);
  const rg=w.blRun('ground'),ru=w.blRun('upper');
  ok('both levels run',!rg.err&&!ru.err,(rg.err||'')+(ru.err||''));
  const frow=rg.R.checks.find(r=>r.circ===w.cktOfDevice(ep2).ref);
  ok('ground: the feeder is checked as a 3-phase 25 A / 6 mm² circuit',!!frow&&frow.In===25&&frow.mm2===6&&frow.cable==='NYM5x6'&&frow.okI);
  ok('ground: a drop leg reaches the feed point',rg.R.legs.some(l=>l.kind==='drop'&&l.dev===ep2.id));
  const fl=ru.R.legs.find(l=>l.kind==='feed');
  ok('upstairs: a feed leg from the riser to the Alosztó (slab + up + along + to the cabinet)',!!fl&&fl.to==='AL1'&&/Felszálló/.test(fl.from)&&fl.poly[0][2]===-300&&fl.pipes[0].cables[0].c==='NYM5x6'&&fl.len>300+ru.R.W.trunk);
  ok('upstairs: the runs start from the Alosztó (trunk from it)',ru.R.legs.some(l=>l.kind==='trunk'&&l.from==='Elosztó'));
  ok('upstairs: the feeder drop is added to every circuit',ru.cfg.upstreamDropPct===frow.dU&&ru.R.checks.every(r=>r.dUup===frow.dU)&&ru.notes.some(n=>/Alosztó betáp/.test(n)));
  // ---- 3. cabinet, checks, entry points ----
  const sch=w.eloSchedule(al2.id),schM=w.eloSchedule(main.id);
  ok('the Alosztó cabinet: no main switch, SPD type 2, no bell',!sch.feed.some(f=>/Főkapcsoló/.test(f.n))&&sch.feed.some(f=>/T2/.test(f.n))&&!sch.feed.some(f=>/csengő/.test(f.n)));
  ok('the Alosztó ways are plain MCBs (the floor RCD is the feeder’s)',sch.ways.length>0&&sch.ways.every(x=>/^MCB /.test(x.device)));
  const fw=schM.ways.find(x=>x.feeds.indexOf(ep2.id)>=0);
  ok('the main cabinet: the feeder way starts with its own RCD (4P 30 mA) + MCB 3C 25A, 7 modules',!!fw&&fw.feeder&&/^RCD 4P 25A 30 mA A \+ MCB 3C 25A$/.test(fw.device)&&fw.mod===7,fw&&fw.device);
  ok('the main switch stays in the main Elosztó only',schM.feed.some(f=>/Főkapcsoló/.test(f.n))&&schM.feed.some(f=>/T1\+T2/.test(f.n)));
  ok('the feeder’s load is the floor’s (its ways × 0,6)',Math.abs(fw.kw-w.alsFloorKw(al2.id)*0.6)<0.01&&fw.kw>0);
  const sug=ru.notes.find(n=>/^Betáp-javaslat/.test(n)),sg=w.alsSuggest(al2.id,frow.Lm,Math.max(...ru.R.checks.map(r=>r.dU-r.dUup)));
  ok('a suggested feeder is shown upstairs (Q1 C), from the floor load and the drop figures',!!sug&&sg.In>=16&&sg.mm2===6&&sg.same&&/a mostani megfelel/.test(sug),sug);
  ok('a long feeder on a heavy floor suggests a larger cross-section',(x=>x.mm2>6||x.In>25)(w.alsSuggest(al2.id,80,3.2)));
  const checks=()=>w.eval('STK_CHECKS')['sys:DED'].map(f=>{try{return f(w.stkActive()||{id:null})||[];}catch(_){return [];}}).flat();
  ok('no Alosztó warnings on a sound plan',!checks().some(c=>/^als\./.test(c.code||'')&&c.sev==='warn'),JSON.stringify(checks().filter(c=>/^als/.test(c.code||''))));
  const c0=w.cktList().find(c=>c.members.indexOf(us.id)>=0);c0.members.push(gs.id);
  ok('a circuit with end points on two levels is flagged',checks().some(c=>c.code==='als.span'));
  c0.members.pop();
  const keepEp=al2.feedEp;delete al2.feedEp;ok('an Alosztó without its feed point is flagged',checks().some(c=>c.code==='als.feed'));al2.feedEp=keepEp;
  ok('the phase-4 button and the action exist',!!w.document.querySelector('#phBody .phGrid[data-ph="vill"] .tool[data-a="wf.subBoard"]')&&!!w.actionById('wf.subBoard'));
  const items=[];w.eval('STK_DEVMENU').forEach(f=>f(D.devices.indexOf(al2),items));const k=items.find(i=>/Alosztó kivitele/.test(i.label));
  ok('the Alosztó menu: kivitel szekrény ↔ DIN-sínes RBX, and its feed point',!!k&&items.some(i=>/Betáp-pont/.test(i.label)));
  k.act();ok('kivitel switches to DIN-sínes RBX',al2.subKind==='rbx');
  ok('the menu offers the suggested feeder',items.some(i=>/Betáp-javaslat/.test(i.label)));
  // ---- 4. chained (Q4 B): main in the basement → ground Alosztó → upper Alosztó ----
  w.hardResetWorkspace();const D2=w.__data,W2=w.__getWalls();['ground','upper','basement'].forEach(l=>W2[l].length=0);
  D2.floors.length=0;D2.devices.length=0;D2.circuits=[];D2.paths.length=0;D2.openings.length=0;D2.marks=[];
  const walls2=(l,p)=>W2[l].push({x0:-100,y0:-100,x1:8100,y1:0,id:p+'1'},{x0:-100,y0:0,x1:0,y1:3000,id:p+'2'},{x0:8000,y0:0,x1:8100,y1:3000,id:p+'4'},{x0:-100,y0:3000,x1:8100,y1:3100,id:p+'5'});
  [['basement','B'],['ground','G'],['upper','U']].forEach(([l,p])=>{walls2(l,p);D2.floors.push({level:l,poly:[[0,0],[8000,0],[8000,3000],[0,3000]],name:p,kinds:['nappali'],kind:'nappali',num:p+'R',layer:'L0'});
    [p+'1',p+'2'].forEach(x=>D2.marks.push({kind:'wall',wall:x,level:l,tags:['vezetheto'],pol:'plus',layer:'L0'}));
    D2.devices.push({type:w.epTypeFor('SOC'),code:'SOC',level:l,x:6000,y:0,h:300,layer:'L0'});});
  w.ensureIds(D2);const m3=w.jbPlace('board',{level:'basement',x:1000,y:0,side:1});
  const g3=w.jbPlace('board',{level:'ground',x:1500,y:0,side:1,sub:true}),u3=w.jbPlace('board',{level:'upper',x:2500,y:0,side:1,sub:true});
  const ge=w.byId('devices',g3.feedEp),ue=w.byId('devices',u3.feedEp);
  ok('ground Alosztó fed from the basement Elosztó',g3.sub&&ge.level==='basement'&&w.cktOfDevice(ge).board===m3.id);
  ok('upstairs Alosztó fed from the ground Alosztó, not the main (chained)',u3.sub&&ue.level==='ground'&&ue.x===2500&&w.cktOfDevice(ue).board===g3.id);
  [m3,g3,u3].forEach(b=>w.elpApply(w.elpSuggest(b.id)));
  const rB=w.blRun('basement'),rG=w.blRun('ground'),rU=w.blRun('upper');
  ok('all three levels run',!rB.err&&!rG.err&&!rU.err,[rB.err,rG.err,rU.err].join('|'));
  const fG=rG.R.checks.find(r=>r.circ===w.cktOfDevice(ue).ref);
  ok('the ground run routes the upstairs feeder from the ground Alosztó',!!fG&&rG.R.legs.some(l=>l.kind==='drop'&&l.dev===ue.id));
  ok('drops add up along the chain: upstairs carries the ground feeder’s total (which carries the basement feeder’s)',!!fG&&fG.dUup===rG.cfg.upstreamDropPct&&rU.cfg.upstreamDropPct===fG.dU&&fG.dU>fG.dUup);
  ok('the ground Alosztó cabinet carries the upstairs feeder with its own RCD',(x=>!!x&&x.feeder&&/^RCD 4P/.test(x.device))(w.eloSchedule(g3.id).ways.find(x=>x.feeds.indexOf(ue.id)>=0)));
  // a basement Alosztó under a ground-floor main is fed from above: its feed comes down through the slab
  w.hardResetWorkspace();const D3=w.__data,W3=w.__getWalls();['ground','upper','basement'].forEach(l=>W3[l].length=0);D3.floors.length=0;D3.devices.length=0;D3.circuits=[];D3.marks=[];D3.openings.length=0;D3.paths.length=0;
  [['basement','B'],['ground','G']].forEach(([l,p])=>walls2(l,p));       // WALLS is one object: walls2 writes the fresh arrays
  [['basement','B'],['ground','G']].forEach(([l,p])=>{D3.floors.push({level:l,poly:[[0,0],[8000,0],[8000,3000],[0,3000]],name:p,kinds:['nappali'],kind:'nappali',num:p+'R',layer:'L0'});
    [p+'1',p+'2'].forEach(x=>D3.marks.push({kind:'wall',wall:x,level:l,tags:['vezetheto'],pol:'plus',layer:'L0'}));D3.devices.push({type:w.epTypeFor('SOC'),code:'SOC',level:l,x:6000,y:0,h:300,layer:'L0'});});
  w.ensureIds(D3);w.jbPlace('board',{level:'ground',x:1000,y:0,side:1});const b3=w.jbPlace('board',{level:'basement',x:1500,y:0,side:1,sub:true}),be=w.byId('devices',b3.feedEp);
  ok('a basement Alosztó is fed from the ground floor above (feed point low, h 300)',b3.sub&&be.level==='ground'&&be.h===300);
  const rb=w.blRun('basement'),fb=!rb.err&&rb.R.legs.find(l=>l.kind==='feed');
  ok('its feed leg comes down through the slab',!!fb&&fb.poly[0][2]>rb.R.W.trunk&&rb.cfg.subFeed.fromAbove===true,rb.err||'');
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
