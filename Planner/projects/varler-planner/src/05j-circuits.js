// ==========================================================================
// 05j-circuits.js — circuit endpoints: which devices a circuit has to reach
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The first slice of the circuit record planned for schema v3 (docs/wiring_pipeline.md §4):
// a circuit knows its NAME, COLOUR, whether it is DEDIKÁLT, its kismegszakító and its
// END POINTS — the devices it has to reach. Runs (which segments a cable takes) come later.
//
//   data.circuits = [{id:'A12', ref:'A1', name, col:'#1d9e75', dedicated, mcb, members:['D7',…]}]
//
// - dedikált: exactly one end point, wired straight to the Elosztó.
// - több pontos: several end points that first have to reach each other inside the room.
// - A device is the end point of at most ONE circuit. Elosztó and kötődoboz are never end points:
//   wires pass through or are cut there, they don't end there.
// - Members are device ids, not indices; a deleted device simply stops resolving.
// - Circuits live on no layer. The same end points stay valid whichever layer's routing
//   proposal they are later wired along.
//
// Nothing here is drawn unless a circuit exists, so a document without circuits renders
// byte-identically to one made before this module.

// ---- the record ----
function cktList(){if(!Array.isArray(data.circuits))data.circuits=[];return data.circuits;}
function cktById(id){return id?byId('circuits',id):null;}
function cktMembers(c){return ((c&&c.members)||[]).map(id=>byId('devices',id)).filter(Boolean);}
function cktOfDevice(d){if(!d||!d.id||!Array.isArray(data.circuits))return null;
  for(const c of data.circuits)if(c&&(c.members||[]).indexOf(d.id)>=0)return c;return null;}
