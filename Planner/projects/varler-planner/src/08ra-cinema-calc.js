// ==========================================================================
// 08ra-cinema-calc.js — round 2026-10-18 (docs/round-2026-10-18), WP-C3: the home-cinema calculator
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// Pure functions, no DOM, no Planner data. The authority for every number is the guide
// (docs/round-2026-10-18/src/home-cinema-part1-architectural-base.md, § below). Units: METRES here, the layer (08r)
// converts. Coordinates as in the guide's worked example: x = distance from the FRONT (screen) wall into the room
// (the screen plane is at x = xScr, D = xMLP − xScr), y = from the room centreline, z = above the finished floor.
// Sets (§3.1–3.5): A only the room is known · B the screen is fixed (o.Ws) · C the seat is fixed (o.xMLP) · D the
// projector is owned (o.trMin / o.trMax, optional fixed o.xPJ and o.shiftMax %) · E the ceiling binds. A set only
// decides x_MLP and W_s; everything downstream (§3.6–3.10) is the same. Every failed check is a WARNING (C4: 7.1 is
// always allowed, a failing viability test only leaves a note). Prefix: cin.

const CIN_DEF={set:'A',trMin:1.3,trMax:2.0,hEye:1.15,AR:1.78,thetaMax:40,thetaMin:30,cLens:0.32,t:0.05,mlpFrac:0.60,dMount:0.20,TR:1.5,margin:0.25,
  phiMin:22,phiMax:30,side51:[100,110],side71:[90,100],rear71:[135,150]};
const cinRad=d=>d*Math.PI/180,cinDeg=r=>r*180/Math.PI,cinR3=v=>Math.round(v*1000)/1000;

// §3.1 step 1: the seat — preferred band, never in 0.5 L ± 0.05 L, rear clearance ≥ 1.20
function cinSeat(L,frac){let x=L*frac;
  if(Math.abs(x-0.5*L)<=0.05*L)x=0.55*L+0.01;               // out of the length-mode null
  if(L-x<1.2)x=L-1.2;
  if(Math.abs(x-0.5*L)<=0.05*L)x=0.45*L-0.01;               // a short room: the "38 %" side of the null
  return x;}
// a seat inside a band [lo, hi] (x from the front wall): the preferred seat if it fits, never in 0.5 L ± 0.05 L, never
// closer than 1.20 to the rear wall; null when the band misses the room
function cinSeatIn(L,lo,hi,frac){hi=Math.min(hi,L-1.2);if(lo>hi+1e-9)return null;let x=Math.min(hi,Math.max(lo,cinSeat(L,frac)));
  if(Math.abs(x-0.5*L)<=0.05*L){const c=[0.45*L-0.01,0.55*L+0.01].filter(v=>v>=lo-1e-9&&v<=hi+1e-9).sort((a,b)=>Math.abs(a-x)-Math.abs(b-x));if(c.length)x=c[0];}
  return x;}
