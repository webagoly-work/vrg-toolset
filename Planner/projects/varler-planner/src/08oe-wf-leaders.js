// ==========================================================================
// 08oe-wf-leaders.js — wireway rebuild (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.5 K1), WP-T3: leaders and masters
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// Q5 = A (2026-10-18): sockets follow the CLASSIC CHAIN from a leader socket — Elosztó → the first room socket → … →
// the last (08n's rule), not the engine's old star from the door. Per circuit and room:
//   leader   the socket the user clicked (📍 Vezető dugalj, d.lead), else the one nearest its feed (shown javasolt)
//   order    from the leader, always the nearest unvisited socket of that circuit in the room, measured along the
//            routable walls (rgChain's rule, 05v — on the engine's wall graph, since 05v's graph knows drawn routes only)
//   feed     the leader hangs on a door's L4 or the board — never on a szobadoboz (08n: it does crossing, room feed and
//            lamp ↔ switch, NOT socket distribution); a dedicated circuit keeps its own home run
// The chain is a SUGGESTION (dashed) like every T1 link: rögzített links are never replaced, and a re-fill keeps the chain
// because it is computed here, inside upSuggest (UP_SUGGEST).
// Masters (K1): a room with no hub and several drops gets a dashed szobadoboz suggestion at the spot with the shortest
// run to its drops plus home run; the list is ticked and placed (the E4 pattern) — nothing is placed silently.
const LD={tool:false,masters:null};
const LD_MASTER_MIN=4;

function ldZoneRun(g,zone,src,z){for(const strict of [true,false]){const r=g.run(src,{ok:i=>zone[g.N[i].room]===z,edge:e=>e.kind!=='over'&&(!strict||e.kind!=='soft')});
  if(r.dist.some((d,i)=>i!==src&&isFinite(d)))return r;}return g.run(src,{ok:i=>zone[g.N[i].room]===z,edge:e=>e.kind!=='over'});}
function ldNodeOf(R,key){return (R.net.byKey[key]||[])[0];}
// the suggestion refinement (UP_SUGGEST): socket chains from the leader socket
function ldChains(map,run,level){const R=run.R,g=R.net.g,zone=BL.network.zones(run.G,R.net),ref=id=>{const d=byId('devices',id);return d?(d.ref||d.id):id;};
  const dropBy={};R.drops.forEach(d=>dropBy[d.key]=d);
  R.C.list.forEach(c=>{if(c.kind!=='socket')return;
    const groups={};c.members.forEach(e=>{if(e.code!=='SOC'||!e.drop||!dropBy[e.drop])return;(groups[e.room]=groups[e.room]||new Map()).set(e.drop,dropBy[e.drop]);});
    Object.values(groups).forEach(gm=>{const ds=[...gm.values()];
      // the drop's head for this circuit: its member whose suggestion leaves the drop (the box feeds it first)
      const head=d=>{const ms=d.members.filter(e=>(R.C.byMember[e.id]||{}).ref===c.ref);return (ms.find(e=>{const u=map[e.id];return !u||!d.members.some(x=>x.id===u.id);})||ms[0]);};
      const z=zone[ds[0].room];
      // the leader: the clicked one, else the drop nearest its feed
      let lead=ds.find(d=>d.members.some(e=>{const l=byId('devices',e.id);return l&&l.lead&&(R.C.byMember[e.id]||{}).ref===c.ref;}));
      if(!lead)lead=ds.slice().sort((a,b)=>((a.spLen==null?1e12:a.spLen)-(b.spLen==null?1e12:b.spLen))||(a.key<b.key?-1:1))[0];
      // the leader's feed: a door's L4 or the board, never a szobadoboz (08n)
      const lh=head(lead),lu=map[lh.id],lt=lu&&byId('devices',lu.id);
      if(lt&&lt.type==='junction'&&lt.jb==='szoba'){const ln=ldNodeOf(R,lead.key);let best=null;
        R.SP.filter(s=>s.type==='portal'||s.type==='board').forEach(s=>s.faces.forEach(f=>{if(zone[f.room]!==z)return;const fi=ldNodeOf(R,f.key);if(fi==null)return;
          const r=ldZoneRun(g,zone,fi,z);if(isFinite(r.dist[ln])&&(!best||r.dist[ln]<best.d))best={d:r.dist[ln],s,f};}));
        if(best)map[lh.id]=best.s.id==='__board'?{id:(data.devices.find(x=>x&&x.type==='board'&&x.level===level)||{}).id,why:'vezető dugalj — az Elosztóból (szobadoboz nem oszt dugaljat)'}
          :{id:best.s.id,room:best.f.room,why:'vezető dugalj — az ajtó L4 dobozából (szobadoboz nem oszt dugaljat)'};}
      if(map[lh.id])map[lh.id].why=(map[lh.id].why||'')+(map[lh.id].why&&/vezető/.test(map[lh.id].why)?'':' · vezető dugalj');
      if(ds.length<2)return;
      // the order: nearest unvisited along the walls
      let cur=lead;const rest=ds.filter(d=>d!==lead);
      while(rest.length){const r=ldZoneRun(g,zone,ldNodeOf(R,cur.key),z);let k=-1,bd=Infinity;
        rest.forEach((d,i)=>{const v=r.dist[ldNodeOf(R,d.key)];if(isFinite(v)&&(v<bd-1e-9||(Math.abs(v-bd)<=1e-9&&k>=0&&d.key<rest[k].key))){bd=v;k=i;}});
        if(k<0)break;const nx=rest.splice(k,1)[0];map[head(nx).id]={id:head(cur).id,why:'klasszikus lánc a vezető dugaljtól ('+ref(lh.id)+')'};cur=nx;}});});}
