// Workflow round WP-E4 — click the Elosztó → suggested circuits (src/08oa-wf-eloplan.js; MATERIAL §6; Q-E04 = A).
// The WP's fixture: 2 bedrooms (4 sockets each), a kitchen (5 worktop sockets + főzőlap DED + sütő DED), a bathroom (2),
// a 32 m² living room (10 sockets) and 12 lamps → 10 rows: 2 DED · 2 bedroom · 1 kitchen · 1 wet · 2 living · V1 + V2.
// Then: unticking a row leaves its endpoints unassigned and listed; a re-run suggests only for what is left; one undo.
// (The WP's P33 cross-check is not a spec: P33's approved socket plan is hand-configured in p33.config.js, and the
//  client data under Calculator/P33-baseline is not in the repo.)
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
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.devices.length=0;D.circuits=[];D.eloPresets=[];
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  const room=(name,kind,x0,y0,x1,y1)=>{D.floors.push({level:'ground',poly:rect(x0,y0,x1,y1),name,kinds:[kind],kind,stage:'floor',clear:true,layer:'L0'});};
  room('Háló 1','halo',0,0,4000,3500);room('Háló 2','halo',4000,0,8000,3500);room('Konyha','konyha',0,3500,4000,7000);
  room('Fürdő','furdo',4000,3500,6000,6000);room('Nappali','nappali',0,7000,8000,11000);
  const dev=(code,x,y,o)=>{const d=Object.assign({type:w.epTypeFor(code),code,level:'ground',x,y,h:code==='LMP'?2700:300,layer:'L0'},o||{});D.devices.push(d);return d;};
  for(let i=0;i<4;i++){dev('SOC',500+i*800,300);dev('SOC',4500+i*800,300);}
  for(let i=0;i<5;i++)dev('SOC',400+i*700,3800,{h:1100,hVar:'pult'});
  dev('DED',3000,6500,{var:'hob32',hVar:'fozolap',h:600});dev('DED',1000,6500,{var:'g16',hVar:'suto'});
  dev('SOC',4500,5000);dev('SOC',5500,5000);
  for(let i=0;i<10;i++)dev('SOC',400+i*750,i%2?7300:10700);
  const lamp=(x,y)=>dev('LMP',x,y);[[1000,1700],[3000,1700],[5000,1700],[7000,1700],[5000,4700],[1000,5200],[2000,5200],[3000,5200],[1500,9000],[3500,9000],[5500,9000],[7000,9000]].forEach(p=>lamp(p[0],p[1]));
  D.devices.push({type:'board',level:'ground',x:100,y:7100,h:1600,layer:'L0'});w.ensureIds(D);const board=D.devices[D.devices.length-1];
  // 1. the rows
  let rows=w.elpSuggest(board.id);const names=rows.map(r=>r.name).sort();
  const want=['Főzőlap — Konyha','Fürdő dugalj','Háló 1 dugalj','Háló 2 dugalj','Konyha munkalap','Nappali dugalj I','Nappali dugalj II','Sütő — Konyha','Világítás — éjszakai zóna','Világítás — nappali zóna'];
  ok('10 rows with the expected names',rows.length===10&&JSON.stringify(names)===JSON.stringify(want.slice().sort()),JSON.stringify(names));
  const by=n=>rows.find(r=>r.name===n);
  ok('the living room is split 5 + 5 (32 m², 10 sockets)',by('Nappali dugalj I').members.length===5&&by('Nappali dugalj II').members.length===5);
  ok('the worktop row has the 5 worktop sockets, 2,5 mm², konyhaA',by('Konyha munkalap').members.length===5&&by('Konyha munkalap').mm2===2.5&&by('Konyha munkalap').preset==='konyhaA');
  ok('the hob is dedicated, 32 A, preset fozo',by('Főzőlap — Konyha').dedicated&&by('Főzőlap — Konyha').preset==='fozo'&&/32A/.test(by('Főzőlap — Konyha').mcb));
  ok('lighting: night = 5 lamps (bedrooms + bathroom), day = 7',by('Világítás — éjszakai zóna').members.length===5&&by('Világítás — nappali zóna').members.length===7);
  ok('lighting rows carry V1 / V2',by('Világítás — nappali zóna').ref==='V1'&&by('Világítás — éjszakai zóna').ref==='V2');
  // a lamp follows the zone of its switch: a switch in the kitchen (day) that controls the bathroom lamp
  const bathLamp=D.devices.find(d=>d.code==='LMP'&&d.x===5000&&d.y===4700);
  const sw=dev('SWI',3800,5000,{h:1100,ctl:[bathLamp.id]});w.ensureIds(D);
  rows=w.elpSuggest(board.id);
  ok('a lamp switched from the day zone follows its switch',rows.find(r=>r.name==='Világítás — nappali zóna').members.indexOf(bathLamp.id)>=0&&rows.find(r=>r.name==='Világítás — éjszakai zóna').members.length===4);
  // 2. apply with one row unticked
  rows.find(r=>r.name==='Háló 2 dugalj').on=false;
  const res=w.elpApply(rows);
  ok('9 circuits made, the 4 Háló 2 sockets left unassigned',res.made===9&&res.left===4&&w.elpUnassigned().every(d=>d.code==='SOC'&&d.y===300&&d.x>4000),JSON.stringify(res));
  ok('the HUD says so',/9 áramkör létrehozva · 4 végpont kör nélkül/.test(w.document.getElementById('hud').textContent));
  const C=w.cktList();
  ok('V1 / V2 refs kept, sockets numbered A…',C.some(c=>c.ref==='V1')&&C.some(c=>c.ref==='V2')&&C.filter(c=>/^A\d+$/.test(c.ref)).length===7);
  ok('the hob circuit: dedicated, one member, 32 A, preset fozo',(c=>c&&c.dedicated&&c.members.length===1&&c.mcb&&c.mcb.amps===32)(C.find(c=>c.preset==='fozo')));
  ok('the worktop circuit carries its room',(c=>c&&c.rooms.length===1&&c.rooms[0]===D.floors.find(f=>f.name==='Konyha').id)(C.find(c=>c.preset==='konyhaA')));
  // 3. re-run: only what is left
  rows=w.elpSuggest(board.id);ok('a re-run suggests only the Háló 2 sockets',rows.length===1&&rows[0].name==='Háló 2 dugalj'&&rows[0].members.length===4);
  // 4. one undo step
  w.doUndo();ok('one undo removes all 9',w.cktList().length===0);
  // 5. small rooms share by adjacency; a large-by-area room needs 4 sockets to be split
  D.devices=D.devices.filter(d=>d.type==='board');D.floors.length=0;
  room('Előszoba','eloszoba',0,0,3000,2000);room('WC','wc',3100,0,4500,2000);room('Kamra','kamra',9000,0,10000,1500);room('Dolgozó','dolgozo',0,3000,5000,7500);
  dev('SOC',500,1000);dev('SOC',1500,1000);dev('SOC',3500,1000);dev('SOC',9500,700);dev('SOC',1000,4000);dev('SOC',3000,4000);dev('SOC',4000,6000);w.ensureIds(D);
  rows=w.elpSuggest(board.id);const nm=rows.map(r=>r.name).sort();
  ok('Előszoba + WC (neighbours) share one row; the far Kamra gets its own',nm.indexOf('Előszoba · WC dugalj')>=0&&nm.indexOf('Kamra dugalj')>=0,JSON.stringify(nm));
  ok('a 22.5 m² room with 3 sockets stays one circuit',nm.indexOf('Dolgozó dugalj')>=0&&!nm.some(n=>/Dolgozó dugalj I/.test(n)));
  // 6. the entry points
  ok('the phase-4 button and the action exist',!!w.document.querySelector('#phBody .phGrid[data-ph="vill"] .tool[data-a="circuit.suggest"]')&&!!w.actionById('circuit.suggest'));
  w.runAction('circuit.suggest');const mt=w.document.getElementById('modal').textContent;
  ok('the action opens the table with ticks and the ＋ Saját áramkör button',/Áramkörök javaslata/.test(mt)&&w.document.querySelectorAll('.elpOn').length===rows.length&&!!w.document.getElementById('elpOwn'));
  w.closeModal();
  const items=[];w.STK_DEVMENU.forEach(f=>f(D.devices.indexOf(board),items));ok('the Elosztó menu offers it',items.some(i=>/Áramkörök javaslata/.test(i.label)));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
