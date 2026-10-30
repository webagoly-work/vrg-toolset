// ==========================================================================
// 11u-sm-tree.js — Egyszerű felület (docs/simple-ui): the curated menu tree, its generators, the new actions it needs
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// The tree is docs/simple-ui/02_MENU-TREE.md §2. Main-only rows added on planner-sui (2026-10-19): Födém, Igénylista,
// Házimozi (each as a 5th item, so those levels page) — listed as a deviation in the S3 report.
// ==========================================================================

// NEW actions. wf.roomType / wf.stairs / wf.layer.* already exist (05db, T3), so only these are registered here.
registerActions(RB_PRESETS.filter(p=>p.kind!=='off').map(p=>({id:'wf.rule.'+p.k,label:p.n,icon:'📐',group:'Véset',
  alias:'szabaly rule jeloles '+p.k+' '+fold(p.sec),hint:'Szabály: '+p.n+' ('+p.sec+')',when:c=>!c.inEditor,run:()=>rbPick(p.k)})).concat([
  // the Jegyzet tool existed (08-interaction, state.mode 'note') but had no action, so nobody could find it
  {id:'mode.note',label:'Jegyzet',icon:'🗒',group:'Eszköz',alias:'note jegyzet megjegyzes',hint:'Kattints a rajzra, és írd be a jegyzetet.',
   when:c=>!c.inEditor,run:()=>{setMode('note');draw();}},
  {id:'ui.dialSide',label:'Tárcsa: bal / jobb sarok',icon:'◑',group:'Nézet',alias:'dial side corner tarcsa sarok bal jobb',
   hint:'Az egyszerű felület tárcsája a bal vagy a jobb alsó sarokban.',run:()=>smSide()}]));

const SM_L=(a,kind,n,i)=>{const o={a,kind:kind||'action'};if(n)o.n=n;if(i)o.i=i;return o;};
const SM_N=(k,n,i,items)=>({k,n,i,items});
SM_TREE={k:'root',n:'Menü',items:[
 SM_N('epulet','Épület','🧱',[
  SM_N('helyisegek','Helyiségek','⬚',[SM_L('mode.room','tool'),SM_L('wf.walls'),SM_L('wf.floors'),SM_L('wf.roomType','tool')]),
  SM_N('nyilaszarok','Nyílászárók','🚪',[SM_L('wf.door','tool','Ajtó'),SM_L('wf.window','tool','Ablak'),SM_L('wf.stairs','tool','Lépcső'),SM_L('pt.place','tool','Portál')]),
  SM_N('szabalyok','Szabályok','📐',[{k:'szabalykeszlet',n:'Szabálykészlet',i:'📐',gen:'rules'},SM_L('wf.routeWalls','tool'),SM_L('wf.standards'),
   SM_N('jeloles','Jelölés','✎',[SM_L('mark.wall','tool'),SM_L('mark.plane','tool'),SM_L('mark.list'),SM_L('room.renumber')]),
   SM_N('igenylista','Igénylista','☑',[SM_L('req.layer','stay'),SM_L('need.room'),SM_L('need.overview'),SM_L('req.house')])]),
  SM_N('szintek','Szintek','☰',[SM_L('level.up','stay','Feljebb'),SM_L('level.down','stay','Lejjebb'),SM_L('drop.settings','action','Álmennyezet'),
   SM_N('falmeres','Fal mozgatása / mérés','📏',[SM_L('mode.wall','tool','Fal rajzolása'),SM_L('mode.grab','tool'),SM_L('mode.measure','tool')]),
   SM_L('slab.level','action','Födém')])]),
 SM_N('villamossag','Villamosság','⚡',[
  SM_N('vegpontok','Végpontok','◉',[SM_L('wf.layer.SOC','stay','Dugaljak'),SM_L('wf.layer.LIGHT','stay','Lámpák + kapcsolók'),SM_L('wf.layer.DED','stay','Dedikált'),
   {k:'mindenvegpont',n:'Minden végpont',i:'⊕',gen:'endpoints'},
   SM_N('mozi','Házimozi','🎬',[SM_L('cinema.layer','stay'),SM_L('cinema.wiring')])]),
  SM_N('kapcsolas','Kapcsolás','🔗',[SM_L('wf.switches','tool','Kapcsolások'),SM_L('wf.switchSuggest','action','Javaslat'),SM_L('wf.ceilLine','tool','Mennyezeti út'),SM_L('wf.floorLine','tool','Padló út')]),
  SM_N('dobozok','Dobozok és körök','▣',[SM_L('wf.boxSzoba','tool','Szobadoboz'),SM_L('wf.boxKot','tool','Kötődoboz'),SM_L('wf.board','tool','Elosztó'),
   SM_N('aramkorok','Áramkörök','⎓',[SM_L('circuit.pick','tool'),SM_L('circuit.presets','action','Áramkör-lista'),SM_L('circuit.new'),SM_L('circuit.export')])]),
  SM_N('palyak','Pályák','〰',[SM_L('mode.path','tool','Pálya'),SM_L('chn.route','tool','Csatorna'),
   SM_N('feltoltes','Feltöltés','⇶',[SM_L('fill.room'),SM_L('fill.all'),SM_L('fill.channel'),SM_L('fill.report'),SM_L('elo.schedule')]),
   SM_N('sinarm','Sín és ARM','⫶',[SM_L('rail.route','tool'),SM_L('arm.route','tool'),SM_L('hw.rbx','tool'),SM_L('hw.serve','tool')])])]),
 SM_N('eszkozok','Eszközök','🛠',[SM_L('edit.undo','stay'),SM_L('edit.redo','stay'),SM_L('edit.delete','action','Kijelölt törlése'),
  SM_N('rajzeszkozok','Rajzeszközök','✏',[SM_L('mode.select','action','Kijelölés'),SM_L('mode.note','tool','Jegyzet'),SM_L('mode.object','tool','Objektum'),SM_L('mode.format','tool','Formátum')])]),
 SM_N('rendszer','Rendszer','⚙',[
  SM_N('nezet','Nézet','👁',[SM_L('view.toggle3d','stay','2D ↔ 3D'),
   SM_N('stilus','Stílus','◐',['plan','blueprint','whiteout','preview','tiszta'].map(s=>SM_L('view.style.'+s,'stay'))),
   SM_N('kamera','Kamera','⌖',['iso','dim','axo','mil','elev','lock'].map(c=>SM_L('view.cam.'+c,'stay')).concat([SM_L('view.reset','stay')])),
   {k:'retegek',n:'Rétegek',i:'≣',gen:'layers'}]),
  SM_N('projekt','Projekt','📁',[SM_L('proj.save','action','Mentés'),{k:'projektek',n:'Projektek',i:'🗂',gen:'projects'},SM_L('proj.new','action','Új projekt'),SM_L('proj.export','action','Exportálás JSON-ba')]),
  SM_N('kimenet','Kimenet','📄',[SM_L('doc.totals','action','Anyagkimutatás'),SM_L('doc.print','action','Nyomtatás / PDF'),SM_L('doc.png','action','Kép (PNG)'),SM_L('view.export.menu','action','Axonometria lap')]),
  SM_N('beallitasok','Beállítások','⚙',[SM_L('ui.normal'),SM_L('ui.dialSide','stay'),SM_L('app.settings','action','Beállítások'),SM_L('check.list','action','Ellenőrzés'),
   {k:'egyeb',n:'Egyéb parancsok',i:'⋯',gen:'other'}])])]};

