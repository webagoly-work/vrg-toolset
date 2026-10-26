// spec-109 — round 2026-10-22, Villany Stack: stack kinds (V1), wizard + workflow bar (V2), Meglévő / bontás (V3),
// Gyengeáram (V4), EPH · Riasztó · Tűzvédelem · Okos előkészítés (V5, Q-V08–Q-V10), the route layer (V6), promotion (V8);
// 2026-10-26: V7 stage, Meglévő paths + legend, IP44 outdoors, the fire-resistant switch, Veszélyérzékelők, switch-sensors
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const LY=()=>w.eval('layers'),ST=()=>w.eval('stacks'),D=()=>w.__data,J=o=>JSON.stringify(o);
  const fresh=()=>{w.newBlankProject();w.eval('stacks=[]');w.__state.stkOff=false;w.__state.stack=null;w.__state.stage='build';w.__state.active=lvl;};
  const roles=S=>w.stkLayersOf(S.id).map(l=>l.role);
  const room=(name,kinds,poly)=>{const i=w.wfpMakeRoom(poly,lvl);const f=D().floors[i];f.name=name;f.kinds=kinds;f.kind=kinds[0];return f;};
  const at=(x,y)=>({level:lvl,x,y,h:300,mount:'ceiling'});
  const onLayer=(d,S,role)=>d.layer===w.stkLayer(S.id,role).id;

  // 1 — kinds and role sets (V1)
  const E=w.stkRolesOf('elec').map(r=>r.k),B=w.stkRolesOf('bridge').map(r=>r.k);
  ok('elec roles: construct, mark, need, exist, hw, the three mains, Gyengeáram, EPH, Veszélyérzékelők, Riasztó, Tűzvédelem, Nyomvonal, Okos előkészítés, Házimozi',
    J(E)===J(['construct','mark','need','exist','hw','sys:DED','sys:SOC','sys:LIGHT','sys:WEAK','sys:BOND','sys:HAZARD','sys:ALARM','sys:FIRE','route','sys:SMARTREADY','sys:CINEMA'].sort((a,b)=>E.indexOf(a)-E.indexOf(b)))&&E.length===16,J(E));
  ok('elec has no BRIDGE-only role (BASE, Csatorna, buses, RBX world, ARM)',!['base','channel','sys:LV','sys:DATA','sys:SECURITY','cluster','arm','sys:EXTRA'].some(k=>E.indexOf(k)>=0));
  ok('BRIDGE keeps Meglévő, EPH, Veszélyérzékelők, Tűzvédelem, Okos előkészítés (Q-V03 A) and never gets Gyengeáram, Riasztó, Nyomvonal',
    ['exist','sys:BOND','sys:HAZARD','sys:FIRE','sys:SMARTREADY'].every(k=>B.indexOf(k)>=0)&&!['sys:WEAK','sys:ALARM','route'].some(k=>B.indexOf(k)>=0));
  ok('hw reads "Betáplálás és elosztás" in a Villany Stack, "Hardver" in BRIDGE (Q-V02 A)',w.stkRoleName('hw','elec')==='Betáplálás és elosztás'&&w.stkRoleName('hw','bridge')==='Hardver');

  // 2 — stkCreate per kind
  fresh();const S0=w.stkCreate({name:'X'});
  ok('stkCreate without kind is still BRIDGE (B1, no Meglévő by default)',S0.kind==='bridge'&&w.stkShort(S0)==='B1'&&roles(S0).indexOf('exist')<0);
  fresh();const V=w.stkCreate({kind:'elec'});
  ok('an elec stack: kind elec, short V1, default name "Villany Stack 1"',V.kind==='elec'&&w.stkShort(V)==='V1'&&V.name==='Villany Stack 1');
  ok('default elec layers: Szerkezet, Jelölés, Meglévő, Betáplálás, the three mains, Gyengeáram, Veszélyérzékelők, Nyomvonal (D3)',
    J(roles(V))===J(['construct','mark','exist','hw','sys:DED','sys:SOC','sys:LIGHT','sys:WEAK','sys:HAZARD','route']),J(roles(V)));
  ok('layer names carry the V prefix and the elec name',w.stkLayer(V.id,'hw').name==='V1 · Betáplálás és elosztás');
  ok('a BRIDGE-only role asked for in an elec stack is not made',(()=>{fresh();const s=w.stkCreate({kind:'elec',roles:['sys:SOC','sys:LV','sys:BOND']});return J(roles(s).filter(r=>r.indexOf('sys:')===0))===J(['sys:SOC','sys:BOND']);})());

  // 3 — the wizard and the workflow bar (V2)
  fresh();w.actionById('stack.create').run({});
  ok('the wizard opens on Villany with its own phase-2 list',w.document.querySelector('input[name=skKind][value=elec]').checked&&w.document.querySelectorAll('.skR').length===11
    &&!!w.document.querySelector('.skR[value="sys:WEAK"]')&&!w.document.querySelector('.skR[value="sys:LV"]'));
  {const r=w.document.querySelector('input[name=skKind][value=bridge]');r.checked=true;r.dispatchEvent(new w.Event('change',{bubbles:true}));}
  ok('switching to BRIDGE re-renders the list and the default name',!!w.document.querySelector('.skR[value="sys:LV"]')&&!w.document.querySelector('.skR[value="sys:WEAK"]')&&$('skName').value==='BRIDGE Stack 1');
  w.closeModal();
  fresh();room('NAPPALI',['nappali'],[[0,0],[4000,0],[4000,3000],[0,3000]]);const WS=w.wfStack();
  ok('the workflow bar makes a Villany Stack',WS.kind==='elec'&&w.stkKindOf(WS)==='elec');

  // 4 — catalogue: alt roles (V4, Q-V08) and the new codes
  ok('Gyengeáram offers ETH, SCR, AVP, TVA, DBL, BEL, ICM',J(w.epOfRole('sys:WEAK').map(e=>e.code).sort())===J(['AVP','BEL','DBL','ETH','ICM','SCR','TVA']));
  ok('Riasztó offers the wired intrusion codes',J(w.epOfRole('sys:ALARM').map(e=>e.code).sort())===J(['DWC','GLB','KPD','MOT','PNC','SRN']));
  ok('Tűzvédelem: SMK, HDT, MCP, SND on red J-Y(St)Y in family FIRE',J(w.epOfRole('sys:FIRE').map(e=>e.code).sort())===J(['HDT','MCP','SMK','SND'])
    &&w.epOfRole('sys:FIRE').every(e=>e.vars[0].cab[0].c==='JYFIRE')&&w.stkRole('sys:FIRE').fam==='FIRE');
  ok('EPH: EPB, PEB · Okos előkészítés: NUT, DPB, RSV',J(w.epOfRole('sys:BOND').map(e=>e.code))===J(['EPB','PEB'])&&J(w.epOfRole('sys:SMARTREADY').map(e=>e.code))===J(['NUT','DPB','RSV']));
  ok('fire never shares a conduit (warn with every other class)',['mains','selvp','sig','sec'].every(c=>w.eval('AFILL_SHARE')[[c,'fire'].sort().join('|')]==='warn'));

  // 5 — placement on the elec layers
  fresh();const fu=room('FÜRDŐ',['furdo'],[[0,0],[2000,0],[2000,2000],[0,2000]]),na=room('NAPPALI',['nappali'],[[2200,0],[6000,0],[6000,3000],[2200,3000]]);
  const S=w.stkCreate({kind:'elec',roles:['sys:DED','sys:SOC','sys:LIGHT','sys:WEAK','sys:BOND','sys:ALARM','sys:FIRE','route','sys:SMARTREADY']});
  const eth=w.epPlace(at(3000,500),'ETH','sys:WEAK','1'),tva=w.epPlace(at(3200,500),'TVA','sys:WEAK','coax'),bel=w.epPlace(at(3400,500),'BEL','sys:WEAK','2');
  ok('a Gyengeáram endpoint lands on Gyengeáram and draws in its blue',onLayer(eth,S,'sys:WEAK')&&onLayer(tva,S,'sys:WEAK')&&w.epRoleOf(eth)==='sys:WEAK'&&w.stkRoleCol(w.epRoleOf(eth))==='#1e9bff');
  ok('its cable family is still its purpose (ETH → DATA, TVA → MEDIA, BEL → SECURITY)',w.epCables(eth)[0].fam==='DATA'&&w.epCables(tva)[0].fam==='MEDIA'&&w.epCables(bel)[0].fam==='SECURITY');
  w.epToolStart('ETH','sys:WEAK');ok('the endpoint tool keeps the alt layer it was started on',w.eval('EP_T').role==='sys:WEAK');w.epToolOff();
  const mot=w.epPlace(at(3600,500),'MOT','sys:ALARM','pir'),smk=w.epPlace(at(3800,500),'SMK','sys:FIRE','loop');
  ok('Riasztó and Tűzvédelem points land on their layers; a fire SMK is the FIRE entry',onLayer(mot,S,'sys:ALARM')&&onLayer(smk,S,'sys:FIRE')&&w.epEntryOf(smk).role==='sys:FIRE');
  const chk=role=>w.stkCheck(S,role).map(x=>x.msg).join(' | ');
  ok('each system asks for its own Elosztó (MDB, SSC, TJK)',/médiadoboz/.test(chk('sys:WEAK'))&&/riasztóközpont/.test(chk('sys:ALARM'))&&/tűzjelző központ/.test(chk('sys:FIRE')));
  ok('a bathroom without EPB is reported on EPH',/FÜRDŐ: fürdő EPH-bekötés/.test(chk('sys:BOND')));
  const epb=w.epPlace(at(500,500),'EPB','sys:BOND','h4');
  ['mdb','ssc','fire','eph'].forEach((t,i)=>{D().devices.push({type:t,level:lvl,x:2300+i*200,y:2900,h:1500,layer:w.stkLayer(S.id,'hw').id});});w.ensureIds(D());
  ok('with EPB and the four hubs placed the checks go quiet',!/EPH-bekötés/.test(chk('sys:BOND'))&&!/médiadoboz|riasztóközpont|tűzjelző központ|fő EPH sín/.test([chk('sys:WEAK'),chk('sys:ALARM'),chk('sys:FIRE'),chk('sys:BOND')].join()));
  ok('the new hubs get refs MDB · SSC · TJK · EPH',J(['mdb','ssc','fire','eph'].map(t=>w.hwRef(w.hwList(t)[0])))===J(['MDB','SSC','TJK','EPH']));

  // 6 — Meglévő / bontás (V3)
  const EX=w.stkLayer(S.id,'exist').id,mkEx=(type,x,ex)=>{const d={type,level:lvl,x,y:1500,h:300,layer:EX};if(ex)d.ex=ex;D().devices.push(d);w.ensureIds(D());return d;};
  const k1=mkEx('socket',2500),r1=mkEx('socket',2700,'remove'),p1=mkEx('light',2900,'replace');
  ok('an existing item defaults to keep; remove / replace are read from d.ex',w.vstExistOf(k1)==='keep'&&w.vstExistOf(r1)==='remove'&&w.vstExistOf(p1)==='replace'&&w.vstExistOf(eth)===null);
  w.draw();const sc=w.document.querySelector('#lyScene').innerHTML;
  ok('the scene marks them: grey ring, red cross, orange square',/vstEx-keep/.test(sc)&&/vstEx-remove/.test(sc)&&/vstEx-replace/.test(sc));
  const bom=w.computeBOM(),nm=bom.map(r=>r.name);
  ok('BOM: Bontás for remove + replace, Ellenőrzés for keep, and no device material for them',nm.some(n=>/^Bontás – .*Dugalj/.test(n))&&nm.some(n=>/^Bontás – Lámpa/.test(n))&&nm.some(n=>/^Ellenőrzés – meglévő/.test(n))
    &&!(bom.find(r=>r.id==='dev_socket')||{qty:0}).qty&&!(bom.find(r=>r.id==='dev_light')||{qty:0}).qty,J(nm));
  ok('alarm and fire points are cable work only in the BOM',nm.some(n=>/^Riasztó pont/.test(n))&&nm.some(n=>/^Tűzjelző pont/.test(n)));
  ok('a replace with no new item nearby is an info',/cserélendő, de nincs új/.test(w.stkCheck(S,'exist').map(x=>x.msg).join()));
  w.vstSetEx(k1,'remove');ok('vstSetEx sets the state (keep clears the field)',k1.ex==='remove'&&(w.vstSetEx(k1,'keep'),!('ex' in k1)));

  // 7 — the route layer stands in for channel / arm (V6)
  ok('vstPathLayer: channel and arm resolve to Nyomvonal in a Villany Stack',w.vstPathLayer(S,'channel')===w.stkLayer(S.id,'route')&&w.vstPathLayer(S,'arm')===w.stkLayer(S.id,'route'));
  ok('the engine writes its conduits to Nyomvonal (blTargetLayers)',(()=>{const t=w.blTargetLayers(lvl);return t.ch===w.stkLayer(S.id,'route').id&&t.arm===t.ch;})());

  // 8 — promotion (V8)
  const before=J({layers:LY(),stacks:ST(),devices:D().devices}),ids=D().devices.map(d=>d.id).join();
  w.__state.stack=S.id;w.__state.activeLayer=w.stkLayer(S.id,'sys:SOC').id;
  ok('the action is offered on an active Villany Stack',w.actionById('stack.promote').when({})===true);
  const rep=w.vstPromote(S.id);
  ok('the stack is BRIDGE now, B-named',S.kind==='bridge'&&w.stkShort(S)==='B1'&&w.stkLayer(S.id,'hw').name==='B1 · Hardver');
  ok('Gyengeáram items moved to their purpose layers (ETH → Adat, TVA → Média, BEL → Biztonság)',onLayer(eth,S,'sys:DATA')&&onLayer(tva,S,'sys:MEDIA')&&onLayer(bel,S,'sys:SECURITY'));
  ok('Riasztó items moved to Biztonságtechnika, still cable only',onLayer(mot,S,'sys:SECURITY')&&mot.cableOnly===true&&w.vstCableOnly(mot));
  ok('Gyengeáram, Riasztó and the empty Nyomvonal are gone; nothing duplicated',!w.stkLayer(S.id,'sys:WEAK')&&!w.stkLayer(S.id,'sys:ALARM')&&!w.stkLayer(S.id,'route')
    &&new Set(roles(S)).size===roles(S).length&&J(rep.removed.sort())===J(['route','sys:ALARM','sys:WEAK']));
  ok('EPH, Tűzvédelem, Okos előkészítés, Meglévő and their items stay',['sys:BOND','sys:FIRE','sys:SMARTREADY','exist'].every(k=>w.stkLayer(S.id,k))&&onLayer(smk,S,'sys:FIRE')&&onLayer(epb,S,'sys:BOND')&&r1.layer===EX);
  ok('the BRIDGE phase-1 and default phase-2 layers were added',['base','channel','sys:LV','sys:BUSB','sys:CONTROL','sys:SENSOR','sys:RF','sys:HMI','sys:USB','cluster','arm','sys:EXTRA'].every(k=>w.stkLayer(S.id,k)));
  ok('device ids are unchanged',D().devices.map(d=>d.id).join()===ids);
  w.eval('doUndo()');
  const S2=ST()[0];
  ok('one Ctrl+Z restores the Villany Stack exactly',J({layers:LY(),stacks:ST(),devices:D().devices})===before&&S2.kind==='elec');

  // 9 — 2026-10-26 follow-up
  fresh();const ko=room('KONYHA',['konyha'],[[0,0],[3000,0],[3000,2500],[0,2500]]),er=room('ERKÉLY',['kulter'],[[3200,0],[5000,0],[5000,1500],[3200,1500]]),
    fu2=room('FÜRDŐ',['furdo'],[[0,2700],[2000,2700],[2000,4500],[0,4500]]);
  const V2=w.stkCreate({kind:'elec',roles:['sys:DED','sys:SOC','sys:LIGHT','sys:HAZARD','sys:FIRE','route']});
  ok('Veszélyérzékelők: GAS, WLK, HTA, VLV + COA (alt) on the layer, in both kinds',J(w.epOfRole('sys:HAZARD').map(e=>e.code).sort())===J(['COA','GAS','HTA','VLV','WLK']));
  ok('room kinds name their detectors: konyha GAS · WLK · HTA, fürdő WLK, gépészet (kazánház, pince) GAS · COA · WLK · VLV',
    J(w.needDefaults?1:1)&&J(Object.keys(w.needOf(ko,'sys:HAZARD')).filter(k=>w.needOf(ko,'sys:HAZARD')[k]).sort())===J(['GAS','HTA','WLK'])
    &&J(Object.keys(w.needOf(fu2,'sys:HAZARD')).filter(k=>w.needOf(fu2,'sys:HAZARD')[k]))===J(['WLK'])
    &&J(w.eval("NEED_DEFAULTS.gepeszet['sys:HAZARD']"))===J(['GAS','COA','WLK','VLV']));
  ok('Gyengeáram room needs (V4): nappali TVA · ETH, háló TVA, előszoba BEL · ICM',J(w.eval("[NEED_DEFAULTS.nappali['sys:WEAK'],NEED_DEFAULTS.halo['sys:WEAK'],NEED_DEFAULTS.eloszoba['sys:WEAK']]"))===J([['TVA','ETH'],['TVA'],['BEL','ICM']]));
  const gas=w.epPlace(at(1500,1000),'GAS','sys:HAZARD','fold');ok('a gas detector lands on Veszélyérzékelők',onLayer(gas,V2,'sys:HAZARD'));
  // V7
  const st=w.stkStages(V2),cs=st[st.length-1];
  ok('V7: the Villany Stack ends with the Áramkörök és védelem stage; BRIDGE has none',cs.k==='stk:circuits'&&cs.n==='Áramkörök és védelem'&&!w.stkStages(w.stkCreate({name:'B'})).some(x=>x.k==='stk:circuits'));
  w.__state.stack=V2.id;w.__state.activeLayer=w.stkLayer(V2.id,'sys:SOC').id;
  const so=w.epPlace(at(4000,700),'SOC','sys:SOC','25');
  ok('IP44 by default for a socket placed in a kültér room (D5)',so.ip==='IP44'&&!w.epPlace(at(1000,1000),'SOC','sys:SOC','25').ip);
  ok('V7 check: endpoints in no circuit are listed',/nincs áramkörben/.test(cs.check().map(x=>x.msg).join()));
  const ck=w.cktCreate({name:'Erkély',mcb:{curve:'C',amps:16,poles:1,n:false},members:[]});w.cktAssign(ck,so);
  ok('V7 check: an outdoor circuit gets the 1P+N suggestion, and the action applies it',/1P\+N kismegszakító javasolt/.test(cs.check().map(x=>x.msg).join())&&w.vstOutdoor2P()===1&&w.mcbText(ck.mcb).indexOf('N')>=0&&!/1P\+N kismegszakító javasolt/.test(cs.check().map(x=>x.msg).join()));
  ck.rcd=false;ok('V7 check: a wet / outdoor circuit without 30 mA is an error',cs.check().some(x=>x.sev==='error'&&/30 mA/.test(x.msg)));delete ck.rcd;
  ok('the BOM counts the IP44 points separately',w.computeBOM().some(r=>/^ebből IP44 kivitel/.test(r.name)));
  // Meglévő paths + the legend
  const EX2=w.stkLayer(V2.id,'exist').id;D().paths.push({nodes:[{x:100,y:100,level:lvl,h:2400},{x:2100,y:100,level:lvl,h:2400}],sections:[{build:'sull_gege'}],layer:EX2,ex:'remove'});w.ensureIds(D());w.draw();
  ok('a Meglévő path is drawn in its state (red dashed for remove)',(()=>{const e=w.document.querySelector('#lyScene .vstExPath');return !!e&&/vstEx-remove/.test(e.getAttribute('class'))&&e.getAttribute('stroke-dasharray')==='9 4';})());
  ok('… and gives a Bontás row in metres',(()=>{const r=w.computeBOM().find(x=>x.id==='bont_path');return r&&r.unit==='m'&&Math.abs(r.qty-2)<0.01;})());
  ok('the printed legend lists the Meglévő states on the sheet',/Meglévő — bontandó/.test(w.prnLegendSvg(0,0)));
  // the fire-resistant switch
  const sk=w.epPlace(at(1500,1500),'SMK','sys:FIRE','loop');
  ok('fire cable: red J-Y(St)Y by default, E30 / FE180 once the stack switch is on (Q-V10 A)',w.epCables(sk)[0].c==='JYFIRE'&&w.vstFireResSet(V2.id,true)&&w.epCables(sk)[0].c==='JEHFIRE'&&w.eval('AFILL_CABLES').JEHFIRE);
  // switch-sensors
  const lamp=w.epPlace(at(1000,1800),'LMP','sys:LIGHT','230');
  const pir=w.lswLink([lamp.id],{wall:{level:lvl,x:3000,y:1000,side:0}},true);pir.var='pir';
  w.lswRetypeAll();
  ok('a switch-sensor is its own type and the lamp needs no other switch',pir.swType==='erzekelo'&&w.lswType(pir).k==='erzekelo'&&!w.lswSuggest(lvl).some(r=>r.lamps.some(l=>l===lamp)));
  const sw=w.lswLink([lamp.id],{wall:{level:lvl,x:0,y:1800,side:1}},true);w.lswRetypeAll();
  ok('a normal switch beside it is not a váltó partner (101, not 106)',sw.swType==='101');
  ok('… and the check asks for Kizárás or Szabotázs',/Kizárásra \(KI \/ AUTO\) vagy Szabotázsra \(AUTO \/ BE\)/.test(w.stkCheck(V2,'sys:LIGHT').map(x=>x.msg).join()));
  w.vstSwModeSet(sw,'kizaras');w.draw();
  ok('Kizárás = KI / AUTO, shown beside the switch; Szabotázs = AUTO / BE',w.vstSwMode(sw)==='kizaras'&&/KI\/AUTO/.test(w.document.querySelector('#lyScene').innerHTML)&&w.VST_SWMODE.szabotazs.st==='AUTO / BE'
    &&!/vagy Szabotázsra/.test(w.stkCheck(V2,'sys:LIGHT').map(x=>x.msg).join()));
  ok('the switch-sensor draws with the motion mark',w.icoMarkOf(pir)==='motion');
  ok('promotion keeps Veszélyérzékelők',(()=>{w.vstPromote(V2.id);return !!w.stkLayer(V2.id,'sys:HAZARD')&&onLayer(gas,V2,'sys:HAZARD');})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
