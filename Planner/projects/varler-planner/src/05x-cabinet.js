// ==========================================================================
// 05x-cabinet.js — the Elosztószekrény: ways, protection, modules, phases (WP-E5)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The defaults are P33's settled cabinet (P33-BUILD-001 §14, K31/K32): a one-module RCBO on every way, a
// three-phase-ready feed, way groups system / RoomBox lighting / RoomBox sockets / big loads. Ratings and loads
// are typical (reasoned) and a 05j circuit's own `mcb` always wins. The result is a schedule and a JSON the future
// DIN-rail tool reads (format vrg-cabinet v1, wrapping the existing vrg-circuits payload). Prefix: elo.

const ELO_RULES={
 perWay:'rcbo',            // K31: one 1-module RCBO on every way; 'rcd' = grouped RCDs instead [Q33=A]
 rcbo:{type:'A',ma:30,mod:1},
 rcd:{type:'A',ma:30,amps:40,mod:2,maxWays:4},       /*r*/ // only when perWay==='rcd'
 sys:{base:2, ssc:2, pack:1},                        // B1 §14.3: BASE ×2, SSC ×2, assured pack ×1
 lightPerRbx:1,                                      // B1 §14.3
 socketKitchen:3,                                    // S04 trimmed (B1 §14.2): worktop A, B + the island
 mcb:{lighting:'1C 10A', socket15:'1C 13A', socket25:'1C 16A', g16:'1C 16A', hob32:'1C 32A', hob2l:'1P-N C16A', sys:'1C 10A', alelo:'3C 25A', avp:'1C 16A'}, /*r*/
 feed:{'1f':[{n:'Főkapcsoló 2P',mod:2},{n:'Túlfeszültség-védelem 1P+N (T1+T2)',mod:2}],
       '3f':[{n:'Főkapcsoló 4P',mod:4},{n:'Túlfeszültség-védelem 3P+N (T1+T2)',mod:4}]},
 bell:{n:'Moduláris csengő',mod:1,on:true},
 phase:'3f',               // K32: build three-phase-ready
 rowModules:12, spareMin:2,
 // typical connected load per way, kW — B1 §14.4 (BUILD-002 replaces them with nameplates)
 kw:{hob2l:7.4, hob32:7.4, g16:2.0, oven:3.5, washer:2.2, dishwasher:2.0, bojler:2.0, klima:1.2, avp:0.5,
     socketKitchen:1.0, socket:0.7, light:0.15, sys:0.1, alelo:5.0,
     av:{'AV-1':0.3,'AV-2':0.5,'AV-3':0.4}}};   /*r*/ // C7: the guide's §7.1 realistic continuous loads
const ELO_KW_WORDS=[[/sut|oven/,'oven'],[/mosogat|dishwash/,'dishwasher'],[/mosogep|washer/,'washer'],[/bojler|boiler/,'bojler'],[/klima|split|hvac/,'klima']];

function eloOpt(o){const s=state.elo||{};return {phase:(o&&o.phase)||s.phase||ELO_RULES.phase,perWay:(o&&o.perWay)||s.perWay||ELO_RULES.perWay};}
// the consumers a board feeds over the channel topology (mains / panel carriers)
function eloFeeds(boardId){const out={rbx:[],base:[],ssc:[]};
  chnGraph().edges.forEach(e=>{if(e.carrier!=='mains'&&e.carrier!=='panel')return;const o=e.a===boardId?e.b:e.b===boardId?e.a:null;if(!o)return;
    const d=byId('devices',o);if(d&&out[d.type]&&out[d.type].indexOf(d)<0)out[d.type].push(d);});
  ['rbx','base','ssc'].forEach(k=>out[k].sort((a,b)=>prtIdCmp(a.id,b.id)));return out;}
