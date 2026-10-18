// ==========================================================================
// 08ob-wf-engine.js — workflow round (docs/workflow), WP-E5: the Erősáram engine in the Planner
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The P33 baseline engine (tools/baseline: rules · geom · network · prep · plan) runs here unchanged: build.js puts it in
// place of the marker below as `BL` (Q-E05 = A, bundle, don't port). This file is only the glue:
//   blInput(level)  the Planner's own data → the engine's sketch shape (E5_ENGINE_REVIEW §4): Vezethető fal marks only
//                   (Q7), room kinds, sw.ctl, data.circuits, the szobadoboz as a service point (Q5), Padló út lines →
//                   floor groups, Mennyezeti út crossings → ceiling links (Q9), heights as placed (R4 owns them)
//   button 1        "Pályák kiszámítása": conduit paths (trunk = Csatorna layer, the rest = ARM) + boxes, gen:'bl'; a
//                   re-run replaces only gen:'bl' items. The result table + the Q1 / Q2 checks.
//   button 2        "Vezetékek": the cables into those conduits — scope Eszköz | Helyiség | Ház.
// Redőny (SHU) endpoints are left out: their control is on another layer now (WP-E5 item 6).
/*__BASELINE__*/

const BL_KCOL={trunk:'#c0392b',dist:'#e67e22',drop:'#8e44ad',ceil:'#2980b9',floor:'#16a085',island:'#16a085',riser:'#7f8c8d',feed:'#2c3e50'};
const BL_BOX_HU={sp:'szervizpont',drop:'leállás',corner:'sarok',end:'pályavég',pull:'húzódoboz',tj:'gerinc elágazó',island:'padló út vége',rbx:'RBX'};
const BL_KIND_HU={trunk:'gerinc',dist:'leágazó',drop:'leállás',ceil:'mennyezet',floor:'padló',island:'padló út vége',riser:'felszálló',feed:'fővezeték'};
const BL_OPT={cornerAll:false};                       // E5-Q4: the P33 rule (a box at every corner) — the BRIDGE option
let BL_LAST=null;                                     // the last run: {level, sig, R, ...} — button 2 reads it

function blFloorId(f){return f.num||f.id;}
function blRoomAt(x,y,level){const f=(data.floors||[]).find(f=>f&&f.level===level&&f.poly&&BL.geom.inPoly(x,y,f.poly));return f?blFloorId(f):null;}
// the service point a floor line starts from: the door / RBX / BASE / szobadoboz it names, else the nearest one
function blSpNear(p,level,from){
  if(from&&from.door)return from.door;
  const sp=d=>d&&(d.type==='rbx'||d.type==='base'||(d.type==='junction'&&d.jb==='szoba'));
  if(from&&from.dev){const d=byId('devices',from.dev);if(sp(d))return d.id;}
  let best=null,bd=1e9;
  (data.openings||[]).forEach(o=>{if(o.level!==level||o.type!=='door')return;const q=Math.hypot(o.x-p[0],o.y-p[1]);if(q<bd){bd=q;best=o.id;}});
  data.devices.forEach(d=>{if(!d||d.level!==level||!sp(d))return;const q=Math.hypot(d.x-p[0],d.y-p[1]);if(q<bd){bd=q;best=d.id;}});
  return best;}
// a small stable hash of the engine input: button 2 refuses to wire conduits made from another plan
function blHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
function blMcbStr(m){return m&&typeof m==='object'?mcbText(m):String(m||'');}

