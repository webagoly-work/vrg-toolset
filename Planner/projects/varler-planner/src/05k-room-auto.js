// ==========================================================================
// 05k-room-auto.js — room-wide automation of the Wall View commands
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// What the Wall View does one box at a time (⛓ Doboz csatolása szomszédhoz), done for a whole
// room — or every room — in one click, with a preview first.
//
// SOROLÁS (auto-clip): boxes placed next to each other on one wall face become one clip group at
// the standard pitch (DEV_CLIP_SPACING, 72 mm), exactly as the manual clip would leave them.
// A row is: same room, same wall, same face, same layer, same height (±30 mm), same type unless
// asked otherwise, neighbours no further apart than the gap setting. A row keeps its centre;
// the boxes close up around it in their original order.
//
// Path nodes follow the boxes they sit on. A node LINKED to a box moves with it; an unlinked node
// within AUTOCLIP_NODE_TOL of a box in plan moves too, because in practice a route is drawn with a
// node on each box it touches (typically at ceiling height, straight above it). Nodes move in plan
// only — their height is never changed, so a ceiling route stays at the ceiling.
//
// PÁLYA-KÖTÉS (auto-link) is further down: route nodes sitting on a box become links of that box.
var AUTOCLIP_GAP=180,AUTOCLIP_DH=30,AUTOCLIP_NODE_TOL=25,AUTOCLIP_MAX=5;
function autoClipEligible(d){return !!d&&(d.type==='socket'||d.type==='switch'||d.type==='box')&&d.side!=null;}

// {rows:[{entry, room, type, idx:[device index…], moves:[{i,from,to,dist}], nodes:[{p,n,dx,dy}],
//         gid, kind:'new'|'extend'|'repitch', maxMove}], ok, warn:[…]}
function planAutoClip(entries,opt){opt=opt||{};
  const gap=+opt.gap>0?+opt.gap:AUTOCLIP_GAP,same=opt.sameType!==false,withNodes=opt.nodes!==false;
  const rows=[],warn=[];let ok=0;
  (entries||[]).forEach(entry=>{if(!entry)return;
    // bucket the room's wall boxes by wall + face + layer (+ type)
    const buckets={};
    roomMembers(entry).forEach(i=>{const d=data.devices[i];if(!autoClipEligible(d))return;
      const hw=deviceHostWall(d);if(!hw||!hw.r)return;
      const r=hw.r,wid=r.id||[r.x0,r.y0,r.x1,r.y1].join(',');
      const face=(hw.nx+hw.ny)>0?1:-1,u=hw.wi.horiz?hw.px:hw.py;
      const key=[wid,face,d.layer||'L0',same?d.type:'*'].join('|');
      (buckets[key]=buckets[key]||[]).push({i,d,u,hw,h:d.h||0});});
    Object.values(buckets).forEach(list=>{
      // height bands first (a switch row above a socket row is two rows), then gaps along the wall
      list.sort((a,b)=>a.h-b.h);const bands=[];
      list.forEach(it=>{const b=bands[bands.length-1];if(b&&it.h-b[b.length-1].h<=AUTOCLIP_DH)b.push(it);else bands.push([it]);});
      bands.forEach(band=>{band.sort((a,b)=>a.u-b.u);let cur=[];
        const flush=()=>{if(cur.length<2)return;
          if(cur.length>AUTOCLIP_MAX)warn.push(roomLabel(entry.rm)+': '+cur.length+' doboz egy sorban — '+AUTOCLIP_MAX+'-ös csoportokra bontva.');
          for(let s=0;s<cur.length;s+=AUTOCLIP_MAX){const part=cur.slice(s,s+AUTOCLIP_MAX);
            if(part.length<2)continue;
            const row=planClipRow(entry,part,withNodes);if(row)rows.push(row);else ok++;}};
        band.forEach(it=>{if(cur.length&&it.u-cur[cur.length-1].u>gap){flush();cur=[];}cur.push(it);});
        flush();});});});
  return {rows,ok,warn};}

