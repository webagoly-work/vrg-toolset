// ==========================================================================
// 04-totals.js — totals, BOM, numbering, wire and switch reports
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// totals ////////////////////
function updateTotals(){try{renderCircuitList();}catch(e){}const len={lighting:0,sockets:0,power3:0,data:0};data.cables.forEach(cb=>len[cb.type]+=cableLen(cb));
  let rows='',tot=0;for(const k in CIRC){tot+=len[k];rows+=`<tr><td><span class="swatch" style="background:${CIRC[k].c}"></span> ${CIRC[k].name}</td><td class="n">${len[k].toFixed(1)}</td></tr>`;}
  rows+=`<tr><td><b>Összesen</b></td><td class="n"><b>${tot.toFixed(1)}</b></td></tr>`;document.getElementById('tblCable').innerHTML=rows;
  const cnt={};for(const k in DEV)cnt[k]=0;data.devices.forEach(d=>cnt[d.type]++);
  let dr='';for(const k in DEV)dr+=`<tr><td>${DEV[k]}</td><td class="n">${cnt[k]}</td></tr>`;document.getElementById('tblDev').innerHTML=dr;
  renderBOM();}
const DROP={socket:0.3,switch:1.1,light:0.5,board:0,junction:0};
const CABNAME={lighting:'Kábel – Világítás',sockets:'Kábel – Dugalj',power3:'Kábel – 3 fázis',data:'Kábel – Adat'};
function computeBOM(){const len={lighting:0,sockets:0,power3:0,data:0};data.cables.forEach(cb=>len[cb.type]+=cableLen(cb));
  const cnt={};for(const k in DEV)cnt[k]=0;data.devices.forEach(d=>cnt[d.type]++);
  const drop={lighting:0,sockets:0,power3:0,data:0};
  drop.sockets+=cnt.socket*DROP.socket; drop.lighting+=cnt.switch*DROP.switch+cnt.light*DROP.light;
  const w=1+(+state.waste||0)/100,rows=[];
  for(const k of ['lighting','sockets','power3','data']){const q=(len[k]+drop[k])*w;if(q>0)rows.push({id:'cab_'+k,name:CABNAME[k],qty:+q.toFixed(1),unit:'m'});}
  for(const k in DEV){if(cnt[k])rows.push({id:'dev_'+k,name:DEV[k],qty:cnt[k],unit:'db'});}
  const doors=data.openings.filter(o=>o.type==='door').length,wins=data.openings.filter(o=>o.type==='window').length;
  if(doors)rows.push({id:'op_door',name:'Ajtó',qty:doors,unit:'db'});
  if(wins)rows.push({id:'op_win',name:'Ablak',qty:wins,unit:'db'});
  // conduit (path) by build type + conductor by mm²/data — from the path/routing layer
  const cond={},wire={};
  data.paths.forEach(pa=>{for(let si=0;si<pa.nodes.length-1;si++){const sec=pa.sections[si]||{build:'sull_gege'};const L=sectionLen(pa,si);
    cond[sec.build]=(cond[sec.build]||0)+L;
    const carried=(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]);
    carried.forEach(c=>{const k=c.data?('d_'+c.data):('m_'+c.mm2);wire[k]=(wire[k]||0)+L*(c.count||1);});}});
  BUILDS.forEach(b=>{if(cond[b.k])rows.push({id:'cond_'+b.k,name:'Pálya – '+b.l,qty:+(cond[b.k]*w).toFixed(1),unit:'m'});});
  Object.keys(wire).forEach(k=>{const nm=k[0]==='d'?('Vezeték – '+k.slice(2)):('Vezeték '+k.slice(2)+' mm²');rows.push({id:'w_'+k,name:nm,qty:+(wire[k]*w).toFixed(1),unit:'m'});});
  return rows;}
