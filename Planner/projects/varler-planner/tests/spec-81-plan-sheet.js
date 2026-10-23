// Views V9c — the Alaprajz as a sheet: ISO A3 / A4 at a true 1:50 / 1:100, frame, title block, scale bar, fit check,
// SVG / PNG / Nyomtatás from the Exportálás menu (06c viewSheetSvg opts.paper, 06d vexpPlanSheet / vexpPlanFit).
//
// Fixture: the committed CLA v2 furnished plan, ground floor (docs/views/WORKPLAN.md § V9c, tests 1–7).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','CLA-teszt_v2_butor.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const st=w.__state;st.active='ground';st.style='normal';st.pitch=30;w.draw();
  const D='2026-10-14',sheet=(p,N,o)=>w.vexpPlanSheet(p,N,'CLA',Object.assign({date:D},o||{}));
  const axoBefore=[w.vexpSheet('top','CLA').svg,w.vexpSheet('axo','CLA').svg];

  // ---------- 1. sheet sizes ----------
  const A3=sheet('A3',50);
  ok('A3 1:50: 420 × 297 mm, viewBox 0 0 420 297 (landscape)',A3.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">')&&A3.fit.orient==='fekvő');
  const A4=sheet('A4',100);
  ok('A4 1:100: 297 × 210 mm (landscape)',A4.svg.includes('width="297mm" height="210mm" viewBox="0 0 297 210"')&&A4.fit.orient==='fekvő');
  const A3p=sheet('A3',50,{rot:90});
  ok('A3 1:50 at Forgatás 90°: portrait 297 × 420 mm',A3p.svg.includes('width="297mm" height="420mm" viewBox="0 0 297 420"')&&A3p.fit.orient==='álló');

  // ---------- 2. true scale ----------
  const z=w.dz('ground',0),seg=(S,rot)=>{const p0=st.pitch,r0=st.rot;st.pitch=90;st.rot=rot;
    const a=w.planToBase(2000,3000,z),b=w.planToBase(3000,3000,z),c=w.planToBase(2000,4000,z);st.pitch=p0;st.rot=r0;
    const A=S.map(a[0],a[1]),B=S.map(b[0],b[1]),C=S.map(c[0],c[1]);return [Math.hypot(B[0]-A[0],B[1]-A[1]),Math.hypot(C[0]-A[0],C[1]-A[1])];};
  const s50=seg(A3,0),s100=seg(A4,0),s50r=seg(A3p,90);
  ok('1000 mm of plan = 20.000 mm on paper at 1:50 (x and y)',s50.every(v=>Math.abs(v-20)<0.001),s50.map(v=>v.toFixed(4)).join(' '));
  ok('1000 mm of plan = 10.000 mm on paper at 1:100',s100.every(v=>Math.abs(v-10)<0.001),s100.map(v=>v.toFixed(4)).join(' '));
  ok('… and 20.000 mm at 1:50 rotated 90°',s50r.every(v=>Math.abs(v-20)<0.001),s50r.map(v=>v.toFixed(4)).join(' '));
  ok('the plan group carries scale 1 / (SC · 50)',A3.svg.includes('scale('+(+(1/(w.__SC()*50)).toPrecision(8))+')'));

  // ---------- 3. fit ----------
  const F=(p,N,r)=>w.vexpPlanFit(p,N,r||0);
  ok('CLA A3 1:50 fits landscape: rajz 311 × 203 mm',F('A3',50).ok&&F('A3',50).msg==='A3 fekvő · 1:50 · rajz 311 × 203 mm',F('A3',50).msg);
  ok('CLA A4 1:50 does not fit, the exact Hungarian line',!F('A4',50).ok&&F('A4',50).msg==='Nem fér el: A4 1:50 → a rajz 311 × 203 mm, a rajzterület 267 × 160 mm (álló: 180 × 247 mm). Válassz nagyobb lapot vagy kisebb léptéket.',F('A4',50).msg);
  ok('CLA A4 1:100 fits landscape (156 × 102 mm)',F('A4',100).ok&&F('A4',100).orient==='fekvő'&&F('A4',100).msg.endsWith('rajz 156 × 102 mm'));
  ok('no fit → no sheet',sheet('A4',50).svg===null&&sheet('A4',50).fit.ok===false);
  ok('the drawing is centred in the area',(function(){const a=A3.area,[dw,dh]=A3.draw,m=A3.map(A3.fit.box[0],A3.fit.box[1]);
    return Math.abs(m[0]-(a.x+(a.w-dw)/2))<1e-6&&Math.abs(m[1]-(a.y+(a.h-dh)/2))<1e-6&&dw<=a.w&&dh<=a.h;})());

  // ---------- 4. frame + title block ----------
  ok('A3 frame 20 / 10 / 390 × 277',A3.svg.includes('<rect class="vw-frame" x="20" y="10" width="390" height="277"'));
  ok('title block at x 230, y 257, 180 × 30',A3.svg.includes('<g class="vw-tb"><rect x="230" y="257" width="180" height="30"'));
  ok('A4 title block at x 107, y 170',A4.svg.includes('<g class="vw-tb"><rect x="107" y="170" width="180" height="30"'));
  ok('t1 = CLA · FÖLDSZINT, the sub line, Lépték 1:50 · Lap A3 · Dátum',A3.svg.includes('>CLA · FÖLDSZINT</text>')&&A3.svg.includes('>Alaprajz · vágás 1200 mm · 42 végpont a vágás alatt</text>')
    &&A3.svg.includes('>1:50</text>')&&A3.svg.includes('>A3</text>')&&A3.svg.includes('>'+D+'</text>')&&A3.svg.includes('>Varler Planner</text>'));

  // ---------- 5. scale bar ----------
  ok('scale bar 100 mm at 1:50, 50 mm at 1:100',/class="vw-bar-len" x="[\d.]+" y="[\d.]+" width="100"/.test(A3.svg)&&/class="vw-bar-len" x="[\d.]+" y="[\d.]+" width="50"/.test(A4.svg));

  // ---------- 6. state restored ----------
  const keep=JSON.stringify([st.style,st.pitch,st.rot,st.bpScale]),sc0=$('vp').firstChild.innerHTML;sheet('A3',100,{rot:180});
  ok('style, pitch, rot, bpScale and the scene restored',JSON.stringify([st.style,st.pitch,st.rot,st.bpScale])===keep&&$('vp').firstChild.innerHTML===sc0);

  // ---------- the menu ----------
  ok('menu: Alaprajz-lap off, rows hidden',!!$('expPlan')&&!$('expPlan').checked&&$('expPaperRow').style.display==='none');
  $('expPlan').checked=true;$('expPaper').value='A4';$('expScale').value='50';$('expPlan').dispatchEvent(new w.Event('change'));
  ok('ticked + A4 1:50 → the no-fit line in red, the axo controls disabled',$('expFit').textContent.startsWith('Nem fér el: A4 1:50')&&$('expFit').style.color==='rgb(179, 38, 30)'&&$('expView').disabled&&$('expPaperRow').style.display==='');
  ok('export with no fit → nothing (SVG / PNG / print return null)',w.eval('vexpSvg()')===null&&w.eval('vexpPng()')===null&&w.eval('vexpPrint()')===null);
  $('expScale').value='100';$('expScale').dispatchEvent(new w.Event('change'));
  ok('1:100 → the fit line',$('expFit').textContent==='A4 fekvő · 1:100 · rajz 156 × 102 mm');
  $('expTitle').value='CLA';
  ok('file name alaprajz_CLA_A4_1-100.png',w.eval("vexpName('png')")==='alaprajz_CLA_A4_1-100.png');
  ok('PNG at 150 dpi: A4 → 1754 × 1240 px',(function(){const S=sheet('A4',100),k=w.eval('vexpPngK')(S);return Math.round(S.W*k)===1754&&Math.round(S.H*k)===1240;})());
  $('expPlan').checked=false;$('expPlan').dispatchEvent(new w.Event('change'));$('expTitle').value='';
  ok('unticked: axo controls back',!$('expView').disabled&&$('expFit').style.display==='none');

  // ---------- 7. the V4 axo sheet untouched ----------
  ok('vexpSheet top / axo byte-identical before and after',w.vexpSheet('top','CLA').svg===axoBefore[0]&&w.vexpSheet('axo','CLA').svg===axoBefore[1]);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
