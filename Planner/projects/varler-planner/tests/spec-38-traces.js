// spec-38 — movement traces: 45° line, freehand, smoothed freehand, door snapping, drawing, right-click, validation
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
  const D=()=>w.__data,J=o=>JSON.stringify(o),T=()=>w.trcList();
  const ctxLabels=()=>[...w.document.querySelectorAll('#ctx button')].map(b=>b.textContent);
  const ctxClick=t=>[...w.document.querySelectorAll('#ctx button')].find(b=>b.textContent===t).click();
  const wkey=(k,o)=>{const e=new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{}));w.dispatchEvent(e);return e;};
  const stage=()=>w.eval('stage');
  const ptr=(t,x,y,o)=>{const b=w.planToBase(x,y,w.dz(lvl,0));w.clientToBase=()=>b;stage().dispatchEvent(new w.MouseEvent(t,Object.assign({bubbles:true,cancelable:true,button:0,clientX:50,clientY:50},o||{})));};
  const okModal=()=>{if($('mOk'))$('mOk').click();};
  let door;
  const fixture=()=>{w.newBlankProject();w.eval('stacks=[]');w.__state.stkOff=false;w.__state.stack=null;w.__state.activeLayer='L0';w.mrkToolsOff();
    w.__state.zoom=1;w.__state.rot=0;w.__state.pitch=90;w.__state.flat=true;w.__state.active=lvl;
    D().floors.push({level:lvl,name:'Bal',poly:[[0,0],[2000,0],[2000,3000],[0,3000]],layer:'L0'},{level:lvl,name:'Jobb',poly:[[2000,0],[4000,0],[4000,3000],[2000,3000]],layer:'L0'});
    D().openings.push({type:'door',level:lvl,x:2000,y:1500,ang:Math.PI/2,w:900,h:2100,variant:0,layer:'L0'});
    w.ensureIds(D());door=D().openings[0];};
  const addTrace=(o)=>{T().push(Object.assign({level:lvl,plane:'floor',mode:'free',pts:[[200,200],[1200,200]],a:null,b:null,dir:1,tags:['mozgas'],layer:'L0'},o));w.ensureIds(D());return T()[T().length-1];};
  fixture();

  // 1 — the 45° rule
  ok('line45 from (0,0): pointer (730,40) → vertex (700,0)',J(w.trcStep([0,0],[730,40]))===J([700,0]));
  ok('pointer (520,480) → vertex (495,495) (45°, 700 mm along it, rounded to 1 mm)',J(w.trcStep([0,0],[520,480]))===J([495,495]));
  ok('a pointer behind the start snaps to the opposite direction',J(w.trcStep([1000,1000],[210,1030]))===J([200,1000]));
  ok('the minimum step is 100 mm',J(w.trcStep([0,0],[20,5]))===J([100,0]));
  ok('90° and 135° directions',J(w.trcStep([0,0],[10,820]))===J([0,800])&&J(w.trcStep([0,0],[-480,520]))===J([-495,495]));
  ok('the step is relative to the last vertex, not to the origin',J(w.trcStep([300,200],[1050,260]))===J([1100,200]));

  // 2 — RDP and Chaikin
  const jitter=[];for(let i=0;i<50;i++)jitter.push([i*80,(i%2?10:-10)]);
  ok('trcRdp on a straight jittery line (±10 mm) of 50 points returns 2 points',w.trcRdp(jitter,50).length===2);
  ok('trcRdp keeps both ends and a real corner',(function(){const p=w.trcRdp([[0,0],[500,0],[1000,0],[1000,500],[1000,1000]],50);return J(p)===J([[0,0],[1000,0],[1000,1000]]);})());
  ok('trcRdp of one or two points is the input',w.trcRdp([[0,0]],50).length===1&&w.trcRdp([[0,0],[5,5]],50).length===2);
  const arc=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI/2;arc.push([Math.round(1500*Math.sin(a)+((i*7)%11-5)),Math.round(1500*(1-Math.cos(a))+((i*13)%9-4))]);}
  arc[0]=[0,0];arc[80]=[1500,1500];
  const sm=w.trcSmooth(arc),rd=w.trcRdp(arc,50);
  ok('trcSmooth keeps both end points exactly',J(sm[0])===J([0,0])&&J(sm[sm.length-1])===J([1500,1500]));
  ok("the smoothed trace has more points than RDP's (Chaikin)",sm.length>rd.length&&rd.length>2);
  ok('no smoothed point is farther than 60 mm from the input polyline',(function(){const dist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
    return sm.every(p=>{let m=1e9;for(let i=1;i<arc.length;i++)m=Math.min(m,dist(p,arc[i-1],arc[i]));return m<=60;});})());
  ok('Chaikin keeps the ends fixed (the textbook version would move them)',(function(){const c=w.trcChaikin([[0,0],[100,100],[200,0]],2);return J(c[0])===J([0,0])&&J(c[c.length-1])===J([200,0])&&c.length>3;})());
  ok('smoothed coordinates are whole millimetres',sm.every(p=>Number.isInteger(p[0])&&Number.isInteger(p[1])));

  // 3 — doors
  ok('trcApproach: 250 mm from the centre along the normal, on the side of the NEXT point',(function(){const a=w.trcApproach(door,[1000,1500]),b=w.trcApproach(door,[3000,1500]);return J(a)===J([1750,1500])&&J(b)===J([2250,1500]);})());
  ok('a trace ending 400 mm from a door centre attaches: b is the door, the end sits 250 mm from the centre',(function(){
    const r=w.trcAttach(lvl,[[500,1500],[1000,1500],[1600,1500]]);return r.b===door.id&&r.a===null&&J(r.pts[2])===J([1750,1500])&&J(r.pts[0])===J([500,1500]);})());
  ok('700 mm away it does not',w.trcAttach(lvl,[[500,1500],[1000,1500],[1300,1500]]).b===null);
  ok('the start attaches too, choosing the side of the second point',(function(){const r=w.trcAttach(lvl,[[2400,1500],[3000,1500],[3500,1500]]);return r.a===door.id&&J(r.pts[0])===J([2250,1500]);})());
  ok('the side comes from the neighbouring point, not from the end position itself',(function(){const r=w.trcAttach(lvl,[[500,900],[1700,1500]]);return r.b===door.id&&r.pts[1][0]===1750;})());
  ok('a start just past the door that heads away to the other side gets the approach point on the NEXT point side',(function(){const r=w.trcAttach(lvl,[[2100,1500],[1000,1500],[500,1500]]);return r.a===door.id&&J(r.pts[0])===J([1750,1500]);})());
  ok('trcDoorNear returns the nearest door within 600 mm',w.trcDoorNear(lvl,2300,1500)===door&&w.trcDoorNear(lvl,2700,1500)===null);
  ok('a door on another level is not snapped to',w.trcDoorNear('upper',2000,1500)===null);
  ok('a door tagged nemhasznalt is never snapped to',(function(){w.MRK_T.tags=['nemhasznalt'];w.mrkOpeningCommit(door,{shift:true});const r=w.trcDoorNear(lvl,2000,1500)===null&&w.trcAttach(lvl,[[500,1500],[1900,1500]]).b===null;
    D().marks.length=0;return r;})());
  ok('a nyitva door is still a door for snapping',(function(){w.MRK_T.tags=['nyitva'];w.mrkOpeningCommit(door,{shift:true});const r=w.trcDoorNear(lvl,2000,1500)===door;D().marks.length=0;return r;})());

  // 4 — drawing a trace with the pointer: free mode
  w.mrkPlaneStart('free');
  ptr('pointermove',500,1500);
  ptr('pointerdown',500,1500);
  for(let x=520;x<=1600;x+=20)ptr('pointermove',x,1500+(x%40?4:-4));
  ptr('pointerup',1600,1500);
  ok('releasing a freehand stroke opens the small tag dialog',/Mozgásnyom/.test($('modal').textContent)&&w.document.querySelectorAll('.tpTag').length===4&&!!$('tpTwo'));
  ok('the dialog defaults: mozgas ticked, directional',w.document.querySelector('.tpTag[value=mozgas]').checked&&!$('tpTwo').checked);
  okModal();
  ok('the saved trace: free mode, attached to the door at its end, 250 mm from the centre, rounded to 1 mm',(function(){const t=T()[0];
    return t&&t.mode==='free'&&t.plane==='floor'&&t.level===lvl&&t.b===door.id&&t.a===null&&t.dir===1&&t.tags.join()==='mozgas'&&J(t.pts[t.pts.length-1])===J([1750,1500])&&t.pts.every(p=>Number.isInteger(p[0])&&Number.isInteger(p[1]))&&/^T\d+$/.test(t.id)&&t.layer==='L0';})());
  ok('freehand samples closer than 20 mm are dropped',T()[0].pts.every((p,i,a)=>i===0||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>=19));
  ok('the tool ate the click: nothing was selected',w.__getSel()===null);
  ok('undo removes the saved trace',(function(){const n=T().length;w.doUndo();return T().length===n-1;})());
  ok('a stroke shorter than 200 mm is dropped with a HUD message',(function(){ptr('pointerdown',500,2500);ptr('pointermove',560,2500);ptr('pointermove',650,2500);ptr('pointerup',650,2500);
    return T().length===0&&/Túl rövid nyom/.test($('hud').textContent)&&!$('mOk');})());
  ok('a 150 mm trace is dropped (direct)',(function(){w.eval("TRC_D={mode:'free',level:'ground',plane:'floor',pts:[[100,100],[250,100]]}");const r=w.trcFinish({});return r===false&&T().length===0;})());
  ok('the overlay shows a ring on a door within range while drawing',(function(){ptr('pointermove',1700,1500);return /stroke-dasharray="4 3"/.test(w.eval('_lastOverlay'))&&/<circle/.test(w.eval('_lastOverlay'));})());
  ok('no ring far from any door',(function(){ptr('pointermove',300,300);return !/<circle/.test(w.eval('_lastOverlay'));})());
  w.mrkToolsOff();

  // 5 — smooth mode through the pointer
  fixture();w.mrkPlaneStart('smooth');
  ptr('pointerdown',300,300);
  arc.forEach(p=>ptr('pointermove',300+p[0]*0.6,300+p[1]*0.6));
  ptr('pointerup',300+1500*0.6,300+1500*0.6);okModal();
  ok('a smoothed stroke is stored smoothed: far fewer points than the raw stroke, ends kept',(function(){const t=T()[0];return t&&t.mode==='smooth'&&t.pts.length<arc.length&&J(t.pts[0])===J([300,300])&&J(t.pts[t.pts.length-1])===J([1200,1200]);})());
  w.mrkToolsOff();

  // 6 — the 45° line with the pointer
  fixture();w.mrkPlaneStart('line45');
  ptr('pointermove',0,0);ptr('pointerdown',0,0);
  ok('the first click starts a draft (not data)',T().length===0&&w.eval('TRC_D.pts.length')===1);
  ptr('pointerup',0,0);ptr('pointermove',730,40);
  ok('the overlay previews the next segment',/<polyline/.test(w.eval('_lastOverlay'))&&J(w.eval('TRC_D.cur'))===J([700,0]));
  ptr('pointerdown',730,40);ptr('pointerup',730,40);
  ok('the second click commits the vertex (700,0)',J(w.eval('TRC_D.pts'))===J([[0,0],[700,0]]));
  ptr('pointermove',720,540);ptr('pointerdown',720,540);ptr('pointerup',720,540);
  ok('each vertex is relative to the previous one: (700,0) → down 500',J(w.eval('TRC_D.pts'))===J([[0,0],[700,0],[700,500]]));
  wkey('Backspace');
  ok('Backspace removes the last vertex',J(w.eval('TRC_D.pts'))===J([[0,0],[700,0]]));
  ptr('pointermove',1500,40);ptr('pointerdown',1500,40);ptr('pointerup',1500,40);
  const e=wkey('Enter');
  ok('Enter finishes: the tag dialog opens and the key was taken',/Mozgásnyom/.test($('modal').textContent)&&e.defaultPrevented&&w.eval('TRC_D')===null);
  w.document.querySelector('.tpTag[value=atjaras]').checked=true;$('tpTwo').checked=true;okModal();
  ok('the saved trace carries the picked tags and the two-way flag',(function(){const t=T()[0];return t&&t.mode==='line45'&&t.dir===0&&t.tags.join()==='mozgas,atjaras'&&J(t.pts)===J([[0,0],[700,0],[1500,0]]);})());
  ok('Backspace with a single point left drops the draft',(function(){ptr('pointerdown',100,100);ptr('pointerup',100,100);wkey('Backspace');return w.eval('TRC_D')===null;})());
  ok('Esc on a one-point draft drops it (a draft, not data)',(function(){ptr('pointerdown',100,100);ptr('pointerup',100,100);const n=T().length;wkey('Escape');return w.eval('TRC_D')===null&&T().length===n&&!$('mOk')&&w.MRK_P.on===true;})());
  ok('Esc on a draft of 2+ points finishes it, the tool stays on; the next Esc leaves the tool',(function(){
    ptr('pointerdown',100,100);ptr('pointerup',100,100);ptr('pointermove',900,110);ptr('pointerdown',900,110);ptr('pointerup',900,110);
    wkey('Escape');const dlg=/Mozgásnyom/.test($('modal').textContent);okModal();const on=w.MRK_P.on;wkey('Escape');return dlg&&on&&!w.MRK_P.on&&T().length===2;})());
  ok('a double click finishes the line',(function(){w.mrkPlaneStart('line45');ptr('pointerdown',100,2000);ptr('pointerup',100,2000);ptr('pointerdown',900,2000);ptr('pointerup',900,2000);
    ptr('pointerdown',905,2000);ptr('pointerup',905,2000);const d=/Mozgásnyom/.test($('modal').textContent);okModal();return d&&T().length===3&&T()[2].pts.length===2;})());
  ok('Shift on the last click saves with the previous tags, no dialog',(function(){w.mrkPlaneStart('line45');ptr('pointerdown',100,2400);ptr('pointerup',100,2400);ptr('pointerdown',900,2400);ptr('pointerup',900,2400);
    wkey('Enter',{shiftKey:true});const nodlg=!$('mOk');return nodlg&&T().length===4&&T()[3].dir===0&&T()[3].tags.join()==='mozgas,atjaras';})());
  ok('changing the mode while drawing drops the draft',(function(){w.mrkPlaneStart('line45');ptr('pointerdown',100,100);ptr('pointerup',100,100);w.mrkPlaneCycle(1);w.mrkPlaneCycle(-1);ptr('pointermove',500,100);return w.eval('TRC_D')===null;})());
  ok('the plane toggle (R) puts the trace on the ceiling',(function(){w.mrkPlaneStart('line45');wkey('r');ptr('pointerdown',100,100);ptr('pointerup',100,100);
    const q=w.eval('TRC_D&&TRC_D.plane')==='ceiling';wkey('r');return q;})());
  w.mrkToolsOff();

  // 7 — drawing
  fixture();const t1=addTrace({pts:[[200,200],[2200,200]],tags:['mozgas']});
  ok('the scene has a polyline per trace, stroke 2, round joins',/<polyline[^>]*stroke="#2a8c8c" stroke-width="2" stroke-linejoin="round"/.test(w.trcSceneSvg()));
  ok('a directional trace draws direction triangles every 1000 mm, no <marker>',(function(){const s=w.trcSceneSvg();return (s.match(/<polygon/g)||[]).length===2&&s.indexOf('<marker')<0;})());
  ok('a short directional trace gets one triangle',(function(){addTrace({pts:[[200,600],[700,600]]});return (w.trcSceneSvg().match(/<polygon/g)||[]).length===3;})());
  ok('colour by first tag: atjaras, ejszakai, lepcso',(function(){const a=w.trcSvg(Object.assign({},t1,{tags:['atjaras']})),b=w.trcSvg(Object.assign({},t1,{tags:['ejszakai']})),c=w.trcSvg(Object.assign({},t1,{tags:['lepcso']}));
    return a.indexOf('#5470b0')>=0&&b.indexOf('#7a5cc0')>=0&&c.indexOf('#b07a2a')>=0;})());
  ok('dir 0 draws no triangles but a dot at each end',(function(){T().length=0;const t=addTrace({dir:0});const s=w.trcSvg(t);return s.indexOf('<polygon')<0&&(s.match(/<circle/g)||[]).length===2;})());
  ok('ends attached to a door get a white 3 px circle',(function(){T().length=0;const t=addTrace({pts:[[200,1500],[1750,1500]],b:door.id});const s=w.trcSvg(t);return /<circle[^>]*r="3" fill="#fff"/.test(s);})());
  ok('a ceiling trace is dashed',w.trcSvg(addTrace({plane:'ceiling'})).indexOf('stroke-dasharray="6 4"')>=0);
  ok('a trace with fewer than two points draws nothing',w.trcSvg({level:lvl,pts:[[1,1]],tags:[]})==='');
  ok('the trace is on the trace sub-layer: opacity goes through lyrWrap',(function(){w.lyrSetOp('L0','trace',0.5);const r=/<g opacity="0.5"><polyline/.test(w.trcSceneSvg());w.lyrSetOp('L0','trace',1);return r;})());
  ok('cats.trace=false hides every trace',(function(){w.eval('layers[0].cats.trace=false');const r=w.trcSceneSvg()==='';w.eval('layers[0].cats.trace=true');return r;})());
  ok('the trace layer is part of the scene string of draw()',(function(){w.draw();return w.eval('_lastScene').indexOf('stroke="#2a8c8c" stroke-width="2"')>=0;})());
  ok('triangles point a→b: reversing the trace flips them',(function(){T().length=0;const t=addTrace({pts:[[200,200],[1200,200]]});const a=w.trcSvg(t);const b=w.trcSvg(Object.assign({},t,{pts:t.pts.slice().reverse()}));return a!==b&&(a.match(/<polygon/g)||[]).length===1;})());

  // 8 — right-click
  fixture();const t8=addTrace({mode:'free',pts:[[200,1000],[800,1010],[1400,990],[1900,1000]],a:null,b:null});
  const rc=(x,y)=>{const b=w.planToBase(x,y,w.dz(lvl,0));w.clientToBase=()=>b;stage().dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:50}));};
  rc(800,1010);
  ok('right-click on a trace: Címkék…, Irány megfordítása, Kétirányú, Simítás most, Ajtókhoz kötés újra, Törlés',(function(){const l=ctxLabels();
    return ['Címkék…','Irány megfordítása','Kétirányú be','Simítás most','Ajtókhoz kötés újra','Törlés'].every(x=>l.indexOf(x)>=0);})());
  ctxClick('Irány megfordítása');
  ok('Irány megfordítása reverses the points and swaps a / b',(function(){return J(T()[0].pts[0])===J([1900,1000])&&J(T()[0].pts[3])===J([200,1000]);})());
  ok('reversing is undoable',(function(){w.doUndo();return T()[0].pts[0][0]===200;})());
  ok('...and swaps the door ends',(function(){const t=addTrace({a:'X1',b:'X2'});w.trcReverse(t);const r=t.a==='X2'&&t.b==='X1';T().pop();return r;})());
  rc(800,1010);ctxClick('Kétirányú be');
  ok('Kétirányú be makes the trace two-way (dir 0)',T()[0].dir===0);
  rc(800,1010);
  ok('the menu now offers Kétirányú ki',ctxLabels().indexOf('Kétirányú ki')>=0);ctxClick('Kétirányú ki');
  ok('Kétirányú ki makes it directional again',T()[0].dir===1);
  rc(800,1010);ctxClick('Simítás most');
  ok('Simítás most turns a freehand trace into a smooth one, ends kept',T()[0].mode==='smooth'&&J(T()[0].pts[0])===J([200,1000])&&J(T()[0].pts[T()[0].pts.length-1])===J([1900,1000]));
  ok('a smooth trace cannot be smoothed again (HUD)',(function(){rc(800,1000);ctxClick('Simítás most');return /szabadkézi/.test($('hud').textContent);})());
  ok('Ajtókhoz kötés újra attaches the ends that are in range',(function(){const t=T()[0];const r=w.trcReattach(t);return t.b===door.id&&J(t.pts[t.pts.length-1])===J([1750,1500])&&t.a===null;})());
  rc(800,1010);ctxClick('Címkék…');
  ok('Címkék… opens the dialog prefilled',w.document.querySelector('.tpTag[value=mozgas]').checked);
  w.document.querySelector('.tpTag[value=ejszakai]').checked=true;okModal();
  ok('editing stores the new tags',T()[0].tags.indexOf('ejszakai')>=0);
  ok('a right-click far from any trace does not offer the trace menu',(function(){rc(3500,2800);return ctxLabels().indexOf('Ajtókhoz kötés újra')<0;})());
  w.hideCtx();
  rc(800,1010);ctxClick('Törlés');
  ok('Törlés removes it',T().length===0);

  // 9 — validation
  fixture();
  addTrace({pts:[[200,1000],[1800,1000],[2200,1000],[3000,1000]]});
  ok('trace.room (info) when a trace passes through more than one room',(function(){const v=w.validate().filter(x=>x.code==='trace.room');return v.length===1&&v[0].sev==='info'&&/helyiségenként/.test(v[0].msg);})());
  ok('a trace inside one room is quiet',(function(){T().length=0;addTrace();return !w.validate().some(x=>x.code==='trace.room');})());
  ok('trace.door (warn) when a / b points at a missing opening',(function(){T().length=0;addTrace({a:'B999'});const v=w.validate().filter(x=>x.code==='trace.door');return v.length===1&&v[0].sev==='warn';})());
  ok('no warning for an existing door',(function(){T().length=0;addTrace({a:door.id});return !w.validate().some(x=>x.code==='trace.door');})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
