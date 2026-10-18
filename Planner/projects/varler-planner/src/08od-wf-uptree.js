// ==========================================================================
// 08od-wf-uptree.js — wireway rebuild (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.4), WP-T1: the `up` field
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The dual model's topology half (Q1 = A, K1 with `up` from day one). Every node — an Erősáram endpoint, a junction
// (szobadoboz / kötődoboz / mennyezeti), an Alosztó — may carry ONE upstream: d.up = {id, room?, via?, fix?}
//   id    the node it is fed from: a device id, the board, or a DOOR (opening id) = that door's L4 box on face `room`
//         (the derived master of K1: "with no master, the latch L4 of the door is the master — today's behaviour, explicit")
//   via   a drawn route for this link (T6) — stored, not read yet
//   fix   true = "rögzített" (the user's, drawn solid); absent = "javasolt" (drawn dashed, a re-fill may replace it)
// Group, leader, master, sequence are DERIVED from the chain (upRole): master = a junction fed from the board; leader =
// the first node below a master, a door or the board. Control (sw.ctl, grp, swHead) stays separate from power.
// T1 fills the suggestions from what the engine does today (its legs: a vertical chain, a ceiling chain, the drop's
// service point); the engine reads `up` only from T2. Invariants (guard rail 2): one upstream per node (one field), no
// loops — upSet refuses them with a plain Hungarian reason.
const UP={view:false,tool:false};

function upDev(id){const d=id&&byId('devices',id);return d&&d.gen!=='bl'?d:null;}
function upDoor(id){return id?(data.openings||[]).find(o=>o&&o.id===id&&o.type==='door')||null:null;}
// may this device be a node of the tree? (endpoints with a code, junctions, boards, RBX / BASE — not the engine's own boxes)
function upIsNode(d){return !!d&&d.gen!=='bl'&&(d.type==='board'||d.type==='junction'||d.type==='rbx'||d.type==='base'||(typeof epCodeOf==='function'&&!!epCodeOf(d)));}
const upIsHub=d=>!!d&&(d.type==='rbx'||d.type==='base'||(d.type==='junction'&&d.jb==='szoba'));
function upName(up){if(!up)return '—';const d=upDev(up.id);if(d)return d.ref||d.id;const o=upDoor(up.id);return o?(o.id+' ajtó L4'+(up.room?' ('+up.room+')':'')):up.id+' ?';}
// the plan point of an upstream (a door: its L4 slot on the named room's face)
function upPt(up,level){if(!up)return null;const d=upDev(up.id);if(d)return {x:d.x,y:d.y,h:d.h||0};const o=upDoor(up.id);if(!o||typeof ptSlots!=='function')return null;
  const S=ptSlots(o).filter(s=>s.k==='L4'),s=S.find(x=>x.room===up.room)||S[0];return s?{x:s.x,y:s.y,h:s.h}:{x:o.x,y:o.y,h:2100};}
// the chain from a node to its root: [id, parent, …]; loop:true when it comes back on itself
function upChain(id){const out=[],seen=new Set();let cur=id;
  while(cur){if(seen.has(cur))return {ids:out,loop:true};seen.add(cur);out.push(cur);const d=upDev(cur);cur=d&&d.up?d.up.id:null;}
  return {ids:out,loop:false};}
function upRole(id){const d=upDev(id);if(!d)return upDoor(id)?'door':null;if(d.type==='board')return d.sub&&d.up?'master':'board';
  const p=d.up&&upDev(d.up.id),pt=d.up&&upDoor(d.up.id);
  if((d.type==='junction'||upIsHub(d))&&p&&p.type==='board')return 'master';
  if(pt||(p&&(p.type==='board'||upRole(p.id)==='master')))return 'leader';
  return d.up?'member':'none';}

