// ==========================================================================
// 05z-icons.js — the drawn symbol set: body tells the family, mark tells the device,
//                colour tells the system (prefix ico)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Everything that was not a socket, a switch, a lamp or a board used to fall through to one
// generic square-with-a-dot, so an érzékelő, a kezelőpanel, a hangszóró and a kamera were the same
// picture. A symbol now carries three separate things, and each answers a different question:
//
//   BODY   what KIND of thing is it, and how big is it really —
//          szerelvény (a 68 mm doboz) < kötődoboz < mennyezeti pont < hardver;
//   MARK   WHICH device it is — a two-or-three-stroke pictogram inside the body;
//   COLOUR which SYSTEM it belongs to — the role colour from STK_COL (05m), the same red
//          for Erősáram in every project; or the layer's own colour where that is switched on.
//
// Sizing is hybrid [user]: up to view scale 2 the bodies are a readable fixed SCREEN size, in
// tiers that only suggest the real proportions. From 2× they are drawn as real plan footprints in
// millimetres, aligned to the wall they sit on — at 5–10× a 68 mm szerelvény really is 68 mm
// against its wall, and a RoomBox really is its own box. One picture, two honest regimes.
//
// The marks are ours, drawn here as path data in a −5…+5 unit box. Nothing is fetched and nothing
// is a font: the product is one offline HTML file, and an icon font would be a second one.

const ICO_MM_FROM=2;                 // from this view-scale step the bodies are real millimetres
const ICO_SZ_MM=68;                  // szerelvénydoboz ⌀ (DEV_BOX_W in 06, which loads later)
const ICO_CEIL_MM=120;               // a ceiling outlet's own plate
function icoMmMode(){return vsK()>=ICO_MM_FROM;}

// family → {r: half-size in base units at scale 1, mm: real size, shape}
// The r ladder is the "relative size" the user asked the shapes to carry: a szerelvény is the
// smallest and the most numerous, hardware is unmistakably bigger.
const ICO_FAM={
 szerelveny:{r:5.0, mm:ICO_SZ_MM,   shape:'sq'},     // flush device in a 68 mm box
 ceiling:   {r:6.0, mm:ICO_CEIL_MM, shape:'circ'},   // lamp, sensor, AP, speaker — on the plane above
 doboz:     {r:6.6, mm:null,        shape:'auto'},   // kötődoboz: its own jbSize and jbShape
 hw:        {r:9.0, mm:null,        shape:'hw'},     // RBX, mérőóra, ISP, SSC — its real body
 hwbig:     {r:10.5,mm:null,        shape:'hw'}};    // elosztószekrény, BASE

