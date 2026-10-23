// ==========================================================================
// 08oa-wf-eloplan.js — workflow round (docs/workflow), WP-E4: click the Elosztó → suggested circuits
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The user: "the first opportunity to create the circuits is clicking on the Elosztó — the program makes a list of
// suggested circuits (based on our usual policy and what endpoints have been put down). Users select the ones they see
// fit, maybe adding a few more to complete the set."  Policy = MATERIAL §6, the CLA rounds (ALAPRETEG Q-001 / Q-002):
//   1 every DED endpoint → its own circuit (preset by appliance)        2 bedrooms → one socket circuit each
//   3 large rooms (> 20 m² or > 8 sockets) → 2 socket circuits; small rooms share by adjacency, ≤ 8 sockets a circuit
//   4 the kitchen worktop → its own circuit (2,5 mm²)                     5 wet rooms → their own socket circuit
//   6 lighting, Q-E04 = A: V1 day zone, V2 night zone (bedrooms + bathrooms); a lamp follows the zone of its switch
//   7 outdoor / garage sockets → their own circuit
// Only endpoints WITHOUT a circuit are suggested for, so existing circuits are never touched and a re-run fills the gaps.
// Every row is a table row the user ticks (the round's rule: every automatic step ends in a table). Alkalmaz creates 05j
// circuits with the M2 preset (c.preset, c.rooms), one undo step. Spec: tests/spec-97-eloplan.js.

const ELP_LARGE_M2=20,ELP_MAX_SOC=8,ELP_ADJ=450;     // ⚑ MATERIAL §6 thresholds; rooms within a wall's thickness are neighbours
const ELP_BED=['halo','gyerek'],ELP_WET=['furdo'],ELP_NIGHT=['halo','gyerek','furdo'];
const ELP_DED={fozolap:'fozo',suto:'suto',mosogato:'mosogat',mosogep:'mosog',szarito:'szarit',klima:'klima',bojler:'bojler'};
const ELP_DED_WORD=[['főzőlap','fozo'],['sütő','suto'],['mosogatógép','mosogat'],['mosógép','mosog'],['szárító','szarit'],['klíma','klima'],['bojler','bojler']];
const ELP_DED_NAME={fozo:'Főzőlap',fozo2l:'Főzőlap',suto:'Sütő',mosogat:'Mosogatógép',mosog:'Mosógép',szarit:'Szárítógép',klima:'Klíma',bojler:'Bojler',alelo:'Alelosztó'};
const ELP_CODES=['SOC','DED','LMP','SWI','SHU'];

function elpRow(key){return cprRows().find(r=>r.key===key)||CPR_CAT.find(r=>r.key===key)||null;}
function elpKinds(rm){if(!rm)return [];const k=typeof rwKinds==='function'?rwKinds(rm):[];return k.length?k:[typeof needKind==='function'?needKind(rm):'egyeb'];}
function elpIs(rm,list){return elpKinds(rm).some(k=>list.indexOf(k)>=0);}
function elpRoomName(rm){return rm?(rm.name||rm.num||rm.id||'Helyiség'):'Helyiség nélkül';}
function elpArea(rm){return rm&&rm.poly&&rm.poly.length>2?polyAreaMM(rm.poly)/1e6:0;}
function elpDedKey(d){if(d.hVar&&ELP_DED[d.hVar])return d.hVar==='fozolap'&&d.var==='hob2l'?'fozo2l':ELP_DED[d.hVar];
  if(d.var==='hob32')return 'fozo';if(d.var==='hob2l')return 'fozo2l';if(d.var==='alelo')return 'alelo';
  const w=String(d.name||d.label||'').toLowerCase();const hit=ELP_DED_WORD.find(x=>w.indexOf(x[0])>=0);return hit?hit[1]:null;}