// the board a big load hangs on: the origin of its fill run, else the only / nearest board
function eloLoadBoard(d){if(d&&d.cin&&d.cin.av){const fp=data.paths.find(p=>p&&p.cin&&p.cin.kind==='feed'&&p.layer===d.cin.of);if(fp&&byId('devices',fp.cin.to))return fp.cin.to;}   // C7: the cinema's own feed
  const ck=d&&d.var==='alelo'&&typeof cktOfDevice==='function'?cktOfDevice(d):null;if(ck&&ck.board&&byId('devices',ck.board))return ck.board;
  const r=afillRuns().find(x=>x.stage==='stack'&&x.to===d.id&&(byId('devices',x.from)||{}).type==='board');
  if(r)return r.from;const bs=hwList('board');if(bs.length===1)return bs[0].id;
  let best=null,bd=1e18;bs.forEach(b=>{const dd=Math.hypot(b.x-d.x,b.y-d.y)+(b.level===d.level?0:1e9);if(dd<bd){bd=dd;best=b;}});return best?best.id:null;}
function eloMcbOf(dev,fallback){const c=dev&&typeof cktOfDevice==='function'?cktOfDevice(dev):null;return (c&&c.mcb&&c.mcb.curve)?mcbText(c.mcb):fallback;}
function eloLoadKw(d){const v=d.var||'',txt=needFold([d.name,d.lampName,d.note,d.ref].filter(Boolean).join(' '));
  if(v==='hob2l'||v==='hob32')return ELO_RULES.kw[v];
  if(v==='alelo')return (d.feeds&&typeof alsFloorKw==='function'&&byId('devices',d.feeds)?+(alsFloorKw(d.feeds)*ALS_DIVERSITY).toFixed(2):0)||ELO_RULES.kw.alelo;   // E6: the floor's load
  if(epCodeOf(d)==='AVP')return ELO_RULES.kw.avp;
  const hit=ELO_KW_WORDS.find(w=>w[0].test(txt));return hit?ELO_RULES.kw[hit[1]]:ELO_RULES.kw.g16;}
