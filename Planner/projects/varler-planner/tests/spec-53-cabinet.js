// spec-53 — the Elosztószekrény: ways, protection, modules, phases (WP-E5) — reproduces CLA's settled cabinet
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
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground',D=()=>w.__data,J=o=>JSON.stringify(o);w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  // eight rooms in a row, 3000 × 4000 each (CLA-like: kitchen, living, bedroom, bathroom, hall, pantry, upper room, WC)
  const names=['KONYHA','NAPPALI','SZOBA','FÜRDŐ','ELŐSZOBA','KAMRA','FELSŐ SZOBA','WC'];
  names.forEach((n,i)=>D().floors.push({level:lvl,name:n,num:'1.0'+(i+1),poly:[[i*3000,0],[(i+1)*3000,0],[(i+1)*3000,4000],[i*3000,4000]]}));
  w.ensureIds(D());const RM=i=>D().floors[i].id;
  const S=w.stkCreate({name:'P'}),L=r=>w.stkLayer(S.id,r).id;
  const dev=(o)=>{D().devices.push(Object.assign({level:lvl,h:300},o));w.ensureIds(D());return D().devices[D().devices.length-1];};
  const board=dev({type:'board',x:100,y:100,h:2000,ref:'EL1',layer:L('hw')}),base=dev({type:'base',x:200,y:200,units:['NET','COMP','MEDIA'],layer:L('base'),ref:'BASE'}),ssc=dev({type:'ssc',x:300,y:300,layer:L('hw'),ref:'SSC'});
  const rbx=[[0,1],[2,3],[4,5],[6,7]].map((rs,i)=>dev({type:'rbx',x:i*6000+1500,y:2000,h:2150,rb:'RB-M',serves:rs.map(RM),layer:L('hw'),ref:'RBX'+(i+1)}));
  // feeds: channel routes whose ends are linked to the board and the consumer
  const link=(a,b)=>{const p={route:'channel',nodes:[{level:lvl,x:a.x,y:a.y,h:2600},{level:lvl,x:b.x,y:b.y,h:2600}],sections:[{build:'sull_gege'}]};D().paths.push(p);w.ensureIds(D());
    w.addLink(a,p.id,p.nodes[0].id);w.addLink(b,p.id,p.nodes[1].id);return p;};
  link(board,base);link(board,ssc);rbx.forEach(x=>link(board,x));
  const ep=(code,role,room,o)=>{role=(role==='sys:MAINS')?w.mnsRoleOf(code):role;return dev(Object.assign({type:w.epTypeFor(code),code,var:w.epEntry(code,role).vars[0].k,x:room*3000+1000+Math.random()*0,y:1000,layer:L(role)},o||{}));};
  // sockets: kitchen 3 circuits · living, bedroom, bathroom, upper 1 each (implicit) · hall + pantry share one circuit = 8
  const k1=ep('SOC','sys:MAINS',0,{x:500}),k2=ep('SOC','sys:MAINS',0,{x:1000}),k3=ep('SOC','sys:MAINS',0,{x:1500});
  ['A','B','sziget'].forEach((n,i)=>{const c=w.cktCreate({name:'Pult '+n});w.cktAssign(c,[k1,k2,k3][i]);if(i===0)c.mcb=w.mcbParse('1C 16A');});
  [1,2,3,6].forEach(r=>ep('SOC','sys:MAINS',r));
  const h1=ep('SOC','sys:MAINS',4),p1=ep('SOC','sys:MAINS',5);const sh=w.cktCreate({name:'Előszoba + kamra'});w.cktAssign(sh,h1);w.cktAssign(sh,p1);
  // big loads: oven, hob, dishwasher, washing machine, bojler, klíma (DED) + the AV position
  ep('DED','sys:MAINS',0,{name:'sütő'});ep('DED','sys:MAINS',0,{var:'hob2l',name:'főzőlap'});ep('DED','sys:MAINS',0,{name:'mosogatógép'});
  ep('DED','sys:MAINS',3,{name:'mosógép'});ep('DED','sys:MAINS',3,{name:'bojler'});ep('DED','sys:MAINS',1,{name:'klíma'});ep('AVP','sys:MEDIA',1);
  ep('NTL','sys:BUSB',4);                                   // a bus-B endpoint → the assured pack's way
  ok('fixture: 8 socket circuits over the four RoomBoxes',rbx.reduce((s,x)=>s+w.afillRbxCircuits(x,w.stkById(S.id)).length,0)===8);
  const W1=w.eloWays(board.id,{phase:'1f'});
  const cnt=k=>W1.filter(x=>x.kind===k).length;
  ok('single phase: 24 ways = system 5 + lighting 4 + sockets 8 + loads 7 (BUILD-001 §14.3)',W1.length===24&&cnt('sys')===5&&cnt('light')===4&&cnt('socket')===8&&cnt('load')===7,J([W1.length,cnt('sys'),cnt('light'),cnt('socket'),cnt('load')]));
  const S1=w.eloSchedule(board.id,{phase:'1f',perWay:'rcbo'});
  ok('single phase, RCBO per way: 5 + 24 = 29 modules (§14.4)',S1.totalMod===29&&S1.feed.reduce((s,f)=>s+f.mod,0)===5,S1.totalMod);
  const S3=w.eloSchedule(board.id,{phase:'3f',perWay:'rcbo'});
  ok('three phase: the hob becomes two ways (25), feed 9 → 34 modules',S3.ways.length===25&&S3.totalMod===34,S3.totalMod);
  ok('…3 rows of 12, 2 free, no spare warning at spareMin 2',S3.rows===3&&S3.free===2&&!S3.warnings.some(x=>x.code==='elo.spare'));
  ok('…spareMin 3 raises the spare warning',(function(){w.ELO_RULES.spareMin=3;const s=w.eloSchedule(board.id,{phase:'3f'});w.ELO_RULES.spareMin=2;return s.warnings.some(x=>x.code==='elo.spare');})());
  ok('the two hob halves sit on two different phases',(function(){const hs=S3.ways.filter(x=>/főzőlap|\(1\/2\)|\(2\/2\)/.test(x.label)&&x.kind==='load'&&/\/2\)/.test(x.label));return hs.length===2&&hs[0].phase!==hs[1].phase;})());
  ok('phase balance: within 1.5× or flagged',(function(){const v=Object.values(S3.phases),r=Math.max(...v)/Math.min(...v);return r<=1.5||S3.warnings.some(x=>x.code==='elo.phase');})(),J(S3.phases));
  ok('a 05j circuit with its own mcb keeps it (kitchen A: 1C 16A, the others 1C 13A)',(function(){const s=S1.ways.filter(x=>x.kind==='socket');return s.some(x=>x.mcb==='1C 16A'&&/Pult A/.test(x.label))&&s.filter(x=>x.mcb==='1C 13A').length===7;})());
  ok('RCBO devices are named from the mcb',S1.ways.find(x=>x.kind==='light').device==='RCBO 1P C10 30 mA A');
  ok('grouped RCDs: ceil(24 / 4) = 6 RCDs, modules recomputed',(function(){const s=w.eloSchedule(board.id,{phase:'1f',perWay:'rcd'});return s.rcd.length===6&&s.totalMod===5+s.ways.reduce((a,x)=>a+x.mod,0)+12;})());
  ok('export: vrg-cabinet v1 with the vrg-circuits payload inside',(function(){const o=w.eloExportObj(board.id);return o.format==='vrg-cabinet'&&o.v===1&&o.schedule.ways.length>0&&o.circuits&&Array.isArray(o.circuits.circuits||o.circuits.list||[]);})());
  ok('kitchen check: fewer than 3 socket circuits is flagged',(function(){const cA=D().circuits.find(x=>x.name==='Pult A'),cI=D().circuits.find(x=>x.name==='Pult sziget');w.cktAssign(cA,k3);const f=w.stkCheck(S,'sys:DED').some(x=>/S04/.test(x.msg));w.cktAssign(cI,k3);return f;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
