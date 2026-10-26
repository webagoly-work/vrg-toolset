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
// 2026-10-26 follow-up: V7 (the Áramkörök és védelem stage), Meglévő paths and the printed legend, the IP44 default
// outdoors (D5), the fire-resistant switch (Q-V10 A), and the switch-sensors with Kizárás / Szabotázs.
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
  const want=opt.roles||stkRolesOf('bridge').filter(r=>r.ph===2&&!stkRoleOff(r,'bridge')).map(r=>r.k);
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

// ---- V3 (2026-10-26): Meglévő paths — the same three states, drawn over the path; the printed legend ---------------------
const VST_EX_DASH={keep:'6 4',remove:'9 4',replace:''};
function vstPathEx(p){return p&&vstIsExistLayer(p.layer)?(VST_EX[p.ex]?p.ex:'keep'):null;}
function vstPathSvg(p){const ex=vstPathEx(p);if(!ex||!p.nodes||p.nodes.length<2)return '';
  const pts=p.nodes.map(n=>planToBase(n.x,n.y,dz(n.level,n.h||0)).map(v=>v.toFixed(1)).join(',')).join(' '),k=devK(),c=VST_EX[ex].c;
  return `<polyline class="vstExPath vstEx-${ex}" points="${pts}" fill="none" stroke="${c}" stroke-width="${(2.6*k).toFixed(2)}" stroke-opacity="0.85"`
    +(VST_EX_DASH[ex]?` stroke-dasharray="${VST_EX_DASH[ex]}"`:'')+` pointer-events="none"/>`;}
STK_SCENE.push(()=>{let s='';data.paths.forEach(p=>{if(!p||!vstIsExistLayer(p.layer)||!p.nodes||!p.nodes.length||!state.levels[p.nodes[0].level])return;
  if(typeof layerShows==='function'&&!layerShows(p,'path'))return;s+=vstPathSvg(p);});return s;});
STK_PATHMENU.push((ps,items)=>{const p=data.paths[ps.pi],ex=vstPathEx(p);if(!ex)return;
  Object.keys(VST_EX).forEach(k=>{if(k!==ex)items.push({label:'⌫ Nyomvonal: '+VST_EX[k].n,act:()=>{pushUndo(['paths']);if(k==='keep')delete p.ex;else p.ex=k;draw();}});});});
function vstPathLen(p){let L=0;for(let i=0;i<p.nodes.length-1;i++)L+=sectionLen(p,i);return L;}
function vstPathBomRows(){const g={};data.paths.forEach(p=>{const ex=vstPathEx(p);if(!ex)return;const k=ex==='keep'?'ell_path':'bont_path';
  (g[k]=g[k]||{id:k,name:ex==='keep'?'Ellenőrzés – meglévő nyomvonal':'Bontás – meglévő nyomvonal',qty:0,unit:'m'}).qty+=vstPathLen(p);});
  return Object.keys(g).sort().map(k=>Object.assign(g[k],{qty:+g[k].qty.toFixed(1)}));}
// the legend rows a printed sheet adds when Meglévő items are on it (05m prnLegendSvg)
function vstLegendRows(){const seen={};
  data.devices.forEach(d=>{const ex=vstExistOf(d);if(ex&&state.levels[d.level]&&(typeof layerShows!=='function'||layerShows(d)))seen[ex]=1;});
  data.paths.forEach(p=>{const ex=vstPathEx(p);if(ex&&(typeof layerShows!=='function'||layerShows(p,'path')))seen[ex]=1;});
  return Object.keys(VST_EX).filter(k=>seen[k]).map(k=>({c:VST_EX[k].c,dash:VST_EX_DASH[k],n:'Meglévő — '+VST_EX[k].n.toLowerCase()}));}