// one row → where each box goes; null when the row is already a clean clip group
function planClipRow(entry,items,withNodes){
  const ref=items.slice().sort((a,b)=>idNum(a.d.id)-idNum(b.d.id))[0];     // the box placed first sets height and face offset
  const ox=ref.d.x-ref.hw.px,oy=ref.d.y-ref.hw.py,horiz=ref.hw.wi.horiz;
  const uc=items.reduce((s,it)=>s+it.u,0)/items.length,n=items.length;
  const moves=items.map((it,k)=>{const u=uc+(k-(n-1)/2)*DEV_CLIP_SPACING;
    const to={x:Math.round(horiz?u:ref.hw.px+ox),y:Math.round(horiz?ref.hw.py+oy:u),h:ref.h};
    const from={x:it.d.x,y:it.d.y,h:it.h};
    return {i:it.i,from,to,dist:Math.hypot(to.x-from.x,to.y-from.y,to.h-from.h)};});
  const maxMove=Math.max(...moves.map(m=>m.dist));
  // clip groups already present among these boxes
  const gids=[...new Set(items.map(it=>it.d.clip).filter(Boolean))];
  const groupSize=g=>data.devices.filter(d=>d.clip===g).length;
  const whole=gids.length===1&&groupSize(gids[0])===n&&items.every(it=>it.d.clip===gids[0]);
  if(whole&&maxMove<1)return null;
  const kind=whole?'repitch':gids.length?'extend':'new';
  // path nodes sitting on a box that moves
  const nodes=[];
  if(withNodes){const seen=new Set();
    moves.forEach(m=>{if(m.dist<0.5)return;const d=data.devices[m.i],dx=m.to.x-m.from.x,dy=m.to.y-m.from.y;
      linkTargets(d).forEach(lk=>{const key=lk.path.id+'/'+lk.node.id;if(!seen.has(key)){seen.add(key);nodes.push({p:lk.path.id,n:lk.node.id,dx,dy});}});
      data.paths.forEach(pa=>(pa.nodes||[]).forEach(nd=>{if(nd.level!==d.level)return;
        if(Math.hypot(nd.x-m.from.x,nd.y-m.from.y)>AUTOCLIP_NODE_TOL)return;
        const key=pa.id+'/'+nd.id;if(seen.has(key))return;seen.add(key);nodes.push({p:pa.id,n:nd.id,dx,dy});}));});}
  return {entry,room:roomLabel(entry.rm),type:items[0].d.type,idx:items.map(it=>it.i),moves,nodes,
    gid:(whole||gids.length===1&&items.filter(it=>it.d.clip===gids[0]).length===groupSize(gids[0]))?gids[0]:null,
    kind,maxMove};}

// Apply the chosen rows as one undo step; returns how many rows were clipped.
function applyAutoClip(rows){rows=(rows||[]).filter(Boolean);if(!rows.length)return 0;
  pushUndo(['devices','paths']);ensureIds(data);
  const stamp=Date.now().toString(36);
  rows.forEach((row,k)=>{const gid=row.gid||('clip'+stamp+'_'+k);
    row.moves.forEach(m=>{const d=data.devices[m.i];if(!d)return;d.x=m.to.x;d.y=m.to.y;d.h=m.to.h;d.clip=gid;});
    row.nodes.forEach(q=>{const nd=nodeById(q.p,q.n);if(nd){nd.x+=q.dx;nd.y+=q.dy;}});});   // plan only, never the height
  // a group left with a single box (its partners joined another row) is dissolved, as wvUnclip would
  const count={};data.devices.forEach(d=>{if(d.clip)count[d.clip]=(count[d.clip]||0)+1;});
  data.devices.forEach(d=>{if(d.clip&&count[d.clip]<2)delete d.clip;});
  draw();return rows.length;}