// ---- editing (guard rail 2: the editor cannot break the tree) ------------------------------------------------------------
// → {ok, d} or {err} (Hungarian). opt.fix: store as rögzített; opt.noUndo: inside a caller's undo step.
function upSet(childId,up,opt){opt=opt||{};const d=upDev(childId);if(!d)return {err:'Nincs ilyen elem.'};
  if(!upIsNode(d))return {err:(d.ref||d.id)+': ez nem eleme a betáp-fának.'};
  if(d.type==='board'&&!d.sub)return {err:'Az Elosztónak nincs betápja a fában — ő a gyökér.'};
  if(!up||!up.id)return {err:'Nincs megadva, honnan kap betápot.'};
  if(up.id===d.id)return {err:(d.ref||d.id)+' nem táplálhatja önmagát.'};
  const p=upDev(up.id),o=upDoor(up.id);if(!p&&!o)return {err:'A betáp forrása ('+up.id+') nincs a tervben.'};
  if(p&&!upIsNode(p))return {err:(p.ref||p.id)+' nem lehet betápforrás.'};
  if((p&&p.level!==d.level&&!(d.type==='board'&&d.sub))||(o&&o.level!==d.level))return {err:'A betáp forrása másik szinten van.'};
  if(p){const ch=upChain(p.id);if(ch.ids.indexOf(d.id)>=0)return {err:'Hurok: '+(p.ref||p.id)+' már '+(d.ref||d.id)+' alól kap betápot ('+ch.ids.map(id=>{const x=upDev(id);return x?(x.ref||x.id):id;}).join(' → ')+').'};}
  if(!opt.noUndo)pushUndo(['devices']);
  const rec={id:up.id};if(up.room)rec.room=up.room;if(up.via)rec.via=up.via;if(opt.fix)rec.fix=true;d.up=rec;
  if(!opt.noUndo)draw();return {ok:true,d};}
function upClear(id,opt){const d=upDev(id);if(!d||!d.up)return false;if(!(opt&&opt.noUndo))pushUndo(['devices']);delete d.up;if(!(opt&&opt.noUndo))draw();return true;}
function upFix(id,on,opt){const d=upDev(id);if(!d||!d.up)return false;if(!(opt&&opt.noUndo))pushUndo(['devices']);if(on===false)delete d.up.fix;else d.up.fix=true;if(!(opt&&opt.noUndo))draw();return true;}

