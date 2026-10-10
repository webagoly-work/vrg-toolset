// ==========================================================================
// 05s-endpoints.js — endpoints of a BRIDGE Stack: type codes, placement, circuits, control groups (WP-D1, D4)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Every system layer of a stack places ENDPOINTS identified by a BRIDGE three-letter code (STD-004 §1.2) and a
// variant that fixes its cable(s) and own conduit (STD-001-A2). LMP / SWI / SOC keep the classic light / switch /
// socket types (their renderers, reports and Behúzás keep working); every other code is the generic type `ep`.
//   device: {type, code, var, level, x, y, h, side?, layer}
// An endpoint ALWAYS lands on its code's role layer, whatever layer is active — that is what makes the stack
// "layer by layer" and lets E1 draw on all of it at once. Six codes are proposed additions to STD-004 (new:true).
// Prefix: ep.

const EP_CAT=[
 // ---- MAINS ----
 {code:'LMP',role:'sys:MAINS',n:'Lámpa',cat:'light',mount:'ceiling',topo:'chain',from:'rbx',vars:[
   {k:'230',n:'230 V lámpahely',cab:[{c:'NYM3x15',w:'M20'}]}]},
 {code:'SWI',role:'sys:MAINS',n:'Kapcsoló (bemenet)',cat:'switch',mount:'wall',h:1100,topo:'star',from:'rbx',vars:[
   {k:'230', n:'230 V nyomó (RC-szűrt, BRIDGE-DN)',cab:[{c:'NYM3x15',w:'M20'}]},            // default [Q29]
   {k:'selv',n:'SELV nyomó → bistabil bemenet',    cab:[{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]}]},
 {code:'SOC',role:'sys:MAINS',n:'Dugalj',cat:'socket',mount:'wall',h:300,topo:'chain',from:'rbx',vars:[
   {k:'s04',n:'1,5 mm² kör (S04)',cab:[{c:'NYM3x15',w:'M20'}]},
   {k:'25', n:'2,5 mm² kör',      cab:[{c:'NYM3x25',w:'M25'}]}]},
 {code:'DED',new:true,role:'sys:MAINS',n:'Dedikált fogyasztó',cat:'device',mount:'wall',h:300,topo:'star',from:'board',vars:[
   {k:'g16',  n:'16 A — sütő, mosogatógép, mosógép, bojler, klíma, AV',cab:[{c:'NYM3x25',w:'M25'}]},
   {k:'hob32',n:'Indukciós főzőlap 32 A, 1 fázis',cab:[{c:'NYM3x6',w:'M32'}]},
   {k:'hob2l',n:'Indukciós főzőlap 2L+2N / 3 fázis',cab:[{c:'NYM5x25',w:'M25'}]},
   {k:'alelo',n:'Alelosztó betáp, 3 fázis',cab:[{c:'NYM5x6',w:'M32'}]}]},
 {code:'SHU',role:'sys:MAINS',n:'Redőnymotor',cat:'device',mount:'wall',h:2300,topo:'star',from:'rbx',vars:[
   {k:'230',n:'Fel · le · N · PE',cab:[{c:'NYM4x15',w:'M20'}]}]},
 // ---- LV, bus A ----
 {code:'LNR',role:'sys:LV',n:'LED-vonal / rejtett világítás',cat:'light',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'rov',    n:'Rövid (≤ 5 m, ≤ 2 A)',cab:[{c:'H05_2x15',w:'M20'}]},
   {k:'hosszu', n:'Hosszú / középbetáp (≤ 5 A)',cab:[{c:'H05_2x25',w:'M20'}]}]},
 {code:'UEP',role:'sys:LV',n:'Univerzális végpont',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'selv',n:'SELV pár + üres tartalék',cab:[{c:'H05_2x15',w:'M16'},{c:'SPARE',w:'M16'}]},
   {k:'usbc',n:'USB-C töltő (PD modul)',   cab:[{c:'H05_2x15',w:'M16'}]}]},
 // ---- bus B, assured ----
 {code:'LMP',role:'sys:BUSB',n:'Menekülési / lépcső fény',cat:'light',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'b',n:'B busz pár',cab:[{c:'H05_2x15',w:'M16'}]}]},
 {code:'LNR',role:'sys:BUSB',n:'Kapaszkodó / lépcső LED',cat:'light',mount:'wall',h:900,topo:'star',from:'rbx',vars:[
   {k:'b',n:'B busz pár',cab:[{c:'H05_2x15',w:'M16'}]}]},
 {code:'NTL',role:'sys:BUSB',n:'Értesítő fény (NTL)',cat:'device',mount:'wall',h:1150,topo:'star',from:'rbx',vars:[   // STD-008 eye level 1100–1200
   {k:'tr',  n:'NL-TR, B busz pár',cab:[{c:'H05_2x15',w:'M16'}]},
   {k:'trd', n:'NL-TR + adatpár',  cab:[{c:'H05_2x15',w:'M16'},{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]}]},
 // ---- CONTROL ----
 {code:'POR',role:'sys:CONTROL',n:'Portál vezérlőpont (RS-485)',cat:'device',mount:'wall',h:2150,topo:'star',from:'rbx',vars:[
   {k:'rs485',n:'J-Y(St)Y 2×2×0,8',cab:[{c:'JY2x2x08',w:'M16'}]},
   {k:'cat',  n:'Cat6A S/FTP',      cab:[{c:'CAT6A_S',w:'M20'}]}]},
 // ---- DATA ----
 {code:'ACP',role:'sys:DATA',n:'WiFi hozzáférési pont',cat:'device',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'poe',n:'1 × Cat6A PoE',cab:[{c:'CAT6A_U',w:'M20'}]}]},
 {code:'ETH',new:true,role:'sys:DATA',n:'Adataljzat',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'1',n:'Egyes',cab:[{c:'CAT6A_U',w:'M20'}]},
   {k:'2',n:'Kettős (asztal, médiafal)',cab:[{c:'CAT6A_U',w:'M25',n:2}]}]},
 {code:'CAM',role:'sys:DATA',n:'Kamera',cat:'device',mount:'wall',h:2400,topo:'star',from:'rbx',vars:[
   {k:'poe',n:'Cat6A + LV tartalék',cab:[{c:'CAT6A_U',w:'M20'},{c:'SPARE',w:'M16',fam:'LV'}]}]},
 // ---- KNX (the role is off by default) ----
 {code:'ACT',role:'sys:KNX',n:'KNX eszköz',cat:'device',mount:'wall',h:1100,topo:'chain',from:'rbx',vars:[
   {k:'knx',n:'YCYM 2×2×0,8 — vonal, soha nem hurok',cab:[{c:'YCYM',w:'M16'}]}]},
 // ---- SENSOR ----
 {code:'SEN',role:'sys:SENSOR',n:'Érzékelő',cat:'device',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'mmwave', n:'Jelenlét (mmWave)',cab:[{c:'LIYCY4x05',w:'M16'}]},
   {k:'co2',    n:'CO₂ / levegőminőség',cab:[{c:'LIYCY4x05',w:'M16'}]},
   {k:'pir',    n:'PIR',cab:[{c:'LIYCY4x05',w:'M16'}]},
   {k:'leak',   n:'Vízszivárgás (padlószint)',cab:[{c:'LIYY2x05',w:'M16'}]},
   {k:'thermal',n:'Hőkamera-tömb (fürdő)',cab:[{c:'CAT6A_S',w:'M20'}]},
   {k:'bed',    n:'Ágy életjel-érzékelő',cab:[{c:'H05_2x15',w:'M16',fam:'LV'},{c:'LIYCY4x05',w:'M16'},{c:'SPARE',w:'M16'}]}]},
 {code:'POR',role:'sys:SENSOR',n:'Portál érzékelő (ToF, nyitás)',cat:'device',mount:'wall',h:2150,topo:'star',from:'rbx',vars:[
   {k:'tof',n:'LiYCY 6×0,25',cab:[{c:'LIYCY6x025',w:'M16'}]},
   {k:'cat',n:'Cat6A S/FTP',  cab:[{c:'CAT6A_S',w:'M20'}]}]},
 // ---- HMI ----
 {code:'PAN',role:'sys:HMI',n:'Kezelőpanel',cat:'device',mount:'wall',h:1450,topo:'star',from:'rbx',vars:[   /*r h*/
   {k:'touch',n:'Érintőpanel (PoE + LV)',cab:[{c:'CAT6A_U',w:'M20',fam:'DATA'},{c:'H05_2x15',w:'M16',fam:'LV'}]},
   {k:'entry',n:'Belépési pont (kód, ujjlenyomat, NFC)',cab:[{c:'CAT6A_S',w:'M20'}]}]},
 {code:'THR',role:'sys:HMI',n:'Termosztát',cat:'device',mount:'wall',h:1500,topo:'star',from:'rbx',vars:[       /*r*/
   {k:'bus',n:'LiYCY 4×0,5',cab:[{c:'LIYCY4x05',w:'M16',fam:'SENSOR'}]}]},
 // ---- MEDIA & AUDIO ----
 {code:'SPK',role:'sys:MEDIA',n:'Hangszóró',cat:'device',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'17',    n:'≤ 17 m — 2×1,5',cab:[{c:'SPK2x15',w:'M16'}]},
   {k:'27',    n:'≤ 27 m — 2×2,5',cab:[{c:'SPK2x25',w:'M20'}]},
   {k:'pair',  n:'Sztereó pár egy kábelen — 4×2,5',cab:[{c:'SPK4x25',w:'M25'}]},
   {k:'sub',   n:'Mélynyomó, vonalszint',cab:[{c:'LINE',w:'M20'}]}]},
 {code:'SCR',new:true,role:'sys:MEDIA',n:'Képernyő',cat:'device',mount:'wall',h:1200,topo:'star',from:'rbx',vars:[
   {k:'aoc', n:'HDMI AOC fix fejjel + Cat6A',cab:[{c:'AOC_FIX',w:'M40'},{c:'CAT6A_U',w:'M20',fam:'DATA'}]},
   {k:'aocd',n:'HDMI AOC levehető fejjel + Cat6A',cab:[{c:'AOC_DET',w:'M25'},{c:'CAT6A_U',w:'M20',fam:'DATA'}]}]},
 {code:'AVP',new:true,role:'sys:MEDIA',n:'AV pozíció',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'std',n:'Saját kör + média + 2 × adat',cab:[{c:'NYM3x25',w:'M25',fam:'MAINS',from:'board'},
     {c:'AOC_FIX',w:'M40'},{c:'CAT6A_U',w:'M25',fam:'DATA',n:2}]}]},
 // ---- USB ----
 {code:'USB',new:true,role:'sys:USB',n:'USB adatpont',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'u2',n:'USB 2.0 Cat6A extenderrel (nem az IT hálózaton)',cab:[{c:'CAT6A_U',w:'M20'}]},
   {k:'u3',n:'USB 3.x aktív optikai',cab:[{c:'AOC_USB',w:'M25'}]}]},
 // ---- SECURITY (last) ----
 {code:'SEC',new:true,role:'sys:SECURITY',n:'Biztonsági pont',cat:'device',mount:'wall',h:2200,topo:'star',from:'ssc',vars:[
   {k:'det',    n:'Mozgásérzékelő',cab:[{c:'ALARM6',w:'M16'}]},
   {k:'contact',n:'Nyitásérzékelő',cab:[{c:'ALARM6',w:'M16'}]},
   {k:'siren',  n:'Kültéri sziréna',cab:[{c:'SIREN4',w:'M16'}]},
   {k:'keypad', n:'Kezelő / buszeszköz',cab:[{c:'BUS4',w:'M16'}]}]}];
