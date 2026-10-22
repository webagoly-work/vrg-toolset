// ==========================================================================
// 08j-wf-standards.js — workflow round (docs/workflow), WP-R4: Szabványmagasságok (STANDARDS)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The CLA lesson: the user places devices as stickers, the heights are a STANDARD. R04 = B (answered 2026-10-14):
// every height variant is its OWN catalogue item — `Dugalj · garázs · 500`, `Borotválkozó dugalj · 1400` — placed from
// the Szabványok panel. The item is stored on the device as d.hVar (d.var stays the ELECTRICAL variant of 05s).
// The table owns the heights: change a row → every placed item of that kind follows on Alkalmaz, except devices moved
// by hand (d.h ≠ d.hStd, the height the standard last gave it). Context never rewrites a device: it raises a suggestion
// (check std.suggest, "Csere" in the panel) — the logic of tools/baseline/rules.js stdHeight(), ported.
// Overrides cascade, most specific wins: room:<id> → kind:<k> → project → built-in STD_H. Stored in data.stdHeights
// (a UKEYS collection, prefix K). Every row confirmed by the user at the R4 ⏸ (2026-10-14): laundry 1100 above the
// machine, elszívó socket 1900; a new unconfirmed row gets flag:1 (⚑ in the panel).

// {code, hv, n, h (mm | 'C' = the room's ceiling), auto:{kind?, zone?, tag?, word?, wall?, maxH?}, src, flag?}
const STD_H=[
 // ---- Dugalj (SOC)
 {code:'SOC',hv:'alap',n:'Dugalj',h:300,auto:{},src:'EP_CAT / felhasználó'},
 {code:'SOC',hv:'garazs',n:'Dugalj · garázs / műhely',h:500,auto:{kind:'gepeszet'},src:'felhasználó'},
 {code:'SOC',hv:'ejjeli',n:'Dugalj · éjjeliszekrény fölött',h:750,auto:{zone:'agy'},src:'rules.js'},
 {code:'SOC',hv:'media',n:'Dugalj · médiafal',h:1200,auto:{tag:'media'},src:'felhasználó'},
 {code:'SOC',hv:'pult',n:'Dugalj · munkalap fölött',h:1100,auto:{tag:'pult'},src:'rules.js (900 + 200)'},
 {code:'SOC',hv:'sziget',n:'Dugalj · szigetben, oldallapon',h:750,auto:{zone:'sziget'},src:'rules.js'},
 {code:'SOC',hv:'borotva',n:'Borotválkozó dugalj · tükör / mosdó mellett',h:1400,auto:{},src:'felhasználó (R06)'},
 {code:'SOC',hv:'furdo',n:'Dugalj · fürdő, egyéb',h:1100,auto:{kind:['furdo','wc']},src:'Q-R09 = A'},
 {code:'SOC',hv:'kamra',n:'Dugalj · kamra, polcmagasság',h:1100,auto:{kind:['kamra','gardrob']},src:'rules.js'},
 {code:'SOC',hv:'ventil',n:'Dugalj · ventilátor / elszívó',h:1900,auto:{word:'ventil'},src:'felhasználó (R4 ⏸)'},
 // ---- appliance sockets below the worktop (R05 answer, MATERIAL §3b)
 {code:'SOC',hv:'huto',n:'Hűtő dugalj',h:300,auto:{word:'hűtő'},src:'MATERIAL §3b'},
 {code:'SOC',hv:'mikro',n:'Mikró dugalj (beépített)',h:300,auto:{word:'mikr'},src:'MATERIAL §3b'},
 {code:'SOC',hv:'paraelsz',n:'Páraelszívó dugalj',h:2000,auto:{word:'elszív'},src:'MATERIAL §3b'},
 // ---- Dedikált (DED)
 {code:'DED',hv:'alap',n:'Dedikált fogyasztó',h:300,auto:{},src:'EP_CAT'},
 {code:'DED',hv:'fozolap',n:'Főzőlap csatlakozó',h:600,auto:{word:'főzőlap'},src:'rules.js'},
 {code:'DED',hv:'suto',n:'Sütő / sütőtorony',h:300,auto:{word:'sütő'},src:'rules.js'},
 {code:'DED',hv:'mosogato',n:'Mosogatógép',h:300,auto:{word:'mosogatógép'},src:'rules.js'},
 {code:'DED',hv:'mosogep',n:'Mosógép',h:1100,auto:{word:'mosógép'},src:'rules.js'},
 {code:'DED',hv:'szarito',n:'Szárítógép',h:1100,auto:{word:'szárító'},src:'MATERIAL §3b'},
 {code:'DED',hv:'klima',n:'Klíma beltéri egység',h:2300,auto:{word:'klíma'},src:'rules.js'},
 {code:'DED',hv:'bojler',n:'Bojler',h:1800,auto:{word:'bojler'},src:'MATERIAL §3b'},
 {code:'DED',hv:'kazan',n:'Kazán / hőszivattyú beltéri',h:1500,auto:{word:'kazán'},src:'MATERIAL §3b'},
 // ---- Kapcsoló, panel, termosztát
 {code:'SWI',hv:'alap',n:'Kapcsoló',h:1100,auto:{},src:'WORKSHOP-001'},
 {code:'SWI',hv:'ejjeli',n:'Kapcsoló · ágy mellett',h:750,auto:{zone:'agy'},src:'rules.js'},
 {code:'PAN',hv:'alap',n:'Kezelőpanel / okos vezérlés',h:1450,auto:{},src:'rules.js'},
 {code:'THR',hv:'alap',n:'Termosztát',h:1500,auto:{},src:'rules.js'},
 // ---- Lámpák, redőny
 {code:'LMP',hv:'mennyezet',n:'Mennyezeti lámpa',h:'C',auto:{wall:false},src:'rules.js'},
 {code:'LMP',hv:'fali',n:'Fali lámpa',h:1800,auto:{wall:true},src:'rules.js'},
 {code:'LMP',hv:'olvaso',n:'Olvasólámpa · ágytámla fölött',h:1400,auto:{wall:true,zone:'agy'},src:'rules.js'},
 {code:'LMP',hv:'tukor',n:'Tükörlámpa',h:1900,auto:{wall:true,kind:['furdo','wc']},src:'rules.js'},
 {code:'LMP',hv:'munkafeny',n:'Munkafény · felső szekrény alja',h:1450,auto:{wall:true,word:'munkafény'},src:'rules.js'},
 {code:'LMP',hv:'allolampa',n:'Kapcsolt dugalj állólámpának',h:300,auto:{wall:true,maxH:450},src:'rules.js'},
 {code:'SHU',hv:'alap',n:'Redőnymotor',h:2500,auto:{},src:'rules.js'},
 // ---- a többi réteg
 {code:'NTL',hv:'alap',n:'Értesítő fény',h:1150,auto:{},src:'STD-008'},
 {code:'SEN',hv:'alap',n:'Érzékelő · falon',h:2400,auto:{wall:true},src:'rules.js'},
 {code:'SEN',hv:'co2',n:'CO₂ érzékelő · légzési zóna',h:1400,auto:{word:'co2'},src:'RESEARCH-001'},
 {code:'CAM',hv:'alap',n:'Kamera',h:2400,auto:{},src:'rules.js'},
 {code:'ETH',hv:'alap',n:'Adataljzat',h:300,auto:{},src:'rules.js'},
 {code:'ETH',hv:'media',n:'Adataljzat · médiafal',h:1200,auto:{tag:'media'},src:'MATERIAL §3'},
 {code:'USB',hv:'alap',n:'USB aljzat',h:300,auto:{},src:'rules.js'},
 // ---- pályák, dobozok, szintek (E5 reads these)
 {code:'PATH',hv:'trunk',n:'Gerinc (Elosztó ↔ szervizpont)',h:2600,src:'CLA döntés'},
 {code:'PATH',hv:'dist',n:'Leágazó (szervizpont ↔ végpont)',h:2450,src:'CLA döntés'},
 {code:'PATH',hv:'data',n:'Adat sáv',h:2700,src:'ADATRETEG'},
 {code:'BOX',hv:'rbx',n:'RBX dobozközép (alja ≥ 1900)',h:2150,src:'STD-001-A1'},
 {code:'BOX',hv:'drop',n:'Leállás-doboz (2 szerelvényes)',h:2450,src:'CLA'},
 {code:'LVL',hv:'ceiling',n:'Belmagasság (alap)',h:2850,src:'CLA'},
 {code:'LVL',hv:'worktop',n:'Munkalap',h:900,src:'rules.js'},
 {code:'LVL',hv:'lintel',n:'Szemöldök',h:2100,src:'rules.js'}];
