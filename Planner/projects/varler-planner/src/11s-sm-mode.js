// ==========================================================================
// 11s-sm-mode.js — Egyszerű felület (Simplified UI, docs/simple-ui): the mode switch, the dial, tool feedback
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// Mode = a viewer preference (localStorage 'villanyterv_ui'), never project data: nothing here writes data.* or state.*.
// ==========================================================================

// S0 — the module object. Later WPs add fields here, never new top-level lets.
const SM={on:false,open:false,stack:[],q:null,focus:0};
function smOn(){return SM.on;}
function smSet(on,opt){on=!!on;opt=opt||{};if(on===SM.on)return;SM.on=on;
  document.body.classList.toggle('ui-simple',on);
  if(opt.save!==false){try{localStorage.setItem('villanyterv_ui',on?'simple':'normal');}catch(_){}}
  if(on){if(typeof paletteIsOpen==='function'&&paletteIsOpen())paletteClose();const c=document.getElementById('ctx');if(c)c.style.display='none';}
  else if(typeof smClose==='function')smClose();
  if(typeof smDialDraw==='function')smDialDraw();
  if(opt.quiet)return;                                   // boot: 12-boot draws once the workspace is restored
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{setTransform();draw();});
  draw();
  const h=document.getElementById('hud');if(h)h.textContent=on?'Egyszerű felület — F2: vissza':'Normál felület';}

// S0 — chrome-hide CSS (contract §2.1). #ctx stays: the right-click menus must keep working in simple mode, and it is a
// child of .stage-wrap, so the child rule spares it by id. #modalBg, #gpCursor, #gpWheel and #rwWheel live outside.
(function smCssInject(){if(document.getElementById('smCss'))return;const s=document.createElement('style');s.id='smCss';
  s.textContent='body.ui-simple header,body.ui-simple .side,body.ui-simple .resizer,body.ui-simple #toolbarRow,'
   +'body.ui-simple .stage-wrap>:not(#stage):not(#smRoot):not(#ctx),'
   +'body.ui-simple #rbPanel,body.ui-simple #stdPanel,body.ui-simple #lpDock,body.ui-simple #lpQr,'
   +'body.ui-simple #expMenu,body.ui-simple #palette,body.ui-simple .ntP,body.ui-simple #vbkOpen,'
   +'body.ui-simple [data-chrome]{display:none!important}'
   +'#smRoot{display:none}body.ui-simple #smRoot{display:block}'
   +'#smDial{position:absolute;left:0;bottom:0;pointer-events:none;overflow:visible;z-index:30}body.sm-right #smDial{left:auto;right:0}'
   +'#smDial .smQ{pointer-events:visiblePainted;cursor:pointer;fill:#e3e9ee}#smDial text{pointer-events:none}';   // the look: 11t #smMenuCss (S6)
  document.head.appendChild(s);})();
(function smRootInject(){if(document.getElementById('smRoot'))return;const w=document.querySelector('.stage-wrap');if(!w)return;
  const r=document.createElement('div');r.id='smRoot';w.appendChild(r);})();
(function smBtnInject(){if(document.getElementById('smBtn'))return;const b=document.createElement('button');b.id='smBtn';
  b.title='Egyszerű felület: csak a rajz és a sarokmenü (F2)';b.textContent='◔ Egyszerű';b.onclick=()=>smSet(true);
  const after=document.getElementById('bPanels');
  if(after&&after.parentNode)after.parentNode.insertBefore(b,after.nextSibling);
  else{const h=document.querySelector('header');if(h)h.appendChild(b);}})();

registerActions([
  {id:'ui.simple',label:'Egyszerű felület',icon:'◔',group:'Nézet',keys:['f2'] /* SUI-Q S06 = B */,
   alias:'simple minimal zen egyszeru csak rajz',hint:'Csak a rajz és a sarokmenü. Ugyanez a billentyű visszavált.',
   when:c=>!c.inEditor,run:()=>smSet(!smOn())},
  {id:'ui.normal',label:'Normál felület',icon:'▣',group:'Nézet',when:()=>smOn(),run:()=>smSet(false)}
]);

// S0 — boot: ?ui=simple|normal wins for this page load (not saved), else the stored preference.
(function smBoot(){let v=null;try{const m=/[?&]ui=(simple|normal)\b/.exec(location.search||'');if(m)v=m[1];}catch(_){}
  if(!v){try{v=localStorage.getItem('villanyterv_ui');}catch(_){}}
  if(v==='simple')smSet(true,{save:false,quiet:true});})();


