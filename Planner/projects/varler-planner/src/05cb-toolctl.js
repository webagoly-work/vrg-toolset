// ==========================================================================
// 05cb-toolctl.js — the tool controller (UI tidy, docs/ui-tidy T1)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The Planner has two kinds of tool. A MODE is state.mode (select, path, wall…, set by setMode). A SUB-TOOL rides on a
// mode — mostly on Select — behind its own flag (MKP.on, EP_T.on, JB_T.on…) and takes the canvas events through
// STK_TOOLS (05m). Each sub-tool used to switch off a hand-picked list of the others when it started, so two could be
// live at once and the one earlier in STK_TOOLS took the clicks of the one picked last — the "buttons work half the
// time" of the 2026-10-14 audit (18 such pairs; J, G and RBX even survived a click on Select).
//
// Now there is one rule: AT MOST ONE TOOL IS LIVE. Every sub-tool's start calls toolsOff() before raising its own flag,
// and setMode() calls it too, so picking any tool — a mode button, a sub-tool, ▖ Select — ends whatever ran before.
// The table below is the only list of sub-tools; a new one is registered here and calls toolsOff() in its start.
//
// The same table answers "what is running now" for everyone who shows it: the status bar, the lit tool button, and
// the Simplified UI's dial (docs/simple-ui contract §2.3: toolCurrent / toolStop / toolStart / toolOnChange).
//
// The entries read flags that later modules declare. They are only CALLED at run time, after every module has loaded;
// each call still sits in a try/catch, so an entry whose module is missing from a build reads as "not live".

// k = the action id of the tool (a string, or a function of the tool's state); live / off read and end it;
// label (optional) overrides the action's label when one action covers several states.
const TOOL_SUBS=[
 {k:'mark.wall',  live:()=>MRK_T.on, off:()=>mrkToolsOff()},
 {k:'mark.plane', live:()=>MRK_P.on, off:()=>mrkToolsOff()},
 {k:'hw.serve',   live:()=>!!HW_SP,  off:()=>{HW_SP=null;}},
 {k:()=>'hw.'+HW_T.type, live:()=>HW_T.on, off:()=>hwToolOff()},
 {k:'chn.route',  live:()=>CHN_T.on, off:()=>{CHN_T.on=false;}},
 {k:()=>'ep.place.'+EP_T.code, live:()=>EP_T.on, off:()=>epToolOff()},
 {k:'ep.ctl',     live:()=>!!EP_CTL, off:()=>{EP_CTL=null;}},
 {k:'arm.route',  live:()=>ARM_T.on, off:()=>{ARM_T.on=false;}},
 {k:'pt.place',   live:()=>PT_T.on,  off:()=>ptToolOff()},
 {k:'rail.route', live:()=>RAIL_T.on,off:()=>{RAIL_T.on=false;}},
 {k:'cls.place',  live:()=>CL_T.on,  off:()=>clsToolOff()},
 {k:()=>MKP.ink==='vezetheto'?'wf.routeWalls':'wf.rules', live:()=>MKP.on, off:()=>mkpOff(),     // the marker pen (08ia, R5)
  label:()=>MKP.ink==='vezetheto'?'Vezethető fal':'Jelölő toll: '+((rbPreset(MKP.ink)||{}).n||MKP.ink)},
 {k:'wf.rules',   live:()=>RB.on,    off:()=>rbOff(), label:()=>{const p=rbPreset(RB.preset);return 'Szabály: '+(p?p.n:RB.preset);}},
 {k:'wf.switches',live:()=>LSW.on,   off:()=>lswToolOff()},
 {k:()=>CLN.plane==='floor'?'wf.floorLine':'wf.ceilLine', live:()=>CLN.on, off:()=>clnOff()},
 {k:()=>({kot:'wf.boxKot',ceiling:'wf.boxKot',board:'wf.board'})[JB_T.kind]||'wf.boxSzoba', live:()=>JB_T.on, off:()=>jbToolOff(),
  label:()=>JB_N[JB_T.kind]||'Szobadoboz'},
 {k:'circuit.pick', live:()=>!!cktPick, off:()=>cktPickStop()}];
