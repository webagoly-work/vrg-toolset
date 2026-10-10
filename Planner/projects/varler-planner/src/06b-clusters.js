// ==========================================================================
// 06b-clusters.js — cluster boxes, ideal spots, the device list, the Extras layer, preloaded plans
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// CLUSTER BOXES (IDEA-001 / IDEA-002 §6): a hardware device of type 'cluster' on the stack's Klaszterpontok layer —
//   {type:'cluster', cls:'K1'|'K2'|'K3', zone:'low'|'mid'|'high', sec:bool, level, x, y, h, side}
// An endpoint housed in a box (or in a Portal / RBX / BASE) carries d.host = <node id>; membership is never stored on
// the box, so deleting either side is always safe. `sec` marks a SECONDARY box: opened automatically when a higher-
// layer endpoint is placed on a custom spot, so the next layer's device finds flush space already there.
// IDEAL SPOTS: per stack layer, the places the existing rules (05t needs + suggestions, IDEA-003 door geometry,
// the endpoint clusters) call ideal — drawn as dashed ghosts, never devices until the user right-clicks one.
// A layer's ✦ button (05l) hides them; they draw for the active layer, or for every layer with Ideális: mind.
// Prefix: cls (boxes), ideal (spots), xtr (extras), pre (preloaded plans).

const CLS_K={
 K1:{n:'K1 — kicsi, 2–3 hely',                size:[209,68,50],max:3},     // Kopos KPL 64-50/3LD class (IDEA-002 §6)
 K2:{n:'K2 — közepes, 4–6 hely, smart-up mély',size:[351,68,65],max:6},     // KPL 64-50/5LD, Chorus ONE 6–8
 K3:{n:'K3 — osztott 200 × 200 (erős + gyenge)',size:[200,200,65],max:12}};  // the keystone: Ladder H 200, divider
const CLS_ZONES={low:{n:'alsó (200–500)',h:300},mid:{n:'középső (800–1400)',h:1300},high:{n:'felső (1900–2500)',h:2150}};
const CLS_GAP=300;              // IDEA-001 §3: one box width plus a gap
const CLS_HOSTS=['cluster','portal','rbx','base'];
function clsZoneOf(h){return (h||0)<650?'low':(h||0)<1750?'mid':'high';}
function clsHigher(role){return !!role&&role.indexOf('sys:')===0&&role!=='sys:MAINS'&&role!=='sys:RF';}
function clsList(level){return data.devices.filter(d=>d&&d.type==='cluster'&&(!level||d.level===level));}
function clsMembers(node){return node?data.devices.filter(d=>d&&d.host===node.id):[];}

// ---- the stack layer a box lives on (created on demand in a stack that predates the role) ----
function stkEnsureRole(S,roleKey){if(!S)return null;let L=stkLayer(S.id,roleKey);if(L)return L;const role=stkRole(roleKey);if(!role)return null;
  L=stkMakeLayer(S,role);const mine=stkLayersOf(S.id),ix=stkRoleIx(roleKey),before=mine.filter(l=>stkRoleIx(l.role)<ix).pop();
  layers.splice(before?layers.indexOf(before)+1:layers.length,0,L);stkSync(S);if(typeof renderLayers==='function')renderLayers();return L;}
function clsLayerId(){const S=(typeof stkActive==='function')?stkActive():null,L=S?stkEnsureRole(S,'cluster'):null;return L?L.id:state.activeLayer;}

// ---- making boxes ----
// at a wall face point: {r, side:±1, u}; opt {cls, zone, h, sec, noUndo}
function clsMake(level,r,side,u,opt){opt=opt||{};const wi=wallInfo(r),p=mrkFacePt(r,side,u,-wi.thick/2),zone=opt.zone||clsZoneOf(opt.h);
  return {type:'cluster',cls:opt.cls||'K2',zone,sec:!!opt.sec,level,x:Math.round(p[0]),y:Math.round(p[1]),h:Math.round(opt.h||CLS_ZONES[zone].h),side:side>0?1:0,layer:opt.layer||clsLayerId()};}
function clsPlace(level,r,side,u,opt){opt=opt||{};if(!opt.noUndo)pushUndo(['devices']);
  const d=clsMake(level,r,side,u,opt);data.devices.push(d);ensureIds(data);d.ref=hwRef(d);
  if(!opt.quiet){draw();lyrHud('Klaszterdoboz: '+d.ref+' · '+CLS_K[d.cls].n+' · '+CLS_ZONES[d.zone].n+(d.sec?' · másodlagos':''));}
  return d;}
// the box a single higher-layer endpoint opens on its custom spot
function clsCreateFor(d){const h=(typeof deviceHostWall==='function')?deviceHostWall(d):null;if(!h)return null;
  return clsPlace(d.level,h.r,d.side?1:-1,mrkU(h.r,d.x,d.y),{cls:'K1',h:d.h,sec:true,noUndo:true,quiet:true});}
// a node near enough to house an endpoint: a box within 200 mm and its zone; a Portal / RBX / BASE column within 250 mm
function clsNearNode(d){let best=null,bd=1e9;
  data.devices.forEach(n=>{if(!n||n===d||n.level!==d.level||CLS_HOSTS.indexOf(n.type)<0)return;const pd=Math.hypot(n.x-d.x,n.y-d.y);
    const ok=n.type==='cluster'?(pd<200&&Math.abs((n.h||0)-(d.h||0))<250):pd<250;if(ok&&pd<bd){bd=pd;best=n;}});
  return best;}
EP_PLACED.push((d,g)=>{if(g&&g.host){if(byId('devices',g.host))d.host=g.host;return;}
  const role=epRoleOf(d);if(state.clsAuto===false||!clsHigher(role))return;
  const near=clsNearNode(d);if(near){d.host=near.id;return;}
  if((g&&g.snapped)||d.side==null)return;          // an ideal spot is not a custom place; ceiling / floor points get no box
  const c=clsCreateFor(d);if(c){d.host=c.id;lyrHud(d.code+' egyéni helyen — másodlagos klaszterdoboz nyitva: '+c.ref);}});

