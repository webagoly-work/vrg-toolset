// ==========================================================================
// 05h-rooms.js — room membership: which devices belong to which room
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A device belongs to exactly ONE room, or to none. This is the seam the room
// breakdown, room renumbering and the room document all read — derived from
// geometry on demand, never stored.
//
// - A free-standing device (ceiling lamp, floor box) belongs to the room its plan
//   point falls in.
// - A wall-mounted device sits on one FACE of its host wall and belongs to the room
//   that face looks into. A socket on the far side of a partition is the
//   neighbour's, even though it is a few mm from this room's outline.
//
// The room is sampled a little past the mounting face, measured from the wall
// centreline, so it works whether the outline was drawn on the centreline (what
// createRoom does) or on the inner face of the walls.
const ROOM_PROBE=60;          // mm past the mounting face where the room is sampled
const ROOM_WALL_TOL=40;       // mm a device may stand off its wall face and still count as mounted on it

// {wi, nx, ny, px, py}: the wall this device is mounted on, the face normal it looks
// along, and the point on the centreline behind it — or null when it is free-standing.
function deviceHostWall(d){if(d.side==null)return null;
  let best=null;
  (WALLS[d.level]||[]).forEach(r=>{const wi=wallInfo(r),[a,b]=wi.seg;
    const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy||1;
    const t=Math.max(0,Math.min(1,((d.x-a[0])*dx+(d.y-a[1])*dy)/L2));
    const px=a[0]+t*dx,py=a[1]+t*dy,dist=Math.hypot(d.x-px,d.y-py);
    if(dist>wi.thick/2+ROOM_WALL_TOL||(best&&dist>=best.dist))return;
    // which face: the device's actual offset wins; d.side only breaks a tie on the centreline
    const off=(d.x-px)*wi.perp[0]+(d.y-py)*wi.perp[1];
    const s=Math.abs(off)>1?Math.sign(off):(d.side?1:-1);
    best={wi,dist,px,py,nx:wi.perp[0]*s,ny:wi.perp[1]*s};});
  return best;}
// the plan point that decides the room
function deviceRoomPoint(d){const h=deviceHostWall(d);if(!h)return [d.x,d.y];
  const k=h.wi.thick/2+ROOM_PROBE;return [h.px+h.nx*k,h.py+h.ny*k];}
function roomEntryKey(e){return e?e.src+e.i+'@'+e.level:'';}
// the room entry ({rm,src,i,level}, as allRooms returns) a device belongs to; topmost wins, like roomHitAt
function roomOfDevice(d){const [x,y]=deviceRoomPoint(d),list=allRooms(d.level);
  for(let k=list.length-1;k>=0;k--)if(pointInPoly(x,y,list[k].rm.poly))return list[k];
  return null;}
// indices into data.devices that belong to this room entry
function roomMembers(entry){const key=roomEntryKey(entry),out=[];
  data.devices.forEach((d,i)=>{if(d.level===entry.level&&roomEntryKey(roomOfDevice(d))===key)out.push(i);});
  return out;}

// ---- breakdown: devices by type and count ----
const ROOM_TYPE_ORDER=['board','switch','socket','light','junction','box'];
// the finest label a device has: the variant (Kapcsoló 106, Aljzat UTP), else the base type
function devTypeLabel(d){
  if(d.kind&&DEVKIND[d.kind])return DEVKIND[d.kind].n;
  if(d.type==='box')return 'Szerelvénydoboz'+(d.lv?' LV':'');
  if(d.type==='junction'){const s=+d.jbSize||80;return 'Kötődoboz '+(d.jbShape==='circle'?'⌀'+s:s+'×'+s);}
  return DEV[d.type]||d.type||'?';}
// [{type, label, n, refs}] grouped by type, then variant; refs in id (creation) order
function roomBreakdown(entry){const rows={};
  roomMembers(entry).forEach(i=>{const d=data.devices[i],label=devTypeLabel(d),k=d.type+'|'+label;
    (rows[k]=rows[k]||{type:d.type,label,n:0,devs:[]}).n++;rows[k].devs.push(d);});
  const ord=t=>{const ix=ROOM_TYPE_ORDER.indexOf(t);return ix<0?99:ix;};
  return Object.values(rows)
    .sort((a,b)=>(ord(a.type)-ord(b.type))||a.label.localeCompare(b.label,'hu',{numeric:true}))
    .map(r=>({type:r.type,label:r.label,n:r.n,
      refs:r.devs.sort((a,b)=>idNum(a.id)-idNum(b.id)).map(d=>d.ref||d.id)}));}