function cktCanJoin(d){return !!d&&d.type!=='board'&&d.type!=='junction';}
var CKT_COLS=['#1d9e75','#d85a30','#7f77dd','#d4537e','#2f79c9','#b8901f','#16a3b8','#8e44ad','#5d8a1f','#c0392b'];
function cktColor(c){return (c&&/^#[0-9a-f]{6}$/i.test(c.col||''))?c.col:'#888888';}
function cktNextRef(){let n=0;cktList().forEach(c=>{const m=/^A(\d+)$/.exec((c&&c.ref)||'');if(m)n=Math.max(n,+m[1]);});return 'A'+(n+1);}
function cktNextCol(){const used=cktList().map(c=>c.col);
  return CKT_COLS.find(x=>used.indexOf(x)<0)||CKT_COLS[cktList().length%CKT_COLS.length];}
function cktLabel(c){return c?[c.ref,c.name].filter(Boolean).join(' '):'';}
// Create a circuit (with an id) and return it. The caller pushes undo first.
function cktCreate(o){o=o||{};
  const c={ref:cktNextRef(),name:o.name||'Új áramkör',col:o.col||cktNextCol(),dedicated:!!o.dedicated,
    mcb:o.mcb||null,members:[]};
  cktList().push(c);ensureIds(data);
  (o.members||[]).forEach(id=>cktAssign(c,byId('devices',id)));
  return c;}
// make d an end point of c, taking it out of any other circuit; a dedikált circuit keeps only d
function cktAssign(c,d){if(!c||!cktCanJoin(d))return false;if(!d.id)ensureIds(data);
  const other=cktOfDevice(d);if(other===c)return true;
  if(other)other.members=other.members.filter(x=>x!==d.id);
  if(c.dedicated)c.members=[d.id];else (c.members=c.members||[]).push(d.id);
  return true;}
function cktRelease(d){const c=cktOfDevice(d);if(!c)return false;c.members=c.members.filter(x=>x!==d.id);return true;}
function cktSetDedicated(c,on){c.dedicated=!!on;
  if(c.dedicated&&(c.members||[]).length>1)c.members=c.members.slice(0,1);}
// where a circuit stands on its way to the Behúzás
function cktStatus(c){const n=cktMembers(c).length;
  if(!n)return {k:'empty',t:'nincs végpont'};
  if(c.dedicated)return n===1?{k:'ready',t:'dedikált · kész a Behúzásra'}:{k:'bad',t:'dedikált, de '+n+' végpont'};
  return n===1?{k:'open',t:'1 végpont · bővíthető'}:{k:'multi',t:n+' végpont · szobán belül összekötendő'};}

// ---- kismegszakító ----
// Written the way the Kalkulátor and the Inventory write it: `1C 13A` (poles, characteristic,
// rating), and `1P-N C16A` for a pole plus switched neutral. Typed forms such as `C13A1P`,
// `c16 3p` or `B10` are read too. The DIN rail width follows from the poles: one module per pole,
// plus one for a switched N — the Kalkulátor counts `1P-N` as 2 modules and `3P-N` as 4.
function mcbParse(s){s=String(s||'').toUpperCase().replace(/\s+/g,' ').trim();
  if(!s)return {empty:true};
  const withN=/(\d|P)\s*[-+]\s*N\b/.test(s);
  const ca=/([BCDKZ])\s*(\d{1,3})\s*A?(?![0-9])/.exec(s.replace(/(\d|P)\s*[-+]\s*N\b/,'$1'));
  if(!ca)return {err:'Hiányzik a karakterisztika és a névleges áram (pl. 1C 13A).'};
  let poles=null;const pm=/(\d)\s*P\b/.exec(s);
  if(pm)poles=+pm[1];else{const lead=/^(\d)\s*[BCDKZ]/.exec(s);poles=lead?+lead[1]:1;}
  const amps=+ca[2];
  if(poles<1||poles>4)return {err:'A pólusszám 1–4 lehet.'};
  if(amps<1||amps>125)return {err:'A névleges áram 1–125 A lehet.'};
  return {curve:ca[1],amps,poles,n:withN};}
function mcbText(m){if(!m||!m.curve)return '';
  return m.n?`${m.poles}P-N ${m.curve}${m.amps}A`:`${m.poles}${m.curve} ${m.amps}A`;}
function mcbModules(m){return (m&&m.curve)?m.poles+(m.n?1:0):0;}

// ---- plan symbols ----
// the ring around an end point: solid = dedikált, dashed = több pontos
function cktRingSvg(d,x,y,k,back){const c=cktOfDevice(d);if(!c)return '';
  // written in the symbol's own unit (05z), so the ring keeps hugging the body when the view scale
  // switches the bodies to real millimetres. In screen mode this is exactly `k`.
  const u=(typeof icoRingU==='function')?icoRingU(d,k):k;
  const R=v=>+(v*u).toFixed(2),col=cktColor(c);
  const dash=c.dedicated?'':` stroke-dasharray="${R(3.2)} ${R(2.4)}"`;
  const hot=(cktPick===c.id);
  return (hot?`<circle cx="${x}" cy="${y}" r="${R(12.5)}" fill="${col}" fill-opacity="0.16"/>`:'')
    +`<circle cx="${x}" cy="${y}" r="${R(10.5)}" fill="none" stroke="${col}" stroke-width="${R(hot?2.8:2.2)}"${dash}${back?' opacity="0.6"':''}/>`;}
// A layer may tint the body of every device on it, so two layouts (old and new) shown together
// stay apart. The tint is the layer colour washed towards white, keeping the symbol's lines legible.
// A hand-picked tint still wins and still implies "paint it" (that is what the picker always did);
// otherwise the layer's own colour is used only when its swatch is switched on (05l).
function layerTintOf(d){const L=layerById((d&&d.layer)||'L0');if(!L)return null;
  if(/^#[0-9a-f]{6}$/i.test(L.tint||''))return L.tint;
  return (typeof lyrPaints==='function'&&lyrPaints(L))?lyrAutoCol(L):null;}
function tintMix(hex,a){const n=parseInt(hex.slice(1),16),m=v=>Math.round(255-(255-v)*a);
  return '#'+[m(n>>16&255),m(n>>8&255),m(n&255)].map(v=>v.toString(16).padStart(2,'0')).join('');}

// The shell caches its stage checks per scene version. Renaming a circuit, adding an empty one or
// changing its breaker leaves the scene as it was, so the Áramkörök checks are dropped by hand.
function cktRedraw(){if(typeof invalidateShell==='function')invalidateShell();draw();}

// ---- pick mode: click devices on the plan to make them end points of one circuit ----
// var, not let: devSym reads cktPick, and a draw() before this line runs must not hit a TDZ
var cktPick=null,cktLast=null;
function cktPickHint(){const c=cktById(cktPick);if(!c)return '';
  return `⚡ ${cktLabel(c)} — kattints a készülékekre (újra kattintva kiveszi) · ${kbdKey('circuit')} vagy Esc = kész`;}
function cktPickStart(id){const c=cktById(id);if(!c)return false;
  if(state.mode!=='select')setMode('select');
  cktPick=c.id;cktLast=c.id;selected=null;if(typeof clearMulti==='function')clearMulti();
  const mh=$('modeHint');if(mh)mh.textContent=cktPickHint();
  $('hud').textContent=cktPickHint()+' · '+cktStatus(c).t;cktRedraw();return true;}
function cktPickStop(){if(!cktPick)return false;cktPick=null;
  const mh=$('modeHint');if(mh&&typeof HINTS!=='undefined')mh.textContent=HINTS[state.mode]||'';
  cktRedraw();return true;}
function cktPickToggle(di){const c=cktById(cktPick),d=data.devices[di];if(!c||!d)return;
  if(!cktCanJoin(d)){$('hud').textContent='Elosztó és kötődoboz nem lehet végpont — rajtuk a vezeték áthalad.';return;}
  pushUndo(['circuits']);
  const mine=cktOfDevice(d)===c,was=cktOfDevice(d);
  if(mine)cktRelease(d);else cktAssign(c,d);
  $('hud').textContent=(d.ref||d.id)+(mine?' kivéve: ':(was?' áthelyezve ide: ':' hozzáadva: '))+cktLabel(c)+' · '+cktStatus(c).t;
  cktRedraw();}
// the circuit a command acts on: the one being picked, else the selected device's
function cktCurrent(){if(cktPick)return cktById(cktPick);
  const o=(typeof selected!=='undefined'&&selected&&selected.t==='devices')?data.devices[selected.i]:null;
  return cktOfDevice(o);}
function cktSelDevices(){const hs=(typeof selList==='function')?selList():[];
  return hs.filter(h=>h&&h.t==='devices').map(h=>data.devices[h.i]).filter(cktCanJoin);}

// ---- edit dialog ----
function cktEditDialog(c){if(!c)return;
  const a=v=>esc(String(v==null?'':v)).replace(/"/g,'&quot;');
  const refs=cktMembers(c).map(d=>d.ref||d.id);
  openModal('Áramkör — '+esc(cktLabel(c)),
    `<div class="mrow"><label style="width:92px">Jelölés</label><input id="ckRef" value="${a(c.ref)}" style="width:70px">`
   +` <input id="ckCol" type="color" value="${cktColor(c)}" style="width:40px;height:24px" title="Szín"></div>`
   +`<div class="mrow"><label style="width:92px">Név</label><input id="ckName" value="${a(c.name)}" style="flex:1"></div>`
   +`<div class="mrow"><label><input type="checkbox" id="ckDed" ${c.dedicated?'checked':''}> dedikált — egyetlen végpont, közvetlenül az Elosztóra</label></div>`
   +`<div class="mrow"><label style="width:92px">Kismegszakító</label><input id="ckMcb" value="${a(mcbText(c.mcb))}" placeholder="1C 13A" style="width:110px">`
   +` <span id="ckMcbOut" style="font-size:11px;color:#777"></span></div>`
   +`<div class="mrow" style="font-size:11px;color:#777">Írható így is: C13A1P · 1P-N C16A · 3C 20A. A pólusszámból jön, hány DIN modult foglal.</div>`
   +`<div class="mrow" style="font-size:11px;color:#555">Végpontok (${refs.length}): ${esc(refs.join(' · ')||'—')}</div>`,
    ()=>{const m=mcbParse($('ckMcb').value);if(m.err){$('ckMcbOut').textContent='⚠ '+m.err;$('ckMcbOut').style.color='#c0392b';return false;}
      pushUndo(['circuits']);
      c.ref=$('ckRef').value.trim()||c.ref;c.name=$('ckName').value.trim();c.col=$('ckCol').value;
      c.mcb=m.empty?null:{curve:m.curve,amps:m.amps,poles:m.poles,n:m.n};
      cktSetDedicated(c,$('ckDed').checked);cktRedraw();},'Mentés');
  const out=()=>{const m=mcbParse($('ckMcb').value),o=$('ckMcbOut');o.style.color='#777';
    o.textContent=m.empty?'nincs megadva':m.err?'⚠ '+m.err:'→ '+mcbText(m)+' · '+mcbModules(m)+' modul';
    if(m.err)o.style.color='#c0392b';};
  $('ckMcb').oninput=out;out();}

// ---- export: the circuit list as data, for the Inventory and the Elosztó tool ----
function cktExportObj(){
  const byMcb={};let modules=0;
  const list=cktList().map(c=>{const m=c.mcb&&c.mcb.curve?c.mcb:null,mt=mcbText(m);
    if(m){byMcb[mt]=(byMcb[mt]||0)+1;modules+=mcbModules(m);}
    return {id:c.id,ref:c.ref||'',name:c.name||'',color:cktColor(c),dedicated:!!c.dedicated,status:cktStatus(c).k,
      mcb:m?{text:mt,curve:m.curve,amps:m.amps,poles:m.poles,n:!!m.n,modules:mcbModules(m)}:null,
      members:cktMembers(c).map(d=>{const r=(typeof roomOfDevice==='function')?roomOfDevice(d):null;
        return {id:d.id,ref:d.ref||'',type:d.type,typeLabel:(typeof devTypeLabel==='function')?devTypeLabel(d):d.type,
          kind:d.kind||'',level:d.level,layer:d.layer||'L0',layerName:(layerById(d.layer||'L0')||{}).name||'',
          room:r?{num:r.rm.num||'',name:r.rm.name||''}:null};})};});
  return {format:'vrg-circuits',version:1,project:(typeof B!=='undefined'&&B&&B.name)||'',
    exported:new Date().toISOString(),totals:{circuits:list.length,modules,byMcb},circuits:list};}
function cktExport(){const o=cktExportObj(),nm=(o.project||'terv').replace(/[^\w\-]+/g,'_');
  download(nm+'_aramkorok.json',JSON.stringify(o,null,2));
  $('hud').textContent='Áramkörök exportálva: '+o.circuits.length+' kör, '+o.totals.modules+' modul.';}

// ---- inspector ----
function cktSwatch(c){return `<span class="ckSw${c.dedicated?'':' multi'}" style="border-color:${cktColor(c)};background:${c.dedicated?cktColor(c):'transparent'}"></span>`;}
// the line under a selected device, in any stage
function cktDeviceHtml(d){if(!d||!cktCanJoin(d))return '';const c=cktOfDevice(d);
  return `<div class="insCkt"><div class="insRoomH"><b>Áramkör</b>`
    +(c?`<span>${esc(mcbText(c.mcb)||'—')}</span></div><div class="ckLine">${cktSwatch(c)}${esc(cktLabel(c))}</div>`
       :`<span></span></div><div class="insSub">nincs áramkörben — ${kbdKey('circuit')}: végpont kijelölés</div>`)+`</div>`;}
// the circuit list, in the Áramkörök stage
function cktListHtml(){const L=cktList();let mods=0;L.forEach(c=>mods+=mcbModules(c.mcb));
  const head=`<div class="insRoomH"><b>Áramkörök</b><span>${L.length} db${mods?' · '+mods+' modul':''}</span></div>`;
  if(!L.length)return `<div class="insCkt">${head}<div class="insSub">Még nincs áramkör. K vagy „Új áramkör”, majd kattints a végpontokra.</div></div>`;
  return `<div class="insCkt">${head}`+L.map(c=>{const st=cktStatus(c);
    return `<div class="ckCard${cktPick===c.id?' on':''}" data-ck="${esc(c.id)}">`
      +`<div class="ckLine">${cktSwatch(c)}<b>${esc(c.ref||'')}</b>&nbsp;${esc(c.name||'')}<span style="flex:1"></span>`
      +`<button class="ckEd" data-cke="${esc(c.id)}" title="Szerkesztés">✎</button></div>`
      +`<div class="insSub">${esc(mcbText(c.mcb)||'nincs kismegszakító')} · <span class="ckSt ${st.k}">${esc(st.t)}</span></div></div>`;}).join('')
    +`</div>`;}
function cktInspectorHtml(sel,stageKey){let s='';
  if(sel&&sel.t==='devices')s+=cktDeviceHtml(data.devices[sel.i]);
  if(stageKey==='circuits')s+=cktListHtml();
  return s;}
function cktBindInspector(root){if(!root)return;
  root.querySelectorAll('.ckCard[data-ck]').forEach(el=>el.onclick=e=>{
    if(e.target&&e.target.dataset&&e.target.dataset.cke)return;
    const id=el.dataset.ck;if(cktPick===id)cktPickStop();else cktPickStart(id);});
  root.querySelectorAll('.ckEd[data-cke]').forEach(b=>b.onclick=e=>{e.stopPropagation();cktEditDialog(cktById(b.dataset.cke));});}

// ---- stage check ----
function cktChecks(){const out=[],L=cktList();
  const cand=data.devices.filter(d=>cktCanJoin(d)&&!cktOfDevice(d)).length;
  if(!L.length){out.push({sev:'info',msg:'Még nincs áramkör — '+kbdKey('circuit')+': végpontok kijelölése.'});return out;}
  const empty=L.filter(c=>!cktMembers(c).length).length;
  if(empty)out.push({sev:'warn',msg:empty+' áramkörnek nincs végpontja.'});
  const bad=L.filter(c=>cktStatus(c).k==='bad').length;
  if(bad)out.push({sev:'warn',msg:bad+' dedikált áramkörnek több végpontja van.'});
  const noMcb=L.filter(c=>!(c.mcb&&c.mcb.curve)).length;
  if(noMcb)out.push({sev:'info',msg:noMcb+' áramkörnél nincs megadva kismegszakító.'});
  if(cand)out.push({sev:'info',msg:cand+' készülék még nincs áramkörben.'});
  return out;}

// ---- actions ----
registerActions([
 {id:'circuit.pick',alias:'aramkor vegpont endpoint circuit pick kor',label:'Végpontok kijelölése',icon:'⚡',group:'Áramkör',keys:['k'],
  hint:'Kattints a készülékekre a rajzon: az aktív áramkör végpontjai lesznek. K vagy Esc = kész.',
  when:c=>!c.inEditor,
  run:()=>{if(cktPick){cktPickStop();return;}
    let c=cktCurrent()||cktById(cktLast)||cktList()[cktList().length-1];
    if(!c){pushUndo(['circuits']);c=cktCreate();}
    cktPickStart(c.id);}},
 {id:'circuit.new',alias:'uj aramkor new circuit',label:'Új áramkör',icon:'＋',group:'Áramkör',
  hint:'Új áramkör, és rögtön a végpontjai kijelölése.',
  when:c=>!c.inEditor,run:()=>{pushUndo(['circuits']);const c=cktCreate();cktPickStart(c.id);}},
 {id:'circuit.fromSel',alias:'kijeloltekbol aramkor selection circuit',label:'Kijelöltekből áramkör',icon:'⚡',group:'Áramkör',
  need:'Jelölj ki egy vagy több készüléket (Ctrl+kattintás).',
  hint:'A kijelölt készülékek egy új áramkör végpontjai lesznek; egy készülék esetén dedikált.',
  when:c=>!c.inEditor&&cktSelDevices().length>0,
  run:()=>{const ds=cktSelDevices();pushUndo(['circuits']);
    const c=cktCreate({dedicated:ds.length===1});ds.forEach(d=>cktAssign(c,d));cktLast=c.id;
    $('hud').textContent=cktLabel(c)+' · '+cktStatus(c).t;cktRedraw();cktEditDialog(c);}},
 {id:'circuit.edit',alias:'aramkor szerkesztes kismegszakito mcb',label:'Áramkör szerkesztése…',icon:'✎',group:'Áramkör',
  need:'Válassz egy áramkörbe tartozó készüléket, vagy lépj végpont kijelölésbe.',
  hint:'Név, szín, dedikált, kismegszakító (pl. 1C 13A).',
  when:c=>!c.inEditor&&!!cktCurrent(),run:()=>cktEditDialog(cktCurrent())},
 {id:'circuit.release',alias:'kivetel aramkorbol remove from circuit',label:'Kivétel az áramkörből',icon:'⊖',group:'Áramkör',
  need:'Válassz egy áramkörbe tartozó készüléket.',
  when:c=>!c.inEditor&&c.selType==='devices'&&!!cktOfDevice(data.devices[c.sel.i]),
  run:c=>{pushUndo(['circuits']);cktRelease(data.devices[c.sel.i]);cktRedraw();}},
 {id:'circuit.remove',alias:'aramkor torlese delete circuit',label:'Áramkör törlése',icon:'🗑',group:'Áramkör',
  need:'Válassz egy áramkört (végpont kijelölés vagy egy tagja).',
  hint:'Csak a kört törli; a készülékek maradnak.',
  when:c=>!c.inEditor&&!!cktCurrent(),
  run:()=>{const c=cktCurrent();if(!c||!confirm('Törlöd: '+cktLabel(c)+'? A készülékek megmaradnak.'))return;
    pushUndo(['circuits']);data.circuits=cktList().filter(x=>x!==c);if(cktPick===c.id)cktPickStop();cktRedraw();}},
 {id:'circuit.export',alias:'aramkorok export json inventory',label:'Áramkörök exportálása',icon:'⬇',group:'Áramkör',
  hint:'JSON: áramkörök, végpontok helyiséggel, kismegszakító és DIN modulszám — az Inventory és az Elosztó eszköz is olvassa.',
  run:()=>cktExport()}
]);

// test hooks
window.cktList=cktList;window.cktById=cktById;window.cktMembers=cktMembers;window.cktOfDevice=cktOfDevice;
window.cktCreate=cktCreate;window.cktAssign=cktAssign;window.cktRelease=cktRelease;window.cktSetDedicated=cktSetDedicated;
window.cktStatus=cktStatus;window.mcbParse=mcbParse;window.mcbText=mcbText;window.mcbModules=mcbModules;
window.cktPickStart=cktPickStart;window.cktPickStop=cktPickStop;window.cktPickToggle=cktPickToggle;
window.cktExportObj=cktExportObj;window.cktRingSvg=cktRingSvg;window.layerTintOf=layerTintOf;window.tintMix=tintMix;
window.cktIsPicking=()=>cktPick;window.cktChecks=cktChecks;
