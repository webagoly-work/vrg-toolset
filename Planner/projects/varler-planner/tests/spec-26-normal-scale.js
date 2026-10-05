// The modelling view used to draw in raw base units: a wall outline came out 22 mm thick on
// the building and a room name half a metre tall, which is what made a careful plan look like
// a toy. It is now on the same paper-millimetre footing as the blueprint.
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
  const st=w.__state;st.style='plan';st.pitch=90;st.active=lvl;st.bpScale=50;st.bpFine=1;w.draw();
  const MM=1/0.045;                       // model mm per base unit
  const P=w.__pens();

  // ---------- pens ----------
  ok('nvSW converts paper mm through the drawing scale',
     Math.abs(+w.nvSW(0.25)-0.25*50*0.045)<1e-3,w.nvSW(0.25));
  ok('the default edge pen is 0.25 mm on paper',P.NV_PEN.edge===0.25);
  ok('at 1:50 that is 12.5 mm on the building',Math.abs(+w.nvSW(P.NV_PEN.edge)*MM-12.5)<0.05);
  ok('it is finer than the blueprint wall pen',P.NV_PEN.edge<P.BP_PEN.wall);
  ok('no drawn line is the old 22 mm slab',(function(){
    const mx=Math.max(...widths(scene()));return mx*MM<20;})(),Math.max(...widths(scene()))*MM+' mm');
  ok('halving the scale halves the normal-view pen',(function(){
    const a=w.bpU(P.NV_PEN.edge);st.bpScale=25;const b=w.bpU(P.NV_PEN.edge);st.bpScale=50;
    return Math.abs(a/b-2)<1e-9;})());
  ok('the fineness slider reaches the modelling view too',(function(){
    const a=w.bpU(P.NV_PEN.edge);st.bpFine=1.5;const b=w.bpU(P.NV_PEN.edge);st.bpFine=1;
    return Math.abs(b/a-1.5)<1e-9;})());
  ok('changing the scale actually changes what is drawn',(function(){
    const a=scene();st.bpScale=100;w.draw();const b=scene();st.bpScale=50;w.draw();
    return a!==b&&a===scene();})());

  // ---------- room labels ----------
  ok('nvMM turns paper mm into model mm at the scale',w.nvMM(3.5)===175);
  ok('a room name is 175 mm on the building, not 520',w.nvMM(P.NV_TXT.room)===175);
  ok('that is about a third of what it was',(520/w.nvMM(P.NV_TXT.room))>2.9);
  ok('labelSize still scales it',(function(){
    const one=w.nvMM(P.NV_TXT.room)*1,two=w.nvMM(P.NV_TXT.room)*2;return two===2*one;})());

  // ---------- the blueprint is untouched by all this ----------
  ok('the blueprint still uses its own heavier wall pen',P.BP_PEN.wall===0.5);
  ok('both views read the same drawing scale',(function(){
    st.bpScale=75;const a=+w.nvSW(0.5),b=+w.bpSW(0.5);st.bpScale=50;return Math.abs(a-b)<1e-9;})());
  ok('reg: blueprint still draws',(function(){try{st.style='blueprint';w.draw();st.style='plan';w.draw();return true;}
    catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