// ---- auto-fill from today's logic (guard rail 1: auto-filled, drawn dashed) ---------------------------------------------
// Read off one engine run: each device's first leg says what feeds it — the previous device of a vertical / ceiling
// chain, or a box, whose service point is a door (its L4), a szobadoboz / RBX, or the board. A switched lamp is fed
// through its switch's box: up = the head switch, or the box its leg meets in (08n jbMeet: chosen / szobadoboz). A
// szobadoboz is a master: up = the board. → {map: id → {id, room?, why}, run} or {err}
function upSuggest(level,run){level=level||state.active;run=run||(typeof blRun==='function'?blRun(level):{err:'nincs motor'});if(run.err)return {err:run.err};
  const R=run.R,map={},board=data.devices.find(d=>d&&d.type==='board'&&d.level===level);
  const boxById={};R.boxes.forEach(b=>boxById[b.id]=b);const dropBy={};R.drops.forEach(d=>dropBy[d.key]=d);
  const spUp=(sp,room)=>{if(!sp)return null;if(sp==='__board')return board?{id:board.id}:null;if(upDoor(sp))return {id:sp,room};return upDev(sp)?{id:sp}:null;};
  const fromBox=b=>{if(!b)return null;if(b.sp)return spUp(b.sp,b.room);if(b.drop){const d=dropBy[b.drop];return d&&spUp(d.sp,d.spFace&&d.spFace.room);}
    if(b.kind==='island'){const fl=R.legs.find(l=>l.kind==='floor'&&l.to===b.id);return fl?fromBox(boxById[fl.from]):null;}return null;};
  const firstLeg={};R.legs.forEach(l=>{const k=l.dev||(upDev(l.to)?l.to:null);if(k&&!firstLeg[k])firstLeg[k]=l;});
  run.E.forEach(e=>{const live=upDev(e.id);if(!live||!R.C.byMember[e.id])return;let s=null,why='';
    const head=R.L.ctlOf[e.id]&&R.L.ctlOf[e.id][0];
    // a switched ceiling lamp further down its chain hangs on the lamp before it (T2 keeps the chain, not a star)
    const fl=firstLeg[e.id];if(e.code==='LMP'&&head&&fl&&fl.kind==='ceil'&&upDev(fl.from)&&R.L.ctlOf[fl.from]&&R.L.ctlOf[fl.from].join('+')===R.L.ctlOf[e.id].join('+')){s={id:fl.from};why='mennyezeti lánc (ugyanaz a kapcsolás)';}
    if(!s&&e.code==='LMP'&&head&&upDev(head)){const m=typeof jbMeet==='function'?jbMeet(live):null;
      s=m&&m.box&&upDev(m.box.id)?{id:m.box.id}:{id:head};why=m&&m.box?'a lámpaág találkozási doboza':'a kapcsolója dobozán át';}
    // a chain passes devices of OTHER circuits too (one box, one vertical conduit): power comes from the previous device of
    // the same circuit only — else from the drop's service point. A plate switch without a leg of its own: the same.
    // a SWITCHED lamp carries the switched line: it feeds only lamps of its own switching unit, never its switch or a socket
    const unitOf=id=>R.L.ctlOf[id]?R.L.ctlOf[id].join('+'):null,canFeed=p=>R.C.byMember[p]===circ&&(!unitOf(p)||(e.code==='LMP'&&unitOf(p)===unitOf(e.id)));
    const circ=R.C.byMember[e.id],dropUp=()=>{const d=e.drop&&dropBy[e.drop];return d?spUp(d.sp,d.spFace&&d.spFace.room):null;};
    if(!s){const l=firstLeg[e.id];if(l){if(upDev(l.from)&&l.from!==e.id&&canFeed(l.from)){s={id:l.from};why=l.kind==='ceil'?'mennyezeti lánc':'függőleges lánc a dobozból';}
      else if(upDev(l.from)&&l.from!==e.id){let p=l.from,n=0;while(upDev(p)&&!canFeed(p)&&firstLeg[p]&&n++<20)p=firstLeg[p].from;
        if(upDev(p)&&canFeed(p)){s={id:p};why='függőleges lánc a dobozból (egy más körű pont fölött)';}else{s=dropUp();why='a leállás szervizpontja (a lánc más kört is visz)';}}
      else if(l.from==='Elosztó'&&board){s={id:board.id};why='az Elosztóból';}else{s=fromBox(boxById[l.from]);why='a leállás szervizpontja';}}}
    if(!s&&e.drop){s=dropUp();why='a leállás szervizpontja (közös keret)';}
    if(s){s.why=why;map[e.id]=s;}});
  // masters: every szobadoboz hangs on the board (K1); a ceiling box on the switch of the leg that meets in it
  data.devices.forEach(d=>{if(!d||d.level!==level||d.gen==='bl'||!(d.type==='junction'||upIsHub(d)))return;
    if(upIsHub(d)&&board)map[d.id]={id:board.id,why:(d.type==='junction'?'szobadoboz':d.type.toUpperCase())+' = mester, az Elosztóból'};
    else if(d.jb==='ceiling'){const l=data.devices.find(x=>x&&x.meet===d.id),h=l&&R.L.ctlOf[l.id]&&R.L.ctlOf[l.id][0];if(h&&upDev(h))map[d.id]={id:h,why:'a kapcsoló dobozából'};}});
  return {map,run};}
// apply the suggestions to every node that has no rögzített up; an old suggestion with nothing behind it goes. ONE undo.
// opt.run: an engine run to read (Pályák passes its own); opt.noUndo: inside the caller's undo step (and no view switch)
function upFill(level,opt){opt=opt||{};level=level||state.active;const S=upSuggest(level,opt.run);if(S.err)return {err:S.err};
  if(!opt.noUndo)pushUndo(['devices']);let set=0,kept=0,gone=0,refused=[];const was={};
  data.devices.forEach(d=>{if(d&&d.level===level&&upIsNode(d))was[d.id]=JSON.stringify(d.up||null);});
  data.devices.forEach(d=>{if(!d||d.level!==level||!upIsNode(d)||(d.up&&d.up.fix))return;if(d.up&&!S.map[d.id]){delete d.up;gone++;}});
  // in two passes so a loop check sees the new tree: clear the auto ones first, then set
  Object.keys(S.map).forEach(id=>{const d=upDev(id);if(d&&d.up&&!d.up.fix)delete d.up;});
  Object.entries(S.map).forEach(([id,s])=>{const d=upDev(id);if(!d)return;if(d.up&&d.up.fix){kept++;return;}
    const r=upSet(id,{id:s.id,room:s.room},{noUndo:true});if(r.ok)set++;else refused.push((d.ref||d.id)+': '+r.err);});
  const changed=Object.keys(was).filter(id=>{const d=upDev(id);return d&&JSON.stringify(d.up||null)!==was[id];}).length;
  if(!opt.noUndo){UP.view=true;draw();}return {set,kept,gone,changed,refused,run:S.run};}
