// spec-109 — round 2026-10-22, Villany Stack: stack kinds (V1), wizard + workflow bar (V2), Meglévő / bontás (V3),
// Gyengeáram (V4), EPH · Riasztó · Tűzvédelem · Okos előkészítés (V5, Q-V08–Q-V10), the route layer (V6), promotion (V8)
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
  ok('elec roles: construct, mark, need, exist, hw, the three mains, Gyengeáram, EPH, Riasztó, Tűzvédelem, Nyomvonal, Okos előkészítés, Házimozi',
    J(E)===J(['construct','mark','need','exist','hw','sys:DED','sys:SOC','sys:LIGHT','sys:WEAK','sys:BOND','sys:ALARM','sys:FIRE','route','sys:SMARTREADY','sys:CINEMA'].sort((a,b)=>E.indexOf(a)-E.indexOf(b)))&&E.length===15,J(E));
  ok('elec has no BRIDGE-only role (BASE, Csatorna, buses, RBX world, ARM)',!['base','channel','sys:LV','sys:DATA','sys:SECURITY','cluster','arm','sys:EXTRA'].some(k=>E.indexOf(k)>=0));
  ok('BRIDGE keeps Meglévő, EPH, Tűzvédelem, Okos előkészítés (Q-V03 A) and never gets Gyengeáram, Riasztó, Nyomvonal',
    ['exist','sys:BOND','sys:FIRE','sys:SMARTREADY'].every(k=>B.indexOf(k)>=0)&&!['sys:WEAK','sys:ALARM','route'].some(k=>B.indexOf(k)>=0));
  ok('hw reads "Betáplálás és elosztás" in a Villany Stack, "Hardver" in BRIDGE (Q-V02 A)',w.stkRoleName('hw','elec')==='Betáplálás és elosztás'&&w.stkRoleName('hw','bridge')==='Hardver');

  // 2 — stkCreate per kind
  fresh();const S0=w.stkCreate({name:'X'});
  ok('stkCreate without kind is still BRIDGE (B1, no Meglévő by default)',S0.kind==='bridge'&&w.stkShort(S0)==='B1'&&roles(S0).indexOf('exist')<0);
  fresh();const V=w.stkCreate({kind:'elec'});
  ok('an elec stack: kind elec, short V1, default name "Villany Stack 1"',V.kind==='elec'&&w.stkShort(V)==='V1'&&V.name==='Villany Stack 1');
  ok('default elec layers: Szerkezet, Jelölés, Meglévő, Betáplálás, the three mains, Gyengeáram, Nyomvonal (D3)',
    J(roles(V))===J(['construct','mark','exist','hw','sys:DED','sys:SOC','sys:LIGHT','sys:WEAK','route']),J(roles(V)));
  ok('layer names carry the V prefix and the elec name',w.stkLayer(V.id,'hw').name==='V1 · Betáplálás és elosztás');
  ok('a BRIDGE-only role asked for in an elec stack is not made',(()=>{fresh();const s=w.stkCreate({kind:'elec',roles:['sys:SOC','sys:LV','sys:BOND']});return J(roles(s).filter(r=>r.indexOf('sys:')===0))===J(['sys:SOC','sys:BOND']);})());

  // 3 — the wizard and the workflow bar (V2)
  fresh();w.actionById('stack.create').run({});
  ok('the wizard opens on Villany with its own phase-2 list',w.document.querySelector('input[name=skKind][value=elec]').checked&&w.document.querySelectorAll('.skR').length===10
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
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