function renderBOM(){const rows=computeBOM();let html=`<tr><td><b>Tétel</b></td><td class="n"><b>Menny.</b></td><td><b>E.</b></td><td class="n"><b>Ft/e.</b></td><td class="n"><b>Összeg</b></td></tr>`,tot=0;
  for(const r of rows){const price=state.price[r.id]||0,sum=price*r.qty;tot+=sum;
    html+=`<tr><td>${r.name}</td><td class="n">${r.qty}</td><td>${r.unit}</td>`
      +`<td class="n"><input type="number" data-p="${r.id}" value="${price}" style="width:58px"></td>`
      +`<td class="n">${sum?Math.round(sum).toLocaleString('hu-HU'):''}</td></tr>`;}
  html+=`<tr><td colspan="4"><b>Összesen (Ft)</b></td><td class="n"><b>${Math.round(tot).toLocaleString('hu-HU')}</b></td></tr>`;
  const el=document.getElementById('tblBOM');if(!el)return;el.innerHTML=html;
  el.querySelectorAll('input[data-p]').forEach(inp=>inp.onchange=()=>{state.price[inp.dataset.p]=+inp.value||0;renderBOM();});}
function bomText(){const rows=computeBOM();let t=`ELEKTROMOS ANYAG- ÉS ÁRKIMUTATÁS (hulladék ${state.waste}%)\n`,tot=0;
  rows.forEach(r=>{const p=state.price[r.id]||0,s=p*r.qty;tot+=s;t+=`${r.name}: ${r.qty} ${r.unit}`+(p?` × ${p} = ${Math.round(s)} Ft`:'')+'\n';});
  return t+`Összesen: ${Math.round(tot).toLocaleString('hu-HU')} Ft`;}
function bomCSV(){const rows=computeBOM();let t='Tetel;Mennyiseg;Egyseg;Ft_egyseg;Osszeg\n';
  rows.forEach(r=>{const p=state.price[r.id]||0;t+=`${r.name};${r.qty};${r.unit};${p};${Math.round(p*r.qty)}\n`;});return t;}
function bomJSON(){const rows=computeBOM();let tot=0;const items=rows.map(r=>{const p=state.price[r.id]||0;tot+=p*r.qty;return {tetel:r.name,menny:r.qty,egyseg:r.unit,ft_egyseg:p,osszeg:Math.round(p*r.qty)};});
  return {hulladek_szazalek:+state.waste,tetelek:items,osszesen_ft:Math.round(tot)};}
// ---- documentation: numbering + wire/cable lists ----
const REFPRE={socket:'D',switch:'K',light:'L',junction:'KD',board:'EL',box:'SZ'};
// ---- device KINDS: a switch/socket variant always lives IN a szerelvénydoboz, so the box is implied ----
const DEVKIND={
  '100':{t:'switch',n:'Kapcsoló 100 — impulzuskapcsoló',   s:'100'},
  '101':{t:'switch',n:'Kapcsoló 101 — egypólusú',          s:'101',vl:'752001'},
  '102':{t:'switch',n:'Kapcsoló 102 — kétpólusú',          s:'102',vl:'752002'},
  '103':{t:'switch',n:'Kapcsoló 103 — háromfázisú',        s:'103',vl:'752003'},
  '104':{t:'switch',n:'Kapcsoló 104 — éjszakai fokozat (kifutó)',s:'104'},
  '105':{t:'switch',n:'Kapcsoló 105 — csillárkapcsoló',    s:'105',vl:'752005'},
  '106':{t:'switch',n:'Kapcsoló 106 — váltókapcsoló',      s:'106',vl:'752006'},
  '107':{t:'switch',n:'Kapcsoló 107 — keresztkapcsoló',    s:'107',vl:'752007'},
  '108':{t:'switch',n:'Kapcsoló 108 — kettős váltókapcsoló',s:'108',vl:'752008'},
  'mozg':{t:'switch',n:'Mozgásérzékelő',                   s:'M'},
  '2pf': {t:'socket',n:'Aljzat 2P+F',                      s:'2P+F',vl:'753120'},
  '2pf2':{t:'socket',n:'Aljzat 2P+F dupla',                s:'2×'},
  'utp': {t:'socket',n:'Aljzat UTP (RJ45)',                s:'UTP'},
  '3f':  {t:'socket',n:'Aljzat 3F (5×) ipari',             s:'3F'},
  'tv':  {t:'socket',n:'Aljzat TV/SAT',                    s:'TV'},
  'usb': {t:'socket',n:'Aljzat USB',                       s:'USB'}};
