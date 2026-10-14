// ==========================================================================
// 08f-wf-wheel.js — workflow round (docs/workflow), WP-R1: the room-type wheel
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// LMB on a room with the Helyiség-toll (no line being drawn, not on an edge or corner) opens an 8-sector wheel at the
// pointer: the seven most common room types, South = Továbbiak (the next ring; on the last ring ‹ Vissza). Picking a type
// the room already has removes it — a room can carry several (Konyha + Étkező). RMB keeps the old advanced room menu.
// The look and geometry are the controller wheel's (08b-gamepad.js: R 150, r 62, sector 0 up, clockwise); the drawing is
// a copy here, not a lift, so the gamepad code stays untouched (deviation from WP-R1 step 1, noted in the README).
// Data: rm.kinds[]; rm.kind = kinds[0] so every old reader (needKind, F4 tint) works; an unnamed room is named after its
// kinds (nameAuto) so the existing room labels show the type without any render change.
// R02 = A: Gyerekszoba, Gardrób, Mosókonyha become kinds of their own — EXPLICIT only (their pattern never matches a
// name, so no existing room changes kind) — with the needs defaults of Háló, Kamra and Gépészet.
(function(){const add=(k,n,parent)=>{if(NEED_KINDS.some(x=>x.k===k))return;
  NEED_KINDS.splice(NEED_KINDS.length-1,0,{k,n,re:/(?!)/,parent});NEED_DEFAULTS[k]=NEED_DEFAULTS[parent];};
  add('gyerek','Gyerekszoba','halo');add('gardrob','Gardrób','kamra');add('mosokonyha','Mosókonyha','gepeszet');})();
if(typeof WFW_KIND_HUE!=='undefined'){WFW_KIND_HUE.gyerek=WFW_KIND_HUE.halo;WFW_KIND_HUE.gardrob=WFW_KIND_HUE.kamra;WFW_KIND_HUE.mosokonyha=WFW_KIND_HUE.gepeszet;}

const RW_ICON={nappali:'🛋',konyha:'🍳',halo:'🛏',furdo:'🛁',wc:'🚽',eloszoba:'🚪',kozlekedo:'↔',etkezo:'🍽',dolgozo:'💻',kamra:'📦',
  gepeszet:'⚙',gyerek:'🧸',gardrob:'👕',mosokonyha:'🧺',kulter:'🌿',egyeb:'…'};
// MATERIAL §2 (R01 = A): sector 0 = North, clockwise; index 4 (South) is the ring switch
const RW_RINGS=[['nappali','konyha','halo','furdo','>','wc','eloszoba','kozlekedo'],
                ['etkezo','dolgozo','kamra','gepeszet','>','gyerek','gardrob','mosokonyha'],
                ['kulter','egyeb',null,null,'<',null,null,null]];
const RW={open:false,ring:0,pick:-1,room:null,x:0,y:0,keep:false};
const RW_SIZE=300,RW_VB=380,RW_C=190,RW_R=150,RW_r=62;

function rwKindName(k){const e=NEED_KINDS.find(x=>x.k===k);return e?e.n:k;}
function rwKinds(rm){if(Array.isArray(rm.kinds))return rm.kinds;return rm.kind?[rm.kind]:[];}
// angle → sector: (dx, dy) in screen px from the centre; null inside the hub
function rwSectorAt(dx,dy,n,hub){if(Math.hypot(dx,dy)<(hub==null?30:hub))return null;
  let a=Math.atan2(dy,dx)+Math.PI/2;a=(a+Math.PI*2)%(Math.PI*2);return Math.round(a/(Math.PI*2/n))%n;}
function rwToggleKind(rm,k){if(!rm||!k)return null;const ks=rwKinds(rm).slice(),i=ks.indexOf(k);
  if(data.floors.indexOf(rm)>=0)pushUndo(UNDO_SCOPE.floor);
  if(i>=0)ks.splice(i,1);else ks.push(k);
  if(ks.length){rm.kinds=ks;rm.kind=ks[0];}else{delete rm.kinds;delete rm.kind;}
  if(!rm.name||rm.nameAuto){if(ks.length){rm.name=ks.map(rwKindName).join(' + ');rm.nameAuto=true;}else{rm.name='';delete rm.nameAuto;}}
  if(rm.fillAuto&&typeof wfwTintOf==='function')rm.fill=wfwTintOf(rm);
  return ks;}
