// Workflow round WP-E0 — the Munkafolyamat bar (src/08k-wf-bar.js).
// What must hold (docs/workflow/WP-E0_workflow-bar.md; E01 = A): four phases with their tools; Villamosság on a
// project with no stack creates one ADOPTING the rooms' layer (nothing copied) and activates the socket layer;
// Lámpák + kapcsolók switches to the lighting layer; later steps greyed; live checks from the data; the bar toggles off.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  w.wfBarDraw();
  ok('the bar exists with four phases',!!$('wfBar')&&$('wfBar').querySelectorAll('[data-ph]').length===4);
  ok('starts on Alapozás',st.wfPhase==='alap'&&/class="p on" data-ph="alap"/.test($('wfBar').innerHTML));
  ok('check: no rooms yet',/nincs helyiség/.test($('wfBar').innerHTML));
  D.floors.push({level:'ground',poly:rect(0,0,3600,3000),name:'',stage:'outline',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(3600,0,7200,3000),name:'',stage:'outline',clear:true,layer:'L0',kinds:['konyha'],kind:'konyha'});
  w.wfBarDraw();ok('check: 2 rooms, no walls, 2 without floor',/2 helyiség · falak nélkül · 2 padló nélkül/.test($('wfBar').innerHTML));
  w.wfwApply(w.wfwPlan('ground'),'ground');w.wfwFloors('ground');w.wfBarDraw();
  ok('check after F3 / F4: walls ✓ floor ✓',/2 helyiség · falak ✓ · padló ✓/.test($('wfBar').innerHTML));
  // tools of a phase run the existing tools
  const tool=i=>$('wfBar').querySelector('[data-t="'+i+'"]');
  tool(0).click();ok('Alapozás tool 1 = the room pen',st.mode==='room');
  w.wfPhase('nyil');w.wfBarDraw();tool(0).click();ok('Nyílászárók tool 1 = Ajtó',st.mode==='build'&&st.buildType==='door');
  w.wfPhase('szab');w.wfBarDraw();
  ok('Szabályok check: 1 room without a type',/1 helyiség típus nélkül/.test($('wfBar').innerHTML));
  tool(2).click();ok('Szabályok tool 3 = the rules palette',$('rbPanel')&&$('rbPanel').style.display==='block');w.rbPanel(false);
  // Villamosság
  const before=w.eval('layers').length,nStacks=w.eval('stacks').length;
  w.wfPhase('vill');
  const S=w.stkActive(),L=w.lyrLayer(st.activeLayer);
  ok('a stack was created',w.eval('stacks').length===nStacks+1&&!!S);
  ok('it adopted L0 as Szerkezet (the rooms stay where they are)',w.lyrLayer('L0').stack===S.id&&w.lyrLayer('L0').role==='construct'&&D.floors.every(f=>f.layer==='L0'));
  ok('the active layer is Erősáram — dugalj',L&&L.role==='sys:SOC',L&&L.role);
  ok('new layers were added',w.eval('layers').length>before);
  w.wfBarDraw();ok('4.1 Dugaljak is lit',/class="t on" data-t="0"/.test($('wfBar').innerHTML));
  tool(1).click();ok('Lámpák + kapcsolók → the lighting layer',w.lyrLayer(st.activeLayer).role==='sys:LIGHT');
  ok('the steps not built yet are greyed (4.4, 4.5), the built ones live',(()=>{const dis=[...$('wfBar').querySelectorAll('button[disabled]')].map(b=>b.textContent);return dis.some(t=>/4.5/.test(t))&&!dis.some(t=>/4.2|4.3/.test(t));})());
  w.wfPhase('alap');w.wfPhase('vill');ok('re-entering keeps the stack and the layer',w.eval('stacks').length===nStacks+1&&w.lyrLayer(st.activeLayer).role==='sys:LIGHT');
  ok('Villamosság check counts endpoints',/0 dugalj · 0 lámpa · 0 kapcsoló · 0 dedikált/.test($('wfBar').innerHTML));
  // orphan role layers (their stack deleted) → a new stack, not a dead layer
  w.eval('stacks.length=0');w.wfPhase('alap');w.wfPhase('vill');ok('orphan role layer → a new stack is made',w.eval('stacks').length===1&&w.lyrLayer(st.activeLayer).stack===w.eval('stacks')[0].id);
  // toggle
  w.wfBarToggle(false);ok('the bar hides',$('wfBar').style.display==='none');w.wfBarToggle(true);
  ok('golden-neutral: the bar is not in the scene',!/wfBar/.test($('vp').innerHTML));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