// ---- dialog: preview, tick the rows, apply ----
const AUTOCLIP_KIND={new:'új csoport',extend:'bővítés',repitch:'72 mm-re igazítás'};
function autoClipDialog(entries,title){entries=(entries||[]).filter(Boolean);if(!entries.length)return;
  let plan=null;
  openModal(esc(title||('Sorolás — '+roomLabel(entries[0].rm))),
    `<div class="mrow" style="font-size:12px">Szomszéd, ha a középpontok távolsága ≤ <input id="acGap" type="number" step="10" min="72" value="${state.autoClipGap||AUTOCLIP_GAP}" style="width:66px"> mm</div>`
   +`<div class="mrow" style="font-size:12px"><label><input type="checkbox" id="acSame" checked> csak azonos típus (aljzat az aljzattal)</label></div>`
   +`<div class="mrow" style="font-size:12px"><label><input type="checkbox" id="acNodes" checked> a dobozon ülő pálya-csomópontok is mozognak (magasságuk marad)</label></div>`
   +`<div id="acPrev" style="max-height:320px;overflow:auto;font-size:12px;border-top:1px solid #eee;padding-top:4px"></div>`,
    ()=>{const pick=[...document.querySelectorAll('#acPrev input[data-row]')].filter(c=>c.checked).map(c=>plan.rows[+c.dataset.row]);
      if(!pick.length)return false;
      state.autoClipGap=+$('acGap').value||AUTOCLIP_GAP;
      const n=applyAutoClip(pick);
      $('hud').textContent='Sorolás: '+n+' sor csatolva '+DEV_CLIP_SPACING+' mm-es osztással.';},'Sorolás');
  const run=()=>{plan=planAutoClip(entries,{gap:+$('acGap').value,sameType:$('acSame').checked,nodes:$('acNodes').checked});
    const many=entries.length>1;
    $('acPrev').innerHTML=(plan.rows.length?plan.rows.map((r,k)=>
        `<label style="display:flex;gap:6px;align-items:flex-start;padding:3px 0;border-bottom:1px solid #f2efe8">`
        +`<input type="checkbox" data-row="${k}" checked style="margin-top:2px"><span style="flex:1">`
        +(many?`<b>${esc(r.room)}</b> · `:'')+`${esc(DEV[r.type]||r.type)} × ${r.idx.length}: `
        +esc(r.idx.map(i=>data.devices[i].ref||data.devices[i].id).join(' · '))
        +`<br><span style="color:#8a8478">${esc(AUTOCLIP_KIND[r.kind])} · max. elmozdulás ${Math.round(r.maxMove)} mm`
        +(r.nodes.length?` · ${r.nodes.length} csomópont követi`:'')+`</span></span></label>`).join('')
       :`<div style="color:#8a8478;padding:4px 0">Nincs egymás melletti doboz ${esc(String(+$('acGap').value))} mm-en belül.</div>`)
      +(plan.ok?`<div style="color:#3a7d44;padding:4px 0">✔ ${plan.ok} sor már szabályosan csatolva.</div>`:'')
      +plan.warn.map(m=>`<div style="color:#c0530f;padding:2px 0">⚠ ${esc(m)}</div>`).join('');};
  ['acGap','acSame','acNodes'].forEach(id=>{$(id).oninput=run;$(id).onchange=run;});
  run();}
function allRoomEntries(){const out=[];ORD.forEach(l=>allRooms(l).forEach(e=>out.push(e)));return out;}

// ---- PÁLYA-KÖTÉS (auto-link): every route node that sits on a box becomes a link of that box ----
// "Sits on" is decided in PLAN, within AUTOLINK_TOL: a route is drawn with a node on each box it
// touches, usually at ceiling height straight above it, so heights differ by metres and are ignored.
// Nothing moves — neither node nor box. The links are plan-only (no glue), so the node never gets
// pulled down to the box's height later.
// Links live on the device but point at one layer's routes, so each routing proposal (layer) is
// linked on its own, and re-linking a layer replaces only that layer's auto-links. Glued links made
// by hand in the Wall View are never touched.
// Height still decides between boxes stacked on one plan point (KD 2500 / K 1300 / D 300 on one
// drop): a node drawn at a box's height (±AUTOLINK_HTOL) is on THAT box; a ceiling node over a stack
// is offered with the box nearest in height pre-selected; two boxes at the same height — usually the
// same box on two layouts — are shown as a tie.
var AUTOLINK_TOL=25,AUTOLINK_HTOL=150;
function devLayerOn(L){return L.visible!==false&&(L.cats||{}).device!==false;}
function autoLinkEligible(d,devLayers){if(!d||d.type==='board')return false;
  return devLayers?devLayers.indexOf(d.layer||'L0')>=0:layerShows(d,'device');}
