// ==========================================================================
// 08o-cpr.js — round 2026-10-10, WP-M2: circuit presets (Elosztó list, box menu, rooms, export / import)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// Extends the 05j circuits (data.circuits), not the legacy route-section circuits of the sidebar panel.
// Right-click the Elosztó → Áramkör-lista: the usual circuits of a home in three tiers (Alap · Kiegészítő · Speciális),
// each with ☐ aktív, B/C + amps + poles, scope (Ház / rooms) and its status. Ticking creates a 05j circuit with
// c.preset (catalogue key), c.presetRow (the project row — CLANV4 has three klíma rows of one key) and c.rooms
// ([roomId] | ['*']). "Waiting for its endpoint" is derived (no members). Unticking a circuit WITH members asks and only
// deactivates it (c.off, members released) — wiring decisions are never silently deleted.
// The project list lives in data.eloPresets (prefix E, registered in 11c-wf-keys.js); absent = the built-in CPR_CAT,
// and the first edit copies the catalogue in. Tier-1 keys not active show ⚠ alapkör (expect [min,max]; klíma 1–2).
// Right-click a szerelvénydoboz / an endpoint without a circuit → Áramkör ehhez…: the room's active circuits first,
// then fitting presets; choosing assigns it and starts the K pick mode. Esc before any further click = the box is
// released again and the circuit stays waiting (answer M07: A with Esc → B). Export / import: vrg-elo-presets v1;
// import merges by key AND name (same key, other name = a second circuit of that type). Placed after 05m (STK_DEVMENU)
// and before 11 (UKEYS) on purpose — see 11c-wf-keys.js. Spec: tests/spec-94-circuit-presets.js.
const CPR_CAT=[
 // tier 1 — alap: minden otthonban
 {key:'vil',    tier:1,kind:'light', n:'Világítás (lakás-füzér)',            mcb:'1C 10A',  mm2:1.5, cab:'NYM3x15', scope:'house', codes:['LMP','SWI']},
 {key:'dugsz',  tier:1,kind:'socket',n:'Dugaljkör — szoba (1,5 mm², S04)',   mcb:'1C 13A',  mm2:1.5, cab:'NYM3x15', scope:'room', kinds:['halo','nappali','dolgozo','etkezo'], codes:['SOC']},
 {key:'dug25',  tier:1,kind:'socket',n:'Dugaljkör — 2,5 mm²',                mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['nappali','dolgozo'], codes:['SOC']},
 {key:'konyhaA',tier:1,kind:'socket',n:'Konyhai munkalap A',                 mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['konyha'], codes:['SOC']},
 {key:'konyhaB',tier:1,kind:'socket',n:'Konyhai munkalap B',                 mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['konyha'], codes:['SOC']},
 {key:'furdo',  tier:1,kind:'socket',n:'Fürdőszobai dugalj',                 mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['furdo'], codes:['SOC']},
 {key:'mosog',  tier:1,kind:'ded',   n:'Mosógép',                            mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['furdo','gepeszet','kamra'], codes:['DED:g16']},
 {key:'mosogat',tier:1,kind:'ded',   n:'Mosogatógép',                        mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha'], codes:['DED:g16']},
 {key:'suto',   tier:1,kind:'ded',   n:'Sütő',                               mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha'], codes:['DED:g16']},
 {key:'fozo',   tier:1,kind:'ded',   n:'Főzőlap, 1 fázis 32 A',              mcb:'1C 32A',  mm2:6,   cab:'NYM3x6',  scope:'unit', kinds:['konyha'], codes:['DED:hob32']},
 {key:'rsys',   tier:1,kind:'sys',   n:'BRIDGE rendszerkör (BASE, SSC, puffer)',mcb:'1C 10A', mm2:1.5, cab:'NYM3x15', scope:'house', codes:[]},
 {key:'klima',  tier:1,kind:'ded',   n:'Klíma (beltéri egységenként)',       mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['halo','nappali','dolgozo'], codes:['DED:g16'], expect:[1,2]},
 // tier 2 — kiegészítő: gyakori
 {key:'fozo2l', tier:2,kind:'ded',   n:'Főzőlap 2L+2N',                      mcb:'1P-N C16A',mm2:2.5,cab:'NYM5x25', scope:'unit', kinds:['konyha'], codes:['DED:hob2l']},
 {key:'huto',   tier:2,kind:'ded',   n:'Hűtő / fagyasztó (saját kör)',       mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha','kamra'], codes:['DED:g16']},
 {key:'mikro',  tier:2,kind:'ded',   n:'Mikrohullámú sütő',                  mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha'], codes:['DED:g16']},
 {key:'szarit', tier:2,kind:'ded',   n:'Szárítógép',                         mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['furdo','gepeszet','mosokonyha'], codes:['DED:g16']},
 {key:'bojler', tier:2,kind:'ded',   n:'Villanybojler',                      mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['furdo','gepeszet','kamra'], codes:['DED:g16']},
 {key:'szobakor',tier:2,kind:'socket',n:'Szobakör — dugaljak + világítás (felújítás, CLANV4-minta)',mcb:'1C 16A',mm2:2.5,cab:'NYM3x25', scope:'room', kinds:['nappali','halo','dolgozo'], codes:['SOC','LMP','SWI']},
 {key:'av',     tier:2,kind:'ded',   n:'AV pozíció (médiafal)',              mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['nappali'], codes:['AVP']},
 {key:'kulter', tier:2,kind:'socket',n:'Kültéri dugalj (IP44)',              mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['kulter'], codes:['SOC']},
 {key:'garazs', tier:2,kind:'socket',n:'Garázs / műhely dugalj',             mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['gepeszet'], codes:['SOC']},
 {key:'csengo', tier:2,kind:'sys',   n:'Csengő / kaputelefon táp',           mcb:'1B 6A',   mm2:1.5, cab:'NYM3x15', scope:'house', codes:[]},
 {key:'kapu',   tier:2,kind:'ded',   n:'Kapunyitó / garázskapu motor',       mcb:'1C 10A',  mm2:1.5, cab:'NYM3x15', scope:'unit', codes:['DED:g16']},
 // tier 3 — speciális
 {key:'ev',     tier:3,kind:'ded',   n:'Elektromosautó-töltő, 3 fázis 11 kW',mcb:'3C 16A',  mm2:4,   cab:'NYM5x6',  scope:'unit', codes:['DED'], note:'RCD A-EV / B típus ⚑'},
 {key:'hosziv', tier:3,kind:'ded',   n:'Hőszivattyú kültéri egység',         mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', codes:['DED'], note:'gyártói adat szerint ⚑'},
 {key:'pfutes', tier:3,kind:'ded',   n:'Elektromos padlófűtés (helyiségenként)',mcb:'1C 16A',mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['furdo'], codes:['DED:g16']},
 {key:'szauna', tier:3,kind:'ded',   n:'Szaunakályha',                       mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', codes:['DED']},
 {key:'tuzhely3',tier:3,kind:'ded',  n:'Tűzhely, 3 fázis',                   mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', kinds:['konyha'], codes:['DED:hob2l']},
 {key:'cee',    tier:3,kind:'socket',n:'Ipari (CEE) dugalj 3 fázis',         mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', codes:['SOC']},
 {key:'medence',tier:3,kind:'ded',   n:'Medence- / kerti szivattyú',         mcb:'1C 10A',  mm2:1.5, cab:'NYM3x15', scope:'unit', codes:['DED:g16'], note:'C görbe a motor miatt'},
 {key:'napelem',tier:3,kind:'ded',   n:'Napelemes inverter',                 mcb:'3C 16A',  mm2:4,   cab:'NYM5x6',  scope:'unit', codes:['DED'], note:'inverter adatlap szerint ⚑'},
 {key:'alelo',  tier:3,kind:'ded',   n:'Alelosztó betáp, 3 fázis',           mcb:'3C 25A',  mm2:6,   cab:'NYM5x6',  scope:'unit', codes:['DED:alelo']}];
// the bundled CLANV4 sample (docs/round-2026-10-10/samples/CLANV4-minta.vrg-elo-presets.json) — no client data in it
const CPR_SAMPLE_CLANV4={format:'vrg-elo-presets',v:1,project:'CLANV4 minta — panellakás, nappali + 2 szoba, teljes felújítás',items:[
 {key:'vil',n:'Világítás (előszoba, konyha, fürdő, WC) + előszobai dugalj',kind:'light',tier:1,mcb:'1B 10A',mm2:1.5,cab:'NYM3x15',scope:'house',codes:['LMP','SWI','SOC']},
 {key:'szobakor',n:'Nappali — dugaljak, világítás',kind:'socket',tier:2,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'room',kinds:['nappali'],codes:['SOC','LMP','SWI']},
 {key:'szobakor',n:'Szoba (02) — dugaljak, világítás',kind:'socket',tier:2,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'room',kinds:['halo'],codes:['SOC','LMP','SWI']},
 {key:'szobakor',n:'Szoba (03) — dugaljak, világítás',kind:'socket',tier:2,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'room',kinds:['halo'],codes:['SOC','LMP','SWI']},
 {key:'konyhaA',n:'Konyha — pult feletti dugaljak',kind:'socket',tier:1,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'room',kinds:['konyha'],codes:['SOC']},
 {key:'suto',n:'Sütő / főzőlap (1×16 A, ≤ 3,6 kW)',kind:'ded',tier:1,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'unit',kinds:['konyha'],codes:['DED:g16']},
 {key:'huto',n:'Hűtő',kind:'ded',tier:2,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'unit',kinds:['konyha'],codes:['DED:g16']},
 {key:'mikro',n:'Mikrohullámú sütő',kind:'ded',tier:2,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'unit',kinds:['konyha'],codes:['DED:g16']},
 {key:'furdo',n:'Fürdőszoba — dugaljak',kind:'socket',tier:1,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'room',kinds:['furdo'],codes:['SOC']},
 {key:'klima',n:'Klíma — Nappali',kind:'ded',tier:1,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'unit',kinds:['nappali'],codes:['DED:g16']},
 {key:'klima',n:'Klíma — Szoba (02)',kind:'ded',tier:1,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'unit',kinds:['halo'],codes:['DED:g16']},
 {key:'klima',n:'Klíma — Szoba (03)',kind:'ded',tier:1,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'unit',kinds:['halo'],codes:['DED:g16']},
 {key:'mosog',n:'Mosógép',kind:'ded',tier:1,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'unit',kinds:['furdo'],codes:['DED:g16']}]};
const CPR_TIER={1:'Alap',2:'Kiegészítő',3:'Speciális'};
const CPR_AMPS=[6,10,13,16,20,25,32];

// ---- the list ----------------------------------------------------------------------------------------------------------------
function cprRows(){return Array.isArray(data.eloPresets)&&data.eloPresets.length?data.eloPresets:CPR_CAT;}
function cprList(){return cprRows();}
function cprOwn(){return Array.isArray(data.eloPresets)&&data.eloPresets.length>0;}
// the first edit copies the catalogue into the project (with ids); the caller pushed undo
function cprEnsure(){if(cprOwn())return data.eloPresets;data.eloPresets=CPR_CAT.map(r=>JSON.parse(JSON.stringify(r)));ensureIds(data);return data.eloPresets;}
function cprExpect(r){return r.expect||(r.tier===1?[1,1]:[0,99]);}
function cprCircuitOf(row){return cktList().find(c=>c.presetRow&&c.presetRow===row.id)||null;}
function cprActive(row){const c=cprCircuitOf(row);return !!c&&!c.off;}
function cprActiveCount(key){return cktList().filter(c=>c.preset===key&&!c.off).length;}
// the rooms a row pre-selects: of its kinds (needKind / kinds[]), every level
function cprRoomsFor(row){if(row.scope==='house')return ['*'];if(!row.kinds||!row.kinds.length)return [];const out=[];
  ORD.forEach(l=>allRooms(l).forEach(e=>{const rm=e.rm;if(!rm.id)return;const ks=Array.isArray(rm.kinds)&&rm.kinds.length?rm.kinds:[needKind(rm)];
    if(ks.some(k=>row.kinds.indexOf(k)>=0))out.push(rm.id);}));return out;}
function cprMcb(row){const m=mcbParse(row.mcb);return m.err||m.empty?null:{curve:m.curve,amps:m.amps,poles:m.poles,n:m.n};}
// tick: create (or wake) the 05j circuit of a row
function cprActivate(rowId){pushUndo(['circuits','eloPresets']);const L=cprEnsure(),row=L.find(r=>r.id===rowId)||L.find(r=>r.key===rowId);if(!row)return null;
  let c=cprCircuitOf(row);if(c){c.off=false;cktRedraw();return c;}
  c=cktCreate({name:row.n,mcb:cprMcb(row),dedicated:row.kind==='ded'});c.preset=row.key;c.presetRow=row.id;c.rooms=cprRoomsFor(row);cktRedraw();return c;}
// untick: no members → the circuit goes; members → ask, then only deactivate and release them
function cprDeactivate(rowId){const row=cprRows().find(r=>r.id===rowId);const c=row&&cprCircuitOf(row);if(!c)return false;
  const n=(c.members||[]).length;
  if(n&&!confirm('„'+c.name+'” — '+n+' végpontja van. Kikapcsolod? A kör megmarad (kikapcsolva), a végpontok felszabadulnak.'))return false;
  pushUndo(['circuits']);if(n){c.off=true;c.members=[];}else data.circuits=cktList().filter(x=>x!==c);cktRedraw();return true;}
// edit a row (the first edit copies the catalogue in); an active circuit follows its breaker
function cprEdit(rowId,patch){pushUndo(['circuits','eloPresets']);const L=cprEnsure(),row=L.find(r=>r.id===rowId)||L.find(r=>r.key===rowId);if(!row)return null;
  Object.assign(row,patch);const c=cprCircuitOf(row);if(c){if(patch.mcb)c.mcb=cprMcb(row);if(patch.n)c.name=row.n;if(patch.rooms)c.rooms=patch.rooms;}cktRedraw();return row;}
function cprSetCurve(rowId,curve){const r=cprRows().find(x=>x.id===rowId)||cprEnsure().find(x=>x.key===rowId);const m=mcbParse(r&&r.mcb);if(!r||m.err)return null;
  m.curve=curve;return cprEdit(r.id||rowId,{mcb:mcbText(m)});}
function cprSetAmps(rowId,a){const r=cprRows().find(x=>x.id===rowId)||cprEnsure().find(x=>x.key===rowId);const m=mcbParse(r&&r.mcb);if(!r||m.err)return null;m.amps=+a;return cprEdit(r.id||rowId,{mcb:mcbText(m)});}
function cprSetPoles(rowId,p){const r=cprRows().find(x=>x.id===rowId)||cprEnsure().find(x=>x.key===rowId);const m=mcbParse(r&&r.mcb);if(!r||m.err)return null;
  if(p==='1P-N'){m.poles=1;m.n=true;}else{m.poles=+p;m.n=false;}return cprEdit(r.id||rowId,{mcb:mcbText(m)});}
function cprAddCustom(){pushUndo(['eloPresets']);const L=cprEnsure();let n=1;while(L.some(r=>r.key==='sajat'+n))n++;
  L.push({key:'sajat'+n,tier:3,kind:'socket',n:'Saját kör '+n,mcb:'1C 16A',mm2:2.5,cab:'NYM3x25',scope:'room',kinds:[],codes:['SOC'],custom:true});ensureIds(data);return L[L.length-1];}
function cprDismiss(rowId){pushUndo(['eloPresets']);const L=cprEnsure(),row=L.find(r=>r.id===rowId)||L.find(r=>r.key===rowId);if(row)row.dismissed=true;return row;}
// tier-1 keys short of their expected count (one warning per key, never for a dismissed key)
function cprReminders(){const out=[],seen=new Set();cprRows().forEach(r=>{if(seen.has(r.key)||r.tier!==1)return;seen.add(r.key);
  if(cprRows().some(x=>x.key===r.key&&x.dismissed))return;const n=cprActiveCount(r.key),[lo]=cprExpect(r);
  if(n<lo)out.push({key:r.key,row:r,msg:'⚠ alapkör — nincs aktiválva: '+r.n});});return out;}

// ---- export / import / sample ------------------------------------------------------------------------------------------------
function cprExportObj(){return {format:'vrg-elo-presets',v:1,project:(typeof B!=='undefined'&&B&&B.name)||'',date:new Date().toISOString().slice(0,10),
  items:cprRows().map(r=>{const o=JSON.parse(JSON.stringify(r));delete o.id;delete o.dismissed;return o;})};}
function cprExport(){const o=cprExportObj();download(((o.project||'terv').replace(/[^\w\-]+/g,'_'))+'_elosztolista.vrg-elo-presets.json',JSON.stringify(o,null,1));
  $('hud').textContent='Elosztó-lista exportálva: '+o.items.length+' kör.';}
// merge: a row whose key AND name match an existing one is a conflict → onConflict(row, item) 'keep' | 'replace';
// anything else is added (same key + another name = a second circuit of that type)
function cprImport(obj,onConflict){if(!obj||obj.format!=='vrg-elo-presets'||!Array.isArray(obj.items))return {err:'Nem Elosztó-lista (vrg-elo-presets).'};
  pushUndo(['eloPresets']);if(!Array.isArray(data.eloPresets))data.eloPresets=[];const L=data.eloPresets;let added=0,replaced=0,kept=0;
  obj.items.forEach(it=>{const ex=L.find(r=>r.key===it.key&&r.n===it.n);
    if(ex){const how=onConflict?onConflict(ex,it):(confirm('Ütközés: „'+it.n+'” — felülírjam? (OK = csere, Mégse = megtartás)')?'replace':'keep');
      if(how==='replace'){const id=ex.id;Object.keys(ex).forEach(k=>delete ex[k]);Object.assign(ex,JSON.parse(JSON.stringify(it)),{id});replaced++;}else kept++;}
    else{L.push(JSON.parse(JSON.stringify(it)));added++;}});
  ensureIds(data);return {added,replaced,kept};}
function cprImportFile(){const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
  inp.onchange=()=>{const f=inp.files&&inp.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{let o;try{o=JSON.parse(rd.result);}catch(_){$('hud').textContent='Hibás JSON.';return;}
    const r=cprImport(o);$('hud').textContent=r.err||('Importálva: +'+r.added+' kör'+(r.replaced?' · '+r.replaced+' csere':'')+(r.kept?' · '+r.kept+' megtartva':''));cprDialogRefresh();};rd.readAsText(f);};inp.click();}
function cprLoadSample(onConflict){return cprImport(CPR_SAMPLE_CLANV4,onConflict||(()=>'keep'));}

// ---- the Elosztó dialog ------------------------------------------------------------------------------------------------------
let CPR_UI={open:{1:true,2:false,3:false},board:null};
function cprRowHtml(r){const c=cprCircuitOf(r),on=!!c&&!c.off,m=mcbParse(r.mcb)||{},st=c&&!c.off?cktStatus(c):null,id=r.id||r.key;
  const rooms=c&&c.rooms?(c.rooms[0]==='*'?'Ház':c.rooms.length+' helyiség'):(r.scope==='house'?'Ház':r.scope==='unit'?'készülékenként':'helyiségek');
  // three columns so it fits the modal: tick · name with a grey detail line · breaker
  const det=[(r.mm2||'')+' mm²',rooms,on?(c.members||[]).length+' végpont':'',c&&c.off?'kikapcsolva':'',st?st.t:''].filter(Boolean).join(' · ');
  return `<tr class="cprR" data-r="${esc(id)}" style="border-top:1px solid #eee"><td style="vertical-align:top;padding-top:3px"><input type="checkbox" class="cprOn" ${on?'checked':''}></td>`
   +`<td style="padding:2px 4px">${esc(r.n)}${r.note?` <span style="color:#999" title="${esc(r.note)}">ⓘ</span>`:''}<div style="font-size:10.5px;color:${st&&st.k==='empty'?'#d08a1e':'#888'}">${esc(det)}</div></td>`
   +`<td style="white-space:nowrap;vertical-align:top"><button class="cprCv" title="B / C görbe">${m.curve||'C'}</button><select class="cprA">${CPR_AMPS.map(a=>`<option${a===m.amps?' selected':''}>${a}</option>`).join('')}</select>`
   +`<select class="cprP">${['1','1P-N','3'].map(p=>`<option${(p==='1P-N'?m.n:(+p===m.poles&&!m.n))?' selected':''}>${p}</option>`).join('')}</select></td></tr>`;}
function cprDialogBody(){const rem=cprReminders();let s=`<div style="font-size:11.5px;color:#777;margin-bottom:4px">Az aktív sorokból 05j áramkör lesz; a „nincs végpont” állapot = végpontra vár. B/C, amper, pólus soronként.</div>`;
  if(rem.length)s+=`<div style="font-size:12px;color:#c0392b;margin-bottom:4px">${rem.map(x=>`${esc(x.msg)} <button class="cprX" data-x="${esc(x.row.id||x.row.key)}" title="Nem kell">×</button>`).join('<br>')}</div>`;
  [1,2,3].forEach(t=>{const R=cprRows().filter(r=>r.tier===t);if(!R.length)return;
    s+=`<div class="cprT" data-t="${t}" style="font-weight:700;margin:6px 0 2px;cursor:pointer">${CPR_UI.open[t]?'▾':'▸'} ${CPR_TIER[t]} (${R.length})</div>`;
    if(CPR_UI.open[t])s+=`<table style="font-size:12px;width:100%;border-collapse:collapse">${R.map(cprRowHtml).join('')}</table>`;});
  return s+`<div class="mrow" style="gap:6px;margin-top:6px"><button id="cprAdd">＋ Saját kör</button><button id="cprExp">⬇ Export</button><button id="cprImp">📥 Import</button><button id="cprCLANV4">Minta betöltése (CLANV4)</button></div>`;}
function cprDialogRefresh(){const host=$('cprBody');if(!host)return;host.innerHTML=cprDialogBody();cprBind(host);}
function cprBind(host){const rid=el=>el.closest('[data-r]').dataset.r;
  host.querySelectorAll('.cprT').forEach(b=>b.onclick=()=>{CPR_UI.open[b.dataset.t]=!CPR_UI.open[b.dataset.t];cprDialogRefresh();});
  host.querySelectorAll('.cprOn').forEach(b=>b.onchange=()=>{const id=rid(b);const row=cprRows().find(r=>(r.id||r.key)===id);
    if(b.checked)cprActivate(id);else if(row)cprDeactivate(row.id);cprDialogRefresh();});
  host.querySelectorAll('.cprCv').forEach(b=>b.onclick=()=>{cprSetCurve(rid(b),b.textContent==='B'?'C':'B');cprDialogRefresh();});
  host.querySelectorAll('.cprA').forEach(b=>b.onchange=()=>{cprSetAmps(rid(b),b.value);cprDialogRefresh();});
  host.querySelectorAll('.cprP').forEach(b=>b.onchange=()=>{cprSetPoles(rid(b),b.value);cprDialogRefresh();});
  host.querySelectorAll('.cprX').forEach(b=>b.onclick=()=>{cprDismiss(b.dataset.x);cprDialogRefresh();});
  const g=id=>host.querySelector('#'+id);
  if(g('cprAdd'))g('cprAdd').onclick=()=>{cprAddCustom();CPR_UI.open[3]=true;cprDialogRefresh();};
  if(g('cprExp'))g('cprExp').onclick=()=>cprExport();
  if(g('cprImp'))g('cprImp').onclick=()=>cprImportFile();
  if(g('cprCLANV4'))g('cprCLANV4').onclick=()=>{const r=cprLoadSample();$('hud').textContent='CLANV4 minta: +'+r.added+' kör';CPR_UI.open[2]=true;cprDialogRefresh();};}
function cprDialog(boardId){CPR_UI.board=boardId||null;openModal('Áramkör-lista (Elosztó)',`<div id="cprBody" style="max-height:60vh;overflow-y:auto;overflow-x:hidden"></div>`,()=>{},'Kész');cprDialogRefresh();}

// ---- the box / endpoint menu: Áramkör ehhez… --------------------------------------------------------------------------------
let CPR_ESC=null;   // {c, d, n} — the circuit just chosen from a box menu, its box and its member count then (Esc → B)
function cprChoices(d){const e=typeof roomOfDevice==='function'?roomOfDevice(d):null,rm=e&&e.rm,rid=rm&&rm.id;
  const kinds=rm?(Array.isArray(rm.kinds)&&rm.kinds.length?rm.kinds:[needKind(rm)]):[];
  const act=cktList().filter(c=>!c.off&&c.preset&&(c.rooms||[]).some(x=>x==='*'||x===rid));
  const free=cprRows().filter(r=>!cprActive(r)&&(!r.kinds||!r.kinds.length||r.kinds.some(k=>kinds.indexOf(k)>=0)));
  return {room:rm,active:act,presets:free};}
function cprChoose(d,pick){let c;if(pick.c)c=pick.c;else c=cprActivate(pick.row.id||pick.row.key);if(!c)return null;
  pushUndo(['circuits']);cktAssign(c,d);cktPickStart(c.id);CPR_ESC={c:c.id,d:d.id,n:(c.members||[]).length};
  $('hud').textContent='⚡ '+cktLabel(c)+' — kattints a kör többi végpontjára · K: kész · Esc rögtön: a doboz nem lesz tagja';return c;}
function cprBoxDialog(d){const ch=cprChoices(d);const opts=[];
  ch.active.forEach(c=>opts.push({t:'⚡ '+cktLabel(c)+' · '+cktStatus(c).t,c}));ch.presets.forEach(r=>opts.push({t:'＋ '+r.n+' ('+r.mcb+')',row:r}));
  if(!opts.length){$('hud').textContent='Nincs ide illő áramkör a listában.';return;}
  openModal('Áramkör ehhez — '+esc(d.ref||d.id),`<div style="font-size:11.5px;color:#777">${ch.room?esc(ch.room.name||ch.room.id)+' · ':''}aktív körök, majd — Új a listából —</div>`
    +opts.map((o,i)=>`${i===ch.active.length&&ch.active.length?'<div style="color:#999;font-size:11px;margin-top:4px">— Új a listából —</div>':''}<div class="mrow"><label><input type="radio" name="cprCh" value="${i}" ${i===0?'checked':''}> ${esc(o.t)}</label></div>`).join(''),
    ()=>{const i=+((document.querySelector('input[name=cprCh]:checked')||{}).value||0);cprChoose(d,opts[i]);},'Hozzárendel');}
// Esc right after choosing (no further endpoint clicked) → the box goes again, the circuit stays waiting
STK_TOOLS.push({k:'cprEsc',active:()=>!!CPR_ESC,
  esc(){const E=CPR_ESC;CPR_ESC=null;if(!E)return;const c=cktById(E.c),d=byId('devices',E.d);
    if(c&&d&&(c.members||[]).length===E.n&&cktOfDevice(d)===c){pushUndo(['circuits']);cktRelease(d);cktRedraw();
      $('hud').textContent='A(z) „'+c.name+'” aktív, végpontra vár — a doboz nem lett hozzárendelve.';}},
  down(){if(!cktPick)CPR_ESC=null;return false;},key(e){if(e.key!=='Escape'&&!cktPick)CPR_ESC=null;return false;}});

// ---- reminders in the rooms (warn) ------------------------------------------------------------------------------------------
function cprRoomWarnings(){const out=[];cktList().forEach(c=>{if(c.off||!c.preset||!c.rooms)return;const mem=cktMembers(c);
  if(c.rooms[0]==='*'){if(!mem.length)out.push({sev:'warn',code:'cpr.wait',msg:'Ház: a „'+c.name+'” kör vár végpontra'});return;}
  c.rooms.forEach(rid=>{const e=ORD.map(l=>allRooms(l).find(x=>x.rm.id===rid)).find(Boolean);if(!e)return;
    if(!mem.some(d=>{const r=roomOfDevice(d);return r&&r.rm.id===rid;}))out.push({sev:'warn',code:'cpr.wait',msg:((e.rm.num||'')+' '+(e.rm.name||rid)).trim()+': a „'+c.name+'” kör vár végpontra'});});});return out;}
['sys:SOC','sys:DED','sys:LIGHT'].forEach(role=>{(STK_CHECKS[role]=STK_CHECKS[role]||[]).push(()=>role==='sys:SOC'?cprRoomWarnings():[]);});

// ---- menus, panel line, registry --------------------------------------------------------------------------------------------
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d)return;
  if(d.type==='board')items.push({label:'⚡ Áramkör-lista…',act:()=>cprDialog(d.id)});
  else if(cktCanJoin(d)&&(d.type==='box'||((typeof epCodeOf==='function'&&epCodeOf(d))&&!cktOfDevice(d))))items.push({label:'⚡ Áramkör ehhez…',act:()=>cprBoxDialog(d)});});
(function(){const L=$('circList');if(!L||$('cprLine'))return;const div=document.createElement('div');div.id='cprLine';div.style.cssText='font-size:11px;color:#777;margin:2px 0 4px';
  div.innerHTML='Elosztó-szintű áramkörök: jobb klikk az Elosztón → Áramkör-lista. <button id="cprOpen" style="font-size:11px">Áramkör-lista…</button>';
  L.parentNode.insertBefore(div,L);const b=$('cprOpen');if(b)b.onclick=()=>{const bd=data.devices.find(x=>x&&x.type==='board');cprDialog(bd&&bd.id);};})();
registerActions([
 {id:'circuit.presets',label:'Áramkör-lista (Elosztó)…',icon:'📑',group:'Áramkör',alias:'circuit presets elosztolista aramkor lista',
  hint:'A szokásos áramkörök: aktív / B-C / amper / helyiségek; emlékeztet a hiányzó alapkörökre.',when:c=>!c.inEditor,run:()=>{const bd=data.devices.find(x=>x&&x.type==='board');cprDialog(bd&&bd.id);}},
 {id:'circuit.presetsExport',label:'Elosztó-lista exportálása',icon:'⬇',group:'Áramkör',alias:'export presets',hint:'vrg-elo-presets JSON.',run:()=>cprExport()},
 {id:'circuit.presetsImport',label:'Elosztó-lista importálása',icon:'📥',group:'Áramkör',alias:'import presets',hint:'vrg-elo-presets JSON, összefésülve.',run:()=>cprImportFile()}]);
