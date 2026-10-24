// Simplified UI WP-S3 — the real menu tree, generators, new actions (src/11u-sm-tree.js). Tests 1–10 of
// docs/simple-ui/WP-S3_menu-tree.md, plus the planner-sui additions (mode.note, ui.dialSide, Födém / Igénylista / Házimozi).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const d=w.document;const $=id=>d.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 const labels=()=>[...$('smMenu').querySelectorAll('.smI')].map(b=>b.querySelector('.smLb').childNodes[0].textContent);
 const crumb=()=>$('smMenu').querySelector('.smCrumb').textContent;
 const go=(...names)=>{w.smClose();w.smOpen();for(const n of names){const i=w.__SM.slots.findIndex(s=>s.n===n);if(i<0)throw new Error('no slot '+n+' in '+labels().join());w.smActivate(i);}};
 try{
  w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.smSet(true);const T=w.SM_TREE_GET();
  // 1
  const ids=[];(function walk(n){(n.items||[]).forEach(c=>{if(c.a)ids.push(c.a);walk(c);});})(T);
  const miss=ids.filter(id=>!w.actionById(id));ok('every a: in SM_TREE resolves ('+ids.length+')',miss.length===0,miss.join(' '));
  // 2
  w.smOpen();ok('root: Épület Villamosság Eszközök Rendszer Bezár',labels().join()==='Épület,Villamosság,Eszközök,Rendszer,Bezár',labels().join());
  // 3
  go('Épület','Nyílászárók');ok('Épület › Nyílászárók: Ajtó Ablak Lépcső Portál Vissza',labels().join()==='Ajtó,Ablak,Lépcső,Portál,Vissza',labels().join());
  // 4
  w.smActivate(2);ok('Lépcső → build mode, buildType stairs, menu closed',w.__state.mode==='build'&&w.__state.buildType==='stairs'&&!w.__SM.open,w.__state.mode+' '+w.__state.buildType);
  w.runAction('mode.select');
  // 5
  go('Villamosság','Végpontok');const li=w.__SM.slots.findIndex(s=>s.a==='wf.layer.LIGHT');w.smActivate(li);
  const L=w.lyrLayer(w.__state.activeLayer);ok('Lámpák + kapcsolók → active layer role sys:LIGHT, menu still open',L&&L.role==='sys:LIGHT'&&w.__SM.open,L&&L.role);
  // 6
  go('Épület','Szabályok','Szabálykészlet');ok('rule sections: Fal Nyílászáró Egyéb területek Vissza',labels().join()==='Fal,Nyílászáró,Egyéb területek,Vissza',labels().join());
  w.smActivate(0);const p1=labels();w.smActivate(3);const p2=labels();w.smActivate(3);const p3=labels();
  ok('Fal: 3 pages of 3 / 3 / 4',p1.length===5&&p2.length===5&&p3.length===5&&p1[3]==='Tovább'&&p2[3]==='Tovább'&&p3[3]!=='Tovább',[p1,p2,p3].map(x=>x.join('|')).join(' ; '));
  ok('Tilos is on page 2',p2.indexOf('Tilos')>=0&&p1.indexOf('Tilos')<0);
  w.smBack();w.smActivate(w.__SM.slots.findIndex(s=>s.n==='Tilos'));
  // since R5 the side / wall / route presets are marker-pen inks (08ia mkpIsPen), so Tilos starts the pen, not RB.on
  const tc=w.toolCurrent();ok('Tilos → a tool runs (the marker pen, R5), menu closed',!!tc&&w.mkpIsPen('tilos')&&!w.__SM.open,JSON.stringify(tc));
  w.toolStop();
  go('Épület','Szabályok','Szabálykészlet');w.smActivate(0);w.smActivate(3);w.smActivate(3);w.smActivate(w.__SM.slots.findIndex(s=>s.n==='Ágy zóna'));
  const RB=w.eval('RB');ok('Ágy zóna (a zone preset) → RB.on, preset agy',RB.on===true&&RB.preset==='agy',RB.on+' '+RB.preset);w.toolStop();
  // 7
  const epIds=w.ACTIONS.map(a=>a.id).filter(id=>/^ep\.place\./.test(id));const seen={};
  w.SM_GEN.endpoints().forEach(g=>g.items.forEach(l=>{seen[l.a]=(seen[l.a]||0)+1;}));
  const bad7=epIds.filter(id=>seen[id]!==1);ok('every ep.place.<CODE> exactly once under Minden végpont ('+epIds.length+')',bad7.length===0&&!seen['ep.place'],bad7.join(' '));
  // 8
  const all=w.ACTIONS.map(a=>a.id);const reach=w.smReach();const unreached=all.filter(id=>!reach.has(id));
  ok('smReach() covers every action ('+all.length+')',unreached.length===0,unreached.join(' '));
  const other=w.SM_GEN.other().reduce((n,g)=>n+g.items.length,0);console.log('INFO  other holds '+other+' of '+all.length+' actions');
  ok('other holds ≤ 150 ids ('+other+')',other<=150,other);
  let maxSlots=0,levels=0;const stk=w.__SM;
  (function explore(depth){if(depth>6)return;levels++;const n=w.__SM.slots.length;maxSlots=Math.max(maxSlots,n);
    const subs=w.__SM.slots.map((s,i)=>[s,i]).filter(([s])=>s.kind==='sub'||s.kind==='more');
    for(const [s,i] of subs){const snap=JSON.stringify(stk.stack.map(x=>[x.node.k||x.node.n,x.page]));w.smActivate(i);explore(depth+1);w.smBack();
      if(JSON.stringify(stk.stack.map(x=>[x.node.k||x.node.n,x.page]))!==snap)throw new Error('back did not return at '+snap);}})
  ((w.smClose(),w.smOpen(),0));
  ok('no level of the real tree (depth 6, every page) has more than 5 slots ('+levels+' levels)',maxSlots<=5,maxSlots);
  // 9
  const TOOLS=['mode.room','wf.roomType','wf.door','wf.window','wf.stairs','pt.place','wf.routeWalls','mark.wall','mark.plane','mode.wall','mode.grab',
   'mode.measure','wf.switches','wf.ceilLine','wf.floorLine','wf.boxSzoba','wf.boxKot','wf.board','circuit.pick','mode.path','chn.route','rail.route',
   'arm.route','hw.rbx','hw.serve','mode.note','mode.object','mode.format'];
  const kinds={};(function walk(n){(n.items||[]).forEach(c=>{if(c.a)kinds[c.a]=c.kind;walk(c);});})(T);
  const wrong=Object.keys(kinds).filter(id=>(kinds[id]==='tool')!==(TOOLS.indexOf(id)>=0));
  ok('exactly the §2 tool rows have kind:tool',wrong.length===0,wrong.join(' '));
  // 10
  const layers=w.eval('layers');while(layers.length<3)layers.push({id:'LT'+layers.length,name:'Teszt '+layers.length,visible:true,cats:layers[0].cats});
  const n0=layers.length;const gl=w.SM_GEN.layers();ok('layers generator: one leaf per layer ('+n0+')',gl.length===n0);
  gl[1].fn();ok('activating the 2nd sets state.activeLayer',w.__state.activeLayer===layers[1].id);
  // planner-sui additions
  ok('mode.note exists and starts the note tool',(w.runAction('mode.note'),w.__state.mode==='note'));w.runAction('mode.select');
  go('Rendszer','Beállítások');const ds=w.__SM.slots.findIndex(s=>s.a==='ui.dialSide');w.smActivate(ds);
  ok('Tárcsa: bal / jobb sarok flips the side and stays open',d.body.classList.contains('sm-right')&&w.__SM.open);w.smSide(false);
  go('Épület','Szintek');w.smActivate(3);ok('Szintek pages to Födém',labels().indexOf('Födém')>=0,labels().join());
  go('Villamosság','Végpontok');w.smActivate(3);ok('Végpontok page 2 holds Házimozi',labels().indexOf('Házimozi')>=0,labels().join());
  go('Épület','Szabályok');w.smActivate(3);ok('Szabályok page 2 holds Igénylista',labels().indexOf('Igénylista')>=0,labels().join());
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x!==''&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