// ---- clustering the endpoints that are already there (IDEA-001 §3) ----
// same wall face, same zone, along-wall gap ≤ CLS_GAP → one box; class from the count and the MAINS / SELV mix
function clsGroups(level){const by={};
  data.devices.forEach(d=>{if(!d||d.level!==level||!epCodeOf(d)||d.side==null||(d.host&&byId('devices',d.host)))return;
    const h=deviceHostWall(d);if(!h)return;const side=d.side?1:-1,z=clsZoneOf(d.h);
    (by[h.r.id+'|'+side+'|'+z]=by[h.r.id+'|'+side+'|'+z]||[]).push({d,u:mrkU(h.r,d.x,d.y),r:h.r,side,z});});
  const out=[];
  Object.keys(by).forEach(k=>{const a=by[k].sort((p,q)=>p.u-q.u);let cur=[a[0]];
    for(let i=1;i<=a.length;i++){if(i<a.length&&a[i].u-cur[cur.length-1].u<=CLS_GAP){cur.push(a[i]);continue;}
      if(cur.length>=2)out.push(clsFromGroup(level,cur));if(i<a.length)cur=[a[i]];}});
  return out;}
function clsFromGroup(level,cur){const r=cur[0].r,side=cur[0].side,u=Math.round(cur.reduce((s,x)=>s+x.u,0)/cur.length),h=Math.round(cur.reduce((s,x)=>s+(x.d.h||0),0)/cur.length/50)*50;
  const roles=[...new Set(cur.map(x=>epRoleOf(x.d)))],mains=roles.indexOf('sys:MAINS')>=0,other=roles.some(x=>x!=='sys:MAINS');
  const cls=(mains&&other)?'K3':cur.length<=3?'K1':cur.length<=6?'K2':'K3',wi=wallInfo(r),p=mrkFacePt(r,side,u,-wi.thick/2);
  return {kind:'cluster',level,r,wall:r.id,side,u,h,zone:cur[0].z,cls,members:cur.map(x=>x.d.id),x:Math.round(p[0]),y:Math.round(p[1]),mount:'wall',
    why:cur.length+' végpont · '+cur.map(x=>epCodeOf(x.d)).join(' ')+(mains&&other?' · erős + gyenge → K3':'')};}
function clsFromSuggestion(sp,opt){opt=opt||{};const d=clsPlace(sp.level,sp.r,sp.side,sp.u,{cls:sp.cls,zone:sp.zone,h:sp.h,noUndo:opt.noUndo,quiet:opt.quiet});
  (sp.members||[]).forEach(id=>{const m=byId('devices',id);if(m)m.host=d.id;});return d;}
function clsAutoAll(level){level=level||state.active;const gs=clsGroups(level);if(!gs.length){lyrHud('Nincs csoportosítható végpont ezen a szinten (azonos falfelület, zóna, ≤ '+CLS_GAP+' mm).');return 0;}
  pushUndo(['devices']);gs.forEach(sp=>clsFromSuggestion(sp,{noUndo:true,quiet:true}));draw();
  lyrHud(gs.length+' klaszterdoboz · '+gs.reduce((s,g)=>s+g.members.length,0)+' végpont házban.');return gs.length;}

// ---- corner cluster points: the corners the room's L leaves out (IDEA-003 §7) ----
function clsLFaces(e){if(typeof mrkList!=='function'||typeof sugFaces!=='function')return [];
  const ms=mrkList().filter(m=>m.kind==='side'&&m.level===e.level&&(m.tags||[]).indexOf('lforma')>=0);
  return sugFaces(e).filter(f=>ms.some(m=>m.wall===f.r.id&&m.side===f.side));}
function clsCornerSpots(level){const out=[];
  stkRooms(level).forEach(rm=>{const e=mrkRoomById(rm.id);if(!e)return;const LF=clsLFaces(e);if(!LF.length)return;
    const P=e.rm.poly,n=P.length;let A=0;for(let i=0,j=n-1;i<n;j=i++)A+=P[j][0]*P[i][1]-P[i][0]*P[j][1];
    const ends=LF.map(f=>[mrkFacePt(f.r,f.side,f.u0,0),mrkFacePt(f.r,f.side,f.u1,0)]);
    const lc=ends.reduce((s,x)=>[s[0]+x[0][0]+x[1][0],s[1]+x[0][1]+x[1][1]],[0,0]).map(v=>v/(ends.length*2));
    const cand=[];
    P.forEach((v,i)=>{const a=P[(i+n-1)%n],b=P[(i+1)%n],cr=(v[0]-a[0])*(b[1]-v[1])-(v[1]-a[1])*(b[0]-v[0]);
      if(Math.sign(cr)!==Math.sign(A))return;                                        // a reflex corner holds no cluster
      const onL=ends.filter(x=>Math.hypot(x[0][0]-v[0],x[0][1]-v[1])<400||Math.hypot(x[1][0]-v[0],x[1][1]-v[1])<400).length;
      // on the longer of the two walls, 200 mm from the corner — unless an opening is within 300 mm there (R06's SE
      // corner would otherwise sit over B171's head); then the other wall; neither → no spot
      const eA=Math.hypot(a[0]-v[0],a[1]-v[1]),eB=Math.hypot(b[0]-v[0],b[1]-v[1]);let r=null,u=0;
      for(const o of (eA>=eB?[a,b]:[b,a])){const mid=[(v[0]+o[0])/2,(v[1]+o[1])/2],rr=sugHostWall(level,mid[0],mid[1]);if(!rr)continue;
        const uv=mrkU(rr,v[0],v[1]),uu=Math.round(uv+Math.sign(mrkU(rr,mid[0],mid[1])-uv)*200);
        if((data.openings||[]).some(op=>op&&op.level===level&&op.type!=='stairs'&&sugHostWall(level,op.x,op.y)===rr&&Math.abs(mrkU(rr,op.x,op.y)-uu)<(op.w||900)/2+300))continue;
        r=rr;u=uu;break;}
      if(!r)return;const wi=wallInfo(r);
      const side=pointInPoly(...mrkFacePt(r,1,u,50),P)?1:-1,p=mrkFacePt(r,side,u,-wi.thick/2);
      cand.push({kind:'cluster',level,r,wall:r.id,side,u,h:CLS_ZONES.high.h,zone:'high',cls:'K2',x:Math.round(p[0]),y:Math.round(p[1]),mount:'wall',
        inner:onL>=2,dist:Math.hypot(v[0]-lc[0],v[1]-lc[1]),room:rm.id,
        why:onL>=2?'Az L belső sarka (RBX mellett)':'Sarok-klaszter (ZS-e) — az L-en kívüli sarok'});});
    // the three outer corners farthest from the L, plus the inner corner (Q-SF-01: both variants)
    cand.filter(c=>!c.inner).sort((p,q)=>q.dist-p.dist).slice(0,3).concat(cand.filter(c=>c.inner)).forEach(c=>out.push(c));});
  return out.filter(c=>!data.devices.some(d=>d&&d.level===level&&CLS_HOSTS.indexOf(d.type)>=0&&Math.hypot(d.x-c.x,d.y-c.y)<600));}   // a Portal / box near it absorbs it
