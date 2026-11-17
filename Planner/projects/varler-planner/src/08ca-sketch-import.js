// ==========================================================================
// 08ca-sketch-import.js — VRG Mobile Vázlat (Mobile WP M24): the field sketch, imported and marked
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// On site the phone sketches the flat roughly (rectangles or a lineout), takes some of the sizes, places the
// installation points, circuits, the Elosztó and the nyomvonal. Its solver (Mobile/android/sketch-core, Solver.kt)
// turns that into millimetres and writes a PACKAGE: {kind:'vrg-sketch', v:1, name, level, sketch:<raw>,
// plan:{center, report, data:{floors, devices, circuits, paths, notes, seq}}} — the Planner's own records with ids.
// "Terv betöltése fájlból" recognises it here and opens it as a new project; nothing else in the Planner changes.
//
//   rooms come as Helyiség-toll records (stage 'outline', clear: inner sizes), so Falak / Padlók létrehozása
//   (WP-F3 / F4) build them as for a pen-drawn room. Every record carries sk {src:'vazlat', id, …}.
//
// THE MARK. A size the sketch did not measure and could not derive from other sizes took the sketch's proportions:
// fl.sk.est lists those edges. They are drawn here as an orange dashed line with "≈ <length>" and the room gets a
// faint orange fill and "≈ becsült méret", on screen and in print, until "Vázlat: méretek ellenőrizve" clears them.
// A floor without sk.est draws nothing new, so every golden render stays byte-identical. Prefix: ski.

const SKI_COL='#d0701e';
function skiIs(o){return !!(o&&o.kind==='vrg-sketch'&&o.plan&&o.plan.data&&typeof o.plan.data==='object');}

// the package → a sessionObj-shaped payload (what applyProjectData loads)
function skiPayload(o){
  const b=blankBuilding();b.name=o.name||'Vázlat';
  const c=o.plan.center;if(Array.isArray(c)&&c.length>=2&&isFinite(c[0])&&isFinite(c[1]))b.center=[+c[0],+c[1]];
  const d=JSON.parse(JSON.stringify(o.plan.data));
  UKEYS.forEach(k=>{if(!Array.isArray(d[k]))d[k]=[];});
  // a route needs one section per segment (computeBOM reads pa.sections[si]); the Planner's own default build
  d.paths.forEach(pa=>{if(!pa||!Array.isArray(pa.nodes))return;if(!Array.isArray(pa.sections))pa.sections=[];
    for(let i=pa.sections.length;i<pa.nodes.length-1;i++)pa.sections.push({build:'sull_gege',circuit:null});});
  const lvl=ORD.indexOf(o.level)>=0?o.level:'ground';
  // an Elosztó from the phone has no footprint yet: the Planner's own board defaults (09-menus)
  d.devices.forEach(dv=>{if(dv&&dv.type==='board'){const z=boardZ();if(dv.h==null||dv.sk)dv.h=z;dv.z=z;
    if(dv.rw==null)dv.rw=BOARD_RW;if(dv.rd==null)dv.rd=BOARD_RD;}});
  return {v:1,state:{active:lvl},data:d,building:b};}

// counts for the HUD line
function skiSummary(o){const d=o.plan.data,r=o.plan.report||{};
  const n=k=>Array.isArray(d[k])?d[k].length:0;
  const est=(d.floors||[]).reduce((t,f)=>t+((f&&f.sk&&Array.isArray(f.sk.est))?f.sk.est.length:0),0);
  let s=`Vázlat betöltve: ${n('floors')} helyiség, ${n('devices')} pont, ${n('circuits')} áramkör, ${n('paths')} nyomvonal, ${n('notes')} jegyzet`;
  if(est)s+=` · ${est} becsült fal (narancs ≈)`;
  if(Array.isArray(r.conflicts)&&r.conflicts.length)s+=` · ${r.conflicts.length} ellentmondó méret`;
  return s;}

function skiImport(o){const payload=skiPayload(o);
  const id=saveProject((o.name||'Vázlat')+' (vázlat)');const ix=loadProjIndex();ix[id].data=payload;saveProjIndex(ix);
  loadProject(id);$('hud').textContent=skiSummary(o);return id;}

