// build-gyakorlo.js — the practice apartment (Gyakorló lakás): an invented ~77 m² flat that holds one of every wall,
// corner and door situation the wireway engine has to handle, with a minimal stock Erősáram job on it. Built through
// the Planner's own workflow functions in phase order, the same calls the buttons make, and STOPPED before Pályák:
//   1 Alapozás     room outlines (clear sizes) → Falak létrehozása (wfw) → Padló létrehozása; one hand-drawn free-ended wall
//   2 Nyílászárók  doors, windows, a wall opening; the front door marked 'bejarat'
//   3 Szabályok    room kinds (R1) only — Vezethető fal (R2) and the marks (R3) are left for hand work
//   4 Villamosság  endpoints (Standards heights), switching (E1), Elosztó (E3), the Elosztó's circuit suggestion (E4)
// Not invented client data: every name and size here is made up, so the plan may live in git.
// node tools/practice/build-gyakorlo.js [dist.html] [out dir]   (run from Planner/projects/varler-planner)
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
const DIST=process.argv[2]||path.join(__dirname,'../../dist/varler_planner.html');
const OUT=process.argv[3]||__dirname;fs.mkdirSync(OUT,{recursive:true});
const LOG=[];const log=(...a)=>{LOG.push(a.join(' '));};
const HALF_PI=Math.PI/2;

// ---- 1. rooms: CLEAR outlines, already 200 apart (inner walls) — Falak létrehozása fills the gaps, 300 outside ----
// x → east, y → south, mm. The outer clear box is 11 400 × 7 600 with a balcony notch in the north-east corner.
const ROOMS=[
 {name:'HÁLÓ',kinds:['halo'],poly:[[0,0],[3800,0],[3800,4000],[1500,4000],[1500,2500],[0,2500]]},           // L-shape round the gardrób
 {name:'GARDRÓB',kinds:['kamra'],poly:[[0,2700],[1300,2700],[1300,4000],[0,4000]]},                      // room in a room's corner, windowless
 {name:'GYEREKSZOBA',kinds:['halo'],poly:[[4000,0],[7000,0],[7000,4000],[4000,4000]]},
 {name:'NAPPALI · ÉTKEZŐ',kinds:['nappali','etkezo'],                                                       // 8 corners: balcony notch + kitchen notch
  poly:[[7200,0],[9600,0],[9600,1800],[11400,1800],[11400,7600],[9600,7600],[9600,5400],[7200,5400]]},
 {name:'KONYHA',kinds:['konyha'],poly:[[7200,5600],[9400,5600],[9400,7600],[7200,7600]]},
 {name:'FÜRDŐSZOBA',kinds:['furdo'],poly:[[0,4200],[2600,4200],[2600,7600],[0,7600]]},
 {name:'WC',kinds:['wc'],poly:[[2800,5600],[3800,5600],[3800,7600],[2800,7600]]},                        // 1000 wide, windowless
 {name:'KÖZLEKEDŐ',kinds:['kozlekedo'],poly:[[2800,4200],[7000,4200],[7000,5400],[2800,5400]]},             // 1200 wide, doors on every side
 {name:'ELŐSZOBA',kinds:['eloszoba'],poly:[[4000,5600],[7000,5600],[7000,7600],[4000,7600]]}];               // its NE corner = the X junction
// the balcony: added AFTER the walls, so Falak létrehozása does not wall it in (a re-run of it would — see the README)
const BALCONY={name:'ERKÉLY',kinds:['kulter'],poly:[[9900,-300],[11700,-300],[11700,1500],[9900,1500]]};
// a hand-drawn wall the room pen cannot make: the shower partition, fixed to the south wall, its north end free
const FREE_WALLS=[{x0:1400,y0:6400,x1:1500,y1:7600,note:'zuhanyfal — szabad végű'}];