// symbol colour per role — one source of truth, STK_COL in 05m (which loads first)
const EP_ROLE_COL=stkSysCols();
const EP_CLASSIC={LMP:'light',SWI:'switch',SOC:'socket'};
const EP_FROM_TYPE={light:'LMP',switch:'SWI',socket:'SOC'};

// ---- the catalogue ------------------------------------------------------------------------------------------------
function epEntry(code,role){return EP_CAT.find(e=>e.code===code&&(!role||e.role===role))||null;}
function epOfRole(role){return EP_CAT.filter(e=>e.role===role);}
function epTypeFor(code){return EP_CLASSIC[code]||'ep';}
// the code of a device: its own, or the classic type's (a socket drawn with the old Device tool is a SOC)
function epCodeOf(d){return d?(d.code||EP_FROM_TYPE[d.type]||null):null;}
// the role a device is FOR: its layer's role when that layer is a system layer, else the first role of its code
function epRoleOf(d){const L=d&&lyrLayer(d.layer);if(L&&L.role&&L.role.indexOf('sys:')===0)return L.role;
  const e=epEntry(epCodeOf(d));return e?e.role:null;}
function epEntryOf(d){const c=epCodeOf(d);return c?(epEntry(c,epRoleOf(d))||epEntry(c)):null;}
function epVar(d){const e=epEntryOf(d);if(!e)return null;return e.vars.find(v=>v.k===d.var)||e.vars[0];}
// [{c, w, fam, n, from}] with the defaults filled: fam = the role's family, n = 1, from = the entry's origin
function epCables(d){const e=epEntryOf(d),v=epVar(d);if(!e||!v)return [];const R=stkRole(e.role)||{};
  return v.cab.map(c=>({c:c.c,w:c.w,fam:c.fam||R.fam||null,n:c.n||1,from:c.from||e.from}));}
