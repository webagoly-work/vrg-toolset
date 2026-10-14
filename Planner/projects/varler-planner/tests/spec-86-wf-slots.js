// Workflow round WP-O2 — the door is the portal; the window's redőny slot (src/08g-wf-slots.js).
// What must hold (docs/workflow/WP-O2_door-portal-slots.md; Q-O02 A, Q-O03 A): PT_SLOTS equals the engine table; a door
// between two rooms has 10 slots per face; latch / hinge from the door variant (flipping moves L1 to the other jamb);
// u offsets 150 / 450 from the edge; heights; auto-portal SF-0 on both faces in one undo with the door; the window slot
// exists only with the redőny tag; slots draw only for the families the active layer uses.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const ENGINE=require(path.join(__dirname,'..','tools','baseline','rules.js'));
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  ok('PT_SLOTS = tools/baseline PORTAL_SLOTS',JSON.stringify(w.eval('PT_SLOTS'))===JSON.stringify(ENGINE.PORTAL_SLOTS));
  // two rooms + walls: the partition is x 3600–3800 (centre 3700), y 0–3000
  D.floors.length=0;const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  D.floors.push({level:'ground',poly:rect(0,0,3600,3000),name:'Nappali',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(3600,0,7200,3000),name:'Háló',stage:'floor',clear:true,layer:'L0'});
  w.wfwApply(w.wfwPlan('ground'),'ground');w.ensureIds(D);
  D.openings.push({type:'door',level:'ground',x:3700,y:1500,ang:Math.PI/2,variant:0,w:900,h:2100,dtype:'hinged',layer:'L0'});w.ensureIds(D);
  const door=D.openings[D.openings.length-1];
  const S=w.ptSlots(door);
  ok('20 slots: 10 per face × 2 rooms',S.length===20,S.length);
  const face=S.filter(s=>s.room===S[0].room),by=k=>face.find(s=>s.k===k);
  ok('L1 at 1100, L4 at 2450, H1 at 300',by('L1').h===1100&&by('L4').h===2450&&by('H1').h===300);
  ok('latch and hinge columns are 900 + 2 × 150 = 1200 apart',Math.abs(by('L1').u-by('H0').u)===1200,by('L1').u+' / '+by('H0').u);
  ok('the panel column L2 is 300 further out than L1',Math.abs(by('L2').u-by('H0').u)===1500);
  ok('the head slots sit at the door centre',Math.abs(by('T1').u-(by('L1').u+by('H0').u)/2)<=1);
  ok('slots sit on the partition centreline x 3700',face.every(s=>s.x===3700));
  const L1a=by('L1').u;door.variant=2;const F2=w.ptSlots(door).filter(s=>s.room===S[0].room);
  const L1b=F2.find(s=>s.k==='L1').u;
  ok('variant 2 (hinge at the far jamb) moves L1 to the other jamb',Math.abs(L1a-L1b)===1200,L1a+' → '+L1b);
  door.variant=0;
  // auto-portal: the Ajtó tool's up-hook after a placement
  D.devices.length=0;w.opnTool('door');
  const tool=w.eval("STK_TOOLS.find(t=>t.k==='ptAutoDoor')");
  D.openings.pop();tool.down();D.openings.push(door);tool.up();
  const P=D.devices.filter(d=>d.type==='portal');
  ok('placing a door makes a portal on both faces',P.length===2,P.length);
  ok('tier SF-0 (előkészítve)',P.every(d=>d.tier==='SF-0'));
  tool.down();tool.up();ok('a click that adds no door adds no portal',D.devices.filter(d=>d.type==='portal').length===2);
  // the window slot
  D.openings.push({type:'window',level:'ground',x:1800,y:-150,ang:0,w:1200,h:1500,sill:900,layer:'L0'});w.ensureIds(D);
  const win=D.openings[D.openings.length-1];
  ok('no redőny tag → no W1',w.ptWinSlot(win)===null);
  D.marks=D.marks||[];D.marks.push({kind:'opening',op:win.id,opening:win.id,tags:['redony'],pol:'none',layer:'L0'});
  const tagged=w.mrkOpeningTags(win.id).indexOf('redony')>=0;
  const ws=w.ptWinSlot(win);
  ok('the redőny tag is read',tagged);
  ok('redőny tag → W1 at 2500, 150 beyond the window edge',(ws&&ws.h===2500&&Math.abs(Math.abs(ws.u-w.mrkU(w.opnHost(win),win.x,win.y))-750)<=1),JSON.stringify(ws)+' tagged='+tagged);
  // drawing: families by the active layer
  ok('no layer role → no slot drawing',w.ptSlotFams().length===0||!!w.lyrLayer(st.activeLayer).role);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
