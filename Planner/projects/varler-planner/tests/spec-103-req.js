// Round 2026-10-18 WP-N1 + N2 — Igénylista (src/08q-req.js): the counted request list per room.
// 1. the role / layer: optional Igények right after Jelölés (stack) or a plain layer (no stack); 2. the switch rows from
// k and the door count; 3. the room-kind suggestions; 4. reqSet / reqClean clamps + undo, reqTake (keep), reqClear;
// 5. the Ház = the sum of the rooms (N3 B).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);const J=o=>JSON.stringify(o);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  WL.ground.push({x0:-100,y0:-100,x1:8100,y1:0,id:'W1'},{x0:-100,y0:3000,x1:8100,y1:3100,id:'W2'},{x0:-100,y0:0,x1:0,y1:3000,id:'W3'},
    {x0:4000,y0:0,x1:4100,y1:3000,id:'W4'},{x0:8000,y0:0,x1:8100,y1:3000,id:'W5'});
  D.floors.length=0;D.openings.length=0;D.marks=[];
  const room=(name,kind,poly)=>{const f={level:'ground',poly,name,kind,layer:'L0'};D.floors.push(f);return f;};
  let A=room('Háló','halo',[[0,0],[4000,0],[4000,3000],[0,3000]]);let B=room('Nappali','nappali',[[4100,0],[8000,0],[8000,3000],[4100,3000]]);
  w.ensureIds(D);
  // ---- 1. the role and the layer ----
  const ks=w.STK_ROLES.map(r=>r.k),need=w.STK_ROLES.find(r=>r.k==='need');
  ok('role need (Igények) sits right after Jelölés, optional phase-1',ks.indexOf('need')===ks.indexOf('mark')+1&&need.ph===1&&need.opt===true);
  ok('it has an icon, a colour of its own and an Info text',w.eval("STK_ICONS").need==='☑'&&w.STK_COL.need&&Object.values(w.STK_COL).filter(c=>c===w.STK_COL.need).length===1&&w.RLI_TEXT.need&&w.RLI_TEXT.need.cel);
  const n0=w.eval("layers").length;const L0=w.reqLayerAdd();
  ok('without a stack: a plain layer {req:true} named Igények, active',L0.req===true&&!L0.stack&&L0.name==='Igények'&&w.__state.activeLayer===L0.id&&w.eval("layers").length===n0+1);
  ok('asking again returns the same layer',w.reqLayerAdd()===L0&&w.eval("layers").length===n0+1);
  w.eval("layers").splice(w.eval("layers").indexOf(L0),1);
  const S=w.stkCreate({name:'T'});
  ok('a new stack does not get the optional Igények layer',!w.stkLayer(S.id,'need'));
  const L1=w.reqLayerAdd(),mk=w.stkLayer(S.id,'mark');
  ok('inside a stack: role need, placed right after the Jelölés layer',L1.role==='need'&&L1.stack===S.id&&w.eval("layers").indexOf(L1)===w.eval("layers").indexOf(mk)+1&&w.reqLayer()===L1);
  ok('…and the stack record lists it in role order',S.layers.indexOf(L1.id)===S.layers.indexOf(mk.id)+1);
  // ---- 2. switch rows ----
  ok('1 door: k 1 → 101, k 2 → 105, k 3 → 105 + 101',J(w.reqSwAuto(1,1))===J(['101'])&&J(w.reqSwAuto(2,1))===J(['105'])&&J(w.reqSwAuto(3,1))===J(['105','101']));
  ok('2 doors: k 1 → 106 pair, k 2 → 108 pair',J(w.reqSwAuto(1,2))===J(['106','106'])&&J(w.reqSwAuto(2,2))===J(['108','108']));
  ok('3 doors: 106 + 107 + 106; 4 doors: 106 + 107 + 107 + 106',J(w.reqSwAuto(1,3))===J(['106','107','106'])&&J(w.reqSwAuto(1,4))===J(['106','107','107','106']));
  // ---- 3. suggestions ----
  const sA=w.reqSuggest(A);
  ok('Háló (R1): soc 4 (2 dupla), lámpa 1 / 1 / 1, one string 106 + 107 + 106 (ajtó, ágy két oldala)',sA.kind==='halo'&&J(sA.items.soc)===J({n:4,dbl:2})&&J(sA.items.lmp)===J({n:1,k:1,v:1})&&J(sA.items.swi.rows.map(r=>r.type))===J(['106','107','106']),J(sA));
  ok('…and the bedside reading light offered (2 sides), not applied',sA.opt.read===2&&!sA.items.read);
  const sB=w.reqSuggest(B);
  ok('Nappali: soc 6 (2 dupla), lámpa 3 on 2 kapcsolási kör, one 105',J(sB.items.soc)===J({n:6,dbl:2})&&sB.items.lmp.n===3&&sB.items.lmp.k===2&&J(sB.items.swi.rows.map(r=>r.type))===J(['105']));
  const K=room('Konyha','konyha',[[0,4000],[3000,4000],[3000,7000],[0,7000]]);
  const sK=w.reqSuggest(K);
  ok('Konyha: soc 5 + hűtő / mosogatógép / páraelszívó 1900, sütő 16 A + főzőlap 3 × 16 A',sK.items.soc.n===5&&sK.items.soc_app.rows.length===3&&sK.items.soc_app.rows[2].h===1900
    &&sK.items.ded.rows.length===2&&sK.items.ded.rows[1].ph===3);
  const KZ=room('Folyosó','kozlekedo',[[0,8000],[7400,8000],[7400,9200],[0,9200]]);
  ok('Közlekedő 7.4 m: lámpa by length = 2 (1 / 3 m), auto switch with 1 door → 101',w.reqSuggest(KZ).items.lmp.n===2&&J(w.reqSuggest(KZ).items.swi.rows.map(r=>r.type))===J(['101']));
  const WC=room('WC','wc',[[5000,4000],[6000,4000],[6000,5500],[5000,5500]]);
  ok('WC: no socket item, lámpa 1/1, 101',!w.reqSuggest(WC).items.soc&&w.reqSuggest(WC).items.lmp.n===1&&w.reqSuggest(WC).items.swi.rows[0].type==='101');
  ok('an unknown name falls back to Egyéb: soc 2, lámpa 1/1',(function(){const x=room('Valami','',[[9000,0],[10000,0],[10000,1000],[9000,1000]]);delete x.kind;const s=w.reqSuggest(x);D.floors.pop();return s.kind==='egyeb'&&s.items.soc.n===2;})());
  // ---- 4. set / clean / take / clear ----
  ok('a room starts with no request (a suggestion is only taken by the user)',!w.reqSaved(A)&&J(w.reqItems(A))==='{}');
  const u0=w.__undoLen();
  w.reqSet(A,'lmp',{n:2,k:5,v:4});
  ok('reqSet is one undo step and clamps k ≤ n and v ≤ k',w.__undoLen()===u0+1&&J(A.req.items.lmp)===J({n:2,k:2,v:2}));
  w.reqSet(A,'lmp',{n:3,k:2,v:1,pair:[{kk:1,vk:1},{kk:2,vk:1},{kk:3,vk:1}]});
  ok('the optional pairing keeps only kapcsolási kör / világítási kör that exist',A.req.items.lmp.pair.length===2);
  w.reqSet(A,'swi',{rows:[{type:'106'},{type:'104'},{type:'redony'}]});
  ok('switch rows keep only known types (104 dropped)',J(A.req.items.swi.rows.map(r=>r.type))===J(['106','redony']));
  w.reqSet(A,'soc',{n:3,dbl:7});
  ok('dupla ≤ n',J(A.req.items.soc)===J({n:3,dbl:3}));
  w.reqSet(A,'soc',null);
  ok('null removes an item',!A.req.items.soc);
  w.doUndo();A=D.floors.find(f=>f.name==='Háló');B=D.floors.find(f=>f.name==='Nappali');   // undo restores the floors array: re-resolve
  ok('undo brings it back',A.req.items.soc&&A.req.items.soc.n===3);
  w.reqTake(A,true);
  ok('take the suggestion keeping what the user set: lmp stays 3/2/1, soc stays 3, swi stays, the rest from the suggestion',
    A.req.items.lmp.n===3&&A.req.items.soc.n===3&&J(A.req.items.swi.rows.map(r=>r.type))===J(['106','redony']));
  w.reqTake(B);
  ok('take without keep = exactly the suggestion',J(B.req.items)===J(Object.fromEntries(Object.entries(w.reqSuggest(B).items).map(([k,v])=>[k,w.reqClean(k,v)]))));
  // ---- 5. the house ----
  const H=w.reqHouseSum();
  ok('Ház = sum of rooms: dugalj 3 + 6 = 9, 2 rooms',H.soc.n===9&&H.soc.rooms===2,J(H.soc));
  ok("…lámpa 3 + 3 = 6 on 2 + 2 = 4 kapcsolási kör",H.lmp.n===6&&H.lmp.k===4,J(H.lmp));
  ok('…switches by type: 106 1, redony 1, 105 1',H.swi.byType['106']===1&&H.swi.byType.redony===1&&H.swi.byType['105']===1);
  w.reqClear(A);
  ok('reqClear removes the room\'s list; the house follows',!A.req&&w.reqHouseSum().soc.n===6);
  // ---- 6. N4: totals, what the room has, status ----
  w.reqTake(A);w.reqSet(A,"read",{n:2});
  const T=w.reqTotals(A);
  ok("totals: the reading light adds a socket, a lamp, a kör and a 101 per side",T.SOC===6&&T.LMP===3&&T.KK===3&&T.SWI===5&&T.sw["101"]===2&&T.sw["107"]===1,J(T));
  let st0=w.reqStatus(A);
  ok("an empty room is hiányos, every hard row 0 / need",st0.st==="open"&&st0.rows.find(r=>r.k==="SOC").have===0);
  const dv=(type,x,y,o)=>{const d=Object.assign({type,level:"ground",x,y,h:300,layer:"L0"},o||{});D.devices.push(d);return d;};
  for(let i=0;i<6;i++)dv("socket",300+i*500,50);
  for(let i=0;i<3;i++)dv("light",1000+i*1000,1500,{h:2700,grp:"g"+i});
  dv("switch",3900,500,{h:1100,swType:"106"});dv("switch",300,2900,{h:1100,swType:"107"});dv("switch",3500,2900,{h:1100,swType:"106"});
  dv("switch",200,1500,{h:900,swType:"101"});dv("switch",3800,1500,{h:900,swType:"101"});
  dv("socket",4500,50);   // in the Nappali — must not count for the Háló
  w.ensureIds(D);
  const Hv=w.reqHave(A);
  ok("reqHave counts the room only: 6 dugalj, 3 lámpa in 3 groups, 5 switches",Hv.SOC===6&&Hv.LMP===3&&Hv.KK===3&&Hv.SWI===5&&Hv.sw["106"]===2,J(Hv));
  st0=w.reqStatus(A);
  ok("everything placed → kész",st0.st==="done",J(st0.rows));
  D.devices.splice(D.devices.findIndex(d=>d.type==="light"),1);
  ok("one lamp missing → hiányos again",w.reqStatus(A).st==="open");
  ok("05t reads the counts (N1 A): sys:SOC → SOC, sys:LIGHT → LMP + SWI",J(w.needOf(A,"sys:SOC"))===J({SOC:true})&&J(Object.keys(w.needOf(A,"sys:LIGHT")).sort())===J(["LMP","SWI"]));
  ok("a room without a list keeps the 05t defaults",!w.reqNeedOf(WC,"sys:SOC"));
  // ---- 7. N3: the dialog ----
  w.reqDialog(A);
  const doc=w.document;
  ok("the dialog opens with every item row and the kell / van table",doc.querySelectorAll(".rqOn").length===7&&/kell/.test(doc.getElementById("rqBody").innerHTML));
  ok("the lamp row reads n lámpa · k kapcsolási kör · v világítási kör",/kapcsolási kör/.test(doc.getElementById("rqBody").innerHTML)&&/világítási kör/.test(doc.getElementById("rqBody").innerHTML));
  const box=[...doc.querySelectorAll(".rqOn")].find(c=>c.dataset.k==="shu");box.checked=true;box.onchange();
  ok("ticking Redőny adds it (no tagged window → 1)",A.req.items.shu&&A.req.items.shu.n===1);
  const kin=[...doc.querySelectorAll(".rqF")].find(c=>c.dataset.k==="lmp"&&c.dataset.f==="k");kin.value="1";kin.onchange();
  ok("editing the kapcsolási kör field stores it",A.req.items.lmp.k===1);
  const add=[...doc.querySelectorAll(".rqAdd")].find(a=>a.dataset.k==="swi");add.onclick({preventDefault(){}});
  ok("+ sor adds a 101 switch row",A.req.items.swi.rows.length===4&&A.req.items.swi.rows[3].type==="101");
  const sel=[...doc.querySelectorAll(".rqF")].find(c=>c.dataset.k==="swi"&&c.dataset.i==="3");sel.value="105";sel.onchange();
  ok("the row type select changes it to 105",A.req.items.swi.rows[3].type==="105");
  w.closeModal();
  w.reqHouseDialog();
  ok("Ház összesítő opens with the room list",doc.querySelectorAll(".rqRoom").length>=5);
  w.closeModal();
  const HT=w.reqHouseTotals();
  ok("house totals add the rooms (Háló + Nappali lamps)",HT.LMP===w.reqTotals(A).LMP+w.reqTotals(B).LMP);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
