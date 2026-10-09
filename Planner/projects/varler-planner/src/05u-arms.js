// ==========================================================================
// 05u-arms.js — drawing on the stack as one layer: ARM routes (WP-E1)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// An ARM is a one-line route from a RoomBox towards endpoints (STD-004 `R03.A2` — layers are an attribute, never
// part of the name). One ARM carries any number of layers; "the same route, separate conduits" is worked out by
// the fill (E3) — here only geometry and joins are drawn. ARM routes are ordinary paths (route:'arm') on the stack's
// ARM layer, drawn with the Path tool while ARM_T is on; a route that starts or ends ON another route branches
// from it through an explicit join n.j = {p, n} (never by coincidence). Prefix: arm.

let ARM_T={on:false,rule:'sull'};
const ARM_SNAP=150;                       // mm in plan: an end this close to another route branches from it

// ---- the stack view [Q40=A]: every layer of the active stack drawn as one, the rest faded to 30 % ----------------
function armFade(item){const S=(typeof stkActive==='function')?stkActive():null;if(!S)return 1;
  const L=lyrLayer((item&&item.layer)||'L0');return L&&L.stack===S.id?1:0.3;}

// ---- the tool --------------------------------------------------------------------------------------------------------
function armToolStart(){const S=(typeof stkActive==='function')?stkActive():null,L=S?stkLayer(S.id,'arm'):null;
  if(!L){lyrHud('Aktív BRIDGE Stack ARM réteggel kell hozzá.');return;}
  if(typeof mrkToolsOff==='function')mrkToolsOff();if(typeof hwToolOff==='function')hwToolOff();if(typeof epToolOff==='function')epToolOff();
  state.activeLayer=L.id;state.stkView=true;renderLayers();
  state.pathType=ARM_T.rule==='csat'?'csat':'gege';setMode('path');ARM_T.on=true;
  const mh=$('modeHint');if(mh)mh.textContent='ARM pálya: az RBX-től a végpontokig, bármely réteg végpontjára illeszthető · ágaztatás: kezdd egy meglévő pályán · Tab: süllyesztett ↔ kábelcsatorna · dupla katt: kész';
  lyrHud('ARM pálya — stack nézet bekapcsolva');}
STK_TOOLS.push({k:'armRoute',active:()=>{if(!ARM_T.on)return false;if(state.mode!=='path'){ARM_T.on=false;return false;}return true;},
  key(e){if(e.key!=='Tab')return false;e.preventDefault();ARM_T.rule=ARM_T.rule==='csat'?'sull':'csat';state.pathType=ARM_T.rule==='csat'?'csat':'gege';
    if(typeof pathDraft!=='undefined'&&pathDraft)pathDraft.ptype=state.pathType;lyrHud(ARM_T.rule==='csat'?'Kábelcsatorna':'Süllyesztett');return true;},
  mode(){ARM_T.on=false;},esc(){ARM_T.on=false;}});
CHN_PATH_HOOKS.push(p=>{if(!ARM_T.on||!p)return;p.route='arm';chnApplyRule(p,ARM_T.rule);p.color='#5a5a5a';
  const j=armJoinEnds(p);lyrHud('ARM '+armRef(p)+(j?' — ágaztatva '+j+' végen':'')+(armEndOpen(p).length?' · figyelem: kötetlen vég':''));});

// ---- branching: explicit joins ----------------------------------------------------------------------------------------
function armIsRoute(p){return !!p&&(p.route==='arm'||p.route==='channel');}
function armNodeLinked(p,n){return data.devices.some(d=>hasLinkTo(d,p.id,n.id));}
// insert a node into section si of path q at plan point (x,y); the height is interpolated, both halves keep the
// section's build. Ids of every other node stay, so links and joins stay valid.
function armSplitAt(q,si,x,y){const a=q.nodes[si],b=q.nodes[si+1];if(!a||!b)return null;
  const L=Math.hypot(b.x-a.x,b.y-a.y)||1,t=Math.max(0,Math.min(1,((x-a.x)*(b.x-a.x)+(y-a.y)*(b.y-a.y))/(L*L)));
  const n={level:a.level,x:Math.round(a.x+(b.x-a.x)*t),y:Math.round(a.y+(b.y-a.y)*t),h:Math.round((a.h||0)+((b.h||0)-(a.h||0))*t)};
  const sec=q.sections[si]?JSON.parse(JSON.stringify(q.sections[si])):{build:'sull_gege',circuit:null};
  q.nodes.splice(si+1,0,n);q.sections.splice(si+1,0,sec);ensureIds(data);return n;}