function rwRoomAt(p,level){const L=allRooms(level||state.active);for(let k=L.length-1;k>=0;k--)if(L[k].rm.poly&&pointInPoly(p[0],p[1],L[k].rm.poly))return L[k];return null;}

function rwHost(){let h=$('rwWheel');if(!h){h=document.createElement('div');h.id='rwWheel';document.body.appendChild(h);
  const st=document.createElement('style');st.textContent=
   '#rwWheel{position:fixed;z-index:60;display:none;width:'+RW_SIZE+'px;height:'+RW_SIZE+'px;margin:-'+RW_SIZE/2+'px 0 0 -'+RW_SIZE/2+'px;user-select:none}'
   +'#rwWheel .s{fill:#fffefbF2;stroke:#d8d3c8;stroke-width:1.2;cursor:pointer}#rwWheel .s.sel{fill:#f6d9c4}#rwWheel .s.on{fill:#e8641c;stroke:#c8540c}'
   +'#rwWheel .s.nil{fill:#f3f1ec;opacity:.55;cursor:default}#rwWheel .i{text-anchor:middle;font-size:17px;fill:#3a3a3a;pointer-events:none}'
   +'#rwWheel .l{text-anchor:middle;font-size:10.5px;fill:#4a4a4a;pointer-events:none}#rwWheel .on~.i,#rwWheel .i.on,#rwWheel .l.on{fill:#fff;font-weight:700}'
   +'#rwWheel .l.sel{font-weight:700;fill:#a8461a}#rwWheel .h{fill:#2c2c2cF2;stroke:#1a1a1a;cursor:pointer}#rwWheel .ht{text-anchor:middle;font-size:12.5px;font-weight:700;fill:#fff;pointer-events:none}'
   +'#rwWheel .hs{text-anchor:middle;font-size:10px;fill:#e8a06c;pointer-events:none}';
  document.head.appendChild(st);
  h.addEventListener('pointermove',e=>{const n=RW_RINGS[RW.ring].length,k=rwSectorAt((e.clientX-RW.x)*RW_VB/RW_SIZE,(e.clientY-RW.y)*RW_VB/RW_SIZE,n,RW_r-4);
    if(k!==RW.pick){RW.pick=k==null?-1:k;rwDraw();}});
  h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(e.button!==0){rwClose();return;}
    const n=RW_RINGS[RW.ring].length,k=rwSectorAt((e.clientX-RW.x)*RW_VB/RW_SIZE,(e.clientY-RW.y)*RW_VB/RW_SIZE,n,RW_r-4);
    if(k==null){rwClose();return;}rwChoose(k,e.shiftKey);});
  h.addEventListener('contextmenu',e=>{e.preventDefault();rwClose();});}
  return h;}
function rwChoose(k,keep){if(!RW.open||!RW.room)return false;const it=RW_RINGS[RW.ring][k];if(it==null)return false;
  if(it==='>'){RW.ring=Math.min(RW.ring+1,RW_RINGS.length-1);RW.pick=-1;rwDraw();return true;}
  if(it==='<'){RW.ring=0;RW.pick=-1;rwDraw();return true;}
  const ks=rwToggleKind(RW.room,it);
  $('hud').textContent=(ks.indexOf(it)>=0?'Helyiségtípus: ':'Típus levéve: ')+rwKindName(it)+(ks.length?' — most: '+ks.map(rwKindName).join(' + '):'');
  if(keep||RW.keep)rwDraw();else rwClose();draw();return true;}
