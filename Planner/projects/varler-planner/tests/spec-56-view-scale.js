// The view scale (nézeti lépték) and the room-label fit.
//
// Two complaints, one cause: the drawing's base scale was a constant, so the zoom ceiling put a
// floor under how close you could work, and the room name was sized from the paper scale with no
// regard for the room, so a WC wore a label nearly twice its own width.
//
// What must hold:
//   * a step changes how far the zoom reaches, and nothing else — the picture does not move, and
//     pens, device symbols and labels keep their size on screen;
//   * step 1 stays byte-identical to the old fixed scale (the golden renders depend on it);
//   * a label never grows, and shrinks only as far as the room makes it.
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
 const near=(a,b,e)=>Math.abs(a-b)<(e||1e-6);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  w.loadBuilding(w.__H,true);
  const st=w.__state;st.style='normal';st.pitch=90;st.active='ground';st.bpScale=50;st.bpFine=1;
  w.vsSet(1);w.resetView();w.draw();

  // ---------- the steps ----------
  ok('step 1 is the base scale the goldens were drawn at',w.vsK()===1&&near(w.__SC(),0.045));
  ok('the ladder starts at 1 and is strictly increasing',(function(){
    const V=w.VIEW_SCALES;return V[0]===1&&V.every((v,i)=>i===0||v>V[i-1]);})(),w.VIEW_SCALES.join(','));
  ok('an unknown step falls back to 1',w.vsOk(7)===1&&w.vsOk(null)===1&&w.vsOk('10')===10);
  ok('setting a step moves SC and nothing else about the model',(function(){
    w.vsSet(10);const a=near(w.__SC(),0.45)&&w.vsK()===10;w.vsSet(1);return a;})());
  ok('the same step twice is a no-op',(function(){w.vsSet(5);const r=w.vsSet(5);w.vsSet(1);return r===false;})());

  // ---------- the picture does not move ----------
  const sx=()=>{const q=w.planToBase(3000,3000,w.dz('ground',0));
    return [q[0]*st.zoom+st.panX,q[1]*st.zoom+st.panY];};
  const perM=()=>{const a=w.planToBase(0,0,0),b=w.planToBase(1000,0,0);
    return Math.hypot(b[0]-a[0],b[1]-a[1])*st.zoom;};
  ok('a plan point keeps its screen position across every step',(function(){
    const [x0,y0]=sx();let bad='';
    for(const f of w.VIEW_SCALES){w.vsSet(f);const [x,y]=sx();if(!near(x,x0,0.01)||!near(y,y0,0.01))bad=f+'x';}
    w.vsSet(1);return bad||true;})()===true);
  ok('and so does the size of a metre on the building',(function(){
    const m0=perM();let bad='';
    for(const f of w.VIEW_SCALES){w.vsSet(f);if(!near(perM(),m0,0.01))bad=f+'x';}
    w.vsSet(1);return bad||true;})()===true);
  ok('a round trip back to 1 restores zoom and pan exactly',(function(){
    const z=st.zoom,px=st.panX,py=st.panY;
    w.vsSet(2);w.vsSet(10);w.vsSet(1);
    return near(st.zoom,z,1e-9)&&near(st.panX,px,1e-6)&&near(st.panY,py,1e-6);})());

  // ---------- pens and symbols keep their SCREEN size ----------
  const pen=()=>+w.nvSW(w.__pens().NV_PEN.edge)*st.zoom;
  const sym=()=>w.devK()*st.zoom;
  const badge=()=>w.vsP(9.5)*st.zoom;
  ok('the wall pen is the same thickness on screen at every step',(function(){
    const a=pen();let bad='';for(const f of w.VIEW_SCALES){w.vsSet(f);if(!near(pen(),a,1e-3))bad=f+'x '+pen();}
    w.vsSet(1);return bad||true;})()===true);
  ok('so is a device symbol',(function(){
    const a=sym();let bad='';for(const f of w.VIEW_SCALES){w.vsSet(f);if(!near(sym(),a,1e-9))bad=f+'x';}
    w.vsSet(1);return bad||true;})()===true);
  ok('so is a badge written in base units',(function(){
    const a=badge();let bad='';for(const f of w.VIEW_SCALES){w.vsSet(f);if(!near(badge(),a,1e-9))bad=f+'x';}
    w.vsSet(1);return bad||true;})()===true);
  ok('vsP and vsDash are the identity at step 1',w.vsP(1.6)===1.6&&w.vsDash('7 4')==='7 4');
  ok('vsBadge adds no wrapper at step 1',w.vsBadge(10,10,'<x/>')==='<x/>');
  ok('and does wrap above it',(function(){w.vsSet(5);const s=w.vsBadge(10,10,'<x/>');w.vsSet(1);
    return s.indexOf('scale(5)')>0&&s.indexOf('<x/>')>0;})());

  // ---------- the zoom range ----------
  ok('step 10 reaches ten times closer than step 1',(function(){
    w.vsSet(1);st.zoom=w.vsClamp(999);const a=w.__SC()*st.zoom;
    w.vsSet(10);st.zoom=w.vsClamp(999);const b=w.__SC()*st.zoom;
    w.vsSet(1);w.resetView();return near(b/a,10,1e-6);})());
  ok('and still zooms out as far — a step never loses range',(function(){
    w.vsSet(1);st.zoom=w.vsClamp(0);const a=w.__SC()*st.zoom;
    w.vsSet(10);st.zoom=w.vsClamp(0);const b=w.__SC()*st.zoom;
    w.vsSet(1);w.resetView();return near(b,a,1e-9);})());
  ok('the home view frames the same thing at every step',(function(){
    let bad='';const ref=(function(){w.vsSet(1);w.resetView();return [perM(),sx()[0]];})();
    for(const f of w.VIEW_SCALES){w.vsSet(f);w.resetView();
      if(!near(perM(),ref[0],0.01)||!near(sx()[0],ref[1],0.01))bad=f+'x';}
    w.vsSet(1);w.resetView();return bad||true;})()===true);

  // ---------- the room label fits its room ----------
  const RM={poly:[[0,0],[660,0],[660,1792],[0,1792]],num:'R04',name:'WC'};
  const BIG={poly:[[0,0],[4773,0],[4773,3825],[0,3825]],num:'R06',name:'Nappali'};
  const szOf=svg=>+(/font-size="([\d.]+)"/.exec(svg)||[0,0])[1];
  const base=()=>w.nvMM(w.__pens().NV_TXT.room)*st.labelSize;
  ok('a big room still gets the full label size',near(szOf(w.floorLabel(BIG,'ground')),base(),0.01),szOf(w.floorLabel(BIG,'ground')));
  ok('a small room gets a smaller one',szOf(w.floorLabel(RM,'ground'))<base()*0.8,szOf(w.floorLabel(RM,'ground')));
  ok('the label never shrinks past the floor',szOf(w.floorLabel({poly:[[0,0],[80,0],[80,80],[0,80]],num:'R',name:'X'},'ground'))>=base()*0.4-0.01);
  ok('lblFit never grows a label',(function(){
    const box={u:99999,v:99999},L=[{t:'A',k:1,by:0}];return w.lblFit(100,box,L)===100;})());
  ok('a degenerate room leaves the size alone',w.lblFit(100,{u:0,v:0},[{t:'A',k:1,by:0}])===100);
  ok('the fit is in model mm, so the step does not change it',(function(){
    const a=szOf(w.floorLabel(RM,'ground'));w.vsSet(10);const b=szOf(w.floorLabel(RM,'ground'));w.vsSet(1);
    return near(a,b,1e-9);})());
  ok('labelSize still scales what fits',(function(){
    const a=szOf(w.floorLabel(BIG,'ground'));st.labelSize=0.5;const b=szOf(w.floorLabel(BIG,'ground'));st.labelSize=1;
    return near(b,a/2,0.01);})());
  ok('the official view fits its label too',(function(){
    const a=szOf(w.bpFloorLabel(BIG,'ground')),b=szOf(w.bpFloorLabel(RM,'ground'));return b<a;})());
  ok('reg: the drawing still renders at every step',(function(){try{
    for(const f of w.VIEW_SCALES){w.vsSet(f);w.draw();}
    w.vsSet(1);w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: the official view renders at every step',(function(){try{
    st.style='blueprint';for(const f of w.VIEW_SCALES){w.vsSet(f);w.draw();}
    w.vsSet(1);st.style='normal';w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