const STD_GROUP={SOC:'Dugalj',DED:'Dedikált',SWI:'Kapcsoló',PAN:'Kezelőpanel',THR:'Termosztát',LMP:'Lámpa',SHU:'Redőny',NTL:'Értesítő fény',
  SEN:'Érzékelő',CAM:'Kamera',ETH:'Adat',USB:'USB',PATH:'Pályák',BOX:'Dobozok',LVL:'Szintek'};
// data.stdHeights joins UKEYS / IDPRE in 11c-wf-keys.js — UKEYS is declared in 11-controls.js, after this file (TDZ)

function stdList(){if(!Array.isArray(data.stdHeights))data.stdHeights=[];return data.stdHeights;}
function stdRow(code,hv){return STD_H.find(r=>r.code===code&&r.hv===hv)||null;}
function stdRowsOf(code){return STD_H.filter(r=>r.code===code);}
// the room entry, its kinds and its id for a device
function stdRoomOf(d){const e=typeof roomOfDevice==='function'?roomOfDevice(d):null;if(!e)return {e:null,kinds:[],id:null};
  const rm=e.rm,ks=Array.isArray(rm.kinds)&&rm.kinds.length?rm.kinds:[typeof needKind==='function'?needKind(rm):(rm.kind||'egyeb')];
  return {e,kinds:ks,id:rm.id||null};}
