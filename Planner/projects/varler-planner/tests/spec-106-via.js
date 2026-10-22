// Wireway rebuild T6 (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.5 K3) — drawn routes on links (up.via):
// 1. a room run follows the drawn path where it can (×0,25 along it), even when another way is shorter;
// 2. never through a ban: a banned stretch breaks the fit — the report and a warning say how much was followed;
// 3. a via that no longer exists warns; a hub's home run follows its via (gerinc);
// 4. the Planner: viaSet on a node with an up, only on a user path (not gen:'bl'), carried in cfg.tree.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
const BLD=path.join(__dirname,'..','tools','baseline');
const geom=require(path.join(BLD,'geom')),prep=require(path.join(BLD,'prep')),plan=require(path.join(BLD,'plan'));
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
function mk(o){o=o||{};const walls=[{id:'WT',x0:-100,y0:-100,x1:10100,y1:0},{id:'WB',x0:-100,y0:3000,x1:10100,y1:3100},{id:'WL',x0:-100,y0:0,x1:0,y1:3000},{id:'WR',x0:10000,y0:0,x1:10100,y1:3000},
  {id:'WB2',x0:-100,y0:6000,x1:10100,y1:6100},{id:'WL2',x0:-100,y0:3100,x1:0,y1:6000},{id:'WR2',x0:10000,y0:3100,x1:10100,y1:6000}];
  const marks=walls.map(w=>({kind:'wall',wall:w.id,level:'ground',tags:['vezetheto']})).concat(o.marks||[]);
  const devices=[{id:'BRD',type:'board',level:'ground',x:5000,y:5950,h:1500,layer:'hw'},{id:'S1',type:'socket',code:'SOC',level:'ground',x:6000,y:0,h:300,layer:'m',ref:'D1'}].concat(o.devices||[]);
  const D={floors:[{id:'A',num:'A',name:'Nappali',level:'ground',poly:[[0,0],[10000,0],[10000,3000],[0,3000]]},{id:'B',num:'B',name:'Háló',level:'ground',poly:[[0,3100],[10000,3100],[10000,6000],[0,6000]]}],
    openings:[{id:'O1',type:'door',level:'ground',x:9000,y:3050,w:900,ang:0,variant:2}],marks,objects:[],devices,
    paths:[{id:'P1',ptype:'gege',nodes:[{x:8400,y:3000},{x:0,y:3000},{x:0,y:0},{x:6000,y:0}].map(n=>Object.assign({level:'ground'},n))}].concat(o.paths||[]),
    circuits:[{ref:'A1',name:'dug',mcb:'C16',members:devices.filter(d=>d.layer==='m').map(d=>d.id)}]};
  return {project:{data:D,building:{walls:{ground:walls}},layers:[{id:'m',role:'sys:MAINS'},{id:'hw',role:'hw'}]}};}
function run(doc,cfg){cfg=Object.assign({level:'ground',ceiling:2850,maxCablesPerPipe:3},cfg||{});
  const G=geom.load(doc,'ground'),al=geom.allowedFromSketch(G,[]).allowed,E=prep.endpoints(G,cfg);prep.applyHeights(E);
  const PT=prep.portals(G,E);prep.portalMembers(G,PT,E);return Object.assign(plan.plan(G,E,PT,cfg,al),{G,E,PT});}
