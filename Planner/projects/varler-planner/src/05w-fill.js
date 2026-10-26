// ==========================================================================
// 05w-fill.js — the auto-fill: runs, pipes, conduit sizing; the channel fill (WP-E3, E4)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// The physics rule that keeps this simple and right:
//   A PIPE CAN ONLY START AND END AT A BOX. A cable leaves its conduit only at a box (RBX, an endpoint's box, a
//   kötődoboz), so every RUN LEG — origin → endpoint (star) or member → next member (chain) — is its own pipe,
//   running beside the others on a shared route. Two legs share one pipe only when they are the same FAMILY and run
//   between the same two boxes (2 × Cat6A to a double data point). Families never share a pipe (STD-001-A2 rule 1).
// Stored results follow wiring_pipeline decision 3: data.runs (stage 'stack' | 'channel') and per route section
// sec.cont = {auto:[…], manual, basis} where every auto entry carries `src` ('room:<id>' | 'chn:<route id>') and a
// writer replaces only its own entries. Lengths are approximations (decision 6): Σ route + slack per end, waste in
// the report, labelled tájékoztató. Prefix: afill.

// ---- catalogues (01_CATALOGUES §6–§7). od = outer diameter (mm, the UPPER end of A2 §2.2: size up when in doubt) ----
const AFILL_CABLES={
 NYM3x15:{n:'NYM-J 3×1,5',od:9},   NYM3x25:{n:'NYM-J 3×2,5',od:10.5}, NYM4x15:{n:'NYM-J 4×1,5',od:10},
 NYM5x25:{n:'NYM-J 5×2,5',od:12},  NYM3x6:{n:'NYM-J 3×6',od:13.5},    NYM5x6:{n:'NYM-J 5×6',od:16},
 H05_2x15:{n:'H05VV-F 2×1,5',od:7.5}, H05_2x25:{n:'H05VV-F 2×2,5',od:9},
 JY2x2x08:{n:'J-Y(St)Y 2×2×0,8',od:5.5}, JY4x2x08:{n:'J-Y(St)Y 4×2×0,8',od:7},
 LIYCY4x05:{n:'LiYCY 4×0,5',od:6}, LIYCY6x025:{n:'LiYCY 6×0,25',od:5.5/*r*/}, LIYY2x05:{n:'LiYY 2×0,5',od:4.5/*r*/},
 YCYM:{n:'YCYM 2×2×0,8 (KNX)',od:5.5},
 CAT6A_U:{n:'Cat6A U/FTP',od:7.5}, CAT6A_S:{n:'Cat6A S/FTP',od:8},
 AOC_FIX:{n:'HDMI AOC, fix fej',od:4.5,minW:'M40'}, AOC_DET:{n:'HDMI AOC, levehető fej',od:4.5,minW:'M25'},
 AOC_USB:{n:'USB 3.x AOC',od:5/*r*/,minW:'M25'},
 SPK2x15:{n:'Hangszóró 2×1,5',od:6.5}, SPK2x25:{n:'Hangszóró 2×2,5',od:7.5}, SPK4x25:{n:'Hangszóró 4×2,5',od:10},
 LINE:{n:'Árnyékolt vonalkábel',od:6/*r*/},
 ALARM6:{n:'Riasztó 4×0,22+2×0,5 árny.',od:5.5}, SIREN4:{n:'Sziréna 2×0,75+2×0,22 árny.',od:6/*r*/},
 BUS4:{n:'Szolgáltatói 4 eres busz',od:5/*r*/},
 COAX:{n:'Koax RG-6',od:6.9}, JYFIRE:{n:'J-Y(St)Y 2×2×0,8 piros (tűzjelző)',od:5.5},   // round 2026-10-22
 H07VK4:{n:'H07V-K 4 mm² zöld-sárga',od:4.8/*r*/}, H07VK6:{n:'H07V-K 6 mm² zöld-sárga',od:5.5/*r*/},
 SPARE:{n:'Üres cső + behúzószál',od:0,empty:true}};
// flexible light conduit, inner diameter mm (A2 §2.1 — typical, check the datasheet)
const AFILL_CONDUITS=[{k:'M16',id:10.7},{k:'M20',id:14.1},{k:'M25',id:18.3},{k:'M32',id:24.3},{k:'M40',id:31.2},{k:'M50',id:39.6},{k:'M63',id:52.6}];
const AFILL_RULE={single:1.4, fill:0.40, fillLong:0.33, longMm:10000, slackPerEnd:500};
// cls = the sharing class of A2 §5; c = drawing colour (the role colours of 05s)
const AFILL_FAMS={MAINS:{n:'Erősáram',cls:'mains',c:'#d1493f'},LV:{n:'A busz (SELV)',cls:'selvp',c:'#e6a800'},BUSB:{n:'B busz (biztosított)',cls:'selvp',c:'#b07a2a'},
  CONTROL:{n:'Vezérlés',cls:'sig',c:'#7a5cc0'},DATA:{n:'Adat',cls:'sig',c:'#16a085'},KNX:{n:'KNX',cls:'sig',c:'#2e7d32'},SENSOR:{n:'Érzékelő',cls:'sig',c:'#2f79c9'},
  MEDIA:{n:'Média',cls:'sig',c:'#c2638a'},USB:{n:'USB',cls:'sig',c:'#607d8b'},SECURITY:{n:'Biztonság',cls:'sec',c:'#444444'},SPARE:{n:'Tartalék',cls:'spare',c:'#999999'},
  // round 2026-10-22: bonding travels with mains; fire never shares a conduit with anything (Q-V10 A)
  BOND:{n:'EPH / védővezető',cls:'mains',c:'#8db600'},FIRE:{n:'Tűzjelző',cls:'fire',c:'#8e0f2b'}};
