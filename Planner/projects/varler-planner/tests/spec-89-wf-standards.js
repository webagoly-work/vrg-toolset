// Workflow round WP-R4 — Szabványmagasságok (src/08j-wf-standards.js).
// What must hold (docs/workflow/WP-R4_standards.md; R04 = B, R05, R06, Q-R09 answered): the table's key rows; the
// cascade room → kind → project → built-in; placing an ITEM stores hVar + its height (the electrical var untouched);
// any other tool start forgets the item; context suggests, never rewrites; Csere; Alkalmaz follows the table but leaves
// hand-moved and legacy devices alone; undo; the panel.
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
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.marks=[];D.devices.length=0;D.stdHeights=[];
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  D.floors.push({level:'ground',poly:rect(0,0,3600,3000),name:'Konyha',kinds:['konyha'],kind:'konyha',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(3600,0,7200,3000),name:'Garázs',kinds:['gepeszet'],kind:'gepeszet',stage:'floor',clear:true,layer:'L0'});
  w.wfwApply(w.wfwPlan('ground'),'ground');w.ensureIds(D);
  const K=D.floors[0],G=D.floors[1],top=W.ground.find(r=>r.y0===-300);
  const dev=o=>{D.devices.push(Object.assign({level:'ground',layer:st.activeLayer},o));w.ensureIds(D);return D.devices[D.devices.length-1];};
  // 1. the table
  const row=(c,h)=>w.stdRow(c,h);
  ok('garázs dugalj 500, borotválkozó 1400, fürdő egyéb 1100 (Q-R09 A)',row('SOC','garazs').h===500&&row('SOC','borotva').h===1400&&row('SOC','furdo').h===1100);
  ok('appliance items exist (hűtő, mosogatógép, bojler)',!!row('SOC','huto')&&!!row('DED','mosogato')&&!!row('DED','bojler'));
  ok('paths and levels: trunk 2600, dist 2450, ceiling 2850',row('PATH','trunk').h===2600&&row('PATH','dist').h===2450&&row('LVL','ceiling').h===2850);
  ok('stdHeights is an undoable collection with prefix K',w.eval("UKEYS.indexOf('stdHeights')>=0&&IDPRE.stdHeights==='K'"));
  // 2. the cascade
  const sG=dev({type:'socket',code:'SOC',var:'s04',x:5600,y:1500,h:300});
  ok('built-in: garazs 500',w.stdH('SOC','garazs',sG)===500);
  w.stdSet('SOC','garazs','project',550);ok('project override 550',w.stdH('SOC','garazs',sG)===550);
  w.stdSet('SOC','garazs','kind:gepeszet',520);ok('kind override wins: 520',w.stdH('SOC','garazs',sG)===520);
  w.stdSet('SOC','garazs','room:'+G.id,530);ok('room override wins: 530',w.stdH('SOC','garazs',sG)===530);
  w.doUndo();ok('undo removes the room override',w.stdH('SOC','garazs',sG)===520);
  D.stdHeights=[];
  // 3. suggestions (context, never a rewrite)
  let p=w.stdPick(sG);ok('a plain socket in the garage → garázs suggested',p&&p.hv==='garazs'&&p.h===500&&/helyiség/.test(p.why),JSON.stringify(p));
  ok('… but the device is not changed',!sG.hVar&&sG.h===300);
  ok('it is listed as a suggestion',w.stdSuggestions('ground').some(x=>x.d===sG));
  w.rbWallCommit(w.rbPreset('munkalap'),{level:'ground',id:top.id,side:1,u:1800});
  const sK=dev({type:'socket',code:'SOC',var:'s04',x:1800,y:-150,h:300,side:1});
  ok('a socket on the worktop face → pult 1100',(w.stdPick(sK)||{}).hv==='pult',JSON.stringify(w.stdPick(sK))+' tags='+JSON.stringify(w.stdFaceTags(sK)));
  w.rbZoneCommit(w.rbPreset('agy'),'ground',[500,1500],[2500,2900]);
  const sB=dev({type:'socket',code:'SOC',var:'s04',x:2800,y:2000,h:300});
  ok('a socket 300 mm from the bed zone → éjjeli 750',(w.stdPick(sB)||{}).hv==='ejjeli');
  const dW=dev({type:'ep',code:'DED',var:'g16',x:1000,y:500,h:300,note:'Mosogatógép'});
  ok('a DED named Mosogatógép → mosogato',(w.stdPick(dW)||{}).hv==='mosogato');
  const sX=dev({type:'socket',code:'SOC',var:'s04',x:1000,y:500,h:300});
  ok('a plain kitchen socket away from everything → alap (no suggestion)',(w.stdPick(sX)||{}).hv==='alap'&&!w.stdSuggestions('ground').some(x=>x.d===sX));
  // 4. Csere
  w.stdSwap(sG,'garazs');ok('Csere → hVar garazs, h 500, hStd 500',sG.hVar==='garazs'&&sG.h===500&&sG.hStd===500);
  ok('… and the suggestion is gone',!w.stdSuggestions('ground').some(x=>x.d===sG));
  // 5. placing an item
  w.stdPlace('SOC','garazs');ok('the 05s tool runs for SOC',w.EP_T.on&&w.EP_T.code==='SOC');
  const d1=w.epPlace({level:'ground',x:6000,y:2500,h:300});
  ok('placed as an item: hVar garazs, h 500, electrical var kept',d1&&d1.hVar==='garazs'&&d1.h===500&&d1.var==='s04',JSON.stringify(d1));
  w.epToolStart('SOC','sys:SOC');const d2=w.epPlace({level:'ground',x:6200,y:2500,h:300});
  ok('another tool start forgets the item',d2&&!d2.hVar&&d2.h===300);
  // 6. Alkalmaz
  w.stdSet('SOC','garazs','project',600);
  sG.h=650;                                   // moved by hand
  const plan=w.stdApplyPlan('project');
  ok('apply plan: only d1 (sG moved by hand, legacy ones untouched)',plan.length===1&&plan[0].d===d1&&plan[0].to===600,plan.map(x=>x.d.id+':'+x.to).join());
  w.stdApply('project',null,true);ok('applied: d1 600, sG stays 650, sX stays 300',d1.h===600&&d1.hStd===600&&sG.h===650&&sX.h===300);
  w.doUndo();ok('undo puts d1 back to 500',(D.devices.find(x=>x.id===d1.id)||{}).h===500);
  // 7. the panel
  ok('the button exists',!!$('stdBtn'));
  w.stdPanel(true);let html=$('stdPanel').innerHTML;
  ok('the Dugalj group is open with its items',/Dugalj · garázs \/ műhely/.test(html)&&/Borotválkozó dugalj/.test(html));
  ok('no ⚑ left after the R4 ⏸ (all rows confirmed)',(html.match(/class="fl"/g)||[]).length===0);
  ok('confirmed: elszívó socket 1900, mosógép 1100',w.stdRow('SOC','ventil').h===1900&&w.stdRow('DED','mosogep').h===1100);
  ok('the project override shows on its input (600, orange)',/data-row="SOC\|garazs" value="600" placeholder="" class="own"/.test(html));
  ok('suggestions are listed with Csere',/Javaslatok/.test(html)&&/data-swap=/.test(html));
  w.eval("STD_UI.scope='kind';STD_UI.kind='gepeszet'");w.stdPanelDraw();html=$('stdPanel').innerHTML;
  ok('kind scope shows the inherited project value, not own',/data-row="SOC\|garazs" value="600" placeholder="" class=""/.test(html));
  w.stdPanel(false);ok('closes',$('stdPanel').style.display==='none');
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