// ---- 2. openings. Door variant: bit1 = hinge at the far jamb (max x / max y), bit0 = the leaf swings to +y / +x ----
const DOORS=[
 {k:'BEJ',x:5500,y:7750,ang:0,dtype:'hinged',w:1000,variant:0,n:'Bejárati ajtó (befelé nyíló, zsanér nyugaton)',bejarat:true},
 {k:'HAL',x:3200,y:4100,ang:0,dtype:'hinged',w:800,variant:0,n:'Háló — a tok a közlekedő végfalához simul'},
 {k:'GYE',x:6400,y:4100,ang:0,dtype:'hinged',w:800,variant:2,n:'Gyerekszoba — 200 mm-re a saroktól'},
 {k:'WC', x:3250,y:5500,ang:0,dtype:'hinged',w:700,variant:0,n:'WC — kifelé nyíló, 150 / 200 mm-es pillérek'},
 {k:'FUR',x:2700,y:4800,ang:HALF_PI,dtype:'hinged',w:800,variant:0,n:'Fürdő — a közlekedő végfalában'},
 {k:'NAP',x:7100,y:4800,ang:HALF_PI,dtype:'hinged',w:800,variant:1,n:'Nappali — a közlekedő másik végfalában'},
 {k:'KON',x:7100,y:6400,ang:HALF_PI,dtype:'pocket',w:800,variant:2,n:'Konyha — falba futó tolóajtó'},
 {k:'GAR',x:1400,y:3350,ang:HALF_PI,dtype:'hinged',w:700,variant:3,n:'Gardrób — a hálóba nyíló'},
 {k:'KOZ',x:5500,y:5500,ang:0,dtype:'double',w:1400,variant:1,n:'Előszoba ↔ közlekedő — kétszárnyú'},
 {k:'NYI',x:8300,y:5500,ang:0,dtype:'opening',w:1600,variant:0,n:'Konyha ↔ nappali falnyílás (tok nélkül)'}];
const WINDOWS=[
 {k:'H1',x:1000,y:-150,ang:0,wtype:'std',n:'Háló É — sarokablak-pár egyik fele'},
 {k:'H2',x:-150,y:1000,ang:HALF_PI,wtype:'std',n:'Háló Ny — sarokablak-pár másik fele'},
 {k:'GY',x:5500,y:-150,ang:0,wtype:'wide',n:'Gyerekszoba É (redőnnyel)'},
 {k:'N1',x:8400,y:-150,ang:0,wtype:'wide',n:'Nappali É — 300 mm-re a lépcsős saroktól'},
 {k:'N2',x:11550,y:3600,ang:HALF_PI,wtype:'std',n:'Nappali K 1'},
 {k:'N3',x:11550,y:6500,ang:HALF_PI,wtype:'std',n:'Nappali K 2'},
 {k:'EA',x:9750,y:900,ang:HALF_PI,wtype:'french',n:'Erkélyajtó'},
 {k:'KO',x:8300,y:7750,ang:0,wtype:'std',n:'Konyha D — mosogató fölött'},
 {k:'FU',x:-150,y:6000,ang:HALF_PI,wtype:'small',n:'Fürdő Ny — kis ablak'}];

// ---- 4. endpoints. Wall points: [code, face x, face y, hVar, name, opts] — (x, y) on the room face of a wall ----
const SOCKETS=[
 ['SOC',3800,400,'ejjeli','Háló éjjeli 1'],['SOC',3800,2600,'ejjeli','Háló éjjeli 2'],['SOC',0,2000,'alap','Háló Ny'],['SOC',2400,4000,'alap','Háló D'],
 ['SOC',1300,3000,'kamra','Gardrób'],
 ['SOC',4000,2000,'alap','Gyerek Ny (íróasztal)'],['SOC',7000,1500,'alap','Gyerek K'],['SOC',4600,4000,'alap','Gyerek D'],
 ['SOC',11400,2600,'alap','Nappali K1'],['SOC',11400,5000,'media','TV / média'],['SOC',11400,5300,'alap','TV / média alsó'],
 ['SOC',9600,6800,'alap','Nappali K2 (kanapé)'],['SOC',7200,1200,'alap','Étkező Ny'],['SOC',7200,3800,'alap','Étkező Ny 2'],
 ['SOC',9400,6000,'pult','Konyha munkalap 1'],['SOC',9400,7000,'pult','Konyha munkalap 2'],['SOC',7500,7600,'pult','Konyha munkalap 3'],
 ['SOC',7200,7300,'huto','Hűtő'],['SOC',9100,7600,'paraelsz','Páraelszívó'],
 ['SOC',2000,4200,'borotva','Fürdő tükör melletti'],['SOC',2600,6600,'furdo','Fürdő egyéb'],
 ['SOC',3800,6000,'ventil','WC elszívó ventilátor (ablaktalan)'],
 ['SOC',4000,7000,'alap','Előszoba (porszívó)'],['SOC',6000,4200,'alap','Közlekedő'],
 ['SOC',10600,1500,'alap','Erkély kültéri (IP44)']];
const DEDS=[
 ['DED',8600,7600,'fozolap','Főzőlap',{var:'hob32'}],['DED',7200,6800,'suto','Sütő',{var:'g16'}],['DED',7900,7600,'mosogato','Mosogatógép',{var:'g16'}],
 ['DED',0,5000,'mosogep','Mosógép',{var:'g16'}],['DED',1000,7600,'bojler','Bojler',{var:'g16'}],['DED',7200,2600,'klima','Klíma beltéri egység',{var:'g16'}]];
