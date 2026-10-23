// ==========================================================================
// 05t-needs.js — room needs per system layer, and placement suggestions (WP-D2, D3)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// NEEDS: each room carries a checklist per system layer — which endpoint codes it needs. Defaults come from the
// room's kind (its Rendeltetés field, else its name) plus ticks DERIVED from the Marking layer (a window tagged
// redőny needs a shutter motor…). A room the user never touched follows the defaults; once a layer is saved for
// a room (rm.needs[role]) it is a full object and never silently changes. A layer is done for a room when every
// ticked code has at least one device on that layer in the room. Gating is soft [Q27=A]. Prefix: need.
// SUGGESTIONS: overlay hints and soft snapping while placing — never a device created on its own. Prefix: sug.

// kind: first match on the accent-folded `use`, then `name`. Order matters: fürdőszoba must not be read as szoba.
const NEED_KINDS=[
 {k:'eloszoba', n:'Előszoba',  re:/eloszob|bejarat|\bhall\b/},
 {k:'gepeszet', n:'Gépészet / garázs',re:/gepesz|kazan|garazs|mosokonyha|pince/},
 {k:'furdo',    n:'Fürdő',     re:/furd|zuhany|bath/},
 {k:'wc',       n:'WC',        re:/\bwc\b|mosdo|toalett/},
 {k:'konyha',   n:'Konyha',    re:/konyh/},
 {k:'etkezo',   n:'Étkező',    re:/etkez/},
 {k:'nappali',  n:'Nappali',   re:/nappal|living/},
 {k:'dolgozo',  n:'Dolgozó',   re:/dolgoz|iroda|office/},
 {k:'halo',     n:'Háló / szoba',re:/halo|szoba|gyerek|bedroom/},
 {k:'kamra',    n:'Kamra / tároló',re:/kamra|spajz|tarolo|gardrob/},
 {k:'kozlekedo',n:'Közlekedő', re:/kozleked|folyoso|lepcso/},
 {k:'kulter',   n:'Terasz / erkély',re:/terasz|erkely|kert|loggia/},
 {k:'egyeb',    n:'Egyéb',     re:/.*/}];
// kind → role → codes. The kind's entry REPLACES '*' for that role ([] = nothing ticked).
const NEED_DEFAULTS={
 '*':        {'sys:LIGHT':['LMP','SWI'],'sys:SOC':['SOC'],'sys:SENSOR':['SEN'],'sys:RF':['wifi','thread'],'sys:MEDIA':['SPK']},
 eloszoba:   {'sys:BUSB':['LMP'],'sys:HMI':['PAN'],'sys:DATA':['CAM'],'sys:SECURITY':['DWC','KPD','SRN','MOT'],'sys:MEDIA':[]},   // S5: replaces ['SEC']
 konyha:     {'sys:LIGHT':['LMP','SWI'],'sys:SOC':['SOC'],'sys:DED':['DED'],'sys:LV':['LNR'],'sys:SENSOR':['SEN'],'sys:RF':['wifi','thread','uwb'],'sys:SECURITY':['SMK']},   // SMK 'heat' suggested here
 etkezo:     {'sys:RF':['wifi','thread','uwb']},
 nappali:    {'sys:LV':['LNR','UEP'],'sys:DATA':['ETH','ACP'],'sys:HMI':['PAN','THR'],'sys:MEDIA':['SPK','SCR','AVP'],'sys:USB':['USB'],'sys:RF':['wifi','thread','uwb'],'sys:SECURITY':['MOT']},
 halo:       {'sys:LV':['UEP'],'sys:DATA':['ETH'],'sys:HMI':['THR'],'sys:SECURITY':['SMK']},
 dolgozo:    {'sys:LV':['UEP'],'sys:DATA':['ETH'],'sys:USB':['USB']},
 furdo:      {'sys:LV':['LNR'],'sys:HMI':['THR']},
 wc:         {'sys:LIGHT':['LMP','SWI'],'sys:SOC':[],'sys:MEDIA':[]},
 kamra:      {'sys:LIGHT':['LMP','SWI'],'sys:SOC':[],'sys:SENSOR':[],'sys:MEDIA':[],'sys:RF':[]},
 kozlekedo:  {'sys:LIGHT':['LMP','SWI'],'sys:SOC':[],'sys:BUSB':['LMP','NTL'],'sys:MEDIA':[],'sys:SECURITY':['SMK','MOT']},
 kulter:     {'sys:LIGHT':['LMP'],'sys:SOC':['SOC'],'sys:DATA':['CAM'],'sys:SENSOR':[],'sys:MEDIA':[],'sys:RF':[],'sys:SECURITY':['SRN','MOT']},
 gepeszet:   {'sys:LIGHT':['LMP','SWI'],'sys:SOC':['SOC'],'sys:DED':['DED'],'sys:SENSOR':['SEN'],'sys:MEDIA':[],'sys:SECURITY':['SMK','COA']},
 egyeb:      {}};
const NEED_STATUS={off:{n:'ki',c:'#9aa0a6'},empty:{n:'nincs igény',c:'#9aa0a6'},open:{n:'hiányos',c:'#d08a1e'},done:{n:'kész',c:'#2e9e5b'}};

function needFold(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();}
function needKind(rm){if(!rm)return 'egyeb';if(rm.kind&&NEED_KINDS.some(k=>k.k===rm.kind))return rm.kind;
  for(const src of [rm.use,rm.name]){if(!src)continue;const f=needFold(src),k=NEED_KINDS.find(x=>x.k!=='egyeb'&&x.re.test(f));if(k)return k.k;}
  return 'egyeb';}