// S1 — the dial (tárcsa): a quarter circle whose centre is the window corner. SUI-Q S01 = A+C: bottom-left by default,
// bottom-right as a viewer setting (localStorage villanyterv_ui_side, body.sm-right); the geometry is mirrored, not flipped
// by CSS, so the glyph and the warning numeral stay readable.
SM.right=false;SM.dialLast=null;
function smDialSvg(st){st=st||{};const R=!!st.right,X=x=>R?(96-x):x,F=v=>(+v.toFixed(2)).toString();
  const P=(r,deg)=>{const a=deg*Math.PI/180;return [F(X(r*Math.sin(a))),F(96-r*Math.cos(a))];};
  const sw=R?0:1,arc=(r,a0,a1)=>{const p0=P(r,a0),p1=P(r,a1);return 'M'+p0[0]+','+p0[1]+' A'+r+','+r+' 0 0 '+sw+' '+p1[0]+','+p1[1];};
  let s='<path class="smQ" d="M'+X(0)+',96 L'+X(0)+',8 A88,88 0 0 '+sw+' '+X(88)+',96 Z"/>'
   +'<path class="smR1" d="'+arc(88,0,90)+'"/><path class="smR2" d="'+arc(64,0,90)+'"/>';
  for(let i=0;i<10;i++){const a=4.5+i*9,p=P(88,a),q=P(82,a);s+='<line class="smTk" x1="'+p[0]+'" y1="'+p[1]+'" x2="'+q[0]+'" y2="'+q[1]+'"/>';}
  for(let i=0;i<4;i++){const a0=1.25+i*22.5;s+='<path class="smDp'+(i<(st.depth||0)?' on':'')+'" d="'+arc(76,a0,a0+20)+'"/>';}
  s+='<path class="smCore" d="M'+X(0)+',96 L'+X(0)+',56 A40,40 0 0 '+sw+' '+X(40)+',96 Z"/>';
  const g=st.tool&&st.tool.icon?st.tool.icon:(st.search?'⌕':(st.open?'×':'≡'));
  s+='<text class="smGl" x="'+X(9)+'" y="88"'+(R?' text-anchor="end"':'')+'>'+esc(g)+'</text>';
  if(st.warn>0){const p=P(100,45);s+='<text class="smWarn" x="'+p[0]+'" y="'+p[1]+'" text-anchor="middle">'+(st.warn|0)+'</text>';}
  return s;}
function smDialState(){return {open:SM.open,depth:SM.stack.length,tool:null,warn:0,right:SM.right,search:SM.open&&SM.q!=null};}
function smDialDraw(){const el=document.getElementById('smDial');if(!el)return;const str=smDialSvg(smDialState());
  if(str!==SM.dialLast){el.innerHTML=str;SM.dialLast=str;}
  el.setAttribute('aria-expanded',SM.open?'true':'false');el.classList.toggle('tool',!!smDialState().tool);}
function smToggle(){if(typeof smOpen==='function'){if(SM.open)smClose();else smOpen('browse');return;}SM.open=!SM.open;smDialDraw();} // S2: 11t owns open/close
function smSide(right){SM.right=right==null?!SM.right:!!right;document.body.classList.toggle('sm-right',SM.right);
  try{localStorage.setItem('villanyterv_ui_side',SM.right?'right':'left');}catch(_){}
  SM.dialLast=null;smDialDraw();return SM.right;}
(function smDialBuild(){const r=document.getElementById('smRoot');if(!r||document.getElementById('smDial'))return;
  try{SM.right=localStorage.getItem('villanyterv_ui_side')==='right';}catch(_){}
  document.body.classList.toggle('sm-right',SM.right);
  r.insertAdjacentHTML('beforeend','<svg id="smDial" width="96" height="96" viewBox="0 0 96 96" tabindex="0" role="button" aria-haspopup="menu" aria-expanded="false" aria-label="Menü"></svg><div id="smMenu"></div><div id="smHint"></div>');
  const d=document.getElementById('smDial');
  d.addEventListener('pointerdown',e=>{e.stopPropagation();});
  d.addEventListener('pointerup',e=>{if(e.target&&e.target.classList&&e.target.closest('#smDial')){e.stopPropagation();e.preventDefault();smToggle();}});
  d.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();smToggle();}});
  smDialDraw();})();

// test hooks
window.smOn=smOn;window.smSet=smSet;window.__SM=SM;window.smDialSvg=smDialSvg;window.smDialDraw=smDialDraw;window.smToggle=smToggle;window.smSide=smSide;