// the height of (code, hv) where the device stands: room → kind → project → built-in; 'C' = the room's ceiling
function stdH(code,hv,d){const row=stdRow(code,hv);if(!row)return null;const R=d?stdRoomOf(d):{kinds:[],id:null},L=stdList();
  const pick=sc=>L.find(o=>o.code===code&&o.hv===hv&&o.scope===sc);
  const o=(R.id&&pick('room:'+R.id))||R.kinds.map(k=>pick('kind:'+k)).find(Boolean)||pick('project');
  const h=o?o.h:row.h;
  if(h==='C')return d&&typeof epCeilH==='function'?Math.round(epCeilH(d.level,d.x,d.y)):LH.ground;
  return +h;}
function stdSet(code,hv,scope,h){const L=stdList(),i=L.findIndex(o=>o.code===code&&o.hv===hv&&o.scope===scope);
  pushUndo(['stdHeights']);
  if(h==null||h===''){if(i>=0)L.splice(i,1);}else if(i>=0)L[i].h=+h;else L.push({code,hv,scope,h:+h});
  ensureIds(data);return true;}

// ---- context → the suggested item (the rules.js stdHeight logic) -------------------------------------------------------------
function stdZonesNear(d,R){const out=[];mrkList().forEach(m=>{if(m.kind!=='zone'||m.level!==d.level||m.shape!=='rect')return;
  const dx=Math.max(m.x0-d.x,0,d.x-m.x1),dy=Math.max(m.y0-d.y,0,d.y-m.y1);if(Math.hypot(dx,dy)<=R)(m.tags||[]).forEach(t=>out.push(t));});return out;}
function stdFaceTags(d){const hw=typeof deviceHostWall==='function'?deviceHostWall(d):null;if(!hw||!hw.r||!hw.r.id)return [];
  const s=Math.sign(hw.nx*hw.wi.perp[0]+hw.ny*hw.wi.perp[1])||1,u=mrkU(hw.r,d.x,d.y),out=[];
  mrkList().forEach(m=>{if(m.wall!==hw.r.id)return;
    if(m.kind==='wall'||(m.kind==='side'&&m.side===s)||(m.kind==='vstrip'&&m.side===s&&u>=m.u0-150&&u<=m.u1+150))(m.tags||[]).forEach(t=>out.push(t));});
  return out;}
function stdWords(d){const c=typeof cktOfDevice==='function'?cktOfDevice(d):null;
  return [d.name,d.note,d.lampName,c&&c.name].filter(Boolean).join(' ').toLowerCase();}
