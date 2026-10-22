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
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 const key=e=>{const ev=new w.KeyboardEvent('keydown',Object.assign({bubbles:true,cancelable:true},e));
   w.document.dispatchEvent(ev);return ev;};
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const devs=()=>w.__data.devices,ids=()=>devs().map(d=>d.id),unique=a=>new Set(a).size===a.length;
  const num=id=>+String(id).replace(/^\D+/,'');
  const REQ=()=>({name:'Szoba N',num:'3',count:3,mm2:1.5,colors:['fekete','kék','zöld']});
  // a board at the origin, a route P1 along y=0 to x=4000, a branch P2 from x=2000 to y=2000
  const mk=()=>{w.newBlankProject();const d=w.__data;
    d.devices.push({type:'board',ref:'EL1',level:lvl,x:0,y:0,h:1500,layer:'L0'});
    d.paths.push({nodes:[{x:0,y:0,h:2500,level:lvl},{x:2000,y:0,h:2500,level:lvl},{x:4000,y:0,h:2500,level:lvl}],
      sections:[{build:'sull_gege'},{build:'sull_gege'}],layer:'L0'});
    d.paths.push({nodes:[{x:2000,y:0,h:2500,level:lvl},{x:2000,y:2000,h:2500,level:lvl}],sections:[{build:'sull_gege'}],layer:'L0'});
    w.ensureIds(d);return d;};
  const sock=o=>Object.assign({type:'socket',ref:'D12',level:lvl,y:0,h:500,layer:'L0',side:1},o);
  const onSec=(d,pi,si)=>((d.paths[pi].sections[si]||{}).circuits||[]).map(c=>c.dev);

  // ---------- the bug: Ctrl+D and Ctrl+drag copied the id along with the box ----------
  let d=mk();
  d.devices.push(sock({x:4000,req:REQ()}));w.ensureIds(d);
  const orig=d.devices[1],P1=d.paths[0];
  w.setLink(orig,P1.id,P1.nodes[2].id);orig.clip='g1';
  const ck=w.cktCreate({name:'Szoba',dedicated:true,members:[orig.id]});
  w.setMode('grab');w.__setSel({t:'devices',i:1});
  const n0=devs().length,seq0=d.seq;
  key({key:'d',ctrlKey:true});
  const cp=devs()[n0];
  ok('Ctrl+D copies the box',devs().length===n0+1&&!!cp&&cp.type==='socket'&&cp.x===orig.x+300,cp&&cp.x);
  ok('the copy has its own id, straight from the counter',!!cp&&/^D\d+$/.test(cp.id)&&cp.id!==orig.id&&num(cp.id)>seq0,cp&&(orig.id+' / '+cp.id));
  ok('ids stay unique; validate() finds no duplicate',unique(ids())&&!w.validate().some(i=>i.code==='id.duplicate'));
  ok('each box is found by its own id',w.byId('devices',orig.id)===orig&&w.byId('devices',cp.id)===cp);
  ok('the copy keeps what the box is: ref, height, wire data',cp.ref===orig.ref&&cp.h===orig.h&&JSON.stringify(cp.req)===JSON.stringify(orig.req));
  ok('…but not how the original is tied in: no route link, no clip row',
     !w.devLinks(cp).length&&!cp.clip&&w.devLinks(orig).length===1&&orig.clip==='g1');
  ok('the copy is not silently a second end point of the dedikált circuit',w.cktOfDevice(cp)===null&&w.cktOfDevice(orig)===ck&&ck.members.length===1);
  const cpId=cp.id;
  ok('undo takes the copy back, redo restores it under the same id',(function(){w.doUndo();const gone=devs().length===n0;
    w.doRedo();const back=devs()[n0];return gone&&!!back&&back.id===cpId;})());
  ok('a later copy never reuses an id',(function(){const used=new Set(ids());w.__setSel({t:'devices',i:1});key({key:'d',ctrlKey:true});
    const c2=devs()[devs().length-1];return !used.has(c2.id)&&unique(ids());})(),ids().join());
  ok('Ctrl+drag (clonePiece) gives a fresh id too',(function(){const i=ids().indexOf(orig.id),h=w.clonePiece({t:'devices',i});
    const c=devs()[h.i];return c!==orig&&!!c.id&&c.id!==orig.id&&unique(ids());})());

  // copying a clip row: the copies form a row of their own, the originals keep theirs
  d=mk();
  d.devices.push(sock({x:1000,clip:'gR'}),sock({x:1072,clip:'gR'}));w.ensureIds(d);
  w.setMode('grab');w.__clearMulti();w.__setSel({t:'devices',i:1});w.__addMulti({t:'devices',i:2});
  key({key:'d',ctrlKey:true});
  ok('a multi-selection copy gives every box a fresh id',devs().length===5&&unique(ids()),ids().join());
  ok('a copied clip row is a new row; the original row is untouched',(function(){const a=devs()[3],b=devs()[4];
    return !!a.clip&&a.clip===b.clip&&a.clip!=='gR'&&devs()[1].clip==='gR'&&devs()[2].clip==='gR';})(),devs().map(x=>x.clip).join());
  w.__clearMulti();

  // the same bug, other kinds of records
  ok('a copied wall gets its own id',(function(){const WA=w.__getWalls()[lvl];WA.push({x0:0,y0:3000,x1:4000,y1:3100});w.ensureIds(w.__data);
    const src=WA[WA.length-1],h=w.clonePiece({t:'wall',level:lvl,ref:src});return /^W\d+$/.test(h.ref.id||'')&&h.ref.id!==src.id;})());
  ok('the note menu copy gets its own id',(function(){w.__data.notes.push({level:lvl,x:100,y:100,text:'Médiapult',layer:'L0'});w.ensureIds(w.__data);
    const i=w.__data.notes.length-1,src=w.__data.notes[i],items=w.ntMenuItems(i,[]);items.find(x=>/Másolás/.test(x.label)).act();
    w.ensureIds(w.__data);const c=w.__data.notes[w.__data.notes.length-1];return c!==src&&c.text==='Médiapult'&&!!c.id&&c.id!==src.id;})());
  ok('object / opening / roof copies drop the id, keep the rest (deep)',['objects','openings','roofs'].every(k=>{
    const src={id:'X9',x:1,nested:{a:1}},c=w.copyRecord(k,src);c.nested.a=2;return c.id===undefined&&c.x===1&&src.nested.a===1;}));

  // ---------- repair on load: CLANV4 in miniature ----------
  // three boxes under one id (the old Ctrl+drag), 18 cm apart, all on the same route node; the first and
  // third carry wire data and were routed while they shared the id, the middle one has a glued link
  d=mk();
  d.devices.push(sock({x:4000,req:REQ()}),sock({x:4180,h:480}),sock({x:4360,req:REQ()}));w.ensureIds(d);
  w.setLink(d.devices[2],d.paths[0].id,d.paths[0].nodes[2].id);
  const X=d.devices[1].id;d.devices[2].id=X;d.devices[3].id=X;
  w.routeDevice(1,'board',null,true);w.routeDevice(3,'board',null,true);
  const saved=JSON.parse(JSON.stringify(w.sessionObj()));
  ok('fixture: three boxes share one id, each section carries the entry twice',
     saved.data.devices.filter(x=>x.id===X).length===3&&[0,1].every(si=>onSec(saved.data,0,si).filter(v=>v===X).length===2));
  w.applyProjectData(JSON.parse(JSON.stringify(saved)));
  d=w.__data;let dv=d.devices;
  ok('after loading every id is unique',unique(ids())&&!w.validate().some(i=>i.code==='id.duplicate'),ids().join());
  ok('the first keeps the id, the others get fresh ones from the counter',
     dv[1].id===X&&dv[2].id!==X&&dv[3].id!==X&&num(dv[2].id)>saved.data.seq&&num(dv[3].id)>num(dv[2].id)&&d.seq>=num(dv[3].id),
     [dv[1].id,dv[2].id,dv[3].id,d.seq].join());
  ok('the glued link stays with its own box',w.devLinks(dv[2]).length===1&&!!w.linkTarget(dv[2])&&!w.devLinks(dv[1]).length&&!w.devLinks(dv[3]).length);
  ok('the Behúzás entries are split: one per routed box on every section',
     [0,1].every(si=>{const s=onSec(d,0,si);return s.length===2&&s.includes(X)&&s.includes(dv[3].id);}),[0,1].map(si=>onSec(d,0,si).join('+')).join(' | '));
  ok('each routed box now has its own run length; the unrouted one has none',
     w.deviceRunLen(1).L>0&&w.deviceRunLen(3).L===w.deviceRunLen(1).L&&w.deviceRunLen(2).L===0);
  ok('the report names the re-id and the split',(function(){const r=w.idRepairReport();
    return !!r&&r.reid.length===2&&r.moved===2&&!r.kept.length&&r.split.length===1&&r.split[0].from===X&&r.split[0].to===dv[3].id;})(),
     JSON.stringify(w.idRepairReport()));
  ok('the file version is not bumped',d.v===saved.data.v);
  ok('idempotent: loading the repaired save changes nothing',(function(){const s1=JSON.parse(JSON.stringify(w.sessionObj())),a=JSON.stringify(s1.data);
    w.applyProjectData(s1);return w.idRepairReport()===null&&JSON.stringify(w.sessionObj().data)===a;})());
  ok('loading it from the project list says so in the status line',(function(){
    const id=w.saveProject('dup-teszt'),ix=JSON.parse(w.localStorage.getItem('villanyterv_projects_v1'));
    ix[id].data=JSON.parse(JSON.stringify(saved));w.localStorage.setItem('villanyterv_projects_v1',JSON.stringify(ix));
    w.loadProject(id);return /Kettőzött azonosító javítva: 2 elem/.test($('hud').textContent)&&/2 behúzás átkötve/.test($('hud').textContent);})(),
     $('hud').textContent);

  // ---------- repair: the boxes' own routes tell the entries apart ----------
  d=mk();
  d.devices.push(sock({x:4000,req:REQ()}),sock({x:2000,y:2000,req:REQ()}));w.ensureIds(d);
  const Y=d.devices[1].id;d.devices[2].id=Y;
  w.routeDevice(1,'board',null,true);w.routeDevice(2,'board',null,true);
  w.applyProjectData(JSON.parse(JSON.stringify(w.sessionObj())));
  d=w.__data;dv=d.devices;
  ok('routes: the shared trunk carries one entry each',(function(){const s=onSec(d,0,0);return s.length===2&&s.includes(Y)&&s.includes(dv[2].id);})(),onSec(d,0,0).join());
  ok('routes: each branch keeps only its own box',onSec(d,0,1).join()===Y&&onSec(d,1,0).join()===dv[2].id,onSec(d,0,1).join()+' / '+onSec(d,1,0).join());

  // ---------- repair: what cannot be told apart stays with the first, and is reported ----------
  d=mk();
  d.devices.push(sock({x:4000,req:REQ()}),sock({x:4180,req:REQ()}),{type:'switch',ref:'K1',level:lvl,x:3000,y:0,h:1100,layer:'L0'});
  w.ensureIds(d);
  const Z=d.devices[1].id;d.devices[2].id=Z;d.devices[3].swMap={L1:Z};
  w.routeDevice(1,'board',null,true);w.routeDevice(2,'board',null,true);
  d.paths[0].sections[1].circuits.pop();                     // one run no longer matches either box's route
  w.cktCreate({name:'Szoba',members:[Z]});
  w.applyProjectData(JSON.parse(JSON.stringify(w.sessionObj())));
  d=w.__data;dv=d.devices;
  ok('ambiguous: ids are still made unique',unique(ids())&&dv[1].id===Z&&dv[2].id!==Z);
  ok('ambiguous: every Behúzás entry keeps pointing at the first',[0,1].every(si=>onSec(d,0,si).every(v=>v===Z)),[0,1].map(si=>onSec(d,0,si).join('+')).join(' | '));
  ok('ambiguous: the switch output and the circuit end point stay with the first',dv[3].swMap.L1===Z&&d.circuits[0].members.join()===Z);
  ok('ambiguous: all three are reported',(function(){const r=w.idRepairReport(),k=r&&r.kept.map(x=>x.what+'×'+x.n).sort().join();
    return !!r&&r.moved===0&&k==='behúzás×3,kapcsoló×1,áramkör végpont×1';})(),JSON.stringify(w.idRepairReport()&&w.idRepairReport().kept));
  ok('ambiguous: the status note says references were left',/5 hivatkozás az elsőnél maradt/.test(w.idRepairNote()),w.idRepairNote());

  // ---------- repair outside the open document (plain migrate) ----------
  ok('different wire data decides by itself, without any geometry',(function(){
    const o={v:2,seq:10,cables:[],notes:[],measures:[],openings:[],floors:[],objects:[],roofs:[],wallNotes:[],
      devices:[{id:'D1',type:'socket',x:0,y:0,h:0,level:lvl,req:{name:'Konyha',num:'1'}},
               {id:'D1',type:'socket',x:5000,y:0,h:0,level:lvl,req:{name:'Fürdő',num:'2'}}],
      paths:[{id:'P2',nodes:[{id:'n3',x:0,y:0,h:0,level:lvl},{id:'n4',x:5000,y:0,h:0,level:lvl}],
        sections:[{build:'sull_gege',circuits:[{name:'Konyha',num:'1',dev:'D1'},{name:'Fürdő',num:'2',dev:'D1'}]}]}]};
    w.migrate(o);const c=o.paths[0].sections[0].circuits;
    return o.devices[1].id==='D11'&&o.seq===11&&c[0].dev==='D1'&&c[1].dev==='D11';})());
  ok('a v1 index reference still lands on the box it meant',(function(){
    const o={v:1,seq:5,cables:[],notes:[],measures:[],openings:[],floors:[],objects:[],roofs:[],wallNotes:[],
      devices:[{id:'D1',type:'socket',x:0,y:0,h:0,level:lvl},{id:'D1',type:'light',x:9,y:9,h:0,level:lvl}],
      paths:[{id:'P2',nodes:[{id:'n3',x:0,y:0,h:0,level:lvl},{id:'n4',x:9,y:9,h:0,level:lvl}],
        sections:[{build:'sull_gege',circuits:[{name:'L',dev:1}]}]}]};
    w.migrate(o);return o.devices[1].id!=='D1'&&o.paths[0].sections[0].circuits[0].dev===o.devices[1].id;})());
  ok('notes, openings and objects under one id are re-id\'d too',(function(){
    const o={v:2,seq:3,cables:[],measures:[],floors:[],roofs:[],wallNotes:[],devices:[],paths:[],
      notes:[{id:'N1',text:'a'},{id:'N1',text:'b'}],openings:[{id:'B2',type:'door'},{id:'B2',type:'door'},{id:'B2',type:'window'}],
      objects:[{id:'O3',name:'Klíma'},{id:'O3',name:'Klíma'}]};
    w.migrate(o);const all=['notes','openings','objects'].reduce((a,k)=>a.concat(o[k].map(r=>r.id)),[]);
    return unique(all)&&o.notes[0].id==='N1'&&o.openings[0].id==='B2'&&o.objects[0].id==='O3'&&/^N\d+$/.test(o.notes[1].id)&&/^B\d+$/.test(o.openings[2].id);})());
  ok('a document without repeats passes through untouched',(function(){const cur=JSON.parse(JSON.stringify(w.sessionObj().data)),a=JSON.stringify(cur);
    w.migrate(cur);return JSON.stringify(cur)===a&&w.idRepairReport()===null;})());

  ok('reg: draw()',(function(){w.setMode('select');try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
