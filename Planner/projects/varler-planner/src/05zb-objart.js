// ==========================================================================
// 05zb-objart.js — object line-art (Views WP V8, docs/views/WORKPLAN.md § V8a): our own front / left /
//                  right / top drawings of the OBJLIB objects, parametric from w/d/h
//                  (prefixes oa / OA_ / objArt)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The clean, colourless elevation look: four classes and nothing else, so a style sheet decides how
// it prints (objArtCss gives the default one, line widths in paper mm at 1 : k).
//   oa-out  outline 0.35 · oa-det  detail 0.18 · oa-hid  hidden 0.13 dashed · oa-fill  white fill
// Hidden lines come from painting back to front with oa-fill; oa-hid only where a hidden part is worth showing.
//
// Every view is drawn in its own 2-D frame (a across, b up) in mm, and the pen maps it to SVG (y = −b):
//   F  a = across (−w/2 … w/2), b = height       viewBox −w/2 −h w h   origin bottom-centre-front
//   L  a = depth from the front, drawn leftwards  viewBox −d −h d h     the front is the right edge
//   R  the same side drawing, drawn rightwards    viewBox 0 −h d h      (sym objects: R = L mirrored)
//   T  a = across, b = depth from the front       viewBox −w/2 −d w d   the front is the bottom edge
// The front is the front-most point including handles, so nothing pokes out of the box. No SVG transforms:
// every coordinate is computed from w/d/h, so line weights never distort when an object is resized.
// Resizing rule (DECISIONS D-V8-1): parts are recounted from w/d/h where the family has parts to count;
// small details keep a fixed mm size in every family; a family with nothing to count (WC) stretches.

const OA_W={out:.35,det:.18,hid:.13};   // paper mm
const OA_DASH=[1.2,.8];                  // paper mm, the oa-hid dash
function objArtCss(k){k=k||20;const r=v=>+(v*k).toFixed(3);
  return '.oa-out,.oa-det,.oa-hid{fill:none;stroke:#000;stroke-linecap:round;stroke-linejoin:round}'+
    '.oa-out{stroke-width:'+r(OA_W.out)+'}.oa-det{stroke-width:'+r(OA_W.det)+'}'+
    '.oa-hid{stroke-width:'+r(OA_W.hid)+';stroke-dasharray:'+r(OA_DASH[0])+' '+r(OA_DASH[1])+'}.oa-fill{fill:#fff}';}

// symmetric rounding to 0.1 mm (so a mirrored view is exactly the negated one), no −0
function oaNum(v){const r=Math.sign(v)*Math.round(Math.abs(v)*10)/10;return r===0?0:r;}