// → [{key, label, kind, mcb, kw, phases:1|2, feeds:[ids]}] — one entry per way (a 2L+2N hob on 3 phases = two ways)
function eloWays(boardId,opt){opt=eloOpt(opt);const F=eloFeeds(boardId),S=stkActive(),R=ELO_RULES,ways=[];
  const add=(key,label,kind,mcb,kw,feeds)=>ways.push({key,label,kind,mcb,kw,feeds:feeds||[]});
  if(F.base.length)for(let i=1;i<=R.sys.base;i++)add('sys:base:'+i,'BASE '+i,'sys',R.mcb.sys,R.kw.sys,F.base.map(d=>d.id));
  F.ssc.forEach(s=>{for(let i=1;i<=R.sys.ssc;i++)add('sys:ssc:'+s.id+':'+i,(s.ref||'SSC')+' '+i,'sys',R.mcb.sys,R.kw.sys,[s.id]);});
  const busB=S&&stkLayer(S.id,'sys:BUSB')&&data.devices.some(d=>d.layer===stkLayer(S.id,'sys:BUSB').id);
  const packBoard=(()=>{const bs=hwList('board');const fb=bs.find(b=>eloFeeds(b.id).base.length);return (fb||bs[0]||{}).id;})();
  if(busB&&packBoard===boardId)for(let i=1;i<=R.sys.pack;i++)add('sys:pack:'+i,'B busz akku','sys',R.mcb.sys,R.kw.sys,[]);
  F.rbx.forEach(x=>{for(let i=1;i<=R.lightPerRbx;i++)add('light:'+x.id+':'+i,(x.ref||x.id)+' világítás','light',R.mcb.lighting,R.kw.light,[x.id]);});
  const seen=new Set();
  F.rbx.forEach(x=>{(S?afillRbxCircuits(x,S):[]).forEach(c=>{if(seen.has(c.key))return;seen.add(c.key);
    const real=typeof cktById==='function'?cktById(c.key):null,members=real?real.members:[];
    const kitchen=hwServes(x).some(r=>{const e=mrkRoomById(r);return e&&needKind(e.rm)==='konyha'&&(!real||members.some(m=>{const d=byId('devices',m);return d&&epRoomOf(d)===r;}));});
    add('socket:'+c.key,c.name||'dugalj','socket',(real&&real.mcb&&real.mcb.curve)?mcbText(real.mcb):(c.cable==='NYM3x25'?R.mcb.socket25:R.mcb.socket15),
      kitchen?R.kw.socketKitchen:R.kw.socket,members);});});
  // the workflow's own circuits (E4, classic — not through an RBX): one way each, on the board of their level (WP-E6)
  (typeof cktList==='function'?cktList():[]).forEach(c=>{if(seen.has(c.id))return;const ms=(c.members||[]).map(id=>byId('devices',id)).filter(Boolean);
    if(!ms.length||ms.some(d=>{const k=epCodeOf(d);return k==='DED'||k==='AVP';}))return;
    if((c.board||eloLoadBoard(ms[0]))!==boardId)return;
    const light=ms.every(d=>{const k=epCodeOf(d);return k==='LMP'||k==='SWI'||k==='SHU';}),kitchen=ms.some(d=>{const e=roomOfDevice(d);return e&&e.rm&&needKind(e.rm)==='konyha';});
    const kw=light?ms.reduce((a,d)=>a+({LMP:0.06,SHU:0.15}[epCodeOf(d)]||0),0):(kitchen?R.kw.socketKitchen:R.kw.socket);
    add('ckt:'+c.id,(c.ref||'')+' '+(c.name||''),light?'light':'socket',(c.mcb&&c.mcb.curve)?mcbText(c.mcb):(light?R.mcb.lighting:R.mcb.socket25),+kw.toFixed(2),ms.map(d=>d.id));});
  data.devices.forEach(d=>{const c=d&&epCodeOf(d);if(c!=='DED'&&c!=='AVP')return;if(eloLoadBoard(d)!==boardId)return;
    const v=d.var||'',kw=eloLoadKw(d),lbl=(d.ref||d.id)+' — '+((epVar(d)||{}).n||'').split(' — ')[0];
    // C7: a cinema AV circuit (08r d.cin) — its own group: one phase, one busbar, its own type A RCD (guide §7.2 / §7.3)
    if(d.cin&&d.cin.av){const w={key:'av:'+d.id,label:(d.ref||d.id)+' — '+(d.name||d.cin.av),kind:'av',mcb:'1'+(d.cin.curve||'B')+' 16A',kw:(R.kw.av||{})[d.cin.av]||0.3,feeds:[d.id],group:d.cin.phaseGroup||'AV'};ways.push(w);return;}
    if(v==='hob2l'&&opt.phase==='3f'){for(let i=1;i<=2;i++)add('load:'+d.id+':'+i,lbl+' ('+i+'/2)','load',eloMcbOf(d,R.mcb.hob2l),kw/2,[d.id]);}
    else add('load:'+d.id,lbl,'load',eloMcbOf(d,c==='AVP'?R.mcb.avp:(R.mcb[v]||R.mcb.g16)),kw,[d.id]);});
  return ways;}
function eloDevice(mcb,perWay){const m=mcbParse(mcb);if(!m||!m.curve)return mcb;
  return perWay==='rcbo'?'RCBO '+(m.poles+(m.n?'P+N':'P'))+' '+m.curve+m.amps+' '+ELO_RULES.rcbo.ma+' mA '+ELO_RULES.rcbo.type:'MCB '+mcbText(m);}
// greedy: largest load first onto the least loaded phase; the two halves of a hob onto two different phases
function eloBalance(ways){const ph={L1:0,L2:0,L3:0},keys=['L1','L2','L3'];const pick=ex=>keys.filter(k=>k!==ex).sort((a,b)=>ph[a]-ph[b]||(a<b?-1:1))[0];
  // C7: the ways of a phase group (the cinema's AV circuits) go on ONE phase, placed as their summed load
  const gkw={},gph={};ways.forEach(w=>{if(w.group)gkw[w.group]=(gkw[w.group]||0)+w.kw;});const kwOf=w=>w.group?gkw[w.group]:w.kw;
  const order=ways.slice().sort((a,b)=>kwOf(b)-kwOf(a)||((a.group||'')<(b.group||'')?-1:(a.group||'')>(b.group||'')?1:0)||(a.key<b.key?-1:1));const hob={};
  order.forEach(w=>{if(w.group){if(!gph[w.group])gph[w.group]=pick(null);w.phase=gph[w.group];ph[w.phase]+=w.kw;return;}const base=w.key.replace(/:\d$/,'');let p;if(/^load:.*:[12]$/.test(w.key)&&hob[base])p=pick(hob[base]);else p=pick(null);
    if(/^load:.*:[12]$/.test(w.key))hob[base]=hob[base]||p;w.phase=p;ph[p]+=w.kw;});
  return ph;}