// ---- the adapter ------------------------------------------------------------------------------------------------------
function blInput(level){level=level||state.active;
  const P=JSON.parse(JSON.stringify(sessionObj())),D=P.data,notes=[];
  // the engine's own earlier output is not input
  D.devices=(D.devices||[]).filter(d=>d&&d.gen!=='bl');D.paths=[];
  // layers: one MAINS layer for the engine (M1 split it in three), hardware off the endpoint list, redőny out
  P.layers=(P.layers||[]).concat([{id:'bl:mains',role:'sys:MAINS'},{id:'bl:hw',role:'bl:hw'},{id:'bl:off',role:'bl:off'}]);
  let shu=0,avc=0;
  D.devices.forEach(d=>{const live=byId('devices',d.id)||d,code=epCodeOf(live);
    if(!code){d.layer='bl:hw';return;}
    const role=epRoleOf(live);
    if(code==='SHU'){if(d.level===level)shu++;d.layer='bl:off';return;}
    if(live.cin&&live.cin.av){if(d.level===level)avc++;d.layer='bl:off';return;}   // C7: the cinema's own pass routes its AV circuits (08r)
    if(mnsIs(role))d.layer='bl:mains';
    d.hFix=true;});                                  // heights: as placed — the Standards (R4) set them, not the engine
  if(shu)notes.push(shu+' redőny végpont kimarad: a redőnyvezérlés külön rétegen van (WP-E5 6.).');
  if(avc)notes.push(avc+' házimozi AV kör kimarad: a Házimozi réteg saját útvonalon vezeti az Elosztóig (C7).');
  const off=new Set(D.devices.filter(d=>d.layer==='bl:off').map(d=>d.id));
  // WP-E6: a level's own circuits only (a circuit with end points on two levels is listed — each level has its own board)
  const onLv=new Set(D.devices.filter(d=>d.level===level).map(d=>d.id));
  D.circuits=(D.circuits||[]).filter(c=>{const ms=c.members||[],n=ms.filter(id=>onLv.has(id)).length;
    if(n&&n<ms.length)notes.push((c.ref||'')+' '+(c.name||'')+': végpontjai két szinten vannak — itt csak az ezen a szinten lévőket vezeti.');return n>0;});
  // circuits: the Planner's, as the engine reads them (lighting by its preset / its members, the breaker as text)
  D.circuits=D.circuits.map(c=>{const ms=(c.members||[]).filter(id=>!off.has(id)),codes=ms.map(id=>epCodeOf(byId('devices',id)));
    const light=c.kind==='light'||c.preset==='vil'||(/^V\d+$/.test(c.ref||'')&&codes.length&&codes.every(k=>k==='LMP'||k==='SWI'))||(codes.length&&codes.every(k=>k==='LMP'||k==='SWI')&&codes.indexOf('LMP')>=0);
    return Object.assign({},c,{members:ms,mcb:blMcbStr(c.mcb),kind:light?'light':c.kind});});
  // heights of the runs: from the ceiling (Q3), unless the Standards table carries a project value
  // WP-E6: an Alosztó's level — the feeder arrives through the slab at its feed point (on the level below, straight under)
  const brd=data.devices.find(d=>d&&d.level===level&&d.type==='board');let feedEp=null;
  if(brd&&brd.sub){feedEp=byId('devices',brd.feedEp);if(!feedEp)notes.push((brd.ref||brd.id)+': az Alosztónak nincs betáp-pontja — a betáp nem számolható.');}
  const pv=hv=>{const o=(typeof stdList==='function'?stdList():[]).find(o=>o.code==='PATH'&&o.hv===hv&&o.scope==='project');return o?o.h:null;};
  const cfg={level,ceiling:LH[level]||2850,trunkH:pv('trunk'),distH:pv('dist'),cornerBoxes:BL_OPT.cornerAll?'all':'pull',maxCablesPerPipe:3,
    bedZoneMark:'agy',shutterSwitch:false,mainFeed:true,floorGroups:[],ceilLinks:[]};
  if(feedEp)cfg.subFeed={x:feedEp.x,y:feedEp.y,n:'Felszálló '+(feedEp.ref||feedEp.id),cable:'NYM5x6',slab:Math.max(slbT(level),slbT(feedEp.level))||300,ep:feedEp.id,fromAbove:ORD.indexOf(feedEp.level)>ORD.indexOf(level)};
  // switching (E1): sw.ctl + lamp legs (d.grp) + sw.swType → the engine's explicit switch groups. Switches sharing a leg
  // are one unit (2 = váltó, more = kereszt in the middle); one switch with two legs = csillár. chain[0] = the box the
  // lamps hang from: the switch marked swHead, else the end nearest to the lamps.
  // a wall device faces the room the Planner gives it (05h roomOfDevice: its offset from the wall centre, d.side on the
  // centreline) — not merely the nearest face, which is a coin toss at a corner
  cfg.fixFace={};D.devices.forEach(d=>{if(d.level!==level||d.layer!=='bl:mains')return;const live=byId('devices',d.id);if(!live||live.side==null)return;
    const r=typeof roomOfDevice==='function'?roomOfDevice(live):null;if(r&&r.rm&&(data.floors||[]).indexOf(r.rm)>=0)cfg.fixFace[d.id]=blFloorId(r.rm);});
  cfg.switchGroups=blSwitchGroups(D,level);cfg.rbxSwitched={};
  D.devices.forEach(d=>{if(d.level===level&&d.rbxSw&&d.layer==='bl:mains')cfg.rbxSwitched[d.id]='RBX-kimenetről kapcsolt (Planner)';});
  // Padló út (E2) → floor groups: from the service point down into the floor, along the line, up at its junction. A line
  // with a bend before its target has its junction box at that last bend; lines from the same start to the same junction
  // share one group (the island: one floor run, then a short leg to each device). A straight line: the box at the target.
  const fg={};
  (typeof clnMarks==='function'?clnMarks(level,'floor'):[]).forEach(m=>{const d=byId('devices',m.to);if(!d||off.has(d.id)||!m.pts||m.pts.length<2)return;
    const a=m.pts[0],sp=blSpNear(a,level,m.from);if(!sp){notes.push((d.ref||d.id)+': a padló útnak nincs szervizpontja.');return;}
    const bend=m.pts.length>=3,j=bend?m.pts[m.pts.length-2]:[d.x,d.y],key=sp+'|'+a.join(',')+'|'+j.join(',');
    if(fg[key]){fg[key].members.push(d.id);return;}
    cfg.floorGroups.push(fg[key]={name:'PU:'+m.id,sp,room:blRoomAt(a[0]+Math.sign(m.pts[1][0]-a[0])*200,a[1]+Math.sign(m.pts[1][1]-a[1])*200,level)||undefined,members:[d.id],
      box:{x:j[0],y:j[1],h:m.boxH||(bend?300:Math.min(300,d.h||300)),n:'Padló út '+(bend?'kötődoboz':'vége — '+(d.ref||d.id))},line:bend?m.pts.slice(0,-1):m.pts});});
  // Mennyezeti út between two wall points (Q9 = A) → a trunk ceiling crossing. It hops OVER something (the stair void),
  // so each end lands on the far face of its wall — the room on the side away from the line (P33: R03 at both ends);
  // an end with nothing beyond (an outside wall) stays in the room the line enters
  (typeof clnMarks==='function'?clnMarks(level,'ceil'):[]).filter(m=>m.cross&&m.pts&&m.pts.length>=2).forEach(m=>{const P2=m.pts,a=P2[0],b=P2[P2.length-1],a1=P2[1],b1=P2[P2.length-2];
    const probe=(p,q)=>blRoomAt(p[0]-Math.sign(q[0]-p[0])*250,p[1]-Math.sign(q[1]-p[1])*250,level)||blRoomAt(p[0]+Math.sign(q[0]-p[0])*250,p[1]+Math.sign(q[1]-p[1])*250,level);
    cfg.ceilLinks.push({a,b,aRoom:probe(a,a1),bRoom:probe(b,b1),n:'Mennyezeti átvezetés ('+(m.id||'')+')',short:'átvezetés'});});
  const sig=blHash(JSON.stringify([level,P.building&&P.building.walls&&P.building.walls[level],D.floors,D.openings,D.marks,D.circuits,
    D.devices.filter(d=>d.level===level).map(d=>[d.id,d.type,d.code,d.var,d.x,d.y,d.h,d.layer,d.ctl,d.jb]),cfg]));
  return {doc:{project:P},cfg,notes,sig};}

