// Wireway rebuild T4 (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.6, Q4 = A) — src/08of, the Elosztó tray:
// 1. "waiting" = no circuit + an up chain that reaches the board (straight, through a door's L4, through a master);
//    an endpoint with no up, or a chain that ends nowhere, is not waiting;
// 2. the rows are 08oa's suggestion cut to the waiting endpoints, pre-ticked; a row may target an existing circuit;
// 3. apply: new circuits + joins in ONE undo step; the tray is a panel (no modal) showing "Elosztóra vár: N".
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
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  WL.ground.push({x0:-100,y0:-100,x1:8100,y1:0,id:'W1'},{x0:-100,y0:0,x1:0,y1:3000,id:'W2'},{x0:4000,y0:0,x1:4100,y1:3000,id:'W3'},
    {x0:8000,y0:0,x1:8100,y1:3000,id:'W4'},{x0:-100,y0:3000,x1:8100,y1:3100,id:'W5'});
  D.floors.length=0;D.devices.length=0;D.circuits=[];D.paths.length=0;D.openings.length=0;D.marks=[];
  D.floors.push({level:'ground',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali',kinds:['nappali'],kind:'nappali',num:'RA',layer:'L0'},
    {level:'ground',poly:[[4100,0],[8000,0],[8000,3000],[4100,3000]],name:'Háló',kinds:['halo'],kind:'halo',num:'RB',layer:'L0'});
  D.openings.push({type:'door',level:'ground',x:4050,y:1500,w:900,ang:Math.PI/2,variant:0});const door=D.openings[0];w.ensureIds(D);
  const dev=(code,x,y,h)=>{const d={type:w.epTypeFor(code),code,level:'ground',x,y,h,layer:'L0'};D.devices.push(d);return d;};
  D.devices.push({type:'board',level:'ground',x:1000,y:60,h:1600,layer:'L0'});const board=D.devices[D.devices.length-1];
  const a1=dev('SOC',2500,0,300),a2=dev('SOC',3500,0,300),b1=dev('SOC',6500,0,300),b2=dev('SOC',7500,0,300),x1=dev('SOC',1500,0,300),y1=dev('SOC',5000,0,300);w.ensureIds(D);
  const sz=w.jbMake('szoba',{level:'ground',x:8000,y:1500,h:2150,side:0});
  // a1 on the board, a2 chained to a1; b1 on the door (Háló side), b2 on b1; y1 on the szobadoboz, which is on the board;
  // x1 has no up at all
  [[a1,{id:board.id}],[a2,{id:a1.id}],[b1,{id:door.id,room:'RB'}],[b2,{id:b1.id}],[sz,{id:board.id}],[y1,{id:sz.id}]].forEach(([d,u])=>{const r=w.upSet(d.id,u,{noUndo:true});if(r.err)throw new Error(r.err);});
  const W=w.trayWaiting('ground').map(d=>d.id).sort();
  ok('1 waiting: straight on the board, via a door, via a master — with their chains',JSON.stringify(W)===JSON.stringify([a1.id,a2.id,b1.id,b2.id,y1.id].sort()),JSON.stringify(W));
  ok('1 an endpoint with no up is not waiting',W.indexOf(x1.id)<0);
  // ---- 2. rows ----
  const rows=w.trayRows('ground');
  ok('2 the rows are the circuit suggestion cut to the waiting endpoints (x1 left out)',rows.length>=2&&rows.every(r=>r.members.indexOf(x1.id)<0)&&rows.reduce((n,r)=>n+r.members.length,0)===5,JSON.stringify(rows.map(r=>[r.name,r.members.length])));
  ok('2 every row is pre-ticked, aimed at a new circuit',rows.every(r=>r.on!==false&&r.target==='new'));
  ok('2 Háló (a bedroom) gets its own row',rows.some(r=>/Háló/.test(r.name)&&r.members.indexOf(b1.id)>=0&&r.members.indexOf(b2.id)>=0));
  // ---- 3. apply: one new circuit, one row joining an existing circuit; one undo ----
  const old=w.cktCreate({name:'Meglévő kör',mcb:{curve:'C',amps:16,poles:1,n:false},members:[]});
  const rN=rows.find(r=>r.members.indexOf(b1.id)>=0),rO=rows.find(r=>r!==rN);rO.target=old.id;rows.filter(r=>r!==rN&&r!==rO).forEach(r=>r.on=false);
  const nC0=D.circuits.length,res=w.trayApply(rows);
  ok('3 apply: a new circuit for Háló, the other row joins the existing circuit',res.made===1&&res.joined===rO.members.length&&w.cktOfDevice(w.byId('devices',b1.id))&&w.cktOfDevice(w.byId('devices',rO.members[0])).id===old.id,JSON.stringify(res));
  ok('3 the joined endpoints are no longer waiting',w.trayWaiting('ground').every(d=>rO.members.indexOf(d.id)<0&&d.id!==b1.id));
  w.doUndo();ok('3 one undo takes back both',w.__data.circuits.length===nC0&&!w.cktOfDevice(w.byId('devices',b1.id))&&!w.cktOfDevice(w.byId('devices',rO.members[0])));
  // ---- the panel ----
  st.wfPhase='vill';w.trayDraw(true);const h=w.document.getElementById('blTray');
  ok('3 the tray is a panel (not a modal) that says how many wait',h&&h.style.display==='block'&&/Elosztóra vár: 5/.test(h.textContent),h&&h.textContent);
  w.TRAY.open=true;w.trayDraw(true);ok('3 opened, it lists the rows with a target selector and one apply button',h.querySelectorAll('[data-tray-to]').length===w.TRAY.rows.length&&!!h.querySelector('[data-tray-apply]'));
  ok('the action is registered',w.eval('ACTIONS').some(a=>a.id==='tray.open'));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
