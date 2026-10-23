// Round 2026-10-18 WP-C7 — the cinema wiring list + the CINEMA family (src/08rb-cinema-wire.js), the cabinet's AV group
// (05x) and the engine leaving the AV circuits to the cinema (08ob).
// 1. the guide's rules: §5.2 fill (53 / 31 / 40 %, the HDMI head → Ø40), §6.1 speaker section; 2. a routed room → the
// list, the pipes in the paths (CINEMA + a separate MAINS), the runs; 3. §5.5 separation; 4. the cabinet; 5. the engine.
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
  // ---- 1. the rules ----
  ok('the CINEMA family exists, signal class',w.AFILL_FAMS.CINEMA&&w.AFILL_FAMS.CINEMA.cls==='sig');
  const s1=w.cinWSize([{c:'SPK2x25',n:1}]);
  ok('§5.2 one speaker cable (Ø7.5) at 53 % → M16 (ID 10.7: 49 %)',s1.size==='M16'&&/53 %/.test(s1.why),s1.why);
  const s2=w.cinWSize([{c:'CAT6A_U',n:1},{c:'TRIG2x075',n:1}]);
  ok('§5.2 two cables at 31 %: M20 would be 44 % → M25',s2.size==='M25'&&/31 %/.test(s2.why),s2.why);
  const s3=w.cinWSize([{c:'AOC_FIX',n:1},{c:'CAT6A_U',n:1},{c:'SPARE',n:1}],'M40');
  ok('§5.1 the projector: an HDMI head → Ø40 whatever the fill; the spare pipe has no area',s3.size==='M40'&&s3.fill<0.2,s3.why);
  const k=[10,20,30].map(l=>[w.cinWSpk(l,8).mm2,w.cinWSpk(l,4).mm2].join('/')).join(' ');
  ok('§6.1 the table: ≤10 m 1.5 / 2.5 · 10–20 m 2.5 / 4 · 20–30 m 4 / 6 (8 Ω / 4 Ω)',k==='1.5/2.5 2.5/4 4/6',k);
  ok('§6.1 beyond 6 mm² is flagged',w.cinWSpk(40,4).over===true);
  // ---- 2. a routed room (the spec-104 C6 layout + subs, projector, screen, keypad) ----
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state;st.active='ground';st.exploded=false;
  const D=w.__data,WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  WL.ground.push({x0:-100,y0:-100,x1:9100,y1:0,id:'W1'},{x0:-100,y0:5000,x1:9100,y1:5100,id:'W2'},{x0:-100,y0:0,x1:0,y1:5000,id:'W3'},
    {x0:6000,y0:0,x1:6100,y1:5000,id:'W4'},{x0:9000,y0:0,x1:9100,y1:5000,id:'W5'});
  D.floors.length=0;D.openings.length=0;D.marks=[];D.paths.length=0;D.devices.length=0;
  const A={level:'ground',poly:[[0,0],[6000,0],[6000,5000],[0,5000]],name:'Mozi',kind:'nappali',layer:'L0'},B={level:'ground',poly:[[6100,0],[9000,0],[9000,5000],[6100,5000]],name:'Előtér',layer:'L0'};
  D.floors.push(A,B);w.ensureIds(D);
  const CL=w.cinLayerAdd();CL.cinema={room:A.id,level:'ground',side:'y0',xScr:300,zone:{L:5000,W:6000,off:0},suggest:true,fmt:'5.1',disp:'pj',hEye:1150,theta:40};
  st.activeLayer=CL.id;
  const mk=(code,x,y,h,mount)=>{const d=w.epMake({level:'ground',x,y,h,mount:mount||'wall'},code,'sys:CINEMA');D.devices.push(d);return d;};
  const rk=w.cinSpotList(CL).find(p=>p.code==='CRK');
  const rack=mk('CRK',rk.x,rk.y,300),fl=mk('CLR',1700,50,1150),fr=mk('CLR',4300,50,1150),ls=mk('CSR',50,3500,1750),
    sw1=mk('CSW',50,2500,0,'floor'),sw2=mk('CSW',5950,2500,0,'floor'),pj=mk('CPJ',3000,2800,2500,'ceiling'),sc=mk('CSC',3000,400,2600,'ceiling'),kp=mk('CKP',5950,4500,1100);
  w.ensureIds(D);
  ok('the node catalogue: speaker / LFE / AOC / Cat6A / trigger signals are CINEMA, the 230 V MAINS',
    ['CLR','CSR','CBK','CSW','CPJ','CSC','CTV','CKP'].every(c=>w.epEntry(c,'sys:CINEMA').vars[0].cab.every(x=>x.fam==='CINEMA'||x.fam==='MAINS')),'');
  const face=(id,toward,u0,u1)=>{const r=w.mrkWallById('ground',id);const p1=w.mrkFacePt(r,1,10,0),p2=w.mrkFacePt(r,-1,10,0);
    const side=Math.hypot(p1[0]-toward[0],p1[1]-toward[1])<Math.hypot(p2[0]-toward[0],p2[1]-toward[1])?1:-1;
    D.marks.push({kind:'vstrip',level:'ground',wall:id,side,u0:u0||0,u1:u1||w.mrkWallLen(r),pol:'plus',tags:['mozi'],layer:'L0'});};
  face('W2',[3000,2500],0,6100);face('W3',[3000,2500]);face('W1',[3000,2500],0,6100);face('W4',[3000,2500]);face('W4',[7500,2500]);
  D.marks.push({kind:'wall',level:'ground',wall:'W1',tags:['vezetheto'],pol:'plus',layer:'L0'});
  const board={type:'board',level:'ground',x:8000,y:50,h:1600,layer:'L0'};D.devices.push(board);w.ensureIds(D);
  const res=w.cinRouteAll(CL,{circuits:3,useGeneral:true});
  ok('the C6 run reaches everything (3 AV circuits)',res.ded===3&&!res.miss.length,JSON.stringify(res));
  const W=w.cinWiring(CL);
  ok('one row per node (9 − the rack = 8), the rack as the feed row',W.rows.length===8&&W.feed&&W.feed.dev===rack.id&&W.feed.path);
  const row=id=>W.rows.find(r=>r.dev===id);
  ok('every speaker row carries the SAME section (§6.1), chosen by the longest speaker run',[fl,fr,ls].every(d=>row(d.id).sig.cables[0].c===W.spk.cable)&&W.spk.mm2>=1.5);
  ok('the sub: LFE coax ≥ M25 + 230 V on AV-2 in its own pipe',row(sw1.id).sig.cables[0].c==='LFE'&&w.AFILL_CONDUITS.findIndex(c=>c.k===row(sw1.id).sig.size)>=2&&row(sw1.id).mains.ckt==='AV-2');
  ok('the projector: AOC + Cat6A + spare in Ø40, 230 V on AV-3',row(pj.id).sig.size==='M40'&&row(pj.id).sig.cables.length===3&&row(pj.id).mains.ckt==='AV-3');
  ok('the screen: trigger pair + Cat6A (§6.3), 230 V on AV-3; the keypad: Cat6A only',row(sc.id).sig.cables.map(c=>c.c).join()==='TRIG2x075,CAT6A_U'&&row(sc.id).mains.ckt==='AV-3'&&!row(kp.id).mains);
  ok('the feed: 3 × NYM-J 3×2,5 (AV-1 + AV-2 + AV-3), ≥ M25',W.feed.mains.cables[0].n===3&&W.feed.mains.ckt==='AV-1 + AV-2 + AV-3'&&w.AFILL_CONDUITS.findIndex(c=>c.k===W.feed.mains.size)>=2);
  ok('lengths: path + 2 × 500 mm',row(fl.id).len===Math.round(w.cinWPathLen(w.pathById(row(fl.id).path))+1000));
  // pipes were written by the C6 run (same undo step)
  const pp=w.pathById(row(pj.id).path),cont=pp.sections[0].cont;
  ok('the projector path carries a CINEMA pipe and a separate MAINS pipe (src cin:<layer>)',cont&&cont.auto.length===2&&cont.auto.some(a=>a.fam==='CINEMA'&&a.size==='M40')&&cont.auto.some(a=>a.fam==='MAINS')&&cont.auto.every(a=>a.src==='cin:'+CL.id));
  const runs=w.afillRuns().filter(r=>r.stage==='cinema');
  ok('the runs: stage cinema, the spare is not a run',runs.length>0&&runs.every(r=>r.layer===CL.id&&r.cable.c!=='SPARE')&&runs.some(r=>r.fam==='MAINS'&&r.from===rack.id&&r.cable.n===3));
  const nr=runs.length;w.cinWApply(CL);
  ok('a re-apply replaces, never doubles (runs and pipes)',w.afillRuns().filter(r=>r.stage==='cinema').length===nr&&w.pathById(row(pj.id).path).sections[0].cont.auto.length===2);
  CL.cinema.zMin=8;const W8=w.cinWiring(CL);
  ok('Z_min 8 Ω never needs a thicker speaker cable than 4 Ω',W8.spk.mm2<=W.spk.mm2);
  // ---- 3. §5.5 separation ----
  ok('no Erősáram path → no separation note',!w.cinSepChecks(CL).length);
  const fp=w.pathById(row(fl.id).path),seg=fp.nodes.slice(1).map((n,i)=>[fp.nodes[i],n]).find(s=>Math.hypot(s[1].x-s[0].x,s[1].y-s[0].y)>=1500);
  const mp={ptype:'gege',level:'ground',layer:'L0',nodes:[{level:'ground',x:seg[0].x,y:seg[0].y+150,h:seg[0].h},{level:'ground',x:seg[1].x,y:seg[1].y+150,h:seg[1].h}],sections:[{build:'sull_gege'}]};
  D.paths.push(mp);w.ensureIds(D);
  const sep=w.cinSepChecks(CL);
  ok('§5.5 a mains path 150 mm beside an unscreened speaker run → an info note (300 mm)',sep.some(x=>x.ref===fl.id&&x.sev==='info'&&/300 mm/.test(x.msg)),JSON.stringify(sep.map(x=>x.msg)));
  ok('…the parallel test: 90° crossing does not count',w.cinSepPair({level:'ground',a:{x:0,y:0},b:{x:2000,y:0},h:2400},{level:'ground',a:{x:1000,y:-1000},b:{x:1000,y:1000},h:2400},300)===0);
  ok('…a screened LFE run only needs 150 mm',w.cinSepPair({level:'ground',a:{x:0,y:0},b:{x:2000,y:0},h:0},{level:'ground',a:{x:0,y:200},b:{x:2000,y:200},h:0},150)===0
    &&w.cinSepPair({level:'ground',a:{x:0,y:0},b:{x:2000,y:0},h:0},{level:'ground',a:{x:0,y:200},b:{x:2000,y:200},h:0},300)===2000);
  D.paths.splice(D.paths.indexOf(mp),1);
  // ---- 4. the cabinet ----
  const S3=w.eloSchedule(board.id,{phase:'3f',perWay:'rcbo'}),av=S3.ways.filter(x=>x.kind==='av');
  ok('the cabinet lists the 3 AV circuits as their own group (B16 / C16 / B16)',av.length===3&&av.map(x=>x.mcb).join()==='1B 16A,1C 16A,1B 16A',JSON.stringify(av.map(x=>x.mcb)));
  ok('…all on ONE phase (§7.2)',av.every(x=>x.phase&&x.phase===av[0].phase));
  ok('…with the "same phase + busbar" note on the schedule',S3.warnings.some(x=>x.code==='elo.av'));
  const Sr=w.eloSchedule(board.id,{phase:'3f',perWay:'rcd'});
  ok('RCD mode: the AV ways get their OWN RCD, never shared (§7.3)',Sr.rcd.some(r=>r.group==='AV'&&r.ways.length===3)&&Sr.rcd.filter(r=>!r.group).every(r=>r.ways.every(k=>k.indexOf('av:')!==0)));
  ok('the DED check does not ask for a stack route for an AV circuit on the cinema feed',!(w.STK_CHECKS['sys:DED']||[]).some(f=>{try{return (f({id:'x'})||[]).some(x=>/AV-|nincs útvonal/.test(x.msg)&&D.devices.some(d=>d.cin&&x.msg.indexOf(d.ref||d.id)===0));}catch(_){return false;}}));
  // ---- 5. the engine ----
  const I=w.blInput('ground');
  ok('the Erősáram engine leaves the AV circuits out (the cinema routes them) and says so',I.doc.project.data.devices.filter(d=>d.cin&&d.cin.av).every(d=>d.layer==='bl:off')&&I.notes.some(n=>/házimozi AV kör/.test(n)));
  // ---- the dialog ----
  w.cinWireDialog(CL);
  ok('the Kábellista dialog opens with the section line and the rows',/Hangszórókábel minden csatornán/.test(w.document.body.innerHTML)&&/Csövekbe írás/.test(w.document.body.innerHTML));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