// the inspector block for a selected room
function roomBreakdownHtml(entry){const rows=roomBreakdown(entry),tot=rows.reduce((a,r)=>a+r.n,0);
  const head=`<div class="insRoomH"><b>${esc(t('insp.roomDevs','Készülékek a helyiségben'))}</b><span>${tot} db</span></div>`;
  if(!rows.length)return `<div class="insRoom">${head}<div class="insSub">${esc(t('insp.roomEmpty','Nincs készülék ebben a helyiségben.'))}</div></div>`;
  return `<div class="insRoom">${head}`+rows.map(r=>
    `<div class="insRoomR" title="${esc(r.refs.join(', '))}"><span class="insRoomL">${esc(r.label)}</span><b>${r.n}</b></div>`
    +`<div class="insRoomRefs">${esc(r.refs.join(' · '))}</div>`).join('')+`</div>`;}

// ---- renumbering: a room's devices get template refs, counted per type, in id order ----
// Only the display `ref` changes — never the id — so links, wiring and undo are untouched.
// The existing refs play no part: whatever they were, the room is numbered from 1 again.
// The Elosztószekrény is skipped by default: it sits above rooms (P33-EL1), not in one.
const ROOM_REF_TPL='{szám}-{típus}{n}';
const ROOM_REF_TOKENS=[
  ['projekt','projektkód (Dokumentáció → projekt)'],['szám','helyiség száma, ha nincs: neve'],
  ['név','helyiség neve'],['szint','szint'],['típus','típus-előtag (D, K, L, KD, SZ)'],
  ['n','sorszám'],['nn','sorszám két jeggyel (01)']];
const ROOM_REF_SEP='[-._/ ]';
function roomRefTpl(){return state.roomRefTpl||ROOM_REF_TPL;}
function selRoomEntry(sel){const rm=sel&&sel.t==='floors'?data.floors[sel.i]:null;
  return rm?{rm,src:'F',i:sel.i,level:rm.level}:null;}
function roomLabel(rm){return [rm.num,rm.name].filter(Boolean).join(' ')||t('insp.room','Helyiség');}
// Fill a template. An empty token takes one neighbouring separator with it, so a room without
// a number gives `D1`, not `-D1`, and a missing project code gives `1.02-D1`, not `-1.02-D1`.
function fillRefTpl(tpl,v){const E='',fold=k=>k.normalize('NFD').replace(/[̀-ͯ]/g,'');
  const val={projekt:v.projekt,szam:v.szam,nev:v.nev,szint:v.szint,tipus:v.tipus,n:v.n,nn:String(v.n).padStart(2,'0')};
  let s=String(tpl).replace(/\{([^{}]+)\}/g,(m,k)=>{const x=val[fold(k.trim())];
    return x===undefined?m:(x===''||x==null?E:String(x));});
  s=s.replace(new RegExp('^(?:'+E+ROOM_REF_SEP+'?)+'),'').replace(new RegExp(ROOM_REF_SEP+'?'+E,'g'),'').split(E).join('');
  return s.trim();}
// {rows:[{i, dev, old, ref, label, changed}], warn:[msg], block:msg|null} — computes, changes nothing
function planRoomRenumber(entry,opt){opt=opt||{};const tpl=opt.tpl||roomRefTpl(),rm=entry.rm;
  const skipBoard=opt.skipBoard!==false,cnt={},rows=[],warn=[];
  const base={projekt:String((state.bp&&state.bp.proj)||'').trim(),szam:String(rm.num||rm.name||'').trim().replace(/\s+/g,'_'),
    nev:String(rm.name||'').trim().replace(/\s+/g,'_'),szint:entry.level};
  roomMembers(entry).map(i=>({i,d:data.devices[i]}))
    .filter(x=>!(skipBoard&&x.d.type==='board'))
    .sort((a,b)=>idNum(a.d.id)-idNum(b.d.id))
    .forEach(({i,d})=>{const pre=REFPRE[d.type]||'X';cnt[pre]=(cnt[pre]||0)+1;
      const ref=fillRefTpl(tpl,Object.assign({tipus:pre,n:cnt[pre]},base));
      rows.push({i,dev:d,old:d.ref||'',ref,label:devTypeLabel(d),changed:(d.ref||'')!==ref});});
  if(!rm.num)warn.push(rm.name?'A helyiségnek nincs száma — a neve kerül a jelölésbe.':'A helyiségnek nincs se száma, se neve.');
  const seen={};let block=null;
  rows.forEach(r=>{if(!r.ref)block='Üres jelölés keletkezne — a sablonból hiányzik a típus vagy a sorszám.';
    else if(seen[r.ref])block='Két készülék ugyanazt a jelölést kapná ('+r.ref+') — a sablonban legyen {n} és {típus}.';
    seen[r.ref]=1;});
  const mine=new Set(rows.map(r=>r.dev));
  const clash=data.devices.filter(d=>!mine.has(d)&&d.ref&&seen[d.ref]).map(d=>d.ref);
  if(clash.length)warn.push('Más helyiségben már van ilyen jelölés: '+[...new Set(clash)].join(', ')+'.');
  return {rows,warn,block,tpl};}
