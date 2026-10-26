// ==========================================================================
// 08s-villany.js — round 2026-10-22: the Villany Stack's own behaviour (V3, V5, V6, V8)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The kinds and the role table are in 05m (V1, V2); the catalogue entries in 05s; the hardware "Elosztó" of each
// ordinary system (MDB · TJK · EPH, SSC as the alarm panel) in 05p. This module holds what only the Villany Stack does:
//   V3  Meglévő / bontás — d.ex = keep (default) · remove · replace on every item of an `exist` layer, its marks, menu,
//       check and the Bontás / Ellenőrzés BOM rows (D8, Q-V12 A). Keep / remove are never material.
//   V5  the checks of Érintésvédelem, Riasztó, Tűzvédelem, Gyengeáram: each system wants its own "Elosztó".
//   V6  vstPathLayer — channel / arm resolve to `route` in a Villany Stack, so every path tool and the engine work there.
//   V8  vstPromote — one undo step from Villany to BRIDGE: Gyengeáram and Riasztó dissolve into their purpose layers
//       (Q-V07 A, Q-V08 A), an empty `route` goes (Q-V06 A), the missing BRIDGE roles are added; nothing is duplicated.
// Prefix: vst.

// ---- V3 Meglévő / bontás ----------------------------------------------------------------------------------------------------
const VST_EX={keep:{n:'Megmarad',c:'#8f8f8f'},remove:{n:'Bontandó',c:'#d32f2f'},replace:{n:'Cserélendő',c:'#ef6c00'}};
function vstIsExistLayer(id){const L=lyrLayer(id);return !!(L&&L.role==='exist');}
// the state of an existing item, or null when the item is not on a Meglévő layer
function vstExistOf(d){return d&&vstIsExistLayer(d.layer)?(VST_EX[d.ex]?d.ex:'keep'):null;}
function vstSetEx(d,ex){if(!d||!VST_EX[ex])return false;pushUndo(['devices']);if(ex==='keep')delete d.ex;else d.ex=ex;draw();
  lyrHud((d.ref||d.id)+': '+VST_EX[ex].n);return true;}
function vstExistName(d){const c=epCodeOf(d),e=c?(epEntryOf(d)||epEntry(c)):null;return e?e.n:(DEV[d.type]||d.type);}
// the state mark drawn over the symbol: keep a grey ring, remove a red cross, replace an orange square — scene, so it prints
function vstExistMark(d){const ex=vstExistOf(d);if(!ex)return '';
  const b=planToBase(d.x,d.y,dz(d.level,d.h||0)),k=devK(),R=v=>+(v*k).toFixed(2),c=VST_EX[ex].c,x=b[0],y=b[1];
  if(ex==='remove')return `<g class="vstEx vstEx-remove" stroke="${c}" stroke-width="${R(2.2)}" stroke-linecap="round" pointer-events="none">`
    +`<line x1="${x-R(10)}" y1="${y-R(10)}" x2="${x+R(10)}" y2="${y+R(10)}"/><line x1="${x-R(10)}" y1="${y+R(10)}" x2="${x+R(10)}" y2="${y-R(10)}"/></g>`;
  if(ex==='replace')return `<rect class="vstEx vstEx-replace" x="${x-R(11)}" y="${y-R(11)}" width="${R(22)}" height="${R(22)}" rx="${R(3)}" fill="none" stroke="${c}" stroke-width="${R(1.8)}" pointer-events="none"/>`;
  return `<circle class="vstEx vstEx-keep" cx="${x}" cy="${y}" r="${R(11)}" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="${R(1.2)}" pointer-events="none"/>`;}
STK_SCENE.push(()=>{let s='';data.devices.forEach(d=>{if(!d||!state.levels[d.level]||!vstIsExistLayer(d.layer))return;
  if(typeof layerShows==='function'&&!layerShows(d,'device'))return;s+=vstExistMark(d);});return s;});
STK_DEVMENU.push((di,items)=>{const d=data.devices[di],ex=vstExistOf(d);if(!ex)return;
  Object.keys(VST_EX).forEach(k=>{if(k!==ex)items.push({label:'⌫ '+VST_EX[k].n,act:()=>vstSetEx(d,k)});});});
STK_LAYERMENU.push((L,items)=>{if(L.role!=='exist')return;
  items.push({label:'⌫ Bontási terv (csak ez a réteg)',act:()=>rliSolo(L.id)});});
