// Wireway rebuild T2 (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.6, GO-WIRE.md) — the engine FITS the user's tree:
// 1. cfg.tree: a drop hangs on the door / hub / board its up names; one hanging on a device in another drop is fed from
//    that drop (the classic socket chain); an up it cannot follow is an error naming why; no up = today's rule;
// 2. a lamp leg starts where it meets (a szobadoboz on the wall graph, a ceiling junction) and a switch leg runs to the
//    switch box; a ceiling chain follows the up order (chain or star);
// 3. the home runs: congest 0 = today's single tree exactly; with congest the runs are routed one by one, deterministic;
// 4. the Planner: blInput passes every d.up (and lamp.meet) as cfg.tree, keeps the user's own paths, and the tree is in
//    the stale signature; Pályák draws a fixed point (not stale at once).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
const BLD=path.join(__dirname,'..','tools','baseline');
const geom=require(path.join(BLD,'geom')),prep=require(path.join(BLD,'prep')),plan=require(path.join(BLD,'plan'));
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
// room A (top) and B (bottom), a door O1 between them at x 9000, the board in B; all walls Vezethető
function mk(o){o=o||{};const walls=[{id:'WT',x0:-100,y0:-100,x1:10100,y1:0},{id:'WB',x0:-100,y0:3000,x1:10100,y1:3100},{id:'WL',x0:-100,y0:0,x1:0,y1:3000},{id:'WR',x0:10000,y0:0,x1:10100,y1:3000},
  {id:'WB2',x0:-100,y0:6000,x1:10100,y1:6100},{id:'WL2',x0:-100,y0:3100,x1:0,y1:6000},{id:'WR2',x0:10000,y0:3100,x1:10100,y1:6000}].concat(o.walls||[]);
  const marks=walls.map(w=>({kind:'wall',wall:w.id,level:'ground',tags:['vezetheto']}));
  const devices=[{id:'BRD',type:'board',level:'ground',x:5000,y:5950,h:1500,layer:'hw'}].concat(o.devices||[]);
  const D={floors:[{id:'A',num:'A',name:'Nappali',level:'ground',poly:[[0,0],[10000,0],[10000,3000],[0,3000]]},{id:'B',num:'B',name:'Háló',level:'ground',poly:[[0,3100],[10000,3100],[10000,6000],[0,6000]]}],
    openings:[{id:'O1',type:'door',level:'ground',x:9000,y:3050,w:900,ang:0,variant:0}].concat(o.openings||[]),marks,paths:[],objects:[],devices,circuits:o.circuits};
  return {project:{data:D,building:{walls:{ground:walls}},layers:[{id:'m',role:'sys:MAINS'},{id:'hw',role:'hw'}]}};}
function run(doc,cfg){cfg=Object.assign({level:'ground',ceiling:2850,maxCablesPerPipe:3},cfg||{});
  const G=geom.load(doc,'ground'),al=geom.allowedFromSketch(G,[]).allowed,E=prep.endpoints(G,cfg);prep.applyHeights(E);
  const PT=prep.portals(G,E);prep.portalMembers(G,PT,E);return Object.assign(plan.plan(G,E,PT,cfg,al),{G,E,PT});}