const AFILL_SHARE={'mains|selvp':'warn','mains|sig':'warn','mains|sec':'warn',
  'selvp|sig':'ok','selvp|sec':'ok','sig|sec':'ok','mains|mains':'ok','selvp|selvp':'ok','sig|sig':'ok','sec|sec':'ok',
  'fire|mains':'warn','fire|selvp':'warn','fire|sig':'warn','fire|sec':'warn','fire|fire':'ok'};
const AFILL_SHARE_MSG='Erősáram és törpefeszültség egy nyomvonalon: ≥ 50 mm távolság vagy rögzített fémválaszfal, keresztezés 90°-ban (A2 §5).';

function afillRuns(){if(!Array.isArray(data.runs))data.runs=[];return data.runs;}
function afillCondIx(k){const i=AFILL_CONDUITS.findIndex(c=>c.k===k);return i<0?0:i;}
function afillArea(d){return Math.PI*d*d/4;}
function afillCabName(c){return (AFILL_CABLES[c]||{n:c}).n;}
// the conduit a set of cables needs: {size, fill, why, over?}. cables = [{c, n, w}]
function afillSize(cables,lenMm,minK){const list=(cables||[]).filter(c=>c&&AFILL_CABLES[c.c]);let need=minK?afillCondIx(minK):0;
  list.forEach(c=>{need=Math.max(need,afillCondIx(c.w||'M16'),afillCondIx(AFILL_CABLES[c.c].minW||'M16'));});
  const real=list.filter(c=>!AFILL_CABLES[c.c].empty);
  if(!real.length){const C=AFILL_CONDUITS[need];return {size:C.k,fill:0,why:'üres cső + behúzószál → '+C.k};}
  const n=real.reduce((s,c)=>s+(c.n||1),0),area=real.reduce((s,c)=>s+(c.n||1)*afillArea(AFILL_CABLES[c.c].od),0);
  const lbl=real.map(c=>((c.n||1)>1?(c.n)+'×':'1×')+afillCabName(c.c)).join(' + ');
  if(n===1){const od=AFILL_CABLES[real[0].c].od,i=AFILL_CONDUITS.findIndex(k=>k.id>=AFILL_RULE.single*od);need=Math.max(need,i<0?AFILL_CONDUITS.length-1:i);
    const C=AFILL_CONDUITS[need];return {size:C.k,fill:+(area/afillArea(C.id)).toFixed(3),why:lbl+': ID '+C.id+' ≥ 1,4 × '+od+' → '+C.k};}
  const k=lenMm>AFILL_RULE.longMm?AFILL_RULE.fillLong:AFILL_RULE.fill;
  for(let i=need;i<AFILL_CONDUITS.length;i++){const C=AFILL_CONDUITS[i],f=area/afillArea(C.id);
    if(f<=k+1e-9)return {size:C.k,fill:+f.toFixed(3),why:lbl+': '+Math.round(f*100)+' % ≤ '+Math.round(k*100)+' % → '+C.k};}
  const C=AFILL_CONDUITS[AFILL_CONDUITS.length-1],f=area/afillArea(C.id);
  return {size:C.k,fill:+f.toFixed(3),why:lbl+': '+Math.round(f*100)+' % — túltelített M63 is',over:true};}
// FNV-1a 32-bit, hex
function afillHash(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return 'h:'+h.toString(16);}

// ---- planning one room (pure) -----------------------------------------------------------------------------------------
function afillGroupsOf(roomId,S){const out=[];STK_ROLES.forEach(r=>{if(r.k.indexOf('sys:')!==0||r.k==='sys:RF'||!stkLayer(S.id,r.k))return;
  epGroupsFor(roomId,r.k,S.id).forEach(g=>out.push(Object.assign({role:r.k},g)));});return out;}
function afillBasis(roomId,S){S=S||stkActive();const routes=data.paths.filter(p=>p&&(p.route==='arm'||p.route==='channel')).map(p=>[p.id,p.rule,(p.nodes||[]).map(n=>[n.id,Math.round(n.x),Math.round(n.y),Math.round(n.h||0),n.j?n.j.p+'/'+n.j.n:''])]);
  const groups=S?afillGroupsOf(roomId,S):[];const ids=new Set();groups.forEach(g=>g.members.forEach(m=>ids.add(m)));
  const devs=data.devices.filter(d=>d&&(ids.has(d.id)||d.type==='rbx'||d.type==='board'||d.type==='ssc')).map(d=>[d.id,Math.round(d.x),Math.round(d.y),Math.round(d.h||0),d.code||d.type,d.var||'',d.layer,devLinks(d).map(l=>l.p+'/'+l.n).join(','),(d.serves||[]).join(',')]);
  return afillHash(JSON.stringify([routes,devs,groups.map(g=>[g.key,g.topo,g.members])]));}
// nearest device of a type by graph distance from a key
function afillNearestOf(G,type,fromKey){const D=rgDijkstra(G,fromKey);let best=null,bd=Infinity;
  data.devices.forEach(d=>{if(!d||d.type!==type)return;const k=rgDevKey(d.id),x=D.dist.get(k);if(x!==undefined&&(x<bd-1e-9||(Math.abs(x-bd)<=1e-9&&best&&d.id<best.id))){bd=x;best=d;}});return best;}
