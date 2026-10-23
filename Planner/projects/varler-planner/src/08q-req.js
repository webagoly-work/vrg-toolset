// ==========================================================================
// 08q-req.js — round 2026-10-18 (docs/round-2026-10-18), WP-N1 + N2: Igénylista
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// A COUNTED request list per room: "dugalj 4 · lámpa 2 on 2 kapcsolási kör / 1 világítási kör · kapcsolók 105, 106".
// It extends 05t (ticks per role × room) instead of duplicating it — the room kind (needKind), the openings and their
// Jelölés tags come from there. Answers: N1 A (one system; 05t reads the counts in N4), N2 A (works without a BRIDGE
// stack), N3 B (no house data: Ház = the sum of the rooms), N4 B (the világítási kör is asked too; the number of
// kapcsolási kör is the primary number, the pairing is optional), N5 B (a switch row is its type only), N6 A (soft:
// nothing is created). Erősáram only in this round; the other layers join by adding REQ_ITEMS rows (40_INTEGRATION).
//
// The layer: role 'need' (*Igények*) right after Jelölés, OPTIONAL (opt:true — a new stack does not get it; the user
// adds it), or a plain layer {req:true} when there is no stack. The data lives on the room (rm.req), so it survives
// the layer. Prefix: req.

STK_ROLES.splice(STK_ROLES.findIndex(r=>r.k==='mark')+1,0,
  {k:'need', n:'Igények', ph:1, opt:true, cats:['mark'], hint:'Helyiségenkénti igénylista: mi kell és hány darab (dugalj, lámpa, kapcsolási kör, kapcsoló). A Ház = a helyiségek összege.'});
STK_ICONS.need='☑';STK_COL.need='#5d6d7e';
// its Info text (RLI_TEXT.need) is in 13-role-info.js — that const is still in its TDZ here

// ---- N2: the Erősáram items --------------------------------------------------------------------------------------------
// kind: n = a count · rows = a list (each row its own spec) · lamp = n lámpa / k kapcsolási kör / v világítási kör
const REQ_ITEMS=[
 {k:'soc',    n:'Dugalj',                     role:'sys:SOC',  code:'SOC', kind:'n',    f:{n:'db',dbl:'ebből dupla'}},
 {k:'soc_app',n:'Készülék dugalj',            role:'sys:SOC',  code:'SOC', kind:'rows', f:{n:'készülék',h:'magasság'}},
 {k:'lmp',    n:'Lámpa',                      role:'sys:LIGHT',code:'LMP', kind:'lamp', f:{n:'lámpa',k:'kapcsolási kör',v:'világítási kör'}},
 {k:'swi',    n:'Kapcsoló',                   role:'sys:LIGHT',code:'SWI', kind:'rows', f:{type:'típus'}},
 {k:'shu',    n:'Redőny / árnyékoló',         role:'sys:LIGHT',code:'SHU', kind:'n',    f:{n:'db'}},
 {k:'ded',    n:'Dedikált fogyasztó',         role:'sys:DED',  code:'DED', kind:'rows', f:{n:'fogyasztó',A:'A',ph:'fázis'}},
 // R1 (2026-10-18): at a bedside spot — a socket + a 101 switch + the reading light above it, per side. It adds to the
 // dugalj / lámpa / kapcsoló totals (one kapcsolási kör per side), it is not a device of its own.
 {k:'read',   n:'Olvasólámpa az ágy mellett (dugalj + 101 + lámpa)', role:'sys:LIGHT', code:null, kind:'n', f:{n:'oldal'}}];
// the switch types a row may take (the HU codes — 105 csillár · 106 váltó · 107 kereszt · 108 dupla váltó; never renumber)
const REQ_SW_TYPES=['101','105','106','107','108','100','redony'];
function reqItem(k){return REQ_ITEMS.find(x=>x.k===k)||null;}