// ---- generators (built when the node opens, never cached) ----
SM_GEN.rules=()=>{const secs=[];RB_PRESETS.forEach(p=>{if(p.kind==='off')return;let s=secs.find(x=>x.n===p.sec);if(!s)secs.push(s={k:'rb.'+p.sec,n:p.sec,i:'📐',items:[]});
  s.items.push(SM_L('wf.rule.'+p.k,'tool',p.n));});return secs;};
SM_GEN.endpoints=()=>{const by=new Map();ACTIONS.forEach(a=>{const m=/^ep\.place\.(.+)$/.exec(a.id);if(!m)return;const e=epEntry(m[1]);const role=(e&&e.role)||'?';
  if(!by.has(role))by.set(role,[]);by.get(role).push(SM_L(a.id,'tool',m[1]+' — '+String(a.label).replace(/^Végpont:\s*\S+\s*—\s*/,'')));});
  const ord=k=>{const i=STK_ROLES.findIndex(r=>r.k===k);return i<0?999:i;};
  return [...by.keys()].sort((a,b)=>ord(a)-ord(b)).map(k=>{const r=STK_ROLES.find(x=>x.k===k);return {k:'ep.'+k,n:r?r.n:k,i:'◉',items:by.get(k)};});};
SM_GEN.layers=()=>layers.filter(L=>!L.parent).map(L=>({n:L.name||L.id,i:L.id===state.activeLayer?'●':'○',kind:'stay',
  line2:L.id===state.activeLayer?'● aktív':(L.visible===false?'rejtett':''),
  fn:()=>{state.activeLayer=L.id;if(typeof lyrRefresh==='function')lyrRefresh();else renderLayers();draw();}}));
SM_GEN.projects=()=>{const ix=loadProjIndex();return Object.keys(ix).map(id=>Object.assign({id},ix[id])).sort((a,b)=>(b.ts||0)-(a.ts||0))
  .map(p=>({n:p.name||p.id,i:'📄',kind:'action',line2:p.ts?new Date(p.ts).toLocaleDateString('hu-HU'):'',
    fn:()=>{if(confirm('Megnyitod: '+(p.name||p.id)+'? A jelenlegi terv mentve marad.'))loadProject(p.id);}}));};
function smWalk(node,fn,depth,seen){depth=depth||0;seen=seen||new Set();if(depth>8||!node)return;
  const kids=node.gen?(node.gen==='other'?[]:smChildren(node)):(node.items||[]);
  kids.forEach(c=>{if(c.items||c.gen){if(!seen.has(c)){seen.add(c);smWalk(c,fn,depth+1,seen);}}else fn(c);});}
function smReachCurated(){const s=new Set();smWalk(SM_TREE,l=>{if(l.a)s.add(l.a);});return s;}
SM_GEN.other=()=>{const cur=smReachCurated();const g=new Map();ACTIONS.forEach(a=>{if(cur.has(a.id))return;const k=a.group||'Egyéb';if(!g.has(k))g.set(k,[]);g.get(k).push(SM_L(a.id));});
  return [...g.keys()].sort((a,b)=>a.localeCompare(b,'hu-HU')).map(k=>({k:'o.'+k,n:k,i:'⋯',items:g.get(k)}));};
function smReach(){const s=smReachCurated();SM_GEN.other().forEach(n=>n.items.forEach(l=>s.add(l.a)));return s;}

window.SM_TREE_GET=()=>SM_TREE;window.smReach=smReach;window.smReachCurated=smReachCurated;
