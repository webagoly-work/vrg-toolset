// ==========================================================================
// 05zc-objart-konyha.js — object line-art batch V8b · Konyha (Views WP V8, docs/views/WORKPLAN.md § V8):
//                         14 kitchen objects on 14 new families, drawn with the 05zb machinery
//                         (prefixes oaKo / OA_KO)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Frames, classes and the resizing rule are those of 05zb (D-V8-1 A): parts are recounted from w/d/h, small
// details keep a fixed mm size, an object with nothing to count stretches. Families (fixed mm · what is counted):
//   sarok        corner base unit, L-door on the front and the right face; worktop 40 / overhang 30 on both open
//                faces, plinth 100, door 18 · leaves per face = ceil(face / 600), shelves = round(760 / 380) − 1
//   fiokos       drawer base; worktop 40, plinth 100, top drawer 144 · units ceil(w / 600), drawers per unit =
//                1 + round((h − 284) / 300) (one shallow on top, the rest equal below)
//   beepito      tall housing unit; plinth 100, handle zone 20, door 18, appliance niche 600 high from 860 ·
//                columns ceil(w / 600), niche in the left one; drawers under it round(760 / 380), doors above
//                round((h − niche top) / 750); other columns a lower + the upper door(s)
//   kamra        open pantry shelving; uprights 30, shelves 25, bottom shelf at 100 · bays ceil((w − 30) / 1000),
//                shelf levels round((h − 100) / 380) + 1
//   sziget       island; worktop 40 / overhang 30 at the front, plinth 100, waterfall end 40 on the left, an open
//                end shelf 300 on the right, bar overhang behind the cabinets (cabinets 620 deep) · units
//                ceil(between / 600) with a drawer + door each, end shelves round(724 / 300) − 1
//   mosogato     sink base; worktop 40, plinth 100, a fixed false front 144, bowl 180 deep, tap hole r 18 ·
//                doors ceil(w / 600), bowls ceil((w − 100) / 700) (≤ 450 wide each)
//   tuzhely      freestanding cooker; handle zone 40, pan supports 30, control panel 120, storage drawer 140 ·
//                burner columns round(w / 300) × 2 rows, a knob per burner
//   indukcio     induction hob in a worktop; glass 6, body inset 30, control strip 70 · zones round(w / 350) × 2
//   suto         built-in oven, stretches; handle zone 40, fascia 20, control strip 100, 2 knobs, display 140
//   mikro        built-in microwave, stretches; handle zone 30, fascia 20, control column ≤ 140, side-hinged door
//   amhuto       American fridge; handle zone 40, door 70, kick strip 60, handles ≤ 900 · side-by-side (2 doors,
//                freezer 0.45 w left with the dispenser) from w 750, else one door
//   mosogatogep  freestanding dishwasher; lid 20, kick plate 100 (20 below h 700), control panel 100, drop door ·
//                racks round((h − 200) / 220), 1 … 3, hidden in the side view
//   para         chimney hood; rim 70, chimney ≤ 260 × 260 at the back, telescopic joint · grease filters
//                ceil(w / 300), hidden in the top view
//   kave         countertop coffee machine, stretches; drip tray 30 proud, display 50, two spouts, tank, hopper
// Hinged doors carry the 05zb swing mark (D-V8-2 2b A); side-hinged doors hinge as 2c A, drop-down doors
// (oven, cooker, dishwasher) point their mark at the bottom hinge.

const OA_KO={wt:40,ov:30,door:18};     // the 05zb worktop run: worktop 40, front overhang 30, door 18
// the swing mark of a bottom-hinged (drop-down) door: from the top corners to the middle of the bottom
function oaKoDrop(P,a0,a1,b0,b1){P.poly([[a0,b1],[(a0+a1)/2,b0],[a1,b1]],'hid');}
// the plinth of a base unit in the side view, as 05zb pult: the board 50 behind the worktop edge, two legs
function oaKoPlinthS(P,ov,f,d,pl){P.rect(ov+50,0,ov+68,pl,'det+fill');P.rect(f+60,0,f+90,pl,'det');P.rect(d-60,0,d-30,pl,'det');}

