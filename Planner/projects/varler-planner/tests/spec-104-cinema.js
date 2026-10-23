// Round 2026-10-18 WP-C1–C4 — Házimozi (src/08ra-cinema-calc.js + src/08r-cinema.js).
// 1. the calculator against the guide's worked example (§3.1: L 6.0, W 6.0, H_f 2.60, x_scr 0.50, h_eye 1.15, AR 1.78,
//    θ 40°, c_lens 0.32, t 0.05, x_MLP = 0.60 L; tolerance 5 mm); 2. the role + layer; 3. the screen line → side / x_scr,
//    the zone (C3 D start = A); 4. the overlay (30 %), the checks, the spots on demand.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);const near=(a,b,t)=>Math.abs(a-b)<=(t||0.005);
 try{
  // ---- 1. the calculator ----
  const r7=w.cinCalc({L:6,W:6,Hf:2.6,xScr:0.5,fmt:'7.1'}),r5=w.cinCalc({L:6,W:6,Hf:2.6,xScr:0.5,fmt:'5.1'});
  ok('x_MLP 3.600, D 3.100',near(r7.xMLP,3.6)&&near(r7.D,3.1));
  ok('W_s: angle 2.257, height 3.017 → the angle binds, 2.257',near(r7.WsAng,2.257)&&near(r7.WsH,3.017)&&r7.bind==='angle'&&near(r7.Ws,2.257));
  ok('H_s 1.268, z_bot 0.727',near(r7.Hs,1.268)&&near(r7.zBot,0.727));
  ok('fronts: y_LR 1.278, φ 22.4°',near(r7.spk.L.y,1.278)&&near(r7.phi,22.4,0.05)&&near(r7.spk.R.y,-1.278));
  ok('7.1 sides at α 90°: x_S 3.600; 5.1 sides at α 110°: x_S 4.674',r7.alpha===90&&near(r7.spk.Ls.x,3.6)&&r5.alpha===110&&near(r5.spk.Ls.x,4.674));
  ok('7.1 rears at β 135°: y_B ±2.350, x 5.95',r7.rear.beta===135&&near(r7.spk.Lb.y,2.35)&&near(r7.spk.Rb.y,-2.35)&&near(r7.spk.Lb.x,5.95));
  ok('surround height z 1.75 (h_eye + 0.60)',near(r7.spk.Ls.z,1.75)&&near(r7.spk.Lb.z,1.75));
  ok('modes f_L 28.6 Hz, f_H 66.0 Hz',near(r7.modes.fL,28.58,0.01)&&near(r7.modes.fH,65.96,0.01));
  ok('7.1 viable (rear clearance 2.40 ≥ 1.50)',r7.viable71===true);
  ok('L ≈ W: the square-room warning (11) is the only failed check',r7.checks.filter(c=>!c.ok).map(c=>c.n).join()==='11',r7.checks.filter(c=>!c.ok).map(c=>c.n).join());
  ok('the projector: T = 1.5 × W_s, beam keep-out wedge, a track-light band exists',near(r5.pj.T,1.5*r5.Ws)&&r5.beam.poly.length===3&&r5.band.ok===true);
  const sh=w.cinCalc({L:3.6,W:3.0,Hf:2.5,xScr:0,fmt:'7.1'});
  ok('a short room: 7.1 still computed, the viability and rear-pair notes are warnings, not refusals',!!sh.rear&&sh.checks.some(c=>c.n==='7.1'&&!c.ok)&&sh.checks.every(c=>c.sev==='warn'));
  ok('the seat never lands in 0.5 L ± 0.05 L',(function(){for(let L=3;L<=9;L+=0.25){const x=w.cinCalc({L,W:4,Hf:2.6,xScr:0}).xMLP;if(Math.abs(x-0.5*L)<=0.05*L)return false;}return true;})());
  const tv=w.cinCalc({L:6,W:6,Hf:2.6,xScr:0,disp:'tv'});
  ok('TV: no projector, no beam',!tv.pj&&!tv.beam);
  // ---- 2. the role + layer ----
  w.confirm=()=>true;w.alert=()=>{};w.hardResetWorkspace();const st=w.__state,D=w.__data;st.active='ground';
  const ks=w.STK_ROLES.map(r=>r.k),cr=w.STK_ROLES.find(r=>r.k==='sys:CINEMA');
  ok('role sys:CINEMA right after Média és hang, off by default',ks.indexOf('sys:CINEMA')===ks.indexOf('sys:MEDIA')+1&&cr.off===true&&cr.ph===2);
  ok('the cinema node codes are in the catalogue',['CLR','CSR','CBK','CSW','CPJ','CSC','CTV','CRK'].every(c=>w.epEntry(c,'sys:CINEMA')));
  const WL=w.__getWalls();['ground','upper','basement'].forEach(l=>WL[l].length=0);
  D.floors.length=0;D.openings.length=0;
  const room={level:'ground',poly:[[0,0],[6000,0],[6000,5000],[0,5000]],name:'Nappali',kind:'nappali',layer:'L0'};D.floors.push(room);w.ensureIds(D);
  const L=w.cinLayerAdd();
  ok('without a stack: a plain Házimozi layer (role sys:CINEMA, no stack), active',L.role==='sys:CINEMA'&&!L.stack&&st.activeLayer===L.id);
  // ---- 3. line → side, zone ----
  const s=w.cinLineSide(room,[1000,520],[5000,480]);
  ok('a horizontal line 500 mm below the top edge → side y0, x_scr 500',s.side==='y0'&&s.xScr===500);
  const s2=w.cinLineSide(room,[5700,1000],[5710,4000]);
  ok('a vertical line near the right edge → side x1, x_scr 300 (snapped to 50)',s2.side==='x1'&&s2.xScr===300);
  const z=w.cinZoneA(room,'y0',s.mid);
  ok('zone A of a rectangle = the whole room: L 5000 (depth from y0), W 6000',z.L===5000&&z.W===6000&&z.off===0,JSON.stringify(z));
  const Lsh={level:'ground',poly:[[0,0],[6000,0],[6000,3000],[3000,3000],[3000,6000],[0,6000]],name:'L',layer:'L0'};
  const zl=w.cinZoneA(Lsh,'y0',[1500,200]);
  ok('an L-shaped room: zone A stands on the full top edge, depth stops at the inner corner (3000)',zl.W===6000&&zl.L===3000,JSON.stringify(zl));
  // ---- 4. the layer data, overlay, checks, spots ----
  L.cinema={room:room.id,level:'ground',side:'y0',xScr:500,zone:{L:5000,W:6000,off:0},suggest:true,fmt:'5.1',disp:'pj',hEye:1150,theta:40};
  const rc=w.cinCompute(L);
  ok('cinCompute reads the zone in mm and the room ceiling (2700 → H_f 2.70)',near(rc.in.L,5)&&near(rc.in.W,6)&&near(rc.in.Hf,2.7));
  ok('…and adds the door/window check (12)',rc.checks.some(c=>c.n===12));
  w.draw();let ov=w.document.querySelector('.cin-ovl');
  ok('the overlay draws: zone, screen, beam (red 12 %), band (green 12 %), markers at 30 %',!!ov&&/fill-opacity="0.12"/.test(ov.innerHTML)&&/opacity="0.3"/.test(ov.outerHTML)&&/MLP/.test(ov.textContent));
  L.cinema.suggest=false;w.draw();
  ok('"no suggestion" → no overlay',!w.document.querySelector('.cin-ovl'));
  L.cinema.suggest=true;
  D.openings.push({type:'door',level:'ground',x:1500,y:0,w:900,id:'B1'});   // L sits at x ≈ 1720 (the viewer's left)
  ok('a door next to the left front speaker trips check 12',w.cinCompute(L).checks.some(c=>c.n===12&&!c.ok));
  D.openings.length=0;
  const n=w.cinMakeSpots(L);
  ok('Javasolt helyek: 3 fronts + 2 sides + 2 subs + PJ + screen + rack = 10 ideal spots',n===10&&L.cinema.spots.every(p=>p.role==='sys:CINEMA'&&p.level==='ground'));
  const sp=w.idealSpots(L,'ground');
  ok('the ideal-spot mechanism (06b) serves them',sp.length===10&&sp.every(p=>p.layer===L.id));
  const pjS=L.cinema.spots.find(p=>p.code==='CPJ');
  const lS=L.cinema.spots.find(p=>p.why==='Házimozi L'),rS=L.cinema.spots.find(p=>p.why==='Házimozi R');
  ok('L is on the viewer\x27s left: screen on the top wall (y0), the viewer faces up, so L has the SMALLER x',lS.x<3000&&rS.x>3000,lS.x+'/'+rS.x);
  ok('the projector spot is on the room centreline at the ceiling − 200',pjS.x===3000&&pjS.h===2500);
  const items=w.roomMenuItems({rm:room,src:'F',i:0,level:'ground'}).map(x=>x.label);
  ok('the room menu offers the cinema items',items.some(l=>/Javasolt helyek/.test(l))&&items.some(l=>/Mozi ellenőrzés/.test(l)));
  // ---- 5. C5: the checklist and the snap ----
  w.hardResetWorkspace();const D2=w.__data,WL2=w.__getWalls();st.active="ground";st.exploded=false;["ground","upper","basement"].forEach(l=>WL2[l].length=0);
  WL2.ground.push({x0:-100,y0:-100,x1:9100,y1:0,id:"W1"},{x0:-100,y0:5000,x1:9100,y1:5100,id:"W2"},{x0:-100,y0:0,x1:0,y1:5000,id:"W3"},
    {x0:6000,y0:0,x1:6100,y1:5000,id:"W4"},{x0:9000,y0:0,x1:9100,y1:5000,id:"W5"});
  D2.floors.length=0;D2.openings.length=0;D2.marks=[];D2.paths.length=0;D2.devices.length=0;
  const A2={level:"ground",poly:[[0,0],[6000,0],[6000,5000],[0,5000]],name:"Mozi",kind:"nappali",layer:"L0"},B2={level:"ground",poly:[[6100,0],[9000,0],[9000,5000],[6100,5000]],name:"Előtér",layer:"L0"};
  D2.floors.push(A2,B2);w.ensureIds(D2);
  const CL=w.cinLayerAdd();CL.cinema={room:A2.id,level:"ground",side:"y0",xScr:300,zone:{L:5000,W:6000,off:0},suggest:true,fmt:"5.1",disp:"pj",hEye:1150,theta:40};
  let N=w.cinNodes(CL);
  ok("C5: the list — fronts 3, sides 2, rears 2 (5.1: előkészítés), subs 2, projector, screen, rack, keypads 2",N.map(x=>x.code+x.need).join(" ")==="CLR3 CSR2 CBK2 CSW2 CPJ1 CSC1 CRK1 CKP2"&&N.find(x=>x.code==="CBK").opt===true,N.map(x=>x.code+x.need).join(" "));
  const spots=w.cinSpotList(CL),rk=spots.find(p=>p.code==="CRK");
  const snapped=w.cinSnap({level:"ground",x:rk.x+400,y:rk.y-200,h:1100},"CRK");
  ok("C5: a CRK ghost within 700 mm snaps to the rack suggestion (x, y, h)",snapped&&snapped.x===rk.x&&snapped.y===rk.y&&snapped.h===300);
  ok("…a code with no suggestion nearby does not snap",!w.cinSnap({level:"ground",x:rk.x+3000,y:rk.y,h:300},"CRK")&&!w.cinSnap({level:"ground",x:0,y:0,h:0},"SOC"));
  st.activeLayer=CL.id;
  const mk=(code,x,y,h)=>{const d=w.epMake({level:"ground",x,y,h,mount:"wall"},code,"sys:CINEMA");D2.devices.push(d);return d;};
  const rack=mk("CRK",rk.x,rk.y,300);const front=mk("CLR",1700,300,1150);w.ensureIds(D2);
  N=w.cinNodes(CL);
  ok("C5: placed devices on the layer count (rack 1 / 1, fronts 1 / 3)",N.find(x=>x.code==="CRK").have===1&&N.find(x=>x.code==="CLR").have===1);
  // ---- 6. C6: the Mozi fal ink, the route, the prompt, the AV circuits ----
  ok("C6: the marker pen knows the Mozi fal ink (face net)",w.mkpInk("mozi")&&w.mkpInk("mozi").net==="f");
  const face=(id,toward,u0,u1)=>{const r=w.mrkWallById("ground",id);const p1=w.mrkFacePt(r,1,10,0);const d1=Math.hypot(p1[0]-toward[0],p1[1]-toward[1]),p2=w.mrkFacePt(r,-1,10,0),d2=Math.hypot(p2[0]-toward[0],p2[1]-toward[1]);
    const side=d1<d2?1:-1;D2.marks.push({kind:"vstrip",level:"ground",wall:id,side,u0:u0||0,u1:u1||w.mrkWallLen(r),pol:"plus",tags:["mozi"],layer:"L0"});};
  face("W2",[3000,2500],0,6100);face("W3",[3000,2500]);face("W1",[3000,2500],0,6100);   // u = x + 100 on the long walls: the cinema room only
  face("W4",[3000,2500]);face("W4",[7500,2500]);
  const board={type:"board",level:"ground",x:8000,y:50,h:1600,layer:"L0"};D2.devices.push(board);w.ensureIds(D2);
  ok("C6: without a mark on the far room's wall the cinema walls do not reach the Elosztó",!w.cinRoute("ground",[rack.x,rack.y],[board.x,board.y],false));
  D2.marks.push({kind:"wall",level:"ground",wall:"W1",tags:["vezetheto"],pol:"plus",layer:"L0"});
  let asked=0;w.confirm=()=>{asked++;return true;};
  const res=w.cinRouteAll(CL,{circuits:2});
  ok("C6: the route asks once to use the general Vezethető fal, then reaches the Elosztó",asked===1&&CL.cinema.useGeneral===true&&!res.miss.includes("Elosztó"),JSON.stringify(res));
  const feed=D2.paths.find(p=>p.cin&&p.cin.kind==="feed");
  ok("C6: the feed path crosses the middle wall (from the cinema room x < 6000 to x ≥ 6100) and ends at the board",!!feed&&feed.nodes[0].x<6000&&feed.nodes.some((n,k)=>k>0&&feed.nodes[k-1].x<=6000&&n.x>=6100)&&feed.nodes[feed.nodes.length-1].x===8000,feed&&JSON.stringify(feed.nodes.map(n=>[n.x,n.y])));
  ok("C6: the run is at the spine height, the ends drop to the devices; sections match the nodes",feed.nodes[0].h===300&&feed.nodes[1].h===w.cinRunH("ground")&&feed.sections.length===feed.nodes.length-1);
  ok("C6: the front speaker is routed to the rack along the cinema walls",D2.paths.some(p=>p.cin&&p.cin.kind==="node"&&p.cin.from===front.id));
  const av=D2.devices.filter(d=>d.cin&&d.cin.av);
  ok("C6: 2 AV circuits as DED endpoints: AV-1 rack B, AV-2 C-curve, same phase group + own RCD",av.length===2&&av[0].code==="DED"&&av[1].cin.curve==="C"&&av.every(d=>d.cin.phaseGroup==="AV"&&d.cin.rcd==="AV"));
  ok("C6: the room asks for a DED on the Dedikált körök layer (05t derived)",w.needDefaults(A2,"sys:DED").codes.includes("DED"));
  const n1=D2.paths.length;w.cinRouteAll(CL,{circuits:2});
  ok("C6: a re-run replaces the cinema paths and circuits (no doubles)",D2.paths.length===n1&&D2.devices.filter(d=>d.cin&&d.cin.av).length===2);
  ok("C6: one undo step takes the whole run back",(w.doUndo(),!w.__data.paths.some(p=>p.cin&&p.cin.kind==="node"&&p.cin.from===front.id)||w.__data.paths.filter(p=>p.cin).length<=n1));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