// the full layout. o = {set, L, W, Hf, xScr, fmt:'5.1'|'7.1', disp:'pj'|'tv', hEye, thetaMax, Ws (B), xMLP (C), trMin/trMax/xPJ/shiftMax (D), …}
function cinCalc(o){const P=Object.assign({},CIN_DEF,o||{}),L=+P.L,W=+P.W,Hf=+P.Hf,xs=+P.xScr||0,t=P.t,he=P.hEye,AR=P.AR;
  const checks=[],warn=(n,ok,msg)=>checks.push({n,ok:!!ok,sev:'warn',msg}),r3=v=>String(cinR3(v)).replace('.',',');
  const set=P.disp==='tv'&&P.set==='D'?'A':(P.set||'A'),tMax=Math.tan(cinRad(P.thetaMax/2)),tMin=Math.tan(cinRad(P.thetaMin/2));
  const cl=P.disp==='tv'?0.10:P.cLens,WsH=AR*1.5*(Hf-cl-he);
  let xM,Ws,bind,sband=null,wsRange=null,trUse=P.TR,pjAt=null;
  // A / C / D start the same way: the seat (C: measured), then the binding of the viewing angle and the ceiling (§3.1 steps 3–5)
  const fromSeat=x=>{const D=x-xs,a=2*D*tMax;return {Ws:Math.max(0,Math.min(a,WsH)),bind:a<=WsH?'angle':'height',lo:Math.max(0,Math.min(2*D*tMin,WsH))};};
  if(set==='B'){Ws=+P.Ws||0;bind='fixed';sband={lo:xs+Ws/(2*tMax),hi:xs+Ws/(2*tMin)};               // §3.2 the screen is fixed
    xM=cinSeatIn(L,sband.lo,sband.hi,P.mlpFrac);
    if(xM==null){xM=L-1.2;const fit=2*(L-1.2-xs)*tMax;warn('B',false,'A vászon nagy a helyiséghez: a 40°-os ülés is 1,20 m-en belül lenne a hátsó falhoz — legfeljebb '+r3(fit)+' m széles kép ('+r3(Ws-fit)+' m-rel kisebb).');}
    else warn('B',true,'Ülősáv a vászonhoz: '+r3(sband.lo)+' – '+r3(Math.min(sband.hi,L-1.2))+' m.');}
  else if(set==='E'){Ws=Math.max(0,WsH);bind='height';sband={lo:xs+Ws/(2*tMax),hi:xs+Ws/(2*tMin)};   // §3.5 the ceiling binds
    xM=cinSeatIn(L,sband.lo,sband.hi,P.mlpFrac);
    if(xM==null){xM=cinSeat(L,P.mlpFrac);const f=fromSeat(xM);Ws=f.Ws;bind=f.bind;warn('E',false,'A belmagasság szerinti kép ülősávja nem fér a helyiségbe — kisebb kép (A szerint).');}
    else warn('E',true,'Ülősáv a belmagassághoz: '+r3(sband.lo)+' – '+r3(Math.min(sband.hi,L-1.2))+' m.');}
  else{xM=P.xMLP!=null?+P.xMLP:cinSeat(L,P.mlpFrac);const f=fromSeat(xM);Ws=f.Ws;bind=f.bind;wsRange=[f.lo,f.Ws];   // A, C
    if(set==='D'){const T0=P.xPJ!=null?+P.xPJ-xs:null,maxT=L-0.3-xs;                                      // §3.4 the projector is owned
      const rng=T0!=null?[T0/P.trMax,T0/P.trMin]:[0,maxT/P.trMin],lo=Math.max(f.lo,rng[0]),hi=Math.min(f.Ws,rng[1]);
      if(lo<=hi+1e-9){Ws=hi;warn('D',true,'A projektor képe '+r3(rng[0])+' – '+r3(rng[1])+' m; a választott kép '+r3(Ws)+' m.');}
      else{Ws=Math.min(Math.max(f.Ws,rng[0]),rng[1]);
        warn('D',false,rng[1]<f.lo?'A projektor túl hosszú vetítésű a helyiséghez: legfeljebb '+r3(rng[1])+' m kép, a 30°-hoz '+r3(f.lo)+' m kellene.'
          :'A projektor ezen a helyen túl nagy képet ad (legalább '+r3(rng[0])+' m) — előrébb kell szerelni.');}
      bind='projector';trUse=T0!=null?T0/Ws:Math.min(P.trMax,maxT/Ws);if(T0!=null)pjAt=+P.xPJ;}}
  const D=xM-xs,WsAng=2*D*tMax,Hs=Ws/AR,zBot=he-Hs/3,zTop=zBot+Hs;
  // §3.6 fronts: outside the image edge, φ ≥ 22°, side-wall clearance
  const yMax=W/2-0.6,yLR=Math.max(Ws/2+0.15,D*Math.tan(cinRad(P.phiMin)));
  const yL=Math.min(yLR,Math.max(0,yMax)),phi=cinDeg(Math.atan2(yL,D));
  // the centre: under a non-AT screen, as high as possible but ≥ 0.6
  const zC=P.disp==='tv'?Math.max(0.6,zBot-0.20):Math.max(0.6,zBot-0.15);
  // §3.6 side surrounds: 5.1 → 110° first, 7.1 → 90°; stepped down 5° while x_S > L − 0.30
  const zS=Math.min(he+0.6,Hf-0.3),ySide=W/2-t;
  const sideX=a=>Math.abs(a-90)<1e-6?xM:xM-ySide/Math.tan(cinRad(a));
  let a=P.fmt==='7.1'?P.side71[0]:P.side51[1];while(sideX(a)>L-0.3&&a>90)a-=5;
  const xS=sideX(a);
  // §3.6 rears (7.1): β from 135°, widened while |y_B| > W/2 − 0.50
  let rear=null;if(P.fmt==='7.1'){const dx=(L-t)-xM;let b=P.rear71[0];const yb=bb=>dx*Math.tan(cinRad(180-bb));
    while(Math.abs(yb(b))>W/2-0.5&&b<P.rear71[1])b+=5;rear={x:L-t,y:yb(b),z:zS,beta:b,dx};}
  // §3.9 subwoofers: L ≈ W (within 10 %) → 2 at the side-wall midpoints (4 recommended); else 2 the same way
  const square=Math.abs(L-W)/Math.max(L,W)<=0.10,nSubs=P.nSubs||2;
  const subs=nSubs===1?[{x:t,y:W/4,z:0}]:[{x:L/2,y:ySide,z:0},{x:L/2,y:-ySide,z:0}];
  // §3.8 projector, beam keep-out, track-light band
  let pj=null,beam=null,band=null;
  if(P.disp!=='tv'){const xP=pjAt!=null?pjAt:Math.min(xs+trUse*Ws,L-0.3),T=xP-xs,zL=Hf-P.dMount;
    pj={x:xP,y:0,z:zL,T,shiftPct:Hs>0?(zL-(zBot+Hs/2))/Hs*100:0};
    beam={apex:[xP,0],base:[[xs,-Ws/2],[xs,Ws/2]],margin:P.margin,poly:[[xP+P.margin,0],[xs,Ws/2+P.margin],[xs,-Ws/2-P.margin]]};
    const yi=Ws/2+P.margin,yo=W/2-0.6;band={ok:yo>yi,yIn:yi,yOut:yo,x0:xs+0.4,x1:xP-0.1};}
  const spk={L:{x:xs,y:yL,z:he},C:{x:xs,y:0,z:zC},R:{x:xs,y:-yL,z:he},Ls:{x:xS,y:ySide,z:zS},Rs:{x:xS,y:-ySide,z:zS}};
  if(rear){spk.Lb={x:rear.x,y:Math.abs(rear.y),z:zS};spk.Rb={x:rear.x,y:-Math.abs(rear.y),z:zS};}
  // §3.7 the distances the processor needs
  const dist={};Object.keys(spk).forEach(k=>{const s=spk[k];dist[k]=Math.hypot(xM-s.x,s.y,he-s.z);});
  // §3.9 axial modes
  const modes={fL:343/(2*L),fW:343/(2*W),fH:343/(2*Hf)};
  // §3.10 the sweep (12 = doors, park zones, windows: 08r checks it against the room's openings)
  warn(1,zBot>=0.6,'A kép alja '+cinR3(zBot)+' m — legalább 0,60 m kell: kisebb kép vagy magasabb ülés.');
  warn(2,P.disp==='tv'||zTop+cl<=Hf+1e-9,'A kép teteje + lencse nem fér a mennyezet alá: kisebb kép.');
  warn(3,Math.abs(xM-0.5*L)>0.05*L,'A hallgatási pont a hossz felénél van (módus-nulla): tolj rajta 0,3 m-t.');
  warn(4,L-xM>=1.2-1e-9,'A hallgatási pont mögött kevesebb mint 1,20 m van.');
  warn(5,yLR<=yMax+1e-9,'A front hangfalak 0,60 m-nél közelebb kerülnének az oldalfalhoz: kisebb szög vagy előrébb ülés.');
  warn(6,yL>=Ws/2+0.15-1e-9,'A front hangfalak a kép szélén belül vannak: kisebb kép.');
  if(P.fmt==='7.1'){warn('7.1',L-xM>=1.5-1e-9,'7.1: a hallgatási pont mögött csak '+cinR3(L-xM)+' m van (1,50 kell) — az 5.1 jobb lehet.');
    warn(7,2*Math.abs(rear.y)>=1.0,'7.1: a hátsó pár '+cinR3(2*Math.abs(rear.y))+' m-re van egymástól (1,00 kell) — 5.1 javasolt.');}
  warn(8,xS<=L-0.3+1e-9&&(!pj||pj.x<=L-0.3+1e-9),'Az oldalsó surround vagy a projektor túl közel a hátsó falhoz.');
  if(set==='D'&&pj&&P.shiftMax!=null)warn('D-shift',Math.abs(pj.shiftPct)<=+P.shiftMax+1e-9,'Lencse-eltolás: '+Math.round(pj.shiftPct)+' % kellene, a projektor '+P.shiftMax+' %-ot tud — lejjebb kell szerelni (rúd), ami a sugár helyét eszi (§3.8).');
  if(band)warn(10,band.ok,'Nincs sín-világításra alkalmas mennyezeti sáv a sugár mellett: fal- vagy rejtett világítás.');
  warn(11,!square,'Négyzetes helyiség (H ≈ Sz): legalább 2, inkább 4 mélysugárzó.');
  checks.forEach(c=>{if(c.ok&&(c.n==='B'||c.n==='D'||c.n==='E'))c.note=true;});   // the set's own line: shown even when fine
  return {in:P,set,seatBand:sband,wsRange,xMLP:xM,D,Ws,WsAng,WsH,bind,Hs,zBot,zTop,phi,alpha:a,rear,spk,subs,pj,beam,band,dist,modes,square,checks,
    viable71:L-xM>=1.5-1e-9};}
window.cinCalc=cinCalc;window.CIN_DEF=CIN_DEF;