function needRoomEntry(rm){for(const l of ORD){const e=allRooms(l).find(x=>x.rm===rm);if(e)return e;}return null;}
// openings of the room (a door or window whose either side is this room)
function needOpenings(rid,type){return (data.openings||[]).filter(o=>o&&(!type||o.type===type)&&typeof mrkDoorRooms==='function'&&
  mrkDoorRooms(o).some(e=>e&&stkRoomId(e)===rid));}
function needTagged(list,tags){return list.some(o=>{const t=mrkOpeningTags(o.id);return tags.some(k=>t.indexOf(k)>=0);});}
// derived ticks from the Marking layer → {role:[codes]}
function needDerived(rm){const e=needRoomEntry(rm),rid=e&&stkRoomId(e),out={};if(!rid||typeof mrkOpeningTags!=='function')return out;
  const add=(role,code)=>{(out[role]=out[role]||[]);if(out[role].indexOf(code)<0)out[role].push(code);};
  const wins=needOpenings(rid,'window'),doors=needOpenings(rid,'door'),all=needOpenings(rid);
  if(needTagged(wins,['redony','arnyekolo']))add('sys:LIGHT','SHU');
  if(typeof cinRoomIds==='function'&&cinRoomIds().indexOf(rid)>=0)add('sys:DED','DED');   // 08r: a cinema room needs its AV circuit(s)
  if(needTagged(doors,['portal','bejarat','lepcso']))add('sys:BUSB','NTL');
  if(needTagged(doors,['p2','p3'])){add('sys:CONTROL','POR');add('sys:SENSOR','POR');}
  // S5: the entrance gets contact + keypad + doorbell; every perimeter opening a contact; a protected window glass-break
  if(needTagged(doors,['bejarat'])){add('sys:SECURITY','DWC');add('sys:SECURITY','KPD');add('sys:SECURITY','DBL');}
  if(needTagged(all,['kulso','nyitaserz','vedett']))add('sys:SECURITY','DWC');
  if(needTagged(wins,['vedett']))add('sys:SECURITY','GLB');
  if(typeof trcList==='function'&&trcList().some(t=>t.level===e.level&&(t.tags||[]).some(k=>k==='ejszakai'||k==='lepcso')&&
     (t.pts||[]).some(p=>pointInPoly(p[0],p[1],rm.poly))))add('sys:BUSB','LMP');
  return out;}
// role → [codes] with the derived ones marked: {codes:[…], derived:[…]}
function needDefaults(rm,role){
  if(role==='sys:MAINS'&&typeof MNS_ROLES!=='undefined'){const o={codes:[],derived:[]};   // M1 alias: lighting, sockets, dedicated
    ['sys:LIGHT','sys:SOC','sys:DED'].forEach(r=>{const x=needDefaults(rm,r);x.codes.forEach(c=>{if(o.codes.indexOf(c)<0)o.codes.push(c);});x.derived.forEach(c=>o.derived.push(c));});return o;}
  const k=needKind(rm),base=NEED_DEFAULTS['*'][role]||[],own=(NEED_DEFAULTS[k]||{})[role];
  const codes=(own!==undefined?own:base).slice(),derived=(needDerived(rm)[role]||[]).filter(c=>codes.indexOf(c)<0);
  return {codes:codes.concat(derived),derived};}
// {code:true} — the saved checklist of that layer, else the defaults
function needOf(rm,role){if(rm&&rm.needs&&rm.needs[role])return Object.assign({},rm.needs[role]);
  if(typeof reqNeedOf==='function'){const r=reqNeedOf(rm,role);if(r)return r;}   // 08q (N1 A): a room with an igénylista ticks from its counts
  const o={};needDefaults(rm,role).codes.forEach(c=>{o[c]=true;});return o;}
function needSaved(rm,role){return !!(rm&&rm.needs&&rm.needs[role]);}
function needSet(rm,role,code,on){if(!rm)return false;const isFloor=data.floors.indexOf(rm)>=0;
  if(isFloor)pushUndo(['floors']);
  const cur=needOf(rm,role);if(on)cur[code]=true;else delete cur[code];
  rm.needs=rm.needs||{};rm.needs[role]=cur;
  if(!isFloor)lyrHud('Épületmodell-helyiség: ez a módosítás nem vonható vissza.');
  if(typeof invalidateShell==='function')invalidateShell();
  return true;}
function needCodesOf(role){if(role==='sys:RF')return (typeof RF_TECH!=='undefined'?RF_TECH:[]).map(t=>t.k);
  return [...new Set(epOfRole(role).map(e=>e.code))];}
// how many there are: devices of that code on the role's layer in the room; for RF: 1 when ≥ 90 % covered
function needHave(rid,role,code,stackId){
  if(role==='sys:RF'){if(typeof rfRoomCover!=='function')return null;return rfRoomCover(rid,code)>=0.9?1:0;}
  return epInRoom(rid,role,stackId).filter(d=>epCodeOf(d)===code).length;}
function needStatus(rm,role,stackId){const S=stackId?stkById(stackId):stkActive(),L=S?stkLayer(S.id,role):null;
  if(!L||L.visible===false)return 'off';
  const e=needRoomEntry(rm),rid=e&&stkRoomId(e),need=needOf(rm,role),ks=Object.keys(need).filter(k=>need[k]);
  if(!ks.length)return 'empty';
  return ks.some(k=>needHave(rid,role,k,S.id)===0)?'open':'done';}
function needSysRoles(S){return STK_ROLES.filter(r=>r.k.indexOf('sys:')===0&&(!S||stkLayer(S.id,r.k)));}
function needRoomSummary(rm,stackId){const S=stackId?stkById(stackId):stkActive(),e=needRoomEntry(rm),rid=e&&stkRoomId(e);
  return needSysRoles(S).map(r=>{const st=needStatus(rm,r.k,S&&S.id),need=needOf(rm,r.k);
    return {role:r.k,status:st,missing:st==='open'?Object.keys(need).filter(k=>need[k]&&needHave(rid,r.k,k,S.id)===0):[]};});}
