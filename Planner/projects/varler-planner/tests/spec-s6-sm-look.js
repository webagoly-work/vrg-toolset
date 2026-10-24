// Simplified UI WP-S6 — the look (src/11t-sm-menu.js #smMenuCss). Tests 1–5 of docs/simple-ui/WP-S6_visual-pass.md;
// the real look is the ⏸ with screenshots. jsdom has no matchMedia, so tests 4–5 stub it.
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
 const fin=()=>{let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x!==''&&!c?'   ['+x+']':''));});
   console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');process.exit(0);};
 try{
  // 1
  const css=$('smMenuCss')&&$('smMenuCss').textContent;
  const TOK=['--sm-glass','--sm-glass-hi','--sm-glass-back','--sm-edge-hi','--sm-edge-lo','--sm-ink','--sm-ink-dim','--sm-accent','--sm-glow','--sm-warn','--sm-scan','--sm-font','--sm-num'];
  const missT=TOK.filter(t=>!css||css.indexOf(t+':')<0);ok('#smMenuCss defines all 13 design §7 tokens',!!css&&missT.length===0,missT.join(' '));
  ok('token values are verbatim (glass .80, accent #3a8ac4)',/--sm-glass:rgba\(214,224,232,\.80\)/.test(css)&&/--sm-accent:#3a8ac4/.test(css));
  // 2
  w.smSet(true);w.smOpen();const it=$('smMenu').querySelector('.smI');
  // jsdom does not resolve var(): resolve --sm-font by hand (the browser pane check reads the real computed value)
  const ff=w.getComputedStyle(it).fontFamily.replace(/var\(--sm-font\)/,(css.match(/--sm-font:([^;}]+)/)||[,''])[1]);
  ok('a .smI uses Bahnschrift',/^"Bahnschrift SemiCondensed"/.test(ff),ff);
  // 3
  ok('.smI.foc::before is the 3 px accent bar',/\.smI\.foc::before\{[^}]*width:3px[^}]*var\(--sm-accent\)/.test(css));
  ok('pressed = the inverted bevel on :active',/\.smI:active[^{]*\{border-color:var\(--sm-edge-lo\) var\(--sm-edge-hi\) var\(--sm-edge-hi\) var\(--sm-edge-lo\)/.test(css));
  ok('reduced motion switches transitions and animations off',/prefers-reduced-motion:reduce\)\{[^}]*transition:none!important;animation:none!important/.test(css));
  ok('icons are monochrome ink',/\.smIc\{[^}]*grayscale\(1\) brightness\(\.4\) contrast\(1\.3\)/.test(css));
  w.smClose();
  // 4 — motion on
  w.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){}});
  w.smOpen();const col=$('smMenu').querySelector('.smCol:not(.smGhost)');
  const ds=[...col.querySelectorAll('.smI')].map(b=>b.style.getPropertyValue('--d')).join();
  ok('a replace sets .sm-in on the new column, --d = 0…4',col.classList.contains('sm-in')&&ds==='0,1,2,3,4',ds);
  w.smActivate(1);ok('going deeper leaves an .sm-out ghost (not counted as .smI)',!!$('smMenu').querySelector('.smGhost.sm-out')&&$('smMenu').querySelectorAll('.smI').length<=5);
  setTimeout(()=>{
   ok('after 200 ms no .sm-in and no ghost remain',!$('smMenu').querySelector('.sm-in')&&!$('smMenu').querySelector('.smGhost'));
   w.smClose();
   // 5 — reduced motion
   w.matchMedia=q=>({matches:true,media:q,addListener(){},removeListener(){}});
   w.smOpen();w.smActivate(1);
   ok('reduced motion: no .sm-in / .sm-out on a replace',!$('smMenu').querySelector('.sm-in')&&!$('smMenu').querySelector('.sm-out'));
   fin();
  },260);
 }catch(err){R.push(['exception',false,err.stack]);fin();}
},900);