// The pen: rect / line / poly / path / circ in the view's (a, b) frame. cls = 'out' | 'det' | 'hid', with
// '+fill' for a shape that hides what is behind it. o.part tags a counted part; o.rx all corners, o.rt / o.rb
// the top / bottom corners (top = up in the drawing).
function oaPen(map){
  const prims=[],parts={};let body='';
  const pt=(a,b)=>{const p=map(a,b);return [oaNum(p[0]),oaNum(-p[1])];};
  const cl=c=>{const q=c.split('+');return 'oa-'+q[0]+(q[1]==='fill'?' oa-fill':'');};
  const put=(kind,cls,pts,o,s)=>{const part=o&&o.part||null;prims.push({kind,cls:cl(cls),pts,part});
    if(part)parts[part]=(parts[part]||0)+1;body+=s;};
  return {parts,prims,body:()=>body,
    rect(a0,b0,a1,b1,cls,o){o=o||{};const p=pt(a0,b0),q=pt(a1,b1);
      const x0=Math.min(p[0],q[0]),x1=Math.max(p[0],q[0]),y0=Math.min(p[1],q[1]),y1=Math.max(p[1],q[1]);
      const pts=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],lim=Math.min(x1-x0,y1-y0)/2;
      const rt=oaNum(Math.min(lim,o.rt!=null?o.rt:o.rx||0)),rb=oaNum(Math.min(lim,o.rb!=null?o.rb:o.rx||0));
      if(!rt&&!rb)return put('rect',cls,pts,o,`<rect x="${x0}" y="${y0}" width="${oaNum(x1-x0)}" height="${oaNum(y1-y0)}" class="${cl(cls)}"/>`);
      const d=`M${oaNum(x0+rt)} ${y0}H${oaNum(x1-rt)}Q${x1} ${y0} ${x1} ${oaNum(y0+rt)}V${oaNum(y1-rb)}Q${x1} ${y1} ${oaNum(x1-rb)} ${y1}`+
        `H${oaNum(x0+rb)}Q${x0} ${y1} ${x0} ${oaNum(y1-rb)}V${oaNum(y0+rt)}Q${x0} ${y0} ${oaNum(x0+rt)} ${y0}Z`;
      put('rect',cls,pts,o,`<path d="${d}" class="${cl(cls)}"/>`);},
    line(a0,b0,a1,b1,cls,o){const p=pt(a0,b0),q=pt(a1,b1);
      put('line',cls,[p,q],o,`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" class="${cl(cls)}"/>`);},
    poly(list,cls,o){o=o||{};const pts=list.map(v=>pt(v[0],v[1]));
      put('poly',cls,pts,o,`<${o.close?'polygon':'polyline'} points="${pts.map(v=>v.join(',')).join(' ')}" class="${cl(cls)}"/>`);},
    // segs: ['M',a,b] ['L',a,b] ['Q',a1,b1,a,b] ['C',a1,b1,a2,b2,a,b] ['Z']
    path(segs,cls,o){const pts=[];let d='';
      for(const g of segs){d+=g[0];for(let k=1;k<g.length;k+=2){const p=pt(g[k],g[k+1]);pts.push(p);d+=(k>1?' ':'')+p[0]+' '+p[1];}}
      put('path',cls,pts,o,`<path d="${d}" class="${cl(cls)}"/>`);},
    circ(a,b,r,cls,o){const p=pt(a,b);r=oaNum(r);
      put('circ',cls,[[oaNum(p[0]-r),oaNum(p[1]-r)],[oaNum(p[0]+r),oaNum(p[1]+r)]],o,`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" class="${cl(cls)}"/>`);}};}

const OA_VIEWS={
  F:{map:(a,b)=>[a,b],  vb:s=>[-s.w/2,-s.h,s.w,s.h]},
  L:{map:(a,b)=>[-a,b], vb:s=>[-s.d,-s.h,s.d,s.h]},
  R:{map:(a,b)=>[a,b],  vb:s=>[0,-s.h,s.d,s.h]},
  T:{map:(a,b)=>[a,b],  vb:s=>[-s.w/2,-s.d,s.w,s.d]}};

// ---------- parametric helpers ----------
// units across a width: n = ceil(w / max), equal widths (600 → 1, 1100 → 2, 1200 → 2, 1800 → 3)
function oaSplit(w,max){const n=Math.max(1,Math.ceil(w/(max||600)-1e-9));return {n,u:w/n};}
// sofa cushions over a seat width: n = round(seat / pref), at least 1 (1840 → 3, 2440 → 4)
function oaCushions(seatW,pref){return Math.max(1,Math.round(seatW/(pref||650)));}
// a bar handle: horizontal (dir 'h') or vertical ('v'), centred on (a, b), fixed 12 mm thick
function oaHandle(P,a,b,len,dir){const t=6;
  if(dir==='v')P.rect(a-t,b-len/2,a+t,b+len/2,'det+fill',{rx:t});else P.rect(a-len/2,b-t,a+len/2,b+t,'det+fill',{rx:t});}
// the elevation swing mark: dashed lines from the opening side's corners to the middle of the hinge side
function oaSwing(P,a0,a1,b0,b1,hinge){const h=hinge==='right'?a1:a0,o=hinge==='right'?a0:a1;
  P.poly([[o,b1],[h,(b0+b1)/2],[o,b0]],'hid');}