// → {room, rbx, runs:[…], pipes:[…], warns:[…]}
function afillPlanRoom(stackId,roomId,G){const S=stackId?stkById(stackId):stkActive(),warns=[],runs=[];
  const room=mrkRoomById(roomId),lbl=room?((room.rm.num?room.rm.num+' ':'')+(room.rm.name||roomId)):roomId;
  const rbx=(typeof hwRoomRbx==='function')?hwRoomRbx(roomId):null;
  if(!S)return {room:roomId,rbx:null,runs,pipes:[],warns:[{sev:'error',code:'fill.nostack',msg:'Nincs aktív BRIDGE Stack.'}]};
  if(!rbx)return {room:roomId,rbx:null,runs,pipes:[],warns:[{sev:'error',code:'fill.norbx',msg:lbl+': nincs RBX hozzárendelve.',ref:roomId}]};
  G=G||rgBuild({routes:['arm','channel']});
  afillGroupsOf(roomId,S).forEach(g=>{const first=byId('devices',g.members[0]);if(!first)return;
    epCables(first).forEach((cab,ci)=>{
      // the origin: the room's RoomBox, or — never through a RoomBox — the board / the SSC nearest by route
      let org=null;
      if(cab.from==='rbx')org=rbx;
      else{const k0=rgDevKey(first.id);org=G.nodes.has(k0)?afillNearestOf(G,cab.from==='board'?'board':'ssc',k0):null;
        if(!org)org=hwList(cab.from==='board'?'board':'ssc')[0]||null;}
      if(!org){warns.push({sev:'error',code:'fill.noorigin',msg:lbl+': nincs '+(cab.from==='board'?'Elosztószekrény':cab.from==='ssc'?'biztonsági központ':'RBX')+' a '+g.code+' kábeléhez.',ref:first.id});return;}
      const ok=rgDevKey(org.id);
      if(!G.nodes.has(ok)){warns.push({sev:'warn',code:'fill.unreached',msg:(org.ref||org.id)+': nincs pályán (ARM / csatorna).',ref:org.id});return;}
      const mk=g.members.map(rgDevKey),legs=[];
      const miss=m=>{const d=byId('devices',m.slice(2));warns.push({sev:'warn',code:'fill.unreached',msg:((d&&(d.ref||d.id))||m)+': nincs pályán a '+(org.ref||org.id)+'-ig',ref:m.slice(2)});};
      if(g.topo==='chain'){const C=rgChain(G,ok,mk);C.legs.forEach(l=>legs.push(l));C.unreached.forEach(miss);}
      else if(g.topo==='tree'){const ST=rgSteiner(G,[ok].concat(mk));ST.unreached.forEach(miss);
        const stops=new Set([ok].concat(mk).concat(ST.branch));
        ST.branch.forEach(b=>{const nd=G.nodes.get(b);if(nd&&nd.kind!=='dev')warns.push({sev:'warn',code:'fill.branch',msg:'Elágazás doboz nélkül: kötődoboz kell ide ('+b+')',ref:b});});
        rgTreeLegs(ST,ok,[...stops]).forEach(l=>legs.push(Object.assign(l,{len:rgLen(G,l.keys)})));}
      else rgStar(G,ok,mk).forEach(s=>{if(!s.keys){miss(s.to);return;}legs.push({from:ok,to:s.to,keys:s.keys,len:s.len});});
      legs.forEach(l=>{const edges=rgPathEdges(G,l.keys);
        runs.push({role:g.role,code:g.code,group:g.key,fam:cab.c==='SPARE'?'SPARE':(cab.fam||'MAINS'),cable:cab.c,n:cab.n||1,w:cab.w,ci,origin:cab.from,
          from:l.from.indexOf('D:')===0?l.from.slice(2):l.from,to:l.to.indexOf('D:')===0?l.to.slice(2):l.to,
          segs:edges.filter(x=>x.e.k==='seg').map(x=>({p:x.e.p,a:x.e.a,b:x.e.b,si:x.e.si})),
          route:Math.round(l.len),len:Math.round(l.len+2*AFILL_RULE.slackPerEnd)});});});});
  // pipes: one per (family, from, to); a spare is always its own
  const byKey=new Map();
  runs.forEach((r,i)=>{const key=r.fam==='SPARE'?'SPARE|'+r.from+'|'+r.to+'|'+r.group+'|'+r.ci:r.fam+'|'+r.from+'|'+r.to;r.pipe=key;
    if(!byKey.has(key))byKey.set(key,{key,fam:r.fam,from:r.from,to:r.to,cables:[],segs:r.segs,len:r.route});
    const P=byKey.get(key);const ex=P.cables.find(c=>c.c===r.cable&&c.w===r.w);if(ex)ex.n+=r.n;else P.cables.push({c:r.cable,n:r.n,w:r.w});});
  const pipes=[...byKey.values()];
  pipes.forEach(P=>Object.assign(P,afillSize(P.cables,P.len)));
  pipes.forEach(P=>{if(P.over)warns.push({sev:'warn',code:'fill.overfill',msg:'Túltelített cső: '+P.why,ref:P.key});});
  // route sharing (A2 §5) and the ban walls
  const perSec=new Map();pipes.forEach(P=>P.segs.forEach(s=>{const k=s.p+':'+s.si;if(!perSec.has(k))perSec.set(k,new Set());perSec.get(k).add(P.fam);}));
  perSec.forEach((fams,k)=>{const cls=[...fams].map(f=>(AFILL_FAMS[f]||{}).cls).filter(c=>c&&c!=='spare');let bad=false;
    for(let i=0;i<cls.length&&!bad;i++)for(let j=i+1;j<cls.length;j++){const pr=[cls[i],cls[j]].sort().join('|');if(cls[i]!==cls[j]&&AFILL_SHARE[pr]==='warn'){bad=true;break;}}
    if(bad)warns.push({sev:'warn',code:'fill.share',msg:AFILL_SHARE_MSG+' ('+k+')',ref:k});});
  const banned=new Set();if(typeof armBanSegs==='function')data.paths.forEach(p=>{if(!p||p.rule==='csat'||(p.route!=='arm'&&p.route!=='channel'))return;
    armBanSegs(p).forEach(b=>{if(b.kind==='along')banned.add(p.id+':'+b.si);});});
  [...perSec.keys()].filter(k=>banned.has(k)).forEach(k=>warns.push({sev:'warn',code:'fill.ban',msg:'Tartófalon süllyesztett cső: '+k,ref:k}));
  return {room:roomId,rbx:rbx.id,runs,pipes,warns,basis:afillBasis(roomId,S)};}

