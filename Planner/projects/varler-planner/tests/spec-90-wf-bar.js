// Workflow round WP-E0 — the Munkafolyamat phases (src/08k-wf-bar.js); since T2 + T3 (2026-10-15) the left column of the
// fixed frame (src/05db-layout.js): six phases, each with its tools; the live checks are the phase buttons' tooltips.
// What must hold (docs/workflow/WP-E0_workflow-bar.md; E01 = A): the phases with their tools; Villamosság on a project
// with no stack creates one ADOPTING the rooms' layer (nothing copied) and activates the socket layer; Lámpák + kapcsolók
// switches to the lighting layer; live checks from the data; the phases can be a grid or a list (L1, user: optional).
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
  w.phSet('alap');w.layoutSync(true);const nav=()=>$('phaseNav'),title=k=>nav().querySelector('.phB[data-ph="'+k+'"]').title;
  ok('the phases exist: the four of this round + Pályák + Kimenet',nav().querySelectorAll('.phB[data-ph]').length===6&&[...nav().querySelectorAll('.phB')].slice(0,4).map(b=>b.dataset.ph).join()==='alap,nyil,szab,vill');
  ok('starts on Alapozás',st.wfPhase==='alap'&&nav().querySelector('.phB.on').dataset.ph==='alap');
  ok('check: no rooms yet',/nincs helyiség/.test(title('alap')));
  D.floors.push({level:'ground',poly:rect(0,0,3600,3000),name:'',stage:'outline',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(3600,0,7200,3000),name:'',stage:'outline',clear:true,layer:'L0',kinds:['konyha'],kind:'konyha'});
  w.invalidateShell();w.layoutSync(true);ok('check: 2 rooms, no walls, 2 without floor',/2 helyiség · falak nélkül · 2 padló nélkül/.test(title('alap')),title('alap'));
  w.wfwApply(w.wfwPlan('ground'),'ground');w.wfwFloors('ground');w.invalidateShell();w.layoutSync(true);
  ok('check after F3 / F4: walls ✓ floor ✓',/2 helyiség · falak ✓ · padló ✓/.test(title('alap')));
  // the tools of a phase run the existing tools; only the current phase's tools show
  const tool=i=>$('phBody').querySelector('.phGrid.on').querySelectorAll('.tool')[i];
  tool(0).click();ok('Alapozás tool 1 = the room pen',st.mode==='room');
  w.phSet('nyil');ok('only the current phase shows its tools',$('phBody').querySelectorAll('.phGrid.on').length===1&&$('phBody').querySelector('.phGrid.on').dataset.ph==='nyil');
  tool(0).click();ok('Nyílászárók tool 1 = Ajtó',st.mode==='build'&&st.buildType==='door');
  w.phSet('szab');w.invalidateShell();w.layoutSync(true);
  ok('Szabályok check: 1 room without a type',/1 helyiség típus nélkül/.test(title('szab')));
  ok('Szabályok shows the rules palette in the context panel',w.ctxKeyNow()==='rules'&&!!$('rbPanel')&&$('ctxPanel').contains($('rbPanel'))&&$('rbPanel').style.display==='block');
  ok('… and Mennyezeti út / Padló út are Szabályok tools now',[...$('phBody').querySelectorAll('.phGrid[data-ph="szab"] .tool')].map(b=>b.dataset.a).join().indexOf('wf.ceilLine,wf.floorLine')>=0);
  // Villamosság
  const before=w.eval('layers').length,nStacks=w.eval('stacks').length;
  w.phSet('vill');
  const S=w.stkActive(),L=w.lyrLayer(st.activeLayer);
  ok('a stack was created',w.eval('stacks').length===nStacks+1&&!!S);
  ok('it adopted L0 as Szerkezet (the rooms stay where they are)',w.lyrLayer('L0').stack===S.id&&w.lyrLayer('L0').role==='construct'&&D.floors.every(f=>f.layer==='L0'));
  ok('the active layer is Erősáram — dugalj',L&&L.role==='sys:SOC',L&&L.role);
  ok('new layers were added',w.eval('layers').length>before);
  w.layoutSync(true);ok('Dugaljak is lit',tool(0).classList.contains('on')&&!tool(1).classList.contains('on'));
  tool(1).click();ok('Lámpák + kapcsolók → the lighting layer',w.lyrLayer(st.activeLayer).role==='sys:LIGHT');
  w.layoutSync(true);ok('… and it is the lit one',tool(1).classList.contains('on')&&!tool(0).classList.contains('on'));
  w.phSet('alap');w.phSet('vill');ok('re-entering keeps the stack and the layer',w.eval('stacks').length===nStacks+1&&w.lyrLayer(st.activeLayer).role==='sys:LIGHT');
  ok('Villamosság check counts endpoints',/0 dugalj · 0 lámpa · 0 kapcsoló · 0 dedikált/.test(w.wfCheck('vill')));
  ok('the Villamosság panel is Áramkörök',w.ctxKeyNow()==='circuits');
  // orphan role layers (their stack deleted) → a new stack, not a dead layer
  w.eval('stacks.length=0');w.phSet('alap');w.phSet('vill');ok('orphan role layer → a new stack is made',w.eval('stacks').length===1&&w.lyrLayer(st.activeLayer).stack===w.eval('stacks')[0].id);
  // L1 (user: optional): grid ↔ list
  w.runAction('view.phaseLayout');ok('the phases can be a list',nav().classList.contains('list')&&st.phLayout==='list');w.runAction('view.phaseLayout');
  ok('golden-neutral: nothing of the frame is in the scene',!/phaseNav|phB/.test($('vp').innerHTML));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
