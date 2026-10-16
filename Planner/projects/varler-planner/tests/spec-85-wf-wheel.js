// Workflow round WP-R1 — the room-type wheel (src/08f-wf-wheel.js).
// What must hold (docs/workflow/WP-R1_room-type-wheel.md; R01 A, R02 A, R08 A): the angle → sector rule (0 up,
// clockwise, hub = none); toggling kinds (multi-type, kind = kinds[0]); the auto name; the ring switch at South; the
// three new explicit-only kinds with inherited needs; a pen click inside a room opens the wheel, a click on its edge
// still draws; the tint follows; Esc / RMB close.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  const RW=w.eval('RW');
  // 1. sectors
  ok('up → 0',w.rwSectorAt(0,-100,8)===0);ok('right → 2',w.rwSectorAt(100,0,8)===2);
  ok('down → 4 (South)',w.rwSectorAt(0,100,8)===4);ok('up-left → 7',w.rwSectorAt(-70,-70,8)===7);
  ok('the hub → none',w.rwSectorAt(10,10,8)===null);
  // 2. toggling
  D.floors.length=0;D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'',stage:'floor',clear:true,fillAuto:true,fill:'#e2ddd0',layer:'L0'});
  const rm=D.floors[0];
  w.rwOpenRoom({rm},400,300);ok('the wheel opens at the pointer',RW.open&&w.document.getElementById('rwWheel').style.display==='block');
  ok('ring 1 shows Nappali … Közlekedő and Továbbiak',/Nappali/.test(w.document.getElementById('rwWheel').innerHTML)&&/Továbbiak/.test(w.document.getElementById('rwWheel').innerHTML));
  w.rwChoose(1);ok('Konyha picked → kinds [konyha], kind konyha',JSON.stringify(rm.kinds)==='["konyha"]'&&rm.kind==='konyha');
  ok('a plain pick closes the wheel',!RW.open);
  ok('the room is named after its kind',rm.name==='Konyha'&&rm.nameAuto===true);
  ok('the floor tint follows (#dbdfce)',rm.fill==='#dbdfce',rm.fill);
  w.rwOpenRoom({rm},400,300);w.rwChoose(4);ok('South → ring 2',RW.ring===1&&RW.open);
  w.rwChoose(0);ok('Étkező added → Konyha + Étkező',JSON.stringify(rm.kinds)==='["konyha","etkezo"]'&&rm.name==='Konyha + Étkező');
  w.rwOpenRoom({rm},400,300);w.rwChoose(1);ok('Konyha again → removed, kind becomes etkezo',JSON.stringify(rm.kinds)==='["etkezo"]'&&rm.kind==='etkezo'&&rm.name==='Étkező');
  w.rwOpenRoom({rm},400,300);w.rwChoose(4);w.rwChoose(0);ok('last kind off → no kinds, name cleared',!rm.kinds&&!rm.kind&&rm.name==='');
  rm.name='Nagy szoba';w.rwOpenRoom({rm},400,300);w.rwChoose(2);ok('a user name stays',rm.name==='Nagy szoba'&&rm.kind==='halo');
  w.rwOpenRoom({rm},400,300);w.rwChoose(4);w.rwChoose(4);ok('South on ring 2 → ring 3',RW.ring===2);
  w.rwChoose(4);ok('South on the last ring → back to ring 1',RW.ring===0);
  RW.ring=2;ok('an empty sector does nothing',w.rwChoose(2)===false&&RW.open);
  w.rwChoose(0,true);ok('Shift keeps the wheel open',RW.open&&rm.kinds.indexOf('kulter')>=0);
  w.rwClose();ok('a closed wheel ignores a pick',w.rwChoose(1)===false);w.rwOpenRoom({rm},400,300);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));ok('Esc closes it',!RW.open);
  // 3. new kinds
  ok('Gyerekszoba, Gardrób, Mosókonyha exist',['gyerek','gardrob','mosokonyha'].every(k=>w.NEED_KINDS.some(x=>x.k===k)));
  ok('"Gyerekszoba" by NAME is still Háló (explicit-only kinds)',w.needKind({name:'Gyerekszoba'})==='halo');
  ok('kind gyerek inherits Háló needs',w.needDefaults({kind:'gyerek'},'sys:DATA').codes.join()===w.needDefaults({kind:'halo'},'sys:DATA').codes.join());
  // 3b. Q-R10 A: double-click in Select
  w.setMode('select');w.draw();w.eval('hitTest=()=>null');
  w.eval('clientToBase=()=>[0,0];baseToPlan=()=>[2000,1500,0]');
  w.eval('stage').dispatchEvent(new w.MouseEvent('dblclick',{clientX:300,clientY:300,bubbles:true}));
  ok('Select: double-click on a room opens the wheel',RW.open&&RW.room===rm);w.rwClose();
  w.setMode('wall');w.eval('stage').dispatchEvent(new w.MouseEvent('dblclick',{clientX:300,clientY:300,bubbles:true}));
  ok('other tools: double-click does nothing',!RW.open);
  // 4. the pen click
  st.zoom=1;w.setMode('room');w.wfpOff();
  ok('rwRoomAt finds the room',w.rwRoomAt([2000,1500]).rm===rm);
  ok('a point on its edge is snapped as an edge (the pen draws, no wheel)',w.wfpSnapPt([4003,1500],false).kind==='edge');
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