function elpWorktop(d){return d.hVar==='pult'||(d.h>=900&&d.h<=1300);}
// rooms are neighbours when their outlines come within a wall's thickness of each other along a shared stretch
function elpBox(rm){const xs=rm.poly.map(p=>p[0]),ys=rm.poly.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}
function elpAdjacent(a,b){if(!a||!b||!a.poly||!b.poly)return false;const A=elpBox(a),B=elpBox(b);
  const gx=Math.max(A[0]-B[2],B[0]-A[2]),gy=Math.max(A[1]-B[3],B[1]-A[3]);
  return (gx<=ELP_ADJ&&gy<0)||(gy<=ELP_ADJ&&gx<0);}
// sockets in perimeter order (by angle round the room's centre), cut into n contiguous groups
function elpSplit(list,rm,n){const c=rm&&rm.poly?polyCentroidOf(rm.poly):[0,0];
  const s=list.slice().sort((a,b)=>Math.atan2(a.y-c[1],a.x-c[0])-Math.atan2(b.y-c[1],b.x-c[0]));const out=[];const k=Math.ceil(s.length/n);
  for(let i=0;i<s.length;i+=k)out.push(s.slice(i,i+k));return out;}
function polyCentroidOf(p){let x=0,y=0;p.forEach(q=>{x+=q[0];y+=q[1];});return [x/p.length,y/p.length];}