// ---- V7 Áramkörök és védelem: a stage of the Villany Stack ----------------------------------------------------------------
const VST_WET=['furdo','wc','kulter'];
function vstRoomKinds(rm){return rm?((rm.kinds&&rm.kinds.length?rm.kinds:[rm.kind]).filter(Boolean)):[];}
function vstMcb(c){const m=c&&c.mcb;return (m&&typeof m==='object')?m:(typeof mcbParse==='function'?mcbParse(m):null);}
function vstCktRooms(c){return cktMembers(c).map(d=>{const e=roomOfDevice(d);return e&&e.rm;}).filter(Boolean);}
function vstCktOutdoor(c){return vstCktRooms(c).some(rm=>vstRoomKinds(rm).indexOf('kulter')>=0);}
function vstCircuitChecks(S){const out=[],L=new Set(stkLayersOf(S.id).filter(l=>MNS_ROLES.indexOf(l.role)>=0).map(l=>l.id));
  const loose=data.devices.filter(d=>d&&L.has(d.layer)&&['SOC','LMP','SWI','DED','SHU'].indexOf(epCodeOf(d))>=0&&!cktOfDevice(d));
  if(loose.length)out.push({sev:'warn',msg:loose.length+' erősáramú végpont nincs áramkörben: '+loose.slice(0,8).map(d=>d.ref||d.id).join(', ')+(loose.length>8?' …':'')+' — Elosztó → Áramkörök javaslata.'});
  cktList().forEach(c=>{const wet=vstCktRooms(c).some(rm=>vstRoomKinds(rm).some(k=>VST_WET.indexOf(k)>=0));
    if(wet&&c.rcd===false)out.push({sev:'error',msg:(c.ref||c.id)+' '+(c.name||'')+': vizes / kültéri kör 30 mA ÁVK nélkül (MSZ HD 60364-7-701).'});
    const m=vstMcb(c);if(vstCktOutdoor(c)&&m&&m.curve&&m.poles<2&&!m.n)
      out.push({sev:'info',msg:(c.ref||c.id)+' '+(c.name||'')+': kültéri kör — 1P+N kismegszakító javasolt (D5). Jobb klikk a stage-en: Kültéri körök 1P+N.'});});
  if(!cktList().length)out.push({sev:'info',msg:'Még nincs áramkör — Elosztó → Áramkörök javaslata.'});
  return out;}
function vstCircuitStage(S){return {k:'stk:circuits',n:'Áramkörök és védelem',icon:'⚡',groups:['Áramkör'],
  hint:'Az áramkörök, a kismegszakítók és az ÁVK-k — nem réteg: az Elosztó köreit olvassa.',check:()=>vstCircuitChecks(S)};}
// D5: the suggested 2-pole breaker for outdoor circuits, applied on request (never forced)
function vstOutdoor2P(){const list=cktList().filter(c=>{const m=vstMcb(c);return vstCktOutdoor(c)&&m&&m.curve&&m.poles<2&&!m.n;});if(!list.length)return 0;
  pushUndo(['circuits']);list.forEach(c=>{const m=Object.assign({},vstMcb(c),{n:true});c.mcb=m;});draw();lyrHud('Kültéri körök 1P+N: '+list.length);return list.length;}

// ---- D5: IP44 by default outdoors ------------------------------------------------------------------------------------------
const VST_IP_CODES=['SOC','LMP','SWI'];
function vstOutdoor(d){const e=d&&roomOfDevice(d);return !!(e&&e.rm&&vstRoomKinds(e.rm).indexOf('kulter')>=0);}
EP_PLACED.push(d=>{if(VST_IP_CODES.indexOf(epCodeOf(d))>=0&&vstOutdoor(d)&&!d.ip)d.ip='IP44';});
function vstIp44Apply(){const list=data.devices.filter(d=>d&&VST_IP_CODES.indexOf(epCodeOf(d))>=0&&!d.ip&&vstOutdoor(d));if(!list.length)return 0;
  pushUndo(['devices']);list.forEach(d=>{d.ip='IP44';});draw();lyrHud('IP44: '+list.length+' kültéri pont');return list.length;}