// room kind → the suggestion. Numbers = the WF R4 standards practice; ⏸ the user reviews this table before N3.
// lmp: [n lámpa, k kapcsolási kör]; swi: 'auto' = from k and the door count; a list = fixed rows.
const REQ_SUGGEST={
 eloszoba: {soc:{n:1},          lmp:[1,1], swi:'auto'},
 nappali:  {soc:{n:6,dbl:2},    lmp:[3,2], swi:['105']},
 konyha:   {soc:{n:5},          soc_app:[{n:'hűtő'},{n:'mosogatógép'},{n:'páraelszívó',h:1900}], lmp:[2,2], swi:['105'],
            ded:[{n:'sütő',A:16,ph:1},{n:'főzőlap',A:16,ph:3}]},
 etkezo:   {soc:{n:2},          lmp:[1,1], swi:'auto'},
 halo:     {soc:{n:4,dbl:2},    lmp:[1,1], swi:['106','107','106'], opt:{read:2}},   // R1: one string ajtó → ágy egyik oldala → másik oldala; option: olvasólámpa per side
 dolgozo:  {soc:{n:4},          lmp:[1,1], swi:'auto'},
 furdo:    {soc:{n:0},          soc_app:[{n:'borotva',h:1400},{n:'mosógép'}], lmp:[2,2], swi:['105']},   // tükör külön kör
 wc:       {soc:{n:0},          lmp:[1,1], swi:['101']},
 kamra:    {soc:{n:0},          lmp:[1,1], swi:['101']},
 kozlekedo:{soc:{n:1},          lmp:['len',1], swi:'auto'},            // 1 lámpa / 3 m a hosszabb oldalon
 gepeszet: {soc:{n:2},          lmp:[1,1], swi:['101'], ded:[{n:'kazán',A:10,ph:1}]},
 kulter:   {soc:{n:1},          lmp:[1,1], swi:['101']},                // IP44, a kapcsoló belül
 egyeb:    {soc:{n:2},          lmp:[1,1], swi:'auto'}};

// switch rows from the number of kapcsolási kör and doors: 1 door → 101 (k 1) / 105 (k 2) / 101 + 105… ; 2 doors → a 106
// pair (k 2: 108 pair); 3+ doors → 106 + 107 × (doors − 2) + 106. More than 2 kör from one door: one 105 per two kör.
function reqSwAuto(k,doors){k=Math.max(1,k|0);doors=Math.max(1,doors|0);
  if(doors===1){const out=[];let left=k;while(left>0){out.push(left>=2?'105':'101');left-=2;}return out;}
  const end=k>=2?'108':'106',mid=[];for(let i=0;i<doors-2;i++)mid.push('107');
  return [end].concat(mid,[end]);}
function reqRoomId(rm){const e=typeof needRoomEntry==='function'?needRoomEntry(rm):null;return e&&stkRoomId(e);}
function reqDoors(rm){const rid=reqRoomId(rm);return rid&&typeof needOpenings==='function'?needOpenings(rid,'door').length:1;}
function reqShutters(rm){const rid=reqRoomId(rm);if(!rid||typeof needOpenings!=='function'||typeof mrkOpeningTags!=='function')return 0;
  return needOpenings(rid,'window').filter(o=>{const t=mrkOpeningTags(o.id);return t.indexOf('redony')>=0||t.indexOf('arnyekolo')>=0;}).length;}
// the suggestion for one room, as a full rm.req.items object
function reqSuggest(rm){const kind=typeof needKind==='function'?needKind(rm):'egyeb',S=REQ_SUGGEST[kind]||REQ_SUGGEST.egyeb,it={};
  const copy=o=>JSON.parse(JSON.stringify(o));
  if(S.soc&&S.soc.n>0)it.soc=Object.assign({n:0,dbl:0},copy(S.soc));
  if(S.soc_app)it.soc_app={rows:copy(S.soc_app)};
  if(S.lmp){let n=S.lmp[0];if(n==='len'){const b=rm&&rm.poly?polyBBox(rm.poly):null;n=b?Math.max(1,Math.round(Math.max(b.x1-b.x0,b.y1-b.y0)/3000)):1;}
    it.lmp={n,k:Math.min(n,S.lmp[1]),v:1};}
  const rows=S.swi==='auto'?reqSwAuto(it.lmp?it.lmp.k:1,reqDoors(rm)):(S.swi||[]);
  if(rows.length)it.swi={rows:rows.map(t=>({type:t}))};
  const sh=reqShutters(rm);if(sh)it.shu={n:sh};
  if(S.ded)it.ded={rows:copy(S.ded)};
  return {kind,items:it,opt:S.opt?copy(S.opt):{}};}   // opt: offered, not applied by reqTake (the bedside reading light)