Object.assign(OA_FAM,{
  // Konyhapult (sarok): the corner cell of an L run, open on the front and the right face (L-door), closed on
  // the left and the back. The front leaf hinges on the carcass (left), the side leaf on the front leaf (its
  // front edge, the left of the R drawing). Not symmetric, so L and R are drawn separately.
  sarok:{resize:'param',
    k(s){const {wt,ov,door}=OA_KO,pl=Math.min(100,s.h*.15),dTop=s.h-wt,f=ov+door;
      return {wt,ov,door,pl,dTop,f,xr:s.w/2-ov,hy:dTop-52,spF:oaSplit(s.w-ov,600),spR:oaSplit(s.d-f,600),
        sh:Math.max(0,Math.round((dTop-pl)/380)-1)};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,k.xr-50,k.pl,'det+fill');
      P.rect(-s.w/2,k.pl,k.xr,k.dTop,'out+fill');
      oaDoors(P,-s.w/2,k.xr,k.pl,k.dTop,{n:k.spF.n,handle:'top'});
      P.rect(-s.w/2,k.dTop,s.w/2,s.h,'out+fill');},
    L(P,s){const k=this.k(s);                                             // the closed side
      P.rect(k.f,k.pl,s.d,k.dTop,'out+fill');
      P.rect(k.ov,k.pl+2,k.f,k.dTop-2,'det+fill');
      P.rect(2,k.hy-6,k.ov,k.hy+6,'det+fill');
      oaKoPlinthS(P,k.ov,k.f,s.d,k.pl);
      for(let j=1;j<=k.sh;j++){const y=k.pl+(k.dTop-k.pl)*j/(k.sh+1);P.line(k.f+18,y,s.d-18,y,'hid',{part:'shelf'});}
      P.rect(0,k.dTop,s.d,s.h,'out+fill');},
    R(P,s){const k=this.k(s);                                             // the open side, the second leaf
      P.rect(k.ov+50,0,s.d,k.pl,'det+fill');
      P.rect(k.ov,k.pl,s.d,k.dTop,'out+fill');
      P.rect(k.ov,k.pl+2,k.f,k.dTop-2,'det+fill');                         // the front leaf, edge on
      oaDoors(P,k.f,s.d,k.pl,k.dTop,{n:k.spR.n,handle:'top'});
      P.rect(2,k.hy-6,k.ov,k.hy+6,'det+fill');
      P.rect(0,k.dTop,s.d,s.h,'out+fill');},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill');
      P.poly([[-s.w/2,k.ov],[k.xr,k.ov],[k.xr,s.d]],'hid');}},            // the fronts under both overhangs

  // Fiókos alsó: a drawer base unit, one shallow drawer on top and equal deep ones below
  fiokos:{resize:'param',
    k(s){const {wt,ov,door}=OA_KO,pl=Math.min(100,s.h*.15),dTop=s.h-wt,top=Math.min(144,(dTop-pl)/2);
      const nd=Math.max(1,Math.round((dTop-pl-top)/300)),rh=(dTop-pl-top)/nd,rows=[];
      for(let r=0;r<nd;r++)rows.push({y0:pl+r*rh,y1:pl+(r+1)*rh,hy:pl+(r+1)*rh-52});
      rows.push({y0:dTop-top,y1:dTop,hy:dTop-top/2});
      return {wt,ov,door,pl,dTop,f:ov+door,rows,sp:oaSplit(s.w,600)};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,k.pl,'det+fill');
      P.rect(-s.w/2,k.pl,s.w/2,k.dTop,'out+fill');
      for(let i=0;i<k.sp.n;i++){const x0=-s.w/2+i*k.sp.u+2,x1=-s.w/2+(i+1)*k.sp.u-2;
        for(const r of k.rows){P.rect(x0,r.y0+2,x1,r.y1-2,'det+fill',{part:'drawer'});oaHandle(P,(x0+x1)/2,r.hy,Math.min(160,x1-x0-80),'h');}}
      P.rect(-s.w/2,k.dTop,s.w/2,s.h,'out+fill');},
    S(P,s){const k=this.k(s);
      P.rect(k.f,k.pl,s.d,k.dTop,'out+fill');
      for(const r of k.rows){P.rect(k.ov,r.y0+2,k.f,r.y1-2,'det+fill');P.rect(2,r.hy-6,k.ov,r.hy+6,'det+fill');
        P.rect(k.f+20,r.y0+30,s.d-50,r.y1-40,'hid');}                     // the drawer box
      oaKoPlinthS(P,k.ov,k.f,s.d,k.pl);
      P.rect(0,k.dTop,s.d,s.h,'out+fill');},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill');
      P.line(-s.w/2,k.ov,s.w/2,k.ov,'hid');
      for(let i=1;i<k.sp.n;i++){const x=-s.w/2+i*k.sp.u;P.line(x,k.ov,x,s.d,'hid',{part:'joint'});}}},

  // Magas szekrény (beépítő): a tall housing unit; the left column holds the appliance niche (drawers under it,
  // door(s) above), any further column is a pantry with a lower and an upper door; the niche is left empty
  beepito:{resize:'param',
    k(s){const hz=20,door=18,pl=Math.min(100,s.h*.06),nb=Math.min(860,s.h*.4),nt=Math.min(nb+600,s.h-150);
      const ur=Math.max(1,Math.round((s.h-nt)/750));
      return {hz,door,f:hz+door,pl,nb,nt,dr:Math.max(1,Math.round((nb-pl)/380)),ur,uh:(s.h-nt)/ur,sp:oaSplit(s.w,600)};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,k.pl,'det+fill');
      P.rect(-s.w/2,k.pl,s.w/2,s.h,'out+fill');
      for(let i=0;i<k.sp.n;i++){const x0=-s.w/2+i*k.sp.u,x1=x0+k.sp.u,hinge=i<k.sp.n/2?'left':'right';
        if(i===0){oaDrawers(P,x0,x1,k.pl,k.nb,{n:1,rows:k.dr});
          P.rect(x0+2,k.nb,x1-2,k.nt,'out+fill',{part:'niche'});P.rect(x0+18,k.nb+18,x1-18,k.nt,'det');}
        else oaDoors(P,x0,x1,k.pl,k.nt,{n:1,hinge,handle:'top'});
        for(let r=0;r<k.ur;r++){const y0=k.nt+r*k.uh;oaDoors(P,x0,x1,y0,y0+k.uh,{n:1,hinge,handle:'bottom',hy:60});}}},
    S(P,s){const k=this.k(s),dh=(k.nb-k.pl)/k.dr,strip=(y0,y1,hy)=>{P.rect(k.hz,y0+2,k.f,y1-2,'det+fill');P.rect(2,hy-6,k.hz,hy+6,'det+fill');};
      P.rect(k.f,k.pl,s.d,s.h,'out+fill');
      if(k.sp.n>1)strip(k.pl,k.nt,k.nt-52);                                // the pantry door, seen through the niche
      for(let r=0;r<k.dr;r++)strip(k.pl+r*dh,k.pl+(r+1)*dh,k.pl+(r+.5)*dh);
      for(let r=0;r<k.ur;r++){const y0=k.nt+r*k.uh;strip(y0,y0+k.uh,y0+60);}
      P.rect(k.f,k.nb+18,s.d-40,k.nt,'hid');                               // the niche
      oaKoPlinthS(P,k.hz,k.f,s.d,k.pl);},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2,k.f,s.w/2,s.d,'out+fill');
      for(let i=0;i<k.sp.n;i++){const x0=-s.w/2+i*k.sp.u+2,x1=-s.w/2+(i+1)*k.sp.u-2,xc=(x0+x1)/2,hl=Math.min(160,x1-x0-80);
        P.rect(x0,k.hz,x1,k.f,'det+fill');P.rect(xc-hl/2,2,xc+hl/2,k.hz,'det+fill');}}},

  // Kamrapolc: open pantry shelving, uprights at every bay, shelves at equal steps from 100 to the top
  kamra:{resize:'param',
    k(s){const up=30,st=25,b0=Math.min(100,s.h*.1),sp=oaSplit(s.w-up,1000),lv=Math.max(2,Math.round((s.h-b0)/380)+1),xs=[],ys=[];
      for(let i=0;i<=sp.n;i++)xs.push(-s.w/2+i*(s.w-up)/sp.n);
      for(let j=0;j<lv;j++)ys.push(b0+j*(s.h-st-b0)/(lv-1));
      return {up,st,xs,ys};},
    F(P,s){const k=this.k(s);
      for(let i=0;i+1<k.xs.length;i++)for(const y of k.ys)P.rect(k.xs[i]+k.up,y,k.xs[i+1],y+k.st,'out+fill',{part:'shelf'});
      for(const x of k.xs){P.rect(x,0,x+k.up,s.h,'out+fill');P.line(x,15,x+k.up,15,'det');}},
    S(P,s){const k=this.k(s);
      for(const y of k.ys)P.rect(k.up,y,s.d-k.up,y+k.st,'out+fill',{part:'shelf'});
      P.rect(0,0,k.up,s.h,'out+fill');P.rect(s.d-k.up,0,s.d,s.h,'out+fill');
      P.line(0,15,k.up,15,'det');P.line(s.d-k.up,15,s.d,15,'det');},
    T(P,s){const k=this.k(s);
      for(let i=0;i+1<k.xs.length;i++)P.rect(k.xs[i]+k.up,0,k.xs[i+1],s.d,'det+fill');
      for(const x of k.xs){P.rect(x,0,x+k.up,s.d,'det+fill');P.rect(x,0,x+k.up,k.up,'out+fill');P.rect(x,s.d-k.up,x+k.up,s.d,'out+fill');}
      P.rect(-s.w/2,0,s.w/2,s.d,'out');}},

  // Konyhasziget: worktop 40 over the full footprint, cabinets 620 deep at the front, the bar overhang behind;
  // a waterfall end on the left (L), open end shelves on the right (R). Not symmetric.
  sziget:{resize:'param',
    k(s){const {wt,ov,door}=OA_KO,pl=Math.min(100,s.h*.15),dTop=s.h-wt,wf=40,es=Math.min(300,s.w*.2),cb=Math.min(s.d-250,620);
      const x0=-s.w/2+wf,x1=s.w/2-es;
      return {wt,ov,door,pl,dTop,dBot:dTop-144,f:ov+door,wf,es,cb,x0,x1,sp:oaSplit(x1-x0,600),
        sh:Math.max(0,Math.round((dTop-pl-36)/300)-1)};},
    F(P,s){const k=this.k(s);
      P.rect(k.x0,0,s.w/2-50,k.pl,'det+fill');
      P.rect(k.x0,k.pl,k.x1,k.dTop,'out+fill');
      oaDrawers(P,k.x0,k.x1,k.dBot,k.dTop,{n:k.sp.n,rows:1});
      oaDoors(P,k.x0,k.x1,k.pl,k.dBot,{n:k.sp.n,handle:'top'});
      P.rect(k.x1,k.pl,s.w/2,k.dTop,'out+fill');                           // the end shelf's closed front side
      P.poly([[-s.w/2,0],[-s.w/2,s.h],[s.w/2,s.h],[s.w/2,k.dTop],[k.x0,k.dTop],[k.x0,0]],'out+fill',{close:true});
      P.line(-s.w/2,s.h,k.x0,k.dTop,'det');},                              // the waterfall mitre
    L(P,s){const k=this.k(s);                                             // the waterfall end
      P.rect(0,0,s.d,s.h,'out+fill');
      P.rect(k.f,k.pl,k.cb,k.dTop,'hid');
      P.line(0,k.dTop,s.d,k.dTop,'hid');},
    R(P,s){const k=this.k(s),dm=(k.dBot+k.dTop)/2,hy=k.dBot-52,o0=k.ov+18,o1=k.cb-18;
      P.rect(k.cb,0,s.d,k.dTop,'det');                                     // the waterfall, seen under the bar overhang
      P.rect(k.ov+50,0,k.cb-50,k.pl,'det+fill');
      P.rect(k.ov,k.pl,k.cb,k.dTop,'out+fill');
      P.rect(o0,k.pl+18,o1,k.dTop-18,'det');
      for(let j=1;j<=k.sh;j++){const y=k.pl+18+(k.dTop-k.pl-36)*j/(k.sh+1);P.rect(o0,y-9,o1,y+9,'det+fill',{part:'shelf'});}
      P.rect(2,dm-6,k.ov,dm+6,'det+fill');P.rect(2,hy-6,k.ov,hy+6,'det+fill');
      P.rect(0,k.dTop,s.d,s.h,'out+fill');},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill');
      P.line(k.x0,k.ov,s.w/2,k.ov,'hid');
      for(let i=1;i<k.sp.n;i++){const x=k.x0+i*k.sp.u;P.line(x,k.ov,x,k.cb,'hid',{part:'joint'});}
      P.line(k.x1,k.ov,k.x1,k.cb,'hid');
      P.line(k.x0,k.cb,s.w/2,k.cb,'hid');
      P.line(k.x0,0,k.x0,s.d,'hid');}},

  // Mosogató: a sink base unit, a fixed false front on top, doors below, an inset sink with a tap hole (the tap
  // itself would stand above the box, so it is not drawn); bowl and trap hidden in the side view
  mosogato:{resize:'param',
    k(s){const {wt,ov,door}=OA_KO,pl=Math.min(100,s.h*.15),dTop=s.h-wt,bn=oaSplit(s.w-100,700).n;
      const bw=Math.min(450,(s.w-160-(bn-1)*60)/bn),bd=Math.min(400,s.d-220),rw=bn*bw+(bn-1)*60+60;
      return {wt,ov,door,pl,dTop,dBot:dTop-144,f:ov+door,sp:oaSplit(s.w,600),bn,bw,bd,rw,bx:i=>-rw/2+30+i*(bw+60)};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,k.pl,'det+fill');
      P.rect(-s.w/2,k.pl,s.w/2,k.dTop,'out+fill');
      for(let i=0;i<k.sp.n;i++)P.rect(-s.w/2+i*k.sp.u+2,k.dBot+2,-s.w/2+(i+1)*k.sp.u-2,k.dTop-2,'det+fill',{part:'panel'});
      oaDoors(P,-s.w/2,s.w/2,k.pl,k.dBot,{n:k.sp.n,handle:'top'});
      for(let i=0;i<k.bn;i++)P.rect(k.bx(i),k.dTop-180,k.bx(i)+k.bw,k.dTop,'hid',{rb:20});
      P.rect(-s.w/2,k.dTop,s.w/2,s.h,'out+fill');},
    S(P,s){const k=this.k(s),hy=k.dBot-52,b0=80,b1=80+k.bd,bc=(b0+b1)/2,y=k.dTop-180;
      P.rect(k.f,k.pl,s.d,k.dTop,'out+fill');
      P.rect(k.ov,k.dBot+2,k.f,k.dTop-2,'det+fill');P.rect(k.ov,k.pl+2,k.f,k.dBot-2,'det+fill');
      P.rect(2,hy-6,k.ov,hy+6,'det+fill');
      oaKoPlinthS(P,k.ov,k.f,s.d,k.pl);
      P.rect(b0,y,b1,k.dTop,'hid',{rb:20});
      P.path([['M',bc,y],['L',bc,y-150],['Q',bc,y-200,bc+50,y-200],['Q',bc+100,y-200,bc+100,y-150],['L',bc+100,y-120],['L',s.d-20,y-120]],'hid');
      P.rect(0,k.dTop,s.d,s.h,'out+fill');},
    T(P,s){const k=this.k(s),r1=50+30+k.bd+80;
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill');
      P.line(-s.w/2,k.ov,s.w/2,k.ov,'hid');
      for(let i=1;i<k.sp.n;i++){const x=-s.w/2+i*k.sp.u;P.line(x,k.ov,x,s.d,'hid',{part:'joint'});}
      P.rect(-k.rw/2,50,k.rw/2,r1,'det+fill',{rx:20});
      for(let i=0;i<k.bn;i++){const x0=k.bx(i);P.rect(x0,80,x0+k.bw,80+k.bd,'det+fill',{rx:30,part:'bowl'});P.circ(x0+k.bw/2,80+k.bd*.6,22,'det');}
      P.circ(0,r1-40,18,'det');}},

  // Tűzhely: a freestanding cooker; pan supports on top, the control panel with a knob per burner, the drop-down
  // oven door with a window and a bar handle, a storage drawer below; the oven cavity hidden in the side view
  tuzhely:{resize:'param',
    k(s){const hz=40,top=s.h-30,pan=top-120,cols=Math.max(1,Math.round(s.w/300));
      return {hz,top,pan,d0:160,d1:pan-2,cols,n:cols*2,cw:s.w/cols};},
    F(P,s){const k=this.k(s),x0=-s.w/2+10,x1=s.w/2-10,ky=(k.pan+k.top)/2;
      for(let c=0;c<k.cols;c++){const cx=-s.w/2+(c+.5)*k.cw;P.rect(cx-k.cw/2+20,k.top,cx+k.cw/2-20,s.h,'det');}
      P.rect(-s.w/2,0,s.w/2,k.top,'out+fill');
      P.line(-s.w/2,k.pan,s.w/2,k.pan,'det');
      for(let i=0;i<k.n;i++){const x=-s.w/2+(i+.5)*s.w/k.n;P.circ(x,ky,18,'det+fill',{part:'knob'});P.line(x,ky+4,x,ky+16,'det');}
      P.rect(x0,k.d0,x1,k.d1,'det+fill',{part:'door'});
      P.rect(x0+60,k.d0+70,x1-60,k.d1-110,'det',{rx:15});
      oaKoDrop(P,x0,x1,k.d0,k.d1);
      oaHandle(P,0,k.d1-45,s.w-140,'h');
      P.rect(x0,10,x1,150,'det+fill',{part:'drawer'});
      oaHandle(P,0,80,Math.min(160,s.w-100),'h');},
    S(P,s){const k=this.k(s),hy=k.d1-45,ky=(k.pan+k.top)/2;
      P.rect(k.hz+20,k.top,s.d-60,s.h,'det');
      P.rect(k.hz,0,s.d,k.top,'out+fill');
      P.rect(k.hz,k.d0,k.hz+40,k.d1,'det+fill');P.rect(k.hz,10,k.hz+40,150,'det+fill');
      P.rect(k.hz+60,k.d0+40,s.d-80,k.d1-60,'hid',{rx:20});               // the oven cavity
      P.rect(2,hy-6,16,hy+6,'det+fill',{rx:6});P.rect(16,hy-4,k.hz,hy+4,'det+fill');
      P.rect(k.hz-20,74,k.hz,86,'det+fill');
      P.rect(k.hz-25,ky-14,k.hz,ky+14,'det+fill',{rx:4});},
    T(P,s){const k=this.k(s),hl=s.w-140;
      P.rect(-s.w/2,k.hz,s.w/2,s.d,'out+fill',{rx:4});
      for(let c=0;c<k.cols;c++){const cx=-s.w/2+(c+.5)*k.cw;
        P.rect(cx-k.cw/2+20,k.hz+20,cx+k.cw/2-20,s.d-20,'det',{rx:10});
        [.3,.72].forEach((f,r)=>{const cy=k.hz+(s.d-k.hz)*f,R=(c+r)%2?35:50;P.circ(cx,cy,R,'det',{part:'burner'});P.circ(cx,cy,R*.5,'det');});}
      for(let i=0;i<k.n;i++){const x=-s.w/2+(i+.5)*s.w/k.n;P.rect(x-14,k.hz-25,x+14,k.hz,'det+fill');}
      P.rect(-hl/2,2,hl/2,16,'det+fill',{rx:6});P.rect(-hl/2+20,16,-hl/2+32,k.hz,'det+fill');P.rect(hl/2-32,16,hl/2-20,k.hz,'det+fill');}},

  // Indukciós főzőlap: the glass plate on its body (seen above the worktop it sits in), zones in two rows,
  // a slider control strip at the front
  indukcio:{resize:'param',
    k(s){const cols=Math.max(1,Math.round(s.w/350)),g=Math.min(6,s.h*.2),cs=70;return {cols,g,cs,cw:s.w/cols,rh:(s.d-cs-20)/2};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2+30,0,s.w/2-30,s.h-k.g,'out+fill');
      for(let x=-s.w/2+80;x<=s.w/2-80+1e-6;x+=40)P.line(x,12,x,s.h-k.g-12,'det');
      P.rect(-s.w/2,s.h-k.g,s.w/2,s.h,'out+fill');},
    T(P,s){const k=this.k(s),R0=Math.min(k.cw,k.rh)*.45,sw=Math.min(s.w*.5,300);
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill',{rx:8});
      for(let c=0;c<k.cols;c++)for(let r=0;r<2;r++){const cx=-s.w/2+(c+.5)*k.cw,cy=k.cs+(r+.5)*k.rh;
        P.circ(cx,cy,(c+r)%2?R0*.75:R0,'det',{part:'zone'});}
      P.rect(-sw/2,22,sw/2,48,'det',{rx:13});
      P.circ(s.w/2-45,35,10,'det');}},

  // Sütő beépített: nothing to count, so it stretches (D-V8-1); fixed: handle zone 40, fascia 20, control strip
  // 100 with two knobs and a display, the bar handle 45 below the strip, window 60 / 50 in from the door edges
  suto:{resize:'stretch',
    k(s){const cs=Math.min(100,s.h*.25),dt=s.h-cs;return {hz:40,fa:20,cs,dt,hl:s.w-140,kx:s.w/2-70,hy:dt-45,ky:dt+cs/2};},
    F(P,s){const k=this.k(s),x0=-s.w/2+6,x1=s.w/2-6,y0=6,y1=k.dt-3;
      P.rect(-s.w/2,0,s.w/2,s.h,'out+fill');
      P.line(-s.w/2,k.dt,s.w/2,k.dt,'det');
      P.rect(x0,y0,x1,y1,'det+fill',{part:'door'});
      P.rect(x0+60,y0+50,x1-60,y1-100,'det',{rx:15});
      oaKoDrop(P,x0,x1,y0,y1);
      oaHandle(P,0,k.hy,k.hl,'h');
      for(const x of [-k.kx,k.kx]){P.circ(x,k.ky,20,'det+fill',{part:'knob'});P.line(x,k.ky+5,x,k.ky+17,'det');}
      P.rect(-70,k.ky-18,70,k.ky+18,'det',{rx:4});},
    S(P,s){const k=this.k(s);
      P.rect(k.hz+k.fa,15,s.d,s.h-20,'out+fill');
      P.rect(k.hz,0,k.hz+k.fa,s.h,'out+fill');
      P.rect(k.hz+40,50,s.d-60,k.dt-60,'hid',{rx:15});                    // the oven cavity
      P.rect(2,k.hy-6,16,k.hy+6,'det+fill',{rx:6});P.rect(16,k.hy-4,k.hz,k.hy+4,'det+fill');
      P.rect(k.hz-22,k.ky-15,k.hz,k.ky+15,'det+fill',{rx:4});},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2+18,k.hz+k.fa,s.w/2-18,s.d,'out+fill');
      P.rect(-s.w/2,k.hz,s.w/2,k.hz+k.fa,'out+fill');
      for(const x of [-k.kx,k.kx])P.rect(x-15,k.hz-22,x+15,k.hz,'det+fill');
      P.rect(-k.hl/2,2,k.hl/2,16,'det+fill',{rx:6});P.rect(-k.hl/2+20,16,-k.hl/2+32,k.hz,'det+fill');P.rect(k.hl/2-32,16,k.hl/2-20,k.hz,'det+fill');}},

  // Mikró beépített: stretches; fixed: handle zone 30, fascia 20, a control column ≤ 140 on the right (display,
  // knob, two buttons), the door hinged left with a vertical bar handle ≤ 200
  mikro:{resize:'stretch',
    k(s){const cp=Math.min(140,s.w*.25);return {hz:30,fa:20,cp,dx:s.w/2-cp,cx:s.w/2-cp/2,hx:s.w/2-cp-35,hl:Math.min(200,s.h-120),ky:s.h/2-30};},
    F(P,s){const k=this.k(s),x0=-s.w/2+4,x1=k.dx-2,y0=4,y1=s.h-4;
      P.rect(-s.w/2,0,s.w/2,s.h,'out+fill');
      P.rect(x0,y0,x1,y1,'det+fill',{part:'door'});
      P.rect(x0+46,y0+46,x1-90,y1-46,'det',{rx:12});
      oaSwing(P,x0,x1,y0,y1,'left');
      oaHandle(P,k.hx,s.h/2,k.hl,'v');
      P.rect(k.cx-40,s.h-90,k.cx+40,s.h-55,'det',{rx:4});
      P.circ(k.cx,k.ky,25,'det+fill',{part:'knob'});P.line(k.cx,k.ky+8,k.cx,k.ky+22,'det');
      P.circ(k.cx-25,80,8,'det');P.circ(k.cx+25,80,8,'det');},
    S(P,s){const k=this.k(s),y0=s.h/2-k.hl/2,y1=s.h/2+k.hl/2;
      P.rect(k.hz+k.fa,10,s.d,s.h-10,'out+fill');
      P.rect(k.hz,0,k.hz+k.fa,s.h,'out+fill');
      P.rect(k.hz+40,40,s.d-80,s.h-60,'hid',{rx:10});                     // the cavity
      P.line(k.hz+60,55,s.d-100,55,'hid');                                 // the turntable
      P.rect(2,y0,14,y1,'det+fill',{rx:6});P.rect(14,y0,k.hz,y0+15,'det+fill');P.rect(14,y1-15,k.hz,y1,'det+fill');
      P.rect(k.hz-18,k.ky-25,k.hz,k.ky+25,'det+fill',{rx:4});},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2+20,k.hz+k.fa,s.w/2-20,s.d,'out+fill');
      P.rect(-s.w/2,k.hz,s.w/2,k.hz+k.fa,'out+fill');
      P.rect(k.hx-6,2,k.hx+6,14,'det+fill',{rx:6});P.rect(k.hx-4,14,k.hx+4,k.hz,'det+fill');
      P.rect(k.cx-25,k.hz-18,k.cx+25,k.hz,'det+fill');}},

  // Amerikai hűtő: side-by-side from w 750 (freezer 0.45 w on the left with the ice / water dispenser, hinged
  // left; fridge on the right, hinged right; long bar handles where the doors meet), else a single door hinged
  // left; kick strip with vent slots, compressor hidden in the side view
  amhuto:{resize:'param',
    k(s){const hz=40,door=70,kick=60,two=s.w>=750;
      return {hz,door,f:hz+door,kick,two,xm:two?-s.w/2+Math.round(s.w*.45):s.w/2,hl:Math.min(900,(s.h-kick)*.5),hb:kick+(s.h-kick)*.55};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.h,'out+fill',{rt:10});
      P.rect(-s.w/2+20,8,s.w/2-20,k.kick-8,'det');
      for(let x=-s.w/2+60;x<=s.w/2-60+1e-6;x+=40)P.line(x,20,x,k.kick-20,'det');
      oaDoors(P,-s.w/2,k.xm,k.kick,s.h,{n:1,hinge:'left',handle:'side',hb:k.hb,hlen:k.hl,rt:8});
      if(!k.two)return;
      oaDoors(P,k.xm,s.w/2,k.kick,s.h,{n:1,hinge:'right',handle:'side',hb:k.hb,hlen:k.hl,rt:8});
      const cx=(-s.w/2+k.xm)/2,dw=Math.min(220,(k.xm+s.w/2)*.55),db=Math.min(s.h*.5,1000);
      P.rect(cx-dw/2,db,cx+dw/2,db+330,'det+fill',{rx:12,part:'dispenser'});
      P.rect(cx-dw/2+30,db+60,cx+dw/2-30,db+250,'det',{rx:8});
      P.line(cx-dw/2+20,db+30,cx+dw/2-20,db+30,'det');},
    S(P,s){const k=this.k(s),y0=k.hb-k.hl/2,y1=k.hb+k.hl/2;
      P.rect(k.f,0,s.d,s.h,'out+fill',{rt:10});
      P.rect(k.f-20,8,k.f,k.kick-2,'det+fill');
      P.rect(k.hz,k.kick+2,k.f,s.h-2,'det+fill',{rt:6});
      P.rect(2,y0,16,y1,'det+fill',{rx:6});P.rect(16,y0,k.hz,y0+20,'det+fill');P.rect(16,y1-20,k.hz,y1,'det+fill');
      P.rect(s.d-240,30,s.d-40,280,'hid',{rx:20});},                      // the compressor
    T(P,s){const k=this.k(s),doors=k.two?[[-s.w/2,k.xm,'left'],[k.xm,s.w/2,'right']]:[[-s.w/2,s.w/2,'left']];
      P.rect(-s.w/2,k.f,s.w/2,s.d,'out+fill',{rx:10});
      for(const [a0,a1,hg] of doors){const xa=hg==='left'?a1-47:a0+47;
        P.rect(a0+2,k.hz,a1-2,k.f,'det+fill');P.rect(xa-6,2,xa+6,16,'det+fill',{rx:6});P.rect(xa-4,16,xa+4,k.hz,'det+fill');}}},

  // Mosogatógép (freestanding): lid 20, kick plate 100 (none on a table-top model below h 700), control panel
  // 100 with display and buttons, a recessed grip, the drop-down door; racks hidden in the side view
  mosogatogep:{resize:'param',
    k(s){const lid=20,kick=s.h>=700?100:20,dt=s.h-lid-2,cp=Math.min(100,(s.h-lid-kick)*.3);
      return {lid,kick,dt,dp:dt-cp,df:50,racks:Math.max(1,Math.min(3,Math.round((s.h-200)/220)))};},
    F(P,s){const k=this.k(s),x0=-s.w/2+2,x1=s.w/2-2,cy=(k.dp+k.dt)/2;
      P.rect(-s.w/2,0,s.w/2,s.h-k.lid,'out+fill');
      P.rect(-s.w/2,s.h-k.lid,s.w/2,s.h,'out+fill',{rt:4});
      if(k.kick>40)P.rect(-s.w/2+10,0,s.w/2-10,k.kick,'det');
      P.rect(x0,k.kick+2,x1,k.dt,'det+fill',{part:'door'});
      P.line(x0,k.dp,x1,k.dp,'det');
      oaKoDrop(P,x0,x1,k.kick+2,k.dp);
      P.rect(-70,k.dp-26,70,k.dp-8,'det+fill',{rx:9});
      P.rect(-s.w/2+40,cy-18,-s.w/2+150,cy+18,'det',{rx:4});
      for(let i=0;i<4;i++)P.circ(s.w/2-50-i*35,cy,8,'det');},
    S(P,s){const k=this.k(s),z0=k.kick+40,zh=(s.h-k.lid-60-z0)/k.racks;
      P.rect(k.df,0,s.d,s.h-k.lid,'out+fill');
      P.rect(0,k.kick+2,k.df,k.dt,'det+fill');
      if(k.kick>40)P.rect(10,0,k.df,k.kick,'det+fill');
      P.rect(0,s.h-k.lid,s.d,s.h,'out+fill',{rt:4});
      for(let j=0;j<k.racks;j++){const y0=z0+j*zh+10;P.rect(k.df+40,y0,s.d-60,y0+Math.min(160,zh*.6),'hid',{rx:8,part:'rack'});}},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill',{rx:6});
      P.line(-s.w/2,k.df,s.w/2,k.df,'hid');}},

  // Páraelszívó (chimney hood, origin = its own bottom): rim 70, a hipped canopy up to the chimney ≤ 260 × 260
  // at the back, telescopic joint halfway up; grease filters ceil(w / 300), hidden in the top view; fan hidden
  para:{resize:'param',
    k(s){const rim=Math.min(70,s.h*.15),cb=rim+Math.min(250,(s.h-rim)*.4);
      return {rim,cb,cw:Math.min(260,s.w*.45),cd:Math.min(260,s.d*.55),jy:cb+(s.h-cb)/2,sp:oaSplit(s.w,300)};},
    F(P,s){const k=this.k(s);
      P.rect(-k.cw/2,k.cb,k.cw/2,s.h,'out+fill');
      P.line(-k.cw/2,k.jy,k.cw/2,k.jy,'det');
      P.poly([[-s.w/2,k.rim],[-k.cw/2,k.cb],[k.cw/2,k.cb],[s.w/2,k.rim]],'out+fill',{close:true});
      P.rect(-s.w/2,0,s.w/2,k.rim,'out+fill');
      for(let i=0;i<4;i++){const x=s.w/2-60-i*34;P.rect(x-11,k.rim/2-5,x+11,k.rim/2+5,'det');}},
    S(P,s){const k=this.k(s),cf=s.d-k.cd,r=Math.min(80,(k.cb-k.rim)/2-10);
      P.rect(cf,k.cb,s.d,s.h,'out+fill');
      P.line(cf,k.jy,s.d,k.jy,'det');
      P.poly([[0,k.rim],[cf,k.cb],[s.d,k.cb],[s.d,k.rim]],'out+fill',{close:true});
      P.rect(0,0,s.d,k.rim,'out+fill');
      const cx=s.d-k.cd/2,cy=(k.rim+k.cb)/2;   // the fan (a round rect: circ would not mirror into R)
      if(r>10)P.rect(cx-r,cy-r,cx+r,cy+r,'hid',{rx:r});},
    T(P,s){const k=this.k(s),cf=s.d-k.cd;
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill');
      P.line(-s.w/2,0,-k.cw/2,cf,'det');P.line(s.w/2,0,k.cw/2,cf,'det');
      P.rect(-k.cw/2,cf,k.cw/2,s.d,'out+fill');
      for(let i=0;i<k.sp.n;i++)P.rect(-s.w/2+i*k.sp.u+20,40,-s.w/2+(i+1)*k.sp.u-20,s.d-40,'hid',{part:'filter'});}},

  // Kávégép (pult): stretches; fixed: drip tray 30 proud of the body and 50 high, display 50, the cup bay with a
  // spout head and two spouts, water tank (side), bean hopper and tank lid (top)
  kave:{resize:'stretch',
    F(P,s){const w=s.w,h=s.h,bx=w/2-30;
      P.rect(-w/2,0,w/2,h,'out+fill',{rt:20});
      P.rect(-bx,h-80,bx,h-30,'det',{rx:6});
      for(let i=0;i<3;i++)P.circ(bx-20-i*24,h-55,6,'det');
      P.rect(-bx,20,bx,h-110,'det+fill',{rt:20});
      P.rect(-50,h-150,50,h-115,'det+fill',{rx:8});
      P.rect(-30,h-170,-14,h-150,'det+fill',{part:'spout'});P.rect(14,h-170,30,h-150,'det+fill',{part:'spout'});
      P.rect(-w/2+20,0,w/2-20,50,'det+fill');P.line(-w/2+35,35,w/2-35,35,'det');},
    S(P,s){const d=s.d,h=s.h,tp=30;
      P.rect(tp,0,d,h,'out+fill',{rt:20});
      P.rect(d-130,40,d-20,h-60,'det',{rx:10});                            // the water tank
      P.rect(tp,20,tp+130,h-110,'hid');                                    // the cup bay
      P.rect(0,0,tp,50,'det+fill');},
    T(P,s){const w=s.w,d=s.d,tp=30,r=Math.min(60,w*.2),tw=Math.min(110,w*.35);
      P.rect(-w/2,tp,w/2,d,'out+fill',{rx:20});
      P.rect(-w/2+20,0,w/2-20,tp,'det+fill');
      P.rect(-w/2+20,tp+30,w/2-20,d-170,'det',{rx:10});                    // the cup warmer
      P.circ(-w/2+20+r,d-30-r,r,'det');P.circ(-w/2+20+r,d-30-r,r*.6,'det'); // the bean hopper
      P.rect(w/2-20-tw,d-150,w/2-20,d-20,'det',{rx:8});}}});               // the tank lid

oaReg('sarok',['Konyhapult (sarok)']);
oaReg('fiokos',['Fiókos alsó 60']);
oaReg('beepito',['Magas szekrény (beépítő)']);
oaReg('kamra',['Kamrapolc']);
oaReg('sziget',['Konyhasziget']);
oaReg('mosogato',['Mosogató']);
oaReg('tuzhely',['Tűzhely 60']);
oaReg('indukcio',['Indukciós főzőlap (sziget)']);
oaReg('suto',['Sütő beépített']);
oaReg('mikro',['Mikró beépített']);
oaReg('amhuto',['Amerikai hűtő']);
oaReg('mosogatogep',['Mosogatógép 60']);
oaReg('para',['Páraelszívó']);
oaReg('kave',['Kávégép (pult)']);
