// spec-46 — room needs per system layer and placement suggestions (WP-D2, D3)
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
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const D=()=>w.__data,J=o=>JSON.stringify(o);
  // ---- D2: kinds and defaults (pure) ----
  ok('Fürdőszoba is a bathroom, not a bedroom',w.needKind({name:'Fürdőszoba'})==='furdo');
  ok('ÉTKEZŐ folds to etkezo',w.needKind({name:'ÉTKEZŐ'})==='etkezo');
  ok('the Rendeltetés field wins over the name',w.needKind({use:'hálószoba',name:'R07'})==='halo');
  ok('mosókonyha is technical, not a kitchen',w.needKind({use:'mosókonyha'})==='gepeszet');
  ok('rm.kind overrides everything',w.needKind({kind:'wc',name:'NAPPALI'})==='wc');
  ok('a WC: MAINS LMP+SWI only, nothing on MEDIA',J(w.needDefaults({name:'WC'},'sys:MAINS').codes)==='["LMP","SWI"]'&&w.needDefaults({name:'WC'},'sys:MEDIA').codes.length===0);
  ok('a living room inherits * for MAINS and has its own MEDIA list',J(w.needDefaults({name:'Nappali'},'sys:MAINS').codes)==='["LMP","SWI","SOC"]'&&J(w.needDefaults({name:'Nappali'},'sys:MEDIA').codes)==='["SPK","SCR","AVP"]');
  // ---- fixture: one 4000 × 3000 room ----
  w.newBlankProject();const WA=w.__getWalls()[lvl];
  WA.push({x0:-50,y0:-50,x1:4050,y1:50},{x0:-50,y0:2950,x1:4050,y1:3050},{x0:-50,y0:-50,x1:50,y1:3050},{x0:3950,y0:-50,x1:4050,y1:3050});
  D().floors.push({level:lvl,name:'NAPPALI',num:'1.04',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  D().openings.push({type:'door',level:lvl,x:2000,y:3000,ang:0,w:900,variant:0},{type:'window',level:lvl,x:2000,y:0,ang:0,w:1200});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const rm=D().floors[0],K=rm.id,door=D().openings[0],win=D().openings[1];
  const S=w.stkCreate({name:'N'}),L=r=>w.stkLayer(S.id,r).id;
  const mark=(o)=>{w.mrkList().push(Object.assign({level:lvl,layer:L('mark'),pol:'none',tags:[]},o));w.ensureIds(D());};
  mark({kind:'opening',op:win.id,tags:['redony']});mark({kind:'opening',op:door.id,tags:['portal','p2']});
  ok('derived: a window tagged redony → SHU on MAINS (marked derived)',w.needDefaults(rm,'sys:MAINS').derived.indexOf('SHU')>=0);
  ok('derived: a door tagged p2 → POR on CONTROL and SENSOR; portal → NTL',w.needOf(rm,'sys:CONTROL').POR&&w.needOf(rm,'sys:SENSOR').POR&&w.needOf(rm,'sys:BUSB').NTL);
  const put=(code,role,x,y,side)=>{role=(role==='sys:MAINS')?w.mnsRoleOf(code):role;const en=w.epEntry(code,role);return w.epPlace({level:lvl,x,y,h:en.h||2700,mount:en.mount,side:en.mount==='wall'?(side==null?1:side):undefined},code,role);};
  put('LMP','sys:MAINS',2000,1500);put('SWI','sys:MAINS',2600,3000,0);
  ok('Erősáram with LMP+SWI but no SOC/SHU: Világítás misses SHU, Dugaljak misses SOC',(function(){const S=w.needRoomSummary(rm),l=S.find(x=>x.role==='sys:LIGHT'),o=S.find(x=>x.role==='sys:SOC');
    return l.status==='open'&&J(l.missing)==='["SHU"]'&&o.status==='open'&&J(o.missing)==='["SOC"]';})());
  put('SOC','sys:MAINS',0,1000,1);put('SHU','sys:MAINS',2000,0,1);
  ok('…and done once SOC and SHU exist',w.needStatus(rm,'sys:LIGHT')==='done'&&w.needStatus(rm,'sys:SOC')==='done');
  ok('a device of that code on the WRONG layer does not count',(function(){const d=D().devices.find(x=>x.code==='SOC');d.layer=L('sys:DATA');const st=w.needStatus(rm,'sys:SOC');d.layer=L('sys:SOC');return st==='open';})());
  ok('needSet stores a full object; undo restores the defaults',(function(){w.needSet(rm,'sys:LIGHT','SWI',false);const a=rm.needs&&rm.needs['sys:LIGHT']&&rm.needs['sys:LIGHT'].LMP===true&&!rm.needs['sys:LIGHT'].SWI;
    w.doUndo();const r2=D().floors[0];return a&&!(r2.needs&&r2.needs['sys:LIGHT']);})());
  const rm2=()=>D().floors[0];
  ok('a saved layer ignores later default changes',(function(){w.needSet(rm2(),'sys:LV','LNR',true);const before=J(w.needOf(rm2(),'sys:LV'));
    w.NEED_DEFAULTS.nappali['sys:LV']=['UEP'];const after=J(w.needOf(rm2(),'sys:LV'));w.NEED_DEFAULTS.nappali['sys:LV']=['LNR','UEP'];return before===after;})());
  ok('needNextRole = the first open system layer in stack order',w.needNextRole(rm2())==='sys:LV');
  ok('MAINS-stage checks list what a room is missing',(function(){const c=w.stkCheck(S,'sys:LV');return c.some(x=>/hiányzik/.test(x.msg));})());
  ok('needReport is plain JSON with one entry per room',(function(){const r=w.needReport();return r.length===1&&r[0].room.kind==='nappali'&&J(JSON.parse(J(r)))===J(r);})());
  ok('the room menu offers the checklist',(function(){const it=w.roomMenuItems({rm:rm2(),src:'F',i:0,level:lvl});return it.some(x=>/Helyiség igényei/.test(x.label));})());
  ok('the checklist dialog renders a row per system layer',(function(){w.needDialog(rm2());const n=w.document.querySelectorAll('.ndC').length;w.eval('closeModal()');return n>20;})());
  // ---- D3: suggestions ----
  const bottom=WA[1],left=WA[2],right=WA[3],top=WA[0];
  const ptOf=(code,role)=>w.sugFor(code,role,K).filter(h=>h.kind==='pt');
  ok('SWI: on the room face of the door wall, 150 mm beyond the FAR jamb (hinge at the start)',(function(){const p=ptOf('SWI','sys:MAINS');return p.length===1&&p[0].x===2600&&p[0].y===3000&&p[0].h===1100&&p[0].side===-1&&p[0].wall===bottom.id;})(),J(ptOf('SWI','sys:MAINS')));
  ok('…and beyond the START jamb when the hinge is at the far jamb (variant 2)',(function(){door.variant=2;const p=ptOf('SWI','sys:MAINS');door.variant=0;return p[0].x===1400;})());
  ok('SHU: above the window head (900 + 1500 + 100)',(function(){const p=ptOf('SHU','sys:MAINS');return p.length===1&&p[0].x===2000&&p[0].y===0&&p[0].h===2500;})(),J(ptOf('SHU','sys:MAINS')));
  ok('POR: on the lintel of a P-2 door',(function(){const p=ptOf('POR','sys:SENSOR');return p.length===1&&p[0].x===2000&&p[0].h===2150;})());
  mark({kind:'side',wall:left.id,side:1,pol:'plus',tags:['lforma','media']});
  ok('SPK: a pair parallel to the media wall at 1/3 depth — (1333, 750) and (1333, 2250)',(function(){const p=ptOf('SPK','sys:MEDIA');return p.length===2&&p[0].x===1333&&p[0].y===750&&p[1].y===2250;})(),J(ptOf('SPK','sys:MEDIA').map(p=>[p.x,p.y])));
  ok('SEN: the corner diagonal to the door, 300 mm in',(function(){const p=ptOf('SEN','sys:SENSOR');return p.length===1&&p[0].x===212&&p[0].y===212&&p[0].h===2200;})(),J(ptOf('SEN','sys:SENSOR')));
  ok('SOC: the L-forma face comes first',(function(){const b=w.sugFor('SOC','sys:MAINS',K).filter(h=>h.kind==='band');return b.length&&b[0].why==='L-forma'&&b[0].wall===left.id;})());
  w.trcList().push({level:lvl,plane:'floor',mode:'line45',pts:[[3700,200],[3700,2800]],a:null,b:null,dir:1,tags:['ejszakai'],layer:L('mark')});w.ensureIds(D());
  ok('night trace: leg lights along the right wall at h 300',(function(){const p=ptOf('LMP','sys:BUSB');return p.length===2&&p.every(q=>q.x===4000&&q.h===300&&q.side===-1);})(),J(ptOf('LMP','sys:BUSB')));
  ok('THR: the longest inner face with no window',(function(){const p=ptOf('THR','sys:HMI');return p.length===1&&p[0].h===1500&&p[0].wall!==top.id;})());
  const g0={level:lvl,x:2400,y:3000,h:1100,side:0,wall:bottom.id,u:2450,wallSide:-1,mount:'wall'};
  ok('soft snap: 200 mm from the hint → onto it, with the reason',(function(){const g=w.sugSnap(g0,'SWI','sys:MAINS');return g.snapped&&g.x===2600&&/Kilincs/.test(g.why);})());
  ok('…400 mm away → no snap',!w.sugSnap(Object.assign({},g0,{x:2200,u:2250}),'SWI','sys:MAINS').snapped);
  ok('…suggestions off → no snap',(function(){w.__state.sugOn=false;const g=w.sugSnap(g0,'SWI','sys:MAINS');w.__state.sugOn=true;return !g.snapped;})());
  ok('soft snap on a band sets only the height (left face, dugalj default 150–450)',(function(){const g=w.sugSnap({level:lvl,x:0,y:1500,h:300,side:1,wall:left.id,u:1550,wallSide:1,mount:'wall'},'SOC','sys:MAINS');return g.snapped&&g.h===300&&g.x===0;})());
  mark({kind:'wall',wall:top.id,pol:'ban',tags:['tartofal']});
  ok('avoid: a tartófal wall is a red cover for any code',w.sugFor('SOC','sys:MAINS',K).some(h=>h.kind==='cover'&&h.pol==='ban'&&h.wall===top.id));
  ok('the overlay draws the hints while placing',(function(){w.EP_T.on=true;w.EP_T.code='SWI';w.EP_T.role='sys:MAINS';w.EP_T.g=g0;const s=w.sugOverlaySvg();w.EP_T.on=false;w.EP_T.g=null;return /<circle/.test(s)&&/stroke-width="5"/.test(s);})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