// ---- apply -------------------------------------------------------------------------------------------------------------------
function afillSec(pid,si){const p=pathById(pid);return p&&p.sections?p.sections[si]:null;}
function afillDropSrc(src){data.paths.forEach(p=>(p.sections||[]).forEach(sec=>{if(sec&&sec.cont&&Array.isArray(sec.cont.auto)){
  sec.cont.auto=sec.cont.auto.filter(a=>a.src!==src);if(!sec.cont.auto.length&&!sec.cont.manual)delete sec.cont;}}));}
function afillPutPipe(P,src,basis,extra){P.segs.forEach(s=>{const sec=afillSec(s.p,s.si);if(!sec)return;
  sec.cont=sec.cont||{auto:[],manual:null};sec.cont.auto=sec.cont.auto||[];
  sec.cont.auto.push(Object.assign({src,pipe:P.key,fam:P.fam,size:P.size,n:P.cables.reduce((a,c)=>a+(c.n||1),0),fill:P.fill,cables:P.cables.map(c=>({c:c.c,n:c.n}))},extra||{}));
  sec.cont.basis=basis;});}
function afillApply(plans,S){S=S||stkActive();if(!plans.length)return 0;pushUndo(['paths','runs']);let n=0;
  plans.forEach(pl=>{if(!pl.rbx)return;const src='room:'+pl.room;
    data.runs=afillRuns().filter(r=>!(r.stage==='stack'&&r.room===pl.room&&r.manual!==true));
    afillDropSrc(src);
    pl.runs.forEach(r=>{afillRuns().push({stage:'stack',stack:S.id,role:r.role,room:pl.room,code:r.code,group:r.group,fam:r.fam,from:r.from,to:r.to,
      via:r.segs.map(s=>({p:s.p,a:s.a,b:s.b})),cable:{c:r.cable,n:r.n},len:r.len,pipe:r.pipe,basis:pl.basis});n++;});
    pl.pipes.forEach(P=>afillPutPipe(P,src,pl.basis));});
  ensureIds(data);if(typeof invalidateShell==='function')invalidateShell();draw();return n;}
// pipes of a section that are not merged into a trunk (E4)
function afillSecPipes(sec){const a=(sec&&sec.cont&&Array.isArray(sec.cont.auto))?sec.cont.auto:[],merged=new Set();
  a.forEach(x=>(x.merged||[]).forEach(k=>merged.add(k)));
  return a.filter(x=>!(x.src.indexOf('room:')===0&&merged.has(x.pipe)));}
// stale = the stored basis differs from the current one
function afillStale(roomId,S){const rs=afillRuns().filter(r=>r.stage==='stack'&&r.room===roomId);if(!rs.length)return false;return rs[0].basis!==afillBasis(roomId,S);}
function afillManualStale(){const out=[];data.paths.forEach(p=>(p.sections||[]).forEach((sec,si)=>{if(sec&&sec.cont&&sec.cont.manual&&sec.cont.auto&&sec.cont.auto.length){
  const rooms=[...new Set(sec.cont.auto.filter(a=>a.src.indexOf('room:')===0).map(a=>a.src.slice(5)))];
  if(rooms.some(r=>afillStale(r)))out.push({sev:'warn',code:'fill.manual',msg:'Kézi érték, a bemenet azóta változott: '+p.id+':'+si,ref:p.id});}}));return out;}

// ==================================================================================================================
// WP-E4 — the channel fill: the CHANNEL bundle, the RoomBox feeds, the trunks
// ==================================================================================================================
const AFILL_PACK_CAP=afillArea(24.3)*AFILL_RULE.fill;   // M32 at 40 % — A2: "two S04 circuits on one route → M32"
// the socket circuits a RoomBox carries: real 05j circuits with a SOC member in its rooms + the implicit room circuits
function afillRbxCircuits(rbx,S){const out=new Map();hwServes(rbx).forEach(rid=>epCircuits(rid,S.id).forEach(c=>{
  const socs=c.members.map(id=>byId('devices',id)).filter(d=>d&&epCodeOf(d)==='SOC');if(!socs.length)return;
  if(!out.has(c.key))out.set(c.key,{key:c.key,name:c.name,cable:(epVar(socs[0])||{}).k==='25'?'NYM3x25':'NYM3x15'});}));return [...out.values()];}
