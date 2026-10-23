// Views V9a — Alaprajz, the cut-plane floor plan (06e-view-plan.js).
//
// Fixture: the committed CLA v2 furnished plan (Calculator/CLA-teszt_v2_butor.vplan.json), ground floor (H 2850):
// 19 walls 0–2850, 7 doors 0–2100, 4 windows 900–2400, 31 objects, 165 endpoints.
// What must hold (docs/views/WORKPLAN.md § V9a, tests 1–9): opt-in and 2D only; walls / openings / objects / endpoints
// classified against the cut (endpoints above it hidden, D-V9-5 3C) with the exact CLA counts; one poché contour; the front rule (D-V9-3 A); the art matrix;
// the Eleje cycle; the cut controls; the other styles untouched by the new `front` field.
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
  const st=w.__state;st.active='ground';
  const scene=()=>$('vp').firstChild.innerHTML;
  const setStyle=v=>{const s=$('style');s.value=v;s.onchange({target:s});};
  const L=()=>w.eval('AP_LAST');
  const cnt=(cut)=>{w.apCutSet(cut);const S=L();return S;};

  // ---------- 1. opt-in, 2D only ----------
  setStyle('normal');st.pitch=30;w.draw();
  ok('Normal draws no ap- markup',!/ap-(art|contour|above)/.test(scene()));
  setStyle('alaprajz');
  ok('Alaprajz from 3D lands at pitch 90',st.pitch===90&&w.alaprajzOn());
  ok('the cut row shows with the style',$('apCutRow').style.display==='flex');
  st.pitch=30;w.draw();
  ok('in 3D the style is off and the normal geometry is drawn',!w.alaprajzOn()&&!scene().includes('ap-contour'));
  st.pitch=90;w.draw();

  // ---------- 2–3. the CLA counts ----------
  let S=cnt(1200);
  ok('cut 1200: walls 19 / 0 / 0',JSON.stringify(S.walls)==='{"cut":19,"beyond":0,"above":0}',JSON.stringify(S.walls));
  ok('cut 1200: openings cut 11 / hidden 0',S.open.cut===11&&S.open.hidden===0,JSON.stringify(S.open));
  ok('cut 1200: objects art 6 / outline 24 / above 1',JSON.stringify(S.obj)==='{"art":6,"outline":24,"above":1}',JSON.stringify(S.obj));
  ok('cut 1200: the art = Kanapé 3ü, Ágy 200×160, WC csésze × 2, Konyhapult, Hűtő 60',
    S.fronts.map(f=>f.name).sort().join('|')==='Hűtő 60|Kanapé 3ü|Konyhapult|WC csésze|WC csésze|Ágy 200×160',S.fronts.map(f=>f.name).join('|'));
  ok('cut 1200: endpoints full 42 / above (hidden) 123',S.dev.full===42&&S.dev.above===123,JSON.stringify(S.dev));
  S=cnt(300);
  ok('cut 300: openings 7 / 4 (the windows), endpoints 22 / 143',S.open.cut===7&&S.open.hidden===4&&S.dev.full===22&&S.dev.above===143,JSON.stringify([S.open,S.dev]));
  S=cnt(2200);
  ok('cut 2200: openings 4 / 7 (the doors), endpoints 81 / 84',S.open.cut===4&&S.open.hidden===7&&S.dev.full===81&&S.dev.above===84,JSON.stringify([S.open,S.dev]));
  S=cnt(1500);
  ok('cut 1500: endpoints 63 / 102',S.dev.full===63&&S.dev.above===102,JSON.stringify(S.dev));
  ok('endpoints above the cut are not drawn; the HUD counts them (D-V9-5 3C)',!scene().includes('ap-above')&&$('hud').textContent.includes('a vágás fölött 102 rejtve'),$('hud').textContent);
  ok('the poché is mid-grey (D-V9-5 1B)',scene().includes('fill="#9a9a9a"')&&!scene().includes('#262626'));

  // ---------- 4. one contour ----------
  S=cnt(1200);
  ok('one poché contour path at bpSW(0.5)',(scene().match(/class="ap-contour"/g)||[]).length===1&&scene().includes(`stroke-width="${w.bpSW(0.5)}" stroke-linecap="square"`));
  ok('poché pieces = AP_LAST.pieces (30 at 1200)',(scene().match(/fill="#9a9a9a"/g)||[]).length===S.pieces&&S.pieces===30,S.pieces);
  ok("the clean output has no text outside the V9b annotation group",!/<text/.test(scene().split('<g class="ap-annot">')[0]),(scene().match(/<text[^>]*>[^<]*/g)||[]).slice(0,3).join(" ~ "));
  $('apAll').checked=true;$('apAll').onchange({target:$('apAll')});
  ok('útvonalak, rétegek is → the routes come back',scene().length>0&&st.apAll===true&&/<polyline[^>]*stroke-dasharray/.test(scene()));
  $('apAll').checked=false;$('apAll').onchange({target:$('apAll')});

  // ---------- 5. the front rule ----------
  const WALLS=w.__getWalls(),saved=WALLS.ground;
  WALLS.ground=[{x0:0,y0:0,x1:4000,y1:200},{x0:0,y0:3000,x1:4000,y1:3200},{x0:-200,y0:0,x1:0,y1:3200}];
  const ob=(x,y,o)=>Object.assign({level:'ground',x,y,w:400,d:400,ht:800,ang:0},o||{});
  const F=o=>w.apFront(o).map(v=>v===0?0:v).join(',');
  ok('o.front 90 → (1, 0)',F(ob(2000,1600,{front:90}))==='1,0');
  ok('a free object, ang 0 → (0, −1)',F(ob(2000,1600))==='0,-1');
  ok('a free object, ang π/2 → (1, 0)',F(ob(2000,1600,{ang:Math.PI/2}))==='1,0');
  ok('100 mm below a horizontal wall (wall at smaller y) → (0, 1)',F(ob(2000,200+100+200))==='0,1');
  ok('100 mm above a horizontal wall (wall at larger y) → (0, −1)',F(ob(2000,3000-100-200))==='0,-1');
  ok('a vertical wall to its left → (1, 0)',F(ob(0+100+200,1600))==='1,0');
  ok('700 mm away → the free rule',F(ob(2000,200+700+200))==='0,-1');
  ok('a corner: the longer overlap wins (sofa 2000 × 800 along the top wall)',F(ob(1000+100,200+400,{w:2000,d:800}))==='0,1');
  WALLS.ground=saved;

  // ---------- 6. the art matrix ----------
  const so=w.__data.objects.find(o=>o.name==='Kanapé 3ü'),f=w.apFront(so),sz=w.apArtSize(so,f),M=w.apArtMatrix(so,f,sz.d),z=w.dz('ground',0);
  const ap=(x,y)=>[M[0]*x+M[2]*y+M[4],M[1]*x+M[3]*y+M[5]];
  const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<0.5;
  ok('art origin (front centre) → c + f·d/2',near(ap(0,0),w.planToBase(so.x+f[0]*sz.d/2,so.y+f[1]*sz.d/2,z)));
  ok('art (0, −d) → the back centre c − f·d/2',near(ap(0,-sz.d),w.planToBase(so.x-f[0]*sz.d/2,so.y-f[1]*sz.d/2,z)));
  ok('the CLA sofa: across 1950, depth 850 (front along its d axis)',sz.w===1950&&sz.d===850,JSON.stringify(sz));
  ok('the scene carries its matrix',scene().includes('<g class="ap-art" transform="matrix('+M.map(v=>+v.toFixed(4)).join(' ')+')">'));

  // ---------- 7. Eleje ----------
  const o7={};const seq=[];for(let i=0;i<5;i++){w.apFrontCycle(o7);seq.push(o7.front===undefined?'u':o7.front);}
  ok('Eleje cycles 0 → 90 → 180 → 270 → auto',seq.join(' ')==='0 90 180 270 u'&&!('front' in o7),seq.join(' '));
  ok('labels: automatikus / ← (kézi)',w.apFrontLabel({})==='automatikus'&&w.apFrontLabel({front:270})==='← (kézi)');
  ok('the object menu has the Eleje entry',fs.readFileSync(findPlanner(),'utf8').includes("label:'⤾ Eleje: '+apFrontLabel(O)+' (vált)'"));
  const sofaI=w.__data.objects.indexOf(so),u0=w.__undoLen();w.pushUndo();w.apFrontCycle(so);
  ok('a front is saved in the object (data)',w.__data.objects[sofaI].front===0&&w.__undoLen()===u0+1);
  delete so.front;

  // ---------- 8. the controls ----------
  w.document.querySelector('.apPre[data-v="300"]').click();
  ok('preset 300',st.planCutH===300&&$('apCut').value==='300'&&L().cut===300);
  w.document.querySelector('.apPre[data-v="1100"]').click();
  ok('preset 1100',st.planCutH===1100&&L().cut===1100);
  $('apCutN').value='5000';$('apCutN').onchange({target:$('apCutN')});
  ok('the number clamps to 2700',st.planCutH===2700);
  $('apCutN').value='10';$('apCutN').onchange({target:$('apCutN')});
  ok('… and to 100',st.planCutH===100);
  w.apCutSet(1200);

  // ---------- 9. the other styles ignore `front` ----------
  const shots=()=>{const out=[];for(const [s,p] of [['normal',90],['whiteout',90],['blueprint',90],['normal',30],['tiszta',30]]){st.style=s;st.pitch=p;w.draw();out.push(scene());}return out;};
  const A=shots();w.__data.objects.forEach(o=>{o.front=90;});const B=shots();w.__data.objects.forEach(o=>{delete o.front;});
  ok('normal / whiteout / blueprint / 3D / tiszta identical with a front on every object',A.every((s,i)=>s===B[i]));
  st.style='alaprajz';st.pitch=90;w.draw();
  ok('…while Alaprajz turns the art',(function(){const a=scene();w.__data.objects.forEach(o=>{o.front=90;});w.draw();const b=scene();w.__data.objects.forEach(o=>{delete o.front;});return a!==b;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