// ---- the marks ---------------------------------------------------------------------------------
// Each is drawn inside a −5…+5 box and scaled to the body. `f` fills instead of strokes.
const ICO_MARK={
 socket:  {d:'M-3.2 1.3 A3.2 3.2 0 0 1 3.2 1.3 Z M-3.8 1.3 H3.8',f:1},
 switch:  {d:'M0 2.6 L0 0 L2.8 -2.8 M-1 2.6 H1'},
 light:   {d:'M-2.7 -2.7 L2.7 2.7 M2.7 -2.7 L-2.7 2.7'},
 ledline: {d:'M-3.8 1.4 L-1.3 -1.4 L1.3 1.4 L3.8 -1.4'},
 dedicat: {d:'M0.9 -3.2 L-1.7 0.4 H0.2 L-0.9 3.2 L2.1 -0.5 H0.3 Z',f:1},
 shutter: {d:'M-3.2 -2.6 H3.2 M-3.2 -0.9 H3.2 M-3.2 0.8 H3.2 M-3.2 2.5 H3.2'},
 uep:     {d:'M-2.1 0 A2.1 2.1 0 1 0 2.1 0 A2.1 2.1 0 1 0 -2.1 0 M-0.9 0 H0.9'},
 notify:  {d:'M0 -1.6 A1.6 1.6 0 1 0 0 1.6 A1.6 1.6 0 1 0 0 -1.6 M0 -3.6 V-2.6 M0 2.6 V3.6 M-3.6 0 H-2.6 M2.6 0 H3.6'},
 portal:  {d:'M-2.9 3.2 V-0.5 A2.9 2.9 0 0 1 2.9 -0.5 V3.2'},
 wifi:    {d:'M-3.2 0.4 A4.4 4.4 0 0 1 3.2 0.4 M-1.7 2 A2.4 2.4 0 0 1 1.7 2 M-0.5 3.2 A0.7 0.7 0 1 0 0.5 3.2 A0.7 0.7 0 1 0 -0.5 3.2'},
 eth:     {d:'M-2.7 -2.2 H2.7 V1.2 H1.2 V2.8 H-1.2 V1.2 H-2.7 Z'},
 cam:     {d:'M-3.2 -1.7 H0.9 V1.7 H-3.2 Z M0.9 -0.6 L3.2 -2.4 V2.4 L0.9 0.6 Z'},
 knx:     {d:'M-3.6 0 H3.6 M-2.4 -1.2 V1.2 M0 -1.2 V1.2 M2.4 -1.2 V1.2'},
 sensor:  {d:'M-0.8 -2.6 A0.8 0.8 0 1 0 0.8 -2.6 A0.8 0.8 0 1 0 -0.8 -2.6 M-2.4 0 A2.6 2.6 0 0 0 2.4 0 M-3.8 1.6 A4 4 0 0 0 3.8 1.6'},
 panel:   {d:'M-3 -2.5 H3 V2.5 H-3 Z M-1.5 1.1 H1.5'},
 thermo:  {d:'M0 1.4 V-2.9 M-1.1 2.3 A1.4 1.4 0 1 0 1.1 2.3 A1.4 1.4 0 1 0 -1.1 2.3 M1 -1.6 H2.2 M1 -0.3 H2.2'},
 speaker: {d:'M-3.2 -1.4 H-1.4 L0.4 -3.1 V3.1 L-1.4 1.4 H-3.2 Z M1.8 -1.5 A2.2 2.2 0 0 1 1.8 1.5'},
 screen:  {d:'M-3.2 -2.4 H3.2 V1 H-3.2 Z M0 1 V2.4 M-1.7 2.7 H1.7'},
 avp:     {d:'M-3.2 -2.2 H3.2 V2.2 H-3.2 Z M-0.8 -0.9 L1.2 0 L-0.8 0.9 Z'},
 usb:     {d:'M0 3.2 V-3.2 M0 -0.9 L-2.1 0.9 M0 -0.9 L2.1 0.9 M-0.7 3.2 A0.7 0.7 0 1 0 0.7 3.2 A0.7 0.7 0 1 0 -0.7 3.2 M-2.1 0.9 V2 M2.1 0.9 L2.1 2'},
 shield:  {d:'M0 -3.3 L2.9 -1.9 V0.7 C2.9 2.5 0 3.4 0 3.4 C0 3.4 -2.9 2.5 -2.9 0.7 V-1.9 Z'},
 // S5 — security marks on the shared body: MOT a fan of rays · DWC reed + magnet bars · GLB a cracked pane · SRN a horn ·
 // KPD a 3×3 grid · PNC "!" · LCK a padlock · SMK a ring with three dots · COA "CO" · DBL a bell
 motion:  {d:'M-3 2.8 L3.4 -1.2 M-3 2.8 L2 -3.2 M-3 2.8 L3.6 1.6 M-3 2.8 m-0.6 0 a0.6 0.6 0 1 0 1.2 0 a0.6 0.6 0 1 0 -1.2 0'},
 contact: {d:'M-2.9 -3 H-0.9 V3 H-2.9 Z M0.9 -3 H2.9 V3 H0.9 Z'},
 glass:   {d:'M-3 -3 H3 V3 H-3 Z M-0.4 -3 L0.6 -0.8 L-0.7 0.7 L0.5 3'},
 siren:   {d:'M-3.2 -1 H-1.2 L2.2 -3 V3 L-1.2 1 H-3.2 Z M3.3 -2.2 V2.2'},
 keypad:  {d:'M-2.2 -2.2 h0.01 M0 -2.2 h0.01 M2.2 -2.2 h0.01 M-2.2 0 h0.01 M0 0 h0.01 M2.2 0 h0.01 M-2.2 2.2 h0.01 M0 2.2 h0.01 M2.2 2.2 h0.01'},
 panic:   {d:'M0 -3.2 V1 M0 2.6 V2.7'},
 lock:    {d:'M-2.5 -0.3 H2.5 V3.1 H-2.5 Z M-1.5 -0.3 V-1.7 A1.5 1.5 0 0 1 1.5 -1.7 V-0.3 M0 1 V1.9'},
 smoke:   {d:'M-3 0 A3 3 0 1 0 3 0 A3 3 0 1 0 -3 0 M-1.3 0 h0.01 M0 0 h0.01 M1.3 0 h0.01'},
 coalarm: {d:'M-0.7 -1.4 A1.7 1.7 0 1 0 -0.7 1.4 M0.4 0 A1.35 1.35 0 1 0 3.1 0 A1.35 1.35 0 1 0 0.4 0'},
 bell:    {d:'M-2.5 1.6 C-2.5 -3.4 2.5 -3.4 2.5 1.6 Z M-3.2 1.6 H3.2 M-0.7 2.4 A0.7 0.7 0 0 0 0.7 2.4'},
 junction:{d:'M-3.8 0 H-1.5 M1.5 0 H3.8 M0 -3.8 V-1.5 M0 1.5 V3.8 M-1 0 A1 1 0 1 0 1 0 A1 1 0 1 0 -1 0',f:0},
 rbx:     {d:'M-2.8 -3.2 H2.8 V3.2 H-2.8 Z M1.1 -3.2 V3.2 M-0.2 0 H0.4'},
 base:    {d:'M-3.2 -2.6 H3.2 M-3.2 0 H3.2 M-3.2 2.6 H3.2 M-3.2 -3.4 V3.4 M3.2 -3.4 V3.4'},
 board:   {d:'M-3.4 -2.4 H3.4 V2.4 H-3.4 Z M-1.7 -1.2 V1.2 M0 -1.2 V1.2 M1.7 -1.2 V1.2'},
 meter:   {d:'M-2.6 0 A2.6 2.6 0 1 0 2.6 0 A2.6 2.6 0 1 0 -2.6 0 M0 0 L1.8 -1.3'},
 entry:   {d:'M-3.6 0 H1.4 M-0.4 -1.7 L1.7 0 L-0.4 1.7 M2.8 -2.6 V2.6'},
 generic: {d:'M-1.3 0 A1.3 1.3 0 1 0 1.3 0 A1.3 1.3 0 1 0 -1.3 0',f:1},
 // round 2026-10-22 — Gyengeáram, Tűzvédelem, EPH, Okos előkészítés
 tvsat:   {d:'M-2.6 0 A2.6 2.6 0 1 0 2.6 0 A2.6 2.6 0 1 0 -2.6 0 M-0.6 0 A0.6 0.6 0 1 0 0.6 0 A0.6 0.6 0 1 0 -0.6 0 M-3.6 0 H-2.6 M2.6 0 H3.6'},
 intercom:{d:'M-2.2 -3 H2.2 V3 H-2.2 Z M-1.2 -1.8 H1.2 V0.2 H-1.2 Z M-0.9 1.6 h0.01 M0.9 1.6 h0.01'},
 heat:    {d:'M-3 0 A3 3 0 1 0 3 0 A3 3 0 1 0 -3 0 M-1.8 0.8 L-0.9 -0.8 L0 0.8 L0.9 -0.8 L1.8 0.8'},
 callpt:  {d:'M-2.8 -2.8 H2.8 V2.8 H-2.8 Z M-1.6 -1.6 L1.6 1.6'},
 bond:    {d:'M0 -3 V0.6 M-2.6 0.6 H2.6 M-1.7 1.8 H1.7 M-0.8 3 H0.8'},
 neutral: {d:'M-2.4 -2.4 H2.4 V2.4 H-2.4 Z M-1.1 1.2 V-1.2 L1.1 1.2 V-1.2'},
 deepbox: {d:'M-2.4 -2.4 H2.4 V2.4 H-2.4 Z M-1.4 -1.4 H1.4 V1.4 H-1.4 Z'},
 spare:   {d:'M-3.2 -1.2 H3.2 M-3.2 1.2 H3.2 M-1.6 -1.2 V1.2 M1.6 -1.2 V1.2'},
 // 2026-10-26 — Veszélyérzékelők
 gas:     {d:'M-3 0 A3 3 0 1 0 3 0 A3 3 0 1 0 -3 0 M0.9 -1 A1.3 1.3 0 1 0 0.9 1 H0 V0.2'},
 leak:    {d:'M0 -3 C-1.8 -0.4 -2.3 0.6 -2.3 1.3 A2.3 2.3 0 0 0 2.3 1.3 C2.3 0.6 1.8 -0.4 0 -3 Z'},
 valve:   {d:'M-3 -2 L3 2 V-2 L-3 2 Z M0 0 V-3.2 M-1.2 -3.2 H1.2'}};

