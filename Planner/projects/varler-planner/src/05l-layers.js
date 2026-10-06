// ==========================================================================
// 05l-layers.js — layer model v2: sixteen sub-layer categories, per-category opacity
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// LAYER_CATS / LAYER_CATS_V1 / layerCatsAll() live in 02-state.js (the default layer is built from
// them at load time). Prefix here: lyr. Everything below is a function, so call order is free.

// the category of a device: sockets, switches and lights are their own; every other box is 'device'
function lyrDevCat(d){const t=d&&d.type;
  if(t==='socket'||t==='switch'||t==='light')return t;
  if(t==='ep'){const c=d.code;return (c==='LMP'||c==='LNR')?'light':c==='SWI'?'switch':c==='SOC'?'socket':'device';}
  return 'device';}
// a call site may still say the v1 names 'device' / 'build'; map them onto the v2 category of THIS item
function lyrCat(item,cat){
  if(cat==='device')return (item&&item.type)?lyrDevCat(item):'device';
  if(cat==='build'){const t=item&&item.type;
    if(t==='door'||t==='window'||t==='stairs')return t;
    return (item&&item.poly)?'floor':'roof';}
  return cat;}
// the category a record of a collection belongs to (coll 'walls' = a wall rect)
function lyrCatOf(coll,rec){
  switch(coll){
    case 'devices':return lyrDevCat(rec);
    case 'openings':return (rec&&rec.type)||'door';
    case 'floors':return 'floor';
    case 'roofs':return 'roof';
    case 'objects':return 'object';
    case 'paths':return 'path';
    case 'cables':return 'cable';
    case 'notes':case 'wallNotes':return 'note';
    case 'walls':return 'wall';
    case 'marks':return 'mark';
    case 'traces':return 'trace';}
  return null;}
function lyrKnown(k){return LAYER_CATS.some(c=>c.k===k);}
// opacity step: one decimal, 0.1…1
function lyrClampOp(v){v=+v;if(!isFinite(v))return 1;return Math.min(1,Math.max(0.1,Math.round(v*10)/10));}
// idempotent: v1 layers (device / build keys) become v2, every category present, op cleaned
function lyrMigrate(L){if(!L)return L;
  const c=L.cats||(L.cats={});
  if(!('socket' in c)&&!('switch' in c)&&!('light' in c)&&('device' in c)){const v=c.device!==false;
    LAYER_CATS_V1.device.forEach(k=>{c[k]=v;});}
  if('build' in c){const v=c.build!==false;LAYER_CATS_V1.build.forEach(k=>{c[k]=v;});delete c.build;}
  LAYER_CATS.forEach(k=>{if(c[k.k]===undefined)c[k.k]=true;});
  if(L.op&&typeof L.op==='object'){
    Object.keys(L.op).forEach(k=>{if(!lyrKnown(k)){delete L.op[k];return;}
      const v=lyrClampOp(L.op[k]);if(v>=1)delete L.op[k];else L.op[k]=v;});
    if(!Object.keys(L.op).length)delete L.op;}
  else if('op' in L)delete L.op;
  return L;}
function lyrMigrateAll(){layers.forEach(lyrMigrate);}
// the layer opacity of an item in a category, 1 when none is set
function lyrOp(item,cat){const L=layerById((item&&item.layer)||'L0'),k=lyrCat(item,cat);
  const v=L.op&&L.op[k];return (typeof v==='number'&&v>=0.1&&v<1)?v:1;}
function lyrOpStr(v){return String(+v.toFixed(1));}
function lyrOpAttr(item,cat){const v=lyrOp(item,cat);return v===1?'':` opacity="${lyrOpStr(v)}"`;}
function lyrWrap(item,cat,svg){const v=lyrOp(item,cat);return v===1?svg:`<g opacity="${lyrOpStr(v)}">`+svg+`</g>`;}
// wrap what a loop appended to `s` since index `i` — for sites that build one long string
function lyrWrapFrom(s,i,item,cat){return lyrWrapOp(s,i,lyrOp(item,cat));}
function lyrWrapOp(s,i,v){return (!v||v>=1)?s:s.slice(0,i)+`<g opacity="${lyrOpStr(v)}">`+s.slice(i)+`</g>`;}
// data records handed to the wall / plane views carry `op` only when it is below 1 (no change at 100 %)
function lyrTagOp(rec,item,cat){const v=lyrOp(item,cat);if(v<1)rec.op=v;return rec;}
// depth-sorted face lists (3D views): tag the faces pushed since index `from` with the layer opacity
function lyrFaces(faces,from,item,cat){const v=lyrOp(item,cat);if(v===1)return;
  for(let i=from;i<faces.length;i++)faces[i].lop=v;}
function lyrSetOp(layerId,cat,v){const L=layerById(layerId);if(!L||!lyrKnown(cat))return;
  v=lyrClampOp(v);
  if(v>=1){if(L.op){delete L.op[cat];if(!Object.keys(L.op).length)delete L.op;}}
  else{(L.op||(L.op={}))[cat]=v;}
  draw();}
// every layer / stack operation is undoable as one step: all collections + walls + layers + stacks
function lyrPushUndo(){pushUndo(['__walls','__layers']);}

// test hooks
window.LAYER_CATS=LAYER_CATS;window.lyrDevCat=lyrDevCat;window.lyrCat=lyrCat;window.lyrCatOf=lyrCatOf;
window.lyrMigrate=lyrMigrate;window.lyrMigrateAll=lyrMigrateAll;window.lyrOp=lyrOp;window.lyrOpAttr=lyrOpAttr;
window.lyrWrap=lyrWrap;window.lyrWrapFrom=lyrWrapFrom;window.lyrWrapOp=lyrWrapOp;window.lyrTagOp=lyrTagOp;window.lyrFaces=lyrFaces;window.lyrSetOp=lyrSetOp;window.lyrPushUndo=lyrPushUndo;window.layerCatsAll=layerCatsAll;
window.layerShows=layerShows;
