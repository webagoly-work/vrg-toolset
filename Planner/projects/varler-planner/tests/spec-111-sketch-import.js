// VRG Mobile Vázlat (Mobile WP M24) — the field sketch package, imported (src/08ca-sketch-import.js).
//
// tests/sketch-field.json is what the phone's export writes for its test sketch: the JVM test
// (Mobile/android/sketch-core WheelJsonExportTest) builds it and checks it still equals this file, so the two
// sides cannot drift apart. What must hold: the package is recognised (and a plain plan is not); it opens as a
// new project with outline rooms, devices, a circuit on its Elosztó, a route linked to its devices, notes; the
// inferred edges are marked (≈) and nothing else is; "méretek ellenőrizve" clears them in one undo step;
// "Terv betöltése fájlból" takes the package.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PKG=fs.readFileSync(path.join(__dirname,'sketch-field.json'),'utf8');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(async()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();
  const D=w.__data,st=w.__state;const o=JSON.parse(PKG);
  const scene=()=>{st.pitch=90;w.draw();return $('vp').firstChild.innerHTML;};

  // ---------- 1. recognition ----------
  ok('the package is a sketch',w.skiIs(o)===true);
  ok('a plain project file is not',w.skiIs({building:{},data:{}})===false&&w.skiIs(null)===false&&w.skiIs({kind:'vrg-sketch'})===false);

  // ---------- 2. a plan without sketch marks draws none (the goldens stay) ----------
  D.floors.push({level:'ground',poly:[[0,0],[3000,0],[3000,3000],[0,3000]],name:'Sima',stage:'outline',clear:true});
  ok('no ski markup without sk.est',!/ski-/.test(scene()));

  // ---------- 3. import ----------
  const id=w.skiImport(o);
  ok('a new project, named after the sketch',w.__proj.list()[id]&&w.__proj.list()[id].name==='Kossuth u. 12 (vázlat)');
  ok('the HUD counts what came in',/Vázlat betöltve: 2 helyiség, 4 pont, 1 áramkör, 1 nyomvonal, 2 jegyzet, 1 fotópont \(1 fotó\) · 2 becsült fal/.test($('hud').textContent),$('hud').textContent);
  ok('two outline rooms with inner sizes',D.floors.length===2&&D.floors.every(f=>f.stage==='outline'&&f.clear===true));
  ok('the earlier workspace is gone',!D.floors.some(f=>f.name==='Sima'));
  ok('room kinds came along (Fürdő from its tag)',D.floors[0].kind==='nappali'&&D.floors[1].kind==='furdo');
  ok('Nappali is 4000 × 3200',Math.round(w.polyAreaMM(D.floors[0].poly)/1e4)/100===12.8);
  ok('four devices',D.devices.length===4&&D.devices.map(d=>d.type).join()==='socket,switch,light,board');
  const board=D.devices[3];
  ok('the Elosztó gets the Planner\'s board size and height',board.rw===w.eval('BOARD_RW')&&board.h===w.eval('boardZ()')&&board.z===board.h);
  const ck=D.circuits[0];
  ok('the circuit keeps its members, colour and board',ck&&ck.members.length===3&&ck.members.every(m=>w.byId('devices',m))&&ck.board===board.id&&ck.col==='#e8641c');
  ok('the circuit end points resolve',w.cktMembers(ck).length===3);
  const sw=D.devices[1];
  ok('the route reaches the switch (a link that resolves)',w.linkTargets(sw).length===1&&w.linkTargets(sw)[0].path.id===D.paths[0].id);
  ok('route nodes at the ceiling',D.paths[0].nodes.every(n=>n.h===2700));
  ok('memo + loose tag + the photo point as notes',D.notes.length===3&&D.notes[1].text==='#Nedves'&&D.notes[2].hidden===true);
  ok('existing / planned is kept on the device',D.devices[0].sk.st==='meglevo'&&D.devices[1].sk.st==='tervezett');
  ok('ids stay unique after the Planner\'s own pass',(()=>{w.ensureIds(D);const ids=[];w.eval('UKEYS').forEach(k=>(D[k]||[]).forEach(r=>ids.push(r.id)));return ids.length===new Set(ids).size;})());

  // ---------- 4. the mark ----------
  let sc=scene();
  ok('two inferred edges drawn',(sc.match(/class="ski-edge"/g)||[]).length===2);
  ok('their length with ≈',sc.includes('≈ 2 000'));
  ok('the inferred room is labelled',(sc.match(/≈ becsült méret/g)||[]).length===1);
  ok('the measured room has no mark',(sc.match(/class="ski-room"/g)||[]).length===1);
  ok('the action is offered',w.actionById('sketch.confirm')&&w.actionById('sketch.confirm').when({})===true);

  // ---------- 5. checked ----------
  ok('confirm clears 2 edges',w.skiConfirm('ground')===2);
  ok('no mark after confirm',!/ski-/.test(scene()));
  ok('the edges count as derived now',D.floors[1].sk.est.length===0&&D.floors[1].sk.der.length===4&&D.floors[1].sk.checked===true);
  w.doUndo();
  ok('undo brings the mark back',(scene().match(/class="ski-edge"/g)||[]).length===2);

  // ---------- 6. Fotópont (Mobile WP M25) ----------
  const ph=D.notes[2];
  ok('the photo point sits in the middle of Nappali',ph.sk.photo&&ph.x===2000&&ph.y===1600&&ph.sk.room==='Nappali');
  ok('its one shot faces K with the board file name',ph.sk.shots.length===1&&ph.sk.shots[0].deg===90&&ph.sk.shots[0].file==='kossuth-u-12_F99_kelet.jpg');
  scene();sc=$('vp').innerHTML;   // the photo point is on the overlay (an editing aid, not printed)
  ok('the point and one filled cone + three empty ones are drawn',(sc.match(/class="ski-photo"/g)||[]).length===1
    &&(sc.match(/class="ski-cone"/g)||[]).length===1&&(sc.match(/class="ski-cone-empty"/g)||[]).length===3);
  ok('the hidden note draws no pin of its own',!sc.includes('Fotópont · Nappali'));
  ok('the photos action is offered',w.actionById('sketch.photos').when({})===true);
  const F=(n)=>new w.File(['x'],n,{type:'image/jpeg'});
  const r1=await w.skiAttach([F('kossuth-u-12_F99_kelet.jpg'),F('masik_F1_del.jpg')],async()=>'data:image/jpeg;base64,AAAA');
  ok('a board file matches its shot by name, a stranger is reported',r1.matched===1&&r1.unknown.join()==='masik_F1_del.jpg');
  ok('the thumbnail is kept on the shot',ph.sk.shots[0].thumb==='data:image/jpeg;base64,AAAA'&&ph.sk.shots[0].seen===true);
  w.doUndo();
  ok('attaching is one undo step',!D.notes[2].sk.shots[0].thumb);
  const r2=await w.skiAttach([F('kossuth-u-12_F99_kelet.jpg')],async()=>null);
  ok('no thumbnail (no canvas): the file is still matched',r2.matched===1&&D.notes[2].sk.shots[0].seen===true&&!D.notes[2].sk.shots[0].thumb);
  w.skiOpenPhotos();
  ok('the panel lists the four sides',/Nappali/.test($('skiList').innerHTML)&&(($('skiList').innerHTML.match(/nincs fotó/g))||[]).length===3);
  w.closeModal();

  // ---------- 7. through "Terv betöltése fájlból" ----------
  w.hardResetWorkspace();
  w.importProjectFile(new w.File([PKG],'kossuth.vsketch.json',{type:'application/json'}));
  await new Promise(r=>setTimeout(r,400));
  ok('the file import takes the package',D.floors.length===2&&D.devices.length===4&&/Vázlat betöltve/.test($('hud').textContent));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
