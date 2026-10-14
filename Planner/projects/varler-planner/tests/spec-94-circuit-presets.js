// Round 2026-10-10 WP-M2 — circuit presets (src/08o-cpr.js). Tests 1–9 of docs/round-2026-10-10/WP-M2_circuit-presets.md
// (answers M06 C-curve default + NV4 sample + klíma 1–2 expected · M07 A with Esc → B · M08 A) + the verifier's
// mcbParse round-trip of every catalogue string.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const NV4=JSON.parse(fs.readFileSync(path.join(__dirname,'..','docs','round-2026-10-10','samples','NV4-minta.vrg-elo-presets.json'),'utf8'));
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  let ask=true;w.confirm=()=>ask;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.devices.length=0;D.circuits=[];D.eloPresets=[];
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  D.floors.push({level:'ground',poly:rect(0,0,4000,3000),name:'Konyha',num:'R03',kinds:['konyha'],kind:'konyha',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(4000,0,7000,3000),name:'Háló',num:'R04',kinds:['halo'],kind:'halo',stage:'floor',clear:true,layer:'L0'});
  w.ensureIds(D);const [K,H]=D.floors;
  const CAT=w.eval('CPR_CAT');
  // 0. the verifier: every catalogue breaker string round-trips
  ok('every catalogue mcb round-trips through mcbParse / mcbText',CAT.every(r=>{const m=w.mcbParse(r.mcb);return !m.err&&w.mcbParse(w.mcbText(m)).amps===m.amps;}),CAT.filter(r=>w.mcbParse(r.mcb).err).map(r=>r.key).join());
  ok('… including 1P-N C16A, 3C 25A, 1B 6A',w.mcbText(w.mcbParse('1P-N C16A'))==='1P-N C16A'&&w.mcbText(w.mcbParse('3C 25A'))==='3C 25A'&&w.mcbText(w.mcbParse('1B 6A'))==='1B 6A');
  // 1. the list
  ok('no eloPresets → the catalogue ('+CAT.length+' rows)',w.cprList()===CAT&&!w.cprOwn());
  w.cprEdit('dugsz',{mcb:'1C 16A'});
  ok('an edit copies the catalogue in, with ids E…',w.cprOwn()&&D.eloPresets.length===CAT.length&&/^E\d+$/.test(D.eloPresets[0].id));
  w.doUndo();ok('undo restores the empty state',!w.cprOwn());
  // 2. activate konyhaA
  const c=w.cprActivate('konyhaA');
  ok('konyhaA → a 05j circuit with preset, mcb 1C 16A',c&&c.preset==='konyhaA'&&c.mcb.curve==='C'&&c.mcb.amps===16&&c.mcb.poles===1);
  ok('rooms pre-filled with the kitchen',JSON.stringify(c.rooms)===JSON.stringify([K.id]));
  ok('waiting for its endpoint (no members)',w.cktStatus(c).k==='empty');
  const rowA=D.eloPresets.find(r=>r.key==='konyhaA');w.cprSetCurve(rowA.id,'B');
  ok('toggle B → 1B 16A, the circuit follows',w.mcbText(w.cktById(c.id).mcb)==='1B 16A'&&rowA.mcb==='1B 16A');
  // 3. the box menu
  D.devices.push({type:'box',level:'ground',x:1000,y:1500,h:1100,layer:'L0'});w.ensureIds(D);const box=D.devices[D.devices.length-1];
  const ch=w.cprChoices(box);ok('a box in the Konyha lists konyhaA first',ch.active[0]&&ch.active[0].preset==='konyhaA');
  ok('… then fitting presets (konyhaB, not dugsz)',ch.presets.some(r=>r.key==='konyhaB')&&!ch.presets.some(r=>r.key==='dugsz'));
  // 4. room reminder
  const warn=()=>w.cprRoomWarnings().filter(x=>/Konyha/.test(x.msg)&&/Konyhai munkalap A/.test(x.msg));
  ok('an active room circuit with no endpoint → the room line',warn().length===1&&/^R03 Konyha: a „Konyhai munkalap A” kör vár végpontra$/.test(warn()[0].msg),JSON.stringify(warn()));
  w.cprChoose(box,{c:w.cktById(c.id)});
  ok('choosing it → the box is a member, pick mode on',w.cktOfDevice(box)&&w.cktOfDevice(box).id===c.id&&w.cktIsPicking()===c.id);
  ok('… and the room line is gone',warn().length===0);
  // 7. Esc at once → B
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  ok('Esc at once: the box is released, the circuit stays active and waiting',!w.cktOfDevice(box)&&!w.cktById(c.id).off&&w.cktStatus(w.cktById(c.id)).k==='empty');
  D.devices.push({type:'box',level:'ground',x:2000,y:1500,h:1100,layer:'L0'});w.ensureIds(D);const box2=D.devices[D.devices.length-1];
  w.cprChoose(box,{c:w.cktById(c.id)});w.cktPickToggle(D.devices.indexOf(box2));
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  ok('choose → one more box → Esc: both stay members',w.cktOfDevice(box)&&w.cktOfDevice(box2)&&w.cktMembers(w.cktById(c.id)).length===2);
  // 6. deactivate with members
  ask=false;ok('deactivate with members asks; "no" changes nothing',w.cprDeactivate(rowA.id)===false&&w.cktMembers(w.cktById(c.id)).length===2);
  ask=true;w.cprDeactivate(rowA.id);const cc=w.cktById(c.id);
  ok('"yes" keeps the record, deactivated, members released',cc&&cc.off===true&&cc.members.length===0&&!w.cktOfDevice(box));
  w.cprActivate(rowA.id);ok('re-ticking wakes the same circuit',w.cktById(c.id).off===false&&w.cktList().filter(x=>x.preset==='konyhaA').length===1);
  // 5. export / import
  const ex=JSON.parse(JSON.stringify(w.cprExportObj()));
  ok('export: vrg-elo-presets v1, no ids',ex.format==='vrg-elo-presets'&&ex.v===1&&ex.items.length===CAT.length&&!ex.items.some(i=>i.id));
  D.eloPresets=[];D.circuits=[];const r0=w.cprImport(ex);
  ok('import into an empty project → the same rows',r0.added===CAT.length&&D.eloPresets.length===CAT.length&&D.eloPresets[3].key===ex.items[3].key);
  const before=JSON.stringify(D.eloPresets.find(r=>r.key==='vil'));
  const r1=w.cprImport({format:'vrg-elo-presets',v:1,items:[Object.assign({},ex.items[0],{mcb:'1B 6A'})]},()=>'keep');
  ok('a conflicting key+name with "keep" → unchanged',r1.kept===1&&JSON.stringify(D.eloPresets.find(r=>r.key==='vil'))===before);
  ok('a bad file is refused',!!w.cprImport({format:'x'}).err);
  // 8. NV4 sample
  D.eloPresets=[];D.circuits=[];const r2=w.cprImport(NV4);
  ok('NV4 → 13 rows',r2.added===13&&D.eloPresets.length===13);
  ok('vil parses as 1B 10A',w.mcbText(w.mcbParse(D.eloPresets.find(r=>r.key==='vil').mcb))==='1B 10A');
  ok('the bundled NV4 equals the sample file',JSON.stringify(w.eval('CPR_SAMPLE_NV4').items)===JSON.stringify(NV4.items));
  // 9. duplicate keys stay separate
  ok('three szobakor and three klima rows kept separately',D.eloPresets.filter(r=>r.key==='szobakor').length===3&&D.eloPresets.filter(r=>r.key==='klima').length===3);
  const kl=D.eloPresets.filter(r=>r.key==='klima'),klW=()=>w.cprReminders().some(x=>x.key==='klima');
  ok('zero klíma active → ⚠ alapkör',klW());
  w.cprActivate(kl[0].id);ok('one klíma → no reminder (1–2 expected)',!klW());
  w.cprActivate(kl[1].id);w.cprActivate(kl[2].id);ok('three klíma → no reminder',!klW()&&w.cktList().filter(x=>x.preset==='klima').length===3);
  ok('every klíma circuit is dedikált',w.cktList().filter(x=>x.preset==='klima').every(x=>x.dedicated));
  // dismiss + custom + the dialog
  const vw=()=>w.cprReminders().some(x=>x.key==='vil');ok('vil not active → reminder',vw());w.cprDismiss(D.eloPresets.find(r=>r.key==='vil').id);ok('× dismiss → gone',!vw());
  const cu=w.cprAddCustom();ok('＋ Saját kör',cu.custom&&/^sajat\d+$/.test(cu.key)&&/^E\d+$/.test(cu.id));
  w.cprDialog();const body=w.document.getElementById('cprBody');
  ok('the dialog lists the tiers and the NV4 button',body&&/Alap/.test(body.innerHTML)&&/Minta betöltése/.test(body.innerHTML));
  ok('the Elosztó panel line exists',!!w.document.getElementById('cprLine'));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
