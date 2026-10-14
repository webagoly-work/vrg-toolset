// spec-54 — a BRIDGE Stack end to end: every phase, then a save / load round trip, every stage, timing
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
  const ms=f=>{const t=Date.now();f();return Date.now()-t;};
  // ---- construct: three rooms in a row, doors between them ----
  w.newBlankProject();const WA=w.__getWalls()[lvl];
  WA.push({x0:-50,y0:-50,x1:12050,y1:50},{x0:-50,y0:3950,x1:12050,y1:4050},{x0:-50,y0:-50,x1:50,y1:4050},{x0:11950,y0:-50,x1:12050,y1:4050},
          {x0:3950,y0:50,x1:4050,y1:3950},{x0:7950,y0:50,x1:8050,y1:3950});
  D().floors.push({level:lvl,name:'ELŐSZOBA',num:'1.01',poly:[[0,0],[4000,0],[4000,4000],[0,4000]]},
                  {level:lvl,name:'NAPPALI',num:'1.02',poly:[[4000,0],[8000,0],[8000,4000],[4000,4000]]},
                  {level:lvl,name:'KONYHA',num:'1.03',poly:[[8000,0],[12000,0],[12000,4000],[8000,4000]]});
  D().openings.push({type:'door',level:lvl,x:4000,y:2000,ang:Math.PI/2,w:900,variant:0},{type:'door',level:lvl,x:8000,y:2000,ang:Math.PI/2,w:900,variant:0},
                    {type:'door',level:lvl,x:2000,y:4000,ang:0,w:1000,variant:0},{type:'window',level:lvl,x:6000,y:0,ang:0,w:1500});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const [E,N,K]=D().floors.map(f=>f.id),[d1,d2,dIn,win]=D().openings;
  const S=w.stkCreate({name:'E2E'}),L=r=>w.stkLayer(S.id,r).id;
  ok('1 · the stack has its 21 layers and the construct checks pass',S.layers.length===21&&!w.stkCheck(S,'construct').some(c=>c.sev==='error'));
  // ---- marking ----
  const M=o=>{w.mrkList().push(Object.assign({level:lvl,layer:L('mark'),pol:'none',tags:[]},o));w.ensureIds(D());};
  M({kind:'opening',op:dIn.id,tags:['bejarat','portal','p3']});M({kind:'opening',op:d1.id,tags:['portal','p2']});M({kind:'opening',op:win.id,tags:['redony']});
  M({kind:'wall',wall:WA[0].id,pol:'minus',tags:['homlokzat']});M({kind:'vstrip',wall:WA[4].id,side:-1,u0:400,u1:700,pol:'plus',tags:['rbx']});
  w.trcList().push({level:lvl,plane:'floor',mode:'line45',pts:[[2000,3750],[3750,2000]],a:null,b:null,dir:1,tags:['mozgas'],layer:L('mark')});w.ensureIds(D());
  w.trcReattach(w.trcList()[0]);
  ok('2 · marks and a trace attached to both doors of the hall',(function(){const t=w.trcList()[0];return t.a===dIn.id&&t.b===d1.id;})());
  ok('2 · the portal graph sees the hall edge with line of sight',w.prtGraph(lvl).edges.some(e=>e.room===E&&e.los));
  // ---- hardware, BASE, channel ----
  const hw=(t,x,y,u)=>{if(u)w.HW_T.units=u;return w.hwPlace(w.hwGhostAt(t,lvl,x,y));};
  const board=hw('board',1000,100),meter=hw('meter',300,100),entry=hw('entry',2500,100),base=hw('base',3000,3900,['NET','COMP','MEDIA']);
  const rA=hw('rbx',3900,600),rK=hw('rbx',11900,2000);
  ok('3 · the RBX snapped to the marked strip and serves the hall and the living room',rA.y===600&&J(w.hwServes(rA))===J([E,N].sort((a,b)=>w.eval('prtIdCmp')(a,b))));
  ok('3 · every room has an RBX',w.hwUnserved(lvl).length===0);
  const at=(d,h)=>({level:lvl,x:d.x,y:d.y,h:h||2600,dev:d.id}),P=(x,y)=>({level:lvl,x,y,h:2600});
  const route=(tool,pts)=>{w[tool]();pts.forEach(p=>w.eval('pathAddNode('+J(p)+')'));w.eval('finishPath()');return D().paths[D().paths.length-1];};
  route('chnToolStart',[at(base),P(3000,3300),P(3500,600),at(rA)]);route('chnToolStart',[at(rA),P(3700,300),P(11700,300),at(rK)]);
  route('chnToolStart',[at(board),P(1000,700),at(rA)]);route('chnToolStart',[at(board),P(1200,200),P(11800,200),at(rK)]);
  route('chnToolStart',[at(meter),at(board)]);route('chnToolStart',[at(entry),P(2500,3600),at(base)]);
  // RBX03 is chained behind RBX01, so the BASE→RBX01 bundle carries two RoomBoxes' uplinks: the STD-001 gap (Q37) is the ONLY warning
  ok('3 · channel checks: only the chain overfill warnings (Q37)',(function(){const c=w.stkCheck(S,'channel'),bad=c.filter(x=>x.sev==='warn'||x.sev==='error');return bad.length>0&&bad.every(x=>x.msg.indexOf('túltelítve (BASE~RBX01)')>=0)&&bad.some(x=>x.msg.indexOf('C1 túltelítve (BASE~RBX01)')===0);})(),J(w.stkCheck(S,'channel')));
  ok('3 · a single bus-B pair in its M20 is NOT an overfill (1.4 × OD rule)',!w.stkCheck(S,'channel').some(c=>c.msg.indexOf('C4b túltelítve (RBX01~RBX03)')>=0));
  ok('3 · the BASE guideline rules: no errors',!w.hwBaseRules(base).some(r=>!r.ok&&r.sev==='error'),J(w.hwBaseRules(base).filter(r=>!r.ok)));
  // ---- endpoints, needs ----
  const put=(code,role,x,y,side)=>{role=(role==='sys:MAINS')?w.mnsRoleOf(code):role;const en=w.epEntry(code,role);return w.epPlace({level:lvl,x,y,h:en.h||2700,mount:en.mount,side:en.mount==='wall'?(side==null?1:side):undefined},code,role);};
  const lN=put('LMP','sys:MAINS',6000,2000),swN=put('SWI','sys:MAINS',4000,2600,1),sN1=put('SOC','sys:MAINS',6000,4000,0),sN2=put('SOC','sys:MAINS',7000,4000,0);
  const shu=put('SHU','sys:MAINS',6000,0,1),sen=put('SEN','sys:SENSOR',5000,3500),lK=put('LMP','sys:MAINS',10000,2000),oven=put('DED','sys:MAINS',12000,1000,0);
  w.epCtlPick(swN);w.epCtlToggle(lN);w.eval('EP_CTL=null');
  ok('4 · the living room Erősáram is done (Világítás LMP SWI + derived SHU · Dugaljak SOC)',w.needStatus(D().floors[1],'sys:LIGHT')==='done'&&w.needStatus(D().floors[1],'sys:SOC')==='done');
  // ---- ARM routes, fill, channel fill, cabinet ----
  const arm=pts=>route('armToolStart',pts);
  arm([at(rA),P(4300,600),P(4300,2000),at(lN)]);arm([P(4300,2000),at(swN)]);arm([P(4300,2000),P(5500,3700),at(sN1)]);arm([at(sN1),at(sN2)]);
  arm([P(4300,600),at(shu)]);arm([P(4300,2000),at(sen)]);arm([at(rK),P(11000,2000),at(lK)]);arm([P(11000,2000),at(oven)]);
  ok('5 · every endpoint is on a route',w.armUnreached(S).length===0,J(w.armUnreached(S).map(d=>d.ref)));
  const G=w.rgBuild();
  const plans=[N,K].map(r=>w.afillPlanRoom(S.id,r,G));
  ok('5 · the fill plans runs for both rooms without errors',plans.every(p=>p.runs.length>0&&!p.warns.some(x=>x.sev==='error')),J(plans.map(p=>p.warns.map(x=>x.code))));
  ok('5 · the oven is fed from the board, never through the RoomBox',plans[1].runs.some(r=>r.code==='DED'&&r.from===board.id));
  w.afillApply(plans,w.stkById(S.id));
  const cp=w.afillChannelPlan(S.id);w.afillChannelApply(cp,w.stkById(S.id));
  ok('5 · the channel fill wrote the bundle on both CHANNEL routes',D().paths.filter(p=>p.route==='channel'&&w.chnCarrier(p)==='channel').every(p=>w.afillSecPipes(p.sections[0]).filter(a=>a.src==='chn:'+p.id).length===6));
  const sch=w.eloSchedule(board.id,{phase:'3f'});
  ok('5 · the cabinet: BASE ×2 + pack-free, 2 lighting, socket circuits, the oven',sch.ways.filter(x=>x.kind==='light').length===2&&sch.ways.some(x=>x.kind==='load')&&sch.totalMod>9);
  ok('5 · validate() reports no errors',!w.validate().some(x=>x.sev==='error'),J(w.validate().filter(x=>x.sev==='error')));
  // ---- save / load round trip ----
  const snap=J(w.sessionObj());
  const counts=()=>J([D().marks.length,D().traces.length,D().runs.length,D().devices.length,D().paths.length,w.eval('stacks').length,w.eval('layers').filter(l=>l.stack).length]);
  const before=counts(),contN=D().paths.reduce((s,p)=>s+(p.sections||[]).filter(x=>x&&x.cont).length,0);
  w.newBlankProject();
  ok('6 · a blank project really is empty',D().runs.length===0&&w.eval('stacks').length===0);
  w.applyProjectData(JSON.parse(snap));
  ok('6 · after reload: every collection, the stack and its role layers are back',counts()===before,counts()+' vs '+before);
  ok('6 · …section containment, serves, ctl and the needs survive',D().paths.reduce((s,p)=>s+(p.sections||[]).filter(x=>x&&x.cont).length,0)===contN
    &&D().devices.find(d=>d.id===swN.id).ctl.indexOf(lN.id)>=0&&w.hwServes(D().devices.find(d=>d.id===rA.id)).length===2);
  ok('6 · …and the reloaded fill is not stale',!w.afillStale(N)&&!w.afillStale(K));
  ok('6 · the same cabinet after reload',J(w.eloSchedule(board.id,{phase:'3f'}).ways.map(x=>x.key))===J(sch.ways.map(x=>x.key)));
  // ---- every stage renders ----
  const S2=w.stkById(S.id);w.stkActivate(S2.id);
  ok('7 · every stack stage renders with its checks',(function(){try{w.stkStages(S2).forEach(st=>{w.setStage(st.k);w.draw();w.renderShell();});return true;}catch(e){return 'ERR '+e.message;}})()===true);
  // ---- timing (jsdom, generous bounds) ----
  w.__state.stkView=true;w.__state.prtShow=true;w.__state.rfShow=true;
  const tDraw=ms(()=>{for(let i=0;i<5;i++){w.__state.rot+=1;w.draw();}})/5;
  const tChecks=ms(()=>{w.stkStages(S2).forEach(st=>st.check());});
  const tFill=ms(()=>{const G2=w.rgBuild();[N,K].forEach(r=>w.afillPlanRoom(S2.id,r,G2));});
  ok('8 · a full draw with every stack overlay on stays under 1.5 s in jsdom',tDraw<1500,'draw '+tDraw.toFixed(0)+' ms · all checks '+tChecks+' ms · fill plan '+tFill+' ms');
  ok('8 · all stage checks together under 3 s',tChecks<3000,tChecks+' ms');
  console.log('timing: draw '+tDraw.toFixed(0)+' ms · checks '+tChecks+' ms · fill plan '+tFill+' ms');
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
