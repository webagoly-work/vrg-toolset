// Workflow round WP-O1 — Ajtó / Ablak tools: ←/→ type, ↑/↓ opening side (src/08e-wf-openings.js).
// What must hold (docs/workflow/WP-O1_opening-keys.md; Q-O01 = A): with a ghost on screen the arrows cycle the type in
// DOORTYPE / OPN_WINTYPE order and the side 0 → 1 → 3 → 2; the pick rides on the ghost and on what is placed (sizes
// from the type); without a ghost the arrows keep the old build-mode meaning; the pick is remembered per tool.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state;
  const key=k=>w.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
  const ghost=v=>w.eval('buildGhost='+(v?JSON.stringify(v):'null'));
  const DK=Object.keys(w.eval('DOORTYPE')),WK=Object.keys(w.eval('OPN_WINTYPE'));
  ok('both buttons exist',!!w.document.getElementById('opnDoorBtn')&&!!w.document.getElementById('opnWinBtn'));
  w.opnTool('door');ok('Ajtó tool = build mode, door',st.mode==='build'&&st.buildType==='door');
  ghost({type:'door',x:0,y:0});
  key('ArrowRight');ok('→ next door type = '+DK[1],st.buildPick.door.dtype===DK[1],st.buildPick.door.dtype);
  key('ArrowLeft');key('ArrowLeft');ok('← ← wraps to the last type',st.buildPick.door.dtype===DK[DK.length-1]);
  key('ArrowRight');ok('back to hinged',st.buildPick.door.dtype==='hinged');
  const seq=[];for(let i=0;i<4;i++){key('ArrowUp');seq.push(st.buildPick.door.variant);}
  ok('↑ × 4 → 1, 3, 2, 0',seq.join()==='1,3,2,0',seq.join());
  key('ArrowDown');ok('↓ → 2',st.buildPick.door.variant===2);
  ok('the ghost follows the pick',w.eval('buildGhost.variant')===2&&w.eval('buildGhost.dtype')==='hinged');
  key('ArrowRight');const g=w.eval('buildGhost');ok('the ghost takes the type size (double 1400 × 2100)',g.dtype==='double'&&g.w===1400&&g.h===2100,JSON.stringify(g));
  ok('HUD names type and side',/Kétszárnyú/.test(w.document.getElementById('hud').textContent)&&/zsanér jobb/.test(w.document.getElementById('hud').textContent));
  const placed=w.opnPickOf('door');ok('placement fields = the pick',placed.dtype==='double'&&placed.variant===2&&placed.w===1400);
  // windows
  w.opnTool('window');ghost({type:'window',x:0,y:0});key('ArrowRight');
  ok('→ window type = '+WK[1],st.buildPick.window.wtype===WK[1]);
  const pw=w.opnPickOf('window');ok('window size + sill from the type (wide 1800 × 1500, 900)',pw.w===1800&&pw.h===1500&&pw.sill===900,JSON.stringify(pw));
  ok('the door pick is remembered separately',st.buildPick.door.dtype==='double');
  // no ghost → old meaning (cycle build types)
  ghost(null);const before=st.buildPick.window.wtype;key('ArrowRight');
  ok('no ghost: the arrows do not touch the pick',st.buildPick.window.wtype===before);
  ok('no ghost: old build-type cycling (window → stairs)',st.buildType==='stairs',st.buildType);
  ok('the build source carries the pick into placement',/opnPickOf\(state\.buildType\)/.test(w.document.documentElement.innerHTML));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
