// spec-55 — the client preview model (05y-client-preview.js)
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
  const D=()=>w.__data,J=o=>JSON.stringify(o);w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const G=w.__getWalls().ground,U=w.__getWalls().upper;
  G.push({x0:-100,y0:-100,x1:4300,y1:0},{x0:-100,y0:3200,x1:4300,y1:3300},{x0:-100,y0:0,x1:0,y1:3200},{x0:4200,y0:0,x1:4300,y1:3200});
  U.push({x0:-100,y0:-100,x1:4300,y1:0});
  D().floors.push({level:'ground',poly:[[0,0],[4200,0],[4200,3200],[0,3200]],name:'Nappali',num:'1.01'});
  D().floors.push({level:'upper',poly:[[0,0],[4200,0],[4200,1600],[0,1600]],name:'Szoba'});
  D().devices.push({type:'socket',ref:'D1',x:600,y:40,h:300,level:'ground',side:1});
  D().devices.push({type:'light',ref:'L1',x:2100,y:1600,h:2700,level:'ground'});
  D().devices.push({type:'socket',ref:'D9',x:9000,y:9000,h:300,level:'ground'});
  w.ensureIds(D());
  w.__state.levels={basement:false,ground:true,upper:false};
  const before=J(D());
  const m=w.cpvModel();
  ok('pure: the plan data is unchanged after building the model',J(D())===before);
  ok('kind and version',m.kind==='vrg-client-preview'&&m.v===1);
  ok('default scope: shown level in, hidden level with geometry ghost, empty basement skipped',
    J(m.levels.map(l=>[l.id,l.scope]))===J([['ground','in'],['upper','ghost']]),J(m.levels.map(l=>[l.id,l.scope])));
  ok('ground at z 0, upper one storey + slab above',m.levels[0].z===0&&m.levels[1].z===2700+300,J(m.levels.map(l=>l.z)));
  const nap=m.rooms.find(r=>r.name==='Nappali');
  ok('room carries num, area in m² to one decimal, ceiling height',nap&&nap.num==='1.01'&&nap.area===13.4&&nap.ceil===2700,J(nap));
  ok('room lists its devices by id',nap&&nap.devices.length===2,J(nap&&nap.devices));
  const soc=m.devices.find(d=>d.ref==='D1');
  ok('wall socket: endpoint kind, Hungarian and English label, faces into the room',soc&&soc.kind==='endpoint'&&soc.label==='Aljzat'&&soc.labelEn==='Socket'&&soc.ny===1,J(soc));
  ok('device outside every room has room null',m.devices.find(d=>d.ref==='D9').room===null);
  ok('walls come out as min/max rectangles with height',m.walls.filter(x=>x.level==='ground').length===4&&m.walls.every(x=>x.x0<=x.x1&&x.y0<=x.y1&&x.h>0));
  ok('stats count only in-scope rooms and endpoints',m.stats.rooms===1&&m.stats.endpoints===3,J(m.stats));
  const m2=w.cpvModel({scope:{upper:'skip'}});
  ok('explicit scope wins: upper skipped, its rooms and walls left out',m2.levels.length===1&&!m2.rooms.some(r=>r.level==='upper')&&!m2.walls.some(x=>x.level==='upper'));
  const m3=w.cpvModel({scope:{upper:'in'}});
  ok('upper in scope counts its room',m3.stats.rooms===2);
  ok('JSON round-trip is lossless (no functions, no cycles)',J(JSON.parse(J(m)))===J(m));
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
