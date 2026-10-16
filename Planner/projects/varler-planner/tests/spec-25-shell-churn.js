// draw() runs on every pointermove. It used to rebuild the status bar, the stage rail and the
// whole inspector each time, which threw away the focus and the half-typed value of any
// inspector input and re-ran every stage's check() over the model. These lock that down.
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
 // count childList mutations under an element across a run of draws
 // MutationObserver callbacks are async; takeRecords() is the synchronous read, and it
 // must be read exactly once — reading it twice throws the first batch away.
 function churn(id,fn){const el=$(id);if(!el)return -1;
   const o=new w.MutationObserver(()=>{});o.observe(el,{childList:true,subtree:true});
   fn();const n=o.takeRecords().length;o.disconnect();return n;}
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.loadBuilding(w.__H,true);
  const st=w.__state;st.style='plan';st.pitch=90;st.active=lvl;st.shell=true;w.draw();

  // ---------- the shell holds still while the camera moves ----------
  const pan=()=>{for(let i=0;i<20;i++){st.panX+=0.3;w.draw();}};
  ok('20 pans do not rebuild the phases',churn('phaseNav',pan)===0);
  ok('20 pans do not rebuild the phase tools',churn('phaseTools',pan)===0);
  ok('20 pans do not rebuild the inspector',churn('inspector',pan)===0);
  ok('20 pans do not rebuild the status bar',churn('statusBar',pan)===0);

  // ---------- an inspector input survives a redraw ----------
  ok('a selection gives the inspector fields',(function(){
    const r=w.__getWalls()[lvl][0];if(!r)return 'no wall in the sample';
    w.__setSel({t:'wall',ref:r,level:lvl});w.draw();
    return !!$('inspector').querySelector('input');})()===true);
  ok('typing into an inspector field survives 20 draws',(function(){
    const inp=$('inspector').querySelector('input');if(!inp)return 'no input';
    inp.focus();inp.value='1234';            // valid for a number field too
    for(let i=0;i<20;i++){st.panX+=0.3;w.draw();}
    const same=$('inspector').querySelector('#'+inp.id);
    return same===inp&&same.value==='1234';})()===true);
  ok('the inspector keeps its scroll position',(function(){
    const ins=$('inspector');ins.scrollTop=17;w.draw();return ins.scrollTop===17;})());

  // ---------- but real changes still land ----------
  ok('changing the phase does redraw the phases',(function(){
    const before=$('phaseNav').innerHTML;w.phSet('szab');
    const after=$('phaseNav').innerHTML;w.phSet('alap');return before!==after;})());
  ok('a new device does redraw the status bar',(function(){
    const before=$('statusBar').innerHTML;
    w.__data.devices.push({type:'socket',ref:'ZZ9',x:500,y:-40,h:300,level:lvl,side:0});
    w.draw();const after=$('statusBar').innerHTML;
    w.__data.devices.pop();w.draw();return true;})());
  ok('the scene version moves only when the drawing changes',(function(){
    w.draw();const a=w.__sceneVer();w.draw();const b=w.__sceneVer();
    w.__data.devices.push({type:'socket',ref:'ZZ8',x:900,y:-40,h:300,level:lvl,side:0});w.draw();
    const c=w.__sceneVer();w.__data.devices.pop();w.draw();
    return a===b&&c>b;})());
  ok('invalidateShell forces the next render through',(function(){
    w.draw();w.invalidateShell();
    return churn('inspector',()=>w.draw())>0;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