function clsSpots(level){return clsGroups(level).concat(clsCornerSpots(level));}

// ---- the cluster tool ----
let CL_T={on:false,cls:'K2',zone:'mid',g:null};
function clsGhost(e){const h=CLS_ZONES[CL_T.zone].h,pk=hwPick(e,h);if(!pk)return null;
  return Object.assign(clsMake(pk.level,pk.r,pk.side,pk.u,{cls:CL_T.cls,zone:CL_T.zone,layer:'ghost'}),{pk});}
function clsToolStart(){if(typeof mrkToolsOff==='function')mrkToolsOff();if(typeof hwToolOff==='function')hwToolOff();if(typeof ptToolOff==='function')ptToolOff();
  if(state.mode!=='select')setMode('select');const L=clsLayerId();if(L&&lyrLayer(L)){state.activeLayer=L;renderLayers();}
  CL_T.on=true;CL_T.g=null;clsHint();}
function clsHint(){const mh=$('modeHint');if(!mh)return;mh.textContent=CL_T.on?('Klaszterdoboz: '+CLS_K[CL_T.cls].n+' · '+CLS_ZONES[CL_T.zone].n+' · ←/→: osztály · ↑/↓: zóna · Esc kilép'):(typeof HINTS!=='undefined'?HINTS[state.mode]||'':'');}
function clsToolOff(){CL_T.on=false;CL_T.g=null;clsHint();}
STK_TOOLS.push({k:'clsPlace',active:()=>{if(!CL_T.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){clsToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const g=clsGhost(e);if(!g)return true;clsPlace(g.pk.level,g.pk.r,g.pk.side,g.pk.u,{cls:CL_T.cls,zone:CL_T.zone});return true;},
  move(e){CL_T.g=clsGhost(e);draw();return false;},
  key(e){if(e.ctrlKey||e.altKey)return false;const ks=Object.keys(CLS_K),zs=Object.keys(CLS_ZONES);
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const i=ks.indexOf(CL_T.cls);CL_T.cls=ks[(i+(e.key==='ArrowRight'?1:-1)+ks.length)%ks.length];clsHint();draw();return true;}
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const i=zs.indexOf(CL_T.zone);CL_T.zone=zs[Math.max(0,Math.min(zs.length-1,i+(e.key==='ArrowUp'?1:-1)))];clsHint();draw();return true;}
    return false;},
  mode(){clsToolOff();},esc(){clsToolOff();draw();}});

// ---- symbols ----
function clsSymbol(d,x,y,k,back){if(!d||d.type!=='cluster')return null;
  const z=dz(d.level,d.h||0),F=hwFrame(d),c=planToBase(F.cx,F.cy,z),R=v=>+(v*k).toFixed(2),ink=back?'#9299a0':'#6b4a20',n=clsMembers(d).length;
  return `<polygon points="${p2b(hwFootprint(d,z))}" fill="${back?'#f4f1ea':(d.sec?'#fbf6ea':HW_DEF.cluster.col)}" stroke="${back?ink:ND_TIER_COL.bronze}" stroke-width="${R(1.8)}"${d.sec?' stroke-dasharray="'+vsDash('3 2')+'"':''}/>`
    +`<text x="${c[0].toFixed(1)}" y="${(c[1]+R(3)).toFixed(1)}" font-size="${R(8)}" text-anchor="middle" font-weight="700" fill="${ink}">${esc((d.cls||'K2')+(n?'·'+n:''))}</text>`;}
STK_DEVSYM.unshift(clsSymbol);
function clsWvBox(dv,x,y,sc,col,back){const d=data.devices[dv.di];if(!d||d.type!=='cluster')return null;const S=hwSize(d),w=S.w*sc,h=S.ht*sc;
  return `<rect x="${(x-w/2).toFixed(1)}" y="${(y-h/2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${back?'#f4f1ea':(d.sec?'#fbf6ea':HW_DEF.cluster.col)}" stroke="${ND_TIER_COL.bronze}" stroke-width="1.4"${d.sec||back?' stroke-dasharray="4 3"':''}/>`
    +`<text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" font-size="9" text-anchor="middle" font-weight="700" fill="${col}">${esc(d.cls||'K2')}</text>`;}
STK_WVBOX.unshift(clsWvBox);