// the suggestion: rows {ref, name, preset, members:[ids], mm2, mcb, why, kind, dedicated, rooms:[ids], on}
function elpSuggest(boardId){
  // WP-E6: every level has its own board (Elosztó / Alosztó) — with more than one, a board suggests for its own level only
  const B=boardId?byId('devices',boardId):null,multi=hwList('board').length>1;
  const eps=data.devices.filter(d=>d&&cktCanJoin(d)&&ELP_CODES.indexOf(epCodeOf(d))>=0&&!cktOfDevice(d)&&(!multi||!B||d.level===B.level));
  const room=d=>{const e=roomOfDevice(d);return e&&e.rm?e.rm:null;};
  const rows=[],row=(key,name,ms,why,o)=>{const R=elpRow(key)||{};rows.push(Object.assign({preset:key,name,members:ms.map(d=>d.id),mm2:R.mm2||2.5,
    mcb:R.mcb||'1C 16A',why,kind:R.kind||'socket',dedicated:R.kind==='ded',rooms:[...new Set(ms.map(d=>{const r=room(d);return r&&r.id;}).filter(Boolean))],on:true},o||{}));};
  // sockets per room
  const byRoom=new Map();eps.filter(d=>epCodeOf(d)==='SOC').forEach(d=>{const r=room(d);const k=r?r.id:'—';if(!byRoom.has(k))byRoom.set(k,{rm:r,s:[]});byRoom.get(k).s.push(d);});
  const pool=[];
  byRoom.forEach(({rm,s})=>{const nm=elpRoomName(rm);
    if(rm&&elpIs(rm,['konyha'])){const top=s.filter(elpWorktop),rest=s.filter(d=>!elpWorktop(d));
      if(top.length>ELP_MAX_SOC){const g=elpSplit(top,rm,2);row('konyhaA',nm+' munkalap A',g[0],'konyhai munkalap, saját kör (§6.4)');row('konyhaB',nm+' munkalap B',g[1],'több mint 8 munkalap-dugalj');}
      else if(top.length)row('konyhaA',nm+' munkalap',top,'konyhai munkalap, saját kör (§6.4)');
      if(rest.length)pool.push({rm,s:rest,name:nm});return;}
    if(rm&&elpIs(rm,ELP_WET)){row('furdo',nm+' dugalj',s,'vizes helyiség, saját kör (§6.5)');return;}
    if(rm&&elpIs(rm,['kulter'])){row('kulter',nm+' dugalj',s,'kültér, saját kör (§6.7)');return;}
    if(rm&&elpIs(rm,['gepeszet'])&&/garázs|garazs|műhely/i.test(nm)){row('garazs',nm+' dugalj',s,'garázs / műhely, saját kör (§6.7)');return;}
    const large=rm&&((elpArea(rm)>ELP_LARGE_M2&&s.length>=4)||s.length>ELP_MAX_SOC);   // by area only with 4+ sockets: 3 sockets on 2 circuits makes no sense
    if(large){const n=Math.max(2,Math.ceil(s.length/ELP_MAX_SOC)),g=elpSplit(s,rm,n),key=elpIs(rm,['nappali','dolgozo'])?'dug25':'dugsz';
      g.forEach((m,i)=>row(key,nm+' dugalj '+['I','II','III','IV','V'][i],m,'nagy helyiség ('+elpArea(rm).toFixed(0)+' m², '+s.length+' dugalj) — '+g.length+' kör (§6.3)'));return;}
    if(rm&&elpIs(rm,ELP_BED)){row('dugsz',nm+' dugalj',s,'hálószoba, saját kör (§6.2)');return;}
    pool.push({rm,s,name:nm});});
  // the small rooms share circuits by adjacency, ≤ 8 sockets each (§6.3)
  const left=pool.slice();while(left.length){let cur=[left.shift()],n=cur[0].s.length;
    for(let grew=true;grew;){grew=false;for(let i=0;i<left.length;i++){const p=left[i];
      if(n+p.s.length<=ELP_MAX_SOC&&cur.some(q=>elpAdjacent(q.rm,p.rm))){cur.push(p);n+=p.s.length;left.splice(i,1);grew=true;break;}}}
    const ms=[].concat(...cur.map(p=>p.s));
    if(ms.length>ELP_MAX_SOC)elpSplit(ms,cur[0].rm,Math.ceil(ms.length/ELP_MAX_SOC)).forEach((m,i)=>row('dugsz',cur.map(p=>p.name).join(' · ')+' dugalj '+(i+1),m,'általános dugaljkör, szomszédos helyiségek (§6.3)'));
    else row('dugsz',cur.map(p=>p.name).join(' · ')+' dugalj',ms,cur.length>1?'kis helyiségek közös köre, szomszédosak (§6.3)':'általános dugaljkör (§6.3)');}
  // every dedicated endpoint → its own circuit
  eps.filter(d=>epCodeOf(d)==='DED').forEach(d=>{const key=elpDedKey(d),rm=room(d),nm=(ELP_DED_NAME[key]||'Dedikált fogyasztó')+' — '+elpRoomName(rm);
    const R=key?elpRow(key):null;row(key||'',nm,[d],'dedikált végpont, saját kör (§6.1)'+(key?'':' — típus ismeretlen, 16 A'),{kind:'ded',dedicated:true,mcb:R?R.mcb:'1C 16A',mm2:R?R.mm2:2.5});});
  // lighting: V1 day, V2 night (Q-E04 = A); a lamp switched from the other zone follows its switch
  const L=eps.filter(d=>{const c=epCodeOf(d);return c==='LMP'||c==='SWI'||c==='SHU';}),zone={};
  L.forEach(d=>{zone[d.id]=elpIs(room(d),ELP_NIGHT)?2:1;});
  data.devices.forEach(sw=>{if(!sw||!Array.isArray(sw.ctl)||!(sw.id in zone))return;sw.ctl.forEach(id=>{if(id in zone)zone[id]=zone[sw.id];});});
  // N4: a room whose Igénylista (08q) asks for 2+ világítási kör — vk 1 stays in its zone, vk 2… get their own circuit;
  // a switch goes with them when everything it controls does
  const extra=[];if(typeof reqLightVk==='function'){const byRm=new Map();L.forEach(d=>{if(epCodeOf(d)!=='LMP')return;const r=room(d);if(!r)return;if(!byRm.has(r))byRm.set(r,[]);byRm.get(r).push(d);});
    byRm.forEach((ls,rm)=>{const P=reqLightVk(rm,ls);if(!P)return;const take=new Map();
      ls.forEach(l=>{const vk=P.vk.get(l.id);if(vk>=2){if(!take.has(vk))take.set(vk,[]);take.get(vk).push(l);}});
      [...take.keys()].sort((a,b)=>a-b).forEach(vk=>{const lamps=take.get(vk),ids=new Set(lamps.map(l=>l.id));
        const sws=L.filter(s=>epCodeOf(s)==='SWI'&&Array.isArray(s.ctl)&&s.ctl.length&&s.ctl.every(id=>ids.has(id)));
        const ms=lamps.concat(sws);ms.forEach(d=>{zone[d.id]=0;});extra.push({rm,vk,ms,v:P.v,paired:P.paired});});});}
  [1,2].forEach(z=>{const ms=L.filter(d=>zone[d.id]===z);if(!ms.filter(d=>epCodeOf(d)==='LMP').length)return;
    row('vil',z===1?'Világítás — nappali zóna':'Világítás — éjszakai zóna',ms,(z===1?'nappali zóna':'éjszakai zóna: hálók, fürdők')+' (Q-E04 = A)',{kind:'light',ref:'V'+z});});
  extra.forEach(x=>row('vil','Világítás — '+elpRoomName(x.rm)+' '+x.vk,x.ms,'Igénylista: '+x.v+' világítási kör, ez a '+x.vk+'. ('+(x.paired?'párosítás szerint':'a kapcsolási körök sorrendjében')+')',{kind:'light'}));
  return rows;}