// ---- the mark ---------------------------------------------------------------------------------------------------------
function skiEst(fl){return fl&&fl.sk&&Array.isArray(fl.sk.est)&&fl.sk.est.length&&fl.poly&&fl.poly.length>=3?fl.sk.est:null;}
function skiFmt(mm){return String(Math.round(mm)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
function skiMarkSvg(){let s='';
  for(const l of ORD){if(!state.levels[l])continue;const z=dz(l,0);
    data.floors.forEach((fl,i)=>{const est=skiEst(fl);if(!est||fl.level!==l||!layerShows(fl,'build'))return;
      if(state.soloRoom&&!soloRoomIs({src:'F',i,level:l}))return;
      const P=fl.poly,n=P.length;
      s+=`<polygon class="ski-room" points="${p2b(P.map(p=>[p[0],p[1],z]))}" fill="${SKI_COL}" fill-opacity="0.07" stroke="none"/>`;
      est.forEach(k=>{if(!(k>=0&&k<n))return;const a=P[k],b=P[(k+1)%n];
        s+=`<line class="ski-edge" x1="${planToBase(a[0],a[1],z)[0].toFixed(1)}" y1="${planToBase(a[0],a[1],z)[1].toFixed(1)}" x2="${planToBase(b[0],b[1],z)[0].toFixed(1)}" y2="${planToBase(b[0],b[1],z)[1].toFixed(1)}" stroke="${SKI_COL}" stroke-width="${vsP(2.6)}" stroke-dasharray="${vsDash('3 4')}"/>`;
        if(l!==state.active)return;
        const m=planToBase((a[0]+b[0])/2,(a[1]+b[1])/2,z);
        s+=`<text class="ski-len" x="${m[0].toFixed(1)}" y="${(m[1]+vsP(14)).toFixed(1)}" font-size="${vsP(10)}" text-anchor="middle" fill="${SKI_COL}" font-weight="700" stroke="#fff" stroke-width="${vsP(3)}" paint-order="stroke">≈ ${skiFmt(Math.hypot(b[0]-a[0],b[1]-a[1]))}</text>`;});
      if(l!==state.active)return;
      const c=wfpCentroid(P),cb=planToBase(c[0],c[1],z);
      s+=`<text class="ski-tag" x="${cb[0].toFixed(1)}" y="${(cb[1]+vsP(25)).toFixed(1)}" font-size="${vsP(9.5)}" text-anchor="middle" fill="${SKI_COL}" font-weight="700" stroke="#fff" stroke-width="${vsP(3)}" paint-order="stroke">≈ becsült méret</text>`;});}
  return s;}
// like the Helyiség-toll's outline: the scene normally, the overlay in the clean styles (they skip STK_SCENE)
STK_SCENE.push(()=>wfpCleanStyle()?'':skiMarkSvg());
STK_OVERLAY.push(()=>wfpCleanStyle()?skiMarkSvg():'');

// the user checked the sizes on the drawing: the marks go (one undo step)
function skiConfirm(level){let n=0;
  const fls=data.floors.filter(fl=>skiEst(fl)&&(!level||fl.level===level));if(!fls.length)return 0;
  pushUndo(UNDO_SCOPE.floor);
  fls.forEach(fl=>{n+=fl.sk.est.length;fl.sk.der=(fl.sk.der||[]).concat(fl.sk.est);fl.sk.est=[];fl.sk.checked=true;});
  draw();scheduleSave&&scheduleSave();return n;}
function skiHasMarks(){return data.floors.some(fl=>skiEst(fl));}

registerActions([{id:'sketch.confirm',label:'Vázlat: méretek ellenőrizve',icon:'≈',group:'Helyiség',
  alias:'vazlat sketch becsult meret ellenorizve inferred estimate mobile',
  hint:'A telefonos vázlat becsült (≈) falméretei ezen a szinten ellenőrizve: a narancs jelölés eltűnik.',
  need:'Nincs becsült méret ezen a szinten.',when:()=>data.floors.some(fl=>skiEst(fl)&&fl.level===state.active),
  run:()=>{const n=skiConfirm(state.active);$('hud').textContent=n?`${n} becsült fal ellenőrzöttnek jelölve.`:'Nincs becsült méret.';}}]);