// device layers with linkable boxes in these rooms
function deviceLayersIn(entries){const n={};
  (entries||[]).forEach(e=>roomMembers(e).forEach(i=>{const d=data.devices[i];if(d&&d.type!=='board'){const k=d.layer||'L0';n[k]=(n[k]||0)+1;}}));
  return layers.filter(L=>n[L.id]).map(L=>({id:L.id,name:L.name,on:devLayerOn(L),devices:n[L.id]}));}
function entryLevels(entries){return [...new Set((entries||[]).map(e=>e.level))];}
// the layers that carry routes on these levels, with how many
function routeLayers(levels){const n={};
  data.paths.forEach(p=>{if((p.nodes||[]).some(q=>levels.indexOf(q.level)>=0)){const k=p.layer||'L0';n[k]=(n[k]||0)+1;}});
  return layers.filter(L=>n[L.id]).map(L=>({id:L.id,name:L.name,visible:L.visible!==false,paths:n[L.id]}));}
function planAutoLink(entries,opt){opt=opt||{};entries=(entries||[]).filter(Boolean);
  const tol=+opt.tol>0?+opt.tol:AUTOLINK_TOL,replace=opt.replace!==false;
  const lids=opt.layers||routeLayers(entryLevels(entries)).filter(L=>L.visible).map(L=>L.id);
  const paths=data.paths.filter(p=>lids.indexOf(p.layer||'L0')>=0),pathIds=new Set(paths.map(p=>p.id));
  const devLayers=opt.devLayers||null;
  const devs=[];entries.forEach(e=>roomMembers(e).forEach(i=>{const d=data.devices[i];
    if(autoLinkEligible(d,devLayers))devs.push({i,d,room:roomLabel(e.rm)});}));
  // with replace, these devices' earlier auto-links into the chosen layers are dropped first
  const replaced=l=>replace&&!l.glue&&pathIds.has(l.p);
  const kept=o=>devLinks(o.d).filter(l=>!replaced(l));
  const pairs=[],amb=[];let already=0,dropped=0;
  if(replace)devs.forEach(o=>{dropped+=devLinks(o.d).filter(replaced).length;});
  paths.forEach(pa=>(pa.nodes||[]).forEach(nd=>{
    const near=devs.filter(o=>o.d.level===nd.level).map(o=>({i:o.i,d:o.d,room:o.room,
      dist:Math.hypot(nd.x-o.d.x,nd.y-o.d.y),dh:Math.round((nd.h||0)-(o.d.h||0))})).filter(o=>o.dist<=tol);
    if(!near.length)return;
    const fresh=near.filter(o=>!kept(o).some(l=>l.p===pa.id&&l.n===nd.id));
    already+=near.length-fresh.length;if(!fresh.length)return;
    const base={p:pa.id,n:nd.id,layer:pa.layer||'L0',h:Math.round(nd.h||0)};
    if(fresh.length===1){pairs.push(Object.assign(base,fresh[0]));return;}
    fresh.sort((a,b)=>Math.abs(a.dh)-Math.abs(b.dh));
    const at=fresh.filter(o=>Math.abs(o.dh)<=AUTOLINK_HTOL);
    if(at.length===1){pairs.push(Object.assign(base,at[0],{byHeight:true}));return;}      // drawn at its height
    const m=Math.abs(fresh[0].dh),top=at.length?at:fresh.filter(o=>Math.abs(o.dh)-m<=AUTOLINK_HTOL);
    amb.push(Object.assign(base,{cands:fresh,kind:top.length===1?'height':'tie',def:top.length===1?String(top[0].i):'all'}));}));
  // boxes no chosen route reaches — worth a look before wiring. A box in a clip row counts as
  // reached when any box of its row is: the route enters a row at one end and the row carries it on.
  const reached=new Set(pairs.map(q=>q.i));amb.forEach(a=>a.cands.forEach(o=>reached.add(o.i)));
  devs.forEach(o=>{if(kept(o).some(l=>pathIds.has(l.p)))reached.add(o.i);});
  const rowHit=new Set();reached.forEach(i=>{const c=data.devices[i].clip;if(c)rowHit.add(c);});
  const unreached=devs.filter(o=>!reached.has(o.i)&&!(o.d.clip&&rowHit.has(o.d.clip))).map(o=>o.i);
  return {pairs,amb,already,dropped,unreached,layers:lids,devLayers,tol,replace,devIdx:devs.map(o=>o.i),pathIds:[...pathIds]};}
