// ==========================================================================
// 08og-wf-chaintool.js — wireway rebuild (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.2, Q3 = A), WP-T5: the chain tool
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The user's "Group Order" tool, in the agreed form (Q3 = A): EACH CLICK SETS up = THE PREVIOUSLY CLICKED NODE — no
// revisits, so the drawing is a tree by construction and two users drawing the same tree draw it the same way.
//   start / branch  the first click, a click on a node already in this chain, on the board, a hub (szobadoboz / RBX /
//                   BASE) or a door (its L4, on the side clicked) — or Shift + click on anything — sets where the next
//                   link starts from, without linking it. A branch = two nodes with the same up.
//   link            any other node: its up becomes the previous node, rögzített (solid). A loop is refused with
//                   upSet's reason, and the chain keeps its place.
//   undo            every link is its own undo step; Esc ends the chain.
// The engine reads these links from T2 on (a socket chain, a leader on its master, a lamp on its meeting box).
const BFL={on:false,prev:null,seen:[],links:0};

function bflIsSource(d){return !!d&&(d.type==='board'||(typeof upIsHub==='function'&&upIsHub(d)));}
function bflTgtName(t){if(!t)return '—';if(t.door)return t.door+' ajtó L4 ('+(t.room||'?')+')';const d=byId('devices',t.id);return d?(d.ref||d.id):t.id;}
function bflStart(){toolsOff();if(state.mode!=='select')setMode('select');Object.assign(BFL,{on:true,prev:null,seen:[],links:0});UP.view=true;
  const mh=$('modeHint');if(mh)mh.textContent='Betáp-lánc — kattints a forrásra (Elosztó, szobadoboz, ajtó), aztán sorban a végpontokra: mindegyik az előzőből kap betápot · lánc-pontra vagy Shift+kattintással ágat indítasz · Esc: kész';draw();}
function bflOff(){BFL.on=false;BFL.prev=null;BFL.seen=[];const mh=$('modeHint');if(mh)mh.textContent=HINTS[state.mode]||'';}
// one click, as data: t = {id} (a device) or {door, room}; shift = start a branch here. → {from} | {linked} | {err}
function bflClick(t,shift){if(!t)return {err:'Kattints egy végpontra, dobozra, az Elosztóra vagy egy ajtóra.'};
  if(t.door){BFL.prev={door:t.door,room:t.room};return {from:BFL.prev};}
  const d=byId('devices',t.id);if(!d||!upIsNode(d))return {err:'Ez nem eleme a betáp-fának.'};
  if(shift||!BFL.prev||bflIsSource(d)||BFL.seen.indexOf(d.id)>=0){BFL.prev={id:d.id};if(BFL.seen.indexOf(d.id)<0)BFL.seen.push(d.id);return {from:BFL.prev};}
  const up=BFL.prev.door?{id:BFL.prev.door,room:BFL.prev.room}:{id:BFL.prev.id};
  const r=upSet(d.id,up,{fix:true});if(r.err)return {err:r.err};
  BFL.links++;BFL.seen.push(d.id);BFL.prev={id:d.id};return {linked:d.id,up};}
// the pointer: the first tree node under it; else a door (its L4 on the side of the click)
function bflPick(e){const [bx,by]=clientToBase(e),C=typeof hitCands==='function'?hitCands(e,bx,by):[];
  const c=C.find(c=>c.h&&c.h.t==='devices'&&upIsNode(data.devices[c.h.i]));if(c)return {id:data.devices[c.h.i].id};
  const o=C.find(c=>c.h&&c.h.t==='openings'&&data.openings[c.h.i]&&data.openings[c.h.i].type==='door');
  if(o){const op=data.openings[o.h.i],p=baseToPlan(bx,by,dz(state.active,0));return {door:op.id,room:typeof blRoomAt==='function'?blRoomAt(p[0],p[1],op.level):null};}
  return null;}
STK_TOOLS.push({k:'bflTool',active:()=>{if(!BFL.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){bflOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const t=bflPick(e),r=bflClick(t,e.shiftKey);
    $('hud').textContent=r.err?'⛔ '+r.err:r.from?'Lánc innen: '+bflTgtName(r.from):bflTgtName({id:r.linked})+' ← '+bflTgtName(r.up.door?{door:r.up.id,room:r.up.room}:r.up)+' · rögzített ('+BFL.links+' kapcsolat)';draw();return true;},
  esc(){bflOff();draw();},mode(){bflOff();}});
// the chain being drawn: its nodes ringed orange, the current start point filled
STK_OVERLAY.push(()=>{if(!BFL.on)return '';const lvl=state.active,z=h=>dz(lvl,h||0);let s='';
  BFL.seen.forEach(id=>{const d=byId('devices',id);if(!d||d.level!==lvl)return;const b=planToBase(d.x,d.y,z(d.h));s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(8)}" fill="none" stroke="#e8641c" stroke-width="${vsP(1.4)}"/>`;});
  const p=BFL.prev&&(BFL.prev.door?upPt({id:BFL.prev.door,room:BFL.prev.room},lvl):(d=>d&&{x:d.x,y:d.y,h:d.h})(byId('devices',BFL.prev.id)));
  if(p){const b=planToBase(p.x,p.y,z(p.h));s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(5)}" fill="#e8641c" fill-opacity="0.85"/>`;}
  return s?`<g pointer-events="none">${s}</g>`:'';});
registerActions([{id:'bfl.tool',label:'Betáp-lánc',icon:'⛓',group:'Pálya',alias:'chain tool group order betap lanc sorrend',
  hint:'Kattints a forrásra, majd sorban a végpontokra: mindegyik az előzőből kap betápot (rögzített). Lánc-pontra kattintva ágat indítasz.',when:c=>!c.inEditor,run:()=>bflStart()}]);
window.bflStart=bflStart;window.bflClick=bflClick;window.bflOff=bflOff;window.BFL=BFL;
