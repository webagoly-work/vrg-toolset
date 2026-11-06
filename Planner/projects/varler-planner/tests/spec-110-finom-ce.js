// 2026-11-06 — 06f-finom.js: the Finom Alaprajz look + the classical-plan round CE-1 (letters), CE-5 (red = new), CE-7
// (the Finom sheet's legend). docs/research/2026-11-06_varler-document-style.md, 2026-11-06_classical-electrical-plan-review.md.
// Fixture: tools/practice/Gyakorlo_lakas_villany.vplan.json (Villany Stack, 16 linked switches, 4 points on Meglévő).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','tools','practice','Gyakorlo_lakas_villany.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
const t0=Date.now();
// wait for the boot itself (the state's levels exist), not a fixed delay: a busy machine once timed several suites out
(function wait(){const ready=typeof w.applyProjectData==='function'&&typeof w.fnmSet==='function'&&w.__state&&w.__state.levels;
  if(!ready&&Date.now()-t0<20000)return setTimeout(wait,100);setTimeout(run,300);})();
function run(){
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const st=w.__state;st.active='ground';st.style='alaprajz';st.pitch=90;st.flat=true;st.apFinom=false;w.draw();
  const scene=()=>w.document.getElementById('vp').firstChild.innerHTML,last=()=>w.eval('AP_LAST');
  const hiv0=scene(),sheetHiv0=w.vexpPlanSheet('A3',50,'GY',{date:'2026-11-06'}).svg;

  // ---------- 1. off = untouched ----------
  w.fnmSet(true);const fin=scene();w.fnmSet(false);
  ok('Finom off after on: the hivatalos scene byte-identical',scene()===hiv0);
  ok('… and the hivatalos A3 sheet too',w.vexpPlanSheet('A3',50,'GY',{date:'2026-11-06'}).svg===sheetHiv0);
  ok('the hivatalos sheet keeps its ISO frame',sheetHiv0.includes('class="vw-frame"'));

  // ---------- 2. Finom re-ink ----------
  ok('Finom: no #111 pen left in the scene',!/(fill|stroke)="#111(111)?"/.test(fin));
  ok('Finom: taupe walls instead of the grey poché',fin.includes(w.FNM.wall)&&!/fill="#9a9a9a"/.test(fin));
  ok('Finom: Bahnschrift, no Arial',fin.includes('Bahnschrift')&&!fin.includes('font-family="Arial'));
  ok('Finom: the hairline/outline overrides are in the scene',fin.startsWith('<style>.ap-dim'));
  ok('Finom scene differs from the hivatalos one',fin!==hiv0);

  // ---------- 3. CE-1 letters ----------
  ok('ceLetter: 0 → A, 25 → Z, 26 → AA, 27 → AB',[0,25,26,27].map(w.ceLetter).join(' ')==='A Z AA AB');
  const T=w.ceLetters('ground');
  ok('ground: some switch groups lettered',T.n>0,T.n+' groups');
  ok('letters are the first n of the series, no gaps',(()=>{const set=new Set([...T.lamp.values()]);for(const v of T.sw.values())v.split(',').forEach(x=>set.add(x));
    return set.size===T.n&&[...Array(T.n).keys()].every(i=>set.has(w.ceLetter(i)));})());
  ok('every switch letter belongs to a lamp it switches',[...T.sw.entries()].every(([id,v])=>{const s=w.eval('data').devices.find(d=>d.id===id);
    const mine=new Set(s.ctl.map(x=>T.lamp.get(x)).filter(Boolean));return v.split(',').every(x=>mine.has(x));}));
  w.draw();const L=last().labels;
  ok('letters placed on the plan through the placer',L.grp>0,L.grp+' placed');
  ok('no overlapping texts with the letters on',L.overlaps===0,'overlaps '+L.overlaps);
  w.ceLettersSet(false);ok('csoportbetűk off: none placed',!last().labels.grp);w.ceLettersSet(true);
  ok('letters on lamps too when the cut shows them (cut 2700)',(()=>{st.planCutH=2700;w.draw();const S=last();st.planCutH=1200;w.draw();
    return S.drawn.some(e=>T.lamp.has(e.d.id));})());

  // ---------- 4. CE-5 red = new on a renovation plan ----------
  const ex=d=>w.vstExistOf(d);w.draw();const D=last().drawn;
  const old=D.filter(e=>ex(e.d)),neu=D.filter(e=>!ex(e.d));
  ok('the fixture has drawn existing and new points',old.length>0&&neu.length>0,old.length+' / '+neu.length);
  ok('hivatalos: new points are red (#c62828)',neu.every(e=>e.svg.includes('#c62828')));
  ok('hivatalos: existing points carry no red',old.every(e=>!/#c62828|#d32f2f/.test(e.svg)));
  ok('a removed point gets an ink cross, not a red one',old.filter(e=>ex(e.d)==='remove').every(e=>e.svg.includes('class="ce-rm"')&&!e.svg.includes('#d32f2f')));
  w.fnmSet(true);w.draw();const DF=last().drawn;
  ok('Finom: new points in the vezeték red',DF.filter(e=>!ex(e.d)).every(e=>e.svg.includes(w.FNM.vez)));

  // ---------- 5. CE-7 the Finom sheet ----------
  const F=w.vexpPlanSheet('A3',50,'GY',{date:'2026-11-06'});
  ok('Finom A3 1:50 fits like the hivatalos one',!!F.svg&&F.fit.ok,F.fit.msg);
  ok('Finom sheet: no ISO frame, no #111',!F.svg.includes('vw-frame')&&!/(fill|stroke)="#111"/.test(F.svg.replace(/<g class="vw-plan"[\s\S]*?<\/g><g class="fnm-sheet">/,'')));
  ok('the legend sections: JELKULCS, VÁLTOZÁSOK, KAPCSOLÓCSOPORTOK, MAGASSÁGOK',['JELKULCS','VÁLTOZÁSOK','KAPCSOLÓCSOPORTOK','MAGASSÁGOK'].every(s=>F.svg.includes(s)));
  ok('every legend row fits on the sheet',F.legend.left===0,JSON.stringify(F.legend));
  ok('switch rows name the HU code (e.g. 106 – Váltókapcsoló)',/10[1-8] – /.test(F.svg));
  ok('the title strip: LÉPTÉK 1 : 50 and the maker',F.svg.includes('1 : 50')&&F.svg.includes('VARLER PLANNER'));
  const F4=w.vexpPlanSheet('A3',100,'GY',{date:'2026-11-06'});
  ok('A3 1:100: the legend takes the side column',F4.legend.where==='side'&&F4.legend.left===0);
  w.fnmSet(false);
  ok('Finom off: the hivatalos sheet again, byte-identical',w.vexpPlanSheet('A3',50,'GY',{date:'2026-11-06'}).svg===sheetHiv0);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);}
