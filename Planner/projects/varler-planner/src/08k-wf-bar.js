// ==========================================================================
// 08k-wf-bar.js — workflow round (docs/workflow), WP-E0: the Munkafolyamat bar
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The overlay the user asked for ("parts of an overlaying control system"): a thin bar over the canvas that walks the
// four phases — 1 Alapozás › 2 Nyílászárók › 3 Szabályok › 4 Villamosság — and puts that phase's tools one click away.
// It drives the existing tools and layers only; it stores nothing but state.wfPhase (and state.wfBar on/off).
// Entering Villamosság makes sure a stack exists — a Villany Stack since round 2026-10-22 (V2) — (adopting the layer the rooms are on as Szerkezet, nothing
// copied) and activates the Erősáram socket layer; 4.1 has two buttons, Dugaljak / Lámpák + kapcsolók (E01 = A).
// The later steps 4.2–4.5 are listed greyed until their work packages land. Each phase shows a live check, read from
// the data, never stored.
// T2 (docs/ui-tidy, 2026-10-15): the bar no longer floats on the canvas — its phases are the six phases of the fixed
// frame (05db PH_LIST: the four of this round + Pályák + Kimenet) and their tools are the left column's buttons.
// What stays here is the phase logic: wfPhase (Villamosság makes sure a stack exists), wfLayer, and the live checks.
const WF_PHASES=PH_LIST;
// the stack the electrical phase works in: the active one, else the first, else a new one adopting the rooms' layer
function wfStack(){let S=typeof stkActive==='function'?stkActive():null;if(!S&&typeof stacks!=='undefined'&&stacks.length)S=stacks[0];
  if(S)return S;const fl=data.floors.find(f=>f&&f.level===state.active),L=(fl&&fl.layer)||'L0';
  return stkCreate({name:'Villany',kind:'elec',construct:{mode:'adopt',layers:[L]}});}
function wfLayer(role){const S=wfStack();if(!S)return null;state.stack=S.id;state.stkOff=false;
  const L=stkLayer(S.id,role);if(!L){$('hud').textContent='A stackben nincs '+role+' réteg.';return null;}
  state.activeLayer=L.id;if(typeof lyrRefresh==='function')lyrRefresh();else if(typeof renderLayers==='function')renderLayers();
  if(state.mode!=='select')setMode('select');wfBarDraw();draw();
  $('hud').textContent='Aktív réteg: '+(L.name||role)+' — Végpont: jobb klikk a rétegen, vagy a Szabványok ＋ gombja.';return L;}
function wfPhase(k){const P=WF_PHASES.find(p=>p.k===k);if(!P)return false;state.wfPhase=k;
  // a role on the active layer is not enough: its stack must still exist (a reset can leave orphan role layers behind)
  if(k==='vill'){const L=lyrLayer(state.activeLayer),r=L&&L.role,S=typeof stkActive==='function'?stkActive():null;
    if(!S||!stkById(S.id)||!(r==='sys:SOC'||r==='sys:LIGHT'||r==='sys:DED'))wfLayer('sys:SOC');}
  wfBarDraw();return true;}
// live checks per phase
function wfCheck(k){const lvl=state.active,rooms=data.floors.filter(f=>f&&f.level===lvl&&f.poly&&f.poly.length>=3);
  if(k==='alap'){if(!rooms.length)return 'nincs helyiség';const ol=rooms.filter(f=>f.stage==='outline').length,gw=(WALLS[lvl]||[]).length;
    return rooms.length+' helyiség'+(gw?' · falak ✓':' · falak nélkül')+(ol?' · '+ol+' padló nélkül':' · padló ✓');}
  if(k==='nyil'){const o=(data.openings||[]).filter(x=>x.level===lvl);return o.filter(x=>x.type==='door').length+' ajtó · '+o.filter(x=>x.type==='window').length+' ablak';}
  if(k==='szab'){const nk=rooms.filter(f=>!(Array.isArray(f.kinds)&&f.kinds.length)&&!f.kind).length,rw=typeof rwlAllowed==='function'?rwlAllowed(lvl).length:0;
    return (nk?nk+' helyiség típus nélkül':'típusok ✓')+' · '+rw+' vezethető szakasz';}
  if(k==='vill'){const e=data.devices.filter(d=>d&&d.level===lvl&&typeof epCodeOf==='function'&&epCodeOf(d)),c=x=>e.filter(d=>epCodeOf(d)===x).length;
    return c('SOC')+' dugalj · '+c('LMP')+' lámpa · '+c('SWI')+' kapcsoló · '+c('DED')+' dedikált';}
  if(k==='paly'){const p=(data.paths||[]).filter(x=>x&&x.level===lvl).length;return p+' pálya';}
  if(k==='ki'){const v=typeof validateSummary==='function'?validateSummary():{};return v.error?v.error+' hiba':v.warn?v.warn+' figyelmeztetés':'ellenőrzés ✓';}
  return '';}

// the old names, for callers that still redraw "the bar"
function wfBarDraw(){if(typeof layoutSync==='function')layoutSync(true);}
function wfBarToggle(){return typeof phLayoutToggle==='function'?phLayoutToggle():null;}

registerActions([{id:'wf.electric',label:'Villamosság: Erősáram',icon:'⚡',group:'Készülék',alias:'electrical erosaram villamossag',
   hint:'Villany Stack (ha még nincs stack) és az Erősáram dugalj rétege aktív.',when:()=>true,run:()=>phSet('vill')}]);
