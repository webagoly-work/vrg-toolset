// ==========================================================================
// 08e-wf-openings.js — workflow round (docs/workflow), WP-O1: Ajtó / Ablak as their own tools
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// With the ghost on screen (Q-O01 = A): ←/→ cycles the type (DOORTYPE for doors, OPN_WINTYPE for windows), ↑/↓ cycles
// the four opening sides — door `variant` bits (04-render.js): bit1 = hinge at the far jamb, bit0 = the side it opens
// to. The order 0 → 1 → 3 → 2 flips ONE thing per press. The pick is remembered per tool (state.buildPick) and rides on
// the ghost and the placed opening through opnPickOf() (two hooks in 08-interaction.js). Without a ghost the arrows keep
// their old meaning (camera / U4).
const OPN_WINTYPE={
  std:   {n:'Bukó-nyíló ablak',          w:1200,h:1500,sill:900},
  wide:  {n:'Széles ablak (kétszárnyú)', w:1800,h:1500,sill:900},
  small: {n:'Kis ablak (fürdő, WC)',     w:600, h:600, sill:1500},
  french:{n:'Erkélyajtó / franciaablak', w:900, h:2100,sill:0},
  fix:   {n:'Fix üvegezés',              w:1200,h:1500,sill:900}};
const OPN_VAR_ORDER=[0,1,3,2];
if(!state.buildPick)state.buildPick={door:{dtype:'hinged',variant:0},window:{wtype:'std',variant:0}};

function opnPick(type){const P=state.buildPick=state.buildPick||{};
  if(!P[type])P[type]=type==='door'?{dtype:'hinged',variant:0}:{wtype:'std',variant:0};return P[type];}
// the fields a new door / window gets from the current pick (stairs and anything else: nothing)
function opnPickOf(type){if(type==='door'){const p=opnPick('door'),T=DOORTYPE[p.dtype]||DOORTYPE.hinged;return {dtype:p.dtype,variant:p.variant,w:T.w,h:T.h};}
  if(type==='window'){const p=opnPick('window'),T=OPN_WINTYPE[p.wtype]||OPN_WINTYPE.std;return {wtype:p.wtype,variant:p.variant,w:T.w,h:T.h,sill:T.sill};}
  return {};}
function opnSideName(v){return 'zsanér '+((v&2)?'jobb':'bal')+' · nyílás '+((v&1)?'hátra':'előre');}
function opnPickHud(type){const p=opnPick(type);
  if(type==='door')return 'Ajtó: '+(DOORTYPE[p.dtype]||DOORTYPE.hinged).n+' · '+opnSideName(p.variant)+' — ←/→ típus, ↑/↓ nyitásirány';
  const T=OPN_WINTYPE[p.wtype]||OPN_WINTYPE.std;return 'Ablak: '+T.n+' '+T.w+'×'+T.h+', parapet '+T.sill+' · '+opnSideName(p.variant)+' — ←/→ típus, ↑/↓ nyitásirány';}
function opnCycleType(type,dir){const p=opnPick(type),keys=Object.keys(type==='door'?DOORTYPE:OPN_WINTYPE),f=type==='door'?'dtype':'wtype';
  let i=keys.indexOf(p[f]);i=(i+dir+keys.length)%keys.length;p[f]=keys[i];return p[f];}
function opnCycleSide(type,dir){const p=opnPick(type);let i=OPN_VAR_ORDER.indexOf(p.variant|0);if(i<0)i=0;
  i=(i+dir+OPN_VAR_ORDER.length)%OPN_VAR_ORDER.length;p.variant=OPN_VAR_ORDER[i];return p.variant;}
function opnTool(type){setMode('build');state.buildType=type;const sel=$('buildType');if(sel)sel.value=type;
  $('hud').textContent=opnPickHud(type);opnToolBtns();draw();}
function opnToolBtns(){['door','window'].forEach(t=>{const b=$(t==='door'?'opnDoorBtn':'opnWinBtn');if(b)b.classList.toggle('on',state.mode==='build'&&state.buildType===t);});}

STK_TOOLS.push({k:'opnKeys',
  active:()=>state.mode==='build'&&(state.buildType==='door'||state.buildType==='window')&&!!buildGhost,
  key:e=>{const t=state.buildType;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){opnCycleType(t,e.key==='ArrowRight'?1:-1);}
    else if(e.key==='ArrowUp'||e.key==='ArrowDown'){opnCycleSide(t,e.key==='ArrowUp'?1:-1);}
    else return false;
    e.preventDefault();Object.assign(buildGhost,opnPickOf(t));$('hud').textContent=opnPickHud(t);draw();return true;},
  mode:()=>{setTimeout(opnToolBtns,0);}});

registerActions([
  {id:'wf.door',label:'Ajtó',icon:'🚪',group:'Nyílászáró',alias:'door ajto',hint:'Ajtó lerakása falra: ←/→ típus, ↑/↓ nyitásirány (a szellemkép mutatja).',when:c=>!c.inEditor,run:()=>opnTool('door')},
  {id:'wf.window',label:'Ablak',icon:'🪟',group:'Nyílászáró',alias:'window ablak',hint:'Ablak lerakása falra: ←/→ típus, ↑/↓ nyitásirány.',when:c=>!c.inEditor,run:()=>opnTool('window')}]);
(function(){const d=$('opnDoorBtn'),w=$('opnWinBtn');if(d)d.onclick=()=>opnTool('door');if(w)w.onclick=()=>opnTool('window');})();
