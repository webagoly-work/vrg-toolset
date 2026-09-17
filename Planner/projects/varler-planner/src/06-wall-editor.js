// ==========================================================================
// 05-wall-editor.js — wall elevation editor: chases, notes, action rail, session, links, list
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
// ---- Wall View: 2D elevation of a selected wall ----
function devMini(type,x,y,col){
  if(type==='socket')return `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="${col}" stroke-width="1.4"/><line x1="${x-3}" y1="${y}" x2="${x+3}" y2="${y}" stroke="${col}" stroke-width="1.4"/>`;
  if(type==='switch')return `<rect x="${x-5.5}" y="${y-5.5}" width="11" height="11" rx="2" fill="#fff" stroke="${col}" stroke-width="1.4"/><line x1="${x-2}" y1="${y+3}" x2="${x+3}" y2="${y-3}" stroke="${col}" stroke-width="1.2"/>`;
  if(type==='light')return `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="${col}" stroke-width="1.4"/><line x1="${x-4}" y1="${y-4}" x2="${x+4}" y2="${y+4}" stroke="${col}"/><line x1="${x+4}" y1="${y-4}" x2="${x-4}" y2="${y+4}" stroke="${col}"/>`;
  if(type==='board')return `<rect x="${x-8}" y="${y-8}" width="16" height="16" rx="2" fill="#fff" stroke="${col}" stroke-width="1.6"/><text x="${x}" y="${y+4}" font-size="10" text-anchor="middle" fill="${col}" font-weight="700">T</text>`;
  return `<rect x="${x-5}" y="${y-5}" width="10" height="10" fill="#fff" stroke="${col}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="1.7" fill="${col}"/>`;}
// elevation editor constants: device mounting-box size + chase (chase = size × adjustable factor)
const DEV_BOX_W=68, DEV_BOX_H=68;   // Szerelvénydoboz standard 68mm ⌀
const DEV_CLIP_SPACING=72;          // two clipped boxes: 72mm centre-to-centre
// wall-mount device catalogue: flush-mount plate sizes (mm) + gyártói cikkszám. Shown as a RECTANGLE over the box.
const DEVICE_CATALOG=[
  {id:'valena_socket_2p',brand:'Valena Life',name:'Csatlakozóaljzat 2P+F',cikk:'753120',w:81,h:81},
  {id:'valena_switch_1',brand:'Valena Life',name:'Egypólusú kapcsoló',cikk:'752001',w:81,h:81},
  {id:'valena_switch_alt',brand:'Valena Life',name:'Váltókapcsoló',cikk:'752006',w:81,h:81},
  {id:'valena_dimmer',brand:'Valena Life',name:'Fényerőszabályzó',cikk:'752060',w:81,h:81},
  {id:'valena_usb',brand:'Valena Life',name:'USB töltő A+C',cikk:'753124',w:81,h:81},
  {id:'valena_blind',brand:'Valena Life',name:'Redőnykapcsoló',cikk:'752030',w:81,h:81},
  {id:'schneider_socket_2p',brand:'Schneider Asfora',name:'Dugalj 2P+F',cikk:'EPH2900121',w:80,h:80},
  {id:'schneider_switch_1',brand:'Schneider Asfora',name:'Egypólusú kapcsoló',cikk:'EPH0100121',w:80,h:80},
  {id:'schneider_switch_alt',brand:'Schneider Asfora',name:'Váltókapcsoló',cikk:'EPH0400121',w:80,h:80},
  {id:'schneider_2socket',brand:'Schneider Asfora',name:'Dupla dugalj',cikk:'EPH9800121',w:157,h:80},
  {id:'schneider_thermostat',brand:'Schneider',name:'Termosztát',cikk:'MTN5775',w:80,h:80}];
function deviceCat(id){return DEVICE_CATALOG.find(x=>x.id===id)||null;}
// ---- chase (véset) model: width comes from the REAL conduit diameter, depth is the cut depth ----
const PATH_DIA=[16,20,25,32];            // gégecső standard diameters (mm) — chosen by wire count
// per-section override sec.dia, else a sensible default from the build type
function chaseDia(build,sec){if(sec&&sec.dia)return +sec.dia;build=build||'';
  if(build.indexOf('szeles')>=0)return 32;if(build.indexOf('kv_')===0)return 20;return 20;}
function pathDia(build,sec){return chaseDia(build,sec);}                       // legacy alias
function chaseDepthOf(sec,dia){if(sec&&sec.cd)return +sec.cd;return dia<=25?30:35;}   // 30 mm to ⌀25, 35 mm for ⌀32
function chaseWidthOf(dia){return Math.max(20,Math.round(dia*(state.chaseFactor||1.6)));}
// geometry of every chase area on this wall, in PIXEL space (so they can be unioned + masked)
function wvChaseShapes(d,X,Y,sc){const out=[];
  d.secs.filter(t=>!t.back&&(t.build||'').indexOf('sull')>=0).forEach(t=>{
    const dia=chaseDia(t.build,t),w=chaseWidthOf(dia),dep=chaseDepthOf(t,dia);
    const x1=X(t.ua),y1=Y(t.ha),x2=X(t.ub),y2=Y(t.hb),L=Math.hypot(x2-x1,y2-y1);if(L<0.05)return;
    const ux=(x2-x1)/L,uy=(y2-y1)/L,hw=w*sc/2;
    const ax=x1-ux*hw,ay=y1-uy*hw,bx=x2+ux*hw,by=y2+uy*hw;   // square caps → runs merge cleanly at corners/boxes
    const nx=-uy*hw,ny=ux*hw;
    out.push({kind:'path',pi:t.pi,na:t.na,dia,w,dep,mm:Math.hypot(t.ub-t.ua,t.hb-t.ha),
      mx:(x1+x2)/2,my:(y1+y2)/2,ang:Math.atan2(y2-y1,x2-x1),nx:-uy,ny:ux,hw:hw,
      poly:[{x:ax+nx,y:ay+ny},{x:bx+nx,y:by+ny},{x:bx-nx,y:by-ny},{x:ax-nx,y:ay-ny}]});});
  const pad=(state.chasePad!=null?state.chasePad:4);
  d.devs.filter(x=>!x.back&&x.type!=='board').forEach(dv=>{
    const base=(dv.type==='junction'?(dv.jbSize||80):DEV_BOX_W),bw=base+pad,bh=base+pad;
    const x=X(dv.u),y=Y(dv.h),hw=bw*sc/2,hh=bh*sc/2;
    out.push({kind:'box',di:dv.di,dia:base,w:bw,dep:(state.boxDepth||45),mm:0,mx:x,my:y,ang:0,
      poly:[{x:x-hw,y:y-hh},{x:x+hw,y:y-hh},{x:x+hw,y:y+hh},{x:x-hw,y:y+hh}]});});
  out.forEach(o=>{const xs=o.poly.map(p=>p.x),ys=o.poly.map(p=>p.y);
    o.bb=[Math.min.apply(null,xs),Math.min.apply(null,ys),Math.max.apply(null,xs),Math.max.apply(null,ys)];});
  return out;}
function ptInPolyPx(px,py,P){let inside=false;
  for(let i=0,j=P.length-1;i<P.length;j=i++){const xi=P[i].x,yi=P[i].y,xj=P[j].x,yj=P[j].y;
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))inside=!inside;}
  return inside;}
// union outline: keep only the edge pieces that are NOT inside another chase → one merged contour, no inner seams
function chaseOutline(shapes){const segs=[];
  shapes.forEach((S,si)=>{const P=S.poly;
    const cx=P.reduce((a,p)=>a+p.x,0)/P.length,cy=P.reduce((a,p)=>a+p.y,0)/P.length;
    for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],L=Math.hypot(b.x-a.x,b.y-a.y);if(L<0.05)continue;
      const n=Math.max(2,Math.min(200,Math.ceil(L/2)));let run=null;
      const at=t=>[a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t];
      for(let k=0;k<n;k++){const t0=k/n,tm=(k+0.5)/n;
        const m=at(tm),dx=cx-m[0],dy=cy-m[1],dl=Math.hypot(dx,dy)||1;
        const qx=m[0]+dx/dl*0.7,qy=m[1]+dy/dl*0.7;   // nudge just inside this shape, then test the others
        let hid=false;
        for(let j=0;j<shapes.length&&!hid;j++){if(j===si)continue;const B=shapes[j].bb;
          if(qx<B[0]||qx>B[2]||qy<B[1]||qy>B[3])continue;
          if(ptInPolyPx(qx,qy,shapes[j].poly))hid=true;}
        if(!hid){if(run===null)run=t0;}
        else if(run!==null){const s0=at(run),s1=at(t0);segs.push([s0[0],s0[1],s1[0],s1[1]]);run=null;}}
      if(run!==null){const s0=at(run);segs.push([s0[0],s0[1],b.x,b.y]);}}});
  return segs;}
// summary text, wrapped to the sheet width (quote-ready: running metres per width×depth + pocket counts)
function chaseSummaryLines(shapes,maxPx){const sum=chaseSummary(shapes),parts=[];
  Object.keys(sum.grp).sort().forEach(k=>parts.push(k+' mm — '+(sum.grp[k]/1000).toFixed(2)+' m'));
  Object.keys(sum.pk).sort().forEach(k=>parts.push('fészek '+k+' mm — '+sum.pk[k]+' db'));
  if(!parts.length)return [];
  const lines=[];let cur='Véset (szél.×mély.): ';const lim=Math.max(40,(maxPx||600)/5.2);
  parts.forEach((p,i)=>{const add=(i?'   ·   ':'')+p;
    if(cur.length+add.length>lim){lines.push(cur);cur='    '+p;}else cur+=add;});
  lines.push(cur);return lines;}
// running metres per width×depth group + pocket counts (quote-ready)
function chaseSummary(shapes){const grp={},pk={};
  shapes.forEach(S=>{const k=S.w+'×'+S.dep;
    if(S.kind==='box')pk[k]=(pk[k]||0)+1;else grp[k]=(grp[k]||0)+S.mm;});
  return {grp,pk};}
// renders one device in the elevation as a hollow Szerelvénydoboz (68mm ⌀), with the defined wall-mount plate
// rectangle overlaid on top when dv.devDef is set. sc = mm→px scale. col = stroke; boxCol = optional per-box fill.
function wvKindCode(dv){return (dv.kind&&DEVKIND[dv.kind])?DEVKIND[dv.kind].s:(dv.lv?'LV':'');}
function wvDevBox(dv,x,y,sc,col,back){const r=(DEV_BOX_W/2)*sc;let s='';
  const fill=dv.boxColor||'#fff';
  // Kötődoboz: 80mm circle OR rectangle (dv.jbShape)
  if(dv.type==='junction'){const jr=((dv.jbSize||80)/2)*sc;
    if(dv.jbShape==='rect')s+=`<rect x="${x-jr}" y="${y-jr}" width="${jr*2}" height="${jr*2}" rx="2" fill="${fill}" stroke="${col}" stroke-width="1.6"/>`;
    else s+=`<circle cx="${x}" cy="${y}" r="${jr}" fill="${fill}" stroke="${col}" stroke-width="1.6"/>`;
    s+=`<text x="${x}" y="${y+3}" font-size="${Math.max(7,jr*0.7)}" text-anchor="middle" fill="${col}">KD</text>`;return s;}
  if(dv.type==='board')return devMini('board',x,y,col);
  // Szerelvénydoboz hollow mount (68mm circle)
  s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${col}" stroke-width="1.4" stroke-dasharray="${dv.devDef?'':'3 2'}"/>`;
  const def=deviceCat(dv.devDef);
  if(def){ // defined device: overlay the flush-mount plate rectangle at real size
    const pw=def.w*sc,ph=def.h*sc;
    s+=`<rect x="${x-pw/2}" y="${y-ph/2}" width="${pw}" height="${ph}" rx="${3*sc}" fill="none" stroke="${back?col:'#0a2b6b'}" stroke-width="1.5"/>`
      +`<rect x="${x-pw*0.16}" y="${y-ph*0.16}" width="${pw*0.32}" height="${ph*0.32}" fill="none" stroke="${back?col:'#0a2b6b'}" stroke-width="1"/>`;
  } else { // undefined mount — a small dot to show it's an empty box
    s+=`<circle cx="${x}" cy="${y}" r="${Math.max(1.4,r*0.12)}" fill="${col}"/>`;}
  const kc=wvKindCode(dv);
  if(kc)s+=`<text x="${x}" y="${y-r-3}" font-size="${Math.max(7,r*0.55)}" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round">${esc(kc)}</text>`
        +`<text x="${x}" y="${y-r-3}" font-size="${Math.max(7,r*0.55)}" text-anchor="middle" fill="${back?col:'#5a5348'}">${esc(kc)}</text>`;
  return s;}