function blSwitchGroups(D,level){const mains=new Map();D.devices.forEach(d=>{if(d.level===level&&d.layer==='bl:mains')mains.set(d.id,d);});
  const code=d=>epCodeOf(byId('devices',d.id)||d),lamp=id=>{const d=mains.get(id);return d&&code(d)==='LMP'?d:null;};
  const legOf=l=>l.grp?'G:'+l.grp:'L:'+l.id,legs={};
  mains.forEach(s=>{if(code(s)!=='SWI'||s.var==='shu'||!Array.isArray(s.ctl))return;
    s.ctl.map(lamp).filter(Boolean).forEach(l=>{const k=legOf(l),o=legs[k]||(legs[k]={lamps:new Set(),sw:new Set()});o.sw.add(s.id);
      if(l.grp)mains.forEach(x=>{if(x.grp===l.grp&&code(x)==='LMP')o.lamps.add(x.id);});else o.lamps.add(l.id);});});
  const units={};Object.values(legs).forEach(o=>{const k=[...o.sw].sort().join('+');const u=units[k]||(units[k]={sw:[...o.sw],lamps:new Set(),legs:0});u.legs++;o.lamps.forEach(x=>u.lamps.add(x));});
  return Object.values(units).map(u=>{const L=[...u.lamps].map(id=>mains.get(id)),cx=L.reduce((a,l)=>a+l.x,0)/L.length,cy=L.reduce((a,l)=>a+l.y,0)/L.length;
    const S=u.sw.map(id=>mains.get(id)),t=s=>String(s.swType||''),dist=s=>Math.hypot(s.x-cx,s.y-cy);
    let chain;if(S.length===1)chain=[S[0].id];
    else{const mid=S.filter(s=>t(s)==='107'),ends=S.filter(s=>t(s)!=='107').sort((a,b)=>(b.swHead?1:0)-(a.swHead?1:0)||dist(a)-dist(b));
      chain=[ends[0]].concat(mid,ends.slice(1)).map(s=>s.id);}
    return {lamps:[...u.lamps],chain,mode:S.length>2?'3way':S.length===2?'2way':u.legs>1?'double':'single',why:'Planner kapcsolás'};});}

