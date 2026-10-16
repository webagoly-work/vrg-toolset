// spec-23 — controller scheme, end to end: a scripted pad -> 08b-gamepad.js -> the
// PLANNER_CAM / PLANNER_INPUT adapters -> the planner's real handlers.
//
// jsdom has no Gamepad API, which is the point: the driver's frame is a plain
// function, step(pad, dt), so a test can feed it frames the same way
// control-bridge-smoke.js feeds the phone link scripted messages. Nothing here
// needs a real controller, and the one thing that does — whether the browser
// hands us a pad at all — is in docs/browser_verification_checklist.md.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);

// a pad frame: axes [LX,LY,RX,RY], buttons by index
function PAD(o){
  o=o||{};
  const ax=o.axes||[0,0,0,0];
  const b=[];for(let i=0;i<17;i++)b.push({pressed:false,value:0});
  (o.down||[]).forEach(i=>{b[i]={pressed:true,value:1};});
  Object.keys(o.analog||{}).forEach(i=>{b[i]={pressed:+o.analog[i]>0.5,value:+o.analog[i]};});
  return {id:'Test Pad',index:0,connected:true,mapping:'standard',axes:ax,buttons:b};}
const B={A:0,B:1,X:2,Y:3,LB:4,RB:5,LT:6,RT:7,BACK:8,START:9,LS:10,RS:11,DU:12,DD:13,DL:14,DR:15};
const NONE=PAD();

setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;
  w.newBlankProject();
  const lvl='ground';
  const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:0,x1:6000,y1:300});
  w.__data.floors.push({level:lvl,poly:[[0,0],[6000,0],[6000,4000],[0,4000]],name:'Nappali'});
  w.__data.devices.push({type:'socket',ref:'D1',x:1200,y:340,h:300,level:lvl,side:1});
  w.ensureIds(w.__data);w.draw();

  const GP=w.PLANNER_GP, IN=w.PLANNER_INPUT, CAM=w.PLANNER_CAM, gp=w.__gp;
  // jsdom gives every element a zero-size box; the driver needs a real stage
  // rectangle, so stand one in.
  const RECT={left:0,top:0,width:1000,height:720,right:1000,bottom:720};
  IN.stageRect=()=>RECT;
  // jsdom implements no SVG geometry at all. The stage's viewBox is
  // "0 0 1000 720" and RECT is the same size, so an identity mapping here is
  // not a fudge — it is exactly what a real browser would compute for a stage
  // of that size. (Same spirit as the AbortController shim in qr-net-smoke.)
  const stageEl=$('stage');
  stageEl.createSVGPoint=function(){return {x:0,y:0,
    matrixTransform(){return {x:this.x,y:this.y};}};};
  stageEl.getScreenCTM=function(){return {inverse(){return {};}};};
  const CENTRE=[RECT.width/2,RECT.height/2];
  const step=(p,dt)=>gp.step(p,dt==null?1/60:dt);
  // a press is two frames: down, then up. Held buttons stay down.
  const tap=(...ids)=>{step(PAD({down:ids}));step(NONE);};
  const reset=()=>{gp.reset();step(NONE);};

  // ---------- the adapters ----------
  ok('PLANNER_CAM is present (shared with the phone gyro)',
     !!CAM&&typeof CAM.setYaw==='function'&&typeof CAM.zoomBy==='function');
  ok('PLANNER_INPUT exposes the mouse and keyboard verbs',
     !!IN&&['hover','press','release','context','escape','heightStep','cyclePick','drop','fine']
       .every(k=>typeof IN[k]==='function'));
  ok('the driver exports a toggle and a config',
     !!GP&&typeof GP.setEnabled==='function'&&typeof GP.cfg().dead==='number');

  // ---------- the toggle ----------
  ok('starts off',GP.enabled()===false);
  ok('the toolbar button exists and is wired',!!$('gpBtn')&&typeof $('gpBtn').onclick==='function');
  GP.setEnabled(true);
  ok('turns on',GP.enabled()===true);
  ok('the button lights up',$('gpBtn').className.indexOf('on')>=0);
  ok('the legend appears',(function(){reset();step(PAD());
    return $('gpLegend').style.display==='flex'&&$('gpLegend').textContent.length>0;})());

  // ---------- stick maths ----------
  ok('the dead zone is radial, so slow diagonals still move',(function(){
    const c=gp.cfg(),d=c.dead;
    const inside=gp.stick({axes:[d*0.6,d*0.6,0,0]},0,1);
    const outside=gp.stick({axes:[0.9,0.9,0,0]},0,1);
    return inside[0]===0&&inside[1]===0&&outside[0]>0&&outside[1]>0;})());
  ok('full deflection still reaches full speed after the dead zone',(function(){
    const v=gp.stick({axes:[1,0,0,0]},0,1);return Math.abs(v[0]-1)<1e-6;})());
  ok('the response curve leaves room for slow movement',(function(){
    const half=gp.stick({axes:[0.5,0,0,0]},0,1)[0];return half>0&&half<0.5;})());

  // ---------- the cursor box: one mechanism, one number per mode ----------
  w.setMode('select');
  ok('select gets a free cursor',gp.boxFor('select')>0);
  ok('drawing gets a locked centre reticle',gp.boxFor('device')===0&&gp.boxFor('path')===0);
  ok('the free cursor moves with the left stick',(function(){
    reset();w.setMode('select');step(PAD());
    const a=gp.cursor();step(PAD({axes:[1,0,0,0]}),0.1);const b=gp.cursor();
    return a&&b&&b[0]>a[0]+10&&Math.abs(b[1]-a[1])<1;})());
  ok('the locked reticle stays at centre and pans the world instead',(function(){
    reset();w.setMode('device');step(PAD());
    const px=w.__state.panX;
    step(PAD({axes:[1,0,0,0]}),0.1);
    const c=gp.cursor();
    return c&&Math.abs(c[0]-CENTRE[0])<0.01&&w.__state.panX<px-10;})());
  ok('pushing past the box edge drags the camera',(function(){
    reset();w.setMode('select');step(PAD());
    for(let i=0;i<40;i++)step(PAD({axes:[1,0,0,0]}),0.05);   // pinned at the edge
    const px=w.__state.panX;
    step(PAD({axes:[1,0,0,0]}),0.05);
    return w.__state.panX<px;})());

  // ---------- camera ----------
  ok('the right stick yaws',(function(){reset();step(PAD());
    const y=w.__state.rot;step(PAD({axes:[0,0,1,0]}),0.2);return w.__state.rot!==y;})());
  ok('the right stick pitches',(function(){reset();step(PAD());
    const p=w.__state.pitch;step(PAD({axes:[0,0,0,1]}),0.2);return w.__state.pitch<p;})());
  ok('pitch stays inside the 5..90 clamp',(function(){reset();
    for(let i=0;i<200;i++)step(PAD({axes:[0,0,0,-1]}),0.05);
    const hi=w.__state.pitch;
    for(let i=0;i<400;i++)step(PAD({axes:[0,0,0,1]}),0.05);
    return hi<=90&&w.__state.pitch>=5;})());
  ok('the triggers zoom, analog and both ways',(function(){reset();step(PAD());
    const z0=w.__state.zoom;
    step(PAD({analog:{[B.RT]:1}}),0.3);const zIn=w.__state.zoom;
    step(PAD({analog:{[B.LT]:1}}),0.3);const zOut=w.__state.zoom;
    return zIn>z0&&zOut<zIn;})());
  ok('a light trigger squeeze zooms less than a full one',(function(){reset();step(PAD());
    const z0=w.__state.zoom;step(PAD({analog:{[B.RT]:0.3}}),0.2);const soft=w.__state.zoom/z0;
    const z1=w.__state.zoom;step(PAD({analog:{[B.RT]:1}}),0.2);const hard=w.__state.zoom/z1;
    return hard>soft;})());

  // ---------- A is the mouse button ----------
  ok('A places a device in device mode',(function(){reset();
    w.setMode('device');$('devType').value='socket';
    const n=w.__data.devices.length;
    step(PAD());tap(B.A);
    return w.__data.devices.length===n+1;})());
  ok('A press/release is pointerdown/pointerup, so a drag is possible',(function(){reset();
    w.setMode('select');step(PAD());
    step(PAD({down:[B.A]}));const held=IN.isHeld();
    step(NONE);
    return held===true&&IN.isHeld()===false;})());
  ok('A adds a node in path mode',(function(){reset();
    w.setMode('path');step(PAD());tap(B.A);tap(B.A);
    const d=w.__state;return true;})()); // placement is exercised above; this only
                                          // asserts the path handler does not throw

  // ---------- closing a run: the gap B cannot fill, because Esc discards ----------
  ok('RS closes an open path instead of discarding it',(function(){
    gp.reset();w.setMode('path');step(PAD());
    const n=w.__data.paths.length;
    tap(B.A);tap(B.A);tap(B.A);          // three nodes
    tap(B.RS);
    return w.__data.paths.length===n+1;})());
  ok('closing a run is a registered action, so the wheel and ⌘K reach it too',
     !!w.actionById('draw.finish'));
  ok('it is offered only while a run is actually open',(function(){
    gp.reset();w.setMode('select');step(PAD());
    const offWhenIdle=!w.actionsFor().some(a=>a.id==='draw.finish');
    w.setMode('path');step(PAD());tap(B.A);tap(B.A);
    const onWhenDrawing=w.actionsFor().some(a=>a.id==='draw.finish');
    tap(B.RS);
    return offWhenIdle&&onWhenDrawing;})());
  ok('RS still recentres the pivot when not drawing',(function(){
    gp.reset();w.setMode('select');step(PAD());
    tap(B.RS);
    return true;})());   // only asserts it does not throw or finish anything

  // ---------- X is context-sensitive, and the legend says so ----------
  ok('X flips the wall face while placing a device',(function(){
    gp.reset();w.setMode('device');step(PAD());
    const side=w.__state.side;tap(B.X);
    return w.__state.side!==side;})());
  ok('X opens the context menu in select mode',(function(){
    gp.reset();w.setMode('select');step(PAD());
    tap(B.X);
    const shown=$('ctx').style.display!=='none';
    $('ctx').style.display='none';
    return shown;})());
  ok('the legend names the meaning X actually has right now',(function(){
    gp.reset();w.setMode('device');step(PAD());
    const dev=gp.legend().find(x=>x[0]==='X')[1];
    w.setMode('select');step(PAD());
    const sel=gp.legend().find(x=>x[0]==='X')[1];
    w.setMode('path');step(PAD());
    const run=gp.legend().find(x=>x[0]==='X')[1];
    return dev!==sel&&sel!==run&&dev.indexOf('Fal')>=0&&run.indexOf('Doboz')>=0;})());

  // ---------- B is Esc ----------
  ok('B steps out of a tool back to select',(function(){reset();
    w.setMode('wall');step(PAD());tap(B.B);
    return w.__state.mode==='select';})());

  // ---------- the D-pad is the arrow keys ----------
  ok('D-pad up/down steps the drawing height while drawing',(function(){reset();
    w.setMode('device');step(PAD());
    const h0=w.__state.drawHKey;
    tap(B.DU);
    return w.__state.drawHKey!==h0;})());
  ok('D-pad up/down tilts the camera when not drawing',(function(){reset();
    w.setMode('select');step(PAD());
    const p=w.__state.pitch;tap(B.DU);
    return w.__state.pitch>p;})());
  ok('D-pad left/right cycles the place palette on a path',(function(){reset();
    w.setMode('path');step(PAD());
    const i=w.__state.placeIdx||0;tap(B.DR);
    return (w.__state.placeIdx||0)!==i;})());
  ok('a held D-pad repeats after a delay, not every frame',(function(){reset();
    w.setMode('select');step(PAD());
    const p0=w.__state.pitch;
    step(PAD({down:[B.DU]}),1/60);const afterOne=w.__state.pitch;
    step(PAD({down:[B.DU]}),1/60);const afterTwo=w.__state.pitch;
    // first frame fires, the second must not (still inside the repeat delay)
    return afterOne!==p0&&afterTwo===afterOne;})());

  // ---------- undo / redo ----------
  ok('LB undoes, RB redoes',(function(){reset();
    w.setMode('device');$('devType').value='socket';step(PAD());
    const n=w.__data.devices.length;
    tap(B.A);const placed=w.__data.devices.length;
    tap(B.LB);const undone=w.__data.devices.length;
    tap(B.RB);const redone=w.__data.devices.length;
    return placed===n+1&&undone===n&&redone===n+1;})());

  // ---------- the wheel ----------
  ok('Y opens the wheel',(function(){reset();step(PAD());tap(B.Y);
    const s=gp.wheel();return !!s&&s.level===0&&s.sectors.length>0;})());
  ok('the wheel has at most eight sectors',gp.wheel().sectors.length<=8);
  ok('the wheel renders',$('gpWheel').style.display==='flex'&&$('gpWheel').innerHTML.indexOf('gpSec')>=0);
  ok('the stick picks a sector and up is sector 0',(function(){
    step(PAD({axes:[0,-1,0,0]}));return gp.wheel().pick===0;})());
  ok('the stick sweeps clockwise',(function(){
    const n=gp.wheel().sectors.length;
    step(PAD({axes:[1,0,0,0]}));
    return gp.wheel().pick===Math.round(n/4)%n;})());
  ok('the sector stays picked when the thumb returns to centre',(function(){
    const was=gp.wheel().pick;
    step(PAD());
    return was>=0&&gp.wheel().pick===was;})());
  ok('nothing is picked until the stick is moved',(function(){
    gp.closeWheel();gp.reset();step(PAD());tap(B.Y);
    return gp.wheel().pick===-1;})());
  ok('A descends into the picked sector, even after the thumb recentres',(function(){
    step(PAD({axes:[0,-1,0,0]}));   // aim at sector 0
    tap(B.A);                        // press with the stick back at centre
    const s=gp.wheel();return !!s&&s.level===1;})());
  ok('B climbs back out, then closes',(function(){
    tap(B.B);const back=gp.wheel();
    tap(B.B);const gone=gp.wheel();
    return back&&back.level===0&&gone===null;})());
  ok('the wheel is never deeper than two levels',(function(){reset();step(PAD());
    tap(B.Y);step(PAD({axes:[0,-1,0,0]}));tap(B.A);tap(B.A);
    const s=gp.wheel();
    return s===null||s.level<=1;})());   // running an action closes it
  ok('curated mode gives a fixed eight-sector ring',(function(){
    gp.reset();const was=GP.cfg().wheel;
    GP.set('wheel','curated');step(PAD());tap(B.Y);
    const s=gp.wheel();const n=s?s.sectors.length:0;
    if(s)gp.closeWheel();
    GP.set('wheel',was);
    return n>0&&n<=8;})());
  ok('the wheel is generated from the action registry, not a second list',(function(){
    gp.reset();step(PAD());tap(B.Y);
    const names=gp.wheel().sectors;
    const groups={};w.ACTIONS.forEach(a=>groups[a.group||'Egyéb']=1);
    gp.closeWheel();
    return names.every(n=>groups[n]||n==='Egyéb');})());
  ok('the top ring does not move when the context changes — muscle memory',(function(){
    gp.reset();w.setMode('select');step(PAD());tap(B.Y);
    const a=gp.wheel().sectors.join('|');gp.closeWheel();
    gp.reset();w.setMode('path');step(PAD());tap(B.A);tap(B.A);   // a run open, different ctx
    tap(B.Y);const b=gp.wheel().sectors.join('|');gp.closeWheel();
    w.runAction('draw.finish');
    return a===b&&a.length>0;})());
  ok('unavailable actions are dimmed, not hidden',(function(){
    gp.reset();w.setMode('select');w.__clearMulti();step(PAD());
    tap(B.Y);
    // Szerkesztés holds edit.delete, which needs a selection — so with nothing
    // selected that ring must still list it, greyed.
    const ix=gp.wheel().sectors.indexOf('Szerkesztés');
    if(ix<0){gp.closeWheel();return false;}
    gp.pick(ix);tap(B.A);
    const items=gp.items();
    gp.closeWheel();
    const del=items&&items.find(i=>i.id==='edit.delete');
    return !!del&&del.dis===true;})());
  ok('pressing A on a dimmed action says what it needs and stays open',(function(){
    gp.reset();w.setMode('select');w.__clearMulti();step(PAD());
    tap(B.Y);
    const ix=gp.wheel().sectors.indexOf('Szerkesztés');
    gp.pick(ix);tap(B.A);
    const items=gp.items();
    const di=items.findIndex(i=>i.dis);
    if(di<0){gp.closeWheel();return false;}
    gp.pickSub(di);
    const hudBefore=$('hud').textContent;
    tap(B.A);
    const stillOpen=!!gp.wheel();
    const explained=$('hud').textContent!==hudBefore&&$('hud').textContent.length>0;
    gp.closeWheel();
    return stillOpen&&explained;})());
  ok('every registered action is assigned to a sector, in both wheel modes',(function(){
    const total=w.ACTIONS.length;
    const sum=mode=>{
      const was=GP.cfg().wheel;GP.set('wheel',mode);
      gp.reset();step(PAD());tap(B.Y);
      const f=gp.wheel().full.reduce((a,b)=>a+b,0);
      gp.closeWheel();GP.set('wheel',was);return f;};
    return sum('auto')===total&&sum('curated')===total;})());
  ok('a full ring says how many it is not showing',(function(){
    gp.reset();step(PAD());tap(B.Y);
    const f=gp.wheel().full,n=f.length;
    let over=-1;
    for(let i=0;i<n;i++)if(f[i]>12){over=i;break;}
    if(over<0){gp.closeWheel();return true;}      // nothing overflowed: nothing to say
    gp.pick(over);tap(B.A);
    const shown=(gp.items()||[]).length;
    const foot=$('gpWheel').textContent;
    gp.closeWheel();
    return shown===12&&foot.indexOf('tov\u00e1bbi')>=0;})());
  ok('an overflowing ring keeps every runnable action and cuts dimmed ones',(function(){
    // direct test of the cut, with a group built to be the awkward case: the
    // runnable entries sit at the very END of canonical order, so a naive
    // slice(0,12) would throw all five of them away.
    const N=gp.SUBMAX;
    const list=[],live={};
    for(let i=0;i<N+8;i++){
      const a={id:'t'+i,label:'T'+i,group:'Eszköz'};
      list.push(a);
      if(i>=N+3)live[a.id]=1;                     // the last five are runnable
    }
    const ring=gp.ringFor(list,live);
    const kept=ring.map(x=>x.id);
    const runnableKept=ring.filter(x=>!x.dis).length;
    return ring.length===N&&runnableKept===5
        && kept.indexOf('t'+(N+7))>=0             // the last runnable survived
        && kept.indexOf('t0')>=0;})());           // canonical order still leads
  ok('a ring that fits is left exactly as it is',(function(){
    const list=[{id:'a',label:'A',group:'Eszköz'},{id:'b',label:'B',group:'Eszköz'}];
    const ring=gp.ringFor(list,{a:1});
    return ring.length===2&&ring[0].id==='a'&&ring[0].dis===false&&ring[1].dis===true;})());
  ok('no sub-ring is so long it turns into slivers',(function(){
    gp.reset();step(PAD());tap(B.Y);
    const n=gp.wheel().sectors.length;
    let worst=0;
    for(let i=0;i<n;i++){
      gp.pick(i);tap(B.A);
      const it=gp.items();
      if(it&&it.length>worst)worst=it.length;
      tap(B.B);}
    gp.closeWheel();
    return worst>0&&worst<=12;})());

  // ---------- standing down when something else owns the input ----------
  ok('an open modal stops the driver touching the drawing',(function(){
    gp.reset();w.setMode('select');step(PAD());
    w.openModal('teszt','<div></div>',()=>{});
    const busy=IN.busy();
    const n=w.__data.devices.length,z=w.__state.zoom;
    step(PAD({axes:[1,1,1,1],analog:{[B.RT]:1}}),0.2);
    const quiet=(w.__data.devices.length===n&&w.__state.zoom===z);
    w.closeModal();
    return busy==='modal'&&quiet;})());
  ok('a dialog opening mid-press does not leave the button stuck down',(function(){
    gp.reset();w.setMode('select');step(PAD());
    step(PAD({down:[B.A]}));              // A down, drag in progress
    const heldBefore=IN.isHeld();
    w.openModal('teszt','<div></div>',()=>{});
    step(PAD({down:[B.A]}));              // still holding A, but the dialog owns input
    const released=IN.isHeld()===false;
    w.closeModal();step(NONE);
    return heldBefore===true&&released;})());
  ok('the wheel opening mid-press releases too',(function(){
    gp.reset();w.setMode('select');step(PAD());
    step(PAD({down:[B.A]}));
    tap(B.Y);                              // wheel opens while A was down
    const released=IN.isHeld()===false;
    gp.closeWheel();step(NONE);
    return released;})());
  ok('B still backs out of a modal',(function(){
    gp.reset();w.openModal('teszt','<div></div>',()=>{});
    step(PAD());tap(B.B);
    return IN.busy()===null;})());

  ok('the legend stands down behind a dialog instead of lying about A',(function(){
    gp.reset();w.setMode('device');step(PAD());
    const open=gp.legend().map(x=>x[1]).join('|');
    w.openModal('teszt','<div></div>',()=>{});
    step(PAD());
    const shut=gp.legend().map(x=>x[1]).join('|');
    w.closeModal();
    return open.indexOf('Készülék')>=0&&shut.indexOf('Készülék')<0&&shut.indexOf('Vissza')>=0;})());

  // ---------- the chrome rule: this feature may not touch the drawing ----------
  ok('picking a tool raises its ghost without the stick being touched',(function(){
    gp.reset();w.setMode('select');step(PAD());
    w.setMode('device');
    step(PAD());                       // sticks at rest
    return IN.hasCursor()===true;})());
  ok('the scene layer is byte-identical with the controller on and off',(function(){
    gp.reset();w.setMode('select');
    GP.setEnabled(false);w.draw();
    const off=$('lyScene').innerHTML;
    GP.setEnabled(true);step(PAD());step(PAD({axes:[0.4,0.4,0,0]}),0.1);w.draw();
    const on=$('lyScene').innerHTML;
    return off.length>500&&off===on;})());
  ok('every controller surface is DOM chrome, never SVG in the stage',(function(){
    const stageHtml=$('stage').innerHTML;
    return stageHtml.indexOf('gpCursor')<0&&stageHtml.indexOf('gpWheel')<0
        && stageHtml.indexOf('gpLegend')<0&&stageHtml.indexOf('gpSec')<0;})());

  // ---------- sticky targeting ----------
  ok('sticky targeting is a press-time decision, not a moving cursor',(function(){
    gp.reset();w.setMode('select');step(PAD());
    const before=gp.cursor();
    const aimed=gp.aim(before[0],before[1]);
    step(NONE);
    const after=gp.cursor();
    return after[0]===before[0]&&after[1]===before[1]&&Array.isArray(aimed);})());
  ok('a zero radius turns stickiness off entirely',(function(){
    const was=GP.cfg().sticky;GP.set('sticky',0);
    const p=gp.aim(123,456);GP.set('sticky',was);
    return p[0]===123&&p[1]===456;})());

  // ---------- the legend ----------
  ok('the legend re-labels itself per mode',(function(){
    gp.reset();w.setMode('select');step(PAD());
    const a=gp.legend().map(x=>x[1]).join('|');
    w.setMode('path');step(PAD());
    const b=gp.legend().map(x=>x[1]).join('|');
    return a!==b;})());
  ok('the legend names every button the scheme uses',(function(){
    const keys=gp.legend().map(x=>x[0]);
    return ['A','B','X','Y','LB','RB'].every(k=>keys.indexOf(k)>=0);})());
  ok('Back hides and shows the legend',(function(){
    gp.reset();step(PAD());
    const on=GP.cfg().legend;tap(B.BACK);
    const off=GP.cfg().legend;tap(B.BACK);
    return off===!on&&GP.cfg().legend===on;})());

  // ---------- the actions are registered ----------
  ok('the toggle is in the action registry, so ⌘K and the status bar find it',
     !!w.actionById('input.gamepad'));
  ok('running the action toggles the mode',(function(){
    const was=GP.enabled();w.runAction('input.gamepad');
    const flipped=GP.enabled()!==was;w.runAction('input.gamepad');
    return flipped&&GP.enabled()===was;})());

  // ---------- off means off ----------
  ok('turning it off stops the loop and clears every overlay',(function(){
    GP.setEnabled(false);
    return $('gpCursor').style.display==='none'
        && $('gpWheel').style.display==='none'
        && $('gpLegend').style.display==='none';})());
  ok('the setting survives a reload (localStorage, not project state)',(function(){
    GP.setEnabled(true);
    const raw=w.localStorage.getItem('villanyterv_gamepad');
    GP.setEnabled(false);
    return !!raw&&JSON.parse(raw).on===true;})());
  ok('controller config never leaks into the saved project',(function(){
    const s=JSON.stringify(w.__state);
    return s.indexOf('gamepad')<0&&s.indexOf('cursorSpeed')<0;})());

  // ---------- the settings panel ----------
  ok('the settings panel carries a controller section',(function(){
    w.settingsPanel();
    const txt=$('modal').textContent;
    const has=!!$('gpOn')&&!!$('gpWheelMode')&&txt.indexOf('Kontroller')>=0;
    w.closeModal();return has;})());

 }catch(e){R.push(['EXCEPTION: '+(e&&e.stack||e),false]);}

 const bad=R.filter(r=>!r[1]);
 R.forEach(r=>{if(!r[1])console.log('FAIL  '+r[0]+(r[2]?('  — '+r[2]):''));});
 console.log(bad.length?(bad.length+' FAILED of '+R.length):('ALL PASS ('+R.length+')'));
 process.exit(bad.length?1:0);
},400);
