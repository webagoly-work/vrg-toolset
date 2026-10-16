// UI tidy T5–T8 (docs/ui-tidy/UI-AUDIT.md §5): the header diet (T7), the split View (T5), one height source (T6),
// names + icons (T8). The moved buttons keep their ids, so their old bindings are checked through them.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window,d=w.document,$=id=>d.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  // ---- T7: the header ----
  const hdr=d.querySelector('header'),top=[...hdr.children].filter(e=>e.tagName!=='H1'&&!e.classList.contains('sp')&&!e.hidden);
  const items=top.map(e=>e.id||e.textContent.trim());
  ok('T7: the header has five items: Projekt ▾ · ↩ ↪ · Kimenet ▾ · ⌘K · Bevitel ▾',JSON.stringify(items)===JSON.stringify(['hmProj','bUndo','bRedo','hmOut','bCmdK','hmIn']),JSON.stringify(items));
  ok('…every old header id still exists exactly once',['bSave','bLoad','bNew','bPNG','bPNGg','bPrint','bExport','lockBtn','mobileBtn','gpBtn','bPanels','bReset','bUndo','bRedo'].every(id=>d.querySelectorAll('#'+id).length===1));
  ok('…undo / redo are in the header, not in the always-row',!!hdr.querySelector('#bUndo')&&!d.querySelector('#phAlways #bUndo')&&typeof $('bUndo').onclick==='function');
  ok('…Kimenet holds PNG, print, the axonometric sheet, the bill of materials',['bPNG','bPNGg','bPrint','bExport'].every(id=>$('hmOut').contains($(id)))&&!!$('hmOut').querySelector('[data-a="doc.totals"]'));
  ok('…Bevitel holds touch, controller, lock',['mobileBtn','gpBtn','lockBtn'].every(id=>$('hmIn').contains($(id))));
  ok('…Projekt holds the project panel and the building template',!!$('projBody').querySelector('#pjSave')&&!!$('projBody').querySelector('#projList')&&!!$('projBody').querySelector('#saveLayout'));
  const mb=$('hmOut').querySelector('.hmB');mb.click();ok('…a menu opens on click',$('hmOut').classList.contains('open'));
  $('hmIn').querySelector('.hmB').click();ok('…opening another closes the first',!$('hmOut').classList.contains('open')&&$('hmIn').classList.contains('open'));
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));ok('…Esc closes it',!$('hmIn').classList.contains('open'));
  $('bCmdK').click();ok('…⌘K opens the command palette',w.paletteIsOpen());w.paletteClose();
  ok('…the right tabs are Rétegek and Kimutatás only',[...d.querySelectorAll('#rTabs .rTab')].map(b=>b.textContent).join()==='Rétegek,Kimutatás');
  // ---- T5: the quick-view widget + Megjelenés ----
  ok('T5: the quick-view widget holds rotation, projection, style, 2D/3D, reset, full view, Megjelenés',['rotL','rotR','camPreset','styleToggle','view3d','bReset','bPanels','qvMgj'].every(id=>$('qv').contains($(id))));
  const r0=w.__state.rot;$('rotR').click();ok('…the rotation buttons still turn the view, the readout follows',w.__state.rot===(r0+15)%360&&$('qvRot').textContent===w.__state.rot+'°');
  $('qvMgj').click();ok('…⚙ opens the Megjelenés panel with the View and Floor-label settings',$('mgj').classList.contains('on')&&$('mgjBody').contains($('style'))&&$('mgjBody').contains($('lblShow'))&&$('mgjBody').contains($('wallMode')));
  $('mgjX').click();ok('…✕ closes it',!$('mgj').classList.contains('on'));
  ok('…the behaviour toggles are no longer in the View panel (hidden, still bound)',!!$('behHidden')&&$('behHidden').contains($('gizSnap'))&&$('behHidden').contains($('multiSel')));
  w.runAction('app.settings');ok('…Beállítások shows them',!!$('stGiz')&&!!$('stMulti')&&$('stGiz').checked===$('gizSnap').checked);
  let fired=0;$('multiSel').addEventListener('change',()=>fired++);const want=!$('multiSel').checked;$('stMulti').checked=want;$('mOk').click();
  ok('…and saving writes through to the bound checkbox (change fired)',$('multiSel').checked===want&&fired===1);
  // ---- T6: one height source ----
  const g=k=>w.guideByKey(k);
  ok('T6: the Kapcsoló guide is the Standards row (SWI · alap)',w.resolveMm(g('s1100'),'ground')===w.stdH('SWI','alap'));
  w.stdSet('SOC','alap','project',350);
  ok('…a project value in the Standards table moves the guide and its label',w.resolveMm(g('s300'),'ground')===350&&w.guideLabel(g('s300'),'ground')==='350 Dugalj');
  ok('…the draw-height list shows the live label',(()=>{w.rebuildDrawH();const o=[...$('drawH').options].find(x=>x.value==='s300');return o&&o.textContent==='350 Dugalj';})());
  ok('…Panel / Lámpa follow their rows (PAN 1450, LMP fali 1800)',w.resolveMm(g('s1300'),'ground')===w.stdH('PAN','alap')&&w.resolveMm(g('s1900'),'ground')===w.stdH('LMP','fali'));
  ok('…Süllyesztett gerinc = the engine trunk height (ceiling − 250)',w.resolveMm(g('gerinc'),'ground')===w.eval('LH').ground-250);
  w.stdSet('PATH','trunk','project',2500);ok('…or the project PATH trunk value',w.resolveMm(g('gerinc'),'ground')===2500);
  const sp=d.querySelector('#guideBox .gname[data-g="s300"]');sp.ondblclick();
  ok('…a linked guide’s height is not edited in the guide (it points to the Standards table)',!$('grmm')&&/Szabványok/.test($('modal').textContent));w.closeModal();
  const cu=w.eval('GUIDES');cu.push({k:'gx',mm:777,l:'Saját 777',c:'#000',vis:false,jump:true});ok('…a user guide keeps its own number',w.resolveMm(cu[cu.length-1],'ground')===777);
  // ---- T8: names + icons ----
  const h3=[...d.querySelectorAll('.grp h3')].map(e=>e.textContent.trim());
  const EN=/\b(Layers|View|Objects|Device|Build|Path|Cable|Floor|Height|Show|Building|Active|Devices|totals)\b/;
  ok('T8: no English panel heading',!h3.some(t=>EN.test(t)),h3.filter(t=>EN.test(t)).join(' | '));
  ok('…renamed panels keep their place (data-pid)',$('projBody').querySelector('.grp[data-pid="buildinglayout"]')&&$('mgjBody').querySelector('.grp[data-pid="view"]')&&$('mgjBody').querySelector('.grp[data-pid="floorlabels"]'));
  const vis=[...d.querySelectorAll('#phAlways .tool, #phBody .tool, header .hmB, #qv button')].map(b=>({a:b.dataset.a||b.dataset.mode||b.id,i:(b.textContent.trim().match(/^\S+/)||[''])[0]}));
  const byIcon={};vis.forEach(v=>{if(!/^[A-Za-z0-9]/.test(v.i))(byIcon[v.i]=byIcon[v.i]||new Set()).add(v.a);});
  const clash=Object.entries(byIcon).filter(([k,s])=>s.size>1);
  ok('…one icon per function on the phase tools, header and quick-view',!clash.length,clash.map(([k,s])=>k+':'+[...s].join('/')).join(' '));
  const icon=id=>(w.actionById(id)||{}).icon;
  ok('…Mérés ≠ Szabványok, Padló ≠ jelölés, Elosztó ≠ Alosztó ≠ Dugaljak, Beállítások ≠ Megjelenés ≠ Pályák',icon('mode.measure')!==icon('wf.standards')&&icon('wf.floors')!==icon('mark.plane')
    &&new Set([icon('wf.board'),icon('wf.subBoard'),icon('wf.layer.SOC')]).size===3&&new Set([icon('app.settings'),icon('view.appearance'),icon('bl.routes')]).size===3);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
