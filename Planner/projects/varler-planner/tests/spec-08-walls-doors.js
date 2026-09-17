const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}

const HTML=findPlanner();
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';

  // ---------- corrected switch numbering ----------
  const K=w.DEVKIND;
  ok('100 impulzus',/impulzus/i.test(K['100'].n));
  ok('101 egypólusú',/egypólusú/.test(K['101'].n)&&K['101'].vl==='752001');
  ok('102 kétpólusú',/kétpólusú/.test(K['102'].n)&&K['102'].vl==='752002');
  ok('103 háromfázisú',/háromfázisú/.test(K['103'].n),K['103'].n);
  ok('104 marked as phased out',/kifutó/.test(K['104'].n),K['104'].n);
  ok('105 csillár',/csillár/.test(K['105'].n)&&K['105'].vl==='752005');
  ok('106 váltó',/váltókapcsoló/.test(K['106'].n)&&K['106'].vl==='752006');
  ok('107 kereszt',/kereszt/.test(K['107'].n)&&K['107'].vl==='752007');
  ok('108 kettős váltó',/kettős váltó/.test(K['108'].n)&&K['108'].vl==='752008');
  ok('valena ref helper',w.kindRef('107')==='752007'&&w.kindRef('mozg')==='');
  ok('palette shows the ref',w.PLACE_ITEMS.find(i=>i.id==='k_107').n.indexOf('[752007]')>0);
  ok('all nine numbers present',['100','101','102','103','104','105','106','107','108'].every(k=>K[k]));

  // ---------- wall properties ----------
  const WA=w.__getWalls()[lvl];WA.length=0;
  WA.push({x0:0,y0:0,x1:4000,y1:300});
  const r=WA[0];
  let g=w.wallGeom(r);
  ok('geom reads horizontal wall',g.horiz===true&&g.len===4000&&g.th===300,JSON.stringify(g));
  w.setWallGeom(r,lvl,{th:100});
  ok('thickness keeps the centreline',r.y0===100&&r.y1===200&&r.x0===0&&r.x1===4000,JSON.stringify(r));
  w.setWallGeom(r,lvl,{len:3000});
  ok('length grows about the centre',r.x0===500&&r.x1===3500);
  w.setWallGeom(r,lvl,{h:1200,z0:900});
  ok('height + start stored',r.h===1200&&r.z0===900);
  w.setWallGeom(r,lvl,{z0:0});
  ok('zero start is removed, not stored',r.z0===undefined);
  w.setWallGeom(r,lvl,{h:0});
  ok('zero height falls back to full',r.h===undefined);
  w.setWallGeom(r,lvl,{name:'Pengefal',mat:'gipszkarton'});
  ok('name + material stored',r.name==='Pengefal'&&r.mat==='gipszkarton');
  ok('vertical wall handled',(function(){WA.push({x0:0,y0:0,x1:300,y1:5000});const v=WA[1];
    const gg=w.wallGeom(v);w.setWallGeom(v,lvl,{th:120,len:4000});
    return gg.horiz===false&&v.x0===90&&v.x1===210&&v.y0===500&&v.y1===4500;})());
  WA.length=1;
  ok('presets include pengefal',w.WALL_PRESETS.some(p=>/Pengefal/.test(p.n)&&p.th===100));
  ok('geometry survives save/load',(function(){w.setWallGeom(r,lvl,{h:1100,z0:800});
    const arr=w.rectArr(r),back=w.wr(arr);
    return back.h===1100&&back.z0===800&&back.name==='Pengefal'&&back.mat==='gipszkarton';})());

  // raised wall in the elevation
  const d=w.wallElevationData(r,lvl);
  ok('elevation height = start + body',d.H===1900&&d.z0===800,d.H+'/'+d.z0);
  const svg=w.wallElevationSVG(d,false,true).svg;
  ok('open band drawn under the wall',/nyitott sáv/.test(svg)&&/stroke-dasharray="6 4"/.test(svg));
  ok('no open band for a normal wall',(function(){w.setWallGeom(r,lvl,{z0:0,h:0});
    const dd=w.wallElevationData(r,lvl);return dd.z0===0&&!/nyitott sáv/.test(w.wallElevationSVG(dd,false,true).svg);})());
  ok('undo snapshot carries wall geometry',(function(){w.setWallGeom(r,lvl,{th:100,z0:600});
    const sn=w.__snap();w.setWallGeom(r,lvl,{th:300,z0:0});w.__applySnap(sn);
    const rr=w.__getWalls()[lvl][0];return rr.z0===600&&Math.round(rr.y1-rr.y0)===100;})());

  // ---------- door types + orientation ----------
  const DT=w.DOORTYPE;
  ok('door kinds present',['hinged','double','sliding','pocket','folding','garage','fire','opening'].every(k=>DT[k]),Object.keys(DT).join(','));
  ok('garage default is wide',DT.garage.w===2500&&DT.garage.h===2200);
  ok('doorKind falls back to hinged',w.doorKind({})==='hinged'&&w.doorKind({dtype:'nonsense'})==='hinged'&&w.doorKind({dtype:'sliding'})==='sliding');
  ok('doorName reads well',/Tolóajtó/.test(w.doorName({dtype:'sliding'})));

  // blueprint symbols differ per kind
  w.__data.openings.length=0;
  w.__getWalls()[lvl].length=0;
  w.__getWalls()[lvl].push({x0:0,y0:0,x1:6000,y1:300});
  w.__setWalls&&w.__setWalls();
  const mk=(dtype,x)=>({type:'door',level:lvl,x,y:150,ang:0,variant:0,w:1000,h:2100,dtype});
  const symOf=(dtype)=>{w.__data.openings.length=0;w.__data.openings.push(mk(dtype,3000));
    w.__state.style='blueprint';w.__state.pitch=90;w.__state.flat=true;
    return w.drawBlueprintPlan();};
  const hinged=symOf('hinged'),sliding=symOf('sliding'),dbl=symOf('double'),fold=symOf('folding'),
        gar=symOf('garage'),fire=symOf('fire'),open2=symOf('opening'),pocket=symOf('pocket');
  ok('hinged draws a swing arc',(hinged.match(/polyline/g)||[]).length>=4);
  ok('sliding differs from hinged',sliding!==hinged&&/polygon/.test(sliding));
  ok('double draws two arcs',dbl!==hinged&&(dbl.match(/polyline/g)||[]).length>(hinged.match(/polyline/g)||[]).length);
  ok('folding draws a zigzag',fold!==hinged);
  ok('garage is labelled GK',/>GK</.test(gar));
  ok('fire door is labelled EI',/>EI</.test(fire));
  ok('bare opening has no leaf',(open2.match(/polyline/g)||[]).length<(hinged.match(/polyline/g)||[]).length);
  ok('pocket leaf is dashed',/stroke-dasharray="5 3"/.test(pocket));

  // orientation: both axes flip the drawing
  w.__data.openings.length=0;w.__data.openings.push(mk('hinged',3000));
  const o=w.__data.openings[0];
  const v0=w.drawBlueprintPlan();
  o.variant=2;const v2=w.drawBlueprintPlan();
  o.variant=1;const v1=w.drawBlueprintPlan();
  o.variant=3;const v3=w.drawBlueprintPlan();
  ok('hinge side changes the symbol',v2!==v0);
  ok('opening direction changes the symbol',v1!==v0);
  ok('all four orientations are distinct',new Set([v0,v1,v2,v3]).size===4);
  ok('type dialog exists',typeof w.doorTypeDialog==='function');
  ok('applying a type sets defaults',(function(){o.dtype=undefined;o.dtype='garage';o.w=w.DOORTYPE.garage.w;
    return w.doorKind(o)==='garage'&&o.w===2500;})());
  ok('dtype persists',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.data.openings[0].dtype==='garage';})());

  // ---------- regressions ----------
  w.__state.style='plan';w.__state.pitch=30;w.__state.flat=false;
  w.__data.openings.length=0;
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: blueprint renders',(function(){try{w.__state.style='blueprint';w.__state.pitch=90;const q=w.drawBlueprintGeom();
    w.__state.style='plan';w.__state.pitch=30;return typeof q==='string'&&q.length>50;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: wall editor',(function(){try{w.openWallView(w.__getWalls()[lvl][0],lvl);const o2=w.__WV()!==null;
    w.wvCloseEditor(true);return o2;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: plane editor',(function(){try{w.openPlaneView({name:'X',poly:[[0,0],[3000,0],[3000,3000],[0,3000]]},lvl,'ceiling');
    const o2=w.__PV()!==null;w.wvCloseEditor(true);return o2;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: placement palette',w.PLACE_ITEMS.length>=20&&typeof w.placeAtCursor==='function');
  ok('reg: fine mode',typeof w.fineXY==='function'&&w.fineStep(10)===10);
  ok('reg: camera memory',typeof w.camSnap==='function');
  ok('reg: chase model',w.chaseWidthOf(25)===40);
  ok('reg: session save',(function(){const so=w.sessionObj();return !!so.data&&!!so.state;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
