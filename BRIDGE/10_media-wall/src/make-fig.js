// BRIDGE-MW-001 figure: front elevation + section + layout variants + legend. Coordinates in mm, drawn at 0.3 px/mm.
// node make-fig.js → ../fig/MW-001_media-wall.svg
const fs=require('fs'),path=require('path');
const S=0.3,X=mm=>60+mm*S,Y=mm=>900-mm*S;                      // elevation: x from the wall's left end, y = height above FFL
const XS=z=>1290+z*S;                                           // section: z = depth out from the existing wall face
const C={ink:'#2b2b2b',line:'#555',faint:'#9a968e',board:'#f4f1ea',recess:'#e6e1d6',wood:'#d9c7a6',warm:'#f2b94b',cool:'#9cc3ff',
  egress:'#e08a3c',mains:'#d1493f',sig:'#5b3f8c',data:'#16a085',hatch:'#b9b3a6',num:'#5b3f8c'};
let s='';const add=t=>{s+=t+'\n';};
const rect=(x0,y0,x1,y1,o)=>add(`<rect x="${X(x0)}" y="${Y(y1)}" width="${(x1-x0)*S}" height="${(y1-y0)*S}" ${o||''}/>`);
const srect=(z0,y0,z1,y1,o)=>add(`<rect x="${XS(z0)}" y="${Y(y1)}" width="${(z1-z0)*S}" height="${(y1-y0)*S}" ${o||''}/>`);
const line=(x0,y0,x1,y1,o)=>add(`<line x1="${X(x0)}" y1="${Y(y0)}" x2="${X(x1)}" y2="${Y(y1)}" ${o||''}/>`);
const sline=(z0,y0,z1,y1,o)=>add(`<line x1="${XS(z0)}" y1="${Y(y0)}" x2="${XS(z1)}" y2="${Y(y1)}" ${o||''}/>`);
const txt=(x,y,t,o)=>add(`<text x="${x}" y="${y}" ${o||''}>${t}</text>`);
// numbered callouts: a small disc at a point of the drawing; the legend below says what it is
const nums=[];const num=(n,px,py)=>{nums.push([n,px,py]);};
const legend={};const L=(n,t)=>{legend[n]=t;};

add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1560 1560" width="1560" height="1560" font-family="Segoe UI, Arial, sans-serif">`);
add(`<defs>
 <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${C.hatch}" stroke-width="1.4"/></pattern>
 <pattern id="noDrill" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${C.mains}" stroke-width="1" stroke-opacity="0.55"/></pattern>
 <pattern id="slats" width="9" height="10" patternUnits="userSpaceOnUse"><rect width="9" height="10" fill="${C.wood}"/><line x1="7.5" y1="0" x2="7.5" y2="10" stroke="#8a7350" stroke-width="2.2"/></pattern>
 <pattern id="grille" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1" fill="#6e6a62"/></pattern>
 <linearGradient id="cove" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.warm}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.warm}" stop-opacity="0"/></linearGradient>
 <radialGradient id="bias" cx="0.5" cy="0.5" r="0.62"><stop offset="0.72" stop-color="${C.cool}" stop-opacity="0.65"/><stop offset="1" stop-color="${C.cool}" stop-opacity="0"/></radialGradient>
 <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3a7bd5"/></marker>
</defs>
<rect width="1560" height="1560" fill="#ffffff"/>`);
txt(60,38,'BRIDGE-MW-001 · Media Wall — reference configuration MW-L1 (3.60 × 2.70 m, 75″ screen, next-size-up bay)','font-size="19" font-weight="600" fill="'+C.ink+'"');
txt(60,62,'Front elevation · section A–A through the screen bay · five layout variants. Numbers → legend. Dimensions in mm, heights above FFL.','font-size="13" fill="#666"');

