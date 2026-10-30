// ==========================================================================
// 05q-rf.js — radio coverage of a BRIDGE Stack (WP-C3)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A simplified COST-231 multi-wall model [Q23=B]: path loss grows with distance AND with every wall crossed;
// the loss of a wall comes from its material tag on the Marking layer (05n), else from its thickness.
//   PL(d) = 10·pe·log10(d) + f·Σ wall loss            (d in m, min 0.5)
//   covered when PL ≤ 10·pe·log10(R0)                  (R0 = the free-space range; the PL at 1 m cancels out)
// Every number is a typical indoor figure — reasoned, not measured — and editable in the RF settings.
// Coverage is DERIVED and memoised against a basis string (sources, walls, wall tags, settings). Prefix: rf.

const RF_TECH=[
 {k:'wifi',  n:'WiFi 2,4 GHz',   c:'#3b82c4', R0:20, pe:2.2, f:1.0,  src:['acp']},
 {k:'wifi5', n:'WiFi 5 GHz',     c:'#2a5f99', R0:12, pe:2.4, f:1.6,  src:['acp'], off:true},
 {k:'thread',n:'Thread (ch 20)', c:'#3fa36b', R0:15, pe:2.3, f:1.0,  src:['rbx']},   // STD-005 channel plan
 {k:'zigbee',n:'Zigbee (ch 25)', c:'#7aa63a', R0:15, pe:2.3, f:1.0,  src:['rbx'], off:true},
 {k:'ble',   n:'BLE',            c:'#8a63c2', R0:10, pe:2.2, f:1.0,  src:['rbx']},
 {k:'uwb',   n:'UWB',            c:'#c2638a', R0:10, pe:2.0, f:1.5,  src:['rbx']},   // NLOS hurts ranging: walls ×1.5
 {k:'espnow',n:'ESP-NOW (ch 1)', c:'#c28a3b', R0:20, pe:2.2, f:1.0,  src:['rbx','base']},
 {k:'lora',  n:'LoRa 868 MHz',   c:'#8a8a8a', R0:80, pe:2.0, f:0.6,  src:['base'], off:true}]; // STD-005: BASE-only (1 % duty)
const RF_GRID=500;                                 // mm — the same grid as the portal encoding (05o)
const RF_RBX_RADIOS=['thread','ble','espnow'];     // a new RBX; UWB is added in key rooms (STD-005 / U23)

function rfTech(k){return RF_TECH.find(t=>t.k===k)||null;}
// the settings: state.rf = {on:{tech:bool}, R0:{tech:m}} — defaults from RF_TECH
function rfOn(k){const s=state.rf&&state.rf.on;if(s&&k in s)return !!s[k];const t=rfTech(k);return !!t&&!t.off;}
function rfR0(k){const s=state.rf&&state.rf.R0,t=rfTech(k);return (s&&+s[k]>0)?+s[k]:(t?t.R0:10);}

// ---- the model (pure) -------------------------------------------------------------------------------------------
// dB at 2.4 GHz: the largest rf of the wall's material tags, else by thickness
function rfWallLoss(r){let v=null;
  if(typeof mrkWallTags==='function'&&r&&r.id)mrkWallTags(r.id).forEach(k=>{const t=mrkTag('wall',k);if(t&&t.rf!=null)v=Math.max(v==null?0:v,t.rf);});
  if(v!=null)return v;
  const th=wallInfo(r).thick;return th>=250?12:th>=120?8:4;}
// Liang–Barsky: does the segment a→b pass through the rectangle?
function rfSegRect(ax,ay,bx,by,r){let t0=0,t1=1;const dx=bx-ax,dy=by-ay;
  const x0=Math.min(r.x0,r.x1),x1=Math.max(r.x0,r.x1),y0=Math.min(r.y0,r.y1),y1=Math.max(r.y0,r.y1);
  const p=[-dx,dx,-dy,dy],q=[ax-x0,x1-ax,ay-y0,y1-ay];
  for(let i=0;i<4;i++){if(p[i]===0){if(q[i]<0)return false;}else{const t=q[i]/p[i];if(p[i]<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}}}
  return t1>t0;}
function rfInRect(x,y,r,pad){return x>=Math.min(r.x0,r.x1)-pad&&x<=Math.max(r.x0,r.x1)+pad&&y>=Math.min(r.y0,r.y1)-pad&&y<=Math.max(r.y0,r.y1)+pad;}
// the walls a ray crosses; the wall a source is mounted IN does not count (the source sits inside or on its rect)
function rfSegWalls(level,ax,ay,bx,by){return (WALLS[level]||[]).filter(r=>r&&!rfInRect(ax,ay,r,2)&&rfSegRect(ax,ay,bx,by,r));}
// the radios: RoomBoxes carrying the tech, access points (D1 end points coded ACP), BASE devices
function rfSources(level,tech,only){const t=rfTech(tech);if(!t)return [];const out=[];
  (only||data.devices).forEach(d=>{if(!d||d.level!==level)return;
    let ok=false;
    if(d.type==='rbx'&&t.src.indexOf('rbx')>=0)ok=(d.radios||RF_RBX_RADIOS).indexOf(tech)>=0;
    else if(d.type==='ep'&&d.code==='ACP'&&t.src.indexOf('acp')>=0)ok=true;
    else if(d.type==='base'&&t.src.indexOf('base')>=0)ok=true;
    if(ok){const F=(typeof hwFrame==='function'&&d.type!=='ep')?hwFrame(d):null;
      // a wall box radiates from just in front of its face, so its own wall is not counted
      const x=F&&F.n?F.cx+F.n[0]*(F.S.dp/2+20):d.x,y=F&&F.n?F.cy+F.n[1]*(F.S.dp/2+20):d.y;
      out.push({id:d.id,x,y,dev:d});}});
  return out;}
