// Views V5 slice 1 — the static exploded view (docs/views/WORKPLAN.md WP V5, DECISIONS D-V5-1),
// plus the two V4 look fixes (D-V4-3: no empty legend heading, Felülnézet rotation in the export).
//
// Fixture: the committed CLA v2 furnished plan (Calculator/CLA-teszt_v2_butor.vplan.json), ground floor.
// Core camera (default def): yaw 225, pitch 50, k 0.105 → a lift of L mm moves a point by −L·cos50°·0.105 on screen.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','CLA-teszt_v2_butor.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const st=w.__state,$=id=>w.document.getElementById(id),E=s=>w.eval(s);st.active='ground';
  const before=JSON.stringify(w.__data),F=-Math.cos(50*Math.PI/180)*0.105;
  const A=w.viewRender({}),B=w.viewRender({explode:{step:900}});
  const LIFTS={R01:900,R04:1800,R03L:2700,R03:3600,R05:4500,R08:5400,R06:6300,R07:7200};
  ok('order: entrance R01 first, then by distance: R01 R04 R03L R03 R05 R08 R06 R07',B.stats.order.join(' ')==='R01 R04 R03L R03 R05 R08 R06 R07',B.stats.order.join(' '));
  ok('lifts = (rank + 1) × 900',JSON.stringify(B.stats.lifts)===JSON.stringify(LIFTS),JSON.stringify(B.stats.lifts));
  ok('8 ground rooms, each once',B.stats.order.length===8&&new Set(B.stats.order).size===8&&w.viewModel('ground').rooms.length===8);
  ok('step 600 → R01 600, R07 4800',(function(){const C=w.viewRender({explode:{step:600}});return C.stats.lifts.R01===600&&C.stats.lifts.R07===4800;})());
  ok('step options: 900 · 600 · falmagasság (2850 on CLA)',w.VIEW_EXPLODE_STEPS.map(e=>e.n).join(' · ')==='900 mm · 600 mm · falmagasság'
    &&w.viewExplodeStep('ground','900')===900&&w.viewExplodeStep('ground','600')===600&&w.viewExplodeStep('ground','wall')===2850);
  ok('explode off = the plain render, byte for byte',w.viewRender({explode:null}).svg===A.svg);
  ok('shared walls split: the grid grows 78×78 → 83×81',A.stats.grid.join('x')==='78x78'&&B.stats.grid.join('x')==='83x81',B.stats.grid.join('x'));
  ok('every drawn cell has an owner room (no geometry left at lift 0)',B.prims.filter(p=>p.k==='poly'||p.k==='line').every(p=>p.grp&&LIFTS[p.grp]),
    B.prims.filter(p=>(p.k==='poly'||p.k==='line')&&!p.grp).length);
  ok('both halves of a shared wall: R03 and R05 own cells of the same wall line',(function(){
    const g=new Set(B.prims.filter(p=>p.t==='wall.top.cut').map(p=>p.grp));return g.has('R03')&&g.has('R05')&&g.size===8;})());
  // endpoints: same screen x, y moved by exactly their room's lift
  const key=p=>p.ref+'|'+p.type+'|'+p.s[0].toFixed(6),pe=new Map();A.prims.filter(p=>p.k==='ep').forEach(p=>pe.set(key(p),p));
  const eb=B.prims.filter(p=>p.k==='ep'),vals=Object.values(LIFTS);
  ok('128 endpoints, each at its plain x, lifted by one of the room lifts',eb.length===128&&eb.every(p=>{const q=pe.get(key(p));if(!q)return false;
    const L=(p.s[1]-q.s[1])/F;return vals.some(v=>Math.abs(v-L)<1e-6);}),eb.length);
  ok('a lamp’s drop line ends on its lifted floor',eb.filter(p=>p.drop).every(p=>{const q=pe.get(key(p));return q&&Math.abs((p.drop[1]-q.drop[1])-(p.s[1]-q.s[1]))<1e-9;}));
  ok('room label R03 lifted by 3600',(function(){const a=A.prims.find(p=>p.t==='label.room'&&p.sub==='R03'),b=B.prims.find(p=>p.t==='label.room'&&p.sub==='R03');
    return Math.abs(b.s[0]-a.s[0])<1e-9&&Math.abs((b.s[1]-a.s[1])/F-3600)<1e-6;})());
  ok('the entrance marker rides with R01 (900)',(function(){const a=A.prims.find(p=>p.t==='label.entry'),b=B.prims.find(p=>p.t==='label.entry');
    return Math.abs((b.s[1]-a.s[1])/F-900)<1e-6&&Math.abs((b.to[1]-a.to[1])/F-900)<1e-6;})());
  ok('bounds: the top rises by 8 × 900, the bottom stays',Math.abs((B.bounds.minY-A.bounds.minY)/F-7200)<1e-6&&Math.abs(B.bounds.maxY-A.bounds.maxY)<1e-9);
  ok('no entrance tag → the largest room first',(function(){const keep=w.__data.marks;w.__data.marks=[];const C=w.viewRender({explode:{step:900}});w.__data.marks=keep;
    const rooms=w.viewModel('ground').rooms,big=rooms.reduce((a,b)=>w.polyArea(b.poly)>w.polyArea(a.poly)?b:a);return C.stats.order[0]===(big.num||big.name);})());
  ok('deterministic',w.viewRender({explode:{step:900}}).svg===B.svg);
  // the export menu
  ok('menu: Szétszedve + Emelés lépcsője (900 default)',!!$('expExplode')&&$('expStep').options.length===3&&$('expStep').value==='900');
  ok('unticked → no explode',E('vexpExplode')()===null);
  ok('ticked + 600 → {step:600}',(function(){$('expExplode').checked=true;$('expStep').value='600';const e=E('vexpExplode')();$('expExplode').checked=false;$('expStep').value='900';return e&&e.step===600;})());
  ok('the export subtitle says so',w.vexpSheet('axo','CLA',{explode:{step:900}}).svg.includes(' · szétszedve, lépcső 900 mm</text>'));
  ok('the exploded export file name ends _szet',(function(){$('expExplode').checked=true;$('expView').value='axo';$('expTitle').value='CLA';const n=E('vexpName')('svg');$('expExplode').checked=false;return n==='axo_CLA_axo_szet.svg'?true:n;})()===true);
  // D-V4-3 fixes
  ok('Felülnézet: rotation 0 by default, 90 when asked',w.vexpSheet('top','').R.def.yaw===0&&w.vexpSheet('top','',{rot:90}).R.def.yaw===90&&w.vexpSheet('top','',{rot:45}).R.def.yaw===0);
  ok('Forgatás row: 0° 90° 180° 270°, shown only for Felülnézet',(function(){const r=$('expRot'),row=$('expRotRow'),v=$('expView');
    const opts=[...r.options].map(o=>o.textContent).join(' ');v.value='axo';v.onchange();const hid=row.style.display==='none';v.value='top';v.onchange();
    return opts==='0° 90° 180° 270°'&&hid&&row.style.display==='';})());
  ok('legend: no roles → no heading, JELEK at the top',(function(){const keep=w.__data.devices;w.__data.devices=[];const S=w.viewSheetSvg(w.viewRender({}));w.__data.devices=keep;
    return !S.svg.includes('VÉGPONTOK RENDSZERENKÉNT')&&S.svg.includes('<text class="lh" x="0" y="0">JELEK</text>');})());
  ok('the data is untouched',JSON.stringify(w.__data)===before);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