// a row of doors across [a0, a1] × [b0, b1]: n from oaSplit (or o.n), gap 2, handle 160 (≤ door − 80) at
// o.handle 'top' (50 below the top) / 'bottom' (o.hy above b0, default 58) / 'side' (vertical, o.hlen long,
// o.hb its centre); hinge: the left half of the doors hinge left, the rest right (o.hinge forces one side)
function oaDoors(P,a0,a1,b0,b1,o){o=o||{};const g=o.gap!=null?o.gap:2,sp=o.n?{n:o.n,u:(a1-a0)/o.n}:oaSplit(a1-a0,o.max);
  for(let i=0;i<sp.n;i++){const x0=a0+i*sp.u+g,x1=a0+(i+1)*sp.u-g,y0=b0+g,y1=b1-g;
    const hinge=o.hinge||(i<sp.n/2?'left':'right'),xc=(x0+x1)/2,hl=Math.min(160,x1-x0-80);
    P.rect(x0,y0,x1,y1,'det+fill',{part:'door',rt:o.rt||0});
    oaSwing(P,x0,x1,y0,y1,hinge);
    if(o.handle==='side'){const xa=hinge==='left'?x1-45:x0+45;oaHandle(P,xa,o.hb,o.hlen,'v');}
    else if(o.handle==='bottom')oaHandle(P,xc,b0+(o.hy!=null?o.hy:58),hl,'h');
    else oaHandle(P,xc,y1-50,hl,'h');}
  return sp;}
// drawer fronts stacked in [b0, b1] over the units of [a0, a1]: rows = o.rows or round((b1 − b0) / o.dh)
function oaDrawers(P,a0,a1,b0,b1,o){o=o||{};const g=o.gap!=null?o.gap:2,sp=o.n?{n:o.n,u:(a1-a0)/o.n}:oaSplit(a1-a0,o.max);
  const rows=o.rows||Math.max(1,Math.round((b1-b0)/(o.dh||180))),rh=(b1-b0)/rows;
  for(let i=0;i<sp.n;i++)for(let r=0;r<rows;r++){const x0=a0+i*sp.u+g,x1=a0+(i+1)*sp.u-g,y0=b0+r*rh+g,y1=b0+(r+1)*rh-g;
    P.rect(x0,y0,x1,y1,'det+fill',{part:'drawer'});oaHandle(P,(x0+x1)/2,(y0+y1)/2,Math.min(160,x1-x0-80),'h');}
  return {n:sp.n,rows};}