// the display code: '<code><n>', n = running number of that code in its room (derived — STD-004 R03.LMP2)
function epRef(d){const c=epCodeOf(d);if(!c)return d.ref||'';const r=roomOfDevice(d),rid=r&&stkRoomId(r);
  const same=data.devices.filter(x=>epCodeOf(x)===c&&x.level===d.level&&(()=>{const rr=roomOfDevice(x);return (rr&&stkRoomId(rr))===rid;})());
  return c+(same.indexOf(d)+1);}
function epRoleLayer(role){const S=(typeof stkActive==='function')?stkActive():null;return S?stkLayer(S.id,role):null;}

// ---- placement -------------------------------------------------------------------------------------------------------
let EP_T={on:false,code:null,role:null,var:null,g:null};
// ceiling height at a plan point: the room's own (drop ceiling first), else the level's
function epCeilH(level,x,y){const e=(typeof mrkRoomAtPt==='function')?mrkRoomAtPt(level,x,y):null;
  if(e&&e.rm){const dc=e.rm.dropC||0;return dc?(roomCeilH(e.rm,level)-dc):roomCeilH(e.rm,level);}return wallH(level);}
// the ghost: a wall endpoint on the wall centreline (face in side), a ceiling / floor one at the plan point
function epGhost(e){const en=epEntry(EP_T.code,EP_T.role);if(!en)return null;const level=state.active;
  let g;
  if(en.mount==='wall'){const pk=hwPick(e,en.h||1100);if(!pk)return null;
    const p=mrkFacePt(pk.r,pk.side,pk.u,-wallInfo(pk.r).thick/2);
    g={level,x:Math.round(p[0]),y:Math.round(p[1]),h:en.h||1100,side:pk.side>0?1:0,wall:pk.id,u:Math.round(pk.u),wallSide:pk.side,mount:'wall'};}
  else{const z0=en.mount==='floor'?0:wallH(level),[bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(level,z0));
    g={level,x:Math.round(p[0]),y:Math.round(p[1]),h:en.mount==='floor'?0:epCeilH(level,p[0],p[1]),mount:en.mount};}
  if(typeof sugSnap==='function'&&!e.altKey)g=sugSnap(g,EP_T.code,EP_T.role)||g;       // D3 — Alt places freely
  return g;}