// code → mark, for the endpoint catalogue (05s). A code can appear under two roles (LMP is both a
// MAINS lamp and a BUSB escape light); the colour separates them, the mark stays the same thing.
const ICO_BY_CODE={LMP:'light',SWI:'switch',SOC:'socket',DED:'dedicat',SHU:'shutter',LNR:'ledline',
 UEP:'uep',NTL:'notify',POR:'portal',ACP:'wifi',ETH:'eth',CAM:'cam',ACT:'knx',SEN:'sensor',
 PAN:'panel',THR:'thermo',SPK:'speaker',SCR:'screen',AVP:'avp',USB:'usb',SEC:'shield',
 MOT:'motion',DWC:'contact',GLB:'glass',SRN:'siren',KPD:'keypad',PNC:'panic',LCK:'lock',SMK:'smoke',COA:'coalarm',DBL:'bell',   // S5
 TVA:'tvsat',BEL:'bell',ICM:'intercom',HDT:'heat',MCP:'callpt',SND:'siren',EPB:'bond',PEB:'bond',NUT:'neutral',DPB:'deepbox',RSV:'spare',   // 2026-10-22
 GAS:'gas',WLK:'leak',HTA:'heat',VLV:'valve'};   // 2026-10-26
const ICO_BY_TYPE={socket:'socket',switch:'switch',light:'light',junction:'junction',box:'generic',
 board:'board',rbx:'rbx',base:'base',meter:'meter',entry:'entry',ssc:'shield',mdb:'tvsat',fire:'callpt',eph:'bond'};
