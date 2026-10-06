// spec-32 — layer model v2: sixteen sub-layer categories, per-category opacity, layer undo, schema seed
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
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const LY=()=>w.eval('layers'),STK=()=>w.eval('stacks'),SCENE=()=>w.eval('_lastScene');
  const J=o=>JSON.stringify(o);
  w.newBlankProject();
  const D=()=>w.__data;

  // 1 — the catalogue
  const KEYS=['path','socket','switch','light','device','wall','door','window','stairs','object','floor','roof','note','cable','mark','trace'];
  ok('LAYER_CATS has 16 entries in panel order',J(w.LAYER_CATS.map(c=>c.k))===J(KEYS));
  ok('layerCatsAll() has all 16 true',(function(){const o=w.layerCatsAll();return Object.keys(o).length===16&&KEYS.every(k=>o[k]===true);})());
  ok('the default layer is built from layerCatsAll',J(LY()[0].cats)===J(w.layerCatsAll()));

  // 2 — v1 → v2 migration
  const L1={id:'Lx',name:'Régi',visible:true,cats:{path:true,device:false,cable:true,wall:true,build:false,object:true}};
  w.lyrMigrate(L1);
  ok('v1 device=false turns socket/switch/light/device off',['socket','switch','light','device'].every(k=>L1.cats[k]===false));
  ok('v1 build=false turns door/window/stairs/floor/roof off',['door','window','stairs','floor','roof'].every(k=>L1.cats[k]===false));
  ok('the rest keep their value, every key present, no v1 build key',L1.cats.path===true&&L1.cats.wall===true&&L1.cats.cable===true&&L1.cats.object===true&&
     !('build' in L1.cats)&&KEYS.every(k=>k in L1.cats));
  ok('lyrMigrate is idempotent',(function(){const a=J(L1);w.lyrMigrate(L1);return J(L1)===a;})());
  ok('a v2 layer with device=false is not re-expanded',(function(){const L={cats:w.layerCatsAll()};L.cats.device=false;w.lyrMigrate(L);return L.cats.socket===true&&L.cats.device===false;})());
  ok('lyrMigrate cleans op: rounds, clamps, drops 1 and unknown',(function(){
    const L={cats:{},op:{socket:0.55,wall:0.04,door:1,bogus:0.5,light:'x'}};w.lyrMigrate(L);return J(L.op)===J({socket:0.6,wall:0.1});})());
  ok('an empty op map is removed',(function(){const L={cats:{},op:{socket:1}};w.lyrMigrate(L);return !('op' in L);})());

  // 3 — layerShows follows the v2 category of the item
  const L0=()=>LY()[0];
  const sock={type:'socket',layer:'L0'},junc={type:'junction',layer:'L0'},door={type:'door',layer:'L0'},floorRec={poly:[[0,0],[1,0],[1,1]],layer:'L0'},roofRec={type:'gable',layer:'L0'};
  L0().cats.socket=false;
  ok("layerShows(socket,'device') follows cats.socket",w.layerShows(sock,'device')===false&&w.layerShows(junc,'device')===true);
  L0().cats.socket=true;L0().cats.device=false;
  ok("cats.device no longer hides sockets",w.layerShows(sock,'device')===true&&w.layerShows(junc,'device')===false);
  L0().cats.device=true;L0().cats.door=false;
  ok("layerShows(door,'build') follows cats.door",w.layerShows(door,'build')===false&&w.layerShows({type:'window',layer:'L0'},'build')===true);
  L0().cats.door=true;L0().cats.floor=false;
  ok("layerShows(floor,'build') follows cats.floor",w.layerShows(floorRec,'build')===false&&w.layerShows(roofRec,'build')===true);
  L0().cats.floor=true;L0().visible=false;
  ok('a hidden layer hides every category',w.layerShows(sock,'device')===false&&w.layerShows({},'wall')===false);
  L0().visible=true;

  // 4 — category of an item
  ok('lyrDevCat: socket/switch/light are their own',w.lyrDevCat({type:'socket'})==='socket'&&w.lyrDevCat({type:'switch'})==='switch'&&w.lyrDevCat({type:'light'})==='light');
  ok('lyrDevCat: junction and board are device',w.lyrDevCat({type:'junction'})==='device'&&w.lyrDevCat({type:'board'})==='device');
  ok('lyrDevCat: end points by code',w.lyrDevCat({type:'ep',code:'LNR'})==='light'&&w.lyrDevCat({type:'ep',code:'LMP'})==='light'&&
     w.lyrDevCat({type:'ep',code:'SWI'})==='switch'&&w.lyrDevCat({type:'ep',code:'SOC'})==='socket'&&w.lyrDevCat({type:'ep',code:'ETH'})==='device');
  ok('lyrCatOf maps every collection',w.lyrCatOf('devices',{type:'light'})==='light'&&w.lyrCatOf('openings',{type:'stairs'})==='stairs'&&
     w.lyrCatOf('floors',{})==='floor'&&w.lyrCatOf('roofs',{})==='roof'&&w.lyrCatOf('objects',{})==='object'&&w.lyrCatOf('paths',{})==='path'&&
     w.lyrCatOf('cables',{})==='cable'&&w.lyrCatOf('notes',{})==='note'&&w.lyrCatOf('wallNotes',{})==='note'&&w.lyrCatOf('walls',{})==='wall'&&
     w.lyrCatOf('marks',{})==='mark'&&w.lyrCatOf('traces',{})==='trace');

  // 5 — opacity setting
  w.lyrSetOp('L0','socket',0.55);
  ok('lyrSetOp(0.55) stores 0.6',L0().op&&L0().op.socket===0.6);
  ok("lyrOpAttr gives ' opacity=\"0.6\"'",w.lyrOpAttr(sock,'device')===' opacity="0.6"');
  w.lyrSetOp('L0','socket',0.04);
  ok('lyrSetOp(0.04) stores 0.1',L0().op.socket===0.1);
  w.lyrSetOp('L0','socket',1);
  ok('lyrSetOp(1) deletes the key (and an empty op map)',!('op' in L0())&&w.lyrOpAttr(sock,'device')==='');
  ok('lyrWrap is the identity at 100 %',w.lyrWrap(sock,'device','<g/>')==='<g/>');
  w.lyrSetOp('L0','nope',0.5);
  ok('an unknown category is ignored',!('op' in L0()));

  // 6 — opacity in the scene
  const D0=D();
  D0.floors.push({level:lvl,name:'T',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  D0.devices.push({type:'socket',ref:'D1',level:lvl,x:1000,y:1000,h:300,layer:'L0',side:0});
  w.ensureIds(D0);w.__state.rot=0;w.__state.pitch=90;w.__state.flat=true;
  w.draw();const before=SCENE();
  const count=(s,t)=>s.split(t).length-1;
  w.lyrSetOp('L0','socket',0.6);w.draw();const faded=SCENE();
  ok('at 60 % the socket scene carries opacity="0.6" once',count(faded,'opacity="0.6"')===count(before,'opacity="0.6"')+1);
  w.lyrSetOp('L0','socket',1);w.draw();
  ok('back at 100 % the scene is byte-identical to before',SCENE()===before);
  const planBefore=w.drawNormalGeom();
  w.lyrSetOp('L0','floor',0.5);
  ok('a floor at 50 % fades its face in the plan render',w.drawNormalGeom()!==planBefore&&w.drawNormalGeom().indexOf('opacity="0.5"')>=0);
  w.lyrSetOp('L0','floor',1);
  ok('floor back at 100 % → plan render identical',w.drawNormalGeom()===planBefore);
  const bpBefore=w.drawBlueprintPlan();
  w.lyrSetOp('L0','wall',0.5);w.lyrSetOp('L0','object',0.5);
  ok('blueprint plan is unchanged by opacity when there are no walls or objects',w.drawBlueprintPlan()===bpBefore);
  w.lyrSetOp('L0','wall',1);w.lyrSetOp('L0','object',1);
  // a wall: the blueprint groups per opacity, one group at 100 %
  w.__getWalls()[lvl].push({x0:0,y0:0,x1:4000,y1:100});w.ensureIds(D0);w.draw();
  const bpW=w.drawBlueprintPlan();
  w.lyrSetOp('L0','wall',0.5);const bpW5=w.drawBlueprintPlan();
  ok('blueprint plan: a faded wall is wrapped in one group',bpW5!==bpW&&count(bpW5,'<g opacity="0.5">')===1);
  w.lyrSetOp('L0','wall',1);
  ok('blueprint plan: wall back at 100 % → identical',w.drawBlueprintPlan()===bpW);
  w.__getWalls()[lvl].length=0;D0.devices.length=0;D0.floors.length=0;

  // 7 — schema seed
  w.newBlankProject();
  ok('UKEYS lists marks/traces/runs',(function(){const u=w.eval('UKEYS');return ['marks','traces','runs'].every(k=>u.indexOf(k)>=0);})());
  ok('IDPRE gives J / T / H',(function(){const p=w.eval('IDPRE');return p.marks==='J'&&p.traces==='T'&&p.runs==='H';})());
  ok('a blank project has the three arrays, empty',['marks','traces','runs'].every(k=>Array.isArray(D()[k])&&D()[k].length===0));
  ok('ensureIds gives a pushed mark the id J<n>',(function(){D().marks.push({kind:'wall',layer:'L0',level:lvl});w.ensureIds(D());return /^J\d+$/.test(D().marks[0].id);})());
  w.newBlankProject();
  ok('a project reset empties the new collections',D().marks.length===0);

  // 8 — stacks travel with the session
  ok('sessionObj() carries stacks:[]',(function(){const o=w.sessionObj();return Array.isArray(o.stacks)&&o.stacks.length===0;})());
  ok('sessionObj() carries a stack that was set',(function(){w.eval("stacks=[{id:'S1',name:'T',layers:[]}]");const o=w.sessionObj();const r=o.stacks.length===1&&o.stacks[0].id==='S1';w.eval('stacks=[]');return r;})());
  ok('applyProjectData of a session without stacks yields []',(function(){const o=w.sessionObj();delete o.stacks;w.eval("stacks=[{id:'S9'}]");w.applyProjectData(o);return STK().length===0;})());
  ok('applyProjectData migrates a v1 layer',(function(){const o=w.sessionObj();o.layers=[{id:'L0',name:'Alap',visible:true,cats:{path:true,device:false,cable:true,wall:true,build:true,object:true}}];
    w.applyProjectData(o);const c=LY()[0].cats;return c.socket===false&&c.light===false&&c.door===true&&!('build' in c);})());
  ok('a v1 session without cats for new keys opens with every layer button state kept',(function(){
    const o=w.sessionObj();o.layers=[{id:'L0',name:'A',visible:true,cats:{path:true,device:true,cable:true,wall:false,build:true,object:true}}];w.applyProjectData(o);
    const c=LY()[0].cats;return c.wall===false&&KEYS.filter(k=>k!=='wall').every(k=>c[k]===true);})());
  ok('hardResetWorkspace clears stacks',(function(){w.eval("stacks=[{id:'S2'}]");w.hardResetWorkspace();return STK().length===0;})());
  w.newBlankProject();

  // 9 — layer undo
  ok('lyrPushUndo then a rename: doUndo restores the name, doRedo re-applies it',(function(){
    LY()[0].name='Alap';w.lyrPushUndo();LY()[0].name='Átnevezett';w.doUndo();const a=LY()[0].name==='Alap';w.doRedo();const b=LY()[0].name==='Átnevezett';
    LY()[0].name='Alap';return a&&b;})());
  ok('undo of a layer add restores the layer list',(function(){const n=LY().length;w.lyrPushUndo();LY().push({id:'Lq',name:'x',visible:true,cats:w.layerCatsAll()});w.doUndo();return LY().length===n;})());
  ok('undoing the add of the ACTIVE layer moves the drawing target back to a live layer',(function(){const S=w.__state;w.lyrPushUndo();LY().push({id:'Lz',name:'z',visible:true,cats:w.layerCatsAll()});S.activeLayer='Lz';w.doUndo();const back=S.activeLayer==='L0'&&!LY().some(l=>l.id==='Lz');w.doRedo();const fwd=LY().some(l=>l.id==='Lz');S.activeLayer='L0';w.lyrPushUndo();w.doUndo();return back&&fwd;})());
  ok('undo of a stack change restores stacks',(function(){w.lyrPushUndo();w.eval("stacks.push({id:'S3'})");w.doUndo();return STK().length===0;})());

  // 10 — undo isolation: a device undo must not revert a visibility toggle made after it
  ok('undo of a device move leaves the layer visibility alone',(function(){
    w.newBlankProject();D().devices.push({type:'socket',ref:'D1',level:lvl,x:100,y:100,h:300,layer:'L0'});w.ensureIds(D());
    w.pushUndo(['devices']);D().devices[0].x=999;LY()[0].visible=false;w.doUndo();
    const r=D().devices[0].x===100&&LY()[0].visible===false;LY()[0].visible=true;return r;})());

  // 11 — scoped entries unchanged
  ok("pushUndo(['paths']) snapshot has no __walls and no __layers, scope ['paths']",(function(){
    w.newBlankProject();w.pushUndo(['paths']);const sn=w.eval('undo[undo.length-1]');
    return J(sn.__scope)===J(['paths'])&&!('__walls' in sn)&&!('__layers' in sn)&&Array.isArray(sn.paths)&&!('devices' in sn);})());
  ok('a plain pushUndo() carries all collections and walls but not layers',(function(){
    w.pushUndo();const sn=w.eval('undo[undo.length-1]');return sn.__scope===null&&!!sn.__walls&&!('__layers' in sn)&&Array.isArray(sn.marks)&&Array.isArray(sn.runs);})());
  ok('lyrPushUndo snapshot is marked and carries layers + stacks + walls',(function(){
    w.lyrPushUndo();const sn=w.eval('undo[undo.length-1]');return sn.__scope.indexOf('__layers')>=0&&!!sn.__layers&&Array.isArray(sn.__layers.layers)&&!!sn.__walls;})());
  ok('applySnap never writes __walls / __layers into data',(function(){
    w.lyrPushUndo();w.doUndo();return !('__walls' in D())&&!('__layers' in D())&&!('__scope' in D());})());
  ok('a lone marker scope falls back to every collection',(function(){
    w.newBlankProject();D().devices.push({type:'socket',level:lvl,x:1,y:1,h:0,layer:'L0'});w.ensureIds(D());w.pushUndo(['__layers']);
    D().devices.length=0;w.doUndo();return D().devices.length===1;})());
  // 12 — Wall View and Plane View honour the opacity
  ok('Wall View: a faded socket carries op and its SVG is wrapped; at 100 % nothing changes',(function(){
    w.newBlankProject();const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:4000,y1:100});
    D().floors.push({level:lvl,name:'T',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
    D().devices.push({type:'socket',ref:'D1',level:lvl,x:1000,y:50,h:300,layer:'L0',side:0});w.ensureIds(D());
    const r=WA[0],d0=w.wallElevationData(r,lvl),s0=w.wallElevationSVG(d0,false,false).svg;
    w.lyrSetOp('L0','socket',0.5);const d1=w.wallElevationData(r,lvl),s1=w.wallElevationSVG(d1,false,false).svg;
    w.lyrSetOp('L0','socket',1);const d2=w.wallElevationData(r,lvl),s2=w.wallElevationSVG(d2,false,false).svg;
    return d0.devs.length===1&&!('op' in d0.devs[0])&&d1.devs[0].op===0.5&&s1.indexOf('<g opacity="0.5">')>=0&&s2===s0;})());
  ok('Plane View: a faded socket carries op and its SVG is wrapped; at 100 % nothing changes',(function(){
    const room=D().floors[0],p0=w.planeViewData(room,lvl,'floor'),sv0=w.planeViewSVG(p0,false).svg;
    w.lyrSetOp('L0','socket',0.5);const p1=w.planeViewData(room,lvl,'floor'),sv1=w.planeViewSVG(p1,false).svg;
    w.lyrSetOp('L0','socket',1);const sv2=w.planeViewSVG(w.planeViewData(room,lvl,"floor"),false).svg;
    const all=p1.devs.concat(p1.ghosts);return all.length===1&&all[0].op===0.5&&sv2===sv0&&(sv1.indexOf('<g opacity="0.5">')>=0||p1.devs.length===0);})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