function applyRoomRenumber(plan){if(plan.block||!plan.rows.length)return 0;
  pushUndo(UNDO_SCOPE.dev);let n=0;
  plan.rows.forEach(r=>{if(r.changed){r.dev.ref=r.ref;n++;}});
  draw();return n;}
function roomRenumberPreviewHtml(plan){
  if(!plan.rows.length)return `<div class="insSub" style="padding:8px">Nincs átszámozható készülék ebben a helyiségben.</div>`;
  const td='padding:2px 7px;border-top:1px solid #eee;white-space:nowrap';
  return `<table style="font-size:12px;border-collapse:collapse;width:100%">`
    +`<tr>${['Típus','Régi','','Új'].map(h=>`<th style="text-align:left;padding:3px 7px;position:sticky;top:0;background:#f3f0e9">${h}</th>`).join('')}</tr>`
    +plan.rows.map(r=>`<tr style="${r.changed?'':'color:#aaa'}"><td style="${td}">${esc(r.label)}</td>`
      +`<td style="${td}">${esc(r.old||'—')}</td><td style="${td}">→</td><td style="${td}"><b>${esc(r.ref)}</b></td></tr>`).join('')
    +`</table>`;}
function roomRenumberDialog(entry){if(!entry)return;
  openModal('Helyiség átszámozása — '+esc(roomLabel(entry.rm)),
     `<div class="mrow"><label style="width:70px">Sablon</label><input id="rrTpl" value="${esc(roomRefTpl())}" style="flex:1">`
    +`<button id="rrDef" title="Alapértelmezett sablon: ${esc(ROOM_REF_TPL)}" style="margin-left:6px">↺</button></div>`
    +`<div class="mrow" style="font-size:10.5px;color:#888;line-height:1.5">`
    +ROOM_REF_TOKENS.map(([k,d])=>`<code>{${k}}</code> ${esc(d)}`).join(' · ')+`</div>`
    +`<div class="mrow"><label><input type="checkbox" id="rrBoard" checked> Elosztószekrény kihagyása</label></div>`
    +`<div id="rrMsg" class="mrow" style="font-size:11.5px"></div>`
    +`<div id="rrPrev" style="max-height:46vh;overflow:auto"></div>`,
    ()=>{const plan=cur();if(plan.block)return false;
      const tpl=$('rrTpl').value.trim();if(tpl&&tpl!==ROOM_REF_TPL)state.roomRefTpl=tpl;else delete state.roomRefTpl;
      const n=applyRoomRenumber(plan);
      $('hud').textContent=roomLabel(entry.rm)+': '+plan.rows.length+' készülék átszámozva ('+n+' jelölés változott).';},
    'Átszámozás');
  const cur=()=>planRoomRenumber(entry,{tpl:$('rrTpl').value.trim()||ROOM_REF_TPL,skipBoard:$('rrBoard').checked});
  const show=()=>{const plan=cur(),changed=plan.rows.filter(r=>r.changed).length;
    $('rrPrev').innerHTML=roomRenumberPreviewHtml(plan);
    $('rrMsg').innerHTML=(plan.block?`<div style="color:#c0392b">⛔ ${esc(plan.block)}</div>`:'')
      +plan.warn.map(w=>`<div style="color:#c0530f">⚠ ${esc(w)}</div>`).join('')
      +(plan.rows.length?`<div style="color:#6a6357">${plan.rows.length} készülék · ${changed} jelölés változik</div>`:'');
    $('mOk').disabled=!!plan.block||!plan.rows.length;};
  $('rrTpl').oninput=show;$('rrBoard').onchange=show;
  $('rrDef').onclick=()=>{$('rrTpl').value=ROOM_REF_TPL;show();};
  show();}

registerActions([
 {id:'room.renumber',alias:'room renumber rename refs numbering',need:'Jelölj ki egy helyiséget (padlót).',
  label:'Helyiség átszámozása',icon:'🔢',group:'Helyiség',
  hint:'A helyiség minden készüléke új jelölést kap a sablon szerint (pl. 1.02-D1), típusonként, azonosító sorrendben.',
  when:c=>!!selRoomEntry(c.sel),run:c=>roomRenumberDialog(selRoomEntry(c.sel))}]);

// test hooks (consts are not global properties)
window.deviceHostWall=deviceHostWall;window.roomOfDevice=roomOfDevice;window.roomMembers=roomMembers;
window.roomBreakdown=roomBreakdown;window.devTypeLabel=devTypeLabel;window.roomEntryKey=roomEntryKey;
window.ROOM_REF_TPL=ROOM_REF_TPL;window.fillRefTpl=fillRefTpl;window.planRoomRenumber=planRoomRenumber;
window.applyRoomRenumber=applyRoomRenumber;window.roomRenumberDialog=roomRenumberDialog;