function wallElevationData(r,level){const z0=r.z0||0,H=z0+(r.h||wallH(level));
  const horiz=(r.x1-r.x0)>=(r.y1-r.y0),len=horiz?(r.x1-r.x0):(r.y1-r.y0);
  const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,thick=horiz?(r.y1-r.y0):(r.x1-r.x0);
  const ox=horiz?r.x0:cx,oy=horiz?cy:r.y0,ax=horiz?1:0,ay=horiz?0:1,px=horiz?0:1,py=horiz?1:0;
  const uOf=(X,Y)=>(X-ox)*ax+(Y-oy)*ay,sOfRaw=(X,Y)=>(X-cx)*px+(Y-cy)*py,tol=thick/2+250,inR=u=>u>-200&&u<len+200;
  const sflip=(typeof WV!=='undefined'&&WV&&WV.flipSide)?-1:1;const sOf=(X,Y)=>sOfRaw(X,Y)*sflip;
  const ops=[];data.openings.forEach((o,oi)=>{if(o.level!==level||o.type==='stairs'||!layerShows(o,'build'))return;const u=uOf(o.x,o.y);
    if(Math.abs(sOf(o.x,o.y))<tol&&inR(u)){const win=o.type==='window';ops.push({oi,type:o.type,u,w:o.w||(win?WIN_W:DOOR_W),h:o.h||(win?WIN_H:DOOR_H),sill:win?(o.sill!=null?o.sill:WIN_SILL):0});}});
  const devs=[];data.devices.forEach(dv=>{if(dv.level!==level||!layerShows(dv,'device'))return;const u=uOf(dv.x,dv.y),ss=sOf(dv.x,dv.y);
    if(Math.abs(ss)<tol&&inR(u))devs.push({di:data.devices.indexOf(dv),type:dv.type,ref:dv.ref||'',u,h:dv.h||0,back:ss<-1,
      devDef:dv.devDef,boxColor:dv.boxColor,jbShape:dv.jbShape,jbSize:dv.jbSize,clip:dv.clip,link:dv.link});});
  const secs=[];data.paths.forEach((pa,pi)=>{if(!layerShows(pa,'path'))return;for(let i=0;i<pa.nodes.length-1;i++){const a=pa.nodes[i],b=pa.nodes[i+1];if(a.level!==level||b.level!==level)continue;
    const sa=sOf(a.x,a.y),sb=sOf(b.x,b.y);if(Math.abs(sa)<tol&&Math.abs(sb)<tol){const ua=uOf(a.x,a.y),ub=uOf(b.x,b.y);
      if(inR(Math.max(ua,ub))&&inR(Math.min(ua,ub))){const sec=pa.sections[i]||{build:'sull_gege'};
        secs.push({pi,na:i,nb:i+1,ua,ub,ha:a.h||0,hb:b.h||0,build:sec.build,dia:sec.dia,cd:sec.cd,carried:(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]),back:(sa+sb)/2<-1});}}}});
  const notes=[];const __nk=wallKey(r,level);
  if(!noteSurfaceHidden(__nk))(data.wallNotes||[]).forEach((nt,i)=>{if(nt.wallKey!==__nk)return;
    notes.push({i,u:nt.u,h:nt.h,text:nt.text,kind:nt.kind,tag:nt.tag});});
  return {H,z0,len,thick,level,ops,devs,secs,horiz,notes};}
// ---- NOTES: a proper annotation object, not a bare string ----
const NOTEKIND={
  info:{n:'Megjegyzés',   bg:'#fffbe6',bd:'#d9c86a',fg:'#6a5a10',ic:'📝'},
  warn:{n:'Figyelmeztetés',bg:'#fff0e6',bd:'#e8641c',fg:'#a03c06',ic:'⚠'},
  todo:{n:'Teendő',       bg:'#e9f2ff',bd:'#2f6fb0',fg:'#1c4f86',ic:'☐'},
  done:{n:'Kész',         bg:'#eaf7ec',bd:'#3fae55',fg:'#1f6b33',ic:'✔'},
  dim: {n:'Méret / adat', bg:'#f2f0fa',bd:'#7a5cc0',fg:'#4a3585',ic:'📐'}};
function noteKind(n){return (n&&n.kind&&NOTEKIND[n.kind])?n.kind:'info';}
// wrap to ~30 characters so a note can hold a real sentence instead of a label
function noteLines(txt,maxCh){maxCh=maxCh||30;const out=[];
  String(txt||'').split(/\n/).forEach(par=>{let line='';
    par.split(/\s+/).forEach(wd=>{if(!line){line=wd;return;}
      if((line+' '+wd).length<=maxCh)line+=' '+wd;else{out.push(line);line=wd;}});
    out.push(line);});
  return out.slice(0,8).filter((l,i,a)=>l!==''||a.length===1);}
// one renderer for both editors: kind colour, icon, multi-line body, optional leader dot
function noteBox(n,x,y,extraAttr){const k=noteKind(n),K=NOTEKIND[k],lines=noteLines(n.text);
  const fs=9.5,lh=11.6,pad=6,ic=K.ic+' ';
  const wch=Math.max(ic.length+4,...lines.map(l=>l.length+(l===lines[0]?ic.length:0)));
  const w=Math.max(44,wch*5.5+pad*2),h=lines.length*lh+pad*1.6;
  const x0=x-w/2,y0=y-h/2;
  let s=`<g class="wvnote" data-ni2="${n.i}" style="cursor:move"${extraAttr||''}>`
   +`<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${K.bg}" stroke="${K.bd}" stroke-width="1"${k==='done'?' opacity="0.75"':''}/>`;
  lines.forEach((ln,i)=>{s+=`<text x="${(x0+pad).toFixed(1)}" y="${(y0+pad+ (i+0.82)*lh - 2).toFixed(1)}" font-size="${fs}" fill="${K.fg}"${k==='done'?' text-decoration="line-through"':''}>${esc((i===0?ic:'')+ln)}</text>`;});
  // the tag sits ABOVE the box's top-right corner so it can never collide with the body text
  if(n.tag)s+=`<text x="${(x0+w).toFixed(1)}" y="${(y0-2.5).toFixed(1)}" font-size="7.5" text-anchor="end" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round">${esc(n.tag)}</text>`
            +`<text x="${(x0+w).toFixed(1)}" y="${(y0-2.5).toFixed(1)}" font-size="7.5" text-anchor="end" fill="${K.bd}">${esc(n.tag)}</text>`;
  return s+`</g>`;}
// the editing dialog — used from both editors (right-click or double-click a note)
function noteDialog(i,onDone){const n=(data.wallNotes||[])[i];if(!n)return;
  const opts=Object.keys(NOTEKIND).map(k=>`<option value="${k}" ${noteKind(n)===k?'selected':''}>${NOTEKIND[k].ic} ${NOTEKIND[k].n}</option>`).join('');
  wvOpenModal('Jegyzet szerkesztése',
     `<div class="mrow"><textarea id="ntTxt" rows="4" style="width:100%;font:inherit" placeholder="Több sor is lehet — a rajzon tördelve jelenik meg.">${esc(n.text||'')}</textarea></div>`
    +`<div class="mrow"><label style="width:80px">Típus</label><select id="ntKind" style="width:190px">${opts}</select>`
    +`<label style="margin-left:10px">Címke <input id="ntTag" value="${esc(n.tag||'')}" placeholder="pl. VF-03" style="width:80px"></label></div>`
    +`<div class="mrow" style="font-size:11px;color:#777">A típus adja a színt és az ikont; a „Kész” áthúzva, halványan jelenik meg. Húzással bárhová mozgatható, a koordináta-listában mm-re pontosan állítható.</div>`,
    ()=>{wvPush();n.text=$('ntTxt').value;n.kind=$('ntKind').value;
      const tg=$('ntTag').value.trim();if(tg)n.tag=tg;else delete n.tag;
      draw();if(onDone)onDone();},'Mentés');}
function noteMenu(ev,i,rerender){const it=noteItems(i,rerender);if(it)ctxMenu(ev,it);}
function noteItems(i,rerender){const n=(data.wallNotes||[])[i];if(!n)return null;
  const items=[{label:'✎ Szerkesztés…',act:()=>noteDialog(i,rerender)}];
  Object.keys(NOTEKIND).forEach(k=>{if(noteKind(n)===k)return;
    items.push({label:NOTEKIND[k].ic+' → '+NOTEKIND[k].n,act:()=>{wvPush();n.kind=k;rerender();draw();}});});
  items.push({label:'🗑 Törlés',act:()=>{wvPush();(data.wallNotes||[]).splice(i,1);rerender();draw();}});
  return items;}
function noteSurfaceHidden(key){return !!(data.noteHide&&data.noteHide[key]);}
function noteSurfaceToggle(key){data.noteHide=data.noteHide||{};
  if(data.noteHide[key])delete data.noteHide[key];else data.noteHide[key]=true;
  return !data.noteHide[key];}
