// ==========================================================================
// 00b-i18n.js — the translation seam
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The UI is Hungarian and stays Hungarian by default. This is the SEAM, not a
// finished translation: t(key, hu) returns the active language's string, falling
// back to the Hungarian text passed in. Converting a literal later is a local
// edit — 'Fal' becomes t('wall','Fal') — and nothing breaks in between, because
// an unknown key simply yields its fallback.
//
// Rule: the fallback is always the Hungarian original, so a missing translation
// degrades to the language the tool was written in, never to a bare key.

const LANGS={hu:'Magyar',en:'English'};
const L10N={hu:{},en:{
  // shell
  'stage.build':'Structure','stage.rooms':'Rooms','stage.devices':'Devices',
  'stage.paths':'Runs','stage.doc':'Documentation',
  'stage.build.hint':'Walls, openings, levels, floors.',
  'stage.rooms.hint':'Naming, use, environment (IP), finishes, default heights.',
  'stage.devices.hint':'Sockets, switches, lights, boxes and their heights.',
  'stage.paths.hint':'Cable runs, chases, circuits.',
  'stage.doc.hint':'Official drawing, bill of materials, printing, saving.',
  'insp.none':'Nothing selected','insp.pick':'Select something in the drawing.',
  'insp.wall':'Wall','insp.device':'Device','insp.room':'Room','insp.object':'Object',
  'insp.roomDevs':'Devices in this room','insp.roomEmpty':'No devices in this room.',
  'f.ref':'Tag','f.height':'Height (mm)','f.thickness':'Thickness (mm)','f.length':'Length (mm)',
  'f.wallH':'Height (0 = full)','f.z0':'Starts above floor (mm)','f.name':'Name','f.number':'Number',
  'f.ceilH':'Ceiling height (0 = storey)','f.width':'Width (mm)','f.depth':'Depth (mm)',
  'f.sill':'Sill / threshold (mm)','f.base':'Underside above floor (mm)',
  // status bar
  'sb.level':'level','sb.height':'height','sb.free':'free drawing','sb.bound':'snapped to walls',
  'sb.fine':'fine 1 mm','sb.editor':'editor','sb.wall':'wall','sb.plane':'plane',
  'sb.selected':'selected','sb.error':'error','sb.warn':'warning','sb.cmd':'commands',
  // palette
  'pal.search':'Search commands…  (Esc to close)',
  'pal.foot':'↑↓ move · Enter run · Esc close','pal.none':'No match',
  'pal.need':'Not available right now — select a suitable element, or close the editor.',
  // settings
  'set.title':'Settings and standards','set.chase':'Chase','set.boxes':'Boxes and devices',
  'set.heights':'Standard heights','set.env':'Environment and IP','set.walls':'Wall presets',
  'set.note':'These are the numbers the drawing and the bill of materials are built from.'
}};
function lang(){return (state&&state.lang)||'hu';}
function t(key,hu){const d=L10N[lang()];const v=d&&d[key];return (v!=null&&v!=='')?v:(hu!=null?hu:key);}
function setLang(l){if(!LANGS[l])return;state.lang=l;
  if(typeof renderShell==='function')renderShell();
  if(typeof statusBar==='function')statusBar();
  if(typeof draw==='function')draw();
  $('hud').textContent=(l==='hu'?'Nyelv: magyar':'Language: English');}
// how much of the interface the active language actually covers
function i18nCoverage(){const keys=Object.keys(L10N.en||{});return {keys:keys.length,lang:lang()};}

// test hooks
window.t=t;window.setLang=setLang;window.lang=lang;window.LANGS=LANGS;window.L10N=L10N;window.i18nCoverage=i18nCoverage;
