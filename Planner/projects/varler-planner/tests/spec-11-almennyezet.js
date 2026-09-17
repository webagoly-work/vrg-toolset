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
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.__state.active=lvl;
  const H=w.wallH(lvl);

  // ---------- wall-snap toggle ----------
  w.__state.freeHeight=false;w.__state.midFree=false;
  w.__state.drawHKey='floor';   ok('floor is free (as before)',w.isFreeHeight()===true);
  w.__state.drawHKey='ceiling'; ok('ceiling is free (as before)',w.isFreeHeight()===true);
  w.__state.drawHKey='s1100';   ok('mid height binds to walls by default',w.isFreeHeight()===false);
  w.__state.midFree=true;
  ok('toggle frees the mid heights',w.isFreeHeight()===true);
  w.__state.drawHKey='s300';    ok('every intermediate height freed',w.isFreeHeight()===true);
  w.__state.drawHKey='floor';   ok('floor still free with the toggle on',w.isFreeHeight()===true);
  w.__state.drawHKey='ceiling'; ok('ceiling still free with the toggle on',w.isFreeHeight()===true);
  ok('the toggle only covers strictly-between heights',(function(){
    w.__state.drawHKey='s1100';const on=w.isFreeHeight();
    w.__state.midFree=false;const off=w.isFreeHeight();w.__state.midFree=true;
    return on===true&&off===false;})());
  ok('checkbox exists and is wired',(function(){const el=$('midFree');if(!el)return false;
    el.checked=false;el.onchange({target:el});const a=w.__state.midFree;
    el.checked=true;el.onchange({target:el});return a===false&&w.__state.midFree===true;})());
  ok('setting persists',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));return so.state.midFree===true;})());
  // it really reaches the snapper: object wall snap uses the same gate
  ok('object snap honours it too',(function(){const src=fs.readFileSync(HTML,'utf8');
    return (src.match(/!isFreeHeight\(\)/g)||[]).length>=3;})());
  w.__state.midFree=false;w.__state.drawHKey='s1100';

  // ---------- álmennyezet ----------
  ok('DROPC starts empty',w.DROPC.ground===0&&w.hasDropCeil(lvl,null)===false);
  ok('default plane sits under the slab',w.dropCeilOrDefault(lvl,null)===H-250,''+w.dropCeilOrDefault(lvl,null));
  w.DROPC.ground=2400;
  ok('level value used',w.dropCeilMm(lvl,null)===2400&&w.hasDropCeil(lvl,null)===true);
  ok('plenum computed',w.plenumMm(lvl,null)===H-2400,''+w.plenumMm(lvl,null));
  const rm={name:'Fürdő',poly:[[0,0],[2000,0],[2000,2000],[0,2000]],dropC:2200};
  ok('room override beats the level',w.dropCeilMm(lvl,rm)===2200&&w.dropCeilOrDefault(lvl,rm)===2200);
  ok('room without an override falls back',w.dropCeilMm(lvl,{poly:rm.poly})===2400);

  // guide line
  const g=w.guideByKey('alcell');
  ok('guide exists between gerinc and mennyezet',!!g&&g.l==='Álmennyezet'&&g.mm==='alcell');
  ok('guide resolves to the level height',w.resolveMm(g,lvl)===2400,''+w.resolveMm(g,lvl));
  ok('guide appears in the drawing-height list',(function(){w.rebuildDrawH();
    return /value="alcell"/.test($('drawH').innerHTML);})());
  ok('drawing at álmennyezet gives the right mm',(function(){w.__state.drawHKey='alcell';
    const mm=w.drawHmm(lvl);w.__state.drawHKey='s1100';return mm===2400;})());

  // level UI
  ok('level input wired',(function(){$('dcLevel').value='ground';$('dcVal').value='2500';
    $('dcVal').onchange({target:$('dcVal')});return w.DROPC.ground===2500;})());
  ok('too-high values are rejected',(function(){w.alert=()=>{};
    $('dcVal').value=String(H+100);$('dcVal').onchange({target:$('dcVal')});
    const cleared=w.DROPC.ground===0;$('dcVal').value='2400';$('dcVal').onchange({target:$('dcVal')});
    return cleared&&w.DROPC.ground===2400;})());
  ok('info line explains the plenum',/Plénum/.test($('dcInfo').textContent),$('dcInfo').textContent.slice(0,60));
  ok('DROPC persists',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));return so.DROPC.ground===2400;})());

  // 3D plane
  w.__data.floors.length=0;
  w.__data.floors.push({level:lvl,poly:[[0,0],[3000,0],[3000,3000],[0,3000]],name:'Nappali',dropC:2300});
  ok('suspended plane drawn',(function(){w.__state.showDropCeil=true;w.draw();const a=$('stage').innerHTML.length;
    w.__state.showDropCeil=false;w.draw();const b=$('stage').innerHTML.length;w.__state.showDropCeil=true;
    return a>b;})(),'with vs without');
  ok('rooms without one are untouched',(function(){const f=w.__data.floors[0];const d=f.dropC;delete f.dropC;
    w.DROPC.ground=0;w.draw();const a=$('stage').innerHTML.length;
    w.DROPC.ground=2400;f.dropC=d;w.draw();const b=$('stage').innerHTML.length;return b>a;})());

  // room data sheet
  w.roomPropsDialog(w.__data.floors[0],lvl,'F');
  ok('sheet has the álmennyezet field',!!$('riDrop')&&$('riDrop').value==='2300',$('riDrop')&&$('riDrop').value);
  $('riDrop').value='2150';$('mOk').onclick();
  ok('sheet saves the room value',w.__data.floors[0].dropC===2150);
  w.roomPropsDialog(w.__data.floors[0],lvl,'F');$('riDrop').value='0';$('mOk').onclick();
  ok('zero clears the room override',w.__data.floors[0].dropC===undefined);
  w.__data.floors[0].dropC=2150;

  // plane editor third plane
  const WA0=w.__getWalls()[lvl];WA0.length=0;
  WA0.push({x0:-100,y0:-100,x1:4100,y1:0},{x0:-100,y0:3000,x1:4100,y1:3100},
           {x0:-100,y0:0,x1:0,y1:3000},{x0:4000,y0:0,x1:4100,y1:3000});
  const room={name:'Nappali',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],dropC:2150};
  w.openPlaneView(room,lvl,'drop');
  const PV=w.__PV();
  ok('editor opens on the suspended plane',PV.kind==='drop');
  const d=w.planeViewData(room,lvl,'drop',300);
  ok('band centred on the suspended plane',d.band.ref===2150&&d.band.lo===1850&&d.band.hi===2450,JSON.stringify(d.band));
  ok('plenum reported',d.band.plenum===w.wallH(lvl)-2150);
  const svg=w.planeViewSVG(d,true).svg;
  ok('caption names it and states the plenum',/Álmennyezet/.test(svg)&&/plénum/.test(svg),(svg.match(/Álmennyezet[^<]*/)||[''])[0].slice(0,90));
  ok('walls ghosted like the ceiling view',/stroke-dasharray="4 3"/.test(svg));
  ok('three-way toggle rendered',!!$('pvFloor')&&!!$('pvDrop')&&!!$('pvCeil'));
  ok('toggle switches planes',(function(){$('pvCeil').onclick();const a=w.__PV().kind;
    $('pvDrop').onclick();const b=w.__PV().kind;$('pvFloor').onclick();const c=w.__PV().kind;
    return a==='ceiling'&&b==='drop'&&c==='floor';})());
  w.__PV().kind='drop';w.renderPlaneView();
  // things created here land at the suspended height
  const di=w.pvCreateDevice('light',1200,900);
  ok('device created at the suspended height',w.__data.devices[di].h===2150,''+w.__data.devices[di].h);
  w.pvStartPath(500,500);w.pvAddPathNode(2500,500);w.pvFinishPath();
  const pa=w.__data.paths[w.__data.paths.length-1];
  ok('path drawn at the suspended height',pa.nodes[0].h===2150&&pa.nodes[1].h===2150);
  const d2=w.planeViewData(room,lvl,'drop',300);
  ok('what was drawn shows up in the band',d2.devs.length===1&&d2.secs.length===1);
  ok('the ceiling plane does not claim them',w.planeViewData(room,lvl,'ceiling',300).devs.length===0);
  ok('notes are keyed per plane',w.planeKey(lvl,'drop',room.poly)!==w.planeKey(lvl,'ceiling',room.poly));
  w.wvCloseEditor(true);

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: wall editor',(function(){try{const WA=w.__getWalls()[lvl];WA.length=0;WA.push({x0:0,y0:0,x1:4000,y1:300});
    w.openWallView(WA[0],lvl);w.wvCloseEditor(true);return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: blueprint',(function(){try{w.__state.style='blueprint';w.__state.pitch=90;const q=w.drawBlueprintGeom();
    w.__state.style='plan';w.__state.pitch=30;return q.length>50;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: lamp sheet + Z axis',typeof w.lampDialog==='function'&&w.pLiftable({t:'floors'})===true);
  ok('reg: room sheet + notes',typeof w.roomPropsDialog==='function'&&!!w.NOTEKIND.todo);
  ok('reg: palette + fine mode',w.PLACE_ITEMS.length>=20&&w.fineStep(10)===10);
  ok('reg: chase model',w.chaseWidthOf(25)===40);
  ok('reg: session save',(function(){const so=w.sessionObj();return !!so.data&&!!so.DROPC&&!!so.LH;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
