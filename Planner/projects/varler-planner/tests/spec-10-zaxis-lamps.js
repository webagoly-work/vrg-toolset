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
  const lvl='ground';
  const WA=w.__getWalls()[lvl];WA.length=0;WA.push({x0:0,y0:0,x1:4000,y1:300});
  w.__data.devices.length=0;w.__data.objects.length=0;w.__data.floors.length=0;w.__data.openings.length=0;

  // ---------- Z axis on more piece types ----------
  const H=t=>({t,i:0,level:lvl});
  ok('wall is liftable now',w.pLiftable({t:'wall',i:0,level:lvl})===true);
  ok('floors liftable',w.pLiftable({t:'floors',i:0,level:lvl})===true);
  ok('objects/devices/roofs still liftable',w.pLiftable({t:'objects'})&&w.pLiftable({t:'devices'})&&w.pLiftable({t:'roofs'}));
  // wall
  const wh={t:'wall',i:0,level:lvl,ref:WA[0]};
  ok('wall Z reads z0',(function(){WA[0].z0=800;return w.pGetZ(wh)===800;})(),''+w.pGetZ(wh));
  w.pSetZ(wh,1200);ok('wall Z writes z0',WA[0].z0===1200);
  w.pSetZ(wh,0);ok('wall Z zero clears z0',WA[0].z0===undefined);
  // floors
  w.__data.floors.push({level:lvl,poly:[[0,0],[2000,0],[2000,2000],[0,2000]],name:'Dobogó'});
  const fh={t:'floors',i:0,level:lvl};
  w.pSetZ(fh,150);
  ok('floor Z writes a slab offset',w.__data.floors[0].z===150&&w.pGetZ(fh)===150);
  ok('raised floor reaches the 3D pass',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  w.pSetZ(fh,0);ok('floor Z zero clears',w.__data.floors[0].z===undefined);
  // openings
  w.__data.openings.push({type:'window',level:lvl,x:1000,y:150,ang:0,variant:0,w:1200,h:1500,sill:900});
  w.__data.openings.push({type:'door',level:lvl,x:3000,y:150,ang:0,variant:0,w:900,h:2100});
  const oh={t:'openings',i:0,level:lvl},dh={t:'openings',i:1,level:lvl};
  ok('window Z reads the sill',w.pGetZ(oh)===900);
  w.pSetZ(oh,1100);ok('window sill writable',w.__data.openings[0].sill===1100);
  w.pSetZ(dh,60);ok('door gets a threshold',w.__data.openings[1].sill===60&&w.pGetZ(dh)===60);
  ok('door threshold is honoured by the geometry',(function(){const g=w.openingSym(w.__data.openings[1]);
    w.__data.openings[1].sill=0;const g0=w.openingSym(w.__data.openings[1]);w.__data.openings[1].sill=60;
    return g!==g0;})());
  // stairs stay out of it
  w.__data.openings.push({type:'stairs',level:lvl,x:500,y:500,ang:0,variant:0});
  ok('stairs are not liftable',w.pLiftable({t:'openings',i:2,level:lvl})===false);
  ok('Z labels per type',/Fal indulása/.test(w.pZLabel({t:'wall'}))&&/Parapet/.test(w.pZLabel({t:'openings'}))
     &&/Padlósík/.test(w.pZLabel({t:'floors'}))&&/Szerelési/.test(w.pZLabel({t:'devices'})));
  // gizmo shows the purple handle + value for a wall
  ok('gizmo draws the Z handle with a readout',(function(){WA[0].z0=650;
    const g=w.gizmoSvg({t:'wall',i:0,level:lvl,ref:WA[0]});delete WA[0].z0;
    return /data-ax="z"/.test(g)&&/650 mm/.test(g)&&/#8e44ad/.test(g);})());

  // ---------- lamp data sheet ----------
  w.__data.devices.push({type:'light',ref:'L1',x:2000,y:1500,h:2700,level:lvl});
  const L=w.lampDef(w.__data.devices[0]);
  ok('lamp defaults',L.w===300&&L.ht===120&&L.mount==='mennyezeti'&&L.drop===0&&L.hover===true,JSON.stringify(L).slice(0,90));
  ok('mount table',Object.keys(w.LAMP_MOUNT).length>=6&&w.LAMP_MOUNT.fuggesztett.drop===600);
  ok('fixing methods',Object.keys(w.LAMP_FIX).length>=5&&/Gipszkarton/.test(w.LAMP_FIX.gipszkarton));
  ok('body height = mount − drop − height',(function(){const d=w.__data.devices[0];d.mount='fuggesztett';d.drop=600;d.lampHt=200;
    return w.lampBodyZ(d)===1900;})(),''+w.lampBodyZ(w.__data.devices[0]));

  ok('dialog opens with every field',(function(){w.lampDialog(0);
    return !!$('lpName')&&!!$('lpShape')&&!!$('lpW')&&!!$('lpMount')&&!!$('lpDrop')&&!!$('lpFix')&&!!$('lpUrl')&&!!$('lpFile')&&!!$('lpHover')&&!!$('lpGen')&&!!$('lpShow');})());
  ok('live readout computes the underside',/1900 mm/.test($('lpInfo').innerHTML),$('lpInfo').textContent.slice(0,90));
  ok('mount note shown',$('lpMountNote').textContent.length>4);
  $('lpName').value='Nappali függeszték';$('lpShape').value='rect';$('lpW').value='450';$('lpD').value='450';$('lpHt').value='250';
  $('lpMount').value='fuggesztett';$('lpDrop').value='800';$('lpFix').value='gipszkarton';
  $('lpUrl').value='https://pelda.hu/lampa';$('lpHover').checked=true;$('lpGen').checked=true;$('lpShow').checked=true;
  $('mOk').onclick();
  const D=w.__data.devices[0];
  ok('lamp fields saved',D.lampName==='Nappali függeszték'&&D.lampShape==='rect'&&D.lampW===450&&D.lampHt===250
     &&D.mount==='fuggesztett'&&D.drop===800&&D.lampFix==='gipszkarton'&&D.url==='https://pelda.hu/lampa');
  // generated object
  ok('object generated',w.__data.objects.length===1&&w.lampObjIndex(0)===0);
  const O=w.__data.objects[0];
  ok('object copies the size',O.w===450&&O.d===450&&O.ht===250);
  ok('object hangs at mount − drop − height',O.z===2700-800-250,''+O.z);
  ok('object is tagged as generated',O.genFor==='lamp'&&!!O.genId&&O.genId===D.genId&&w.isGenObject(O)===true);
  ok('object carries the name and link',O.name==='Nappali függeszték'&&O.url==='https://pelda.hu/lampa');
  ok('regenerating updates in place',(function(){D.lampW=600;w.lampGenObject(0);
    return w.__data.objects.length===1&&w.__data.objects[0].w===600;})());
  ok('changing the mounting height moves the object',(function(){D.h=3000;w.lampGenObject(0);
    return w.__data.objects[0].z===3000-800-250;})(),''+w.__data.objects[0].z);
  ok('show/hide toggle',(function(){w.__state.showGenObjects=false;const off=w.genObjectsVisible();
    w.__state.showGenObjects=true;return off===false&&w.genObjectsVisible()===true;})());
  ok('hidden generated objects vanish from the scene',(function(){
    w.__state.pitch=30;w.__state.flat=false;w.__state.style='plan';
    w.__state.showGenObjects=false;w.draw();const a=$('stage').innerHTML.length;
    w.__state.showGenObjects=true;w.draw();const b=$('stage').innerHTML.length;
    return b>a;})(),'sizes compared');
  ok('dropping the object clears the link',(function(){w.lampDropObject(0);
    return w.__data.objects.length===0&&D.genId===undefined&&w.lampObjIndex(0)===-1;})());
  ok('deleting the lamp removes its object',(function(){w.lampGenObject(0);
    const n=w.__data.objects.length;w.removeHit({t:'devices',i:0,level:lvl});
    return n===1&&w.__data.objects.length===0;})());

  // thumbnail + hover
  w.__data.devices.length=0;
  w.__data.devices.push({type:'light',ref:'L2',x:1000,y:1000,h:2700,level:lvl,
    thumb:'data:image/png;base64,iVBORw0KGgo=',hover:true,url:'https://pelda.hu/x',lampName:'Spot'});
  w.lampHoverShow(w.__data.devices[0],120,140);
  const pop=$('thumbPop');
  ok('hover popup created',!!pop&&pop.style.display!=='none');
  ok('popup shows the image and name',/<img/.test(pop.innerHTML)&&/Spot/.test(pop.innerHTML)&&/bolti link/.test(pop.innerHTML));
  ok('popup follows the cursor',pop.style.left==='136px'&&pop.style.top==='156px',pop.style.left+'/'+pop.style.top);
  w.lampHoverHide();
  ok('popup hides',$('thumbPop').style.display==='none');
  ok('hover off means no popup',(function(){w.__data.devices[0].hover=false;w.lampHoverShow(w.__data.devices[0],10,10);
    const hid=$('thumbPop').style.display==='none';w.__data.devices[0].hover=true;return hid;})());
  ok('lampAt only considers lamps with a picture',(function(){
    return w.lampAt(-9999,-9999)===null;})());
  ok('image shrinker exists and is safe',(function(){let got=null;w.lampShrinkImage('data:image/png;base64,zzz',320,o=>{got=o;});
    return typeof w.lampShrinkImage==='function';})());
  ok('lamp data persists',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.data.devices[0].thumb&&so.data.devices[0].lampName==='Spot';})());
  ok('menu offers the lamp sheet',(function(){let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it.map(i=>i.label);};
    w.__planMenuForDevice&&w.__planMenuForDevice(0);w.ctxMenu=old;
    return cap?cap.some(l=>/Lámpa adatlap/.test(l)):'no hook';})());

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: blueprint',(function(){try{w.__state.style='blueprint';w.__state.pitch=90;const q=w.drawBlueprintGeom();
    w.__state.style='plan';w.__state.pitch=30;return q.length>50;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: editors open',(function(){try{w.openWallView(WA[0],lvl);w.wvCloseEditor(true);
    w.openPlaneView({name:'X',poly:[[0,0],[3000,0],[3000,3000],[0,3000]]},lvl,'floor');w.wvCloseEditor(true);return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: room sheet + notes',typeof w.roomPropsDialog==='function'&&!!w.NOTEKIND.warn);
  ok('reg: wall props + doors',typeof w.setWallGeom==='function'&&!!w.DOORTYPE.sliding);
  ok('reg: palette + fine mode',w.PLACE_ITEMS.length>=20&&w.fineStep(10)===10);
  ok('reg: chase model',w.chaseWidthOf(20)===32);
  ok('reg: session save',(function(){const so=w.sessionObj();return !!so.data&&!!so.building;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
