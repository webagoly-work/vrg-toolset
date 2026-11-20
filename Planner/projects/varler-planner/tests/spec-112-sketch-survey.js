// VRG Sketcher (Mobile WP M46) — the survey's intake and takeoff imported with the drawing (src/08cb-sketch-survey.js).
//
// tests/sketch-intake.json is the Planner fixture package (sketch-field.json) with an intake in its sketch and the
// takeoff the JS engine makes of it (Sketcher/tools/make-takeoff-fixture.js writes it; Sketcher/test/run.js checks it is
// current). What must hold: the drawing imports exactly as before; the survey lands on the building (B.survey) and
// survives a save; the HUD counts it; "Felmérés: munkakör lap" shows the scope, the items with ≈ / ⚑, the open
// decisions, the answers, the notes (Tisztázandó flagged) and the photos; an old package without a takeoff keeps the raw
// intake; a package with no intake adds nothing; nothing is drawn (the goldens stay).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PKG=fs.readFileSync(path.join(__dirname,'sketch-intake.json'),'utf8');
const OLD=fs.readFileSync(path.join(__dirname,'sketch-field.json'),'utf8');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(async()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();
  const D=w.__data;const o=JSON.parse(PKG);const B=()=>w.eval('B');
  const scene=()=>{w.__state.pitch=90;w.draw();return $('vp').firstChild.innerHTML;};

  // ---------- 1. the fixture carries what the phone exports now ----------
  ok('the package has a takeoff',o.takeoff&&o.takeoff.kind==='vrg-sketch-takeoff'&&o.takeoff.items.length>5);
  ok('no intake, no takeoff: nothing to keep',w.svyFromPackage(JSON.parse(OLD))===null);

  // ---------- 2. import ----------
  w.skiImport(o);
  ok('the drawing imports as before',D.floors.length===2&&D.devices.length===4&&D.circuits.length===1&&D.paths.length===1);
  const sv=B().survey;
  ok('the survey is on the building',sv&&sv.src==='vazlat'&&sv.takeoff&&sv.name==='Kossuth u. 12');
  ok('a copy, not the package itself',sv.takeoff!==o.takeoff&&sv.takeoff.items.length===o.takeoff.items.length);
  ok('the raw intake is kept too',sv.raw.scope.dugalj===3&&sv.raw.answers.lenyeg.options[0]==='csere'&&sv.raw.entries.length===2&&sv.raw.captures.length===1);
  ok('the HUD counts it',/felmérés: \d+ tétel \(\d+ ≈\), \d+ nyitott döntés, 1 tisztázandó/.test($('hud').textContent),$('hud').textContent);
  ok('no new data collection (the schema is unchanged)',!('survey' in D));

  // ---------- 3. saved with the project ----------
  const so=w.sessionObj();
  ok('a save carries it',so.building.survey&&so.building.survey.takeoff.items.length===o.takeoff.items.length);

  // ---------- 4. the panel ----------
  const act=w.actionById('sketch.survey');
  ok('the action is offered',act&&act.when({})===true);
  act.run({});
  const body=$('svyBody').innerHTML;
  ok('the scope by group',/A munka jellege/.test(body)&&/Felújítás, csere/.test(body));
  const rows=w.document.querySelectorAll('#svyBody .svy-item');
  ok('one row per item',rows.length===o.takeoff.items.length);
  const sock=w.document.querySelector('#svyBody .svy-item[data-id="pont.socket.uj"]');
  ok('the wanted sockets: 3, guessed and flagged',sock&&/<b>3<\/b> db/.test(sock.innerHTML)&&sock.querySelector('.svy-est')&&sock.querySelector('.svy-flag'),sock&&sock.innerHTML);
  ok('cable in metres with a comma',/<b>4,2<\/b> m/.test(body));
  ok('the open decisions',w.document.querySelectorAll('#svyBody .svy-dec').length===o.takeoff.decisions.length&&/Mikor készült a hálózat/.test(body));
  ok('the answer with its option label',/✓<\/span> Mi a kérés lényege\? — Csere, felújítás/.test(body));
  ok('Tisztázandó stays flagged',w.document.querySelectorAll('#svyBody .svy-open').length===1&&/⚑ Tisztázandó/.test(body));
  ok('the photos by purpose',/Elosztó: 1/.test(body)&&/kossuth-u-12_C52_eloszto\.jpg/.test(body));
  w.closeModal();

  // ---------- 5. nothing drawn ----------
  ok('no survey markup in the scene',!/svy/.test(scene()));

  // ---------- 6. an older phone: no takeoff, the raw intake by its ids ----------
  const old=JSON.parse(PKG);delete old.takeoff;
  w.hardResetWorkspace();w.skiImport(old);
  const s2=B().survey;
  ok('kept raw',s2&&s2.takeoff===null&&s2.raw.entries.length===2);
  ok('the HUD counts the raw intake',/felmérés: 7 munkakör, 2 válasz, 2 jegyzet, 1 tisztázandó/.test($('hud').textContent),$('hud').textContent);
  w.actionById('sketch.survey').run({});
  ok('the raw panel lists ids, Tisztázandó flagged',/dugalj ×3/.test($('svyBody').innerHTML)&&w.document.querySelectorAll('#svyBody .svy-open').length===1);
  w.closeModal();

  // ---------- 7. a package without intake: no survey, the action says why ----------
  w.hardResetWorkspace();w.skiImport(JSON.parse(OLD));
  ok('no survey on the building',!B().survey);
  ok('the action is dimmed',w.actionById('sketch.survey').when({})===false);

  // ---------- 8. through "Terv betöltése fájlból" ----------
  w.hardResetWorkspace();
  w.importProjectFile(new w.File([PKG],'kossuth.vsketch.json',{type:'application/json'}));
  await new Promise(r=>setTimeout(r,400));
  ok('the file import keeps the survey',B().survey&&B().survey.takeoff&&/felmérés:/.test($('hud').textContent));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
