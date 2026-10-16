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
  const D=w.__data,WA=w.__getWalls()[lvl],S=w.__state;
  WA.push({x0:0,y0:2950,x1:4000,y1:3050});                       // horizontal wall, face y=2950 is side 0
  D.floors.push({level:lvl,name:'NAPPALI',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  const add=o=>{D.devices.push(Object.assign({level:lvl,h:300,layer:'L0',side:0,y:2950},o));w.ensureIds(D);return D.devices[D.devices.length-1];};
  const a1=add({type:'socket',ref:'D1',x:1000});
  S.side=0;S.activeLayer='L0';
  // the wall is re-read every time: an undo rebuilds every wall object (CLAUDE.md)
  const P=(x,o)=>Object.assign({level:lvl,x,y:2950,h:1200,wall:w.__getWalls()[lvl][0],snap:'fal/köz'},o||{});

  // ---------- row snap ----------
  let r=w.rowSnap(P(1100),'socket');
  ok('Shift beside a socket: 72 mm to its right, at its height',r&&r.anchor===a1&&r.x===1072&&r.y===2950&&r.h===300,r&&[r.x,r.h].join());
  r=w.rowSnap(P(900),'socket');
  ok('…or to its left, following the cursor',r&&r.x===928);
  ok('a different box type does not snap',!w.rowSnap(P(1100),'switch'));
  ok('the far face of the wall does not snap',(function(){S.side=1;const x=w.rowSnap(P(1100),'socket');S.side=0;return !x;})());
  ok('another layer does not snap',(function(){S.activeLayer='Lx';const x=w.rowSnap(P(1100),'socket');S.activeLayer='L0';return !x;})());
  ok('beyond reach (400 mm) does not snap',!w.rowSnap(P(1500),'socket'));
  ok('not wall-locked (ceiling height), a box near the cursor still gives the row',(function(){
    const x=w.rowSnap(P(1100,{wall:null,y:2900,h:2700}),'socket');return x&&x.x===1072&&x.y===2950&&x.h===300;})());
  ok('not wall-locked and far off the wall, nothing snaps',!w.rowSnap(P(1100,{wall:null,y:2500}),'socket'));
  const a2=add({type:'socket',ref:'D2',x:1072,clip:'g1'});a1.clip='g1';
  ok('a row grows at its end, not beside the nearest box',w.rowSnap(P(1100),'socket').x===1144&&w.rowSnap(P(950),'socket').x===928);
  ok('a full row (5) refuses',(function(){const extra=[1144,1216,1288].map((x,k)=>add({type:'socket',ref:'F'+k,x,clip:'g1'}));
    const x=w.rowSnap(P(1300),'socket');extra.forEach(()=>D.devices.pop());return x&&x.full===true;})());

  // ---------- placing ----------
  w.setMode('device');$('devType').value='socket';
  let p=w.placeSnapAt(P(1100),null,true);
  ok('the snapped cursor says where it goes',p.row===a2.id&&p.x===1144&&p.h===300&&/D2 mellé/.test(p.snap),p.snap);
  const n0=D.devices.length;let d3=w.placeDevice(p,'socket');
  ok('the click places it in the slot and clips it into the row',d3.x===1144&&d3.h===300&&d3.clip==='g1'&&d3.side===0&&D.devices.length===n0+1);
  ok('one undo takes it back',(function(){w.doUndo();return w.__data.devices.length===n0;})());
  const D2=w.__data;
  p=w.placeSnapAt(P(1100),null,false);
  ok('without Shift nothing snaps',!p.row&&p.x===1100&&p.h===1200);
  ok('without Shift the box is placed as before',(function(){const d=w.placeDevice(p,'socket');const r0=!d.clip&&d.x===1100&&d.h===1200;w.doUndo();return r0;})());
  ok('a first box with no neighbour says so',/nincs azonos doboz/.test(w.placeSnapAt(P(3000),null,true).snap));
  ok('Space with Shift joins the row too, when it drops the same box',(function(){
    const items=w.eval('PLACE_ITEMS'),ix=items.findIndex(it=>/^k_/.test(it.id)&&(it.mk()||{}).type==='socket');
    S.placeIdx=ix;w.__tmpCur=w.placeSnapAt(P(1100),null,true);w.eval('cursor=window.__tmpCur');
    const i=w.placeAtCursor(),d=w.__data.devices[i];const r0=d.clip==='g1'&&d.x===1144;w.doUndo();return r0;})());
  ok('a wall rebuilt by undo still matches by id',(function(){w.pushUndo();w.doUndo();return !!w.rowSnap(P(1100),'socket');})());

  // ---------- path nodes on boxes ----------
  w.setMode('path');S.pathType=S.pathType||'mbcu';w.setPitch(90);   // flat plan: stacked boxes overlap
  const b1=w.planToBase(1000,2950,w.dz(lvl,300));
  ok('the box under the pointer is found by its symbol',w.devAtBase(b1[0]+2,b1[1]-2,lvl)===w.__data.devices.find(x=>x.id===a1.id));
  ok('a point well away from any symbol finds nothing',!w.devAtBase(b1[0]+60,b1[1]+60,lvl));
  ok('on a stack, the box nearest the drawing height is picked',(function(){
    const kd=add({type:'junction',ref:'KD1',x:1000,h:2500,side:0}),k1=add({type:'switch',ref:'K1',x:1000,h:1100,side:0});
    const b=w.planToBase(1000,2950,w.dz(lvl,300)),live=id=>w.__data.devices.find(x=>x.id===id);
    const top=w.devAtBase(b[0],b[1],lvl,2700),low=w.devAtBase(b[0],b[1],lvl,300),mid=w.devAtBase(b[0],b[1],lvl,1200);
    D.devices.pop();D.devices.pop();
    return top===kd&&low===live(a1.id)&&mid===k1;})());
  ok('a box on a hidden layer is not picked',(function(){const L=w.layerById('L0');L.visible=false;const x=w.devAtBase(b1[0],b1[1],lvl);L.visible=true;return !x;})());
  p=w.placeSnapAt(P(1006,{h:2700}),b1,false);
  ok('a path node on a box snaps onto it in plan, at the drawing height',p.dev===a1.id&&p.x===1000&&p.y===2950&&p.h===2700&&/D1/.test(p.snap),p.snap);
  const nA=w.pathAddNode(p);
  ok('the draft node is marked for linking',nA.on===a1.id);
  w.__tmpCur=p;w.eval('cursor=window.__tmpCur');w.draw();
  ok('the preview rings the box and colours the marked node',(function(){const h=w.document.getElementById('lyOverlay').innerHTML+w.document.getElementById('lyScene').innerHTML;
    return /stroke="#1d9e75"/.test(h);})());
  w.pathAddNode(w.placeSnapAt(P(2000,{h:2700,wall:null}),null,false));
  const before=w.__data.paths.length;w.finishPath();
  const pa=w.__data.paths[w.__data.paths.length-1],A1=w.__data.devices.find(x=>x.id===a1.id);
  ok('finishing the path links the box to that node',w.__data.paths.length===before+1&&w.hasLinkTo(A1,pa.id,pa.nodes[0].id));
  ok('the link is plan-only, the marker is gone, the height stayed',(function(){const l=w.devLinks(A1).find(x=>x.p===pa.id);
    return l&&!l.glue&&pa.nodes.every(n=>n.on===undefined)&&pa.nodes[0].h===2700;})());
  ok('an unmarked node links nothing',w.__data.devices.every(d=>!w.hasLinkTo(d,pa.id,pa.nodes[1].id)));
  ok('one undo removes the path and its link together',(function(){w.doUndo();const d=w.__data.devices.find(x=>x.id===a1.id);
    return w.__data.paths.length===before&&!w.devLinks(d).some(l=>l.p===pa.id);})());
  ok('reg: draw()',(function(){w.setMode('select');try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