// ---- run --------------------------------------------------------------------------------------------------------------
function blRun(level){const r=blRunRaw(level,0);return r.err?r:(BL_LAST=r);}
// WP-E6: on an Alosztó's level the feeder's own drop (its circuit on the level below) is added to every circuit here
function blRunRaw(level,depth){const I=blInput(level),cfg=I.cfg,t0=Date.now();
  if(cfg.subFeed&&depth<3){const ep=byId('devices',cfg.subFeed.ep),up=ep?blRunRaw(ep.level,depth+1):null,c=ep&&cktOfDevice(ep);
    const row=up&&!up.err&&c&&up.R.checks.find(r=>r.circ===c.ref);
    if(row){cfg.upstreamDropPct=row.dU;I.notes.push('Alosztó betáp ('+c.ref+'): '+String(row.dU).replace('.',',')+' % feszültségesés — minden kör értékéhez hozzáadva.');cfg._feedLm=row.Lm;}
    else I.notes.push('Az Alosztó betápjának feszültségesése nem számolható (a lenti szint nem fut le) — a körök értéke nélküle.');}
  const board=I.doc.project.data.devices.find(d=>d.level===cfg.level&&d.type==='board');
  if(!board)return {err:'Nincs Elosztó / Alosztó ezen a szinten — tedd le előbb (Villamosság → ⚡ Elosztó, más szinten ⚡ Alosztó).'};
  let G,E,PT,R,allowed;
  try{G=BL.geom.load(I.doc,cfg.level);allowed=BL.geom.allowedFromSketch(G,[]).allowed;
    if(!Object.keys(allowed).length)return {err:'Nincs vezethető fal ezen a szinten — jelöld a 🟩 Vezethető fal tollal (Szabályok).'};
    E=BL.prep.endpoints(G,cfg);BL.prep.applyHeights(E);PT=BL.prep.portals(G,E);BL.prep.portalMembers(G,PT,E);
    // no placeInPortals: the Planner's devices stay where the user put them (slot snap, O2)
    R=BL.plan.plan(G,E,PT,cfg,allowed);}
  catch(err){return {err:'A számítás megállt: '+(err&&err.message||err)};}
  blShapeLines(R,cfg);
  // E6-Q1 C: the suggested feeder for this Alosztó, from its floor load and these very voltage-drop figures
  if(cfg._feedLm!=null&&typeof alsSuggest==='function'){const al=board&&byId('devices',board.id),own=R.checks.map(r=>r.dU-(r.dUup||0));
    const s=al&&alsSuggest(al.id,cfg._feedLm,own.length?Math.max(...own):0);if(s)I.notes.unshift(alsSuggestText(s));}
  return {level:cfg.level,sig:I.sig,cfg,notes:I.notes,G,E,PT,R,allowed,ms:Date.now()-t0};}