function rwDraw(){const h=rwHost();if(!RW.open){h.style.display='none';h.innerHTML='';return;}
  const list=RW_RINGS[RW.ring],n=list.length,mine=rwKinds(RW.room);
  let s=`<svg viewBox="0 0 ${RW_VB} ${RW_VB}" width="${RW_SIZE}" height="${RW_SIZE}">`;
  for(let i=0;i<n;i++){const a0=(i-0.5)*(Math.PI*2/n)-Math.PI/2,a1=(i+0.5)*(Math.PI*2/n)-Math.PI/2,C=RW_C,R=RW_R,r=RW_r;
    const P=(a,d)=>(C+Math.cos(a)*d).toFixed(1)+' '+(C+Math.sin(a)*d).toFixed(1);
    const it=list[i],on=i===RW.pick&&it!=null,sel=it&&mine.indexOf(it)>=0;
    s+=`<path class="s${on?' on':''}${sel&&!on?' sel':''}${it==null?' nil':''}" d="M${P(a0,r)} L${P(a0,R)} A${R} ${R} 0 0 1 ${P(a1,R)} L${P(a1,r)} A${r} ${r} 0 0 0 ${P(a0,r)} Z"/>`;
    if(it==null)continue;const am=(a0+a1)/2,tx=C+Math.cos(am)*(r+R)/2,ty=C+Math.sin(am)*(r+R)/2;
    const lab=it==='>'?'Továbbiak ›':it==='<'?'‹ Vissza':rwKindName(it),ico=it==='>'||it==='<'?'⟳':(RW_ICON[it]||'');
    s+=`<text class="i${on?' on':''}" x="${tx.toFixed(1)}" y="${(ty-4).toFixed(1)}">${ico}</text><text class="l${on?' on':''}${sel&&!on?' sel':''}" x="${tx.toFixed(1)}" y="${(ty+12).toFixed(1)}">${esc(sel?'✓ '+lab:lab)}</text>`;}
  const cur=RW.pick>=0&&list[RW.pick]&&list[RW.pick].length>1?rwKindName(list[RW.pick]):'';
  s+=`<circle class="h" cx="${RW_C}" cy="${RW_C}" r="${RW_r-4}"/><text class="ht" x="${RW_C}" y="${RW_C-4}">Helyiségtípus</text>`
    +`<text class="hs" x="${RW_C}" y="${RW_C+13}">${esc(cur||(mine.length?mine.map(rwKindName).join(' + '):(RW.ring+1)+'. kör'))}</text></svg>`;
  h.innerHTML=s;h.style.left=RW.x+'px';h.style.top=RW.y+'px';h.style.display='block';}
function rwOpenRoom(entry,cx,cy){const rm=entry&&(entry.rm||entry);if(!rm)return false;
  RW.open=true;RW.ring=0;RW.pick=-1;RW.room=rm;RW.keep=false;
  RW.x=Math.max(RW_SIZE/2,Math.min(window.innerWidth-RW_SIZE/2,cx));RW.y=Math.max(RW_SIZE/2,Math.min(window.innerHeight-RW_SIZE/2,cy));
  rwDraw();$('hud').textContent='Helyiségtípus — kattints egy típusra (újra kattintva leveszi; Shift: nyitva marad). Dél: további típusok. Esc / jobb klikk: bezár.';return true;}
function rwClose(){RW.open=false;RW.room=null;rwDraw();}
STK_TOOLS.unshift({k:'rwWheel',active:()=>RW.open,esc:()=>{rwClose();},mode:()=>{rwClose();},
  key:e=>{if(e.key==='Escape'){rwClose();return true;}return false;},down:()=>{rwClose();return true;}});
// Q-R10 = A: in Select, a double-click on a room's empty floor opens the wheel (Alt+click keeps "cycle overlapping items")
function rwDblHit(e){if(state.mode!=='select'||(typeof WV!=='undefined'&&WV))return null;const h=typeof hitTest==='function'?hitTest(e):null;
  if(h&&h.t!=='floors')return null;const [bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(state.active,0));return rwRoomAt(p);}
stage.addEventListener('dblclick',e=>{const r=rwDblHit(e);if(r){e.preventDefault();rwOpenRoom(r,e.clientX,e.clientY);}});