// choice[k] for ambiguous node k: 'all', 'none', or a device index; missing = the plan's default
function applyAutoLink(plan,choice){if(!plan)return 0;choice=choice||{};
  pushUndo(['devices']);
  const pathIds=new Set(plan.pathIds);
  if(plan.replace)plan.devIdx.forEach(i=>removeLinks(data.devices[i],l=>!l.glue&&pathIds.has(l.p)));
  let n=0;
  plan.pairs.forEach(q=>{if(addLink(data.devices[q.i],q.p,q.n))n++;});
  plan.amb.forEach((a,k)=>{const ch=choice[k]==null?(a.def||'all'):choice[k];
    a.cands.forEach(o=>{if((ch==='all'||+ch===o.i)&&addLink(data.devices[o.i],a.p,a.n))n++;});});
  if(typeof invalidateShell==='function')invalidateShell();       // links change no pixels of the plan
  draw();return n;}

function autoLinkDialog(entries,title){entries=(entries||[]).filter(Boolean);if(!entries.length)return;
  const RL=routeLayers(entryLevels(entries)),DL=deviceLayersIn(entries);let plan=null;
  const ref=i=>esc(data.devices[i].ref||data.devices[i].id);
  if(!RL.length){openModal('Pálya-kötés','<div class="mrow">Ezen a szinten még nincs pálya.</div>',()=>{},'Bezár');return;}
  openModal(esc(title||('Pálya-kötés — '+roomLabel(entries[0].rm))),
    `<div class="mrow" style="font-size:12px">Csomópont a készüléken, ha alaprajzban ≤ <input id="alTol" type="number" step="5" min="1" value="${state.autoLinkTol||AUTOLINK_TOL}" style="width:56px"> mm-re van tőle (a magasság csak egymás feletti dobozoknál számít)</div>`
   +`<div class="mrow" style="font-size:12px;flex-wrap:wrap;gap:4px 12px">Pályák rétege: `
   +RL.map(L=>`<label><input type="checkbox" class="alLay" value="${esc(L.id)}" ${L.visible?'checked':''}> ${esc(L.name)} <span style="color:#8a8478">(${L.paths})</span></label>`).join('')+`</div>`
   +`<div class="mrow" style="font-size:12px;flex-wrap:wrap;gap:4px 12px">Készülékek rétege: `
   +DL.map(L=>`<label><input type="checkbox" class="alDev" value="${esc(L.id)}" ${L.on?'checked':''}> ${esc(L.name)} <span style="color:#8a8478">(${L.devices})</span></label>`).join('')+`</div>`
   +`<div class="mrow" style="font-size:12px"><label><input type="checkbox" id="alRep" checked> a rétegek korábbi automatikus kötéseit újraszámolja (a kézi kötések maradnak)</label></div>`
   +`<div id="alPrev" style="max-height:340px;overflow:auto;font-size:12px;border-top:1px solid #eee;padding-top:4px"></div>`,
    ()=>{const choice={};document.querySelectorAll('#alPrev select[data-amb]').forEach(s=>{choice[+s.dataset.amb]=s.value;});
      if(!plan.pairs.length&&!plan.amb.length&&!plan.dropped)return false;
      state.autoLinkTol=+$('alTol').value||AUTOLINK_TOL;
      const n=applyAutoLink(plan,choice);
      $('hud').textContent='Pálya-kötés: '+n+' kötés'+(plan.dropped?' ('+plan.dropped+' régi újraszámolva)':'')+'.';},'Kötés');
  const run=()=>{const ticked=cls=>[...document.querySelectorAll(cls)].filter(c=>c.checked).map(c=>c.value);
    plan=planAutoLink(entries,{tol:+$('alTol').value,layers:ticked('.alLay'),devLayers:ticked('.alDev'),replace:$('alRep').checked});
    // new links per device, in room order
    const per={};plan.pairs.forEach(q=>{(per[q.i]=per[q.i]||[]).push(q);});
    const rooms={};Object.keys(per).forEach(i=>{const r=per[i][0].room;(rooms[r]=rooms[r]||[]).push(+i);});
    const lname=id=>(layerById(id)||{}).name||id;
    $('alPrev').innerHTML=
      `<div style="padding:2px 0 6px"><b>${plan.pairs.length}</b> új kötés · ${Object.keys(per).length} készülék`
      +(plan.amb.length?` · ${plan.amb.length} csomópont választással`:'')
      +(plan.already?` · ${plan.already} már kötve`:'')+(plan.dropped?` · ${plan.dropped} régi újraszámolva`:'')+`</div>`
      +Object.keys(rooms).map(r=>`<div style="padding:2px 0"><b>${esc(r)}</b>: `
        +rooms[r].map(i=>`${ref(i)}<span style="color:#8a8478">×${per[i].length}</span>`).join(' · ')+`</div>`).join('')
      +(plan.amb.length?`<div style="padding:6px 0 2px"><b>Egy csomópont, több készülék</b> <span style="color:#8a8478">— ⚠ azonos magasságban (ugyanaz a doboz két rétegen?) · ↕ magasság szerint előválasztva</span></div>`:'')
      +plan.amb.map((a,k)=>{const sel=v=>String(v)===String(a.def)?' selected':'';
        return `<div style="padding:3px 0;color:${a.kind==='tie'?'#c0530f':'#4a453c'}">${a.kind==='tie'?'⚠':'↕'} ${esc(lname(a.layer))} ${esc(a.p)}/${esc(a.n)} (${a.h} mm): `
        +`<select data-amb="${k}"><option value="all"${sel('all')}>mindegyik</option>`
        +a.cands.map(o=>`<option value="${o.i}"${sel(o.i)}>csak ${ref(o.i)} (${o.d.h||0} mm, ${esc(lname(o.d.layer||'L0'))})</option>`).join('')
        +`<option value="none">egyik sem</option></select></div>`;}).join('')
      +(plan.unreached.length?`<div style="padding:4px 0;color:#8a8478">Nincs a közelében csomópont a választott rétegeken: ${plan.unreached.map(ref).join(' · ')}</div>`:'')
      +(!plan.layers.length?`<div style="color:#c0392b">Válassz legalább egy réteget.</div>`:'');};
  $('alTol').oninput=run;$('alRep').onchange=run;document.querySelectorAll('.alLay,.alDev').forEach(c=>c.onchange=run);
  run();}