(STK_CHECKS.exist=STK_CHECKS.exist||[]).push(S=>{const L=stkLayer(S.id,'exist'),out=[];if(!L)return out;
  const mine=data.devices.filter(d=>d&&d.layer===L.id);if(!mine.length){out.push({sev:'info',msg:'Nincs meglévő pont felvéve.'});return out;}
  const n=k=>mine.filter(d=>vstExistOf(d)===k).length;
  out.push({sev:'info',msg:'Meglévő pontok: '+n('keep')+' megmarad · '+n('remove')+' bontandó · '+n('replace')+' cserélendő.'});
  // a replace with no new item of the same code within 300 mm on a design layer of the stack
  mine.filter(d=>vstExistOf(d)==='replace').forEach(d=>{const c=epCodeOf(d);
    const hit=data.devices.some(x=>x&&x!==d&&x.level===d.level&&epCodeOf(x)===c&&!vstIsExistLayer(x.layer)&&Math.hypot(x.x-d.x,x.y-d.y)<=300);
    if(!hit)out.push({sev:'info',msg:(d.ref||d.id)+' cserélendő, de nincs új '+(c||d.type)+' 300 mm-en belül a tervezett rétegeken.'});});
  return out;});
// D8 / Q-V12 A: remove and replace give a Bontás row, keep an Ellenőrzés row; the new item of a replace is the design
// layer's own material, so nothing is counted twice
function vstBomRows(){const g={};data.devices.forEach(d=>{const ex=vstExistOf(d);if(!ex)return;
  const key=(ex==='keep'?'ell':'bont')+'_'+(epCodeOf(d)||d.type),nm=(ex==='keep'?'Ellenőrzés – meglévő ':'Bontás – ')+vstExistName(d);
  (g[key]=g[key]||{id:key,name:nm,qty:0,unit:'db'}).qty++;});
  return Object.keys(g).sort().map(k=>g[k]);}
// Q-V08 / Q-V09 A: alarm and fire points are cable work only — no device material, one box row each
function vstCableOnly(d){const L=d&&lyrLayer(d.layer);return !!(d&&(d.cableOnly||(L&&(L.role==='sys:ALARM'||L.role==='sys:FIRE'))));}
function vstCableOnlyRows(){const g={};data.devices.forEach(d=>{if(!vstCableOnly(d))return;const L=lyrLayer(d.layer),fire=L&&L.role==='sys:FIRE';
  const key=(fire?'tuz':'riaszto')+'_'+(epCodeOf(d)||d.type);
  (g[key]=g[key]||{id:key,name:(fire?'Tűzjelző':'Riasztó')+' pont (doboz + kábel, eszköz nélkül) – '+vstExistName(d),qty:0,unit:'db'}).qty++;});
  return Object.keys(g).sort().map(k=>g[k]);}

// ---- V5 checks: every ordinary system wants its own Elosztó --------------------------------------------------------------
function vstHubCheck(role,type,msg,sev){(STK_CHECKS[role]=STK_CHECKS[role]||[]).push(S=>{const L=stkLayer(S.id,role);if(!L)return [];
  const used=data.devices.some(d=>d&&d.layer===L.id);if(!used||hwList(type).length)return [];return [{sev:sev||'warn',msg}];});}
vstHubCheck('sys:WEAK','mdb','Van gyengeáramú végpont, de nincs gyengeáramú elosztó (médiadoboz) — Betáplálás és elosztás.','info');
vstHubCheck('sys:ALARM','ssc','Van riasztópont, de nincs riasztóközpont (SSC) — Betáplálás és elosztás.');
vstHubCheck('sys:FIRE','fire','Van tűzjelző pont, de nincs tűzjelző központ — Betáplálás és elosztás.');
vstHubCheck('sys:BOND','eph','Van EPH-bekötés, de nincs fő EPH sín — Betáplálás és elosztás.');
// MSZ HD 60364-7-701: a bathroom gets its supplementary bonding
(STK_CHECKS['sys:BOND']=STK_CHECKS['sys:BOND']||[]).push(S=>{const L=stkLayer(S.id,'sys:BOND'),out=[];if(!L)return out;
  ORD.forEach(l=>stkRooms(l).forEach(r=>{const k=(r.rm.kinds&&r.rm.kinds.length?r.rm.kinds:[r.rm.kind]).filter(Boolean);
    if(k.indexOf('furdo')<0)return;
    const has=data.devices.some(d=>d&&d.layer===L.id&&epCodeOf(d)==='EPB'&&epRoomOf(d)===r.id);
    if(!has)out.push({sev:'warn',msg:(r.name||r.id)+': fürdő EPH-bekötés (EPB) nélkül.'});}));
  return out;});

// ---- V6 the path layer ----------------------------------------------------------------------------------------------------
// channel / arm: the role's own layer, else — in a Villany Stack — Nyomvonal és dobozok
function vstPathLayer(S,k){if(!S)return null;return stkLayer(S.id,k)||(stkKindOf(S)==='elec'&&(k==='channel'||k==='arm')?stkLayer(S.id,'route'):null);}

