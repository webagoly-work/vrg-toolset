// Views V1 (the view core, 06c-view-core.js) and V3 (the Kivágás / cutaway wall mode in the 3D view).
//
// Fixture: the committed P33 v2 furnished plan (Calculator/P33-teszt_v2_butor.vplan.json).
// What must hold:
//   * the core reproduces V0 exactly where V0 was proven (yaw 225: far W6 W7 W9, near W8 W10 W11)
//     and the classes swap for the opposite camera;
//   * the output is deterministic, finite, parses as SVG, labels overlap nothing, and rendering a
//     view changes neither the data nor the normal drawing;
//   * the cutaway gives every wall its full height, the interior cut or the near cut, follows the
//     camera (a half turn swaps near and far), clips openings to the lowered wall, and is opt-in.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','P33-teszt_v2_butor.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 const ids=a=>a.slice().sort().join(' ');
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const st=w.__state;st.wallMode='translucent';w.draw();

  // ---------- V1: the core ----------
  const A=w.viewRender({yaw:225}),B=w.viewRender({yaw:45});
  ok('yaw 225 = V0: far W6 W7 W9',ids(A.stats.far)==='W6 W7 W9',ids(A.stats.far));
  ok('yaw 225 = V0: near W8 W10 W11',ids(A.stats.near)==='W10 W11 W8',ids(A.stats.near));
  ok('yaw 45 swaps them',ids(B.stats.far)===ids(A.stats.near)&&ids(B.stats.near)===ids(A.stats.far));
  ok('yaw 135 / 315 swap too',(function(){const C=w.viewRender({yaw:135}),D=w.viewRender({yaw:315});
    return ids(C.stats.far)===ids(D.stats.near)&&ids(C.stats.near)===ids(D.stats.far);})());
  ok('interior walls stay interior in every quadrant',ids(A.stats.int)===ids(B.stats.int)&&A.stats.int.length===13,A.stats.int.length);
  ok('128 endpoints (every ground device but the ARM junctions)',A.stats.devices===128,A.stats.devices);
  ok('deterministic',w.viewRender({yaw:225}).svg===A.svg);
  ok('every primitive coordinate is finite',A.prims.every(p=>{const q=[].concat(p.p||[],p.a?[p.a]:[],p.b?[p.b]:[],p.s?[p.s]:[],p.at?[p.at]:[]);
    return q.every(v=>isFinite(v[0])&&isFinite(v[1]));}));
  ok('the SVG parses',(function(){const d=new w.DOMParser().parseFromString(A.svg,'image/svg+xml');
    return !d.getElementsByTagName('parsererror').length&&d.documentElement.nodeName==='svg';})());
  ok('the floor tiles carry the room tone (Nappali → green)',A.prims.some(p=>p.t==='floor'&&p.room==='R06'&&p.fill==='#dce9c9'));
  ok('edge-on camera (yaw 180) draws no x-facing faces and still works',(function(){const E=w.viewRender({yaw:180});
    return !E.prims.some(p=>/\.a$/.test(p.t))&&E.prims.some(p=>/\.b$/.test(p.t));})());
  for(const [n,V] of [['225',A],['45',B]])ok('labels overlap nothing at yaw '+n,(function(){
    const T=V.prims.filter(p=>p.k==='text'),boxes=T.map(p=>w.eval('viewTextBox')(p,p.at[0],p.at[1]));
    const marks=V.prims.filter(p=>p.k==='ep').map(p=>{const r=(p.hw?4.2:p.type==='light'?3.2:3.4);return [p.s[0]-r,p.s[1]-r,p.s[0]+r,p.s[1]+r];});
    const ov=w.eval('viewOverlap');let bad=[];
    for(let i=0;i<boxes.length;i++){for(let j=i+1;j<boxes.length;j++)if(ov(boxes[i],boxes[j])>0)bad.push(T[i].txt+'/'+T[j].txt);
      if(marks.some(m=>ov(boxes[i],m)>0))bad.push(T[i].txt+'/marker');}
    return bad.length?bad.join(', '):true;})()===true,(function(){const T=V.prims.filter(p=>p.k==='text'),bx=T.map(p=>w.eval('viewTextBox')(p,p.at[0],p.at[1])),ov=w.eval('viewOverlap'),out=[];for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++)if(ov(bx[i],bx[j])>0)out.push(T[i].txt+'/'+T[j].txt);V.prims.filter(p=>p.k==='ep').forEach(p=>{const r=(p.hw?4.2:p.type==='light'?3.2:3.4);bx.forEach((b,i)=>{if(ov(b,[p.s[0]-r,p.s[1]-r,p.s[0]+r,p.s[1]+r])>0)out.push(T[i].txt+'/marker '+p.type);});});return out.join(', ');})());
  ok('the entrance comes from the bejarat mark',A.prims.some(p=>p.t==='label.entry'));
  ok('rendering a view touches neither the data nor the drawing',(function(){
    const d0=JSON.stringify(w.__data);w.draw();const s0=w.document.getElementById('scene')?w.document.getElementById('scene').innerHTML:'';
    w.viewRender({yaw:315});w.draw();const s1=w.document.getElementById('scene')?w.document.getElementById('scene').innerHTML:'';
    return JSON.stringify(w.__data)===d0&&s0===s1;})());

  // ---------- V3: the cutaway ----------
  const H=w.eval('LH').ground,walls=()=>w.__getWalls().ground;
  const topsAt=rot=>{w.setRot(rot);const t=w.eval('cutTops')('ground');const o={};walls().forEach(r=>o[r.id]=t.get(r));return o;};
  st.wallMode='cutaway';st.cutH=1500;st.cutNearH=1000;st.pitch=30;
  const T0=topsAt(90),T1=topsAt(270);
  ok('every wall gets full height, the interior cut or the near cut',Object.values(T0).every(v=>v===H||v===1500||v===1000||v<1000),
    Object.values(T0).join(','));
  const full=T=>ids(Object.keys(T).filter(k=>T[k]===H)),low=T=>ids(Object.keys(T).filter(k=>T[k]===1000));
  ok('a half turn swaps the full-height and the lowered exterior walls',full(T0)===low(T1)&&low(T0)===full(T1),full(T0)+' | '+low(T0));
  ok('the cutaway follows the camera (some wall changes height between quadrants)',JSON.stringify(T0)!==JSON.stringify(T1));
  ok('the heights come from the state',(function(){st.cutH=1200;st.cutNearH=600;const T=topsAt(90);st.cutH=1500;st.cutNearH=1000;
    return Object.values(T).includes(1200)&&Object.values(T).includes(600);})());
  ok('openings clip to a lowered wall; above the cut they vanish',(function(){w.setRot(90);const t=w.eval('cutTops')('ground'),co=w.eval('cutOpening');
    let clipped=0,whole=0,gone=0;
    for(const o of w.__data.openings.filter(o=>o.level==='ground')){const host=w.eval('opnHost')(o);if(!host)continue;
      const r=co(o),win=o.type==='window',sill=o.sill!=null?o.sill:(win?900:0),top=t.get(host);
      if(!r)gone++;else if(r===o)whole++;else{clipped++;if(Math.abs(sill+r.h-top)>0.5)return 'bad h on '+o.id;}}
    return clipped>0&&whole>0?true:'clipped '+clipped+' whole '+whole+' gone '+gone;})()===true);
  ok('the cutaway draws, and differs from solid walls',(function(){
    w.setRot(90);st.wallMode='solid';w.draw();const a=w.drawNormalGeom();st.wallMode='cutaway';w.draw();const b=w.drawNormalGeom();
    return a.length>0&&b.length>0&&a!==b;})());
  ok('the Kivágás action toggles and restores the previous mode',(function(){
    st.wallMode='solid';const act=w.eval('ACTIONS').find(a=>a.id==='view.cutaway');act.run();const on=st.wallMode==='cutaway';
    act.run();return on&&st.wallMode==='solid';})());
  ok('the heights row shows only in cutaway',(function(){const sel=w.document.getElementById('wallMode'),row=w.document.getElementById('cutRow');
    sel.value='cutaway';sel.onchange({target:sel});const a=row.style.display==='';sel.value='translucent';sel.onchange({target:sel});
    return a&&row.style.display==='none';})());
  st.wallMode='translucent';
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