function wallKey(r,level){return level+':'+Math.round(r.x0)+','+Math.round(r.y0)+','+Math.round(r.x1)+','+Math.round(r.y1);}
function wallElevationSVG(d,showFar,dims){const M=56,H=d.H,len=d.len;
  const full=!!(WV&&WV.full),vw=(typeof window!=='undefined'&&window.innerWidth)||1200,vh=(typeof window!=='undefined'&&window.innerHeight)||800;
  const AVW=full?Math.max(980,vw-120):980,AVH=full?Math.max(440,vh-250):440;   // fullscreen never shrinks the sheet
  const sc=Math.min((AVW-2*M)/Math.max(len,1),(AVH-2*M)/Math.max(H,1));
  const mir=(typeof WV!=='undefined'&&WV&&WV.mirror)?1:0;
  const X=u=>+(M+(mir?u:(len-u))*sc).toFixed(1),Y=v=>+(M+(H-v)*sc).toFixed(1);
  const L=(WV&&WV.layers)||{installed:true,cuts:true,notes:true,cutLabels:true};
  // chase geometry is needed before sizing (the summary adds lines under the drawing)
  const chS=L.cuts?wvChaseShapes(d,X,Y,sc):[];
  const cutLines=chS.length?chaseSummaryLines(chS,len*sc+2*M):[];
  const extra=dims?54:0,cutExtra=cutLines.length?(cutLines.length*12+4):0;
  const Wpx=Math.round(len*sc+2*M),Hpx=Math.round(H*sc+2*M+40+extra+cutExtra);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${Wpx}" height="${Hpx}" viewBox="0 0 ${Wpx} ${Hpx}" font-family="Segoe UI,Arial"><defs><pattern id="chaseh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#f7e2ce"/><line x1="0" y1="0" x2="0" y2="5" stroke="#c0794f" stroke-width="1"/><line x1="2.5" y1="0" x2="2.5" y2="5" stroke="#dfae8e" stroke-width="0.6"/></pattern></defs><rect width="${Wpx}" height="${Hpx}" fill="#fff"/>`;
  const z0=d.z0||0;
  s+=`<rect x="${Math.min(X(0),X(len))}" y="${Y(H)}" width="${(len*sc).toFixed(1)}" height="${((H-z0)*sc).toFixed(1)}" fill="#f4f2eb" stroke="#111" stroke-width="1.5"/>`;
  if(z0>0){ // the wall starts above the floor — the band underneath is open
    s+=`<rect x="${Math.min(X(0),X(len))}" y="${Y(z0)}" width="${(len*sc).toFixed(1)}" height="${(z0*sc).toFixed(1)}" fill="#fff" stroke="#999" stroke-width="0.8" stroke-dasharray="6 4"/>`
      +`<text x="${((X(0)+X(len))/2).toFixed(1)}" y="${(Y(z0/2)+3).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">nyitott sáv — a fal ${Math.round(z0)} mm-en indul</text>`
      +`<text x="${((X(0)+X(len))/2).toFixed(1)}" y="${(Y(z0/2)+3).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#8a8478">nyitott sáv — a fal ${Math.round(z0)} mm-en indul</text>`;}
  GUIDES.forEach(g=>{const shown=(WV&&WV.hLines)?!!WV.hLines[g.k]:guideOn[g.k];if(!shown)return;const mm=resolveMm(g,d.level);if(mm<0||mm>H)return;
    s+=`<line x1="${X(0)}" y1="${Y(mm)}" x2="${X(len)}" y2="${Y(mm)}" stroke="${g.c}" stroke-width="0.7" stroke-dasharray="2 4" opacity="0.6"/><text x="${X(len)-2}" y="${Y(mm)-2}" font-size="9" text-anchor="end" fill="${g.c}">${esc(g.l)}</text>`;});
  // ---- CUT LAYER (auto-generated chase areas for süllyesztett installs) — drawn under the installed layer ----
  if(L.cuts&&chS.length){const shapes=chS;
    {
      // ONE merged region: a single hatched rect clipped to the UNION of every chase polygon (clipPath children
      // union by spec) → no internal seams, and the 45° hatch runs continuously across joined chases.
      s+=`<clipPath id="cutclip">`
        +shapes.map(S=>`<polygon points="${S.poly.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')}"/>`).join('')
        +`</clipPath>`;
      s+=`<rect class="cutfill" width="${Wpx}" height="${Hpx}" fill="url(#chaseh)" clip-path="url(#cutclip)" opacity="0.92"/>`;
      chaseOutline(shapes).forEach(g=>{s+=`<line class="cutedge" x1="${g[0].toFixed(1)}" y1="${g[1].toFixed(1)}" x2="${g[2].toFixed(1)}" y2="${g[3].toFixed(1)}" stroke="#b07a5a" stroke-width="0.9" stroke-linecap="round"/>`;});
      if(!(WV&&WV.layers&&WV.layers.cutLabels===false))shapes.forEach(S=>{
        if(S.kind!=='path')return;const L=Math.hypot(S.poly[1].x-S.poly[0].x,S.poly[1].y-S.poly[0].y);if(L<74)return;
        let a=S.ang*180/Math.PI;if(a>90)a-=180;if(a<-90)a+=180;
        const off=S.hw+9,sgn=(S.ny>0?-1:1);           // sit just off the band, on the upper/left side
        const lx=S.mx+S.nx*off*sgn,ly=S.my+S.ny*off*sgn+2.5;
        const lt=`⌀${S.dia} · ${S.w}×${S.dep}`,tr=`rotate(${a.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})`;
        s+=`<text class="cutlbl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="${tr}" font-size="8.5" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">${lt}</text>`
          +`<text class="cutlbl" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" transform="${tr}" font-size="8.5" text-anchor="middle" fill="#8a5a3a">${lt}</text>`;});
      cutLines.forEach((ln,i)=>{s+=`<text class="cutsum" x="${M}" y="${Y(0)+(dims?58:34)+i*12}" font-size="9.5" fill="#8a5a3a">${esc(ln)}</text>`;});
    }}
  // ---- INSTALLED LAYER (paths + openings + devices at real sizes) ----
  if(L.installed){
  const warpPi=(WV&&WV.warp)?WV.warp.pi:null;
  const drawSec=back=>{const arr=d.secs.filter(x=>x.back===back);
    arr.forEach(t=>{const col=back?'#b0b4b8':(t.build.indexOf('kv_')===0?'#c0761d':'#6f757d');
      const sw=((t.build||'').indexOf('sull')>=0?Math.max(1.5,+(chaseDia(t.build,t)*sc).toFixed(2)):2.4);   // real conduit ⌀
      s+=`<line x1="${X(t.ua)}" y1="${Y(t.ha)}" x2="${X(t.ub)}" y2="${Y(t.hb)}" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${t.build.indexOf('kv_')===0?'':'6 3'}" stroke-linecap="round"/>`;
      // invisible fat grab line: drag = move the WHOLE section, Alt+click = warp mode for this path
      if(!back)s+=`<line class="wvseg" data-pi="${t.pi}" data-na="${t.na}" data-nb="${t.nb}" x1="${X(t.ua)}" y1="${Y(t.ha)}" x2="${X(t.ub)}" y2="${Y(t.hb)}" stroke="transparent" stroke-width="14" stroke-linecap="round" pointer-events="stroke" style="cursor:grab"/>`;
      if(t.carried.length){const mx=(X(t.ua)+X(t.ub))/2,my=(Y(t.ha)+Y(t.hb))/2,c=t.carried[0],n=t.carried.reduce((a,x)=>a+(x.count||1),0);
        s+=`<text x="${mx}" y="${my-4}" font-size="9" text-anchor="middle" fill="${back?'#b0b4b8':'#0a5c33'}" paint-order="stroke" stroke="#fff" stroke-width="2.4">${esc((c.name||'')+(c.num?' '+c.num:''))} ${n}ér</text>`;}});
    if(!back)arr.forEach(t=>{const col=(t.build.indexOf('kv_')===0?'#c0761d':'#6f757d'),hi=(t.pi===warpPi);
      s+=`<circle class="wvnode" data-pi="${t.pi}" data-ni="${t.na}" cx="${X(t.ua)}" cy="${Y(t.ha)}" r="4.5" fill="${hi?'#fff3d6':'#fff'}" stroke="${hi?'#e8641c':col}" stroke-width="1.6" style="cursor:move"/>`
        +`<circle class="wvnode" data-pi="${t.pi}" data-ni="${t.nb}" cx="${X(t.ub)}" cy="${Y(t.hb)}" r="4.5" fill="${hi?'#fff3d6':'#fff'}" stroke="${hi?'#e8641c':col}" stroke-width="1.6" style="cursor:move"/>`;});};
  if(showFar)drawSec(true);drawSec(false);
  d.ops.forEach(o=>{const x=Math.min(X(o.u-o.w/2),X(o.u+o.w/2)),y=Y(o.sill+o.h),w=(o.w*sc).toFixed(1),h=(o.h*sc).toFixed(1);
    s+=`<g class="wvop" data-oi="${o.oi}" style="cursor:ew-resize">`
      +`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="1.4"/>`;
    if(o.type==='window')s+=`<line x1="${x}" y1="${Y(o.sill+o.h/2)}" x2="${(+x+ +w)}" y2="${Y(o.sill+o.h/2)}" stroke="#2f6fb0"/><line x1="${X(o.u)}" y1="${y}" x2="${X(o.u)}" y2="${(+y+ +h)}" stroke="#2f6fb0"/>`;
    s+=`<text x="${X(o.u)}" y="${y-3}" font-size="9" text-anchor="middle" fill="#111">${o.type==='window'?'Ablak':'Ajtó'} ${o.w}×${o.h}${o.sill?'/'+o.sill:''}</text></g>`;});
  const drawDev=back=>d.devs.filter(x=>x.back===back).forEach(dv=>{const col=back?'#b0b4b8':'#111',x=X(dv.u),y=Y(dv.h);
    s+=`<g class="wvdev" data-di="${dv.di}" style="cursor:move">`+wvDevBox(dv,x,y,sc,col,back)
      +`<text x="${x+DEV_BOX_W/2*sc+3}" y="${y-7}" font-size="9" fill="${back?'#b0b4b8':'#0a2b6b'}" font-weight="700">${esc(dv.ref)}</text>`;
    const def=deviceCat(dv.devDef);if(def&&!back)s+=`<text x="${x+DEV_BOX_W/2*sc+3}" y="${y+4}" font-size="7.5" fill="#666">${esc(def.cikk)}</text>`;
    if(dv.link&&!back)s+=`<circle cx="${x}" cy="${y}" r="${(DEV_BOX_W/2)*sc+3}" fill="none" stroke="#c0530f" stroke-width="0.9" stroke-dasharray="2 2"/>`;
    s+=`</g>`;
    s+=`<line x1="${X(0)}" y1="${y}" x2="${x}" y2="${y}" stroke="${col}" stroke-width="0.4" stroke-dasharray="2 3" opacity="0.5"/><text x="${X(0)+2}" y="${y-2}" font-size="8" fill="${col}">${Math.round(dv.h)}</text>`;});
  if(showFar)drawDev(true);drawDev(false);
  // ---- WARP (Photoshop-style free transform of one path's nodes on this wall) ----
  if(warpPi!=null){const bb=wvWarpBox(d,warpPi);
    if(bb){const x0=Math.min(X(bb.u0),X(bb.u1)),x1=Math.max(X(bb.u0),X(bb.u1)),y0=Math.min(Y(bb.h0),Y(bb.h1)),y1=Math.max(Y(bb.h0),Y(bb.h1));
      s+=`<rect x="${x0-6}" y="${y0-6}" width="${(x1-x0+12).toFixed(1)}" height="${(y1-y0+12).toFixed(1)}" fill="none" stroke="#e8641c" stroke-width="1" stroke-dasharray="5 3"/>`;
      [[0,0],[0.5,0],[1,0],[1,0.5],[1,1],[0.5,1],[0,1],[0,0.5]].forEach(hd=>{
        const hx=hd[0],hy=hd[1],uH=bb.u0+hx*(bb.u1-bb.u0),hH=bb.h0+hy*(bb.h1-bb.h0);
        const px=X(uH),py=Y(hH),cur=(hx===0.5?'ns-resize':hy===0.5?'ew-resize':'nwse-resize');
        s+=`<rect class="wvwarp" data-pi="${warpPi}" data-hx="${hx}" data-hy="${hy}" x="${(px-4).toFixed(1)}" y="${(py-4).toFixed(1)}" width="8" height="8" fill="#fff" stroke="#e8641c" stroke-width="1.4" style="cursor:${cur}"/>`;});
      const wl='✥ WARP — húzd a fogantyúkat',wx=((x0+x1)/2).toFixed(1),wy=(y0-11).toFixed(1);
      s+=`<text x="${wx}" y="${wy}" font-size="9" text-anchor="middle" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round">${wl}</text>`
        +`<text x="${wx}" y="${wy}" font-size="9" text-anchor="middle" fill="#c0530f">${wl}</text>`;}}
  } // end installed layer
  // ---- NOTES LAYER (draggable wall notes) ----
  if(L.notes&&d.notes)d.notes.forEach(nt=>{s+=noteBox(nt,X(nt.u),Y(nt.h));});
  // ---- LIVE MEASURE overlay (while dragging an item): distance from left, right, and ground ----
  if(WV&&WV.drag){const dg=WV.drag,x=X(dg.u),y=Y(dg.h);
    const fromL=Math.round(dg.u),fromR=Math.round(len-dg.u),fromG=Math.round(dg.h);
    // vertical guide + horizontal guide through the dragged point
    s+=`<line x1="${x}" y1="${Y(0)}" x2="${x}" y2="${Y(H)}" stroke="#e8641c" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.8"/>`
      +`<line x1="${X(0)}" y1="${y}" x2="${X(len)}" y2="${y}" stroke="#e8641c" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.8"/>`;
    // left measure
    s+=`<line x1="${X(0)}" y1="${Y(0)+16}" x2="${x}" y2="${Y(0)+16}" stroke="#e8641c" stroke-width="0.8"/><text x="${(X(0)+x)/2}" y="${Y(0)+13}" font-size="9" text-anchor="middle" fill="#c0530f" paint-order="stroke" stroke="#fff" stroke-width="2.4">${fromL}</text>`;
    // right measure
    s+=`<line x1="${x}" y1="${Y(0)+16}" x2="${X(len)}" y2="${Y(0)+16}" stroke="#e8641c" stroke-width="0.8"/><text x="${(x+X(len))/2}" y="${Y(0)+13}" font-size="9" text-anchor="middle" fill="#c0530f" paint-order="stroke" stroke="#fff" stroke-width="2.4">${fromR}</text>`;
    // ground measure
    s+=`<text x="${x+6}" y="${(y+Y(0))/2}" font-size="9" fill="#c0530f" paint-order="stroke" stroke="#fff" stroke-width="2.4">↕${fromG}</text>`;
    // real-size readout badge
    if(dg.label)s+=`<rect x="${x+8}" y="${y-30}" width="${dg.label.length*6.4+10}" height="16" rx="3" fill="#2c2c2c" opacity="0.9"/><text x="${x+13}" y="${y-18}" font-size="9.5" fill="#fff">${esc(dg.label)}</text>`;}
  if(dims){ // horizontal dimension chain: wall ends, opening edges, device centres
    const pts=[0,len];d.ops.forEach(o=>{pts.push(o.u-o.w/2,o.u+o.w/2);});d.devs.filter(x=>!x.back).forEach(dv=>pts.push(dv.u));
    const u=[...new Set(pts.map(v=>Math.round(v)))].filter(v=>v>=-1&&v<=len+1).sort((a,b)=>a-b);
    const yc=Y(0)+30;
    s+=`<line x1="${X(0)}" y1="${yc}" x2="${X(len)}" y2="${yc}" stroke="#555" stroke-width="0.8"/>`;
    u.forEach(v=>{s+=`<line x1="${X(v)}" y1="${yc-5}" x2="${X(v)}" y2="${yc+5}" stroke="#555" stroke-width="0.8"/><line x1="${X(v)}" y1="${Y(0)}" x2="${X(v)}" y2="${yc-5}" stroke="#bbb" stroke-width="0.4" stroke-dasharray="2 3"/>`;});
    for(let i=1;i<u.length;i++){const mid=(X(u[i-1])+X(u[i]))/2,dv=u[i]-u[i-1];
      if(dv>1)s+=`<text x="${mid}" y="${yc-8}" font-size="8.5" text-anchor="middle" fill="#333">${dv}</text>`;}
    const hs=[...new Set(d.devs.filter(x=>!x.back).map(x=>Math.round(x.h)).concat(d.ops.map(o=>o.sill+o.h)))].filter(v=>v>0&&v<H).sort((a,b)=>a-b);
    const xc=X(0)-26;
    s+=`<line x1="${xc}" y1="${Y(0)}" x2="${xc}" y2="${Y(H)}" stroke="#555" stroke-width="0.8"/>`;
    hs.concat([H]).forEach(v=>{s+=`<line x1="${xc-4}" y1="${Y(v)}" x2="${xc+4}" y2="${Y(v)}" stroke="#555" stroke-width="0.8"/><text x="${xc-6}" y="${Y(v)+3}" font-size="8.5" text-anchor="end" fill="#333">${Math.round(v)}</text>`;});}
  const yb=Hpx-12;
  s+=`<line x1="${X(0)}" y1="${yb}" x2="${X(len)}" y2="${yb}" stroke="#555"/><line x1="${X(0)}" y1="${yb-4}" x2="${X(0)}" y2="${yb+4}" stroke="#555"/><line x1="${X(len)}" y1="${yb-4}" x2="${X(len)}" y2="${yb+4}" stroke="#555"/><text x="${(X(0)+X(len))/2}" y="${yb-4}" font-size="10" text-anchor="middle" fill="#555">${Math.round(len)} mm</text>`;
  return {svg:s+'</svg>',w:Wpx,h:Hpx,M,sc,H,len};}
