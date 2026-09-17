// Wiring pipeline S1 (docs/wiring_pipeline.md): schema v2 ids for wiring references, and spans.
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
  const lvl='ground';const D=w.__data;
  w.confirm=()=>true;w.alert=()=>{};
  const reset=()=>{w.newBlankProject();w.__getWalls()[lvl].push({x0:0,y0:0,x1:6000,y1:300});};
  reset();

  // ================= schema v2: wiring references are ids =================
  ok('schema is v2',w.SCHEMA_VERSION===2);

  // a v1 document, built by hand: indices everywhere
  const v1=()=>({v:1,seq:0,cables:[],notes:[],measures:[],openings:[],floors:[],objects:[],roofs:[],wallNotes:[],noteHide:{},
    devices:[{type:'board',ref:'EL1',x:200,y:-40,h:1200,level:lvl},
             {type:'socket',ref:'D1',x:2600,y:-40,h:300,level:lvl},
             {type:'switch',ref:'K1',x:1000,y:-40,h:1100,level:lvl,swType:'101',swMap:{'1':3,'2':99}},
             {type:'light',ref:'L1',x:1000,y:1500,h:2400,level:lvl}],
    paths:[{nodes:[{x:200,y:-40,h:300,level:lvl},{x:2600,y:-40,h:300,level:lvl}],
      sections:[{build:'sull_gege',circuits:[{dev:1,name:'Dugalj',num:'3',count:3,mm2:2.5},{dev:42,name:'Szellem'}]}]}]});

  const m=w.migrate(v1());
  ok('migrate stamps v2',m.v===2);
  ok('a routed circuit now points at a device id, not an index',
     m.paths[0].sections[0].circuits[0].dev===m.devices[1].id&&typeof m.paths[0].sections[0].circuits[0].dev==='string',
     JSON.stringify(m.paths[0].sections[0].circuits[0]));
  ok('a routed circuit whose index pointed nowhere is dropped, not mis-attached',
     m.paths[0].sections[0].circuits.length===1&&!m.paths[0].sections[0].circuits.some(c=>c.name==='Szellem'));
  ok('switch outputs now point at device ids',m.devices[2].swMap['1']===m.devices[3].id,JSON.stringify(m.devices[2].swMap));
  ok('a switch output whose index pointed nowhere is removed',!('2' in m.devices[2].swMap));
  ok('migrate is idempotent on a v2 document',(function(){
    const before=JSON.stringify(m);const again=w.migrate(JSON.parse(before));
    return JSON.stringify(again)===before;})());
  ok('a v0 document (no version) also migrates its wiring',(function(){
    const d=v1();delete d.v;const r=w.migrate(d);return r.v===2&&r.paths[0].sections[0].circuits[0].dev===r.devices[1].id;})());

  // ---- live: the bug the migration exists for ----
  reset();
  D.devices.push({type:'board',ref:'EL1',x:200,y:-40,h:1200,level:lvl,rw:500,rd:150});
  D.devices.push({type:'socket',ref:'D1',x:2600,y:-40,h:300,level:lvl,side:0,
    req:{name:'Dugalj',num:'3',count:3,mm2:2.5}});
  D.paths.push({nodes:[{x:200,y:-40,h:300,level:lvl},{x:1400,y:-40,h:300,level:lvl},{x:2600,y:-40,h:300,level:lvl}],
    sections:[{build:'sull_gege'},{build:'sull_gege'}]});
  w.ensureIds(D);
  const sock=D.devices[1];
  w.routeDevice(1,'board',null,true);
  const carried=D.paths[0].sections.map(s=>(s.circuits||[]).map(c=>c.dev));
  ok('Behúzás writes the device id onto every section it crosses',
     carried.length===2&&carried.every(a=>a.length===1&&a[0]===sock.id),JSON.stringify(carried));
  const lenBefore=w.deviceRunLen(D.devices.indexOf(sock)).L;
  ok('the run has a length',lenBefore>2,lenBefore);
  D.devices.unshift({type:'light',ref:'L9',x:5000,y:3000,h:2400,level:lvl});w.ensureIds(D);
  ok('inserting a device before it does not steal its wiring',
     Math.abs(w.deviceRunLen(D.devices.indexOf(sock)).L-lenBefore)<1e-9&&w.deviceRunLen(0).L===0,
     w.deviceRunLen(0).L+' / '+w.deviceRunLen(D.devices.indexOf(sock)).L);
  ok('cable list still names the right device',w.cableRows().length===1&&w.cableRows()[0][2]==='D1',JSON.stringify(w.cableRows()));

  // switch → lamp, then shift the indices underneath it
  const sw={type:'switch',ref:'K1',x:1000,y:-40,h:1100,level:lvl,side:0,swType:'101',swMap:{}};
  const lamp={type:'light',ref:'L1',x:1000,y:1500,h:2400,level:lvl};
  D.devices.push(sw,lamp);w.ensureIds(D);
  sw.swMap['1']=w.devIdOf(D.devices.indexOf(lamp));
  ok('a switch output stores the lamp id',sw.swMap['1']===lamp.id);
  D.devices.unshift({type:'socket',ref:'D7',x:5200,y:-40,h:300,level:lvl});w.ensureIds(D);
  ok('the switch report still names the lamp after indices shift',(function(){
    const r=w.switchReportData().find(s=>s.ref==='K1');return r&&r.drives.length===1&&/^L1/.test(r.drives[0]);})());
  ok('no dangling-wiring issue while everything exists',
     !w.validate().some(v=>v.code==='wiring.dangling'||v.code==='switch.dangling'));
  D.devices.splice(D.devices.indexOf(sock),1);D.devices.splice(D.devices.indexOf(lamp),1);
  const issues=w.validate().map(v=>v.code);
  ok('deleting a routed device is reported, not silently re-pointed',issues.includes('wiring.dangling'),issues.join());
  ok('deleting a switched lamp is reported',issues.includes('switch.dangling'),issues.join());
  ok('the switch report shows no target rather than the wrong one',(function(){
    const r=w.switchReportData().find(s=>s.ref==='K1');return r&&r.drives.length===0;})());
  ok('reg: draw() with dangling wiring',(function(){try{w.draw();return true;}catch(e){return false;}})());

  // ================= spans =================
  reset();
  const add=o=>{D.devices.push(Object.assign({level:lvl},o));w.ensureIds(D);return D.devices[D.devices.length-1];};
  const route=nodes=>{D.paths.push({nodes:nodes.map(n=>({x:n[0],y:n[1],h:n[2]||300,level:lvl})),
    sections:nodes.slice(1).map(()=>({build:'sull_gege'}))});w.ensureIds(D);return D.paths[D.paths.length-1];};
  const board=add({type:'board',ref:'EL1',x:200,y:-40,h:1200,rw:500,rd:150});
  const d1=add({type:'socket',ref:'D1',x:3000,y:-40,h:300,side:0});
  const p1=route([[200,-40],[1500,-40],[3000,-40]]);
  let sp=w.routeSpans(p1);
  ok('a bend does not split a span',sp.length===1&&sp[0].segs.join()==='0,1',JSON.stringify(sp.map(s=>s.segs)));
  ok('span ends resolve to the terminals',sp[0].from.dev===board&&sp[0].to.dev===d1);
  ok('span length is the sum of its segments (m)',Math.abs(sp[0].len-2.8)<1e-6,sp[0].len);
  ok('the board-side end is named first',w.allSpans()[0].name==='EL1~D1',w.allSpans()[0].name);

  const kd=add({type:'junction',ref:'KD1',x:1500,y:-40,h:300,jbShape:'circle',jbSize:80});
  sp=w.routeSpans(p1);
  ok('a kötődoboz on a node splits the route into two spans',sp.length===2&&sp[0].to.dev===kd&&sp[1].from.dev===kd);
  ok('names read board first, then natural order',
     w.allSpans().map(s=>s.name).join()==='EL1~KD1,D1~KD1',w.allSpans().map(s=>s.name).join());
  ok('coincidence joins are marked as such',sp[0].to.how==='near');

  ok('an explicit link beats a closer coincident device',(function(){
    const other=add({type:'junction',ref:'KD2',x:1560,y:-40,h:300,jbShape:'circle',jbSize:80});
    other.link={p:p1.id,n:p1.nodes[1].id};
    const t=w.terminalAtNode(p1,p1.nodes[1]);
    const r=t&&t.dev===other&&t.how==='link';
    D.devices.splice(D.devices.indexOf(other),1);return r;})());
  ok('a switch 800 mm above a node is not at that node',(function(){
    const k=add({type:'switch',ref:'K1',x:1500,y:-40,h:1100,side:0});
    D.devices.splice(D.devices.indexOf(kd),1);
    const t=w.terminalAtNode(p1,p1.nodes[1]);
    D.devices.splice(D.devices.indexOf(k),1);D.devices.push(kd);
    return !t;})());
  ok('a junction outranks a box sharing its node',(function(){
    const bx=add({type:'box',ref:'SZ1',x:1500,y:-40,h:300});
    const t=w.terminalAtNode(p1,p1.nodes[1]);D.devices.splice(D.devices.indexOf(bx),1);
    return t&&t.dev===kd;})());
  ok('an unterminated route end is named by path and node',(function(){
    const p2=route([[3000,-40],[3000,2000]]);
    const s=w.allSpans().find(x=>x.path===p2.id);const r=s&&s.name==='D1~'+p2.id+'/'+p2.nodes[1].id;
    D.paths.pop();return r||(s&&s.name);})()===true);
  ok('a parallel span between the same terminals gets /b',(function(){
    const p3=route([[1500,-40],[2200,600],[3000,-40]]);
    const names=w.allSpans().filter(s=>s.base==='D1~KD1').map(s=>s.name).join();
    D.paths.pop();return names==='D1~KD1,D1~KD1/b'||names;})()===true);
  ok('spanOfSection finds the span of a segment',(function(){
    const s=w.spanOfSection(p1.id,1);return s&&s.name==='D1~KD1';})());
  ok('spans are derived, nothing is stored on the document',
     !JSON.stringify(D).includes('"spans"')&&!D.paths.some(p=>p.spans));
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return false;}})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