// the inspector line under a selected device: how many route nodes it is linked to, and on which layers
function linkInspectorHtml(sel){if(!sel||sel.t!=='devices')return '';const d=data.devices[sel.i];if(!d||d.type==='board')return '';
  const ts=linkTargets(d),lay=[...new Set(ts.map(t=>(layerById(t.path.layer||'L0')||{}).name||''))].filter(Boolean);
  return `<div class="insCkt"><div class="insRoomH"><b>Pálya-kötés</b><span>${ts.length?ts.length+' csomópont':'—'}</span></div>`
    +`<div class="insSub">${ts.length?esc(lay.join(', '))+(ts.some(t=>t.glue)?' · kézi kötéssel':''):'nincs pályához kötve'}</div></div>`;}

// ---- while drawing: the same two things, one box or one node at a time ----
// Device tool + Shift: the new box goes 72 mm beside the nearest box of the same type on the same
// wall face and layer (within ROWSNAP_REACH), past the row's end on the cursor's side, at that box's
// height — and joins its clip group. Path tool: a node put down on a box symbol snaps onto the box
// in plan (keeping the drawing height) and, when the path is finished, becomes a link of that box.
// Both are decided in the cursor snap, so the preview shows exactly what the click will do.
// When the cursor is locked to a wall, only that wall face counts. Unlocked (e.g. drawing at ceiling
// height) the nearest box of the type near the cursor decides, and its own wall gives the row's line.
var ROWSNAP_REACH=400,ROWSNAP_OFF=300;
function rowSnap(p,type){if(!p||!autoClipEligible({type,side:0}))return null;
  const face=state.side?1:-1,lay=curLayer();let best=null;
  data.devices.forEach(d=>{if(d.level!==p.level||d.type!==type||(d.layer||'L0')!==lay||d.side==null)return;
    const hw=deviceHostWall(d);if(!hw)return;const wi=hw.wi;
    if(p.wall){if(!(hw.r===p.wall||(hw.r.id&&hw.r.id===p.wall.id)))return;   // by id too: undo rebuilds walls
      if(((hw.nx*wi.perp[0]+hw.ny*wi.perp[1])>0?1:-1)!==face)return;}
    const du=Math.abs(wi.horiz?d.x-p.x:d.y-p.y),dv=Math.abs(wi.horiz?d.y-p.y:d.x-p.x);
    if(du>ROWSNAP_REACH||(!p.wall&&dv>ROWSNAP_OFF))return;
    if(!best||du+dv<best.k)best={d,hw,k:du+dv};});
  if(!best)return null;
  const horiz=best.hw.wi.horiz,uOf=o=>horiz?o.x:o.y,u=uOf(p);
  const a=best.d,grp=a.clip?data.devices.filter(x=>x.clip===a.clip):[a];
  if(grp.length>=AUTOCLIP_MAX)return {full:true,anchor:a};
  const us=grp.map(uOf),nu=u>=uOf(a)?Math.max(...us)+DEV_CLIP_SPACING:Math.min(...us)-DEV_CLIP_SPACING;
  return {anchor:a,x:horiz?nu:a.x,y:horiz?a.y:nu,h:a.h||0};}