UP_SUGGEST.push(ldChains);

// ---- 📍 the leader socket: one click ----------------------------------------------------------------------------------
function ldRoomOf(d){return typeof upRoomOfDev==='function'?upRoomOfDev(d):null;}
// toggle d.lead; one leader per circuit and room. Then the suggestions are refilled (the chain follows at once).
function ldSetLeader(id,on){const d=byId('devices',id);if(!d||epCodeOf(d)!=='SOC')return {err:'Vezető csak dugalj lehet.'};const c=cktOfDevice(d);
  if(!c)return {err:(d.ref||d.id)+': nincs áramkörben — előbb a kör (Elosztó → körök).'};
  pushUndo(['devices']);const rid=ldRoomOf(d);on=on==null?!d.lead:!!on;
  data.devices.forEach(x=>{if(x&&x!==d&&x.lead&&cktOfDevice(x)===c&&ldRoomOf(x)===rid)delete x.lead;});
  if(on)d.lead=true;else delete d.lead;
  const f=typeof upFill==='function'?upFill(d.level,{noUndo:true}):null;UP.view=true;draw();
  return {ok:true,lead:on,chain:f&&!f.err?f.set:0};}
function ldToolStart(){toolsOff();if(state.mode!=='select')setMode('select');LD.tool=true;UP.view=true;
  const mh=$('modeHint');if(mh)mh.textContent='Vezető dugalj — kattints egy dugaljra: a köre ebben a helyiségben tőle indul, láncban · újra kattintva leveszed · Esc: kész';draw();}
