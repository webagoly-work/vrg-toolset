// spec-60 — the selected piece keeps the click; its centre is a handle (round 2026-10-10, WP-U3)
//
// Clicking a selected piece's blue centre often picked a neighbour: the dot had no class="giz", so the click fell
// through to hitTest, which took whichever centre was nearest; and an object claimed half its size around its
// centre, then reset the distance every later piece had to beat. Also covered: the group gizmo's move arrows,
// which threw on every pointermove because nothing set gizDrag.grab.
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
  const st=w.__state,D=w.__data,stage=$('stage');
  st.zoom=1;st.style='normal';st.active=lvl;st.pitch=90;w.setMode('select');
  let tgt=[0,0];w.clientToBase=e=>[tgt[0]+((e&&e.clientX)||100)-100,tgt[1]+((e&&e.clientY)||100)-100];
  const B=(x,y,z)=>w.planToBase(x,y,w.dz(lvl,z||0));
  const at=b=>{tgt=b;return w.hitTest({clientX:100,clientY:100});};
  const ev=(el,type,o)=>el.dispatchEvent(new w.MouseEvent(type,Object.assign({bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:100,clientY:100},o||{})));
  const refOf=h=>h?(h.t==='wall'?h.ref:D[h.t][h.i]):null;
  const sock=o=>Object.assign({type:'socket',level:lvl,h:300,layer:'L0',side:0},o);

  // 1 — two devices 10 mm apart: the selected one keeps a click just off its centre
  const A=sock({x:1000,y:1000,ref:'A'}),Bd=sock({x:1010,y:1000,ref:'B'});D.devices.push(A,Bd);w.ensureIds(D);
  const bA=B(A.x,A.y,A.h),bB=B(Bd.x,Bd.y,Bd.h),ux=(bB[0]-bA[0]),uy=(bB[1]-bA[1]),ul=Math.hypot(ux,uy)||1;
  const off=[bA[0]+ux/ul*3/st.zoom,bA[1]+uy/ul*3/st.zoom];
  w.__setSel(null);
  ok('with nothing selected, a click 3 px from A towards B takes the nearer centre (B)',refOf(at(off))===Bd,refOf(at(off))&&refOf(at(off)).ref);
  w.__setSel({t:'devices',i:D.devices.indexOf(A)});
  ok('with A selected, the same click stays on A',refOf(at(off))===A);
  ok('… even a click right on B: 10 mm is inside the 14 px of the selection — Alt+click is the way to B',refOf(at(bB))===A);
  ok('a device well away from the selection still takes its own click',(function(){
    const Cd=sock({x:4000,y:1000,ref:'C'});D.devices.push(Cd);w.ensureIds(D);const r=refOf(at(B(Cd.x,Cd.y,Cd.h)));D.devices.pop();return r===Cd;})());
  ok('a hidden selection is not sticky',(function(){w.eval('layers')[0].cats.socket=false;const h=at(off);w.eval('layers')[0].cats.socket=true;return h===null;})());
  D.devices.length=0;w.__setSel(null);

  // 2 — the gizmo centre is a move handle with a grab point
  const dv=sock({x:3000,y:3000,ref:'G'});D.devices.push(dv);w.ensureIds(D);
  w.setMode('grab');w.__setSel({t:'devices',i:0});w.draw();
  const lay=w.eval('_lyOverlay');
  const centre=()=>{const gs=[...lay.querySelectorAll('.gizmo .giz')];return gs[gs.length-1];};
  ok('the centre dot is a .giz move handle, drawn last (above the arrow shafts)',(function(){const c=centre();
    return !!c&&c.getAttribute('data-ax')==='move'&&c.querySelectorAll('circle').length===2&&c.querySelector('circle').getAttribute('fill-opacity')==='0.001';})());
  tgt=B(dv.x,dv.y,dv.h);ev(centre().querySelector('circle'),'pointerdown');
  const gz=w.eval('gizDrag');
  ok('pointerdown on it starts a free move with a grab point',!!gz&&gz.ax==='move'&&Array.isArray(gz.grab)&&gz.grab.length===2);
  ok('dragging the centre moves the piece by the pointer offset',(function(){const x0=dv.x,y0=dv.y;st.gizmoSnap=false;
    ev(stage,'pointermove',{clientX:140,clientY:100});ev(stage,'pointerup',{clientX:140,clientY:100});
    const exp=w.baseToPlan(tgt[0]+40,tgt[1],w.dz(lvl,dv.h));   // the plan point under the moved pointer (the view is rotated)
    return Math.abs(dv.x-exp[0])<1&&Math.abs(dv.y-exp[1])<1&&(dv.x!==x0||dv.y!==y0);})(),dv.x+','+dv.y);
  D.devices.length=0;w.__setSel(null);w.setMode('select');

  // 3 — a socket inside a 2 m object's box is the socket; the object everywhere else in its box
  const obj={level:lvl,x:6000,y:6000,z:0,w:2000,d:2000,ht:900,ang:0,name:'Szekrény',layer:'L0'};D.objects.push(obj);
  const s2=sock({x:6200,y:6000,ref:'S2'});D.devices.push(s2);w.ensureIds(D);
  ok('a click on the socket inside the object takes the socket',refOf(at(B(s2.x,s2.y,s2.h)))===s2);
  ok('a click inside the object far from the socket takes the object',refOf(at(B(6000,6700,450)))===obj);
  ok('the object is hit across its whole drawn box, not only near its centre',refOf(at(B(6900,5100,450)))===obj);

  // 4 — Alt+click cycles: socket → object → floor → socket
  D.floors.push({level:lvl,poly:[[4000,4000],[8000,4000],[8000,8000],[4000,8000]],layer:'L0',name:'Szoba'});
  const altClick=()=>{tgt=B(s2.x,s2.y,s2.h);ev(stage,'pointerdown',{altKey:true});ev(stage,'pointerup',{altKey:true});
    return {r:refOf(w.__getSel()),hud:$('hud').textContent};};
  w.__setSel(null);
  const c1=altClick(),c2=altClick(),c3=altClick(),c4=altClick();
  ok('Alt+click cycles 1 → 2 → 3 → 1 through the pieces under the pointer',
     c1.r===s2&&c2.r===obj&&c3.r===D.floors[0]&&c4.r===s2,[c1,c2,c3,c4].map(c=>c.r&&(c.r.ref||c.r.name)).join(' → '));
  ok('the HUD says which one of how many',/Átfedő elemek: 2 \/ 3/.test(c2.hud)&&/Alt\+kattintás: következő/.test(c2.hud),c2.hud);
  ok('a plain click on the same spot is the socket again (Alt does not latch)',(function(){w.__setSel({t:'objects',i:0});
    tgt=B(s2.x,s2.y,s2.h);ev(stage,'pointerdown');ev(stage,'pointerup');return refOf(w.__getSel())===s2;})());
  ok('a selected room or cabinet does not swallow a socket near its centre',(function(){
    w.__setSel({t:'floors',i:0});const a=at(B(s2.x,s2.y,s2.h));w.__setSel({t:'objects',i:0});const b=at(B(s2.x,s2.y,s2.h));
    return refOf(a)===s2&&refOf(b)===s2;})());
  ok('inside a selected object, a wall-class peer does not steal the click',(function(){
    const wl={x0:5900,y0:4000,x1:6100,y1:8000,layer:'L0'};w.__getWalls()[lvl].push(wl);
    w.__setSel({t:'objects',i:0});const h=at(B(6000,6800,450));w.__getWalls()[lvl].pop();return refOf(h)===obj;})());

  // the group gizmo: its move arrows used to throw (no gizDrag.grab)
  {const _g=(function(){
    D.devices.push(sock({x:1000,y:9000,ref:'M1'}),sock({x:2000,y:9000,ref:'M2'}));w.ensureIds(D);
    const i1=D.devices.length-2,i2=D.devices.length-1,m1=D.devices[i1],m2=D.devices[i2];
    w.setMode('grab');w.clearMulti();w.addMulti({t:'devices',i:i1});w.addMulti({t:'devices',i:i2});w.__setSel({t:'devices',i:i1});w.draw();
    const arrow=lay.querySelector('.gizmo .giz[data-ax="move"]');if(!arrow)return 'no arrow';
    const gc=w.groupCentroid(w.selList());tgt=B(gc[0],gc[1],m1.h);
    let err=null;const onErr=e=>{err=e.message;};w.addEventListener('error',onErr);
    const p1=[m1.x,m1.y],p2=[m2.x,m2.y];
    try{ev(arrow,'pointerdown');ev(stage,'pointermove',{clientX:130});ev(stage,'pointerup',{clientX:130});}catch(e){err=e.message;}
    w.removeEventListener('error',onErr);w.setMode('select');
    const d1=[m1.x-p1[0],m1.y-p1[1]],d2=[m2.x-p2[0],m2.y-p2[1]];
    return err?('ERR '+err):((d1[0]||d1[1])&&d1[0]===d2[0]&&d1[1]===d2[1])||('moved '+d1+' / '+d2);})();
  ok('the group gizmo moves a multi-selection as one (no throw, spacing kept)',_g===true,_g);}
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
