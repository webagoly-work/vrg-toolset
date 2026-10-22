// ==========================================================================
// 08m-wf-ceiling.js — workflow round (docs/workflow), WP-E2: Mennyezeti út + Padló út — reach lines to endpoints
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The second half of the "horizontal intent by hand" rule: a lamp in the middle of a ceiling is reached by a line the
// user draws OUT of an allowed wall — from a Vezethető fal point (R2), a door's MAINS slot (O2), a box or a switch —
// across the ceiling to the lamp. On CLA these were the 6 off-wall sketch lines. Click the start, click bends (45° lock,
// Shift = free), click the target to finish; Backspace takes a bend back, Esc cancels. One line per target (a new one
// replaces the old, in one undo step). In a room with an álmennyezet the route runs ABOVE it, in the plenum (void:true).
// The same tool for the FLOOR (the user, 2026-10-14: "do the same for padló"): Padló út runs in the floor / screed to any
// endpoint that is not a ceiling lamp (an island socket, a floor box…) and never through a Padlófűtés zone (R3, ban).
// Stored as Jelölés marks {kind:'cline', plane?:'floor', tags:['mennyezet-ut'|'padlo-ut'], pts, to, lamp?, from, h, void};
// E5 reads clineFor(id) / flineFor(id). Colours: ceiling = blue, floor = brown (the user's choice).
// Deviation from WP-E2: click-click (like the room pen) instead of press-drag + middle-click bends.
MRK_KINDS.cline='Mennyezeti / padló út';
const CLN_PLANES={
  ceil: {n:'Mennyezeti út',tag:'mennyezet-ut',col:'#2f79c9',dash:'7 4',to:'lámpára',done:'mennyezeten'},
  floor:{n:'Padló út',     tag:'padlo-ut',    col:'#8a5a2b',dash:'9 3 2 3',to:'végpontra',done:'a padlóban'}};
const CLN={on:false,plane:'ceil',pts:null,from:null,cur:null};
const CLN_HEAT_MSG='A padlóút padlófűtéses zónán menne át — kerüld meg, vagy vedd le a zónát.';

function clnPlaneOf(m){return m&&m.plane==='floor'?'floor':'ceil';}
function clnMarks(level,plane){return mrkList().filter(m=>m.kind==='cline'&&(!level||m.level===level)&&(!plane||clnPlaneOf(m)===plane));}
function clineFor(id,plane){plane=plane||'ceil';return mrkList().find(m=>m.kind==='cline'&&clnPlaneOf(m)===plane&&(m.to===id||m.lamp===id))||null;}
function flineFor(id){return clineFor(id,'floor');}
function clnTol(){return Math.max(60,12/(state.zoom||1)/SC);}
function clnPt(e){const [bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(state.active,0));return [p[0],p[1]];}
// where a line may start: {p, from} or null — a door MAINS slot, a box / switch, or a point on a Vezethető fal
function clnStartAt(p,level){const tol=clnTol();let best=null,bd=tol;
  (data.openings||[]).forEach(o=>{if(o.level!==level||o.type!=='door'||typeof ptSlots!=='function')return;
    ptSlots(o).forEach(s=>{if(s.fam!=='MAINS')return;const d=Math.hypot(s.x-p[0],s.y-p[1]);if(d<bd){bd=d;best={p:[s.x,s.y],from:{door:s.door,face:s.face,k:s.k},why:'portál '+s.k};}});});
  data.devices.forEach(d=>{if(!d||d.level!==level)return;const c=typeof epCodeOf==='function'?epCodeOf(d):null;
    if(!(d.type==='box'||d.type==='junction'||d.type==='rbx'||d.type==='portal'||c==='SWI'))return;
    const q=Math.hypot(d.x-p[0],d.y-p[1]);if(q<bd){bd=q;best={p:[d.x,d.y],from:{dev:d.id},why:d.ref||d.id};}});
  if(best)return best;
  // a Vezethető fal: the foot point on the centreline of a covered wall
  let wb=null,wd=tol+300;(WALLS[level]||[]).forEach(r=>{if(!r||!r.id)return;const wi=wallInfo(r),[a,b]=wi.seg,f=wfpFoot(p,a,b);
    if(f.d>wi.thick/2+tol||f.d>=wd)return;const u=mrkU(r,f.q[0],f.q[1]);if(!rwlCovers(r.id,u,level))return;wd=f.d;wb={p:[Math.round(f.q[0]),Math.round(f.q[1])],from:{wall:r.id,u:Math.round(u)},why:'vezethető fal'};});
  return wb;}
// the target under the pointer: a ceiling lamp (ceiling), or any endpoint that is not a ceiling lamp (floor)
function clnTargetAt(p,level,plane){let best=null,bd=clnTol()*1.5;
  data.devices.forEach(d=>{if(!d||d.level!==level||typeof epCodeOf!=='function')return;const c=epCodeOf(d);if(!c)return;
    const ceilLamp=c==='LMP'&&d.side==null;if(plane==='floor'?ceilLamp:!ceilLamp)return;
    const q=Math.hypot(d.x-p[0],d.y-p[1]);if(q<bd){bd=q;best=d;}});return best;}