// "Elfogadom mind" for one room: every suggestion there becomes rögzített (guard rail 1)
function upAcceptRoom(rid,level){level=level||state.active;pushUndo(['devices']);let n=0;
  data.devices.forEach(d=>{if(!d||d.level!==level||!d.up||d.up.fix)return;if(upRoomOfDev(d)===rid){d.up.fix=true;n++;}});
  draw();return n;}
function upRoomOfDev(d){const e=typeof roomOfDevice==='function'?roomOfDevice(d):null;if(e&&e.rm)return blFloorId(e.rm);return typeof blRoomAt==='function'?blRoomAt(d.x,d.y,d.level):null;}

// ---- states and checks -------------------------------------------------------------------------------------------------
// guard rail 3: four visible states — none (no upstream), auto (javasolt), fix (rögzített), unreached (the last run)
function upState(d,unreached){if(unreached&&unreached.has(d.id))return 'unreached';if(!d.up)return 'none';return d.up.fix?'fix':'auto';}
function upUnreached(level){const r=typeof BL_LAST!=='undefined'&&BL_LAST&&BL_LAST.level===level?BL_LAST.R:null;return new Set(((r&&r.unreached)||[]).map(u=>u.id));}
// [{sev, code, msg, id}]: a loop or a dangling id (err / warn), a chain that crosses circuits (warn), nodes with none (info)
function upCheck(level){level=level||state.active;const out=[],ref=d=>d.ref||d.id;let none=0;
  data.devices.forEach(d=>{if(!d||d.level!==level||!upIsNode(d))return;
    if(!d.up){if(d.type!=='board'&&cktOfDevice(d)&&epCodeOf(d)!=='SHU')none++;return;}   // redőny: its own layer (WP-E5 6.), not routed here
    if(!upDev(d.up.id)&&!upDoor(d.up.id)){out.push({sev:'warn',code:'up.dangling',id:d.id,msg:ref(d)+': a betáp forrása ('+d.up.id+') már nincs a tervben.'});return;}
    const ch=upChain(d.id);if(ch.loop){out.push({sev:'err',code:'up.loop',id:d.id,msg:ref(d)+': hurok a betáp-fában ('+ch.ids.map(id=>{const x=upDev(id);return x?ref(x):id;}).join(' → ')+').'});return;}
    const p=upDev(d.up.id),cd=cktOfDevice(d),cp=p&&cktOfDevice(p);
    if(cd&&cp&&cd!==cp)out.push({sev:'warn',code:'up.circuit',id:d.id,msg:ref(d)+' ('+(cd.ref||'')+') '+ref(p)+' ('+(cp.ref||'')+') alól kap betápot — a lánc átlép egy másik körbe.'});});
  if(none)out.push({sev:'info',code:'up.none',msg:'Betáp-fa: '+none+' végpontnak még nincs betápja — ⚙ Betáp-fa javaslat.'});
  return out;}
(STK_CHECKS['sys:SOC']=STK_CHECKS['sys:SOC']||[]).push(()=>data.devices.some(d=>d&&d.up)?upCheck(state.active):[]);