// which codes live on the plane above rather than on a wall — they get the round ceiling body
const ICO_CEILING=['LMP','LNR','ACP','SEN','SPK','SMK','HDT','HTA'];

// ---- what a device is --------------------------------------------------------------------------
function icoHw(d){return !!(d&&typeof HW_TYPES!=='undefined'&&HW_TYPES[d.type]);}
function icoFamOf(d){
  if(!d)return 'szerelveny';
  if(d.type==='board'||d.type==='base')return 'hwbig';
  if(icoHw(d))return 'hw';
  if(d.type==='box')return 'szerelveny';        // an empty szerelvénydoboz is a 68 mm box like any other
  if(d.type==='junction')return 'doboz';
  const code=(typeof epCodeOf==='function')?epCodeOf(d):null;
  const en=(typeof epEntryOf==='function')?epEntryOf(d):null;
  const mount=en?en.mount:(d.type==='light'?'ceiling':'wall');
  if(mount==='ceiling'||(code&&ICO_CEILING.indexOf(code)>=0&&mount!=='wall'))return 'ceiling';
  return 'szerelveny';}
function icoMarkOf(d){
  const code=(typeof epCodeOf==='function')?epCodeOf(d):null;
  if(code==='SWI'&&d&&(d.var==='pir'||d.var==='pres'))return 'motion';   // a switch-sensor (2026-10-26) reads as a detector
  if(code&&ICO_BY_CODE[code])return ICO_BY_CODE[code];
  return ICO_BY_TYPE[d&&d.type]||'generic';}
