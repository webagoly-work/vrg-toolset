// ==========================================================================
// 08n-wf-boxes.js — workflow round (docs/workflow), WP-E3: Dobozok — Elosztó, portal boxes, szobadoboz, switching boxes
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The boxes of the Erősáram layer, on the existing device types (junction: jbSize / jbShape; board = the Elosztó) with a
// role field d.jb:
//   'szoba'   — the SZOBADOBOZ, the user's "pre-evolution RBX" (E06, 2026-10-14): wall crossing (faláttörés), the room
//               feed (szoba betáplálás) and lamp ↔ switch interconnection — NEVER socket distribution: sockets chain
//               Elosztó → first room socket → … → last (classic, non-BRIDGE). Size by job count (Q-E08 = C): one job
//               150×150, two or more 200×200; d.sizeFix keeps a hand size. Later layers upgrade it in place to an RBX.
//   'kot'     — a plain kötődoboz (min 100×100) the user places
//   'ceiling' — "Kötődoboz ehhez a kapcsoláshoz": a ⌀80 ceiling box where one lamp leg meets its switches
// The PORTAL box is derived, not stored: the L4 slot of every door face that already has an Erősáram device in a slot
// (E5 turns it into a real box with the wiring — no material before the wiring step). Deviation from WP-E3 step 1.
// SERVICE POINTS (jbServicePoints) = Elosztó + portal boxes + szobadobozok + RBX + BASE: a wall is crossed only there.
// A leg MEETS (jbMeet) in: the box the user chose (lamp.meet) → the room's szobadoboz → its switch's portal box.
const JB_H={szoba:2150,kot:2450,ceiling:null,board:1500};
const JB_N={szoba:'Szobadoboz',kot:'Kötődoboz',ceiling:'Mennyezeti kötődoboz',board:'Elosztó'};
const JB_T={on:false,kind:'szoba'};

function jbIs(d,k){return !!d&&(k==='board'?d.type==='board':d.type==='junction'&&d.jb===k);}
function jbRoomOf(d){const e=typeof roomOfDevice==='function'?roomOfDevice(d):null;return e&&e.rm?e.rm:null;}
function jbSzobaOf(rm,level){return rm?data.devices.find(d=>jbIs(d,'szoba')&&d.level===level&&jbRoomOf(d)===rm)||null:null;}
// the rooms on both faces of a wall-mounted device (a box on a partition crosses it)
function jbFaces(d){const hw=typeof deviceHostWall==='function'?deviceHostWall(d):null;if(!hw)return [];
  const out=[];[1,-1].forEach(s=>{const q=[hw.px+hw.wi.perp[0]*s*(hw.wi.thick/2+60),hw.py+hw.wi.perp[1]*s*(hw.wi.thick/2+60)];
    const e=allRooms(d.level).find(x=>x.rm.poly&&pointInPoly(q[0],q[1],x.rm.poly));if(e&&out.indexOf(e.rm)<0)out.push(e.rm);});return out;}
// the legs (lamp groups) meeting in a box
function jbLegsIn(box){const legs=new Set();data.devices.forEach(l=>{if(!lswLamp(l))return;const m=jbMeet(l);if(m&&m.box===box)legs.add(lswLegOf(l));});return [...legs];}
// the jobs of a szobadoboz: feed (always — it IS the room's box), crossing (on a wall between two rooms), switching
function jbJobs(d){const j=['szoba betáplálás'];if(jbFaces(d).length>1)j.push('faláttörés');if(jbLegsIn(d).length)j.push('kapcsolók és lámpák összekötése');return j;}
function jbAutoSize(d){if(!jbIs(d,'szoba'))return d.jbSize||100;return jbJobs(d).length>1?200:150;}
function jbResize(){data.devices.forEach(d=>{if(jbIs(d,'szoba')&&!d.sizeFix)d.jbSize=jbAutoSize(d);});}

// ---- service points + meeting ------------------------------------------------------------------------------------------------
// [{kind, x, y, h, level, ref, dev?|door/face}] — the only places a route may cross a wall
function jbPortalBoxes(level){const out=[];(data.openings||[]).forEach(o=>{if(o.type!=='door'||(level&&o.level!==level)||typeof ptSlots!=='function')return;
  const S=ptSlots(o);[...new Set(S.map(s=>s.face))].forEach(face=>{
    const used=data.devices.some(d=>d&&d.slot&&d.slot.door===o.id&&d.slot.face===face);if(!used)return;
    const L4=S.find(s=>s.face===face&&s.k==='L4');if(L4)out.push({kind:'portal',x:L4.x,y:L4.y,h:L4.h,level:o.level,door:o.id,face,ref:(o.id||'')+'·L4'});});});
  return out;}