// the Valena Life mechanism refs end in the same type number (752001=101 … 752008=108)
function kindRef(k){return (DEVKIND[k]&&DEVKIND[k].vl)||'';}
// what Space drops at the cursor; ←/→ cycles the list while drawing a path/cable
const PLACE_ITEMS=[
  {id:'box',   n:'Szerelvénydoboz (üres, ⌀68)', mk:()=>({type:'box'})},
  {id:'boxlv', n:'Szerelvénydoboz LV (gyengeáram — leválasztva)', mk:()=>({type:'box',lv:true,boxColor:'#e6f2ff'})},
  {id:'kd80',  n:'Kötődoboz ⌀80',   mk:()=>({type:'junction',jbShape:'circle',jbSize:80})},
  {id:'kd100', n:'Kötődoboz 100×100', mk:()=>({type:'junction',jbShape:'rect',jbSize:100})},
  {id:'kdx',   n:'Kötődoboz — egyedi méret…', mk:()=>{const v=+prompt('Kötődoboz mérete (mm):',state.lastJb||120);
      if(!v||isNaN(v))return null;state.lastJb=v;return {type:'junction',jbShape:'rect',jbSize:v};}}
].concat(Object.keys(DEVKIND).map(k=>({id:'k_'+k,n:DEVKIND[k].n+(DEVKIND[k].vl?'  ['+DEVKIND[k].vl+']':''),mk:()=>({type:DEVKIND[k].t,kind:k})})))
 .concat([{id:'light',n:'Lámpa',mk:()=>({type:'light'})},
          {id:'board',n:'Elosztószekrény',mk:()=>({type:'board',h:boardZ(),z:boardZ(),rw:BOARD_RW,rd:BOARD_RD})}]);
function placeItem(){return PLACE_ITEMS[(state.placeIdx||0)%PLACE_ITEMS.length];}
// real-world footprint of the pending Space item, in mm (drives the grey swatch on the height display)
function placeItemSize(it){const d=(it.id==='kdx')?{type:'junction',jbSize:(state.lastJb||120)}:(it.mk?it.mk():null)||{};
  if(d.type==='junction')return +(d.jbSize||80);
  if(d.type==='board')return 400;
  return DEV_BOX_W;}
// the badge drawn inside the floating height display: name of the item + a square scaled to its size
function paletteBadge(x0,y0,it){const mm=placeItemSize(it),px=Math.max(7,Math.min(18,mm*0.16));
  const cy=y0+10,cx=x0+13;
  return `<rect x="${(cx-px/2).toFixed(1)}" y="${(cy-px/2).toFixed(1)}" width="${px.toFixed(1)}" height="${px.toFixed(1)}" rx="1.5" fill="#5a5348" fill-opacity="0.75" stroke="#333" stroke-width="0.8"/>`
    +`<text x="${cx+px/2+5}" y="${cy+3.5}" font-size="9.5" fill="#333">␣ ${esc(it.n.replace(/\s*\[.*$/,''))} · ${mm} mm</text>`;}
function cyclePlace(dir){const n=PLACE_ITEMS.length;state.placeIdx=(((state.placeIdx||0)+dir)%n+n)%n;
  $('hud').textContent='Space → '+placeItem().n+'   (←/→ vált, '+((state.placeIdx||0)+1)+'/'+n+')';draw();}
// drop the currently selected item at the drawing cursor
function placeAtCursor(){if(!cursor)return;const it=placeItem(),base=it.mk();if(!base)return;
  pushUndo();
  const dev=Object.assign({level:cursor.level,x:cursor.x,y:cursor.y,h:cursor.h||0,layer:curLayer()},base);
  dev.ref=nextRef(dev.type);
  if(dev.type==='board'){dev.h=BOARD_DEFAULT_Z;if(typeof ensureBoardObject==='function'){data.devices.push(dev);ensureBoardObject(dev);draw();
    $('hud').textContent=it.n+' elhelyezve.';return data.devices.length-1;}}
  data.devices.push(dev);draw();
  $('hud').textContent=it.n+' elhelyezve — '+(dev.ref||'')+' · '+Math.round(dev.h)+' mm';
  return data.devices.length-1;}
function nextRef(type){let n=0;data.devices.forEach(d=>{if(d.type===type&&d.ref)n++;});return (REFPRE[type]||'X')+(n+1);}
function autoNumber(){pushUndo();const c={};data.devices.forEach(d=>{c[d.type]=(c[d.type]||0)+1;d.ref=(REFPRE[d.type]||'X')+c[d.type];});
  // number circuits that lack a sorszám, per device order
  let ci=0;data.devices.forEach(d=>{if(d.req&&!d.req.num){ci++;d.req.num=(d.req.data?'A':'')+ci;}});
  draw();$('hud').textContent='Készülékek és áramkörök átszámozva.';}
