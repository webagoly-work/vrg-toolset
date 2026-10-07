// spec-52 — the channel fill: the CHANNEL bundle, RoomBox feeds, trunks (WP-E4)
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
  // packing (pure): three NYM-J 3×1,5 → M32 (2) + M25 (1)
  ok('three room circuits pack into M32 (2 cables) + M25 (1 cable)',(function(){const b=w.afillPackMains([{c:'NYM3x15',n:3}],5000);
    return b.length===2&&b[0].size==='M32'&&b[0].cables[0].n===2&&b[1].size==='M25'&&b[1].cables[0].n===1;})(),J(w.afillPackMains([{c:'NYM3x15',n:3}],5000).map(b=>[b.size,b.cables])));
  w.newBlankProject();const WA=w.__getWalls()[lvl];
  WA.push({x0:-50,y0:-50,x1:10050,y1:50},{x0:-50,y0:3950,x1:10050,y1:4050},{x0:-50,y0:-50,x1:50,y1:4050},{x0:9950,y0:-50,x1:10050,y1:4050},{x0:4950,y0:50,x1:5050,y1:3950});
  D().floors.push({level:lvl,name:'R1',num:'1',poly:[[0,0],[5000,0],[5000,4000],[0,4000]]},{level:lvl,name:'R2',num:'2',poly:[[5000,0],[10000,0],[10000,4000],[5000,4000]]});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const R1=D().floors[0].id,S=w.stkCreate({name:'C'});
  const hw=(t,x,y,u)=>{if(u)w.HW_T.units=u;return w.hwPlace(w.hwGhostAt(t,lvl,x,y));};
  const board=hw('board',1000,100),base=hw('base',2000,100,['NET','COMP','MEDIA']),meter=hw('meter',300,100),ssc=hw('ssc',3000,100);
  const r1=hw('rbx',100,2000),r2=hw('rbx',9900,2000);
  const at=(d,h)=>({level:lvl,x:d.x,y:d.y,h:h||2600,dev:d.id}),P=(x,y)=>({level:lvl,x,y,h:2600});
  const chn=pts=>{w.chnToolStart();pts.forEach(p=>w.eval('pathAddNode('+J(p)+')'));w.eval('finishPath()');return D().paths[D().paths.length-1];};
  const arm=pts=>{w.armToolStart();pts.forEach(p=>w.eval('pathAddNode('+J(p)+')'));w.eval('finishPath()');return D().paths[D().paths.length-1];};
  const cB1=chn([at(base),P(2000,1000),P(400,1000),at(r1)]),cR12=chn([at(r1),P(400,3500),P(9600,3500),at(r2)]);
  const m1=chn([at(board),P(1000,500),at(r1)]),m2=chn([at(board),P(1000,300),P(9700,300),at(r2)]);
  const sec=chn([at(ssc),P(3000,700),P(500,700),at(r1)]),feed=chn([at(meter),at(board)]);
  ok('fixture: carriers',w.chnCarrier(cB1)==='channel'&&w.chnCarrier(cR12)==='channel'&&w.chnCarrier(m1)==='mains'&&w.chnCarrier(sec)==='security'&&w.chnCarrier(feed)==='feed');
  ok('fixture: RBX2 is chained behind RBX1',w.chnChain(r2.id)==='chained');
  const put=(code,role,x,y,side)=>{const en=w.epEntry(code,role);return w.epPlace({level:lvl,x,y,h:en.h||2700,mount:en.mount,side:en.mount==='wall'?(side==null?1:side):undefined},code,role);};
  const s1=put('SOC','sys:MAINS',2000,0,1),s2=put('SOC','sys:MAINS',3000,4000,0),l1=put('LMP','sys:MAINS',2500,2000);
  const c=w.cktCreate({name:'Pult'});w.cktAssign(c,s1);                                 // s1 real circuit, s2 the implicit one → 2 socket circuits
  const e1=put('SEC','sys:SECURITY',4000,0,1),e2=put('SEC','sys:SECURITY',4000,4000,0);
  [[at(r1),P(1500,2000),at(l1)],[P(1500,2000),P(2000,300),at(s1)],[P(1500,2000),P(3000,3700),at(s2)],[P(1500,2000),P(4000,300),at(e1)],[P(1500,2000),P(4000,3700),at(e2)]].forEach(arm);
  ok('fixture: the RBX carries 2 socket circuits',w.afillRbxCircuits(r1,w.stkById(S.id)).length===2);
  w.afillApply([w.afillPlanRoom(S.id,R1)],w.stkById(S.id));
  ok('the room fill ran the two SEC runs from the SSC through the security trunk route',w.afillRuns().filter(r=>r.fam==='SECURITY'&&r.from===ssc.id&&r.via.some(v=>v.p===sec.id)).length===2);
  const plan=w.afillChannelPlan(S.id);const RT=id=>plan.routes.find(x=>x.p===id);
  ok('BASE→RBX1: six pipes C1…C5 + C4b in order with their fixed sizes',J(RT(cB1.id).pipes.map(p=>p.key+':'+p.size))===J(['C1:M25','C2:M40','C3:M20','C4:M25','C4b:M20','C5:M20']));
  ok('…C1 carries 4 × Cat6A (RBX1 + RBX2) → an overfill warning (177 mm² > 105 mm²)',RT(cB1.id).pipes[0].cables[0].n===4&&plan.warns.some(x=>x.code==='chn.overfill'&&x.ref===cB1.id&&/C1/.test(x.msg)));
  ok('…RBX1→RBX2 C1 carries 2 → no warning there',RT(cR12.id).pipes[0].cables[0].n===2&&!plan.warns.some(x=>x.ref===cR12.id&&/C1 /.test(x.msg)));
  ok('board→RBX1: 1 lighting + 2 socket circuits → M32 (2) + M25 (1)',J(RT(m1.id).pipes.map(p=>[p.size,p.cables.reduce((s,c)=>s+c.n,0)]))===J([['M32',2],['M25',1]]),J(RT(m1.id).pipes.map(p=>[p.size,p.cables])));
  ok('board→RBX2: lighting only (no sockets in R2) → one M25',J(RT(m2.id).pipes.map(p=>p.size))===J(['M25']));
  ok('SSC→RBX1: one trunk ≥ M25 holding both SEC cables, merging the room pipes',(function(){const t=RT(sec.id).pipes[0];return t.key==='TRUNK'&&t.cables[0].n===2&&w.AFILL_CONDUITS.findIndex(c=>c.k===t.size)>=2&&t.merged.length===2;})());
  ok('feed: no pipes, the A08 note',RT(feed.id).pipes.length===0&&/A08/.test(RT(feed.id).note));
  ok('runs: RBX2 C3 goes BASE→RBX2 through both routes, length = both + slack',(function(){const r=plan.runs.find(x=>x.to===r2.id&&x.code==='C3');
    return r&&r.from===base.id&&r.via.some(v=>v.p===cB1.id)&&r.via.some(v=>v.p===cR12.id)&&Math.abs(r.len-(Math.round(w.chnLen(cB1)+w.chnLen(cR12))+1000))<=1;})());
  w.afillChannelApply(plan,w.stkById(S.id));
  ok('apply: the trunk replaces the two SEC pipes on the trunk sections (room entries kept, hidden by merge)',(function(){const s0=D().paths.find(p=>p.id===sec.id).sections[0];
    const all=s0.cont.auto,vis=w.afillSecPipes(s0);return all.some(a=>a.src==='room:'+R1&&a.fam==='SECURITY')&&vis.filter(a=>a.fam==='SECURITY').length===1&&vis[0].pipe==='TRUNK';})());
  ok('re-applying replaces only chn: entries',(function(){const s0=()=>D().paths.find(p=>p.id===sec.id).sections[0];const nRoom=s0().cont.auto.filter(a=>a.src.indexOf('room:')===0).length;
    w.afillChannelApply(w.afillChannelPlan(S.id),w.stkById(S.id));return s0().cont.auto.filter(a=>a.src.indexOf('room:')===0).length===nRoom&&s0().cont.auto.filter(a=>a.src==='chn:'+sec.id).length===1;})());
  ok('channel runs are stored once per bundle cable per reached RBX',w.afillRuns().filter(r=>r.stage==='channel').length===2*5);
  ok('the report lists the channels with their pipes',(function(){const r=w.afillReport(S.id);return r.channels.length===6&&r.channels.find(c=>c.id===cB1.id).pipes.length===6;})());
  ok('the RBX device menu offers the channel fill',(function(){const it=[];w.deviceExtraItems(D().devices.indexOf(r1),it);return it.some(x=>/Csatorna feltöltése/.test(x.label));})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