// ---------- the families ----------
// Each is {resize, F, S (the side, for L and R), T}, drawing functions (P, s) with s = {w, d, h}.
const OA_FAM={
  // Kanapé: arms 180 (≤ w/6), legs 120, seat top 430, arm top 620, back frame h − 80, back 220 deep (≤ 0.3 d);
  // cushions n = round((w − 2·arm) / 650), a seat and a back cushion each
  kanape:{resize:'param',
    k(s){const arm=Math.min(180,s.w/6),seat=Math.min(430,s.h*.55),n=oaCushions(s.w-2*arm);
      return {arm,seat,n,cw:(s.w-2*arm)/n,leg:Math.min(120,s.h*.15),armH:Math.min(s.h-100,Math.max(seat+120,620)),
        top:s.h-80,back:Math.min(220,s.d*.3),x0:-s.w/2+arm};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,k.leg,s.w/2,k.top,'out+fill',{rt:40});
      for(let i=0;i<k.n;i++)P.rect(k.x0+i*k.cw+6,k.seat-20,k.x0+(i+1)*k.cw-6,s.h,'det+fill',{rt:60,rb:20,part:'back'});
      P.rect(k.x0,k.leg,-k.x0,k.seat-150,'out+fill');
      for(let i=0;i<k.n;i++)P.rect(k.x0+i*k.cw+6,k.seat-150,k.x0+(i+1)*k.cw-6,k.seat,'det+fill',{rx:30,part:'seat'});
      P.rect(-s.w/2,k.leg,k.x0,k.armH,'out+fill',{rt:60});P.rect(-k.x0,k.leg,s.w/2,k.armH,'out+fill',{rt:60});
      P.rect(-s.w/2+50,0,-s.w/2+90,k.leg,'out+fill');P.rect(s.w/2-90,0,s.w/2-50,k.leg,'out+fill');},
    S(P,s){const k=this.k(s),bf=s.d-k.back;
      P.path([['M',bf-190,k.seat],['L',bf-120,s.h-40],['Q',bf-110,s.h,bf-60,s.h],['L',bf,s.h],['L',bf,k.seat],['Z']],'det+fill');
      P.rect(bf,k.leg,s.d,k.top,'out+fill',{rt:40});
      P.rect(0,k.leg,s.d,k.armH,'out+fill',{rt:60});
      P.rect(30,k.seat-150,bf,k.seat,'hid',{rx:30});                       // the seat cushion behind the arm
      P.rect(30,0,70,k.leg,'out+fill');P.rect(s.d-70,0,s.d-30,k.leg,'out+fill');},
    T(P,s){const k=this.k(s),bf=s.d-k.back;
      for(let i=0;i<k.n;i++)P.rect(k.x0+i*k.cw+6,30,k.x0+(i+1)*k.cw-6,bf,'det+fill',{rx:40,part:'seat'});
      P.rect(-s.w/2,0,k.x0,s.d,'out+fill',{rx:40});P.rect(-k.x0,0,s.w/2,s.d,'out+fill',{rx:40});
      P.rect(-s.w/2,bf,s.w/2,s.d,'out+fill',{rx:30});
      for(let i=0;i<k.n;i++)P.rect(k.x0+i*k.cw+6,bf-190,k.x0+(i+1)*k.cw-6,bf,'det+fill',{rx:50,part:'back'});}},

  // Ágy: the front is the foot end. Legs 100, rail top min(300, 0.55 h), mattress 180 to min(rail + 180, h − 60),
  // head panel 60 deep to h; pillows n = w ≥ 1200 ? 2 : 1, up to 700 wide, 40 apart
  agy:{resize:'param',
    k(s){const rail=Math.min(300,s.h*.55),mt=Math.min(rail+180,s.h-60),pn=s.w>=1200?2:1,pw=Math.min(700,(s.w-80-(pn-1)*40)/pn);
      return {leg:Math.min(100,s.h*.2),rail,mt,mb:rail-60,head:60,pn,pw,px0:-(pn*pw+(pn-1)*40)/2};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,k.leg,s.w/2,s.h,'out+fill',{rt:20});
      for(let i=0;i<k.pn;i++){const x=k.px0+i*(k.pw+40);P.rect(x,k.mt-40,x+k.pw,s.h-10,'det+fill',{rx:40,part:'pillow'});}
      P.rect(-s.w/2+15,k.mb,s.w/2-15,k.mt,'det+fill',{rx:40});
      P.rect(-s.w/2,k.leg,s.w/2,k.rail,'out+fill');
      P.rect(-s.w/2+30,0,-s.w/2+90,k.leg,'out+fill');P.rect(s.w/2-90,0,s.w/2-30,k.leg,'out+fill');},
    S(P,s){const k=this.k(s),hp=s.d-k.head;
      P.rect(hp,k.leg,s.d,s.h,'out+fill',{rt:20});
      P.rect(hp-480,k.mt-40,hp-20,s.h-10,'det+fill',{rx:50});
      P.rect(15,k.mb,hp,k.mt,'det+fill',{rx:40});
      P.line(hp-600,k.mb+20,hp-600,k.mt,'det');                            // the duvet turned back
      P.rect(0,k.leg,hp,k.rail,'out+fill');
      P.rect(20,0,80,k.leg,'out+fill');P.rect(s.d-55,0,s.d-15,k.leg,'out+fill');},
    T(P,s){const k=this.k(s),hp=s.d-k.head;
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill');
      P.rect(-s.w/2+15,15,s.w/2-15,hp,'det+fill',{rx:40});
      P.rect(-s.w/2+5,5,s.w/2-5,hp-600,'det+fill',{rx:40});
      P.line(-s.w/2+5,hp-880,s.w/2-5,hp-880,'det');
      for(let i=0;i<k.pn;i++){const x=k.px0+i*(k.pw+40);P.rect(x,hp-480,x+k.pw,hp-20,'det+fill',{rx:60,part:'pillow'});}
      P.rect(-s.w/2,hp,s.w/2,s.d,'out+fill');}},

  // WC csésze (close-coupled): nothing to count, so it stretches with w/d/h (D-V8-1); fixed: seat 15, lid 30,
  // cistern lid 25, flush button r 30. Rim at h/2 − 45, cistern from 0.48 h, 0.25 d deep, bowl ±0.45 w
  wc:{resize:'stretch',
    k(s){const rim=s.h/2-45;return {rim,r42:Math.min(s.h*.42,rim),cb:s.h*.48,cd:s.d*.25,bw:s.w*.45};},
    F(P,s){const k=this.k(s),w=s.w,h=s.h;
      P.rect(-.475*w,k.cb,.475*w,h,'out+fill',{rt:15});P.line(-.475*w,h-25,.475*w,h-25,'det');
      P.path([['M',-.25*w,0],['C',-.25*w,.25*h,-k.bw,.3*h,-k.bw,k.r42],['L',-k.bw,k.rim],['L',k.bw,k.rim],['L',k.bw,k.r42],
        ['C',k.bw,.3*h,.25*w,.25*h,.25*w,0],['Z']],'out+fill');
      P.rect(-k.bw,k.rim,k.bw,k.rim+15,'det+fill',{rx:5});
      P.rect(-k.bw+10,k.rim+15,k.bw-10,k.rim+45,'out+fill',{rt:12});},
    S(P,s){const k=this.k(s),d=s.d,h=s.h,cf=d-k.cd;
      P.path([['M',.3*d,0],['C',.26*d,.2*h,0,.26*h,0,k.r42],['L',0,k.rim],['L',cf,k.rim],['L',cf,k.cb],['L',.9*d,k.cb],
        ['C',.9*d,.3*h,.72*d,.15*h,.72*d,0],['Z']],'out+fill');
      P.rect(cf,k.cb,d,h,'out+fill',{rt:15});P.line(cf,h-25,d,h-25,'det');
      P.rect(0,k.rim,cf,k.rim+15,'det+fill',{rx:5});
      P.rect(.01*d,k.rim+15,cf-10,k.rim+45,'out+fill',{rt:12});
      P.path([['M',.33*d,k.rim-40],['C',.3*d,.12*h,.5*d,.1*h,.6*d,.16*h],['L',.72*d,.18*h]],'hid');},   // the trap
    T(P,s){const k=this.k(s),w=s.w,d=s.d,cf=d-k.cd;
      P.rect(-.475*w,cf,.475*w,d,'out+fill',{rx:15});
      P.circ(0,d-k.cd/2,30,'det',{part:'button'});
      P.path([['M',-k.bw,cf],['C',-k.bw,.3*d,-.3*w,0,0,0],['C',.3*w,0,k.bw,.3*d,k.bw,cf],['Z']],'out+fill',{part:'bowl'});
      P.path([['M',-k.bw+12,cf-10],['C',-k.bw+12,.3*d,-.3*w+8,12,0,12],['C',.3*w-8,12,k.bw-12,.3*d,k.bw-12,cf-10],['Z']],'det');
      P.line(-k.bw+30,cf-40,k.bw-30,cf-40,'det');}},

  // Konyhapult (base unit run): worktop 40 with a 30 front overhang, plinth 100 set back 50, door 18, top drawer
  // 140, gaps 2, bar handles 160; units n = ceil(w / 600), a drawer and a door each; a hidden shelf in the side
  pult:{resize:'param',
    k(s){const wt=40,ov=30,door=18,pl=Math.min(100,s.h*.15),dTop=s.h-wt,dBot=dTop-144;
      return {wt,ov,door,pl,dTop,dBot,sp:oaSplit(s.w,600)};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,k.pl,'det+fill');
      P.rect(-s.w/2,k.pl,s.w/2,s.h-k.wt,'out+fill');
      oaDrawers(P,-s.w/2,s.w/2,k.dBot,k.dTop,{n:k.sp.n,rows:1});
      oaDoors(P,-s.w/2,s.w/2,k.pl,k.dBot,{n:k.sp.n,handle:'top'});
      P.rect(-s.w/2,s.h-k.wt,s.w/2,s.h,'out+fill');},
    S(P,s){const k=this.k(s),f=k.ov+k.door,dm=(k.dBot+k.dTop)/2,hy=k.dBot-52;
      P.rect(f,k.pl,s.d,s.h-k.wt,'out+fill');
      P.rect(k.ov,k.dBot+2,f,k.dTop-2,'det+fill');P.rect(k.ov,k.pl+2,f,k.dBot-2,'det+fill');
      P.rect(2,dm-6,k.ov,dm+6,'det+fill');P.rect(2,hy-6,k.ov,hy+6,'det+fill');
      P.rect(k.ov+50,0,k.ov+68,k.pl,'det+fill');P.rect(f+60,0,f+90,k.pl,'det');P.rect(s.d-60,0,s.d-30,k.pl,'det');
      P.line(f+18,(k.pl+k.dBot)/2,s.d-18,(k.pl+k.dBot)/2,'hid',{part:'shelf'});
      P.rect(0,s.h-k.wt,s.d,s.h,'out+fill');},
    T(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.d,'out+fill');
      P.line(-s.w/2,k.ov,s.w/2,k.ov,'hid');                                // the fronts under the overhang
      for(let i=1;i<k.sp.n;i++){const x=-s.w/2+i*k.sp.u;P.line(x,k.ov,x,s.d,'hid',{part:'joint'});}}},

  // Felsőszekrény (wall unit, origin = its own bottom): handle zone 20, door 18, handle 58 above the bottom;
  // doors n = ceil(w / 600), shelves = max(0, round(h / 350) − 1), hidden in the side view
  felso:{resize:'param',
    k(s){return {hz:20,door:18,sp:oaSplit(s.w,600),sh:Math.max(0,Math.round(s.h/350)-1)};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.h,'out+fill');
      oaDoors(P,-s.w/2,s.w/2,0,s.h,{n:k.sp.n,handle:'bottom',hy:60});},
    S(P,s){const k=this.k(s),f=k.hz+k.door;
      P.rect(f,0,s.d,s.h,'out+fill');
      P.rect(k.hz,2,f,s.h-2,'det+fill');
      P.rect(2,54,k.hz,66,'det+fill');
      for(let j=1;j<=k.sh;j++){const y=s.h*j/(k.sh+1);P.line(f+18,y,s.d-18,y,'hid',{part:'shelf'});}},
    T(P,s){const k=this.k(s),f=k.hz+k.door;
      P.rect(-s.w/2,f,s.w/2,s.d,'out+fill');
      for(let i=0;i<k.sp.n;i++){const x0=-s.w/2+i*k.sp.u+2,x1=-s.w/2+(i+1)*k.sp.u-2,hl=Math.min(160,x1-x0-80);
        P.rect(x0,k.hz,x1,f,'det+fill');P.rect((x0+x1)/2-hl/2,2,(x0+x1)/2+hl/2,k.hz,'det+fill');}}},

  // Hűtő (freestanding): handle zone 30, door 60, kick strip 60 with vent slots, hinge left, compressor hidden in
  // the side; doors = h ≥ 1500 ? 2 (freezer below, split at 0.38 h) : 1; handle ≤ 400 (0.4 of the door)
  huto:{resize:'param',
    k(s){const kick=60,sp=Math.round(s.h*.38),two=s.h>=1500;
      const doors=two?[{b0:kick,b1:sp,at:'top'},{b0:sp,b1:s.h,at:'bottom'}]:[{b0:kick,b1:s.h,at:'top'}];
      doors.forEach(o=>{o.hl=Math.min(400,(o.b1-o.b0)*.4);o.hb=o.at==='top'?o.b1-62-o.hl/2:o.b0+62+o.hl/2;});
      return {hz:30,door:60,kick,doors};},
    F(P,s){const k=this.k(s);
      P.rect(-s.w/2,0,s.w/2,s.h,'out+fill',{rt:10});
      P.rect(-s.w/2+20,8,s.w/2-20,k.kick-8,'det');
      for(let x=-s.w/2+60;x<=s.w/2-60+1e-6;x+=40)P.line(x,20,x,k.kick-20,'det');
      for(const o of k.doors)oaDoors(P,-s.w/2,s.w/2,o.b0,o.b1,{n:1,hinge:'left',handle:'side',hb:o.hb,hlen:o.hl,rt:o.b1===s.h?8:0});},
    S(P,s){const k=this.k(s),f=k.hz+k.door;
      P.rect(f,0,s.d,s.h,'out+fill',{rt:10});
      P.rect(f-20,8,f,k.kick-2,'det+fill');
      for(const o of k.doors){P.rect(k.hz,o.b0+2,f,o.b1-2,'det+fill',{rt:o.b1===s.h?6:0});
        const y0=o.hb-o.hl/2,y1=o.hb+o.hl/2;
        P.rect(2,y0,16,y1,'det+fill',{rx:6});P.rect(16,y0,k.hz,y0+20,'det+fill');P.rect(16,y1-20,k.hz,y1,'det+fill');}
      P.rect(s.d-220,30,s.d-40,260,'hid',{rx:20});},                       // the compressor
    T(P,s){const k=this.k(s),f=k.hz+k.door;
      P.rect(-s.w/2,f,s.w/2,s.d,'out+fill',{rx:10});
      P.rect(-s.w/2+2,k.hz,s.w/2-2,f,'det+fill');
      P.rect(s.w/2-55,2,s.w/2-35,k.hz,'det+fill');}}};

