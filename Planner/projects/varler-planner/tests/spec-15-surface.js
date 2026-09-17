const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const SRC=fs.readFileSync(HTML,'utf8');
const dom=new JSDOM(SRC,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:4000,y1:300});
  const D=w.__data;
  D.devices.push({type:'socket',ref:'D1',x:600,y:340,h:300,level:lvl,side:1});   // near face
  D.paths.push({nodes:[{x:600,y:340,h:300,level:lvl},{x:2600,y:340,h:300,level:lvl},{x:2600,y:340,h:1100,level:lvl}],
    sections:[{build:'sull_gege'},{build:'sull_gege'}]});
  D.wallNotes.push({wallKey:w.wallKey(WA[0],lvl),u:1000,h:1500,text:'jegyzet',kind:'info'});
  w.ensureIds(D);
  const room={name:'N',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]};

  // ---------- the layer exists and is shared ----------
  ok('one surface layer',typeof w.edBindSurface==='function'&&typeof w.edInner==='function');
  ok('shared hit-testing',typeof w.edHitDevice==='function'&&typeof w.edHitSection==='function');
  ok('mount target indirection',typeof w.edMount==='function');
  ok('the duplicated pointer code is gone',(function(){
    // both editors used to carry their own copy of startDrag / soft-render / bind
    return (SRC.match(/const startDrag=\(kind,ds,ev\)=>/g)||[]).length===1
        && (SRC.match(/function edBindSurface\(/g)||[]).length===1;})(),
     'startDrag now defined once');
  ok('both editors register a projection',(function(){
    return (SRC.match(/edBindSurface\(WV,svgEl,\{/g)||[]).length===1
        && (SRC.match(/edBindSurface\(PV,svgEl,\{/g)||[]).length===1;})());

  // ---------- the wall projection ----------
  w.openWallView(WA[0],lvl);
  const WV=w.__WV();
  ok('editor records its projection',!!WV.proj&&WV.proj.kind==='wall');
  const Pw=WV.proj;
  ok('wall projection maps a node to surface mm',(function(){const q=Pw.nodeUV(D.paths[0].nodes[0]);
    return Math.abs(q.u-600)<1&&Math.abs(q.v-300)<1;})(),JSON.stringify(Pw.nodeUV(D.paths[0].nodes[0])));
  ok('clamp keeps the point on the sheet',(function(){const a=Pw.clamp({u:-500,v:-500}),b=Pw.clamp({u:99999,v:100});
    return a.u===0&&a.v===0&&b.u===4000;})());
  ok('projection data is the surface data',(function(){const d=Pw.data();
    return Array.isArray(d.secs)&&Array.isArray(d.devs)&&d.secs.length===2;})());
  ok('hit-test finds the device',(function(){const d=Pw.data();
    const hit=w.edHitDevice(d,600,300);return hit&&hit.di===0;})());
  ok('hit-test finds the section',(function(){const d=Pw.data();
    const hit=w.edHitSection(d,1500,300);return !!hit&&hit.pi===0;})());
  ok('hit-test misses when far away',!w.edHitDevice(Pw.data(),3900,2600)&&!w.edHitSection(Pw.data(),3900,2600));
  ok('setters go through the projection',(function(){Pw.setNode(0,1,2000,700);
    return D.paths[0].nodes[1].x===2000&&D.paths[0].nodes[1].h===700;})());
  ok('note setter clamps to the floor',(function(){Pw.setNote(0,1234,-50);
    return D.wallNotes[0].u===1234&&D.wallNotes[0].h===0;})());
  ok('soft render replaces children, not the element',(function(){
    const box=$('wvBox'),svg=box.querySelector('svg');const before=svg;
    Pw.soft(svg);
    return box.querySelector('svg')===before&&svg.innerHTML.length>100;})());
  w.wvCloseEditor(true);

  // ---------- the plane projection ----------
  w.openPlaneView(room,lvl,'floor');
  const PV=w.__PV();
  ok('plane editor records its projection',!!PV.proj&&PV.proj.kind==='plane');
  const Pp=PV.proj;
  ok('plane projection maps a node to x/y',(function(){const q=Pp.nodeUV({x:1234,y:567});
    return q.u===1234&&q.v===567;})());
  ok('plane setters move in plan, not in height',(function(){
    const h0=D.paths[0].nodes[0].h;Pp.setNode(0,0,1500,900);
    return D.paths[0].nodes[0].x===1500&&D.paths[0].nodes[0].y===900&&D.paths[0].nodes[0].h===h0;})());
  ok('plane soft render keeps the element',(function(){const box=$('pvBox'),svg=box.querySelector('svg');
    Pp.soft(svg);return box.querySelector('svg')===svg;})());
  ok('the plane has no height badge',Pp.badge===false);
  ok('both projections answer the same interface',(function(){
    const keys=['local','data','nodeUV','setDev','setNode','setNote','addNode','soft','full','menu'];
    return keys.every(k=>typeof Pw[k]==='function'&&typeof Pp[k]==='function');})());
  ok('only the wall moves openings',typeof Pw.setOpening==='function'&&Pp.setOpening===undefined);
  w.wvCloseEditor(true);

  // ---------- behaviour parity: what one editor can do, both can ----------
  const menuOf=(open,close,x,y)=>{let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it.map(i=>i.label);};
    open();const P=(w.__WV()||w.__PV()).proj;P.menu({clientX:0,clientY:0},x,y);w.ctxMenu=old;close();return cap||[];};
  const wallMenuDev=menuOf(()=>w.openWallView(WA[0],lvl),()=>w.wvCloseEditor(true),600,300);
  ok('wall: right-click on a device gives the device menu',wallMenuDev.some(l=>/Törlés/.test(l))&&wallMenuDev.some(l=>/Magasság|Készülék/.test(l)),
     wallMenuDev.slice(0,2).join(' | '));
  const wallMenuEmpty=menuOf(()=>w.openWallView(WA[0],lvl),()=>w.wvCloseEditor(true),3800,2500);
  ok('wall: right-click on nothing gives the create menu',wallMenuEmpty.some(l=>/Jegyzet/.test(l)));
  const planeMenuEmpty=menuOf(()=>w.openPlaneView(room,lvl,'floor'),()=>w.wvCloseEditor(true),3800,2500);
  ok('plane: right-click on nothing gives the create menu',planeMenuEmpty.some(l=>/Jegyzet/.test(l)));
  ok('both create menus offer path drawing',wallMenuEmpty.some(l=>/Pálya rajzolása/.test(l))&&planeMenuEmpty.some(l=>/Pálya rajzolása/.test(l)));

  // ---------- warp works through the shared layer in both ----------
  const warpIn=(open,close)=>{open();const E=w.__WV()||w.__PV();
    E.warp={pi:0};const bb=w.wvWarpBox(E.proj.data(),0);close();return bb;};
  ok('warp box comes from the projection data (wall)',(function(){
    const bb=warpIn(()=>w.openWallView(WA[0],lvl),()=>w.wvCloseEditor(true));
    return bb&&bb.nodes.length>=2;})());
  ok('warp box comes from the projection data (plane)',(function(){
    D.paths.push({nodes:[{x:500,y:500,h:0,level:lvl},{x:2500,y:500,h:0,level:lvl}],sections:[{build:'sull_gege'}]});
    w.ensureIds(D);const pi=D.paths.length-1;
    w.openPlaneView(room,lvl,'floor');const E=w.__PV();E.warp={pi};
    const bb=w.wvWarpBox(E.proj.data(),pi);w.wvCloseEditor(true);D.paths.pop();
    return bb&&bb.nodes.length===2;})());

  // ---------- notes behave the same on every surface ----------
  ok('note dblclick + context menu are bound once, for all surfaces',
     (SRC.match(/g\.addEventListener\('dblclick',ev=>\{ev\.preventDefault\(\);ev\.stopPropagation\(\);noteDialog/g)||[]).length===1);

  // ---------- regressions ----------
  ok('reg: wall editor opens, edits and saves',(function(){try{w.openWallView(WA[0],lvl);
    w.wvSetNode(0,1,2200,800);w.wvCloseEditor(true);
    return D.paths[0].nodes[1].x===2200;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: plane editor opens, edits and saves',(function(){try{w.openPlaneView(room,lvl,'ceiling');
    w.pvSetNode(0,0,1600,1000);w.wvCloseEditor(true);
    return D.paths[0].nodes[0].x===1600;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: session discard still reverts',(function(){w.openWallView(WA[0],lvl);
    const before=D.paths[0].nodes[1].x;w.wvPush();w.wvSetNode(0,1,3333,800);w.wvCloseEditor(false);
    return D.paths[0].nodes[1].x===before;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: schema intact',typeof w.linkTarget==='function'&&w.SCHEMA_VERSION>=1);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},700);