// ---- drawing: a line to the upstream, dashed = javasolt, solid = rögzített; a ring for the state ------------------------
const UP_COL={auto:'#7a6a55',fix:'#2c2c2c',none:'#9e9e9e',unreached:'#c62828'};
STK_OVERLAY.push(()=>{if(!UP.view&&!UP.tool)return '';const lvl=state.active,z=h=>dz(lvl,h||0),un=upUnreached(lvl);let s='';
  data.devices.forEach(d=>{if(!d||d.level!==lvl||!upIsNode(d)||d.type==='board')return;const st=upState(d,un),a=planToBase(d.x,d.y,z(d.h));
    if(d.up){const t=upPt(d.up,lvl);if(t){const b=planToBase(t.x,t.y,z(t.h));
      s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${UP_COL[d.up.fix?'fix':'auto']}" stroke-width="${vsP(d.up.fix?1.4:1)}"${d.up.fix?'':` stroke-dasharray="${vsDash('4 3')}"`} marker-end="url(#upArr)"/>`;}}
    if(st==='none'&&!cktOfDevice(d))return;
    s+=`<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="${vsP(st==='unreached'?7:5)}" fill="none" stroke="${UP_COL[st]}" stroke-width="${vsP(st==='fix'?1.6:1.1)}"${st==='auto'?` stroke-dasharray="${vsDash('2 2')}"`:''}/>`;});
  return s?`<defs><marker id="upArr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#555"/></marker></defs><g pointer-events="none">${s}</g>`:'';});

// ---- the tool: one click on a device = its suggestion becomes rögzített (and back) --------------------------------------
function upToolStart(){toolsOff();if(state.mode!=='select')setMode('select');UP.tool=true;
  const mh=$('modeHint');if(mh)mh.textContent='Betáp-fa — kattints egy végpontra: a javasolt (szaggatott) betáp rögzített lesz, újra kattintva vissza · Esc: kész';draw();}
function upToolOff(){UP.tool=false;const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';}
STK_TOOLS.push({k:'upTool',active:()=>{if(!UP.tool)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){upToolOff();return false;}return true;},
  // the first tree node under the pointer (a wall mark or a generated box on top must not hide it)
  down(e){if(e.button!==0)return false;const [bx,by]=clientToBase(e),C=typeof hitCands==='function'?hitCands(e,bx,by):[];
    const c=C.find(c=>c.h&&c.h.t==='devices'&&upIsNode(data.devices[c.h.i])),d=c?data.devices[c.h.i]:null;
    if(!d||!upIsNode(d)){$('hud').textContent='Kattints egy végpontra vagy dobozra.';return true;}
    if(!d.up){$('hud').textContent=(d.ref||d.id)+': még nincs betápja — ⚙ Betáp-fa javaslat, vagy a menüből.';return true;}
    upFix(d.id,!d.up.fix);$('hud').textContent=(d.ref||d.id)+' ← '+upName(d.up)+(d.up.fix?' · rögzített':' · javasolt');return true;},
  esc(){upToolOff();draw();},mode(){upToolOff();}});

// ---- menus and actions ---------------------------------------------------------------------------------------------------
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!upIsNode(d)||d.type==='board')return;
  if(d.up){items.push({label:(d.up.fix?'● Betáp rögzítve: ':'◌ Betáp (javasolt): ')+upName(d.up)+(d.up.fix?' — feloldás':' — rögzítés'),act:()=>upFix(d.id,!d.up.fix)});
    items.push({label:'✕ Betáp törlése',act:()=>upClear(d.id)});}
  const rid=upRoomOfDev(d);if(rid&&data.devices.some(x=>x&&x.level===d.level&&x.up&&!x.up.fix&&upRoomOfDev(x)===rid))
    items.push({label:'✓ Elfogadom mind ebben a helyiségben ('+rid+')',act:()=>{const n=upAcceptRoom(rid,d.level);$('hud').textContent='Betáp-fa: '+n+' javaslat rögzítve ('+rid+').';}});});
registerActions([
 {id:'up.fill',label:'Betáp-fa javaslat',icon:'⚙',group:'Pálya',alias:'up tree topology betap fa javaslat felfele',
  hint:'Minden végpont betápja a mai számításból: szaggatott = javasolt, a rögzítettekhez nem nyúl.',when:c=>!c.inEditor,
  run:()=>{const r=upFill(state.active);$('hud').textContent=r.err?r.err:'Betáp-fa: '+r.set+' javaslat'+(r.kept?', '+r.kept+' rögzített megmaradt':'')+(r.gone?', '+r.gone+' régi javaslat törölve':'')+(r.refused.length?' · '+r.refused.length+' elutasítva':'');}},
 {id:'up.tool',label:'Betáp-fa rögzítése',icon:'📌',group:'Pálya',alias:'up tree fix rogzit betap',hint:'Kattintás egy végpontra: a javasolt betáp rögzített lesz (és vissza).',when:c=>!c.inEditor,run:()=>upToolStart()},
 {id:'up.view',label:'Betáp-fa megjelenítése',icon:'🌳',group:'Pálya',alias:'up tree show betap fa',hint:'A betáp-kapcsolatok vonalai: szaggatott = javasolt, folytonos = rögzített.',when:c=>!c.inEditor,run:()=>{UP.view=!UP.view;draw();}}]);

window.upSet=upSet;window.upClear=upClear;window.upFix=upFix;window.upChain=upChain;window.upRole=upRole;window.upSuggest=upSuggest;
window.upFill=upFill;window.upAcceptRoom=upAcceptRoom;window.upCheck=upCheck;window.upState=upState;window.UP=UP;