STK_SCENE.push(()=>{let s='';const k=devK();data.devices.forEach(d=>{if(!d||!d.ip||!state.levels[d.level]||(typeof layerShows==='function'&&!layerShows(d)))return;
  const b=planToBase(d.x,d.y,dz(d.level,d.h||0));
  s+=`<text class="vstIp" x="${(b[0]+9*k).toFixed(1)}" y="${(b[1]-8*k).toFixed(1)}" font-size="${(6.5*k).toFixed(2)}" font-weight="700" fill="#1565c0" pointer-events="none">${esc(d.ip)}</text>`;});return s;});
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d||VST_IP_CODES.indexOf(epCodeOf(d))<0)return;
  items.push({label:d.ip?'IP44 levétele':'IP44 kivitel',act:()=>{pushUndo(['devices']);if(d.ip)delete d.ip;else d.ip='IP44';draw();}});});
function vstIpRows(){const g={};data.devices.forEach(d=>{if(!d||!d.ip||vstExistOf(d))return;const k='ip_'+epCodeOf(d);
  (g[k]=g[k]||{id:k,name:'ebből '+d.ip+' kivitel – '+vstExistName(d),qty:0,unit:'db'}).qty++;});return Object.keys(g).sort().map(k=>g[k]);}

// ---- Q-V10 A: the fire-resistant cable, per stack ---------------------------------------------------------------------------
function vstFireRes(d){const S=(d&&stkOfLayer(d.layer))||stkActive();return !!(S&&S.fireRes);}
function vstFireResSet(stackId,on){const S=stkById(stackId);if(!S)return false;on=!!on;if(!!S.fireRes===on)return false;
  lyrPushUndo();if(on)S.fireRes=true;else delete S.fireRes;draw();
  lyrHud(on?'Tűzvédelem: tűzálló kábel — JE-H(St)H 2×2×0,8 E30 / FE180 (funkciómegtartás).':'Tűzvédelem: J-Y(St)Y 2×2×0,8 piros.');return true;}
STK_LAYERMENU.push((L,items)=>{if(L.role!=='sys:FIRE')return;const S=stkById(L.stack);if(!S)return;
  items.push({label:S.fireRes?'🔥 Kábel: tűzálló E30 / FE180 → piros J-Y(St)Y':'🔥 Kábel: piros J-Y(St)Y → tűzálló E30 / FE180',act:()=>vstFireResSet(S.id,!S.fireRes)});});

// ---- switch-sensors (2026-10-26, the user) ----------------------------------------------------------------------------------
// A switch-sensor (SWI · pir / pres) switches its lamps by itself: the lamp needs no other switch. A normal switch on the same
// leg is not a váltó partner; it gets a mode:
//   Kizárás   (KI / AUTO) — in SERIES before the sensor: OFF blocks it, AUTO leaves the lamp to the sensor
//   Szabotázs (AUTO / BE) — in PARALLEL with the sensor's output: ON overrides it, AUTO leaves the lamp to the sensor
const VST_SWMODE={kizaras:{n:'Kizárás',st:'KI / AUTO',why:'sorosan az érzékelő előtt'},szabotazs:{n:'Szabotázs',st:'AUTO / BE',why:'párhuzamosan az érzékelő kimenetével'}};
function vstSensorLegs(sw){return lswLegsOf(sw).filter(g=>data.devices.some(x=>lswSensor(x)&&x!==sw&&lswLegsOf(x).indexOf(g)>=0));}
function vstSwMode(sw){return sw&&!lswSensor(sw)&&vstSensorLegs(sw).length&&VST_SWMODE[sw.swMode]?sw.swMode:null;}
function vstSwModeSet(sw,mode){if(!sw||lswSensor(sw))return false;pushUndo(['devices']);if(VST_SWMODE[mode])sw.swMode=mode;else delete sw.swMode;draw();
  lyrHud((sw.ref||sw.id)+': '+(VST_SWMODE[mode]?VST_SWMODE[mode].n+' ('+VST_SWMODE[mode].st+')':'normál BE / KI'));return true;}
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!lswSw(d)||lswSensor(d)||!vstSensorLegs(d).length)return;
  Object.keys(VST_SWMODE).forEach(k=>{if(d.swMode!==k)items.push({label:'◐ Üzemmód: '+VST_SWMODE[k].n+' ('+VST_SWMODE[k].st+')',act:()=>vstSwModeSet(d,k)});});
  if(d.swMode)items.push({label:'◐ Üzemmód: normál (BE / KI)',act:()=>vstSwModeSet(d,null)});});
