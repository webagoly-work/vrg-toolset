// ==========================================================================
// 08b-gamepad.js — Varler Planner
// Standard USB controller (Xbox) control scheme.
//
// WHERE THIS GOES: src/08b-gamepad.js. Sorts after 08-interaction.js and
// before 09-menus.js — build.js accepts NNx-style names, so nothing needs
// renumbering.
//
// ── WHAT IT TALKS TO ────────────────────────────────────────────────────
// Only two adapters, both at the bottom of 08-interaction.js:
//   window.PLANNER_CAM   — camera + history (shared with the phone gyro)
//   window.PLANNER_INPUT — pointer, keyboard and readout verbs
// It never reaches into another module's internals. That is the same rule
// 07b-phone-camera.js follows, and with one shared scope it is what keeps a
// feature this size from colliding with something it has never heard of.
// Everything here lives inside this IIFE; the only globals it creates are
// window.PLANNER_GP and window.__gp (test hook).
//
// ── THE SCHEME ──────────────────────────────────────────────────────────
// Modelled on Tropico 5, which got three things right:
//   1. the camera layer is never modal — the sticks mean the same thing on
//      every screen, so you never have to ask what they do right now;
//   2. an always-visible button legend that changes with context — this is
//      most of why it is quick to pick up;
//   3. nothing is deeper than two presses.
//
// The map is anchored on one honest rule: THE D-PAD IS THE ARROW KEYS.
// In this app the arrows already mean "step the drawing height" and "cycle
// the place palette", which are the two most-repeated operations there are.
//
//   L-stick   cursor (or pans the world — see THE CURSOR BOX below)
//   R-stick   yaw / pitch, pivoting at the cursor
//   LT / RT   zoom out / in, analog
//   A         primary click — press = pointerdown, release = pointerup, so
//             click, drag and gizmo-drag all come for free
//   B         Esc (steps out one level; never discards — see ARCHITECTURE)
//   X         context menu, or drop the place-palette item while drawing
//   Y         the action wheel
//   LB / RB   undo / redo
//   D-pad     the arrow keys
//   LS click  hold for fine mode (the Alt equivalent)
//   RS click  recentre the pivot
//   Start     the palette      Back  the legend
//
// ── THE CURSOR BOX ──────────────────────────────────────────────────────
// Free cursor and fixed reticle are ONE mechanism with one parameter. The
// cursor roams inside a box centred on the stage; pushing past the edge
// drags the camera instead. A box of 0 collapses to a reticle locked at
// screen centre with the world moving under it. So:
//   select / grab / format  → box 0.55, a free cursor (you are picking
//                             things that are already on screen)
//   every drawing mode      → box 0, a locked reticle (you are placing, and
//                             a fixed aim point with a moving world is both
//                             steadier and what Tropico's build mode did)
// One code path, one number per mode, both exposed as settings.
//
// ── PRECISION ───────────────────────────────────────────────────────────
// A thumbstick cannot hit a millimetre and does not have to: cableSnap()
// and wallPointSnap() already snap to walls, nodes and standard heights.
// The controller only has to get close. On top of that, STICKY TARGETING:
// if A is pressed with nothing directly under the reticle, a ring of sample
// points around it is hit-tested and the nearest target is clicked instead.
// It runs on press, not per frame, so it costs nothing while you are just
// moving around; a low-rate scan tints the reticle when a target is in
// reach, so you can see the stickiness before you commit to it.
// ==========================================================================

