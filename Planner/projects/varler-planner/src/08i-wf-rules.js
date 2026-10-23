// ==========================================================================
// 08i-wf-rules.js — workflow round (docs/workflow), WP-R3: the Szabályok palette
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The colour-coded marks the user put on CLA (and the non-electrical areas, R07 answer) as one-click presets. Every
// preset writes an ordinary Jelölés mark (05n) — same store, colours (MRK_POL), undo, layer, list — so the engine and
// every later layer read them like any mark. Selection rule (the user's): LMB = the FACE nearest the pointer (half wall),
// hold + drag along it = only that part; whole-wall presets take both faces; zones are dragged rectangles on the floor;
// opening presets click a door / window. A click on what is already marked with that preset removes it.
// Existing tags are reused where they mean the same (munkalap → 'pult', fűtőtest → 'radiator', vizes → 'vizes');
// new ones: kerulendo, tilos, gaz (faces) · sziget, strang (floor zones).
(function(){const add=(kind,t)=>{const L=MRK_TAGS[kind];if(L&&!L.some(x=>x.k===t.k))L.push(t);};
  add('side',{k:'kerulendo',n:'Kerülendő falfelület',pol:'minus'});add('side',{k:'tilos',n:'Tilos — nem véshető felület',pol:'ban'});
  add('side',{k:'gaz',n:'Gázvezeték nyomvonala',pol:'ban'});
  add('plane',{k:'sziget',n:'Konyhasziget',pl:'floor',pol:'none'});add('plane',{k:'strang',n:'Lefolyó / strang',pl:'floor',pol:'ban'});})();

// {k, n, sec, kind: 'route'|'wall'|'side'|'zone'|'door'|'window'|'off', tag, pol}
const RB_PRESETS=[
  {k:'vezetheto',n:'Vezethető fal',sec:'Fal',kind:'route',pol:'plus'},
  {k:'lforma',n:'L-forma oldal',sec:'Fal',kind:'side',tag:'lforma',pol:'plus'},
  {k:'kulso',n:'Külső fal',sec:'Fal',kind:'wall',tag:'homlokzat',pol:'minus'},     // was Belső fal (user, 2026-10-15)
  {k:'kerulendo',n:'Kerülendő',sec:'Fal',kind:'side',tag:'kerulendo',pol:'minus'},
  {k:'tilos',n:'Tilos',sec:'Fal',kind:'side',tag:'tilos',pol:'ban'},
  {k:'media',n:'Médiafal',sec:'Fal',kind:'side',tag:'media',pol:'plus'},
  {k:'munkalap',n:'Munkalap',sec:'Fal',kind:'side',tag:'pult',pol:'none'},
  {k:'agy',n:'Ágy zóna',sec:'Fal',kind:'zone',tag:'agy',pol:'none'},
  {k:'folyoso',n:'Közlekedő',sec:'Fal',kind:'zone',tag:'folyoso',pol:'none'},
  {k:'sziget',n:'Sziget',sec:'Fal',kind:'zone',tag:'sziget',pol:'none'},
  {k:'redony',n:'Redőny',sec:'Nyílászáró',kind:'window',tag:'redony',pol:'none'},
  {k:'portal',n:'Portál',sec:'Nyílászáró',kind:'door',tag:'portal',pol:'none'},
  {k:'vizes',n:'Vizes fal',sec:'Egyéb területek',kind:'side',tag:'vizes',pol:'ban'},
  {k:'gepeszet',n:'Gépészet a falban',sec:'Egyéb területek',kind:'wall',tag:'gepeszet',pol:'ban'},
  {k:'gaz',n:'Gázvezeték',sec:'Egyéb területek',kind:'side',tag:'gaz',pol:'ban'},
  {k:'futotest',n:'Fűtőtest',sec:'Egyéb területek',kind:'side',tag:'radiator',pol:'minus'},
  {k:'padlofutes',n:'Padlófűtés',sec:'Egyéb területek',kind:'zone',tag:'padlofutes',pol:'ban'},
  {k:'kemeny',n:'Kémény / szellőző',sec:'Egyéb területek',kind:'wall',tag:'kemeny',pol:'ban'},
  {k:'strang',n:'Lefolyó / strang',sec:'Egyéb területek',kind:'zone',tag:'strang',pol:'ban'},
  {k:'butor',n:'Bútor / szekrénysor',sec:'Egyéb területek',kind:'side',tag:'butor',pol:'minus'},
  {k:'padlo',n:'Padló szabályok — fejlesztés alatt',sec:'Padló',kind:'off'}];
