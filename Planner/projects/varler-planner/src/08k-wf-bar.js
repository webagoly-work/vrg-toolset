// ==========================================================================
// 08k-wf-bar.js — workflow round (docs/workflow), WP-E0: the Munkafolyamat bar
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The overlay the user asked for ("parts of an overlaying control system"): a thin bar over the canvas that walks the
// four phases — 1 Alapozás › 2 Nyílászárók › 3 Szabályok › 4 Villamosság — and puts that phase's tools one click away.
// It drives the existing tools and layers only; it stores nothing but state.wfPhase (and state.wfBar on/off).
// Entering Villamosság makes sure a BRIDGE stack exists (adopting the layer the rooms are on as Szerkezet, nothing
// copied) and activates the Erősáram socket layer; 4.1 has two buttons, Dugaljak / Lámpák + kapcsolók (E01 = A).
// The later steps 4.2–4.5 are listed greyed until their work packages land. Each phase shows a live check, read from
// the data, never stored.
if(state.wfPhase==null)state.wfPhase='alap';
if(state.wfBar==null)state.wfBar=true;
const WF_PHASES=[
  {k:'alap',n:'Alapozás',i:'1',tools:[
    {n:'⬚ Helyiség-toll',run:()=>setMode('room')},{n:'🧱 Falak létrehozása',run:()=>wfwDialog()},{n:'▦ Padló létrehozása',run:()=>wfwFloors()},
    {n:'▤ Fal',run:()=>setMode('wall')},{n:'✥ Mozgatás',run:()=>setMode('grab')}]},
  {k:'nyil',n:'Nyílászárók',i:'2',tools:[{n:'🚪 Ajtó',run:()=>opnTool('door')},{n:'🪟 Ablak',run:()=>opnTool('window')}]},
  {k:'szab',n:'Szabályok',i:'3',tools:[
    {n:'🏷 Helyiségtípus',run:()=>{setMode('room');$('hud').textContent='Helyiségtípus: kattints egy helyiség belsejébe (Kijelölésben: dupla kattintás).';}},
    {n:'🟩 Vezethető fal',run:()=>rwlToolStart()},{n:'📐 Szabályok',run:()=>rbPanel(true)},{n:'📏 Szabványok',run:()=>stdPanel(true)}]},
  {k:'vill',n:'Villamosság',i:'4',tools:[
    {n:'⚡ Dugaljak',role:'sys:SOC',run:()=>wfLayer('sys:SOC')},{n:'💡 Lámpák + kapcsolók',role:'sys:LIGHT',run:()=>wfLayer('sys:LIGHT')},
    {n:'🔌 Dedikált',role:'sys:DED',run:()=>wfLayer('sys:DED')},
    {n:'4.2 Kapcsolások',off:'E1'},{n:'4.3 Dobozok',off:'E3'},{n:'4.4 Áramkörök',off:'E4'},{n:'4.5 Pályák és vezetékek',off:'E5'}]}];

// the stack the electrical phase works in: the active one, else the first, else a new one adopting the rooms' layer
function wfStack(){let S=typeof stkActive==='function'?stkActive():null;if(!S&&typeof stacks!=='undefined'&&stacks.length)S=stacks[0];
  if(S)return S;const fl=data.floors.find(f=>f&&f.level===state.active),L=(fl&&fl.layer)||'L0';
  return stkCreate({name:'Munkafolyamat',construct:{mode:'adopt',layers:[L]}});}
function wfLayer(role){const S=wfStack();if(!S)return null;state.stack=S.id;state.stkOff=false;
  const L=stkLayer(S.id,role);if(!L){$('hud').textContent='A stackben nincs '+role+' réteg.';return null;}
  state.activeLayer=L.id;if(typeof lyrRefresh==='function')lyrRefresh();else if(typeof renderLayers==='function')renderLayers();
  if(state.mode!=='select')setMode('select');wfBarDraw();draw();
  $('hud').textContent='Aktív réteg: '+(L.name||role)+' — Végpont: jobb klikk a rétegen, vagy a Szabványok ＋ gombja.';return L;}
function wfPhase(k){const P=WF_PHASES.find(p=>p.k===k);if(!P)return false;state.wfPhase=k;
  // a role on the active layer is not enough: its stack must still exist (a reset can leave orphan role layers behind)
  if(k==='vill'){const L=lyrLayer(state.activeLayer),r=L&&L.role,S=typeof stkActive==='function'?stkActive():null;
    if(!S||!stkById(S.id)||!(r==='sys:SOC'||r==='sys:LIGHT'||r==='sys:DED'))wfLayer('sys:SOC');}
  wfBarDraw();return true;}
// live checks per phase
function wfCheck(k){const lvl=state.active,rooms=data.floors.filter(f=>f&&f.level===lvl&&f.poly&&f.poly.length>=3);
  if(k==='alap'){if(!rooms.length)return 'nincs helyiség';const ol=rooms.filter(f=>f.stage==='outline').length,gw=(WALLS[lvl]||[]).length;
    return rooms.length+' helyiség'+(gw?' · falak ✓':' · falak nélkül')+(ol?' · '+ol+' padló nélkül':' · padló ✓');}
  if(k==='nyil'){const o=(data.openings||[]).filter(x=>x.level===lvl);return o.filter(x=>x.type==='door').length+' ajtó · '+o.filter(x=>x.type==='window').length+' ablak';}
  if(k==='szab'){const nk=rooms.filter(f=>!(Array.isArray(f.kinds)&&f.kinds.length)&&!f.kind).length,rw=typeof rwlAllowed==='function'?rwlAllowed(lvl).length:0;
    return (nk?nk+' helyiség típus nélkül':'típusok ✓')+' · '+rw+' vezethető szakasz';}
  if(k==='vill'){const e=data.devices.filter(d=>d&&d.level===lvl&&typeof epCodeOf==='function'&&epCodeOf(d)),c=x=>e.filter(d=>epCodeOf(d)===x).length;
    return c('SOC')+' dugalj · '+c('LMP')+' lámpa · '+c('SWI')+' kapcsoló · '+c('DED')+' dedikált';}
  return '';}