(function(){
  'use strict';

  const LS='villanyterv_gamepad';          // device-level, NOT project state:
  // sessionObj() serialises the whole `state` object into every saved
  // project, and "this PC has a controller plugged in" has no business
  // travelling inside a client's plan file. So the config lives on its own.

  const DEF={
    on:false,
    dead:0.16,          // radial dead zone (radial, not per-axis — a per-axis
                        // dead zone is what makes slow diagonals impossible)
    curve:2,            // response exponent: precision near centre, speed at the rim
    cursorSpeed:900,    // px/s at full deflection
    panSpeed:950,       // px/s at full deflection when the cursor is boxed
    yawSpeed:135,       // deg/s
    pitchSpeed:80,      // deg/s
    zoomRate:3.2,       // zoom multiplier per second at full trigger
    invertY:false,
    sticky:52,          // sticky-targeting radius in px (0 = off)
    rumble:true,
    legend:true,
    wheel:'auto',       // 'auto' = generated from the action registry
                        // 'curated' = fixed top ring, generated sub-rings
    boxFree:0.55,       // cursor box in select/grab/format
    boxDraw:0           // cursor box while drawing — 0 = locked centre reticle
  };

  let GP=Object.assign({},DEF);
  let raf=null,lastT=0,pad=null,padIx=null;
  let cx=null,cy=null;                     // virtual cursor, in client px
  let prevBtn=[],rep={};                   // edge detection + auto-repeat timers
  let wheel=null;                          // {level, sectors, pick, sub, subPick, opened}
  let legendKey='',stickyHit=false,scanT=0,lastMode=null;
  let warned=false;

  // standard gamepad mapping (Xbox layout)
  const BT={A:0,B:1,X:2,Y:3,LB:4,RB:5,LT:6,RT:7,BACK:8,START:9,LS:10,RS:11,
            DU:12,DD:13,DL:14,DR:15};
  const FREE_MODES=['select','grab','format'];
  const REPEAT_DELAY=0.34,REPEAT_RATE=0.11;   // seconds

  function CAM(){return window.PLANNER_CAM||null;}
  function IN(){return window.PLANNER_INPUT||null;}
  function el(id){return document.getElementById(id);}

  // ---- config ------------------------------------------------------------
  function load(){
    try{const raw=localStorage.getItem(LS);if(raw)GP=Object.assign({},DEF,JSON.parse(raw));}
    catch(_){GP=Object.assign({},DEF);}
    return GP;}
  function save(){try{localStorage.setItem(LS,JSON.stringify(GP));}catch(_){}}

  // ---- stick maths -------------------------------------------------------
  // Radial dead zone, then a curve, then rescale so the usable range still
  // reaches 1.0 — otherwise the dead zone quietly costs you top speed.
  function stick(pd,ax,ay){
    if(!pd||!pd.axes)return [0,0];
    let x=pd.axes[ax]||0,y=pd.axes[ay]||0;
    const m=Math.hypot(x,y);
    const d=Math.max(0,Math.min(0.9,GP.dead||0));   // set() is public: never divide by zero
    if(m<d)return [0,0];
    const t=Math.min(1,(m-d)/(1-d));
    const s=Math.pow(t,GP.curve)/m;
    return [x*s,y*s];}

  function btn(pd,i){
    if(!pd||!pd.buttons||!pd.buttons[i])return 0;
    const b=pd.buttons[i];
    if(typeof b==='number')return b;
    return b.pressed?(b.value!=null?b.value:1):(b.value||0);}
  function down(pd,i){return btn(pd,i)>0.5;}

  function edge(pd,i){return down(pd,i)&&!prevBtn[i];}
  function lift(pd,i){return !down(pd,i)&&prevBtn[i];}

  // auto-repeat: fires once on press, then at REPEAT_RATE after REPEAT_DELAY
  function repeat(pd,i,dt){
    if(!down(pd,i)){delete rep[i];return false;}
    if(rep[i]==null){rep[i]=-REPEAT_DELAY;return true;}   // fires on press
    rep[i]+=dt;
    if(rep[i]>=0){rep[i]=-REPEAT_RATE;return true;}
    return false;}

  function rumble(ms,strong,weak){
    if(!GP.rumble||!pad)return;
    const a=pad.vibrationActuator;
    if(!a||typeof a.playEffect!=='function')return;
    try{a.playEffect('dual-rumble',{duration:ms,strongMagnitude:strong,weakMagnitude:weak||0});}catch(_){}}

  // ---- the pad ------------------------------------------------------------
  function readPad(){
    if(typeof navigator==='undefined'||typeof navigator.getGamepads!=='function')return null;
    let list;try{list=navigator.getGamepads();}catch(_){return null;}
    if(!list)return null;
    if(padIx!=null&&list[padIx]&&list[padIx].connected)return list[padIx];
    for(let i=0;i<list.length;i++){
      if(list[i]&&list[i].connected){padIx=i;return list[i];}}
    padIx=null;return null;}

  // ---- the cursor ---------------------------------------------------------
  function boxFor(mode){
    return FREE_MODES.indexOf(mode)>=0?Math.max(0,Math.min(1,GP.boxFree))
                                      :Math.max(0,Math.min(1,GP.boxDraw));}

  function centreOn(rect){cx=rect.left+rect.width/2;cy=rect.top+rect.height/2;}

  function moveCursor(rect,lx,ly,dt,C){
    const box=boxFor(IN().mode());
    const ccx=rect.left+rect.width/2,ccy=rect.top+rect.height/2;
    if(box<=0){                                   // locked reticle, world moves
      cx=ccx;cy=ccy;
      if(lx||ly)C.panBy(-lx*GP.panSpeed*dt,-ly*GP.panSpeed*dt);
      return !!(lx||ly);}
    if(cx==null)centreOn(rect);
    const hw=rect.width*box/2,hh=rect.height*box/2;
    let nx=cx+lx*GP.cursorSpeed*dt,ny=cy+ly*GP.cursorSpeed*dt,ox=0,oy=0;
    if(nx<ccx-hw){ox=nx-(ccx-hw);nx=ccx-hw;}
    else if(nx>ccx+hw){ox=nx-(ccx+hw);nx=ccx+hw;}
    if(ny<ccy-hh){oy=ny-(ccy-hh);ny=ccy-hh;}
    else if(ny>ccy+hh){oy=ny-(ccy+hh);ny=ccy+hh;}
    if(ox||oy)C.panBy(-ox,-oy);                   // edge push = camera drag
    const moved=(nx!==cx||ny!==cy||ox||oy);
    cx=nx;cy=ny;
    return !!moved;}

  // Sticky targeting. Returns the point to click: the cursor itself when
  // something is already under it, otherwise the nearest sample on a ring
  // that does hit. Cheap because it only runs on press.
  function aim(x,y){
    const I=IN();
    if(!I||GP.sticky<=0)return [x,y];
    if(I.hitAt(x,y))return [x,y];
    for(let r=GP.sticky*0.5;r<=GP.sticky;r+=GP.sticky*0.5){
      for(let a=0;a<8;a++){
        const t=a*Math.PI/4,px=x+Math.cos(t)*r,py=y+Math.sin(t)*r;
        if(I.hitAt(px,py))return [px,py];}}
    return [x,y];}

  function scanSticky(x,y){
    const I=IN();
    if(!I||GP.sticky<=0){stickyHit=false;return;}
    const p=aim(x,y);
    stickyHit=(p[0]!==x||p[1]!==y)||!!I.hitAt(x,y);}

  // ==========================================================================
  // the action wheel
  // ==========================================================================
  // Built from the action registry, like the palette and the inspector — a new
  // action turns up here the moment it is registered, with nothing to maintain.
  //
  // TWO RULES SHAPE IT, and they pull in opposite directions:
  //
  //  1. THE TOP RING IS FIXED. Muscle memory is most of what makes a controller
  //     fast, and it needs the same sector in the same place every time. So the
  //     eight top sectors come from every registered group in a canonical order
  //     and do NOT change with context. Seven named groups plus Egyéb, which
  //     carries the rest.
  //  2. UNAVAILABLE ACTIONS ARE DIMMED, NOT HIDDEN — the registry's own rule
  //     (see docs/ARCHITECTURE.md: hiding them is how a tool becomes folklore).
  //     A sub-ring shows everything in its group; the ones you cannot run right
  //     now are greyed, and pressing A on one tells you what it needs instead of
  //     silently doing nothing.
  //
  // Sector 0 is straight up and they run clockwise, like every radial menu
  // anyone has used before.
  const GROUP_ORDER=['Eszköz','Készülék','Rajz','Véset','Helyiség','Nézet','Szerkesztés',
                     'Dokumentáció','Projekt','Fal','Nyílászáró','Szint','Jegyzet',
                     'Ellenőrzés','Szerkesztő','Súgó'];
  const GROUP_ICON={'Eszköz':'✥','Rajz':'✎','Készülék':'◈','Véset':'〰','Fal':'▤',
    'Nyílászáró':'🚪','Helyiség':'🏷','Szint':'▦','Nézet':'👁','Szerkesztés':'↺',
    'Jegyzet':'📌','Dokumentáció':'📄','Ellenőrzés':'✔','Projekt':'💾','Szerkesztő':'🛠',
    'Súgó':'?','Egyéb':'…'};
  const TOP=7;          // named sectors; the eighth is always Egyéb
  const SUBMAX=12;      // a ring of narrow slivers is worse than a short list
  // Eight sectors times twelve is not every action, and is not meant to be:
  // the wheel is the SPEED surface, ⌘K (Start) is the complete one. Every
  // action is still ASSIGNED to a sector — sum(sector.full) === ACTIONS.length
  // — so nothing is ever silently unclassified; a full ring says how many it
  // is not showing and where to find them.

  // 'curated' keeps the top ring at a deliberate eight, merging the small
  // groups. The sub-rings are still generated.
  const CURATED=[
    {n:'Eszköz',      icon:'✥', groups:['Eszköz']},
    {n:'Készülék',    icon:'◈', groups:['Készülék']},
    {n:'Rajz',        icon:'✎', groups:['Rajz','Jegyzet']},
    {n:'Pálya',       icon:'〰', groups:['Véset']},
    {n:'Épület',      icon:'▤', groups:['Fal','Nyílászáró','Szint']},
    {n:'Helyiség',    icon:'🏷', groups:['Helyiség']},
    {n:'Nézet',       icon:'👁', groups:['Nézet','Szerkesztés']},
    {n:'Dokumentum',  icon:'📄', groups:['Dokumentáció','Ellenőrzés','Projekt','Súgó']}
  ];

  function allActions(){
    const A=window.ACTIONS;
    return (A&&A.length)?A.slice():[];}

  // which ids can actually run right now — the registry already answers this,
  // so the wheel never re-implements a `when()` gate.
  function liveIds(){
    const set=Object.create(null);
    try{(window.actionsFor?window.actionsFor():[]).forEach(a=>{set[a.id]=1;});}catch(_){}
    return set;}

  // registry entry -> a wheel item. A wrapper, not the entry itself: marking
  // availability on the shared action object would leak this surface's state
  // into every other consumer of the registry.
  function item(a,live){
    return {id:a.id,label:a.label||a.id,icon:a.icon||'•',hint:a.hint||'',
            need:a.need||'Most nem érhető el.',dis:!live[a.id]};}

  function groupRank(g){const i=GROUP_ORDER.indexOf(g);return i<0?99:i;}

  function ringFor(list,live){
    const all=list.slice()
      .sort((x,y)=>groupRank(x.group)-groupRank(y.group))
      .map(a=>item(a,live));
    if(all.length<=SUBMAX)return all;
    // Overflowing. Never drop an action you COULD run in favour of one you
    // can't: fill from the runnable ones first, top up with the rest, then put
    // the survivors back in canonical order so positions stay predictable.
    const keep=all.filter(x=>!x.dis).slice(0,SUBMAX);
    for(let i=0;i<all.length&&keep.length<SUBMAX;i++)if(all[i].dis)keep.push(all[i]);
    return all.filter(x=>keep.indexOf(x)>=0);}

  function buildSectors(){
    const all=allActions();
    if(!all.length)return [];
    const live=liveIds();
    const by={};
    all.forEach(a=>{const g=a.group||'Egyéb';(by[g]=by[g]||[]).push(a);});

    if(GP.wheel==='curated'){
      // A curated ring names the groups it wants, which means a group added
      // later would silently become unreachable. So anything unclaimed lands
      // in the last sector rather than nowhere.
      const claimed={};CURATED.forEach(c=>c.groups.forEach(g=>{claimed[g]=1;}));
      const orphan=[];
      Object.keys(by).forEach(g=>{if(!claimed[g])orphan.push.apply(orphan,by[g]);});
      const out=CURATED.map((c,i)=>{
        const list=[];c.groups.forEach(g=>{if(by[g])list.push.apply(list,by[g]);});
        if(i===CURATED.length-1&&orphan.length)list.push.apply(list,orphan);
        return {n:c.n,icon:c.icon,items:ringFor(list,live),full:list.length};});
      return out.filter(c=>c.items.length);}

    const names=Object.keys(by).sort((a,b)=>groupRank(a)-groupRank(b));
    const out=names.slice(0,TOP).map(g=>({n:g,icon:GROUP_ICON[g]||'•',
      items:ringFor(by[g],live),full:by[g].length}));
    const restNames=names.slice(TOP);
    if(restNames.length){
      const rest=[];restNames.forEach(g=>rest.push.apply(rest,by[g]));
      out.push({n:'Egyéb',icon:GROUP_ICON['Egyéb'],items:ringFor(rest,live),full:rest.length});}
    return out;}

  function wheelOpen(){
    const s=buildSectors();
    if(!s.length)return false;
    wheel={level:0,sectors:s,pick:-1,sub:null,subPick:-1,opened:now()};
    drawWheel();rumble(30,0.2,0.1);return true;}

  function wheelClose(){wheel=null;drawWheel();}

  function wheelDescend(){
    if(!wheel||wheel.pick<0)return false;
    const s=wheel.sectors[wheel.pick];
    if(!s||!s.items.length)return false;
    wheel.level=1;wheel.sub=s;wheel.subPick=-1;drawWheel();rumble(25,0.15,0.1);return true;}

  function wheelBack(){
    if(!wheel)return false;
    if(wheel.level===1){wheel.level=0;wheel.sub=null;wheel.subPick=-1;drawWheel();return true;}
    wheelClose();return true;}

  function wheelRun(){
    if(!wheel||wheel.level!==1||wheel.subPick<0)return false;
    const a=wheel.sub.items[wheel.subPick];
    if(!a)return false;
    // dimmed: say what it needs and stay open, rather than swallowing the press
    if(a.dis){
      const I=IN();if(I)I.hud(a.label+' — '+a.need);
      rumble(60,0.1,0.35);
      return false;}
    wheelClose();
    if(typeof window.runAction==='function')window.runAction(a.id);
    rumble(45,0.45,0.2);
    return true;}

  // stick direction → sector index. Straight up is sector 0, then clockwise,
  // which is how every radial menu anyone has used before behaves.
  function sectorAt(lx,ly,n){
    if(!n)return -1;
    const m=Math.hypot(lx,ly);
    if(m<0.45)return -1;                       // centre = nothing selected
    let a=Math.atan2(lx,-ly);                  // 0 = up, clockwise positive
    if(a<0)a+=Math.PI*2;
    return Math.floor(a/(Math.PI*2/n)+0.5)%n;}

  function drawWheel(){
    const host=el('gpWheel');
    if(!host)return;
    if(!wheel){host.style.display='none';host.innerHTML='';return;}
    const list=wheel.level===0?wheel.sectors:wheel.sub.items;
    const pick=wheel.level===0?wheel.pick:wheel.subPick;
    const n=list.length,R=150,r=62,cxw=190,cyw=190;
    let svg=`<svg viewBox="0 0 380 380" width="380" height="380" aria-hidden="true">`;
    for(let i=0;i<n;i++){
      const a0=(i-0.5)*(Math.PI*2/n)-Math.PI/2,a1=(i+0.5)*(Math.PI*2/n)-Math.PI/2;
      const x0=cxw+Math.cos(a0)*r,y0=cyw+Math.sin(a0)*r;
      const x1=cxw+Math.cos(a0)*R,y1=cyw+Math.sin(a0)*R;
      const x2=cxw+Math.cos(a1)*R,y2=cyw+Math.sin(a1)*R;
      const x3=cxw+Math.cos(a1)*r,y3=cyw+Math.sin(a1)*r;
      const big=(Math.PI*2/n)>Math.PI?1:0;
      const on=(i===pick);
      const it=list[i];
      const dis=(wheel.level===1&&it.dis);
      svg+=`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}`
         +` A${R} ${R} 0 ${big} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
         +` L${x3.toFixed(1)} ${y3.toFixed(1)} A${r} ${r} 0 ${big} 0 ${x0.toFixed(1)} ${y0.toFixed(1)} Z"`
         +` class="gpSec${on?' on':''}${dis?' dim':''}"/>`;
      const am=(a0+a1)/2,tx=cxw+Math.cos(am)*(r+R)/2,ty=cyw+Math.sin(am)*(r+R)/2;
      const label=(wheel.level===0?it.n:it.label)||'';
      const icon=it.icon||'';
      svg+=`<text x="${tx.toFixed(1)}" y="${(ty-4).toFixed(1)}" class="gpIco${on?' on':''}">${esc(icon)}</text>`;
      svg+=`<text x="${tx.toFixed(1)}" y="${(ty+12).toFixed(1)}" class="gpLbl${on?' on':''}">${esc(clip(label,16))}</text>`;}
    const head=wheel.level===0?'Művelet':wheel.sub.n;
    const cur=pick>=0?(wheel.level===0?list[pick].n:(list[pick].label||'')):'';
    svg+=`<circle cx="${cxw}" cy="${cyw}" r="${r-4}" class="gpHub"/>`;
    svg+=`<text x="${cxw}" y="${cyw-4}" class="gpHubT">${esc(head)}</text>`;
    svg+=`<text x="${cxw}" y="${cyw+13}" class="gpHubS">${esc(clip(cur,18))}</text>`;
    svg+=`</svg>`;
    const hint=wheel.level===0?'A / Y elenged — belép · B — bezár'
                              :'A — futtat · B — vissza';
    let foot='';
    if(wheel.level===1&&pick>=0){
      const it=list[pick];
      foot=it.dis?(it.need):clip(it.hint||'',90);}
    if(!foot&&wheel.level===1&&wheel.sub.full>list.length)
      foot='+'+(wheel.sub.full-list.length)+' további — ⌘K (Start)';
    host.innerHTML=svg+`<div class="gpWfoot">${esc(foot||hint)}</div>`;
    host.style.display='flex';}

  function esc(s){return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function clip(s,n){s=String(s==null?'':s);return s.length>n?s.slice(0,n-1)+'…':s;}

  // ==========================================================================
  // the legend — the single biggest reason a controller scheme feels quick
  // ==========================================================================
  function legendFor(){
    const I=IN();if(!I)return [];
    if(I.busy())return [['B','Vissza'],['','⟨a párbeszéd van előtérben⟩']];
    const m=I.mode(),sel=I.sel();
    const drawing=['cable','path','device','object'].indexOf(m)>=0;
    const placing=['wall','build','floor','roof','measure','note'].indexOf(m)>=0;
    const A={select:'Kijelöl · húz',grab:'Mozgat',device:'Készülék le',cable:'Kábel pont',
      path:'Pálya pont',wall:'Fal pont',build:'Beépít',object:'Objektum le',floor:'Padló pont',
      roof:'Tető pont',measure:'Mérőpont',note:'Jegyzet',format:'Formátum'}[m]||'Kattint';
    const run=(m==='path'||m==='cable');
    const X=run?'Doboz le':(m==='device'||m==='object')?'Fal túloldala':'Menü';
    const UD=drawing?'Magasság':'Dőlés';
    const LR=run?'Paletta':(m==='device')?'Típus'
            :(m==='build')?'Beépített':'Forgat';
    const out=[['A',A],['B','Vissza'],['X',X],['Y','Művelet'],
               ['LB','Vissza↺'],['RB','Újra↻'],['✚↑↓',UD],['✚←→',LR]];
    if(run)out.push(['RS','Lezár']);
    if(sel.count>1)out.push(['','⟨'+sel.count+' elem⟩']);
    else if(placing)out.push(['','⟨'+I.modeLabel()+'⟩']);
    return out;}

  function drawLegend(){
    const host=el('gpLegend');if(!host)return;
    if(!GP.on||!GP.legend){host.style.display='none';legendKey='';return;}
    const items=legendFor();
    const key=items.map(i=>i[0]+':'+i[1]).join('|');
    if(key===legendKey){host.style.display='flex';return;}   // no DOM churn
    legendKey=key;
    host.innerHTML=items.map(i=>i[0]
      ?`<span class="gpKey">${esc(i[0])}</span><span class="gpAct">${esc(i[1])}</span>`
      :`<span class="gpAct gpCtx">${esc(i[1])}</span>`).join('');
    host.style.display='flex';}

  function drawCursor(){
    const host=el('gpCursor');if(!host)return;
    const I=IN();
    if(!GP.on||!pad||cx==null||!I||I.busy()){host.style.display='none';return;}
    host.style.left=Math.round(cx)+'px';
    host.style.top=Math.round(cy)+'px';
    host.className=(boxFor(I.mode())<=0?'locked':'free')+(stickyHit?' target':'');
    host.style.display='block';}

  // ==========================================================================
  // the frame
  // ==========================================================================
  function now(){return (typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();}

  function step(pd,dt){
    const C=CAM(),I=IN();
    if(!C||!I){
      if(!warned){warned=true;
        console.warn('[gamepad] PLANNER_CAM / PLANNER_INPUT adapter missing — see the header of 08b-gamepad.js');}
      return;}
    pad=pd;
    const rect=I.stageRect();
    if(rect&&cx==null)centreOn(rect);

    const busy=I.busy();

    // Anything that takes the input away — the wheel opening, a dialog, a lost
    // stage — must not leave the virtual button stuck down. `held` sets the
    // buttons flag on every hover, so a stuck one makes the next pointermove
    // look like a drag nobody started.
    if((wheel||busy||!rect)&&I.isHeld())I.release(cx==null?0:cx,cy==null?0:cy);

    const [lx,lyRaw]=stick(pd,0,1);
    const [rx,ryRaw]=stick(pd,2,3);
    const ly=lyRaw,ry=GP.invertY?-ryRaw:ryRaw;

    // ---- the wheel owns the sticks while it is open ----
    if(wheel){
      const n=wheel.level===0?wheel.sectors.length:wheel.sub.items.length;
      // The pick is STICKY: returning the thumb to centre keeps the sector you
      // were pointing at, it does not deselect. Otherwise the selection dies in
      // the moment between aiming and pressing A, which is the single most
      // annoying thing a radial menu can do. Cancelling is B's job — A and B
      // stay confirm and cancel, here as everywhere else.
      const p=sectorAt(lx,ly,n);
      if(p>=0&&wheel.level===0&&p!==wheel.pick){wheel.pick=p;drawWheel();rumble(12,0.08,0.04);}
      if(p>=0&&wheel.level===1&&p!==wheel.subPick){wheel.subPick=p;drawWheel();rumble(12,0.08,0.04);}
      if(edge(pd,BT.A)){if(wheel.level===0)wheelDescend();else wheelRun();}
      if(edge(pd,BT.B))wheelBack();
      if(edge(pd,BT.Y)&&wheel&&wheel.level===1)wheelClose();   // Y opened it, Y closes it
      // hold Y and release on a sector to descend in one motion; a tap of Y
      // just leaves the wheel open. Both gestures, one rule.
      if(lift(pd,BT.Y)){
        if(wheel.level===0&&wheel.pick>=0&&(now()-wheel.opened)>250)wheelDescend();
        else if(wheel.level===0&&wheel.pick<0&&(now()-wheel.opened)>250)wheelClose();}
      if(edge(pd,BT.START))wheelClose();
      remember(pd);drawLegend();drawCursor();return;}

    // ---- an editor, modal or the palette owns the input ----
    if(busy){
      if(edge(pd,BT.B))I.escape();        // B still backs out — nothing else
      remember(pd);drawLegend();drawCursor();return;}

    if(!rect){remember(pd);return;}

    // ---- camera: right stick, pivoting at the cursor like a right-drag ----
    if(rx||ry){
      const s=C.read?C.read():{yaw:0,pitch:30};
      if(I.isHeld()===false){                     // don't fight an active drag
        if(cx!=null)C.pivotAt(cx,cy);}
      if(rx)C.setYaw((s.yaw||0)+rx*GP.yawSpeed*dt);
      if(ry)C.setPitch((s.pitch||30)-ry*GP.pitchSpeed*dt);}

    // ---- zoom: analog triggers ----
    const lt=btn(pd,BT.LT),rt=btn(pd,BT.RT);
    if(rt>0.05)C.zoomBy(Math.pow(GP.zoomRate,rt*dt));
    if(lt>0.05)C.zoomBy(Math.pow(GP.zoomRate,-lt*dt));

    // ---- cursor ----
    const moved=moveCursor(rect,lx,ly,dt,C);
    // A tool change has to push one hover even with the stick at rest: that is
    // what fills in `cursor` and raises the placement ghost. Without it the
    // first thing you see after picking a tool is nothing at all, and X (drop
    // at cursor) silently does nothing until you nudge the stick.
    const modeNow=I.mode(),fresh=(modeNow!==lastMode);
    if(fresh)lastMode=modeNow;
    if(moved||fresh||I.isHeld())I.hover(cx,cy);

    // low-rate sticky scan, purely so the reticle can show it is in reach
    scanT+=dt;
    if(scanT>0.1){scanT=0;if(boxFor(I.mode())>0)scanSticky(cx,cy);else stickyHit=!!I.hitAt(cx,cy);}

    // ---- buttons ----
    if(edge(pd,BT.A)){const p=aim(cx,cy);I.hover(p[0],p[1]);I.press(p[0],p[1]);rumble(18,0.25,0.1);}
    if(lift(pd,BT.A))I.release(cx,cy);

    if(edge(pd,BT.B)){I.escape();rumble(15,0.15,0.08);}

    // X is the "other thing you'd want right here" button. Its ROLE is fixed,
    // its effect is per mode — which is fine precisely because the legend says
    // which one you're getting. Placing a device on a wall has no other route
    // to the near/far face, and drawing a run has no other route to the
    // place palette.
    if(edge(pd,BT.X)){
      const m=I.mode();
      if((m==='path'||m==='cable')&&I.hasCursor())I.drop();
      else if(m==='device'||m==='object')I.flipSide();
      else I.context(cx,cy);
      rumble(20,0.2,0.1);}

    if(edge(pd,BT.Y))wheelOpen();

    if(edge(pd,BT.LB))C.undo();
    if(edge(pd,BT.RB))C.redo();

    if(repeat(pd,BT.DU,dt))I.heightStep(1);
    if(repeat(pd,BT.DD,dt))I.heightStep(-1);
    if(repeat(pd,BT.DL,dt))I.cyclePick(-1);
    if(repeat(pd,BT.DR,dt))I.cyclePick(1);

    if(edge(pd,BT.LS))I.fine(true,cx,cy);
    if(lift(pd,BT.LS))I.fine(false);

    // RS closes an open run while drawing. Without this a controller cannot
    // finish a path at all: B is Esc, and Esc DISCARDS the draft.
    if(edge(pd,BT.RS)){
      const m=I.mode();
      if(m==='path'||m==='cable'){I.finish();rumble(30,0.3,0.15);}
      else{C.pivotCenter();I.repaint();}}

    if(edge(pd,BT.START)&&typeof window.paletteOpen==='function')window.paletteOpen();
    if(edge(pd,BT.BACK)){GP.legend=!GP.legend;save();legendKey='';drawLegend();}

    remember(pd);
    drawLegend();
    drawCursor();}

  function remember(pd){
    prevBtn=[];
    if(!pd||!pd.buttons)return;
    for(let i=0;i<pd.buttons.length;i++)prevBtn[i]=down(pd,i);}

  function frame(){
    raf=null;
    if(!GP.on)return;
    const t=now(),dt=Math.max(0,Math.min(0.1,(t-lastT)/1000));
    lastT=t;
    const pd=readPad();
    if(pd)step(pd,dt);
    else{pad=null;drawCursor();}
    schedule();}

  function schedule(){
    if(!GP.on||raf!=null)return;
    if(typeof requestAnimationFrame!=='function')return;
    raf=requestAnimationFrame(frame);}

  // ---- on / off -----------------------------------------------------------
  function setEnabled(on,quiet){
    on=!!on;
    const was=GP.on;GP.on=on;save();
    const b=el('gpBtn');if(b)b.classList.toggle('on',on);
    const I=IN();
    if(on){
      lastT=now();prevBtn=[];rep={};legendKey='';
      schedule();
      if(!quiet&&I){
        const p=readPad();
        I.hud(p?('Kontroller: '+clip(p.id||'csatlakoztatva',40))
               :'Kontroller mód bekapcsolva — nyomj meg egy gombot a kontrolleren.');}}
    else{
      if(raf!=null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(raf);
      raf=null;pad=null;cx=null;cy=null;wheel=null;stickyHit=false;
      drawWheel();drawCursor();drawLegend();
      if(I&&I.isHeld())I.release(0,0);
      if(!quiet&&was&&I)I.hud('Kontroller mód kikapcsolva.');}
    return GP.on;}

  // ---- wiring -------------------------------------------------------------
  function init(){
    load();
    const b=el('gpBtn');
    if(b){b.onclick=()=>setEnabled(!GP.on);b.classList.toggle('on',GP.on);}

    // Activation is manual, by design. Chrome does not expose a pad until a
    // button is pressed, so "plug it in and it lights up" is not on offer;
    // and an app that changes how it behaves because something was nudged on
    // the desk is worse than one you have to switch on.
    if(typeof window.addEventListener==='function'){
      window.addEventListener('gamepadconnected',e=>{
        padIx=(e&&e.gamepad)?e.gamepad.index:padIx;
        if(GP.on){lastT=now();schedule();}
        const I=IN();
        if(I&&!GP.on)I.hud('Kontroller észlelve — bekapcsolás: a 🎮 gomb, vagy ⌘K → kontroller.');});
      window.addEventListener('gamepaddisconnected',()=>{
        padIx=null;pad=null;prevBtn=[];rep={};
        const I=IN();if(I&&I.isHeld())I.release(cx==null?0:cx,cy==null?0:cy);
        drawCursor();});
      window.addEventListener('blur',()=>{
        // a drag must not survive losing focus mid-press
        const I=IN();if(I&&I.isHeld())I.release(cx==null?0:cx,cy==null?0:cy);
        prevBtn=[];rep={};});}

    if(GP.on)setEnabled(true,true);
    drawLegend();}

  if(typeof registerActions==='function'){
    registerActions([
      {id:'input.gamepad',label:'Kontroller mód be/ki',icon:'🎮',group:'Nézet',
       alias:'gamepad controller xbox joypad kontroller',
       hint:'Xbox-kompatibilis kontroller: bal kar kurzor, jobb kar kamera, ravaszok nagyítás, Y a művelet-kerék.',
       run:()=>setEnabled(!GP.on)},
      {id:'input.gamepad.legend',label:'Kontroller gombsáv be/ki',icon:'⌨',group:'Nézet',
       alias:'gamepad legend hints buttons gombsav',
       when:()=>GP.on,
       hint:'Az alsó sávban mutatja, mit csinál most minden gomb.',
       run:()=>{GP.legend=!GP.legend;save();legendKey='';drawLegend();}},
      {id:'input.gamepad.wheel',label:'Kontroller művelet-kerék',icon:'🎯',group:'Nézet',
       alias:'gamepad wheel radial menu kerek',
       when:()=>GP.on,
       hint:'Ugyanaz a kerék, amit a kontrolleren az Y gomb nyit.',
       run:()=>{if(wheel)wheelClose();else wheelOpen();}}
    ]);}

  window.PLANNER_GP={
    enabled(){return GP.on;},
    setEnabled,
    cfg(){return Object.assign({},GP);},
    set(k,v){if(!(k in DEF))return false;GP[k]=v;save();
      if(k==='legend'){legendKey='';drawLegend();}
      return true;},
    defaults(){return Object.assign({},DEF);},
    reset(){GP=Object.assign({},DEF,{on:GP.on});save();legendKey='';drawLegend();return Object.assign({},GP);},
    connected(){return !!readPad();}
  };

  // test hook — lets tests drive the loop with a scripted pad, the way
  // tests/control-bridge-smoke.js drives the phone link with scripted frames.
  window.__gp={
    step,                                   // step(fakePad, dt)
    cursor(){return cx==null?null:[cx,cy];},
    setCursor(x,y){cx=x;cy=y;},
    wheel(){return wheel?{level:wheel.level,pick:wheel.pick,subPick:wheel.subPick,
      sectors:wheel.sectors.map(s=>s.n),full:wheel.sectors.map(s=>s.full)}:null;},
    items(){return wheel&&wheel.level===1?wheel.sub.items.slice():null;},
    pick(i){if(wheel)wheel.pick=i;},
    pickSub(i){if(wheel)wheel.subPick=i;},
    closeWheel:wheelClose,
    legend(){return legendFor();},
    boxFor,aim,stick,sectorAt,ringFor,SUBMAX,
    cfg(){return GP;},
    reset(){prevBtn=[];rep={};wheel=null;cx=null;cy=null;stickyHit=false;lastMode=null;
      drawWheel();drawCursor();}
  };

  if(typeof document!=='undefined'){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
    else init();}

})();
