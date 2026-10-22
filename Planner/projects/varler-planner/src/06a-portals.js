// ==========================================================================
// 06a-portals.js — Portals (the SmartFrame of a door) and the Silver Rail (IDEA-003)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A Portal is a HARDWARE device (05p): type 'portal', the nest box of one door face, on the Hardver layer.
//   {type:'portal', door:<opening id>, face:±1 (the wall side it sits on), room:<room id>, at:'hinge'|'latch',
//    cls:'PT-S'|'PT-D'|'PT-E'|'PT-W'|'PT-B', tier:'SF-0'…'SF-3', level, x, y, h, side}
// Where the nest goes is IDEA-003 §3.3: H0-1 the hinge-side upper corner on the served room's face; H0-3 the latch
// side when the wall beyond the hinge jamb is shorter than 300 mm (a 200 box needs 100–300 from the edge — four of
// the seven CLA doors). Its height is the rail line: max(ZW-o lower line, lintel top + 150) + 50, which is 2450 under
// the 2850 CLA ceiling and stays clear of the lintel under a lower one.
// The Silver Rail is an ordinary path (route:'rail') drawn with the Path tool, like a channel (05r): RBX ↔ Portals.
// Node tiers (IDEA-003 §8): gold = Elosztó, mérőóra, ISP, BASE, SSC · silver = RBX, Portal · bronze = endpoints and
// the cluster boxes that house them. A path takes the tier of the node it leaves. Prefix: pt / rail / nd.

const PT_CLS={'PT-S':'egyoldali','PT-D':'kétoldali','PT-E':'bejárati (P-3)','PT-W':'vizes oldal','PT-B':'vak (ajtó nélküli L-ág)'};
const PT_TIERS={'SF-0':'előkészítve','SF-1':'portál','SF-2':'keret','SF-3':'teljes'};
const PT_FREE_MIN=300;          // IDEA-003 H0-3: a 200 nest needs 100–300 mm from the opening edge
const PT_OFF=200;               // the zone centreline, 200 mm from the raw edge (ZS-t / ZS-t(h))
const ND_TIER={board:'gold',meter:'gold',entry:'gold',base:'gold',ssc:'gold',rbx:'silver',portal:'silver',cluster:'bronze'};
const ND_TIER_N={gold:'arany',silver:'ezüst',bronze:'bronz'};
const ND_TIER_COL={gold:'#c9a227',silver:'#8c96a0',bronze:'#a8683a'};
function ndTier(d){if(!d)return null;if(ND_TIER[d.type])return ND_TIER[d.type];return (typeof epCodeOf==='function'&&epCodeOf(d))?'bronze':null;}

// ---- door geometry -------------------------------------------------------------------------------------------------
// the rail / nest height at a point: max(ceiling − 450, door head + 280) + 50
function ptRailH(level,x,y,o){const ceil=(typeof epCeilH==='function')?epCeilH(level,x,y):wallH(level);
  return Math.round(Math.max(ceil-450,((o&&o.h)||DOOR_H)+280)+50);}
// everything IDEA-003 needs about one door face → {o, rid, r, wallSide, swing, uh, ul, uc, away, free, at, u, x, y, h, cls}
// `force` = 'hinge' | 'latch' overrides H0-1 / H0-3
function ptDoorGeo(o,rid,force){if(!o||o.type!=='door'||typeof sugDoor!=='function'||!rid)return null;
  const rs=(typeof mrkDoorRooms==='function')?mrkDoorRooms(o).map(e=>e?stkRoomId(e):null):[];if(rs.indexOf(rid)<0)return null;
  const D=sugDoor(o,rid);if(!D.r)return null;const r=D.r,wi=wallInfo(r);
  const wallSide=Math.sign(D.n[0]*wi.perp[0]+D.n[1]*wi.perp[1])||1;
  const sw=((o.variant||0)&1)?1:-1,sv=wi.horiz?[0,sw]:[sw,0],swing=(D.n[0]*sv[0]+D.n[1]*sv[1])>0;   // 04-render bpDoorSymbol
  const hp=[D.c[0]-D.hd*D.w*D.d[0],D.c[1]-D.hd*D.w*D.d[1]],lp=[D.c[0]+D.hd*D.w*D.d[0],D.c[1]+D.hd*D.w*D.d[1]];
  const uh=mrkU(r,hp[0],hp[1]),ul=mrkU(r,lp[0],lp[1]),uc=mrkU(r,D.c[0],D.c[1]),away=Math.sign(uh-uc)||1;
  // free wall beyond the hinge jamb: walk 20 mm in front of the face until the point leaves the room. The face ranges
  // of 05n are sampled too coarsely for this (B103 → R06 read 751 against a true 824).
  const e=mrkRoomById(rid);let free=Infinity;
  if(e&&e.rm&&e.rm.poly){for(let t=0;t<=4000;t+=5){const q=mrkFacePt(r,wallSide,uh+away*t,20);if(!pointInPoly(q[0],q[1],e.rm.poly)){free=t;break;}}}
  const at=force||(free>=PT_FREE_MIN?'hinge':'latch');
  const u=Math.round(at==='hinge'?uh+away*PT_OFF:ul-away*PT_OFF);
  const p=mrkFacePt(r,wallSide,u,-wi.thick/2),h=ptRailH(o.level,p[0],p[1],o);
  const tags=(typeof mrkOpeningTags==='function')?mrkOpeningTags(o.id):[];
  const kind=(typeof needKind==='function'&&e)?needKind(e.rm):'';
  const cls=tags.indexOf('bejarat')>=0?'PT-E':(kind==='furdo'||kind==='wc')?'PT-W':'PT-S';
  return {o,rid,r,wall:r.id,wallSide,swing,uh,ul,uc,away,free,at,u,x:Math.round(p[0]),y:Math.round(p[1]),h,cls,level:o.level,D};}
