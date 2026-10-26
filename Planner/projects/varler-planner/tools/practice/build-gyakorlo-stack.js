// build-gyakorlo-stack.js — the practice apartment as a fully stacked example, on top of Gyakorlo_lakas.vplan.json
// (walls, openings, the Erősáram points and circuits — build-gyakorlo.js). Two outputs, both STOPPED before any path:
//   Gyakorlo_lakas_villany.vplan.json  every layer of the Villany Stack with a few points each, and each ordinary
//                                      system's own "Elosztó" on Betáplálás és elosztás (MDB · SSC · TJK · EPH · mérő · ISP)
//   Gyakorlo_lakas_bridge.vplan.json   the same stack promoted to BRIDGE in one step (vstPromote): Gyengeáram and Riasztó
//                                      dissolve into Adat / Média / Biztonság, then one example per BRIDGE-only layer —
//                                      RBX, BASE, portals, the buses, Vezérlés, Érzékelők, Kezelőfelületek, Média, USB, Extrák
// Less is more: one to four points per layer, chosen to show the layer, not to finish the job.
// node tools/practice/build-gyakorlo-stack.js [dist.html] [out dir]   (run from Planner/projects/varler-planner)
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const DIST=process.argv[2]||path.join(__dirname,'../../dist/varler_planner.html');
const OUT=process.argv[3]||__dirname;
const BASE=path.join(__dirname,'Gyakorlo_lakas.vplan.json');
const LOG=[];const log=(...a)=>{LOG.push(a.join(' '));};

// ---- the Villany Stack layers: [code, face x, face y, var, note, h?] — (x, y) on a wall face, or [code, x, y, var, note, 'C'] on the ceiling ----
const VILLANY={
 'sys:WEAK':[   // purpose decides: TVA → Média, ETH → Adat, BEL / ICM → Biztonság on promotion
  ['TVA',11400,5600,'coax','TV / SAT — nappali médiafal'],['ETH',11400,5800,'1','Adat — nappali médiafal'],
  ['TVA',0,1500,'coax','TV / SAT — háló'],['ETH',4000,2300,'1','Adat — gyerekszoba íróasztal'],
  ['BEL',6300,7900,'2','Csengőnyomó — kívül, a bejárati ajtó mellett'],['ICM',6600,7600,'2w','Kaputelefon — előszoba']],
 'sys:BOND':[   // MSZ HD 60364-7-701: the bathroom's local bar, its metal parts, the kitchen pipes
  ['PEB',600,4200,'h6','Helyi EPH sín — fürdő'],['EPB',1100,7600,'h4','EPH — kád / zuhanytálca'],['EPB',8300,7600,'h4','EPH — mosogató csövei']],
 'sys:ALARM':[  // cable runs only, panel = the SSC in the gardrób
  ['KPD',7000,7200,'kod','Riasztó kezelő — előszoba'],['DWC',6150,7600,'reed','Nyitásérzékelő — bejárati ajtó'],
  ['MOT',11400,7450,'pir','Mozgásérzékelő — nappali sarok'],['SRN',5000,4200,'bel','Beltéri sziréna — közlekedő']],
 'sys:FIRE':[   // red pairs, own conduit; panel = TJK in the előszoba
  ['SMK',4800,4800,'loop','Füstérzékelő — közlekedő','C'],['SMK',9000,2600,'loop','Füstérzékelő — nappali','C'],
  ['HDT',8000,6200,'loop','Hőérzékelő — konyha','C'],['MCP',7000,6200,'loop','Kézi jelzésadó — előszoba'],['SND',6600,5400,'loop','Hang-fényjelző — közlekedő']],
 'sys:HAZARD':[ // 2026-10-26: the everyday detectors of the rooms that need them (no kazánház / pince in this flat)
  ['GAS',9400,5900,'fold','Gázérzékelő — konyha, magasan (földgáz)',2400],['HTA',8800,6900,'zb','Hőjelző — konyha','C'],
  ['WLK',8150,7600,'w','Vízszivárgás — mosogató alatt',100],['WLK',2600,5000,'w','Vízszivárgás — fürdő padló',100]],
 'sys:SMARTREADY':[
  ['NUT',7200,5250,'n','Nullás doboz — a nappali ajtókapcsoló mögé'],['DPB',4000,3300,'60','Mély doboz — gyerekszoba (redőny modul)'],
  ['RSV',11400,6100,'m20','Tartalék cső — nappali médiafal']]};
