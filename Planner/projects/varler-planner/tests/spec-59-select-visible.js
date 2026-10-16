// spec-59 — the Select tool selects visibly (round 2026-10-10, WP-U2)
//
// The select click set `selected` and returned without draw(), and the overlay drew a single selection
// only in Move mode — so the selection existed but was invisible until something else redrew, and the
// inspector kept showing the stage. Also, any movement after the click dragged the piece and pushed an
// undo step. These checks go through the real stage listeners, not through the helpers.
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
  st.zoom=1;st.style='normal';st.active=lvl;w.setMode('select');
  const dev={type:'socket',level:lvl,x:1000,y:1000,h:300,layer:'L0',side:0};D.devices.push(dev);
  const wall={x0:4000,y0:4000,x1:7000,y1:4200,layer:'L0'};w.__getWalls()[lvl].push(wall);
  w.ensureIds(D);if(!wall.id)wall.id='W900';w.draw();
  // the pointer is aimed in base coordinates: clientToBase answers with the target, offset by the client delta
  let tgt=[0,0];w.clientToBase=e=>[tgt[0]+(e.clientX-100),tgt[1]+(e.clientY-100)];
  const aimAt=(x,y,z)=>{tgt=w.planToBase(x,y,w.dz(lvl,z||0));};
  const ev=(type,cx,cy,o)=>stage.dispatchEvent(new w.MouseEvent(type,Object.assign({bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:cx,clientY:cy},o||{})));
  const ov=()=>w.eval('_lastOverlay')||'',sc=()=>w.eval('_lastScene')||'';
  const sel=()=>{const s=w.__getSel();return s?(s.t==='wall'?s.ref:D[s.t][s.i]):null;};
  const insSel=()=>{const b=w.document.querySelector('#inspector .insSel b');return b?b.textContent:'';};
  const undoLen=()=>w.eval('undo.length');

  // 1 + 2 — one click, nothing else: selected, aura in the overlay, inspector shows it
  const scene0=sc();
  aimAt(dev.x,dev.y,dev.h);ev('pointerdown',100,100);
  ok('a click on a device selects it',sel()===dev);
  ok('… and the overlay carries the aura at once (no mode switch)',/data-sel-aura="devices"/.test(ov()));
  ok('… and the inspector shows the device, not the stage',insSel()===w.inspectorTitle(w.__getSel()).t&&insSel()!=='',insSel());
  ok('the aura never enters the scene string',sc()===scene0&&!/data-sel-aura/.test(sc()));
  ev('pointerup',100,100);
  ok('the aura is two stroke passes, no SVG filter',(function(){const m=ov().match(/<g data-sel-aura[^]*?<\/g>/);
    return !!m&&(m[0].match(/<circle /g)||[]).length===2&&!/filter/.test(m[0])&&/pointer-events="none"/.test(m[0]);})());
  ok('the aura is screen-constant: its stroke is 7 px at any zoom',(function(){
    const wd=z=>{st.zoom=z;w.draw();const m=ov().match(/data-sel-aura[^]*?stroke-width="([\d.]+)"/);return m?+m[1]*z:NaN;};
    const a=wd(0.5),b=wd(2);st.zoom=1;w.draw();return Math.abs(a-7)<0.01&&Math.abs(b-7)<0.01;})());

  // 3 — the drag threshold
  const pos=()=>dev.x+','+dev.y;
  ok('a 2 px wobble moves nothing and records no undo step',(function(){const p0=pos(),u0=undoLen();
    aimAt(dev.x,dev.y,dev.h);ev('pointerdown',100,100);ev('pointermove',102,100);ev('pointerup',102,100);
    return pos()===p0&&undoLen()===u0;})(),pos());
  ok('a 10 px drag moves the device with exactly one undo step',(function(){const p0=pos(),u0=undoLen();
    aimAt(dev.x,dev.y,dev.h);ev('pointerdown',100,100);ev('pointermove',105,100);ev('pointermove',110,100);ev('pointerup',110,100);
    return pos()!==p0&&undoLen()===u0+1;})(),pos());

  // 4 — empty click
  aimAt(20000,20000,0);ev('pointerdown',100,100);ev('pointerup',100,100);
  ok('an empty click clears the selection and the aura',w.__getSel()===null&&!/data-sel-aura/.test(ov()));

  // the other kinds get their own shape
  w.draw();aimAt((wall.x0+wall.x1)/2,(wall.y0+wall.y1)/2,0);ev('pointerdown',100,100);ev('pointerup',100,100);
  ok('a wall gets a polygon aura',sel()===wall&&/data-sel-aura="wall"[^>]*><polygon/.test(ov()));
  ok('Move mode shows the same glow under the gizmo',(function(){w.setMode('grab');w.__setSel({t:'wall',level:lvl,ref:wall});
    const o=ov();w.setMode('select');return /data-sel-aura="wall"/.test(o)&&o.indexOf('data-sel-aura')<o.indexOf('class="gizmo"');})());
  ok('every selectable kind draws an aura without throwing',(function(){
    D.openings.push({type:'door',level:lvl,x:5000,y:4100,w:900,h:2100,ang:0,layer:'L0'});
    D.objects.push({level:lvl,x:9000,y:1000,w:600,d:400,ht:800,z:0,ang:0.3,name:'O',layer:'L0'});
    D.notes.push({level:lvl,x:1000,y:6000,text:'N',layer:'L0'});
    D.measures.push([{level:lvl,x:0,y:9000},{level:lvl,x:2000,y:9000}]);
    D.floors.push({level:lvl,poly:[[0,0],[3000,0],[3000,3000],[0,3000]],layer:'L0'});
    D.roofs=D.roofs||[];D.roofs.push({level:lvl,x0:0,y0:0,x1:3000,y1:3000,eave:2800,ridge:4000,layer:'L0'});
    D.cables.push({type:'sockets',layer:'L0',nodes:[{level:lvl,x:0,y:500,h:300},{level:lvl,x:2000,y:500,h:300}]});
    const hs=['openings','objects','notes','measures','floors','roofs','cables'].map(t=>({t,i:D[t].length-1}));
    const miss=hs.filter(h=>!/data-sel-aura/.test(w.selAuraSvg(h))).map(h=>h.t);
    return miss.length?miss.join(','):true;})()===true);
  ok('a multi-selection keeps its circles and gets no aura (Q-U02 = off)',(function(){
    w.addMulti({t:'devices',i:D.devices.indexOf(dev)});w.addMulti({t:'wall',level:lvl,ref:wall});w.draw();
    const o=ov();w.clearMulti();w.__setSel(null);return !/data-sel-aura/.test(o)&&/fill-opacity="0.18"/.test(o);})());
  ok('the Select hint no longer promises a delete it never did',!/delete/i.test(w.eval('HINTS.select'))&&/Kijelölés/.test($('modeHint').textContent));
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