function epMake(g,code,role,vk){const type=epTypeFor(code),L=epRoleLayer(role);
  const d={type,code,var:vk||epEntry(code,role).vars[0].k,level:g.level,x:g.x,y:g.y,h:g.h,layer:L?L.id:state.activeLayer};
  if(g.side!=null)d.side=g.side;
  return d;}
function epPlace(g,code,role,vk){if(!g)return null;code=code||EP_T.code;role=role||EP_T.role;
  const d=epMake(g,code,role,vk||EP_T.var);
  pushUndo(['devices']);data.devices.push(d);ensureIds(data);
  d.ref=EP_CLASSIC[code]&&typeof nextRef==='function'?nextRef(d.type):epRef(d);
  draw();const v=epVar(d);lyrHud(code+' · '+epEntry(code,role).n+' · '+(v?v.n:'')+(g.why?' — '+g.why:''));return d;}
function epToolStart(code,role,vk){const en=epEntry(code,role);if(!en)return;
  if(typeof mrkToolsOff==='function')mrkToolsOff();if(typeof hwToolOff==='function')hwToolOff();
  if(state.mode!=='select')setMode('select');
  Object.assign(EP_T,{on:true,code,role:en.role,var:vk||en.vars[0].k,g:null});epHint();draw();}
function epHint(){const mh=$('modeHint');if(!mh)return;const en=EP_T.on?epEntry(EP_T.code,EP_T.role):null;
  mh.textContent=en?(EP_T.code+' — '+en.n+' · '+((en.vars.find(v=>v.k===EP_T.var)||{}).n||'')+' · ←/→: változat · Alt: szabad elhelyezés · Esc kilép'):(typeof HINTS!=='undefined'?HINTS[state.mode]||'':'');}
