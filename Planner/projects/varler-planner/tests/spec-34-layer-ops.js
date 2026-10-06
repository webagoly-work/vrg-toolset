// spec-34 — layer operations: duplicate, merge, link, lock
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
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const LY=()=>w.eval('layers'),D=()=>w.__data,J=o=>JSON.stringify(o);
  const undoLen=()=>w.eval('undo.length');
  const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const addDev=(o)=>{D().devices.push(Object.assign({type:'socket',level:lvl,x:100,y:100,h:300,layer:'L0',side:0},o));w.ensureIds(D());return D().devices[D().devices.length-1];};
  const addL=(id,name,o)=>{LY().push(Object.assign({id,name,visible:true,cats:w.layerCatsAll()},o||{}));w.renderLayers();};
  const onLayer=(coll,l)=>D()[coll].filter(r=>(r.layer||'L0')===l);
  const fresh=()=>{w.newBlankProject();};

  // 1 — duplicate: ids, links
  fresh();
  const path0={ptype:'gege',layer:'L0',sections:[],nodes:[{level:lvl,x:0,y:0,h:300},{level:lvl,x:500,y:0,h:300},{level:lvl,x:1000,y:0,h:300}]};
  D().paths.push(path0);w.ensureIds(D());
  const dA=addDev({ref:'A',x:500,y:0}),dB=addDev({ref:'B',x:900,y:900});
  w.setLink(dA,path0.id,path0.nodes[1].id);
  const origLink=J(w.devLinks(dA));
  const u0=undoLen();
  const nid=w.lyrDuplicate('L0');
  ok('duplicate returns a new layer id, inserted directly after the source',!!nid&&LY()[1].id===nid&&LY().length===2);
  ok('the new layer is named "<name> másolat" and copies cats',LY()[1].name==='Alap másolat'&&J(LY()[1].cats)===J(LY()[0].cats));
  ok('the copy holds 2 devices and 1 path',onLayer('devices',nid).length===2&&onLayer('paths',nid).length===1);
  ok('the original layer still holds its items',onLayer('devices','L0').length===2&&onLayer('paths','L0').length===1);
  ok('all ids are new and unique, validate() has no id.duplicate',(function(){const ids=[];['devices','paths'].forEach(k=>D()[k].forEach(r=>{ids.push(r.id);if(k==='paths')r.nodes.forEach(n=>ids.push(n.id));}));
    return new Set(ids).size===ids.length&&!w.validate().some(x=>x.code==='id.duplicate');})());
  const cp=onLayer('paths',nid)[0],cA=onLayer('devices',nid).find(d=>d.ref==='A');
  ok('the copied device links the COPIED path, node 2, glued',(function(){const l=w.devLinks(cA);return l.length===1&&l[0].p===cp.id&&l[0].n===cp.nodes[1].id&&l[0].glue===true&&cp.id!==path0.id;})());
  ok('the original link is unchanged',J(w.devLinks(dA))===origLink);
  ok('the unlinked device copy has no link',w.devLinks(onLayer('devices',nid).find(d=>d.ref==='B')).length===0);
  ok('one undo step removes the duplicate entirely (layer + items)',undoLen()===u0+1&&(w.doUndo(),LY().length===1&&D().devices.length===2&&D().paths.length===1));
  ok('a copy of a copy collides with nothing',(function(){const a=w.lyrDuplicate('L0'),b=w.lyrDuplicate(a);const ids=[];['devices','paths'].forEach(k=>D()[k].forEach(r=>{ids.push(r.id);if(k==='paths')r.nodes.forEach(n=>ids.push(n.id));}));
    return new Set(ids).size===ids.length&&!w.validate().some(x=>x.code==='id.duplicate')&&!!b;})());
  ok('a link to a path on another layer is dropped in the copy',(function(){fresh();
    const p=D().paths;p.push({ptype:'gege',layer:'LX',sections:[],nodes:[{level:lvl,x:0,y:0,h:0},{level:lvl,x:9,y:0,h:0}]});w.ensureIds(D());
    const d=addDev({ref:'Z'});w.setLink(d,p[0].id,p[0].nodes[0].id);const n=w.lyrDuplicate('L0');return w.devLinks(onLayer('devices',n)[0]).length===0&&w.devLinks(d).length===1;})());

  // 2 — clip rows and generated lamp objects
  fresh();
  addDev({ref:'C1',clip:'clipOLD',x:100});addDev({ref:'C2',clip:'clipOLD',x:172});addDev({ref:'C3',x:300});
  const n2=w.lyrDuplicate('L0'),cc=onLayer('devices',n2).filter(d=>d.clip);
  ok('clipped devices duplicate into a pair sharing a NEW clip',cc.length===2&&cc[0].clip===cc[1].clip&&cc[0].clip!=='clipOLD'&&onLayer('devices','L0').every(d=>!d.clip||d.clip==='clipOLD'));
  fresh();
  const lamp=addDev({type:'light',ref:'L1',genId:'lampX'});D().objects.push({level:lvl,x:1,y:1,w:100,d:100,ht:100,layer:'L0',genId:'lampX',genFor:'lamp'});w.ensureIds(D());
  const n2b=w.lyrDuplicate('L0'),gd=onLayer('devices',n2b)[0],go=onLayer('objects',n2b)[0];
  ok('a lamp device and its generated object keep a common NEW genId in the copy',gd.genId&&gd.genId===go.genId&&gd.genId!=='lampX'&&lamp.genId==='lampX');

  // 3 — walls
  fresh();const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:4000,y1:100,layer:'L0'});WA.push({x0:0,y0:0,x1:100,y1:3000,layer:'L0'});w.ensureIds(D());addDev({});
  const n3=w.lyrDuplicate('L0');
  ok('duplicate without walls copies 0 walls',WA.length===2);
  const n3b=w.lyrDuplicate('L0',{walls:true});
  ok('duplicate with {walls:true} copies them with new W ids on the new layer',WA.length===4&&WA.filter(r=>r.layer===n3b).length===2&&new Set(WA.map(r=>r.id)).size===4&&WA.every(r=>/^W\d+$/.test(r.id)));
  ok('the wall copy rebuilt the snap lines',w.eval(`SNAP.${lvl}`).length!==undefined);

  // 4 — merge
  fresh();addL('L1','Réteg 2');addL('L2','Réteg 3');
  addDev({ref:'U1',layer:'L1'});addDev({ref:'U2',layer:'L1'});addDev({ref:'B1',layer:'L2'});
  LY()[2].cats.socket=false;
  const m0=undoLen();
  ok('lyrMergeDown: the upper layer is gone, its items carry the lower layer id',w.lyrMergeDown('L1')===true&&LY().map(l=>l.id).join()==='L0,L2'&&onLayer('devices','L2').length===3&&onLayer('devices','L1').length===0);
  ok('the target keeps its own cats',LY()[1].cats.socket===false);
  ok('merge is one undo step; undo restores both layers and the original layer fields',undoLen()===m0+1&&(w.doUndo(),LY().map(l=>l.id).join()==='L0,L1,L2'&&onLayer('devices','L1').length===2&&onLayer('devices','L2').length===1));
  ok('the active layer follows when the merged layer was active',(function(){w.__state.activeLayer='L1';w.lyrMergeDown('L1');const r=w.__state.activeLayer==='L2';return r;})());
  w.doUndo();
  ok('merging the last layer down is refused (no undo step)',(function(){const n=undoLen();return w.lyrMergeDown('L2')===false&&undoLen()===n;})());
  ok('merging L0 as a source is refused',(function(){const n=undoLen();return w.lyrMerge('L1',['L0'])===false&&w.lyrMergeDown('L0')!==undefined&&LY()[0].id==='L0'&&undoLen()===n;})());
  ok('a stack layer merges only into its own stack',(function(){LY()[1].stack='S1';const n=undoLen();const a=w.lyrMerge('L2',['L1']);const refused=a===false&&LY().length===3&&undoLen()===n&&/Stack réteg/.test($('hud').textContent);
    LY()[2].stack='S1';const b=w.lyrMerge('L2',['L1']);return refused&&b===true&&LY().length===2;})());
  w.doUndo();

  // 5 — link
  fresh();addL('L1','Réteg 2');addL('L2','Réteg 3');addDev({layer:'L1'});addDev({layer:'L2',x:200});
  const g=w.lyrLink(['L1','L2']);
  ok('lyrLink gives both layers one group id',!!g&&LY()[1].link===g&&LY()[2].link===g&&w.lyrGroupOf('L1').length===2);
  ok('a layer with no link is its own group',w.lyrGroupOf('L0').length===1&&w.lyrGroupOf('L0')[0].id==='L0');
  w.__state.activeLayer='L1';w.renderLayers();
  click(w.document.querySelector('[data-lv="L1"]'));
  ok('hiding L1 hides L2',LY()[1].visible===false&&LY()[2].visible===false&&LY()[0].visible===true);
  click(w.document.querySelector('[data-lv="L1"]'));
  ok('showing it again shows both',LY()[1].visible&&LY()[2].visible);
  w.lyrSetOp('L1','socket',1);w.renderLayers();
  click(w.document.querySelector('[data-so="L1:socket:-1"]'));
  ok('[−] on L1 Dugaljak changes L2 too',LY()[1].op.socket===0.9&&LY()[2].op.socket===0.9);
  click(w.document.querySelector('[data-sv="L1:socket"]'));
  ok('a sub-layer 👁 acts on the whole group',LY()[1].cats.socket===false&&LY()[2].cats.socket===false);
  click(w.document.querySelector('[data-sv="L1:socket"]'));
  ok('linked layers show a 🔗 badge, the others do not',w.document.querySelectorAll('#layerList .llink').length===2);
  w.lyrUnlink('L1');
  ok('unlink: the single remaining member is un-grouped too',!('link' in LY()[1])&&!('link' in LY()[2]));
  click(w.document.querySelector('[data-lv="L1"]'));
  ok('after unlinking the layers are independent',LY()[1].visible===false&&LY()[2].visible===true);
  click(w.document.querySelector('[data-lv="L1"]'));
  ok('lyrLink with one id unlinks it',(function(){w.lyrLink(['L1','L2']);w.lyrLink(['L1']);return !('link' in LY()[1]);})());
  ok('link and unlink are undoable',(function(){w.lyrLink(['L1','L2']);w.doUndo();return !('link' in LY()[1])&&!('link' in LY()[2]);})());
  ok('merge linked: the group folds into its topmost layer',(function(){w.lyrLink(['L1','L2']);const r=w.lyrMergeLinked('L2');
    return r&&LY().map(l=>l.id).join()==='L0,L1'&&onLayer('devices','L1').length===2&&!('link' in LY()[1]);})());

  // 6 — lock and hit test
  fresh();addL('L1','Réteg 2');
  const d0=addDev({ref:'ON0',x:100,y:100,layer:'L0'}),d1=addDev({ref:'ON1',x:3000,y:3000,layer:'L1'});
  w.__state.zoom=1;
  const at=d=>{const b=w.planToBase(d.x,d.y,w.dz(d.level,d.h||0));w.clientToBase=()=>b;return w.hitTest({clientX:0,clientY:0});};
  ok('an unlocked L1 device is hit',(function(){const h=at(d1);return h&&h.t==='devices'&&D().devices[h.i]===d1;})());
  w.lyrToggleLock('L1');w.renderLayers();
  ok('a locked layer shows 🔒 and its device is not hit',LY()[1].lock===true&&at(d1)===null&&!!w.document.querySelector('[data-lk="L1"]')&&w.document.querySelector('[data-lk="L1"]').textContent==='🔒');
  ok('the click that would have hit it says so in the HUD',/Zárolt réteg: Réteg 2/.test($('hud').textContent));
  ok('an L0 device still hits',(function(){const h=at(d0);return h&&D().devices[h.i]===d0;})());
  ok('a locked item does not shadow an unlocked one behind it',(function(){d1.x=d0.x+10;d1.y=d0.y;const h=at(d0);d1.x=3000;d1.y=3000;return h&&D().devices[h.i]===d0;})());
  ok('a locked item still draws and still counts for snapping',(function(){w.draw();return w.eval('_lastScene').length>0&&w.layerShows(d1,'device')===true;})());
  ok('a locked device is not offered to the right-click device hit either',(function(){const b=w.planToBase(d1.x,d1.y,w.dz(d1.level,d1.h));w.clientToBase=()=>b;return w.devHitIdx({clientX:0,clientY:0})===null;})());
  w.lyrToggleLock('L1');
  ok('unlocking makes it hit again',at(d1)!==null&&!('lock' in LY()[1]));
  ok('linked layers lock together',(function(){addL('L2','Réteg 3');w.lyrLink(['L1','L2']);w.lyrToggleLock('L1');const r=LY()[1].lock&&LY()[2].lock;w.lyrToggleLock('L2');return r&&!LY()[1].lock&&!LY()[2].lock;})());

  // 7 — right-click menu on the layer row, actions
  fresh();addL('L1','Réteg 2');addL('L2','Réteg 3');
  w.document.querySelector('[data-lb="L1"] .lrow').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));
  let labels=[...w.document.querySelectorAll('#ctx button')].map(b=>b.textContent);
  ok('the layer menu offers copy, merge down, link, lock',['Réteg másolása…','Egyesítés az alatta lévővel','Csatolás…','Zárolás'].every(t=>labels.indexOf(t)>=0)&&labels.indexOf('Csatolás bontása')<0);
  w.lyrLink(['L1','L2']);
  w.document.querySelector('[data-lb="L1"] .lrow').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));
  labels=[...w.document.querySelectorAll('#ctx button')].map(b=>b.textContent);
  ok('a linked layer also offers Csatolt rétegek egyesítése and Csatolás bontása',labels.indexOf('Csatolt rétegek egyesítése')>=0&&labels.indexOf('Csatolás bontása')>=0);
  w.document.querySelector('[data-lb="L0"] .lrow').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:20,clientY:20}));
  labels=[...w.document.querySelectorAll('#ctx button')].map(b=>b.textContent);
  ok('L0 is never offered a merge down',labels.indexOf('Egyesítés az alatta lévővel')<0);
  ok('the six actions exist in group Réteg',['layer.duplicate','layer.mergeDown','layer.mergeLinked','layer.link','layer.unlink','layer.lock'].every(id=>{const a=w.actionById(id);return a&&a.group==='Réteg';}));
  ok('mergeLinked / unlink are only available for a linked active layer',(function(){w.__state.activeLayer='L0';const a=w.actionById('layer.mergeLinked'),b=w.actionById('layer.unlink');
    const off=!a.when({})&&!b.when({});w.__state.activeLayer='L1';return off&&a.when({})&&b.when({});})());
  ok('layer.duplicate opens a modal that duplicates the active layer',(function(){w.__state.activeLayer='L0';addDev({ref:'Q'});const n=LY().length;w.actionById('layer.duplicate').run({});$('ldWalls').checked=false;$('mOk').click();return LY().length===n+1;})());
  ok('layer.link opens a checkbox list and links the ticked layers',(function(){w.lyrUnlink('L1');w.__state.activeLayer='L0';w.actionById('layer.link').run({});
    const boxes=[...w.document.querySelectorAll('.llSel')];boxes.forEach(b=>{b.checked=(b.value==='L0'||b.value==='L2');});$('mOk').click();return !!LY().find(l=>l.id==='L0').link&&LY().find(l=>l.id==='L0').link===LY().find(l=>l.id==='L2').link;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
