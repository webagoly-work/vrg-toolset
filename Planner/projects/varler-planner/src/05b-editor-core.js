// ==========================================================================
// 05b-editor-core.js — ONE editor surface, driven by a projection descriptor
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// A wall elevation and the three plan planes are the SAME thing: a projection of
// the model onto a surface, with a 2D local coordinate system in millimetres.
// Everything except the drawing itself is shared from here — pointer handling,
// dragging, warp, path drawing, note editing and the context-menu routing.
//
// A projection supplies:
//   local(ev)            → {u,v} in surface mm
//   clamp({u,v})         → {u,v} kept inside the sheet
//   data()               → the surface data (secs/devs/notes, ua/ha/ub/hb naming)
//   setDev/setNode/setNote/setOpening   writers in surface coordinates
//   nodeUV(node)         → {u,v} of a path node on this surface
//   soft()               → redraw INTO THE SAME <svg> element
//   full()               → full re-render of the editor
//   menu(ev,u,v)         → context menu for that point
//   addNode(u,v)         → next node while drawing a path
//   badge(kind,info)     → optional text for the live drag readout
//
// The one rule the whole layer exists to protect: the <svg> element is never
// replaced during a drag, because it owns the pointer capture.

function edSurfaceProjection(E){return (E&&E.proj)||null;}
// what a drag of this kind can possibly modify — keeps undo entries small
function edDragScope(kind){
  if(kind==='note')return UNDO_SCOPE.note;
  if(kind==='op')return UNDO_SCOPE.open;
  if(kind==='dev')return UNDO_SCOPE.devPath;      // a device drags its linked node with it
  return UNDO_SCOPE.path;                          // node / seg / warp
}

// where the editor renders — the modal today, a separate window later (1.1 R5)
function edMount(E){return (E&&E.mount)||modalEl;}
function edMountQuery(E,sel){const m=edMount(E);return m?m.querySelector(sel):null;}