// ---------- the store ----------
// OBJART[name] = {fam, front, left, right, top}: each view a (s) → {vb, body, parts, prims} function.
const OBJART={};
function oaDraw(fam,view,s){const F=OA_FAM[fam],V=OA_VIEWS[view];if(!F||!V)return null;
  const fn=F[view]||((view==='L'||view==='R')?F.S:null);if(!fn)return null;
  const P=oaPen(V.map);fn.call(F,P,s);
  return {vb:V.vb(s).map(oaNum),body:P.body(),parts:P.parts,prims:P.prims};}
function oaReg(fam,names){for(const n of names)OBJART[n]={fam,
  front:s=>oaDraw(fam,'F',s),left:s=>oaDraw(fam,'L',s),right:s=>oaDraw(fam,'R',s),top:s=>oaDraw(fam,'T',s)};}
oaReg('kanape',['Kanapé 3ü']);
oaReg('agy',['Ágy 200×160']);
oaReg('wc',['WC csésze']);
oaReg('pult',['Konyhapult 60','Konyhapult 120','Konyhapult']);
oaReg('felso',['Felsőszekrény']);
oaReg('huto',['Hűtő 60']);

function objArtItem(name){for(const g of OBJLIB)for(const it of g.items)if(it.n===name)return it;return null;}

// objArt(name, 'F'|'L'|'R'|'T', size?, {k, css}) → {name, view, size, vb, body, svg, parts, prims} or null.
// size defaults to the catalogue size; opt.k = paper scale 1 : k (adds width / height in mm); opt.css false = no <style>.
function objArt(name,view,size,opt){
  const e=OBJART[name],key={F:'front',L:'left',R:'right',T:'top'}[view];if(!e||!key)return null;
  const it=objArtItem(name)||{},z=size||{};opt=opt||{};
  const s={w:+(z.w||it.w),d:+(z.d||it.d),h:+(z.h||it.h)};
  const r=e[key](s);if(!r)return null;
  const mm=v=>+(v/opt.k).toFixed(2)+'mm';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r.vb.join(' ')}"${opt.k?` width="${mm(r.vb[2])}" height="${mm(r.vb[3])}"`:''}>`+
    (opt.css===false?'':`<style>${objArtCss(opt.k||20)}</style>`)+`<g class="oa">${r.body}</g></svg>`;
  return {name,view,size:s,vb:r.vb,body:r.body,svg,parts:r.parts,prims:r.prims};}
