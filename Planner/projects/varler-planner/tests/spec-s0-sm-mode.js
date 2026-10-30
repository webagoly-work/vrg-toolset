// Simplified UI WP-S0 — mode switch + clear screen (src/11s-sm-mode.js). Tests 1–9 of docs/simple-ui/WP-S0_mode-switch.md.
// Deviations: #stageRail no longer exists (T2) and #inspector moved into the right .side (T3), so test 2 checks real
// visibility (any ancestor display:none). The ◔ button sits next to ⤢ in the stage quick-view #qv (bPanels is there now).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=fs.readFileSync(findPlanner(),'utf8');
const mk=(url,seed)=>new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:url||'http://localhost/',
  beforeParse(win){if(seed)try{win.localStorage.setItem('villanyterv_ui',seed);}catch(_){}}});
const dom=mk();const w=dom.window;const d=w.document;const $=id=>d.getElementById(id);
const disp=el=>el?w.getComputedStyle(el).display:'(missing)';
const shown=el=>{for(let e=el;e&&e!==d.body;e=e.parentElement)if(w.getComputedStyle(e).display==='none')return false;return !!el;};
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  // 1. fresh load
  ok('fresh load: smOn() false, no ui-simple class',w.smOn()===false&&!d.body.classList.contains('ui-simple'));
  ok('#smRoot exists inside .stage-wrap, hidden in normal mode',$('smRoot')&&$('smRoot').parentElement.classList.contains('stage-wrap')&&disp($('smRoot'))==='none');
  ok('the ◔ Egyszerű button is shown in normal mode, next to ⤢',shown($('smBtn'))&&$('smBtn').previousElementSibling===$('bPanels'));
  // 3a. scene in normal mode (HOUSE)
  w.loadBuilding(w.eval('HOUSE'),false);w.draw();const sceneN=$('lyScene').innerHTML;
  // 2. on
  w.smSet(true);
  ok('smSet(true): class set, localStorage simple',d.body.classList.contains('ui-simple')&&w.localStorage.getItem('villanyterv_ui')==='simple');
  ok('header hidden',disp(d.querySelector('header'))==='none');
  ok('every .side hidden',[...d.querySelectorAll('.side')].every(el=>disp(el)==='none'));
  ok('#inspector, #statusBar, #qv and the ◔ button are not shown',!['inspector','statusBar','qv','smBtn'].some(i=>shown($(i))));
  ok('#stage visible, #smRoot block',disp($('stage'))!=='none'&&disp($('smRoot'))==='block');
  $('ctx').style.display='block';$('modalBg').style.display='flex';
  ok('#ctx and #modalBg are not hidden by the mode',disp($('ctx'))==='block'&&disp($('modalBg'))==='flex',disp($('ctx'))+' '+disp($('modalBg')));
  $('ctx').style.display='none';$('modalBg').style.display='';
  // 3b. scene identity
  w.draw();ok('scene byte-identical in simple and normal mode (HOUSE)',$('lyScene').innerHTML===sceneN&&sceneN.length>1000,sceneN.length);
  // 9. Esc with the menu closed does not leave the mode
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  ok('Esc keeps simple mode',w.smOn()===true);
  // 4. actions
  ok('ui.normal enabled while on',w.actionById('ui.normal').when()===true);
  w.runAction('ui.simple');ok('runAction(ui.simple) toggles back off',w.smOn()===false&&!d.body.classList.contains('ui-simple'));
  ok('ui.normal disabled while off',w.actionsFor().every(a=>a.id!=='ui.normal'));
  ok('F2 is the ui.simple key',w.actionForKey('f2',w.actionCtx()).id==='ui.simple');
  // 5. not project data
  w.smSet(true);const ses=JSON.stringify(w.sessionObj());
  ok('sessionObj has neither uiSimple nor "SM"',!/uiSimple/.test(ses)&&!/"SM"/.test(ses));
  w.smSet(false);
  // 8. wide mode survives
  const L=d.querySelector('.side:not(.r)');const hadHide=L.classList.contains('hide');
  w.pnlWide();w.smSet(true);w.smSet(false);w.pnlWide();
  ok('Tab wide mode on → simple on/off → wide off restores the left sidebar',L.classList.contains('hide')===hadHide);
 }catch(err){R.push(['exception',false,err.stack]);}
 // 6 + 7. boot paths
 const d2=mk('http://localhost/','simple');const d3=mk('http://localhost/?ui=normal','simple');
 setTimeout(()=>{
  try{
   ok('boot: stored simple → smOn() true',d2.window.smOn()===true&&d2.window.document.body.classList.contains('ui-simple'));
   ok('boot: ?ui=normal wins over stored simple, storage unchanged',d3.window.smOn()===false&&d3.window.localStorage.getItem('villanyterv_ui')==='simple');
  }catch(err){R.push(['exception (boot)',false,err.stack]);}
  let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
  console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
  process.exit(0);
 },900);
},900);