// The visible box whose symbol is under this base-space point. Boxes stacked on one plan point
// overlap in the flat plan, so the one nearest the drawing height h wins (a ceiling route lands on
// the KD at the top of a drop, a route drawn at socket height on the socket), then one on the active
// layer, then the nearest symbol.
function devAtBase(bx,by,level,h){const k=devK(),R=Math.max(8*k,10/(state.zoom||1)),lay=curLayer();
  const hit=[];
  data.devices.forEach(d=>{if(d.level!==level||!state.levels[d.level]||!layerShows(d,'device'))return;
    const b=planToBase(d.x,d.y,dz(d.level,d.h||0)),dd=Math.hypot(b[0]-bx,b[1]-by);
    if(dd<=R)hit.push({d,dd,dh:h==null?0:Math.abs((d.h||0)-h),own:(d.layer||'L0')===lay?0:1});});
  hit.sort((a,b)=>(a.dh-b.dh)||(a.own-b.own)||(a.dd-b.dd));
  return hit.length?hit[0].d:null;}
// cableSnap, plus the two placement snaps; `base` is the pointer in base space
function placeSnapAt(p,base,shift){
  if(state.mode==='device'&&shift){const r=rowSnap(p,($('devType')||{}).value||'socket');
    if(r&&r.full)p.snap='sor tele ('+AUTOCLIP_MAX+' doboz) — nem csatolható';
    else if(r){p.x=r.x;p.y=r.y;p.h=r.h;p.row=r.anchor.id;p.snap='sor · '+(r.anchor.ref||r.anchor.id)+' mellé, '+DEV_CLIP_SPACING+' mm';}
    else p.snap+=' · nincs azonos doboz a közelben';}
  if(state.mode==='path'&&base){const d=devAtBase(base[0],base[1],p.level,p.h);
    if(d){p.x=d.x;p.y=d.y;p.dev=d.id;p.snap='készülékre: '+(d.ref||d.id);}}
  return p;}
function placeSnap(e){return placeSnapAt(cableSnap(e),clientToBase(e),!!(e&&e.shiftKey));}
// make dev the next box of anchor's row (clip group); the caller pushed undo
function rowJoin(dev,anchorId){const a=byId('devices',anchorId);if(!a||!dev)return false;
  const gid=a.clip||('clip'+Date.now().toString(36));a.clip=gid;dev.clip=gid;dev.side=a.side;
  $('hud').textContent=(dev.ref||'')+' csatolva: '+(a.ref||a.id)+' sorába, '+DEV_CLIP_SPACING+' mm';return true;}
// the Device tool's click
function placeDevice(p,ty){pushUndo();
  const dev={type:ty,level:p.level,x:p.x,y:p.y,h:p.h,layer:curLayer(),ref:nextRef(ty)};
  if(p.wall){dev.side=state.side?1:0;}   // remember which wall side (like path sections)
  data.devices.push(dev);
  if(p.row)rowJoin(dev,p.row);
  draw();return dev;}
