// spec-40 — hardware nodes, RBX room serving, BASE placement (WP-C1, C2, C4)
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
  const D=()=>w.__data,S=()=>w.__state;
  // two rooms A | B sharing a 100 mm partition at x=4000; outer walls 100 mm on the centrelines
  const fixture=()=>{w.newBlankProject();const WA=w.__getWalls()[lvl];
    WA.push({x0:-50,y0:-50,x1:8050,y1:50},{x0:-50,y0:3950,x1:8050,y1:4050},{x0:-50,y0:-50,x1:50,y1:4050},{x0:7950,y0:-50,x1:8050,y1:4050},
            {x0:3950,y0:50,x1:4050,y1:3950});
    D().floors.push({level:lvl,name:'NAPPALI',num:'1.03',poly:[[0,0],[4000,0],[4000,4000],[0,4000]]},
                    {level:lvl,name:'HÁLÓ',num:'1.04',poly:[[4000,0],[8000,0],[8000,4000],[4000,4000]]});
    w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');w.draw();};
  fixture();
  const A=()=>D().floors[0].id,B=()=>D().floors[1].id;
  const part=()=>w.__getWalls()[lvl][4];

  // ---- C1 types ----
  ok('DEV knows the hardware types',w.eval('DEV').rbx==='RoomBox (RBX)'&&w.eval('DEV').base==='BASE');
  ok('hardware is in the Eszközök sub-layer',w.lyrDevCat({type:'rbx'})==='device'&&w.lyrDevCat({type:'meter'})==='device');
  // an RBX on the partition, facing A (x < 4000)
  const g=w.hwGhostAt('rbx',lvl,3900,2000);
  ok('a ghost on the partition faces the pointer side',!!g&&g.wall===part().id&&g.side===0&&g.x===3950&&g.y===2000,JSON.stringify(g));
  const rbx=w.hwPlace(g);
  ok('the RBX is placed at h 2150 with class RB-M',rbx&&rbx.type==='rbx'&&rbx.h===2150&&rbx.rb==='RB-M');
  ok('its ref is keyed to the room it faces (1.03 → RBX03)',rbx.ref==='RBX03',rbx.ref);
  const box=w.hwBox(rbx);
  ok('the derived 3D box is 400×500×110, bottom at 1900',box.w===400&&box.ht===500&&box.d===110&&box.z===1900);
  ok('the box is recessed into the partition, front 10 mm proud of the face',Math.abs(box.x-(3950+55-10))<0.01,box.x);
  const sceneHas=s=>{w.draw();const sc=(w.document.querySelector('#vp')||w.document.body).innerHTML;return sc.indexOf(s)>=0;};
  ok('plan symbol shows RBX and RB-M',sceneHas('>RBX<')&&sceneHas('>RB-M<'));
  ok('the box follows the device: move it, the box moves',(function(){rbx.y=1500;const b=w.hwBox(rbx);rbx.y=2000;return Math.abs(b.y-1500)<0.01;})());
  // strip preference
  w.mrkList().push({kind:'vstrip',level:lvl,wall:part().id,side:-1,u0:2850,u1:3150,pol:'plus',tags:['rbx'],layer:'L0'});w.ensureIds(D());
  const g2=w.hwGhostAt('rbx',lvl,3900,2700);
  ok('a vstrip tagged rbx within 400 mm attracts the ghost to its centre',g2.snapped&&Math.abs(g2.u-3000)<1&&g2.y===3050,JSON.stringify([g2.u,g2.y]));
  const g3=w.hwGhostAt('rbx',lvl,3900,1000);
  ok('…but not from 2000 mm away',!g3.snapped);
  // ban mark
  w.mrkList().push({kind:'wall',level:lvl,wall:part().id,pol:'ban',tags:['tartofal'],layer:'L0'});w.ensureIds(D());
  ok('a ban mark under the ghost is reported',w.hwGhostAt('rbx',lvl,3900,1000).ban.length===1);
  ok('the hw check warns about a box on a ban mark',w.stkCheck({id:'x'},'hw').some(c=>c.sev==='warn'&&/tilos/.test(c.msg)));
  w.mrkList().splice(0,w.mrkList().length);

  // ---- C2 serving ----
  ok('hwAutoServes = [A, B], front first',JSON.stringify(w.hwAutoServes(rbx))===JSON.stringify([A(),B()]));
  ok('hwServes resolves both rooms to this RBX',w.hwServes(rbx).length===2&&w.hwRoomRbx(B())===rbx);
  const r2=w.hwPlace(w.hwGhostAt('rbx',lvl,7900,2000));       // a second RBX on the right outer wall, facing B
  ok('an outer-wall RBX serves only its own room',JSON.stringify(w.hwAutoServes(r2))===JSON.stringify([B()]));
  ok('a box FACING a room beats a box BEHIND its wall',w.hwRoomRbx(B())===r2&&w.hwServes(rbx).join()===A());
  ok('no room is unserved',w.hwUnserved(lvl).length===0);
  // pick mode
  w.hwServePick(rbx);const u0=w.eval('undo.length');
  ok('pick: toggling B onto RBX03 moves it (confirm) and makes both lists explicit',w.hwServeToggle(B())&&w.hwRoomRbx(B())===rbx&&Array.isArray(rbx.serves)&&Array.isArray(r2.serves)&&r2.serves.length===0);
  ok('pick: the first toggle pushed exactly one undo step',w.eval('undo.length')===u0+1);
  ok('pick: toggling B again removes it',w.hwServeToggle(B())&&w.hwRoomRbx(B())===null&&w.hwUnserved(lvl).length===1);
  w.doUndo();
  ok('one undo restores the automatic lists',rbx.serves===null||rbx.serves===undefined?true:(w.__data.devices.find(d=>d.ref==='RBX03').serves==null));
  w.eval('HW_SP=null');
  const rbxN=()=>D().devices.find(d=>d.ref==='RBX03');
  ok('equal manual claims on one room are an error',(function(){rbxN().serves=[B()];const r=D().devices.find(d=>d.type==='rbx'&&d!==rbxN());r.serves=[B()];
    const bad=w.stkCheck({id:'x'},'hw').some(c=>c.sev==='error'&&/két RBX/.test(c.msg));rbxN().serves=null;r.serves=null;return bad;})());
  ok('the overlay shows the coverage of a selected RBX (clipPath per face)',(function(){w.eval("selected={t:'devices',i:"+D().devices.indexOf(rbxN())+"}");const s=w.hwOverlaySvg();w.eval('selected=null');return /hwcv-sel/.test(s)&&/fill-opacity="0.10"/.test(s);})());
  ok('an unserved room is hatched while the Hardver stage is active',(function(){const S0=w.stkCreate({name:'T'});w.__state.activeLayer=w.stkLayer(S0.id,'hw').id;
    D().devices.filter(d=>d.type==='rbx').forEach(d=>{d.serves=[];});const s=w.hwOverlaySvg();D().devices.filter(d=>d.type==='rbx').forEach(d=>{d.serves=null;});return /hwhatch/.test(s);})());
  ok('a new RBX lands on the stack Hardver layer',(function(){const d=w.hwPlace(w.hwGhostAt('rbx',lvl,100,1000));return d.layer===w.stkLayer(w.stkActive().id,'hw').id;})());
  ok('device menu offers RB classes and room assignment',(function(){const it=[];w.deviceExtraItems(D().devices.indexOf(rbxN()),it);
    return it.some(x=>/RB osztály: RB-H/.test(x.label))&&it.some(x=>/Helyiségek hozzárendelése/.test(x.label));})());

  // ---- C4 BASE ----
  fixture();
  w.HW_T.units=['NET','COMP'];
  const b1=w.hwPlace(w.hwGhostAt('base',lvl,100,3000));
  ok('a BASE with NET+COMP: units, ref and floor-standing height',JSON.stringify(b1.units)==='["NET","COMP"]'&&b1.ref==='BASE'&&b1.h===600,JSON.stringify([b1.units,b1.h]));
  ok('the unit picker then offers only MEDIA',JSON.stringify(Object.keys(w.hwBasePlaced()))==='["NET","COMP"]');
  ok('a unit cannot be in two BASE devices',w.hwSetUnits(b1,['NET','COMP','MEDIA'])===true&&(function(){w.HW_T.units=['MEDIA'];const b2=w.hwPlace(w.hwGhostAt('base',lvl,100,1000));
    const r=w.hwSetUnits(b2,['NET']);D().devices.splice(D().devices.indexOf(b2),1);return r===false;})());
  w.hwSetUnits(b1,['NET','COMP']);
  const rule=(d,k)=>w.hwBaseRules(d).find(r=>r.k===k);
  ok('dry rule: a wet room is an error',(function(){D().floors[0].env='vizes';const r=rule(b1,'dry');D().floors[0].env='';return r.ok===false&&r.sev==='error'&&rule(b1,'dry').ok;})());
  const el=w.hwPlace(w.hwGhostAt('board',lvl,1000,100));
  ok('the Elosztószekrény is placed through the same tool (board type, autoObj)',el.type==='board'&&el.autoObj===true&&el.h===2000);
  ok('board rule: 7 m ok, 9 m warn',(function(){el.x=100;el.y=3000-7000;const a=rule(b1,'board').ok;el.y=3000-9000;const b=rule(b1,'board');el.x=1000;el.y=0;return a&&!b.ok&&b.sev==='warn';})());
  ok('column rule: MEDIA 1.5 m away warns, 0.8 m is fine',(function(){w.HW_T.units=['MEDIA'];const m=w.hwPlace(w.hwGhostAt('base',lvl,100,1500));
    const far=!rule(b1,'column').ok;m.y=2200;const near=rule(b1,'column').ok;return far&&near;})());
  ok('base checks list a missing unit when one is absent',(function(){const m=D().devices.find(d=>d.type==='base'&&d.units[0]==='MEDIA');const i=D().devices.indexOf(m);D().devices.splice(i,1);
    const c=w.stkCheck({id:'x'},'base').some(x=>/MEDIA hiányzik/.test(x.msg));D().devices.splice(i,0,m);return c;})());
  ok('the BASE guide draws rings and the level centre',/stroke-dasharray="6 4"/.test(w.hwBaseGuideSvg(b1))&&/#7a5cc0/.test(w.hwBaseGuideSvg(b1)));
  ok('golden safety: a project without hardware has no stack boxes',(function(){w.newBlankProject();return w.stkBoxes().length===0;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