// ==================================================================================================================
// ideal spots
// ==================================================================================================================
function idealCap(L){return !!(L&&L.stack&&L.role&&((L.role.indexOf('sys:')===0&&L.role!=='sys:RF')||L.role==='hw'||L.role==='cluster'));}
function idealShown(L){return idealCap(L)&&L.visible!==false&&L.ideal!==false&&(L.id===state.activeLayer||!!state.idealAll);}
function idealTaken(L,code,h){return data.devices.some(d=>d&&d.layer===L.id&&epCodeOf(d)===code&&d.level===h.level&&Math.hypot(d.x-h.x,d.y-h.y)<250&&Math.abs((d.h||0)-(h.h||0))<400);}
// [{key, kind:'ep'|'portal'|'cluster', role, layer, code?, x, y, h, level, mount, side?, wall?, why, …}]
function idealSpots(L,level){if(!idealCap(L))return [];const role=L.role,seen={},out=[];
  const add=s=>{if(seen[s.key])return;seen[s.key]=1;s.layer=L.id;s.role=role;out.push(s);};
  if(role==='hw'){(typeof ptCandidates==='function'?ptCandidates(level):[]).forEach(G=>add({key:'pt:'+G.o.id+':'+G.wallSide,kind:'portal',code:'PT',
      x:G.x,y:G.y,h:G.h,level,mount:'wall',side:G.wallSide,wall:G.wall,why:'Portál · '+G.cls+' · '+(G.at==='hinge'?'zsanér':'kilincs')+' oldal',G}));return out;}
  if(role==='cluster'){clsSpots(level).forEach(c=>add(Object.assign(c,{key:'cl:'+c.wall+':'+c.side+':'+c.u+':'+c.h,code:c.cls})));return out;}
  stkRooms(level).forEach(rm=>{if(!rm.id)return;const need=needOf(rm.rm,role);
    Object.keys(need).filter(k=>need[k]&&epEntry(k,role)).forEach(code=>{
      sugFor(code,role,rm.id).forEach(h=>{if(h.kind!=='pt'||h.level!==level||idealTaken(L,code,h))return;
        add({key:role+':'+code+':'+Math.round(h.x)+':'+Math.round(h.y)+':'+Math.round(h.h||0),kind:'ep',code,x:h.x,y:h.y,h:h.h||0,level,
          mount:h.mount,side:h.side,wall:h.wall,why:h.why||'',room:rm.id});});});});
  return out;}
function idealVisible(){const out=[];if(state.idealOff)return out;
  layers.forEach(L=>{if(!idealShown(L))return;ORD.forEach(l=>{if(state.levels[l])idealSpots(L,l).forEach(s=>out.push(s));});});return out;}
function idealSvg(){const sp=idealVisible();let s='';const k=devK();
  sp.forEach(p=>{const b=planToBase(p.x,p.y,dz(p.level,p.h||0)),col=p.kind==='portal'?'#5f6b75':p.kind==='cluster'?ND_TIER_COL.bronze:(EP_ROLE_COL[p.role]||'#666'),R=v=>+(v*k).toFixed(2);
    const w=p.kind==='ep'?R(14):R(18),h=p.kind==='ep'?R(14):(p.kind==='portal'?R(18):R(11));
    s+=`<rect x="${(b[0]-w/2).toFixed(1)}" y="${(b[1]-h/2).toFixed(1)}" width="${w}" height="${h}" rx="${R(3)}" fill="#ffffff" fill-opacity="0.55" stroke="${col}" stroke-width="${R(1.3)}" stroke-dasharray="${vsDash('3 2')}" opacity="0.85"/>`
      +`<text x="${b[0].toFixed(1)}" y="${(b[1]+R(2.4)).toFixed(1)}" font-size="${R(6)}" text-anchor="middle" font-weight="700" fill="${col}" opacity="0.85">${esc(p.code||'✦')}</text>`
      +`<text x="${(b[0]+w/2+R(1)).toFixed(1)}" y="${(b[1]-h/2+R(1)).toFixed(1)}" font-size="${R(6)}" fill="${col}">✦</text>`;});
  return s?`<g class="ideal" pointer-events="none">${s}</g>`:'';}
STK_OVERLAY.push(idealSvg);
function idealHit(e){const [bx,by]=clientToBase(e),R=14/state.zoom;let best=null,bd=R;
  idealVisible().forEach(p=>{const b=planToBase(p.x,p.y,dz(p.level,p.h||0)),d=Math.hypot(bx-b[0],by-b[1]);if(d<bd){bd=d;best=p;}});return best;}
// the ghost an ideal endpoint spot turns into (05s epPlace)
function idealG(sp){const g={level:sp.level,x:sp.x,y:sp.y,h:sp.h,mount:sp.mount||'wall',snapped:true,why:sp.why};
  if(sp.side!=null){g.side=sp.side>0?1:0;g.wallSide=sp.side;g.wall=sp.wall;}return g;}
function idealPlace(sp,vk){if(!sp)return null;
  if(sp.kind==='portal')return ptPlace(sp.G);
  if(sp.kind==='cluster')return clsFromSuggestion(sp);
  return epPlace(idealG(sp),sp.code,sp.role,vk);}
function idealItems(sp){const items=[];
  if(sp.kind==='portal')items.push({label:'✦ Portál ide — '+sp.why,act:()=>idealPlace(sp)});
  else if(sp.kind==='cluster')items.push({label:'✦ Klaszterdoboz ide — '+sp.cls+' · '+sp.why,act:()=>idealPlace(sp)});
  else{const en=epEntry(sp.code,sp.role);if(en)en.vars.forEach(v=>items.push({label:'✦ '+sp.code+' — '+en.n+' · '+v.n+(sp.why?' ('+sp.why+')':''),act:()=>idealPlace(sp,v.k)}));
    items.push({label:'▦ Eszközlista ide…',act:()=>clsDeviceList(sp.role,{kind:'spot',sp})});}
  items.push({label:'✧ Ideális helyek elrejtése ezen a rétegen',act:()=>{const L=lyrLayer(sp.layer);if(L){L.ideal=false;renderLayers();draw();}}});
  return items;}