function epToolOff(){EP_T.on=false;EP_T.g=null;epHint();}
STK_TOOLS.push({k:'epPlace',active:()=>{if(!EP_T.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){epToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const g=epGhost(e);if(!g)return false;epPlace(g);return true;},
  move(e){EP_T.g=epGhost(e);draw();return false;},
  key(e){const dir=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!dir||e.ctrlKey||e.altKey)return false;   // was Tab (U4)
    e.preventDefault();const en=epEntry(EP_T.code,EP_T.role),i=en.vars.findIndex(v=>v.k===EP_T.var);
    EP_T.var=en.vars[(i+dir+en.vars.length)%en.vars.length].k;epHint();return true;},
  mode(){epToolOff();},esc(){epToolOff();draw();}});
// the picker: every code of the role, variants as radio buttons
function epPicker(role){const S=(typeof stkActive==='function')?stkActive():null,L=lyrLayer(state.activeLayer);
  role=role||(L&&L.role&&L.role.indexOf('sys:')===0?L.role:'sys:MAINS');const list=epOfRole(role);
  openModal('Végpont — '+((stkRole(role)||{n:role}).n),
    list.map((en,i)=>`<div class="mrow" style="align-items:flex-start"><label style="width:200px"><input type="radio" name="epC" value="${en.code}" ${i===0?'checked':''}> <b style="color:${EP_ROLE_COL[role]}">${en.code}</b> ${esc(en.n)}${en.new?' <span style="color:#999">(új kód)</span>':''}</label>`
      +`<span>`+en.vars.map((v,j)=>`<label style="display:block;font-size:11.5px"><input type="radio" name="epV_${en.code}" value="${v.k}" ${j===0?'checked':''}> ${esc(v.n)}</label>`).join('')+`</span></div>`).join('')
    +(list.length?'':`<div class="mrow">Ennek a szerepnek nincs végpontja (a lefedettség a Rádió nézetben).</div>`),
    ()=>{const c=(document.querySelector('input[name=epC]:checked')||{}).value;if(!c)return;
      const v=(document.querySelector('input[name=epV_'+c+']:checked')||{}).value;epToolStart(c,role,v);});}

// ---- symbols ----------------------------------------------------------------------------------------------------------------
function epSymbol(d,x,y,k,back){if(!d||d.type!=='ep')return null;
  const R=v=>+(v*k).toFixed(2),col=back?'#9299a0':(EP_ROLE_COL[epRoleOf(d)]||'#444');
  return `<rect x="${x-R(7)}" y="${y-R(7)}" width="${R(14)}" height="${R(14)}" rx="${R(3)}" fill="#fff" stroke="${col}" stroke-width="${R(1.6)}"${back?' stroke-dasharray="'+vsDash('2.5 2')+'"':''}/>`
    +`<text x="${x}" y="${(y+R(2.6)).toFixed(2)}" font-size="${R(6.8)}" text-anchor="middle" font-weight="700" fill="${col}">${esc(d.code||'?')}</text>`;}
STK_DEVSYM.push(epSymbol);
function epWvBox(dv,x,y,sc,col,back){const d=data.devices[dv.di];if(!d||d.type!=='ep')return null;
  const r=35*sc,c=back?'#b0b4b8':(EP_ROLE_COL[epRoleOf(d)]||col);
  return `<rect x="${(x-r).toFixed(1)}" y="${(y-r).toFixed(1)}" width="${(2*r).toFixed(1)}" height="${(2*r).toFixed(1)}" rx="3" fill="#fff" stroke="${c}" stroke-width="${vsP(1.5)}"${back?' stroke-dasharray="'+vsDash('3 2')+'"':''}/>`
    +`<text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" font-size="${Math.max(7,r*0.55).toFixed(1)}" text-anchor="middle" font-weight="700" fill="${c}">${esc(d.code||'?')}</text>`;}
STK_WVBOX.push(epWvBox);
// the ghost while placing
STK_OVERLAY.push(()=>{if(!EP_T.on||!EP_T.g)return '';const g=EP_T.g,b=planToBase(g.x,g.y,dz(g.level,g.h||0)),k=devK();
  const fake={type:epTypeFor(EP_T.code),code:EP_T.code,level:g.level,layer:(epRoleLayer(EP_T.role)||{}).id};
  return `<g opacity="0.6" pointer-events="none">`+(fake.type==='ep'?epSymbol(fake,b[0],b[1],k,false):devSym(Object.assign(fake,{x:g.x,y:g.y,h:g.h})))+`</g>`;});