// the schedule: plain JSON
// E6-Q3 (the user): one main switch, in the main Elosztó; every Alosztó feeder leaves its cabinet through its own RCD —
// the floor's RCD — so an Alosztó has no main switch and its ways are plain MCBs.
function eloIsFeeder(w){return (w.feeds||[]).some(id=>{const d=byId('devices',id);return d&&d.var==='alelo';});}
function eloFeederDevice(mcb){const m=mcbParse(mcb);if(!m||!m.curve)return mcb;const p=m.poles>=3?'4P':'2P',a=[25,40,63].find(x=>x>=m.amps)||63;
  return {n:'RCD '+p+' '+a+'A '+ELO_RULES.rcd.ma+' mA '+ELO_RULES.rcd.type+' + MCB '+mcbText(m),mod:(m.poles>=3?4:2)+mcbModules(m)};}
function eloSchedule(boardId,o){const opt=eloOpt(o),R=ELO_RULES,b=byId('devices',boardId);
  if(b&&b.sub)opt.perWay='mcb';                       // E6-Q3: the floor is protected by its feeder's RCD upstream
  const ways=eloWays(boardId,opt).map(w=>{const f=eloIsFeeder(w)?eloFeederDevice(w.mcb):null;
    return Object.assign({},w,{device:f?f.n:eloDevice(w.mcb,opt.perWay),feeder:!!f,
    mod:f?f.mod:opt.perWay==='rcbo'?R.rcbo.mod:mcbModules(mcbParse(w.mcb))||1,phase:null});});
  const sub=!!(b&&b.sub);   // WP-E6: an Alosztó — no main switch (Q3), a type-2 SPD only, no bell
  const feed=sub?[{n:'Túlfeszültség-védelem '+(opt.phase==='3f'?'3P+N':'1P+N')+' (T2)',mod:opt.phase==='3f'?4:2}]
    :R.feed[opt.phase].map(f=>({n:f.n,mod:f.mod}));if(R.bell.on&&!sub)feed.push({n:R.bell.n,mod:R.bell.mod});
  const rcd=[],grp=ways.filter(w=>!w.feeder&&!w.group);if(opt.perWay==='rcd'){for(let i=0;i<grp.length;i+=R.rcd.maxWays)rcd.push({n:'RCD '+R.rcd.amps+'A '+R.rcd.ma+' mA '+R.rcd.type,mod:R.rcd.mod,ways:grp.slice(i,i+R.rcd.maxWays).map(w=>w.key)});
    // C7: a phase group (AV) never shares its RCD with the rest of the dwelling (guide §7.3)
    [...new Set(ways.filter(w=>w.group).map(w=>w.group))].forEach(g=>{const gw=ways.filter(w=>w.group===g);for(let i=0;i<gw.length;i+=R.rcd.maxWays)rcd.push({n:'RCD '+R.rcd.amps+'A '+R.rcd.ma+' mA '+R.rcd.type+' ('+g+')',mod:R.rcd.mod,group:g,ways:gw.slice(i,i+R.rcd.maxWays).map(w=>w.key)});});}
  const totalMod=feed.reduce((s,f)=>s+f.mod,0)+ways.reduce((s,w)=>s+w.mod,0)+rcd.reduce((s,r)=>s+r.mod,0);
  const rows=Math.max(1,Math.ceil(totalMod/R.rowModules)),free=rows*R.rowModules-totalMod,warnings=[];
  let phases=null;
  if(opt.phase==='3f'){phases=eloBalance(ways);const v=Object.values(phases),mx=Math.max(...v),mn=Math.min(...v);
    Object.keys(phases).forEach(k=>{phases[k]=Math.round(phases[k]*100)/100;});
    if(mn>0&&mx/mn>1.5)warnings.push({sev:'warn',code:'elo.phase',msg:'Fázisaszimmetria: '+Object.keys(phases).map(k=>k+' '+phases[k]+' kW').join(' · ')});}
  if(ways.some(w=>w.kind==='av'))warnings.push({sev:'info',code:'elo.av',msg:'AV körök (házimozi): mind ugyanarról a fázisról és gyűjtősínről'+(phases?' ('+ways.find(w=>w.kind==='av').phase+')':'')+', saját A típusú 30 mA védelemmel'+(opt.perWay==='rcd'?' (külön ÁVK)':' (RCBO körönként)')+' — írd rá a kiosztásra, mert különben önkényesnek tűnik (§7.2).'});
  if(free<R.spareMin)warnings.push({sev:'warn',code:'elo.spare',msg:'Csak '+free+' szabad modul — következő sor / nagyobb szekrény.'});
  return {board:boardId,ref:b?(b.ref||b.id):boardId,phase:opt.phase,perWay:opt.perWay,feed,ways,rcd,totalMod,rows,free,phases,warnings};}

