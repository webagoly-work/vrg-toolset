// Workflow round WP-R5 — the marker pen on the wall-line network (src/08ia-wf-marker.js; R5-Q1…Q5 = A).
// Fixture: three rooms in a row through Create Walls (F3), so the junctions are the real ones: the long walls run
// through, the partitions stop at their faces. What must hold: the centrelines meet at the junctions; the face pieces
// each belong to one room; a click marks one wall of one room; a drag follows the net round a corner; a second click
// takes the ink off; Alt erases a part; the routing-wall and rules tools are the pen now; old data stays readable.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';st.penThick={ext:300,int:200};
  const W=w.__getWalls();['ground','upper','basement'].forEach(l=>W[l].length=0);D.floors.length=0;D.marks=[];
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  ['A','B','C'].forEach((n,i)=>D.floors.push({level:'ground',poly:rect(i*3000,0,i*3000+3000,3000),name:n,stage:'outline',clear:true,layer:'L0'}));
  w.wfwApply(w.wfwPlan('ground'),'ground');w.ensureIds(D);
  const G=W.ground,room=n=>D.floors.find(f=>f.name===n);
  const top=G.filter(r=>(r.x1-r.x0)>(r.y1-r.y0)&&r.y1<=0+1).sort((a,b)=>(b.x1-b.x0)-(a.x1-a.x0))[0];
  const parts=G.filter(r=>(r.y1-r.y0)>(r.x1-r.x0)&&r.y0>=-1&&r.y1<=3001&&r.x0>100&&r.x1<8000).sort((a,b)=>a.x0-b.x0);
  const bx=n=>{const p=room(n).poly.map(q=>q[0]);return [Math.min(...p),Math.max(...p)];};
  ok('fixture: a through top wall and two partitions',!!top&&parts.length===2&&top.x1-top.x0>9000,JSON.stringify(G.map(r=>[r.x0,r.y0,r.x1,r.y1])));
  const net=w.wlnNet('ground'),tc=(top.y0+top.y1)/2;
  // 1. centrelines meet
  const topC=net.c.filter(e=>e.wall===top.id),pc=parts.map(p=>(p.x0+p.x1)/2);
  ok('the top wall centre is split at both partitions',pc.every(x=>topC.some(e=>Math.round(e.a[0])===Math.round(x)||Math.round(e.b[0])===Math.round(x))),JSON.stringify(topC.map(e=>[e.a,e.b])));
  ok('each partition centreline ends ON the top centreline (distance 0)',parts.every(p=>net.c.some(e=>e.wall===p.id&&[e.a,e.b].some(q=>Math.abs(q[1]-tc)<0.6&&Math.abs(q[0]-(p.x0+p.x1)/2)<0.6))));
  // 2. faces: one wall of one room
  const topF=net.f.filter(e=>e.wall===top.id&&e.side!==0&&Math.abs(e.a[1]-top.y1)<0.6);
  const rooms=[...new Set(topF.map(e=>e.room).filter(Boolean))];
  ok('the top wall\'s inner face is three pieces, one per room',rooms.length===3&&rooms.indexOf(room('B').id)>=0,JSON.stringify(topF.map(e=>[e.a[0],e.b[0],e.room])));
  ok('each partition has a face piece in the room on either side',parts.every(p=>new Set(net.f.filter(e=>e.wall===p.id&&e.side!==0).map(e=>e.room)).size===2));
  ok('the faces close round each room (every end point is shared)',(function(){const k={};net.f.forEach(e=>[e.a,e.b].forEach(q=>{const s=Math.round(q[0])+','+Math.round(q[1]);k[s]=(k[s]||0)+1;}));return Object.values(k).every(n=>n>=2);})());
  // 3. a click in room B marks exactly B's span of the top wall
  const [b0,b1]=bx('B'),tol=60;
  const sB=w.wlnNearest('ground','f',[(b0+b1)/2,top.y1+5],tol);
  let rg=w.wlnRanges('ground',w.wlnUnit('ground','f',sB));
  ok('click in B → one range on the top wall, as long as B',rg.length===1&&rg[0].wall===top.id&&Math.round(rg[0].u1-rg[0].u0)===b1-b0,JSON.stringify(rg));
  let res=w.mkpApply('kerulendo','ground',rg,false);
  const kM=()=>D.marks.filter(m=>(m.tags||[]).indexOf('kerulendo')>=0);
  ok('… one face strip, Kerülendő',res.added===1&&kM().length===1&&kM()[0].kind==='vstrip'&&kM()[0].wall===top.id);
  const [a0,a1]=bx('A'),uA=w.mrkU(top,(a0+a1)/2,0);
  ok('room A\'s part of the same wall is untouched',w.mrkAt('ground',top.id,kM()[0].side,uA).length===0);
  ok('a second click with the same ink takes it off',w.mkpCovered(w.mkpInk('kerulendo'),'ground',rg[0])&&w.mkpApply('kerulendo','ground',rg,true).added===0&&kM().length===0);
  w.doUndo();ok('one undo step brings it back',kM().length===1);D.marks=[];
  // 4. a drag round the corner: top face in A → the first partition's face in A
  const s0=w.wlnNearest('ground','f',[a0+800,top.y1+5],tol),p1=parts[0],s1=w.wlnNearest('ground','f',[p1.x0-5,1500],tol);
  const route=w.wlnRoute('ground','f',s0,s1);rg=w.wlnRanges('ground',route);
  ok('the drag gives two ranges: the top wall and the partition',rg.length===2&&rg.some(g=>g.wall===top.id)&&rg.some(g=>g.wall===p1.id),JSON.stringify(rg));
  const gt=rg.find(g=>g.wall===top.id),gp=rg.find(g=>g.wall===p1.id);
  ok('… they meet at the inner corner',Math.abs(w.mrkU(top,p1.x0,0)-gt.u1)<1&&Math.abs(gp.u0-w.mrkU(p1,p1.x0,top.y1))<1,JSON.stringify([gt,gp]));
  // 5. the centre net: a drag from the top centre to the partition centre turns at the junction
  const c0=w.wlnNearest('ground','c',[a0+800,tc],tol),c1=w.wlnNearest('ground','c',[(p1.x0+p1.x1)/2,1500],tol);
  const cr=w.wlnRanges('ground',w.wlnRoute('ground','c',c0,c1));
  ok('centre drag: top wall + partition, turning at the junction',cr.length===2&&cr.some(g=>g.wall===top.id&&g.side===0)&&cr.some(g=>g.wall===p1.id&&g.side===0),JSON.stringify(cr));
  // 6. Vezethető fal through the pen, then an Alt erase in the middle
  const L=w.mrkWallLen(top);w.mkpApply('vezetheto','ground',[{wall:top.id,side:0,u0:0,u1:L}],false);
  ok('the pen\'s vezethető span feeds rwlAllowed',w.rwlAllowed('ground').some(a=>a.wall===top.id&&a.u0===0&&a.u1===L));
  w.mkpApply('vezetheto','ground',[{wall:top.id,side:0,u0:3000,u1:5000}],true);
  const A=w.rwlAllowed('ground').filter(a=>a.wall===top.id);
  ok('Alt erase cuts the middle out: two spans left',A.length===2&&A[0].u1===3000&&A[1].u0===5000,JSON.stringify(A));
  ok('mrkAt sees a span',w.mrkAt('ground',top.id,1,1000).some(x=>x.kind==='wspan')&&!w.mrkAt('ground',top.id,1,4000).some(x=>x.kind==='wspan'));
  // 7. a whole-wall ink (Külső fal) as a span draws
  w.mkpApply('kulso','ground',[{wall:parts[1].id,side:0,u0:0,u1:1500}],false);w.draw();
  ok('a Külső fal span is drawn (grey)',w.mrkSceneSvg().indexOf('#8a8f96')>=0);
  // 8. the tools are the pen now
  w.rwlToolStart();ok('Vezethető fal button → the pen with the routing ink',w.MKP.on&&w.MKP.ink==='vezetheto'&&w.toolCurrent().id==='wf.routeWalls');
  w.rbPick('tilos');ok('a face preset → the pen with that ink, the old rules tool off',w.MKP.on&&w.MKP.ink==='tilos'&&!w.eval('RB.on')&&w.toolCurrent().label==='Jelölő toll: Tilos');
  w.rbPick('agy');ok('a zone preset keeps the rules tool (rectangles on the floor)',!w.MKP.on&&w.eval('RB.on')&&w.eval('RB.preset')==='agy');
  w.rbPick('kemeny');w.setMode('wall');ok('another tool ends the pen',!w.MKP.on);
  ok('golden-neutral: nothing of the net is in the scene',!/wln|mkp/.test(w.document.getElementById('vp').innerHTML));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