// ---- N1: the data ------------------------------------------------------------------------------------------------------
function reqOf(rm){return rm&&rm.req&&rm.req.items?rm.req:null;}
function reqSaved(rm){return !!reqOf(rm);}
// what the room asks for: the saved list, else nothing (a suggestion is only taken by the user — N6 A)
function reqItems(rm){const r=reqOf(rm);return r?r.items:{};}
function reqUndo(rm,label){const isFloor=data.floors.indexOf(rm)>=0;if(isFloor)pushUndo(['floors']);
  else if(typeof lyrHud==='function')lyrHud('Épületmodell-helyiség: ez a módosítás nem vonható vissza.');
  if(typeof invalidateShell==='function')invalidateShell();}
// one item: spec = null removes it; n / k / v are clamped (k ≤ n, v ≤ k), rows keep only known switch types
function reqClean(key,spec){const I=reqItem(key);if(!I||spec==null)return null;const o=JSON.parse(JSON.stringify(spec));
  const nn=v=>Math.max(0,Math.round(+v||0));
  if(I.kind==='n'){o.n=nn(o.n);if(o.dbl!=null)o.dbl=Math.min(o.n,nn(o.dbl));}
  if(I.kind==='lamp'){o.n=nn(o.n);o.k=Math.min(o.n,Math.max(o.n?1:0,nn(o.k)));o.v=Math.min(Math.max(o.k,o.k?1:0),Math.max(o.k?1:0,nn(o.v||1)));
    if(Array.isArray(o.pair))o.pair=o.pair.filter(p=>p&&p.kk>=1&&p.kk<=o.k&&p.vk>=1&&p.vk<=o.v);}
  if(I.kind==='rows'){o.rows=(o.rows||[]).filter(Boolean);if(key==='swi')o.rows=o.rows.filter(r=>REQ_SW_TYPES.indexOf(String(r.type))>=0);}
  return o;}
function reqSet(rm,key,spec){if(!rm||!reqItem(key))return false;reqUndo(rm);
  rm.req=rm.req||{v:1,items:{}};const c=reqClean(key,spec);if(c)rm.req.items[key]=c;else delete rm.req.items[key];
  return true;}
// take the suggestion (one undo step); keep = keys the user already set stay as they are
function reqTake(rm,keep){if(!rm)return false;const S=reqSuggest(rm);reqUndo(rm);
  const old=reqItems(rm),items={};Object.keys(S.items).forEach(k=>{items[k]=reqClean(k,S.items[k]);});
  if(keep)Object.keys(old).forEach(k=>{items[k]=old[k];});
  rm.req={v:1,items};return true;}
function reqClear(rm){if(!rm||!rm.req)return false;reqUndo(rm);delete rm.req;return true;}
// how many units an item asks for (rows → row count; soc_app counts as sockets, ded as consumers)
function reqCount(key,spec){const I=reqItem(key);if(!I||!spec)return 0;return I.kind==='rows'?(spec.rows||[]).length:(+spec.n||0);}
// N3 B: the house is the sum of every room — no data of its own
function reqRooms(){const out=[];ORD.forEach(l=>allRooms(l).forEach(e=>{if(reqOf(e.rm))out.push({level:l,rm:e.rm});}));return out;}
function reqHouseSum(){const sum={},sw={};
  reqRooms().forEach(({rm})=>{const it=reqItems(rm);Object.keys(it).forEach(k=>{
    const s=sum[k]||(sum[k]={key:k,n:0,rooms:0});s.n+=reqCount(k,it[k]);s.rooms++;
    if(k==='soc'){s.dbl=(s.dbl||0)+(+it[k].dbl||0);}
    if(k==='lmp'){s.k=(s.k||0)+(+it[k].k||0);s.v=(s.v||0)+(+it[k].v||0);}
    if(k==='swi')(it[k].rows||[]).forEach(r=>{sw[r.type]=(sw[r.type]||0)+1;});});});
  if(sum.swi)sum.swi.byType=sw;
  return sum;}

// ---- the layer -----------------------------------------------------------------------------------------------------------
function reqLayer(){const S=typeof stkActive==='function'?stkActive():null;
  return (S&&stkLayer(S.id,'need'))||layers.find(l=>l.req)||null;}