// margin in dB (≥ 0 = covered) at plan point x,y from one source
function rfMargin(src,x,y,tech){const T=rfTech(tech),level=src.dev?src.dev.level:state.active;
  const d=Math.max(0.5,Math.hypot(x-src.x,y-src.y)/1000);
  let wl=0;rfSegWalls(level,src.x,src.y,x,y).forEach(r=>{wl+=rfWallLoss(r);});
  return 10*T.pe*Math.log10(rfR0(tech))-(10*T.pe*Math.log10(d)+T.f*wl);}
// the cells of the level that lie inside some room
function rfCells(level){const g=RF_GRID,seen=new Set(),out=[];
  allRooms(level).forEach(e=>{prtGrid(e.rm.poly,g).forEach(c=>{const k=c.i+','+c.j;if(!seen.has(k)){seen.add(k);out.push(c);}});});
  return out;}
// best margin over the sources per cell; uncovered cells (m < 0) omitted. Memoised on a basis string.
const RF_MEMO={};
function rfBasis(level,tech,srcs){
  let s=tech+'|'+rfR0(tech)+'|'+srcs.map(q=>q.id+':'+Math.round(q.x)+','+Math.round(q.y)).join(';')+'|';
  (WALLS[level]||[]).forEach(r=>{s+=(r.id||'')+':'+r.x0+','+r.y0+','+r.x1+','+r.y1+':'+(typeof mrkWallTags==='function'&&r.id?mrkWallTags(r.id).join(','):'')+';';});
  allRooms(level).forEach(e=>{s+=JSON.stringify(e.rm.poly);});
  return s;}
function rfGrid(level,tech,only){const srcs=rfSources(level,tech,only),key=level+'|'+tech+(only?'|'+only.map(d=>d.id).join(','):'');
  const basis=rfBasis(level,tech,srcs),m=RF_MEMO[key];if(m&&m.basis===basis)return m.res;
  const g=RF_GRID,cells=[];
  if(srcs.length)rfCells(level).forEach(c=>{const x=(c.i+0.5)*g,y=(c.j+0.5)*g;let best=-1e9;
    srcs.forEach(q=>{const v=rfMargin(q,x,y,tech);if(v>best)best=v;});
    if(best>=0)cells.push({i:c.i,j:c.j,m:Math.round(best*10)/10});});
  const res={tech,level,grid:g,cells};RF_MEMO[key]={basis,res};return res;}
// share 0…1 of the room's cells that are covered
function rfRoomCover(roomId,tech){const e=mrkRoomById(roomId);if(!e)return 0;
  const all=prtGrid(e.rm.poly,RF_GRID);if(!all.length)return 0;
  const cov=new Set(rfGrid(e.level,tech).cells.map(c=>c.i+','+c.j));
  return all.filter(c=>cov.has(c.i+','+c.j)).length/all.length;}

// ---- the view -----------------------------------------------------------------------------------------------------------
// pale squares, tint by margin, a faint outline where a covered cell meets an uncovered one. `only` restricts the
// sources (the RBX ghost of C2); otherwise every shown tech of the active level.
function rfCoverageSvg(only){const level=only&&only[0]?only[0].level:state.active,z=dz(level,0),g=RF_GRID;let s='';
  RF_TECH.forEach(T=>{if(!rfOn(T.k))return;const G=rfGrid(level,T.k,only);if(!G.cells.length)return;
    const has=new Set(G.cells.map(c=>c.i+','+c.j));
    G.cells.forEach(c=>{const op=(0.05+0.10*Math.min(1,c.m/10)).toFixed(3);
      s+=`<polygon points="${p2b([[c.i*g,c.j*g,z],[(c.i+1)*g,c.j*g,z],[(c.i+1)*g,(c.j+1)*g,z],[c.i*g,(c.j+1)*g,z]])}" fill="${T.c}" fill-opacity="${op}" stroke="none"/>`;
      [[1,0,[c.i+1,c.j],[c.i+1,c.j+1]],[-1,0,[c.i,c.j],[c.i,c.j+1]],[0,1,[c.i,c.j+1],[c.i+1,c.j+1]],[0,-1,[c.i,c.j],[c.i+1,c.j]]].forEach(([di,dj,a,b])=>{
        if(!has.has((c.i+di)+','+(c.j+dj)))s+=`<polyline points="${p2b([[a[0]*g,a[1]*g,z],[b[0]*g,b[1]*g,z]])}" fill="none" stroke="${T.c}" stroke-opacity="0.35" stroke-width="${vsP(0.6)}"/>`;});});});
  return s;}