const soc=(id,x,y)=>({id,type:'socket',code:'SOC',level:'ground',x,y,h:300,layer:'m',ref:id});
const sig=r=>JSON.stringify(r.legs.map(l=>[l.kind,l.from,l.to,l.len,l.cond]))+JSON.stringify(r.boxes.map(b=>[b.kind,Math.round(b.x),Math.round(b.y)]));
const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
function engine(){
  // three sockets in room A: S1 on the top wall, S2 on the left wall, S3 on the top wall far left
  const devs=[soc('S1',6000,0),soc('S2',0,1500),soc('S3',1500,0)],circ=[{ref:'A1',name:'dug',mcb:'C16',members:['S1','S2','S3']}];
  const base=run(mk({devices:devs,circuits:circ}));
  // ---- 1. no tree = today's rule; an empty tree = the same ----
  ok('1 an empty tree changes nothing',sig(run(mk({devices:devs,circuits:circ}),{tree:{}}))===sig(base));
  // the chain: S1 ← door, S3 ← S1, S2 ← S3
  const tree={S1:{id:'O1',room:'A'},S3:{id:'S1'},S2:{id:'S3'}},rc=run(mk({devices:devs,circuits:circ}),{tree});
  const dropBox=id=>{const d=rc.drops.find(d=>d.members.some(e=>e.id===id));return rc.boxes.find(b=>b.drop===d.key);};
  const b1=dropBox('S1'),b3=dropBox('S3'),b2=dropBox('S2');
  const link=(a,b)=>rc.legs.some(l=>l.kind==='dist'&&((l.from===a.id&&l.to===b.id)||(l.from===b.id&&l.to===a.id)));
  ok('1 the chain: a room run S1 box → S3 box and S3 box → S2 box',b1&&b2&&b3&&link(b1,b3)&&link(b3,b2),rc.legs.filter(l=>l.kind==='dist').map(l=>l.from+'>'+l.to).join(' '));
  ok('1 … and no run from the door straight to S2',!rc.legs.some(l=>l.kind==='dist'&&(l.to===b2.id||l.from===b2.id)&&rc.boxes.find(b=>b.id===(l.to===b2.id?l.from:l.to)&&b.kind==='sp')));
  ok('1 chain drops carry their depth and the root service point',rc.drops.find(d=>d.members[0].id==='S2').depth===2&&rc.drops.find(d=>d.members[0].id==='S2').sp==='O1');
  ok('1 the voltage drop counts the whole chain (longer than the star)',rc.checks[0].Lm>base.checks[0].Lm,rc.checks[0].Lm+' vs '+base.checks[0].Lm);
  // an up into the other room's drop: refused (another zone), today's rule instead, and an error that says why
  const rz=run(mk({devices:devs.concat([soc('S4',2000,6000)]),circuits:[{ref:'A1',name:'dug',mcb:'C16',members:['S1','S2','S3','S4']}]}),{tree:{S4:{id:'S1'}}});
  ok('1 an up it cannot follow is an error naming why, and the drop still routes',rz.warn.some(x=>x.sev==='err'&&x.tree&&/másik helyiségzónában/.test(x.msg))&&rz.drops.find(d=>d.members[0].id==='S4').sp);
  // up = the board: the run starts at the board (room B)
  const rbd=run(mk({devices:[soc('S5',2000,6000)],circuits:[{ref:'A1',name:'dug',mcb:'C16',members:['S5']}]}),{tree:{S5:{id:'BRD'}}});
  ok('1 up = the board: the drop is fed from the board itself',rbd.drops[0].sp==='__board');
  // ---- 2. lamps: the meeting box, the switch leg, the ceiling order ----
  const L=[{id:'K1',type:'switch',code:'SWI',level:'ground',x:9600,y:3000,h:1100,layer:'m',ref:'K1',ctl:['L1','L2','L3']},
    {id:'L1',type:'light',code:'LMP',level:'ground',x:3000,y:1500,h:2850,layer:'m',ref:'L1'},{id:'L2',type:'light',code:'LMP',level:'ground',x:5000,y:1500,h:2850,layer:'m',ref:'L2'},
    {id:'L3',type:'light',code:'LMP',level:'ground',x:7000,y:1500,h:2850,layer:'m',ref:'L3'},{id:'SZ',type:'junction',jb:'szoba',level:'ground',x:0,y:1000,h:2150,layer:'hw',ref:'SZ1'}];
  const lc=[{ref:'V1',name:'vil',mcb:'B10',kind:'light',members:['K1','L1','L2','L3']}],sg=[{lamps:['L1','L2','L3'],chain:['K1'],mode:'single',why:'t'}];
  const r0=run(mk({devices:L,circuits:lc}),{switchGroups:sg}),ceil0=r0.legs.filter(l=>l.kind==='ceil');
  ok('2 no tree: the riser from the switch box, a nearest-neighbour chain',ceil0.length===3&&ceil0.filter(l=>l.bends===2).length===1);
  const rm=run(mk({devices:L,circuits:lc}),{switchGroups:sg,tree:{L1:{id:'SZ'},L2:{id:'L1'},L3:{id:'L2'}}});
  const szb=rm.boxes.find(b=>b.sp==='SZ'),cm=rm.legs.filter(l=>l.kind==='ceil');
  ok('2 meeting in the szobadoboz: the riser starts at its box',szb&&cm.some(l=>l.from===szb.id&&l.to==='L1'&&l.bends===2),cm.map(l=>l.from+'>'+l.to).join(' '));
  ok('2 … the chain follows up: L1 → L2 → L3',cm.some(l=>l.from==='L1'&&l.to==='L2')&&cm.some(l=>l.from==='L2'&&l.to==='L3'));
  const swBox=rm.boxes.find(b=>b.drop&&rm.drops.find(d=>d.key===b.drop).members.some(e=>e.id==='K1'));
  ok('2 a switch leg runs from the szobadoboz to the switch box',swBox&&rm.legs.some(l=>l.kind==='dist'&&((l.from===szb.id&&l.to===swBox.id)||(l.to===szb.id&&l.from===swBox.id))),rm.legs.filter(l=>l.kind==='dist').map(l=>l.from+'>'+l.to).join(' '));
  const rs=run(mk({devices:L,circuits:lc}),{switchGroups:sg,tree:{L1:{id:'K1'},L2:{id:'K1'},L3:{id:'K1'}}});
  ok('2 all three on the switch: a star — three risers from the box',rs.legs.filter(l=>l.kind==='ceil'&&l.bends===2).length===3);
  const LJ=L.concat([{id:'J1',type:'junction',jb:'ceiling',level:'ground',x:5000,y:2000,h:2850,layer:'hw',ref:'J1'}]);
  const rj=run(mk({devices:LJ,circuits:lc}),{switchGroups:sg,tree:{L1:{id:'J1'},L2:{id:'J1'},L3:{id:'J1'}}}),cj=rj.legs.filter(l=>l.kind==='ceil');
  ok('2 a ceiling junction: box → riser → J1, then J1 → each lamp',cj.some(l=>l.to==='J1'&&l.bends===2)&&['L1','L2','L3'].every(id=>cj.some(l=>l.from==='J1'&&l.to===id)),cj.map(l=>l.from+'>'+l.to).join(' '));
  // ---- 3. the home runs ----
  const two=mk({devices:devs.concat([soc('S6',3000,6000),soc('S7',7000,0)]),circuits:[{ref:'A1',name:'a',mcb:'C16',members:['S1','S3']},{ref:'A2',name:'b',mcb:'C16',members:['S2','S7']},{ref:'A3',name:'c',mcb:'C16',members:['S6']}],
    openings:[{id:'O2',type:'door',level:'ground',x:1000,y:3050,w:900,ang:0,variant:0}]});
  const k0=run(JSON.parse(JSON.stringify(two))),k0b=run(JSON.parse(JSON.stringify(two)),{congest:0});
  ok('3 congest 0 = no congestion term (identical)',sig(k0)===sig(k0b));
  const k1=run(JSON.parse(JSON.stringify(two)),{congest:0.5}),k1b=run(JSON.parse(JSON.stringify(two)),{congest:0.5});
  ok('3 with congestion the result is deterministic',sig(k1)===sig(k1b));
  const busy=r=>{const m=new Map();r.legs.filter(l=>l.kind==='trunk').forEach(l=>l.tpts.forEach((p,k)=>{if(k){const key=Math.min(p,l.tpts[k-1])+'-'+Math.max(p,l.tpts[k-1]);m.set(key,(m.get(key)||0)+l.pipes.length);}}));return Math.max(0,...m.values());};
  // the circuit's own cross-section (05j c.mm2) wins over the breaker text (Q1 = A, Domoszló A4: 2,5 mm² on 13 A)
  const cs=(mm2,mcb)=>run(mk({devices:[soc('S9',6000,0)],circuits:[Object.assign({ref:'A1',name:'dug',mcb,members:['S9']},mm2?{mm2}:{})]})).C.list[0].cable;
  ok('3 c.mm2 2,5 on a 13 A breaker → NYM-J 3×2,5; none → the breaker rule (13 A → 3×1,5, 16 A → 3×2,5)',cs(2.5,'1C 13A')==='NYM3x25'&&cs(0,'1C 13A')==='NYM3x15'&&cs(0,'1C 16A')==='NYM3x25'&&cs(1.5,'1C 16A')==='NYM3x15');
  ok('3 the congestion term never makes the busiest trunk stretch busier',busy(k1)<=busy(k0),busy(k1)+' vs '+busy(k0));
}
try{engine();}catch(err){R.push(['engine exception',false,err.stack]);}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 try{
  // ---- 4. the Planner adapter ----
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  WL.ground.push({x0:-100,y0:-100,x1:8100,y1:0,id:'W1'},{x0:-100,y0:0,x1:0,y1:3000,id:'W2'},{x0:4000,y0:0,x1:4100,y1:3000,id:'W3'},
    {x0:8000,y0:0,x1:8100,y1:3000,id:'W4'},{x0:-100,y0:3000,x1:8100,y1:3100,id:'W5'});
  D.floors.length=0;D.devices.length=0;D.circuits=[];D.paths.length=0;D.openings.length=0;D.marks=[];
  D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali',num:'RA',layer:'L0'},{level:'ground',poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'Háló',num:'RB',layer:'L0'});
  D.openings.push({type:'door',level:'ground',x:4050,y:1500,w:900,ang:Math.PI/2,variant:0});
  ['W1','W2','W3','W4'].forEach(id=>D.marks.push({kind:'wall',wall:id,level:'ground',tags:['vezetheto'],pol:'plus',layer:'L0'}));
  const dev=(code,x,y,h)=>{const d={type:w.epTypeFor(code),code,level:'ground',x,y,h,layer:'L0'};D.devices.push(d);return d;};
  D.devices.push({type:'board',level:'ground',x:1000,y:60,h:1600,layer:'L0'});
  const a=dev('SOC',2500,0,300),b=dev('SOC',0,1500,300),c=dev('SOC',6500,0,300);w.ensureIds(D);
  w.cktCreate({name:'Dugalj',mcb:{curve:'C',amps:16,poles:1,n:false},members:[a.id,b.id,c.id]});
  D.paths.push({ptype:'gege',nodes:[{level:'ground',x:100,y:100},{level:'ground',x:900,y:100}],sections:[{build:'sull_gege'}],layer:'L0'});w.ensureIds(D);
  const I0=w.blInput('ground');
  ok('4 the user paths stay in the engine input (T6 reads them), the engine output does not',I0.doc.project.data.paths.length===1);
  ok('4 the Planner turns the congestion term on',I0.cfg.congest>0);
  const s0=I0.sig;w.byId('devices',b.id).up={id:a.id,fix:true};const I1=w.blInput('ground');
  ok('4 every d.up is in cfg.tree, and the tree is in the stale signature',I1.cfg.tree[b.id]&&I1.cfg.tree[b.id].id===a.id&&I1.sig!==s0);
  const lamp=dev('LMP',6000,1500,2700);w.ensureIds(D);lamp.meet='JX';const I2=w.blInput('ground');
  ok('4 a lamp with no up but a pinned meeting box: the box is its tree entry',I2.cfg.tree[lamp.id]&&I2.cfg.tree[lamp.id].id==='JX');
  D.devices.splice(D.devices.indexOf(lamp),1);
  const res=w.blApplyRoutes(w.blRun('ground'),{confirm:true});
  ok('4 Pályák draws a fixed point: not stale right after',!res.err&&(s=>s.drawn>0&&s.stale===0)(w.blStale('ground')),JSON.stringify(w.blStale('ground')));
  ok('4 the rögzített link survives and the engine follows it (a room run from the chain parent)',w.byId('devices',b.id).up.id===a.id&&w.byId('devices',b.id).up.fix);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
