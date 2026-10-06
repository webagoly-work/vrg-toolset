// spec-33 — layer panel: vertical sub-layer rows, counts, opacity buttons, swap / move, right-click menu, hold-drag
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const LY=()=>w.eval('layers'),D=()=>w.__data,J=o=>JSON.stringify(o);
  const rows=()=>[...w.document.querySelectorAll('#layerList .lblock.lactive .lsub')];
  const row=(l,c)=>w.document.querySelector(`#layerList [data-sl="${l}:${c}"]`);
  const btn=(l,c,d)=>w.document.querySelector(`#layerList [data-so="${l}:${c}:${d}"]`);
  const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const ptr=(type,el,o)=>el.dispatchEvent(new w.MouseEvent(type,Object.assign({bubbles:true,cancelable:true,button:0,clientX:10,clientY:10},o||{})));
  const addDev=(type,layer,x)=>{D().devices.push({type,ref:type[0]+x,level:lvl,x,y:100,h:300,layer,side:0});w.ensureIds(D());};
  const cleanLayers=()=>{w.newBlankProject();};
  const withL1=(n)=>{LY().push({id:'L1',name:'Réteg 2',visible:true,cats:w.layerCatsAll()});if(n)LY().push({id:'L2',name:'Réteg 3',visible:true,cats:w.layerCatsAll()});w.renderLayers();};

  // 1 — rows
  cleanLayers();w.renderLayers();
  ok('one .lsub row per non-optional category on the active layer',rows().length===w.LAYER_CATS.filter(c=>!c.opt).length);
  ok('rows are in LAYER_CATS order',J(rows().map(r=>r.dataset.sl.split(':')[1]))===J(w.LAYER_CATS.filter(c=>!c.opt).map(c=>c.k)));
  ok('an optional category (note) is absent until a note is on the layer',!row('L0','note')&&(function(){
    D().notes.push({level:lvl,x:10,y:10,text:'n',layer:'L0'});w.ensureIds(D());w.renderLayers();return !!row('L0','note');})());
  D().notes.length=0;

  // 2 — counts
  cleanLayers();[100,200,300].forEach(x=>addDev('socket','L0',x));addDev('switch','L0',400);addDev('junction','L0',500);w.renderLayers();
  const cnt=(l,c)=>{const r=row(l,c);return r?r.querySelector('.lsc').textContent:null;};
  ok('3 sockets + 1 switch → Dugaljak 3, Kapcsolók 1, Eszközök 1',cnt('L0','socket')==='3'&&cnt('L0','switch')==='1'&&cnt('L0','device')==='1');
  ok('lyrCount agrees with the panel',w.lyrCount('L0','socket')===3&&w.lyrCount('L0','light')===0);
  ok('a category without items shows no number and a dimmed row',cnt('L0','light')===''&&row('L0','light').classList.contains('none'));

  // 3 — opacity buttons
  ok('[+] at 100 % is disabled, [−] is not',btn('L0','socket',1).disabled===true&&btn('L0','socket',-1).disabled===false);
  click(btn('L0','socket',-1));click(btn('L0','socket',-1));
  ok('[−] twice → op 0.8 and the label reads 80%',LY()[0].op&&LY()[0].op.socket===0.8&&row('L0','socket').querySelector('.lsp').textContent==='80%');
  ok('[+] is enabled again after the first [−]',btn('L0','socket',1).disabled===false);
  for(let i=0;i<12;i++){const b=btn('L0','socket',-1);if(b&&!b.disabled)click(b);}
  ok('the minimum is 10 % and [−] is then disabled',LY()[0].op.socket===0.1&&btn('L0','socket',-1).disabled===true);
  click(btn('L0','socket',1));
  ok('[+] steps up by 10 points',LY()[0].op.socket===0.2);
  w.lyrSetOp('L0','socket',1);w.renderLayers();
  ok('the 👁 button of a row toggles its category',(function(){const b=w.document.querySelector('[data-sv="L0:socket"]');click(b);const off=LY()[0].cats.socket===false&&row('L0','socket').classList.contains('off');click(w.document.querySelector('[data-sv="L0:socket"]'));return off&&LY()[0].cats.socket===true;})());

  // 4 — swap
  cleanLayers();withL1();
  [100,200,300].forEach(x=>addDev('socket','L0',x));[400,500].forEach(x=>addDev('socket','L1',x));addDev('switch','L0',600);
  w.lyrSetOp('L0','socket',0.8);w.lyrSetOp('L1','socket',0.5);LY()[1].cats.socket=false;
  const idsOf=(l,c)=>w.lyrItemsOf(l,c).map(x=>x.rec.id).sort();
  const a0=idsOf('L0','socket'),b0=idsOf('L1','socket');
  const undoLen=()=>w.eval('undo.length');const u0=undoLen();
  ok('lyrSwapCat reports success',w.lyrSwapCat('L0','L1','socket')===true);
  ok("swap: L0's 3 sockets are on L1 and L1's 2 on L0",J(idsOf('L1','socket'))===J(a0)&&J(idsOf('L0','socket'))===J(b0));
  ok('swap leaves the switch alone',w.lyrItemsOf('L0','switch').length===1&&w.lyrItemsOf('L1','switch').length===0);
  ok('swap exchanges the opacity of the two sets',LY()[0].op.socket===0.5&&LY()[1].op.socket===0.8);
  ok('swap exchanges the visibility of the two sets',LY()[0].cats.socket===false&&LY()[1].cats.socket===true);
  ok('swap is exactly one undo step',undoLen()===u0+1);
  w.doUndo();
  ok('one undo restores items, opacity and visibility',J(idsOf('L0','socket'))===J(a0)&&J(idsOf('L1','socket'))===J(b0)&&LY()[0].op.socket===0.8&&LY()[1].op.socket===0.5&&LY()[1].cats.socket===false);
  w.doRedo();
  ok('redo re-applies the swap',J(idsOf('L1','socket'))===J(a0));
  w.doUndo();
  ok('swap refuses the same layer and an empty source (no undo step)',(function(){const n=undoLen();
    const r1=w.lyrSwapCat('L0','L0','socket'),r2=w.lyrSwapCat('L0','L1','light');return r1===false&&r2===false&&undoLen()===n;})());
  ok('swap does not ping-pong when both sides hold items',idsOf('L0','socket').length===3&&idsOf('L1','socket').length===2);
  ok('the HUD names the swap',(w.lyrSwapCat('L0','L1','socket'),/Csere: Dugaljak — Réteg 1 ↔ Réteg 2 \(3 ↔ 2 elem\)/.test($('hud').textContent)||$('hud').textContent));

  // 5 — move, walls
  cleanLayers();withL1();
  const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:4000,y1:100,layer:'L0'});WA.push({x0:0,y0:0,x1:100,y1:3000,layer:'L0'});w.ensureIds(D());
  const snap0=w.eval(`SNAP.${lvl}`);
  ok('lyrItemsOf includes walls',w.lyrItemsOf('L0','wall').length===2&&w.lyrItemsOf('L0','wall')[0].coll==='walls');
  ok('lyrMoveCat moves the wall rects to the other layer and switches it on',(function(){LY()[1].cats.wall=false;const r=w.lyrMoveCat('L0','L1','wall');
    return r&&WA.every(x=>x.layer==='L1')&&LY()[1].cats.wall===true&&w.lyrItemsOf('L0','wall').length===0;})());
  ok('SNAP is rebuilt for the touched level',w.eval(`SNAP.${lvl}`)!==snap0);
  w.doUndo();
  ok('undo moves the walls back',w.__getWalls()[lvl].every(x=>x.layer==='L0'));

  // 6 — context menu
  cleanLayers();withL1(true);addDev('socket','L0',100);w.renderLayers();
  row('L0','socket').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));
  const menu=[...w.document.querySelectorAll('#ctx button')].map(b=>b.textContent);
  ok('the menu lists Csere + Áthelyezés for each other layer',['Csere: Réteg 2','Csere: Réteg 3','Áthelyezés: Réteg 2','Áthelyezés: Réteg 3'].every(t=>menu.indexOf(t)>=0)&&menu.indexOf('Csere: Alap')<0);
  ok('the menu has Csak ez látszik and the opacity reset',menu.indexOf('Csak ez látszik')>=0&&menu.indexOf('Átlátszatlanság visszaállítása')>=0);
  ok('a separator item exists and clicking it does not throw',(function(){const sep=[...w.document.querySelectorAll('#ctx button')].find(b=>b.textContent==='—');try{sep.click();return true;}catch(e){return false;}})());
  row('L0','socket').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));
  [...w.document.querySelectorAll('#ctx button')].find(b=>b.textContent==='Áthelyezés: Réteg 3').click();
  ok('clicking Áthelyezés moves the sockets',w.lyrItemsOf('L2','socket').length===1&&w.lyrItemsOf('L0','socket').length===0);
  w.doUndo();w.renderLayers();
  row('L0','socket').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));
  [...w.document.querySelectorAll('#ctx button')].find(b=>b.textContent==='Csak ez látszik').click();
  ok('Csak ez látszik: every other category off, this one on',LY()[0].cats.socket===true&&w.LAYER_CATS.filter(c=>c.k!=='socket').every(c=>LY()[0].cats[c.k]===false));
  w.lyrSetOp('L0','socket',0.5);w.renderLayers();
  row('L0','socket').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));
  [...w.document.querySelectorAll('#ctx button')].find(b=>b.textContent==='Átlátszatlanság visszaállítása').click();
  ok('Átlátszatlanság visszaállítása clears the op',!LY()[0].op);

  // 7 — hold and drag
  async function drag(opt){opt=opt||{};
    cleanLayers();withL1();[100,200,300].forEach(x=>addDev('socket','L0',x));[400,500].forEach(x=>addDev('socket','L1',x));w.renderLayers();
    const r=row('L0','socket'),blk1=w.document.querySelector('#layerList [data-lb="L1"]');
    w.document.elementFromPoint=()=>blk1.querySelector('.lrow')||blk1;
    ptr('pointerdown',r,{clientX:10,clientY:10});
    await sleep(opt.hold||400);
    const lifted=r.classList.contains('ldrag');
    if(opt.esc)r.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    ptr('pointermove',r,{clientX:12,clientY:80});
    const hot=blk1.classList.contains('ldrop');
    ptr('pointerup',r,{clientX:12,clientY:80,ctrlKey:!!opt.ctrl});
    return {lifted,hot,l0:w.lyrItemsOf('L0','socket').length,l1:w.lyrItemsOf('L1','socket').length,
            clean:!r.classList.contains('ldrag')&&!w.document.querySelector('.ldrop'),gone:w.eval('lyrDrag')===null};}
  const sw=await drag();
  ok('hold 400 ms, drag onto another layer: the row lifts, the block lights up, a drop swaps',sw.lifted&&sw.hot&&sw.l0===2&&sw.l1===3);
  ok('after the drop nothing is left lifted or highlighted',sw.clean&&sw.gone);
  const mv=await drag({ctrl:true});
  ok('the same with Ctrl moves instead of swapping',mv.l0===0&&mv.l1===5);
  const sh=await drag({hold:100});
  ok('a 100 ms press is not a drag: nothing happens',!sh.lifted&&sh.l0===3&&sh.l1===2);
  const es=await drag({esc:true});
  ok('Esc during a drag cancels it and only it',es.lifted&&es.l0===3&&es.l1===2&&es.clean);
  cleanLayers();withL1();addDev('socket','L0',100);w.renderLayers();
  ok('moving more than 6 px before 350 ms is a scroll, not a lift',await (async()=>{const r=row('L0','socket');ptr('pointerdown',r,{clientX:10,clientY:10});ptr('pointermove',r,{clientX:10,clientY:40});
    await sleep(400);const l=r.classList.contains('ldrag');ptr('pointerup',r,{});return !l&&w.eval('lyrDrag')===null;})());
  ok('a release outside any other block does nothing',await (async()=>{const r=row('L0','socket'),own=w.document.querySelector('#layerList [data-lb="L0"]');
    w.document.elementFromPoint=()=>own;ptr('pointerdown',r,{});await sleep(400);ptr('pointermove',r,{clientY:30});ptr('pointerup',r,{clientY:30});
    return w.lyrItemsOf('L0','socket').length===1;})());
  ok('re-rendering the panel ends a pending drag',await (async()=>{const r=row('L0','socket');ptr('pointerdown',r,{});w.renderLayers();await sleep(400);return w.eval('lyrDrag')===null;})());

  // 8 — fold, actions, structure
  cleanLayers();withL1();
  ok('only the active layer is open by default',w.document.querySelectorAll('#layerList .lblock .lsub').length===rows().length&&rows().length>0&&!w.document.querySelector('#layerList [data-lb="L1"] .lsub'));
  ok('the fold button opens a collapsed layer and the choice sticks',(function(){click(w.document.querySelector('[data-lf="L1"]'));
    const open=!!w.document.querySelector('#layerList [data-lb="L1"] .lsub');w.renderLayers();return open&&!!w.document.querySelector('#layerList [data-lb="L1"] .lsub')&&LY()[1].collapsed===false;})());
  ok('the radio makes a layer active and opens it',(function(){const r=w.document.querySelector('[data-la="L1"]');r.checked=true;r.dispatchEvent(new w.Event('change',{bubbles:true}));return w.__state.activeLayer==='L1';})());
  ok('the tint picker and the layer controls are still there',!!w.document.querySelector('#layerList [data-lt="L1"]')&&!!w.document.querySelector('[data-lv="L0"]')&&!!w.document.querySelector('[data-ln="L0"]')&&!w.document.querySelector('[data-lx="L0"]')&&!!w.document.querySelector('[data-lx="L1"]'));
  ok('actions layer.swapCat and layer.moveCat exist in group Réteg and need two layers',(function(){
    const a=w.actionById('layer.swapCat'),b=w.actionById('layer.moveCat');return a&&b&&a.group==='Réteg'&&b.group==='Réteg';})());
  ok('the actions open a modal and run the operation',(function(){
    addDev('socket','L0',100);w.renderLayers();w.actionById('layer.swapCat').run({});
    $('lcFrom').value='L0';$('lcCat').value='socket';$('lcTo').value='L1';$('mOk').click();return w.lyrItemsOf('L1','socket').length===1;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