const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
// a room-run segment along the left wall's face (x = 0), longer than 2 m
const usesLeft=r=>r.legs.some(l=>l.kind==='dist'&&l.poly.some((p,k)=>k&&Math.abs(p[0])<2&&Math.abs(l.poly[k-1][0])<2&&Math.abs(p[1]-l.poly[k-1][1])>2000));
function engine(){
  const base=run(mk(),{tree:{S1:{id:'O1',room:'A'}}});
  ok('0 without a via the room run takes the short way round (the right)',!usesLeft(base));
  const rv=run(mk(),{tree:{S1:{id:'O1',room:'A',via:'P1'}}}),row=rv.report.via[0];
  ok('1 with the drawn path the run goes the long way the user drew (the left wall)',usesLeft(rv));
  ok('1 the report says it was followed (≥ 90 %), no warning',row&&row.via==='P1'&&row.pct>=90&&!rv.warn.some(x=>/rajzolt pályát/.test(x.msg)),JSON.stringify(row));
  ok('1 the lengths stay geometric (the ×0,25 is for the search only)',rv.legs.filter(l=>l.kind==='dist').reduce((a,l)=>a+l.len,0)>base.legs.filter(l=>l.kind==='dist').reduce((a,l)=>a+l.len,0)+5000);
  // a Tilos face on the left wall: no edge there — the fit breaks, the report says so
  const rb=run(mk({marks:[{kind:'side',level:'ground',wall:'WL',side:1,pol:'ban',tags:['tilos']}]}),{tree:{S1:{id:'O1',room:'A',via:'P1'}}}),rowb=rb.report.via[0];
  ok('2 never through a ban: the run leaves the drawn path',!usesLeft(rb));
  ok('2 … and says how much it followed, with a warning',rowb&&rowb.pct<90&&rb.warn.some(x=>x.sev==='warn'&&/csak \d+ %-ban/.test(x.msg)),JSON.stringify(rowb));
  const rm=run(mk(),{tree:{S1:{id:'O1',room:'A',via:'NOPE'}}});
  ok('3 a via that is gone: a warning, and the run still routes',rm.warn.some(x=>/már nincs a tervben/.test(x.msg))&&rm.legs.some(l=>l.kind==='dist'));
  // a hub in room A on the left wall, on the board, its home run drawn up the right side
  const hub={id:'SZ',type:'junction',jb:'szoba',level:'ground',x:-50,y:1500,h:2150,layer:'hw',ref:'SZ1'};
  const P2={id:'P2',ptype:'gege',nodes:[{x:5000,y:6000},{x:10000,y:6000},{x:10000,y:3100}].map(n=>Object.assign({level:'ground'},n))};
  const rh=run(mk({devices:[hub,{id:'S2',type:'socket',code:'SOC',level:'ground',x:0,y:2000,h:300,layer:'m',ref:'D2'}],paths:[P2]}),{tree:{SZ:{id:'BRD',via:'P2'},S2:{id:'SZ'}}});
  ok('3 a hub\'s home run reports its via (gerinc)',rh.report.via.some(v=>v.what==='gerinc'&&v.via==='P2'),JSON.stringify(rh.report.via));
}
try{engine();}catch(err){R.push(['engine exception',false,err.stack]);}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const D=w.__data;w.__state.active='ground';
  D.devices.length=0;D.paths.length=0;
  const s={type:'socket',code:'SOC',level:'ground',x:100,y:0,h:300,layer:'L0'};D.devices.push(s);
  D.paths.push({ptype:'gege',nodes:[{level:'ground',x:0,y:0},{level:'ground',x:900,y:0}],sections:[{build:'sull_gege'}],layer:'L0'});
  D.paths.push({ptype:'gege',nodes:[{level:'ground',x:0,y:50},{level:'ground',x:900,y:50}],sections:[{build:'sull_gege'}],layer:'L0',gen:'bl'});w.ensureIds(D);
  ok('4 no up yet: refused with the reason',/Előbb a betáp/.test(w.viaSet(s.id,D.paths[0].id).err||''));
  s.up={id:'B1'};ok('4 a generated path is refused',/számított pálya/.test(w.viaSet(s.id,D.paths[1].id).err||''));
  const r=w.viaSet(s.id,D.paths[0].id);ok('4 a user path: up.via set, the link rögzített',r.ok&&s.up.via===D.paths[0].id&&s.up.fix);
  ok('4 cfg.tree carries the via',w.blInput('ground').cfg.tree[s.id].via===D.paths[0].id);
  ok('4 and it can be taken off',w.viaClear(s.id)&&!s.up.via);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