// a preset's colour = the look its marks get (05n MRK_STYLE), Vezethető fal green
function rbCol(p){if(p.kind==='route')return MRK_STYLE.vezetheto.c;const st=p.tag&&MRK_STYLE[p.tag];return st?st.c:(MRK_POL[p.pol]||MRK_POL.none).c;}
const RB={on:false,preset:null,press:null,hover:null,panel:false};

function rbPreset(k){return RB_PRESETS.find(p=>p.k===k)||null;}
function rbMarkOf(p,m){if(!p||!m||!p.tag||(m.tags||[]).indexOf(p.tag)<0)return false;
  if(p.kind==='wall')return m.kind==='wall';if(p.kind==='side')return m.kind==='side'||m.kind==='vstrip';
  if(p.kind==='zone')return m.kind==='zone';if(p.kind==='door'||p.kind==='window')return m.kind==='opening';return false;}
function rbCount(k){const p=rbPreset(k);if(!p)return 0;if(p.kind==='route')return typeof rwlMarks==='function'?rwlMarks().length:0;
  return mrkList().filter(m=>rbMarkOf(p,m)).length;}
// ---- committing (pure enough to test: no pointer needed) -----------------------------------------------------------------
// wall / side: pt = {level, id, side, u}; opt.u0/u1 = a drag along the face. Returns the new mark, or null when it toggled off.
function rbWallCommit(p,pt,opt){opt=opt||{};const r=mrkWallById(pt.level,pt.id);if(!r)return undefined;
  if(p.kind==='wall'){const ex=mrkList().find(m=>m.kind==='wall'&&m.wall===pt.id&&(m.tags||[]).indexOf(p.tag)>=0);
    if(ex){mrkRemove(ex);return null;}return mrkAdd({kind:'wall',level:pt.level,wall:pt.id,pol:p.pol,tags:[p.tag]});}
  if(opt.u0!=null&&opt.u1!=null&&Math.abs(opt.u1-opt.u0)>=100){const len=mrkWallLen(r);
    return mrkAdd({kind:'vstrip',level:pt.level,wall:pt.id,side:pt.side,u0:Math.max(0,mrkSnap(Math.min(opt.u0,opt.u1))),u1:Math.min(len,mrkSnap(Math.max(opt.u0,opt.u1))),pol:p.pol,tags:[p.tag]});}
  const ex=mrkList().find(m=>m.kind==='side'&&m.wall===pt.id&&m.side===pt.side&&(m.tags||[]).indexOf(p.tag)>=0);
  if(ex){mrkRemove(ex);return null;}return mrkAdd({kind:'side',level:pt.level,wall:pt.id,side:pt.side,pol:p.pol,tags:[p.tag]});}
// an opening: one opening mark per opening per layer (05n) — the tag is added to it or taken off it
function rbOpeningCommit(p,o){if(!o||(p.kind==='window')!==(o.type==='window')||o.type==='stairs')return undefined;if(!o.id)ensureIds(data);
  const L=mrkLayer(),ex=mrkList().find(m=>m.kind==='opening'&&m.op===o.id&&m.layer===L);
  if(ex){pushUndo(['marks']);const i=(ex.tags||[]).indexOf(p.tag);ex.tags=ex.tags||[];
    if(i>=0){ex.tags.splice(i,1);if(!ex.tags.length)mrkList().splice(mrkList().indexOf(ex),1);draw();return null;}ex.tags.push(p.tag);draw();return ex;}
  return mrkAdd({kind:'opening',level:o.level,op:o.id,pol:p.pol,tags:[p.tag]});}
function rbZoneCommit(p,level,a,b){const g=mrkPlaneGeo('rect',{x:a[0],y:a[1]},{x:b[0],y:b[1]});if(!g)return undefined;
  return mrkAdd(Object.assign({level,plane:'floor'},g,{pol:p.pol,tags:[p.tag]}));}