// first-fit decreasing into M32-at-40 % bins, then each bin sized with a minimum of M25 (STD-001 §3.1) [Q38=A]
function afillPackMains(cables,lenMm){const items=[];cables.forEach(c=>{for(let i=0;i<(c.n||1);i++)items.push({c:c.c,a:afillArea(AFILL_CABLES[c.c].od)});});
  items.sort((x,y)=>y.a-x.a||(x.c<y.c?-1:1));const bins=[];
  items.forEach(it=>{const b=bins.find(b=>b.a+it.a<=AFILL_PACK_CAP+1e-9);if(b){b.a+=it.a;b.items.push(it);}else bins.push({a:it.a,items:[it]});});
  return bins.map(b=>{const cs=[];b.items.forEach(it=>{const ex=cs.find(c=>c.c===it.c);if(ex)ex.n++;else cs.push({c:it.c,n:1,w:'M20'});});
    return Object.assign({cables:cs},afillSize(cs,lenMm,'M25'));});}
function afillSegsOf(p){return (p.sections||[]).map((s,si)=>({p:p.id,a:p.nodes[si].id,b:p.nodes[si+1].id,si}));}
// → {routes:[{p, carrier, pipes:[…], note?}], runs:[…], warns:[…]}
function afillChannelPlan(stackId,onlyRbxId){const S=stackId?stkById(stackId):stkActive(),out={routes:[],runs:[],warns:[]};if(!S)return out;
  const T=chnTree(),E=afillEloRules();
  const below=pid=>hwList('rbx').filter(x=>T[x.id]&&T[x.id].via.indexOf(pid)>=0);          // every RBX whose way to BASE uses this route
  const wanted=p=>{if(!onlyRbxId)return true;const t=T[onlyRbxId];const ends=chnEnds(p);return (t&&t.via.indexOf(p.id)>=0)||ends.some(d=>d&&d.id===onlyRbxId);};
  chnRoutes().forEach(p=>{if(!wanted(p))return;const k=chnCarrier(p),len=Math.round(chnLen(p)),segs=afillSegsOf(p),R={p:p.id,carrier:k,pipes:[]};
    if(k==='channel'){const n=below(p.id).length||1;
      CHN_BUNDLE.forEach(b=>{const cables=b.cab.map(c=>({c:c.c,n:(c.c==='SPARE'?1:(c.n||1)*n),w:b.w}));
        const area=cables.filter(c=>!AFILL_CABLES[c.c].empty).reduce((s,c)=>s+c.n*afillArea(AFILL_CABLES[c.c].od),0),f=area/afillArea(AFILL_CONDUITS[afillCondIx(b.w)].id);
        // the fixed size is enough when the sizing rule would not ask for more (one cable: 1.4 × OD; several: the fill)
        // a real overfill fails even the 40 % rule; 'fits at 40 %, not at the 33 % of a run over 10 m' is STD-001's own C1 vs A2 §1
        const bare=cables.map(c=>({c:c.c,n:c.n,w:'M16'})),fits=afillCondIx(afillSize(bare,0).size)<=afillCondIx(b.w),fitsLong=afillCondIx(afillSize(bare,len).size)<=afillCondIx(b.w);
        R.pipes.push({key:b.k,fam:b.fam||'SPARE',cables,segs,len,size:b.w,fill:+f.toFixed(3),why:b.k+' '+b.w+(b.note?' — '+b.note:''),over:!fits});
        if(fits&&!fitsLong)out.warns.push({sev:'info',code:'chn.long',msg:b.k+' '+b.w+' ('+chnName(p)+', '+(len/1000).toFixed(1)+' m): '+Math.round(f*100)+' % — a 10 m feletti szakaszra az A2 33 %-ot enged, az STD-001 rögzített mérete ennél szűkebb. Ellenőrizd a csövet.',ref:p.id});
        if(!fits)out.warns.push({sev:'warn',code:'chn.overfill',msg:b.k+' túltelítve ('+chnName(p)+'): '+cables.map(c=>c.n+' × '+afillCabName(c.c)).join(' + ')+' ('+Math.round(f*100)+' %) — STD-001 nem szabályozza a láncolt köteget; döntés kell: párhuzamos köteg vagy nagyobb cső.',ref:p.id});});}
    else if(k==='mains'){const e=chnEnds(p),rb=e.find(d=>d&&d.type==='rbx'),sc=e.find(d=>d&&d.type==='ssc');let cables=[];
      if(rb){cables.push({c:'NYM3x15',n:E.lightPerRbx});afillRbxCircuits(rb,S).forEach(c=>cables.push({c:c.cable,n:1}));}
      else if(sc)cables.push({c:'NYM3x15',n:E.sys.ssc});
      afillPackMains(cables,len).forEach((B,i)=>R.pipes.push(Object.assign({key:'MAINS.'+(i+1),fam:'MAINS',segs,len},B)));}
    else if(k==='panel'){R.pipes.push(Object.assign({key:'SYS',fam:'MAINS',cables:[{c:'NYM3x15',n:E.sys.base,w:'M20'}],segs,len},afillSize([{c:'NYM3x15',n:E.sys.base,w:'M20'}],len,'M25')));   /*r*/
      R.pipes.push(Object.assign({key:'PANEL',fam:'CONTROL',cables:[{c:'CAT6A_S',n:1,w:'M20'}],segs,len},afillSize([{c:'CAT6A_S',n:1,w:'M20'}],len)));   /*r*/
      R.note='PANEL LINK + rendszerkörök: erősáram és vezérlés egy nyomvonalon — szándékos (≥ 50 mm vagy válaszfal).';}
    else if(k==='data')R.pipes.push(Object.assign({key:'DATA',fam:'DATA',cables:[{c:'CAT6A_U',n:1,w:'M20'}],segs,len},afillSize([{c:'CAT6A_U',n:1,w:'M20'}],len)));
    else if(k==='isp')R.pipes.push({key:'ISP',fam:'SPARE',cables:[{c:'SPARE',n:1,w:'M25'}],segs,len,size:'M25',fill:0,why:'üres M25 + behúzószál — a szolgáltató kábele az övé'});   /*r*/
    else if(k==='security'){const keys=new Set(),cab=[];afillRuns().forEach(r=>{if(r.stage!=='stack'||r.fam!=='SECURITY')return;
        if((r.via||[]).some(v=>v.p===p.id)){keys.add(r.pipe);const ex=cab.find(c=>c.c===r.cable.c);if(ex)ex.n+=r.cable.n||1;else cab.push({c:r.cable.c,n:r.cable.n||1,w:'M16'});}});
      if(cab.length)R.pipes.push(Object.assign({key:'TRUNK',fam:'SECURITY',cables:cab,segs,len,merged:[...keys]},afillSize(cab,len,'M25')));
      else R.note='Nincs még biztonsági végpont-futás ezen a törzsön (előbb a helyiségek feltöltése).';}
    else if(k==='feed')R.note='A betáp a szolgáltató szabályai szerint (A08) — nem számolt.';
    out.routes.push(R);});
  // runs of the bundle: BASE → every reached RBX, through its chain (logical star, physical chain)
  hwList('rbx').forEach(x=>{const t=T[x.id];if(!t||(onlyRbxId&&x.id!==onlyRbxId&&!(T[onlyRbxId]&&T[onlyRbxId].via.some(v=>t.via.indexOf(v)>=0))))return;
    const via=[];t.via.forEach(pid=>{const p=pathById(pid);if(p)afillSegsOf(p).forEach(s=>via.push({p:s.p,a:s.a,b:s.b}));});
    const L=Math.round(t.len+2*AFILL_RULE.slackPerEnd);
    CHN_BUNDLE.forEach(b=>b.cab.forEach(c=>{if(c.c==='SPARE')return;out.runs.push({carrier:'channel',code:b.k,from:t.root,to:x.id,via,cable:{c:c.c,n:c.n||1},len:L,fam:b.fam});}));});
  return out;}