function rfStageOn(){if(state.rfShow)return true;
  const S=(typeof stkActive==='function')?stkActive():null,L=S?lyrLayer(state.activeLayer):null;return !!(L&&L.stack===S.id&&L.role==='sys:RF');}
STK_OVERLAY.push(()=>rfStageOn()?`<g pointer-events="none">`+rfCoverageSvg()+`</g>`:'');

// ---- settings and radios ------------------------------------------------------------------------------------------------------
function rfSettingsDialog(){
  openModal('Rádiós beállítások',
    `<table style="font-size:12px;width:100%"><tr><th align="left">Technológia</th><th>Mutat</th><th>R0 (m)</th></tr>`
    +RF_TECH.map(T=>`<tr><td><span style="color:${T.c}">■</span> ${esc(T.n)}</td><td align="center"><input type="checkbox" class="rfOn" data-k="${T.k}" ${rfOn(T.k)?'checked':''}></td>`
      +`<td align="center"><input type="number" class="rfR0" data-k="${T.k}" value="${rfR0(T.k)}" style="width:60px" min="1"></td></tr>`).join('')+`</table>`
    +`<div class="mrow" style="font-size:11px;color:var(--pc-mute,#888)">Tipikus beltéri értékek — nem mért. A falcsillapítás a Jelölés réteg falcímkéiből jön (tartófal 15 dB, gipszkarton 3 dB…), címke nélkül a falvastagságból.</div>`,
    ()=>{const on={},R0={};document.querySelectorAll('.rfOn').forEach(c=>{on[c.dataset.k]=c.checked;});
      document.querySelectorAll('.rfR0').forEach(i=>{const v=+i.value;if(v>0&&v!==rfTech(i.dataset.k).R0)R0[i.dataset.k]=v;});
      state.rf={on,R0};draw();});}
function rfRadiosDialog(d){if(!d||d.type!=='rbx')return;const cur=d.radios||RF_RBX_RADIOS;
  openModal('RBX rádiói — '+(d.ref||d.id),RF_TECH.filter(T=>T.src.indexOf('rbx')>=0).map(T=>
    `<div class="mrow"><label><input type="checkbox" class="rfRad" value="${T.k}" ${cur.indexOf(T.k)>=0?'checked':''}> <span style="color:${T.c}">■</span> ${esc(T.n)}</label></div>`).join(''),
    ()=>{pushUndo(['devices']);d.radios=[...document.querySelectorAll('.rfRad')].filter(c=>c.checked).map(c=>c.value);draw();});}

// ---- checks -----------------------------------------------------------------------------------------------------------------------
// per room, per RF need ticked in D2 (rm.needs['sys:RF']); until D2 exists: wifi and thread everywhere
(STK_CHECKS['sys:RF']=STK_CHECKS['sys:RF']||[]).push(S=>{const out=[];
  ORD.forEach(l=>{if(!rfSources(l,'thread').length&&!rfSources(l,'wifi').length)return;
    stkRooms(l).forEach(r=>{if(!r.id)return;
      const want=(typeof needOf==='function')?Object.keys(needOf(r.rm,'sys:RF')).filter(k=>needOf(r.rm,'sys:RF')[k]):['wifi','thread'];
      want.forEach(k=>{if(!rfTech(k))return;const c=rfRoomCover(r.id,k);
        if(c<0.9)out.push({sev:'warn',msg:((r.num?r.num+' ':'')+(r.name||r.id))+': '+rfTech(k).n+' lefedettség '+Math.round(c*100)+' %'});});});});
  return out;});

registerActions([
 {id:'rf.view',alias:'radio lefedettseg rf coverage wifi thread view',label:'Rádió-lefedettség mutatása',icon:'📶',group:'Rádió',
  hint:'Halvány zónák az RBX-ektől és hozzáférési pontoktól; a Rádió szakaszban magától bekapcsol.',
  run:()=>{state.rfShow=!state.rfShow;draw();lyrHud('Rádió-lefedettség '+(state.rfShow?'be':'ki'));}},
 {id:'rf.settings',alias:'radios beallitasok rf settings range',label:'Rádiós beállítások…',icon:'📡',group:'Rádió',run:()=>rfSettingsDialog()}
]);
// the RF stage gets the radio actions too
(STK_GROUPS['+sys:RF']=STK_GROUPS['+sys:RF']||[]).push('Rádió');

// test hooks
window.RF_TECH=RF_TECH;window.RF_GRID=RF_GRID;window.RF_RBX_RADIOS=RF_RBX_RADIOS;
window.rfWallLoss=rfWallLoss;window.rfSegRect=rfSegRect;window.rfSegWalls=rfSegWalls;window.rfSources=rfSources;window.rfMargin=rfMargin;
window.rfGrid=rfGrid;window.rfRoomCover=rfRoomCover;window.rfCoverageSvg=rfCoverageSvg;window.rfOn=rfOn;window.rfR0=rfR0;window.rfRadiosDialog=rfRadiosDialog;