function svgToPng(svgStr,w,h,name){const img=new Image();img.onload=()=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);cv.toBlob(b=>{const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);});};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgStr);}
function printSVG(svgStr,title){const wnd=window.open('','_blank');if(!wnd)return;wnd.document.write('<html><head><title>'+title+'</title></head><body style="margin:0;text-align:center">'+svgStr+'<scr'+'ipt>window.onload=function(){window.print();}</scr'+'ipt></body></html>');wnd.document.close();}
const VERSION='1.0.0';                   // 1.0 — the coherent foundation
let WV=null,PV=null;                     // WV = wall elevation editor, PV = floor/ceiling plane editor
function edCur(){return WV||PV;}         // whichever editor session is open
function edRender(){const E=edCur();if(E&&E.render)E.render();}
// ---- elevation device model: define occupant, colour, clip, junction shape ----
// ---------------- editor ACTION RAIL ----------------
// Every right-click option also exists as a button on the right-hand side of the editor, so nothing
// is reachable only by hitting the correct pixel. The rail shows the actions for the current
// selection (click anything to select it) plus the create actions.
function edSelKey(sel){return sel?(sel.kind+':'+(sel.di!=null?sel.di:(sel.pi+'/'+sel.na))+(sel.ni2!=null?('n'+sel.ni2):'')):'';}
function edRailItems(E){
  const out=[],sel=E.sel;
  const rerender=()=>edRender();
  if(sel&&sel.kind==='dev'&&data.devices[sel.di]){
    out.push({h:'Készülék — '+(data.devices[sel.di].ref||'#'+sel.di)});
    wvDeviceItems(sel.di).forEach(it=>out.push(it));
  } else if(sel&&sel.kind==='sec'&&sel.t){
    const items=wvSectionItems(sel.t);
    if(items){out.push({h:'Pálya-szakasz — P'+sel.t.pi+'/'+sel.t.na});items.forEach(it=>out.push(it));}
  } else if(sel&&sel.kind==='note'&&(data.wallNotes||[])[sel.ni2]){
    const items=noteItems(sel.ni2,rerender);
    if(items){out.push({h:'Jegyzet'});items.forEach(it=>out.push(it));}
  } else out.push({h:'Nincs kijelölve',note:'Kattints egy dobozra, pálya-vonalra vagy jegyzetre.'});
  // create block — the same list the empty-surface right-click offers
  out.push({h:'Létrehozás'});
  const c=(E===WV)?wvCreateItems(E.railU!=null?E.railU:Math.round(E.lastLen||1000),E.railH!=null?E.railH:1100)
                 :pvCreateItems(E.railU!=null?E.railU:(E.data?E.data.pb.x0+500:0),E.railH!=null?E.railH:(E.data?E.data.pb.y0+500:0));
  c.forEach(it=>out.push(it));
  return out;}
function edRailHTML(E){
  return `<div id="edRail" style="width:212px;flex:0 0 212px;border-left:1px solid #eee;padding-left:8px;overflow:auto;max-height:${E.full?'80vh':'60vh'}">`
    +edRailItems(E).map((it,i)=>it.h
      ? `<div style="font-size:10.5px;font-weight:700;color:#666;margin:8px 0 3px;border-bottom:1px solid #eee;padding-bottom:2px">${esc(it.h)}</div>`
        +(it.note?`<div style="font-size:10.5px;color:#aaa;margin-bottom:4px">${esc(it.note)}</div>`:'')
      : `<button class="edRailB" data-i="${i}" style="display:block;width:100%;text-align:left;font-size:11px;padding:4px 6px;margin:2px 0;white-space:normal;line-height:1.25">${it.label}</button>`).join('')
    +`</div>`;}
function edRailBind(E){const box=$('edRail');if(!box)return;const items=edRailItems(E);
  box.querySelectorAll('.edRailB').forEach(b=>{b.onclick=()=>{const it=items[+b.dataset.i];if(it&&it.act)it.act();};});}
// clicking (not dragging) an item selects it, which is what the rail follows
function edSelect(E,sel){E.sel=sel;edRender();}
function wvDeviceMenu(ev,di){ctxMenu(ev,wvDeviceItems(di));}
function wvDeviceItems(di){const D=data.devices[di];const items=[];
  if(D.type==='junction'){
    items.push({label:'⬚ Kör ↔ Téglalap',act:()=>{wvPush();D.jbShape=(D.jbShape==='rect'?'circle':'rect');edRender();draw();}});
    items.push({label:'⌀ Méret… (mm)',act:()=>wvOpenModal('Kötődoboz átmérő',`<div class="mrow"><input id="jbs" type="number" value="${D.jbSize||80}" style="width:90px"> mm</div>`,()=>{wvPush();D.jbSize=+$('jbs').value||80;edRender();draw();})});
  } else {
    items.push({label:(D.devDef?'✎ Készülék módosítása…':'＋ Készülék meghatározása…'),act:()=>wvDefineDevice(di)});
    if(D.devDef)items.push({label:'✕ Meghatározás törlése (üres doboz)',act:()=>{wvPush();delete D.devDef;edRender();draw();}});
  }
  items.push({label:'🎨 Doboz színe…',act:()=>wvOpenModal('Doboz színe',`<div class="mrow"><input id="bxc" type="color" value="${D.boxColor||'#ffffff'}" style="width:48px;height:26px"></div>`,()=>{wvPush();D.boxColor=$('bxc').value;edRender();draw();})});
  if(WV&&D.type!=='board'&&D.type!=='junction')items.push({label:'⛓ Doboz csatolása szomszédhoz…',act:()=>wvClipDevice(di)});
  if(WV&&D.clip)items.push({label:'⛓✕ Csatolás bontása',act:()=>{wvPush();wvUnclip(di);edRender();draw();}});
  if(PV)items.push({label:`⇕ Magasság a padlótól… (${Math.round(D.h||0)} mm)`,
    act:()=>wvOpenModal('Magasság a padlótól',`<div class="mrow"><input id="pvz" type="number" step="10" value="${Math.round(D.h||0)}" style="width:90px"> mm</div>`
      +`<div class="mrow" style="font-size:11px;color:#777">Felülnézetben a magasság nem látszik — itt állítható. A síkhoz kötött sávon kívülre állítva a készülék halványan, kontextusként jelenik meg.</div>`,
      ()=>{wvPush();pvSetDeviceZ(di,+$('pvz').value||0);draw();})});
  items.push({label:(D.link?'🔗 Kötés áthelyezése…':'🔗 Csatlakoztatás pályához…'),act:()=>wvLinkDevice(di)});
  if(D.link)items.push({label:'🔗✕ Kötés bontása ('+linkLabel(D)+')',act:()=>{wvPush();delete D.link;edRender();draw();}});
  items.push({label:'🗑 Törlés',act:()=>{wvPush();data.devices.splice(di,1);edRender();draw();}});
  return items;}
function wvDistSeg(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,L=dx*dx+dy*dy;
  let t=L?((px-x1)*dx+(py-y1)*dy)/L:0;t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(x1+dx*t),py-(y1+dy*t));}
// right-click on a path section in the elevation → conduit diameter + chase depth (these drive the cut layer)
function wvSectionMenu(ev,t){const it=wvSectionItems(t);if(it)ctxMenu(ev,it);}
function wvSectionItems(t){const pa=data.paths[t.pi];if(!pa)return null;
  const sec=pa.sections[t.na]||(pa.sections[t.na]={build:t.build||'sull_gege',circuit:null});
  const dia=chaseDia(sec.build||t.build,sec),dep=chaseDepthOf(sec,dia),w=chaseWidthOf(dia);
  const items=[
    {label:`⌀ Cső átmérő… (most ${dia} mm)`,act:()=>wvOpenModal('Cső átmérő',
      `<div class="mrow"><select id="pdia" style="width:130px">`+PATH_DIA.map(v=>`<option value="${v}" ${v===dia?'selected':''}>${v} mm</option>`).join('')+`</select></div>`
      +`<div class="mrow" style="font-size:11px;color:#777">A véset szélessége ebből számolódik: ⌀ × ${(state.chaseFactor||1.6)} = <b>${chaseWidthOf(dia)} mm</b> (⌀20-nál ${chaseWidthOf(20)}, ⌀25-nél ${chaseWidthOf(25)}, ⌀32-nél ${chaseWidthOf(32)}).</div>`,
      ()=>{wvPush();sec.dia=+$('pdia').value;edRender();draw();})},
    {label:`⇳ Véset mélység… (most ${dep} mm)`,act:()=>wvOpenModal('Véset mélység',
      `<div class="mrow"><select id="pcd" style="width:130px"><option value="">auto (${dia<=25?30:35} mm)</option>`
      +`<option value="30" ${sec.cd==30?'selected':''}>30 mm</option><option value="35" ${sec.cd==35?'selected':''}>35 mm</option></select></div>`
      +`<div class="mrow" style="font-size:11px;color:#777">Alapértelmezés: ⌀16–25 → 30 mm, ⌀32 → 35 mm.</div>`,
      ()=>{wvPush();const v=$('pcd').value;if(v)sec.cd=+v;else delete sec.cd;edRender();draw();})},
    {label:'⚙ Szakasz kivitele…',act:()=>setSectionBuild(t.pi,t.na)},
    {label:'⧉ Másolat mellé…',act:()=>wvDuplicateDialog(t)},
    {label:'🔗 Csatlakoztatás készülékhez…',act:()=>wvLinkSectionToDevice(t)},
    {label:(edCur().warp&&edCur().warp.pi===t.pi?'✥ Warp mód kikapcsolása':'✥ Warp mód (vagy Alt+klikk)'),
      act:()=>{const E=edCur();E.warp=(E.warp&&E.warp.pi===t.pi)?null:{pi:t.pi};edRender();}},
    {label:'↔ Egész szakasz mozgatása: húzd magát a vonalat',act:()=>{}},
    {label:`ℹ Véset ezen a szakaszon: ${w}×${dep} mm`,act:()=>{}}];
  return items;}
function wvDuplicateDialog(t){const pa=data.paths[t.pi];if(!pa)return;
  const dia=chaseDia((pa.sections[t.na]||{}).build||t.build,pa.sections[t.na]||{}),def=chaseWidthOf(dia)+10;
  wvOpenModal('Másolat mellé',
    `<div class="mrow">Mit: <select id="dupScope" style="width:150px"><option value="sec">csak ez a szakasz</option><option value="all">az egész pálya</option></select></div>`
   +`<div class="mrow">Irány: <select id="dupDir" style="width:110px"><option value="fel">fel</option><option value="le">le</option><option value="jobbra">jobbra</option><option value="balra">balra</option></select>`
   +` távolság <input id="dupD" type="number" step="5" min="1" value="${def}" style="width:64px"> mm</div>`
   +`<div class="mrow" style="font-size:11px;color:#777">A cső kivitele/⌀/vésetmélység másolódik, az áramkörök NEM (üres párhuzamos cső jön létre). Alap távolság = véset szélessége + 10 mm.${PV?' Felülnézetben az irány a képernyő szerint értendő, a magasság nem változik.':''}</div>`,
    ()=>{wvPush();const pi2=wvDuplicateBeside(t.pi,t.na,$('dupDir').value,Math.max(1,+$('dupD').value||def),$('dupScope').value==='all');
      if(pi2==null)return false;edRender();draw();},'Másol');}
