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
  w.newBlankProject();
  const D=w.__data,WA=w.__getWalls()[lvl];
  WA.push({x0:0,y0:2950,x1:4000,y1:3050});      // horizontal wall, centreline y=3000, between A and B
  WA.push({x0:-50,y0:0,x1:50,y1:3000});         // vertical wall, centreline x=0, A's west side
  D.floors.push({level:lvl,name:'NAPPALI',num:'1.02',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  D.floors.push({level:lvl,name:'HÁLÓ',num:'1.03',poly:[[0,3000],[4000,3000],[4000,6000],[0,6000]]});
  const add=o=>{D.devices.push(Object.assign({level:lvl,h:300,layer:'L0',side:0},o));w.ensureIds(D);return D.devices[D.devices.length-1];};
  // a row of three on A's face of the shared wall, the first two already clipped by hand
  const s1=add({type:'socket',ref:'D1',x:1000,y:2950,clip:'clipX'});
  const s2=add({type:'socket',ref:'D2',x:1140,y:2950,clip:'clipX'});
  const s3=add({type:'socket',ref:'D3',x:1290,y:2950});
  const lone=add({type:'socket',ref:'D4',x:2000,y:2950});                         // 710 mm away — not a neighbour
  const sw=add({type:'switch',ref:'K1',x:1070,y:2950,h:1100});                   // above the row
  const other=add({type:'socket',ref:'D5',x:1210,y:2950,layer:'Lnew'});           // same spot, another layer
  const back=add({type:'socket',ref:'D6',x:1070,y:3050,side:1});                 // the far face — room B
  const sw2=add({type:'switch',ref:'K2',x:1440,y:2950});                         // same height, other type
  const six=[500,640,780,920,1060,1200].map((y,k)=>add({type:'socket',ref:'W'+(k+1),x:50,y}));
  // a ceiling route with a node straight above D1, and a node linked to D3
  D.paths.push({ptype:'mbcu',layer:'L0',nodes:[{level:lvl,x:1000,y:2950,h:2700},{level:lvl,x:1000,y:1500,h:2700}],sections:[{build:'sull_gege',circuit:null}]});
  D.paths.push({ptype:'mbcu',layer:'L0',nodes:[{level:lvl,x:1290,y:2950,h:300},{level:lvl,x:1290,y:2000,h:300}],sections:[{build:'sull_gege',circuit:null}]});
  w.ensureIds(D);
  const P0=D.paths[0],P1=D.paths[1];s3.link={p:P1.id,n:P1.nodes[0].id};
  w.draw();
  const A={rm:D.floors[0],src:'F',i:0,level:lvl},B={rm:D.floors[1],src:'F',i:1,level:lvl};
  const rowOf=(plan,d)=>plan.rows.find(r=>r.idx.indexOf(D.devices.indexOf(d))>=0);

  // ---------- planning ----------
  let plan=w.planAutoClip([A]);
  const r1=rowOf(plan,s1);
  ok('the three neighbours form one row',r1&&r1.idx.length===3&&rowOf(plan,s3)===r1);
  ok('a box 710 mm away stays out',!rowOf(plan,lone));
  ok('a switch at another height is not in the socket row',!rowOf(plan,sw));
  ok('a box on another layer is not in the row',!rowOf(plan,other));
  ok('a box on the far face belongs to the other room',!rowOf(plan,back)&&!w.planAutoClip([B]).rows.length);
  ok('a switch at the same height needs "vegyes"',!rowOf(plan,sw2)&&(function(){const p=w.planAutoClip([A],{sameType:false});
    const r=rowOf(p,s1);return r&&r.idx.indexOf(D.devices.indexOf(sw2))>=0;})());
  ok('a tighter gap setting splits the row',(function(){const p=w.planAutoClip([A],{gap:145});const r=rowOf(p,s1);return r&&r.idx.length===2&&!rowOf(p,s3);})());
  ok('the row closes up around its centre at 72 mm',(function(){const xs=r1.moves.map(m=>m.to.x);return xs.join()==='1071,1143,1215';})(),r1&&r1.moves.map(m=>m.to.x).join());
  ok('the existing hand clip is extended, keeping its id',r1.kind==='extend'&&r1.gid==='clipX');
  ok('the ceiling node above D1 and the node linked to D3 follow',r1.nodes.length===2,r1&&r1.nodes.length);
  const r6=plan.rows.find(r=>r.idx.indexOf(D.devices.indexOf(six[0]))>=0);
  ok('six in a row become one group of five',r6&&r6.idx.length===5&&!rowOf(plan,six[5]));
  ok('…and the split is reported',plan.warn.some(m=>/6 doboz/.test(m)));
  ok('planning changes nothing',s1.x===1000&&s3.x===1290&&P0.nodes[0].x===1000&&!s3.clip);

  // ---------- apply + undo ----------
  const n=w.applyAutoClip(plan.rows);
  ok('apply reports the rows it clipped',n===plan.rows.length,n);
  ok('the boxes moved along the wall only',s1.x===1071&&s2.x===1143&&s3.x===1215&&[s1,s2,s3].every(d=>d.y===2950&&d.h===300));
  ok('one clip group, the hand-made id kept',s1.clip==='clipX'&&s2.clip==='clipX'&&s3.clip==='clipX');
  ok('the ceiling node moved in plan and kept its height',P0.nodes[0].x===1071&&P0.nodes[0].h===2700,P0.nodes[0].x+' / '+P0.nodes[0].h);
  ok('the far end of that route stayed',P0.nodes[1].x===1000&&P0.nodes[1].y===1500);
  ok('the linked node moved with D3',P1.nodes[0].x===1215&&P1.nodes[0].h===300);
  ok('the vertical row closed up along y',(function(){const ys=six.slice(0,5).map(d=>d.y);return ys.join()==='636,708,780,852,924'&&six.every(d=>d.x===50);})(),six.map(d=>d.y).join());
  ok('the sixth box is left unclipped',!six[5].clip&&!!six[0].clip&&six.slice(0,5).every(d=>d.clip===six[0].clip));
  ok('a clean row is not offered again',(function(){const p=w.planAutoClip([A]);return !rowOf(p,s1)&&p.ok>=2;})());
  ok('one undo restores boxes, clips and nodes',(function(){w.doUndo();const d=w.__data,by=id=>d.devices.find(x=>x.id===id);
    const p0=d.paths.find(p=>p.id===P0.id);
    return by(s1.id).x===1000&&by(s3.id).x===1290&&!by(s3.id).clip&&by(s1.id).clip==='clipX'&&p0.nodes[0].x===1000&&!by(six[0].id).clip;})());

  // ---------- a stale clip partner is released ----------
  ok('a partner left alone by a regroup loses its clip',(function(){const d=w.__data;
    const far=d.devices.find(x=>x.id===lone.id),a1=d.devices.find(x=>x.id===s3.id);
    far.clip='clipY';a1.clip='clipY';                                          // a stray hand clip across the room
    const p=w.planAutoClip([{rm:d.floors[0],src:'F',i:0,level:lvl}]);w.applyAutoClip(p.rows);
    const b1=d.devices.find(x=>x.id===s1.id);
    return !far.clip&&!!a1.clip&&a1.clip===b1.clip;})());
  w.doUndo();

  // ---------- surfaces ----------
  ok('the action sits in the Helyiség group and needs a room',(function(){const a=w.ACTIONS.find(x=>x.id==='room.autoclip');
    w.__setSel(null);const off=!w.runAction('room.autoclip');return a&&a.group==='Helyiség'&&off;})());
  ok('the whole-project action is in the Kiosztás stage group',(w.ACTIONS.find(x=>x.id==='rooms.autoclip')||{}).group==='Készülék');
  ok('the room right-click menu offers Sorolás',w.roomMenuItems({rm:w.__data.floors[0],src:'F',i:0,level:lvl}).some(it=>/Sorolás/.test(it.label)));
  w.__setSel({t:'floors',i:0,level:lvl});
  ok('the dialog previews each row with a tick box',(function(){w.runAction('room.autoclip');
    return $('acPrev').querySelectorAll('input[data-row]').length>=2&&/72 mm|bővítés/.test($('acPrev').textContent);})());
  ok('the gap setting re-plans the preview',(function(){const before=$('acPrev').querySelectorAll('input[data-row]').length;
    $('acGap').value='100';$('acGap').oninput();const after=$('acPrev').querySelectorAll('input[data-row]').length;
    $('acGap').value='180';$('acGap').oninput();return after<before;})());
  ok('with every row unticked Sorolás does nothing',(function(){$('acPrev').querySelectorAll('input[data-row]').forEach(c=>c.checked=false);
    $('mOk').onclick();const d=w.__data.devices.find(x=>x.id===s1.id);return d.x===1000&&!!$('acPrev');})());
  ok('ticking one row applies only that row',(function(){const live=id=>w.__data.devices.find(y=>y.id===id);
    const before=[s1.id,six[0].id].map(id=>live(id).x+','+live(id).y);
    const boxes=[...$('acPrev').querySelectorAll('input[data-row]')];
    boxes.forEach(c=>c.checked=false);boxes[0].checked=true;$('mOk').onclick();
    const after=[s1.id,six[0].id].map(id=>live(id).x+','+live(id).y);
    return after[0]!==before[0]&&after[1]===before[1];})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
