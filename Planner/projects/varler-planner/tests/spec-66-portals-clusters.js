// spec-66 — Portals, the Silver Rail, cluster boxes, ideal spots, the Extras layer, preloaded plans (IDEA-003, 2026-10-10)
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','CLA-teszt_v2.vplan.json');
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const D=()=>w.__data,J=o=>JSON.stringify(o);
  // ---- the roles ----
  ok('two new roles: Klaszterpontok before ARM, Extrák és ötletek at the top',(function(){const k=w.STK_ROLES.map(r=>r.k);
    return k.indexOf('cluster')===k.indexOf('arm')-1&&k[k.length-1]==='sys:EXTRA';})());
  ok('the Extras catalogue: 14 provisioned codes on sys:EXTRA, XTT client-requested',(function(){const x=w.EP_CAT.filter(e=>e.role==='sys:EXTRA');
    return x.length===14&&x.every(e=>e.prov&&e.vars.length===2)&&x.find(e=>e.code==='XTT').req===true;})());
  // ---- CLA v2 ----
  const P=JSON.parse(fs.readFileSync(PLAN,'utf8'));w.hardResetWorkspace();w.applyProjectData(P.project);
  const S=w.stkActive()||w.eval('stacks')[0];
  const room=num=>D().floors.find(f=>f.num===num).id,op=id=>D().openings.find(o=>o.id===id);
  ok('the CLA file predates the roles; stkEnsureRole adds both to its stack',(function(){const a=!w.stkLayer(S.id,'cluster');
    const L1=w.stkEnsureRole(S,'cluster'),L2=w.stkEnsureRole(S,'sys:EXTRA');return a&&L1&&L2&&L1.role==='cluster'&&w.stkEnsureRole(S,'cluster')===L1&&S.layers.indexOf(L1.id)>=0;})());
  // ---- door geometry (IDEA-003 §3.2) ----
  const g103=w.ptDoorGeo(op('B103'),room('R06')),g171=w.ptDoorGeo(op('B171'),room('R06')),g109=w.ptDoorGeo(op('B109'),room('R07'));
  ok('B103 → R06: swing face, 824 mm beyond the hinge → nest on the hinge side',g103&&g103.swing&&Math.abs(g103.free-824)<=5&&g103.at==='hinge',g103&&J({s:g103.swing,f:g103.free,a:g103.at}));
  ok('B171 → R06: 163 mm beyond the hinge → H0-3 latch side',g171&&Math.abs(g171.free-163)<=5&&g171.at==='latch',g171&&J({f:g171.free,a:g171.at}));
  ok('B109 → R07: swing face, 443 mm → hinge side',g109&&g109.swing&&Math.abs(g109.free-443)<=5&&g109.at==='hinge',g109&&J({s:g109.swing,f:g109.free,a:g109.at}));
  ok('the nest sits 200 mm from the jamb on the zone centreline, at the rail height (2700 ceiling → 2430)',Math.abs(Math.abs(g103.u-g103.uh)-200)<1&&g103.h===2430&&w.ptRailH(lvl,6000,4000,op('B103'))===2430);
  ok('a door that does not open to the room has no geometry',w.ptDoorGeo(op('B103'),room('R07'))===null);
  // ---- placing portals ----
  const n0=w.ptCandidates(lvl).length;
  const pA=w.ptPlace(g171),pB=w.ptPlace(w.ptDoorGeo(op('B171'),room('R07')));
  ok('two faces of B171 → both PT-D, refs PT and PT2, on the Hardver layer',pA.cls==='PT-D'&&pB.cls==='PT-D'&&pA.ref==='PT'&&pB.ref==='PT2'&&pA.layer===w.stkLayer(S.id,'hw').id);
  ok('a placed face leaves the candidate list',w.ptCandidates(lvl).length===n0-2&&w.ptOf('B171',pA.face)===pA);
  ok('portals are silver nodes; the board is gold; an endpoint is bronze',w.ndTier(pA)==='silver'&&w.ndTier(D().devices.find(d=>d.type==='board'))==='gold'&&w.ndTier(D().devices.find(d=>d.code==='SOC'))==='bronze');
  ok('the portal draws its own symbol (class · tier)',(w.ptSymbol(pA,0,0,1,false)||'').indexOf('PT-D')>=0);
  ok('undo removes the second portal in one step',(function(){w.doUndo();const n=D().devices.filter(d=>d.type==='portal').length;w.doRedo();return n===1;})());
  // ---- the Silver Rail ----
  ok('a path finished with the rail tool on becomes route rail, silver',(function(){const p={id:'Ptest',nodes:[{x:0,y:0},{x:1000,y:0}],sections:[{}]};
    w.RAIL_T.on=true;w.chnPathFinished(p);w.RAIL_T.on=false;return p.route==='rail'&&p.color==='#8c96a0';})());
  // ---- clustering the endpoints already there ----
  const gs=w.clsGroups(lvl);
  ok('CLA v2 has endpoint groups to cluster (same face, same zone, ≤ 300 mm)',gs.length>0&&gs.every(g=>g.members.length>=2),gs.length);
  ok('a group mixing MAINS and SELV gets K3; a pure group of ≤ 3 gets K1',gs.every(g=>{const roles=[...new Set(g.members.map(id=>w.epRoleOf(D().devices.find(d=>d.id===id))))];
    const mixed=roles.some(w.mnsIs)&&roles.some(r=>!w.mnsIs(r));return mixed?g.cls==='K3':(g.members.length<=3?g.cls==='K1':g.cls!=='K1');}));
  const nc=w.clsAutoAll(lvl);
  ok('Klaszterek a végpontokból: one box per group, members hosted, boxes on the cluster layer',nc===gs.length&&w.clsList(lvl).length===nc&&
    w.clsList(lvl).every(c=>w.clsMembers(c).length>=2&&c.layer===w.stkLayer(S.id,'cluster').id&&!c.sec));
  ok('after that no group is left',w.clsGroups(lvl).length===0);
  // ---- secondary boxes on custom spots ----
  const hmi=w.stkLayer(S.id,'sys:HMI');
  const custom=w.epPlace({level:lvl,x:10300,y:3500,h:1500,side:0,mount:'wall'},'THR','sys:HMI');
  const sec=w.__data.devices.find(d=>d.id===custom.host);
  ok('a higher-layer endpoint on a custom spot opens a secondary K1 box and moves into it',sec&&sec.type==='cluster'&&sec.sec&&sec.cls==='K1'&&Math.abs(sec.h-1500)<1,J(sec||null));
  const next=w.epPlace({level:lvl,x:10300,y:3580,h:1450,side:0,mount:'wall'},'PAN','sys:HMI');
  ok('the next endpoint beside it joins that box instead of opening another',next.host===sec.id&&w.clsList(lvl).filter(c=>c.sec).length===1);
  const mains=w.epPlace({level:lvl,x:10300,y:2800,h:300,side:0,mount:'wall'},'SOC','sys:SOC');
  ok('a MAINS endpoint never opens a box',!mains.host);
  ok('an ideal spot (snapped) is not a custom place',(function(){const d=w.epPlace({level:lvl,x:10300,y:5200,h:1500,side:0,mount:'wall',snapped:true},'THR','sys:HMI');return !d.host;})());
  ok('Másodlagos be / ki: off → no box',(function(){w.__state.clsAuto=false;const d=w.epPlace({level:lvl,x:10300,y:4700,h:2200,side:0,mount:'wall'},'CAM','sys:DATA');w.__state.clsAuto=true;return !d.host;})());
  // ---- the device list at a node ----
  const tg1=w.clsTargetG({kind:'node',node:pA},w.epEntry('THR','sys:HMI'));
  ok('placing at a portal: its wall, its face, the code\'s own height, hosted',tg1&&tg1.host===pA.id&&tg1.h===1500&&tg1.side===pA.side&&tg1.mount==='wall');
  const m1=w.epPlace(tg1,'THR','sys:HMI'),tg2=w.clsTargetG({kind:'node',node:pA},w.epEntry('THR','sys:HMI'));
  ok('a second device at the same height takes the next slot along the wall',m1.host===pA.id&&Math.hypot(tg2.x-tg1.x,tg2.y-tg1.y)>80);
  ok('a ceiling code at a node lands 400 mm in front of it at ceiling height',(function(){const g=w.clsTargetG({kind:'node',node:pA},w.epEntry('SEN','sys:SENSOR'));return g&&g.mount==='ceiling'&&g.h>2000&&Math.hypot(g.x-pA.x,g.y-pA.y)>300;})());
  // ---- ideal spots ----
  const LM=w.stkLayer(S.id,'sys:LIGHT');w.__state.activeLayer=LM.id;   // M1: lamps + switches carry the point hints (sockets get bands)
  const im=w.idealSpots(LM,lvl);
  ok('Világítás has ideal spots, every one an endpoint spot of an Erősáram code',im.length>0&&im.every(s=>s.kind==='ep'&&w.epEntry(s.code,'sys:MAINS')),im.length);
  ok('a layer can hide its spots (✦ off) and they are only drawn for the active layer',w.idealShown(LM)&&!w.idealShown(w.stkLayer(S.id,'sys:HMI'))&&(function(){LM.ideal=false;const a=w.idealShown(LM);LM.ideal=true;return !a;})());
  ok('the overlay draws them dashed',w.idealSvg().indexOf('class="ideal"')>=0);
  ok('placing an ideal spot takes it off the list',(function(){const s=im[0],n=w.idealSpots(LM,lvl).length;const d=w.idealPlace(s);return d&&d.code===s.code&&w.idealSpots(LM,lvl).length===n-1;})());
  const LH=w.stkLayer(S.id,'hw');
  ok('Hardver: the ideal spots are the free door faces (portals)',(function(){const s=w.idealSpots(LH,lvl);return s.length===w.ptCandidates(lvl).length&&s.every(x=>x.kind==='portal');})());
  const LX=w.stkLayer(S.id,'sys:EXTRA');
  ok('Extrák: the SmartFrame slots appear at the portal doors (XSP over B103 for R06)',(function(){const s=w.idealSpots(LX,lvl);
    return s.some(x=>x.code==='XSP'&&x.room===room('R06'))&&s.some(x=>x.code==='XTM')&&s.some(x=>x.code==='XDP');})());
  ok('on a swing face the M3 terminal moves to the latch side (H0-2)',(function(){const s=w.idealSpots(LX,lvl).filter(x=>x.code==='XTM'&&x.room===room('R06'));
    return s.some(x=>/kilincs/.test(x.why));})());
  ok('a corner cluster spot for R06 (the L leaves three corners)',(function(){const c=w.clsCornerSpots(lvl).filter(x=>x.room===room('R06'));return c.length>=2&&c.every(x=>x.zone==='high');})());
  ok('no corner cluster spot sits over an opening (≤ 300 mm along its wall)',w.clsCornerSpots(lvl).every(c=>!D().openings.some(o=>o.level===lvl&&w.sugHostWall(lvl,o.x,o.y)===c.r&&
    Math.abs(w.mrkU(c.r,o.x,o.y)-c.u)<(o.w||900)/2+300)));
  // ---- preloaded plans ----
  ok('no preload in a plain build',w.preList().length===0);
  w.VRG_PRELOAD=[{name:'teszt',note:'',project:P.project}];
  ok('a baked-in plan loads and gets the two new layers',w.preLoad(0)&&!!w.stkLayer(w.eval('stacks')[0].id,'cluster')&&!!w.stkLayer(w.eval('stacks')[0].id,'sys:EXTRA'));
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
