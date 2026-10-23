// Views V4, slice 2: "Tiszta axo" as a style in the 3D view (docs/views/DECISIONS.md D-V4-1 A).
//
// Fixture: the committed CLA v2 furnished plan (Calculator/CLA-teszt_v2_butor.vplan.json).
// What must hold:
//   * the scene layer is the view core's drawing of the active level through the LIVE camera:
//     every core point sits exactly on planToBase(), at any view scale, so overlay + hit-testing stay valid;
//   * it always draws the cutaway with the state heights, and agrees with the V3 classifier;
//   * no routes / stack scene layer in this style; the overlay layer is untouched;
//   * one render per camera + model state (a hover reuses it, a model edit re-renders);
//   * 2D falls back to the normal drawing; the default style is unchanged (goldens).
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
 const ids=a=>a.slice().sort().join(' ');
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const before=JSON.stringify(w.__data);
  const st=w.__state,E=s=>w.eval(s),scene=()=>w.document.getElementById('lyScene').innerHTML;
  st.active='ground';st.wallMode='translucent';
  w.camPresetApply('axo');                                  // pitch 46, a quadrant yaw
  st.style='normal';w.draw();const normal=scene();
  st.style='tiszta';w.draw();const tz=scene(),TR=E('tisztaRender')();
  ok('the axo preset is 3D (pitch 46)',st.pitch===46&&E('tisztaOn')());
  ok('scene = the core body in a vw group at scale(1)',(function(){const g=w.document.querySelector('#lyScene > g.vw');
    const np=TR.prims.filter(p=>p.k==='poly').length,nl=TR.prims.filter(p=>p.k==='line').length;
    return g&&g.getAttribute('transform')==='scale(1)'&&g.querySelectorAll('polygon').length===np&&g.querySelectorAll('line').length>=nl?true:(g&&g.querySelectorAll('polygon').length)+' / '+np;})()===true);
  ok('the core drew 128 ground endpoints',TR.stats.devices===128,TR.stats.devices);
  // exact registration with the live camera
  const L=w.__data.devices.find(d=>d.level==='ground'&&d.type==='light'),eps=TR.prims.filter(p=>p.k==='ep');
  const reg=f=>{const b=w.planToBase(L.x,L.y,w.dz('ground',L.h||0));return eps.some(p=>p.type==='light'&&Math.abs(p.s[0]*f-b[0])<1e-6&&Math.abs(p.s[1]*f-b[1])<1e-6);};
  ok('a ceiling light sits exactly on planToBase()',reg(1));
  ok('cutaway: far walls = the V3 classifier at full height',(function(){const t=E('cutTops')('ground'),H=w.wallH('ground');
    const full=E('WALLS').ground.filter(r=>t.get(r)>=(r.h||H)).map(r=>r.id).filter(Boolean);
    return ids(full)===ids(TR.stats.far.concat(TR.stats.int.filter(id=>{const r=E('WALLS').ground.find(q=>q.id===id);return t.get(r)>=(r.h||H);})))?true:ids(full)+' | '+ids(TR.stats.far);})()===true);
  ok('exact far set at the axo preset: W10 W7 W8 W9',ids(TR.stats.far)==='W10 W7 W8 W9',ids(TR.stats.far));
  ok('the core uses the state heights',TR.def.cut===1500&&TR.def.nearCut===1000);
  ok('wall mode is ignored (always the cutaway)',(function(){st.wallMode='solid';w.draw();const a=scene();st.wallMode='translucent';w.draw();return a===tz;})());
  ok('no routes: the normal scene has polylines, Tiszta none',(normal.match(/<polyline/g)||[]).length>0&&!/<polyline/.test(tz),(normal.match(/<polyline/g)||[]).length);
  ok('stage gets the paper class',w.document.getElementById('stage').classList.contains('tiszta'));
  ok('a hover / redraw reuses the render',(function(){w.draw();return E('tisztaRender')()===TR;})());
  ok('a model edit re-renders',(function(){const d=w.__data.devices.find(d=>d.level==='ground'&&d.type==='socket');d.x+=100;
    const R2=E('tisztaRender')();d.x-=100;const R3=E('tisztaRender')();return R2!==TR&&R3!==R2&&R3.body===TR.body;})());
  ok('a quarter turn swaps far and near',(function(){const far=ids(TR.stats.far);w.setRot(st.rot+180);w.draw();const T=E('tisztaRender')();
    const res=ids(T.stats.near)===far;w.setRot(st.rot-180);w.draw();return res;})());
  ok('view scale 2×: scale(2) and still on planToBase()',(function(){w.vsSet(2);w.draw();const T=E('tisztaRender')(),s=scene();
    const e2=T.prims.filter(p=>p.k==='ep'),b=w.planToBase(L.x,L.y,w.dz('ground',L.h||0));
    const res=s.includes('transform="scale(2)"')&&e2.some(p=>p.type==='light'&&Math.abs(p.s[0]*2-b[0])<1e-6&&Math.abs(p.s[1]*2-b[1])<1e-6);
    w.vsSet(1);w.draw();return res;})());
  ok('the overlay still shows a selection',(function(){const i=w.__data.devices.indexOf(L);w.__setSel({t:'devices',i});st.mode='select';w.draw();
    const o=w.document.getElementById('lyOverlay').innerHTML;w.__setSel(null);return o.length>0;})());
  ok('2D falls back to the normal drawing',(function(){st.pitch=90;w.draw();const a=scene(),on=E('tisztaOn')(),cls=w.document.getElementById('stage').classList.contains('tiszta');
    st.style='normal';w.draw();const b=scene();st.style='tiszta';st.pitch=46;w.draw();return a===b&&!on&&!cls;})());
  ok('the Render menu offers it',!!w.document.querySelector('#style option[value="tiszta"]'));
  ok('the action switches to it',(function(){st.style='normal';E('ACTIONS').find(a=>a.id==='view.style.tiszta').run();return st.style==='tiszta';})());
  ok('the data is untouched',JSON.stringify(w.__data)===before);
  st.style='normal';
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