function jbServicePoints(level){const out=jbPortalBoxes(level);
  data.devices.forEach(d=>{if(!d||(level&&d.level!==level))return;
    const k=d.type==='board'?'board':jbIs(d,'szoba')?'szoba':(d.type==='rbx'||d.type==='base')?d.type:null;
    if(k)out.push({kind:k,x:d.x,y:d.y,h:d.h,level:d.level,dev:d.id,ref:d.ref||d.id});});
  return out;}
// where a device's leg meets: {kind, box?|portal?, why} — sockets never (classic chain), null when nothing fits
function jbMeet(d){if(!d)return null;const c=typeof epCodeOf==='function'?epCodeOf(d):null;
  if(c==='SOC'||c==='DED')return {kind:'chain',why:'dugalj / dedikált: klasszikus lánc az Elosztóból — nem dobozon át'};
  const leg=lswLamp(d)?lswLeg(d):[d];
  const pin=leg.map(l=>l.meet&&byId('devices',l.meet)).find(Boolean);if(pin)return {kind:pin.jb||pin.type,box:pin,why:'kijelölve'};
  const rm=jbRoomOf(d),sz=jbSzobaOf(rm,d.level);if(sz)return {kind:'szoba',box:sz,why:'a helyiség szobadoboza'};
  const sw=data.devices.find(s=>lswSw(s)&&s.slot&&(s.ctl||[]).some(id=>leg.some(l=>l.id===id)));
  if(sw){const pb=jbPortalBoxes(d.level).find(p=>p.door===sw.slot.door&&p.face===sw.slot.face);if(pb)return {kind:'portal',portal:pb,why:'a kapcsoló ajtajának portáldoboza (L4)'};}
  return null;}

// ---- placing ------------------------------------------------------------------------------------------------------------------
function jbMake(kind,o){const L=typeof epRoleLayer==='function'?epRoleLayer('sys:LIGHT'):null;
  const d=kind==='board'?{type:'board',level:o.level,x:Math.round(o.x),y:Math.round(o.y),h:o.h||JB_H.board,layer:state.activeLayer}
    :{type:'junction',jb:kind,level:o.level,x:Math.round(o.x),y:Math.round(o.y),h:o.h!=null?o.h:JB_H[kind],jbSize:kind==='ceiling'?80:kind==='kot'?100:150,
      jbShape:kind==='ceiling'?'circle':'square',layer:L?L.id:state.activeLayer};
  if(o.side!=null)d.side=o.side;data.devices.push(d);ensureIds(data);d.ref=typeof nextRef==='function'?nextRef(d.type):d.id;return d;}
function jbPlace(kind,o){pushUndo(['devices']);const d=jbMake(kind,o);jbResize();draw();
  $('hud').textContent=JB_N[kind]+' '+(d.ref||d.id)+(jbIs(d,'szoba')?' · '+d.jbSize+'×'+d.jbSize+' ('+jbJobs(d).join(', ')+')':'');return d;}
function jbSetSize(d,s){if(!d||d.type!=='junction')return false;pushUndo(['devices']);if(s==null){delete d.sizeFix;jbResize();}else{d.jbSize=Math.max(100,+s);d.sizeFix=true;}draw();return true;}
// "Kötődoboz ehhez a kapcsoláshoz": a ceiling box for the leg, on its ceiling line when there is one, else at the centroid
function jbCeilBox(lampId){const l=byId('devices',lampId);if(!lswLamp(l))return null;const leg=lswLeg(l);
  let c=[leg.reduce((a,x)=>a+x.x,0)/leg.length,leg.reduce((a,x)=>a+x.y,0)/leg.length];
  const ln=leg.map(x=>typeof clineFor==='function'?clineFor(x.id):null).find(Boolean);
  if(ln){let best=null,bd=Infinity;for(let i=1;i<ln.pts.length;i++){const f=wfpFoot(c,ln.pts[i-1],ln.pts[i]);if(f.d<bd){bd=f.d;best=f.q;}}if(best)c=best;}
  const H=typeof clnHeight==='function'?clnHeight(l,'ceil').h:wallH(l.level);
  pushUndo(['devices']);const d=jbMake('ceiling',{level:l.level,x:c[0],y:c[1],h:H});leg.forEach(x=>x.meet=d.id);jbResize();draw();
  $('hud').textContent='Mennyezeti kötődoboz '+(d.ref||d.id)+' · '+leg.length+' lámpa találkozik benne';return d;}

// ---- the tool: click a wall face for a szobadoboz / kötődoboz / Elosztó ----------------------------------------------------------
function jbToolStart(kind){['mrkToolsOff','epToolOff','rwlToolOff','rbOff','lswToolOff','clnOff'].forEach(f=>{if(typeof window[f]==='function')try{window[f]();}catch(_){}});
  if(state.mode!=='select')setMode('select');JB_T.on=true;JB_T.kind=kind||'szoba';
  const mh=$('modeHint');if(mh)mh.textContent=JB_N[JB_T.kind]+' — kattints a fal oldalára, ahová kerül'+(JB_T.kind==='szoba'?' (két helyiség közötti falon faláttörés is)':'')+' · Esc: kész';draw();}
