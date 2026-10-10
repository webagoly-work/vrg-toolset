// spec-58 — what is not seen cannot be touched (round 2026-10-10, WP-U1)
//
// The draw side has always filtered by level, layer, sub-layer and solo room; the hit side filtered by
// the LOCK only, so a socket on a hidden layer still stole the click, the menu and the lamp thumbnail.
// hitOk / hitOkWall / hitOkRec are the hit side of the same predicate — every check here is "drawn ⇔ hit".
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
  const st=w.__state,D=w.__data,LY=()=>w.eval('layers');
  st.zoom=1;st.style='normal';st.wallMode='translucent';
  LY().push({id:'L1',name:'Réteg 2',visible:true,cats:w.layerCatsAll()});w.renderLayers();
  const L1=()=>LY().find(l=>l.id==='L1');
  // four kinds on L1, far enough apart that each click has exactly one candidate
  const dev={type:'socket',level:lvl,x:1000,y:1000,h:300,layer:'L1',side:0};D.devices.push(dev);
  const opn={type:'door',level:lvl,x:4000,y:1000,w:900,h:2100,layer:'L1'};D.openings.push(opn);
  const note={level:lvl,x:1000,y:4000,text:'N1',layer:'L1'};D.notes.push(note);
  const wall={x0:6000,y0:6000,x1:9000,y1:6200,layer:'L1'};w.__getWalls()[lvl].push(wall);
  w.ensureIds(D);if(!wall.id)wall.id='W900';
  const aim=b=>{w.clientToBase=()=>b;};
  const atPt=(x,y,z)=>{aim(w.planToBase(x,y,w.dz(lvl,z||0)));return w.hitTest({clientX:0,clientY:0});};
  // hitTest aims a device at its mount height, everything else at the floor
  const hitOf=o=>{const h=atPt(o.x,o.y,D.devices.indexOf(o)>=0?(o.h||0):0);return h&&h.t!=='wall'?D[h.t][h.i]:h&&h.ref;};
  const wallHit=()=>{const h=atPt((wall.x0+wall.x1)/2,(wall.y0+wall.y1)/2,0);return !!h&&h.t==='wall'&&h.ref===wall;};
  const devIdx=()=>{aim(w.planToBase(dev.x,dev.y,w.dz(lvl,dev.h)));return w.devHitIdx({clientX:0,clientY:0});};
  const show=v=>{L1().visible=v;};

  // 1 — layer and sub-layer
  ok('baseline: each of the four is hit where it stands',hitOf(dev)===dev&&hitOf(opn)===opn&&hitOf(note)===note&&wallHit());
  show(false);
  ok('L1 hidden → the device, opening, note and wall are not hit',hitOf(dev)===null&&hitOf(opn)===null&&hitOf(note)===null&&!wallHit());
  show(true);L1().cats.socket=false;
  ok('only the socket sub-layer hidden → the socket is not hit',hitOf(dev)===null);
  ok('… while the note on the same layer still is',hitOf(note)===note&&hitOf(opn)===opn);
  L1().cats.socket=true;L1().cats.wall=false;
  ok('the wall sub-layer hidden → the wall is not hit',!wallHit());
  L1().cats.wall=true;L1().cats.note=false;
  ok('the note sub-layer hidden → the note is not hit',hitOf(note)===null);
  L1().cats.note=true;

  // 2 — the level
  st.levels[lvl]=false;
  ok('level off → nothing on it is hit',hitOf(dev)===null&&hitOf(opn)===null&&hitOf(note)===null&&!wallHit());
  st.levels[lvl]=true;

  // 3 — devHitIdx (right-click device menu, spotlight) mirrors it
  ok('devHitIdx finds the device when shown',devIdx()===D.devices.indexOf(dev));
  show(false);ok('devHitIdx: layer hidden → null',devIdx()===null);show(true);
  L1().cats.socket=false;ok('devHitIdx: sub-layer hidden → null',devIdx()===null);L1().cats.socket=true;
  st.levels[lvl]=false;ok('devHitIdx: level off → null',devIdx()===null);st.levels[lvl]=true;

  // 4 — box select
  const boxAll=()=>{w.clearMulti();w.__setSel(null);w.eval('selBox={x0:-1e7,y0:-1e7,x1:1e7,y1:1e7}');w.finishSelBox();w.eval('selBox=null');
    return w.selList().map(h=>h.t==='wall'?h.ref:D[h.t][h.i]);};
  ok('box select over all four takes them when shown',(function(){const s=boxAll();return [dev,opn,note,wall].every(o=>s.indexOf(o)>=0);})());
  show(false);
  ok('box select with L1 hidden takes none of them',(function(){const s=boxAll();return [dev,opn,note,wall].every(o=>s.indexOf(o)<0)&&w.selList().length===0;})());
  show(true);w.clearMulti();w.__setSel(null);

  // 5 — the wall mode
  st.wallMode='hidden';
  ok('Falak = rejtett → the wall is not hit',!wallHit());
  st.style='whiteout';ok('… but the white-out view draws walls whatever the mode, so there it is hit',wallHit());
  st.style='blueprint';ok('… and so does the blueprint',wallHit());
  st.style='normal';st.wallMode='translucent';
  ok('Falak = áttetsző → the wall is hit',wallHit());
  st.wallMode='solid';ok('Falak = tömör → the wall is hit',wallHit());st.wallMode='translucent';

  // 6 — lock is unchanged
  w.lyrToggleLock('L1');
  ok('a locked layer still reports "Zárolt réteg" and is not hit',hitOf(dev)===null&&/Zárolt réteg: Réteg 2/.test($('hud').textContent));
  w.lyrToggleLock('L1');
  ok('a hidden layer says nothing about locks',(function(){$('hud').textContent='';show(false);const h=hitOf(dev);show(true);return h===null&&!/Zárolt/.test($('hud').textContent);})());

  // the per-collection rules 04-render applies on top of the layer
  ok('a generated object is not hit while generated objects are off',(function(){
    const o={level:lvl,x:1000,y:7000,w:400,d:400,ht:300,layer:'L0',genFor:'X1',name:'gen'};D.objects.push(o);
    const on=hitOf(o)===o;st.showGenObjects=false;const off=hitOf(o);st.showGenObjects=true;D.objects.pop();
    return on&&off===null;})());
  ok('a cable whose circuit kind is switched off is not hit',(function(){
    const cb={type:'lighting',layer:'L1',nodes:[{level:lvl,x:7000,y:1000,h:300}]};D.cables.push(cb);
    const on=(h=>h&&h.t==='cables')(atPt(7000,1000,300));w.eval('circOn.lighting=false');
    const off=atPt(7000,1000,300);w.eval('circOn.lighting=true');show(false);const hid=atPt(7000,1000,300);show(true);D.cables.pop();
    return on&&off===null&&hid===null;})());
  ok('a path section on a hidden layer is not hit (pathSectionHit)',(function(){
    const pa={ptype:'gege',layer:'L1',sections:[],nodes:[{level:lvl,x:7000,y:3000,h:300},{level:lvl,x:9000,y:3000,h:300}]};D.paths.push(pa);w.ensureIds(D);
    aim(w.planToBase(8000,3000,w.dz(lvl,300)));const on=w.pathSectionHit({clientX:0,clientY:0});
    show(false);const off=w.pathSectionHit({clientX:0,clientY:0});show(true);D.paths.pop();
    return !!on&&off===null;})());
  ok('a floor on a hidden layer is not hit; in a solo room only the solo floor is',(function(){
    const fa={level:lvl,poly:[[10000,0],[12000,0],[12000,2000],[10000,2000]],layer:'L1'},
          fb={level:lvl,poly:[[13000,0],[15000,0],[15000,2000],[13000,2000]],layer:'L0'};D.floors.push(fa,fb);
    const ia=D.floors.indexOf(fa),ib=D.floors.indexOf(fb);
    const at=f=>{const h=atPt(f.poly[0][0]+1000,1000,0);return h&&h.t==='floors'?D.floors[h.i]:null;};
    const on=at(fa)===fa;show(false);const off=at(fa);show(true);
    st.soloRoom={src:'F',i:ib,level:lvl};const soloA=at(fa),soloB=at(fb);
    // the solo room also hides a device outside it — but a note outside it is still drawn, so still hit
    const devOut=hitOf(dev),noteOut=hitOf(note);st.soloRoom=null;
    D.floors.splice(ia,2);
    return on&&off===null&&soloA===null&&soloB===fb&&devOut===null&&noteOut===note;})());
  ok('a lamp on a hidden layer shows no thumbnail (lampAt)',(function(){
    const lp={type:'light',level:lvl,x:3000,y:7000,h:2600,layer:'L1',thumb:'x'};D.devices.push(lp);
    const real=w.baseToClientPt;w.baseToClientPt=(bx,by)=>[bx,by];const b=w.planToBase(lp.x,lp.y,w.dz(lvl,lp.h));
    const on=w.lampAt(b[0],b[1])===D.devices.indexOf(lp);show(false);const off=w.lampAt(b[0],b[1]);show(true);
    w.baseToClientPt=real;D.devices.pop();return on&&off===null;})());
  ok('a hidden note (its own hide flag) is not hit',(function(){note.hidden=true;const h=hitOf(note);delete note.hidden;return h===null;})());
  ok('a measure is untouched by layers (it has none)',(function(){
    const m=[{level:lvl,x:10000,y:7000},{level:lvl,x:12000,y:7000}];D.measures.push(m);
    show(false);const h=atPt(11000,7000,0);show(true);D.measures.pop();return !!h&&h.t==='measures';})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