function needNextRole(rm,stackId){const s=needRoomSummary(rm,stackId).find(x=>x.status==='open');return s?s.role:null;}

// ---- the checklist dialog -----------------------------------------------------------------------------------------------
function needCodeName(role,code){if(role==='sys:RF'){const t=typeof rfTech==='function'?rfTech(code):null;return t?t.n:code;}
  const e=epEntry(code,role)||epEntry(code);return e?e.n:code;}
function needDialog(rm){if(!rm)return;const S=stkActive();if(!S){lyrHud('Aktív BRIDGE Stack kell hozzá.');return;}
  const e=needRoomEntry(rm),rid=e&&stkRoomId(e),L=lyrLayer(state.activeLayer),cur=L&&L.stack===S.id?L.role:null;
  const row=r=>{const st=needStatus(rm,r.k,S.id),need=needOf(rm,r.k),der=needSaved(rm,r.k)?[]:needDefaults(rm,r.k).derived;
    return `<div style="margin:6px 0;${r.k===cur?'':'opacity:.92'}"><b>${esc(r.n)}</b> <span style="color:${NEED_STATUS[st].c};font-size:11px">● ${NEED_STATUS[st].n}</span>`
      +(needSaved(rm,r.k)?` <a href="#" class="ndReset" data-r="${r.k}" style="font-size:11px">alapértelmezett</a>`:'')+`<div style="margin-left:10px">`
      +needCodesOf(r.k).map(c=>{const h=needHave(rid,r.k,c,S.id),on=!!need[c];
        return `<label style="display:inline-block;margin-right:10px;font-size:12px"><input type="checkbox" class="ndC" data-r="${r.k}" value="${c}" ${on?'checked':''}> ${esc(needCodeName(r.k,c))}`
          +(h==null?'':` <span style="color:${on&&!h?'#d08a1e':'#888'}">(${r.k==='sys:RF'?(h?'✓':'✗'):h}${on&&!h?'!':''})</span>`)+(der.indexOf(c)>=0?' ⚙':'')+`</label>`;}).join('')+`</div></div>`;};
  openModal('Helyiség igényei — '+((rm.num?rm.num+' ':'')+(rm.name||rid||'')),
    `<div class="mrow">Fajta <select id="ndKind" style="width:180px">`+NEED_KINDS.map(k=>`<option value="${k.k}" ${needKind(rm)===k.k?'selected':''}>${esc(k.n)}</option>`).join('')+`</select>`
    +(rm.kind?'':' <span style="color:#888;font-size:11px">(a rendeltetésből / névből)</span>')+`</div>`
    +`<div style="max-height:420px;overflow:auto">`+needSysRoles(S).map(row).join('')+`</div>`
    +`<div class="mrow" style="font-size:11px;color:#888">⚙ = a Jelölés rétegből levezetve (pl. redőnyös ablak → redőnymotor). (n) = ennyi van a helyiségben; ! = kell, de még nincs.</div>`,
    ()=>{},'Bezár');
  document.querySelectorAll('.ndC').forEach(c=>c.onchange=()=>{needSet(rm,c.dataset.r,c.value,c.checked);draw();});
  document.querySelectorAll('.ndReset').forEach(a=>a.onclick=ev=>{ev.preventDefault();if(data.floors.indexOf(rm)>=0)pushUndo(['floors']);
    delete rm.needs[a.dataset.r];if(!Object.keys(rm.needs).length)delete rm.needs;closeModal();needDialog(rm);draw();});
  $('ndKind').onchange=()=>{if(data.floors.indexOf(rm)>=0)pushUndo(['floors']);const v=$('ndKind').value;
    if(v===needKind(Object.assign({},rm,{kind:undefined})))delete rm.kind;else rm.kind=v;closeModal();needDialog(rm);draw();};}
// the overview: every room × every system layer as status chips
function needOverview(){const S=stkActive();if(!S){lyrHud('Aktív BRIDGE Stack kell hozzá.');return;}
  const roles=needSysRoles(S),rooms=[];ORD.forEach(l=>stkRooms(l).forEach(r=>{if(r.id)rooms.push(r);}));
  openModal('Helyiségek igényei — '+S.name,
    `<div style="max-height:440px;overflow:auto"><table style="font-size:11.5px;border-collapse:collapse"><tr><th align="left">Helyiség</th>`
    +roles.map(r=>`<th title="${esc(r.n)}" style="padding:0 3px">${STK_ICONS[r.k]||'•'}</th>`).join('')+`</tr>`
    +rooms.map(r=>`<tr class="ndRoom" data-id="${r.id}" style="cursor:pointer"><td>${esc((r.num?r.num+' ':'')+(r.name||r.id))}</td>`
      +roles.map(x=>{const st=needStatus(r.rm,x.k,S.id);return `<td align="center" style="color:${NEED_STATUS[st].c}" title="${esc(x.n)}: ${NEED_STATUS[st].n}">●</td>`;}).join('')+`</tr>`).join('')
    +`</table></div>`,()=>{},'Bezár');
  document.querySelectorAll('.ndRoom').forEach(tr=>tr.onclick=()=>{const e=mrkRoomById(tr.dataset.id);closeModal();if(e)needDialog(e.rm);});}
STK_ROOMMENU.push((rh,items)=>{if(!stkActive())return;items.push({label:'☑ Rétegenkénti igények (pipák)…',act:()=>needDialog(rh.rm)});});