// the user's own lines become the drawn route: a floor leg follows its Padló út, a ceiling leg its Mennyezeti út
function blShapeLines(R,cfg){const W=R.W;
  R.legs.forEach(l=>{
    if(l.kind==='floor'&&/^PU:/.test(l.group||'')){const g=cfg.floorGroups.find(x=>x.name===l.group);if(!g)return;
      const a=l.poly[0],z=l.poly[l.poly.length-1],pts=g.line;let flat=0;for(let i=1;i<pts.length;i++)flat+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
      l.poly=[[a[0],a[1],a[2]],[a[0],a[1],0]].concat(pts.map(p=>[p[0],p[1],0])).concat([[z[0],z[1],z[2]]]);
      l.len=Math.round(a[2]+Math.hypot(pts[0][0]-a[0],pts[0][1]-a[1])+flat+z[2]);l.bends=pts.length+1;l.line=true;}
    if(l.kind==='ceil'&&l.dev&&typeof clineFor==='function'){const m=clineFor(l.dev);if(!m||!m.pts||m.pts.length<2)return;const h=m.h||cfg.ceiling,s=m.pts[0];
      let flat=0;for(let i=1;i<m.pts.length;i++)flat+=Math.hypot(m.pts[i][0]-m.pts[i-1][0],m.pts[i][1]-m.pts[i-1][1]);
      l.poly=[[s[0],s[1],W.dist],[s[0],s[1],h]].concat(m.pts.slice(1).map(p=>[p[0],p[1],h]));l.len=Math.round(Math.max(0,h-W.dist)+flat);l.line=true;}});}

// ---- button 1: the conduits -------------------------------------------------------------------------------------------
function blTargetLayers(level){const board=data.devices.find(d=>d&&d.level===level&&d.type==='board');
  const S=(board&&lyrLayer(board.layer)&&stkById(lyrLayer(board.layer).stack))||(typeof stkActive==='function'?stkActive():null);
  const fb=(board&&board.layer)||state.activeLayer||'L0',lay=k=>(S&&stkLayer(S.id,k)||{}).id||fb;
  return {ch:lay('channel'),arm:lay('arm'),box:lay('sys:SOC')};}
function blClear(level){const n0=data.devices.length+data.paths.length;
  data.devices=data.devices.filter(d=>!(d&&d.gen==='bl'&&d.level===level));
  data.paths=data.paths.filter(p=>!(p&&p.gen==='bl'&&(p.nodes||[]).some(n=>n.level===level)));
  return n0-data.devices.length-data.paths.length;}
function blApplyRoutes(run){const R=run.R,lv=run.level,L=blTargetLayers(lv);
  pushUndo(['devices','paths']);const gone=blClear(lv);
  R.boxes.filter(b=>b.kind!=='rbx').forEach(b=>{const sz=BL.rules.BOX[b.kind==='sp'?'portalMains':b.size]||BL.rules.BOX.gang2;
    data.devices.push({type:'junction',jbShape:'rect',jbSize:b.kind==='pull'?200:sz.jbSize,level:lv,x:Math.round(b.x),y:Math.round(b.y),h:Math.round(b.h),
      layer:L.box,ref:b.id,note:b.n+' ['+(BL_BOX_HU[b.kind]||b.kind)+']',faceBack:false,gen:'bl',bl:{run:run.sig,box:b.id,kind:b.kind}});});
  let np=0;R.legs.forEach(l=>(l.pipes||[]).forEach((p,k)=>{
    const nodes=l.poly.map(q=>({level:lv,x:Math.round(q[0]),y:Math.round(q[1]),h:Math.round(q[2])}));if(nodes.length<2)return;
    data.paths.push({ptype:'gege',nodes,sections:nodes.slice(1).map(()=>({build:'sull_gege',cond:p.cond,fill:p.fill,leg:l.id,kind:l.kind})),
      layer:l.kind==='trunk'||l.kind==='feed'?L.ch:L.arm,lane:k,route:l.kind==='trunk'?'channel':'arm',color:BL_KCOL[l.kind]||'#555',gen:'bl',
      bl:{run:run.sig,leg:l.id,kind:l.kind,pipe:k,circ:p.circ.slice()}});np++;}));
  ensureIds(data);if(typeof invalidateShell==='function')invalidateShell();draw();
  return {boxes:R.boxes.filter(b=>b.kind!=='rbx').length,paths:np,replaced:gone};}

