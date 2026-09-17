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
 try{
  const lvl='ground';const D=w.__data;
  const reset=()=>{w.newBlankProject();w.__getWalls()[lvl].push({x0:0,y0:0,x1:4000,y1:300});};
  w.confirm=()=>true;w.alert=()=>{};
  reset();

  // ---------- ids ----------
  ok('schema constants',w.SCHEMA_VERSION>=1&&typeof w.ensureIds==='function');
  D.devices.push({type:'socket',ref:'D1',x:600,y:-40,h:300,level:lvl,side:0});
  D.devices.push({type:'switch',ref:'K1',x:2600,y:-40,h:1100,level:lvl,side:0});
  D.paths.push({nodes:[{x:600,y:-40,h:300,level:lvl},{x:2600,y:-40,h:300,level:lvl},{x:2600,y:-40,h:1100,level:lvl}],
    sections:[{build:'sull_gege'},{build:'sull_gege'}]});
  w.ensureIds(D);
  ok('every record gets an id',D.devices.every(d=>!!d.id)&&D.paths.every(p=>!!p.id));
  ok('every path node gets an id',D.paths[0].nodes.every(n=>!!n.id));
  ok('ids are prefixed by kind',/^D\d+$/.test(D.devices[0].id)&&/^P\d+$/.test(D.paths[0].id)&&/^n\d+$/.test(D.paths[0].nodes[0].id),
     D.devices[0].id+' '+D.paths[0].id+' '+D.paths[0].nodes[0].id);
  ok('ids are unique',(function(){const seen={};let dup=0;
    ['devices','paths','floors','objects','openings'].forEach(k=>(D[k]||[]).forEach(r=>{if(seen[r.id])dup++;seen[r.id]=1;}));
    D.paths.forEach(p=>p.nodes.forEach(n=>{if(seen[n.id])dup++;seen[n.id]=1;}));return dup===0;})());
  ok('ensureIds is idempotent',(function(){const before=JSON.stringify(D.devices.map(d=>d.id));
    w.ensureIds(D);w.ensureIds(D);return JSON.stringify(D.devices.map(d=>d.id))===before;})());
  const seqBefore=D.seq;
  D.devices.push({type:'light',x:1,y:1,h:0,level:lvl});w.ensureIds(D);
  ok('the counter only ever moves forward',D.seq>seqBefore);
  ok('ids are never reissued after a delete',(function(){const gone=D.devices.pop().id;
    D.devices.push({type:'light',x:2,y:2,h:0,level:lvl});w.ensureIds(D);
    return D.devices[D.devices.length-1].id!==gone;})());
  D.devices.pop();

  // ---------- lookups ----------
  const p0=D.paths[0];
  ok('byId / pathById',w.pathById(p0.id)===p0&&w.byId('devices',D.devices[0].id)===D.devices[0]);
  ok('nodeById',w.nodeById(p0.id,p0.nodes[1].id)===p0.nodes[1]);
  ok('missing ids resolve to null, not a wrong object',w.pathById('P9999')===null&&w.byId('devices','nope')===null);

  // ---------- links by id ----------
  w.setLink(D.devices[0],p0.id,p0.nodes[0].id);
  ok('setLink stores ids',D.devices[0].link.p===p0.id&&D.devices[0].link.n===p0.nodes[0].id);
  ok('linkTarget resolves both ends',(function(){const t=w.linkTarget(D.devices[0]);
    return t&&t.path===p0&&t.node===p0.nodes[0]&&t.ni===0;})());
  ok('linkLabel is human readable',w.linkLabel(D.devices[0])===p0.id+'/'+p0.nodes[0].id);
  // THE bug class this phase removes: a splice used to repoint someone else's reference
  ok('inserting a path ahead does NOT repoint the link',(function(){
    D.paths.unshift({nodes:[{x:0,y:0,h:0,level:lvl},{x:9,y:0,h:0,level:lvl}],sections:[{build:'sull_gege'}]});
    w.ensureIds(D);const t=w.linkTarget(D.devices[0]);
    const good=t&&t.path===p0;D.paths.shift();return good;})());
  ok('deleting the target leaves a dangling link that resolves to null',(function(){
    const keep=JSON.parse(JSON.stringify(D.devices[0].link));
    const ix=D.paths.indexOf(p0);D.paths.splice(ix,1);
    const t=w.linkTarget(D.devices[0]);D.paths.splice(ix,0,p0);D.devices[0].link=keep;
    return t===null;})());
  ok('pruneLinks clears only the dangling ones',(function(){
    w.setLink(D.devices[1],p0.id,p0.nodes[2].id);
    D.devices[0].link={p:'P9999',n:'n9999'};
    w.pruneLinks();
    return !D.devices[0].link&&!!D.devices[1].link;})());
  w.setLink(D.devices[0],p0.id,p0.nodes[0].id);
  ok('the old index-repair function is now a one-liner',typeof w.wvRelinkAfterPathRemoval==='function');

  // ---------- migration ----------
  ok('an old (v0) file converts index links to id links',(function(){
    const old={v:0,seq:0,noteHide:{},cables:[],notes:[],measures:[],openings:[],floors:[],objects:[],roofs:[],wallNotes:[],
      devices:[{type:'socket',ref:'D1',x:1,y:2,h:300,level:lvl,link:{pi:1,ni:1}}],
      paths:[{nodes:[{x:0,y:0,h:0,level:lvl},{x:1,y:0,h:0,level:lvl}],sections:[{build:'sull_gege'}]},
             {nodes:[{x:5,y:5,h:0,level:lvl},{x:6,y:6,h:0,level:lvl}],sections:[{build:'sull_gege'}]}]};
    w.migrate(old);
    const dv=old.devices[0],target=old.paths[1].nodes[1];
    return old.v===w.SCHEMA_VERSION&&dv.link.p===old.paths[1].id&&dv.link.n===target.id;})());
  ok('a v0 link pointing at nothing is dropped, not left broken',(function(){
    const old={v:0,devices:[{type:'socket',x:1,y:1,h:0,level:lvl,link:{pi:7,ni:0}}],paths:[],
      cables:[],notes:[],measures:[],openings:[],floors:[],objects:[],roofs:[],wallNotes:[]};
    w.migrate(old);return !old.devices[0].link;})());
  ok('migration is idempotent',(function(){
    const o={v:0,devices:[{type:'socket',x:1,y:1,h:0,level:lvl}],paths:[],cables:[],notes:[],measures:[],
      openings:[],floors:[],objects:[],roofs:[],wallNotes:[]};
    w.migrate(o);const a=JSON.stringify(o);w.migrate(o);return JSON.stringify(o)===a;})());
  ok('a current file passes through unchanged',(function(){
    const cur=JSON.parse(JSON.stringify(w.sessionObj().data));const a=JSON.stringify(cur);
    w.migrate(cur);return JSON.stringify(cur)===a;})());

  // ---------- persistence + undo carry ids ----------
  ok('the session carries ids, version and counter',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.data.v===w.SCHEMA_VERSION&&so.data.seq>0&&so.data.devices[0].id&&so.data.paths[0].nodes[0].id;})());
  ok('undo preserves ids',(function(){const before=D.devices[0].id;
    w.pushUndo();D.devices[0].x=9999;w.doUndo();
    return D.devices[0].id===before&&D.devices[0].x!==9999;})());
  ok('undo cannot resurrect a used id',(function(){const before=D.seq;
    w.pushUndo();D.devices.push({type:'light',x:3,y:3,h:0,level:lvl});w.ensureIds(D);
    const used=D.seq;w.doUndo();return D.seq>=used&&used>before;})());
  ok('a link survives a save/load round trip',(function(){
    const so=JSON.parse(JSON.stringify(w.sessionObj()));
    w.applyProjectData(so);
    const dv=w.__data.devices.find(d=>d.link);return !!dv&&!!w.linkTarget(dv);})());

  // ---------- connectivity seam ----------
  const g=w.connectivity();
  ok('graph lists terminals',Array.isArray(g.terminals)&&g.terminals.length===w.__data.devices.length);
  ok('graph lists one segment per drawn span',(function(){
    const spans=w.__data.paths.reduce((n,p)=>n+Math.max(0,p.nodes.length-1),0);
    return g.segments.length===spans;})(),'segments='+g.segments.length);
  ok('segments reference nodes by id and carry the conduit',(function(){const s=g.segments[0];
    return /^P\d+:\d+$/.test(s.id)&&/^n\d+$/.test(s.a)&&/^n\d+$/.test(s.b)&&s.dia>0&&s.len>0;})(),
     JSON.stringify(g.segments[0]||{}).slice(0,90));
  ok('a linked device is attached to its node',(function(){
    const dv=w.__data.devices.find(d=>d.link);if(!dv)return false;
    const key=dv.link.p+'/'+dv.link.n;return (g.at[key]||[]).includes(dv.id);})());
  ok('coincident devices attach without an explicit link',(function(){
    const p=w.__data.paths[0],n=p.nodes[p.nodes.length-1];
    w.__data.devices.push({type:'junction',ref:'KDx',x:n.x,y:n.y,h:n.h,level:n.level});
    w.ensureIds(w.__data);const g2=w.connectivity();
    const key=p.id+'/'+n.id;const hit=(g2.at[key]||[]).length>0;w.__data.devices.pop();return hit;})());
  ok('the graph is derived, never stored',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.data.terminals===undefined&&so.data.segments===undefined;})());

  // ---------- validation seam ----------
  ok('a healthy document has no errors',w.validateSummary().error===0,JSON.stringify(w.validateSummary()));
  ok('a dangling link is a warning',(function(){w.__data.devices[0].link={p:'P9999',n:'n1'};
    const v=w.validateSummary();const hit=v.issues.some(i=>i.code==='link.dangling');
    w.pruneLinks();return hit&&v.warn>0;})());
  ok('a stub path is an error',(function(){w.__data.paths.push({id:'Pzz',nodes:[{x:0,y:0,h:0,level:lvl}],sections:[]});
    const v=w.validateSummary();const hit=v.issues.some(i=>i.code==='path.stub');
    w.__data.paths.pop();return hit;})());
  ok('a section-count mismatch is an error',(function(){
    w.__data.paths.push({id:'Pyy',nodes:[{x:0,y:0,h:0,level:lvl},{x:1,y:0,h:0,level:lvl}],sections:[]});
    const hit=w.validate().some(i=>i.code==='path.sections');w.__data.paths.pop();return hit;})());
  ok('a duplicate id is an error',(function(){const d0=w.__data.devices[0];
    w.__data.devices.push({id:d0.id,type:'socket',x:0,y:0,h:0,level:lvl});
    const hit=w.validate().some(i=>i.code==='id.duplicate');w.__data.devices.pop();return hit;})());
  ok('an unknown level is an error',(function(){w.__data.devices.push({id:'Dzz',type:'socket',x:0,y:0,h:0,level:'nonsense'});
    const hit=w.validate().some(i=>i.code==='level.unknown');w.__data.devices.pop();return hit;})());
  ok('issues carry severity, code and a reference',(function(){w.__data.paths.push({id:'Pqq',nodes:[],sections:[]});
    const i=w.validate().find(x=>x.code==='path.stub');w.__data.paths.pop();
    return i&&i.sev==='error'&&i.ref==='Pqq'&&typeof i.msg==='string';})());

  // ---------- X4: the background image can be positioned ----------
  w.__state.bg={src:'data:image/png;base64,iVBORw0KGgo=',w:14600,h:8000,x:0,y:0,opacity:0.5,visible:true};
  ok('background renders',/<image/.test(w.bgSvg()));
  ok('offset moves it',(function(){const a=w.bgSvg();w.__state.bg.x=2000;const b=w.bgSvg();
    w.__state.bg.x=0;return a!==b;})());
  ok('rotation is supported',(function(){w.__state.bg.rot=90;const r=w.bgSvg();w.__state.bg.rot=0;
    return /rotate\(90 /.test(r);})());
  w.bgSettings();
  ok('the dialog exposes position, size, rotation and fit',!!$('bgX')&&!!$('bgY')&&!!$('bgW')&&!!$('bgR')&&!!$('bgFit')&&!!$('bgR90'));
  ok('fields apply live, without pressing OK',(function(){
    $('bgX').value='1500';$('bgX').oninput();
    return w.__state.bg.x===1500;})(),'x='+w.__state.bg.x);
  ok('+90° button rotates',(function(){$('bgR90').onclick();return w.__state.bg.rot===90;})());
  ok('width keeps the aspect ratio',(function(){const r=w.__state.bg.h/w.__state.bg.w;
    $('bgW').value='7300';$('bgW').oninput();
    return Math.abs(w.__state.bg.h/w.__state.bg.w-r)<0.01;})());
  ok('fit-to-drawing uses the wall extents',(function(){$('bgFit').onclick();
    return w.__state.bg.w===4000&&w.__state.bg.x===0;})(),w.__state.bg.w+'/'+w.__state.bg.x);
  ok('cancel restores the original',(function(){$('mCancel').onclick();
    return w.__state.bg.x===0&&w.__state.bg.w===14600&&(w.__state.bg.rot||0)===0;})(),JSON.stringify({x:w.__state.bg.x,w:w.__state.bg.w,r:w.__state.bg.rot}));
  ok('a new project clears the background',(function(){w.newBlankProject();return !w.__state.bg;})());

  // ---------- regressions ----------
  reset();
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: editors',(function(){try{w.openWallView(w.__getWalls()[lvl][0],lvl);w.wvCloseEditor(true);
    w.openPlaneView({name:'X',poly:[[0,0],[3000,0],[3000,3000],[0,3000]]},lvl,'floor');w.wvCloseEditor(true);
    return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: blueprint',(function(){try{w.__state.style='blueprint';w.__state.pitch=90;const q=w.drawBlueprintGeom();
    w.__state.style='plan';w.__state.pitch=30;return q.length>50;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: version stamp',w.VERSION&&/^\d+\.\d+\.\d+$/.test(w.VERSION),w.VERSION);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},700);