// a slot point on the door's frame: col 'hinge' | 'latch' | 'centre' | 'jamb', height h
function ptSlotPt(G,col,h){const u=col==='hinge'?G.uh+G.away*PT_OFF:col==='latch'?G.ul-G.away*PT_OFF:col==='jamb'?G.uh+G.away*40:G.uc;
  const p=mrkFacePt(G.r,G.wallSide,u,-wallInfo(G.r).thick/2);
  return {kind:'pt',x:Math.round(p[0]),y:Math.round(p[1]),h,level:G.level,wall:G.wall,side:G.wallSide,mount:'wall'};}
function ptOf(doorId,face){return data.devices.find(d=>d&&d.type==='portal'&&d.door===doorId&&(face==null||d.face===face))||null;}
function ptList(level){return data.devices.filter(d=>d&&d.type==='portal'&&(!level||d.level===level));}
// the door faces a portal could take on a level: [geo] for every door × each room it opens to, minus the taken ones
function ptCandidates(level){const out=[];
  (data.openings||[]).forEach(o=>{if(!o||o.type!=='door'||o.level!==level||typeof mrkDoorRooms!=='function')return;
    mrkDoorRooms(o).forEach(e=>{const rid=e&&stkRoomId(e);if(!rid)return;const G=ptDoorGeo(o,rid);if(!G||ptOf(o.id,G.wallSide))return;out.push(G);});});
  return out;}

// ---- placing ---------------------------------------------------------------------------------------------------------
function ptLayerId(){const S=(typeof stkActive==='function')?stkActive():null,L=S?stkLayer(S.id,'hw'):null;return L?L.id:state.activeLayer;}
function ptMake(G,opt){opt=opt||{};
  return {type:'portal',level:G.level,x:G.x,y:G.y,h:G.h,side:G.wallSide>0?1:0,door:G.o.id,face:G.wallSide,room:G.rid,at:G.at,
    cls:opt.cls||G.cls,tier:opt.tier||(G.cls==='PT-E'?'SF-3':'SF-1'),layer:opt.layer||ptLayerId()};}
// one undo step; a second face on the same door turns both into PT-D (unless entry / wet)
function ptPlace(G,opt){if(!G)return null;opt=opt||{};
  if(!opt.noUndo)pushUndo(['devices']);
  const d=ptMake(G,opt);data.devices.push(d);ensureIds(data);d.ref=hwRef(d);
  const other=data.devices.find(x=>x&&x!==d&&x.type==='portal'&&x.door===d.door&&x.face!==d.face);
  if(other){[d,other].forEach(x=>{if(x.cls==='PT-S')x.cls='PT-D';});}
  if(!opt.quiet){draw();lyrHud('Portál: '+d.ref+' · '+d.cls+' · '+(G.at==='hinge'?'zsanér oldal':'kilincs oldal'+(G.free<PT_FREE_MIN?' (a zsanér melletti fal csak '+G.free+' mm — H0-3)':''))+' · '+d.h+' mm');}
  return d;}
// re-seat a portal on its door (the door moved, or the user forces a side)
function ptReseat(d,force){const o=byId('openings',d.door);if(!o)return false;const G=ptDoorGeo(o,d.room,force||d.at);if(!G)return false;
  pushUndo(['devices']);Object.assign(d,{x:G.x,y:G.y,h:G.h,side:G.wallSide>0?1:0,face:G.wallSide,at:G.at});draw();return true;}