function wvDefineDevice(di){const D=data.devices[di];
  const opts=DEVICE_CATALOG.map(c=>`<option value="${c.id}" ${D.devDef===c.id?'selected':''}>${esc(c.brand)} — ${esc(c.name)} (${esc(c.cikk)}, ${c.w}×${c.h})</option>`).join('');
  wvOpenModal('Készülék meghatározása (Szerelvénydoboz)',
    `<div class="mrow" style="font-size:11px;color:#777">A hollow Szerelvénydoboz helyére kerülő fali szerelvény. A rajz a gyártói villáskengyel-méretet mutatja.</div>`
    +`<div class="mrow"><select id="ddSel" style="width:100%">${opts}</select></div>`,
    ()=>{wvPush();D.devDef=$('ddSel').value;const def=deviceCat(D.devDef);if(def&&!D.ref)D.ref=(D.type==='switch'?'K':D.type==='light'?'L':'D');edRender();draw();},'Meghatároz');}
// clip a device box onto a neighbour's up/down/left/right connect point (72mm spacing), forming a group (max 5)
function wvClipDevice(di){const D=data.devices[di];
  // find candidate neighbours on the same wall within ~200mm
  const near=data.devices.map((o,i)=>({o,i})).filter(({o,i})=>i!==di&&o.type!=='board'&&o.type!=='junction'&&o.level===D.level&&Math.hypot(o.x-D.x,o.y-D.y)<300);
  if(!near.length){alert('Nincs közeli doboz a csatoláshoz (≤300 mm).');return;}
  const list=near.map(({o,i})=>`<option value="${i}">${esc(o.ref||('#'+i))} (${Math.round(Math.hypot(o.x-D.x,o.y-D.y))} mm)</option>`).join('');
  wvOpenModal('Doboz csatolása','<div class="mrow">Szomszéd: <select id="clipN">'+list+'</select></div>'
    +'<div class="mrow">Irány: <select id="clipDir"><option value="right">jobbra</option><option value="left">balra</option><option value="up">fel</option><option value="down">le</option></select></div>'
    +'<div class="mrow" style="font-size:11px;color:#777">72 mm-es osztással illeszti; a csatolt csoport együtt mozog, de dobozonként külön színezhető/meghatározható (max 5).</div>',
    ()=>{const ni=+$('clipN').value,dir=$('clipDir').value;wvPush();wvDoClip(di,ni,dir);edRender();draw();},'Csatol');}
function clipGroupOf(i){ // collect all devices sharing the same clip group id
  const D=data.devices[i];if(!D.clip)return [i];
  return data.devices.map((o,idx)=>idx).filter(idx=>data.devices[idx].clip===D.clip);}
function wvDoClip(di,ni,dir){const D=data.devices[di],N=data.devices[ni];
  const gid=N.clip||('clip'+Date.now());N.clip=gid;
  if((clipGroupOf(ni).length)>=5){alert('Egy csoportban legfeljebb 5 doboz lehet.');return;}
  D.clip=gid;
  // place D at 72mm from N along the wall axis (dir) — use wall basis
  const wb=(typeof WV!=='undefined'&&WV&&WV.r)?wvWallBasis():{ax:1,ay:0};const ax=wb.ax,ay=wb.ay;
  const off=DEV_CLIP_SPACING;
  if(dir==='right'){D.x=N.x+ax*off;D.y=N.y+ay*off;D.h=N.h;}
  else if(dir==='left'){D.x=N.x-ax*off;D.y=N.y-ay*off;D.h=N.h;}
  else if(dir==='up'){D.x=N.x;D.y=N.y;D.h=(N.h||0)+off;}
  else if(dir==='down'){D.x=N.x;D.y=N.y;D.h=Math.max(0,(N.h||0)-off);}}
function wvUnclip(di){const D=data.devices[di];const g=clipGroupOf(di);delete D.clip;
  if(g.filter(i=>i!==di).length<=1)g.forEach(i=>delete data.devices[i].clip);} // dissolve group if only one left
// ---- editor SESSION: edits are live (so the 3D view updates) but only COMMITTED on save ----
function wvPush(scope){const E=edCur();if(!E){pushUndo(scope);return;}   // editor-local undo step
  E.undo.push(snap_(scope));if(E.undo.length>60)E.undo.shift();E.redo.length=0;E.dirty=true;}
function wvUndo(){const E=edCur();if(!E||!E.undo.length)return;const sn=E.undo.pop();E.redo.push(snap_(sn.__scope));applySnap(sn);edRender();draw();}
function wvRedo(){const E=edCur();if(!E||!E.redo.length)return;const sn=E.redo.pop();E.undo.push(snap_(sn.__scope));applySnap(sn);edRender();draw();}
function wvCloseEditor(save){const E=edCur();if(!E){closeModal();return;}
  if(save){if(E.dirty){undo.push(E.base);if(undo.length>80)undo.shift();redo.length=0;}}   // ONE global undo step for the whole session
  else{if(E.dirty&&!confirm('Elveted a szerkesztőben végzett módosításokat?'))return;
    applySnap(E.base);}
  if(E.keyFn)document.removeEventListener('keydown',E.keyFn,true);
  if(E===WV)WV=null;else PV=null;
  closeModal();draw();if(typeof scheduleSave==='function')scheduleSave();}
// shared keyboard map for both editors
function edKeyFn(E){return ev=>{if(edCur()!==E)return;
  const tg=(ev.target&&ev.target.tagName)||'';if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;
  if(ev.key==='Escape'){ev.stopPropagation();ev.preventDefault();
    // Esc steps OUT of whatever is active, one level at a time. It never closes the editor and
    // never discards a session — that is what the Elvetés button is for.
    if(E.drawPi!=null){E.finishPath();$('hud').textContent='Pálya lezárva.';return;}
    if(E.warp){E.warp=null;edRender();return;}
    if(E.sel){E.sel=null;edRender();return;}
    if(E.full){E.full=false;edRender();return;}
    $('hud').textContent='Nincs mit megszakítani — kilépéshez: 💾 Mentés vagy ✕ Elvetés.';return;}
  if(ev.key==='Enter'&&E.drawPi!=null){ev.stopPropagation();ev.preventDefault();
    E.finishPath();$('hud').textContent='Pálya kész — a rajzeszköz aktív marad, kattints új kezdőpontra.';return;}
  if((ev.ctrlKey||ev.metaKey)&&(ev.key==='z'||ev.key==='Z')){ev.stopPropagation();ev.preventDefault();ev.shiftKey?wvRedo():wvUndo();return;}
  if((ev.ctrlKey||ev.metaKey)&&(ev.key==='y'||ev.key==='Y')){ev.stopPropagation();ev.preventDefault();wvRedo();}};}
// sub-dialogs opened FROM the editor must return to it (cancel = back to the wall, not close everything)
function wvOpenModal(title,body,onOk,okLabel){openModal(title,body,()=>{const r=onOk();if(r===false)return false;
  edRender();return false;},okLabel);
  const c=$('mCancel');if(c)c.onclick=()=>edRender();}
function openWallView(r,level){WV={r,level,far:false,dims:true,mirror:false,flipSide:false,
  layers:{installed:true,cuts:true,notes:true,cutLabels:true},   // elevation layers (+ chase labels)
  hLines:null,                                     // per-guide line visibility in the viewer (null=inherit GUIDES.vis)
  warp:null,                                       // {pi} — free-transform box over one path's nodes
  drag:null,                                       // live drag readout {u,h,label}
  base:snap_(),undo:[],redo:[],dirty:false,        // session snapshot + viewer-local history
  full:false,drawPi:null,list:true,                // fullscreen, elevation path-drawing, coord list
  render:renderWallView,finishPath:()=>wvFinishPath()};
  WV.keyFn=edKeyFn(WV);document.addEventListener('keydown',WV.keyFn,true);
  renderWallView();}
// ---- build the wall from the elevation: create devices / openings / paths / notes at a clicked point ----
function wvCreateDevice(type,u,h){const b=wvWallBasis(),p=wvPlanXY(u);
  wvPush();
  const dev={type,level:WV.level,x:p.x,y:p.y,h:Math.max(0,Math.round(h/10)*10),layer:curLayer(),ref:nextRef(type),side:(WV.flipSide?1:0)};
  if(type==='board'){dev.h=boardZ();dev.z=boardZ();dev.rw=BOARD_RW;dev.rd=BOARD_RD;dev.ang=b.horiz?0:Math.PI/2;}
  data.devices.push(dev);
  if(type==='board'&&typeof ensureBoardObject==='function')ensureBoardObject(dev);
  renderWallView();draw();return data.devices.length-1;}
function wvCreateOpening(type,u){const b=wvWallBasis();wvPush();
  const win=(type==='window');
  data.openings.push({type,level:WV.level,x:b.ox+b.ax*u,y:b.oy+b.ay*u,ang:(b.horiz?0:Math.PI/2),variant:0,layer:curLayer(),
    w:(win?WIN_W:DOOR_W),h:(win?WIN_H:DOOR_H),sill:(win?WIN_SILL:0)});
  renderWallView();draw();}
function wvSnapH(h){                                   // typed/clicked heights snap to a visible guide line within 50mm
  let best=null,bd=50;GUIDES.forEach(g=>{if(g.jump===false)return;const mm=resolveMm(g,WV.level);
    const dd=Math.abs(mm-h);if(dd<bd){bd=dd;best=mm;}});
  return best!=null?best:Math.round(h/10)*10;}
function wvStartPath(u,h){const p=wvPlanXY(u);wvPush();
  data.paths.push({ptype:state.pathType,nodes:[{level:WV.level,x:p.x,y:p.y,h:Math.max(0,wvSnapH(h))}],sections:[],layer:curLayer()});
  WV.drawPi=data.paths.length-1;renderWallView();}
function wvAddPathNode(u,h){if(WV.drawPi==null)return;const pa=data.paths[WV.drawPi];if(!pa)return;
  const p=wvPlanXY(u);pa.sections.push({build:'sull_gege',circuit:null});
  pa.nodes.push({level:WV.level,x:p.x,y:p.y,h:Math.max(0,wvSnapH(h))});renderWallView();draw();}
function wvFinishPath(){if(WV.drawPi==null)return;const pa=data.paths[WV.drawPi];
  if(pa&&pa.nodes.length<2){data.paths.splice(WV.drawPi,1);wvRelinkAfterPathRemoval(WV.drawPi);}   // a lone node is not a path
  WV.drawPi=null;WV.sel=null;renderWallView();draw();}
function wvCreateMenu(ev,u,h){ctxMenu(ev,wvCreateItems(u,h));}
function wvCreateItems(u,h){const items=[
  {label:'＋ Aljzat ide',act:()=>wvCreateDevice('socket',u,h)},
  {label:'＋ Kapcsoló ide',act:()=>wvCreateDevice('switch',u,h)},
  {label:'＋ Lámpa ide',act:()=>wvCreateDevice('light',u,h)},
  {label:'＋ Kötődoboz ide',act:()=>wvCreateDevice('junction',u,h)},
  {label:'＋ Elosztószekrény ide',act:()=>wvCreateDevice('board',u,h)},
  {label:'＋ Ajtó ide',act:()=>wvCreateOpening('door',u)},
  {label:'＋ Ablak ide',act:()=>wvCreateOpening('window',u)},
  {label:'✏ Pálya rajzolása innen',act:()=>wvStartPath(u,h)},
  {label:'📝 Jegyzet ide…',act:()=>{wvPush();data.wallNotes=data.wallNotes||[];
    data.wallNotes.push({wallKey:wallKey(WV.r,WV.level),u:Math.round(u),h:Math.round(h),text:'',kind:'info'});
    const i=data.wallNotes.length-1;renderWallView();noteDialog(i,renderWallView);}}];
  if(WV.drawPi!=null){items.unshift({label:'✔ Pálya lezárása (Enter)',act:()=>wvFinishPath()});}
  return items;}
