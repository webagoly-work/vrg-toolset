// Workflow round WP-E1 — lamps ↔ switches (src/08l-wf-switches.js).
// What must hold (docs/workflow/WP-E1_lamp-switch-links.md; E02 A, E03 A): legs (groups); a link to a door's L1 slot
// CREATES the switch there (1100, slot recorded) and fills the existing sw.ctl; the type follows the links in the
// Planner's numbering (101 / 103 csillár / 105 váltó / 107 kereszt / 106 / 108); a hand type stays; the suggestion
// (one leg per room → the L1 slot of every room door; a wet room → the DRY face); a slot switch follows its door.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.devices.length=0;D.openings.length=0;
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  // A nappali 0–4000 × 0–3000 · B fürdő 4000–6000 (→ 4200–6200) · C előszoba 0–6000 × 3000–5000 (→ y 3200–5200)
  D.floors.push({level:'ground',poly:rect(0,0,4000,3000),name:'Nappali',kinds:['nappali'],kind:'nappali',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(4000,0,6000,3000),name:'Fürdő',kinds:['furdo'],kind:'furdo',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(0,3000,6000,5000),name:'Előszoba',kinds:['eloszoba'],kind:'eloszoba',stage:'floor',clear:true,layer:'L0'});
  w.wfwApply(w.wfwPlan('ground'),'ground');w.wfPhase('vill');
  const door=(x,y,a)=>{D.openings.push({type:'door',level:'ground',x,y,ang:a,variant:0,w:900,h:2100,dtype:'hinged',layer:'L0'});w.ensureIds(D);return D.openings[D.openings.length-1];};
  const D1=door(2000,3100,0),D2=door(5200,3100,0),D3=door(4100,1500,Math.PI/2);
  const [A,B,C]=D.floors;
  const lamp=(x,y)=>{D.devices.push({type:'light',code:'LMP',var:'230',level:'ground',x,y,h:2850,layer:w.epRoleLayer('sys:LIGHT').id});w.ensureIds(D);return D.devices[D.devices.length-1];};
  const L1=lamp(2000,1500),L2=lamp(1000,1000),L3=lamp(5200,1500);
  const slot=(o,rm)=>w.ptSlots(o).find(s=>s.k==='L1'&&s.room===rm.id);
  ok('fixture: D1 has an L1 slot on the nappali face',!!slot(D1,A));
  // 1. legs
  const g=w.lswGroup([L1.id,L2.id]);ok('two lamps → one leg',g&&L1.grp===g&&L2.grp===g&&w.lswLeg(L1).length===2);
  // 2. link creates the switch at the slot
  let s1=w.lswLink([L1.id],{slot:slot(D1,A)});
  ok('a switch is created at the slot',s1&&s1.type==='switch'&&s1.code==='SWI'&&s1.slot.door===D1.id&&s1.h===1100);
  ok('the whole leg is linked through one lamp',s1.ctl.length===2&&s1.ctl.indexOf(L2.id)>=0);
  ok('one leg → 101 egypólusú',s1.swType==='101');
  ok('it sits on the Erősáram lighting layer',w.lyrLayer(s1.layer).role==='sys:LIGHT');
  w.lswLink([L3.id],{sw:s1});ok('a second leg → 105 csillár',s1.swType==='105');
  w.lswUnlink([L3.id],s1);ok('unlinked → 101 again',s1.swType==='101');
  // 3. váltó / kereszt
  const s2=w.lswLink([L1.id],{slot:slot(D3,A)});
  ok('the same leg from a second door → both 106 váltó',s1.swType==='106'&&s2.swType==='106');
  const s3=w.lswLink([L2.id],{wall:{level:'ground',x:-150,y:1500,side:1}});
  const types=[s1,s2,s3].map(s=>s.swType).sort().join();
  ok('three switches on one leg → two 106 at the ends, one 107 in the middle',types==='106,106,107',types);
  s3.typeFix=true;s3.swType='101';w.lswRetypeAll();ok('a hand-set type stays',s3.swType==='101');
  // 4. the suggestion on a fresh set
  D.devices.length=0;const M1=lamp(2000,1500),M2=lamp(1000,1000),M3=lamp(5200,1500);
  const rows=w.lswSuggest('ground');const rA=rows.find(r=>r.room===A),rB=rows.find(r=>r.room===B);
  ok('Nappali: 2 lamps, 2 doors → 106 + 106',rA&&rA.lamps.length===2&&rA.slots.length===2&&rA.type==='106 + 106');
  ok('Fürdő (wet): its switch places are on the DRY faces',rB&&rB.slots.length===2&&rB.slots.every(s=>s.room!==B.id),rB&&JSON.stringify(rB.slots.map(s=>s.room)));
  ok('Előszoba has no lamps → no row',!rows.some(r=>r.room===C));
  w.lswSuggestApply(rows);
  const sws=D.devices.filter(d=>d.code==='SWI');
  ok('after Alkalmaz every lamp is switched',[M1,M2,M3].every(l=>sws.some(s=>(s.ctl||[]).indexOf(l.id)>=0)));
  ok('the nappali lamps became one leg',M1.grp&&M1.grp===M2.grp);
  ok('3 switch places (the D3 nappali face is shared by both rooms)',sws.length===3,sws.length);
  const shared=sws.find(s=>s.slot.door===D3.id);ok('… and that one carries two shared legs → 108 dupla váltó',shared&&shared.swType==='108',shared&&shared.swType);
  ok('nothing left to suggest',w.lswSuggest('ground').length===0);
  // 5. a slot switch follows its door (E03 A)
  const sd1=sws.find(s=>s.slot.door===D1.id),x0=sd1.x;D1.variant=2;w.lswReseat();
  ok('flipping the door moves its switch to the other jamb (1200 mm)',Math.abs(sd1.x-x0)===1200,x0+' → '+sd1.x);
  // 5b. the Hungarian codes (the user's list — must never change) + the one-time migration of the old keys
  const T=k=>w.switchType(k).l;
  ok('codes: 100 impulzus, 101 egypólusú, 102 kétpólusú, 103 háromfázisú, 105 csillár, 106 váltó, 107 kereszt, 108 dupla váltó',
    /Impulzus/.test(T('100'))&&/Egypólusú/.test(T('101'))&&/Kétpólusú/.test(T('102'))&&/Háromfázisú/.test(T('103'))&&/Csillár/.test(T('105'))&&/^106 – Váltó/.test(T('106'))&&/Kereszt/.test(T('107'))&&/Dupla váltó/.test(T('108')));
  ok('104 is not offered (old standard)',!w.eval('SWITCH_TYPES').some(x=>x.k==='104'));
  const old={devices:[{type:'switch'},{type:'switch',swType:'103'},{type:'switch',swType:'105'},{type:'switch',swType:'106'},{type:'switch',swType:'104'},{type:'switch',swType:'108'},{type:'switch',swType:'107'},{type:'switch',swType:'105',swNum:2}]};
  w.swNumMigrate(old);ok('old keys mapped once (a typeless switch is not touched): 103→105, 105→106, 106→108, 104→100, 108→redony, 107 stays, new ones untouched',
    old.devices.map(x=>x.swType||'-').join()==='-,105,106,108,100,redony,107,105'&&old.devices[0].swNum===undefined);
  w.swNumMigrate(old);ok('a second run changes nothing',old.devices.map(x=>x.swType||'-').join()==='-,105,106,108,100,redony,107,105'&&old.devices[0].swNum===undefined);
  ok('switches made by E1 carry swNum 2',sws.every(s=>s.swNum===2));
  // 6. checks + bar
  lamp(3000,500);const msgs=(w.STK_CHECKS['sys:LIGHT']||[]).flatMap(f=>{try{return f()||[];}catch(_){return [];}});
  ok('an unswitched lamp is reported (lsw.none)',msgs.some(m=>m.code==='lsw.none'));
  w.wfBarDraw();ok('the bar offers 4.2 Kapcsolások and the suggestion',/4\.2 Kapcsolások/.test($('wfBar').innerHTML)&&/Kapcsolások javaslata/.test($('wfBar').innerHTML)&&![...$('wfBar').querySelectorAll('button[disabled]')].some(x=>/4.2/.test(x.textContent)));
  w.lswToolStart();ok('the tool runs on the lighting layer',w.eval('LSW.on')&&w.lyrLayer(st.activeLayer).role==='sys:LIGHT');
  w.setMode('wall');ok('another tool ends it',!w.eval('LSW.on'));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