// the first row (in table order, skipping 'alap') whose auto rule matches; else alap
function stdPick(d){const code=epCodeOf(d);const rows=stdRowsOf(code);if(!rows.length)return null;
  const R=stdRoomOf(d),zones=stdZonesNear(d,600),tags=stdFaceTags(d),words=stdWords(d),wall=d.side!=null;
  const hit=rows.find(r=>{const a=r.auto;if(!a||r.hv==='alap'||!Object.keys(a).length)return false;
    if(a.wall!=null&&a.wall!==wall)return false;
    if(a.kind){const ks=[].concat(a.kind);if(!ks.some(k=>R.kinds.indexOf(k)>=0))return false;}
    if(a.zone&&zones.indexOf(a.zone)<0)return false;
    if(a.tag&&tags.indexOf(a.tag)<0)return false;
    if(a.word&&words.indexOf(a.word)<0)return false;
    if(a.maxH!=null&&!(d.h<=a.maxH))return false;
    return true;});
  const row=hit||rows.find(r=>r.hv==='alap')||(code==='LMP'&&!wall?stdRow('LMP','mennyezet'):null);if(!row)return null;
  return {hv:row.hv,h:stdH(code,row.hv,d),n:row.n,why:hit?stdWhy(hit,R):'alapérték'};}
function stdWhy(r,R){const a=r.auto||{};if(a.kind)return 'helyiség: '+R.kinds.map(k=>typeof rwKindName==='function'?rwKindName(k):k).join(' + ');
  if(a.zone)return 'zóna: '+a.zone;if(a.tag)return 'falfelület: '+a.tag;if(a.word)return 'megnevezés: „'+a.word+'”';return 'szabály';}
function stdHvOf(d){return d.hVar||'alap';}
// devices whose context suggests another item (never for a hand-pinned one)
function stdSuggestions(level){const out=[];data.devices.forEach(d=>{if(!d||(level&&d.level!==level))return;const c=epCodeOf(d);if(!c||!stdRowsOf(c).length)return;
  const p=stdPick(d);if(p&&p.hv!==stdHvOf(d)&&!(c==='LMP'&&!d.hVar&&p.hv==='mennyezet'))out.push({d,p});});return out;}
function stdSwap(d,hv){const c=epCodeOf(d);if(!stdRow(c,hv))return false;pushUndo(['devices']);d.hVar=hv;const h=stdH(c,hv,d);d.h=h;d.hStd=h;draw();return true;}
// set every device's height from its item (scope 'device' | 'room' | 'project'); hand-moved ones (h ≠ hStd) stay
function stdApplyPlan(scope,ref){const out=[];data.devices.forEach(d=>{if(!d)return;const c=epCodeOf(d);if(!c||!stdRow(c,stdHvOf(d)))return;
  if(scope==='device'&&d!==ref)return;if(scope==='room'){const R=stdRoomOf(d);if(!ref||R.id!==ref)return;}
  if(!d.hVar)return;                                  // only devices placed / swapped as an item; legacy heights are never bulldozed
  if(d.hStd!=null&&d.h!==d.hStd)return;
  const h=stdH(c,stdHvOf(d),d);if(h!=null&&h!==d.h)out.push({d,from:d.h,to:h});});return out;}
function stdApply(scope,ref,silent){const plan=stdApplyPlan(scope,ref);
  const go=()=>{if(!plan.length)return 0;pushUndo(['devices']);plan.forEach(x=>{x.d.h=x.to;x.d.hStd=x.to;});draw();
    $('hud').textContent='Szabványmagasság: '+plan.length+' eszköz frissítve.';return plan.length;};
  if(silent)return go();
  if(!plan.length){$('hud').textContent='Minden eszköz a szabvány szerinti magasságon van.';return 0;}
  openModal('Szabványmagasság alkalmazása',`<div style="font-size:12px">${plan.length} eszköz magassága változik (a kézzel mozgatottak maradnak).</div>`
    +`<table style="font-size:12px;width:100%;margin-top:6px">${plan.slice(0,60).map(x=>`<tr><td>${esc(x.d.ref||x.d.id)}</td><td>${esc((stdRow(epCodeOf(x.d),stdHvOf(x.d))||{}).n||'')}</td><td style="text-align:right">${x.from} → <b>${x.to}</b></td></tr>`).join('')}</table>`,go,'Alkalmaz');
  return plan.length;}

// ---- placing an item: the 05s tool + d.hVar and the item's height, in the placement's undo step ----------------------------
let STD_T={hv:null,code:null};
function stdPlace(code,hv){const en=epOfRole?EP_CAT.find(e=>e.code===code&&(code!=='LMP'||e.role==='sys:LIGHT')):null;if(!en)return false;
  STD_EPTS(code,en.role);STD_T={hv,code};
  const mh=$('modeHint');if(mh)mh.textContent='Lerakás: '+((stdRow(code,hv)||{}).n||code)+' · '+(stdH(code,hv,null)||'')+' mm · Alt: szabad elhelyezés · Esc kilép';return true;}