function wfBarHost(){let h=$('wfBar');if(!h){const wrap=document.querySelector('.stage-wrap');if(!wrap)return null;
  h=document.createElement('div');h.id='wfBar';wrap.appendChild(h);
  const st=document.createElement('style');st.textContent='#wfBar{position:absolute;top:8px;left:12px;right:110px;width:fit-content;margin:0 auto;z-index:20;font-size:12px;color:#2c2c2c;'
   +'background:#fffefbEE;border:1px solid #d8d3c8;border-radius:10px;box-shadow:0 2px 10px #0001;padding:4px 6px}'
   +'#wfBar .ph{display:flex;gap:2px;align-items:center;justify-content:center;flex-wrap:wrap}#wfBar .p{border:none;background:none;cursor:pointer;padding:3px 8px;border-radius:7px;color:#5a6270;font-size:12px}'
   +'#wfBar .p.on{background:#2c2c2c;color:#fff;font-weight:700}#wfBar .p b{display:inline-block;width:16px;height:16px;line-height:16px;border-radius:50%;background:#e8e3d8;color:#2c2c2c;font-size:10.5px;margin-right:4px;text-align:center}'
   +'#wfBar .p.on b{background:#e8641c;color:#fff}#wfBar .sep{color:#bbb}#wfBar .tl{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:4px;align-items:center}'
   +'#wfBar .t{border:1px solid #d8d3c8;background:#fff;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:11.5px;color:#2c2c2c}#wfBar .t.on{border-color:#e8641c;background:#fdf0e7;font-weight:700}'
   +'#wfBar .t[disabled]{color:#aaa;cursor:default;border-style:dashed}#wfBar .ck{color:#777;font-size:11px;margin-left:6px}';
  document.head.appendChild(st);
  h.addEventListener('click',e=>{const p=e.target.closest('[data-ph]');if(p){wfPhase(p.dataset.ph);draw();return;}
    const t=e.target.closest('[data-t]');if(t&&!t.disabled){const P=WF_PHASES.find(x=>x.k===state.wfPhase),T=P&&P.tools[+t.dataset.t];if(T&&T.run){T.run();wfBarDraw();}}});}
  return h;}
function wfBarDraw(){const h=wfBarHost();if(!h)return;if(!state.wfBar){h.style.display='none';return;}
  const cur=WF_PHASES.find(p=>p.k===state.wfPhase)||WF_PHASES[0],L=typeof lyrLayer==='function'?lyrLayer(state.activeLayer):null,role=L&&L.role;
  let s='<div class="ph">'+WF_PHASES.map((p,i)=>(i?'<span class="sep">›</span>':'')+`<button class="p${p===cur?' on':''}" data-ph="${p.k}" title="${esc(wfCheck(p.k))}"><b>${p.i}</b>${esc(p.n)}</button>`).join('')+'</div>';
  s+='<div class="tl">'+cur.tools.map((t,i)=>t.off?`<button class="t" disabled title="${t.off} — hamarosan">${esc(t.n)}</button>`
    :`<button class="t${t.role&&t.role===role?' on':''}" data-t="${i}">${esc(t.n)}</button>`).join('')+`<span class="ck">${esc(wfCheck(cur.k))}</span></div>`;
  if(h.__s!==s){h.innerHTML=s;h.__s=s;}h.style.display='block';
  // clear of the mode hint (top-left of the stage): start right of it when it is showing
  const mh=$('modeHint'),wr=h.parentElement;if(mh&&wr){const a=mh.getBoundingClientRect(),w=wr.getBoundingClientRect();
    const showing=a.width&&a.top<w.top+60&&getComputedStyle(mh).display!=='none',beside=Math.round(a.right-w.left+10);
    // beside the hint when there is room for the bar, else under it (side panels open = a narrow stage)
    const room=w.width-beside-110>=420,L=showing&&room?beside:12,T=showing&&!room?Math.round(a.bottom-w.top+6):8;
    if(h.style.left!==L+'px')h.style.left=L+'px';if(h.style.top!==T+'px')h.style.top=T+'px';}}   // rewrite only on change: a click must not lose its button
function wfBarToggle(on){state.wfBar=on==null?!state.wfBar:!!on;wfBarDraw();return state.wfBar;}
// the checks follow the drawing: refresh after every draw (cheap — a few counts)
STK_OVERLAY.push(()=>{if(state.wfBar)setTimeout(wfBarDraw,0);return '';});

registerActions([{id:'wf.bar',label:'Munkafolyamat sáv',icon:'🧭',group:'Nézet',alias:'workflow bar munkafolyamat fazis',
  hint:'Alapozás › Nyílászárók › Szabályok › Villamosság — a fázis eszközei egy kattintásra.',when:()=>true,run:()=>wfBarToggle()},
  {id:'wf.electric',label:'Villamosság: Erősáram',icon:'⚡',group:'Készülék',alias:'electrical erosaram villamossag',
   hint:'BRIDGE stack (ha még nincs) és az Erősáram dugalj rétege aktív.',when:()=>true,run:()=>wfPhase('vill')}]);
setTimeout(wfBarDraw,0);