// add it: inside the active stack right after Jelölés (role need); without a stack a plain layer {req:true}
function reqLayerAdd(){const ex=reqLayer();if(ex){state.activeLayer=ex.id;lyrRefresh();return ex;}
  lyrPushUndo();const S=typeof stkActive==='function'?stkActive():null;let L;
  if(S){L=stkMakeLayer(S,stkRole('need'));const mk=stkLayer(S.id,'mark');const at=mk?layers.indexOf(mk)+1:layers.length;layers.splice(at,0,L);stkSync(S);}
  else{L={id:lyrNewId(),name:'Igények',visible:true,cats:layerCatsAll(),req:true};layers.push(L);}
  state.activeLayer=L.id;lyrRefresh();if(typeof lyrHud==='function')lyrHud('Igények réteg: jobb klikk egy helyiségen → Igénylista.');
  return L;}
registerActions([{id:'req.layer',label:'Igénylista réteg',icon:'☑',group:'Réteg',alias:'igenylista igenyek checklist needs requests layer',
  hint:'Helyiségenkénti igénylista darabszámokkal (dugalj, lámpa, kapcsolási kör, kapcsoló). Stackben a Jelölés után.',
  when:()=>true,run:()=>reqLayerAdd()}]);
if(typeof STK_LAYERMENU!=='undefined')STK_LAYERMENU.push((L,items)=>{if(L.role==='mark'&&L.stack&&!stkLayer(L.stack,'need'))
  items.push({label:'☑ Igények réteg hozzáadása',act:()=>{state.activeLayer=L.id;reqLayerAdd();}});});
window.REQ_ITEMS=REQ_ITEMS;window.REQ_SUGGEST=REQ_SUGGEST;

// ---- N4: what the room has vs what it asks for ---------------------------------------------------------------------------
// the totals a request adds up to (the bedside reading light adds a socket, a lamp, a kapcsolási kör and a 101 per side)
function reqTotals(rm){const it=reqItems(rm),rd=+((it.read||{}).n)||0,T={SOC:0,LMP:0,KK:0,VK:0,SWI:0,SHU:0,DED:0,sw:{}};
  if(it.soc)T.SOC+=+it.soc.n||0;if(it.soc_app)T.SOC+=(it.soc_app.rows||[]).length;T.SOC+=rd;
  if(it.lmp){T.LMP+=+it.lmp.n||0;T.KK+=+it.lmp.k||0;T.VK+=+it.lmp.v||0;}T.LMP+=rd;T.KK+=rd;
  ((it.swi&&it.swi.rows)||[]).forEach(r=>{T.SWI++;T.sw[r.type]=(T.sw[r.type]||0)+1;});
  if(rd){T.SWI+=rd;T.sw['101']=(T.sw['101']||0)+rd;}
  if(it.shu)T.SHU+=+it.shu.n||0;if(it.ded)T.DED+=(it.ded.rows||[]).length;
  return T;}
// devices standing in the room (any layer — the list works without a stack): counts by code, kapcsolási kör = the
// distinct lamp groups (d.grp, set by the Kapcsolások tool E1), switches by their type
function reqHave(rm){const e=typeof needRoomEntry==='function'?needRoomEntry(rm):null,H={SOC:0,LMP:0,KK:0,SWI:0,SHU:0,DED:0,sw:{}};if(!e)return H;
  const grp=new Set();
  data.devices.forEach(d=>{if(!d||d.level!==e.level)return;const r=roomOfDevice(d);if(!r||r.rm!==rm)return;
    const c=epCodeOf(d);if(c==='SWI'||d.type==='switch'){H.SWI++;const t=d.swType||'101';H.sw[t]=(H.sw[t]||0)+1;return;}
    if(c&&c!=='sw'&&c in H){H[c]++;if(c==='LMP'&&d.grp!=null)grp.add(d.grp);}});
  H.KK=grp.size;return H;}