// ---- checks ---------------------------------------------------------------------------------------------------------------
// M1: about ways and modules — one registration (on the dedicated layer) is enough for the three Erősáram roles
(STK_CHECKS['sys:DED']=STK_CHECKS['sys:DED']||[]).push(S=>{const out=[];
  hwList('rbx').forEach(x=>hwServes(x).forEach(r=>{const e=mrkRoomById(r);if(!e||needKind(e.rm)!=='konyha')return;
    const n=epCircuits(r,S.id).filter(c=>c.members.some(id=>epCodeOf(byId('devices',id))==='SOC')).length;
    if(n&&n<ELO_RULES.socketKitchen)out.push({sev:'info',msg:hwRoomLabel(r)+': '+n+' dugaljkör — S04 szerint a konyhába '+ELO_RULES.socketKitchen+' javasolt (pult A, B + sziget).'});}));
  if(afillRuns().length)data.devices.forEach(d=>{const c=epCodeOf(d);if(c!=='DED'&&c!=='AVP')return;
    if(d.cin&&d.cin.av&&data.paths.some(p=>p&&p.cin&&p.cin.kind==='feed'&&p.layer===d.cin.of))return;   // C7: on the cinema's own feed
    if(!afillRuns().some(r=>r.stage==='stack'&&r.to===d.id&&(byId('devices',r.from)||{}).type==='board'))out.push({sev:'warn',msg:(d.ref||d.id)+': nincs útvonal az Elosztószekrénytől.'});});
  return out;});