function jbToolOff(){JB_T.on=false;const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';}
STK_TOOLS.push({k:'jbTool',active:()=>{if(!JB_T.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){jbToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const pk=mrkPick(e);if(!pk||pk.opening){$('hud').textContent='Kattints egy fal oldalára.';return true;}
    const r=mrkWallById(pk.level,pk.id),q=mrkFacePt(r,pk.side,pk.u,-wallInfo(r).thick/2);
    jbPlace(JB_T.kind,{level:pk.level,x:q[0],y:q[1],side:pk.side>0?1:0});return true;},
  esc(){jbToolOff();draw();},mode(){jbToolOff();}});
// overlay while in the electrical phase: service points (diamond) and where each leg meets (dotted)
STK_OVERLAY.push(()=>{if(!(JB_T.on||(typeof LSW!=='undefined'&&LSW.on)||state.wfPhase==='vill'))return '';const lvl=state.active,z=h=>dz(lvl,h||0);let s='';
  jbServicePoints(lvl).forEach(p=>{const b=planToBase(p.x,p.y,z(p.h)),r=vsP(5);
    s+=`<path d="M${b[0].toFixed(1)} ${(b[1]-r).toFixed(1)}l${r} ${r}l${-r} ${r}l${-r} ${-r}z" fill="${p.kind==='portal'?'#fff':'#2c2c2c'}" fill-opacity="0.85" stroke="#2c2c2c" stroke-width="${vsP(1)}"/>`;});
  const seen=new Set();data.devices.forEach(l=>{if(!lswLamp(l)||l.level!==lvl)return;const k=lswLegOf(l);if(seen.has(k))return;seen.add(k);const m=jbMeet(l);if(!m||m.kind==='chain')return;
    const t=m.box||m.portal;const a=planToBase(l.x,l.y,z(l.h)),b=planToBase(t.x,t.y,z(t.h));
    s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#555" stroke-width="${vsP(0.8)}" stroke-dasharray="${vsDash('1 3')}"/>`;});
  return s?`<g pointer-events="none">${s}</g>`:'';});
// check: a lamp leg with nowhere to meet (info)
(STK_CHECKS['sys:LIGHT']=STK_CHECKS['sys:LIGHT']||[]).push(()=>{const out=[],seen=new Set();data.devices.forEach(l=>{if(!lswLamp(l))return;const k=lswLegOf(l);if(seen.has(k))return;seen.add(k);
  if(!jbMeet(l))out.push({sev:'info',code:'jb.none',msg:(l.ref||l.id)+': az ágnak nincs találkozási doboza — szobadoboz, kapcsoló az ajtón, vagy mennyezeti kötődoboz kell.'});});return out;});
// device menu: the ceiling box for a lamp's leg
if(typeof STK_DEVMENU!=='undefined')STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(lswLamp(d))items.push({label:'⊙ Kötődoboz ehhez a kapcsoláshoz',act:()=>jbCeilBox(d.id)});
  if(jbIs(d,'szoba'))items.push({label:'↔ Szobadoboz mérete: '+(d.sizeFix?'kézi — vissza automatikusra':'automatikus ('+d.jbSize+')'),act:()=>jbSetSize(d,d.sizeFix?null:(d.jbSize===150?200:150))});});

(function(){if(typeof WF_PHASES==='undefined')return;const P=WF_PHASES.find(p=>p.k==='vill');if(!P)return;const i=P.tools.findIndex(t=>t.off==='E3');
  if(i>=0)P.tools.splice(i,1,{n:'4.3 Szobadoboz',run:()=>jbToolStart('szoba')},{n:'▣ Kötődoboz',run:()=>jbToolStart('kot')},{n:'⚡ Elosztó',run:()=>jbToolStart('board')});})();
registerActions([{id:'wf.boxSzoba',label:'Szobadoboz',icon:'▣',group:'Készülék',alias:'room box szobadoboz pre rbx',
  hint:'Faláttörés, szoba betáplálás, lámpák és kapcsolók összekötése — dugaljt nem oszt. 150×150 egy feladatra, 200×200 többre.',when:c=>!c.inEditor,run:()=>jbToolStart('szoba')},
  {id:'wf.boxKot',label:'Kötődoboz lerakása',icon:'▣',group:'Készülék',alias:'junction box kotodoboz',hint:'Kötődoboz (min. 100×100) a fal egyik oldalán.',when:c=>!c.inEditor,run:()=>jbToolStart('kot')},
  {id:'wf.board',label:'Elosztó lerakása',icon:'⚡',group:'Készülék',alias:'board elosztoszekreny',hint:'Az Elosztó helye a falon.',when:c=>!c.inEditor,run:()=>jbToolStart('board')}]);