// rows of the comparison; soft rows (kör, types) are shown but never hold the room back (N6 A: soft)
const REQ_ROWS=[{k:'SOC',n:'Dugalj'},{k:'LMP',n:'Lámpa'},{k:'KK',n:'Kapcsolási kör',soft:true},{k:'SWI',n:'Kapcsoló'},{k:'SHU',n:'Redőny'},{k:'DED',n:'Dedikált'}];
function reqStatus(rm){if(!reqOf(rm))return {st:'off',rows:[]};const T=reqTotals(rm),H=reqHave(rm);
  const rows=REQ_ROWS.filter(r=>T[r.k]>0).map(r=>({k:r.k,n:r.n,need:T[r.k],have:H[r.k],soft:!!r.soft,ok:H[r.k]>=T[r.k]}));
  Object.keys(T.sw).forEach(t=>rows.push({k:'sw'+t,n:'· '+t,need:T.sw[t],have:H.sw[t]||0,soft:true,ok:(H.sw[t]||0)>=T.sw[t]}));
  const hard=rows.filter(r=>!r.soft);
  return {st:!hard.length?'empty':hard.every(r=>r.ok)?'done':'open',rows};}
// N1 A: the 05t tick list of an Erősáram role, read from the counts (a role saved in rm.needs still wins in 05t)
const REQ_CODE_ROLE={SOC:'sys:SOC',LMP:'sys:LIGHT',SWI:'sys:LIGHT',SHU:'sys:LIGHT',DED:'sys:DED'};
function reqNeedOf(rm,role){if(!reqOf(rm))return null;const T=reqTotals(rm);let any=false;const o={};
  Object.keys(REQ_CODE_ROLE).forEach(c=>{if(REQ_CODE_ROLE[c]===role){any=true;if(T[c]>0)o[c]=true;}});
  return any?o:null;}

// ---- N3: the dialog ------------------------------------------------------------------------------------------------------
const REQ_ST={off:{n:'nincs lista',c:'#9aa0a6'},empty:{n:'üres',c:'#9aa0a6'},open:{n:'hiányos',c:'#d08a1e'},done:{n:'kész',c:'#2e9e5b'}};
function reqRoomName(rm){return (rm.num?rm.num+' ':'')+(rm.name||rm.id||'Helyiség');}
function reqSugText(key,v){if(v==null)return '';const I=reqItem(key);if(!I)return '';
  if(I.kind==='n')return v.n+(v.dbl?' ('+v.dbl+' dupla)':'');
  if(I.kind==='lamp')return v.n+' lámpa / '+v.k+' kör / '+v.v+' vil. kör';
  return (v.rows||[]).map(r=>key==='swi'?r.type:(r.n+(r.A?' '+(r.ph===3?'3×':'')+r.A+' A':'')+(r.h?' '+r.h:''))).join(', ')||'—';}
function reqSwLabel(t){if(t==='redony')return 'redőny';const s=typeof switchType==='function'?switchType(t):null;return s&&s.k===t?s.l:t;}
function reqInput(key,f,val,i,w){const di=i==null?'':` data-i="${i}"`;
  if(key==='swi'&&f==='type')return `<select class="rqF" data-k="${key}" data-f="${f}"${di}>`
    +REQ_SW_TYPES.map(t=>`<option value="${t}" ${String(val)===t?'selected':''}>${esc(reqSwLabel(t))}</option>`).join('')+`</select>`;
  const num=!(f==='n'&&reqItem(key).kind==='rows');
  return `<input class="rqF" data-k="${key}" data-f="${f}"${di} ${num?'type="number" min="0" step="1"':''} value="${esc(val==null?'':String(val))}" style="width:${w||(num?52:110)}px">`;}