function clnLampAt(p,level){return clnTargetAt(p,level,'ceil');}
function clnSnap(p,shift){const P=CLN.pts;if(!P||!P.length)return p;const L=wfpLock(P[P.length-1],p,50);return shift?[Math.round(p[0]),Math.round(p[1])]:L.p;}
// a floor line must not cross a Padlófűtés (ban) zone: the first zone any segment touches, or null
function clnSegRect(a,b,r){const inR=q=>q[0]>r.x0&&q[0]<r.x1&&q[1]>r.y0&&q[1]<r.y1;if(inR(a)||inR(b))return true;
  const E=[[[r.x0,r.y0],[r.x1,r.y0]],[[r.x1,r.y0],[r.x1,r.y1]],[[r.x1,r.y1],[r.x0,r.y1]],[[r.x0,r.y1],[r.x0,r.y0]]];return E.some(e=>wfpSegX(a,b,e[0],e[1]));}
function clnHeatHit(pts,level){const Z=mrkList().filter(m=>m.kind==='zone'&&m.shape==='rect'&&m.level===level&&(m.tags||[]).indexOf('padlofutes')>=0);
  for(let i=1;i<pts.length;i++)for(const z of Z)if(clnSegRect(pts[i-1],pts[i],z))return z;return null;}
// the height the line runs at: the ceiling (above the álmennyezet if any), or the floor
function clnHeight(dev,plane){if(plane==='floor')return {h:0,void:false};const e=typeof roomOfDevice==='function'?roomOfDevice(dev):null,rm=e&&e.rm;
  const v=!!(rm&&typeof hasDropCeil==='function'&&hasDropCeil(dev.level,rm));
  return {h:rm&&typeof roomCeilH==='function'?roomCeilH(rm,dev.level):wallH(dev.level),void:v,room:rm&&rm.id};}
// make (or replace) the line of a target in ONE undo step (mrkAdd would push a second one); null when refused
function clnCommit(pts,from,dev,plane){plane=plane==='floor'?'floor':'ceil';if(!dev||!pts||pts.length<1)return null;const H=clnHeight(dev,plane);
  const P=pts.concat([[dev.x,dev.y]]).map(q=>[Math.round(q[0]),Math.round(q[1])]);
  if(plane==='floor'&&clnHeatHit(P,dev.level))return null;
  pushUndo(['marks']);const old=clineFor(dev.id,plane);if(old)mrkList().splice(mrkList().indexOf(old),1);
  const rec={kind:'cline',level:dev.level,pts:P,to:dev.id,from,h:H.h,void:H.void,pol:'plus',tags:[CLN_PLANES[plane].tag],layer:mrkLayer()};
  if(plane==='floor')rec.plane='floor';else rec.lamp=dev.id;
  mrkList().push(rec);ensureIds(data);draw();return rec;}
// a wall-to-wall crossing (Q9): no target device; E5 turns it into a trunk ceiling link with a pull box at each end
function clnCommitCross(pts,from,toWall,level){const P=pts.map(q=>[Math.round(q[0]),Math.round(q[1])]);pushUndo(['marks']);
  const rec={kind:'cline',level,pts:P,from,toWall,cross:true,h:wallH(level),void:false,pol:'plus',tags:[CLN_PLANES.ceil.tag],layer:mrkLayer()};
  mrkList().push(rec);ensureIds(data);draw();return rec;}
function clnLen(m){let L=0;for(let i=1;i<m.pts.length;i++)L+=Math.hypot(m.pts[i][0]-m.pts[i-1][0],m.pts[i][1]-m.pts[i-1][1]);return L;}

function clnToolStart(plane){toolsOff();
  if(state.mode!=='select')setMode('select');CLN.on=true;CLN.plane=plane==='floor'?'floor':'ceil';CLN.pts=null;CLN.from=null;clnHint();draw();}
function clnHint(){const mh=$('modeHint');if(!mh)return;const P=CLN_PLANES[CLN.plane];
  mh.textContent=!CLN.on?(HINTS[state.mode]||''):!CLN.pts?P.n+' — kattints a kezdőpontra: vezethető fal, ajtó portálhelye, doboz vagy kapcsoló · Esc kilép'
    :P.n+' — töréspont kattintással (45°, Shift = szabad) · kattints a '+P.to+' a befejezéshez'+(CLN.plane==='ceil'&&CLN.from&&CLN.from.wall?' (vagy egy másik vezethető falra: átvezetés)':'')+' · Backspace: vissza · Esc: elvet';}
