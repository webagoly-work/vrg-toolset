// Wireway rebuild T0 (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §3.1, GO-WIRE.md) — the top-10 fixes in tools/baseline:
// 1. lengths are geometric: a leg's len / a span's len / the cable metres never carry the search weights (F1);
// 2. every circuit member with no leg is an error with its reason: off-wall, outside every room, no service point (F2);
// 3. the R3 marks reach the router per face: ban = no edge, minus ×2, előnyben ×0.5, unmarked ×4 and only as a fallback,
//    for the distribution too (F3, F6);
// 4. the door latch comes from door.variant — the Planner's slot table is the engine's (F4);
// 5. a soft-wall warning names the wall the edge really lies on, with the room name and a place to show (F5, L13);
// 6. the Pálya-ellenőrzés report (R.report) (F10, L15);
// 7. drop grouping does not depend on the device order; heights above the ceiling and duplicate refs are reported (L10–L12).
// Engine part: pure Node on synthetic plans. Planner part: the gate, the stale flag and the slot table in the bundle.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
const BLD=path.join(__dirname,'..','tools','baseline');
const geom=require(path.join(BLD,'geom')),prep=require(path.join(BLD,'prep')),plan=require(path.join(BLD,'plan')),RU=require(path.join(BLD,'rules'));
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}

// two rooms side by side, a door in the wall between, the board in B; every wall Vezethető except those in `unmarked`
function mk(o){o=o||{};const walls=[{id:'WT',x0:-100,y0:-100,x1:10100,y1:0},{id:'WB',x0:-100,y0:3000,x1:10100,y1:3100},{id:'WL',x0:-100,y0:0,x1:0,y1:3000},{id:'WR',x0:10000,y0:0,x1:10100,y1:3000},
  {id:'WB2',x0:-100,y0:6000,x1:10100,y1:6100},{id:'WL2',x0:-100,y0:3100,x1:0,y1:6000},{id:'WR2',x0:10000,y0:3100,x1:10100,y1:6000}];
  const un=o.unmarked||[],marks=walls.map(w=>w.id).filter(id=>un.indexOf(id)<0).map(w=>({kind:'wall',wall:w,level:'ground',tags:['vezetheto']})).concat(o.marks||[]);
  const devices=[{id:'BRD',type:'board',level:'ground',x:o.boardX||5000,y:5950,h:1500,layer:'hw'},{id:'S1',type:'socket',code:'SOC',level:'ground',x:9000,y:0,h:300,layer:'m',ref:'D1'},
    {id:'S2',type:'socket',code:'SOC',level:'ground',x:5000,y:6000,h:300,layer:'m',ref:'D2'}].concat(o.devices||[]);
  const D={floors:[{id:'A',num:'A',name:'Nappali',level:'ground',poly:[[0,0],[10000,0],[10000,3000],[0,3000]]},{id:'B',num:'B',name:'Háló',level:'ground',poly:[[0,3100],[10000,3100],[10000,6000],[0,6000]]}],
    openings:[Object.assign({id:'O1',type:'door',level:'ground',x:9000,y:3050,w:900},o.door||{})],marks,paths:[],objects:[],devices,
    circuits:o.circuits||[{ref:'A1',name:'dug',mcb:'C16',members:devices.filter(d=>d.layer==='m').map(d=>d.id)}]};
  return {project:{data:D,building:{walls:{ground:walls}},layers:[{id:'m',role:'sys:MAINS'},{id:'hw',role:'hw'}]}};}
function run(doc,cfg){cfg=Object.assign({level:'ground',ceiling:2850,maxCablesPerPipe:3},cfg||{});
  const G=geom.load(doc,'ground'),al=geom.allowedFromSketch(G,[]).allowed,E=prep.endpoints(G,cfg);prep.applyHeights(E);
  const PT=prep.portals(G,E);prep.portalMembers(G,PT,E);return Object.assign(plan.plan(G,E,PT,cfg,al),{G,E,PT});}
const planLen=poly=>{let L=0;for(let k=1;k<poly.length;k++)L+=Math.hypot(poly[k][0]-poly[k-1][0],poly[k][1]-poly[k-1][1])+Math.abs(poly[k][2]-poly[k-1][2]);return L;};