function reqSugOf(sug,k){return sug.items[k]!=null?sug.items[k]:(sug.opt&&sug.opt[k]!=null?{n:sug.opt[k]}:null);}
function reqRowHtml(rm,I,sug){const it=reqItems(rm),v=it[I.k],on=!!v,sv=reqSugOf(sug,I.k);
  let body='';
  if(on&&I.kind==='n')body=Object.keys(I.f).map(f=>`${reqInput(I.k,f,v[f]||0)} ${esc(I.f[f])}`).join(' &nbsp; ');
  if(on&&I.kind==='lamp'){body=`${reqInput(I.k,'n',v.n)} lámpa · ${reqInput(I.k,'k',v.k)} <b>kapcsolási kör</b> · ${reqInput(I.k,'v',v.v)} világítási kör`;
    if(v.k>1&&v.v>1){const pr=v.pair||[];body+=`<details style="margin-top:3px"><summary style="font-size:11px;color:#666">Párosítás (nem kötelező)</summary>`
      +Array.from({length:v.k},(_,i)=>{const p=pr.find(x=>x.kk===i+1);return `<span style="font-size:11px;margin-right:8px">${i+1}. kapcsolási kör → <select class="rqP" data-kk="${i+1}"><option value="">—</option>`
        +Array.from({length:v.v},(_,j)=>`<option value="${j+1}" ${p&&p.vk===j+1?'selected':''}>${j+1}. vil. kör</option>`).join('')+`</select></span>`;}).join('')+`</details>`;}}
  if(on&&I.kind==='rows')body=(v.rows||[]).map((r,i)=>`<div>`+Object.keys(I.f).map(f=>reqInput(I.k,f,r[f],i,f==='n'?110:48)+(f==='type'?'':' <span style="font-size:11px;color:#888">'+esc(I.f[f])+'</span>')).join(' ')
      +` <a href="#" class="rqDel" data-k="${I.k}" data-i="${i}" title="sor törlése">✕</a></div>`).join('')+`<a href="#" class="rqAdd" data-k="${I.k}" style="font-size:11px">+ sor</a>`;
  return `<div style="margin:5px 0;padding:4px 0;border-top:1px solid #eee"><label><input type="checkbox" class="rqOn" data-k="${I.k}" ${on?'checked':''}> <b>${esc(I.n)}</b></label>`
    +(sv?` <span style="font-size:11px;color:#888">javaslat: ${esc(reqSugText(I.k,sv))}</span>`:'')
    +(body?`<div style="margin:3px 0 0 20px">${body}</div>`:'')+`</div>`;}
// the item a ticked checkbox starts from: the suggestion, else a one-unit default
function reqStart(sug,k){const I=reqItem(k),sv=reqSugOf(sug,k);if(sv)return sv;
  return I.kind==='rows'?{rows:[k==='swi'?{type:'101'}:{n:''}]}:I.kind==='lamp'?{n:1,k:1,v:1}:{n:1};}
