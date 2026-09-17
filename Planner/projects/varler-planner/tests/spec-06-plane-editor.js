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
try{Object.defineProperty(w,'innerWidth',{value:1920});Object.defineProperty(w,'innerHeight',{value:1080});}catch(_){}
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';
  const room={name:'Nappali',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],fill:'#e2ddd0'};
  const H=w.__LH?w.__LH()[lvl]:null;
  const reset=()=>{w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;w.__data.wallNotes=[];
    // ceiling ring + a drop to a wall switch
    w.__data.devices.push({type:'light',ref:'L1',x:2000,y:1500,h:2700,level:lvl});
    w.__data.devices.push({type:'switch',ref:'K1',x:300,y:2900,h:1100,level:lvl});
    w.__data.devices.push({type:'socket',ref:'D1',x:3500,y:2900,h:300,level:lvl});
    w.__data.paths.push({nodes:[
      {x:2000,y:1500,h:2700,level:lvl},{x:600,y:1500,h:2700,level:lvl},{x:600,y:2900,h:2700,level:lvl},
      {x:300,y:2900,h:2700,level:lvl},{x:300,y:2900,h:1100,level:lvl}],
      sections:[{build:'sull_gege'},{build:'sull_gege'},{build:'sull_gege'},{build:'sull_gege'}]});};
  const WA=w.__getWalls()[lvl];WA.length=0;
  WA.push({x0:-100,y0:-100,x1:4100,y1:0,h:2700},{x0:-100,y0:3000,x1:4100,y1:3100,h:2700},
          {x0:-100,y0:0,x1:0,y1:3000,h:2700},{x0:4000,y0:0,x1:4100,y1:3000,h:2700});
  reset();
  const ceilH=w.wallH(lvl);
  ok('level height available',ceilH>1000,''+ceilH);
  // put the ceiling run at the real ceiling height
  w.__data.paths[0].nodes.slice(0,4).forEach(n=>n.h=ceilH);
  w.__data.devices[0].h=ceilH;
  w.__data.paths[0].nodes[4].h=1100;

  // ---------- open ----------
  w.openPlaneView(room,lvl,'ceiling');
  let PV=w.__PV?w.__PV():null;
  ok('openPlaneView creates a session',!!w.pvListRows&&typeof w.renderPlaneView==='function');
  let d=w.planeViewData(room,lvl,'ceiling',300);
  ok('ceiling band around the ceiling',d.band.lo===ceilH-300&&d.band.ref===ceilH,JSON.stringify(d.band));
  ok('ceiling devices in band',d.devs.length===1&&d.devs[0].ref==='L1',JSON.stringify(d.devs.map(x=>x.ref)));
  ok('out-of-band devices become context',d.ghosts.length===2,JSON.stringify(d.ghosts.map(x=>x.ref)));
  ok('in-plane sections only',d.secs.length===3,''+d.secs.length);
  ok('riser where the run leaves the plane',d.risers.length===1&&d.risers[0].to===1100,JSON.stringify(d.risers));
  ok('riser direction is downward',d.risers[0].to<d.risers[0].z);
  ok('bounding walls found',d.walls.length===4,''+d.walls.length);
  ok('secs use ua/ha = x/y',d.secs[0].ua===2000&&d.secs[0].ha===1500);

  // floor plane
  let df=w.planeViewData(room,lvl,'floor',300);
  ok('floor band at the slab',df.band.ref===0&&df.band.hi===300,JSON.stringify(df.band));
  ok('floor plane sees no ceiling run',df.secs.length===0&&df.risers.length===0,df.secs.length+'/'+df.risers.length);
  ok('only the floor-height device is in band',df.devs.length===1&&df.devs[0].ref==='D1'&&df.ghosts.length===2,
     JSON.stringify(df.devs.map(x=>x.ref))+' ghosts='+df.ghosts.length);
  // wider band picks up the wall socket
  df=w.planeViewData(room,lvl,'floor',100);
  ok('narrowing the band drops the 300mm socket',df.devs.length===0&&df.ghosts.length===3,
     df.devs.length+'/'+df.ghosts.length);

  // ---------- render ----------
  const out=w.planeViewSVG(d,true);
  ok('svg renders',/^<svg /.test(out.svg)&&out.w>200&&out.h>200,out.w+'x'+out.h);
  ok('room slab drawn',/<polygon points="[^"]+" fill=/.test(out.svg));
  ok('ceiling walls ghosted (dashed)',/stroke-dasharray="4 3"/.test(out.svg));
  ok('floor walls solid',!/stroke-dasharray="4 3"/.test(w.planeViewSVG(w.planeViewData(room,lvl,'floor',400),true).svg));
  ok('caption says through-the-wall',/a falakon átnézve/.test(out.svg));
  ok('riser marker drawn',/class="pvriser"/.test(out.svg)&&/1100 mm/.test(out.svg));
  ok('context ghosts drawn',(out.svg.match(/class="pvghost"/g)||[]).length===2);
  ok('chase layer reused',(out.svg.match(/<clipPath id="cutclip"/g)||[]).length===1&&/class="cutsum"/.test(out.svg));
  ok('chase summary metres',/2\.[0-9]{2} m|3\.[0-9]{2} m/.test(out.svg),(out.svg.match(/Véset[^<]*/)||[''])[0].slice(0,90));
  ok('grab lines + nodes',(out.svg.match(/class="wvseg"/g)||[]).length===3&&(out.svg.match(/class="wvnode"/g)||[]).length===6);
  ok('device drawn with ref',/class="wvdev"/.test(out.svg)&&/>L1</.test(out.svg));
  // mirror + layers
  const PVo=w.__PV();PVo.mirror=true;const m=w.planeViewSVG(d,true);
  ok('mirror flips X',m.mir===1&&m.svg!==out.svg);PVo.mirror=false;
  PVo.layers.context=false;
  ok('context layer toggles',!/class="pvghost"/.test(w.planeViewSVG(d,true).svg));PVo.layers.context=true;
  PVo.layers.cuts=false;
  ok('cut layer toggles',!/cutclip/.test(w.planeViewSVG(d,true).svg));PVo.layers.cuts=true;
  PVo.full=true;const bigger=w.planeViewSVG(d,true);
  ok('fullscreen enlarges',bigger.sc>out.sc,out.sc.toFixed(3)+'→'+bigger.sc.toFixed(3));PVo.full=false;

  // ---------- setters ----------
  w.pvSetDevice(0,2345,1678);
  ok('device drag snaps to 10mm',w.__data.devices[0].x===2350&&w.__data.devices[0].y===1680,w.__data.devices[0].x+'/'+w.__data.devices[0].y);
  w.pvSetDevice(0,2000,1500,true);
  ok('typed device position exact',w.__data.devices[0].x===2000&&w.__data.devices[0].y===1500);
  ok('device height untouched by plan moves',w.__data.devices[0].h===ceilH);
  w.pvSetDeviceZ(0,2600);
  ok('height setter works',w.__data.devices[0].h===2600);w.pvSetDeviceZ(0,ceilH);
  w.pvSetNode(0,1,700,1600,true);
  ok('node setter exact',w.__data.paths[0].nodes[1].x===700&&w.__data.paths[0].nodes[1].y===1600);
  ok('node height untouched',w.__data.paths[0].nodes[1].h===ceilH);
  // links work top-down
  w.ensureIds(w.__data);w.setLink(w.__data.devices[0],w.__data.paths[0].id,w.__data.paths[0].nodes[0].id);
  w.pvSetDevice(0,1800,1400,true);
  ok('linked node follows in plan',w.__data.paths[0].nodes[0].x===1800&&w.__data.paths[0].nodes[0].y===1400);
  w.pvSetNode(0,0,2100,1550,true);
  ok('device follows its node in plan',w.__data.devices[0].x===2100&&w.__data.devices[0].y===1550);
  delete w.__data.devices[0].link;

  // ---------- warp in plan ----------
  d=w.planeViewData(room,lvl,'ceiling',300);
  const bx=w.wvWarpBox(d,0);
  ok('warp box works on plan coords',bx&&bx.u0>=0&&bx.u1<=4000&&bx.nodes.length===4,JSON.stringify(bx&&{u0:bx.u0,u1:bx.u1,h0:bx.h0,h1:bx.h1,n:bx.nodes.length}));
  const ax=bx.u1,sx=(bx.u0+1000-ax)/(bx.u0-ax);
  bx.nodes.forEach(n=>w.pvSetNode(0,n.ni,ax+(n.u-ax)*sx,n.h,true));
  ok('warp scales about the anchor',Math.abs(w.__data.paths[0].nodes[0].x-(ax+(bx.nodes.find(n=>n.ni===0).u-ax)*sx))<1);

  // ---------- create anything ----------
  reset();w.openPlaneView(room,lvl,'ceiling');PV=w.__PV();
  const di=w.pvCreateDevice('light',1200,800);
  ok('created light at ceiling height',w.__data.devices[di].h===ceilH&&w.__data.devices[di].x===1200,
     w.__data.devices[di].h+'/'+w.__data.devices[di].x);
  ok('created device has a ref',!!w.__data.devices[di].ref);
  w.__PV().kind='floor';w.renderPlaneView();
  const di2=w.pvCreateDevice('socket',900,200);
  ok('floor plane creates at 0mm',w.__data.devices[di2].h===0);
  w.__PV().kind='ceiling';w.renderPlaneView();
  w.pvStartPath(500,500);
  ok('path draw armed',w.__PV().drawPi!=null&&w.__data.paths[w.__PV().drawPi].nodes[0].h===ceilH);
  w.pvAddPathNode(2500,500);w.pvAddPathNode(2500,2000);
  const np=w.__data.paths[w.__PV().drawPi];
  ok('nodes+sections added in plan',np.nodes.length===3&&np.sections.length===2);
  w.pvFinishPath();
  ok('finish clears draw mode',w.__PV().drawPi===null);
  const before=w.__data.paths.length;w.pvStartPath(10,10);w.pvFinishPath();
  ok('lone node discarded',w.__data.paths.length===before);
  ok('create menu items',(function(){let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it.map(i=>i.label);};
    w.pvCreateMenu({},100,100);w.ctxMenu=old;
    return cap&&cap.length===6&&cap.some(l=>/Lámpa/.test(l))&&cap.some(l=>/Pálya rajzolása/.test(l));})());
  ok('device menu gains a height item in plane mode',(function(){let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it.map(i=>i.label);};
    w.wvDeviceMenu({},0);w.ctxMenu=old;
    return cap&&cap.some(l=>/Magasság a padlótól/.test(l))&&!cap.some(l=>/csatolása szomszédhoz/.test(l));})());

  // ---------- notes ----------
  reset();w.openPlaneView(room,lvl,'floor');
  const key=w.planeKey(lvl,'floor',room.poly);
  w.__data.wallNotes.push({wallKey:key,u:1000,h:1000,text:'padlófűtés osztó'});
  d=w.planeViewData(room,lvl,'floor',300);
  ok('plane notes are keyed separately',d.notes.length===1&&d.notes[0].text==='padlófűtés osztó');
  ok('ceiling plane does not show floor notes',w.planeViewData(room,lvl,'ceiling',300).notes.length===0);

  // ---------- coordinate list ----------
  reset();w.openPlaneView(room,lvl,'ceiling');
  d=w.planeViewData(room,lvl,'ceiling',300);
  let rows=w.pvListRows(d);
  ok('list covers devices+nodes+ghosts',rows.length>=7&&rows.filter(r=>r.ghost).length===2,JSON.stringify(rows.map(r=>r.kind)));
  ok('riser info folded into its node row',rows.some(r=>/⊙/.test(r.type)&&/↓ 1100 mm/.test(r.extra)),
     JSON.stringify(rows.filter(r=>r.kind==='node').map(r=>r.extra)));
  const lh=w.pvListHTML(d);
  ok('list has X/Y/height columns',/X balról/.test(lh)&&/Y fentről/.test(lh)&&/magasság/.test(lh));
  ok('list marks out-of-band rows',/sávon kívül/.test(lh));
  const devRow=rows.find(r=>r.kind==='dev'&&!r.ghost);
  w.pvListApply(d,rows,devRow.key,'x',1234);
  ok('typed X is exact + relative to the room corner',w.__data.devices[devRow.i].x===d.pb.x0+1234,''+w.__data.devices[devRow.i].x);
  w.pvListApply(d,rows,devRow.key,'z',2450);
  ok('typed height applies',w.__data.devices[devRow.i].h===2450);
  const nRow=rows.find(r=>r.kind==='node');
  w.pvListApply(d,rows,nRow.key,'y',777);
  ok('node Y typed exact',w.__data.paths[nRow.pi].nodes[nRow.ni].y===d.pb.y0+777);
  const nDev=w.__data.devices.length;w.pvListDelete(rows,devRow.key);
  ok('list delete works',w.__data.devices.length===nDev-1);

  // ---------- session shared with the wall editor ----------
  reset();w.openPlaneView(room,lvl,'ceiling');PV=w.__PV();
  ok('plane session has base+history',!!PV.base&&PV.undo.length===0&&PV.dirty===false);
  w.wvPush();w.__data.devices[0].x=999;
  ok('wvPush targets the plane session',PV.undo.length===1&&PV.dirty===true);
  w.wvUndo();
  ok('undo works in the plane editor',w.__data.devices[0].x===2000,''+w.__data.devices[0].x);
  w.wvRedo();ok('redo works',w.__data.devices[0].x===999);
  w.confirm=()=>true;w.wvCloseEditor(false);
  ok('discard restores + closes',w.__data.devices[0].x===2000&&w.__PV()===null);
  w.openPlaneView(room,lvl,'floor');w.wvPush();w.__data.devices[0].x=1234;w.wvCloseEditor(true);
  ok('save keeps + one global undo step',(function(){if(w.__data.devices[0].x!==1234)return false;
    w.document.getElementById('bUndo').onclick();return w.__data.devices[0].x===2000;})());
  ok('wall editor still opens after plane use',(function(){try{w.openWallView({x0:0,y0:0,x1:4000,y1:100,h:2700},lvl);
    const okk=w.__WV()!==null&&w.__PV()===null;w.wvCloseEditor(true);return okk;}catch(e){return 'ERR '+e.message;}})()===true);

  // ---------- duplicate-beside in plan ----------
  reset();w.openPlaneView(room,lvl,'ceiling');
  const p0=JSON.parse(JSON.stringify(w.__data.paths[0].nodes[0]));
  const npi=w.wvDuplicateBeside(0,0,'le',300,false);
  ok('plan duplicate offsets in Y',w.__data.paths[npi].nodes[0].y===p0.y+300&&w.__data.paths[npi].nodes[0].x===p0.x,
     w.__data.paths[npi].nodes[0].x+'/'+w.__data.paths[npi].nodes[0].y);
  ok('plan duplicate keeps height',w.__data.paths[npi].nodes[0].h===p0.h);
  const npi2=w.wvDuplicateBeside(0,0,'jobbra',200,true);
  ok('plan duplicate whole path in X',w.__data.paths[npi2].nodes[0].x===p0.x+200&&w.__data.paths[npi2].nodes.length===5);
  w.wvCloseEditor(true);

  // ---------- regressions ----------
  reset();
  const wall={x0:0,y0:0,x1:4000,y1:100,h:2700};
  w.openWallView(wall,lvl);
  const wd=w.wallElevationData(wall,lvl),wsvg=w.wallElevationSVG(wd,false,true).svg;
  ok('reg: wall editor renders',/class="wvseg"/.test(wsvg)||wd.secs.length===0);
  ok('reg: wall chase layer',typeof w.wvChaseShapes==='function'&&w.chaseWidthOf(25)===40);
  ok('reg: wall list',typeof w.wvListRows==='function'&&typeof w.wvListHTML==='function');
  ok('reg: wall create',typeof w.wvCreateDevice==='function'&&typeof w.wvStartPath==='function');
  ok('reg: wall session close',(function(){try{w.wvCloseEditor(true);return w.__WV()===null;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: blueprint + report',typeof w.drawBlueprintGeom==='function'&&typeof w.switchReportData==='function');
  ok('reg: room unfold',typeof w.openRoomUnfold==='function'&&typeof w.roomWalls==='function');
  ok('reg: session persist',(function(){const so=w.sessionObj();return !!so.data&&!!so.state;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