// lamps: ceiling [x, y] or wall {x, y, hv}
const LAMPS={
 halo:[2300,1700],halo_olv:{x:3800,y:1500,hv:'olvaso'},gardrob:[650,3350],gyerek:[5500,2000],
 nap:[10500,4400],etk:[8400,2500],erkely:{x:9900,y:1100,hv:'fali'},
 kon:[8300,6600],kon_mf:{x:9400,y:6500,hv:'munkafeny'},
 fur:[1300,5800],fur_tuk:{x:1300,y:4200,hv:'tukor'},wc:[3300,6600],
 koz1:[3700,4800],koz2:[5900,4800],elo:[5500,6500]};

const dom=new JSDOM(fs.readFileSync(DIST,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});const w=dom.window;
setTimeout(()=>{const rep={};try{
  w.confirm=()=>true;w.alert=()=>{};w.newBlankProject();
  const S=w.__state,D=()=>w.__data,WALLS=w.eval('WALLS'),LV='ground';S.active=LV;

  // ===== 1. Alapozás =====
  w.wfPhase('alap');
  ROOMS.forEach(R=>{const i=w.wfpMakeRoom(R.poly,LV);if(i<0)throw new Error('room failed: '+R.name);const f=D().floors[i];f.name=R.name;f.kinds=R.kinds.slice();f.kind=R.kinds[0];});
  const plan=w.wfwPlan(LV);rep.wfw={walls:plan.walls.length,moves:plan.moves,steps:plan.steps,skipped:plan.skipped};
  log('Falak létrehozása:',plan.walls.length,'fal · eltolás',plan.moves.length,'· lépcső',plan.steps.length,'· ferde',plan.skipped.length);
  if(plan.moves.length)log('⚠ eltolt helyiségek:',JSON.stringify(plan.moves));
  w.wfwApply(plan,LV);
  FREE_WALLS.forEach(f=>{WALLS[LV].push({x0:f.x0,y0:f.y0,x1:f.x1,y1:f.y1,layer:w.curLayer()});});
  w.eval('SNAP')[LV]=w.centerlines(WALLS[LV]);w.ensureIds(D());
  rep.walls=WALLS[LV].map(r=>({id:r.id,x0:r.x0,y0:r.y0,x1:r.x1,y1:r.y1,gen:r.gen||'kézi'}));
  {const i=w.wfpMakeRoom(BALCONY.poly,LV);const f=D().floors[i];f.name=BALCONY.name;f.kinds=BALCONY.kinds.slice();f.kind=BALCONY.kinds[0];}
  log('Padló létrehozása:',w.wfwFloors(LV),'helyiség');

  // ===== 2. Nyílászárók =====
  w.wfPhase('nyil');const lay=w.curLayer(),OPN={};
  DOORS.forEach(o=>{const T=w.eval('DOORTYPE')[o.dtype];const r={type:'door',level:LV,x:o.x,y:o.y,ang:o.ang,variant:o.variant,layer:lay,dtype:o.dtype,w:o.w||T.w,h:T.h};
    D().openings.push(r);OPN[o.k]=r;});
  WINDOWS.forEach(o=>{const T=w.eval('OPN_WINTYPE')[o.wtype];const r={type:'window',level:LV,x:o.x,y:o.y,ang:o.ang,variant:0,layer:lay,wtype:o.wtype,w:T.w,h:T.h,sill:T.sill};
    D().openings.push(r);OPN[o.k]=r;});
  w.ensureIds(D());
  // every opening must sit in a wall (opnHost) — a miss here is a layout bug, not a practice case
  const homeless=Object.keys(OPN).filter(k=>!w.opnHost(OPN[k]));if(homeless.length)throw new Error('openings without a wall: '+homeless.join(', '));
  log('Nyílászárók:',DOORS.length,'ajtó / nyílás ·',WINDOWS.length,'ablak');

  // ===== 3. Szabályok: the front door (the portal graph's anchor) =====
  w.wfPhase('szab');w.wfLayer('mark');
  const bej=w.mrkAdd({kind:'opening',level:LV,op:OPN.BEJ.id,pol:'none',tags:['bejarat']});log('Bejárat jelölve:',OPN.BEJ.id,'(',bej.id,')');

  // ===== 4. Villamosság =====
  w.wfPhase('vill');
  // the wall face a point lies on: {r, side (0 min face | 1 max face), along}
  const faceOf=(x,y)=>{let best=null,bd=6;WALLS[LV].forEach(r=>{const wi=w.wallInfo(r);
    const faces=wi.horiz?[[r.y0,0],[r.y1,1]]:[[r.x0,0],[r.x1,1]];faces.forEach(([f,s])=>{
      const d=wi.horiz?Math.abs(y-f):Math.abs(x-f),inside=wi.horiz?(x>r.x0&&x<r.x1):(y>r.y0&&y<r.y1);if(inside&&d<bd){bd=d;best={r,side:s,along:wi.horiz?x:y};}});});
    if(!best)throw new Error('no wall face at '+x+','+y);return best;};
  const faceG=(x,y,h)=>{const f=faceOf(x,y),wi=w.wallInfo(f.r),ws=f.side?1:-1,o=wi.horiz?wi.seg[0][0]:wi.seg[0][1],u=f.along-o;
    const p=w.mrkFacePt(f.r,ws,u,-wi.thick/2);return {level:LV,x:Math.round(p[0]),y:Math.round(p[1]),h,side:f.side,wall:f.r.id,u:Math.round(u),wallSide:ws,mount:'wall'};};
  const place=(g,code,role,vk,hv,name)=>{w.wfLayer(role);const d=w.epPlace(g,code,role,vk);if(hv)d.hVar=hv;if(name)d.note=name;return d;};
  // lamps
  const L={};Object.keys(LAMPS).forEach(k=>{const v=LAMPS[k];
    if(Array.isArray(v)){const g={level:LV,x:v[0],y:v[1],h:w.epCeilH(LV,v[0],v[1]),mount:'ceiling'};L[k]=place(g,'LMP','sys:LIGHT','230','mennyezet');L[k].h=w.stdH('LMP','mennyezet',L[k]);}
    else{const h=w.stdH('LMP',v.hv,null);L[k]=place(faceG(v.x,v.y,h),'LMP','sys:LIGHT','230',v.hv);}});
  // the roller-shutter motor beside the gyerekszoba window head
  const shu=place(faceG(6550,0,w.stdH('SHU','alap',null)),'SHU','sys:LIGHT','230','alap','Gyerekszoba redőny');
  // sockets + dedicated points
  const pts=[];SOCKETS.concat(DEDS).forEach(([code,x,y,hv,name,o])=>{o=o||{};const role=code==='DED'?'sys:DED':'sys:SOC';
    const d=place(faceG(x,y,w.stdH(code,hv,null)||300),code,role,o.var||'25',hv,name);pts.push(d);});
  pts.filter(d=>w.epCodeOf(d)==='DED').forEach((d,i)=>{d.ref='DED'+(i+1);});
  log('Szabványmagasság alkalmazva:',w.stdApply('project',null,true),'eszköz');

  // ---- switching (E1): door switches go to the door's latch slot L1 on the named room's face ----
  const roomId=name=>{const f=D().floors.find(x=>x.name===name);return f&&f.id;};
  const slot=(door,room)=>{const s=w.ptSlots(OPN[door]).filter(s=>s.k==='L1');const rid=roomId(room);
    const hit=s.find(q=>q.room===rid)||s.find(q=>String(q.room).indexOf(rid)>=0);
    if(!hit)throw new Error('no L1 slot: '+door+' / '+room+' — have '+JSON.stringify(s.map(q=>q.room)));return hit;};
  const wallSw=(x,y,hv)=>{const g=faceG(x,y,1100);return {level:LV,x:g.x,y:g.y,side:g.side,hv};};
  const link=(lamps,target)=>{const ids=lamps.map(k=>(L[k]||k).id);const hv=target.hv;const sw=w.lswLink(ids,target.sw?target:(target.k?{slot:target}:{wall:target}),true);
    if(hv){sw.hVar=hv;sw.h=w.stdH('SWI',hv,null);}return sw;};
  const SW={};
  SW.haloDoor=link(['halo'],slot('HAL','HÁLÓ'));
  SW.haloBed=link(['halo'],wallSw(3800,2900,'ejjeli'));link(['halo_olv'],{sw:SW.haloBed});
  SW.gardrob=link(['gardrob'],slot('GAR','HÁLÓ'));
  SW.gyerek=link(['gyerek'],slot('GYE','GYEREKSZOBA'));
  SW.redony=link([shu],wallSw(5500,4000));
  SW.napDoor=link(['nap'],slot('NAP','NAPPALI · ÉTKEZŐ'));link(['etk'],{sw:SW.napDoor});
  SW.napErk=link(['nap'],wallSw(9600,1350));link(['erkely'],{sw:SW.napErk});
  SW.kon=link(['kon'],slot('KON','KONYHA'));link(['kon_mf'],{sw:SW.kon});
  SW.fur=link(['fur'],slot('FUR','KÖZLEKEDŐ'));link(['fur_tuk'],{sw:SW.fur});
  SW.wc=link(['wc'],slot('WC','KÖZLEKEDŐ'));
  // közlekedő: three switch points → 106 · 107 · 106; előszoba: front door + the double door → 106 + 106
  w.lswGroup(['koz1','koz2'].map(k=>L[k].id));
  SW.kozHal=link(['koz1'],slot('HAL','KÖZLEKEDŐ'));
  SW.kozGye=link(['koz1'],slot('GYE','KÖZLEKEDŐ'));
  SW.kozKoz=link(['koz1'],slot('KOZ','KÖZLEKEDŐ'));
  SW.eloBej=link(['elo'],slot('BEJ','ELŐSZOBA'));
  SW.eloKoz=link(['elo'],slot('KOZ','ELŐSZOBA'));
  w.lswRetypeAll();
  rep.switches=Object.keys(SW).map(k=>({k,ref:SW[k].ref,type:SW[k].swType,gang:SW[k].gang,h:SW[k].h,slot:SW[k].slot?SW[k].slot.k+'·'+SW[k].slot.door:''}));
  log('Kapcsolók:',rep.switches.map(s=>s.k+'='+s.type).join(' '));
  const left=w.lswSuggest(LV);log('Kapcsolatlan lámpa maradt:',left.length?left.map(r=>r.room.name).join(', '):'nincs');

  // ---- Elosztó (E3): the hall's west face, beside the front door ----
  const brd=w.jbPlace('board',faceG(4000,6400,null));if(brd.h==null)brd.h=w.eval('JB_H').board;log('Elosztó:',brd.ref||brd.id,'@',brd.x,brd.y,'h',brd.h);

  // ---- circuits (E4): the Elosztó's suggestion, every row ticked ----
  const rows=w.elpSuggest(brd.id);
  // one change of mine: the walk-in's single socket joins the bedroom it opens from, not a circuit of its own
  {const g=rows.find(r=>/^GARDRÓB/.test(r.name)),h=rows.find(r=>/^HÁLÓ dugalj/.test(r.name));
    if(g&&h){h.members=h.members.concat(g.members);h.name='HÁLÓ · GARDRÓB dugalj';rows.splice(rows.indexOf(g),1);log('saját módosítás: a gardrób dugalja a háló körére');}}
  const ap=w.elpApply(rows);
  rep.circuits=w.cktList().map(c=>({ref:c.ref,name:c.name,preset:c.preset||'',mcb:w.mcbText?w.mcbText(c.mcb):JSON.stringify(c.mcb),n:(c.members||[]).length}));
  log('Áramkörök:',rows.length,'javaslat; alkalmazva',ap.made,'· kör nélkül',ap.left);
  rep.circuits.forEach(c=>log('  ',c.ref,c.name,'·',c.mcb,'·',c.n,'pont'));

  // ===== stop: Pályák is the hand work =====
  w.ensureIds(D());S.active=LV;w.draw();
  try{rep.stkChecks=(w.stkCheckAll?w.stkCheckAll():[]).map(c=>(c.code||c.sev)+': '+c.msg);}catch(e){rep.stkChecks=['(nem futott: '+e.message+')'];}
  const name='Gyakorló lakás — alap + Erősáram végpontok és áramkörök (Pályák előtt)';w.eval('B').name=name;
  const snap=w.projSnapshot(name);
  fs.writeFileSync(path.join(OUT,'Gyakorlo_lakas.vplan.json'),JSON.stringify({format:'varler-planner',version:1,name,saved:new Date().toISOString(),project:snap.data},null,1));
  rep.counts={floors:D().floors.length,walls:WALLS[LV].length,openings:D().openings.length,devices:D().devices.length,
    byCode:D().devices.reduce((a,d)=>{const k=w.epCodeOf(d)||d.type;a[k]=(a[k]||0)+1;return a;},{}),paths:D().paths.length,circuits:rep.circuits.length};
  rep.walls=WALLS[LV].map(r=>({id:r.id,x0:r.x0,y0:r.y0,x1:r.x1,y1:r.y1,gen:r.gen||'kézi'}));
 }catch(e){rep.err=e.stack;}
 rep.log=LOG;fs.writeFileSync(path.join(OUT,'build-report.json'),JSON.stringify(rep,null,1));
 console.log(LOG.join('\n'));if(rep.err)console.log('ERR',rep.err);else console.log('counts',JSON.stringify(rep.counts),'\nchecks',JSON.stringify(rep.stkChecks));
 process.exit(0);},1200);