function reqDialog(rm){if(!rm)return;const sug=reqSuggest(rm),S=reqStatus(rm),kn=(typeof NEED_KINDS!=='undefined'&&(NEED_KINDS.find(k=>k.k===sug.kind)||{}).n)||sug.kind;
  const tbl=S.rows.length?`<table style="font-size:11.5px;border-collapse:collapse;margin-top:4px"><tr><th align="left">tétel</th><th>kell</th><th>van</th></tr>`
    +S.rows.map(r=>`<tr style="color:${r.ok?'#2e9e5b':r.soft?'#888':'#d08a1e'}"><td>${esc(r.n)}</td><td align="center">${r.need}</td><td align="center">${r.have}${r.ok?' ✓':''}</td></tr>`).join('')+`</table>`:'';
  const stk=typeof stkActive==='function'&&stkActive();
  openModal('☑ Igénylista — '+esc(reqRoomName(rm)),
    `<div class="mrow" style="font-size:12px">Fajta: <b>${esc(kn)}</b> · <span style="color:${REQ_ST[S.st].c}">● ${REQ_ST[S.st].n}</span></div>`
    +`<div class="mrow"><button id="rqTake">Javaslat átvétele</button> <button id="rqKeep" title="A már beállított tételek maradnak">Javaslat a hiányzókra</button> <button id="rqClr">Lista törlése</button>`
    +(stk?` <a href="#" id="rqOld" style="font-size:11px">rétegenkénti pipák…</a>`:'')+`</div>`
    +`<div id="rqBody" style="max-height:380px;overflow:auto">`+REQ_ITEMS.map(I=>reqRowHtml(rm,I,sug)).join('')+tbl+`</div>`
    +`<div class="mrow" style="font-size:11px;color:#888">A lista nem hoz létre készüléket — a rétegeken elhelyezett készülékek teljesítik. A kapcsolási kör és a típusok tájékoztató sorok.</div>`,
    ()=>{},'Bezár');
  const again=()=>{const b=$('rqBody'),y=b?b.scrollTop:0;closeModal();reqDialog(rm);const b2=$('rqBody');if(b2)b2.scrollTop=y;if(typeof draw==='function')draw();};
  const cur=k=>JSON.parse(JSON.stringify(reqItems(rm)[k]||{}));
  document.querySelectorAll('.rqOn').forEach(c=>c.onchange=()=>{const k=c.dataset.k;reqSet(rm,k,c.checked?reqStart(sug,k):null);again();});
  document.querySelectorAll('.rqF').forEach(inp=>inp.onchange=()=>{const k=inp.dataset.k,f=inp.dataset.f,i=inp.dataset.i,o=cur(k);
    const val=inp.type==='number'?(+inp.value||0):inp.value;
    if(i!=null&&i!==''){o.rows=o.rows||[];o.rows[+i]=Object.assign({},o.rows[+i],{[f]:val});}else o[f]=val;
    reqSet(rm,k,o);again();});
  document.querySelectorAll('.rqP').forEach(sel=>sel.onchange=()=>{const o=cur('lmp'),kk=+sel.dataset.kk;o.pair=(o.pair||[]).filter(p=>p.kk!==kk);
    if(sel.value)o.pair.push({kk,vk:+sel.value});o.pair.sort((a,b)=>a.kk-b.kk);reqSet(rm,'lmp',o);again();});
  document.querySelectorAll('.rqAdd').forEach(a=>a.onclick=ev=>{ev.preventDefault();const k=a.dataset.k,o=cur(k);o.rows=(o.rows||[]).concat([k==='swi'?{type:'101'}:{n:''}]);reqSet(rm,k,o);again();});
  document.querySelectorAll('.rqDel').forEach(a=>a.onclick=ev=>{ev.preventDefault();const k=a.dataset.k,o=cur(k);o.rows.splice(+a.dataset.i,1);reqSet(rm,k,o.rows.length?o:null);again();});
  $('rqTake').onclick=()=>{reqTake(rm);again();};
  $('rqKeep').onclick=()=>{reqTake(rm,true);again();};
  $('rqClr').onclick=()=>{reqClear(rm);again();};
  if($('rqOld'))$('rqOld').onclick=ev=>{ev.preventDefault();closeModal();needDialog(rm);};}
// the house: the sum of the rooms (N3 B) + every room with its status
function reqHouseTotals(){const T={SOC:0,LMP:0,KK:0,VK:0,SWI:0,SHU:0,DED:0,sw:{}};
  reqRooms().forEach(({rm})=>{const t=reqTotals(rm);Object.keys(T).forEach(k=>{if(k==='sw')Object.keys(t.sw).forEach(s=>{T.sw[s]=(T.sw[s]||0)+t.sw[s];});else T[k]+=t[k];});});
  return T;}
function reqHouseDialog(){const T=reqHouseTotals(),rooms=[];ORD.forEach(l=>allRooms(l).forEach(e=>{if(e.rm.poly&&e.rm.poly.length>=3)rooms.push(e);}));
  const line=(n,v)=>`<tr><td>${esc(n)}</td><td align="right"><b>${v}</b></td></tr>`;
  openModal('☑ Ház összesítő — a helyiségek igénylistáinak összege',
    `<table style="font-size:12px;border-collapse:collapse;min-width:260px">`
    +line('Dugalj (készülék és olvasó dugaljjal)',T.SOC)+line('Lámpa',T.LMP)+line('Kapcsolási kör',T.KK)+line('Világítási kör (helyiségenként összeadva)',T.VK)
    +line('Kapcsoló',T.SWI)+Object.keys(T.sw).sort().map(t=>line(' · '+reqSwLabel(t),T.sw[t])).join('')+line('Redőny',T.SHU)+line('Dedikált fogyasztó',T.DED)+`</table>`
    +`<div style="max-height:260px;overflow:auto;margin-top:8px"><table style="font-size:11.5px">`
    +rooms.map((e,i)=>{const st=reqStatus(e.rm).st;return `<tr class="rqRoom" data-i="${i}" style="cursor:pointer"><td>${esc(reqRoomName(e.rm))}</td><td style="color:${REQ_ST[st].c}">● ${REQ_ST[st].n}</td></tr>`;}).join('')
    +`</table></div><div class="mrow" style="font-size:11px;color:#888">Kattints egy helyiségre a listájáért.${reqRooms().length?'':' Még egy helyiségnek sincs listája.'}</div>`,()=>{},'Bezár');
  document.querySelectorAll('.rqRoom').forEach(tr=>tr.onclick=()=>{const e=rooms[+tr.dataset.i];closeModal();reqDialog(e.rm);});}