// ---- the stage right-click: an ideal spot, or a custom point on a higher layer ----
let IDEAL_SKIP=false;
STK_CTX.push(e=>{if(IDEAL_SKIP){IDEAL_SKIP=false;return null;}
  if(typeof devHitIdx==='function'&&devHitIdx(e)!=null)return null;        // a device keeps its own menu (nodes add theirs below)
  const sp=idealHit(e);if(sp)return idealItems(sp);
  const L=lyrLayer(state.activeLayer);if(!L||!L.stack||!clsHigher(L.role))return null;
  const t=clsPointAt(e);if(!t)return null;
  return [{label:'＋ Eszköz ide — '+((stkRole(L.role)||{}).n||L.role)+'…',act:()=>clsDeviceList(L.role,t)},
    {label:'☰ Szokásos menü…',act:()=>{IDEAL_SKIP=true;openCtxAt(e);}}];});
// a custom point: the wall under the pointer (if any) and the plan point
function clsPointAt(e){const level=state.active,[bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(level,0)),pk=hwPick(e,1300);
  const re=(typeof mrkRoomAtPt==='function')?mrkRoomAtPt(level,p[0],p[1]):null;
  if(!pk&&!re)return null;return {kind:'point',level,x:p[0],y:p[1],pk};}

// ---- the device list: every code of a layer, one click places it ----
const CLS_SLOTS=[0,90,-90,180,-180,270,-270,360];
function clsTargetG(t,en){const level=t.level||(t.node&&t.node.level)||(t.sp&&t.sp.level)||state.active,mount=en.mount||'wall';
  if(t.kind==='spot'&&(t.sp.mount||'wall')===mount)return idealG(t.sp);
  let r=null,side=1,u=0,x=t.x,y=t.y,hostId=null,h0=en.h||1100;
  if(t.kind==='node'){const n=t.node,hh=hwHost(n);hostId=n.id;x=n.x;y=n.y;
    if(hh){r=hh.r;side=n.side?1:-1;u=mrkU(r,n.x,n.y);}
    if(n.type==='cluster')h0=n.h;}
  else if(t.kind==='spot'){x=t.sp.x;y=t.sp.y;}
  if(mount==='wall'){
    if(!r){const pk=(t.kind==='point'&&t.pk)?t.pk:hwPickPlan(level,x,y,900);if(!pk)return null;r=pk.r;side=pk.side;u=pk.u;}
    const taken=hostId?clsMembers({id:hostId}).filter(m=>Math.abs((m.h||0)-h0)<120).length:0,uu=Math.round(u+CLS_SLOTS[taken%CLS_SLOTS.length]);
    const p=mrkFacePt(r,side,uu,-wallInfo(r).thick/2);
    return {level,x:Math.round(p[0]),y:Math.round(p[1]),h:h0,side:side>0?1:0,wallSide:side,wall:r.id,u:uu,mount:'wall',host:hostId};}
  let px=x,py=y;if(r){const q=mrkFacePt(r,side,u,400);px=q[0];py=q[1];}         // 400 mm in front of the node
  return {level,x:Math.round(px),y:Math.round(py),h:mount==='floor'?0:epCeilH(level,px,py),mount,host:hostId};}
function clsDeviceList(role,t){const list=epOfRole(role);if(!list.length){lyrHud('Ennek a rétegnek nincs végpontja.');return;}
  const where=t.kind==='node'?('→ '+(t.node.ref||t.node.id)+' ('+(HW_TYPES[t.node.type]||t.node.type)+')'):t.kind==='spot'?'→ ideális hely':'→ egyéni hely'+(clsHigher(role)&&state.clsAuto!==false?' (másodlagos klaszterdoboz nyílik)':'');
  openModal('Eszköz ide — '+((stkRole(role)||{}).n||role)+' <span style="font-weight:400;color:#888;font-size:12px">'+esc(where)+'</span>',
    `<div style="max-height:440px;overflow:auto">`+list.map(en=>`<div class="mrow" style="align-items:flex-start;flex-wrap:wrap"><b style="color:${EP_ROLE_COL[role]||'#444'};width:44px">${en.code}</b>`
      +`<span style="width:200px">${esc(en.n)}${en.prov?' <span style="color:#999">(előkészített)</span>':''}${en.req?' <b title="ügyfél kérte">*</b>':''}</span><span>`
      +en.vars.map(v=>`<button class="cdl" data-c="${en.code}" data-v="${v.k}" style="display:block;margin:1px 0;text-align:left;font-size:11.5px">${esc(v.n)}</button>`).join('')+`</span></div>`).join('')+`</div>`
    +`<div class="mrow" style="font-size:11px;color:#888">Egy kattintás elhelyez. Egy csomópontba (portál, RBX, klaszterdoboz, BASE) helyezett végpont annak a tagja lesz.</div>`,
    ()=>{},'Bezár');
  document.querySelectorAll('.cdl').forEach(b=>b.onclick=()=>{const en=epEntry(b.dataset.c,role),g=clsTargetG(t,en);closeModal();
    if(!g){lyrHud('Nincs fal a közelben ehhez a fali végponthoz.');return;}epPlace(g,en.code,role,b.dataset.v);});}