// ---- checks: one per system role ----------------------------------------------------------------------------------------------
function needChecks(role){return S=>{const out=[];if(!stkLayer(S.id,role))return out;
  ORD.forEach(l=>stkRooms(l).forEach(r=>{if(!r.id)return;const st=needStatus(r.rm,role,S.id),lbl=(r.num?r.num+' ':'')+(r.name||r.id);
    if(st==='open'){const need=needOf(r.rm,role),miss=Object.keys(need).filter(k=>need[k]&&needHave(r.id,role,k,S.id)===0);
      out.push({sev:'warn',msg:lbl+': hiányzik '+miss.join(', ')});}
    else if(st==='empty')out.push({sev:'info',msg:lbl+': nincs igény ezen a rétegen'});
    // soft gating: an earlier layer still open in this room
    const prev=needSysRoles(S).filter(x=>stkRoleIx(x.k)<stkRoleIx(role)).find(x=>needStatus(r.rm,x.k,S.id)==='open');
    if(prev&&st!=='empty')out.push({sev:'info',msg:lbl+': előző réteg nincs kész — '+prev.n});}));
  return out;};}
STK_ROLES.filter(r=>r.k.indexOf('sys:')===0&&r.k!=='sys:RF').forEach(r=>{(STK_CHECKS[r.k]=STK_CHECKS[r.k]||[]).push(needChecks(r.k));});

// ---- export (the phase-3 seam) ---------------------------------------------------------------------------------------------------
function needReport(stackId){const S=stackId?stkById(stackId):stkActive();if(!S)return [];const out=[];
  ORD.forEach(l=>stkRooms(l).forEach(r=>{if(!r.id)return;
    out.push({room:{id:r.id,num:r.num||'',name:r.name||'',kind:needKind(r.rm),level:l},
      roles:needSysRoles(S).map(x=>{const need=needOf(r.rm,x.k),o={};Object.keys(need).filter(k=>need[k]).forEach(k=>{o[k]=needHave(r.id,x.k,k,S.id);});
        return {role:x.k,status:needStatus(r.rm,x.k,S.id),need:o};})});}));
  return out;}

// ==================================================================================================================
// WP-D3 — placement suggestions
// ==================================================================================================================
const SUG_RULES=[
 {code:'SWI', anchor:'doorHandle',  h:1100, off:150, n:'Kilincs felőli oldal, 150 mm-re a toktól'},
 {code:'SOC', anchor:'hband',       h:300,  n:'Dugaljsáv a + jelölt oldalakon, L-forma előnyben'},
 {code:'LMP', role:'sys:LIGHT', anchor:'roomCentre', n:'Mennyezet közepe / lámpasor sáv'},
 {code:'SEN', anchor:'farCorner',   h:2200, n:'Az ajtóval átlós sarok'},
 {code:'POR', anchor:'doorLintel',  h:2150, n:'Ajtó szemöldök fölött (ToF pár)'},
 {code:'NTL', anchor:'doorFlank',   h:1150, off:200, n:'Minden portál mellett'},
 {code:'SHU', anchor:'windowTop',   off:100, n:'Ablak fölött, redőnytokban'},
 {code:'PAN', anchor:'doorHandle',  h:1450, off:300, n:'Bejárat mellett, kilincs felől'},
 {code:'THR', anchor:'innerWall',   h:1500, n:'Belső fal, ablaktól és fűtőtesttől távol'},
 {code:'SPK', anchor:'ceilingPair', n:'Mennyezeti pár, a médiafalra szimmetrikus'},
 {code:'ACP', anchor:'coverageGap', n:'Mennyezet, a WiFi lefedettség hiányának közepe'},
 {code:'LNR', role:'sys:LV', anchor:'hstripTag', tag:'cove', n:'Mennyezet alatti sáv'},
 {code:'LMP', role:'sys:BUSB', anchor:'traceTag', tag:'ejszakai', h:300, n:'Éjszakai útvonal mentén, lábfény magasság'},
 // S5 — security (Home Assistant / ESPHome). DWC on the frame top, latch side; KPD inside the entrance next to the panel;
 // MOT in the corner that sees the most doors; SRN: indoors high and visible, outdoors above the entrance at 2800.
 {code:'DWC', anchor:'openingLatch', h:2050, off:120, n:'Tok teteje, a kilincs felőli oldalon'},
 {code:'KPD', anchor:'doorHandle',  h:1450, off:600, n:'Bejárat mellett, kilincs felől (a panel mellett)'},
 {code:'MOT', anchor:'doorCorner',  h:2200, n:'A legtöbb ajtót belátó sarok'},
 {code:'SRN', anchor:'farCorner',   h:2300, n:'Beltéri sziréna: magas, jól hallható pont'},
 {code:'SRN', anchor:'entryOuter',  h:2800, off:400, n:'Kültéri sziréna: a bejárat fölött, kívül, elérhetetlen magasságban'},
 {code:'*',   anchor:'avoid',       n:'Tilos / kerülendő jelölés'}];

// geometry helpers -------------------------------------------------------------------------------------------------------------------
function sugHostWall(level,x,y){let best=null,bd=1e9;(WALLS[level]||[]).forEach(r=>{const wi=wallInfo(r),a=wi.seg[0],b=wi.seg[1],nr=nearestOnSegPlain(x,y,a[0],a[1],b[0],b[1]);if(nr.d<bd){bd=nr.d;best=r;}});return best;}
// a door's frame in a room: centre, along-wall unit d, into-room normal n, the host wall, the handle-side jamb direction
function sugDoor(o,rid){const rs=mrkDoorRooms(o).map(e=>e?stkRoomId(e):null),s=rs[0]===rid?1:-1;
  const d=[Math.cos(o.ang||0),Math.sin(o.ang||0)],n=[-Math.sin(o.ang||0)*s,Math.cos(o.ang||0)*s],w=(o.w||DOOR_W)/2;
  const hingeFar=!!((o.variant||0)&2),hd=hingeFar?-1:1;            // the handle jamb is the one opposite the hinge
  return {o,c:[o.x,o.y],d,n,w,hd,r:sugHostWall(o.level,o.x,o.y),side:s};}