// ---- ELEVATION -----------------------------------------------------------------------------------------------------------------
const W=3600,H=2700;
rect(0,0,W,H,`fill="#fbfaf7" stroke="${C.faint}" stroke-width="1"`);                        // the room wall behind
line(-60,H,W+60,H,`stroke="${C.ink}" stroke-width="2"`);txt(X(W+60)+6,Y(H)+4,'ceiling 2700','font-size="11" fill="#777"');
line(-60,0,W+60,0,`stroke="${C.ink}" stroke-width="2"`);txt(X(W+60)+6,Y(0)+4,'FFL ±0','font-size="11" fill="#777"');
// the cove glow above the build-out (AMBIENT, STD-002 #1: ≥ 150 mm below the ceiling)
rect(0,2450,W,2700,`fill="url(#cove)"`);
// the build-out: side bays + crown at full depth, the screen bay recessed
rect(0,100,W,2450,`fill="${C.board}" stroke="${C.ink}" stroke-width="1.5"`);
rect(600,580,2600,2300,`fill="${C.recess}" stroke="${C.ink}" stroke-width="1.2"`);             // screen bay recess (200 deep)
// plinth (recessed toe-kick) + its egress light
rect(0,0,W,100,`fill="#d8d3c8" stroke="${C.ink}" stroke-width="1"`);
line(40,30,W-40,30,`stroke="${C.egress}" stroke-width="3" stroke-linecap="round"`);
// the low band: storage | AV bay | service column base | sub + storage
[[0,600],[600,2600],[2600,2900],[2900,3600]].forEach(([a,b])=>rect(a,100,b,520,`fill="#efe9dd" stroke="${C.ink}" stroke-width="1"`));
rect(0,520,W,550,`fill="${C.wood}" stroke="${C.ink}" stroke-width="1"`);                    // bench top
rect(3000,140,3500,480,`fill="url(#grille)" stroke="${C.line}" stroke-width="0.8"`);          // subwoofer grille
line(300,140,300,480,`stroke="${C.faint}"`);line(1600,140,1600,480,`stroke="${C.faint}"`);   // door joints
rect(620,104,2580,124,`fill="#ffffff" stroke="${C.line}" stroke-width="0.6"`);               // intake slot (full width of the AV bay)
rect(620,492,2580,512,`fill="#ffffff" stroke="${C.line}" stroke-width="0.6"`);               // exhaust slot
// the AV bay's box B (furniture point) and its user port panel
rect(980,330,1170,430,`fill="#ffffff" stroke="${C.sig}" stroke-width="1.5"`);
rect(1260,340,1560,420,`fill="#ffffff" stroke="${C.line}" stroke-width="1"`);
[1290,1340,1390,1440,1490,1530].forEach((x,i)=>rect(x,365,x+(i%2?30:40),395,`fill="#cfcac0"`));
// niches: shelves + accent light at the top of each compartment
[[0,600],[2900,3600]].forEach(([a,b])=>{[1000,1500,2000].forEach(y=>rect(a+40,y,b-40,y+30,`fill="${C.wood}" stroke="${C.line}" stroke-width="0.6"`));
  [[550,1000],[1030,1500],[1530,2000],[2030,2450]].forEach(([y0,y1])=>{rect(a+40,y0,b-40,y1,`fill="none" stroke="${C.faint}" stroke-width="0.6"`);
    add(`<polygon points="${X((a+b)/2)},${Y(y1-25)} ${X((a+b)/2-110)},${Y(y0+40)} ${X((a+b)/2+110)},${Y(y0+40)}" fill="${C.warm}" fill-opacity="0.18"/>`);
    add(`<circle cx="${X((a+b)/2)}" cy="${Y(y1-25)}" r="3" fill="${C.warm}" stroke="#a07020" stroke-width="0.6"/>`);});});
