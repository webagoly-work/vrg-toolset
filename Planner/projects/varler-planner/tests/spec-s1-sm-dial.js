// Simplified UI WP-S1 — the dial (src/11s-sm-mode.js). Tests 1–6 of docs/simple-ui/WP-S1_dial.md, plus SUI-Q S01 = A+C:
// the bottom-right mirror (smSide) keeps the same shape mirrored and persists as a viewer preference.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const d=w.document;const $=id=>d.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.smSet(true);const dial=$('smDial');
  // 1
  ok('#smDial inside #smRoot',dial&&dial.parentElement===$('smRoot'));
  const q=dial.querySelector('.smQ');
  ok('.smQ d = M0,96 L0,8 A88,88 0 0 1 88,96 Z',q&&q.getAttribute('d')==='M0,96 L0,8 A88,88 0 0 1 88,96 Z',q&&q.getAttribute('d'));
  ok('10 ticks',dial.querySelectorAll('.smTk').length===10);
  ok('rings 88 / 64 and the core are drawn',!!dial.querySelector('.smR1')&&!!dial.querySelector('.smR2')&&!!dial.querySelector('.smCore'));
  ok('#smMenu and #smHint exist',!!$('smMenu')&&!!$('smHint'));
  ok('a11y: role=button, aria-haspopup=menu, tabindex 0',dial.getAttribute('role')==='button'&&dial.getAttribute('aria-haspopup')==='menu'&&dial.getAttribute('tabindex')==='0');
  // 2
  ok('idle glyph ≡',/≡/.test(w.smDialSvg({open:false,depth:0})));
  ok('open glyph ×',/×/.test(w.smDialSvg({open:true,depth:0})));
  const tmp=d.createElementNS('http://www.w3.org/2000/svg','svg');tmp.innerHTML=w.smDialSvg({open:true,depth:2});
  ok('depth 2 → exactly 2 lit arcs of 4',tmp.querySelectorAll('.smDp.on').length===2&&tmp.querySelectorAll('.smDp').length===4);
  ok('a tool icon replaces the glyph',/✏/.test(w.smDialSvg({tool:{icon:'✏'}})));
  // 3
  dial.querySelector('.smQ').dispatchEvent(new w.Event('pointerup',{bubbles:true}));
  ok('pointerup on .smQ opens, aria-expanded true',w.__SM.open===true&&dial.getAttribute('aria-expanded')==='true');
  dial.querySelector('.smQ').dispatchEvent(new w.Event('pointerup',{bubbles:true}));
  ok('again → closed',w.__SM.open===false&&dial.getAttribute('aria-expanded')==='false');
  dial.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  ok('Enter on the focused dial toggles',w.__SM.open===true);w.smToggle();
  // 4
  w.smDialDraw();let n=0;const mo=new w.MutationObserver(r=>{n+=r.length;});mo.observe(dial,{childList:true,subtree:true,characterData:true});
  w.smDialDraw();
  setTimeout(()=>{
   mo.disconnect();ok('an unchanged redraw does not touch the dial',n===0,n);
   // 5
   const t2=d.createElementNS('http://www.w3.org/2000/svg','svg');t2.innerHTML=w.smDialSvg({warn:3});
   const wn=t2.querySelector('.smWarn');ok('warn 3 → a .smWarn text "3"',wn&&wn.textContent==='3');
   // 6
   const sel0=JSON.stringify(w.__getSel?w.__getSel():null);
   dial.querySelector('.smQ').dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
   ok('pointerdown on the dial: selection unchanged, mode select',JSON.stringify(w.__getSel?w.__getSel():null)===sel0&&w.__state.mode==='select');
   // S01 C — the mirror
   w.smSide(true);
   ok('smSide(true): body.sm-right, stored right',d.body.classList.contains('sm-right')&&w.localStorage.getItem('villanyterv_ui_side')==='right');
   ok('mirrored quadrant M96,96 L96,8 A88,88 0 0 0 8,96 Z',dial.querySelector('.smQ').getAttribute('d')==='M96,96 L96,8 A88,88 0 0 0 8,96 Z',dial.querySelector('.smQ').getAttribute('d'));
   ok('mirrored glyph is end-anchored at x 87',dial.querySelector('.smGl').getAttribute('x')==='87'&&dial.querySelector('.smGl').getAttribute('text-anchor')==='end');
   w.smSide(false);ok('smSide(false) back to the left',!d.body.classList.contains('sm-right')&&dial.querySelector('.smQ').getAttribute('d')==='M0,96 L0,8 A88,88 0 0 1 88,96 Z');
   ok('the side is not project data',!/sm-right|ui_side|"right":/.test(JSON.stringify(w.sessionObj())));
   let bad=0;R.forEach(([nm,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+nm+(x!==''&&!c?'   ['+x+']':''));});
   console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
   process.exit(0);
  },50);
 }catch(err){console.log('FAIL  exception   ['+err.stack+']');process.exit(0);}
},900);