// ---- button 2: the cables, by scope ----------------------------------------------------------------------------------
// which legs a scope covers: Ház = all; Helyiség = the legs touching the room (their boxes, their device, their run);
// Eszköz = the device's own route — its drop / ceiling / floor legs, the room runs of its circuit to its box, its trunk
function blScopeLegs(run,scope,target){const R=run.R,legs=R.legs;if(scope==='haz')return legs.slice();
  const boxById={};R.boxes.forEach(b=>boxById[b.id]=b);const devRoom={};run.E.forEach(e=>devRoom[e.id]=e.room);
  const g=R.net.g;
  if(scope==='room'){const rid=target;return legs.filter(l=>{const rs=new Set();[l.from,l.to].forEach(id=>{if(boxById[id])rs.add(boxById[id].room);if(devRoom[id])rs.add(devRoom[id]);});
    if(l.dev&&devRoom[l.dev])rs.add(devRoom[l.dev]);(l.pts||[]).forEach(i=>{if(g.N[i]&&g.N[i].room)rs.add(g.N[i].room);});return rs.has(rid);});}
  const e=run.E.find(x=>x.id===target);if(!e)return [];const c=R.C.byMember[e.id],ref=c&&c.ref;
  const box=e.drop&&R.boxes.find(b=>b.drop===e.drop),carries=l=>(l.pipes||[]).some(p=>p.circ.indexOf(ref)>=0);
  return legs.filter(l=>l.dev===e.id||(ref&&carries(l)&&((l.kind==='drop'&&box&&(l.from===box.id||run.E.some(x=>x.id===l.from&&x.drop===e.drop)))
    ||(l.kind==='dist'&&box&&(l.to===box.id||l.from===box.id))||l.kind==='trunk'||l.kind==='feed')));}
function blCabN(c){const m=/^NYM(\d)x(\d+)$/.exec(c||'');if(!m)return c;const v=m[2]==='15'?'1,5':m[2]==='25'?'2,5':m[2];return 'NYM-J '+m[1]+'×'+v;}
function blApplyWires(run,scope,target){
  const mine=data.paths.filter(p=>p&&p.gen==='bl'&&p.bl&&(p.nodes||[]).some(n=>n.level===run.level));
  if(!mine.length)return {err:'Előbb a pályák: ⚙ Pályák kiszámítása.'};
  if(mine.some(p=>p.bl.run!==run.sig))return {err:'A terv változott a pályák óta — futtasd újra a ⚙ Pályák kiszámítását.'};
  const legs=blScopeLegs(run,scope,target),byId={};legs.forEach(l=>byId[l.id]=l);
  const circId=ref=>{const c=cktList().find(c=>c.ref===ref);return c&&c.id||null;};
  pushUndo(['paths']);const tot={};let n=0;
  mine.forEach(p=>{const l=byId[p.bl.leg];if(!l)return;const pp=(l.pipes||[])[p.bl.pipe];if(!pp)return;
    const txt=pp.cables.map(c=>(c.n>1?c.n+'× ':'')+blCabN(c.c)).join(' + ');
    p.sections.forEach(s=>{s.cables=txt;s.circuits=pp.circ.slice();s.circuit=pp.circ.length===1?circId(pp.circ[0]):null;});
    p.bl.wired=true;n++;pp.cables.forEach(c=>{if(c.c==='SPARE')return;tot[c.c]=(tot[c.c]||0)+(c.n||1)*l.len;});});
  draw();return {paths:n,legs:legs.length,metres:Object.keys(tot).sort().map(k=>[blCabN(k),Math.round(tot[k]/100)/10])};}

