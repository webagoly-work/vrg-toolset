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
  w.__data.devices.length=0;w.__data.paths.length=0;

  // ---------- placement palette ----------
  const P=w.PLACE_ITEMS;
  ok('palette exists',Array.isArray(P)&&P.length>=18,'n='+(P&&P.length));
  const ids=P.map(i=>i.id);
  ok('boxes first',ids.slice(0,5).join(',')==='box,boxlv,kd80,kd100,kdx',ids.slice(0,5).join(','));
  ok('switch kinds present',['k_101','k_102','k_103','k_105','k_106','k_107'].every(k=>ids.includes(k)));
  ok('socket kinds present',['k_2pf','k_utp','k_3f'].every(k=>ids.includes(k)));
  ok('light + board at the end',ids.slice(-2).join(',')==='light,board');
  ok('every item makes a device',P.filter(i=>i.id!=='kdx').every(i=>{const d=i.mk();return d&&d.type;}));
  ok('switch kind maps to switch type',P.find(i=>i.id==='k_105').mk().type==='switch'&&P.find(i=>i.id==='k_105').mk().kind==='105');
  ok('socket kind maps to socket type',P.find(i=>i.id==='k_utp').mk().type==='socket');
  ok('KD80 is a circle, KD100 a rect',P.find(i=>i.id==='kd80').mk().jbShape==='circle'&&P.find(i=>i.id==='kd100').mk().jbSize===100);
  ok('LV box is flagged + tinted',P.find(i=>i.id==='boxlv').mk().lv===true&&!!P.find(i=>i.id==='boxlv').mk().boxColor);
  ok('DEV knows the box type',w.DEV.box==='Szerelvénydoboz'&&w.REFPRE.box==='SZ');

  // cycling
  w.__state.placeIdx=0;w.cyclePlace(1);
  ok('cycle forward',w.__state.placeIdx===1&&w.placeItem().id==='boxlv',''+w.__state.placeIdx);
  w.cyclePlace(-1);w.cyclePlace(-1);
  ok('cycle wraps backwards',w.__state.placeIdx===P.length-1&&w.placeItem().id==='board',''+w.__state.placeIdx);
  w.__state.placeIdx=0;

  // placing
  const setCur=(x,y,h)=>{w.__setCursor?w.__setCursor({x,y,level:lvl,h}):null;};
  ok('cursor hook',typeof w.__setCursor==='function');
  setCur(1000,500,1100);
  let di=w.placeAtCursor();
  let d0=w.__data.devices[di];
  ok('Space places the empty box',d0.type==='box'&&d0.x===1000&&d0.h===1100,JSON.stringify({t:d0.type,x:d0.x,h:d0.h}));
  ok('placed device gets a ref',d0.ref==='SZ1',''+d0.ref);
  w.__state.placeIdx=P.findIndex(i=>i.id==='k_105');
  di=w.placeAtCursor();d0=w.__data.devices[di];
  ok('kapcsoló 105 = switch in a box',d0.type==='switch'&&d0.kind==='105'&&d0.ref==='K1',JSON.stringify({t:d0.type,k:d0.kind,r:d0.ref}));
  w.__state.placeIdx=P.findIndex(i=>i.id==='k_3f');
  di=w.placeAtCursor();d0=w.__data.devices[di];
  ok('aljzat 3F = socket in a box',d0.type==='socket'&&d0.kind==='3f'&&d0.ref==='D1');
  w.__state.placeIdx=P.findIndex(i=>i.id==='kd100');
  di=w.placeAtCursor();d0=w.__data.devices[di];
  ok('kötődoboz 100 placed',d0.type==='junction'&&d0.jbSize===100&&d0.jbShape==='rect'&&d0.ref==='KD1');
  ok('placement is undoable',(function(){const n=w.__data.devices.length;w.document.getElementById('bUndo').onclick();
    return w.__data.devices.length===n-1;})());

  // kind codes render
  ok('kind code helper',w.wvKindCode({kind:'107'})==='107'&&w.wvKindCode({kind:'2pf'})==='2P+F'&&w.wvKindCode({lv:true})==='LV'&&w.wvKindCode({})==='');
  const box=w.wvDevBox({type:'switch',kind:'101'},50,50,0.2,'#000',false);
  ok('elevation box shows the code',/>101</.test(box));
  const psym=w.devSym({type:'box',x:0,y:0,h:0,level:lvl,lv:true,ref:'SZ9'});
  ok('plan symbol for an empty box',/stroke-dasharray/.test(psym));
  ok('plan symbol prints LV',/>LV</.test(psym));
  ok('plan symbol prints the kind',/>UTP</.test(w.devSym({type:'socket',kind:'utp',x:0,y:0,h:0,level:lvl,ref:'D9'})));

  // ---------- fine (Alt) mode ----------
  ok('fine helpers',typeof w.fineOn==='function'&&typeof w.fineXY==='function'&&w.fineStep(10)===10);
  w.fineOn(500,500);
  ok('fine mode damps the pointer 5×',JSON.stringify(w.fineXY(600,500))==='[520,500]',JSON.stringify(w.fineXY(600,500)));
  ok('fine mode drops the grid to 1mm',w.fineStep(10)===1);
  w.fineOff();
  ok('release restores 1:1',JSON.stringify(w.fineXY(600,500))==='[600,500]'&&w.fineStep(10)===10);
  // the editors inherit it through their setters
  w.__data.devices.length=0;w.__data.paths.length=0;
  w.__data.devices.push({type:'socket',ref:'D1',x:0,y:90,h:300,level:lvl});
  w.__data.paths.push({nodes:[{x:0,y:90,h:300,level:lvl},{x:2000,y:90,h:300,level:lvl}],sections:[{build:'sull_gege'}]});
  w.openWallView({x0:0,y0:0,x1:4000,y1:100,h:2700},lvl);
  w.wvSetNode(0,1,1234,567);
  ok('editor drag snaps to 10mm normally',w.__data.paths[0].nodes[1].x===1230&&w.__data.paths[0].nodes[1].h===570,
     w.__data.paths[0].nodes[1].x+'/'+w.__data.paths[0].nodes[1].h);
  w.fineOn(0,0);w.wvSetNode(0,1,1234,567);
  ok('editor drag snaps to 1mm while Alt is held',w.__data.paths[0].nodes[1].x===1234&&w.__data.paths[0].nodes[1].h===567,
     w.__data.paths[0].nodes[1].x+'/'+w.__data.paths[0].nodes[1].h);
  w.fineOff();w.wvCloseEditor(true);

  // ---------- camera memory ----------
  const st=w.__state;
  st.pitch=32;st.rot=45;st.zoom=0.8;st.panX=111;st.panY=222;st.flat=false;st.cam2d=null;st.cam3d=null;
  const btn=w.document.getElementById('view3d');
  btn.onclick();                                   // 3D → 2D
  ok('switch to 2D sets top-down',st.pitch===90&&st.flat===true&&btn.textContent==='3D');
  ok('3D camera parked',st.cam3d&&st.cam3d.pitch===32&&st.cam3d.rot===45&&st.cam3d.zoom===0.8,JSON.stringify(st.cam3d));
  st.zoom=2.5;st.panX=10;st.panY=20;st.rot=180;     // work in 2D
  btn.onclick();                                   // 2D → 3D
  ok('3D camera restored exactly',st.pitch===32&&st.rot===45&&st.zoom===0.8&&st.panX===111&&st.panY===222,
     JSON.stringify({p:st.pitch,r:st.rot,z:st.zoom,x:st.panX}));
  ok('2D camera parked',st.cam2d&&st.cam2d.zoom===2.5&&st.cam2d.rot===180,JSON.stringify(st.cam2d));
  btn.onclick();
  ok('2D camera restored (no reset)',st.zoom===2.5&&st.panX===10&&st.rot===180,JSON.stringify({z:st.zoom,x:st.panX,r:st.rot}));
  ok('rotation slider follows',w.document.getElementById('rot').value==='180',w.document.getElementById('rot').value);
  ok('camera memory persists in session',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.state.cam3d&&so.state.cam3d.pitch===32;})());

  // ---------- build ghost ----------
  ok('build names',w.BUILDNAME.door==='Ajtó'&&w.BUILDNAME.stairs==='Lépcső');
  ok('ghost var exists',typeof w.__buildGhost==='function');
  st.mode='build';st.buildType='window';
  w.__setBuildGhost({type:'window',level:lvl,x:1500,y:0,ang:0,variant:0});
  const scene=w.drawScene?w.drawScene():null;
  ok('ghost drawn in the scene',(function(){try{w.draw();const svg=w.document.getElementById('stage').innerHTML;
    return /0\.42/.test(svg)&&/Ablak/.test(svg);}catch(e){return 'ERR '+e.message;}})()===true);
  w.__setBuildGhost(null);st.mode='select';
  ok('setMode clears the ghost',(function(){w.__setBuildGhost({type:'door',level:lvl,x:1,y:1,ang:0});w.setMode('select');
    return w.__buildGhost()===null;})());

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: wall editor',(function(){try{w.openWallView({x0:0,y0:0,x1:4000,y1:100,h:2700},lvl);const o=w.__WV()!==null;
    w.wvCloseEditor(true);return o;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: plane editor',(function(){try{w.openPlaneView({name:'X',poly:[[0,0],[3000,0],[3000,3000],[0,3000]]},lvl,'floor');
    const o=w.__PV()!==null;w.wvCloseEditor(true);return o;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: chase model',w.chaseWidthOf(20)===32&&typeof w.wvChaseShapes==='function');
  ok('reg: nextRef unaffected',w.nextRef('light').startsWith('L'));
  ok('reg: blueprint + reports',typeof w.drawBlueprintGeom==='function'&&typeof w.switchReportData==='function');
  ok('reg: session save',(function(){const so=w.sessionObj();return !!so.data&&!!so.state;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