function afillEloRules(){return (typeof ELO_RULES!=='undefined')?ELO_RULES:{lightPerRbx:1,sys:{base:2,ssc:2,pack:1}};}
function afillChannelApply(plan,S){S=S||stkActive();if(!plan||!plan.routes.length)return 0;pushUndo(['paths','runs']);
  const touched=new Set(plan.routes.map(R=>R.p));
  data.runs=afillRuns().filter(r=>!(r.stage==='channel'&&r.manual!==true&&(r.via||[]).some(v=>touched.has(v.p))));
  plan.routes.forEach(R=>{afillDropSrc('chn:'+R.p);R.pipes.forEach(P=>afillPutPipe(P,'chn:'+R.p,'',P.merged?{merged:P.merged}:null));});
  plan.runs.forEach(r=>afillRuns().push(Object.assign({stage:'channel'},r)));
  ensureIds(data);if(typeof invalidateShell==='function')invalidateShell();draw();return plan.runs.length;}

// ---- report (the phase-3 seam) --------------------------------------------------------------------------------------------------
function afillReport(stackId){const S=stackId?stkById(stackId):stkActive();if(!S)return null;const waste=1+(+state.waste||0)/100;
  const m=x=>Math.round(x/100)/10;
  const out={stack:S.id,rbx:[],channels:[],warnings:[]};
  hwList('rbx').forEach(x=>{const rooms=hwServes(x),roles={},tot={cables:{},pipes:{}};
    afillRuns().filter(r=>r.stage==='stack'&&rooms.indexOf(r.room)>=0).forEach(r=>{const R=roles[r.role]||(roles[r.role]={role:r.role,endpoints:new Set(),cables:{},pipes:{}});
      R.endpoints.add(r.to);const nm=afillCabName(r.cable.c),len=r.len*(r.cable.n||1)*waste;R.cables[nm]=(R.cables[nm]||0)+len;tot.cables[nm]=(tot.cables[nm]||0)+len;});
    const seen=new Set();data.paths.forEach(p=>(p.sections||[]).forEach((sec,si)=>{afillSecPipes(sec).forEach(a=>{if(a.src.indexOf('room:')!==0||rooms.indexOf(a.src.slice(5))<0)return;
      const L=Math.hypot(p.nodes[si+1].x-p.nodes[si].x,p.nodes[si+1].y-p.nodes[si].y,(p.nodes[si+1].h||0)-(p.nodes[si].h||0));
      tot.pipes[a.size]=(tot.pipes[a.size]||0)+L;});}));
    const fix=o=>{Object.keys(o).forEach(k=>{o[k]=m(o[k]);});return o;};
    out.rbx.push({id:x.id,ref:x.ref||x.id,rooms,roles:Object.values(roles).map(R=>({role:R.role,endpoints:R.endpoints.size,cables:fix(R.cables)})),
      totals:{cables:fix(tot.cables),pipes:fix(tot.pipes)},chain:(typeof chnChain==='function')?chnChain(x.id):null});});
  chnRoutes().forEach(p=>{const pipes=[];(p.sections||[]).slice(0,1).forEach(sec=>afillSecPipes(sec).filter(a=>a.src==='chn:'+p.id).forEach(a=>pipes.push({k:a.pipe,size:a.size,fill:a.fill,cables:a.cables})));
    out.channels.push({id:p.id,name:chnName(p),carrier:chnCarrier(p),len:m(chnLen(p)),pipes});});
  return out;}