// ---- the tool ------------------------------------------------------------------------------------------------------------
function rbPick(k){const p=rbPreset(k);if(!p||p.kind==='off')return false;
  // R5: whole-wall, face and route presets are inks of the marker pen (08ia); zones and openings keep this tool
  if(typeof mkpIsPen==='function'&&mkpIsPen(k)){RB.on=false;RB.preset=null;mkpStart(k);rbPanelDraw();return true;}
  toolsOff();
  if(state.mode!=='select')setMode('select');RB.on=true;RB.preset=p.k;RB.press=null;
  const how=p.kind==='wall'?'kattints egy falra (mindkét oldal)':p.kind==='side'?'kattints a fal egyik oldalára, vagy húzd végig a szakaszon':
    p.kind==='zone'?'húzz egy téglalapot a padlón':p.kind==='door'?'kattints egy ajtóra':'kattints egy ablakra';
  const mh=$('modeHint');if(mh)mh.textContent='Szabály: '+p.n+' — '+how+' · ugyanoda újra kattintva leveszed · Esc: kész';
  rbPanelDraw();draw();return true;}
function rbOff(){RB.on=false;RB.preset=null;RB.press=null;RB.hover=null;const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';rbPanelDraw();}
function rbPlan(e){const [bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(state.active,0));return [p[0],p[1]];}
STK_TOOLS.push({k:'rbRules',active:()=>{if(!RB.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){rbOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const p=rbPreset(RB.preset);if(!p)return false;
    RB.press={client:[e.clientX,e.clientY],p0:rbPlan(e),pt:p.kind==='zone'?null:mrkPick(e),drag:false};
    try{stage.setPointerCapture(e.pointerId);}catch(_){}return true;},
  move(e){const P=RB.press,p=rbPreset(RB.preset);
    if(P&&(e.buttons&1)){if(!P.drag&&Math.hypot(e.clientX-P.client[0],e.clientY-P.client[1])>6)P.drag=true;
      if(P.drag){P.p1=rbPlan(e);if(p.kind==='side'&&P.pt&&!P.pt.opening){const q=mrkPick(e);if(q&&q.id===P.pt.id)P.u1=q.u;}draw();}return true;}
    if(p&&p.kind!=='zone'){const q=mrkPick(e),k=q?(q.opening?'o'+q.opening.id:q.id+':'+q.side):'';if((RB.hover&&RB.hover.key)!==k){RB.hover=q?Object.assign({key:k},q):null;draw();}}
    return false;},
  up(e){const P=RB.press;RB.press=null;if(!P)return false;try{stage.releasePointerCapture(e.pointerId);}catch(_){}
    const p=rbPreset(RB.preset);let res;
    if(p.kind==='zone'){res=P.drag&&P.p1?rbZoneCommit(p,state.active,P.p0,P.p1):undefined;if(res===undefined)$('hud').textContent='Húzz egy legalább 50 × 50 mm-es téglalapot.';}
    else if(p.kind==='door'||p.kind==='window'){res=P.pt&&P.pt.opening?rbOpeningCommit(p,P.pt.opening):undefined;
      if(res===undefined)$('hud').textContent=p.kind==='door'?'Kattints egy ajtóra.':'Kattints egy ablakra.';}
    else if(P.pt&&!P.pt.opening){res=rbWallCommit(p,P.pt,p.kind==='side'&&P.drag?{u0:P.pt.u,u1:P.u1}:{});}
    else{res=undefined;$('hud').textContent='Kattints egy falra.';}
    if(res!==undefined)$('hud').textContent=(res?'Szabály: ':'Levéve: ')+p.n;
    rbPanelDraw();draw();return true;},
  esc(){rbOff();draw();},mode(){rbOff();}});
STK_OVERLAY.push(()=>{if(!RB.on)return '';const p=rbPreset(RB.preset),P=RB.press,lvl=state.active,z=dz(lvl,0);if(!p)return '';
  const col=rbCol(p);
  if(p.kind==='zone'&&P&&P.drag&&P.p1){const a=P.p0,b=P.p1,R=[[a[0],a[1]],[b[0],a[1]],[b[0],b[1]],[a[0],b[1]]];
    return `<polygon points="${p2b(R.map(q=>[q[0],q[1],z]))}" fill="${col}" fill-opacity="0.15" stroke="${col}" stroke-width="${vsP(1.4)}" stroke-dasharray="${vsDash('5 3')}"/>`;}
  const h=P&&P.pt?P.pt:RB.hover;if(!h||h.opening||(p.kind!=='wall'&&p.kind!=='side'))return '';
  let m;if(p.kind==='wall')m={kind:'wall',level:h.level,wall:h.id,pol:p.pol,tags:[p.tag]};
  else if(P&&P.drag&&P.u1!=null)m={kind:'vstrip',level:h.level,wall:h.id,side:h.side,u0:Math.min(h.u,P.u1),u1:Math.max(h.u,P.u1),pol:p.pol,tags:[p.tag]};
  else m={kind:'side',level:h.level,wall:h.id,side:h.side,pol:p.pol,tags:[p.tag]};
  return `<g opacity="0.8" pointer-events="none">`+mrkWallSvg(m)+`</g>`;});

// ---- the panel ---------------------------------------------------------------------------------------------------------------
function rbPanelHost(){let h=$('rbPanel');if(!h){h=document.createElement('div');h.id='rbPanel';document.body.appendChild(h);
  const st=document.createElement('style');st.textContent='#rbPanel{position:fixed;left:12px;top:96px;z-index:55;width:228px;max-height:calc(100vh - 130px);overflow:auto;'
   +'background:#fffefb;border:1px solid #d8d3c8;border-radius:10px;box-shadow:0 4px 18px #0002;font-size:12px;padding:8px 8px 6px;display:none}'
   +'#rbPanel h5{margin:8px 2px 4px;font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.04em}#rbPanel h4{margin:0 0 4px;font-size:13px;display:flex;justify-content:space-between}'
   +'#rbPanel .rb{display:flex;align-items:center;gap:6px;width:100%;border:1px solid transparent;background:none;padding:3px 4px;border-radius:6px;cursor:pointer;text-align:left;font-size:12px}'
   +'#rbPanel .rb:hover{background:#f3efe7}#rbPanel .rb,#rbPanel .rb.on{color:#2c2c2c}#rbPanel .rb.on{border-color:#e8641c;background:#fdf0e7;font-weight:700}#rbPanel .rb[disabled]{color:#aaa;cursor:default;font-style:italic}'
   +'#rbPanel .dot{width:10px;height:10px;border-radius:50%;flex:none}#rbPanel .n{margin-left:auto;color:#999;font-variant-numeric:tabular-nums}#rbPanel .x{border:none;background:none;cursor:pointer;font-size:14px}';
  document.head.appendChild(st);
  h.addEventListener('click',e=>{const b=e.target.closest('[data-rb]');if(b){const k=b.dataset.rb;if(RB.preset===k&&RB.on)rbOff();else rbPick(k);draw();return;}
    if(e.target.closest('.x'))rbPanel(false);});}
  return h;}
function rbPanelDraw(){const h=rbPanelHost();if(!RB.panel){h.style.display='none';return;}let s='<h4>Szabályok <button class="x" title="Bezár">✕</button></h4>',sec='';
  RB_PRESETS.forEach(p=>{if(p.sec!==sec){sec=p.sec;s+=`<h5>${esc(sec)}</h5>`;}
    if(p.kind==='off'){s+=`<button class="rb" disabled>${esc(p.n)}</button>`;return;}
    const col=rbCol(p),on=RB.on&&RB.preset===p.k||(typeof MKP!=='undefined'&&MKP.on&&MKP.ink===p.k),n=rbCount(p.k);
    s+=`<button class="rb${on?' on':''}" data-rb="${p.k}"><span class="dot" style="background:${col}"></span>${esc(p.n)}<span class="n">${n||''}</span></button>`;});
  h.innerHTML=s;h.style.display='block';}
function rbPanel(on){RB.panel=on==null?!RB.panel:!!on;if(!RB.panel)rbOff();rbPanelDraw();return RB.panel;}

registerActions([{id:'wf.rules',label:'Szabályok',icon:'📐',group:'Véset',alias:'rules palette szabalyok jeloles',
  hint:'A falak, nyílászárók és területek szabályai egy kattintással (vezethető, L-forma, tilos, vizes fal …).',when:c=>!c.inEditor,run:()=>rbPanel(true)}]);
(function(){const b=$('rbBtn');if(b)b.onclick=()=>rbPanel();})();