// a wall-centreline point (where wall devices live) at along-wall offset k from the door centre, facing the room
function sugDoorPt(D,k,h,why){const x=D.c[0]+D.d[0]*k,y=D.c[1]+D.d[1]*k,r=D.r;if(!r)return null;
  const wi=wallInfo(r),side=Math.sign(D.n[0]*wi.perp[0]+D.n[1]*wi.perp[1])||1;
  return {kind:'pt',x:Math.round(x),y:Math.round(y),h,level:D.o.level,wall:r.id,side,mount:'wall',why};}
function sugCentroid(poly){let a=0,cx=0,cy=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const f=poly[j][0]*poly[i][1]-poly[i][0]*poly[j][1];a+=f;cx+=(poly[j][0]+poly[i][0])*f;cy+=(poly[j][1]+poly[i][1])*f;}
  if(Math.abs(a)<1e-9){const b=polyBBox(poly);return [(b.x0+b.x1)/2,(b.y0+b.y1)/2];}return [cx/(3*a),cy/(3*a)];}
// every face of the room: {r, side, u0, u1}
function sugFaces(e){const out=[];(WALLS[e.level]||[]).forEach(r=>{[1,-1].forEach(side=>{mrkFaceRanges(r,side,e.rm.poly).forEach(g=>{if(g[1]-g[0]>=100)out.push({r,side,u0:g[0],u1:g[1]});});});});return out;}
function sugCeil(e,x,y){return epCeilH(e.level,x,y);}