// ---- drawing: one thin line per pipe along every filled section ----------------------------------------------------------------
function afillSceneSvg(){if(state.fillShow===false)return '';let s='';
  data.paths.forEach(p=>{if(!p||(p.route!=='arm'&&p.route!=='channel')||!layerShows(p,'path'))return;const ns=p.nodes||[];
    (p.sections||[]).forEach((sec,si)=>{const ps=afillSecPipes(sec);if(!ps.length||!ns[si+1]||!state.levels[ns[si].level])return;
      const a=ns[si],b=ns[si+1],A=planToBase(a.x,a.y,dz(a.level,a.h||0)),B=planToBase(b.x,b.y,dz(b.level,b.h||0));
      let dx=B[0]-A[0],dy=B[1]-A[1];const l=Math.hypot(dx,dy)||1;const nx=-dy/l,ny=dx/l;
      ps.forEach((P,i)=>{const o=(i-(ps.length-1)/2)*1.6,c=(AFILL_FAMS[P.fam]||{c:'#888'}).c;
        s+=`<line x1="${(A[0]+nx*o).toFixed(1)}" y1="${(A[1]+ny*o).toFixed(1)}" x2="${(B[0]+nx*o).toFixed(1)}" y2="${(B[1]+ny*o).toFixed(1)}" stroke="${c}" stroke-width="${vsP(1)}"/>`;});});
    if(s)s=lyrWrap(p,'path',s);});
  return s;}
STK_SCENE.push(afillSceneSvg);

// ---- UI: preview → apply ------------------------------------------------------------------------------------------------------------
function afillSummary(plans){const byRole={},warn={};
  plans.forEach(pl=>{pl.runs.forEach(r=>{const R=byRole[r.role]||(byRole[r.role]={runs:0,cables:{},pipes:{}});R.runs++;const nm=afillCabName(r.cable);R.cables[nm]=(R.cables[nm]||0)+r.len*(r.n||1);});
    pl.pipes.forEach(P=>{const r=pl.runs.find(x=>x.pipe===P.key);const R=byRole[r?r.role:'?']||(byRole[r?r.role:'?']={runs:0,cables:{},pipes:{}});R.pipes[P.size]=(R.pipes[P.size]||0)+(P.len||0);});
    pl.warns.forEach(x=>{(warn[x.code]=warn[x.code]||[]).push(x.msg);});});
  return {byRole,warn};}
function afillPreview(plans,onApply,title){const sm=afillSummary(plans),m=x=>(x/1000).toFixed(1).replace('.',',');
  openModal(title||'Feltöltés — előnézet',
    `<div style="max-height:400px;overflow:auto;font-size:12px">`
    +Object.keys(sm.byRole).sort((a,b)=>stkRoleIx(a)-stkRoleIx(b)).map(k=>{const R=sm.byRole[k];
      return `<div class="mrow"><b>${esc((stkRole(k)||{n:k}).n)}</b> — ${R.runs} futás · `+Object.keys(R.cables).map(c=>esc(c)+' '+m(R.cables[c])+' m').join(' · ')
        +' · '+Object.keys(R.pipes).sort().map(sz=>sz+' '+m(R.pipes[sz])+' m').join(' · ')+`</div>`;}).join('')
    +(Object.keys(sm.warn).length?`<div class="mrow" style="color:#b05a00"><b>Figyelmeztetések</b></div>`
      +Object.keys(sm.warn).map(c=>`<div style="color:#b05a00">${esc(c)} × ${sm.warn[c].length}: ${esc(sm.warn[c][0])}${sm.warn[c].length>1?' …':''}</div>`).join(''):'')
    +`</div><div class="mrow" style="font-size:11px;color:#888">A hosszak tájékoztató jellegűek (pálya + ${AFILL_RULE.slackPerEnd} mm végenként).</div>`,
    ()=>{const n=onApply();lyrHud('Feltöltve: '+n+' futás.');},'Alkalmaz');}
function afillRoomIds(){const out=[];ORD.forEach(l=>stkRooms(l).forEach(r=>{if(r.id)out.push(r.id);}));return out;}
function afillRoomUI(roomId){const S=stkActive();if(!S){lyrHud('Aktív BRIDGE Stack kell hozzá.');return;}
  const G=rgBuild({routes:['arm','channel']}),pl=[afillPlanRoom(S.id,roomId,G)];afillPreview(pl,()=>afillApply(pl,S),'Helyiség feltöltése — előnézet');}
function afillAllUI(){const S=stkActive();if(!S){lyrHud('Aktív BRIDGE Stack kell hozzá.');return;}
  const G=rgBuild({routes:['arm','channel']}),pl=afillRoomIds().map(r=>afillPlanRoom(S.id,r,G)).filter(p=>p.rbx);afillPreview(pl,()=>afillApply(pl,S),'Teljes stack feltöltése — előnézet');}
function afillChannelUI(rbxId){const S=stkActive();if(!S){lyrHud('Aktív BRIDGE Stack kell hozzá.');return;}const P=afillChannelPlan(S.id,rbxId);
  openModal('Csatorna feltöltése — előnézet',`<div style="max-height:400px;overflow:auto;font-size:12px">`
    +P.routes.map(R=>{const p=pathById(R.p);return `<div class="mrow"><b>${esc(p?chnName(p):R.p)}</b> · ${esc(chnCarrierName(R.carrier))}</div>`
      +R.pipes.map(x=>`<div style="margin-left:12px">${esc(x.key)} ${x.size} · ${esc(x.cables.map(c=>c.n+'×'+afillCabName(c.c)).join(' + '))}${x.fill?' · '+Math.round(x.fill*100)+' %':''}</div>`).join('')
      +(R.note?`<div style="margin-left:12px;color:#888">${esc(R.note)}</div>`:'');}).join('')
    +P.warns.map(x=>`<div style="color:#b05a00">${esc(x.msg)}</div>`).join('')+`</div>`,
    ()=>{const n=afillChannelApply(P,S);lyrHud('Csatorna feltöltve: '+n+' futás.');},'Alkalmaz');}