STK_SCENE.push(()=>{let s='';const k=devK();data.devices.forEach(d=>{if(!d||!state.levels[d.level]||(typeof layerShows==='function'&&!layerShows(d)))return;
  const m=lswSw(d)?(lswSensor(d)?'AUTO':(vstSwMode(d)?VST_SWMODE[d.swMode].st.replace(/ /g,''):'')):'';if(!m)return;
  const b=planToBase(d.x,d.y,dz(d.level,d.h||0));
  s+=`<text class="vstSwMode" x="${(b[0]-9*k).toFixed(1)}" y="${(b[1]+13*k).toFixed(1)}" font-size="${(6*k).toFixed(2)}" font-weight="700" fill="#f08c2e" text-anchor="end" pointer-events="none">${m}</text>`;});return s;});
(STK_CHECKS['sys:LIGHT']=STK_CHECKS['sys:LIGHT']||[]).push(S=>{const out=[],L=stkLayer(S.id,'sys:LIGHT');if(!L)return out;
  data.devices.forEach(d=>{if(!d||d.layer!==L.id||!lswSw(d))return;
    if(lswSensor(d)&&!lswLegsOf(d).length)out.push({sev:'warn',msg:(d.ref||d.id)+': kapcsoló-érzékelő lámpa nélkül.'});
    if(!lswSensor(d)&&vstSensorLegs(d).length&&!VST_SWMODE[d.swMode])out.push({sev:'info',msg:(d.ref||d.id)+': kapcsoló-érzékelő mellett — állítsd Kizárásra (KI / AUTO) vagy Szabotázsra (AUTO / BE).'});});
  return out;});

registerActions([
 {id:'circuits.outdoor2p',alias:'kulteri kor 1p+n ketpolusu kismegszakito outdoor two pole',label:'Kültéri körök 1P+N',icon:'⚡',group:'Áramkör',
  hint:'A kültéri helyiségek köreinek kismegszakítója 1P+N lesz (D5 javaslat). Visszavonható.',run:()=>vstOutdoor2P()},
 {id:'ip44.apply',alias:'ip44 kulter kulteri vedettseg outdoor',label:'Kültéri pontok IP44 kivitelben',icon:'💧',group:'Végpont',
  hint:'Minden kültéri helyiségben lévő dugalj, lámpa és kapcsoló IP44 jelölést kap (az új pontok maguktól kapják).',run:()=>vstIp44Apply()},
 {id:'fire.res',alias:'tuzallo kabel e30 fe180 funkciomegtartas fire resistant',label:'Tűzvédelem: tűzálló kábel be / ki',icon:'🔥',group:'Végpont',
  need:'Aktív stack Tűzvédelem réteggel kell hozzá.',when:()=>{const S=stkActive();return !!(S&&stkLayer(S.id,'sys:FIRE'));},run:()=>{const S=stkActive();vstFireResSet(S.id,!S.fireRes);}}]);

window.VST_EX=VST_EX;window.vstPathEx=vstPathEx;window.vstPathBomRows=vstPathBomRows;window.vstLegendRows=vstLegendRows;window.vstCircuitChecks=vstCircuitChecks;
window.vstCircuitStage=vstCircuitStage;window.vstOutdoor2P=vstOutdoor2P;window.vstIp44Apply=vstIp44Apply;window.vstIpRows=vstIpRows;window.vstFireRes=vstFireRes;
window.vstFireResSet=vstFireResSet;window.VST_SWMODE=VST_SWMODE;window.vstSensorLegs=vstSensorLegs;window.vstSwMode=vstSwMode;window.vstSwModeSet=vstSwModeSet;window.vstExistOf=vstExistOf;window.vstSetEx=vstSetEx;window.vstBomRows=vstBomRows;window.vstCableOnly=vstCableOnly;
window.vstCableOnlyRows=vstCableOnlyRows;window.vstPathLayer=vstPathLayer;window.vstPromote=vstPromote;window.vstTargetRole=vstTargetRole;