function ldToolOff(){LD.tool=false;const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';}
STK_TOOLS.push({k:'ldTool',active:()=>{if(!LD.tool)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){ldToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const [bx,by]=clientToBase(e),C=typeof hitCands==='function'?hitCands(e,bx,by):[];
    const c=C.find(c=>c.h&&c.h.t==='devices'&&epCodeOf(data.devices[c.h.i])==='SOC'),d=c?data.devices[c.h.i]:null;
    if(!d){$('hud').textContent='Kattints egy dugaljra.';return true;}
    const r=ldSetLeader(d.id);$('hud').textContent=r.err||((d.ref||d.id)+(r.lead?' a vezető dugalj — a lánc tőle indul':' már nem vezető')+' · '+r.chain+' javaslat');return true;},
  esc(){ldToolOff();draw();},mode(){ldToolOff();}});

// ---- masters: a szobadoboz suggestion per room ------------------------------------------------------------------------
// → [{room, name, x, y, side, wall, drops, m}] — rooms with no hub (szobadoboz / RBX / BASE) and ≥ LD_MASTER_MIN drops
function ldMasters(level,run){level=level||state.active;run=run||blRun(level);if(run.err)return {err:run.err};
  const R=run.R,g=R.net.g,G=run.G,zone=BL.network.zones(G,R.net);
  const hub=new Set();R.SP.filter(s=>s.type==='szoba'||s.type==='rbx'||s.type==='base').forEach(s=>s.faces.forEach(f=>hub.add(f.room)));
  const bi=ldNodeOf(R,'board'),TB=g.run(bi,{edge:e=>e.kind!=='soft'&&e.kind!=='floor'&&e.kind!=='over'});
  const byRoom={};R.drops.forEach(d=>{if(d.members.some(e=>R.C.byMember[e.id]))(byRoom[d.room]=byRoom[d.room]||[]).push(d);});
  // pre-ticked only where a door box overfills (F7, the funnel a master removes); the rest is offered unticked
  const busy=new Set(((R.report&&R.report.fill)||[]).filter(f=>f.total>6).map(f=>f.room));
  const out=[];Object.entries(byRoom).forEach(([rid,ds])=>{if(hub.has(rid)||ds.length<LD_MASTER_MIN)return;const z=zone[rid];
    const runs=ds.map(d=>ldZoneRun(g,zone,ldNodeOf(R,d.key),z));
    let best=null;(R.net.roomNodes[rid]||[]).forEach(i=>{if(!g.adj[i].some(e=>e.kind==='face'))return;if(!isFinite(TB.dist[i]))return;
      let s=TB.dist[i];for(const r of runs){if(!isFinite(r.dist[i])){s=Infinity;break;}s+=r.dist[i];}
      if(isFinite(s)&&(!best||s<best.s))best={i,s};});
    if(!best)return;const n=g.N[best.i],room=G.rooms.find(r=>r.id===rid),f=BL.network.sToPt(room,n.s).face,w=f&&f.wall&&G.wallById[f.wall];if(!w)return;
    const X=w.axis==='x',cx=X?n.x:(w.x0+w.x1)/2,cy=X?(w.y0+w.y1)/2:n.y,side=(X?Math.sign(n.y-cy):Math.sign(n.x-cx))>0?1:0;
    out.push({room:rid,name:(room&&room.name)||rid,x:Math.round(cx),y:Math.round(cy),side,wall:w.id,drops:ds.length,m:Math.round(best.s/100)/10,on:busy.has(rid),funnel:busy.has(rid)});});
  LD.masters={level,list:out};return {list:out,run};}
function ldPlaceMasters(list,level){level=level||state.active;const pick=(list||[]).filter(m=>m.on!==false);if(!pick.length)return {placed:0};
  pushUndo(['devices']);const made=pick.map(m=>jbMake('szoba',{level,x:m.x,y:m.y,h:JB_H.szoba,side:m.side}));
  if(typeof jbResize==='function')jbResize();const f=typeof upFill==='function'?upFill(level,{noUndo:true}):null;LD.masters=null;UP.view=true;draw();
  return {placed:made.length,ids:made.map(d=>d.id),links:f&&!f.err?f.set:0};}
function ldMastersDialog(){const r=ldMasters(state.active);if(r.err){$('hud').textContent=r.err;return null;}const L=r.list;
  openModal('Szobadoboz-javaslat (mester)',L.length?`<div style="font-size:12px">Helyiségek szobadoboz nélkül, legalább ${LD_MASTER_MIN} leállással. A javasolt hely: a legrövidebb út a leállásokig és az Elosztóig (vezethető falon). Pipáld ki, amit lerakjak — utána a betáp-fa újra javasol.</div>`
    +L.map((m,k)=>`<label style="display:block;font-size:12px;margin-top:4px"><input type="checkbox" data-ldm="${k}"${m.on?' checked':''}> <b>${esc(m.name)}</b> (${esc(m.room)}) — ${m.drops} leállás · ${String(m.m).replace('.',',')} m · ${esc(m.wall)} fal${m.funnel?' · <span style="color:var(--pc-warn,#8a5a00)">túltelt ajtódoboz</span>':''}${blShowLink({at:[m.x,m.y]},state.active)}</label>`).join('')
    :`<div style="font-size:12px">Nincs javaslat: minden helyiségnek van szobadoboza / RBX-e, vagy kevesebb mint ${LD_MASTER_MIN} leállása van.</div>`,()=>{
      document.querySelectorAll('[data-ldm]').forEach(cb=>{L[+cb.dataset.ldm].on=cb.checked;});const p=ldPlaceMasters(L,state.active);
      $('hud').textContent='Szobadoboz: '+p.placed+' lerakva'+(p.placed?' · betáp-fa: '+p.links+' javaslat':'');},L.length?'Lerakom':'Rendben');return r;}
// the suggestions drawn as dashed squares while the betáp-fa is shown
STK_OVERLAY.push(()=>{const M=LD.masters;if(!M||M.level!==state.active||!(UP.view||UP.tool||LD.tool))return '';const z=dz(state.active,JB_H.szoba);let s='';
  M.list.forEach(m=>{const b=planToBase(m.x,m.y,z),r=vsP(9);s+=`<rect x="${(b[0]-r).toFixed(1)}" y="${(b[1]-r).toFixed(1)}" width="${(2*r).toFixed(1)}" height="${(2*r).toFixed(1)}" fill="none" stroke="#7a6a55" stroke-width="${vsP(1.2)}" stroke-dasharray="${vsDash('3 2')}"/>`;});
  return s?`<g pointer-events="none">${s}</g>`:'';});
// the leader is marked with a small flag ring
STK_OVERLAY.push(()=>{if(!(UP.view||UP.tool||LD.tool))return '';const lvl=state.active;let s='';
  data.devices.forEach(d=>{if(!d||!d.lead||d.level!==lvl)return;const b=planToBase(d.x,d.y,dz(lvl,d.h||0));s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(9)}" fill="none" stroke="#e8641c" stroke-width="${vsP(1.6)}"/>`;});
  return s?`<g pointer-events="none">${s}</g>`:'';});

STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d||epCodeOf(d)!=='SOC'||!cktOfDevice(d))return;
  items.push({label:(d.lead?'📍 Vezető dugalj — levétel':'📍 Vezető dugalj: a köre innen indul, láncban'),act:()=>{const r=ldSetLeader(d.id);$('hud').textContent=r.err||((d.ref||d.id)+(r.lead?' a vezető dugalj':' már nem vezető'));}});});
registerActions([
 {id:'ld.tool',label:'Vezető dugalj',icon:'📍',group:'Pálya',alias:'leader socket vezeto dugalj lanc chain',hint:'Kattints egy dugaljra: a köre ebben a helyiségben tőle indul, klasszikus láncban (Q5 = A).',when:c=>!c.inEditor,run:()=>ldToolStart()},
 {id:'ld.masters',label:'Szobadoboz-javaslat',icon:'▣',group:'Pálya',alias:'master room box suggestion szobadoboz javaslat mester',hint:'Helyiségenként egy javasolt szobadoboz-hely; kipipálod, és lerakja.',when:c=>!c.inEditor,run:()=>ldMastersDialog()}]);
window.ldSetLeader=ldSetLeader;window.ldMasters=ldMasters;window.ldPlaceMasters=ldPlaceMasters;window.LD=LD;