// anchors → hints [{kind:'pt'|'band'|'strip'|'cover', …, why}] -------------------------------------------------------------------------
const SUG_ANCHORS={
 doorHandle(R,e,rid){const out=[];needOpenings(rid,'door').forEach(o=>{if((R.code==='PAN'||R.code==='KPD')&&mrkOpeningTags(o.id).indexOf('bejarat')<0)return;
   const D=sugDoor(o,rid),p=sugDoorPt(D,D.hd*(D.w+R.off),R.h,R.n);if(p)out.push(p);});return out;},
 doorFlank(R,e,rid){const out=[];needOpenings(rid,'door').forEach(o=>{const t=mrkOpeningTags(o.id);if(!['portal','bejarat','lepcso'].some(k=>t.indexOf(k)>=0))return;
   const D=sugDoor(o,rid),p=sugDoorPt(D,D.hd*(D.w+R.off),R.h,R.n);if(p)out.push(p);});return out;},
 doorLintel(R,e,rid){const out=[];needOpenings(rid,'door').forEach(o=>{const t=mrkOpeningTags(o.id);if(t.indexOf('p2')<0&&t.indexOf('p3')<0)return;
   const D=sugDoor(o,rid),p=sugDoorPt(D,0,R.h,R.n);if(p)out.push(p);});return out;},
 windowTop(R,e,rid){const out=[];needOpenings(rid,'window').forEach(o=>{const t=mrkOpeningTags(o.id);if(t.indexOf('redony')<0&&t.indexOf('arnyekolo')<0)return;
   const head=(o.sill!=null?o.sill:WIN_SILL)+(o.h||WIN_H),D=sugDoor(o,rid),p=sugDoorPt(D,0,head+(R.off||0),R.n);if(p)out.push(p);});return out;},
 hband(R,e,rid){const out=[],faces=sugFaces(e);
   faces.forEach(f=>{const ms=(typeof mrkAt==='function')?mrkAt(e.level,f.r.id,f.side,(f.u0+f.u1)/2,null):[];
     const L=ms.some(x=>x.kind==='side'&&(x.tags||[]).indexOf('lforma')>=0),plus=ms.some(x=>x.kind==='side'&&x.pol==='plus');
     const band=ms.find(x=>(x.kind==='hstrip'||x.kind==='hband')&&(x.tags||[]).indexOf('dugalj')>=0);
     if(L||plus||band){const v=band?[band.m.v0,band.m.v1]:[150,450];
       out.push({kind:'band',level:e.level,wall:f.r.id,side:f.side,u0:f.u0,u1:f.u1,v0:v[0],v1:v[1],why:L?'L-forma':(band?'Dugaljsáv':'Előnyös oldal'),pri:L?0:1});}});
   return out.sort((a,b)=>a.pri-b.pri);},
 roomCentre(R,e){const c=sugCentroid(e.rm.poly),out=[{kind:'pt',x:Math.round(c[0]),y:Math.round(c[1]),h:sugCeil(e,c[0],c[1]),level:e.level,mount:'ceiling',why:'A helyiség közepe'}];
   if(typeof mrkRoomZones==='function')mrkRoomZones(stkRoomId(e),'ceiling').forEach(m=>{if((m.tags||[]).indexOf('lampasor')<0)return;
     let x,y;if(m.kind==='pstrip'){const b=mrkPstripBox(m);if(!b)return;x=(b.x0+b.x1)/2;y=(b.y0+b.y1)/2;}else if(m.shape==='rect'){x=(m.x0+m.x1)/2;y=(m.y0+m.y1)/2;}else{x=m.cx;y=m.cy;}
     out.push({kind:'pt',x:Math.round(x),y:Math.round(y),h:sugCeil(e,x,y),level:e.level,mount:'ceiling',why:'Lámpasor'});});
   return out;},
 farCorner(R,e,rid){const P=e.rm.poly,ds=needOpenings(rid,'door'),ref=ds.length?[ds.reduce((s,o)=>s+o.x,0)/ds.length,ds.reduce((s,o)=>s+o.y,0)/ds.length]:sugCentroid(P);
   let bi=0,bd=-1;P.forEach((v,i)=>{const d=Math.hypot(v[0]-ref[0],v[1]-ref[1]);if(d>bd){bd=d;bi=i;}});
   const v=P[bi],a=P[(bi+P.length-1)%P.length],b=P[(bi+1)%P.length],ua=[a[0]-v[0],a[1]-v[1]],ub=[b[0]-v[0],b[1]-v[1]],la=Math.hypot(...ua)||1,lb=Math.hypot(...ub)||1;
   let bx=ua[0]/la+ub[0]/lb,by=ua[1]/la+ub[1]/lb;const bl=Math.hypot(bx,by)||1;bx/=bl;by/=bl;
   let x=v[0]+bx*300,y=v[1]+by*300;if(!pointInPoly(x,y,P)){x=v[0]-bx*300;y=v[1]-by*300;}
   return [{kind:'pt',x:Math.round(x),y:Math.round(y),h:Math.min(R.h,sugCeil(e,x,y)),level:e.level,mount:'ceiling',why:'Átlós sarok az ajtóval'}];},
 innerWall(R,e,rid){const wins=needOpenings(rid,'window');let best=null;
   sugFaces(e).forEach(f=>{const tags=mrkWallTags(f.r.id);if(tags.indexOf('homlokzat')>=0)return;
     if(mrkAt(e.level,f.r.id,f.side,null,null).some(x=>x.kind==='side'&&(x.tags||[]).indexOf('radiator')>=0))return;
     if(wins.some(o=>rfInRect(o.x,o.y,f.r,30)))return;
     if(!best||f.u1-f.u0>best.u1-best.u0)best=f;});
   if(!best)return [];const u=(best.u0+best.u1)/2,p=mrkFacePt(best.r,best.side,u,-wallInfo(best.r).thick/2);
   return [{kind:'pt',x:Math.round(p[0]),y:Math.round(p[1]),h:R.h,level:e.level,wall:best.r.id,side:best.side,mount:'wall',why:'Leghosszabb belső fal'}];},
 ceilingPair(R,e){const P=e.rm.poly,bb=polyBBox(P);let face=null;
   sugFaces(e).forEach(f=>{if(!face&&mrkAt(e.level,f.r.id,f.side,(f.u0+f.u1)/2,null).some(x=>x.kind==='side'&&(x.tags||[]).indexOf('media')>=0))face=f;});
   let pts;
   if(face){const wi=wallInfo(face.r),n=[wi.perp[0]*face.side,wi.perp[1]*face.side];
     if(wi.horiz){const a=Math.max(Math.min(face.r.x0,face.r.x1),bb.x0),b=Math.min(Math.max(face.r.x0,face.r.x1),bb.x1),y0=n[1]>0?bb.y0:bb.y1,y=y0+n[1]*(bb.y1-bb.y0)/3;
       pts=[[a+(b-a)/4,y],[a+3*(b-a)/4,y]];}
     else{const a=Math.max(Math.min(face.r.y0,face.r.y1),bb.y0),b=Math.min(Math.max(face.r.y0,face.r.y1),bb.y1),x0=n[0]>0?bb.x0:bb.x1,x=x0+n[0]*(bb.x1-bb.x0)/3;
       pts=[[x,a+(b-a)/4],[x,a+3*(b-a)/4]];}}
   else if(bb.x1-bb.x0>=bb.y1-bb.y0){const y=(bb.y0+bb.y1)/2;pts=[[bb.x0+(bb.x1-bb.x0)/4,y],[bb.x0+3*(bb.x1-bb.x0)/4,y]];}
   else{const x=(bb.x0+bb.x1)/2;pts=[[x,bb.y0+(bb.y1-bb.y0)/4],[x,bb.y0+3*(bb.y1-bb.y0)/4]];}
   return pts.map(p=>({kind:'pt',x:Math.round(p[0]),y:Math.round(p[1]),h:sugCeil(e,p[0],p[1]),level:e.level,mount:'ceiling',why:face?'Médiafalra szimmetrikus pár':'Hosszanti tengely'}));},
 coverageGap(R,e,rid){if(typeof rfGrid!=='function')return SUG_ANCHORS.roomCentre(R,e);
   const cov=new Set(rfGrid(e.level,'wifi').cells.map(c=>c.i+','+c.j)),miss=prtGrid(e.rm.poly,RF_GRID).filter(c=>!cov.has(c.i+','+c.j));
   if(!miss.length)return [];const x=miss.reduce((s,c)=>s+(c.i+0.5)*RF_GRID,0)/miss.length,y=miss.reduce((s,c)=>s+(c.j+0.5)*RF_GRID,0)/miss.length;
   return [{kind:'pt',x:Math.round(x),y:Math.round(y),h:sugCeil(e,x,y),level:e.level,mount:'ceiling',why:'WiFi lefedetlen rész közepe'}];},
 hstripTag(R,e){const out=[];sugFaces(e).forEach(f=>{mrkAt(e.level,f.r.id,f.side,(f.u0+f.u1)/2,null).forEach(x=>{if((x.kind==='hstrip'||x.kind==='hband')&&(x.tags||[]).indexOf(R.tag)>=0)
   out.push({kind:'band',level:e.level,wall:f.r.id,side:f.side,u0:f.u0,u1:f.u1,v0:x.m.v0,v1:x.m.v1,why:R.n});});});return out;},
 traceTag(R,e){const out=[];if(typeof trcList!=='function')return out;
   trcList().forEach(t=>{if(t.level!==e.level||(t.tags||[]).indexOf(R.tag)<0)return;
     trcAlong(t.pts,1500,750).forEach(q=>{if(!pointInPoly(q.x,q.y,e.rm.poly))return;let best=null,bd=1000;
       (WALLS[e.level]||[]).forEach(r=>{const wi=wallInfo(r),a=wi.seg[0],b=wi.seg[1],nr=nearestOnSegPlain(q.x,q.y,a[0],a[1],b[0],b[1]),d=nr.d-wi.thick/2;if(d<bd){bd=d;best={r,nr};}});
       if(!best)return;const wi=wallInfo(best.r),u=mrkU(best.r,q.x,q.y),off=(q.x-wi.seg[0][0])*wi.perp[0]+(q.y-wi.seg[0][1])*wi.perp[1],side=off>=0?1:-1,p=mrkFacePt(best.r,side,u,-wi.thick/2);
       out.push({kind:'pt',x:Math.round(p[0]),y:Math.round(p[1]),h:R.h,level:e.level,wall:best.r.id,side,mount:'wall',why:R.n});});});
   return out;},
 // S5: the latch-side top corner of every perimeter opening (doors at the frame top, windows above the head)
 openingLatch(R,e,rid){const out=[];needOpenings(rid).forEach(o=>{const t=mrkOpeningTags(o.id);
   if(!['kulso','bejarat','nyitaserz','vedett'].some(k=>t.indexOf(k)>=0))return;
   const D=sugDoor(o,rid),h=o.type==='window'?((o.sill!=null?o.sill:WIN_SILL)+(o.h||WIN_H)+50):R.h,p=sugDoorPt(D,D.hd*Math.max(0,D.w-R.off),h,R.n);if(p)out.push(p);});return out;},
 // S5: the convex room corner whose view (the quadrant between its two walls) holds the most door centres
 doorCorner(R,e,rid){const P=e.rm.poly,ds=needOpenings(rid,'door');if(P.length<3)return [];let best=null;
   P.forEach((v,i)=>{const a=P[(i+P.length-1)%P.length],b=P[(i+1)%P.length],ua=[a[0]-v[0],a[1]-v[1]],ub=[b[0]-v[0],b[1]-v[1]];
     const la=Math.hypot(ua[0],ua[1])||1,lb=Math.hypot(ub[0],ub[1])||1,na=[ua[0]/la,ua[1]/la],nb=[ub[0]/lb,ub[1]/lb];
     let bx=na[0]+nb[0],by=na[1]+nb[1];const bl=Math.hypot(bx,by);if(bl<1e-6)return;bx/=bl;by/=bl;
     const q=[v[0]+bx*150,v[1]+by*150];if(!pointInPoly(q[0],q[1],P))return;            // a reflex corner looks into the wall
     const seen=ds.filter(o=>{const dx=o.x-v[0],dy=o.y-v[1];return dx*na[0]+dy*na[1]>=0&&dx*nb[0]+dy*nb[1]>=0;}).length;
     const far=ds.length?Math.min.apply(null,ds.map(o=>Math.hypot(o.x-v[0],o.y-v[1]))):0;
     if(!best||seen>best.seen||(seen===best.seen&&far>best.far))best={q,seen,far};});
   if(!best)return [];const r=sugHostWall(e.level,best.q[0],best.q[1]),wi=r?wallInfo(r):null;
   const side=wi?(((best.q[0]-(r.x0+r.x1)/2)*wi.perp[0]+(best.q[1]-(r.y0+r.y1)/2)*wi.perp[1])>=0?1:-1):1;
   return [{kind:'pt',x:Math.round(best.q[0]),y:Math.round(best.q[1]),h:Math.min(R.h,sugCeil(e,best.q[0],best.q[1])),level:e.level,
     wall:r?r.id:null,side,mount:'wall',why:R.n+(ds.length?' ('+best.seen+'/'+ds.length+' ajtó)':'')}];},
 // S5: above the entrance, on the OUTER face, hinge side — out of reach
 entryOuter(R,e,rid){const out=[];needOpenings(rid,'door').forEach(o=>{if(mrkOpeningTags(o.id).indexOf('bejarat')<0)return;
   const D=sugDoor(o,rid),p=sugDoorPt(D,-D.hd*(D.w+R.off),R.h,R.n);if(p){p.side=-p.side;out.push(p);}});return out;},
 avoid(R,e,rid){const out=[];if(typeof mrkList!=='function')return out;
   sugFaces(e).forEach(f=>{mrkAt(e.level,f.r.id,f.side,null,null).forEach(x=>{if(x.pol!=='ban'&&x.pol!=='minus')return;
     if(x.kind==='wall'||x.kind==='side')out.push({kind:'cover',level:e.level,wall:f.r.id,side:f.side,u0:f.u0,u1:f.u1,pol:x.pol,why:(x.tags||[]).join(', ')});
     else if(x.kind==='vstrip')out.push({kind:'cover',level:e.level,wall:f.r.id,side:f.side,u0:Math.max(f.u0,x.m.u0),u1:Math.min(f.u1,x.m.u1),pol:x.pol,why:(x.tags||[]).join(', ')});});});
   return out;}};
