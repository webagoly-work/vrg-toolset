const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();const SRC=fs.readFileSync(HTML,'utf8');
const dom=new JSDOM(SRC,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 const ms=(f,n)=>{const a=Date.now();for(let i=0;i<n;i++)f();return (Date.now()-a)/n;};
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const WA=w.__getWalls()[lvl];
  for(let i=0;i<8;i++)WA.push({x0:i*1800,y0:0,x1:i*1800+1700,y1:300});
  for(let i=0;i<120;i++)w.__data.devices.push({type:i%3?'socket':'light',ref:'D'+i,
    x:(i%12)*800,y:Math.floor(i/12)*900,h:300,level:lvl});
  for(let i=0;i<60;i++)w.__data.paths.push({nodes:[{x:i*100,y:0,h:300,level:lvl},{x:i*100,y:4000,h:300,level:lvl}],
    sections:[{build:'sull_gege'}]});
  w.ensureIds(w.__data);
  w.__state.pitch=30;w.__state.flat=false;w.__state.style='plan';
  w.draw();

  // ---------- layers ----------
  ok('the viewport is split into two layers',!!$('lyScene')&&!!$('lyOverlay'));
  ok('the drawing lives in the scene layer',$('lyScene').innerHTML.length>1000);
  ok('paint statistics are available',typeof w.paintStats==='function'&&w.paintStats().paints>0);
  ok('an unchanged redraw paints nothing',(function(){const a=w.paintStats().paints;w.draw();w.draw();
    return w.paintStats().paints===a;})(),'skips='+w.paintStats().skips);
  ok('a model change repaints the scene',(function(){const a=w.paintStats().paints;
    w.__data.devices[0].x+=100;w.draw();return w.paintStats().paints>a;})());
  ok('a transient change repaints ONLY the overlay',(function(){
    w.draw();const before=$('lyScene').innerHTML;
    w.__setBox({x0:0,y0:0,x1:120,y1:90});w.draw();
    const sceneSame=$('lyScene').innerHTML===before;
    const overlayHas=/fill-opacity="0.08"/.test($('lyOverlay').innerHTML);
    w.__setBox(null);w.draw();return sceneSame&&overlayHas;})());
  ok('invalidateLayers forces a repaint',(function(){w.draw();const a=w.paintStats().paints;
    w.invalidateLayers();w.draw();return w.paintStats().paints>a;})());

  // ---------- the numbers this phase existed for ----------
  const idle=ms(()=>w.draw(),20);
  let k=0;const overlayOnly=ms(()=>{w.__setBox({x0:0,y0:0,x1:100+(k++%9),y1:80});w.draw();},20);
  w.__setBox(null);
  const sceneChange=ms(()=>{w.__data.devices[0].x=1000+(k++%7)*10;w.draw();},10);
  ok('idle redraw is cheap',idle<20,idle.toFixed(1)+' ms (was ~117 before this phase)');
  ok('overlay-only redraw is cheap',overlayOnly<20,overlayOnly.toFixed(1)+' ms');
  ok('overlay-only beats a scene change by a wide margin',overlayOnly*3<sceneChange,
     overlayOnly.toFixed(1)+' vs '+sceneChange.toFixed(1)+' ms');

  // ---------- totals are gated ----------
  ok('totals do not recompute when nothing changed',(function(){
    let calls=0;const real=w.updateTotals;w.updateTotals=()=>{calls++;return real();};
    w.draw();w.draw();w.draw();const idleCalls=calls;
    w.__data.devices[1].x+=50;w.draw();const afterChange=calls;
    w.updateTotals=real;return idleCalls===0&&afterChange===1;})(),'0 while idle, 1 on a real change');

  // ---------- coalescing ----------
  ok('drawSoon exists and coalesces',typeof w.drawSoon==='function');
  ok('pointermove uses the coalesced path',(function(){
    // the stage pointermove handler must not call draw() synchronously any more
    const h=SRC.slice(SRC.indexOf("stage.addEventListener('pointermove'"));
    const body=h.slice(0,h.indexOf("\nstage.addEventListener("));
    return body.indexOf('drawSoon();')>0&&!/[^a-zA-Z]draw\(\);/.test(body);})());

  // ---------- scoped history ----------
  ok('snapshots can be scoped',typeof w.snapBytes==='function'&&!!w.UNDO_SCOPE);
  const full=w.snapBytes(w.__snap());
  const paths=w.snapBytes(w.__snap(['paths']));
  ok('a scoped snapshot is smaller than a full one',paths<full,(paths/1024).toFixed(0)+' KB vs '+(full/1024).toFixed(0)+' KB');
  ok('the saving grows with what it leaves out',(function(){       // lamp photos are the real weight
    w.__data.devices[0].thumb='data:image/jpeg;base64,'+'A'.repeat(20000);
    const f2=w.snapBytes(w.__snap()),p2=w.snapBytes(w.__snap(['paths']));
    delete w.__data.devices[0].thumb;return p2*2<f2;})());
  ok('a scoped entry records its scope',JSON.stringify(w.__snap(['paths']).__scope)==='["paths"]');
  ok('a full snapshot has no scope',w.__snap().__scope===null);
  ok('drag kinds map to the collections they can touch',
     JSON.stringify(w.edDragScope('node'))==='["paths"]'
     &&JSON.stringify(w.edDragScope('dev'))==='["devices","paths"]'
     &&JSON.stringify(w.edDragScope('note'))==='["wallNotes"]'
     &&JSON.stringify(w.edDragScope('op'))==='["openings"]');
  ok('a scoped restore only touches its own collections',(function(){
    const devX=w.__data.devices[0].x,pathX=w.__data.paths[0].nodes[0].x;
    const sn=w.__snap(['paths']);
    w.__data.devices[0].x=99999;w.__data.paths[0].nodes[0].x=88888;
    w.__applySnap(sn);
    const pathsRestored=w.__data.paths[0].nodes[0].x===pathX;
    const devicesUntouched=w.__data.devices[0].x===99999;
    w.__data.devices[0].x=devX;return pathsRestored&&devicesUntouched;})());
  ok('undo/redo round-trips a scoped entry',(function(){
    const before=w.__data.paths[0].nodes[0].x;
    w.pushUndo(['paths']);w.__data.paths[0].nodes[0].x=4321;w.doUndo();
    const undone=w.__data.paths[0].nodes[0].x===before;
    w.doRedo();const redone=w.__data.paths[0].nodes[0].x===4321;
    w.doUndo();return undone&&redone;})());
  ok('a full entry still restores everything',(function(){
    const d=w.__data.devices[0].x,p=w.__data.paths[0].nodes[0].x;
    w.pushUndo();w.__data.devices[0].x=1;w.__data.paths[0].nodes[0].x=2;w.doUndo();
    return w.__data.devices[0].x===d&&w.__data.paths[0].nodes[0].x===p;})());
  ok('history size is measurable',typeof w.historyBytes==='function'&&w.historyBytes()>=0);
  ok('ids survive a scoped undo',(function(){const id=w.__data.paths[0].id;
    w.pushUndo(['paths']);w.__data.paths[0].nodes[0].x+=10;w.doUndo();
    return w.__data.paths[0].id===id;})());

  // ---------- regressions ----------
  ok('reg: editors still work',(function(){try{w.openWallView(WA[0],lvl);w.wvCloseEditor(true);
    w.openPlaneView({name:'X',poly:[[0,0],[3000,0],[3000,3000],[0,3000]]},lvl,'floor');w.wvCloseEditor(true);
    return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: editor drags use a scoped push',SRC.indexOf('wvPush(edDragScope(drag.kind))')>0);
  ok('reg: blueprint',(function(){try{w.__state.style='blueprint';w.__state.pitch=90;w.draw();
    const q=$('lyScene').innerHTML.length>500;w.__state.style='plan';w.__state.pitch=30;w.draw();return q;}
    catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: schema + surface layer intact',typeof w.linkTarget==='function'&&typeof w.edBindSurface==='function');
  ok('reg: version',/^\d+\.\d+\.\d+$/.test(w.VERSION),w.VERSION);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
