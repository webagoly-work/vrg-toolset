// WP-M1 (round 2026-10-10): Erősáram split into Dedikált · Dugaljak · Világítás + the grey-safe print palette.
//
// Fixture: the committed CLA v2 plan, saved BEFORE the split (one "B1 · Erősáram" layer) — the real migration case.
// What must hold:
//   * a new stack has the three roles in order and no sys:MAINS; the old key still resolves read-only;
//   * loading an old plan migrates once: the old layer id becomes Dugaljak, DED / LIGHT get new layers, every
//     device keeps its id and lands by code, room checklists split; a second run changes nothing;
//   * the colours: DED barna, SOC vörös, LMP világospiros, SWI narancs;
//   * the print palette: distinct (L*, pattern) pairs, the Erősáram four ≥ 15 L* apart, used only while printing,
//     always switched back off after a grey export (also when the export throws).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','CLA-teszt_v2.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const LY=()=>w.eval('layers');

  // ---------- a new stack ----------
  w.newBlankProject();const S0=w.stkCreate({name:'Új'});
  const roles=w.stkLayersOf(S0.id).map(l=>l.role);
  ok('a new stack has sys:DED, sys:SOC, sys:LIGHT in that order, no sys:MAINS',
    roles.indexOf('sys:DED')>=0&&roles.indexOf('sys:DED')+1===roles.indexOf('sys:SOC')&&roles.indexOf('sys:SOC')+1===roles.indexOf('sys:LIGHT')&&roles.indexOf('sys:MAINS')<0,roles.join(','));
  ok('the old key resolves read-only',w.stkRole('sys:MAINS')&&w.stkRole('sys:MAINS').alias.join()==='sys:DED,sys:SOC,sys:LIGHT'&&!!w.epEntry('LMP','sys:MAINS')&&w.epOfRole('sys:MAINS').length===5);
  ok('all three keep the MAINS conduit family',['sys:DED','sys:SOC','sys:LIGHT'].every(r=>w.stkRole(r).fam==='MAINS'));
  ok('catalogue roles: DED → DED · SOC → SOC · LMP SWI SHU → LIGHT',w.epEntry('DED').role==='sys:DED'&&w.epEntry('SOC').role==='sys:SOC'
    &&['LMP','SWI','SHU'].every(c=>w.epEntry(c,'sys:LIGHT')));
  ok('room defaults split: a living room lights LMP+SWI, sockets SOC',(function(){const rm={name:'Nappali'};
    return JSON.stringify(w.needDefaults(rm,'sys:LIGHT').codes)==='["LMP","SWI"]'&&JSON.stringify(w.needDefaults(rm,'sys:SOC').codes)==='["SOC"]';})());

  // ---------- migrating a saved plan ----------
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8')),P=doc.project;
  const old=P.layers.find(l=>l.role==='sys:MAINS');
  ok('the fixture is a pre-split plan (one Erősáram layer)',!!old,old&&old.name);
  const onOld=P.data.devices.filter(d=>d.layer===old.id);
  const R1=P.data.floors[0];R1.needs={'sys:MAINS':{LMP:true,SWI:true,SOC:true,DED:false}};   // a saved checklist to split
  const ids0=new Set(P.data.devices.map(d=>d.id));
  w.hardResetWorkspace();w.applyProjectData(JSON.parse(JSON.stringify(P)));
  const S=w.eval('stacks')[0],Lsoc=LY().find(l=>l.id===old.id),Lded=w.stkLayer(S.id,'sys:DED'),Llit=w.stkLayer(S.id,'sys:LIGHT');
  ok('no sys:MAINS layer is left',!LY().some(l=>l.role==='sys:MAINS'));
  ok('the old layer id is now Dugaljak (sys:SOC), its name follows',Lsoc&&Lsoc.role==='sys:SOC'&&/Dugaljak/.test(Lsoc.name),Lsoc&&Lsoc.name);
  ok('Dedikált körök and Világítás are new layers of the same stack',Lded&&Llit&&Lded.stack===S.id&&Llit.stack===S.id&&/Dedikált/.test(Lded.name)&&/Világítás/.test(Llit.name));
  ok('the three Erősáram layers have three distinct ids (minted in the same millisecond)',new Set([Lded.id,Lsoc.id,Llit.id]).size===3);
  ok('the stack lists the three',S.layers.indexOf(Lded.id)>=0&&S.layers.indexOf(Lsoc.id)>=0&&S.layers.indexOf(Llit.id)>=0);
  const dev=id=>w.__data.devices.find(d=>d.id===id);
  const where=code=>onOld.filter(d=>(d.code||'')===code||(!d.code&&code===({light:'LMP',switch:'SWI',socket:'SOC'})[d.type])).map(d=>dev(d.id).layer);
  ok('every device keeps its id',w.__data.devices.every(d=>ids0.has(d.id))&&w.__data.devices.length===ids0.size);
  ok('DED on Dedikált körök',where('DED').length>0&&where('DED').every(l=>l===Lded.id),where('DED').length);
  ok('LMP and SWI on Világítás',where('LMP').length>0&&where('LMP').concat(where('SWI')).every(l=>l===Llit.id));
  ok('sockets stay on the old id (Dugaljak)',where('SOC').length>0&&where('SOC').every(l=>l===Lsoc.id));
  ok('circuit membership survives (members are ids)',w.__data.circuits.every(c=>(c.members||[]).every(id=>!!dev(id))));
  const r1=w.__data.floors[0];
  ok('the room checklist splits by code',r1.needs&&!r1.needs['sys:MAINS']&&r1.needs['sys:LIGHT'].LMP===true&&r1.needs['sys:LIGHT'].SWI===true&&r1.needs['sys:SOC'].SOC===true&&r1.needs['sys:DED'].DED===false);
  ok('running the migration again changes nothing',(function(){const a=JSON.stringify({l:LY(),d:w.__data.devices,f:w.__data.floors});
    const n=w.stkMigrateRoles();return n===0&&JSON.stringify({l:LY(),d:w.__data.devices,f:w.__data.floors})===a;})());
  ok('a plan with no stack is left alone',(function(){w.newBlankProject();const before=JSON.stringify(LY());return w.stkMigrateRoles()===0&&JSON.stringify(LY())===before;})());
  w.hardResetWorkspace();w.applyProjectData(JSON.parse(JSON.stringify(P)));

  // ---------- circuits still read across the three ----------
  const rooms=w.__data.floors.map(f=>f.id);
  ok('epCircuits(room) covers every Erősáram device with a circuit key, whatever its new layer',rooms.every(rid=>{
    const inC=new Set();w.epCircuits(rid).forEach(c=>c.members.forEach(id=>inC.add(id)));
    const want=w.epInRoom(rid,'sys:MAINS').filter(d=>w.epCircuitOf(d)).map(d=>d.id);return want.every(id=>inC.has(id))&&inC.size===want.length;}));
  ok('the cabinet check is on Dedikált, the switch checks on Világítás',(w.eval('STK_CHECKS')['sys:DED']||[]).length>=2&&(w.eval('STK_CHECKS')['sys:LIGHT']||[]).length>=1&&!(w.eval('STK_CHECKS')['sys:MAINS']||[]).length);

  // ---------- colours ----------
  ok('screen colours: DED barna · SOC vörös · LMP világospiros · SWI narancs',w.stkRoleCol('sys:DED')==='#6d4c41'&&w.stkRoleCol('sys:SOC')==='#c62828'
    &&w.stkRoleCol('sys:LIGHT','LMP')==='#ef7b72'&&w.stkRoleCol('sys:LIGHT','SWI')==='#f08c2e');
  const S2=w.eval('stacks')[0],Lit2=w.stkLayer(S2.id,'sys:LIGHT');   // a reload migrates again: new layer ids
  const sw=w.__data.devices.find(d=>d.layer===Lit2.id&&w.epCodeOf(d)==='SWI'),lm=w.__data.devices.find(d=>d.layer===Lit2.id&&w.epCodeOf(d)==='LMP');
  ok('a switch symbol is orange, a lamp light red',sw&&lm&&w.icoRoleCol(sw)==='#f08c2e'&&w.icoRoleCol(lm)==='#ef7b72',sw&&w.icoRoleCol(sw));

  // ---------- the print palette ----------
  const PR=w.STK_PRINT,ph2=w.STK_ROLES.filter(r=>r.ph===2&&PR[r.k]).map(r=>r.k);
  ok('every phase-2 role in the palette has a unique (L*, pattern) pair',(function(){const k=ph2.concat(['SWI']).map(r=>PR[r].L+PR[r].p);return new Set(k).size===k.length;})(),ph2.length);
  ok('the Erősáram four are ≥ 15 L* apart',(function(){const L=['sys:DED','sys:SOC','SWI','sys:LIGHT'].map(k=>PR[k].L).sort((a,b)=>a-b);return L.every((v,i)=>i===0||v-L[i-1]>=15);})());
  ok('off screen: SWI is narancs; while printing: the print colour',(function(){const a=w.icoRoleCol(sw);w.prnSet(true);const b=w.icoRoleCol(sw),on=w.prnActive();w.prnSet(false);
    return a==='#f08c2e'&&on&&b==='#d87817'&&!w.prnActive();})());
  ok('the printed symbol outline carries the role pattern',(function(){w.prnSet(true);const s=w.icoSym(w.__data.devices.find(d=>d.layer===w.stkLayer(S.id,'sys:SENSOR').id),100,100,1,false)||'';w.prnSet(false);
    return /stroke-dasharray/.test(s);})());
  ok('state.printPal off: printing keeps the true colours',(function(){w.__state.printPal=false;w.prnSet(true);const c=w.icoRoleCol(sw);w.prnSet(false);w.__state.printPal=true;return c==='#f08c2e';})());
  ok('the legend lists the switch and the used roles',(function(){w.prnSet(true);const s=w.prnLegendSvg(10,10);w.prnSet(false);return /Kapcsoló/.test(s)&&/Világítás/.test(s)&&/Dugaljak/.test(s);})());
  ok('exportPNG(true) leaves the palette off afterwards',(w.exportPNG(true),!w.prnActive()));
  ok('… also when the export throws',(function(){const st=w.document.getElementById('stage'),orig=st.cloneNode;st.cloneNode=()=>{throw new Error('boom');};
    try{w.exportPNG(true);}catch(_){}st.cloneNode=orig;return !w.prnActive();})());
  ok('the print palette is in the View panel and the registry',!!w.document.getElementById('printPal')&&w.eval('ACTIONS').some(a=>a.id==='doc.printPalette'));
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