// acoustic slat panel on the right niche's back (first-reflection absorber) — shown as slats in the 1530–2000 compartment
rect(2940,1530,3560,2000,`fill="url(#slats)" fill-opacity="0.75"`);
// service column: magnetic access panel + what lives behind it (faint)
rect(2600,550,2900,2450,`fill="#ece7dc" stroke="${C.ink}" stroke-width="1"`);
rect(2625,1150,2875,2250,`fill="none" stroke="${C.line}" stroke-width="1" stroke-dasharray="6 4"`);
[[2650,2050,2850,2200,'drv'],[2650,1850,2850,1980,'iso'],[2650,1650,2850,1780,'ir'],[2650,1250,2850,1550,'jb']].forEach(([a,b,c,d])=>rect(a,b,c,d,`fill="#ffffff" fill-opacity="0.7" stroke="${C.faint}" stroke-width="0.8"`));
// screen: bias halo, the screen, the bracket no-drill zone, box A
rect(700,780,2500,1830,`fill="url(#bias)"`);
rect(770,838,2430,1773,`fill="#1d1f24" stroke="#000" stroke-width="1"`);
rect(1250,1080,1950,1530,`fill="url(#noDrill)" stroke="${C.mains}" stroke-width="1" stroke-dasharray="5 3"`);
rect(980,920,1170,1030,`fill="#ffffff" fill-opacity="0.35" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="4 3"`);
line(1020,950,1020,1000,`stroke="${C.mains}" stroke-width="3"`);line(1075,950,1075,1000,`stroke="${C.data}" stroke-width="3"`);line(1130,950,1130,1000,`stroke="${C.sig}" stroke-width="3"`);
// the user route A ↔ B (M63) — hidden in the frame cavity
line(1075,920,1075,430,`stroke="${C.sig}" stroke-width="2.4" stroke-dasharray="7 4"`);
// sound slot under the screen, soundbar, its own socket
rect(700,640,2500,800,`fill="#d4cec2" stroke="${C.ink}" stroke-width="1"`);
rect(860,662,2340,742,`fill="#30333a"`);
rect(2400,690,2460,750,`fill="#ffffff" stroke="${C.mains}" stroke-width="1.2"`);
// crown: shadow gap with presence sensor, IR window, NTL
rect(600,2300,2600,2450,`fill="${C.board}" stroke="${C.ink}" stroke-width="1"`);
line(640,2318,2560,2318,`stroke="#555" stroke-width="2.5"`);
add(`<circle cx="${X(1600)}" cy="${Y(2318)}" r="5" fill="#ffffff" stroke="${C.data}" stroke-width="1.6"/>`);
rect(1330,2306,1430,2330,`fill="#3a1f1f"`);
[1760,1775,1790,1805].forEach(x=>add(`<rect x="${X(x)}" y="${Y(2328)}" width="3.2" height="5" fill="#ff6aa0"/>`));
// cove strip on top of the build-out
line(30,2455,W-30,2455,`stroke="${C.warm}" stroke-width="3"`);
// dimension lines
const dimH=(a,b,y,t)=>{line(a,y,b,y,`stroke="#888" stroke-width="0.8"`);[a,b].forEach(v=>line(v,y-40,v,y+40,`stroke="#888" stroke-width="0.8"`));txt((X(a)+X(b))/2,Y(y)-4,t,'font-size="11" fill="#666" text-anchor="middle"');};
dimH(0,600,2630,'600');dimH(600,2600,2630,'2000 — screen bay (fits 85″)');dimH(2600,2900,2630,'300');dimH(2900,3600,2630,'700');
const dimV=(x,a,b,t)=>{line(x,a,x,b,`stroke="#888" stroke-width="0.8"`);[a,b].forEach(v=>line(x-40,v,x+40,v,`stroke="#888" stroke-width="0.8"`));
  add(`<text x="${X(x)-6}" y="${(Y(a)+Y(b))/2}" font-size="11" fill="#666" text-anchor="middle" transform="rotate(-90 ${X(x)-6} ${(Y(a)+Y(b))/2})">${t}</text>`);};