// tick → circuits. One undo step; lighting keeps V1 / V2 when that ref is free.
function elpApply(rows){const on=(rows||[]).filter(r=>r.on!==false&&r.members.length);if(!on.length)return {made:0,left:elpUnassigned().length};
  pushUndo(['circuits']);const made=[];
  on.forEach(r=>{const R=r.preset?elpRow(r.preset):null,m=mcbParse(r.mcb);
    const c=cktCreate({name:r.name,mcb:m.err||m.empty?null:{curve:m.curve,amps:m.amps,poles:m.poles,n:m.n},dedicated:!!r.dedicated,members:r.members});
    if(r.ref&&!cktList().some(x=>x!==c&&x.ref===r.ref))c.ref=r.ref;
    if(r.preset){c.preset=r.preset;c.rooms=r.rooms&&r.rooms.length?r.rooms:(R&&R.scope==='house'?['*']:[]);}
    made.push(c);});
  if(typeof cktRedraw==='function')cktRedraw();const left=elpUnassigned();
  $('hud').textContent=made.length+' áramkör létrehozva · '+left.length+' végpont kör nélkül';
  return {made:made.length,left:left.length,circuits:made};}
function elpUnassigned(level){return data.devices.filter(d=>d&&cktCanJoin(d)&&ELP_CODES.indexOf(epCodeOf(d))>=0&&!cktOfDevice(d)&&(!level||d.level===level));}

