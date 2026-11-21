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
//
// FOTÓPONT (Mobile WP M25). A photo point is a hidden note {sk:{photo:true, room, shots:[{deg, side, file}]}}: deg 0 =
// up on the plan, clockwise (D-24 = A: the four sides of the room as drawn). Each photo reached the PC as its own file
// on the Átadás board (D-25 = A, inbox\board\<date>\), under `file`. The point and a view cone per side are drawn on
// the overlay (an editing aid, not printed): filled = a photo exists, darker once it is attached here. "Vázlat: fotók"
// lists them; attaching the board files there keeps a small thumbnail (≤ 360 px) in the project for each, matched by
// file name, so the room can be looked at from the Planner. The full photos stay files on the PC.

const SKI_COL='#d0701e';
function skiIs(o){return !!(o&&o.kind==='vrg-sketch'&&o.plan&&o.plan.data&&typeof o.plan.data==='object');}

// the package → a sessionObj-shaped payload (what applyProjectData loads)
function skiPayload(o){
  const b=blankBuilding();b.name=o.name||'Vázlat';
  if(typeof svyFromPackage==='function'){const sv=svyFromPackage(o);if(sv)b.survey=sv;}   // the intake + takeoff (08cb)
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
function skiIsPhoto(n){return !!(n&&n.sk&&n.sk.photo&&Array.isArray(n.sk.shots));}
function skiSummary(o){const d=o.plan.data,r=o.plan.report||{};
  const ph=(d.notes||[]).filter(skiIsPhoto),shots=ph.reduce((t,n)=>t+n.sk.shots.length,0);
  const n=k=>Array.isArray(d[k])?(k==='notes'?d[k].length-ph.length:d[k].length):0;
  const est=(d.floors||[]).reduce((t,f)=>t+((f&&f.sk&&Array.isArray(f.sk.est))?f.sk.est.length:0),0);
  let s=`Vázlat betöltve: ${n('floors')} helyiség, ${n('devices')} pont, ${n('circuits')} áramkör, ${n('paths')} nyomvonal, ${n('notes')} jegyzet`;
  if(ph.length)s+=`, ${ph.length} fotópont (${shots} fotó)`;
  if(est)s+=` · ${est} becsült fal (narancs ≈)`;
  if(Array.isArray(r.conflicts)&&r.conflicts.length)s+=` · ${r.conflicts.length} ellentmondó méret`;
  return s;}

function skiImport(o){const payload=skiPayload(o);
  const id=saveProject((o.name||'Vázlat')+' (vázlat)');const ix=loadProjIndex();ix[id].data=payload;saveProjIndex(ix);
  loadProject(id);$('hud').textContent=skiSummary(o)+(typeof svySummary==='function'?svySummary(svySurvey()):'');return id;}

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

// ---- Fotópont (M25) -------------------------------------------------------------------------------------------------
const SKI_PH={cone:900,half:Math.PI/6,col:'#2a8cdb'};
function skiPhotos(level){return data.notes.filter(n=>skiIsPhoto(n)&&(!level||n.level===level));}
// a side's direction on the plan (y down): 0 = up, 90 = right …
function skiDir(deg){const a=(deg%360)*Math.PI/180;return [Math.sin(a),-Math.cos(a)];}
function skiPhotoSvg(){let s='';
  for(const l of ORD){if(!state.levels[l])continue;const z=dz(l,0);
    skiPhotos(l).forEach(n=>{if(!layerShows(n,'note'))return;const shots=n.sk.shots;
      [0,90,180,270].forEach(deg=>{const sh=shots.find(x=>((x.deg%360)+360)%360===deg),[dx,dy]=skiDir(deg);
        const rot=(t)=>[dx*Math.cos(t)-dy*Math.sin(t),dx*Math.sin(t)+dy*Math.cos(t)];
        const a=rot(-SKI_PH.half),b=rot(SKI_PH.half),L=SKI_PH.cone;
        const pts=[[n.x,n.y,z],[n.x+a[0]*L,n.y+a[1]*L,z],[n.x+b[0]*L,n.y+b[1]*L,z]];
        s+=sh?`<polygon class="ski-cone" points="${p2b(pts)}" fill="${SKI_PH.col}" fill-opacity="${sh.thumb?0.5:0.25}" stroke="${SKI_PH.col}" stroke-width="${vsP(1)}"/>`
             :`<polygon class="ski-cone-empty" points="${p2b(pts)}" fill="none" stroke="#8a857b" stroke-width="${vsP(0.8)}" stroke-dasharray="${vsDash('3 3')}"/>`;});
      const c=planToBase(n.x,n.y,z);
      s+=`<circle class="ski-photo" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${vsP(6)}" fill="#fff" stroke="${SKI_PH.col}" stroke-width="${vsP(2)}"/>`;
      if(l===state.active)s+=`<text x="${c[0].toFixed(1)}" y="${(c[1]-vsP(10)).toFixed(1)}" font-size="${vsP(9)}" text-anchor="middle" fill="${SKI_PH.col}" font-weight="700" stroke="#fff" stroke-width="${vsP(3)}" paint-order="stroke">📷 ${shots.length}/4</text>`;});}
  return s;}
STK_OVERLAY.push(()=>skiPhotoSvg());

// a small JPEG thumbnail of an image file, or null where there is no canvas (jsdom) or the file is no image
function skiThumb(file,max){max=max||360;return new Promise(res=>{try{
  const cv=document.createElement('canvas'),g=cv.getContext&&cv.getContext('2d');if(!g||typeof Image==='undefined'){res(null);return;}
  const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height));
      cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);g.drawImage(im,0,0,cv.width,cv.height);
      try{res(cv.toDataURL('image/jpeg',0.72));}catch(_){res(null);}};im.onerror=()=>res(null);im.src=fr.result;};
  fr.onerror=()=>res(null);fr.readAsDataURL(file);}catch(_){res(null);}});}