dimV(-120,0,550,'bench 550');dimV(-120,838,1773,'screen 838–1773');dimV(-120,1773,2450,'crown 2450');

// numbered points on the elevation
num(1,X(1600),Y(1305));num(2,X(1075),Y(975)+0);num(3,X(1075),Y(380));num(4,X(1075)+18,Y(598));num(5,X(1410),Y(380));
num(6,X(1600),Y(118)-1);num(7,X(2750),Y(2120));num(8,X(1600),Y(2318)-12);num(9,X(1380),Y(2318)+14);num(10,X(1790),Y(2318)+14);
num(11,X(2400),Y(1950));num(12,X(1250),Y(2530));num(13,X(300),Y(1770));num(14,X(3250),Y(1765));num(15,X(1800),Y(30)+12);
num(16,X(3250),Y(310));num(17,X(2430),Y(720));num(18,X(1600),Y(702));

// ---- SECTION A–A ---------------------------------------------------------------------------------------------------------------
txt(XS(-150),Y(2700)-14,'A–A  section through the screen bay','font-size="13" font-weight="600" fill="'+C.ink+'"');
srect(-150,0,0,2700,`fill="url(#hatch)" stroke="${C.ink}" stroke-width="1"`);                       // existing wall
sline(-150,0,700,0,`stroke="${C.ink}" stroke-width="2"`);sline(-150,2700,700,2700,`stroke="${C.ink}" stroke-width="2"`);
srect(0,100,75,2450,`fill="#ffffff" stroke="${C.line}" stroke-width="0.8" stroke-dasharray="3 2"`);    // CW75 frame cavity
srect(75,580,93,2300,`fill="${C.wood}" stroke="${C.ink}" stroke-width="0.8"`);                        // 18 ply backing
srect(93,580,100,2300,`fill="#ffffff" stroke="${C.ink}" stroke-width="0.8"`);                          // board on the recess back
srect(75,2300,300,2450,`fill="${C.board}" stroke="${C.ink}" stroke-width="1"`);                       // crown (full depth)
sline(250,2455,300,2455,`stroke="${C.warm}" stroke-width="4"`);
add(`<path d="M${XS(270)},${Y(2470)} q 10,-40 40,-60" fill="none" stroke="${C.warm}" stroke-width="1.6"/>`);
srect(100,1080,125,1530,`fill="#888"`);                                                                 // bracket plate
srect(125,838,185,1773,`fill="#1d1f24"`);                                                               // the screen
srect(0,0,400,100,`fill="#d8d3c8" stroke="${C.ink}" stroke-width="1"`);                               // plinth (set back 50)
sline(380,20,400,20,`stroke="${C.egress}" stroke-width="4"`);
srect(0,100,450,520,`fill="#efe9dd" stroke="${C.ink}" stroke-width="1"`);                             // AV bay
srect(0,520,470,550,`fill="${C.wood}" stroke="${C.ink}" stroke-width="1"`);                           // bench top
srect(60,180,420,330,`fill="#4a4d55"`);txt(XS(240),Y(255)+4,'AVR','font-size="10" fill="#fff" text-anchor="middle"');
srect(0,100,50,520,`fill="#ffffff" stroke="${C.line}" stroke-width="0.6" stroke-dasharray="3 2"`);   // rear plenum
add(`<path d="M${XS(440)},${Y(112)} L${XS(250)},${Y(140)}" stroke="#3a7bd5" stroke-width="1.6" fill="none" marker-end="url(#arr)"/>`);
add(`<path d="M${XS(25)},${Y(200)} L${XS(25)},${Y(500)} L${XS(25)},${Y(600)}" stroke="#3a7bd5" stroke-width="1.6" fill="none" marker-end="url(#arr)"/>`);
srect(100,640,300,660,`fill="${C.wood}" stroke="${C.line}" stroke-width="0.6"`);                     // sound slot shelf
srect(110,662,200,742,`fill="#30333a"`);
add(`<path d="M${XS(40)},${Y(975)} L${XS(40)},${Y(380)}" stroke="${C.sig}" stroke-width="2.2" stroke-dasharray="6 3" fill="none"/>`);   // M63
srect(75,920,100,1030,`fill="#ffffff" stroke="${C.sig}" stroke-width="1.4"`);                        // box A in section
const dimZ=(a,b,y,t)=>{sline(a,y,b,y,`stroke="#888" stroke-width="0.8"`);[a,b].forEach(v=>sline(v,y-40,v,y+40,`stroke="#888" stroke-width="0.8"`));txt((XS(a)+XS(b))/2,Y(y)+14,t,'font-size="10.5" fill="#666" text-anchor="middle"');};
dimZ(0,100,2150,'100');dimZ(100,300,2150,'200 recess');dimZ(0,450,-120,'450 AV bay');
num(19,XS(84),Y(1900));num(20,XS(37),Y(1500));num(21,XS(345),Y(165));num(22,XS(-75),Y(2550));