function elpDialog(boardId){const rows=elpSuggest(boardId);
  if(!rows.length){const n=elpUnassigned().length;$('hud').textContent=n?'Nincs javaslat — '+n+' végpont kör nélkül':'Minden végpont áramkörben van.';return null;}
  let ref=0;const nextRef=()=>{let k;do{k='A'+(++ref);}while(cktList().some(c=>c.ref===k));return k;};
  rows.forEach(r=>{if(!r.ref)r.ref=nextRef();});
  const already=data.devices.filter(d=>d&&cktCanJoin(d)&&ELP_CODES.indexOf(epCodeOf(d))>=0&&cktOfDevice(d)).length;
  const body=`<div style="font-size:12px">A lerakott végpontokból, a szokásos rend szerint (MATERIAL §6). Pipáld ki, amit kérsz; a név átírható.`
    +(already?` <span style="color:#888">${already} végpont már áramkörben van — ahhoz nem nyúl.</span>`:'')+`</div>`
    +`<table style="font-size:12px;width:100%;margin-top:6px;border-collapse:collapse"><tr style="color:#777"><td></td><td>Jel</td><td>Név</td><td>Tag</td><td>mm²</td><td>Kismegszakító</td></tr>`
    +rows.map((r,i)=>`<tr><td><input type="checkbox" class="elpOn" data-i="${i}" checked></td><td><b>${esc(r.ref)}</b></td>`
      +`<td><input class="elpName" data-i="${i}" value="${esc(r.name)}" style="width:210px;font-size:12px"></td><td>${r.members.length}</td>`
      +`<td>${String(r.mm2).replace('.',',')}</td><td>${esc(r.mcb)}</td></tr><tr><td></td><td></td><td colspan="4" style="color:#888;font-size:11px">Miért? ${esc(r.why)}</td></tr>`).join('')
    +`</table><div style="margin-top:8px"><button id="elpOwn">＋ Saját áramkör…</button> <span style="font-size:11px;color:#888">az Áramkör-listából (Elosztó)</span></div>`;
  openModal('Áramkörök javaslata',body,()=>{
    document.querySelectorAll('.elpOn').forEach(c=>{rows[+c.dataset.i].on=c.checked;});
    document.querySelectorAll('.elpName').forEach(c=>{const v=c.value.trim();if(v)rows[+c.dataset.i].name=v;});
    const res=elpApply(rows);if(res.left)setTimeout(()=>elpLeftDialog(),0);},'Alkalmaz');
  const own=$('elpOwn');if(own)own.onclick=()=>{closeModal();cprDialog(boardId);};
  return rows;}
function elpLeftDialog(){const L=elpUnassigned();if(!L.length)return;
  const nm=d=>{const e=roomOfDevice(d);return elpRoomName(e&&e.rm);};
  openModal('Kör nélkül maradt végpontok',`<div style="font-size:12px;margin-bottom:6px">${L.length} végpont nincs áramkörben. Jobb klikk a végponton → Áramkör ehhez…, vagy futtasd újra a javaslatot.</div>`
    +`<div style="max-height:40vh;overflow:auto;font-size:12px">`+L.map(d=>`<div>${esc(d.ref||d.id)} · ${esc(epCodeOf(d)||'')} · ${esc(nm(d))}</div>`).join('')+`</div>`,()=>{},'Rendben');}

// the Elosztó: a click in phase Villamosság (nothing else running) opens the suggestion; its menu always has it
let ELP_DOWN=null;
STK_TOOLS.push({k:'eloClick',active:()=>state.mode==='select'&&state.wfPhase==='vill'&&(typeof toolCurrent!=='function'||!toolCurrent()),
  down(e){ELP_DOWN=e.button===0?[e.clientX,e.clientY]:null;return false;},
  up(e){const p=ELP_DOWN;ELP_DOWN=null;if(!p||Math.hypot(e.clientX-p[0],e.clientY-p[1])>5)return false;
    const h=hitTest(e),d=h&&h.t==='devices'?data.devices[h.i]:null;
    if(d&&d.type==='board'&&elpUnassigned().length)setTimeout(()=>elpDialog(d.id),0);return false;}});
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(d&&d.type==='board')items.push({label:'🧮 Áramkörök javaslata…',act:()=>elpDialog(d.id)});});
registerActions([{id:'circuit.suggest',label:'Áramkörök javaslata',icon:'🧮',group:'Áramkör',alias:'suggest circuits javaslat aramkor elosztó policy',
  hint:'A lerakott végpontokból áramkör-javaslat táblázatban: dedikált, munkalap, vizes, hálók, nagy helyiségek, világítás V1 / V2.',
  when:c=>!c.inEditor,run:()=>{const b=data.devices.find(d=>d&&d.type==='board');elpDialog(b&&b.id);}}]);

window.elpSuggest=elpSuggest;window.elpApply=elpApply;window.elpDialog=elpDialog;window.elpUnassigned=elpUnassigned;