// the Path tool's click: a node, marked when it was put down on a box
function pathAddNode(p){if(!pathDraft){pushUndo();pathDraft={ptype:state.pathType,nodes:[],sections:[],layer:curLayer()};}
  if(pathDraft.nodes.length)pathDraft.sections.push({build:'sull_gege',circuit:null});
  const n={level:p.level,x:p.x,y:p.y,h:p.h};if(p.dev)n.on=p.dev;
  pathDraft.nodes.push(n);draw();return n;}
// called by finishPath once the path is in data.paths: marked nodes become links of their boxes
function linkMarkedNodes(pa){if(!pa||!(pa.nodes||[]).some(n=>n.on))return 0;ensureIds(data);let k=0;
  pa.nodes.forEach(n=>{if(!n.on)return;const d=byId('devices',n.on);delete n.on;if(d&&addLink(d,pa.id,n.id))k++;});
  if(k&&typeof invalidateShell==='function')invalidateShell();
  return k;}
// Shift pressed or released without moving the mouse: redo the Device tool's snap where the pointer is
function refreshPlaceCursor(shift){if(state.mode!=='device')return;
  try{if(!lastPtr||(!lastPtr[0]&&!lastPtr[1]))return;cursor=placeSnap({clientX:lastPtr[0],clientY:lastPtr[1],shiftKey:shift});state.hoverR=cursor.wall||null;
    $('hud').textContent=cursor.snap;drawSoon();}catch(_){}}
document.addEventListener('keydown',e=>{if(e.key==='Shift'&&!e.repeat)refreshPlaceCursor(true);});
document.addEventListener('keyup',e=>{if(e.key==='Shift')refreshPlaceCursor(false);});

registerActions([
 {id:'room.autoclip',alias:'sorolas auto clip csatolas row helyiseg',need:'Jelölj ki egy helyiséget (padlót).',
  label:'Sorolás a helyiségben…',icon:'⛓',group:'Helyiség',
  hint:'Az egymás mellé tett azonos dobozok egy csatolt sorba kerülnek, 72 mm-es osztással — előnézettel.',
  when:c=>!c.inEditor&&!!selRoomEntry(c.sel),run:c=>autoClipDialog([selRoomEntry(c.sel)])},
 {id:'rooms.autoclip',alias:'sorolas minden helyiseg auto clip all rooms',
  label:'Sorolás minden helyiségben…',icon:'⛓',group:'Készülék',
  hint:'Az egész terv egymás melletti dobozai, helyiségenként — előnézettel, soronként kipipálható.',
  when:c=>!c.inEditor,run:()=>autoClipDialog(allRoomEntries(),'Sorolás — minden helyiség')},
 {id:'room.autolink',alias:'pálya kötés auto link csomopont node helyiseg',need:'Jelölj ki egy helyiséget (padlót).',
  label:'Pálya-kötés a helyiségben…',icon:'🔗',group:'Helyiség',
  hint:'A készülékeken ülő pálya-csomópontok a készülékhez kötődnek — rétegenként, előnézettel. Semmi nem mozdul.',
  when:c=>!c.inEditor&&!!selRoomEntry(c.sel),run:c=>autoLinkDialog([selRoomEntry(c.sel)])},
 {id:'rooms.autolink',alias:'pálya kötés minden helyiseg auto link all rooms',
  label:'Pálya-kötés minden helyiségben…',icon:'🔗',group:'Pálya',
  hint:'Az egész terv: minden készülék a rajta ülő csomópontokhoz kötődik, a kiválasztott rétegek pályáin.',
  when:c=>!c.inEditor,run:()=>autoLinkDialog(allRoomEntries(),'Pálya-kötés — minden helyiség')}
]);

// test hooks
window.planAutoClip=planAutoClip;window.applyAutoClip=applyAutoClip;window.autoClipDialog=autoClipDialog;
window.allRoomEntries=allRoomEntries;window.planAutoLink=planAutoLink;window.applyAutoLink=applyAutoLink;
window.autoLinkDialog=autoLinkDialog;window.routeLayers=routeLayers;window.linkInspectorHtml=linkInspectorHtml;
window.deviceLayersIn=deviceLayersIn;window.rowSnap=rowSnap;window.devAtBase=devAtBase;window.placeSnapAt=placeSnapAt;
window.placeDevice=placeDevice;window.pathAddNode=pathAddNode;window.linkMarkedNodes=linkMarkedNodes;