function sugRulesFor(code,role){return SUG_RULES.filter(r=>(r.code===code||r.code==='*')&&(!r.role||!role||r.role===role));}
// every hint for a code in a room
function sugFor(code,role,roomId){const e=mrkRoomById(roomId);if(!e)return [];const out=[];
  sugRulesFor(code,role).forEach(R=>{const f=SUG_ANCHORS[R.anchor];if(!f)return;try{(f(R,e,roomId)||[]).forEach(h=>{h.rule=R.anchor;out.push(h);});}catch(_){}});
  return out;}
// the room a ghost is in: a wall ghost by its face probe, a plan ghost by its point
function sugRoomOf(g){if(g.wall){const r=mrkWallById(g.level,g.wall);if(r){const e=mrkRoomOfFace(g.level,r,g.wallSide||(g.side?1:-1),g.u!=null?g.u:mrkU(r,g.x,g.y));if(e)return stkRoomId(e);}}
  const e=mrkRoomAtPt(g.level,g.x,g.y);return e?stkRoomId(e):null;}
// soft snap: onto a point hint within 300 mm; a band on the ghost's face sets its height to the band's middle
function sugSnap(g,code,role){if(!g||state.sugOn===false)return g;const rid=sugRoomOf(g);if(!rid)return g;
  const hs=sugFor(code,role,rid);let best=null,bd=300;
  hs.forEach(h=>{if(h.kind!=='pt'||h.mount!==g.mount)return;if(g.mount==='wall'&&h.wall&&g.wall&&h.wall!==g.wall)return;
    const d=Math.hypot(h.x-g.x,h.y-g.y);if(d<bd){bd=d;best=h;}});
  if(best){const o=Object.assign({},g,{x:best.x,y:best.y,h:best.h!=null?best.h:g.h,why:best.why,snapped:true});
    if(best.side!=null){o.side=best.side>0?1:0;o.wallSide=best.side;}return o;}
  if(g.mount==='wall'){const ws=g.wallSide||(g.side?1:-1),u=g.u!=null?g.u:null;
    const b=hs.find(h=>h.kind==='band'&&h.wall===g.wall&&h.side===ws&&(u==null||(u>=h.u0-1&&u<=h.u1+1)));
    if(b)return Object.assign({},g,{h:Math.round((b.v0+b.v1)/2),why:b.why,snapped:true});}
  return g;}