function afillReportUI(){const r=afillReport();if(!r){lyrHud('Aktív BRIDGE Stack kell hozzá.');return;}
  openModal('Kábel- és csőlista (tájékoztató)',`<div style="max-height:420px;overflow:auto;font-size:12px">`
    +r.rbx.map(x=>`<div class="mrow"><b>${esc(x.ref)}</b> — ${x.rooms.length} helyiség${x.chain?' · '+x.chain:''}</div>`
      +`<div style="margin-left:12px">`+Object.keys(x.totals.cables).sort().map(k=>esc(k)+': '+x.totals.cables[k]+' m').join('<br>')+`</div>`
      +`<div style="margin-left:12px;color:#555">`+Object.keys(x.totals.pipes).sort().map(k=>k+': '+x.totals.pipes[k]+' m').join(' · ')+`</div>`).join('')
    +`<div class="mrow"><b>Csatornák</b></div>`+r.channels.map(c=>`<div style="margin-left:12px">${esc(c.name)} · ${esc(chnCarrierName(c.carrier))} · ${c.len} m · ${esc(c.pipes.map(p=>p.k+' '+p.size).join(', '))}</div>`).join('')
    +`</div><div class="mrow" style="font-size:11px;color:#888">Kábelhossz × (1 + ${state.waste||0} % hulladék). Tájékoztató.</div>`,()=>{},'Bezár');}

STK_ROOMMENU.push((rh,items)=>{if(!stkActive())return;items.push({label:'⚙ Helyiség feltöltése…',act:()=>afillRoomUI(stkRoomId(rh))});});
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d||d.type!=='rbx'||!stkActive())return;
  items.push({label:'⚙ Csatorna feltöltése (ez az RBX)',act:()=>afillChannelUI(d.id)});});
(STK_CHECKS.arm=STK_CHECKS.arm||[]).push(S=>{const out=[];afillRoomIds().forEach(r=>{const has=afillRuns().some(x=>x.stage==='stack'&&x.room===r);
  if(has&&afillStale(r,S))out.push({sev:'warn',msg:hwRoomLabel(r)+': a feltöltés elavult — futtasd újra.'});});
  afillManualStale().forEach(x=>out.push(x));return out;});
(STK_CHECKS.channel=STK_CHECKS.channel||[]).push(S=>{const out=[];if(!chnRoutes().length)return out;
  if(!afillRuns().some(r=>r.stage==='channel'))out.push({sev:'info',msg:'A csatornák még nincsenek feltöltve.'});
  afillChannelPlan(S.id).warns.forEach(w=>out.push({sev:w.sev,msg:w.msg}));return out;});

registerActions([
 {id:'fill.room',alias:'helyiseg feltoltese fill room cables conduits',label:'Helyiség feltöltése…',icon:'🧵',group:'Feltöltés',
  hint:'A kijelölt helyiség minden rendszer-rétegének futásai, csövei és kábelei az ARM pályákon (előnézet, majd Alkalmaz).',
  need:'Jelölj ki egy helyiséget (padlót).',when:c=>!!stkActive()&&c.selType==='floors',run:c=>afillRoomUI(data.floors[c.sel.i].id)},
 {id:'fill.all',alias:'teljes stack feltoltese fill all',label:'Teljes stack feltöltése…',icon:'🪡',group:'Feltöltés',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>afillAllUI()},
 {id:'fill.channel',alias:'csatornak feltoltese fill channel bundle',label:'Csatornák feltöltése…',icon:'⇋',group:'Feltöltés',
  hint:'CHANNEL köteg (C1…C5) a BASE-től minden RBX-ig a láncon át, az RBX-ek erősáramú betápja, a biztonsági törzs.',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>afillChannelUI(null)},
 {id:'fill.report',alias:'kabel cso lista report cable conduit list',label:'Kábel- és csőlista',icon:'☰',group:'Feltöltés',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>afillReportUI()},
 {id:'fill.export',alias:'feltoltes export json',label:'Feltöltés exportálása (JSON)',icon:'⬇',group:'Feltöltés',
  need:'Aktív BRIDGE Stack kell hozzá.',when:c=>!!stkActive(),run:()=>download('feltoltes-'+stkActive().name.replace(/\s+/g,'_')+'.json',JSON.stringify(afillReport(),null,1))},
 {id:'fill.show',alias:'csovek mutatasa pipes show',label:'Csövek mutatása be / ki',icon:'≡',group:'Feltöltés',run:()=>{state.fillShow=state.fillShow===false;draw();}}
]);

// test hooks
window.AFILL_CABLES=AFILL_CABLES;window.AFILL_CONDUITS=AFILL_CONDUITS;window.AFILL_RULE=AFILL_RULE;window.AFILL_FAMS=AFILL_FAMS;
window.afillRuns=afillRuns;window.afillSize=afillSize;window.afillPlanRoom=afillPlanRoom;window.afillApply=afillApply;window.afillBasis=afillBasis;window.afillStale=afillStale;
window.afillSecPipes=afillSecPipes;window.afillReport=afillReport;window.afillChannelPlan=afillChannelPlan;window.afillChannelApply=afillChannelApply;window.afillPackMains=afillPackMains;
window.afillRbxCircuits=afillRbxCircuits;window.afillManualStale=afillManualStale;window.afillHash=afillHash;window.afillSceneSvg=afillSceneSvg;