// every door with a portal mark (portal / bejarat / lepcso / p1–p3), every face that has a room, one undo step
function ptAuto(level,all){level=level||state.active;let n=0;pushUndo(['devices']);
  ptCandidates(level).forEach(G=>{const t=(typeof mrkOpeningTags==='function')?mrkOpeningTags(G.o.id):[];
    if(!all&&!['portal','bejarat','lepcso','p1','p2','p3'].some(k=>t.indexOf(k)>=0))return;ptPlace(G,{noUndo:true,quiet:true});n++;});
  draw();lyrHud(n?n+' portál elhelyezve.':'Nincs portál-jelölt ajtó (Jelölés: portál / bejárat / P1–P3).');return n;}

// the tool: hover near a door on the side of the room it should serve, click
let PT_T={on:false,g:null};
function ptGhost(e){const level=state.active,[bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(level,0));
  const re=(typeof mrkRoomAtPt==='function')?mrkRoomAtPt(level,p[0],p[1]):null,rid=re&&stkRoomId(re);if(!rid)return null;
  let best=null,bd=1500;(typeof needOpenings==='function'?needOpenings(rid,'door'):[]).forEach(o=>{if(o.level!==level)return;const dd=Math.hypot(o.x-p[0],o.y-p[1]);if(dd<bd){bd=dd;best=o;}});
  return best?ptDoorGeo(best,rid):null;}
function ptToolStart(){toolsOff();
  if(state.mode!=='select')setMode('select');const L=ptLayerId();if(L&&lyrLayer(L)){state.activeLayer=L;renderLayers();}
  PT_T.on=true;PT_T.g=null;const mh=$('modeHint');if(mh)mh.textContent='Portál: vidd az egeret az ajtó mellé, a kiszolgált helyiség oldalán · kattintás: elhelyezés · Esc kilép';}