function wvSetDevice(di,u,h,raw){const dv=data.devices[di];if(!dv)return;const r=WV.r,horiz=(r.x1-r.x0)>=(r.y1-r.y0);
  // clipped group moves as ONE unit: compute this box's delta, then apply to every group member
  const grp=(dv.clip?clipGroupOf(di):[di]);
  const oldX=dv.x,oldY=dv.y,oldH=dv.h||0;
  const q=v=>raw?Math.round(v):Math.round(v/fineStep(10))*fineStep(10);      // typed values are exact, dragged ones snap to 10mm
  let nx=dv.x,ny=dv.y,nh=oldH;
  if(h!=null)nh=Math.max(0,q(h));
  if(u!=null){const uu=q(u);if(horiz)nx=r.x0+uu;else ny=r.y0+uu;}
  const ddx=nx-oldX,ddy=ny-oldY,ddh=nh-oldH;
  grp.forEach(i=>{const g=data.devices[i];g.x+=ddx;g.y+=ddy;g.h=Math.max(0,(g.h||0)+ddh);});
  wvPushLinkedNodes(grp);}
// along-wall coordinate of a path node (+ its height) in the current wall's basis
// ---- device ↔ path-node links: the node follows the device and vice versa ----
function wvPushLinkedNodes(indices){indices.forEach(i=>{const g=data.devices[i];if(!g||!g.link)return;
  const t=linkTarget(g);if(!t)return;const n=t.node;
  n.x=g.x;n.y=g.y;n.h=g.h||0;});}
function wvPullLinkedDev(pi,ni){const pa=data.paths[pi],n=pa&&pa.nodes[ni];if(!n)return;
  const pid=(data.paths[pi]||{}).id,nid=n.id;
  data.devices.forEach(dv=>{if(dv.link&&dv.link.p===pid&&dv.link.n===nid){dv.x=n.x;dv.y=n.y;dv.h=n.h||0;}});}
// ids made this trivial: a link whose target is gone simply resolves to nothing.
function wvRelinkAfterPathRemoval(){pruneLinks();}
// candidate path nodes on this wall, nearest first
function wvNodeCandidates(u,h,maxD){const d=wallElevationData(WV.r,WV.level),out=[],seen={};
  d.secs.filter(x=>!x.back).forEach(t=>{[[t.na,t.ua,t.ha],[t.nb,t.ub,t.hb]].forEach(nd=>{
    const k=t.pi+':'+nd[0];if(seen[k])return;seen[k]=1;
    const dist=Math.hypot(nd[1]-u,nd[2]-h);if(dist<=(maxD||1200))out.push({pi:t.pi,ni:nd[0],u:nd[1],h:nd[2],dist});});});
  return out.sort((a,b)=>a.dist-b.dist);}
function wvLinkDevice(di){const D=data.devices[di];if(!D)return;
  const uh=wvNodeUH({x:D.x,y:D.y,h:D.h||0}),cand=wvNodeCandidates(uh.u,D.h||0,1500);
  if(!cand.length){alert('Nincs pálya-csomópont 1500 mm-en belül ezen a falon.');return;}
  wvOpenModal('Csatlakoztatás pályához',
    `<div class="mrow">Csomópont: <select id="lnkN" style="width:100%">`
    +cand.map(c=>`<option value="${c.pi}:${c.ni}">P${c.pi}/${c.ni} — ${Math.round(c.dist)} mm (${Math.round(c.u)} / ${Math.round(c.h)})</option>`).join('')+`</select></div>`
    +`<div class="mrow"><label><input type="checkbox" id="lnkSnap" checked> a csomópont ugorjon a készülék pontjára</label></div>`
    +`<div class="mrow" style="font-size:11px;color:#777">Kötés után a készülék és a csomópont együtt mozog (bármelyiket húzod).</div>`,
    ()=>{const v=$('lnkN').value.split(':');wvPush();
      const pa=data.paths[+v[0]],nd=pa&&pa.nodes[+v[1]];if(!pa||!nd)return false;
      setLink(D,pa.id,nd.id);
      if($('lnkSnap').checked)wvPushLinkedNodes([di]);else wvPullLinkedDev(+v[0],+v[1]);
      draw();},'Összeköt');}
function wvLinkSectionToDevice(t){const d=wallElevationData(WV.r,WV.level);
  const near=d.devs.filter(x=>!x.back&&x.type!=='board').map(dv=>({dv,dist:Math.min(Math.hypot(dv.u-t.ua,dv.h-t.ha),Math.hypot(dv.u-t.ub,dv.h-t.hb))}))
    .filter(x=>x.dist<1500).sort((a,b)=>a.dist-b.dist);
  if(!near.length){alert('Nincs készülék 1500 mm-en belül.');return;}
  wvOpenModal('Csatlakoztatás készülékhez',
    `<div class="mrow">Készülék: <select id="lnkD" style="width:100%">`
    +near.map(x=>`<option value="${x.dv.di}">${esc(x.dv.ref||('#'+x.dv.di))} — ${Math.round(x.dist)} mm</option>`).join('')+`</select></div>`
    +`<div class="mrow">Melyik vég: <select id="lnkE" style="width:120px"><option value="a">A (${Math.round(t.ua)} mm)</option><option value="b">B (${Math.round(t.ub)} mm)</option></select></div>`,
    ()=>{const di=+$('lnkD').value,ni=($('lnkE').value==='a'?t.na:t.nb);wvPush();
      const pa=data.paths[t.pi],nd=pa&&pa.nodes[ni];if(!pa||!nd)return false;
      setLink(data.devices[di],pa.id,nd.id);wvPushLinkedNodes([di]);draw();},'Összeköt');}
function wvNodeUH(n){const b=wvWallBasis();return {u:(n.x-b.ox)*b.ax+(n.y-b.oy)*b.ay,h:n.h||0};}
// every node of path pi that appears on this wall (near side) → its bounding box in mm
function wvWarpNodes(d,pi){const seen={},out=[];
  d.secs.filter(t=>t.pi===pi&&!t.back).forEach(t=>{
    if(!seen[t.na]){seen[t.na]=1;out.push({ni:t.na,u:t.ua,h:t.ha});}
    if(!seen[t.nb]){seen[t.nb]=1;out.push({ni:t.nb,u:t.ub,h:t.hb});}});
  return out;}
function wvWarpBox(d,pi){const ns=wvWarpNodes(d,pi);if(ns.length<2)return null;
  const us=ns.map(n=>n.u),hs=ns.map(n=>n.h);
  return {u0:Math.min.apply(null,us),u1:Math.max.apply(null,us),h0:Math.min.apply(null,hs),h1:Math.max.apply(null,hs),nodes:ns};}
// duplicate a section (or the whole path) as a parallel run offset beside it
function wvDuplicateBeside(pi,si,dir,dist,whole){const pa=data.paths[pi];if(!pa)return null;
  const plane=!!PV;
  const b=plane?null:wvWallBasis(),mir=((WV&&WV.mirror)||(PV&&PV.mirror))?1:0;
  const sgnU=(mir?1:-1);                                  // screen-right = +u when mirrored, else −u
  let du=0,dh=0,dx=0,dy=0;
  if(plane){                                              // top-down: fel/le = −y/+y, balra/jobbra = ∓x (mirror aware)
    const sx=(mir?-1:1);
    if(dir==='fel')dy=-dist;else if(dir==='le')dy=dist;
    else if(dir==='jobbra')dx=dist*sx;else dx=-dist*sx;
  } else if(dir==='fel')dh=dist;else if(dir==='le')dh=-dist;
  else if(dir==='jobbra')du=dist*sgnU;else du=-dist*sgnU;
  const idx=whole?pa.nodes.map((_,i)=>i):[si,si+1];
  const nodes=idx.map(i=>{const n=JSON.parse(JSON.stringify(pa.nodes[i]));
    if(plane){n.x+=dx;n.y+=dy;}
    else{n.x+=b.ax*du;n.y+=b.ay*du;n.h=Math.max(0,(n.h||0)+dh);}return n;});
  const secs=[];for(let k=0;k<nodes.length-1;k++){const src=pa.sections[whole?k:si]||{};
    secs.push({build:src.build||'sull_gege',circuit:null,dia:src.dia,cd:src.cd});}   // conduit copied, circuits NOT
  const np={nodes,sections:secs,type:pa.type,color:pa.color,layer:pa.layer};
  data.paths.push(np);return data.paths.length-1;}
function wvWallBasis(){const r=WV.r,horiz=(r.x1-r.x0)>=(r.y1-r.y0);
  const cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2,ox=horiz?r.x0:cx,oy=horiz?cy:r.y0,ax=horiz?1:0,ay=horiz?0:1;
  const px=horiz?0:1,py=horiz?1:0,thick=horiz?(r.y1-r.y0):(r.x1-r.x0);
  const sflip=(WV&&WV.flipSide)?-1:1,k=sflip*Math.max(0,thick/2-10);   // offset onto the NEAR wall face
  return {horiz,ox,oy,ax,ay,px,py,cx,cy,thick,k};}
// plan coordinates of an along-wall position, on the near face (so new items land on the visible side)
function wvPlanXY(u){const b=wvWallBasis();return {x:b.ox+b.ax*u+b.px*b.k,y:b.oy+b.ay*u+b.py*b.k};}
function wvSetOpening(oi,u,raw){const o=data.openings[oi];if(!o)return;const b=wvWallBasis();const uu=raw?Math.round(u):Math.round(u/fineStep(10))*fineStep(10);
  // move opening along the wall only (keep its perpendicular position on the wall)
  if(b.horiz)o.x=b.ox+uu; else o.y=b.oy+uu;}
function wvSetNode(pi,ni,u,h,raw){const pa=data.paths[pi];if(!pa||!pa.nodes[ni])return;const n=pa.nodes[ni],b=wvWallBasis();
  const q=v=>raw?Math.round(v):Math.round(v/fineStep(10))*fineStep(10);
  if(h!=null)n.h=Math.max(0,q(h));
  if(u!=null){const uu=q(u);if(b.horiz)n.x=b.ox+uu;else n.y=b.oy+uu;}
  wvPullLinkedDev(pi,ni);}
// ---- coordinate list: every feature on this wall with its mm distances, editable by typing ----
function wvListRows(d){const rows=[];
  d.devs.filter(x=>!x.back).forEach(dv=>{const D=data.devices[dv.di]||{};
    rows.push({kind:'dev',key:'d'+dv.di,i:dv.di,type:(DEV[dv.type]||dv.type),ref:dv.ref||('#'+dv.di),u:dv.u,h:dv.h,
      extra:(D.devDef?(deviceCat(D.devDef)||{}).cikk||'':''),link:linkLabel(D)});});
  const seen={};d.secs.filter(x=>!x.back).forEach(t=>{
    [[t.na,t.ua,t.ha],[t.nb,t.ub,t.hb]].forEach(nd=>{const k=t.pi+':'+nd[0];if(seen[k])return;seen[k]=1;
      rows.push({kind:'node',key:'n'+k,pi:t.pi,ni:nd[0],type:'Pálya-csomópont',ref:'P'+t.pi+'/'+nd[0],u:nd[1],h:nd[2],
        extra:'⌀'+chaseDia(t.build,t)+' mm',link:''});});});
  d.ops.forEach(o=>rows.push({kind:'op',key:'o'+o.oi,i:o.oi,type:(o.type==='window'?'Ablak':'Ajtó'),ref:o.w+'×'+o.h,
    u:o.u,h:o.sill,extra:'parapet',link:'',noH:true}));
  (d.notes||[]).forEach(nt=>rows.push({kind:'note',key:'t'+nt.i,i:nt.i,type:'Jegyzet',ref:nt.text||'',u:nt.u,h:nt.h,extra:'',link:''}));
  return rows.sort((a,b)=>a.u-b.u);}