const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
function engine(){
  // ---- 1. geometric lengths (F1) ----
  // room A reachable only over unmarked walls: the route is soft, its metres must still be the drawn metres
  {const r=run(mk({unmarked:['WR','WT','WL']})),dl=r.legs.filter(l=>l.kind==='dist'||l.kind==='trunk');
    ok('1 the fixture routes over an unmarked wall',dl.some(l=>l.soft));
    // (a trunk leg starts at the board itself, a few cm off its face anchor: that stub is not in len)
    ok('1 every room / trunk leg is as long as its drawn line (no ×4 in the quantities)',dl.length&&dl.every(l=>Math.abs(l.len-planLen(l.poly))<=(l.kind==='trunk'?60:2)),
      dl.map(l=>l.id+' '+l.len+'/'+Math.round(planLen(l.poly))).join(' '));
    ok('1 every span is as long as its line',r.spans.length&&r.spans.every(s=>Math.abs(s.len-planLen(s.poly))<=2));}
  // ---- 2. unreached members are errors (F2) ----
  {const r=run(mk({devices:[{id:'S3',type:'socket',code:'SOC',level:'ground',x:5000,y:1500,h:300,layer:'m',ref:'D3'},{id:'S4',type:'socket',code:'SOC',level:'ground',x:12500,y:1500,h:300,layer:'m',ref:'D4'}]}));
    const er=id=>r.warn.find(x=>x.sev==='err'&&(x.ids||[]).indexOf(id)>=0);
    ok('2 a socket in the middle of the room: an error, "nincs falon" with the distance',er('S3')&&/nincs falon: 1500 mm/.test(er('S3').msg),(er('S3')||{}).msg);
    ok('2 the error names the room by its name and carries the place',er('S3')&&/Nappali \(A\)/.test(er('S3').msg)&&er('S3').room==='A'&&er('S3').at[0]===5000);
    ok('2 a socket outside every room: an error',er('S4')&&/helyiségen kívül/.test(er('S4').msg),(er('S4')||{}).msg);
    ok('2 R.unreached lists both, the wired ones not',r.unreached.map(u=>u.id).sort().join()==='S3,S4');
    const r0=run(mk());ok('2 a complete plan has no unreached member',r0.unreached.length===0&&!r0.warn.some(x=>x.sev==='err'),r0.warn.map(x=>x.msg).join(' | '));}
  // ---- 3. marks per face (F3, F6) ----
  {const edges=r=>{const g=r.net.g,out=[];g.adj.forEach((es,a)=>es.forEach(e=>{if(a<e.to)out.push(Object.assign({a,b:e.to},e));}));return out;};
    const onY=(r,y,x0,x1)=>r.legs.filter(l=>l.kind==='dist').some(l=>l.poly.some((p,k)=>k&&Math.abs(p[1]-y)<2&&Math.abs(l.poly[k-1][1]-y)<2&&Math.max(p[0],l.poly[k-1][0])>x0+5&&Math.min(p[0],l.poly[k-1][0])<x1-5));
    const base=run(mk());
    // Tilos on room A's face of WB (side −1: A lies at smaller y), x 9500–10000
    const rb=run(mk({marks:[{id:'M1',kind:'vstrip',level:'ground',wall:'WB',side:-1,u0:9600,u1:10200,pol:'ban',tags:['tilos']}]}));
    ok('3 a ban face has no edge (g.banned names the mark)',rb.net.g.banned.some(b=>b.mark==='M1'&&b.room==='A')&&!edges(rb).some(e=>e.wall==='WB'&&Math.abs(rb.net.g.N[e.a].y-3000)<2&&rb.net.g.N[e.a].x>9500&&rb.net.g.N[e.b].x>9500));
    ok('3 no room run on the banned stretch, though the plan without it used it',onY(base,3000,9500,10000)&&!onY(rb,3000,9500,10000));
    ok('3 the other face of the same wall keeps its edge',edges(rb).some(e=>e.kind==='face'&&Math.abs(rb.net.g.N[e.a].y-3100)<2&&rb.net.g.N[e.a].x>9500));
    const rm=run(mk({marks:[{kind:'side',level:'ground',wall:'WR',side:-1,pol:'minus',tags:['kerulendo']}]}));
    ok('3 a minus face costs ×2 (its length stays geometric)',edges(rm).some(e=>e.mark==='minus'&&e.wall==='WR'&&Math.abs(e.w-2*e.geo)<1e-6&&e.geo>100));
    const rp=run(mk({unmarked:['WR'],marks:[{kind:'side',level:'ground',wall:'WR',side:-1,pol:'plus',tags:['elonyben']}]}));
    ok('3 előnyben opens an unmarked face at ×0.5',edges(rp).some(e=>e.kind==='face'&&e.mark==='pref'&&e.wall==='WR'&&Math.abs(e.w-0.5*e.geo)<1e-6));
    const rl=run(mk({marks:[{kind:'side',level:'ground',wall:'WR',side:-1,pol:'plus',tags:['lforma']}]}));
    ok('3 an L-forma mark does not change the routes',JSON.stringify(rl.legs.map(l=>[l.kind,l.len]))===JSON.stringify(base.legs.map(l=>[l.kind,l.len])));
    // unmarked WR: the room run goes the long marked way round, never over WR (F6)
    const ru=run(mk({unmarked:['WR']}));
    ok('3 unmarked is a fallback for the distribution too: no soft leg when a marked route exists',!ru.legs.some(l=>l.soft)&&ru.unreached.length===0,ru.legs.filter(l=>l.soft).map(l=>l.id).join());}
  // ---- 4. the latch from the door (F4) ----
  {const lat=door=>run(mk({door})).PT[0];
    ok('4 variant 0, ang 0: the handle at +x',lat({variant:0,ang:0}).latch===1&&lat({variant:0,ang:0}).latchFrom==='door');
    ok('4 variant 2 (hinge at the far jamb): the handle at −x',lat({variant:2,ang:0}).latch===-1);
    ok('4 ang π turns it round',lat({variant:0,ang:Math.PI}).latch===-1);
    ok('4 the opening-side bit (variant 1) does not move the handle',lat({variant:1,ang:0}).latch===1);
    ok('4 a sketch door without a variant keeps the old rule',lat({}).latchFrom!=='door');
    // switches beside the door on its hinge side: the latch still follows the door, and an info line says so
    const r=run(mk({door:{variant:2,ang:0},devices:[{id:'K1',type:'switch',code:'SWI',level:'ground',x:9600,y:3000,h:1100,layer:'m',ref:'K1'}]}));
    ok('4 switches on the hinge side: latch from the door + an info line',r.PT[0].latch===-1&&r.warn.some(x=>x.sev==='info'&&/zsanér oldalán/.test(x.msg)));
    const sp=r.SP.find(s=>s.id==='O1');ok('4 the L4 anchor sits on the latch side, 150 past the edge',sp.faces.every(f=>Math.abs(f.u-(9000-450-150))<1),sp.faces.map(f=>f.u).join());
  }
  // ---- 5. the wall a soft run is reported on is the wall it lies on (F5); room names + a place (L13) ----
  {const doc=mk({unmarked:['WR','WT','WL']}),r=run(doc),walls=doc.project.building.walls.ground;
    const sw=r.warn.filter(x=>/jelöletlen falon/.test(x.msg));
    // a segment lies on wall q when both its ends are on q's box (face lines are the box edges)
    const onBox=(a,q)=>a[0]>=q.x0-2&&a[0]<=q.x1+2&&a[1]>=q.y0-2&&a[1]<=q.y1+2;
    const lies=wid=>{const q=walls.find(w=>w.id===wid);return r.legs.some(l=>l.soft&&l.poly.some((p,k)=>k&&onBox(p,q)&&onBox(l.poly[k-1],q)&&Math.hypot(p[0]-l.poly[k-1][0],p[1]-l.poly[k-1][1])>50));};
    ok('5 a soft-wall warning exists, with walls, room and place',sw.length&&sw.every(x=>x.walls&&x.walls.length&&x.room&&x.at),sw.map(x=>x.msg).join(' | '));
    ok('5 every wall it names carries a soft run of that leg',sw.every(x=>x.walls.every(lies)),sw.map(x=>x.walls.join('/')).join(' '));
    ok('5 the message says the room name',sw.every(x=>/Nappali \(A\)|Háló \(B\)/.test(x.msg)));
    // the old midpoint bug: an edge walked backwards (b.s < a.s) once wrapped round the room — every soft edge's wall
    // now comes from the edge, so it is a wall the edge's room actually touches
    const g=r.net.g,touch=(room,wid)=>r.G.rooms.find(q=>q.id===room).faces.some(f=>f.wall===wid);
    ok('5 every soft edge knows its wall, and the room has a face on it',g.adj.every((es,a)=>es.every(e=>e.kind!=='soft'||(e.wall&&touch(g.N[a].room,e.wall)))));}
  // ---- 7. drop grouping by sort-then-sweep; the input checks (L10–L12) ----
  {const ex=[{id:'S5',type:'socket',code:'SOC',level:'ground',x:3000,y:0,h:300,layer:'m',ref:'D5'},{id:'S6',type:'socket',code:'SOC',level:'ground',x:3200,y:0,h:300,layer:'m',ref:'D6'},
      {id:'S7',type:'socket',code:'SOC',level:'ground',x:3400,y:0,h:300,layer:'m',ref:'D7'},{id:'S8',type:'socket',code:'SOC',level:'ground',x:6000,y:0,h:300,layer:'m',ref:'D8'}];
    const a=mk({devices:ex}),b=mk({devices:ex});b.project.data.devices.reverse();
    const ra=run(a),rb=run(b),sig=r=>JSON.stringify(r.drops.map(d=>d.members.map(e=>e.id).sort()))+JSON.stringify(r.legs.map(l=>[l.kind,l.len,l.cond]))+JSON.stringify(r.boxes.map(x=>[x.kind,Math.round(x.x),Math.round(x.y)]));
    ok('7 reversing the device order changes nothing (drops, legs, boxes)',sig(ra)===sig(rb));
    ok('7 a chain 0 / 200 / 400: the third is 400 from the group start → its own drop',ra.drops.some(d=>d.members.map(e=>e.id).sort().join()==='S5,S6')&&ra.drops.some(d=>d.members.length===1&&d.members[0].id==='S7'),JSON.stringify(ra.drops.map(d=>d.members.map(e=>e.id))));
    const rh=run(mk({devices:[{id:'L9',type:'light',code:'LMP',level:'ground',x:6000,y:0,h:2800,hFix:true,layer:'m',ref:'L9'},{id:'S9',type:'socket',code:'SOC',level:'ground',x:7000,y:0,h:300,layer:'m',ref:'D1'}]}));
    ok('7 a wall lamp above the ceiling − 100: a warning with the limit',rh.warn.some(x=>/L9/.test(x.msg)&&/legfeljebb 2750/.test(x.msg)),rh.warn.map(x=>x.msg).join(' | '));
    ok('7 two endpoints with one ref: a warning naming both',rh.warn.some(x=>/^D1: 2 végpontnak ugyanez a jele/.test(x.msg)&&x.ids.length===2));
    const rs=run(mk({devices:[{id:'S10',type:'socket',code:'SOC',level:'ground',x:9000,y:0,h:300,layer:'m',ref:'D10'}]}));
    ok('7 two endpoints on one spot: said as an info line (and in the report)',rs.report.stacks.length===1&&rs.warn.some(x=>x.sev==='info'&&/egy helyen/.test(x.msg)));
  }
}