// the nearest other route node (or route segment) to a plan point, within ARM_SNAP
function armNearest(p,level,x,y){let best=null,bd=ARM_SNAP;
  data.paths.forEach(q=>{if(q===p||!armIsRoute(q))return;(q.nodes||[]).forEach((n,i)=>{if(n.level!==level)return;const d=Math.hypot(n.x-x,n.y-y);if(d<bd){bd=d;best={q,n,ni:i};}});});
  if(best)return best;
  data.paths.forEach(q=>{if(q===p||!armIsRoute(q))return;const ns=q.nodes||[];
    for(let i=0;i<ns.length-1;i++){const a=ns[i],b=ns[i+1];if(a.level!==level||b.level!==level)continue;
      const r=nearestOnSegPlain(x,y,a.x,a.y,b.x,b.y);if(r.d<bd&&r.t>0.02&&r.t<0.98){bd=r.d;best={q,si:i};}}});
  return best;}
// both ends: not on a device → branch from the route there (snap onto its node, or split its segment first)
function armJoinEnds(p){const ns=p.nodes||[];if(ns.length<2)return 0;let k=0;
  [0,ns.length-1].forEach(i=>{const n=ns[i];if(!n||n.j||armNodeLinked(p,n))return;const hit=armNearest(p,n.level,n.x,n.y);if(!hit)return;
    let tn=hit.n;if(!tn)tn=armSplitAt(hit.q,hit.si,n.x,n.y);if(!tn)return;
    n.x=tn.x;n.y=tn.y;n.j={p:hit.q.id,n:tn.id};k++;});      // the height stays its own: the drop counts as length in E2
  return k;}
// ends that are neither on a device nor joined
function armEndOpen(p){const ns=p.nodes||[],out=[];[0,ns.length-1].forEach(i=>{const n=ns[i];if(n&&!n.j&&!armNodeLinked(p,n)&&!data.devices.some(d=>hasLinkTo(d,p.id,n.id)))out.push(n);});return out;}
// a join whose target path or node is gone → removed (called from validation, not on every draw)
function armPruneJoins(){let n=0;data.paths.forEach(p=>(p.nodes||[]).forEach(nd=>{if(nd.j&&!nodeById(nd.j.p,nd.j.n)){delete nd.j;n++;}}));return n;}

// ---- derived --------------------------------------------------------------------------------------------------------------
function armRoutes(roomId){return data.paths.filter(p=>p&&p.route==='arm'&&(!roomId||armRoomOf(p)===roomId));}
// the room holding most of the route's nodes (ties: the first node's room)
function armRoomOf(p){const cnt={};let first=null;(p.nodes||[]).forEach(n=>{const e=mrkRoomAtPt(n.level,n.x,n.y),id=e&&stkRoomId(e);if(!id)return;if(!first)first=id;cnt[id]=(cnt[id]||0)+1;});
  let best=first,bn=first?cnt[first]:0;Object.keys(cnt).forEach(k=>{if(cnt[k]>bn){bn=cnt[k];best=k;}});return best;}
function armRef(p){const r=armRoomOf(p),same=data.paths.filter(q=>q&&q.route==='arm'&&armRoomOf(q)===r);return 'A'+(same.indexOf(p)+1);}
// a segment that lies ALONG a wall carrying a `ban` mark (both nodes inside the wall rect + 20 mm, parallel to it)
// → chasing forbidden; one that crosses such a wall → a penetration (info)
function armBanWall(r){return typeof mrkList==='function'&&mrkList().some(m=>m.kind==='wall'&&m.wall===r.id&&m.pol==='ban');}
function armBanSegs(p){const out=[];const ns=p.nodes||[];
  for(let i=0;i<ns.length-1;i++){const a=ns[i],b=ns[i+1];if(a.level!==b.level)continue;
    (WALLS[a.level]||[]).forEach(r=>{if(!armBanWall(r))return;const wi=wallInfo(r),par=wi.horiz?Math.abs(a.y-b.y)<1:Math.abs(a.x-b.x)<1;
      const inA=rfInRect(a.x,a.y,r,20),inB=rfInRect(b.x,b.y,r,20);
      if(inA&&inB&&par)out.push({si:i,wall:r.id,kind:'along'});
      else if(rfSegRect(a.x,a.y,b.x,b.y,r)&&!(inA&&inB))out.push({si:i,wall:r.id,kind:'cross'});});}
  return out;}
// the stack devices that no arm / channel route node reaches
function armUnreached(S){const sys=layers.filter(l=>l.stack===S.id&&l.role&&l.role.indexOf('sys:')===0).map(l=>l.id);
  return data.devices.filter(d=>sys.indexOf(d.layer)>=0&&!devLinks(d).some(l=>{const q=pathById(l.p);return armIsRoute(q);}));}