function ptToolOff(){PT_T.on=false;PT_T.g=null;const mh=$('modeHint');if(mh)mh.textContent=(typeof HINTS!=='undefined'?HINTS[state.mode]||'':'');}
STK_TOOLS.push({k:'ptPlace',active:()=>{if(!PT_T.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){ptToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const G=ptGhost(e);if(!G){lyrHud('Itt nincs ajtó a helyiség oldalán (1,5 m-en belül).');return true;}
    if(ptOf(G.o.id,G.wallSide)){lyrHud('Ennek az ajtóoldalnak már van portálja.');return true;}ptPlace(G);return true;},
  move(e){PT_T.g=ptGhost(e);draw();return false;},
  mode(){ptToolOff();},esc(){ptToolOff();draw();}});

// ---- symbols ------------------------------------------------------------------------------------------------------------
function ptSymbol(d,x,y,k,back){if(!d||d.type!=='portal')return null;
  const z=dz(d.level,d.h||0),c=planToBase(hwFrame(d).cx,hwFrame(d).cy,z),R=v=>+(v*k).toFixed(2),ink=back?'#9299a0':'#33414c';
  return `<polygon points="${p2b(hwFootprint(d,z))}" fill="${back?'#eef1f2':HW_DEF.portal.col}" stroke="${back?ink:ND_TIER_COL.silver}" stroke-width="${R(2.4)}"/>`
    +`<text x="${c[0].toFixed(1)}" y="${(c[1]+R(3.2)).toFixed(1)}" font-size="${R(9)}" text-anchor="middle" font-weight="700" fill="${ink}">PT</text>`
    +`<text x="${c[0].toFixed(1)}" y="${(c[1]+R(12.5)).toFixed(1)}" font-size="${R(6.5)}" text-anchor="middle" fill="${ink}">${esc((d.cls||'PT-S')+' · '+(d.tier||'SF-1'))}</text>`;}
STK_DEVSYM.unshift(ptSymbol);
// the ghost and the selected portal's door: a dashed line to the door centre, the jamb it chose
STK_OVERLAY.push(()=>{let s='';const one=(G,col)=>{const fake=ptMake(G,{layer:ptLayerId()}),z=dz(G.level,G.h),zc=dz(G.level,G.h);
    s+=`<polygon points="${p2b(hwFootprint(fake,z))}" fill="${col}" fill-opacity="0.25" stroke="${col}" stroke-width="${vsP(2)}"/>`
      +`<polyline points="${p2b([[G.x,G.y,zc],[G.o.x,G.o.y,dz(G.level,(G.o.h||DOOR_H))]])}" fill="none" stroke="${col}" stroke-width="${vsP(1)}" stroke-dasharray="${vsDash('4 3')}"/>`
      +mrkText(G.x,G.y,zc,(G.at==='hinge'?'zsanér':'kilincs')+' · '+G.cls+(G.swing?' · nyíló oldal':''),col,8);};
  if(PT_T.on&&PT_T.g)one(PT_T.g,ptOf(PT_T.g.o.id,PT_T.g.wallSide)?'#c8372d':(PT_T.g.at==='hinge'?'#2e9e5b':'#d08a1e'));
  return s?`<g pointer-events="none">${s}</g>`:'';});

// ---- the Silver Rail ----------------------------------------------------------------------------------------------------
let RAIL_T={on:false,rule:'sull'};
CHN_PATH_HOOKS.push(p=>{if(!RAIL_T.on||!p)return;p.route='rail';chnApplyRule(p,RAIL_T.rule);p.color=ND_TIER_COL.silver;
  const e=chnEnds(p);lyrHud('Ezüst sín: '+railName(p)+(e[0]&&e[1]?'':' · figyelem: nyitott vég (nincs RBX-en / portálon)'));});
function railRoutes(){return data.paths.filter(p=>p&&p.route==='rail');}
function railName(p){const e=chnEnds(p);return e.map(d=>d?(d.ref||d.id):'?').join(' ≈ ');}
function railToolStart(){const S=(typeof stkActive==='function')?stkActive():null,L=S?stkLayer(S.id,'channel'):null;
  if(L){state.activeLayer=L.id;renderLayers();}
  if(typeof mrkToolsOff==='function')mrkToolsOff();if(typeof hwToolOff==='function')hwToolOff();ptToolOff();
  state.pathType=RAIL_T.rule==='csat'?'csat':'gege';setMode('path');RAIL_T.on=true;
  const mh=$('modeHint');if(mh)mh.textContent='Ezüst sín: RBX → portálok a magas sávban (≈ 2450) · kattints a dobozokra · R: süllyesztett ↔ kábelcsatorna · dupla katt: kész';
  lyrHud('Ezüst sín — '+(RAIL_T.rule==='csat'?'kábelcsatorna':'süllyesztett'));}
STK_TOOLS.push({k:'railRoute',active:()=>{if(!RAIL_T.on)return false;if(state.mode!=='path'){RAIL_T.on=false;return false;}return true;},
  key(e){if(!((e.key==='r'||e.key==='R')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey))return false;e.preventDefault();RAIL_T.rule=RAIL_T.rule==='csat'?'sull':'csat';
    state.pathType=RAIL_T.rule==='csat'?'csat':'gege';if(typeof pathDraft!=='undefined'&&pathDraft)pathDraft.ptype=state.pathType;lyrHud(RAIL_T.rule==='csat'?'Kábelcsatorna':'Süllyesztett');return true;},
  mode(){RAIL_T.on=false;},esc(){RAIL_T.on=false;}});
function railLabelsSvg(){const S=(typeof stkActive==='function')?stkActive():null,L=S?lyrLayer(state.activeLayer):null;
  if(!state.chnLabels&&!(L&&L.stack===S.id&&L.role==='channel'))return '';let s='';
  railRoutes().forEach(p=>{const ns=p.nodes||[];if(ns.length<2||!state.levels[ns[0].level]||!layerShows(p,'path'))return;
    let bi=1,bl=-1;for(let i=1;i<ns.length;i++){const l=Math.hypot(ns[i].x-ns[i-1].x,ns[i].y-ns[i-1].y);if(l>bl){bl=l;bi=i;}}
    const a=ns[bi-1],b=ns[bi];s+=mrkText((a.x+b.x)/2,(a.y+b.y)/2,dz(a.level,((a.h||0)+(b.h||0))/2),'ezüst sín · '+railName(p),'#5f6b75',9);});
  return s?`<g pointer-events="none">${s}</g>`:'';}
STK_OVERLAY.push(railLabelsSvg);
STK_PATHMENU.push((ps,items)=>{const p=data.paths[ps.pi];if(!p)return;
  if(p.route==='rail'){items.unshift({label:'≈ Ezüst sín: '+railName(p),act:()=>{}});
    items.push({label:'≈ Átsorolás: csatorna (arany)',act:()=>{pushUndo(['paths']);p.route='channel';delete p.color;draw();}});}
  else if(p.route==='channel')items.push({label:'≈ Átsorolás: ezüst sín',act:()=>{pushUndo(['paths']);p.route='rail';p.color=ND_TIER_COL.silver;draw();}});});

// ---- right-click on a portal ------------------------------------------------------------------------------------------------
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d)return;const t=ndTier(d);
  if(t&&ND_TIER[d.type])items.push({label:'◆ Csomópont-szint: '+ND_TIER_N[t],act:()=>{}});
  if(d.type!=='portal')return;
  const o=byId('openings',d.door);items.push({label:'⌂ Ajtó: '+(o?(o.ref||o.id):'— törölve —')+' · '+(d.at==='latch'?'kilincs':'zsanér')+' oldal',act:()=>{}});
  Object.keys(PT_CLS).forEach(k=>{if(k!==d.cls)items.push({label:'⌂ Osztály: '+k+' — '+PT_CLS[k],act:()=>{pushUndo(['devices']);d.cls=k;draw();}});});
  Object.keys(PT_TIERS).forEach(k=>{if(k!==d.tier)items.push({label:'⌂ Szint: '+k+' — '+PT_TIERS[k],act:()=>{pushUndo(['devices']);d.tier=k;draw();}});});
  if(o){items.push({label:'⌂ Igazítás az ajtóhoz',act:()=>ptReseat(d)});
    items.push({label:'⌂ Áthelyezés a '+(d.at==='latch'?'zsanér':'kilincs')+' oldalra',act:()=>ptReseat(d,d.at==='latch'?'hinge':'latch')});}});

