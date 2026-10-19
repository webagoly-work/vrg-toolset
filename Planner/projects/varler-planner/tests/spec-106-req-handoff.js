// Round 2026-10-18 WP-N4 hand-off — the Igénylista counts feed the switch suggestion (E1, 08l) and the circuit
// suggestion (E4, 08oa). Room fixture as spec-91: Nappali 0–4000 × 0–3000 with two doors (D1 bottom, D3 to the Fürdő).
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
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.devices.length=0;D.openings.length=0;
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  D.floors.push({level:'ground',poly:rect(0,0,4000,3000),name:'Nappali',kinds:['nappali'],kind:'nappali',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(4000,0,6000,3000),name:'Fürdő',kinds:['furdo'],kind:'furdo',stage:'floor',clear:true,layer:'L0'});
  D.floors.push({level:'ground',poly:rect(0,3000,6000,5000),name:'Előszoba',kinds:['eloszoba'],kind:'eloszoba',stage:'floor',clear:true,layer:'L0'});
  w.wfwApply(w.wfwPlan('ground'),'ground');w.wfPhase('vill');
  const door=(x,y,a)=>{D.openings.push({type:'door',level:'ground',x,y,ang:a,variant:0,w:900,h:2100,dtype:'hinged',layer:'L0'});w.ensureIds(D);};
  door(2000,3100,0);door(5200,3100,0);door(4100,1500,Math.PI/2);
  const A=D.floors[0];
  const lamp=(x,y)=>{D.devices.push({type:'light',code:'LMP',var:'230',level:'ground',x,y,h:2850,layer:w.epRoleLayer('sys:LIGHT').id});w.ensureIds(D);return D.devices[D.devices.length-1];};
  const L=[lamp(600,1500),lamp(1400,1500),lamp(2600,1500),lamp(3400,1500)];
  // without a list: the old behaviour (one leg)
  let row=w.lswSuggest('ground').find(r=>r.room===A);
  ok('no Igénylista → one group, type from the doors (106 + 106)',row&&!row.groups&&row.type==='106 + 106');
  // E1: k = 2
  w.reqSet(A,'lmp',{n:4,k:2,v:1});w.reqSet(A,'swi',{rows:[{type:'108'},{type:'108'},{type:'101'}]});
  row=w.lswSuggest('ground').find(r=>r.room===A);
  ok('E1: k 2 → the lamps split into 2 groups by position (2 + 2, left / right)',row.groups.length===2&&row.groups[0].map(l=>l.id).join()===[L[0].id,L[1].id].join()&&row.groups[1].map(l=>l.id).join()===[L[2].id,L[3].id].join());
  ok('…the type from k and 2 doors: 108 + 108 (reqSwAuto)',row.type==='108 + 108',row.type);
  ok('…the why names the list and the switch beyond the doors',/2 kapcsolási kör/.test(row.why)&&/108 \+ 108 \+ 101/.test(row.why)&&/1 kapcsoló nem ajtónál/.test(row.why),row.why);
  w.lswSuggestApply([row]);
  ok('Alkalmaz: two legs (d.grp), each two lamps',L[0].grp&&L[0].grp===L[1].grp&&L[2].grp&&L[2].grp===L[3].grp&&L[0].grp!==L[2].grp);
  const sws=D.devices.filter(d=>d.code==='SWI'&&(d.ctl||[]).indexOf(L[0].id)>=0);
  ok('…both door switches carry both legs → 108 dupla váltó',sws.length===2&&sws.every(s=>s.swType==='108'&&s.ctl.indexOf(L[3].id)>=0),sws.map(s=>s.swType).join());
  // a lamp the user had already grouped keeps its leg
  D.devices.filter(d=>d.code==='SWI').forEach(s=>D.devices.splice(D.devices.indexOf(s),1));
  [L[0],L[1],L[2],L[3]].forEach(l=>delete l.grp);L[0].grp='G9';L[3].grp='G9';
  row=w.lswSuggest('ground').find(r=>r.room===A);
  ok('E1: an existing leg is kept, the ungrouped lamps make the rest (G9 = L1 + L4, then L2 + L3)',row.groups.length===2&&row.groups[0].every(l=>l.grp==='G9')&&row.groups[1].map(l=>l.id).join()===[L[1].id,L[2].id].join());
  [L[0],L[3]].forEach(l=>delete l.grp);
  w.lswSuggestApply([w.lswSuggest('ground').find(r=>r.room===A)]);
  // E4: v = 1 → the zone circuit only
  let rows=w.elpSuggest(null);
  ok('E4: v 1 → no extra row, the Nappali lamps stay in the day zone',!rows.some(r=>/Világítás — Nappali/.test(r.name))&&L.every(l=>rows.find(r=>r.ref==='V1').members.indexOf(l.id)>=0));
  w.reqSet(A,'lmp',{n:4,k:2,v:2});rows=w.elpSuggest(null);
  const ex=rows.find(r=>r.name==='Világítás — Nappali 2'),v1=rows.find(r=>r.ref==='V1');
  ok('E4: v 2 → kör 2 (the right-hand leg) gets its own circuit "Világítás — Nappali 2"',ex&&ex.kind==='light'&&[L[2].id,L[3].id].every(id=>ex.members.indexOf(id)>=0)&&[L[0].id,L[1].id].every(id=>ex.members.indexOf(id)<0),ex&&JSON.stringify(ex.members));
  ok('…kör 1 stays in the day zone, and no lamp is in two rows',[L[0].id,L[1].id].every(id=>v1.members.indexOf(id)>=0)&&[L[2].id,L[3].id].every(id=>v1.members.indexOf(id)<0));
  ok('…the switches carry both legs, so they stay in the zone',D.devices.filter(d=>d.code==='SWI').every(s=>ex.members.indexOf(s.id)<0));
  w.reqSet(A,'lmp',{n:4,k:2,v:2,pair:[{kk:1,vk:2},{kk:2,vk:2}]});rows=w.elpSuggest(null);
  const ex2=rows.find(r=>r.name==='Világítás — Nappali 2');
  ok('E4: the pairing wins — both kör on világítási kör 2',ex2&&L.every(l=>ex2.members.indexOf(l.id)>=0)&&/párosítás/.test(ex2.why));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
