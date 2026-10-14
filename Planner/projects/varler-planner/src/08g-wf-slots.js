// ==========================================================================
// 08g-wf-slots.js — workflow round (docs/workflow), WP-O2: the door IS the portal; the window's redőny slot
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// A door carries the positions of every later layer from the moment it is placed: latch (kilincs) side 230 V, hinge
// (zsanér) side SELV / LV, the head in the middle — the all-in-one Portal of the P33 baseline engine. PT_SLOTS is that
// engine's table (tools/baseline/rules.js PORTAL_SLOTS, u = mm from the opening EDGE, from the centre for the head);
// spec-86 keeps the two equal until E5 makes the engine read this copy. NOTE: 06a's own zone offset PT_OFF is 200 mm;
// the slots use the engine's 150 (450 for the panel column), which is what the P33 offers were built on.
// Q-O02 = A: placing a door makes its portal on every face that has a room (tier SF-0 „előkészítve”), in the same undo
// step as the door. Slots are POSITIONS, not devices — drawn as faint dots while a layer that uses them is active.
// Q-O03 = A: a window's W1 (redőny betáp) slot exists only when the window carries the redőny tag.
const PT_SLOTS=[
  {k:'H0',side:'hinge',u:150,h:2450,fam:'CONTROL',n:'Fészek — portál vezérlőpont, SELV átvezetés',codes:['POR:rs485']},
  {k:'H3',side:'hinge',u:150,h:1450,fam:'SENSOR',n:'Levegő-modul (FLT-A) / termosztát',codes:['THR','SEN:co2']},
  {k:'H2',side:'hinge',u:150,h:1150,fam:'BUSB',n:'Értesítő fény + közeledés / kopogás (FLT-N)',codes:['NTL']},
  {k:'H1',side:'hinge',u:150,h:300,fam:'BUSB',n:'Lábfény + alacsony PIR (FLT-L)',codes:['LMP:b']},
  {k:'T1',side:'head',u:0,h:2150,fam:'SENSOR',n:'Fej-modul: ToF pár, függöny-PIR, lux (FLT-H)',codes:['POR:tof']},
  {k:'T2',side:'head',u:0,h:2400,fam:'MEDIA',n:'Fejzseb: hangszóró / sziréna / tartalék',codes:['SPK']},
  {k:'L4',side:'latch',u:150,h:2450,fam:'MAINS',n:'Erősáramú leállás-doboz (2 szerelvényes), 230 V átvezetés',codes:[]},
  {k:'L1',side:'latch',u:150,h:1100,fam:'MAINS',n:'Kapcsoló (1–3 gang, váltó)',codes:['SWI']},
  {k:'L3',side:'latch',u:150,h:300,fam:'MAINS',n:'Ajtó melletti dugalj',codes:['SOC']},
  {k:'L2',side:'latch',u:450,h:1450,fam:'CONTROL',n:'Kezelőpanel / belépési pont (külön SELV oszlop)',codes:['PAN']}];
const PT_WIN_SLOT={k:'W1',u:150,h:2500,fam:'MAINS',n:'Redőny betáp (a redőnyszekrény mellett)',codes:['SHU']};
const PT_FAM_ROLES={MAINS:['sys:MAINS','sys:SOC','sys:LIGHT','sys:DED'],CONTROL:['sys:CONTROL','sys:HMI'],SENSOR:['sys:SENSOR'],BUSB:['sys:BUSB'],MEDIA:['sys:MEDIA']};

// the slots of one door face: G = ptDoorGeo(o, roomId)
function ptSlotsOf(G){if(!G)return [];const thick=wallInfo(G.r).thick;
  return PT_SLOTS.map(s=>{const u=s.side==='hinge'?G.uh+G.away*s.u:s.side==='latch'?G.ul-G.away*s.u:G.uc;
    const p=mrkFacePt(G.r,G.wallSide,u,-thick/2);
    return {k:s.k,side:s.side,fam:s.fam,n:s.n,codes:s.codes,h:s.h,u:Math.round(u),x:Math.round(p[0]),y:Math.round(p[1]),
      level:G.level,wall:G.wall,face:G.wallSide,door:G.o.id,room:G.rid};});}
// every face of a door that opens into a room → its slots
function ptSlots(o){if(!o||o.type!=='door'||typeof mrkDoorRooms!=='function')return [];const out=[];
  mrkDoorRooms(o).forEach(e=>{const rid=e&&stkRoomId(e);if(!rid)return;const G=ptDoorGeo(o,rid);if(G)ptSlotsOf(G).forEach(s=>out.push(s));});
  return out;}