// the superseded modes that live in the Tools panel's Régi eszközök drawer (T4)
const TOOL_LEGACY=['mode.cable','mode.device','mode.build','mode.floor','mode.roof'];

function toolSafe(f){try{return f();}catch(_){return undefined;}}
function toolIdOf(t){return typeof t.k==='function'?toolSafe(t.k):t.k;}
function toolLiveSubs(){return TOOL_SUBS.filter(t=>!!toolSafe(t.live));}
// End every live sub-tool (except the one whose id is `except`). Returns how many were ended.
function toolsOff(except){let n=0;
  for(const t of TOOL_SUBS){if(!toolSafe(t.live))continue;if(except&&toolIdOf(t)===except)continue;toolSafe(t.off);n++;}
  return n;}
// The running tool: the live sub-tool, else the mode when it is not Select; null = plain Select.
function toolCurrent(){const t=TOOL_SUBS.find(x=>!!toolSafe(x.live));let id=null,label=null;
  if(t){id=toolIdOf(t);label=t.label?toolSafe(t.label):null;}
  else if(state.mode!=='select'){
    id=state.mode==='build'&&state.buildType==='door'?'wf.door':state.mode==='build'&&state.buildType==='window'?'wf.window':'mode.'+state.mode;}
  if(!id)return null;
  const a=actionById(id),mh=$('modeHint');
  return {id,label:label||(a&&a.label)||MODENAME[state.mode]||id,icon:(a&&a.icon)||'•',hint:mh?mh.textContent:''};}
// Back to plain Select, whatever ran.
function toolStop(){const had=toolsOff();if(state.mode!=='select')setMode('select');else if(had){toolSync();draw();}}
function toolStart(id){return runAction(id);}
const TOOL_LISTENERS=[];
function toolOnChange(fn){if(typeof fn==='function')TOOL_LISTENERS.push(fn);}
// Called from statusBar(), so on every draw (and draw runs on every pointer move): it must cost next to nothing when
// nothing changed. The key is cheap — the live sub-tool's index, the mode, the build type — and only a new key rebuilds
// the description, relights the buttons (setMode lights by mode alone, so 🪜 Build would be lit for a door) and tells
// the listeners.
let _toolKey=null,_toolCur=null;
function toolKeyNow(){for(let i=0;i<TOOL_SUBS.length;i++){const t=TOOL_SUBS[i];
    if(toolSafe(t.live))return 's'+i+'|'+toolIdOf(t)+(t.label?'|'+toolSafe(t.label):'');}
  return state.mode+'|'+(state.mode==='build'?state.buildType:'');}
function toolSync(){const key=toolKeyNow();if(key===_toolKey)return _toolCur;
  const cur=toolCurrent(),prev=_toolCur;_toolKey=key;_toolCur=cur;
  document.querySelectorAll('.tool[data-mode]').forEach(b=>b.classList.toggle('on',cur?cur.id==='mode.'+b.dataset.mode:b.dataset.mode==='select'));
  // a phase tool button carries its action id (05db); one that picks a layer (data-role) is lit by layoutSync instead
  document.querySelectorAll('.tool[data-a]:not([data-mode]):not([data-role])').forEach(b=>b.classList.toggle('on',!!cur&&cur.id===b.dataset.a));
  // T4: a legacy mode picked by its key opens the Régi eszközök drawer, so its lit button is never hidden
  const lg=$('legacyTools');if(lg&&!lg.open&&cur&&TOOL_LEGACY.indexOf(cur.id)>=0)lg.open=true;
  if((prev&&prev.id)!==(cur&&cur.id)||(prev&&prev.label)!==(cur&&cur.label))TOOL_LISTENERS.forEach(fn=>{try{fn(cur);}catch(_){}});
  return cur;}

window.toolCurrent=toolCurrent;window.toolStop=toolStop;window.toolStart=toolStart;window.toolOnChange=toolOnChange;
window.toolsOff=toolsOff;window.toolSync=toolSync;window.toolLiveSubs=toolLiveSubs;
