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
  const wall={x0:0,y0:0,x1:4000,y1:100,h:2700},lvl='ground';
  const reset=()=>{w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;w.__data.wallNotes=[];
    w.__data.devices.push({type:'socket',ref:'D1',x:1000,y:90,h:300,level:lvl});
    w.__data.paths.push({nodes:[{x:1000,y:90,h:300,level:lvl},{x:2500,y:90,h:300,level:lvl},{x:2500,y:90,h:1100,level:lvl}],
      sections:[{build:'sull_gege'},{build:'sull_gege'}]});};
  reset();w.openWallView(wall,lvl);let WV=w.__WV();

  // ---------- session / save / discard ----------
  ok('session snapshot taken',!!WV.base&&Array.isArray(WV.undo)&&WV.dirty===false);
  ok('viewer starts clean',WV.undo.length===0&&WV.redo.length===0);
  w.wvPush();w.__data.devices[0].h=1500;
  ok('wvPush marks dirty + stacks',WV.dirty===true&&WV.undo.length===1);
  w.wvUndo();WV=w.__WV();
  ok('viewer undo restores',w.__data.devices[0].h===300&&WV.redo.length===1,''+w.__data.devices[0].h);
  w.wvRedo();
  ok('viewer redo re-applies',w.__data.devices[0].h===1500,''+w.__data.devices[0].h);
  ok('viewer history is NOT the global one',w.__WV().undo.length>0);
  // discard
  w.confirm=()=>true;
  w.wvCloseEditor(false);
  ok('discard reverts everything',w.__data.devices[0].h===300&&w.__WV===undefined||w.__data.devices[0].h===300,''+w.__data.devices[0].h);
  ok('editor closed on discard',w.__WV()===null);
  // save
  reset();w.openWallView(wall,lvl);WV=w.__WV();
  w.wvPush();w.__data.devices[0].h=1700;
  const gUndoBefore=w.__undoLen?w.__undoLen():null;
  w.wvCloseEditor(true);
  ok('save keeps the change',w.__data.devices[0].h===1700);
  ok('editor closed on save',w.__WV()===null);
  ok('save leaves ONE global undo step',(function(){w.document.getElementById('bUndo').onclick();
    return w.__data.devices[0].h===300;})(),''+w.__data.devices[0].h);

  // ---------- fullscreen ----------
  reset();w.openWallView(wall,lvl);WV=w.__WV();
  const d0=w.wallElevationData(wall,lvl),small=w.wallElevationSVG(d0,false,true);
  WV.full=true;const big=w.wallElevationSVG(d0,false,true);
  ok('fullscreen enlarges the sheet',big.sc>small.sc&&big.w>small.w,small.w+'→'+big.w);
  WV.full=false;
  ok('fullscreen button rendered',w.document.getElementById('wvFull')!==null);
  ok('undo/redo buttons rendered',!!w.document.getElementById('wvUndoB')&&!!w.document.getElementById('wvRedoB'));
  ok('save/discard buttons rendered',!!w.document.getElementById('wvSave')&&!!w.document.getElementById('wvClose'));

  // ---------- coordinate list ----------
  let d=w.wallElevationData(wall,lvl);
  let rows=w.wvListRows(d);
  ok('list has device + 3 nodes',rows.filter(r=>r.kind==='dev').length===1&&rows.filter(r=>r.kind==='node').length===3,
     JSON.stringify(rows.map(r=>r.kind)));
  ok('list sorted by distance from left',rows.every((r,i)=>i===0||rows[i-1].u<=r.u));
  const html=w.wvListHTML(d,d.len);
  ok('list renders editable cells',(html.match(/class="wvcell"/g)||[]).length>=10);
  ok('list shows left/right/ground',/balról/.test(html)&&/jobbról/.test(html)&&/földtől/.test(html));
  ok('right column = len - u',/value="3000"/.test(html),'device at u=1000 on a 4000 wall');
  // typed value is EXACT (no 10mm snap)
  const devRow=rows.find(r=>r.kind==='dev');
  w.wvListApply(rows,devRow.key,'l',1234);
  ok('typed mm is exact, not snapped',w.__data.devices[0].x===1234,''+w.__data.devices[0].x);
  w.wvListApply(rows,devRow.key,'h',1247);
  ok('typed height exact',w.__data.devices[0].h===1247,''+w.__data.devices[0].h);
  // dragging still snaps to 10
  w.wvSetDevice(0,1337,1343);
  ok('dragging still snaps to 10mm',w.__data.devices[0].x===1340&&w.__data.devices[0].h===1340,w.__data.devices[0].x+'/'+w.__data.devices[0].h);
  // delete from the list
  reset();d=w.wallElevationData(wall,lvl);rows=w.wvListRows(d);
  w.wvListDelete(rows,rows.find(r=>r.kind==='dev').key);
  ok('list delete removes the device',w.__data.devices.length===0);
  reset();d=w.wallElevationData(wall,lvl);rows=w.wvListRows(d);
  w.wvListDelete(rows,rows.filter(r=>r.kind==='node')[1].key);
  ok('list delete removes a node',w.__data.paths[0].nodes.length===2&&w.__data.paths[0].sections.length===1);

  // ---------- device ↔ path links ----------
  reset();d=w.wallElevationData(wall,lvl);
  const cand=w.wvNodeCandidates(1000,300,1500);
  ok('node candidates sorted + range-limited',cand.length===2&&cand[0].dist===0&&cand[1].dist===1500,JSON.stringify(cand.map(c=>Math.round(c.dist))));
  w.ensureIds(w.__data);w.setLink(w.__data.devices[0],w.__data.paths[0].id,w.__data.paths[0].nodes[0].id);
  // move the device → the node follows
  w.wvSetDevice(0,1500,500);
  ok('linked node follows the device',w.__data.paths[0].nodes[0].x===1500&&w.__data.paths[0].nodes[0].h===500,
     w.__data.paths[0].nodes[0].x+'/'+w.__data.paths[0].nodes[0].h);
  // move the node → the device follows
  w.wvSetNode(0,0,2000,700);
  ok('device follows its node',w.__data.devices[0].x===2000&&w.__data.devices[0].h===700,
     w.__data.devices[0].x+'/'+w.__data.devices[0].h);
  ok('unlinked devices are untouched',(function(){w.__data.devices.push({type:'socket',x:3000,y:90,h:300,level:lvl});
    w.wvSetNode(0,1,2600,300);return w.__data.devices[1].x===3000;})());
  d=w.wallElevationData(wall,lvl);
  ok('link marker rendered',/stroke-dasharray="2 2"/.test(w.wallElevationSVG(d,false,true).svg));
  ok('link shown in the list',new RegExp('🔗'+w.__data.paths[0].id+'/'+w.__data.paths[0].nodes[0].id).test(w.wvListHTML(d,d.len)));
  ok('link survives session save',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.data.devices[0].link&&so.data.devices[0].link.p===w.__data.paths[0].id;})());
  ok('deleting a path clears dangling links',(function(){w.__data.paths.push({nodes:[{x:0,y:90,h:0,level:lvl},{x:9,y:90,h:0,level:lvl}],sections:[{build:'sull_gege'}]});
    w.ensureIds(w.__data);
    const keep=w.__data.paths[1];
    w.setLink(w.__data.devices[1],keep.id,keep.nodes[0].id);
    w.__data.paths.splice(0,1);w.wvRelinkAfterPathRemoval();
    return !w.__data.devices[0].link&&w.__data.devices[1].link.p===keep.id;})());

  // ---------- create anything ----------
  reset();
  const di=w.wvCreateDevice('socket',2000,1100);
  const nd=w.__data.devices[di];
  ok('created device on this wall',nd.type==='socket'&&nd.h===1100&&nd.level===lvl);
  ok('created device sits on the near face',(function(){const uh=w.wvNodeUH({x:nd.x,y:nd.y,h:nd.h});
    const dd=w.wallElevationData(wall,lvl);const found=dd.devs.find(x=>x.di===di);
    return found&&found.back===false&&Math.abs(uh.u-2000)<1;})());
  ok('created device gets a ref',!!nd.ref);
  const nb=w.wvCreateDevice('board',3000,0);
  ok('board created at 2000mm with a rect',w.__data.devices[nb].h===2000&&w.__data.devices[nb].rw>0);
  w.wvCreateOpening('window',1500);
  const op=w.__data.openings[w.__data.openings.length-1];
  ok('created window w/ defaults',op.type==='window'&&op.w===1200&&op.sill===900&&op.level===lvl);
  ok('opening appears in the elevation',(function(){const dd=w.wallElevationData(wall,lvl);
    return dd.ops.length===1&&Math.abs(dd.ops[0].u-1500)<1;})());
  // path drawing
  reset();
  w.wvStartPath(500,1090);
  ok('draw mode armed',w.__WV().drawPi===w.__data.paths.length-1);
  ok('height snapped to a guide line',w.__data.paths[w.__WV().drawPi].nodes[0].h===1100,''+w.__data.paths[w.__WV().drawPi].nodes[0].h);
  w.wvAddPathNode(2500,1100);w.wvAddPathNode(2500,300);
  const dp=w.__data.paths[w.__WV().drawPi];
  ok('nodes + sections added',dp.nodes.length===3&&dp.sections.length===2,dp.nodes.length+'/'+dp.sections.length);
  w.wvFinishPath();
  ok('finish clears draw mode',w.__WV().drawPi===null&&w.__data.paths.length===2);
  w.wvStartPath(100,100);const cnt=w.__data.paths.length;w.wvFinishPath();
  ok('a lone node is discarded',w.__data.paths.length===cnt-1);
  ok('create menu builds items',(function(){let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it.map(i=>i.label);};
    w.wvCreateMenu({},1000,1000);w.ctxMenu=old;
    return cap&&cap.length===9&&cap.some(l=>/Aljzat/.test(l))&&cap.some(l=>/Ablak/.test(l))&&cap.some(l=>/Pálya rajzolása/.test(l));})());

  // ---------- regressions ----------
  reset();d=w.wallElevationData(wall,lvl);
  const svg=w.wallElevationSVG(d,false,true).svg;
  ok('reg: chase merged + summary',(svg.match(/<clipPath id="cutclip"/g)||[]).length===1&&/class="cutsum"/.test(svg));
  ok('reg: grab lines + warp',(svg.match(/class="wvseg"/g)||[]).length===2&&typeof w.wvWarpBox==='function');
  ok('reg: duplicate beside',typeof w.wvDuplicateBeside==='function');
  ok('reg: device catalogue',w.deviceCat('valena_socket_2p').cikk==='753120');
  ok('reg: chase widths',w.chaseWidthOf(20)===32&&w.chaseWidthOf(32)===51);
  ok('reg: notes still work',(function(){w.__data.wallNotes.push({wallKey:w.wallKey(wall,lvl),u:10,h:10,text:'n'});
    return w.wallElevationData(wall,lvl).notes.length===1;})());
  ok('reg: board rect',typeof w.pointInBoard==='function');
  ok('reg: guides + heights',w.__guides().length>0&&typeof w.stepHeight==='function');
  ok('reg: blueprint',typeof w.drawBlueprintGeom==='function');
  ok('reg: switch report',typeof w.switchReportData==='function');
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: renderWallView()',(function(){try{w.renderWallView();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: project save/load',(function(){try{const so=w.sessionObj();return !!so.data&&!!so.state;}catch(e){return false;}})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