// any other start of the 05s tool (the picker, a hotkey) forgets the chosen item
const STD_EPTS=epToolStart;
epToolStart=function(code,role,vk){STD_T={hv:null,code:null};return STD_EPTS(code,role,vk);};
EP_PLACED.push((d)=>{const c=epCodeOf(d);if(!STD_T.hv||STD_T.code!==c)return;
  d.hVar=STD_T.hv;const h=stdH(c,d.hVar,d);if(h!=null){d.h=h;d.hStd=h;}});
// suggestion check, info level, on the MAINS roles
['sys:SOC','sys:DED','sys:LIGHT'].forEach(role=>{(STK_CHECKS[role]=STK_CHECKS[role]||[]).push(()=>stdSuggestions().filter(x=>epRoleOf(x.d)===role)
  .map(x=>({sev:'info',code:'std.suggest',msg:(x.d.ref||x.d.id)+': '+x.p.why+' — '+x.p.n+' ('+x.p.h+') javasolt.'})));});

// ---- the panel --------------------------------------------------------------------------------------------------------------------
const STD_UI={on:false,scope:'project',kind:'konyha',room:null,open:{SOC:true}};
function stdScopeKey(){return STD_UI.scope==='kind'?'kind:'+STD_UI.kind:STD_UI.scope==='room'&&STD_UI.room?'room:'+STD_UI.room:'project';}
// the value shown for a row under the chosen scope: that scope's own override, else what it inherits
function stdShown(r){const L=stdList(),sk=stdScopeKey(),own=L.find(o=>o.code===r.code&&o.hv===r.hv&&o.scope===sk);
  if(own)return {h:own.h,own:true};
  const pr=sk!=='project'&&L.find(o=>o.code===r.code&&o.hv===r.hv&&o.scope==='project');return {h:pr?pr.h:r.h,own:false};}
function stdPanelHost(){let h=$('stdPanel');if(!h){h=document.createElement('div');h.id='stdPanel';document.body.appendChild(h);
  const st=document.createElement('style');st.textContent='#stdPanel{position:fixed;right:12px;top:96px;z-index:55;width:330px;max-height:calc(100vh - 130px);overflow:auto;'
   +'background:#fffefb;border:1px solid #d8d3c8;border-radius:10px;box-shadow:0 4px 18px #0002;font-size:12px;padding:8px;display:none;color:#2c2c2c}'
   +'#stdPanel h4{margin:0 0 6px;font-size:13px;display:flex;justify-content:space-between}#stdPanel .x{border:none;background:none;cursor:pointer;font-size:14px}'
   +'#stdPanel .sc{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px}#stdPanel .sc select{font-size:11.5px}'
   +'#stdPanel .g{margin:6px 0 2px;font-weight:700;cursor:pointer;color:#5a6270}#stdPanel .r{display:flex;align-items:center;gap:4px;padding:1px 0}'
   +'#stdPanel .r .nm{flex:1;line-height:1.15}#stdPanel .r .src{display:block;color:#999;font-size:10px}#stdPanel .r input{width:58px;font-size:11.5px;text-align:right}'
   +'#stdPanel .r input.own{border-color:#e8641c;background:#fdf0e7}#stdPanel .fl{color:#c0392b;font-weight:700}#stdPanel button.pl{font-size:11px;padding:1px 5px}'
   +'#stdPanel .sg{background:#f3efe7;border-radius:6px;padding:4px 6px;margin-top:6px}#stdPanel .sg div{display:flex;gap:4px;align-items:center;margin:2px 0}';
  document.head.appendChild(st);
  h.addEventListener('click',e=>{const t=e.target;
    if(t.closest('.x')){stdPanel(false);return;}
    const g=t.closest('[data-g]');if(g){STD_UI.open[g.dataset.g]=!STD_UI.open[g.dataset.g];stdPanelDraw();return;}
    const p=t.closest('[data-place]');if(p){const [c,hv]=p.dataset.place.split('|');stdPlace(c,hv);return;}
    const s=t.closest('[data-swap]');if(s){const d=byId('devices',s.dataset.swap);if(d){stdSwap(d,s.dataset.hv);stdPanelDraw();}return;}
    if(t.closest('[data-apply]')){stdApply('project');return;}});
  h.addEventListener('change',e=>{const t=e.target;
    if(t.dataset.row){const [c,hv]=t.dataset.row.split('|'),r=stdRow(c,hv),v=t.value.trim();
      const inh=stdScopeKey()==='project'?r.h:(stdList().find(o=>o.code===c&&o.hv===hv&&o.scope==='project')||r).h;
      stdSet(c,hv,stdScopeKey(),(v===''||+v===+inh)?null:+v);stdPanelDraw();return;}
    if(t.id==='stdScope'){STD_UI.scope=t.value;stdPanelDraw();return;}
    if(t.id==='stdKind'){STD_UI.kind=t.value;stdPanelDraw();return;}
    if(t.id==='stdRoom'){STD_UI.room=t.value;stdPanelDraw();return;}});}
  return h;}