// ---- the dialogs ------------------------------------------------------------------------------------------------------
function blChecksHtml(R){const ck=R.checks||[];if(!ck.length)return '';const n=v=>String(v).replace('.',',');
  return `<div style="margin-top:8px;font-size:12px"><b>Ellenőrzés</b> <span style="color:#888">— áramterhelhetőség csövenként (In ≤ Iz·k), feszültségesés ≤ ${BL.rules.VDROP.limitPct} % (E5-Q1, Q2, Q10, Q11) ⚑</span></div>`
    +`<table class="blChk" style="font-size:11px;width:100%;border-collapse:collapse;margin-top:3px"><tr style="color:#777"><td>Kör</td><td>In</td><td>mm²</td><td>kör/cső</td><td>Iz·k</td><td></td><td>m</td><td>ΔU %</td><td></td></tr>`
    +ck.map(r=>`<tr${r.okI&&r.okU?'':' style="background:#fdecea"'}><td><b>${esc(r.circ)}</b></td><td>${r.In}${r.Ib<r.In?' <span style="color:#888">('+n(r.Ib.toFixed(1))+')</span>':''}</td><td>${n(r.mm2)}</td><td>${r.n}</td><td>${r.Izk==null?'—':n(r.Izk)}</td><td>${r.okI?'✓':'✗'}</td>`
      +`<td>${n(r.Lm)}</td><td>${n(r.dU)}</td><td>${r.okU?'✓':'✗ '+esc(r.fixU||'')}</td></tr>`).join('')+`</table>`;}
function blWarnHtml(run){const W=run.notes.map(m=>({sev:'info',msg:m})).concat(run.R.warn);if(!W.length)return '';
  return `<div style="margin-top:8px;font-size:12px"><b>${W.length} figyelmeztetés</b></div><div style="max-height:22vh;overflow:auto;font-size:11px">`
    +W.map(w=>`<div style="color:${w.sev==='err'?'#b00020':w.sev==='warn'?'#8a5a00':'#666'}">${w.sev==='err'?'⛔':w.sev==='warn'?'⚠':'ℹ'} ${esc(w.msg)}</div>`).join('')+`</div>`;}
function blSummary(R){const cnt=(a,k)=>a.filter(x=>x.kind===k).length,bx=R.boxes.filter(b=>b.kind!=='rbx');
  const parts=['sp','drop','pull','corner','end','tj','island'].map(k=>[k,cnt(bx,k)]).filter(x=>x[1]).map(x=>x[1]+' '+(BL_BOX_HU[x[0]]||x[0]));
  return `${R.C.list.length} kör · ${R.legs.reduce((a,l)=>a+(l.pipes||[]).length,0)} csőszakasz (${R.legs.length} szakasz, ${Math.round(R.legs.reduce((a,l)=>a+l.len,0)/1000)} m) · ${bx.length} doboz (${parts.join(', ')})`;}
function blRoutesDialog(){const run=blRun(state.active);if(run.err){$('hud').textContent=run.err;openModal('Pályák kiszámítása',`<div style="font-size:12px">${esc(run.err)}</div>`,()=>{},'Rendben');return null;}
  const have=data.paths.some(p=>p&&p.gen==='bl'&&(p.nodes||[]).some(n=>n.level===run.level));
  openModal('Pályák kiszámítása',`<div style="font-size:12px">${blSummary(run.R)} <span style="color:#888">· ${run.ms} ms</span></div>`
    +`<div style="font-size:11px;color:#666;margin-top:4px">Gerinc ${run.R.W.trunk} · leágazó ${run.R.W.dist} mm (mennyezet ${run.cfg.ceiling} − 250 / − 400) · csak a vezethető falakon (🟩) · `
    +`a gerinc a Csatorna, a többi az ARM rétegre kerül.${have?' Az előző számítás pályái és dobozai lecserélődnek; a kézzel rajzolt pályák maradnak.':''}</div>`
    +`<label style="display:block;font-size:12px;margin-top:6px"><input type="checkbox" id="blCornerAll"${BL_OPT.cornerAll?' checked':''}> Doboz minden saroknál (BRIDGE rétegek, E5-Q4 A)</label>`
    +blChecksHtml(run.R)+blWarnHtml(run),()=>{
      const cb=document.getElementById('blCornerAll'),want=!!(cb&&cb.checked);let r=run;
      if(want!==BL_OPT.cornerAll){BL_OPT.cornerAll=want;r=blRun(run.level);if(r.err){$('hud').textContent=r.err;return;}}
      const res=blApplyRoutes(r);$('hud').textContent='Pályák: '+res.paths+' cső, '+res.boxes+' doboz'+(res.replaced?' (az előző '+res.replaced+' elem lecserélve)':'')+' — Vezetékek: 🧵';},'Pályák felrajzolása');
  return run;}
