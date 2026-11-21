// VRG Sketcher (Mobile WP M47) — the survey's intake and takeoff imported with the drawing (src/08cb-sketch-survey.js).
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
  ok('no room wants, no wants key',!('wants' in B().survey));

  // ---------- 9. F5 (WP M50): the client's wants by room, as the phone's export writes them (WP M49) ----------
  const ww=JSON.parse(PKG);
  ww.sketch.roomScope={R1:{dugalj:2},R2:{ledszalag:1},R9:{dugalj:1}};   // R9: a deleted room → Általános
  ww.plan.wants=[{id:'dugalj',total:3,general:1,rooms:{R1:2}},{id:'ledszalag',total:2,general:1,rooms:{R2:1}}];
  ww.plan.data.floors[0].sk.wants={dugalj:2};ww.plan.data.floors[1].sk.wants={ledszalag:1};
  ww.takeoff.rooms[0].wants=[{id:'dugalj',label:'Dugalj',sym:'⊙',qty:2}];ww.takeoff.rooms[1].wants=[{id:'ledszalag',label:'LED-szalag',sym:'═',qty:1}];
  w.hardResetWorkspace();w.skiImport(ww);
  const wv=B().survey.wants;
  ok('the wants are kept by room',wv&&wv.rooms.length===2&&wv.rooms[0].name==='Nappali'&&wv.rooms[0].items[0].qty===2&&wv.rooms[1].items[0].label==='LED-szalag',JSON.stringify(wv));
  ok('the rest is Általános (a deleted room counts there)',wv.general.length===2&&wv.general.find(i=>i.id==='dugalj').qty===1&&wv.general.find(i=>i.id==='ledszalag').qty===1,JSON.stringify(wv&&wv.general));
  ok('a save carries them',w.sessionObj().building.survey.wants.rooms.length===2);
  w.actionById('sketch.survey').run({});
  const wr=w.document.querySelectorAll('#svyBody .svy-want');
  ok('the panel: Igények szobánként, one line per room + Általános',/Igények szobánként/.test($('svyBody').innerHTML)&&wr.length===3);
  ok('the room line',/Nappali:<\/i> ⊙ Dugalj ×2/.test(wr[0].innerHTML)&&wr[0].getAttribute('data-room')==='R1',wr[0]&&wr[0].innerHTML);
  ok('the Általános line',wr[2].classList.contains('svy-general')&&/Általános:<\/i> ⊙ Dugalj ×1, ═ LED-szalag ×1/.test(wr[2].innerHTML),wr[2]&&wr[2].innerHTML);
  w.closeModal();
  // an older phone (no takeoff): the ids, the names from the floors
  const wo=JSON.parse(JSON.stringify(ww));delete wo.takeoff;w.hardResetWorkspace();w.skiImport(wo);
  ok('without a takeoff: the room names from the plan, the ids as labels',B().survey.wants.rooms[1].name==='Fürdő'&&B().survey.wants.rooms[0].items[0].label==='dugalj');
  ok('nothing drawn with the wants',!/svy/.test(scene()));
  ok('no client in the fixture package',!('client' in B().survey));

  // ---------- 10. F5: the client's contact, when the phone kept it in the package ----------
  const wc=JSON.parse(PKG);wc.sketch.client={name:'Minta Ügyfél',phone:'+36 30 000 0000',email:'',keep:true};
  w.hardResetWorkspace();w.skiImport(wc);
  ok('the contact is kept with the job',B().survey.client&&B().survey.client.name==='Minta Ügyfél'&&B().survey.client.email==='');
  w.actionById('sketch.survey').run({});
  ok('the panel shows it',/Ügyfél:<\/b>&nbsp;Minta Ügyfél · \+36 30 000 0000/.test($('svyBody').innerHTML),$('svyBody').innerHTML.slice(0,300));
  w.closeModal();
  ok('nothing drawn with the client',!/Minta/.test(scene()));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