// ---- right-click on an endpoint (adds to the device menu) -------------------------------------------------------------------
STK_DEVMENU.push((di,items)=>{const d=data.devices[di],e=epEntryOf(d),L0=d&&lyrLayer(d.layer);if(!d||!e||(!d.code&&!(L0&&L0.role)))return;   // a classic device on a non-stack layer keeps its menu as is
  e.vars.forEach(v=>{if(v.k!==(epVar(d)||{}).k)items.push({label:'⊕ Változat: '+v.n,act:()=>{pushUndo(['devices']);d.var=v.k;draw();}});});
  items.push({label:'⊕ Kábelek: '+epCables(d).map(c=>(c.n>1?c.n+'×':'')+((typeof AFILL_CABLES!=='undefined'&&AFILL_CABLES[c.c])?AFILL_CABLES[c.c].n:c.c)+' · '+c.w).join(' + '),act:()=>{}});
  const L=epRoleLayer(e.role);if(L&&d.layer!==L.id)items.push({label:'⊕ Áthelyezés a szerep rétegére ('+L.name+')',act:()=>{pushUndo(['devices']);d.layer=L.id;draw();}});
  if(d.type==='switch'||epCodeOf(d)==='SWI')items.push({label:'⊕ Mit vezérel?…',act:()=>epCtlPick(d)});});

// ---- validation ------------------------------------------------------------------------------------------------------------------
VALIDATORS.push({code:'ep.*',run:()=>{const out=[];
  data.devices.forEach(d=>{if(!d||!d.code)return;
    if(!epEntry(d.code)){out.push({sev:'error',code:'ep.code',msg:'Ismeretlen végpont-kód: '+d.code+' ('+(d.ref||d.id)+')',ref:d.id});return;}
    const L=lyrLayer(d.layer);if(L&&L.role&&L.role.indexOf('sys:')===0&&!epEntry(d.code,L.role))
      out.push({sev:'warn',code:'ep.role',msg:(d.ref||d.id)+': rossz rétegen ('+((stkRole(L.role)||{n:L.role}).n)+')',ref:d.id});});
  data.devices.forEach(d=>{if(!d||!Array.isArray(d.ctl))return;const gone=d.ctl.filter(id=>!byId('devices',id));
    if(gone.length)out.push({sev:'warn',code:'ep.ctl',msg:(d.ref||d.id)+': törölt lámpát vezérel ('+gone.join(', ')+')',ref:d.id});});
  return out;}});

// ==================================================================================================================
// WP-D4 — circuits and control groups inside the stack
// ==================================================================================================================
// circuits: the existing 05j records, reused. Defaults the fill applies (not stored):
//   a SOC in no circuit → the room's implicit socket circuit · a DED → always its own dedicated circuit ·
//   LMP / LNR → the RBX's lighting circuit (ELO_RULES.lightPerRbx)
// control groups (BRIDGE): a switch is an INPUT of the RoomBox bistable, each lamp group an OUTPUT — there is no
// switch-to-lamp wire [Q29]. sw.ctl = [lamp ids] says which lamps the switch controls.
(STK_GROUPS['+sys:MAINS']=STK_GROUPS['+sys:MAINS']||[]).push('Áramkör','Vezérlés');
function epRoomOf(d){const r=roomOfDevice(d);return r?stkRoomId(r):null;}
// devices of a room on a role's layer of the active (or given) stack
function epInRoom(roomId,role,stackId){const S=stackId?stkById(stackId):((typeof stkActive==='function')?stkActive():null);
  const L=S?stkLayer(S.id,role):null;
  return data.devices.filter(d=>d&&epCodeOf(d)&&(L?d.layer===L.id:epRoleOf(d)===role)&&epRoomOf(d)===roomId);}
function epCircuitOf(d){const c=(typeof cktOfDevice==='function')?cktOfDevice(d):null;if(c)return c.id;
  const code=epCodeOf(d);
  if(code==='DED'||code==='AVP')return 'ded:'+d.id;
  if(code==='SOC')return 'room:'+epRoomOf(d)+':SOC';
  if(code==='LMP'||code==='LNR'){const r=epRoomOf(d),x=r&&typeof hwRoomRbx==='function'?hwRoomRbx(r):null;return 'light:'+(x?x.id:'?');}
  return null;}