// board files → the shots that name them; a file no shot names is reported, not kept. One undo step.
async function skiAttach(files,thumbFn){thumbFn=thumbFn||skiThumb;const byName={};
  skiPhotos().forEach(n=>n.sk.shots.forEach(sh=>{byName[sh.file]=sh;}));
  const hits=[],unknown=[];for(const f of Array.from(files||[])){(byName[f.name]?hits:unknown).push(f);}
  if(hits.length)pushUndo(['notes']);
  for(const f of hits){const th=await thumbFn(f);const sh=byName[f.name];sh.seen=true;if(th)sh.thumb=th;}
  if(hits.length){draw();scheduleSave&&scheduleSave();}
  return {matched:hits.length,unknown:unknown.map(f=>f.name)};}

function skiPhotoListHtml(){const ph=skiPhotos();
  if(!ph.length)return '<div class="mrow">Nincs fotópont.</div>';
  const SIDES=[[0,'É'],[90,'K'],[180,'D'],[270,'Ny']];
  return ph.map(n=>`<div class="mrow" style="flex-direction:column;align-items:stretch;gap:4px"><b>${esc(n.sk.room||'Fotópont')}</b>`
    +`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">`+SIDES.map(([d,lab])=>{const sh=n.sk.shots.find(x=>x.deg===d);
      if(!sh)return `<div style="font-size:11px;color:var(--pc-faint,#aaa)">${lab}: nincs fotó</div>`;
      return `<div style="font-size:11px">${lab}${sh.thumb?`<br><img class="skiTh" src="${sh.thumb}" alt="${esc(sh.file)}" style="width:100%;cursor:zoom-in;border-radius:4px">`
        :`<br><span style="color:var(--pc-mute,#888);word-break:break-all">${esc(sh.file)}</span>${sh.seen?'':' <i>(nincs csatolva)</i>'}`}</div>`;}).join('')
    +`</div></div>`).join('');}
function skiOpenPhotos(){
  const body=`<div id="skiList">${skiPhotoListHtml()}</div>`
    +`<div class="mrow"><label>Fotók csatolása (a PC tábláról): <input type="file" id="skiPick" accept="image/*" multiple></label></div>`
    +`<div class="mrow" id="skiMsg" style="font-size:11px;color:var(--pc-mute,#888)">A telefon a fotókat az Átadás táblára küldi (inbox\\board\\&lt;dátum&gt;\\). Jelöld ki őket egyszerre: a fájlnév alapján a helyükre kerülnek.</div>`;
  openModal('Vázlat: fotók',body,()=>true,'Kész');
  const wire=()=>{document.querySelectorAll('#skiList .skiTh').forEach(im=>{im.onclick=()=>{im.style.width=im.style.width==='100%'?'240%':'100%';};});};wire();
  $('skiPick').onchange=async e=>{const r=await skiAttach(e.target.files);
    $('skiList').innerHTML=skiPhotoListHtml();wire();
    $('skiMsg').textContent=`${r.matched} fotó a helyére került.`+(r.unknown.length?` Nem ehhez a vázlathoz: ${r.unknown.join(', ')}.`:'');e.target.value='';};}
registerActions([{id:'sketch.photos',label:'Vázlat: fotók',icon:'📷',group:'Helyiség',
  alias:'vazlat fotopont photo foto kamera mobile sketch',
  hint:'A telefonos vázlat fotópontjai: szobánként négy irány, a fotók csatolása a PC táblájáról.',
  need:'Nincs fotópont a tervben.',when:()=>skiPhotos().length>0,run:()=>skiOpenPhotos()}]);