// ---- preferred cluster space: Portals, RBXs, boxes and BASE glow on every system layer ----
STK_OVERLAY.push(()=>{const L=lyrLayer(state.activeLayer);if(!L||!L.stack||!L.role||L.role.indexOf('sys:')!==0||L.ideal===false||state.idealOff)return '';let s='';
  const col=EP_ROLE_COL[L.role]||'#666';
  data.devices.forEach(d=>{if(!d||CLS_HOSTS.indexOf(d.type)<0||!state.levels[d.level]||!layerShows(d,'device'))return;
    const b=planToBase(d.x,d.y,dz(d.level,d.h||0));s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(15)}" fill="${col}" fill-opacity="0.07" stroke="${col}" stroke-width="${vsP(1.4)}" stroke-dasharray="${vsDash('5 3')}"/>`;});
  // members of the selected node
  const sel=(typeof selected!=='undefined'&&selected&&selected.t==='devices')?data.devices[selected.i]:null;
  if(sel&&CLS_HOSTS.indexOf(sel.type)>=0){const a=planToBase(sel.x,sel.y,dz(sel.level,sel.h||0));
    clsMembers(sel).forEach(m=>{const b=planToBase(m.x,m.y,dz(m.level,m.h||0));s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${ND_TIER_COL.bronze}" stroke-width="${vsP(1)}" stroke-dasharray="${vsDash('3 2')}"/>`;});}
  return s?`<g pointer-events="none">${s}</g>`:'';});
// the box ghost while placing
STK_OVERLAY.push(()=>{if(!CL_T.on||!CL_T.g)return '';const g=CL_T.g,z=dz(g.level,g.h);
  return `<g pointer-events="none"><polygon points="${p2b(hwFootprint(g,z))}" fill="${ND_TIER_COL.bronze}" fill-opacity="0.25" stroke="${ND_TIER_COL.bronze}" stroke-width="${vsP(2)}"/></g>`;});

// ---- right-click on a node ----
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d)return;
  const L=lyrLayer(state.activeLayer);
  if(CLS_HOSTS.indexOf(d.type)>=0&&L&&L.stack&&L.role&&L.role.indexOf('sys:')===0&&L.role!=='sys:RF')
    items.unshift({label:'▦ Ide helyezés — '+((stkRole(L.role)||{}).n||L.role)+'…',act:()=>clsDeviceList(L.role,{kind:'node',node:d})});
  if(CLS_HOSTS.indexOf(d.type)>=0){const ms=clsMembers(d);if(ms.length)items.push({label:'▦ Tagok ('+ms.length+'): '+ms.map(m=>m.ref||m.code||m.id).join(', '),act:()=>{}});}
  if(d.host){const n=byId('devices',d.host);items.push({label:'▦ Ház: '+(n?(n.ref||n.id):'— törölve —')+' · kivétel a házból',act:()=>{pushUndo(['devices']);delete d.host;draw();}});}
  if(d.type!=='cluster')return;
  Object.keys(CLS_K).forEach(k=>{if(k!==d.cls)items.push({label:'▦ Osztály: '+CLS_K[k].n,act:()=>{pushUndo(['devices']);d.cls=k;draw();}});});
  if(d.sec)items.push({label:'▦ Másodlagos → elsődleges klaszter',act:()=>{pushUndo(['devices']);d.sec=false;draw();}});});

// ---- checks ----
(STK_CHECKS.cluster=STK_CHECKS.cluster||[]).push(S=>{const out=[];
  clsList().forEach(d=>{const ms=clsMembers(d),K=CLS_K[d.cls]||CLS_K.K2,roles=[...new Set(ms.map(m=>epRoleOf(m)))];
    if(!ms.length)out.push({sev:'info',msg:(d.ref||d.id)+': üres klaszterdoboz (tartalék hely).'});
    if(ms.length>K.max)out.push({sev:'warn',msg:(d.ref||d.id)+': '+ms.length+' tag > '+K.max+' — nagyobb osztály kell.'});
    if(d.cls!=='K3'&&roles.indexOf('sys:MAINS')>=0&&roles.some(r=>r!=='sys:MAINS'))out.push({sev:'warn',msg:(d.ref||d.id)+': erős- és gyengeáram egy rekeszben — K3 (osztott) kell (EN 50174-2).'});});
  const n=clsGroups(state.active).length;if(n)out.push({sev:'info',msg:n+' végpont-csoport még nincs dobozban — Klaszterek a végpontokból.'});
  return out;});

// ==================================================================================================================
// the Extras layer: P33-ADD-001 extras and the SmartFrame slots as provisioned endpoints
// ==================================================================================================================
// prov = provisioned (box + conduit, device later); req = client-requested (the user's *). Cables are what the box needs
// pulled now. Each code finds its ideal spot through the 05t suggestion machinery (anchors below).
const XTR_CAT=[
 {code:'XSP',n:'Portál fej + fejérzékelők (H1: ToF, mmWave)',mount:'wall',h:2400,anchor:'portalSlot',slot:'H1',cab:[{c:'H05_2x15',w:'M16',fam:'BUSB'},{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]},
 {code:'XTM',n:'Terminál-előkészítés (M3: CYD / panel / kaputelefon)',mount:'wall',h:1450,anchor:'portalSlot',slot:'M3',cab:[{c:'H05_2x15',w:'M16'},{c:'CAT6A_U',w:'M20',fam:'DATA'}]},
 {code:'XLB',n:'Lábfény betáp + alsó érzékelő (L0)',mount:'wall',h:250,anchor:'portalSlot',slot:'L0',cab:[{c:'H05_2x15',w:'M16'},{c:'LIYCY4x05',w:'M16',fam:'SENSOR'}]},
 {code:'XSE',n:'Érzékelő-csomópont (M4: klíma, mmWave)',mount:'wall',h:1600,anchor:'portalSlot',slot:'M4',cab:[{c:'LIYCY4x05',w:'M16',fam:'SENSOR'}]},
 {code:'XDP',n:'Alvó párhuzamos kapcsolódoboz (L2, akadálymentes 1000)',mount:'wall',h:1000,anchor:'portalSlot',slot:'L2',cab:[{c:'NYM3x15',w:'M20',fam:'MAINS'}]},
 {code:'XLT',n:'Ajtólap kábelátvezető + szögérzékelő (MJ)',mount:'wall',h:1000,anchor:'portalSlot',slot:'MJ',cab:[{c:'H05_2x15',w:'M16',fam:'BUSB'}]},
 {code:'XCC',n:'Szín / lux érzékelő a redőnyhöz (#1)',mount:'wall',h:1600,anchor:'windowSide',cab:[{c:'LIYCY4x05',w:'M16',fam:'SENSOR'}]},
 {code:'XTT',n:'Csempe mögötti érintőgomb ×3 a zuhanyban (#2)',req:true,mount:'wall',h:1050,anchor:'wetWall',count:3,cab:[{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]},
 {code:'XID',n:'IP kijelző a zuhanyban, szemmagasság (#3)',mount:'wall',h:1600,anchor:'wetWall',count:1,cab:[{c:'CAT6A_U',w:'M20',fam:'DATA'},{c:'H05_2x15',w:'M16'}]},
 {code:'XFH',n:'Padlófűtés zóna — padlószonda (#6)',mount:'floor',h:0,anchor:'roomFloor',cab:[{c:'LIYCY4x05',w:'M16',fam:'SENSOR'}]},
 {code:'XFN',n:'Elszívó / downdraft ventilátor (#7, #10)',mount:'ceiling',anchor:'roomCentre',cab:[{c:'NYM3x15',w:'M20',fam:'MAINS'}]},
 {code:'XPH',n:'Telefontartó töltő (#8)',mount:'wall',h:1200,anchor:'innerWall',cab:[{c:'H05_2x15',w:'M16'}]},
 {code:'XAQ',n:'Elszívó-automatika multiszenzor (#10)',mount:'wall',h:2000,anchor:'innerWall',cab:[{c:'LIYCY4x05',w:'M16',fam:'SENSOR'}]},
 {code:'XBT',n:'Elemes vezeték nélküli érzékelő helye (#9)',mount:'ceiling',h:2200,anchor:'farCorner',cab:[]}];
XTR_CAT.forEach(x=>EP_CAT.push({code:x.code,new:true,prov:true,req:!!x.req,role:'sys:EXTRA',n:x.n,cat:'device',mount:x.mount,h:x.h,topo:'star',from:'rbx',
  vars:[{k:'prep',n:'Előkészítve (doboz + védőcső, eszköz később)',cab:x.cab},{k:'full',n:'Beépítve',cab:x.cab}]}));
if(typeof EP_ROLE_COL!=='undefined'&&!EP_ROLE_COL['sys:EXTRA'])EP_ROLE_COL['sys:EXTRA']=STK_COL['sys:EXTRA'];
// the icon set (05z): every code has a mark — the extras borrow the mark of the device they prepare for
if(typeof ICO_BY_CODE!=='undefined'){Object.assign(ICO_BY_CODE,{XSP:'portal',XTM:'panel',XLB:'ledline',XSE:'sensor',XDP:'switch',XLT:'portal',XCC:'sensor',
  XTT:'switch',XID:'screen',XFH:'thermo',XFN:'dedicat',XPH:'uep',XAQ:'sensor',XBT:'sensor'});ICO_BY_TYPE.portal='portal';ICO_BY_TYPE.cluster='junction';}
XTR_CAT.forEach(x=>SUG_RULES.splice(SUG_RULES.length-1,0,{code:x.code,role:'sys:EXTRA',anchor:x.anchor,h:x.h,slot:x.slot,count:x.count,n:x.n}));   // before the '*' avoid rule
// the doors that count as portals: a portal-ish mark, or every door when the plan has no such marks at all
function xtrPortalDoors(rid){const all=needOpenings(rid,'door'),tagged=d=>{const t=mrkOpeningTags(d.id);return ['portal','bejarat','lepcso','p1','p2','p3'].some(k=>t.indexOf(k)>=0);};
  const any=(data.openings||[]).some(o=>o&&o.type==='door'&&tagged(o));return any?all.filter(tagged):all;}
SUG_ANCHORS.portalSlot=(R,e,rid)=>{const out=[];
  xtrPortalDoors(rid).forEach(o=>{const G=ptDoorGeo(o,rid);if(!G)return;
    const hingeCol=G.at==='hinge'?'hinge':'latch';
    const col={H1:'centre',M3:(G.swing||G.at==='latch')?'latch':'hinge',M4:hingeCol,L0:hingeCol,L2:'latch',MJ:'jamb'}[R.slot]||'hinge';
    const h=R.slot==='H1'?G.h-50:R.h,p=ptSlotPt(G,col,h);p.why=R.slot+' · '+(col==='centre'?'az ajtó fölött':col==='jamb'?'zsanér felőli káva':col==='hinge'?'zsanér oldal':'kilincs oldal')+(R.slot==='M3'&&G.swing?' (nyíló oldal → kilincs, H0-2)':'');
    out.push(p);});return out;};
SUG_ANCHORS.windowSide=(R,e,rid)=>{const out=[];needOpenings(rid,'window').forEach(o=>{const t=mrkOpeningTags(o.id);if(t.indexOf('redony')<0&&t.indexOf('arnyekolo')<0)return;
  const D=sugDoor(o,rid),p=sugDoorPt(D,D.w+300,R.h,'Az ablak mellett, ' +R.h+' mm');if(p)out.push(p);});return out;};
SUG_ANCHORS.wetWall=(R,e)=>{const fs=sugFaces(e);if(!fs.length)return [];const f=fs.reduce((a,b)=>(b.u1-b.u0)>(a.u1-a.u0)?b:a);
  const mid=(f.u0+f.u1)/2,us=(R.count||1)===3?[mid-750,mid,mid+750]:[mid],wi=wallInfo(f.r);
  return us.filter(u=>u>f.u0+100&&u<f.u1-100).map(u=>{const p=mrkFacePt(f.r,f.side,u,-wi.thick/2);
    return {kind:'pt',x:Math.round(p[0]),y:Math.round(p[1]),h:R.h,level:e.level,wall:f.r.id,side:f.side,mount:'wall',why:(R.count===3?'egymástól 750 mm, könyökmagasság':'szemmagasság')+' — vizes fal'};});};
SUG_ANCHORS.roomFloor=(R,e)=>{const c=sugCentroid(e.rm.poly);return [{kind:'pt',x:Math.round(c[0]),y:Math.round(c[1]),h:0,level:e.level,mount:'floor',why:'A padlófűtési zóna közepe'}];};
// which rooms tick which extras: the portal slots everywhere a door is a portal, the rest by room kind
(function(){const P=['XSP','XTM','XLB','XSE','XDP','XLT'],K={nappali:['XCC'],konyha:['XFN','XPH','XFH','XAQ'],etkezo:['XFH'],furdo:['XTT','XID','XFN','XAQ','XFH'],wc:['XAQ']};
  NEED_DEFAULTS['*']['sys:EXTRA']=P.slice();Object.keys(K).forEach(k=>{NEED_DEFAULTS[k]=NEED_DEFAULTS[k]||{};NEED_DEFAULTS[k]['sys:EXTRA']=P.concat(K[k]);});})();

// ==================================================================================================================
// preloaded plans (tools/make-preload.js bakes window.VRG_PRELOAD into a build)
// ==================================================================================================================
function preList(){return (typeof window!=='undefined'&&Array.isArray(window.VRG_PRELOAD))?window.VRG_PRELOAD:[];}
function preLoad(i){const p=preList()[i];if(!p)return false;
  hardResetWorkspace();applyProjectData(JSON.parse(JSON.stringify(p.project)));currentProjId=null;
  stacks.forEach(S=>{['cluster','sys:EXTRA'].forEach(k=>stkEnsureRole(S,k));});
  if(typeof renderProjects==='function')renderProjects();if(typeof renderShell==='function')renderShell();draw();
  $('hud').textContent='Betöltve: '+p.name+' — mentsd el a Tervek panelen („Mentés mint…”), hogy megmaradjon.';return true;}
function preOffer(){const L=preList();if(!L.length)return;
  openModal('Előtöltött tervek',
    L.map((p,i)=>`<div class="mrow"><label><input type="radio" name="preP" value="${i}" ${i===0?'checked':''}> <b>${esc(p.name)}</b><br><span style="font-size:11px;color:#888">${esc(p.note||'')}</span></label></div>`).join('')
    +`<div class="mrow" style="font-size:11px;color:#888">Mégse = a legutóbbi munkamenet marad. Később: ⌘K → „Előtöltött terv…”.</div>`,
    ()=>{const v=(document.querySelector('input[name=preP]:checked')||{}).value;if(v!=null)preLoad(+v);},'Betöltés');}
function preloadBoot(){if(preList().length)setTimeout(preOffer,60);}

registerActions([
 {id:'cls.place',alias:'klaszterdoboz elhelyezes cluster box place',label:'Klaszterdoboz elhelyezése',icon:'▦',group:'Klaszter',
  hint:'K1 / K2 / K3 (←/→) a falra, alsó / középső / felső zónában (↑/↓). Több réteg végpontjai egy süllyesztett házban.',run:()=>clsToolStart()},
 {id:'cls.suggest',alias:'klaszterek vegpontokbol cluster endpoints group auto',label:'Klaszterek a végpontokból',icon:'▦',group:'Klaszter',
  hint:'Azonos falfelületen, azonos zónában, ≤ 300 mm-re egymástól álló végpontok egy dobozba; osztály a darabszámból, erős + gyenge → K3.',run:()=>clsAutoAll()},
 {id:'cls.auto',alias:'masodlagos klaszter auto secondary cluster',label:'Másodlagos klaszterdoboz egyéni helyen be / ki',icon:'▦',group:'Klaszter',
  hint:'Ha egy felsőbb réteg végpontját egyéni helyre teszed, automatikusan nyílik egy másodlagos klaszterdoboz a későbbi rétegeknek.',
  run:()=>{state.clsAuto=state.clsAuto===false;lyrHud('Másodlagos klaszterdoboz: '+(state.clsAuto===false?'ki':'be'));}},
 {id:'ideal.all',alias:'idealis helyek minden reteg ideal spots all layers',label:'Ideális helyek: minden réteg / csak az aktív',icon:'✦',group:'Végpont',
  hint:'Alapból csak az aktív réteg ideális helyei látszanak; ezzel minden olyan rétegé, amelynek ✦ gombja be van kapcsolva.',
  run:()=>{state.idealAll=!state.idealAll;lyrHud('Ideális helyek: '+(state.idealAll?'minden réteg':'csak az aktív réteg'));draw();}},
 {id:'ideal.off',alias:'idealis helyek ki be ideal spots toggle',label:'Ideális helyek be / ki (mindenhol)',icon:'✧',group:'Végpont',
  run:()=>{state.idealOff=!state.idealOff;lyrHud('Ideális helyek '+(state.idealOff?'ki':'be'));draw();}},
 {id:'stack.ensure',alias:'hianyzo reteg klaszter extra stack layers add',label:'Klaszter + Extrák réteg a stackhez',icon:'▤',group:'Stack',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>{const S=stkActive();['cluster','sys:EXTRA'].forEach(k=>stkEnsureRole(S,k));draw();lyrHud('Rétegek rendben: Klaszterpontok, Extrák és ötletek.');}},
 {id:'preload.open',alias:'elotoltott terv p33 preload plan',label:'Előtöltött terv…',icon:'📂',group:'Projekt',
  need:'Ebben a buildben nincs előtöltött terv.',when:()=>preList().length>0,run:()=>preOffer()}
]);

// test hooks
window.CLS_K=CLS_K;window.CLS_ZONES=CLS_ZONES;window.CL_T=CL_T;window.XTR_CAT=XTR_CAT;
window.clsZoneOf=clsZoneOf;window.clsHigher=clsHigher;window.clsList=clsList;window.clsMembers=clsMembers;window.stkEnsureRole=stkEnsureRole;window.clsMake=clsMake;
window.clsPlace=clsPlace;window.clsCreateFor=clsCreateFor;window.clsNearNode=clsNearNode;window.clsGroups=clsGroups;window.clsAutoAll=clsAutoAll;
window.clsCornerSpots=clsCornerSpots;window.clsSpots=clsSpots;window.clsToolStart=clsToolStart;window.clsSymbol=clsSymbol;window.clsTargetG=clsTargetG;window.clsDeviceList=clsDeviceList;
window.idealCap=idealCap;window.idealShown=idealShown;window.idealSpots=idealSpots;window.idealVisible=idealVisible;window.idealSvg=idealSvg;window.idealHit=idealHit;
window.idealG=idealG;window.idealPlace=idealPlace;window.idealItems=idealItems;window.preList=preList;window.preLoad=preLoad;window.preOffer=preOffer;window.preloadBoot=preloadBoot;
