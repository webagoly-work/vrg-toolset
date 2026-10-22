// Views V6 — the stack plates (docs/views/WORKPLAN.md WP V6, DECISIONS D-V6-1…4).
//
// Fixture: the committed CLA v2 furnished plan (Calculator/CLA-teszt_v2_butor.vplan.json), ground floor (H 2850).
// Core camera (default def): yaw 225, pitch 50, k 0.105 → Δz mm moves a point by −Δz·cos50°·0.105 on screen.
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
  const A=w.viewRender({}),B=w.viewRender({plates:{step:900}}),P=B.stats.plates;
  const ROLES='mark hw base channel sys:DED sys:SOC sys:LIGHT sys:LV sys:BUSB sys:CONTROL sys:DATA sys:SENSOR sys:HMI sys:MEDIA sys:USB sys:SECURITY';
  ok('16 plates in STK_ROLES order',P.map(p=>p.role).join(' ')===ROLES,P.map(p=>p.role).join(' '));
  ok('counts 15 3 1 5 5 18 38 7 11 5 5 16 5 10 1 3',P.map(p=>p.n).join(' ')==='15 3 1 5 5 18 38 7 11 5 5 16 5 10 1 3',P.map(p=>p.n).join(' '));
  ok('plate k at 2850 + 900 (k + 1): 3750 … 17250',P.every((p,k)=>p.z===2850+900*(k+1))&&P[0].z===3750&&P[15].z===17250);
  ok('no Szerkezet / ARM plate',!P.some(p=>p.role==='construct'||p.role==='arm'));
  ok('key leaders: 14 (3 hardware + 1 BASE + 2 × 5 channel ends)',B.stats.leaders===14,B.stats.leaders);
  ok('all leaders: 153 (15 marks + 128 endpoints + 10 channel ends)',w.viewRender({plates:{step:900,leaders:'all'}}).stats.leaders===153);
  ok('the house part of the list = the plain render',(function(){const n=A.prims.length;
    return JSON.stringify(B.prims.slice(0,n).map(p=>[p.k,p.t,p.p||p.s||p.a]))===JSON.stringify(A.prims.map(p=>[p.k,p.t,p.p||p.s||p.a]));})());
  ok('the upper floor ghosts once, at 2850 (real heights)',JSON.stringify(B.stats.ghosts)==='[{"level":"upper","z":2850}]',JSON.stringify(B.stats.ghosts));
  ok('ghost outlines are drawn',B.prims.some(p=>p.k==='gline'&&p.grp==='ghost:upper'));
  // an endpoint on its plate: house x, lifted by (plate z − its own height)
  ok('every Világítás item sits above its house point by exactly 9150 − h',(function(){const L=w.__data.devices.filter(d=>d.level==='ground'&&w.layerById(d.layer).role==='sys:LIGHT');
    const he=A.prims.filter(p=>p.k==='ep'&&p.role==='sys:LIGHT'),pe=B.prims.filter(p=>p.k==='ep'&&p.grp==='sys:LIGHT');
    return pe.length===38&&pe.every(q=>he.some(h=>Math.abs(h.s[0]-q.s[0])<1e-9&&L.some(d=>Math.abs((q.s[1]-h.s[1])/F-(9150-(d.h||0)))<1e-6)));})());
  ok('a hardware leader runs from its plate (4650) down to the device',(function(){const l=B.prims.filter(p=>p.k==='lead'&&p.grp==='hw');
    return l.length===3&&l.every(p=>Math.abs(p.a[0]-p.b[0])<1e-9&&p.a[1]<p.b[1]);})());
  ok('5 channel polylines on the Csatorna plate',B.prims.filter(p=>p.k==='pline'&&p.grp==='channel').length===5);
  ok('plate labels: role name · count, e.g. Világítás · 38',B.prims.some(p=>p.t==='label.plate'&&p.txt==='Világítás · 38')&&B.prims.filter(p=>p.t==='label.plate').length===16);
  ok('bounds: the top is the last plate (17250), the bottom stays',Math.abs((B.bounds.minY-A.bounds.minY)/F-(17250-2850))<1e-6&&Math.abs(B.bounds.maxY-A.bounds.maxY)<1e-9);
  ok('the labels fit: bounds reach left of every plate label',B.prims.filter(p=>p.t==='label.plate').every(p=>B.bounds.minX<=p.at[0]-p.txt.length*5.188));
  ok('step 600 → the first plate at 3450',w.viewRender({plates:{step:600}}).stats.plates[0].z===3450);
  ok('explode is ignored under plates',(function(){const C=w.viewRender({plates:{step:900},explode:{step:900}});return !C.stats.lifts&&C.svg===B.svg;})());
  ok('plates off = the plain render, byte for byte',w.viewRender({plates:null}).svg===A.svg);
  ok('the footprint is two loops (16 + 4 corners)',w.viewFootprint(w.viewModel('ground').walls,w.viewModel('ground').rooms).map(l=>l.length).join(' ')==='16 4');
  ok('deterministic',w.viewRender({plates:{step:900}}).svg===B.svg);
  ok('the sheet parses as SVG',(function(){const d=new w.DOMParser().parseFromString(w.viewSheetSvg(B).svg,'image/svg+xml');return !d.getElementsByTagName('parsererror').length;})());
  // the export menu
  ok('menu: Rétegek + minden elemhez vezetővonal, both off',!!$('expPlates')&&!!$('expLeadAll')&&!$('expPlates').checked&&!$('expLeadAll').checked&&E('vexpPlates')()===null);
  ok('ticked → {step 900, key}; with all → leaders all',(function(){$('expPlates').checked=true;const a=E('vexpPlates')();$('expLeadAll').checked=true;const b=E('vexpPlates')();
    $('expPlates').checked=false;$('expLeadAll').checked=false;return a.step===900&&a.leaders==='key'&&b.leaders==='all';})());
  ok('the export subtitle and file name say so',(function(){const S=w.vexpSheet('axo','CLA',{plates:{step:900,leaders:'key'}});
    $('expPlates').checked=true;$('expView').value='axo';$('expTitle').value='CLA';const n=E('vexpName')('png');$('expPlates').checked=false;
    return S.svg.includes(' · rétegek 16, lépcső 900 mm</text>')&&n==='axo_CLA_axo_retegek.png'?true:n;})()===true);
  ok('the data is untouched',JSON.stringify(w.__data)===before);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