// ---- UI and export ----------------------------------------------------------------------------------------------------------
function eloDialog(boardId){const bs=hwList('board');if(!bs.length){lyrHud('Nincs Elosztószekrény.');return;}
  boardId=boardId||bs[0].id;const opt=eloOpt();const S=eloSchedule(boardId,opt);
  const kinds={sys:'Rendszer',light:'RBX világítás',socket:'RBX dugaljkörök',load:'Nagy fogyasztók',av:'AV körök (házimozi — egy fázis, saját ÁVK)'};
  openModal('Elosztószekrény összeállítás — '+S.ref,
    `<div class="mrow">Szekrény <select id="eloB">${bs.map(b=>`<option value="${b.id}" ${b.id===boardId?'selected':''}>${esc(b.ref||b.id)}</option>`).join('')}</select>`
    +` Betáp <select id="eloP"><option value="1f" ${opt.phase==='1f'?'selected':''}>1 fázis</option><option value="3f" ${opt.phase==='3f'?'selected':''}>3 fázis</option></select>`
    +` Védelem <select id="eloW"><option value="rcbo" ${opt.perWay==='rcbo'?'selected':''}>RCBO soronként</option><option value="rcd" ${opt.perWay==='rcd'?'selected':''}>RCD csoportok</option></select></div>`
    +`<div style="max-height:380px;overflow:auto"><table style="font-size:11.5px;width:100%"><tr><th align="left">Áramkör</th><th>Kismegsz.</th><th align="left">Eszköz</th><th>Mod.</th><th>Fázis</th><th>kW</th></tr>`
    +S.feed.map(f=>`<tr style="color:#555"><td>${esc(f.n)}</td><td></td><td></td><td align="center">${f.mod}</td><td></td><td></td></tr>`).join('')
    +Object.keys(kinds).map(k=>{const ws=S.ways.filter(w=>w.kind===k);if(!ws.length)return '';
      return `<tr><td colspan="6"><b>${kinds[k]}</b> (${ws.length})</td></tr>`+ws.map(w=>`<tr><td>${esc(w.label)}</td><td align="center">${esc(w.mcb)}</td><td>${esc(w.device)}</td><td align="center">${w.mod}</td><td align="center">${w.phase||''}</td><td align="center">${w.kw}</td></tr>`).join('');}).join('')
    +S.rcd.map(r=>`<tr style="color:#555"><td>${esc(r.n)}</td><td></td><td>${r.ways.length} kör</td><td align="center">${r.mod}</td><td></td><td></td></tr>`).join('')
    +`</table></div><div class="mrow"><b>${S.totalMod} / ${S.rows*ELO_RULES.rowModules} modul · ${S.rows} sor · ${S.free} szabad</b>`
    +(S.phases?' · '+Object.keys(S.phases).map(k=>k+' '+S.phases[k]+' kW').join(' · '):'')+`</div>`
    +S.warnings.map(x=>`<div style="color:#b05a00">${esc(x.msg)}</div>`).join('')
    +`<div class="mrow" style="font-size:11px;color:#888">Névleges értékek és terhelések tipikusak — egy áramkör saját kismegszakítója mindig felülírja.</div>`,()=>{},'Bezár');
  const re=()=>{state.elo={phase:$('eloP').value,perWay:$('eloW').value};closeModal();eloDialog($('eloB').value);};
  $('eloB').onchange=re;$('eloP').onchange=re;$('eloW').onchange=re;}
function eloExportObj(boardId){const bs=hwList('board');boardId=boardId||(bs[0]&&bs[0].id);
  return {format:'vrg-cabinet',v:1,project:(state.bp&&state.bp.proj)||'',schedule:boardId?eloSchedule(boardId):null,
    circuits:(typeof cktExportObj==='function')?cktExportObj():null};}

registerActions([
 {id:'elo.schedule',alias:'elosztoszekreny osszeallitas cabinet schedule rcbo modules',label:'Elosztószekrény összeállítás…',icon:'▤',group:'Feltöltés',
  hint:'Áramkörök (rendszer, RBX világítás és dugalj, nagy fogyasztók), RCBO / RCD, túlfeszültség-védelem, modulszám, fázisok.',
  need:'Legalább egy Elosztószekrény kell.',when:c=>hwList('board').length>0,run:()=>eloDialog()},
 {id:'elo.export',alias:'eloszto export json vrg-cabinet din',label:'Elosztó exportálása (JSON)',icon:'⬇',group:'Feltöltés',
  need:'Legalább egy Elosztószekrény kell.',when:c=>hwList('board').length>0,run:()=>download('vrg-cabinet.json',JSON.stringify(eloExportObj(),null,1))}
]);
MNS_ROLES.forEach(r=>(STK_GROUPS['+'+r]=STK_GROUPS['+'+r]||[]).push('Feltöltés'));

// test hooks
window.ELO_RULES=ELO_RULES;window.eloFeeds=eloFeeds;window.eloWays=eloWays;window.eloSchedule=eloSchedule;window.eloBalance=eloBalance;
window.eloExportObj=eloExportObj;window.eloLoadBoard=eloLoadBoard;window.eloDialog=eloDialog;