// real plan size in mm, and whether the body is round
function icoSizeOf(d,fam){
  if(fam==='doboz')return {mm:+(d.jbSize||80),round:d.jbShape==='circle'};
  if(fam==='hw'||fam==='hwbig'){const S=(typeof hwSize==='function')?hwSize(d):null;
    return {mm:S?Math.max(S.w,220):300,w:S?S.w:300,dp:S?S.dp:120,round:false,real:!!S};}
  const F=ICO_FAM[fam]||ICO_FAM.szerelveny;
  return {mm:F.mm,round:fam==='ceiling'};}

// ---- colour --------------------------------------------------------------------------------------
// A painted layer wins (it is a deliberate "show me this layer"), then the system's own role colour,
// then plain ink. Both the layer colour and the role colour come from STK_COL, so a stack layer and
// its devices can never disagree.
function icoRoleCol(d){
  if(typeof epRoleOf==='function'){const r=epRoleOf(d);
    if(r&&typeof stkRoleCol==='function'){const c=stkRoleCol(r,typeof epCodeOf==='function'?epCodeOf(d):null);if(c)return c;}}
  if(icoHw(d)&&typeof stkRoleCol==='function'){
    const role=(typeof HW_DEF!=='undefined'&&HW_DEF[d.type]||{}).role||'hw';
    const c=stkRoleCol(role);if(c)return c;}
  if(d&&d.type==='board'&&typeof stkRoleCol==='function')return stkRoleCol('hw');
  const L=(typeof lyrLayer==='function')?lyrLayer(d&&d.layer||'L0'):null;
  if(L&&L.stack&&L.role&&typeof stkRoleCol==='function'){const c=stkRoleCol(L.role);if(c)return c;}
  return null;}
function icoCol(d){
  const t=(typeof layerTintOf==='function')?layerTintOf(d):null;    // a painted / hand-tinted layer
  return t||icoRoleCol(d)||'#3a3a3a';}