function clnOff(){CLN.on=false;CLN.pts=null;CLN.from=null;CLN.cur=null;clnHint();}
STK_TOOLS.push({k:'clnTool',active:()=>{if(!CLN.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){clnOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const lvl=state.active,p=clnPt(e),PL=CLN_PLANES[CLN.plane];
    if(!CLN.pts){const s=clnStartAt(p,lvl);if(!s){$('hud').textContent='Csak vezethető falról, portálból vagy dobozból indulhat.';return true;}
      CLN.pts=[s.p];CLN.from=s.from;$('hud').textContent=PL.n+' innen: '+s.why;clnHint();draw();return true;}
    const dev=clnTargetAt(p,lvl,CLN.plane);
    if(dev){const m=clnCommit(CLN.pts,CLN.from,dev,CLN.plane);
      if(!m){$('hud').textContent=CLN_HEAT_MSG;return true;}
      CLN.pts=null;CLN.from=null;clnHint();
      $('hud').textContent=PL.n+' → '+(dev.ref||dev.id)+' · '+wfpMm(clnLen(m))+' mm · '+(m.void?'álmennyezet fölött':PL.done);draw();return true;}
    // E5-Q9 = A: a ceiling line that starts AND ends on a Vezethető fal is a trunk ceiling crossing (the stair void)
    if(CLN.plane==='ceil'&&CLN.from&&CLN.from.wall){const s=clnStartAt(p,lvl),last=CLN.pts[CLN.pts.length-1];
      if(s&&s.from&&s.from.wall&&Math.hypot(s.p[0]-last[0],s.p[1]-last[1])>clnTol()*2){const m=clnCommitCross(CLN.pts.concat([s.p]),CLN.from,s.from,lvl);
        CLN.pts=null;CLN.from=null;clnHint();$('hud').textContent='Mennyezeti átvezetés falról falra · '+wfpMm(clnLen(m))+' mm — a gerinc használhatja';draw();return true;}}
    const q=clnSnap(p,e.shiftKey);
    if(CLN.plane==='floor'&&clnHeatHit([CLN.pts[CLN.pts.length-1],q],lvl)){$('hud').textContent=CLN_HEAT_MSG;return true;}
    CLN.pts.push(q);draw();return true;},
  move(e){if(!CLN.pts)return false;CLN.cur=clnSnap(clnPt(e),e.shiftKey);draw();return false;},
  key(e){if(e.key==='Backspace'&&CLN.pts){CLN.pts.pop();if(!CLN.pts.length){CLN.pts=null;CLN.from=null;}clnHint();draw();e.preventDefault();return true;}return false;},
  esc(){if(CLN.pts){CLN.pts=null;CLN.from=null;clnHint();draw();}else{clnOff();draw();}},mode(){clnOff();}});

function clnSvg(m,z,col,live,plane){plane=plane||clnPlaneOf(m);const P=m.pts.map(q=>[q[0],q[1],z]);if(P.length<2)return '';
  const a=planToBase(P[0][0],P[0][1],z),PL=CLN_PLANES[plane];
  return `<polyline class="cln cln-${plane}" points="${p2b(P)}" fill="none" stroke="${col}" stroke-width="${vsP(live?1.8:1.4)}" stroke-dasharray="${vsDash(m.void?'2 3':PL.dash)}"/>`
    +`<path d="M${(a[0]-vsP(4)).toFixed(1)} ${(a[1]).toFixed(1)}h${vsP(8).toFixed(1)}" stroke="${col}" stroke-width="${vsP(2)}"/>`;}
STK_SCENE.push(()=>{let s='';for(const l of ORD){if(!state.levels[l])continue;const z=dz(l,0);
  clnMarks(l).forEach(m=>{if(layerShows(m,'mark'))s+=clnSvg(m,z,CLN_PLANES[clnPlaneOf(m)].col,false);});}return s;});
STK_OVERLAY.push(()=>{if(!CLN.on||!CLN.pts)return '';const z=dz(state.active,0),P=CLN.pts.concat(CLN.cur?[CLN.cur]:[]);
  return clnSvg({pts:P,void:false},z,CLN_PLANES[CLN.plane].col,true,CLN.plane);});
// check: a ceiling lamp with no reach line gets the router's default (info, so the user knows)
(STK_CHECKS['sys:LIGHT']=STK_CHECKS['sys:LIGHT']||[]).push(()=>data.devices.filter(d=>d&&typeof epCodeOf==='function'&&epCodeOf(d)==='LMP'&&d.side==null&&!clineFor(d.id))
  .map(d=>({sev:'info',code:'cln.none',msg:(d.ref||d.id)+': nincs mennyezeti útja — a legközelebbi vezethető falpontról indul.'})));

registerActions([{id:'wf.ceilLine',label:'Mennyezeti út',icon:'〰',group:'Véset',alias:'ceiling route reach mennyezeti ut',
  hint:'Vonal a vezethető falról / portálból / dobozból a mennyezeten át a lámpához; álmennyezetnél fölötte.',when:c=>!c.inEditor,run:()=>clnToolStart('ceil')},
  {id:'wf.floorLine',label:'Padló út',icon:'▭',group:'Véset',alias:'floor route padlo ut sziget',
   hint:'Vonal a vezethető falról / portálból / dobozból a padlóban egy végponthoz (sziget, padlódoboz); padlófűtéses zónán nem mehet át.',when:c=>!c.inEditor,run:()=>clnToolStart('floor')}]);