// ---- overlay: refs, open ends, unreached endpoints -------------------------------------------------------------------------
function armOverlaySvg(){const S=(typeof stkActive==='function')?stkActive():null;if(!S)return '';
  const L=lyrLayer(state.activeLayer);if(!(L&&L.stack===S.id&&L.role==='arm')&&!ARM_T.on)return '';let s='';
  armRoutes().forEach(p=>{const ns=p.nodes||[];if(ns.length<2||!state.levels[ns[0].level])return;const a=ns[0],b=ns[1];
    s+=mrkText((a.x+b.x)/2,(a.y+b.y)/2,dz(a.level,((a.h||0)+(b.h||0))/2),armRef(p),'#5a5a5a',9);
    armEndOpen(p).forEach(n=>{const c=planToBase(n.x,n.y,dz(n.level,n.h||0));s+=`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${vsP(6)}" fill="none" stroke="#c8372d" stroke-width="${vsP(2)}"/>`;});});
  armUnreached(S).forEach(d=>{if(!state.levels[d.level])return;const c=planToBase(d.x,d.y,dz(d.level,d.h||0));
    s+=`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${vsP(11)}" fill="none" stroke="#d08a1e" stroke-width="${vsP(2)}" stroke-dasharray="${vsDash('3 2')}"/>`;});
  return s?`<g pointer-events="none">${s}</g>`:'';}
STK_OVERLAY.push(armOverlaySvg);

// ---- checks and validation -------------------------------------------------------------------------------------------------------
(STK_CHECKS.arm=STK_CHECKS.arm||[]).push(S=>{const out=[];
  armUnreached(S).forEach(d=>out.push({sev:'warn',msg:(d.ref||d.id)+': nincs ARM / csatorna pályához kötve'}));
  armRoutes().forEach(p=>{const ref=armRef(p);
    if(armEndOpen(p).length)out.push({sev:'warn',msg:ref+' ('+(armRoomOf(p)||'?')+'): kötetlen vég — sem végponton, sem pályán'});
    if(p.rule!=='csat')armBanSegs(p).forEach(b=>out.push(b.kind==='along'?{sev:'warn',msg:'Tartófal: süllyesztett ARM itt tilos — '+ref+' ('+b.wall+')'}
                                                                 :{sev:'info',msg:'Falátvezetés tilos falon — '+ref+' ('+b.wall+')'}));});
  if(typeof hwList==='function')hwList('rbx').forEach(x=>{const rooms=hwServes(x);
    if(rooms.length&&!devLinks(x).some(l=>{const q=pathById(l.p);return q&&q.route==='arm';}))out.push({sev:'info',msg:(x.ref||x.id)+': még nem indul belőle ARM pálya'});});
  return out;});
VALIDATORS.push({code:'arm.join',run:()=>{const n=armPruneJoins();return n?[{sev:'info',code:'arm.join',msg:n+' elárvult pálya-ágaztatás törölve (a célpálya már nincs meg).'}]:[];}});

registerActions([
 {id:'arm.route',alias:'arm palya rajzolas route draw branch',label:'ARM pálya rajzolása',icon:'⑂',group:'ARM',
  hint:'Egyvonalas pálya az RBX-től a végpontokig, rétegtől függetlenül (stack nézet). Meglévő pályán kezdve ágaztat.',
  need:'Aktív BRIDGE Stack ARM réteggel kell hozzá.',when:c=>{const S=stkActive();return !!(S&&stkLayer(S.id,'arm'));},run:()=>armToolStart()},
 {id:'stack.view',alias:'stack nezet egy retegkent view as one layer',label:'Stack nézet (egy rétegként)',icon:'▤',group:'Stack',
  hint:'A stack minden rétege együtt, a többi réteg 30 %-ra halványítva.',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>{state.stkView=!state.stkView;draw();lyrHud('Stack nézet '+(state.stkView?'be':'ki'));}}
]);
(STK_GROUPS.arm=STK_GROUPS.arm||[]).indexOf('Stack')<0&&STK_GROUPS.arm.push('Stack');

// test hooks
window.ARM_T=ARM_T;window.armFade=armFade;window.armToolStart=armToolStart;window.armJoinEnds=armJoinEnds;window.armSplitAt=armSplitAt;
window.armEndOpen=armEndOpen;window.armPruneJoins=armPruneJoins;window.armRoutes=armRoutes;window.armRoomOf=armRoomOf;window.armRef=armRef;
window.armBanSegs=armBanSegs;window.armUnreached=armUnreached;window.armOverlaySvg=armOverlaySvg;