// ---- the overlay -------------------------------------------------------------------------------------------------------------------------
function sugOverlaySvg(){if(state.sugOn===false||typeof EP_T==='undefined'||!EP_T.on||!EP_T.g)return '';
  const g=EP_T.g,rid=sugRoomOf(g);if(!rid)return '';const col=EP_ROLE_COL[EP_T.role]||'#2f6fb0';let s='';
  sugFor(EP_T.code,EP_T.role,rid).forEach(h=>{const z0=dz(h.level,0);
    if(h.kind==='pt'){const b=planToBase(h.x,h.y,dz(h.level,h.h||0));
      s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(7)}" fill="none" stroke="${col}" stroke-width="${vsP(1.6)}" opacity="0.7"/>`
        +`<line x1="${(b[0]-10).toFixed(1)}" y1="${b[1].toFixed(1)}" x2="${(b[0]+10).toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" opacity="0.7"/>`
        +`<line x1="${b[0].toFixed(1)}" y1="${(b[1]-10).toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${(b[1]+10).toFixed(1)}" stroke="${col}" opacity="0.7"/>`;}
    else{const r=mrkWallById(h.level,h.wall);if(!r)return;const a=mrkFacePt(r,h.side,h.u0,8),b=mrkFacePt(r,h.side,h.u1,8);
      const c=h.kind==='cover'?(h.pol==='ban'?'#c8372d':'#d08a1e'):col,o=h.kind==='cover'?(h.pol==='ban'?0.5:0.4):0.45;
      s+=`<polyline points="${p2b([[a[0],a[1],z0],[b[0],b[1],z0]])}" fill="none" stroke="${c}" stroke-width="${vsP(5)}" stroke-opacity="${o}" stroke-linecap="butt"/>`;}});
  if(g.snapped&&g.why){const b=planToBase(g.x,g.y,dz(g.level,g.h||0)),x=b[0].toFixed(1),y=(b[1]-14).toFixed(1),t=esc(g.why);   // haloed: stroke pass, then fill pass
    s+=`<text x="${x}" y="${y}" font-size="${vsP(8.5)}" text-anchor="middle" fill="none" stroke="#fff" stroke-width="${vsP(2.6)}" stroke-linejoin="round">${t}</text><text x="${x}" y="${y}" font-size="${vsP(8.5)}" text-anchor="middle" fill="${col}">${t}</text>`;}
  return s?`<g pointer-events="none">${s}</g>`:'';}
STK_OVERLAY.push(sugOverlaySvg);

registerActions([
 {id:'need.room',alias:'helyiseg igenyei checklist needs room',label:'Helyiség igényei…',icon:'☑',group:'Szükséglet',
  hint:'A kijelölt helyiség rendszer-rétegenkénti igénylistája (pipák a fajta szerint, levezetett tételek a Jelölés rétegből).',
  need:'Jelölj ki egy helyiséget (padlót), vagy használd az áttekintést.',when:c=>!!stkActive()&&c.selType==='floors',run:c=>needDialog(data.floors[c.sel.i])},
 {id:'need.overview',alias:'helyisegek igenyei attekintes needs overview',label:'Helyiségek igényei — áttekintés',icon:'☷',group:'Szükséglet',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>needOverview()},
 {id:'need.export',alias:'igenylista export json needs',label:'Igénylista exportálása (JSON)',icon:'⬇',group:'Szükséglet',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>download('igenylista-'+stkActive().name.replace(/\s+/g,'_')+'.json',JSON.stringify(needReport(),null,1))},
 {id:'sug.toggle',alias:'javaslatok ki be suggestions toggle',label:'Javaslatok be / ki',icon:'✦',group:'Végpont',
  hint:'Elhelyezési javaslatok és puha illesztés a Jelölés réteg alapján (Alt: szabad elhelyezés).',
  run:()=>{state.sugOn=state.sugOn===false;lyrHud('Javaslatok '+(state.sugOn===false?'ki':'be'));draw();}}
]);

// test hooks
window.NEED_KINDS=NEED_KINDS;window.NEED_DEFAULTS=NEED_DEFAULTS;window.SUG_RULES=SUG_RULES;window.SUG_ANCHORS=SUG_ANCHORS;
window.needFold=needFold;window.needKind=needKind;window.needDefaults=needDefaults;window.needDerived=needDerived;window.needOf=needOf;window.needSet=needSet;
window.needHave=needHave;window.needStatus=needStatus;window.needRoomSummary=needRoomSummary;window.needNextRole=needNextRole;window.needReport=needReport;
window.needDialog=needDialog;window.needOverview=needOverview;window.sugFor=sugFor;window.sugSnap=sugSnap;window.sugRoomOf=sugRoomOf;window.sugOverlaySvg=sugOverlaySvg;