function wvListHTML(d,len){const rows=wvListRows(d);
  if(!rows.length)return `<div style="font-size:11px;color:#999;padding:4px">Ezen a falon még nincs elem — jobb klikk a falra: készülék / nyílászáró / pálya / jegyzet.</div>`;
  const cell=(r,f,v)=>`<input class="wvcell" data-k="${r.key}" data-f="${f}" type="number" step="1" value="${Math.round(v)}" style="width:64px;font-size:10.5px;padding:1px 2px">`;
  return `<table style="width:100%;border-collapse:collapse;font-size:10.5px">`
    +`<tr style="color:#666;text-align:left"><th style="padding:2px 4px">Elem</th><th>Azonosító</th>`
    +`<th title="távolság a bal faléltől">balról</th><th title="távolság a jobb faléltől">jobbról</th><th title="magasság a padlótól">földtől</th><th></th><th></th></tr>`
    +rows.map(r=>`<tr data-k="${r.key}" style="border-top:1px solid #f0f0f0">`
      +`<td style="padding:2px 4px;white-space:nowrap">${esc(r.type)}</td>`
      +`<td style="color:#0a2b6b;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis">${esc(String(r.ref))}</td>`
      +`<td>${cell(r,'l',r.u)}</td><td>${cell(r,'r',len-r.u)}</td>`
      +`<td>${r.noH?`<span style="color:#bbb">${Math.round(r.h)}</span>`:cell(r,'h',r.h)}</td>`
      +`<td style="color:#999;white-space:nowrap">${esc(r.extra||'')}${r.link?` <span style="color:#c0530f" title="pályához kötve">🔗${esc(r.link)}</span>`:''}</td>`
      +`<td><button class="wvdel" data-k="${r.key}" title="törlés" style="font-size:10px;padding:0 4px;color:#b33">✕</button></td></tr>`).join('')
    +`</table>`;}
function wvListApply(rows,key,field,val){const r=rows.find(x=>x.key===key);if(!r)return;
  const u=(field==='l')?val:(field==='r')?null:null;
  wvPush();
  if(field==='h'){
    if(r.kind==='dev')wvSetDevice(r.i,null,val,true);
    else if(r.kind==='node')wvSetNode(r.pi,r.ni,null,val,true);
    else if(r.kind==='note'){const nt=(data.wallNotes||[])[r.i];if(nt)nt.h=Math.max(0,Math.round(val));}
  } else {
    const nu=(field==='l')?val:null;   // 'r' is handled by the caller (converted to u)
    if(r.kind==='dev')wvSetDevice(r.i,nu,null,true);
    else if(r.kind==='node')wvSetNode(r.pi,r.ni,nu,null,true);
    else if(r.kind==='op')wvSetOpening(r.i,nu,true);
    else if(r.kind==='note'){const nt=(data.wallNotes||[])[r.i];if(nt)nt.u=Math.round(nu);}
  }}
function wvListDelete(rows,key){const r=rows.find(x=>x.key===key);if(!r)return;wvPush();
  if(r.kind==='dev')data.devices.splice(r.i,1);
  else if(r.kind==='op')data.openings.splice(r.i,1);
  else if(r.kind==='note')(data.wallNotes||[]).splice(r.i,1);
  else if(r.kind==='node'){const pa=data.paths[r.pi];if(!pa)return;
    if(pa.nodes.length<=2){data.paths.splice(r.pi,1);wvRelinkAfterPathRemoval(r.pi);}
    else{pa.nodes.splice(r.ni,1);pa.sections.splice(Math.min(r.ni,pa.sections.length-1),1);}}}
function renderWallView(){const d=wallElevationData(WV.r,WV.level),out=wallElevationSVG(d,WV.far,WV.dims);
  modalEl.classList.toggle('full',!!WV.full);
  modalEl.style.maxWidth=WV.full?'100vw':'96vw';
  modalEl.style.width=WV.full?'99vw':'';
  modalEl.innerHTML=`<h4 style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Fal-nézet szerkesztő — ${WV.level} · ${Math.round(d.len)}×${Math.round(d.H)} mm`
    +`${WV.dirty?'<span style="font-size:11px;color:#c0530f;font-weight:600">● módosítva</span>':''}`
    +`<span style="flex:1"></span>`
    +`<button id="wvUndoB" title="Visszavonás (Ctrl+Z)" style="font-size:12px" ${WV.undo.length?'':'disabled'}>↶</button>`
    +`<button id="wvRedoB" title="Újra (Ctrl+Shift+Z)" style="font-size:12px" ${WV.redo.length?'':'disabled'}>↷</button>`
    +`<button id="wvFull" title="Teljes képernyő (Esc kilép)" style="font-size:12px">${WV.full?'🗗':'⛶'}</button></h4>`
    +`<div class="mrow"><label><input type="checkbox" id="wvFar" ${WV.far?'checked':''}> Túloldal is (szürkén)</label>`
    +`<label><input type="checkbox" id="wvDims" ${WV.dims?'checked':''}> Méretlánc</label>`
    +`<button id="wvFlipSide" title="Az elevációval szemközti faloldal cseréje" style="font-size:11px">⇄ Faloldal csere</button>`
    +`<button id="wvMirror" title="Korrekció: csak a rajz vízszintes tükrözése" style="font-size:11px">🪞 Tükrözés${WV.mirror?' ✓':''}</button>`
    +`<button id="wvOther" title="A fal MÁSIK oldala normál nézetben (oldalváltás + tükrözés egyben)" style="font-size:11px">🔄 Túloldal nézet</button>`
    +`</div>`
    +`<div class="mrow" style="gap:10px;flex-wrap:wrap;font-size:11px;border-top:1px solid #eee;padding-top:5px">`
    +`<b style="color:#555">Rétegek:</b>`
    +`<label><input type="checkbox" id="wvLInst" ${WV.layers.installed?'checked':''}> Beépített</label>`
    +`<label><input type="checkbox" id="wvLCuts" ${WV.layers.cuts?'checked':''}> Vésetek (süllyesztett)</label>`
    +`<label><input type="checkbox" id="wvLNotes" ${WV.layers.notes?'checked':''}> Jegyzetek</label>`
    +`</div>`
    +`<div class="mrow" style="gap:8px;flex-wrap:wrap;font-size:11px"><b style="color:#555">Véset:</b>`
    +`szélesség = ⌀ ×<input id="wvChase" type="number" step="0.1" min="1" value="${state.chaseFactor||1.6}" style="width:46px">`
    +`<span style="color:#ccc">|</span> doboz-ráhagyás <input id="wvPad" type="number" step="1" min="0" value="${state.chasePad!=null?state.chasePad:4}" style="width:42px">mm`
    +`<span style="color:#ccc">|</span> doboz-mélység <input id="wvBoxD" type="number" step="5" min="10" value="${state.boxDepth||45}" style="width:46px">mm`
    +`<label><input type="checkbox" id="wvCutLbl" ${WV.layers.cutLabels!==false?'checked':''}> Feliratok</label>`
    +`<label title="Csak ezen a falon rejti el a jegyzeteket"><input type="checkbox" id="wvNoteSurf" ${noteSurfaceHidden(wallKey(WV.r,WV.level))?'':'checked'}> Jegyzetek ezen a falon</label>`
    +`</div>`
    +`<div class="mrow" style="gap:6px;flex-wrap:wrap;font-size:10.5px;border-top:1px solid #eee;padding-top:5px" id="wvHLines"><b style="color:#555">Vonalak:</b></div>`
    +(WV.drawPi!=null?`<div class="mrow" style="gap:8px;font-size:11px;background:#eef6ff;border:1px solid #2f6fb0;border-radius:5px;padding:3px 6px"><b style="color:#1c4f86">✏ Pálya rajzolása</b><span style="color:#40628a">kattints a következő pontra (a magasság a látható vonalakra ugrik ±50 mm-en belül)</span><button id="wvDrawEnd" style="font-size:11px">✔ Kész (Enter)</button></div>`:'')
    +(WV.warp?`<div class="mrow" style="gap:8px;font-size:11px;background:#fff4ec;border:1px solid #e8641c;border-radius:5px;padding:3px 6px"><b style="color:#c0530f">✥ Warp mód</b><span style="color:#a05a3a">a kijelölt pálya csomópontjai együtt nyúlnak a fogantyúkkal</span><button id="wvWarpOff" style="font-size:11px">Kilépés</button></div>`:'')
    +`<div class="mrow" style="font-size:11px;color:#888">Húzd a készüléket / nyílászárót / csomópontot. Húzd a pálya vonalát = egész szakasz mozgatása; Alt+klikk a vonalon = warp. Jobb klikk: készüléken = doboz menü, pályán = ⌀/mélység/másolás/warp, üres falon = létrehozás (készülék / nyílászáró / pálya / jegyzet). A vésetek a süllyesztett szakaszokból készülnek és egybeolvadnak.</div>`
    +`<div style="display:flex;gap:8px;align-items:flex-start">`
    +`<div id="wvBox" style="flex:1;overflow:auto;max-height:${WV.full?'80vh':'60vh'};border:1px solid #eee;background:#fafafa">${out.svg}</div>`
    +edRailHTML(WV)+`</div>`
    +`<div class="mrow" style="gap:6px;font-size:11px;border-top:1px solid #eee;padding-top:4px">`
    +`<b style="color:#555">Koordináták (mm)</b><button id="wvListT" style="font-size:11px">${WV.list?'elrejt':'mutat'}</button>`
    +`<span style="color:#999">a mezőkbe beírt érték pontos (nincs 10 mm-es kerekítés); a pályacsomópont mozgatja a hozzá kötött készüléket is</span></div>`
    +(WV.list?`<div id="wvList" style="overflow:auto;max-height:${WV.full?'22vh':'26vh'};border:1px solid #eee">${wvListHTML(d,d.len)}</div>`:'')
    +`<div class="mbtns"><button id="wvPng">🖼 PNG</button><button id="wvJson">⬇ JSON</button><button id="wvPrint">🖨 Print/PDF</button>`
    +`<span style="flex:1"></span><button id="wvClose">✕ Elvetés</button><button id="wvSave" class="on">💾 Mentés</button></div>`;
  modalBg.style.display='flex';
  $('wvClose').onclick=()=>wvCloseEditor(false);
  $('wvSave').onclick=()=>wvCloseEditor(true);
  $('wvUndoB').onclick=wvUndo;$('wvRedoB').onclick=wvRedo;
  $('wvFull').onclick=()=>{WV.full=!WV.full;renderWallView();};
  $('wvListT').onclick=()=>{WV.list=!WV.list;renderWallView();};
  if($('wvList')){const rows=wvListRows(d);
    $('wvList').querySelectorAll('.wvcell').forEach(inp=>{inp.onchange=()=>{
      const k=inp.dataset.k,f=inp.dataset.f;let v=+inp.value;if(isNaN(v))return;
      if(f==='r'){const r=rows.find(x=>x.key===k);if(!r)return;wvListApply(rows,k,'l',d.len-v);}
      else wvListApply(rows,k,f,v);
      renderWallView();draw();};});
    $('wvList').querySelectorAll('.wvdel').forEach(btn=>{btn.onclick=()=>{wvListDelete(rows,btn.dataset.k);renderWallView();draw();};});}
  $('wvFar').onchange=e=>{WV.far=e.target.checked;renderWallView();};
  $('wvFlipSide').onclick=()=>{WV.flipSide=!WV.flipSide;renderWallView();};
  $('wvMirror').onclick=()=>{WV.mirror=!WV.mirror;renderWallView();};
  if($('wvOther'))$('wvOther').onclick=()=>{WV.flipSide=!WV.flipSide;WV.mirror=!WV.mirror;WV.sel=null;renderWallView();
    $('hud').textContent='A fal túlsó oldalát nézed (normál állásban).';};
  $('wvLInst').onchange=e=>{WV.layers.installed=e.target.checked;renderWallView();};
  $('wvLCuts').onchange=e=>{WV.layers.cuts=e.target.checked;renderWallView();};
  $('wvLNotes').onchange=e=>{WV.layers.notes=e.target.checked;renderWallView();};
  $('wvChase').onchange=e=>{state.chaseFactor=Math.max(1,+e.target.value||1.6);renderWallView();draw();};
  $('wvPad').onchange=e=>{state.chasePad=Math.max(0,+e.target.value||0);renderWallView();};
  $('wvBoxD').onchange=e=>{state.boxDepth=Math.max(10,+e.target.value||45);renderWallView();};
  $('wvCutLbl').onchange=e=>{WV.layers.cutLabels=e.target.checked;renderWallView();};
  if($('wvNoteSurf'))$('wvNoteSurf').onchange=()=>{wvPush();noteSurfaceToggle(wallKey(WV.r,WV.level));renderWallView();draw();};
  if($('wvWarpOff'))$('wvWarpOff').onclick=()=>{WV.warp=null;renderWallView();};
  if($('wvDrawEnd'))$('wvDrawEnd').onclick=()=>wvFinishPath();
  // per-preset-height-line toggles inside the viewer
  if(!WV.hLines){WV.hLines={};GUIDES.forEach(g=>WV.hLines[g.k]=guideOn[g.k]);}
  const hl=$('wvHLines');if(hl){GUIDES.forEach(g=>{const b=document.createElement('button');b.textContent=g.l;
    b.style.cssText='font-size:10px;padding:1px 5px;border-radius:4px;border:1px solid '+g.c+';'+(WV.hLines[g.k]?('background:'+g.c+';color:#fff'):('background:#fff;color:'+g.c));
    b.onclick=()=>{WV.hLines[g.k]=!WV.hLines[g.k];renderWallView();};hl.appendChild(b);});}
  $('wvDims').onchange=e=>{WV.dims=e.target.checked;renderWallView();};
  $('wvPng').onclick=()=>svgToPng(out.svg,out.w,out.h,'fal_nezet.png');
  $('wvJson').onclick=()=>download('fal_nezet.json',JSON.stringify(d,null,2));
  $('wvPrint').onclick=()=>printSVG(out.svg,'Fal nézet');
  // ---- one shared surface layer; this projection describes the wall elevation ----
  edRailBind(WV);
  const box=$('wvBox'),svgEl=box&&box.querySelector('svg');if(!svgEl)return;
  edBindSurface(WV,svgEl,{
    kind:'wall',
    local:ev=>{const rc=svgEl.getBoundingClientRect(),f=fineXY(ev.clientX,ev.clientY);
      // X is mirrored: screen x maps to u = len − ((px−M)/sc)
      const uRaw=((f[0]-rc.left)/rc.width*out.w-out.M)/out.sc;
      return {u:(WV.mirror?uRaw:(out.len-uRaw)), v:out.H-((f[1]-rc.top)/rc.height*out.h-out.M)/out.sc};},
    clamp:p=>({u:Math.max(0,Math.min(out.len,p.u)),v:Math.max(0,p.v)}),
    data:()=>wallElevationData(WV.r,WV.level),
    nodeUV:n=>{const q=wvNodeUH(n);return {u:q.u,v:q.h};},
    setDev:(di,u,v)=>wvSetDevice(di,u,v),
    setOpening:(oi,u)=>wvSetOpening(oi,u),
    setNode:(pi,ni,u,v)=>wvSetNode(pi,ni,u,v),
    setNote:(i,u,v)=>{const nt=(data.wallNotes||[])[i];if(nt){nt.u=Math.round(u);nt.h=Math.max(0,Math.round(v));}},
    addNode:(u,v)=>wvAddPathNode(u,v),
    soft:el=>{const dd=wallElevationData(WV.r,WV.level),o2=wallElevationSVG(dd,WV.far,WV.dims);
      el.innerHTML=edInner(o2.svg);},
    full:()=>renderWallView(),
    menu:(ev,u,v)=>{const dd=wallElevationData(WV.r,WV.level);
      const hd=edHitDevice(dd,u,v);if(hd){wvDeviceMenu(ev,hd.di);return;}
      const hs=edHitSection(dd,u,v);if(hs){wvSectionMenu(ev,hs);return;}
      WV.railU=u;WV.railH=v;WV.sel=null;wvCreateMenu(ev,u,v);}});
}
// ---- room "unfold": all bounding walls of a room on one sheet ----
function polyBBox(poly){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};}
// ---- HELYISÉG ADATLAP: room-wide data that the rest of the model can actually use ----
const ROOM_USE=['nappali','hálószoba','gyerekszoba','konyha','étkező','fürdőszoba','WC','közlekedő','előszoba',
  'kamra','gardrób','dolgozó','gépészet','mosókonyha','garázs','pince','terasz','egyéb'];