function boardRef(){const b=data.devices.find(d=>d.type==='board');return b&&b.ref?b.ref:'EL';}
function refOf(d){return d.ref||('?'+(data.devices.indexOf(d)+1));}
function deviceRunLen(i){let L=0;const builds=new Set(),D=data.devices[i];if(!D)return {L,builds:[]};
  data.paths.forEach(pa=>{for(let si=0;si<pa.nodes.length-1;si++){const sec=pa.sections[si];
  if(sec&&sec.circuits&&sec.circuits.some(c=>devByRef(c.dev)===D)){L+=sectionLen(pa,si);builds.add(sec.build);}}});return {L,builds:[...builds]};}
function cableRows(){const rows=[];data.devices.forEach((D,i)=>{if(!D.req)return;const {L,builds}=deviceRunLen(i);if(L<=0)return;
  rows.push([(D.req.name||'')+(D.req.num?' '+D.req.num:''),boardRef(),refOf(D),(D.req.count||'?')+'×'+(D.req.data?D.req.data:(D.req.mm2+' mm²')),(L).toFixed(1)+' m',builds.map(b=>BUILDL[b]||b).join(', ')]);});return rows;}
function wireRows(){const rows=[];data.devices.forEach((D,i)=>{if(!D.req)return;const {L}=deviceRunLen(i);if(L<=0)return;const cnt=D.req.count||0;
  for(let c=0;c<cnt;c++)rows.push([(D.req.name||'')+(D.req.num?' '+D.req.num:''),refOf(D),(D.req.colors&&D.req.colors[c])||WIRE_COLORS[c%WIRE_COLORS.length],D.req.data?D.req.data:(D.req.mm2+' mm²'),(L).toFixed(1)+' m']);});return rows;}