function stdPanelDraw(){const h=stdPanelHost();if(!STD_UI.on){h.style.display='none';return;}
  const kinds=NEED_KINDS.filter(k=>k.k!=='egyeb'),rooms=data.floors.filter(f=>f.level===state.active&&f.id);
  let s=`<h4>Szabványmagasságok <button class="x" title="Bezár">✕</button></h4><div class="sc"><select id="stdScope">`
    +[['project','Projekt'],['kind','Helyiségtípus'],['room','Ez a helyiség']].map(([k,n])=>`<option value="${k}"${STD_UI.scope===k?' selected':''}>${n}</option>`).join('')+`</select>`;
  if(STD_UI.scope==='kind')s+=`<select id="stdKind">${kinds.map(k=>`<option value="${k.k}"${STD_UI.kind===k.k?' selected':''}>${esc(k.n)}</option>`).join('')}</select>`;
  if(STD_UI.scope==='room')s+=`<select id="stdRoom"><option value="">— helyiség —</option>${rooms.map(f=>`<option value="${f.id}"${STD_UI.room===f.id?' selected':''}>${esc(f.name||f.id)}</option>`).join('')}</select>`;
  s+=`<button data-apply="1" title="Minden eszköz magassága a táblázat szerint (a kézzel mozgatottak maradnak)">Alkalmaz</button></div>`;
  let grp='';STD_H.forEach(r=>{if(r.code!==grp){grp=r.code;s+=`<div class="g" data-g="${grp}">${STD_UI.open[grp]?'▾':'▸'} ${esc(STD_GROUP[grp]||grp)}</div>`;}
    if(!STD_UI.open[grp])return;const v=stdShown(r),canPlace=!/^(PATH|BOX|LVL)$/.test(r.code)&&!(r.code==='LMP'&&r.hv!=='mennyezet');
    s+=`<div class="r"><span class="nm">${r.flag?'<span class="fl" title="megerősítendő">⚑</span> ':''}${esc(r.n)}<span class="src">${esc(r.src||'')}</span></span>`
      +`<input data-row="${r.code}|${r.hv}" value="${v.h==='C'?'':v.h}" placeholder="${v.h==='C'?'menny.':''}" class="${v.own?'own':''}"${v.h==='C'?' disabled':''}> mm`
      +(canPlace?` <button class="pl" data-place="${r.code}|${r.hv}" title="Lerakás">＋</button>`:'')+`</div>`;});
  const sg=stdSuggestions(state.active);
  if(sg.length)s+=`<div class="sg"><b>Javaslatok (${sg.length})</b>${sg.slice(0,12).map(x=>`<div><span style="flex:1">${esc(x.d.ref||x.d.id)} → ${esc(x.p.n)} (${x.p.h}) <span style="color:#999">${esc(x.p.why)}</span></span><button data-swap="${x.d.id}" data-hv="${x.p.hv}">Csere</button></div>`).join('')}</div>`;
  h.innerHTML=s;h.style.display='block';}
function stdPanel(on){STD_UI.on=on==null?!STD_UI.on:!!on;stdPanelDraw();return STD_UI.on;}

registerActions([{id:'wf.standards',label:'Szabványmagasságok',icon:'📏',group:'Készülék',alias:'standards heights szabvany magassag',
  hint:'Eszköz-, pálya- és szintmagasságok projekt / helyiségtípus / helyiség szinten; minden magasság-változat saját tétel.',
  when:c=>!c.inEditor,run:()=>stdPanel(true)}]);
(function(){const b=$('stdBtn');if(b)b.onclick=()=>stdPanel();})();
