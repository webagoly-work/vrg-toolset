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
 const txt=()=>$('inspector').textContent.replace(/\s+/g,' ');
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:4000,y1:300});
  w.__data.floors.push({level:lvl,poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  w.__data.devices.push({type:'light',ref:'L1',x:1000,y:340,h:2700,level:lvl,side:1});
  w.__data.openings.push({type:'door',level:lvl,x:2000,y:150,ang:0,variant:0,w:900,h:2100});
  w.ensureIds(w.__data);w.draw();

  // ---------- the rail ----------
  ok('five stages, in the order the job happens',
     w.STAGES.map(s=>s.n).join('→')==='Épület→Helyiségek→Kiosztás→Pályák→Dokumentáció');
  ok('every stage explains itself and can self-check',
     w.STAGES.every(s=>s.hint&&typeof s.check==='function'&&s.icon));
  ok('the rail renders',(function(){const r=$('stageRail');
    return r&&r.style.display==='flex'&&r.querySelectorAll('.stg[data-k]').length===5;})());
  ok('the current stage is marked',(function(){w.setStage('paths');
    const on=$('stageRail').querySelector('.stg.on');return on&&on.dataset.k==='paths';})());
  ok('clicking a stage switches it',(function(){
    $('stageRail').querySelector('.stg[data-k="rooms"]').onclick();
    return w.__state.stage==='rooms';})());
  ok('the rail carries a palette and a hide button',!!$('stgPal')&&!!$('stgOff'));
  ok('hiding the shell hides both panels',(function(){$('stgOff').onclick();
    const hidden=$('stageRail').style.display==='none'&&$('inspector').style.display==='none';
    w.runAction('shell.toggle');return hidden&&w.shellOn();})());
  ok('shell state persists with the project',(function(){w.__state.shell=false;
    const so=JSON.parse(JSON.stringify(w.sessionObj()));w.__state.shell=true;w.renderShell();
    return so.state.shell===false;})());

  // ---------- stage checklists ----------
  ok('an unnamed room is flagged',(function(){w.setStage('rooms');
    return /nincs neve/.test(txt());})());
  ok('the flag clears when fixed',(function(){w.__data.floors[0].name='Nappali';w.renderShell();
    return !/nincs neve/.test(txt());})());
  ok('the badge counts warnings on the rail',(function(){w.__data.floors.push({level:lvl,poly:[[0,0],[10,0],[10,10],[0,10]]});
    w.renderShell();const b=$('stageRail').querySelector('.stg[data-k="rooms"] .stgB');
    const has=!!b&&b.textContent==='1';w.__data.floors.pop();w.renderShell();return has;})());
  ok('the documentation stage reports the validation state',(function(){w.setStage('doc');
    return /nem talált kifogásolni valót|hiba|figyelmeztetés/.test(txt());})());
  ok('a real error surfaces there',(function(){
    w.__data.paths.push({id:'Pbad',nodes:[{x:0,y:0,h:0,level:lvl}],sections:[]});
    w.renderShell();const shown=/hiba van a tervben/.test(txt());
    w.__data.paths.pop();w.renderShell();return shown;})());
  ok('the paths stage notices unlinked devices',(function(){w.setStage('paths');
    return /nincs pályához kötve|nincs pálya rajzolva/.test(txt());})());

  // ---------- the inspector ----------
  w.setStage('build');w.__setSel(null);w.renderShell();
  ok('with nothing selected it says so',/Nincs kijelölés/.test(txt()));
  ok('a wall shows its size and its own fields',(function(){
    w.__setSel({t:'wall',ref:WA[0],level:lvl});w.renderShell();
    const f=w.inspectorFields({t:'wall',ref:WA[0],level:lvl}).map(x=>x.label);
    return /4000 × 300 mm/.test(txt())&&f.length===4&&/Vastagság/.test(f[0])&&/Indul a padlótól/.test(f[3]);})());
  ok('editing a field changes the model',(function(){
    $('ins_th').value='120';$('ins_th').onchange();
    const g=w.wallGeom(WA[0]);return Math.round(g.th)===120;})());
  ok('that edit is undoable',(function(){w.doUndo();
    // applySnap rebuilds the wall objects, so re-read the array rather than the old reference
    return Math.round(w.wallGeom(w.__getWalls()[lvl][0]).th)===300;})());
  ok('the selection survives an undo instead of pointing at an orphan',(function(){
    const live=w.__getWalls()[lvl][0];const sel=w.__getSel();
    return sel&&sel.t==='wall'&&sel.ref===live;})(),'reselectAfterSnap re-resolves it');
  ok('a device shows its ref and height',(function(){w.__setSel({t:'devices',i:0,level:lvl});w.renderShell();
    const f=w.inspectorFields({t:'devices',i:0,level:lvl}).map(x=>x.label);
    return /L1/.test(txt())&&f.join(',')==='Jelölés,Magasság (mm)';})());
  ok('a text field writes strings, not numbers',(function(){$('ins_ref').value='L9';$('ins_ref').onchange();
    return w.__data.devices[0].ref==='L9';})());
  ok('an opening shows width, height and sill',(function(){w.__setSel({t:'openings',i:0,level:lvl});w.renderShell();
    return w.inspectorFields({t:'openings',i:0,level:lvl}).length===3&&/900×2100 mm/.test(txt());})());
  ok('a room shows its area',(function(){w.__setSel({t:'floors',i:0,level:lvl});w.renderShell();
    return /12\.00 m²/.test(txt());})());

  // ---------- the inspector is generated from the registry ----------
  ok('selecting a lamp offers the lamp sheet',(function(){w.__setSel({t:'devices',i:0,level:lvl});
    return w.inspectorActions(w.__getSel()).some(a=>a.id==='lamp.sheet');})());
  ok('selecting a wall offers the wall actions',(function(){w.__setSel({t:'wall',ref:WA[0],level:lvl});
    const ids=w.inspectorActions(w.__getSel()).map(a=>a.id);
    return ids.includes('wall.props')&&ids.includes('editor.wall');})());
  ok('selecting a room offers all three plane views',(function(){w.__setSel({t:'floors',i:0,level:lvl});
    const ids=w.inspectorActions(w.__getSel()).map(a=>a.id);
    return ids.includes('room.floorview')&&ids.includes('room.ceilview')&&ids.includes('room.dropview');})());
  ok('the stage filters what else is offered',(function(){w.__setSel(null);
    w.setStage('doc');const doc=w.inspectorActions(null).map(a=>a.id);
    w.setStage('build');const bld=w.inspectorActions(null).map(a=>a.id);
    return doc.includes('doc.print')&&!bld.includes('doc.print');})());
  ok('a new action appears without touching the shell',(function(){
    w.registerAction({id:'test.shell',label:'Teszt művelet',group:'Fal',run:()=>{}});
    w.__setSel({t:'wall',ref:WA[0],level:lvl});w.renderShell();
    return /Teszt művelet/.test(txt());})(),'this is the point of generating it');
  ok('inspector buttons run their action',(function(){w.setStage('build');w.__setSel(null);w.renderShell();
    let ran=false;w.registerAction({id:'test.run',label:'Teszt futtatás',group:'Rajz',run:()=>{ran=true;}});
    w.renderShell();const b=$('inspector').querySelector('.insA[data-id="test.run"]');
    if(b)b.onclick();return ran;})());

  // ---------- stage navigation ----------
  ok('next / previous stage actions',(function(){w.setStage('build');w.runAction('shell.next');
    const a=w.__state.stage;w.runAction('shell.prev');return a==='rooms'&&w.__state.stage==='build';})());
  ok('they stop at the ends',(function(){w.setStage('build');w.runAction('shell.prev');
    const first=w.__state.stage==='build';w.setStage('doc');w.runAction('shell.next');
    return first&&w.__state.stage==='doc';})());

  // ---------- regressions ----------
  ok('reg: the canvas is untouched by the shell',(function(){
    w.__state.shell=true;w.draw();const a=$('lyScene').innerHTML;
    w.__state.shell=false;w.draw();const b=$('lyScene').innerHTML;
    w.__state.shell=true;w.draw();return a===b;})(),'the shell is chrome, not drawing');
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: palette + status bar',typeof w.paletteOpen==='function'&&!!$('statusBar'));
  ok('reg: editors',(function(){try{w.openWallView(WA[0],lvl);w.wvCloseEditor(true);
    w.openPlaneView(w.__data.floors[0],lvl,'floor');w.wvCloseEditor(true);return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: schema',typeof w.linkTarget==='function'&&w.SCHEMA_VERSION>=1);
  ok('reg: version',/^\d+\.\d+\.\d+$/.test(w.VERSION),w.VERSION);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
