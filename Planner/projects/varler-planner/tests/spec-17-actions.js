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
 const top=q=>{const m=w.paletteMatches(q);return m.length?m[0].a.label:'';};
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:4000,y1:300});
  w.__data.devices.push({type:'light',ref:'L1',x:1000,y:340,h:2700,level:lvl,side:1});
  w.__data.floors.push({level:lvl,poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali'});
  w.ensureIds(w.__data);w.draw();

  // ---------- the registry ----------
  ok('a registry exists and is populated',Array.isArray(w.ACTIONS)&&w.ACTIONS.length>=55,'n='+w.ACTIONS.length);
  ok('every action has an id, a label and a run',w.ACTIONS.every(a=>a.id&&a.label&&typeof a.run==='function'));
  ok('ids are unique',(function(){const s=new Set(w.ACTIONS.map(a=>a.id));return s.size===w.ACTIONS.length;})());
  ok('actions are grouped',(function(){const g=new Set(w.ACTIONS.map(a=>a.group));return g.size>=8;})(),
     Array.from(new Set(w.ACTIONS.map(a=>a.group))).join(', '));
  ok('most actions explain themselves',w.ACTIONS.filter(a=>a.hint).length>=15,
     w.ACTIONS.filter(a=>a.hint).length+' have a hint');
  ok('registering is idempotent by id',(function(){const n=w.ACTIONS.length;
    w.registerAction({id:'test.x',label:'Teszt',group:'Teszt',run:()=>{}});
    const a=w.ACTIONS.length;
    w.registerAction({id:'test.x',label:'Teszt 2',group:'Teszt',run:()=>{}});
    const b=w.ACTIONS.length;
    return a===n+1&&b===a&&w.actionById('test.x').label==='Teszt 2';})());

  // ---------- context gating ----------
  const ctx=w.actionCtx();
  ok('the context describes the moment',ctx.mode&&ctx.level&&'inEditor' in ctx&&'selType' in ctx);
  ok('selection-dependent actions are off with nothing selected',
     !w.actionsFor().some(a=>a.id==='lamp.sheet')&&!w.actionsFor().some(a=>a.id==='wall.props'));
  ok('selecting a wall enables the wall actions',(function(){
    w.__setSel({t:'wall',ref:WA[0],level:lvl});
    const on=w.actionsFor().map(a=>a.id);
    return on.includes('wall.props')&&on.includes('editor.wall')&&on.includes('wall.pengefal');})());
  ok('selecting a lamp enables the lamp sheet',(function(){
    w.__setSel({t:'devices',i:0,level:lvl});
    return w.actionsFor().some(a=>a.id==='lamp.sheet');})());
  ok('selecting a floor enables the room actions',(function(){
    w.__setSel({t:'floors',i:0,level:lvl});
    const on=w.actionsFor().map(a=>a.id);
    return on.includes('room.sheet')&&on.includes('room.floorview')&&on.includes('room.dropview');})());
  ok('editor-only actions are off outside an editor',
     !w.actionsFor().some(a=>a.id==='editor.close.save'));
  ok('opening an editor flips the available set',(function(){
    w.openWallView(WA[0],lvl);
    const on=w.actionsFor().map(a=>a.id);
    const good=on.includes('editor.close.save')&&on.includes('editor.full')&&!on.includes('mode.wall');
    w.wvCloseEditor(true);return good;})());
  w.__setSel(null);

  // ---------- running ----------
  ok('runAction runs an enabled action',(function(){w.runAction('mode.path');
    return w.__state.mode==='path';})());
  ok('runAction refuses a disabled one',(function(){w.__setSel(null);
    const before=JSON.stringify(w.__data.devices[0]);
    const r=w.runAction('lamp.sheet');
    return r===false&&JSON.stringify(w.__data.devices[0])===before;})());
  ok('an unknown id is refused, not thrown',w.runAction('nope.nope')===false);
  ok('a throwing action reports instead of crashing',(function(){
    w.registerAction({id:'test.boom',label:'Boom',group:'Teszt',run:()=>{throw new Error('szándékos');}});
    const r=w.runAction('test.boom');
    return r===false&&/szándékos/.test($('hud').textContent);})());
  w.runAction('mode.select');

  // ---------- keyboard, generated from the registry ----------
  ok('key strings are normalised',w.actionKeyString({ctrlKey:true,key:'K'})==='mod+k'
     &&w.actionKeyString({key:' '})==='space'
     &&w.actionKeyString({ctrlKey:true,shiftKey:true,key:'Z'})==='mod+shift+z');
  ok('keys resolve to actions',(function(){const a=w.actionForKey('mod+k',w.actionCtx());
    return a&&a.id==='help.palette';})());
  ok('tool shortcuts are wired',['v','m','w','b','d','p','c'].every(k=>{
    const a=w.actionForKey(k,w.actionCtx());return a&&a.id.indexOf('mode.')===0;}));
  ok('a shortcut respects its own gate',(function(){w.openWallView(WA[0],lvl);
    const a=w.actionForKey('w',w.actionCtx());w.wvCloseEditor(true);return a===null;})(),
     'tool keys are dead while an editor is open');

  // ---------- the palette ----------
  ok('search finds by Hungarian name',top('véset').indexOf('Véset')===0);
  ok('search is accent-insensitive',top('veset').indexOf('Véset')===0&&top('almennyezet').indexOf('Álmennyezet')===0);
  ok('search finds by English alias',top('undo')==='Visszavonás'&&top('bom')==='Anyagkimutatás megnyitása');
  ok('the name beats a mention in another action\'s hint',top('lampa')==='Lámpa adatlap');
  ok('unrelated queries return nothing',w.paletteMatches('qqqzzz').length===0);
  ok('disabled actions are still discoverable',(function(){w.__setSel(null);
    const m=w.paletteMatches('pengefal');
    return m.length>0&&m[0].on===false;})(),'shown dimmed, with the reason');
  ok('a disabled hit explains what it needs',(function(){
    const a=w.actionById('lamp.sheet');return /lámpát/.test(a.need);})());
  ok('enabled ranks above an equally good disabled match',(function(){
    const m=w.paletteMatches('fal');return m[0].on===true;})());
  ok('the palette opens and lists rows',(function(){w.paletteOpen();
    const rows=w.document.querySelectorAll('.palRow').length;
    return w.paletteIsOpen()&&rows>10;})());
  ok('typing filters the list',(function(){const q=$('palQ');q.value='nyomt';q.oninput();
    const first=w.document.querySelector('.palRow .palLab');
    return first&&/Nyomtatás/.test(first.textContent);})());
  ok('arrow keys move the highlight',(function(){const q=$('palQ');q.value='';q.oninput();
    q.onkeydown({key:'ArrowDown',preventDefault(){}});
    return !!w.document.querySelector('.palRow.on');})());
  ok('Escape closes it',(function(){$('palQ').onkeydown({key:'Escape',preventDefault(){}});
    return !w.paletteIsOpen();})());
  ok('shortcuts are shown in the list',(function(){w.paletteOpen();$('palQ').value='vissza';$('palQ').oninput();
    const k=w.document.querySelector('.palRow .palKey');const has=k&&/CTRL/.test(k.textContent);
    w.paletteClose();return has;})());

  // ---------- status bar ----------
  w.draw();
  const sb=()=>$('statusBar').textContent;
  ok('the status bar exists and reports the mode',!!$('statusBar')&&/Kijelölés|Pálya/.test(sb()));
  ok('it reports the level and the drawing height',/szint:/.test(sb())&&/magasság:/.test(sb()),sb().slice(0,80));
  ok('it reports the wall-snap mode',/falhoz köt|szabad rajzolás/.test(sb()));
  ok('it follows a change',(function(){const a=sb();w.runAction('view.midfree');w.draw();
    const b=sb();w.runAction('view.midfree');w.draw();return a!==b;})());
  ok('it shows fine mode while held',(function(){w.fineToggle();w.draw();const on=/finom/.test(sb());
    w.fineToggle();w.draw();return on;})());
  ok('it shows an editor session',(function(){w.openWallView(WA[0],lvl);w.draw();
    const on=/szerkesztő/.test(sb());w.wvCloseEditor(true);w.draw();return on;})());
  ok('it surfaces validation problems',(function(){
    w.__data.paths.push({id:'Pbad',nodes:[{x:0,y:0,h:0,level:lvl}],sections:[]});
    w.draw();const shown=/hiba/.test(sb());w.__data.paths.pop();w.draw();return shown;})());

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: layers still split',!!$('lyScene')&&!!$('lyOverlay'));
  ok('reg: editors',(function(){try{w.openWallView(WA[0],lvl);w.wvCloseEditor(true);
    w.openPlaneView({name:'X',poly:[[0,0],[3000,0],[3000,3000],[0,3000]]},lvl,'ceiling');w.wvCloseEditor(true);
    return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: schema',typeof w.linkTarget==='function'&&w.SCHEMA_VERSION>=1);
  ok('reg: version',/^\d+\.\d+\.\d+$/.test(w.VERSION),w.VERSION);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