// ---- checks ---------------------------------------------------------------------------------------------------------------------------
(STK_CHECKS.hw=STK_CHECKS.hw||[]).push(S=>{const out=[];
  ptList().forEach(d=>{const o=byId('openings',d.door);
    if(d.door&&!o)out.push({sev:'warn',msg:(d.ref||d.id)+': az ajtója törölve.'});
    else if(o&&Math.hypot(o.x-d.x,o.y-d.y)>2500)out.push({sev:'info',msg:(d.ref||d.id)+': messze került az ajtajától — Igazítás az ajtóhoz.'});});
  return out;});
(STK_CHECKS.channel=STK_CHECKS.channel||[]).push(S=>{const out=[];
  railRoutes().forEach(p=>{const e=chnEnds(p);if(!e[0]||!e[1])out.push({sev:'warn',msg:'Nyitott végű ezüst sín: '+railName(p)});});
  ptList().forEach(d=>{if(!railRoutes().some(p=>chnEnds(p).indexOf(d)>=0))out.push({sev:'info',msg:(d.ref||d.id)+': még nincs ezüst sínen.'});});
  return out;});

registerActions([
 {id:'pt.place',alias:'portal smartframe ajto elhelyezes place door frame',label:'Portál elhelyezése (ajtóhoz)',icon:'⌂',group:'Hardver',
  hint:'IDEA-003: a fészek a zsanér felőli felső sarokba kerül a kiszolgált helyiség oldalán; ha a zsanér mögött < 300 mm fal van, a kilincs oldalra (H0-3). Magasság: a sín vonala.',
  run:()=>ptToolStart()},
 {id:'pt.auto',alias:'portalok automatikus minden ajto auto place portals',label:'Portálok a jelölt ajtókhoz (minden oldal)',icon:'⌂',group:'Hardver',
  hint:'Minden portál / bejárat / P1–P3 jelölésű ajtó minden helyiség felőli oldalára egy portál (egy visszavonási lépés).',run:()=>ptAuto()},
 {id:'rail.route',alias:'ezust sin silver rail rbx portal path',label:'Ezüst sín (RBX ↔ portálok)',icon:'≈',group:'Csatorna',
  hint:'A Pálya eszköz egy változata: egy helyiség RBX-e és portáljai közti sín a magas sávban; fölötte futhat az arany csatorna.',run:()=>railToolStart()}
]);

// test hooks
window.PT_CLS=PT_CLS;window.PT_TIERS=PT_TIERS;window.ND_TIER=ND_TIER;window.PT_T=PT_T;window.RAIL_T=RAIL_T;
window.ndTier=ndTier;window.ptRailH=ptRailH;window.ptDoorGeo=ptDoorGeo;window.ptSlotPt=ptSlotPt;window.ptOf=ptOf;window.ptList=ptList;
window.ptCandidates=ptCandidates;window.ptMake=ptMake;window.ptPlace=ptPlace;window.ptReseat=ptReseat;window.ptAuto=ptAuto;window.ptGhost=ptGhost;
window.ptToolStart=ptToolStart;window.ptToolOff=ptToolOff;window.ptSymbol=ptSymbol;window.railRoutes=railRoutes;window.railName=railName;window.railToolStart=railToolStart;