function reqRoomMenu(rh,items){items.push({label:'☑ Igénylista… (darabszámok)',act:()=>reqDialog(rh.rm)});}
registerActions([{id:'req.house',label:'Ház összesítő (igénylista)',icon:'☑',group:'Helyiség',alias:'haz osszesito igenylista house summary requests',
  hint:'A helyiségek igénylistáinak összege és állapota.',when:()=>true,run:()=>reqHouseDialog()}]);

// ---- N4 hand-off: the switch suggestion (08l, E1) and the circuit suggestion (08oa, E4) read the counts ----------------------
// Soft, as everything here (N6 A): the list only shapes a suggestion the user still ticks; lamps already in a kapcsolási
// kör (d.grp) keep it, only the ungrouped ones are split. A kör index (kk) = the order of the groups along the room's
// longer axis — the same order E1 makes them in, so a pairing typed in the dialog lands where it reads.
function reqLampSpec(rm){const it=reqItems(rm);return it&&it.lmp&&(+it.lmp.k||0)>=1?it.lmp:null;}
function reqAxisSort(rm,list){const b=rm&&rm.poly?polyBBox(rm.poly):null,ax=b&&(b.y1-b.y0)>(b.x1-b.x0)?'y':'x';
  return list.slice().sort((a,c)=>(a[ax]-c[ax])||(a.id<c.id?-1:a.id>c.id?1:0));}
// E1: lamps → k groups. → {k, groups:[[lamp]], types (the list's switch rows), auto (the types the doors give), note}
function reqLswPlan(rm,lamps,nSlots){const S=reqLampSpec(rm);if(!S||!lamps||!lamps.length)return null;const k=+S.k;
  const byG=new Map(),free=[];lamps.forEach(l=>{if(l.grp){if(!byG.has(l.grp))byG.set(l.grp,[]);byG.get(l.grp).push(l);}else free.push(l);});
  const groups=[...byG.values()];
  if(free.length){const n=Math.max(1,Math.min(free.length,k-groups.length)),s=reqAxisSort(rm,free);
    for(let i=0;i<n;i++)groups.push(s.slice(Math.floor(i*s.length/n),Math.floor((i+1)*s.length/n)));}
  const it=reqItems(rm),types=it.swi&&Array.isArray(it.swi.rows)?it.swi.rows.map(r=>r.type).filter(Boolean):[];
  const auto=nSlots?reqSwAuto(groups.length,nSlots):[];
  let note='Igénylista: '+k+' kapcsolási kör';
  if(groups.length!==k)note+=' — '+groups.length+' lett ('+(groups.length<k?'kevés lámpa':'meglévő ágak')+')';
  if(types.length)note+=' · a listán: '+types.join(' + ');
  if(types.length>nSlots)note+=' · '+(types.length-nSlots)+' kapcsoló nem ajtónál (pl. ágy mellett) — kézzel';
  return {k,groups,types,auto,note};}
// E4: lamp id → világítási kör (vk) when the room asks for 2 or more; kk → vk by the pairing, else kk i → min(i, v)
function reqLightVk(rm,lamps){const S=reqLampSpec(rm),v=S?Math.max(1,+S.v||1):1;if(v<2||!lamps||!lamps.length)return null;
  const byG=new Map();reqAxisSort(rm,lamps).forEach(l=>{const g=l.grp||('L:'+l.id);if(!byG.has(g))byG.set(g,[]);byG.get(g).push(l);});
  const pair=Array.isArray(S.pair)?S.pair:[],vk=new Map();let i=0;
  byG.forEach(ls=>{i++;const p=pair.find(x=>+x.kk===i);const n=p?+p.vk:Math.min(i,v);ls.forEach(l=>vk.set(l.id,n));});
  return {v,vk,paired:pair.length>0};}
window.reqLswPlan=reqLswPlan;window.reqLightVk=reqLightVk;