// [{key, name, members:[ids], dedicated, mcb?, implicit}] — MAINS endpoints of the room
function epCircuits(roomId,stackId){const by={};
  epInRoom(roomId,'sys:MAINS',stackId).forEach(d=>{const k=epCircuitOf(d);if(!k)return;
    if(!by[k]){const c=(typeof cktById==='function')?cktById(k):null,room=mrkRoomById(roomId);
      by[k]={key:k,name:c?(c.name||c.ref||k):(k.indexOf('room:')===0?((room&&room.rm.num)||'')+' dugalj':k.indexOf('ded:')===0?'dedikált':'világítás'),
        members:[],dedicated:c?!!c.dedicated:k.indexOf('ded:')===0,mcb:c?c.mcb:undefined,implicit:!c};}
    by[k].members.push(d.id);});
  return Object.keys(by).sort().map(k=>by[k]);}
// output groups: lamps grouped by the identical SET of switches controlling them; uncontrolled lamps alone
function epCtlOf(lampId){return data.devices.filter(s=>Array.isArray(s.ctl)&&s.ctl.indexOf(lampId)>=0).map(s=>s.id).sort();}
function epLampGroups(roomId,stackId,role){const lamps=epInRoom(roomId,role||'sys:MAINS',stackId).filter(d=>epCodeOf(d)==='LMP');
  const g={};lamps.forEach(l=>{const sig=epCtlOf(l.id).join(',')||('alone:'+l.id);(g[sig]=g[sig]||[]).push(l.id);});
  return Object.keys(g).map(k=>g[k].sort(prtIdCmp)).sort((a,b)=>prtIdCmp(a[0],b[0]));}
// THE input for the fill (E3): [{key, code, topo, members:[ids], from}] for one room and role
function epGroupsFor(roomId,role,stackId){const devs=epInRoom(roomId,role,stackId),out=[];
  const byCode={};devs.forEach(d=>{(byCode[epCodeOf(d)]=byCode[epCodeOf(d)]||[]).push(d);});
  Object.keys(byCode).sort().forEach(code=>{const en=epEntry(code,role)||epEntry(code),ds=byCode[code];
    if(!en)return;
    if(en.topo==='chain'){
      if(code==='LMP')epLampGroups(roomId,stackId,role).forEach((g,i)=>out.push({key:role+':LMP:'+g[0],code,topo:g.length>1?'chain':'star',members:g,from:en.from}));
      else if(code==='SOC'){const by={};ds.forEach(d=>{const k=epCircuitOf(d)||('room:'+roomId);(by[k]=by[k]||[]).push(d.id);});
        Object.keys(by).sort().forEach(k=>out.push({key:role+':SOC:'+k,code,topo:by[k].length>1?'chain':'star',members:by[k].sort(prtIdCmp),from:en.from}));}
      else out.push({key:role+':'+code+':'+roomId,code,topo:ds.length>1?'chain':'star',members:ds.map(d=>d.id).sort(prtIdCmp),from:en.from});}
    else ds.slice().sort((a,b)=>prtIdCmp(a.id,b.id)).forEach(d=>out.push({key:role+':'+code+':'+d.id,code,topo:'star',members:[d.id],from:en.from}));});
  return out;}

// the control pick mode: clicking a lamp toggles it in the switch's ctl list
let EP_CTL=null;                                         // {id: switch id, pushed}
function epCtlPick(sw){if(!sw)return;if(state.mode!=='select')setMode('select');
  if(typeof mrkToolsOff==='function')mrkToolsOff();epToolOff();
  EP_CTL={id:sw.id,pushed:false};lyrHud('Mit vezérel '+(sw.ref||sw.id)+'? Kattints a lámpákra · Enter / Esc: kész');draw();}
function epIsLamp(d){const c=epCodeOf(d);return c==='LMP'||c==='LNR'||c==='SHU';}
function epCtlToggle(lamp){const sw=byId('devices',EP_CTL&&EP_CTL.id);if(!sw||!epIsLamp(lamp))return false;
  if(!EP_CTL.pushed){pushUndo(['devices']);EP_CTL.pushed=true;}
  sw.ctl=Array.isArray(sw.ctl)?sw.ctl:[];const i=sw.ctl.indexOf(lamp.id);
  if(i>=0)sw.ctl.splice(i,1);else sw.ctl.push(lamp.id);
  if(!sw.ctl.length)delete sw.ctl;lyrHud((sw.ref||sw.id)+' vezérli: '+((sw.ctl||[]).map(id=>(byId('devices',id)||{}).ref||id).join(', ')||'semmit'));draw();return true;}
STK_TOOLS.push({k:'epCtl',active:()=>{if(!EP_CTL)return false;if(state.mode!=='select'||!byId('devices',EP_CTL.id)){EP_CTL=null;return false;}return true;},
  down(e){if(e.button!==0)return false;const h=hitTest(e);if(!h||h.t!=='devices')return true;epCtlToggle(data.devices[h.i]);return true;},
  key(e){if(e.key==='Enter'){EP_CTL=null;draw();return true;}return false;},
  esc(){EP_CTL=null;draw();}});
