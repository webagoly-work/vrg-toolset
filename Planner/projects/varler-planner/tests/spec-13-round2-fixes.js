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
 const key=e=>{const ev=new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},e));
   w.document.dispatchEvent(ev);return ev;};
 try{
  const lvl='ground';w.__state.active=lvl;w.confirm=()=>true;w.alert=()=>{};
  const WA=w.__getWalls()[lvl];WA.length=0;WA.push({x0:0,y0:0,x1:4000,y1:300});

  // ---------- clean slate ----------
  w.__data.devices.push({type:'socket',ref:'D1',x:1000,y:-40,h:300,level:lvl,side:0});
  w.__data.paths.push({nodes:[{x:0,y:-40,h:300,level:lvl},{x:2000,y:-40,h:300,level:lvl}],sections:[{build:'sull_gege'}]});
  w.__data.wallNotes.push({wallKey:w.wallKey(WA[0],lvl),u:500,h:500,text:'régi',kind:'info'});
  w.__data.floors.push({level:lvl,poly:[[0,0],[3000,0],[3000,3000],[0,3000]],name:'Régi'});
  w.__data.objects.push({level:lvl,x:100,y:100,z:0,w:100,d:100,ht:100,ang:0,name:'régi'});
  w.pushUndo();w.__data.devices.push({type:'socket',ref:'D2',x:2000,y:-40,h:300,level:lvl,side:0});
  ok('fixture has content + history',w.__data.devices.length===2&&w.__undoLen()>0,'undo='+w.__undoLen());
  w.newBlankProject();
  ok('devices cleared',w.__data.devices.length===0);
  ok('paths cleared — this is what leaked into the wall view',w.__data.paths.length===0);
  ok('wall notes cleared',w.__data.wallNotes.length===0);
  ok('floors + objects cleared',w.__data.floors.length===0&&w.__data.objects.length===0);
  ok('walls cleared',(w.__getWalls()[lvl]||[]).length===0);
  ok('undo cannot reach the old project',w.__undoLen()===0&&w.__redoLen()===0,'undo='+w.__undoLen());
  ok('undo does nothing after a new project',(function(){const before=JSON.stringify(w.__data.devices);
    w.doUndo();return JSON.stringify(w.__data.devices)===before;})());
  ok('editors are closed',w.__WV()===null&&w.__PV()===null);
  ok('drop-ceiling settings reset',w.DROPC.ground===0);
  ok('autosave now describes the empty workspace',(function(){
    const raw=w.localStorage.getItem('villanyterv_autosave_v1');if(!raw)return 'no autosave';
    const o=JSON.parse(raw);return o.data.paths.length===0&&o.data.devices.length===0;})()===true);
  ok('note-hide map cleared',JSON.stringify(w.__data.noteHide||{})==='{}');

  // ---------- Esc / Enter in an editor ----------
  WA.push({x0:0,y0:0,x1:4000,y1:300});
  w.openWallView(WA[0],lvl);let WV=w.__WV();
  w.wvStartPath(500,1100);w.wvAddPathNode(2500,1100);
  const drawn=w.__data.paths.length;
  key({key:'Enter'});
  ok('Enter finishes the path',w.__WV().drawPi===null&&w.__data.paths.length===drawn);
  ok('Enter keeps the editor open',w.__WV()!==null);
  ok('Enter clears the selection so the rail resets',w.__WV().sel===null);
  const afterEnter=JSON.stringify(w.__data.paths);
  key({key:'Escape'});
  ok('Esc after Enter does NOT revert the path',JSON.stringify(w.__data.paths)===afterEnter,'this was the reported bug');
  ok('Esc does NOT close the editor',w.__WV()!==null);
  // Esc steps out one level at a time
  w.__WV().sel={kind:'dev',di:0};key({key:'Escape'});
  ok('Esc clears the selection first',w.__WV().sel===null&&w.__WV()!==null);
  w.__WV().warp={pi:0};key({key:'Escape'});
  ok('Esc then clears warp',w.__WV().warp===null&&w.__WV()!==null);
  w.__WV().full=true;key({key:'Escape'});
  ok('Esc then leaves fullscreen',w.__WV().full===false&&w.__WV()!==null);
  key({key:'Escape'});
  ok('Esc with nothing active just hints',w.__WV()!==null&&/Mentés|Elvetés/.test($('hud').textContent));
  ok('Esc while drawing finishes instead of cancelling',(function(){w.wvStartPath(100,1100);w.wvAddPathNode(900,1100);
    const n=w.__data.paths.length;key({key:'Escape'});
    return w.__WV().drawPi===null&&w.__data.paths.length===n;})());
  w.wvCloseEditor(true);

  // ---------- global Ctrl+Z ----------
  w.__data.devices.length=0;
  w.pushUndo();w.__data.devices.push({type:'socket',ref:'X',x:1,y:1,h:0,level:lvl});
  key({key:'z',ctrlKey:true});
  ok('Ctrl+Z works in the main planner',w.__data.devices.length===0);
  key({key:'z',ctrlKey:true,shiftKey:true});
  ok('Ctrl+Shift+Z redoes',w.__data.devices.length===1);
  key({key:'y',ctrlKey:true});
  ok('Ctrl+Y is accepted too',true);
  ok('typing in a field is not hijacked',(function(){const inp=w.document.createElement('input');
    w.document.body.appendChild(inp);const n=w.__data.devices.length;
    const ev=new w.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true});
    Object.defineProperty(ev,'target',{value:inp});w.document.dispatchEvent(ev);
    inp.remove();return w.__data.devices.length===n;})());
  ok('an open editor keeps its own history',(function(){w.openWallView(WA[0],lvl);
    const before=w.__undoLen();w.wvPush();w.__data.devices.push({type:'socket',x:5,y:5,h:0,level:lvl});
    key({key:'z',ctrlKey:true});                    // must hit the EDITOR's undo, not the global one
    const okk=w.__undoLen()===before;w.wvCloseEditor(false);return okk;})());

  // ---------- plane editor drag survives a re-render ----------
  ok('soft render keeps the svg element alive',(function(){const src=fs.readFileSync(HTML,'utf8');
    // after the Phase 3 unification both editors soft-render through P.soft(el) → el.innerHTML
    return /el\.innerHTML=edInner\(/.test(src)&&!/box\.innerHTML=o2\.svg/.test(src)&&typeof w.edInner==='function';})());
  ok('editors disable text selection and touch scrolling',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /#wvBox svg,#pvBox svg\{user-select:none/.test(src)&&/touch-action:none/.test(src);})());

  // ---------- riser size + drop-ceiling colour ----------
  w.__data.floors.length=0;w.__data.paths.length=0;w.__data.devices.length=0;
  const ch=w.wallH(lvl);
  const room={name:'N',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]};
  w.__data.devices.push({type:'light',ref:'L1',x:2000,y:1500,h:ch,level:lvl});
  w.__data.paths.push({nodes:[{x:2000,y:1500,h:ch,level:lvl},{x:500,y:1500,h:ch,level:lvl},{x:500,y:1500,h:1100,level:lvl}],
    sections:[{build:'sull_gege'},{build:'sull_gege'}]});
  w.openPlaneView(room,lvl,'ceiling');
  const psvg=w.planeViewSVG(w.planeViewData(room,lvl,'ceiling',300),true).svg;
  ok('riser marker is bigger',/class="pvriser" cx="[^"]+" cy="[^"]+" r="10"/.test(psvg));
  ok('riser arrow is bigger too',/font-size="13" font-weight="700"/.test(psvg));
  w.wvCloseEditor(true);
  ok('drop-ceiling colour + opacity inputs exist',!!$('dcCol')&&!!$('dcOp'));
  ok('they feed the drawing',(function(){w.DROPC.ground=2400;
    w.__data.floors.push({level:lvl,poly:room.poly,name:'N'});
    w.__state.pitch=30;w.__state.flat=false;
    w.__state.dropCol='#ff0000';w.__state.dropOp=90;w.draw();
    const a=$('stage').innerHTML;
    w.__state.dropCol='#00ff00';w.__state.dropOp=20;w.draw();
    const b=$('stage').innerHTML;
    return a!==b&&/#ff0000/.test(a)&&/#00ff00/.test(b);})());
  ok('settings persist',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.state.dropCol==='#00ff00'&&so.state.dropOp===20;})());

  // ---------- lamp menu on the real device hit ----------
  ok('shared device-extras builder',typeof w.deviceExtraItems==='function');
  ok('a lamp gets its sheet',(function(){const items=w.deviceExtraItems(0,[]);
    return items.some(i=>/Lámpa adatlap/.test(i.label))&&items.some(i=>/Objektum generálása/.test(i.label))
        &&items.some(i=>/Magasság/.test(i.label));})());
  ok('a socket gets height but no lamp items',(function(){
    w.__data.devices.push({type:'socket',ref:'D1',x:100,y:-40,h:300,level:lvl,side:0});
    const items=w.deviceExtraItems(w.__data.devices.length-1,[]);
    return items.some(i=>/Magasság/.test(i.label))&&!items.some(i=>/Lámpa adatlap/.test(i.label));})());
  ok('the junction menu still has its wiring items',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /Elfogadott áramkörök/.test(src)&&/deviceExtraItems\(di,items\);/.test(src);})());

  // ---------- roll-up garage door ----------
  ok('roll-up type exists',!!w.DOORTYPE.rollup&&/redőny/.test(w.DOORTYPE.rollup.n));
  ok('it draws differently from the sectional one',(function(){
    w.__data.openings.length=0;w.__getWalls()[lvl].length=0;
    w.__getWalls()[lvl].push({x0:0,y0:0,x1:6000,y1:300});
    w.__state.style='blueprint';w.__state.pitch=90;w.__state.flat=true;
    const mk=t=>{w.__data.openings.length=0;
      w.__data.openings.push({type:'door',level:lvl,x:3000,y:150,ang:0,variant:0,w:2500,h:2200,dtype:t});
      return w.drawBlueprintPlan();};
    const g=mk('garage'),r2=mk('rollup');
    w.__state.style='plan';w.__state.pitch=30;w.__state.flat=false;
    return g!==r2&&/>RK ↑</.test(r2);})());

  // ---------- per-surface note visibility ----------
  w.__getWalls()[lvl].length=0;w.__getWalls()[lvl].push({x0:0,y0:0,x1:4000,y1:300});
  const WR=w.__getWalls()[lvl][0],wk=w.wallKey(WR,lvl);
  w.__data.wallNotes.length=0;
  w.__data.wallNotes.push({wallKey:wk,u:1000,h:1000,text:'falon',kind:'info'});
  w.__data.wallNotes.push({wallKey:w.planeKey(lvl,'floor',room.poly),u:500,h:500,text:'padlón',kind:'info'});
  ok('both notes visible by default',w.wallElevationData(WR,lvl).notes.length===1
     &&w.planeViewData(room,lvl,'floor',300).notes.length===1);
  w.noteSurfaceToggle(wk);
  ok('hiding one wall hides only its notes',w.wallElevationData(WR,lvl).notes.length===0
     &&w.planeViewData(room,lvl,'floor',300).notes.length===1);
  w.noteSurfaceToggle(wk);
  ok('toggling back restores them',w.wallElevationData(WR,lvl).notes.length===1);
  ok('the flag is per surface key',(function(){w.noteSurfaceToggle(w.planeKey(lvl,'floor',room.poly));
    const r1=w.planeViewData(room,lvl,'floor',300).notes.length===0;
    const r2=w.wallElevationData(WR,lvl).notes.length===1;
    w.noteSurfaceToggle(w.planeKey(lvl,'floor',room.poly));return r1&&r2;})());
  ok('wall RCO offers the toggle',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /Jegyzetek elrejtése ezen a falon/.test(src);})());
  ok('room RCO offers one per plane',(function(){const items=w.roomMenuItems({rm:{name:'N',poly:room.poly},src:'F',i:0,level:lvl});
    return items.filter(i=>/Jegyzetek (elrejtése|mutatása)/.test(i.label)).length===3;})());
  ok('editors expose the toggle',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /id="wvNoteSurf"/.test(src)&&/id="pvNoteSurf"/.test(src);})());
  ok('the layer toggle still governs all notes',(function(){w.openPlaneView(room,lvl,'floor');
    const PV=w.__PV();PV.layers.notes=false;
    const svg=w.planeViewSVG(w.planeViewData(room,lvl,'floor',300),true).svg;
    PV.layers.notes=true;w.wvCloseEditor(true);return !/class="wvnote"/.test(svg);})());
  ok('note-hide survives undo',(function(){w.pushUndo();w.noteSurfaceToggle(wk);
    const hidden=w.noteSurfaceHidden(wk);w.doUndo();return hidden&&!w.noteSurfaceHidden(wk);})());
  ok('note-hide persists with the project',(function(){w.noteSurfaceToggle(wk);
    const so=JSON.parse(JSON.stringify(w.sessionObj()));w.noteSurfaceToggle(wk);
    return so.data.noteHide&&so.data.noteHide[wk]===true;})());

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: editors open+close',(function(){try{w.openWallView(WR,lvl);w.wvCloseEditor(true);
    w.openPlaneView(room,lvl,'ceiling');w.wvCloseEditor(true);return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: session save',(function(){const so=w.sessionObj();return !!so.data&&!!so.DROPC;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},700);
