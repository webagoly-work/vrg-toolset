// ==========================================================================
// 11t-sm-menu.js — Egyszerű felület (docs/simple-ui): the menu engine (column, Back, paging, keys), search, menu CSS
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// A leaf only ever runs runAction(id) (contract §2.4); the tree itself lives in 11u-sm-tree.js.
// ==========================================================================

// node:  {k, n, i?, items:[node|leaf]}  or  {k, n, i?, gen:'rules'|'endpoints'|'layers'|'projects'|'other'}
// leaf:  {a:'action.id', n?, i?, kind:'action'|'tool'|'stay'}  or  {fn:()=>{}, n, i?, kind, line2?}  (generator-only)
let SM_TREE={k:'root',n:'Menü',items:[]};        // S3 fills it; tests use smUseTree(t)
const SM_GEN={};                                  // S3 registers generators: SM_GEN.rules=()=>[...]
SM.menuLast=null;SM.slots=[];SM.anim=0;

function smUseTree(t){SM_TREE=t;SM.stack=[];SM.menuLast=null;if(SM.open)SM.stack=[{node:SM_TREE,page:0,focus:0}];}
function smChildren(node){if(!node)return [];if(node.items)return node.items;
  if(node.gen){try{const f=SM_GEN[node.gen];if(!f)throw new Error('nincs generátor: '+node.gen);return f()||[];}
    catch(err){return [{n:'Hiba: '+((err&&err.message)||err),kind:'action',disabled:true}];}}
  return [];}
// paging: ≤4 → one page; else 3 + TOVÁBB while more than 4 remain, the last page holds the rest (≤4)
function smPage(list,page){const pages=[];let i=0;const n=list.length;
  if(n<=4)pages.push(list.slice());else{while(n-i>4){pages.push(list.slice(i,i+3));i+=3;}pages.push(list.slice(i));}
  const p=Math.max(0,Math.min(page|0,pages.length-1));return {items:pages[p],pages:pages.length,page:p,more:p<pages.length-1};}
function smTop(){return SM.stack[SM.stack.length-1]||null;}
function smLeafSlot(leaf){
  if(leaf.items||leaf.gen)return {kind:'sub',n:leaf.n,i:leaf.i||'▸',sub:leaf,disabled:false,line2:''};
  if(leaf.a){const a=actionById(leaf.a);
    if(!a)return {kind:'leaf',leaf,n:leaf.n||leaf.a,i:leaf.i||'•',a:leaf.a,disabled:true,line2:'hiányzó parancs: '+leaf.a};
    const dis=!actionEnabled(a,actionCtx());
    return {kind:'leaf',leaf,n:leaf.n||a.label,i:leaf.i||a.icon||'•',a:leaf.a,stay:leaf.kind==='stay',tool:leaf.kind==='tool',
      disabled:dis,line2:dis?(a.need||'nem elérhető most'):''};}
  return {kind:'leaf',leaf,n:leaf.n,i:leaf.i||'•',stay:leaf.kind==='stay',tool:leaf.kind==='tool',disabled:!!leaf.disabled,line2:leaf.line2||''};}
function smView(){const top=smTop();if(!top)return {crumb:'',slots:[]};
  const pg=smPage(smChildren(top.node),top.page);top.page=pg.page;
  const slots=pg.items.map(smLeafSlot);
  if(pg.more)slots.push({kind:'more',n:'Tovább',i:'›',disabled:false,line2:''});
  const root=SM.stack.length===1&&pg.page===0;
  slots.push({kind:'back',n:root?'Bezár':'Vissza',i:root?'✕':'◂',disabled:false,line2:''});
  const names=SM.stack.map(s=>s.node.n),pgT=pg.pages>1?'('+(pg.page+1)+'/'+pg.pages+')':'';
  const crumb=names.join(' / ')+(pgT?' '+pgT:'');
  // the line is 248 px: deep levels keep the last two names (mock: … / Szabálykészlet / Fal), the page count sits on the right
  const shown=names.length>3?['…'].concat(names.slice(-2)):names;
  const crumbHtml='<span>'+shown.slice(0,-1).map(n=>smEsc(n)+' / ').join('')+'<b>'+smEsc(shown[shown.length-1])+'</b></span>'+(pgT?'<span> '+pgT+'</span>':'');
  return {crumb,crumbHtml,slots,pages:pg.pages,page:pg.page};}
