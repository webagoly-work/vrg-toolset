// spec-51 — the auto-fill: runs, pipes, conduit sizing per room (WP-E3)
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground',D=()=>w.__data,J=o=>JSON.stringify(o);w.confirm=()=>true;w.alert=()=>{};
  // ---- sizing (pure) ----
  ok('one NYM-J 3×1,5 with w M20 → M20',w.afillSize([{c:'NYM3x15',n:1,w:'M20'}],3000).size==='M20');
  ok('a lone od 9 cable with w M16 still needs M20 (1,4 × 9 = 12,6 > 10,7)',w.afillSize([{c:'NYM3x15',n:1,w:'M16'}],3000).size==='M20');
  ok('2 × Cat6A U/FTP → M25 at 34 %',(function(){const s=w.afillSize([{c:'CAT6A_U',n:2,w:'M25'}],3000);return s.size==='M25'&&Math.round(s.fill*100)===34&&/34 %/.test(s.why);})());
  ok('3 × Cat6A over 12 m → the 33 % rule → M32',w.afillSize([{c:'CAT6A_U',n:3,w:'M20'}],12000).size==='M32');
  ok('…the same over 8 m → 40 % → M32 too (132.5 > 105.2)',w.afillSize([{c:'CAT6A_U',n:3,w:'M20'}],8000).size==='M32');
  ok('a plug-limited AOC needs M40 whatever its diameter',w.afillSize([{c:'AOC_FIX',n:1,w:'M20'}],3000).size==='M40');
  ok('an empty spare is its own w',w.afillSize([{c:'SPARE',n:1,w:'M16'}],3000).size==='M16');
  // ---- the room ----
  w.newBlankProject();const WA=w.__getWalls()[lvl];
  WA.push({x0:-50,y0:-50,x1:6050,y1:50},{x0:-50,y0:3950,x1:6050,y1:4050},{x0:-50,y0:-50,x1:50,y1:4050},{x0:5950,y0:-50,x1:6050,y1:4050});
  D().floors.push({level:lvl,name:'KONYHA',num:'1.02',poly:[[0,0],[6000,0],[6000,4000],[0,4000]]});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const K=D().floors[0].id,S=w.stkCreate({name:'F'});
  const rbx=w.hwPlace(w.hwGhostAt('rbx',lvl,100,2000)),board=w.hwPlace(w.hwGhostAt('board',lvl,500,3900));
  const put=(code,role,x,y,side,v)=>{role=(role==='sys:MAINS')?w.mnsRoleOf(code):role;const en=w.epEntry(code,role);return w.epPlace({level:lvl,x,y,h:en.h||2700,mount:en.mount,side:en.mount==='wall'?(side==null?1:side):undefined},code,role,v);};
  const soc1=put('SOC','sys:MAINS',2000,0,1),soc2=put('SOC','sys:MAINS',3000,0,1),sen=put('SEN','sys:SENSOR',4000,2000),eth=put('ETH','sys:DATA',0,1000,1,'2'),ded=put('DED','sys:MAINS',6000,2000,0);
  const at=(d,h)=>({level:lvl,x:d.x,y:d.y,h:h||2600,dev:d.id}),P=(x,y)=>({level:lvl,x,y,h:2600});
  const drawArm=pts=>{w.armToolStart();pts.forEach(p=>w.eval('pathAddNode('+J(p)+')'));w.eval('finishPath()');return D().paths[D().paths.length-1];};
  w.chnToolStart();[at(board),P(100,3500),at(rbx)].forEach(p=>w.eval('pathAddNode('+J(p)+')'));w.eval('finishPath()');
  const mains=D().paths[D().paths.length-1];
  const p1=drawArm([at(rbx),P(1000,2000)]),p2=drawArm([P(1000,2000),P(2000,300),at(soc1)]),p3=drawArm([at(soc1),at(soc2)]),
        p4=drawArm([P(1000,2000),at(sen)]),p5=drawArm([at(rbx),at(eth)]),p6=drawArm([P(1000,2000),P(5000,2000),at(ded)]);
  ok('fixture: the mains route board → RBX exists and the branches joined',w.chnCarrier(mains)==='mains'&&!!p2.nodes[0].j&&!!p4.nodes[0].j&&!!p6.nodes[0].j);
  ok('fixture: the room is served by the RBX',w.hwRoomRbx(K)===rbx);
  const pl=w.afillPlanRoom(S.id,K);
  const runsOf=c=>pl.runs.filter(r=>r.code===c);
  ok('SOC chain: two runs, RBX → SOC1 and SOC1 → SOC2',(function(){const r=runsOf('SOC');return r.length===2&&r[0].from===rbx.id&&r[0].to===soc1.id&&r[1].from===soc1.id&&r[1].to===soc2.id;})(),J(runsOf('SOC').map(r=>[r.from,r.to])));
  ok('…two pipes of NYM-J 3×1,5 in M20',(function(){const ps=pl.pipes.filter(p=>p.fam==='MAINS'&&p.cables[0].c==='NYM3x15');return ps.length===2&&ps.every(p=>p.size==='M20');})());
  ok('SEN: one star run, its own SENSOR pipe beside the socket pipe',runsOf('SEN').length===1&&pl.pipes.some(p=>p.fam==='SENSOR'&&p.to===sen.id));
  ok('MAINS + SENSOR on the same section → one share warning there',pl.warns.filter(x=>x.code==='fill.share'&&x.ref===p1.id+':0').length===1);
  ok('ETH 2: ONE pipe with 2 × Cat6A in M25',(function(){const ps=pl.pipes.filter(p=>p.to===eth.id);return ps.length===1&&ps[0].cables[0].n===2&&ps[0].size==='M25';})());
  ok('DED: from the board, one pipe that does not break at the RBX',(function(){const r=runsOf('DED');const ps=pl.pipes.filter(p=>p.to===ded.id);
    return r.length===1&&r[0].from===board.id&&ps.length===1&&ps[0].from===board.id&&ps[0].segs.some(s=>s.p===mains.id)&&ps[0].segs.some(s=>s.p===p6.id);})());
  ok('a member with no route is reported, the rest still planned',(function(){const lone=put('SEN','sys:SENSOR',5000,3500);const q=w.afillPlanRoom(S.id,K);
    const ok1=q.warns.some(x=>x.code==='fill.unreached'&&x.ref===lone.id)&&q.runs.filter(r=>r.code==='SEN').length===1;D().devices.splice(D().devices.indexOf(lone),1);return ok1;})());
  // ---- apply ----
  const u0=w.eval('undo.length');
  const n=w.afillApply([w.afillPlanRoom(S.id,K)],w.stkById(S.id));
  ok('apply writes runs with H ids and section containment',n>0&&w.afillRuns().every(r=>/^H\d+$/.test(r.id))&&!!(p1.sections[0].cont&&p1.sections[0].cont.auto.length===3));
  ok('…one undo step restores both',(function(){w.doUndo();const a=!(D().runs||[]).length;const q1=D().paths.find(p=>p.id===p1.id);return a&&!(q1.sections[0].cont)&&w.eval('undo.length')===u0;})());
  w.afillApply([w.afillPlanRoom(S.id,K)],w.stkById(S.id));
  const P1=()=>D().paths.find(p=>p.id===p1.id);
  ok('the pipes are drawn along the sections',(function(){w.draw();return w.afillSceneSvg().split('<line').length-1>=3;})());
  ok('a manual value is kept by a re-fill',(function(){P1().sections[0].cont.manual=[{fam:'MAINS',size:'M32'}];w.afillApply([w.afillPlanRoom(S.id,K)],w.stkById(S.id));return J(P1().sections[0].cont.manual)===J([{fam:'MAINS',size:'M32'}]);})());
  ok('moving SEN makes the room stale and raises fill.manual',(function(){const s=D().devices.find(d=>d.id===sen.id);s.x=4200;const st=w.afillStale(K);const m=w.afillManualStale().length>0;s.x=4000;return st&&m;})());
  ok('the report totals NYM-J 3×1,5 = Σ run lengths × 1.1',(function(){w.__state.waste=10;const r=w.afillReport(S.id);const x=r.rbx.find(q=>q.id===rbx.id);
    const sum=w.afillRuns().filter(q=>q.stage==='stack'&&q.cable.c==='NYM3x15').reduce((s,q)=>s+q.len*(q.cable.n||1),0)*1.1;return Math.abs(x.totals.cables['NYM-J 3×1,5']-Math.round(sum/100)/10)<0.11;})());
  ok('re-planning the same input is identical (determinism)',J(w.afillPlanRoom(S.id,K).runs)===J(w.afillPlanRoom(S.id,K).runs));
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