function showList(title,cols,rows,csvName){
  const head=cols.map(c=>`<th style="text-align:left;padding:3px 7px;position:sticky;top:0;background:#f3f0e9">${c}</th>`).join('');
  const body=rows.length?rows.map(r=>'<tr>'+r.map(v=>`<td style="padding:2px 7px;border-top:1px solid #eee">${esc(String(v))}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${cols.length}" style="padding:8px;color:#888">Nincs bekötött (routolt) áramkör. Húzz pályát, állíts be Szükséges ereket, majd Behúzás.</td></tr>`;
  openModal(title,`<div style="max-height:52vh;overflow:auto"><table style="font-size:12px;border-collapse:collapse;width:100%"><tr>${head}</tr>${body}</table></div>`
    +`<div class="mrow" style="margin-top:8px"><button id="lCopy">📋 Copy</button><button id="lCsv">⬇ CSV</button></div>`,()=>true);
  $('lCopy').onclick=()=>{const t=[cols.join('\t')].concat(rows.map(r=>r.join('\t'))).join('\n');(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{},()=>{});};
  $('lCsv').onclick=()=>{const t=[cols.join(';')].concat(rows.map(r=>r.map(v=>String(v).replace(/;/g,',')).join(';'))).join('\n');download(csvName,t);};}
function showCableList(){showList('Kábellista',['Áramkör','Tól','Ig','Ér','Hossz','Kivitel'],cableRows(),'kabellista.csv');}
// ================= SURPRISE: elosztó tábla / áramkör-számítás =================
const DEVLOAD={socket:500,light:60,switch:0,board:0,junction:0};   // W, diversified
const AMPACITY={0.75:9,1.5:16,2.5:20,4:25,6:32,10:43,16:57,25:75,35:92};
const MCBS=[6,10,13,16,20,25,32,40,50,63];
const RHO=0.0225;   // Ω·mm²/m copper at operating temp
function circuitGroups(){const g={};
  data.devices.forEach((D,i)=>{if(!D.req)return;const key=(D.req.name||'?')+'|'+(D.req.num||'');
    const {L}=deviceRunLen(i);
    if(!g[key])g[key]={name:D.req.name||'?',num:D.req.num||'',mm2:D.req.mm2,data:D.req.data,count:D.req.count,devs:[],load:0,maxL:0,totL:0,switches:[],passing:false};
    const G=g[key];G.devs.push(D.ref||DEV[D.type]);G.load+=(DEVLOAD[D.type]||0);
    G.maxL=Math.max(G.maxL,L);G.totL+=L;if(D.req.mm2)G.mm2=D.req.mm2;
    // record switches on this circuit + which devices they drive (so the schedule shows switch→lamp control)
    if(D.type==='switch'&&D.swMap){const drives=Object.keys(D.swMap).map(t=>{const tg=devByRef(D.swMap[t]);return tg?(tg.ref||DEV[tg.type]):null;}).filter(Boolean);
      if(drives.length)G.switches.push((D.ref||'K')+'→'+drives.join('/'));}});
  // gating: mark a circuit group as containing pass-through (uninterrupted) sections
  data.paths.forEach(pa=>(pa.sections||[]).forEach(sec=>{if(!sec)return;const cs=(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]);
    cs.forEach(c=>{if(!c||!c.passing)return;const key=(c.name||'?')+'|'+(c.num||'');if(g[key])g[key].passing=true;});}));
  return Object.values(g);}
function schedRows(){return circuitGroups().map(G=>{
  const isData=!!G.data;
  const P=G.load, I=isData?0:P/230;
  const Iz=AMPACITY[G.mm2]||0;
  const mcb=isData?'—':(MCBS.find(m=>m>=Math.max(I,1)&&m<=Iz)||null);
  const du=(!isData&&G.mm2&&I>0)?(2*RHO*G.maxL*I/G.mm2)/230*100:0;
  const lim=/vil|lámp|light/i.test(G.name)?3:5;
  const warn=[];
  if(!isData){if(!mcb)warn.push('kábel túl kicsi ('+G.mm2+' mm², Iz='+Iz+'A)');
    if(du>lim)warn.push('ΔU '+du.toFixed(1)+'% > '+lim+'%');
    if(G.mm2<1.5&&P>0)warn.push('<1,5 mm² erőátvitelre nem javasolt');}
  return {name:G.name,num:G.num,devs:G.devs.join(', '),n:G.devs.length,P,I,mm2:G.mm2,dataKind:G.data,
    L:G.maxL,tot:G.totL,mcb,du,warn:warn.join(' · '),switches:(G.switches||[]).join(', '),passing:G.passing};});}
function showSchedule(){const rows=schedRows();
  const totP=rows.reduce((a,r)=>a+r.P,0),totI=totP/230;
  const mains=MCBS.find(m=>m>=totI*0.7)||63;
  const head=['Áramkör','Sorsz.','Készülékek','db','P (W)','I (A)','Kábel','Hossz','Kismegszakító','ΔU %','Kapcsolás','Megjegyzés'];
  const body=rows.length?rows.map(r=>{const bad=!!r.warn;
    return `<tr style="${bad?'background:#fff3f3':''}">`+[
      esc(r.name),esc(r.num),esc(r.devs),r.n,Math.round(r.P),r.I?r.I.toFixed(1):'—',
      r.dataKind?esc(r.dataKind):(r.mm2+' mm²'),r.L.toFixed(1)+' m',
      r.mcb?('B'+r.mcb):(r.dataKind?'—':'<b style="color:#c0392b">nincs</b>'),
      r.du?r.du.toFixed(1):'—',
      (r.switches?esc(r.switches):'—')+(r.passing?' <span style="color:#888" title="áthaladó áramkör van a körön">⟿</span>':''),
      bad?`<span style="color:#c0392b">${esc(r.warn)}</span>`:'✓'
    ].map(v=>`<td style="padding:3px 7px;border-top:1px solid #eee;white-space:nowrap">${v}</td>`).join('')+'</tr>';}).join('')
    :`<tr><td colspan="12" style="padding:10px;color:#888">Nincs behúzott áramkör. Állíts be Szükséges ereket a készülékeken, majd Behúzás.</td></tr>`;
  openModal('Elosztó tábla — áramkör-számítás',
    `<div style="max-height:52vh;overflow:auto"><table style="font-size:11.5px;border-collapse:collapse;width:100%">`
    +`<tr>${head.map(h=>`<th style="text-align:left;padding:4px 7px;position:sticky;top:0;background:#f3f0e9;white-space:nowrap">${h}</th>`).join('')}</tr>${body}</table></div>`
    +`<div class="mrow" style="margin-top:8px;font-size:12px">Összes terhelés <b>${Math.round(totP)} W</b> (${totI.toFixed(1)} A) · javasolt főkapcsoló <b>B${mains}</b> · dugalj/vizes körökre <b>30 mA Fi-relé</b></div>`
    +`<div class="mrow" style="font-size:10.5px;color:#888">Számítás: I=P/230 V, diverzifikált terhelés (dugalj 500 W, lámpa 60 W); ΔU=2·ρ·L·I/A, ρ=0,0225 Ω·mm²/m; határ 3% világítás / 5% egyéb. Tájékoztató méretezés — kivitelezés előtt ellenőrizd.</div>`
    +`<div class="mrow"><button id="scCsv">⬇ CSV</button><button id="scPrint">🖨 Print</button></div>`,()=>true);
  $('scCsv').onclick=()=>{const t=[head.join(';')].concat(rows.map(r=>[r.name,r.num,r.devs,r.n,Math.round(r.P),r.I.toFixed(1),r.dataKind||r.mm2,r.L.toFixed(1),r.mcb?'B'+r.mcb:'nincs',r.du.toFixed(1),(r.switches||'')+(r.passing?' (áthaladó)':''),r.warn||'OK'].join(';'))).join('\n');download('elosztotabla.csv',t);};
  $('scPrint').onclick=()=>{const w2=window.open('','_blank');if(!w2)return;
    w2.document.write('<html><head><title>Elosztó tábla</title></head><body style="font-family:Arial;font-size:12px">'
      +'<h3>Elosztó tábla — '+esc(state.bp.proj||'terv')+'</h3><table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:11px">'
      +'<tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr>'
      +rows.map(r=>'<tr>'+[r.name,r.num,r.devs,r.n,Math.round(r.P),r.I.toFixed(1),r.dataKind||(r.mm2+' mm²'),r.L.toFixed(1)+' m',r.mcb?'B'+r.mcb:'nincs',r.du.toFixed(1)+'%',(r.switches||'—')+(r.passing?' (áthaladó)':''),r.warn||'OK'].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')
      +'</table><p>Összes: '+Math.round(totP)+' W ('+totI.toFixed(1)+' A) · főkapcsoló B'+mains+'</p></body></html>');
    w2.document.close();w2.print();};}
// ---- per-switch terminal / wire report ----
function switchReportData(){const out=[];
  data.devices.forEach((D,i)=>{if(D.type!=='switch')return;
    const t=switchType(D.swType||'101');const swMap=D.swMap||{};
    const terms=t.terms.map(tm=>{const tgt=tm.kind==='out'?devByRef(swMap[tm.id]):null;
      return {id:tm.id,kind:tm.kind,label:tm.l,target:tgt?deviceLabel(tgt):null};});
    out.push({ref:D.ref||('K'+(i+1)),type:t.k,typeLabel:t.l,level:D.level,
      wires:(D.wires||[]).map(w=>({name:w.name,color:w.color})),
      terms, drives:terms.filter(x=>x.kind==='out'&&x.target).map(x=>x.target)});});
  return out;}
function showSwitchReport(){const sw=switchReportData();
  const body=sw.length?sw.map(s=>{
    const wireHtml=s.wires.length?s.wires.map(w=>`<span style="display:inline-block;margin:1px 4px 1px 0;padding:1px 6px;border-radius:3px;background:#f2efe8;font-size:11px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${WIRE_HEX[w.color]||'#222'};vertical-align:middle;margin-right:3px"></span>${esc(w.name||'')} (${esc(w.color||'')})</span>`).join(''):'<span style="color:#aaa;font-size:11px">nincs kézi ér megadva</span>';
    const termHtml=s.terms.map(tm=>{const io=tm.kind==='in'?'<b style="color:#b06">be</b>':'<b style="color:#068">ki</b>';
      return `<tr><td style="padding:2px 8px;border-top:1px solid #eee"><b>${esc(tm.id)}</b></td><td style="padding:2px 8px;border-top:1px solid #eee">${io}</td><td style="padding:2px 8px;border-top:1px solid #eee">${esc(tm.label)}</td><td style="padding:2px 8px;border-top:1px solid #eee">${tm.kind==='out'?(tm.target?'→ '+esc(tm.target):'<span style="color:#c0392b">— nincs cél —</span>'):'—'}</td></tr>`;}).join('');
    return `<div style="border:1px solid #e4dfd4;border-radius:7px;padding:8px 10px;margin-bottom:8px">`
      +`<div style="font-size:13px;font-weight:700;margin-bottom:2px">🎚 ${esc(s.ref)} <span style="font-weight:400;color:#777;font-size:11.5px">— ${esc(s.typeLabel)} · ${esc(s.level)}</span></div>`
      +`<div style="font-size:11.5px;margin:3px 0"><b>Kapcsolt készülékek:</b> ${s.drives.length?s.drives.map(esc).join(', '):'<span style="color:#c0392b">nincs hozzárendelve</span>'}</div>`
      +`<table style="border-collapse:collapse;width:100%;margin:4px 0"><tr style="font-size:10.5px;color:#777"><th style="text-align:left;padding:2px 8px">Kapocs</th><th style="text-align:left;padding:2px 8px">Ir.</th><th style="text-align:left;padding:2px 8px">Leírás</th><th style="text-align:left;padding:2px 8px">Cél</th></tr>${termHtml}</table>`
      +`<div style="font-size:11.5px;margin-top:4px"><b>Erek:</b> ${wireHtml}</div>`
      +`</div>`;}).join(''):'<div style="padding:10px;color:#888">Nincs kapcsoló a tervben. Helyezz el kapcsolót, majd jobb klikk → 🎚 Kapcsoló típus a bekötéshez.</div>';
  openModal('Kapcsoló riport — kapcsok és erek',`<div style="max-height:56vh;overflow:auto">${body}</div>`
    +`<div class="mrow" style="font-size:10.5px;color:#888">Minden kapcsoló típusa (101/102/105…), a kapcsainak be/ki iránya, hogy melyik kimenet melyik készüléket hajtja, és a kézzel megadott erek. A célokat jobb klikk → 🎚 Kapcsoló típus alatt állíthatod.</div>`
    +`<div class="mrow"><button id="swrCsv">⬇ CSV</button><button id="swrPrint">🖨 Print</button></div>`,()=>true);
  $('swrCsv').onclick=()=>{const lines=['Kapcsoló;Típus;Kapocs;Irány;Leírás;Cél;Erek'];
    sw.forEach(s=>{const wires=s.wires.map(w=>w.name+'('+w.color+')').join(' / ');
      s.terms.forEach(tm=>lines.push([s.ref,s.type,tm.id,tm.kind==='in'?'be':'ki',tm.label,tm.target||'',wires].join(';')));});
    download('kapcsolo_riport.csv',lines.join('\n'));};
  $('swrPrint').onclick=()=>{const w2=window.open('','_blank');if(!w2)return;
    w2.document.write('<html><head><title>Kapcsoló riport</title></head><body style="font-family:Arial;font-size:12px"><h3>Kapcsoló riport — '+esc(state.bp.proj||'terv')+'</h3>'
      +sw.map(s=>'<div style="margin-bottom:10px"><b>'+esc(s.ref)+'</b> — '+esc(s.typeLabel)+'<br>Kapcsolt: '+(s.drives.map(esc).join(', ')||'—')
      +'<table border="1" cellspacing="0" cellpadding="3" style="border-collapse:collapse;font-size:11px;margin-top:3px"><tr><th>Kapocs</th><th>Irány</th><th>Leírás</th><th>Cél</th></tr>'
      +s.terms.map(tm=>'<tr><td>'+tm.id+'</td><td>'+(tm.kind==='in'?'be':'ki')+'</td><td>'+esc(tm.label)+'</td><td>'+(tm.target?esc(tm.target):'—')+'</td></tr>').join('')
      +'</table>Erek: '+(s.wires.map(w=>esc(w.name)+' ('+esc(w.color)+')').join(', ')||'—')+'</div>').join('')
      +'</body></html>');w2.document.close();w2.print();};}
function showWireList(){showList('Vezetéklista',['Áramkör','Készülék','Szín','Keresztmetszet','Hossz'],wireRows(),'vezeteklista.csv');}
