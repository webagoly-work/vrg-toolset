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
 const scene=()=>$('lyScene').innerHTML;
 const widths=s=>[...s.matchAll(/stroke-width="([\d.]+)"/g)].map(m=>+m[1]);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.loadBuilding(w.__H,true);
  const st=w.__state;st.style='blueprint';st.pitch=90;st.flat=true;st.active=lvl;w.draw();

  // ---------- paper millimetres ----------
  ok('the default scale is M 1:50',w.bpScaleN()===50);
  ok('a 0.5 mm pen at 1:50 covers 25 mm of building',(function(){
    const base=+w.bpSW(0.5);return Math.abs(base-0.5*50*0.045)<1e-6;})(),w.bpSW(0.5));
  ok('halving the scale halves the line',(function(){const a=w.bpU(0.5);st.bpScale=25;const b=w.bpU(0.5);st.bpScale=50;
    return Math.abs(a/b-2)<1e-9;})());
  ok('the fineness slider multiplies on top',(function(){const a=w.bpU(0.5);st.bpFine=1.5;const b=w.bpU(0.5);st.bpFine=1;
    return Math.abs(b/a-1.5)<1e-9;})());
  ok('a broken fineness value falls back to 1',(function(){st.bpFine=0;const a=w.bpFine();st.bpFine=1;return a===1;})());
  ok('bpG keeps a 1:50 model constant paper-constant',(function(){st.bpScale=100;const g=w.bpG(95);st.bpScale=50;return g===190;})());

  // ---------- the drawing follows the scale ----------
  ok('every blueprint line is thinner than the old fixed 1.2',(function(){const ws=widths(scene());
    return ws.length>8&&Math.max(...ws)<=+w.bpSW(0.5)+1e-9;})(),'max='+Math.max(...widths(scene())));
  ok('a wall outline is a 0.5 mm pen',widths(scene()).includes(+w.bpSW(0.5)));
  ok('changing the scale changes the drawing',(function(){const a=scene();st.bpScale=100;w.draw();const b=scene();
    st.bpScale=50;w.draw();return a!==b;})());
  ok('room text is paper-sized, not 255 mm tall',(function(){
    const fs2=[...scene().matchAll(/font-size="([\d.]+)"/g)].map(m=>+m[1]);
    return fs2.length&&Math.max(...fs2)<=+w.bpFS(4.5)+1e-9;})());
  ok('the hatch pitch follows the scale',(function(){const m=/<pattern id="bph" width="([\d.]+)"/.exec(scene());
    return m&&Math.abs(+m[1]-+w.bpU(1.3).toFixed(2))<0.02;})());
  // the normal view draws with its own paper-mm pens (spec-26) — not the blueprint's
  ok('the normal view keeps its own line weights',(function(){st.style='normal';w.draw();
    const ws=widths(scene()),pen=+w.eval('nvSW(NV_PEN.edge)');st.style='blueprint';w.draw();return ws.some(x=>Math.abs(x-pen)<1e-3);})());

  // ---------- scale view ----------
  ok('scale view zooms so one paper mm is one screen mm',(function(){w.bpScaleView();
    const k=($('stage').getBoundingClientRect().width/1000)||1;
    return Math.abs(st.zoom-(96/25.4)/(50*0.045*k))<1e-6;})(),'zoom='+st.zoom);
  ok('a coarser scale needs less zoom',(function(){const a=st.zoom;st.bpScale=100;w.bpScaleView();const b=st.zoom;
    st.bpScale=50;w.bpScaleView();return b<a;})());
  ok('both are registered actions',['view.bp.scale','view.bp.scaleview'].every(id=>!!w.actionById(id)));
  ok('the scale survives a save/load round trip',(function(){st.bpScale=25;st.bpFine=1.2;
    const so=JSON.parse(JSON.stringify(w.sessionObj()));st.bpScale=50;st.bpFine=1;
    return so.state.bpScale===25&&so.state.bpFine===1.2;})());

  // ---------- wall merge ----------
  const two=[{x0:0,y0:0,x1:4000,y1:100},{x0:0,y0:100,x1:4000,y1:200}];
  ok('two walls face to face lose the seam between them',(function(){const g=w.rectsUnionSegs(two);
    return g.length===6&&!g.some(s=>s[1]===100&&s[3]===100);})(),JSON.stringify(w.rectsUnionSegs(two)));
  ok('a partition butting into a wall loses its buried end',(function(){
    const g=w.rectsUnionSegs([{x0:0,y0:0,x1:4000,y1:100},{x0:1000,y0:100,x1:1100,y1:3000}]);
    return !g.some(s=>s[1]===100&&s[3]===100&&s[0]>=1000&&s[2]<=1100);})());
  ok('the wall it runs into is cut where the partition meets it',(function(){
    const g=w.rectsUnionSegs([{x0:0,y0:0,x1:4000,y1:100},{x0:1000,y0:100,x1:1100,y1:3000}]);
    const top=g.filter(s=>s[1]===100&&s[3]===100);return top.length===2;})());
  ok('overlapping corners keep only the outer edges',(function(){
    const g=w.rectsUnionSegs([{x0:0,y0:0,x1:1000,y1:1000},{x0:900,y0:0,x1:1900,y1:1000}]);
    return !g.some(s=>s[0]===1000&&s[2]===1000)&&!g.some(s=>s[0]===900&&s[2]===900);})());
  ok('a lone rectangle keeps all four sides',w.rectsUnionSegs([{x0:0,y0:0,x1:100,y1:100}]).length===4);
  ok('the blueprint always merges',w.wallMergeOn()===true);
  ok('the normal view merges only when asked',(function(){st.style='normal';const off=w.wallMergeOn();
    st.wallMerge=true;const on=w.wallMergeOn();st.wallMerge=false;st.style='blueprint';return off===false&&on===true;})());
  ok('merging changes what the normal view draws',(function(){st.style='normal';st.wallMode='solid';w.draw();const a=scene();
    st.wallMerge=true;w.draw();const b=scene();st.wallMerge=false;st.style='blueprint';w.draw();return a!==b;})());
  ok('merging is visual only — the walls are untouched',(function(){const before=JSON.stringify(w.__getWalls()[lvl]);
    st.wallMerge=true;w.draw();st.style='normal';w.draw();const after=JSON.stringify(w.__getWalls()[lvl]);
    st.wallMerge=false;st.style='blueprint';w.draw();return before===after;})());
  ok('a wall is still individually selectable when merged',(function(){st.wallMerge=true;w.draw();
    const r=w.__getWalls()[lvl][0];w.__setSel({t:'wall',ref:r,level:lvl});
    const held=w.__getSel()&&w.__getSel().ref===r;w.__setSel(null);st.wallMerge=false;w.draw();return held;})());
  ok('the merge toggle is a registered action',!!w.actionById('view.wallmerge'));
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
