// ==========================================================================
// 05y-client-preview.js — the client preview model (prefix cpv)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The client preview (projects/client-preview) is a separate WebGL page that a
// client opens offline. It never sees the Planner's state: it gets ONE plain JSON
// model, built here by a pure read of the open project. Nothing in this file
// writes to data, state or the building.
//
// Levels have a scope: 'in' (the work; solid and clickable), 'ghost' (part of the
// building but outside the work; drawn faint, never clickable) or 'skip' (left
// out). Default: a level shown in the Planner is 'in'; a hidden level that has
// geometry is 'ghost'; an empty level is 'skip'. P33: ground in, upper ghost,
// basement skipped.
const CPV_VERSION=1;
const CPV_SLAB=300;            // mm between one level's ceiling and the next level's floor
const CPV_LEVEL_NAMES={basement:['Pince','Basement'],ground:['Földszint','Ground floor'],upper:['Emelet','Upper floor']};
const CPV_KIND={light:'endpoint',switch:'endpoint',socket:'endpoint',ep:'endpoint',junction:'junction',box:'junction',
  rbx:'rbx',board:'board',base:'base',meter:'meter',entry:'entry',ssc:'ssc'};
const CPV_TYPE_EN={light:'Light',switch:'Switch',socket:'Socket',junction:'Junction box',box:'Wall box',board:'Distribution board',
  rbx:'Room box',base:'BASE',meter:'Meter',entry:'Data entry point',ssc:'Security centre',ep:'Endpoint'};

function cpvHasGeometry(l){return (WALLS[l]||[]).length>0||data.floors.some(f=>f.level===l)||data.devices.some(d=>d.level===l);}
function cpvDefaultScope(){const o={};
  ORD.forEach(l=>{o[l]=state.levels&&state.levels[l]?'in':(cpvHasGeometry(l)?'ghost':'skip');});return o;}
// floor elevation of each level in mm, ground = 0, real (never exploded) spacing
function cpvLevelZ(l){const g=ORD.indexOf('ground'),i=ORD.indexOf(l);let z=0;
  if(i>g)for(let k=g;k<i;k++)z+=LH[ORD[k]]+CPV_SLAB;
  else for(let k=i;k<g;k++)z-=LH[ORD[k]]+CPV_SLAB;
  return z;}
const cpvR=v=>Math.round(v);
function cpvDevLabel(d){const en=d.code&&typeof epEntry==='function'?epEntry(d.code):null;
  const hu=en?en.n:(DEV[d.type]||(typeof HW_TYPES!=='undefined'&&HW_TYPES[d.type])||d.type);
  return {hu,en:CPV_TYPE_EN[d.type]||hu};}

// opts.scope: {basement,ground,upper} → 'in' | 'ghost' | 'skip'; opts.name overrides the project name
function cpvModel(opts){opts=opts||{};const scope=Object.assign(cpvDefaultScope(),opts.scope||{});
  const levels=[],rooms=[],walls=[],openings=[],devices=[];
  ORD.forEach(l=>{if(scope[l]==='skip')return;
    const nm=CPV_LEVEL_NAMES[l]||[l,l];
    levels.push({id:l,name:nm[0],nameEn:nm[1],scope:scope[l]==='ghost'?'ghost':'in',z:cpvLevelZ(l),h:LH[l]});
    (WALLS[l]||[]).forEach(r=>walls.push({level:l,id:r.id||null,x0:cpvR(Math.min(r.x0,r.x1)),y0:cpvR(Math.min(r.y0,r.y1)),
      x1:cpvR(Math.max(r.x0,r.x1)),y1:cpvR(Math.max(r.y0,r.y1)),h:r.h||LH[l],z0:r.z0||0}));
    allRooms(l).forEach((e,i)=>{const rm=e.rm;if(!rm.poly||rm.poly.length<3)return;
      rooms.push({id:rm.id||(e.src+e.i+'@'+l),level:l,num:rm.num||'',name:rm.name||'',kind:rm.kind||null,
        poly:rm.poly.map(p=>[cpvR(p[0]),cpvR(p[1])]),area:Math.round(polyArea(rm.poly)/1e5)/10,
        ceil:rm.ch||LH[l],devices:[]});});
    data.openings.forEach(o=>{if(o.level!==l)return;
      openings.push({level:l,type:o.type,x:cpvR(o.x),y:cpvR(o.y),ang:o.ang||0,w:o.w||(o.type==='window'?1200:900),
        h:o.h||(o.type==='window'?1500:2100),sill:o.type==='window'?(o.sill!=null?o.sill:900):0});});});
  const keep=new Set(levels.map(L=>L.id)),roomById={};rooms.forEach(r=>roomById[r.id]=r);
  data.devices.forEach(d=>{if(!d||!keep.has(d.level))return;
    const e=roomOfDevice(d),rid=e?(e.rm.id||(e.src+e.i+'@'+d.level)):null,hw=deviceHostWall(d),lb=cpvDevLabel(d);
    const o={id:d.id,level:d.level,type:d.type,kind:CPV_KIND[d.type]||'other',code:d.code||null,ref:d.ref||'',
      label:lb.hu,labelEn:lb.en,x:cpvR(d.x),y:cpvR(d.y),h:cpvR(d.h!=null?d.h:LH[d.level]),room:rid};
    if(hw){o.nx=hw.nx;o.ny=hw.ny;}
    devices.push(o);if(rid&&roomById[rid])roomById[rid].devices.push(d.id);});
  const inLv=new Set(levels.filter(L=>L.scope==='in').map(L=>L.id));
  return {kind:'vrg-client-preview',v:CPV_VERSION,name:opts.name||B.name||'Terv',created:new Date().toISOString(),units:'mm',
    levels,rooms,walls,openings,devices,circuits:[],
    stats:{rooms:rooms.filter(r=>inLv.has(r.level)).length,endpoints:devices.filter(d=>inLv.has(d.level)&&d.kind==='endpoint').length}};}