// ---- LAYOUT VARIANTS -------------------------------------------------------------------------------------------------------------
const VY=1000,VW=272,VH=160;
txt(60,VY-18,'Layout variants (same modules, different arrangement)','font-size="14" font-weight="600" fill="'+C.ink+'"');
const box=(x,y,w,h,f,o)=>add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${o||'stroke="#555" stroke-width="0.8"'}/>`);
const variant=(i,title,sub,draw)=>{const x=60+i*(VW+18),y=VY;box(x,y,VW,VH,'#fbfaf7','stroke="#bbb" stroke-width="1"');draw(x,y);
  txt(x,y+VH+18,title,'font-size="12.5" font-weight="600" fill="'+C.ink+'"');txt(x,y+VH+34,sub,'font-size="11" fill="#666"');};
const scr=(x,y,w,h)=>box(x,y,w,h,'#1d1f24','stroke="#000" stroke-width="0.6"');
const fire=(x,y,w,h)=>{box(x,y,w,h,'#3b2a20');add(`<path d="M${x+w*0.2},${y+h-3} q ${w*0.15},${-h*0.7} ${w*0.3},0 q ${w*0.15},${-h*0.9} ${w*0.3},0" fill="#ff9a3c" opacity="0.9"/>`);};
const bench=(x,y)=>{box(x+6,y+VH-34,VW-12,26,'#efe9dd');box(x+6,y+VH-38,VW-12,5,C.wood);};
variant(0,'MW-L1 · Classic, symmetric','niche · screen · niche — the reference',(x,y)=>{box(x+6,y+8,VW-12,VH-46,C.board);box(x+60,y+14,152,VH-58,C.recess);scr(x+74,y+34,124,70);bench(x,y);
  [[x+14],[x+218]].forEach(([a])=>[30,60,90].forEach(d=>box(a,y+8+d,40,3,C.wood,'')));});
variant(1,'MW-L2 · Fire to the side','screen and fire never share a column',(x,y)=>{box(x+6,y+8,VW-12,VH-46,C.board);box(x+14,y+14,150,VH-58,C.recess);scr(x+24,y+34,130,72);
  fire(x+182,y+70,72,34);[40,58].forEach(d=>box(x+182,y+8+d,72,3,C.wood,''));bench(x,y);});
variant(2,'MW-L3 · Fire below the screen','deflector + clearance rule (§4.5)',(x,y)=>{box(x+6,y+8,VW-12,VH-46,C.board);box(x+60,y+12,152,VH-56,C.recess);scr(x+80,y+16,112,62);
  box(x+70,y+82,132,4,'#8a8a8a','');fire(x+90,y+90,92,26);bench(x,y);});
variant(3,'MW-L4 · Cinema front stage','L C R behind acoustic fabric',(x,y)=>{box(x+6,y+8,VW-12,VH-46,'#6f6a73');scr(x+60,y+16,152,72);
  [[x+16],[x+124],[x+228]].forEach(([a])=>box(a,y+94,26,18,'#4c4852'));box(x+6,y+VH-34,VW-12,26,'#efe9dd');});
variant(4,'MW-L5 · Rail kit (no chasing)','rental / retrofit, panels on a rail',(x,y)=>{box(x+6,y+8,VW-12,VH-46,'#fbfaf7','stroke="#bbb" stroke-width="0.6"');
  [y+30,y+86].forEach(r=>box(x+10,r,VW-20,4,'#9a9a9a',''));box(x+16,y+20,44,90,C.wood);box(x+212,y+20,44,90,C.wood);scr(x+72,y+30,128,72);box(x+132,y+104,8,22,'#c8c3b8');bench(x,y);});

// ---- callout discs (drawn last, on top) ------------------------------------------------------------------------------------------
nums.forEach(([n,px,py])=>{add(`<circle cx="${px}" cy="${py}" r="10" fill="${C.num}" stroke="#fff" stroke-width="1.6"/>`);add(`<text x="${px}" y="${py+4}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`);});