// the hubs on Betáplálás és elosztás: [type, face x, face y, note]
const HUBS=[['meter',4500,7900,'Mérőóra — a lépcsőházban, a bejárat mellett'],['entry',4000,7300,'Adatbelépés (ISP) — előszoba'],
 ['mdb',4000,5900,'Gyengeáramú elosztó (médiadoboz) — előszoba, az Elosztó mellett'],['ssc',1300,3700,'Riasztóközpont — gardrób'],
 ['fire',7000,6800,'Tűzjelző központ — előszoba'],['eph',4000,6900,'Fő EPH sín — az Elosztó alatt']];
// Meglévő: what the renovation finds — [type, face x, face y, h, ex, note]
const EXIST=[['socket',0,1200,300,'keep','Régi dugalj — háló Ny (megmarad)'],['light',10450,4350,'C','replace','Régi mennyezeti lámpa — nappali (cserélendő)'],
 ['switch',3700,4200,1100,'remove','Régi kapcsoló — közlekedő (bontandó)'],['socket',7000,4600,300,'remove','Régi dugalj — közlekedő vége (bontandó)']];
// the BRIDGE-only layers after promotion
const BRIDGE={
 'sys:LV':[['LNR',10500,2400,'rov','LED-vonal — nappali rejtett fény','C']],
 'sys:BUSB':[['LMP',4400,4200,'b','Tájékozódó fény — közlekedő']],
 'sys:CONTROL':[['POR',4850,7600,'rs485','Portál vezérlőpont — bejárati ajtó']],
 'sys:DATA':[['ACP',5000,4800,'poe','WiFi AP — közlekedő','C']],
 'sys:SENSOR':[['SEN',9500,3600,'mmwave','Jelenlét (mmWave) — nappali','C']],
 'sys:HMI':[['PAN',7200,3900,'touch','Érintőpanel — nappali'],['THR',3800,3400,'bus','Termosztát — háló']],
 'sys:MEDIA':[['SPK',10500,3200,'17','Hangszóró — nappali','C']],
 'sys:USB':[['USB',4000,2700,'u2','USB — gyerekszoba íróasztal']],
 'sys:EXTRA':[['XPH',3800,2200,null,'Telefontartó töltő — háló, az ágy mellett']]};
// RoomBoxes: [face x, face y, note] — each serves the rooms on both faces of its wall
const RBX=[[7200,2800,'nappali + gyerekszoba'],[2000,4000,'háló + fürdő'],[7000,7000,'előszoba + konyha'],[3300,5400,'közlekedő + WC']];
const BASE_AT=[0,3500,'BASE — gardrób, száraz, az Elosztó 5 m-en belül'];