// a window's W1: beside the head, on the side with more wall left, on the face that looks into a room
function ptWinSlot(o){if(!o||o.type!=='window')return null;
  const tags=typeof mrkOpeningTags==='function'?mrkOpeningTags(o.id):[];if(tags.indexOf('redony')<0)return null;
  const r=opnHost(o);if(!r)return null;const wi=wallInfo(r),L=typeof mrkWallLen==='function'?mrkWallLen(r):Math.hypot(wi.seg[1][0]-wi.seg[0][0],wi.seg[1][1]-wi.seg[0][1]);
  const uc=mrkU(r,o.x,o.y),half=(o.w||WIN_W)/2,dir=(uc<L-uc)?1:-1,u=uc+dir*(half+PT_WIN_SLOT.u);
  let face=1;for(const sd of [1,-1]){const q=mrkFacePt(r,sd,uc,300);if(allRooms(o.level).some(e=>e.rm.poly&&pointInPoly(q[0],q[1],e.rm.poly))){face=sd;break;}}
  const p=mrkFacePt(r,face,u,-wi.thick/2);
  return Object.assign({},PT_WIN_SLOT,{x:Math.round(p[0]),y:Math.round(p[1]),u:Math.round(u),level:o.level,wall:r.id,face,window:o.id});}
// Q-O02 = A: every room face of this door gets its portal (SF-0) unless it has one; no undo of its own
function ptAutoDoor(o){if(!o||o.type!=='door'||typeof mrkDoorRooms!=='function')return 0;let n=0;
  mrkDoorRooms(o).forEach(e=>{const rid=e&&stkRoomId(e);if(!rid)return;const G=ptDoorGeo(o,rid);if(!G||ptOf(o.id,G.wallSide))return;
    ptPlace(G,{noUndo:true,quiet:true,tier:'SF-0'});n++;});return n;}
// which slot families the active layer shows (the hardware layer shows them all)
function ptSlotFams(){const L=typeof lyrLayer==='function'?lyrLayer(state.activeLayer):null,role=L&&L.role;if(!role)return [];
  if(role==='hw')return Object.keys(PT_FAM_ROLES);return Object.keys(PT_FAM_ROLES).filter(f=>PT_FAM_ROLES[f].indexOf(role)>=0);}
function ptSlotAt(p,level,fams){level=level||state.active;fams=fams||ptSlotFams();let best=null,bd=Math.max(80,12/(state.zoom||1)/SC);
  (data.openings||[]).forEach(o=>{if(o.level!==level)return;(o.type==='door'?ptSlots(o):[ptWinSlot(o)]).forEach(s=>{if(!s||fams.indexOf(s.fam)<0)return;
    const d=Math.hypot(s.x-p[0],s.y-p[1]);if(d<bd){bd=d;best=s;}});});return best;}

// a door placed with the Ajtó tool gets its portals in the placement's own undo step (that pushUndo() was unscoped)
let PT_AUTO_N=-1;   // openings count at pointer-down: only a door THIS click added gets portals
STK_TOOLS.push({k:'ptAutoDoor',active:()=>state.mode==='build'&&state.buildType==='door',
  down:()=>{PT_AUTO_N=(data.openings||[]).length;return false;},
  up:()=>{const n=(data.openings||[]).length,o=data.openings[n-1];if(PT_AUTO_N>=0&&n>PT_AUTO_N&&o&&o.type==='door'){if(ptAutoDoor(o))draw();}PT_AUTO_N=-1;return false;}});
// faint slot dots for the families the active layer uses
STK_OVERLAY.push(()=>{const fams=ptSlotFams();if(!fams.length)return '';let s='';const lvl=state.active;
  (data.openings||[]).forEach(o=>{if(o.level!==lvl)return;(o.type==='door'?ptSlots(o):[ptWinSlot(o)]).forEach(t=>{if(!t||fams.indexOf(t.fam)<0)return;
    const b=planToBase(t.x,t.y,dz(lvl,0)),col=t.fam==='MAINS'?'#d1493f':'#7a5cc0';
    s+=`<g class="pt-slot"><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(3.2)}" fill="#fff" stroke="${col}" stroke-width="${vsP(1.2)}" stroke-dasharray="${vsDash('2 1.5')}"/>`
      +`<text x="${(b[0]+vsP(5)).toFixed(1)}" y="${(b[1]-vsP(4)).toFixed(1)}" font-size="${vsP(7.5)}" fill="${col}" paint-order="stroke" stroke="#fff" stroke-width="${vsP(2)}">${t.k}</text></g>`;});});
  return s;});