// ---- LEGEND ------------------------------------------------------------------------------------------------------------------------
L(1,'Bracket no-drill zone — solid 18 mm ply backing, no cable or box inside it');L(2,'Box A behind the screen: socket · Cat6A · HDMI (beside the bracket, hidden by the screen)');
L(3,'Box B at the AV bay — the user end of the media-wall route');L(4,'User route A ↔ B, M63 (sized for an HDMI plug), open ends, nothing permanent');
L(5,'User port panel: USB-C · HDMI in · USB data · optical');L(6,'Full-width intake slot (low) — exhaust slot under the bench top (high)');
L(7,'Service column: magnetic access panel — drivers, isolator, IR hub, junctions');L(8,'Presence sensor in the shadow gap');
L(9,'IR window for remotes (to the IR hub behind 7)');L(10,'Notification light NTL (BRIDGE) — four RGBW pixels');
L(11,'Bias light, 6500 K — behind the screen, ~10 % of the picture brightness');L(12,'Cove uplight (AMBIENT), 2700–3000 K, ≥ 150 mm below the ceiling');
L(13,'Niche accent (ACCENT), 3000 K narrow beam, source above the sight line');L(14,'Acoustic slat panel — first-reflection absorber');
L(15,'Plinth / toe-kick light (EGRESS), 2200 K — assured bus B in BRIDGE');L(16,'Subwoofer bay with grille, floor-coupled');
L(17,'Soundbar socket at the end of the slot — no extension leads');L(18,'Open-fronted sound slot (soundbar never in a closed box)');
L(19,'18 mm ply backing over the full recess back — the bracket can move');L(20,'Frame cavity: route A ↔ B and the AV feeds, MAINS kept to one side');
L(21,'AV bay airflow: front-low in, rear plenum, out high');L(22,'Existing wall — the build-out stands free of it (decoupled, K33)');
const LY=1250;txt(60,LY-14,'Legend','font-size="14" font-weight="600" fill="'+C.ink+'"');
const keys=Object.keys(legend).map(Number).sort((a,b)=>a-b),perCol=Math.ceil(keys.length/2);
keys.forEach((n,i)=>{const col=Math.floor(i/perCol),row=i%perCol,x=60+col*740,y=LY+row*25;
  add(`<circle cx="${x+10}" cy="${y-4}" r="9" fill="${C.num}"/>`);add(`<text x="${x+10}" y="${y}" font-size="10.5" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>`);
  txt(x+26,y,legend[n],'font-size="12.5" fill="#333"');});
add('</svg>');
const out=path.join(__dirname,'..','fig','MW-001_media-wall.svg');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,s);
console.log('wrote',out,s.length,'bytes · callouts',nums.length,'· legend',keys.length);