let failed=null;try{engine();}catch(err){failed=err;R.push(['engine exception',false,err.stack]);}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 try{
  ok('the bundle carries the T0 engine',w.BL&&typeof w.BL.plan.plan==='function'&&typeof w.BL.geom.faceMarks==='function');
  // ---- 4. one slot table; the engine's latch = the side the Planner's L4 slot is on, for every variant ----
  ok('4 PT_SLOTS IS the engine table (one object, not a copy)',w.eval('PT_SLOTS')===w.BL.rules.PORTAL_SLOTS);
  {w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
    D.floors.length=0;const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);
    const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
    D.floors.push({level:'ground',poly:rect(0,0,3600,3000),name:'Nappali',stage:'floor',clear:true,layer:'L0'});
    D.floors.push({level:'ground',poly:rect(3600,0,7200,3000),name:'Háló',stage:'floor',clear:true,layer:'L0'});
    D.floors.push({level:'ground',poly:rect(0,3000,7200,6000),name:'Konyha',stage:'floor',clear:true,layer:'L0'});
    w.wfwApply(w.wfwPlan('ground'),'ground');w.ensureIds(D);
    D.openings.push({type:'door',level:'ground',x:3700,y:1500,ang:Math.PI/2,variant:0,w:900,h:2100,dtype:'hinged',layer:'L0'});
    D.openings.push({type:'door',level:'ground',x:1800,y:3000,ang:0,variant:0,w:900,h:2100,dtype:'hinged',layer:'L0'});w.ensureIds(D);
    let all=true,bad=[];D.openings.filter(o=>o.type==='door').forEach(o=>{const axis=Math.abs(Math.cos(o.ang))>0.5?'x':'y';
      [0,1,2,3].forEach(v=>[o.ang,o.ang+Math.PI].forEach(a=>{o.variant=v;o.ang=a;const L4=w.ptSlots(o).filter(s=>s.k==='L4');
        const side=Math.sign(axis==='x'?L4[0].x-o.x:L4[0].y-o.y),lat=w.BL.prep.doorLatch(o,axis);
        if(!L4.length||L4.some(s=>Math.sign(axis==='x'?s.x-o.x:s.y-o.y)!==side)||side!==lat){all=false;bad.push(o.id+' v'+v+' a'+a.toFixed(2)+' slot '+side+' engine '+lat);}}));
      o.variant=0;});
    ok('4 engine latch = the L4 slot side (2 doors × 4 variants × 2 angles)',all,bad.join('; '));}
  // ---- 6. the report, the gate, the stale flag, the "mutasd" link (Planner) ----
  {w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
    const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
    WL.ground.push({x0:-100,y0:-100,x1:8100,y1:0,id:'W1'},{x0:-100,y0:0,x1:0,y1:3000,id:'W2'},{x0:4000,y0:0,x1:4100,y1:3000,id:'W3'},
      {x0:8000,y0:0,x1:8100,y1:3000,id:'W4'},{x0:-100,y0:3000,x1:8100,y1:3100,id:'W5'});
    D.floors.length=0;D.devices.length=0;D.circuits=[];D.paths.length=0;D.openings.length=0;D.marks=[];
    D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali',kinds:['nappali'],kind:'nappali',num:'RA',layer:'L0'},
      {level:'ground',poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'Háló',kinds:['halo'],kind:'halo',num:'RB',layer:'L0'});
    D.openings.push({type:'door',level:'ground',x:4050,y:1500,w:900,ang:Math.PI/2,variant:0});
    ['W1','W3'].forEach(id=>D.marks.push({kind:'wall',wall:id,level:'ground',tags:['vezetheto'],pol:'plus',layer:'L0'}));
    const dev=(code,x,y,h)=>{const d={type:w.epTypeFor(code),code,level:'ground',x,y,h,layer:'L0'};D.devices.push(d);return d;};
    D.devices.push({type:'board',level:'ground',x:1000,y:60,h:1600,layer:'L0'});
    const sA=dev('SOC',2500,0,300),sB=dev('SOC',6500,0,300),sX=dev('SOC',6000,1500,300);w.ensureIds(D);
    w.cktCreate({name:'Dugalj',mcb:{curve:'C',amps:16,poles:1,n:false},members:[sA.id,sB.id,sX.id]});
    const run=w.blRun('ground');const P=run.R&&run.R.report;
    ok('6 the run carries the report (metres, chases, fill, rooms)',P&&P.metres&&P.metres.geo>0&&P.chases.length&&P.fill.length&&P.rooms.length,run.err||'');
    ok('6 the socket in the middle of Háló is unreached, in the report too',P&&P.unreached.length===1&&P.unreached[0].id===sX.id&&/Háló/.test(P.unreached[0].n));
    const b1=w.blApplyRoutes(run);
    ok('6 an error blocks the drawing',b1.blocked&&b1.err&&!D.paths.some(p=>p.gen==='bl'),JSON.stringify(b1).slice(0,200));
    const b2=w.blApplyRoutes(run,{confirm:true});
    ok('6 … unless confirmed',!b2.err&&b2.paths>0&&D.paths.some(p=>p.gen==='bl'));
    ok('6 just drawn: not stale',(s=>s.drawn>0&&s.stale===0)(w.blStale('ground')));
    w.byId('devices',sB.id).x+=300;
    ok('6 after an edit: stale',(s=>s.stale===s.drawn&&s.drawn>0)(w.blStale('ground')));
    const run2=w.blRun('ground'),html=w.blReportHtml(run2);
    ok('6 the report says stale, lists the unreached socket, and has mutasd links',/elavultak/.test(html)&&/Bekötetlen végpontok/.test(html)&&/data-blshow=/.test(html));
    ok('6 a second run reports the drop-group change since the first',run2.dropChange&&Array.isArray(run2.dropChange.added));
    w.blShow(6000,1500,'ground');ok('6 mutasd centres the view on the place',Math.abs(w.eval('CXv')-6000)<1&&Math.abs(w.eval('CYv')-1500)<1);
    ok('6 the Pálya-ellenőrzés action is registered',typeof w.blReportDialog==='function'||w.eval("typeof blReportDialog")==='function');}
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