// ---- V8 promotion to BRIDGE -------------------------------------------------------------------------------------------------
// the BRIDGE layer an item of a dissolving elec layer moves to: its code's purpose (Q-V07 A, Q-V08 A)
function vstTargetRole(d){const c=epCodeOf(d),L=lyrLayer(d.layer);
  const e=EP_CAT.find(x=>x.code===c&&x.alt&&L&&x.alt.indexOf(L.role)>=0)||(c?epEntry(c):null);return e?e.role:null;}
function vstAutoName(S,L,kind){return STK_KINDS[kind].short+(stacks.indexOf(S)+1)+' · '+stkRoleName(L.role,kind);}
function vstPromote(id,opt){opt=opt||{};const S=stkById(id);if(!S||stkKindOf(S)!=='elec')return null;
  pushUndo(['devices','paths','circuits','__walls','__layers']);   // one undo step: items, layers, the stack record
  const named=stkLayersOf(S.id).filter(L=>L.name===vstAutoName(S,L,'elec'));   // user-renamed layers keep their names
  S.kind='bridge';
  const ensure=role=>{let L=stkLayer(S.id,role);if(L)return L;const r=stkRole(role);if(!r)return null;L=stkMakeLayer(S,r);layers.push(L);return L;};
  const rep={moved:0,added:[],removed:[]};
  // Gyengeáram and Riasztó: every item to its purpose layer; Riasztó items stay cable-only in Biztonságtechnika
  ['sys:WEAK','sys:ALARM'].forEach(role=>{const L=stkLayer(S.id,role);if(!L)return;
    data.devices.forEach(d=>{if(!d||d.layer!==L.id)return;const T=ensure(vstTargetRole(d)||'sys:SECURITY');if(!T)return;
      if(role==='sys:ALARM')d.cableOnly=true;d.layer=T.id;rep.moved++;});
    if(!rliCount(L.id)){layers.splice(layers.indexOf(L),1);rep.removed.push(role);}});
  // Nyomvonal és dobozok (Q-V06 A): a conduit between two fixed points → Csatorna, every other run → ARM; empty → removed
  const R=stkLayer(S.id,'route');
  if(R){const fixed=n=>{const d=n&&n.dev?byId('devices',n.dev):null;return !!(d&&(hwIs(d)||d.type==='board'));};
    data.paths.forEach(p=>{if(!p||p.layer!==R.id)return;const N=p.nodes||[];
      p.layer=ensure(N.length&&fixed(N[0])&&fixed(N[N.length-1])?'channel':'arm').id;rep.moved++;});
    if(!rliCount(R.id)){layers.splice(layers.indexOf(R),1);rep.removed.push('route');}}
  // the BRIDGE roles the stack lacks: phase 1 always, phase 2 the defaults (or opt.roles)
  const want=opt.roles||stkRolesOf('bridge').filter(r=>r.ph===2&&!r.off).map(r=>r.k);
  stkRolesOf('bridge').forEach(r=>{if(stkLayer(S.id,r.k)||stkRoleOpt(r,'bridge'))return;if(r.ph===1||want.indexOf(r.k)>=0){ensure(r.k);rep.added.push(r.k);}});
  named.forEach(L=>{if(layers.indexOf(L)>=0)L.name=vstAutoName(S,L,'bridge');});
  if(/^Villany( Stack)?( \d+)?$/.test(S.name||''))S.name=S.name.replace(/^Villany( Stack)?/,'BRIDGE Stack');
  stkSync(S);lyrRefresh();if(typeof invalidateShell==='function')invalidateShell();draw();
  lyrHud('BRIDGE Stackké bővítve: '+rep.added.length+' új réteg, '+rep.moved+' elem áthelyezve'+(rep.removed.length?', '+rep.removed.length+' réteg feloldva':'')+'.');
  return rep;}
registerActions([
 {id:'stack.promote',alias:'bovites bridge stack promote villany okosotthon',label:'Bővítés BRIDGE Stackké',icon:'⇪',group:'Stack',
  hint:'Az aktív Villany Stack egy lépésben BRIDGE Stack lesz: a Gyengeáram és a Riasztó pontjai a cél rétegükre kerülnek, a hiányzó BRIDGE rétegek létrejönnek. Visszavonható.',
  need:'Aktív Villany Stack kell hozzá.',when:()=>{const S=stkActive();return !!(S&&stkKindOf(S)==='elec');},run:()=>vstPromote(stkActive().id)}]);

window.VST_EX=VST_EX;window.vstExistOf=vstExistOf;window.vstSetEx=vstSetEx;window.vstBomRows=vstBomRows;window.vstCableOnly=vstCableOnly;
window.vstCableOnlyRows=vstCableOnlyRows;window.vstPathLayer=vstPathLayer;window.vstPromote=vstPromote;window.vstTargetRole=vstTargetRole;
