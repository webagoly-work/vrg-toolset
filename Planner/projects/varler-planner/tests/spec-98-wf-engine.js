// Workflow round WP-E5 — the Erősáram engine (tools/baseline) bundled into the Planner (src/08ob-wf-engine.js, build.js).
// 1. the bundle is the CLI engine (same tables; on the P33 v1 sketch — client data, only when present — the same plan);
// 2. blInput on a 2-room fixture: the routable walls are its Vezethető fal marks only (Q7); redőny left out; lighting by
//    preset; Padló út → floor group, a wall-to-wall Mennyezeti út → ceiling link (Q9);
// 3. Pályák kiszámítása writes gen:'bl' paths + boxes; a re-run replaces only those, a hand-drawn path stays; one undo;
// 4. Vezetékek: scope Helyiség wires only that room's legs, Ház all; a changed plan is refused until Pályák runs again.
// (After the undo the data arrays are new objects: devices are looked up by id from there on.)
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const BLD=path.join(__dirname,'..','tools','baseline');
const P33=path.join(__dirname,'..','..','..','..','Calculator','P33-baseline','v1_2026-10-12','P33_teszt_v1_m_solat.vplan(3).json');
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  // ---- 1. the bundle is the CLI engine ----
  const BL=w.BL;ok('BL carries the five engine modules',BL&&['rules','geom','network','prep','plan'].every(k=>BL[k])&&typeof BL.plan.plan==='function');
  const RU=require(path.join(BLD,'rules.js'));
  ok('the same tables as the CLI (IZ, groupK, VDROP, PORTAL_SLOTS)',JSON.stringify(BL.rules.IZ)===JSON.stringify(RU.IZ)&&BL.rules.groupK(16)===RU.groupK(16)
    &&JSON.stringify(BL.rules.VDROP)===JSON.stringify(RU.VDROP)&&JSON.stringify(BL.rules.PORTAL_SLOTS)===JSON.stringify(RU.PORTAL_SLOTS));
  if(fs.existsSync(P33)){
    const raw=fs.readFileSync(P33,'utf8'),cfg0=JSON.stringify(require(path.join(BLD,'p33.config.js')));
    const pipe=(E5,doc,cfg)=>{E5.prep.applyEdits(doc,cfg);const G=E5.geom.load(doc,cfg.level);const {allowed}=E5.geom.allowedFromSketch(G,G.D.paths);
      (cfg.allowExtra||[]).forEach(a=>(allowed[a.wall]=allowed[a.wall]||[]).push(a.iv));
      const E=E5.prep.endpoints(G,cfg);E5.prep.applyHeights(E);const PT=E5.prep.portals(G,E);E5.prep.portalMembers(G,PT,E);E5.prep.placeInPortals(G,PT,E);
      const r=E5.plan.plan(G,E,PT,cfg,allowed);
      return JSON.stringify({c:r.C.list.map(c=>c.ref+':'+c.members.length),b:r.boxes.map(b=>[b.id,b.kind,Math.round(b.x),Math.round(b.y),b.h]),
        l:r.legs.map(l=>[l.id,l.kind,l.from,l.to,l.len,l.cond]),k:r.checks,wn:r.warn.map(x=>x.msg)});};
    const node={geom:require(path.join(BLD,'geom.js')),prep:require(path.join(BLD,'prep.js')),plan:require(path.join(BLD,'plan.js'))};
    const a=pipe(node,JSON.parse(raw),JSON.parse(cfg0)),b=pipe(BL,w.JSON.parse(raw),w.JSON.parse(cfg0));
    ok('P33 v1: the bundled engine gives the CLI plan exactly (circuits, boxes, legs, checks, warnings)',a===b&&a.length>1000,a.length+' vs '+b.length);
  }else ok('P33 v1 sketch not on this machine — parity check skipped (client data)',true);

  // ---- 2. the fixture: room A (board, socket) | door | room B (socket, switch → lamp, redőny) ----
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  WL.ground.push({x0:-100,y0:-100,x1:8100,y1:0,id:'W1'},{x0:-100,y0:0,x1:0,y1:3000,id:'W2'},{x0:4000,y0:0,x1:4100,y1:3000,id:'W3'},
    {x0:8000,y0:0,x1:8100,y1:3000,id:'W4'},{x0:-100,y0:3000,x1:8100,y1:3100,id:'W5'});
  D.floors.length=0;D.devices.length=0;D.circuits=[];D.paths.length=0;D.openings.length=0;D.marks=[];
  D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali',kinds:['nappali'],kind:'nappali',num:'RA',layer:'L0'},
    {level:'ground',poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'Háló',kinds:['halo'],kind:'halo',num:'RB',layer:'L0'});
  D.openings.push({type:'door',level:'ground',x:4050,y:1500,w:900});
  const mk=(kind,wall,tag,pol)=>D.marks.push({kind,wall,level:'ground',tags:[tag],pol,layer:'L0'});
  mk('wall','W1','vezetheto','plus');mk('wall','W3','vezetheto','plus');mk('side','W5','lforma','plus');D.marks[2].side=1;
  const dev=(code,x,y,h,o)=>{const d=Object.assign({type:w.epTypeFor(code),code,level:'ground',x,y,h,layer:'L0'},o||{});D.devices.push(d);return d;};
  D.devices.push({type:'board',level:'ground',x:1000,y:60,h:1600,layer:'L0'});
  const sA=dev('SOC',2500,0,300),sB=dev('SOC',6500,0,300),lamp=dev('LMP',6000,1500,2700),shu=dev('SHU',7500,0,2400);
  w.ensureIds(D);const sw=dev('SWI',4100,800,1100,{ctl:[lamp.id]});w.ensureIds(D);
  const cA=w.cktCreate({name:'Dugalj',mcb:{curve:'C',amps:16,poles:1,n:false},members:[sA.id,sB.id]});
  const cV=w.cktCreate({name:'Világítás',mcb:{curve:'B',amps:10,poles:1,n:false},members:[lamp.id,sw.id,shu.id]});cV.ref='V1';cV.preset='vil';
  // a Padló út to room A's socket from the door, and a wall-to-wall ceiling crossing in room B
  D.marks.push({kind:'cline',plane:'floor',level:'ground',pts:[[3990,1500],[2500,1500],[2500,10]],to:sA.id,from:{door:D.openings[0].id},h:0,tags:['padlo-ut'],pol:'plus',layer:'L0'});
  D.marks.push({kind:'cline',level:'ground',pts:[[4150,2600],[7950,2600]],from:{wall:'W3',u:2600},toWall:{wall:'W4',u:2600},cross:true,h:2700,tags:['mennyezet-ut'],pol:'plus',layer:'L0'});
  w.ensureIds(D);
  const I=w.blInput('ground');const G=BL.geom.load(I.doc,'ground'),al=BL.geom.allowedFromSketch(G,[]).allowed;
  ok('routable walls = the Vezethető fal marks only (W1, W3) — the L-forma side on W5 opens nothing',JSON.stringify(Object.keys(al).sort())==='["W1","W3"]',JSON.stringify(Object.keys(al)));
  ok('mark intervals are exact (no PAD)',al.W1[0][2]===true);
  ok('the redőny endpoint is left out, with a note',I.notes.some(n=>/redőny/.test(n))&&I.doc.project.data.devices.find(d=>d.id===shu.id).layer==='bl:off'&&I.doc.project.data.circuits.find(c=>c.ref==='V1').members.indexOf(shu.id)<0);
  ok('lighting circuit read as lighting, the breaker as text',(c=>c.kind==='light'&&c.mcb==='1B 10A')(I.doc.project.data.circuits.find(c=>c.ref==='V1'))&&I.doc.project.data.circuits.find(c=>c.ref===cA.ref).mcb==='1C 16A');
  ok('heights stay as placed (hFix)',I.doc.project.data.devices.filter(d=>d.layer==='bl:mains').every(d=>d.hFix));
  ok('Padló út → one floor group from the door',I.cfg.floorGroups.length===1&&I.cfg.floorGroups[0].sp===D.openings[0].id&&I.cfg.floorGroups[0].members[0]===sA.id);
  ok('Mennyezeti út wall → wall → one ceiling link; an end lands beyond its wall (room A), an outside wall keeps the inner room (Q9)',I.cfg.ceilLinks.length===1&&I.cfg.ceilLinks[0].aRoom==='RA'&&I.cfg.ceilLinks[0].bRoom==='RB',JSON.stringify(I.cfg.ceilLinks));
  ok('switching from sw.ctl: the switch → lamp link is an explicit group',I.cfg.switchGroups.length===1&&I.cfg.switchGroups[0].chain[0]===sw.id&&I.cfg.switchGroups[0].lamps[0]===lamp.id&&I.cfg.switchGroups[0].mode==='single');
  ok('run heights from the ceiling (Q3): 2700 → trunk 2450, distribution 2300',(r=>r.trunk===2450&&r.dist===2300)(BL.rules.runHeights(Object.assign({},I.cfg,{ceiling:2700,trunkH:null,distH:null}))));

  // switch groups from the Planner's own switching (E1): shared leg = váltó / kereszt, two legs on one switch = csillár
  const sd=(id,code,x,y,o)=>Object.assign({id,code,layer:'bl:mains',level:'ground',x,y},o||{});
  const SG=w.blSwitchGroups({devices:[sd('s1','SWI',0,0,{ctl:['l1'],swType:'106'}),sd('s2','SWI',5000,0,{ctl:['l1'],swType:'106'}),sd('s4','SWI',2500,0,{ctl:['l1'],swType:'107'}),
    sd('l1','LMP',4000,500),sd('s3','SWI',0,3000,{ctl:['l2','l3']}),sd('l2','LMP',500,3000),sd('l3','LMP',900,3000),
    sd('s5','SWI',0,6000,{ctl:['l4']}),sd('l4','LMP',500,6000,{grp:'G1'}),sd('l5','LMP',900,6000,{grp:'G1'})]},'ground');
  const sg=id=>SG.find(g=>g.chain.indexOf(id)>=0);
  ok('three switches on one leg = 3way, kereszt in the middle, the end nearest the lamp first',sg('s1').mode==='3way'&&JSON.stringify(sg('s1').chain)==='["s2","s4","s1"]',JSON.stringify(sg('s1')));
  ok('one switch, two legs = csillár (double); a grouped leg brings its whole group (single)',sg('s3').mode==='double'&&sg('s3').lamps.length===2&&sg('s5').mode==='single'&&sg('s5').lamps.length===2);
  // Padló út lines from one start to one junction share a group (the island); RBX-switched lamps are passed on
  const isl=[[3990,2500],[3000,2500],[3000,2000]];
  D.marks=D.marks.filter(m=>m.plane!=='floor');
  D.marks.push({kind:'cline',plane:'floor',level:'ground',pts:isl.concat([[2500,1800]]),to:sA.id,from:{door:D.openings[0].id},h:0,boxH:600,tags:['padlo-ut'],pol:'plus',layer:'L0'});
  const sA2=dev('SOC',3300,1800,750);w.ensureIds(D);w.cktAssign(cA,sA2);
  D.marks.push({kind:'cline',plane:'floor',level:'ground',pts:isl.concat([[3300,1800]]),to:sA2.id,from:{door:D.openings[0].id},h:0,boxH:600,tags:['padlo-ut'],pol:'plus',layer:'L0'});
  lamp.rbxSw=true;sB.side=0;w.ensureIds(D);
  const I2=w.blInput('ground'),g2=I2.cfg.floorGroups;
  ok('two Padló út lines to one junction = one floor group, its box at the last bend, at boxH',g2.length===1&&g2[0].members.length===2&&g2[0].box.x===3000&&g2[0].box.y===2000&&g2[0].box.h===600,JSON.stringify(g2));
  ok('an RBX-switched lamp is passed on as such (no switch guessed)',I2.cfg.rbxSwitched[lamp.id]!=null);
  delete lamp.rbxSw;
  ok('a wall device faces the room the Planner gives it (fixFace)',I2.cfg.fixFace[sB.id]==='RB',JSON.stringify(I2.cfg.fixFace));
  // ---- 3. Pályák ----
  const run=w.blRun('ground');ok('the engine runs on the fixture',!run.err&&run.R&&run.R.C.list.length===2,run.err||'');
  const RR=run.R||{legs:[],boxes:[]};
  ok('a trunk leg from the Elosztó and room legs',RR.legs.some(l=>l.kind==='trunk'&&l.from==='Elosztó')&&RR.legs.some(l=>l.kind==='drop'));
  ok('the floor leg follows the Padló út (down at the box, along the line, up at the junction)',(l=>l&&l.line&&l.poly.some(p=>p[0]===3000&&p[1]===2500&&p[2]===0)&&l.poly[l.poly.length-1][2]===600)(RR.legs.find(l=>l.kind==='floor')));
  ok('then a short leg from the junction to each socket',RR.legs.filter(l=>l.kind==='island').length===2);
  ok('the capacity / voltage-drop checks come back per circuit',(RR.checks||[]).length===2&&RR.checks.every(r=>'okI' in r&&'dU' in r));
  D.paths.push({ptype:'gege',nodes:[{level:'ground',x:100,y:100},{level:'ground',x:900,y:100}],sections:[{build:'sull_gege'}],layer:'L0'});w.ensureIds(D);const hand=D.paths[D.paths.length-1];
  const nPipes=RR.legs.reduce((a,l)=>a+(l.pipes||[]).length,0),nBox=RR.boxes.filter(b=>b.kind!=='rbx').length;
  const r1=w.blApplyRoutes(run);
  ok('one path per pipe and one junction per box, all gen:bl',r1.paths===nPipes&&D.paths.filter(p=>p.gen==='bl').length===nPipes&&D.devices.filter(d=>d.gen==='bl'&&d.type==='junction').length===nBox,JSON.stringify(r1));
  ok('the trunk is a channel route, the rest ARM',D.paths.filter(p=>p.gen==='bl').every(p=>p.route===(p.bl.kind==='trunk'?'channel':'arm')));
  const r2=w.blApplyRoutes(w.blRun('ground'));
  ok('a re-run replaces only gen:bl items — same count, the hand path stays',r2.replaced===nPipes+nBox&&D.paths.filter(p=>p.gen==='bl').length===nPipes&&D.paths.indexOf(hand)>=0);
  w.doUndo();ok('one undo goes back to the first run',D.paths.filter(p=>p.gen==='bl').length===nPipes&&D.paths.some(p=>p.id===hand.id));

  // ---- 4. Vezetékek ----
  const run2=w.blRun('ground');let res=w.blApplyWires(run2,'room','RB');
  const wired=()=>w.__data.paths.filter(p=>p.gen==='bl'&&p.bl.wired);
  const roomLegs=w.blScopeLegs(run2,'room','RB').map(l=>l.id);
  ok('scope Helyiség: only room B legs get cables',!res.err&&res.paths>0&&wired().every(p=>roomLegs.indexOf(p.bl.leg)>=0)&&wired().length<w.__data.paths.filter(p=>p.gen==='bl').length,JSON.stringify(res));
  ok('room A’s socket drop is not wired by the room-B run',!w.__data.paths.some(p=>p.gen==='bl'&&p.bl.wired&&p.bl.kind==='drop'&&run2.R.legs.find(l=>l.id===p.bl.leg).dev===sA.id));
  ok('cable text on the sections (NYM-J …)',wired().every(p=>p.sections.every(s=>/NYM-J/.test(s.cables||''))));
  res=w.blApplyWires(run2,'haz');ok('scope Ház: every pipe, with metres per cable type',!res.err&&wired().length===w.__data.paths.filter(p=>p.gen==='bl').length&&res.metres.length>0,JSON.stringify(res));
  const devLegs=w.blScopeLegs(run2,'dev',sB.id);ok('scope Eszköz: the socket’s own drop and its circuit’s trunk',devLegs.some(l=>l.dev===sB.id)&&devLegs.some(l=>l.kind==='trunk')&&!devLegs.some(l=>l.dev===sA.id));
  const sBl=()=>w.byId('devices',sB.id);sBl().x+=50;res=w.blApplyWires(w.blRun('ground'),'haz');ok('a changed plan is refused until Pályák runs again',!!res.err&&/változott/.test(res.err));

  // ---- 5. entry points ----
  ok('the phase Pályák has both buttons',!!w.document.querySelector('#phBody .phGrid[data-ph="paly"] .tool[data-a="bl.routes"]')&&!!w.document.querySelector('#phBody .phGrid[data-ph="paly"] .tool[data-a="bl.wires"]'));
  sBl().x-=50;w.runAction('bl.routes');const mt=w.document.getElementById('modal').textContent;
  ok('the action opens the result with the summary and the checks table',/Pályák kiszámítása/.test(mt)&&/kör · /.test(mt)&&!!w.document.querySelector('.blChk')&&!!w.document.getElementById('blCornerAll'));
  w.closeModal();
  D.marks=D.marks.filter(m=>!(m.tags||[]).includes('vezetheto'));const e=w.blRun('ground');ok('no Vezethető fal → a clear message, no crash',!!e.err&&/vezethető fal/i.test(e.err));

  // ---- 6. P33 acceptance (E5-Q12 = C, step A; client data, only when present) ----
  // p33.config's answers → Planner data (to-planner.js) → the Planner's engine == the CLI run with the same exclusions
  // (no shutter switches / motors, floorLinks, risers, prepared routes, spBoxSize — not in the Planner yet)
  if(fs.existsSync(P33)){const cfgP=()=>JSON.parse(JSON.stringify(require(path.join(BLD,'p33.config.js'))));
    const conv=require(path.join(BLD,'to-planner.js')).convert(JSON.parse(fs.readFileSync(P33,'utf8')),cfgP()).doc;
    w.applyProjectData(w.JSON.parse(JSON.stringify(conv.project)));w.__state.active='ground';w.BL_OPT.cornerAll=true;const cg=w.BL_OPT.congest;w.BL_OPT.congest=0;const pr=w.blRun('ground');w.BL_OPT.cornerAll=false;w.BL_OPT.congest=cg;   // the CLI has no congestion term
    const node={geom:require(path.join(BLD,'geom.js')),prep:require(path.join(BLD,'prep.js')),plan:require(path.join(BLD,'plan.js'))};
    const cfg=cfgP(),doc=JSON.parse(fs.readFileSync(P33,'utf8'));node.prep.applyEdits(doc,cfg);Object.assign(cfg,{shutterSwitch:false,floorLinks:[],risers:[],prepared:[]});delete cfg.spBoxSize;
    const DD=doc.project.data,shu=new Set(DD.devices.filter(d=>d.code==='SHU').map(d=>d.id));DD.devices=DD.devices.filter(d=>!shu.has(d.id));DD.circuits.forEach(c=>c.members=c.members.filter(id=>!shu.has(id)));
    const G=node.geom.load(doc,cfg.level),al2=node.geom.allowedFromSketch(G,G.D.paths).allowed;(cfg.allowExtra||[]).forEach(a=>(al2[a.wall]=al2[a.wall]||[]).push(a.iv));
    const E=node.prep.endpoints(G,cfg);node.prep.applyHeights(E);const PT=node.prep.portals(G,E);node.prep.portalMembers(G,PT,E);node.prep.placeInPortals(G,PT,E);const cr=node.plan.plan(G,E,PT,cfg,al2);
    const legSig=R=>R.legs.map(l=>{const a=l.poly[0],z=l.poly[l.poly.length-1];return [l.kind,Math.round(a[0]/10),Math.round(a[1]/10),Math.round(z[0]/10),Math.round(z[1]/10),Math.round(l.len/10),l.cond].join('|');}).sort().join(';');
    const boxSig=R=>R.boxes.map(b=>[b.kind,Math.round(b.x/10),Math.round(b.y/10),b.h].join('|')).sort().join(';');
    ok('P33 acceptance: the converted plan runs in the Planner (16 circuits)',!pr.err&&pr.R.C.list.length===16,pr.err||'');
    ok('P33 acceptance: every leg identical to the CLI ('+cr.legs.length+')',!pr.err&&legSig(pr.R)===legSig(cr));
    ok('P33 acceptance: every box identical ('+cr.boxes.length+')',!pr.err&&boxSig(pr.R)===boxSig(cr));
    ok('P33 acceptance: the same checks',!pr.err&&JSON.stringify(pr.R.checks)===JSON.stringify(cr.checks));
  }else ok('P33 acceptance skipped — client data not on this machine',true);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