function icoMix(hex,a){            // toward white; a = how much of the colour survives
  if(!/^#[0-9a-f]{6}$/i.test(hex))return hex;
  const n=parseInt(hex.slice(1),16),m=v=>Math.round(255-(255-v)*a);
  return '#'+[m(n>>16&255),m(n>>8&255),m(n&255)].map(v=>v.toString(16).padStart(2,'0')).join('');}

// ---- geometry --------------------------------------------------------------------------------------
// the real footprint in plan, squared or rounded, turned to the wall it sits on
function icoFoot(d,mm,round,z){
  const h=(typeof deviceHostWall==='function'&&d&&d.side!=null)?deviceHostWall(d):null;
  const seg=h&&h.wi&&h.wi.seg,ang=seg?Math.atan2(seg[1][1]-seg[0][1],seg[1][0]-seg[0][0]):0;
  const c=Math.cos(ang),s=Math.sin(ang),r=mm/2;
  const P=(u,v)=>[d.x+c*u-s*v,d.y+s*u+c*v,z];
  if(round){const out=[];for(let i=0;i<16;i++){const a=i*Math.PI/8;out.push(P(r*Math.cos(a),r*Math.sin(a)));}return out;}
  return [P(-r,-r),P(r,-r),P(r,r),P(-r,r)];}
// how wide the real footprint comes out on the base canvas — the mark is sized to fit inside it
function icoFootR(pts){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  pts.forEach(p=>{const b=planToBase(p[0],p[1],p[2]);
    if(b[0]<x0)x0=b[0];if(b[0]>x1)x1=b[0];if(b[1]<y0)y0=b[1];if(b[1]>y1)y1=b[1];});
  return Math.min(x1-x0,y1-y0)/2;}

// ---- the symbol --------------------------------------------------------------------------------------
function icoMarkSvg(key,x,y,r,col,sw){
  const M=ICO_MARK[key]||ICO_MARK.generic,s=r/5*0.86;        // the box is −5…5, leave a rim
  const t=`translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${s.toFixed(3)})`;
  return M.f?`<path transform="${t}" d="${M.d}" fill="${col}" stroke="${col}" stroke-width="${(sw/s).toFixed(2)}" stroke-linejoin="round"/>`
            :`<path transform="${t}" d="${M.d}" fill="none" stroke="${col}" stroke-width="${(sw/s).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;}
function icoBodySvg(fam,x,y,r,fill,col,sw,dash,round){
  if(round||fam==='ceiling')return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${fill}" stroke="${col}" stroke-width="${sw}"${dash}/>`;
  const rx=(fam==='szerelveny'?r*0.3:r*0.16).toFixed(2);
  return `<rect x="${(x-r).toFixed(1)}" y="${(y-r).toFixed(1)}" width="${(2*r).toFixed(2)}" height="${(2*r).toFixed(2)}" rx="${rx}" fill="${fill}" stroke="${col}" stroke-width="${sw}"${dash}/>`;}

// The one entry point: registered FIRST on STK_DEVSYM, so it answers for every device type it knows
// and hands the rest back to the symbols that were there before.
function icoSym(d,x,y,k,back){
  if(!d||!d.type)return null;
  const fam=icoFamOf(d);
  if(fam==='szerelveny'&&!ICO_BY_TYPE[d.type]&&!(typeof epCodeOf==='function'&&epCodeOf(d)))return null;
  const mark=icoMarkOf(d),size=icoSizeOf(d,fam),F=ICO_FAM[fam]||ICO_FAM.szerelveny;
  // On the dark client-preview ground the same colours have to go the other way: lift them toward
  // the light instead of washing them toward white, and sit them on the ground, not on paper.
  const dark=(typeof prevOn==='function')&&prevOn();
  const base=icoCol(d),col=back?'#9299a0':(dark?icoMix(base,0.62):base);
  const ink=back?'#9299a0':(dark?icoMix(base,0.5):icoMix(base,0.86));
  // a painted or hand-tinted layer is a deliberate "show me this one", so it fills loudly; the
  // system's own colour only washes the body, or every plan would read as a colour chart
  const paint=(typeof layerTintOf==='function')?layerTintOf(d):null;
  const fill=back?(dark?'#121a23':'#f2f4f6')
    :dark?'#0e141b':(paint?tintMix(paint,0.45):icoMix(base,0.14));
  // an empty szerelvénydoboz is drawn open: there is nothing in it yet
  const pp=(!back&&d.type!=='box'&&typeof prnActive==='function'&&prnActive()&&typeof stkPrintOf==='function')?stkPrintOf(typeof epRoleOf==='function'?epRoleOf(d):null,typeof epCodeOf==='function'?epCodeOf(d):null):null;
  const dash=back?` stroke-dasharray="${vsDash('2.5 2')}"`
    :(d.type==='box'?` stroke-dasharray="${vsDash('3 2')}"`
    :(pp&&STK_PRINT_DASH[pp.p]?` stroke-dasharray="${vsDash(STK_PRINT_DASH[pp.p])}"`:''));   // M1: the print pattern
  let s='',r;
  if(icoMmMode()&&size.mm){                                    // real millimetres, on the wall
    const z=dz(d.level,d.h||0),pts=icoFoot(d,size.mm,size.round,z);
    r=Math.max(2.2,icoFootR(pts));
    s+=`<polygon points="${p2b(pts)}" fill="${fill}" stroke="${ink}" stroke-width="${vsP(1.3)}"${dash}/>`;
  }else{                                                        // fixed screen size, in tiers
    r=F.r*k;
    s+=icoBodySvg(fam,x,y,r,fill,ink,+(k*1.5).toFixed(2),dash,size.round);
  }
  s+=icoMarkSvg(mark,x,y,r,col,Math.max(0.8,r*0.17));
  // The pictogram says what kind of thing it is; these say WHICH one, and a plan is still read in
  // words. Hardware keeps its short label (RBX / EL / kWh / ISP / SSC / BASE) plus the one line
  // that matters for it, and an endpoint keeps its STD-004 code — exactly what they said before.
  const lab=[];
  if(icoHw(d)||d.type==='board'){
    const L=(typeof HW_DEF!=='undefined'&&HW_DEF[d.type]||{}).lbl;if(L)lab.push(L);
    if(d.type==='rbx')lab.push(d.rb||(typeof HW_RB_DEF!=='undefined'?HW_RB_DEF:''));
    else if(d.type==='base'&&typeof hwUnits==='function')lab.push(hwUnits(d).map(u=>u[0]).join('·'));}
  else if(d.type==='ep')lab.push(d.code||'?');
  const halo=dark?(typeof PREV!=='undefined'?PREV.ground:'#0a0e13'):'#fff';
  if(typeof alaprajzOn==='function'&&alaprajzOn())return s;   // V9a: the plan output carries no codes until V9b places them
  lab.filter(Boolean).forEach((t,i)=>{
    s+=`<text x="${x.toFixed(1)}" y="${(y+r+vsP(8)+i*vsP(8.5)).toFixed(1)}" font-size="${vsP(i?7:8)}" text-anchor="middle"`
      +` font-weight="${i?400:700}" fill="${col}" paint-order="stroke" stroke="${halo}" stroke-width="${vsP(2.4)}">${esc(t)}</text>`;});
  return s;}

// The radius the body is actually drawn at, in base units. Rings that hug a symbol — the circuit
// end point (05j), the layer spotlight (05l) — have to follow it across the screen/millimetre
// switch, or at 5× they float around a body a third their size.
function icoBodyR(d,k){
  const fam=icoFamOf(d),size=icoSizeOf(d,fam),F=ICO_FAM[fam]||ICO_FAM.szerelveny;
  if(icoMmMode()&&size.mm)return Math.max(2.2,icoFootR(icoFoot(d,size.mm,size.round,dz(d.level,d.h||0))));
  return F.r*k;}
// The unit those rings are written in. In screen mode it is exactly the symbol scale they always
// used (a szerelvény body is 5 units), so nothing about the 1× drawing moves.
function icoRingU(d,k){const r=icoMmMode()?icoBodyR(d,k):null;return r?r/5:k;}

// ---- the legend ----------------------------------------------------------------------------------
// What the plan is actually using, so the vocabulary can be read without hunting for one of each.
function icoLegendRows(){
  const seen={},rows=[];
  data.devices.forEach(d=>{const fam=icoFamOf(d),mark=icoMarkOf(d),key=fam+'/'+mark+'/'+icoCol(d);
    if(seen[key])return;seen[key]=1;
    const en=(typeof epEntryOf==='function')?epEntryOf(d):null;
    const role=(typeof epRoleOf==='function')?epRoleOf(d):null;
    rows.push({fam,mark,col:icoCol(d),
      name:(en?en.n:(DEV[d.type]||(typeof HW_TYPES!=='undefined'&&HW_TYPES[d.type])||d.type)),
      sys:role&&typeof stkRole==='function'?((stkRole(role)||{}).n||''):''});});
  return rows.sort((a,b)=>a.sys.localeCompare(b.sys,'hu')||a.name.localeCompare(b.name,'hu'));}
function icoLegendChip(row,px){const r=px/2-1.5;
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">`
    +icoBodySvg(row.fam,px/2,px/2,r,icoMix(row.col,0.14),icoMix(row.col,0.86),1.4,'',row.fam==='ceiling')
    +icoMarkSvg(row.mark,px/2,px/2,r,row.col,Math.max(0.8,r*0.17))+`</svg>`;}
function icoLegend(){const rows=icoLegendRows();
  openModal('Jelkulcs — a terven szereplő készülékek',
    rows.length?`<div style="display:grid;grid-template-columns:28px 1fr 130px;gap:4px 8px;align-items:center;max-height:60vh;overflow:auto">`
      +rows.map(r=>icoLegendChip(r,24)+`<span style="font-size:12px">${esc(r.name)}</span>`
        +`<span style="font-size:11px;color:${r.col}">${esc(r.sys)}</span>`).join('')+`</div>`
      +`<div class="mrow" style="font-size:10.5px;color:var(--pc-mute,#888);margin-top:8px">A test mérete a készülék valódi méretét jelzi (szerelvény &lt; kötődoboz &lt; mennyezeti pont &lt; hardver), a jel azt, hogy melyik készülék, a szín pedig azt, hogy melyik rendszeré. 2× nézeti léptéktől a testek valódi milliméterben rajzolódnak.</div>`
    :`<div class="mrow">Még nincs készülék a terven.</div>`,null);}

// first in the chain: 05p's hwSymbol and 05s's endpoint square stay behind it as the fallback
STK_DEVSYM.unshift(icoSym);

registerActions([
 {id:'view.legend',alias:'jelkulcs legend ikonok szimbolumok symbols',label:'Jelkulcs (készülékjelek)',icon:'🗝',group:'Nézet',
  hint:'A terven szereplő készülékjelek: test = méret és fajta, jel = melyik készülék, szín = melyik rendszer.',
  run:()=>icoLegend()},
 {id:'layers.spotlight',alias:'reteg kiemeles spotlight highlight hover',label:'Réteg-kiemelés be/ki',icon:'💡',group:'Réteg',
  hint:'Egy készülékre mutatva az összes rétegtársa felvillan, és a réteg sora is kigyullad az oldalsávban.',
  run:()=>lyrSpotToggle()},
 {id:'layers.hoverInfo',alias:'lebego info hover card tooltip device eszkoz kartya',label:'Lebegő infó be/ki',icon:'🛈',group:'Réteg',
  hint:'Egy készülékre mutatva kis ablak: név, típus, áramkör, réteg, helyiség, magasság, egyéb adatok.',
  run:()=>hovToggle()},
 {id:'layers.paint.all',alias:'retegek szinezese szinkod colour code paint',label:'Minden réteg színezve be/ki',icon:'🎨',group:'Réteg',
  hint:'Minden réteg készülékei a réteg saját színét kapják. Rétegenként a sor színkorongjával is kapcsolható.',
  run:()=>{const on=!(layers.length&&layers.every(lyrPaints));lyrPaintAll(on);
    if($('lyrPaintAll'))$('lyrPaintAll').checked=on;
    lyrHud(on?'Minden réteg a saját színével rajzol.':'Rétegszínezés ki.');}},
 {id:'layers.paint.one',alias:'aktiv reteg szinezese paint layer',label:'Aktív réteg színezve be/ki',icon:'🎨',group:'Réteg',
  hint:'Csak az aktív réteg készülékei kapják a réteg színét.',
  run:()=>lyrTogglePaint(state.activeLayer)}
]);

// test hooks
window.ICO_FAM=ICO_FAM;window.ICO_MARK=ICO_MARK;window.ICO_BY_CODE=ICO_BY_CODE;window.ICO_BY_TYPE=ICO_BY_TYPE;
window.ICO_MM_FROM=ICO_MM_FROM;window.icoSym=icoSym;window.icoFamOf=icoFamOf;window.icoMarkOf=icoMarkOf;
window.icoCol=icoCol;window.icoRoleCol=icoRoleCol;window.icoMmMode=icoMmMode;window.icoSizeOf=icoSizeOf;
window.icoLegendRows=icoLegendRows;window.icoLegend=icoLegend;window.icoMix=icoMix;
window.icoBodyR=icoBodyR;window.icoRingU=icoRingU;