function blWiresDialog(){const sel=selected&&selected.t==='devices'?data.devices[selected.i]:null,fl=selected&&selected.t==='floors'?data.floors[selected.i]:null;
  const dev=sel&&epCodeOf(sel)?sel:null,rm=fl?blFloorId(fl):(dev?blRoomAt(dev.x,dev.y,dev.level):null);
  const opt=(v,n,on,dis)=>`<label style="margin-right:12px;${dis?'color:#aaa':''}"><input type="radio" name="blScope" value="${v}"${on?' checked':''}${dis?' disabled':''}> ${n}</label>`;
  openModal('Vezetékek',`<div style="font-size:12px">A kábelek behúzása a kiszámított pályákba (körönként; kábeltípus a kör szerint, kapcsolóknál az erek száma szerint).</div>`
    +`<div style="font-size:12px;margin-top:8px">${opt('dev','Eszköz'+(dev?' — '+esc(dev.ref||dev.id):''),!!dev,!dev)}${opt('room','Helyiség'+(rm?' — '+esc(rm):''),!dev&&!!rm,!rm)}${opt('haz','Ház',!dev&&!rm,false)}</div>`
    +`<div style="font-size:11px;color:#888;margin-top:4px">Eszköz / Helyiség: jelöld ki előbb a végpontot vagy a helyiséget.</div>`,()=>{
      const s=(document.querySelector('input[name=blScope]:checked')||{}).value||'haz';
      const run=blRun(state.active);if(run.err){$('hud').textContent=run.err;return;}
      const res=blApplyWires(run,s,s==='dev'?dev&&dev.id:rm);if(res.err){$('hud').textContent=res.err;return;}
      $('hud').textContent='Vezetékek: '+res.paths+' cső · '+res.metres.map(m=>m[0]+' '+String(m[1]).replace('.',',')+' m').join(' · ');},'Behúzás');}

registerActions([
 {id:'bl.routes',label:'Pályák kiszámítása',icon:'⚒',group:'Pálya',alias:'engine wireways routes compute palyak szamitas erosaram baseline',
  hint:'Az Erősáram pályái a vezethető falakon: gerinc az Elosztótól, leágazók, leállások, dobozok, csőméret — és az ellenőrzés (terhelhetőség, feszültségesés).',
  when:c=>!c.inEditor,run:()=>blRoutesDialog()},
 {id:'bl.wires',label:'Vezetékek',icon:'🧶',group:'Pálya',alias:'wiring cables vezetekek kabel behuzas',
  hint:'A kábelek a kiszámított pályákba: a kijelölt eszközé, a helyiségé vagy az egész házé.',when:c=>!c.inEditor,run:()=>blWiresDialog()}]);

window.blInput=blInput;window.blRun=blRun;window.blApplyRoutes=blApplyRoutes;window.blApplyWires=blApplyWires;window.blScopeLegs=blScopeLegs;
window.BL=BL;window.BL_OPT=BL_OPT;
// a lamp with no wall switch, switched by an RBX output (P33: the bathroom fan, the wardrobe light) — the engine then
// does not guess a switch for it
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d||epCodeOf(d)!=='LMP')return;
  items.push({label:(d.rbxSw?'✓ ':'')+'RBX-kimenetről kapcsolt (nincs fali kapcsoló)',act:()=>{pushUndo(['devices']);if(d.rbxSw)delete d.rbxSw;else d.rbxSw=true;draw();}});});
window.blSwitchGroups=blSwitchGroups;
