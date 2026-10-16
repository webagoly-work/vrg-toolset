// spec-64 — "Falak egyesítve" works in translucent mode (round 2026-10-10, WP-U7)
//
// The merge was gated to solid walls, and its burying test looks at a face's centre only — so at 0.5 opacity the
// overlap square of every corner was painted twice (the darker squares). Translucent + merge now cuts every face so
// each point of each plane is painted once; solid keeps exactly its old path.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const st=w.__state;const merge0=st.wallMerge;st.style='normal';st.pitch=90;st.flat=true;st.active=lvl;
  const area=r=>(r.u1-r.u0)*(r.v1-r.v0),sum=L=>L.reduce((s,r)=>s+area(r),0);
  const A={u0:0,u1:100,v0:0,v1:100};

  // 1 — rectMinus
  ok('disjoint → unchanged',(function(){const r=w.rectMinus(A,[{u0:200,u1:300,v0:0,v1:100}]);return r.length===1&&area(r[0])===10000;})());
  ok('contained → nothing left',w.rectMinus(A,[{u0:-10,u1:110,v0:-10,v1:110}]).length===0);
  ok('corner overlap → 2 pieces, area(a) − overlap',(function(){const r=w.rectMinus(A,[{u0:60,u1:200,v0:70,v1:200}]);return r.length===2&&sum(r)===10000-40*30;})());
  ok('a hole in the middle → 4 pieces',(function(){const r=w.rectMinus(A,[{u0:40,u1:60,v0:40,v1:60}]);return r.length===4&&sum(r)===10000-400;})());
  ok('a band right across → 2 pieces',(function(){const r=w.rectMinus(A,[{u0:40,u1:60,v0:-5,v1:105}]);return r.length===2&&sum(r)===10000-2000;})());
  ok('two cutters in a row',(function(){const r=w.rectMinus(A,[{u0:0,u1:50,v0:0,v1:100},{u0:50,u1:100,v0:0,v1:40}]);return sum(r)===10000-5000-2000;})());

  // 2 — boxes through pushBox, as drawNormalGeom calls it
  const fz=w.dz(lvl,0),H=w.wallH(lvl);
  const boxes=(rects,clip)=>{const sibs=rects.map((r,k)=>({r,k,z0:fz,z1:fz+H}));const faces=[];
    rects.forEach((r,k)=>w.pushBox(faces,r,fz,fz+H,clip?0.5:1,false,{sibs,flat:true,clip,k}));return faces;};
  const plane=f=>{for(let k=0;k<3;k++)if(f.pts.every(p=>Math.abs(p[k]-f.pts[0][k])<1e-6))return k;return -1;};
  const rectOf=(f,a)=>{const U=a===0?1:0,V=a===2?1:2,us=f.pts.map(p=>p[U]),vs=f.pts.map(p=>p[V]);
    return {u0:Math.min(...us),u1:Math.max(...us),v0:Math.min(...vs),v1:Math.max(...vs),c:f.pts[0][a]};};
  const topArea=fs=>fs.filter(f=>plane(f)===2&&Math.abs(f.pts[0][2]-(fz+H))<1e-6).reduce((s,f)=>s+area(rectOf(f,2)),0);
  // every pair of pieces in one plane must not overlap (each point painted once)
  const doubles=fs=>{let n=0;const P=fs.map(f=>{const a=plane(f);return {a,r:rectOf(f,a)};});
    for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const p=P[i],q=P[j];if(p.a!==q.a||Math.abs(p.r.c-q.r.c)>1e-6)continue;
      const ou=Math.min(p.r.u1,q.r.u1)-Math.max(p.r.u0,q.r.u0),ov=Math.min(p.r.v1,q.r.v1)-Math.max(p.r.v0,q.r.v0);if(ou>0.5&&ov>0.5)n++;}return n;};
  const L=[{x0:0,y0:0,x1:3000,y1:100},{x0:0,y0:0,x1:100,y1:3000}];
  ok('L corner, merge on: the top faces cover the union once (3000·100 + 2900·100)',topArea(boxes(L,true))===300000+290000,topArea(boxes(L,true)));
  ok('L corner, merge off: both footprints, the corner square twice',topArea(boxes(L,false))===600000);
  ok('L corner: no plane is painted twice',doubles(boxes(L,true))===0,doubles(boxes(L,true)));
  const T=[{x0:0,y0:0,x1:4000,y1:120},{x0:1950,y0:0,x1:2050,y1:3000}];
  ok('T junction: no plane is painted twice',doubles(boxes(T,true))===0,doubles(boxes(T,true)));
  const X=[{x0:0,y0:1000,x1:3000,y1:1100},{x0:1000,y0:0,x1:1100,y1:3000}];
  ok('X crossing: no plane is painted twice, and the crossing square is topped once',doubles(boxes(X,true))===0&&topArea(boxes(X,true))===300000+290000);
  ok('a free-standing wall is drawn exactly as before (one face each, untouched)',(function(){const one=[{x0:0,y0:0,x1:2000,y1:100}];
    const a=boxes(one,true),b=boxes(one,false);return a.length===b.length&&a.every((f,i)=>JSON.stringify(f.pts)===JSON.stringify(b[i].pts));})());

  // 3 — the gate and the unchanged paths, through drawNormalGeom
  w.__getWalls()[lvl].push(...L.map(r=>Object.assign({},r)));
  const scene=(wm,m)=>{st.wallMode=wm;st.wallMerge=m;return w.drawNormalGeom();};
  ok('translucent: merge now changes the picture',scene('translucent',true)!==scene('translucent',false));
  ok('hidden: identical with merge on and off',scene('hidden',true)===scene('hidden',false));
  ok('solid + merge never cuts (the old path, byte for byte)',(function(){const real=w.wmgClipFace;let called=0;w.wmgClipFace=function(){called++;return real.apply(this,arguments);};
    scene('solid',true);st.pitch=30;st.flat=false;scene('solid',true);st.pitch=90;st.flat=true;w.wmgClipFace=real;return called===0;})());
  ok('translucent + merge cuts',(function(){const real=w.wmgClipFace;let called=0;w.wmgClipFace=function(){called++;return real.apply(this,arguments);};
    scene('translucent',true);w.wmgClipFace=real;return called>0;})());

  // the checkbox and the action
  st.wallMode='hidden';w.syncUI();
  ok('hidden walls: the checkbox is greyed and says why',$('wallMerge').disabled===true&&/Rejtett falaknál nincs mit egyesíteni/.test($('wallMergeL').title));
  ok('… and the action is dimmed with the same reason',!w.actionEnabled(w.actionById('view.wallmerge'),w.actionCtx())&&/Rejtett falaknál/.test(w.actionById('view.wallmerge').need));
  st.wallMode='translucent';w.syncUI();
  ok('translucent: enabled again, tooltip says it works in both modes',$('wallMerge').disabled===false&&/Áttetsző és tömör falaknál is működik/.test($('wallMergeL').title));
  ok('the default stays off (Q-U06 = A)',!merge0);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