const dom=new JSDOM(fs.readFileSync(DIST,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});const w=dom.window;
setTimeout(()=>{const rep={};try{
  w.confirm=()=>true;w.alert=()=>{};w.newBlankProject();
  const src=JSON.parse(fs.readFileSync(BASE,'utf8'));w.applyProjectData(w.JSON.parse(JSON.stringify(src.project)));
  const S=w.eval('stacks')[0],St=w.__state,D=()=>w.__data,WALLS=w.eval('WALLS'),LV='ground',LY=()=>w.eval('layers');St.active=LV;
  if(!S||w.stkKindOf(S)!=='elec')throw new Error('the base plan must carry a Villany Stack — rebuild it with build-gyakorlo.js');
  St.stack=S.id;St.stkOff=false;St.activeLayer=w.stkLayer(S.id,'construct').id;
  const faceOf=(x,y)=>{let best=null,bd=6;WALLS[LV].forEach(r=>{const wi=w.wallInfo(r);
    const faces=wi.horiz?[[r.y0,0],[r.y1,1]]:[[r.x0,0],[r.x1,1]];faces.forEach(([f,s])=>{
      const d=wi.horiz?Math.abs(y-f):Math.abs(x-f),inside=wi.horiz?(x>r.x0&&x<r.x1):(y>r.y0&&y<r.y1);if(inside&&d<bd){bd=d;best={r,side:s,along:wi.horiz?x:y};}});});
    if(!best)throw new Error('no wall face at '+x+','+y);return best;};
  const faceG=(x,y,h)=>{const f=faceOf(x,y),wi=w.wallInfo(f.r),ws=f.side?1:-1,o=wi.horiz?wi.seg[0][0]:wi.seg[0][1];
    const p=w.mrkFacePt(f.r,ws,f.along-o,-wi.thick/2);return {level:LV,x:Math.round(p[0]),y:Math.round(p[1]),h,side:f.side,mount:'wall'};};
  const ceilG=(x,y)=>({level:LV,x,y,h:w.epCeilH(LV,x,y),mount:'ceiling'});
  const addRole=k=>{if(w.stkLayer(S.id,k))return w.stkLayer(S.id,k);const L=w.stkMakeLayer(S,w.stkRole(k));LY().push(L);w.stkSync(S);return L;};
  const place=(role,[code,x,y,vk,note,h])=>{const en=w.epEntry(code,role);if(!en)throw new Error('no '+code+' on '+role);
    const g=h==='C'?ceilG(x,y):faceG(x,y,h||en.h||300);const d=w.epPlace(g,code,role,vk||en.vars[0].k);d.note=note;return d;};
  const roomOf=d=>{const e=w.roomOfDevice(d);return e&&e.rm?e.rm.name:'(kívül)';};
  const count=()=>{const o={};w.stkLayersOf(S.id).forEach(L=>{o[L.name]=D().devices.filter(d=>d&&d.layer===L.id).length+D().paths.filter(p=>p&&p.layer===L.id).length;});return o;};

  // ===== A. the Villany Stack, every layer =====
  // Igények: the room lists of the two rooms the job is about
  w.reqLayerAdd();['NAPPALI · ÉTKEZŐ','HÁLÓ'].forEach(n=>{const rm=D().floors.find(f=>f.name===n);w.reqTake(rm);});
  log('Igények: a nappali és a háló igénylistája (a javaslat szerint)');
  ['sys:BOND','sys:ALARM','sys:FIRE','sys:SMARTREADY'].forEach(addRole);
  // the hubs
  HUBS.forEach(([t,x,y,note])=>{const g=Object.assign(faceG(x,y,w.hwDefH(t)),{type:t});const d=w.hwPlace(g);d.note=note;});
  log('Betáplálás és elosztás:',w.hwList().filter(d=>d.layer===w.stkLayer(S.id,'hw').id).map(d=>d.ref).join(' · '));
  // the system layers
  const placedV={};Object.keys(VILLANY).forEach(role=>{placedV[role]=VILLANY[role].map(p=>place(role,p));});
  Object.keys(placedV).forEach(r=>log(w.stkRoleNameIn(r,S)+':',placedV[r].map(d=>d.code+' ('+roomOf(d)+')').join(', ')));
  // Meglévő / bontás
  const EXL=w.stkLayer(S.id,'exist');
  EXIST.forEach(([type,x,y,h,ex,note])=>{const g=h==='C'?ceilG(x,y):faceG(x,y,h);const d={type,level:LV,x:g.x,y:g.y,h:g.h,layer:EXL.id,note};
    if(g.side!=null)d.side=g.side;if(ex!=='keep')d.ex=ex;D().devices.push(d);});
  // an old surface run along the corridor's north wall, to come out (a Meglévő path)
  D().paths.push({nodes:[{x:3700,y:4200,level:LV,h:1100},{x:3700,y:4200,level:LV,h:2400},{x:6900,y:4200,level:LV,h:2400}],sections:[{build:'falon'},{build:'falon'}],layer:EXL.id,ex:'remove',note:'Régi falon kívüli vezeték — közlekedő (bontandó)'});
  w.ensureIds(D());
  log('Meglévő / bontás:',EXIST.map(e=>e[5]).join(' · '),'· + egy régi, falon kívüli nyomvonal (bontandó)');
  // a switch-sensor in the WC: the lamp works on its own; the corridor switch K10 becomes Kizárás (KI / AUTO)
  {const lamp=D().devices.find(d=>w.epCodeOf(d)==='LMP'&&roomOf(d)==='WC'),old=D().devices.find(d=>w.lswSw(d)&&(d.ctl||[]).indexOf(lamp.id)>=0);
    const g=faceG(3800,7200,2200);const sen=w.lswLink([lamp.id],{wall:{level:LV,x:g.x,y:g.y,side:g.side}},true);sen.var='pres';sen.h=2200;sen.note='Kapcsoló-érzékelő — WC (jelenlét)';
    w.cktAssign(w.cktOfDevice(lamp),sen);   // on the WC lamp's own lighting circuit
    w.lswRetypeAll();w.vstSwModeSet(old,'kizaras');log('Kapcsoló-érzékelő: WC',sen.ref,'('+sen.swType+') · a folyosói',old.ref,'kapcsoló:',old.swType,'Kizárás (KI / AUTO)');}
  // D5: outdoor points IP44, the outdoor circuit 1P+N (V7 suggestion, applied here as the example)
  log('IP44:',w.vstIp44Apply(),'kültéri pont · Kültéri körök 1P+N:',w.vstOutdoor2P());
  rep.circuitStage=w.vstCircuitChecks(S).map(c=>c.sev+': '+c.msg);
  rep.villanyChecks=w.stkLayersOf(S.id).map(L=>({layer:L.name,checks:w.stkCheck(S,L.role).filter(c=>c.sev!=='info').map(c=>c.msg)})).filter(x=>x.checks.length);
  rep.villany=count();
  const save=(file,name)=>{w.ensureIds(D());St.active=LV;w.draw();w.eval('B').name=name;const snap=w.projSnapshot(name);
    fs.writeFileSync(path.join(OUT,file),JSON.stringify({format:'varler-planner',version:1,name,saved:new Date().toISOString(),project:snap.data},null,1));};
  save('Gyakorlo_lakas_villany.vplan.json','Gyakorló lakás — Villany Stack, minden réteg (pályák nélkül)');

  // ===== B. promoted to BRIDGE, one example per BRIDGE-only layer =====
  const pr=w.vstPromote(S.id);rep.promote=pr;
  log('Bővítés BRIDGE Stackké:',pr.moved,'elem áthelyezve ·',pr.added.length,'új réteg ·',pr.removed.join(', '),'feloldva');
  // portals: the front door is marked bejárat already; mark two more doors 'portal', then Portálok elhelyezése
  St.activeLayer=w.stkLayer(S.id,'mark').id;
  const door=k=>D().openings.find(o=>o.type==='door'&&Math.abs(o.x-k[0])<5&&Math.abs(o.y-k[1])<5);
  [[7100,4800],[3200,4100]].forEach(p=>w.mrkAdd({kind:'opening',level:LV,op:door(p).id,pol:'none',tags:['portal']}));
  St.activeLayer=w.stkLayer(S.id,'hw').id;
  const npt=w.ptAuto(LV);log('Portálok:',npt,'(bejárati ajtó + nappali + háló ajtó, minden helyiség felőli oldalon)');
  // RoomBoxes and BASE
  w.eval('HW_T').rb='RB-M';
  RBX.forEach(([x,y,note])=>{const d=w.hwPlace(Object.assign(faceG(x,y,w.hwDefH('rbx')),{type:'rbx'}));d.note='RBX — '+note;});
  w.eval('HW_T').units=['NET','COMP','MEDIA'];
  {const d=w.hwPlace(Object.assign(faceG(BASE_AT[0],BASE_AT[1],null),{type:'base'}));d.note=BASE_AT[2];}
  log('RBX:',w.hwList('rbx').map(d=>d.ref+' → '+w.hwServes(d).map(r=>(w.mrkRoomById(r)||{rm:{}}).rm.name).join(' + ')).join(' · '),'· nincs RBX-e:',w.hwUnserved(LV).map(r=>r.name).join(', ')||'—');
  const placedB={};Object.keys(BRIDGE).forEach(role=>{placedB[role]=BRIDGE[role].map(p=>place(role,p));});
  Object.keys(placedB).forEach(r=>log(w.stkRoleNameIn(r,S)+':',placedB[r].map(d=>d.code+' ('+roomOf(d)+')').join(', ')));
  rep.clusters=D().devices.filter(d=>d&&d.type==='cluster').map(d=>d.ref+' '+(d.cls||'')+' @'+roomOf(d));
  log('Klaszterpontok (automatikusan, a végpontok mellett):',rep.clusters.join(', ')||'—');
  rep.bridgeChecks=w.stkLayersOf(S.id).map(L=>({layer:L.name,checks:w.stkCheck(S,L.role).filter(c=>c.sev!=='info').map(c=>c.msg)})).filter(x=>x.checks.length);
  rep.bridge=count();rep.paths=D().paths.length;
  save('Gyakorlo_lakas_bridge.vplan.json','Gyakorló lakás — BRIDGE Stack (a Villany Stack bővítve), minden réteg (pályák nélkül)');
 }catch(e){rep.err=e.stack;}
 rep.log=LOG;fs.writeFileSync(path.join(OUT,'build-report-stack.json'),JSON.stringify(rep,null,1));
 console.log(LOG.join('\n'));if(rep.err)console.log('ERR',rep.err);
 else{console.log('\nVillany:',JSON.stringify(rep.villany));console.log('BRIDGE:',JSON.stringify(rep.bridge),'paths',rep.paths);
   console.log('checks (villany):',JSON.stringify(rep.villanyChecks));console.log('checks (bridge):',JSON.stringify(rep.bridgeChecks));}
 process.exit(0);},1200);