const ROOM_ENV=[
  {k:'szaraz', n:'Száraz',            ip:'IP20',  note:'normál lakótér'},
  {k:'nedves', n:'Nedves',            ip:'IP44',  note:'fürdő 2. zóna, konyhai pult, mosókonyha'},
  {k:'vizes',  n:'Vizes / zuhanyzóna',ip:'IP65',  note:'fürdő 0–1. zóna, zuhany'},
  {k:'kulteri',n:'Kültéri',           ip:'IP44+', note:'terasz, kerti, fedett-nyitott'},
  {k:'poros',  n:'Poros / műhely',    ip:'IP54',  note:'garázs, műhely, gépészet'}];
const ROOM_FLOOR=['laminált','parketta','hidegburkolat','kőburkolat','PVC','szőnyeg','öntött beton','esztrich'];
const ROOM_HEAT=['nincs','padlófűtés','radiátor','padlófűtés + radiátor','split klíma','vegyes'];
function roomEnv(k){return ROOM_ENV.find(e=>e.k===k)||ROOM_ENV[0];}
function polyPerim(poly){let p=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];
  p+=Math.hypot(b[0]-a[0],b[1]-a[1]);}return p;}
function roomCeilH(rm,level){return rm.ch||wallH(level);}
// every device whose plan point sits inside the room polygon
function roomDevices(rm,level){const out=[];data.devices.forEach((d,i)=>{if(d.level!==level)return;
  if(pointInPoly2(d.x,d.y,rm.poly))out.push(i);});return out;}
function pointInPoly2(px,py,poly){let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi))inside=!inside;}
  return inside;}
function roomPropsDialog(rm,level,src){
  const A=polyArea(rm.poly)/1e6,P=polyPerim(rm.poly)/1000,H=roomCeilH(rm,level)/1000;
  const sel=(id,list,cur,w)=>`<select id="${id}" style="width:${w||150}px">`
    +`<option value="">—</option>`+list.map(v=>`<option value="${v}" ${v===cur?'selected':''}>${esc(v)}</option>`).join('')+`</select>`;
  const envOpt=ROOM_ENV.map(e=>`<option value="${e.k}" ${e.k===(rm.env||'szaraz')?'selected':''}>${esc(e.n)} — ${e.ip}</option>`).join('');
  openModal('Helyiség adatlap',
     `<div class="mrow"><label style="width:96px">Név</label><input id="riName" value="${esc(rm.name||'')}" style="flex:1">`
    +`<label style="margin-left:8px">Szám <input id="riNum" value="${esc(rm.num||'')}" placeholder="1.02" style="width:60px"></label></div>`
    +`<div class="mrow"><label style="width:96px">Rendeltetés</label>${sel('riUse',ROOM_USE,rm.use,170)}`
    +`<label style="margin-left:8px">Belmagasság <input id="riCh" type="number" step="10" value="${Math.round(rm.ch||0)}" style="width:76px"> mm</label>`
    +`<span style="color:#999;font-size:11px;margin-left:6px">0 = szint szerinti (${wallH(level)})</span></div>`
    +`<div class="mrow"><label style="width:96px">Környezet</label><select id="riEnv" style="width:230px">${envOpt}</select>`
    +`<span id="riEnvNote" style="color:#999;font-size:11px;margin-left:8px"></span></div>`
    +`<div class="mrow"><label style="width:96px">Padlóburkolat</label>${sel('riMat',ROOM_FLOOR,rm.mat,150)}`
    +`<label style="margin-left:8px">Fűtés ${sel('riHeat',ROOM_HEAT,rm.heat,160)}</label></div>`
    +`<div class="mrow"><label style="width:96px">Falfelület</label><input id="riWall" value="${esc(rm.wallFin||'')}" placeholder="glettelt festett / csempe 2,1 m-ig" style="flex:1"></div>`
    +`<div class="mrow"><label style="width:96px">Mennyezet</label><input id="riCeil" value="${esc(rm.ceilFin||'')}" placeholder="glettelt festett / álmennyezet 2,60 m" style="flex:1"></div>`
    +`<div class="mrow"><label style="width:96px">Álmennyezet</label><input id="riDrop" type="number" step="10" min="0" value="${Math.round(rm.dropC||0)}" style="width:86px"> mm`
    +`<span style="color:#999;font-size:11px;margin-left:8px">0 = a szint beállítása szerint (${DROPC[level]?DROPC[level]+' mm':'nincs'})</span></div>`
    +`<div class="mrow" style="border-top:1px solid #eee;padding-top:5px"><b style="font-size:11px;color:#555">Villamos alapadatok</b></div>`
    +`<div class="mrow"><label style="width:96px">Aljzat magasság</label><input id="riHS" type="number" step="10" value="${Math.round(rm.hSocket||0)}" style="width:76px"> mm`
    +`<label style="margin-left:10px">Kapcsoló <input id="riHK" type="number" step="10" value="${Math.round(rm.hSwitch||0)}" style="width:76px"> mm</label>`
    +`<button id="riApply" style="margin-left:8px;font-size:11px">⤓ Alkalmaz a helyiség készülékeire</button></div>`
    +`<div class="mrow"><label style="width:96px">Áramkör-előtag</label><input id="riCirc" value="${esc(rm.circ||'')}" placeholder="pl. NA" style="width:90px">`
    +`<label style="margin-left:10px"><input type="checkbox" id="riNoText" ${rm.noText?'checked':''}> Felirat elrejtése</label>`
    +`<label style="margin-left:10px">Szín <input type="color" id="riFill" value="${(rm.fill||'#e2ddd0')}" style="width:44px;padding:0"></label></div>`
    +`<div class="mrow"><label style="width:96px">Megjegyzés</label><textarea id="riNote" rows="2" style="flex:1;font:inherit">${esc(rm.note||'')}</textarea></div>`
    +`<div class="mrow" id="riInfo" style="font-size:11px;color:#777;border-top:1px solid #eee;padding-top:5px"></div>`,
    ()=>{pushUndo();
      rm.name=$('riName').value.trim();
      const st=(k,v)=>{if(v)rm[k]=v;else delete rm[k];};
      st('num',$('riNum').value.trim());st('use',$('riUse').value);st('env',$('riEnv').value==='szaraz'?'':$('riEnv').value);
      st('mat',$('riMat').value);st('heat',$('riHeat').value);
      st('wallFin',$('riWall').value.trim());st('ceilFin',$('riCeil').value.trim());
      st('circ',$('riCirc').value.trim());st('note',$('riNote').value.trim());
      st('ch',+$('riCh').value||0);st('hSocket',+$('riHS').value||0);st('hSwitch',+$('riHK').value||0);
      st('dropC',+$('riDrop').value||0);
      rm.noText=$('riNoText').checked;rm.fill=$('riFill').value;
      draw();},'Mentés');
  const info=()=>{const ch=(+$('riCh').value||wallH(level))/1000,e=roomEnv($('riEnv').value);
    const wallA=P*ch,vol=A*ch;
    $('riEnvNote').textContent=e.ip+' — '+e.note;
    $('riInfo').innerHTML=`Alapterület <b>${A.toFixed(2)} m²</b> · kerület <b>${P.toFixed(2)} m</b> · belmagasság <b>${ch.toFixed(2)} m</b>`
      +` · falfelület <b>${wallA.toFixed(1)} m²</b> · légtérfogat <b>${vol.toFixed(1)} m³</b>`
      +` · készülék a helyiségben: <b>${roomDevices(rm,level).length} db</b>`
      +`<br>Minimum védettség a környezet szerint: <b>${e.ip}</b>`;};
  $('riCh').oninput=info;$('riEnv').onchange=info;
  $('riApply').onclick=()=>{const hs=+$('riHS').value||0,hk=+$('riHK').value||0;
    if(!hs&&!hk){alert('Adj meg legalább egy magasságot.');return;}
    const idx=roomDevices(rm,level).filter(i=>{const t=data.devices[i].type;
      return (hs&&(t==='socket'))||(hk&&(t==='switch'));});
    if(!idx.length){alert('Nincs érintett készülék ebben a helyiségben.');return;}
    if(!confirm(idx.length+' készülék magassága átáll. Folytatod?'))return;
    pushUndo();idx.forEach(i=>{const d=data.devices[i];d.h=(d.type==='socket'?hs:hk);});
    draw();$('hud').textContent=idx.length+' készülék magassága frissítve.';};
  info();}
function roomWalls(poly,level){const bb=polyBBox(poly),T=420,out=[];
  const test=(r,side)=>{const horiz=(r.x1-r.x0)>=(r.y1-r.y0),cx=(r.x0+r.x1)/2,cy=(r.y0+r.y1)/2;
    if(side==='É'&&horiz&&Math.abs(cy-bb.y0)<T&&r.x1>bb.x0-T&&r.x0<bb.x1+T)return true;
    if(side==='D'&&horiz&&Math.abs(cy-bb.y1)<T&&r.x1>bb.x0-T&&r.x0<bb.x1+T)return true;
    if(side==='NY'&&!horiz&&Math.abs(cx-bb.x0)<T&&r.y1>bb.y0-T&&r.y0<bb.y1+T)return true;
    if(side==='K'&&!horiz&&Math.abs(cx-bb.x1)<T&&r.y1>bb.y0-T&&r.y0<bb.y1+T)return true;return false;};
  ['É','K','D','NY'].forEach(side=>{const r=(WALLS[level]||[]).find(w=>test(w,side));if(r)out.push({side,r});});
  return out;}