function smEsc(t){return String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function smSlotHtml(s,ix,foc,cls){const ch=s.kind==='sub'||s.kind==='more'?'›':(s.stay?'↺':'');
  return '<button class="'+cls+(s.kind==='back'?' back':'')+(s.disabled?' dis':'')+(ix===foc?' foc':'')+'" data-s="'+ix+'" role="menuitem"'
   +(s.disabled?' aria-disabled="true"':'')+' aria-label="'+String(ix+1).padStart(2,'0')+' '+smEsc(s.n)+'" style="--d:'+ix+'">'
   +'<span class="smIx">'+String(ix+1).padStart(2,'0')+'</span><span class="smIc">'+smEsc(s.i)+'</span>'
   +'<span class="smLb"><span class="smT">'+smEsc(s.n)+'</span>'+(s.line2?'<small>'+smEsc(s.line2)+'</small>':'')+'</span><span class="smCh">'+ch+'</span></button>';}
function smRender(){const el=document.getElementById('smMenu');if(!el)return;
  if(!SM.open){if(SM.menuLast!==''){el.innerHTML='';SM.menuLast='';}el.removeAttribute('role');SM.slots=[];return;}
  const v=(SM.q!=null&&typeof smSearchView==='function')?smSearchView():smView();SM.slots=v.slots;
  const top=smTop();const foc=top?Math.min(top.focus|0,v.slots.length-1):0;if(top)top.focus=foc;
  const html='<div class="smCrumb">'+(v.crumbHtml||smEsc(v.crumb))+'</div><div class="smCol">'+v.slots.map((s,i)=>smSlotHtml(s,i,foc,'smI')).join('')+'</div>';
  if(html!==SM.menuLast){el.innerHTML=html;SM.menuLast=html;}
  el.setAttribute('role','menu');}
// motion hooks (classes only; S6 styles them). jsdom and reduced motion → instant.
function smMotion(){try{return typeof matchMedia==='function'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){return false;}}
function smReplace(fn,dir){const el=document.getElementById('smMenu');const anim=el&&smMotion();
  let ghost=null;if(anim){const old=el.querySelector('.smCol');if(old){ghost=old.cloneNode(true);ghost.className='smCol smGhost sm-out'+(dir<0?' back':'');
    ghost.querySelectorAll('.smI').forEach(b=>{b.className=b.className.replace(/\bsmI\b/,'smIg');});}}
  fn();smRender();
  if(anim){clearTimeout(SM.anim);el.querySelectorAll('.smGhost').forEach(g=>g.remove());
    if(ghost)el.appendChild(ghost);el.querySelectorAll('.smCol:not(.smGhost)').forEach(c=>c.classList.add('sm-in'));if(dir<0)el.classList.add('sm-back');else el.classList.remove('sm-back');
    SM.anim=setTimeout(()=>{el.querySelectorAll('.smGhost').forEach(g=>g.remove());el.querySelectorAll('.sm-in').forEach(c=>c.classList.remove('sm-in'));},200);}}
function smOpen(mode){SM.open=true;SM.q=null;SM.stack=[{node:SM_TREE,page:0,focus:0}];
  if(mode==='search'){SM.wasBrowse=false;smSearchStart('');}
  smReplace(()=>{},1);smDialDraw();}
function smClose(){if(!SM.open&&!SM.stack.length)return;SM.open=false;SM.q=null;SM.stack=[];smRender();smDialDraw();}
function smBack(){const top=smTop();if(!top)return smClose();
  if(top.page>0){smReplace(()=>{top.page--;top.focus=3;},-1);return true;}
  if(SM.stack.length>1){smReplace(()=>{SM.stack.pop();},-1);return true;}
  smClose();return true;}
function smRun(s){if(s.a)return runAction(s.a);if(s.leaf&&typeof s.leaf.fn==='function'){s.leaf.fn();return true;}return false;}
function smActivate(slot){if(typeof slot==='number')slot=SM.slots[slot];if(!slot||slot.disabled)return false;
  if(slot.kind==='sub'){if(SM.q!=null)SM.q=null;smReplace(()=>{SM.stack.push({node:slot.sub,page:0,focus:0});},1);return true;}
  if(slot.kind==='more'){const top=smTop();smReplace(()=>{top.page++;top.focus=0;},1);return true;}
  if(slot.kind==='back'){if(slot.search){smSearchEnd();return true;}return smBack();}
  if(slot.stay){smRun(slot);SM.menuLast=null;smRender();smDialDraw();return true;}
  smClose();smRun(slot);if(typeof smDialDraw==='function')smDialDraw();return true;}
function smFocus(i){const top=smTop();if(!top||!SM.slots.length)return;const n=SM.slots.length;top.focus=((i%n)+n)%n;smRender();}

// keys: capture on WINDOW (it runs before 05c's document-capture shortcut handler, which would otherwise fire an action
// bound to the same key first), only while the menu is open; mod+ combos other than mod+k pass through
window.addEventListener('keydown',e=>{
  if(!(smOn()&&SM.open))return;
  const k=e.key||'';const mod=e.ctrlKey||e.metaKey;
  if(mod)return;                                          // Ctrl+K has its own listener below; the rest reach the app
  if(typeof smSearchKey==='function'&&smSearchKey(e)){e.preventDefault();e.stopImmediatePropagation();return;}
  const top=smTop();let done=true;
  if(k==='ArrowDown')smFocus((top?top.focus:0)+1);
  else if(k==='ArrowUp')smFocus((top?top.focus:0)-1);
  else if(k==='Enter'||k==='ArrowRight')smActivate(top?top.focus:0);
  else if(k==='ArrowLeft'||k==='Backspace'||k==='Escape')smBack();
  else if(/^[1-5]$/.test(k)&&!e.altKey)smActivate(+k-1);
  else done=false;
  if(done){e.preventDefault();e.stopImmediatePropagation();}
},true);

// ---- S4: search (the ⌘K half) — the same scoring as the palette (05c paletteScore), never a second one ----
function smSearchIndex(){const out=[],have=new Set();
  const walk=(node,path)=>{const kids=node.gen?((node.gen==='rules'||node.gen==='endpoints')?smChildren(node):[]):(node.items||[]);
    kids.forEach(c=>{if(c.items||c.gen)walk(c,path.concat([c.n]));else if(c.a&&!have.has(c.a)){have.add(c.a);out.push(Object.assign({},c,{path:path.join(' / ')}));}});};
  walk(SM_TREE,[]);
  ACTIONS.forEach(a=>{if(!have.has(a.id)){have.add(a.id);out.push({a:a.id,kind:'action',path:a.group||''});}});
  return out;}
function smSearch(q,idx){idx=idx||smSearchIndex();                   // a bare call (tests, other callers) builds a fresh indexconst ctx=actionCtx();
  return idx.map(e=>{const a=e.a?actionById(e.a):null;const n=e.n||(a&&a.label)||'';let sc=paletteScore(q,n);
      if(!(sc>0)){const s2=paletteScore(q,n+' '+((a&&a.label)||'')+' '+((a&&a.alias)||'')+' '+e.path);sc=s2>0?s2-500:0;}
      return {e,n,sc,en:a?actionEnabled(a,ctx):!e.disabled};})
    .filter(r=>r.sc>0)
    .sort((x,y)=>(y.en-x.en)||(y.sc-x.sc)||x.n.localeCompare(y.n,'hu-HU'))
    .map(r=>r.e);}
function smSearchStart(q){SM.q=q||'';SM.idx=smSearchIndex();SM.res=smSearch(SM.q,SM.idx);SM.win=0;const top=smTop();if(top)top.focus=0;SM.menuLast=null;smRender();smDialDraw();}
function smSearchSet(q){SM.q=q;SM.res=smSearch(q,SM.idx);SM.win=0;const top=smTop();if(top)top.focus=0;smRender();}
function smSearchEnd(){SM.q=null;SM.res=null;SM.menuLast=null;smRender();smDialDraw();}
function smSearchView(){const res=SM.res||[];const win=Math.max(0,Math.min(SM.win|0,Math.max(0,res.length-4)));SM.win=win;
  const slots=res.slice(win,win+4).map(e=>{const s=smLeafSlot(e);s.line2=s.disabled&&/^hiányzó/.test(s.line2)?s.line2:e.path;return s;});
  if(!res.length)slots.push({kind:'leaf',n:'Nincs találat',i:'∅',disabled:true,line2:''});
  slots.push({kind:'back',search:true,n:'Vissza',i:'◂',disabled:false,line2:''});
  const n=Math.min(4,res.length);
  return {slots,crumbHtml:'<span class="smSq">⌕ '+smEsc(SM.q)+'<span class="smCaret">▏</span></span><span class="smCount">'+(res.length?(win+1)+'–'+(win+n)+' / '+res.length:'0 / 0')+'</span>'};}
// true = handled. Browsing: a printable key starts a search. Searching: type, Backspace, Esc/←, ↑/↓ with a scrolling window.
function smSearchKey(e){const k=e.key||'';const pr=k.length===1&&k!==' '&&!e.altKey;
  if(SM.q==null){if(pr&&!/^[1-5]$/.test(k)){SM.wasBrowse=true;smSearchStart(k);return true;}return false;}
  const top=smTop();const n=Math.min(4,(SM.res||[]).length);
  if(pr){smSearchSet(SM.q+k);return true;}
  if(k==='Backspace'){if(SM.q==='')smSearchEnd();else{const q=SM.q.slice(0,-1);if(q===''&&SM.wasBrowse)smSearchEnd();else smSearchSet(q);}return true;}
  if(k==='Escape'||k==='ArrowLeft'){smSearchEnd();return true;}
  if(k==='ArrowDown'){if(top.focus<n-1)top.focus++;else if(top.focus===n-1&&SM.win+4<(SM.res||[]).length)SM.win++;else top.focus=(top.focus+1)%(n+1);smRender();return true;}
  if(k==='ArrowUp'){if(top.focus>0)top.focus--;else if(SM.win>0)SM.win--;smRender();return true;}
  return false;}
// Ctrl+K / ⌘K in simple mode opens the menu in search; the palette (05c) stays a normal-mode thing
window.addEventListener('keydown',e=>{if(!smOn())return;if(!((e.ctrlKey||e.metaKey)&&(e.key||'').toLowerCase()==='k'))return;
  e.preventDefault();e.stopImmediatePropagation();if(!SM.open)smOpen('search');else{SM.wasBrowse=false;smSearchStart('');}},true);

// mouse: delegation on #smMenu; a press on the canvas while open closes the menu and is consumed
(function smMenuBind(){const el=document.getElementById('smMenu');if(!el)return;
  el.addEventListener('pointerdown',e=>e.stopPropagation());
  el.addEventListener('click',e=>{const b=e.target&&e.target.closest&&e.target.closest('.smI');if(!b)return;e.stopPropagation();smActivate(+b.dataset.s);});
  el.addEventListener('mouseover',e=>{const b=e.target&&e.target.closest&&e.target.closest('.smI');if(!b)return;const top=smTop();
    if(top&&top.focus!==+b.dataset.s)smFocus(+b.dataset.s);});})();
document.addEventListener('pointerdown',e=>{if(!(smOn()&&SM.open))return;const t=e.target;if(!(t&&t.closest&&t.closest('#stage')))return;
  e.stopPropagation();e.stopImmediatePropagation();e.preventDefault();SM.eatClick=true;smClose();},true);
document.addEventListener('click',e=>{if(!SM.eatClick)return;SM.eatClick=false;const t=e.target;if(!(t&&t.closest&&t.closest('#stage')))return;e.stopPropagation();e.stopImmediatePropagation();e.preventDefault();},true);

// S6 — the look (Zion-inspired: pale, cool, glassy operator panels; drawn from the design §7 tokens, matches mock/sm-mock.html)
(function smMenuCss(){if(document.getElementById('smMenuCss'))return;const s=document.createElement('style');s.id='smMenuCss';s.textContent=[
 // tokens — design §7 verbatim
 'body.ui-simple{--sm-glass:rgba(214,224,232,.80);--sm-glass-hi:rgba(234,241,247,.94);--sm-glass-back:rgba(196,208,219,.86);',
 '--sm-edge-hi:rgba(255,255,255,.90);--sm-edge-lo:rgba(110,130,150,.45);--sm-ink:#1c2833;--sm-ink-dim:#5b6d7e;--sm-accent:#3a8ac4;',
 '--sm-glow:0 0 0 1px rgba(255,255,255,.55),0 0 16px rgba(130,185,228,.45);--sm-warn:#c0530f;',
 '--sm-scan:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);',
 '--sm-font:"Bahnschrift SemiCondensed","Bahnschrift","Segoe UI",sans-serif;--sm-num:"Cascadia Mono","Consolas",monospace}',
 // column
 '#smMenu{position:absolute;left:20px;bottom:100px;width:248px;z-index:31;font-family:var(--sm-font)}body.sm-right #smMenu{left:auto;right:20px}',
 '#smMenu .smCol{display:flex;flex-direction:column;gap:6px;position:relative}#smMenu .smGhost{position:absolute;left:0;right:0;bottom:0;pointer-events:none}',
 '#smMenu .smCrumb{height:18px;margin-bottom:6px;padding:0 2px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--sm-ink-dim);',
 'display:flex;align-items:flex-end;justify-content:space-between;gap:8px;white-space:nowrap;overflow:hidden}',
 '#smMenu .smCrumb b{color:var(--sm-ink);font-weight:600}',
 '#stage.prev~#smRoot .smCrumb{color:#9fb0c0}#stage.prev~#smRoot .smCrumb b,#stage.prev~#smRoot .smSq{color:#dfe8ef}',   // the dark Ügyfél-előnézet canvas (mock: .dark .crumb)
 '#smMenu .smSq{font-size:13px;letter-spacing:.06em;text-transform:none;color:var(--sm-ink)}#smMenu .smCount{color:var(--sm-ink-dim)}',
 '#smMenu .smCaret{animation:smBlink 1s step-end infinite}@keyframes smBlink{50%{opacity:0}}',
 // item
 '#smMenu .smI{position:relative;box-sizing:border-box;width:100%;height:48px;display:flex;align-items:center;gap:10px;padding:0 12px 0 14px;margin:0;',
 'text-align:left;cursor:pointer;font-family:var(--sm-font);color:var(--sm-ink);border-radius:2px;',
 'background:var(--sm-scan),var(--sm-glass);backdrop-filter:blur(6px) saturate(1.1);-webkit-backdrop-filter:blur(6px) saturate(1.1);',
 'border:1px solid;border-color:var(--sm-edge-hi) var(--sm-edge-lo) var(--sm-edge-lo) var(--sm-edge-hi);transition:border-color 80ms}',
 '#smMenu .smIx{font:11px var(--sm-num);color:var(--sm-ink-dim);width:18px;flex:none}',
 '#smMenu .smIc{font-size:16px;width:20px;text-align:center;flex:none;filter:grayscale(1) brightness(.4) contrast(1.3)}',
 '#smMenu .smLb{flex:1;min-width:0;font-size:14px;letter-spacing:.08em;text-transform:uppercase;line-height:1.25;display:flex;flex-direction:column}  /* no overflow:hidden: it clipped É Ü above the caps */',
 '#smMenu .smT{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-top:2px}',
 '#smMenu .smLb small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10.5px;letter-spacing:.02em;text-transform:none;color:var(--sm-ink-dim)}',
 '#smMenu .smCh{color:var(--sm-ink-dim);font-size:15px;flex:none}',
 '#smMenu .smI.foc{background:var(--sm-scan),var(--sm-glass-hi);box-shadow:var(--sm-glow)}',
 '#smMenu .smI.foc::before{content:"";position:absolute;left:-1px;top:-1px;bottom:-1px;width:3px;background:var(--sm-accent)}',
 'body.sm-right #smMenu .smI.foc::before{left:auto;right:-1px}',
 '#smMenu .smI.back{background:var(--sm-scan),var(--sm-glass-back)}',
 '#smMenu .smI.dis{cursor:default}#smMenu .smI.dis>*{opacity:.45}',
 '#smMenu .smI:active:not(.dis){border-color:var(--sm-edge-lo) var(--sm-edge-hi) var(--sm-edge-hi) var(--sm-edge-lo)}',
 // motion — design §6
 '#smMenu .smCol.sm-out .smIg{transition:transform 90ms,opacity 90ms;transition-delay:calc(var(--d)*20ms);transform:translateX(-8px);opacity:0}',
 '#smMenu .smCol.sm-out.back .smIg{transform:translateX(8px)}',
 '#smMenu .smCol.sm-in .smI{animation:smIn 140ms both;animation-delay:calc((4 - var(--d))*25ms)}',
 '#smMenu.sm-back .smCol.sm-in .smI{animation-name:smInBack}',
 '@keyframes smIn{from{transform:translateY(10px);opacity:0}}@keyframes smInBack{from{transform:translateX(-10px);opacity:0}}',
 // dial — design §7 Dial
 '#smDial .smQ{fill:var(--sm-glass);stroke:var(--sm-edge-lo);stroke-width:2}#smDial .smR1{fill:none;stroke:var(--sm-edge-lo);stroke-width:2}',
 '#smDial .smR2{fill:none;stroke:var(--sm-edge-lo);stroke-width:1}#smDial .smCore{fill:var(--sm-glass-hi);stroke:var(--sm-edge-hi);stroke-width:1}',
 '#smDial .smTk{stroke:var(--sm-ink-dim);stroke-opacity:.5;stroke-width:1.2}',
 '#smDial .smDp{fill:none;stroke:var(--sm-edge-lo);stroke-width:5;stroke-opacity:.6}#smDial .smDp.on{stroke:var(--sm-accent);stroke-opacity:1}',
 '#smDial .smGl{font:20px var(--sm-font);fill:var(--sm-ink)}#smDial .smWarn{font:bold 11px var(--sm-font);fill:var(--sm-warn)}',
 '#smDial.tool .smQ,#smDial.tool .smR1{stroke:var(--sm-accent)}#smDial.tool .smQ{filter:drop-shadow(0 0 6px rgba(130,185,228,.8))}',
 '#smDial:focus{outline:none}#smDial:focus-visible .smQ{stroke:var(--sm-accent)}',
 // hint pill (S5 fills it)
 '#smHint{position:absolute;left:100px;bottom:14px;max-width:min(560px,60vw);height:30px;line-height:30px;padding:0 12px;box-sizing:border-box;z-index:30;',
 'font:12.5px var(--sm-font);color:var(--sm-ink);background:var(--sm-glass);border:1px solid;border-radius:2px;',
 'border-color:var(--sm-edge-hi) var(--sm-edge-lo) var(--sm-edge-lo) var(--sm-edge-hi);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
 'opacity:0;transition:opacity 200ms;pointer-events:none}#smHint.on{opacity:1}#smHint:empty{display:none}body.sm-right #smHint{left:auto;right:100px}',
 '@media (prefers-reduced-motion:reduce){#smMenu *,#smHint{transition:none!important;animation:none!important}}'].join('');
 document.head.appendChild(s);})();

// S1's smToggle delegates here once this module has loaded (11s keeps the name, contract: the dial calls smToggle)
window.smUseTree=smUseTree;window.smChildren=smChildren;window.smPage=smPage;window.smView=smView;window.smOpen=smOpen;
window.smClose=smClose;window.smActivate=smActivate;window.smBack=smBack;window.SM_GEN=SM_GEN;window.smSearch=smSearch;window.smSearchIndex=smSearchIndex;