STK_OVERLAY.push(()=>{const sel=(typeof selected!=='undefined'&&selected&&selected.t==='devices')?data.devices[selected.i]:null;
  const sw=EP_CTL?byId('devices',EP_CTL.id):(sel&&Array.isArray(sel.ctl)?sel:null);if(!sw||!state.levels[sw.level])return '';
  const a=planToBase(sw.x,sw.y,dz(sw.level,sw.h||0));let s='';
  (sw.ctl||[]).forEach(id=>{const l=byId('devices',id);if(!l||!state.levels[l.level])return;const b=planToBase(l.x,l.y,dz(l.level,l.h||0));
    s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#d1493f" stroke-width="${vsP(1)}" stroke-dasharray="${vsDash('4 3')}"/>`;});
  return s?`<g pointer-events="none">${s}</g>`:'';});
(STK_CHECKS['sys:MAINS']=STK_CHECKS['sys:MAINS']||[]).push(S=>{const out=[],L=stkLayer(S.id,'sys:MAINS');if(!L)return out;
  const on=data.devices.filter(d=>d.layer===L.id);
  on.forEach(d=>{const c=epCodeOf(d);
    if(c==='SWI'&&!(d.ctl&&d.ctl.length))out.push({sev:'info',msg:(d.ref||d.id)+': nem vezérel semmit'});
    if(c==='LMP'&&!epCtlOf(d.id).length)out.push({sev:'info',msg:(d.ref||d.id)+': egy kapcsoló sem vezérli'});});
  if(typeof cktList==='function')cktList().forEach(c=>{if(c.dedicated&&(c.members||[]).length>1)out.push({sev:'warn',msg:(c.name||c.id)+': dedikált kör, de '+c.members.length+' tagja van'});});
  return out;});

// ---- actions ---------------------------------------------------------------------------------------------------------------------------
registerActions([
 {id:'ep.place',alias:'vegpont elhelyezes endpoint place code',label:'Végpont elhelyezése…',icon:'⊕',group:'Végpont',
  hint:'A rendszer-réteg végpontjai (BRIDGE kódok) változattal; a végpont mindig a saját szerep-rétegére kerül.',run:()=>epPicker()},
 {id:'ep.ctl',alias:'kapcsolo lampak vezerles control switch lamps',label:'Kapcsoló → lámpák',icon:'⇢',group:'Vezérlés',
  hint:'BRIDGE: a kapcsoló az RBX bemenete, a lámpacsoport a kimenete — itt adod meg, mit vezérel.',
  need:'Jelölj ki egy kapcsolót.',when:c=>c.selType==='devices'&&epCodeOf(data.devices[c.sel.i])==='SWI',run:c=>epCtlPick(data.devices[c.sel.i])}
].concat([...new Set(EP_CAT.map(e=>e.code))].map(code=>({id:'ep.place.'+code,alias:'vegpont '+code.toLowerCase()+' endpoint',
  label:'Végpont: '+code+' — '+EP_CAT.find(e=>e.code===code).n,icon:'⊕',group:'Végpont',need:'Lépj egy rendszer-réteg szakaszába, ahol ez a kód van.',
  when:c=>{const L=lyrLayer(state.activeLayer);return !!(L&&L.role&&epEntry(code,L.role));},
  run:()=>{const L=lyrLayer(state.activeLayer);epToolStart(code,L.role);}}))));

// test hooks
window.EP_CAT=EP_CAT;window.EP_ROLE_COL=EP_ROLE_COL;window.EP_T=EP_T;window.epEntry=epEntry;window.epOfRole=epOfRole;window.epTypeFor=epTypeFor;window.epCodeOf=epCodeOf;window.epRoleOf=epRoleOf;
window.epVar=epVar;window.epCables=epCables;window.epRef=epRef;window.epMake=epMake;window.epPlace=epPlace;window.epToolStart=epToolStart;window.epGhost=epGhost;
window.epSymbol=epSymbol;window.epCircuitOf=epCircuitOf;window.epCircuits=epCircuits;window.epLampGroups=epLampGroups;window.epGroupsFor=epGroupsFor;
window.epCtlPick=epCtlPick;window.epCtlToggle=epCtlToggle;window.epInRoom=epInRoom;window.epCtlOf=epCtlOf;window.epRoomOf=epRoomOf;