function edBindSurface(E,svgEl,P){
  if(!svgEl||!P)return;
  E.proj=P;
  let drag=null,pushed=false,softPending=false;
  const clamp=p=>P.clamp?P.clamp(p):p;
  const local=ev=>clamp(P.local(ev));
  const startDrag=(kind,ds,ev)=>{drag={kind,...ds};pushed=false;
    try{svgEl.setPointerCapture(ev.pointerId);}catch(_){}};   // capture the PERSISTENT svg, never a handle
  const soft=()=>{if(softPending)return;softPending=true;
    const run=()=>{softPending=false;P.soft(svgEl);bind();};
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else run();};
  const setBadge=(u,v,label)=>{E.drag={u,h:v,label};};

  function bind(){
    svgEl.querySelectorAll('.wvdev').forEach(g=>g.addEventListener('pointerdown',ev=>{
      ev.preventDefault();ev.stopPropagation();
      E.sel={kind:'dev',di:+g.dataset.di};startDrag('dev',{di:+g.dataset.di},ev);}));
    svgEl.querySelectorAll('.wvop').forEach(g=>g.addEventListener('pointerdown',ev=>{
      ev.preventDefault();ev.stopPropagation();startDrag('op',{oi:+g.dataset.oi},ev);}));
    svgEl.querySelectorAll('.wvnode').forEach(g=>g.addEventListener('pointerdown',ev=>{
      ev.preventDefault();ev.stopPropagation();startDrag('node',{pi:+g.dataset.pi,ni:+g.dataset.ni},ev);}));
    svgEl.querySelectorAll('.wvnote').forEach(g=>{
      g.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();
        E.sel={kind:'note',ni2:+g.dataset.ni2};startDrag('note',{ni2:+g.dataset.ni2},ev);});
      g.addEventListener('dblclick',ev=>{ev.preventDefault();ev.stopPropagation();noteDialog(+g.dataset.ni2,()=>P.full());});
      g.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopPropagation();noteMenu(ev,+g.dataset.ni2,()=>P.full());});});
    svgEl.querySelectorAll('.wvseg').forEach(g=>g.addEventListener('pointerdown',ev=>{
      ev.preventDefault();ev.stopPropagation();
      const pi=+g.dataset.pi,na=+g.dataset.na,nb=+g.dataset.nb,pa=data.paths[pi];if(!pa)return;
      if(ev.altKey){E.warp=(E.warp&&E.warp.pi===pi)?null:{pi};P.full();return;}   // Alt+click → warp
      const p=local(ev);
      E.sel={kind:'sec',t:{pi,na,nb,build:(pa.sections[na]||{}).build}};
      startDrag('seg',{pi,na,nb,su:p.u,sv:p.v,oa:P.nodeUV(pa.nodes[na]),ob:P.nodeUV(pa.nodes[nb])},ev);}));
    svgEl.querySelectorAll('.wvwarp').forEach(g=>g.addEventListener('pointerdown',ev=>{
      ev.preventDefault();ev.stopPropagation();
      const pi=+g.dataset.pi,hx=+g.dataset.hx,hy=+g.dataset.hy,bb=wvWarpBox(P.data(),pi);if(!bb)return;
      startDrag('warp',{pi,hx,hy,
        anchorU:(hx===1?bb.u0:bb.u1),anchorV:(hy===1?bb.h0:bb.h1),
        startU:bb.u0+hx*(bb.u1-bb.u0),startV:bb.h0+hy*(bb.h1-bb.h0),
        nodes:bb.nodes.map(n=>({ni:n.ni,u:n.u,v:n.h}))},ev);}));
  }
  bind();

  svgEl.addEventListener('pointermove',ev=>{if(!drag)return;ev.preventDefault();
    if(!pushed){wvPush(edDragScope(drag.kind));pushed=true;}   // snapshot only what this drag can touch
    const p=local(ev);let label='';
    if(drag.kind==='dev'){P.setDev(drag.di,p.u,p.v);
      const dv=data.devices[drag.di]||{};label=(DEV[dv.type]||'')+' '+DEV_BOX_W+'×'+DEV_BOX_H+'mm';}
    else if(drag.kind==='op'&&P.setOpening){P.setOpening(drag.oi,p.u);
      const oo=data.openings[drag.oi]||{};label=(oo.w||0)+'×'+(oo.h||0)+'mm';}
    else if(drag.kind==='node'){P.setNode(drag.pi,drag.ni,p.u,p.v);label='csomópont';}
    else if(drag.kind==='seg'){const du=p.u-drag.su,dv=p.v-drag.sv;
      P.setNode(drag.pi,drag.na,drag.oa.u+du,drag.oa.v+dv);
      P.setNode(drag.pi,drag.nb,drag.ob.u+du,drag.ob.v+dv);
      label='szakasz ↔ '+Math.round(du)+' / ↕ '+Math.round(dv)+' mm';}
    else if(drag.kind==='warp'){let sx=1,sy=1;          // free transform about the opposite corner/edge
      if(drag.hx!==0.5){const d0=drag.startU-drag.anchorU;if(Math.abs(d0)>1)sx=(p.u-drag.anchorU)/d0;}
      if(drag.hy!==0.5){const d1=drag.startV-drag.anchorV;if(Math.abs(d1)>1)sy=(p.v-drag.anchorV)/d1;}
      drag.nodes.forEach(n=>P.setNode(drag.pi,n.ni,drag.anchorU+(n.u-drag.anchorU)*sx,
                                                   drag.anchorV+(n.v-drag.anchorV)*sy));
      label='warp ×'+sx.toFixed(2)+' / ×'+sy.toFixed(2);}
    else if(drag.kind==='note'){P.setNote(drag.ni2,p.u,p.v);label='jegyzet';}
    if(P.badge!==false)setBadge(p.u,Math.max(0,p.v),label);
    draw();soft();});

  const end=ev=>{if(!drag)return;drag=null;E.drag=null;
    try{svgEl.releasePointerCapture(ev.pointerId);}catch(_){}
    P.full();draw();};
  svgEl.addEventListener('pointerup',end);
  svgEl.addEventListener('pointercancel',end);

  // left click while drawing → next node
  svgEl.addEventListener('pointerdown',ev=>{if(E.drawPi==null||ev.button!==0)return;
    const p=local(ev);P.addNode(p.u,p.v);});
  // right click → whatever is under it
  svgEl.addEventListener('contextmenu',ev=>{ev.preventDefault();const p=local(ev);P.menu(ev,p.u,p.v);});
  return {rebind:bind};
}

// shared hit-testing on a surface (same data shape for every projection)
function edHitDevice(d,u,v,extra){let hit=null,best=1e9;
  (d.devs||[]).filter(x=>!x.back).forEach(dv=>{
    const r=(dv.type==='junction'?(dv.jbSize||80)/2:DEV_BOX_W/2)+(extra||30);
    const dist=Math.hypot(dv.u-u,dv.h-v);if(dist<r&&dist<best){best=dist;hit=dv;}});
  return hit;}
function edHitSection(d,u,v,tol){let hit=null,best=1e9;
  (d.secs||[]).filter(t=>!t.back).forEach(t=>{const ds=wvDistSeg(u,v,t.ua,t.ha,t.ub,t.hb);
    if(ds<(tol||120)&&ds<best){best=ds;hit=t;}});
  return hit;}
// strip the outer <svg> so children can be swapped without replacing the element
function edInner(svg){return svg.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');}

// test hooks
window.edBindSurface=edBindSurface;window.edInner=edInner;window.edHitDevice=edHitDevice;
window.edHitSection=edHitSection;window.edMount=edMount;
window.edDragScope=edDragScope;
