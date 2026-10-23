// ==========================================================================
// 05n-marks.js — the marking layer of a BRIDGE Stack: tags on walls, wall faces, strips, openings, planes
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Marks are CONSTRAINTS and INTENTIONS the later layers read: wall materials feed the RF model, strips
// attract placement, `ban` marks raise warnings on routes. They are stored in data.marks (record shapes:
// 00_CONTRACT §3.2) and drawn through the shared stack hooks of 05m (STK_SCENE / STK_OVERLAY / STK_TOOLS /
// STK_CTX / STK_WV). Prefix: mrk. Tables are read inside functions only.

// 2026-10-15 (user): green belongs to Vezethető fal alone, so 'preferred' is blue now; per-tag looks are in MRK_STYLE
const MRK_POL={plus:{n:'Előnyös',c:'#3f7fbf',s:'+'},minus:{n:'Kerülendő',c:'#d08a1e',s:'−'},
               ban:{n:'Tilos',c:'#c8372d',s:'⛔'},none:{n:'Semleges',c:'#6f7f95',s:'·'}};
const MRK_TAGS={
 wall:[ // whole wall — material and status
  {k:'tartofal',   n:'Tartófal — nem véshető',          pol:'ban',  rf:15},
  {k:'fofal',      n:'Vastag fal / főfal',               pol:'minus',rf:12},
  {k:'valaszfal',  n:'Vékony válaszfal',                 pol:'none', rf:5},
  {k:'gipszkarton',n:'Gipszkarton / szerelt fal',        pol:'plus', rf:3},
  {k:'elotet',     n:'Előtétfal / installációs fal',     pol:'plus', rf:3},
  {k:'belso',      n:'Belső fal',                        pol:'none'},
  {k:'szomszed',   n:'Szomszéd felé (közös fal)',        pol:'ban',  rf:12},
  {k:'homlokzat',  n:'Külső fal (homlokzat)',           pol:'minus',rf:15},
  {k:'gepeszet',   n:'Gépészet a falban (víz, gáz, fűtés)',pol:'ban'},
  {k:'kemeny',     n:'Kémény / szellőzőkürtő',           pol:'ban'},
  {k:'tuzfal',     n:'Tűzfal / tűzszakasz határ',        pol:'minus'},
  {k:'uvegfal',    n:'Üvegfal / üvegtégla',              pol:'ban',  rf:2}],   // low-E glass is 20+ dB — tag it fofal instead
 side:[ // one face of a wall
  {k:'lforma',     n:'L-forma — preferált sarok',        pol:'plus'},          // [user] two adjacent sides tagged together
  {k:'media',      n:'Média / TV fal',                   pol:'plus'},
  {k:'fejveg',     n:'Ágy fejvége',                      pol:'plus'},
  {k:'pult',       n:'Konyhapult fala',                  pol:'plus'},
  {k:'iroasztal',  n:'Íróasztal fala',                   pol:'plus'},
  {k:'butor',      n:'Bútor takarja (szekrény)',         pol:'minus'},
  {k:'ajtolap',    n:'Ajtólap mögé esik',                pol:'minus'},
  {k:'radiator',   n:'Fűtőtest előtte',                  pol:'minus'},
  {k:'csempe',     n:'Csempézett (doboz a csempekiosztáshoz)',pol:'none'},
  {k:'vizes',      n:'Vizes zóna (fürdő 0–2)',           pol:'ban'},
  {k:'disz',       n:'Díszfal / látszó felület',         pol:'minus'}],
 vstrip:[ // vertical 300 mm strip — where a system element goes [user]
  {k:'elo',        n:'Elosztószekrény helye',            pol:'plus'},
  {k:'base',       n:'BASE helye (NET · COMP · MEDIA)',  pol:'plus'},
  {k:'rbx',        n:'RBX helye',                        pol:'plus'},
  {k:'ssc',        n:'Biztonsági központ helye',         pol:'plus'},
  {k:'felszallo',  n:'Felszálló / függőleges nyomvonal', pol:'plus'},
  {k:'kapcsolo',   n:'Kapcsolóoszlop (ajtó mellett)',    pol:'plus'},
  {k:'portal',     n:'Portálpont (ajtókeret mellett)',   pol:'plus'},
  {k:'av',         n:'AV / média oszlop',                pol:'plus'},
  {k:'zona_f',     n:'Szerelési zóna, függőleges (DIN 18015-3)',pol:'plus'}],
 hstrip:[ // horizontal 300 mm strip along the wall [user]
  {k:'labfeny',    n:'Éjszakai / lábfény',               pol:'plus', v:[150,450]},          // [user]
  {k:'dugalj',     n:'Dugaljsáv',                        pol:'plus', v:[150,450]},
  {k:'kapcsolo',   n:'Kapcsolómagasság',                 pol:'plus', v:[950,1250]},
  {k:'pult',       n:'Pult feletti sáv',                 pol:'plus', v:[1050,1350]},
  {k:'szenzor',    n:'Érzékelősáv',                      pol:'plus', v:[2000,2300]},
  {k:'cove',       n:'Mennyezet alatti sáv (rejtett világítás)',pol:'plus', v:[-300,0]},
  {k:'zona_v',     n:'Szerelési zóna, vízszintes (DIN 18015-3)',pol:'plus', v:[-450,-150]},
  {k:'lambazat',   n:'Lábazat / lambéria',               pol:'minus', v:[0,150]}],
 door:[
  {k:'bejarat',    n:'Bejárat — ház-számláló horgony',   pol:'none'},          // S3: the entry door anchors the house count
  {k:'portal',     n:'Portál',                           pol:'none'},
  {k:'p0',n:'P-0 szint',grp:'tier'},{k:'p1',n:'P-1 szint',grp:'tier'},{k:'p2',n:'P-2 szint',grp:'tier'},{k:'p3',n:'P-3 szint',grp:'tier'},
  {k:'lepcso',     n:'Lépcsőportál — szint-számláló horgony',pol:'none'},    // S3/B1: the stairway portal is the second count anchor
  {k:'nyitva',     n:'Mindig nyitva — nem portál',       pol:'none'},          // S3 "habitually open": the two zones merge
  {k:'nemhasznalt',n:'Nem használt / zárva',             pol:'none'},
  {k:'menekulo',   n:'Menekülési útvonal',               pol:'none'},          // S6 alarm_type: life-safety unlocks it
  {k:'kulso',      n:'Külső (terasz / erkély / kert)',   pol:'none'},
  {k:'tolo',       n:'Tolóajtó (a tok falában nincs doboz)',pol:'minus'},
  {k:'uveg',       n:'Üvegajtó',                         pol:'none'},
  {k:'technikai',  n:'Technikai / garázs / kamra',       pol:'none'}],
 window:[ // [user asked for suggestions] — every tag here feeds a later layer
  {k:'nyithato',   n:'Nyitható (bukó-nyíló)',            grp:'open'},
  {k:'fix',        n:'Fix, nem nyitható',                grp:'open'},
  {k:'redony',     n:'Redőny motorral',                  pol:'none'},          // → SHU need in the room (D2)
  {k:'arnyekolo',  n:'Árnyékoló / reluxa / függönymotor',pol:'none'},          // → SHU need
  {k:'nyitaserz',  n:'Nyitásérzékelő kell',              pol:'none'},          // → SEC contact + "fűtés le, ha nyitva"
  {k:'napos',      n:'Napsütötte (D / Ny) — árnyékolás-automatika',pol:'none'},
  {k:'menekulo',   n:'Menekülési nyílás',                pol:'none'},
  {k:'szellozo',   n:'Szellőztető ablak (CO₂ / pára szerint)',pol:'none'},
  {k:'radiator',   n:'Alatta fűtőtest',                  pol:'minus'},         // no box below the sill; thermostat away from it
  {k:'tukrozes',   n:'Tükröződés — képernyő ne nézzen vele szembe',pol:'minus'},
  {k:'kulsoszenz', n:'Kültéri érzékelő helye (fény, eső, hő)',pol:'plus'},
  {k:'vedett',     n:'Fokozott védelem (rács / üvegtörés-érzékelő)',pol:'none'},
  {k:'tetoablak',  n:'Tetőablak',                        pol:'none'}],
 plane:[ // floor and ceiling strips and zones. pl = floor | ceiling | both
  {k:'folyoso',    n:'Közlekedő sáv / folyosó',  pl:'floor',  pol:'none'},     // [user] corridors
  {k:'tartozkodas',n:'Tartózkodási zóna',        pl:'floor',  pol:'none'},     // [user] dwells
  {k:'vizes',      n:'Vizes terület',            pl:'floor',  pol:'ban'},      // [user] water areas
  {k:'butor',      n:'Fix bútor alatt',          pl:'floor',  pol:'minus'},
  {k:'padlofutes', n:'Padlófűtés — nem fúrható', pl:'floor',  pol:'ban'},
  {k:'padlodoboz', n:'Padlódoboz helye',         pl:'floor',  pol:'plus'},
  {k:'agy',        n:'Ágy helye',                pl:'floor',  pol:'none'},
  {k:'ules',       n:'Kanapé / ülőhely',         pl:'floor',  pol:'none'},
  {k:'asztal',     n:'Asztal / sziget',          pl:'floor',  pol:'none'},
  {k:'szintkul',   n:'Lépcső / szintkülönbség',  pl:'floor',  pol:'none'},
  {k:'almennyezet',n:'Álmennyezet — szerelhető', pl:'ceiling',pol:'plus'},
  {k:'beton',      n:'Látszó beton — nem véshető',pl:'ceiling',pol:'ban'},
  {k:'lampasor',   n:'Lámpasor / világítási sáv',pl:'ceiling',pol:'plus'},
  {k:'hangszoro',  n:'Hangszórópár zónája',      pl:'ceiling',pol:'plus'},
  {k:'szenzor',    n:'Érzékelőzóna',             pl:'both',   pol:'plus'},
  {k:'kifuvo',     n:'Klíma / szellőző kifúvó',  pl:'ceiling',pol:'minus'}]};  // keep sensors out of the air stream
const MRK_TRACE_TAGS=[{k:'mozgas',n:'Mozgás'},{k:'atjaras',n:'Átjárás'},{k:'ejszakai',n:'Éjszakai útvonal'},{k:'lepcso',n:'Lépcsőhasználat'}];
const MRK_DEF={strip:300, snap:50};  // [user] default strip width, mm; positions snap to 50 mm
// hstrip v:[a,b] = default height band in mm above the floor; a negative value counts down from the
// ceiling (wall h or LH[level]): [-450,-150] = 450…150 mm below the ceiling (DIN 18015-3 upper zone).
const MRK_KINDS={wall:'Teljes fal',side:'Falfelület',vstrip:'Függőleges sáv',hstrip:'Vízszintes sáv',hband:'Körbefutó sáv',
                 door:'Ajtó',window:'Ablak',plane:'Padló / mennyezet'};
const MRK_MODES=[{k:'wall',n:'teljes fal'},{k:'side',n:'falfelület (oldal)'},{k:'vstrip',n:'függőleges sáv'},{k:'hstrip',n:'vízszintes sáv'}];

// ---- data helpers ------------------------------------------------------------------------------------
function mrkList(){if(!Array.isArray(data.marks))data.marks=[];return data.marks;}
// marks go on the active stack's Jelölés layer, else on the active layer
function mrkLayer(){const S=(typeof stkActive==='function')?stkActive():null,L=S?stkLayer(S.id,'mark'):null;
  return L?L.id:state.activeLayer;}
// a wall is always looked up by id — walls are rebuilt on undo, a held rect would be an orphan
function mrkWallById(level,id){return id?(WALLS[level]||[]).find(r=>r&&r.id===id)||null:null;}
function mrkFindWall(id){for(const l of ORD){const r=mrkWallById(l,id);if(r)return {r,level:l};}return null;}
function mrkWallLen(r){const wi=wallInfo(r);return wi.horiz?r.x1-r.x0:r.y1-r.y0;}
function mrkWallH(r,level){return (r&&r.h)||wallH(level);}
// mm along the centreline from seg[0] (x0 or y0), clamped to the wall
function mrkU(r,x,y){const wi=wallInfo(r),a=wi.seg[0],u=wi.horiz?x-a[0]:y-a[1];return Math.max(0,Math.min(mrkWallLen(r),u));}
// the plan point on the face of `side` (+1 = along wallInfo(r).perp), `off` mm further out
function mrkFacePt(r,side,u,off){const wi=wallInfo(r),a=wi.seg[0],k=side*(wi.thick/2+(off||0));
  return wi.horiz?[a[0]+u+wi.perp[0]*k,a[1]+wi.perp[1]*k]:[a[0]+wi.perp[0]*k,a[1]+u+wi.perp[1]*k];}
// [[u0,u1]…] where the face of `side` looks into `poly`: sampled every 100 mm at ROOM_PROBE past the face
function mrkFaceRanges(r,side,poly){const len=mrkWallLen(r),out=[];let from=null,last=null;
  const us=[];for(let u=0;u<len;u+=100)us.push(u);us.push(len);
  us.forEach(u=>{const p=mrkFacePt(r,side,u,ROOM_PROBE),inn=pointInPoly(p[0],p[1],poly);
    if(inn){if(from===null)from=u;last=u;}
    else if(from!==null){out.push([from,last]);from=null;}});
  if(from!==null)out.push([from,last]);
  return out;}
// the allRooms entry that holds a point on that face (topmost wins, like roomHitAt)
function mrkRoomOfFace(level,r,side,u){const p=mrkFacePt(r,side,u,ROOM_PROBE),list=allRooms(level);
  for(let k=list.length-1;k>=0;k--)if(pointInPoly(p[0],p[1],list[k].rm.poly))return list[k];return null;}
function mrkRoomById(id){if(!id)return null;
  for(const l of ORD){const e=allRooms(l).find(x=>x.rm&&x.rm.id===id);if(e)return e;}return null;}
// a tag's height band as absolute mm: a negative bottom counts BOTH ends down from the ceiling
function mrkVAbs(v,r,level){const H=mrkWallH(r,level);return v[0]<0?[H+v[0],H+v[1]]:[v[0],v[1]];}
function mrkTag(kind,k){return (MRK_TAGS[kind]||[]).find(t=>t.k===k)||null;}
function mrkTagName(m,k){const kind=m.kind==='hband'?'hstrip':(m.kind==='opening'?mrkOpeningKind(m):(m.kind==='pstrip'||m.kind==='zone')?'plane':m.kind);
  // a face span drawn with the Szabályok tool is stored as a strip but carries a face tag: look in every list before
  // falling back to the raw key (the screenshot of 2026-10-15 showed 'kerulendo')
  let t=mrkTag(kind,k);if(!t)for(const K in MRK_TAGS){t=MRK_TAGS[K].find(x=>x.k===k);if(t)break;}return t?t.n:k;}
function mrkSnap(v){return Math.round(v/MRK_DEF.snap)*MRK_DEF.snap;}

// every mark covering that point of a wall face: THE query the later layers use.
// → [{m, kind, pol, tags}]. Marks are returned whatever their layer shows: a hidden layer is still a constraint.
function mrkAt(level,wallId,side,u,v){const out=[],r=mrkWallById(level,wallId);let room;
  mrkList().forEach(m=>{if(m.level!==level)return;let hit=false;
    if(m.kind==='wall')hit=m.wall===wallId;
    else if(m.kind==='wspan')hit=m.wall===wallId&&(u==null||(u>=Math.min(m.u0,m.u1)&&u<=Math.max(m.u0,m.u1)));
    else if(m.kind==='side')hit=m.wall===wallId&&m.side===side;
    else if(m.kind==='vstrip')hit=m.wall===wallId&&m.side===side&&(u==null||(u>=m.u0&&u<=m.u1));
    else if(m.kind==='hstrip')hit=m.wall===wallId&&m.side===side&&(v==null||(v>=m.v0&&v<=m.v1));
    else if(m.kind==='hband'&&r){if(room===undefined)room=mrkRoomOfFace(level,r,side,u==null?mrkWallLen(r)/2:u);
      hit=!!room&&room.rm.id===m.room&&(v==null||(v>=m.v0&&v<=m.v1));}
    if(hit)out.push({m,kind:m.kind,pol:m.pol,tags:m.tags||[]});});
  return out;}
// union of the tags of the `wall` marks on that wall
function mrkWallTags(wallId){const s=[];
  mrkList().forEach(m=>{if(m.kind==='wall'&&m.wall===wallId)(m.tags||[]).forEach(t=>{if(s.indexOf(t)<0)s.push(t);});});return s;}

// ---- geometry of a mark: plan segments for hit-testing and drawing ------------------------------------------
// hband: every wall face of the room that looks into it. Sampling that is O(walls × length), so it is cached
// against a signature of the walls and the room outline.
const MRK_BAND_CACHE={};
function mrkBandFaces(m){const room=mrkRoomById(m.room);if(!room)return [];
  const ws=WALLS[m.level]||[];let sig=m.room+'|'+JSON.stringify(room.rm.poly)+'|'+ws.length;
  ws.forEach(r=>{sig+='|'+r.x0+','+r.y0+','+r.x1+','+r.y1+','+(r.id||'');});
  const c=MRK_BAND_CACHE[m.id];if(c&&c.sig===sig)return c.faces;
  const faces=[];ws.forEach(r=>{[1,-1].forEach(side=>{mrkFaceRanges(r,side,room.rm.poly).forEach(g=>{
    if(g[1]-g[0]>=100)faces.push({wall:r.id,side,u0:g[0],u1:g[1]});});});});
  MRK_BAND_CACHE[m.id]={sig,faces};return faces;}
// → {level, faces:[{r,side,u0,u1,off}], rect?} or null when the wall is gone
function mrkGeom(m){
  if(m.kind==='wall'){const r=mrkWallById(m.level,m.wall);return r?{level:m.level,rect:r,faces:[]}:null;}
  // a part of a wall, both faces (the marker pen's whole-wall inks, R5; R2's vezethető spans): the box between u0 and u1
  if(m.kind==='wspan'){const r=mrkWallById(m.level,m.wall);if(!r)return null;const wi=wallInfo(r),a=Math.min(m.u0,m.u1),b=Math.max(m.u0,m.u1);
    return {level:m.level,rect:wi.horiz?{x0:r.x0+a,x1:r.x0+b,y0:r.y0,y1:r.y1}:{x0:r.x0,x1:r.x1,y0:r.y0+a,y1:r.y0+b},faces:[]};}
  if(m.kind==='side'){const r=mrkWallById(m.level,m.wall);return r?{level:m.level,faces:[{r,side:m.side,u0:0,u1:mrkWallLen(r),off:0}]}:null;}
  if(m.kind==='vstrip'){const r=mrkWallById(m.level,m.wall);return r?{level:m.level,faces:[{r,side:m.side,u0:m.u0,u1:m.u1,off:25}]}:null;}
  if(m.kind==='hstrip'){const r=mrkWallById(m.level,m.wall);return r?{level:m.level,faces:[{r,side:m.side,u0:0,u1:mrkWallLen(r),off:0}]}:null;}
  if(m.kind==='hband'){const f=[];mrkBandFaces(m).forEach(g=>{const r=mrkWallById(m.level,g.wall);if(r)f.push({r,side:g.side,u0:g.u0,u1:g.u1,off:0});});
    return {level:m.level,faces:f};}
  return null;}

// ---- drawing: plan --------------------------------------------------------------------------------------------
// The look of a mark: its first tag with a style here, else its polarity colour. Only the LOOK — the polarity still
// decides routing. Colour coding by the user, 2026-10-15: only Vezethető fal is green; L-forma light blue; Külső fal
// grey; Közlekedő an opaque purple tint; Kémény / strang off-black brown; Padlófűtés a tinted, horizontally striped
// zone; Fűtőtest a heavy white zig-zag with a thin black contour (a radiator).
const MRK_STYLE={vezetheto:{c:'#2e9e5b'},lforma:{c:'#6cb8ea'},media:{c:'#2f5e9e'},homlokzat:{c:'#8a8f96',op:0.22},belso:{c:'#8a8f96'},
  folyoso:{c:'#8458b8',op:0.32},kemeny:{c:'#3b2f29',op:0.42},strang:{c:'#3b2f29',op:0.42},
  padlofutes:{c:'#cf5a3c',op:0.2,pat:'hstripes'},radiator:{c:'#1e1e1e',pat:'radiator'}};
function mrkStyle(m){for(const k of (m&&m.tags)||[])if(MRK_STYLE[k])return MRK_STYLE[k];return null;}
function mrkCol(m){const st=mrkStyle(m);return st?st.c:(MRK_POL[m.pol]||MRK_POL.none).c;}
function mrkOp(m,def){const st=mrkStyle(m);return st&&st.op!=null?st.op:def;}
// Fűtőtest: a zig-zag 40–140 mm in front of the face, drawn as a thin black contour under a white body
function mrkRadiator(f,z){const pts=[],u0=Math.min(f.u0,f.u1),u1=Math.max(f.u0,f.u1),step=70;let i=0;
  for(let u=u0;u<u1;u+=step,i++){const p=mrkFacePt(f.r,f.side,u,f.off+(i%2?140:40));pts.push([p[0],p[1],z]);}
  const e=mrkFacePt(f.r,f.side,u1,f.off+(i%2?140:40));pts.push([e[0],e[1],z]);const P=p2b(pts);
  return `<polyline points="${P}" fill="none" stroke="#1e1e1e" stroke-width="${vsP(5.2)}" stroke-linejoin="miter" stroke-linecap="square"/>`
    +`<polyline points="${P}" fill="none" stroke="#fff" stroke-width="${vsP(3.4)}" stroke-linejoin="miter" stroke-linecap="square"/>`;}
function mrkLine(a,b,z,col,w,dash){w=vsP(w);dash=dash?vsDash(dash):dash;return `<polyline points="${p2b([[a[0],a[1],z],[b[0],b[1],z]])}" fill="none" stroke="${col}" stroke-width="${w}"${dash?` stroke-dasharray="${dash}"`:''} stroke-linecap="round"/>`;}
// haloed text: a stroke pass, then a fill pass (exporters ignore paint-order)
function mrkText(x,y,z,txt,col,size,anchor){size=vsP(size);const b=planToBase(x,y,z),a=anchor||'middle',t=esc(String(txt));
  return `<text x="${b[0].toFixed(1)}" y="${b[1].toFixed(1)}" font-size="${size}" text-anchor="${a}" fill="none" stroke="#fff" stroke-width="${vsP(2.6)}" stroke-linejoin="round">${t}</text>`
        +`<text x="${b[0].toFixed(1)}" y="${b[1].toFixed(1)}" font-size="${size}" text-anchor="${a}" fill="${col}">${t}</text>`;}
function mrkFirstTag(m){const k=(m.tags||[])[0];return k?mrkTagName(m,k).replace(/ [—(].*$/,''):'';}
function mrkTrunc(s,n){return s.length>n?s.slice(0,n-1)+'…':s;}
function mrkBand(m){return '↕ '+Math.round(m.v0)+'–'+Math.round(m.v1);}
// the SVG of one wall-related mark (also used, un-wrapped, for the hover / drag preview)
function mrkWallSvg(m){const g=mrkGeom(m);if(!g)return '';const z=dz(g.level,0),col=mrkCol(m);let s='';
  if(m.kind==='wall'||m.kind==='wspan'){const r=g.rect;
    s+=`<polygon points="${p2b([[r.x0,r.y0,z],[r.x1,r.y0,z],[r.x1,r.y1,z],[r.x0,r.y1,z]])}" fill="${col}" fill-opacity="${mrkOp(m,0.12)}" stroke="${col}" stroke-width="${vsP(2)}"/>`;
    const lbl=mrkTrunc(mrkFirstTag(m)||MRK_POL[m.pol].s,14);
    s+=mrkText((r.x0+r.x1)/2,(r.y0+r.y1)/2,z,lbl,col,9);return s;}
  g.faces.forEach(f=>{const a=mrkFacePt(f.r,f.side,f.u0,f.off),b=mrkFacePt(f.r,f.side,f.u1,f.off);
    if((m.kind==='side'||m.kind==='vstrip')&&(mrkStyle(m)||{}).pat==='radiator')s+=mrkRadiator(f,z);   // a dragged face span too
    else if(m.kind==='side')s+=mrkLine(a,b,z,col,3);
    else if(m.kind==='vstrip')s+=mrkLine(a,b,z,col,6);
    else s+=mrkLine(a,b,z,col,2,'6 4');
    if(m.kind==='hstrip'||m.kind==='hband')s+=mrkText((a[0]+b[0])/2,(a[1]+b[1])/2,z,mrkBand(m),col,9);});
  if(m.kind==='side'&&(m.tags||[]).indexOf('lforma')>=0&&g.faces[0])s+=mrkLMark(m,g.faces[0],z,col);
  if(m.kind==='side'||m.kind==='vstrip'){const f=g.faces[0],a=mrkFacePt(f.r,f.side,(f.u0+f.u1)/2,f.off+60),t=mrkFirstTag(m);
    if(t&&!(mrkStyle(m)||{}).noText)s+=mrkText(a[0],a[1],z,mrkTrunc(t,14),col,8.5);}   // noText: an ink whose colour says it (08r Mozi fal)
  return s;}
// L-forma: a small L at the end of this face that lies nearest another lforma face
function mrkLMark(m,f,z,col){
  const ends=[[mrkFacePt(f.r,f.side,0,0)],[mrkFacePt(f.r,f.side,mrkWallLen(f.r),0)]];let best=null,bd=700;
  mrkList().forEach(o=>{if(o===m||o.kind!=='side'||o.level!==m.level||(o.tags||[]).indexOf('lforma')<0)return;
    const r=mrkWallById(o.level,o.wall);if(!r)return;
    [mrkFacePt(r,o.side,0,0),mrkFacePt(r,o.side,mrkWallLen(r),0)].forEach(p=>ends.forEach(e=>{const d=Math.hypot(p[0]-e[0][0],p[1]-e[0][1]);
      if(d<bd){bd=d;best=e[0];}}));});
  return best?mrkText(best[0],best[1],z,'L',col,11):'';}
function mrkSceneSvg(){let s='';
  mrkList().forEach(m=>{if(!state.levels[m.level]||!layerShows(m,'mark'))return;
    let svg='';
    if(m.kind==='wall'||m.kind==='wspan'||m.kind==='side'||m.kind==='vstrip'||m.kind==='hstrip'||m.kind==='hband')svg=mrkWallSvg(m);
    else if(typeof mrkOpeningSvg==='function'&&m.kind==='opening')svg=mrkOpeningSvg(m);
    else if(typeof mrkPlaneSvg==='function'&&(m.kind==='pstrip'||m.kind==='zone'))svg=mrkPlaneSvg(m);
    if(svg)s+=lyrWrap(m,'mark',svg);});
  return s;}

// ---- drawing: Wall View (elevation mm) ---------------------------------------------------------------------------
// ctx = {d, X, Y, sc, len, H}: the elevation's own scales. The wall open in the view is WV.r; the face the viewer
// looks at is +perp unless the view is flipped.
function mrkWvSvg(ctx){if(typeof WV==='undefined'||!WV||!WV.r||!ctx)return '';
  const r=WV.r,id=r.id,lvl=ctx.d.level,vs=WV.flipSide?-1:1,X=ctx.X,Y=ctx.Y,H=ctx.H,len=ctx.len;let s='';
  const rect=(x0,y0,x1,y1,m,lbl)=>{const col=mrkCol(m),x=Math.min(X(x0),X(x1)),y=Math.min(Y(y0),Y(y1)),w=Math.abs(X(x1)-X(x0)),h=Math.abs(Y(y1)-Y(y0));
    return `<g class="mrkwv"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="1"/>`
      +`<text x="${(x+3).toFixed(1)}" y="${(y+10).toFixed(1)}" font-size="9" fill="${col}">${esc(lbl)}</text></g>`;};
  mrkList().forEach(m=>{if(m.level!==lvl||!layerShows(m,'mark'))return;let svg='';
    const t=mrkTrunc(mrkFirstTag(m)||MRK_POL[m.pol].s,18);
    if(m.wall===id&&m.kind==='wall'){const col=mrkCol(m);
      svg=`<g class="mrkwv"><rect x="${Math.min(X(0),X(len))+2}" y="${Y(H)+2}" width="${(len*ctx.sc-4).toFixed(1)}" height="${(H*ctx.sc-4).toFixed(1)}" fill="none" stroke="${col}" stroke-width="4" stroke-opacity="0.55"/>`
        +`<text x="${Math.min(X(0),X(len))+8}" y="${Y(H)+16}" font-size="9" fill="${col}">${esc(t)}</text></g>`;}
    else if(m.wall===id&&m.side===vs){
      if(m.kind==='side'){const col=mrkCol(m);
        svg=`<g class="mrkwv"><rect x="${Math.min(X(0),X(len))+2}" y="${Y(H)+2}" width="${(len*ctx.sc-4).toFixed(1)}" height="${(H*ctx.sc-4).toFixed(1)}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="6 3" stroke-opacity="0.55"/>`
          +`<text x="${Math.min(X(0),X(len))+8}" y="${Y(H)+28}" font-size="9" fill="${col}">${esc(t)}</text></g>`;}
      else if(m.kind==='vstrip')svg=rect(m.u0,0,m.u1,H,m,t);
      else if(m.kind==='hstrip')svg=rect(0,m.v0,len,m.v1,m,t+' '+mrkBand(m));}
    else if(m.kind==='hband'){const g=mrkBandFaces(m).filter(f=>f.wall===id&&f.side===vs);
      svg=g.map(f=>rect(f.u0,m.v0,f.u1,m.v1,m,t+' '+mrkBand(m))).join('');}
    if(svg)s+=lyrWrap(m,'mark',svg);});
  return s;}

// ---- the picker -------------------------------------------------------------------------------------------------------
// opt: {tags:[…] the tag list to offer (default MRK_TAGS[kind]), h: wall height for hstrip bands}
let MRK_T={on:false,mode:'wall',pol:'plus',tags:[]};          // the brush
function mrkPicker(kind,m,onOk,opt){opt=opt||{};
  const list=opt.tags||MRK_TAGS[kind]||[],cur=m||{pol:opt.pol||MRK_T.pol,tags:MRK_T.tags.filter(k=>list.some(t=>t.k===k))},tk=cur.tags||[];
  const pols=['plus','minus','ban','none'];
  const first=()=>{const k=[...document.querySelectorAll('.mpTag')].filter(c=>c.checked).map(c=>c.value)[0];return list.find(t=>t.k===k)||null;};
  const vOf=t=>t&&t.v?mrkVAbs(t.v,{h:opt.h||2700},'ground'):null;
  const hv=(m&&m.v0!=null)?[m.v0,m.v1]:(vOf(tk.length?list.find(t=>t.k===tk[0]):null)||[150,450]);
  openModal('Jelölés — '+(MRK_KINDS[kind]||kind),
    `<div class="mrow">`+pols.map(p=>`<label style="margin-right:10px"><input type="radio" name="mpPol" value="${p}" ${cur.pol===p?'checked':''}> <b style="color:${MRK_POL[p].c}">${MRK_POL[p].s}</b> ${MRK_POL[p].n}</label>`).join('')+`</div>`
   +`<div style="max-height:260px;overflow:auto;margin:4px 0">`
   +list.map(t=>`<div><label><input type="checkbox" class="mpTag" value="${t.k}" ${tk.indexOf(t.k)>=0?'checked':''}> ${esc(t.n)}</label></div>`).join('')+`</div>`
   +(kind==='hstrip'?`<div class="mrow">Magasság: alsó <input id="mpV0" type="number" value="${Math.round(hv[0])}" style="width:70px"> felső <input id="mpV1" type="number" value="${Math.round(hv[1])}" style="width:70px"> mm</div>`:'')
   +`<div class="mrow">Megjegyzés <input id="mpNote" value="${esc((m&&m.note)||'').replace(/"/g,'&quot;')}" style="width:220px"></div>`,
    ()=>{const tags=[...document.querySelectorAll('.mpTag')].filter(c=>c.checked).map(c=>c.value);
      const pol=(document.querySelector('input[name=mpPol]:checked')||{}).value||'none';
      const res={pol,tags,note:$('mpNote').value.trim()};
      if(kind==='hstrip'){res.v0=Math.round(+$('mpV0').value||0);res.v1=Math.round(+$('mpV1').value||0);if(res.v1<res.v0){const x=res.v0;res.v0=res.v1;res.v1=x;}}
      MRK_T.pol=pol;MRK_T.tags=tags.slice();
      onOk(res);});
  document.querySelectorAll('.mpTag').forEach(c=>c.onchange=()=>{const t=list.find(x=>x.k===c.value);
    if(c.checked&&t&&t.grp)document.querySelectorAll('.mpTag').forEach(o=>{const u=list.find(x=>x.k===o.value);if(o!==c&&u&&u.grp===t.grp)o.checked=false;});   // radio behaviour inside a group
    if(c.checked&&t&&t.pol){const r=document.querySelector('input[name=mpPol][value='+t.pol+']');if(r)r.checked=true;}                              // the tag's own polarity, changeable
    if(kind==='hstrip'){const f=first(),v=vOf(f);if(v&&$('mpV0')){$('mpV0').value=Math.round(v[0]);$('mpV1').value=Math.round(v[1]);}}});}

// ---- creating and editing -----------------------------------------------------------------------------------------------
function mrkAdd(rec){pushUndo(['marks']);rec.layer=mrkLayer();rec.tags=rec.tags||[];mrkList().push(rec);ensureIds(data);draw();return rec;}
function mrkRemove(m){const i=mrkList().indexOf(m);if(i<0)return;pushUndo(['marks']);mrkList().splice(i,1);draw();}
// the brush tags that exist for this kind
function mrkBrush(kind,list){const l=list||MRK_TAGS[kind]||[];return MRK_T.tags.filter(k=>l.some(t=>t.k===k));}
function mrkHstripV(tag,r,level){const t=mrkTag('hstrip',tag);return t&&t.v?mrkVAbs(t.v,r,level):[150,450];}
// pt = {level, id (wall id), u, side}; opt = {u0,u1 (a drag along the wall), shift}
// A click with Shift and a brush that has tags creates straight away; otherwise the picker opens first.
function mrkCommit(pt,opt){opt=opt||{};const mode=MRK_T.mode,r=mrkWallById(pt.level,pt.id);if(!r)return false;
  const len=mrkWallLen(r),brush=mrkBrush(mode),quick=!!opt.shift&&brush.length>0;
  const geo=()=>{
    if(mode==='wall')return {kind:'wall',wall:pt.id};
    if(mode==='side')return {kind:'side',wall:pt.id,side:pt.side};
    if(mode==='vstrip'){let a,b;
      if(opt.u0!=null&&opt.u1!=null&&Math.abs(opt.u1-opt.u0)>=100){a=mrkSnap(Math.min(opt.u0,opt.u1));b=mrkSnap(Math.max(opt.u0,opt.u1));}
      else{a=mrkSnap(pt.u-MRK_DEF.strip/2);b=a+MRK_DEF.strip;}
      return {kind:'vstrip',wall:pt.id,side:pt.side,u0:Math.max(0,a),u1:Math.min(len,b)};}
    return {kind:'hstrip',wall:pt.id,side:pt.side};};
  const finish=res=>{
    if(mode==='wall'){const ex=mrkList().find(m=>m.kind==='wall'&&m.wall===pt.id&&m.layer===mrkLayer());   // one wall mark per wall per layer
      if(ex){pushUndo(['marks']);ex.pol=res.pol;ex.tags=res.tags;if(res.note)ex.note=res.note;else delete ex.note;draw();return;}}
    const rec=Object.assign({level:pt.level},geo(),{pol:res.pol,tags:res.tags});
    if(res.note)rec.note=res.note;
    if(mode==='hstrip'){const v=res.v0!=null?[res.v0,res.v1]:mrkHstripV(res.tags[0],r,pt.level);rec.v0=v[0];rec.v1=v[1];}
    mrkAdd(rec);
    $('hud').textContent='Jelölés: '+MRK_KINDS[mode==='hstrip'?'hstrip':mode]+' — '+(res.tags.map(k=>mrkTagName(rec,k)).join(', ')||MRK_POL[res.pol].n);};
  if(quick)return finish({pol:MRK_T.pol,tags:brush,note:''}),true;
  const ex=mode==='wall'?mrkList().find(m=>m.kind==='wall'&&m.wall===pt.id&&m.layer===mrkLayer()):null;
  mrkPicker(mode,ex||null,finish,{h:mrkWallH(r,pt.level)});
  return true;}

// ---- picking under the pointer ----------------------------------------------------------------------------------------
// the nearest wall within 16 px of the pointer, the face the pointer is on and the position along it
function mrkPick(e){const level=state.active,[bx,by]=clientToBase(e),zz=dz(level,0);let best=null,bd=16/state.zoom;
  const oh=hitTest(e);if(oh&&oh.t==='openings'&&data.openings[oh.i])return {opening:data.openings[oh.i],level};   // an opening wins over the wall under it
  (WALLS[level]||[]).forEach(r=>{if(!r||!r.id||!layerShows(r,'wall'))return;const w=wallDist(r,bx,by,zz);if(w.d<bd){bd=w.d;best=r;}});
  if(!best)return null;
  const p=baseToPlan(bx,by,zz),wi=wallInfo(best),a=wi.seg[0],off=(p[0]-a[0])*wi.perp[0]+(p[1]-a[1])*wi.perp[1];
  return {level,id:best.id,x:p[0],y:p[1],u:mrkU(best,p[0],p[1]),side:off>=0?1:-1};}

// ---- the tool ---------------------------------------------------------------------------------------------------------------
let MRK_H=null,MRK_DRAG=null;                       // hover target, a vertical-strip drag in progress
function mrkModeName(){const m=MRK_MODES.find(x=>x.k===MRK_T.mode);return 'Jelölés: '+(m?m.n:MRK_T.mode);}
function mrkHint(){const mh=$('modeHint');if(!mh)return;
  if(typeof MRK_P!=='undefined'&&MRK_P.on){mh.textContent=mrkPlaneName()+' · g váltja a módot · R: padló ↔ mennyezet · + − 0 x polaritás · Shift+húzás = sávszélesség · Esc kilép';return;}
  mh.textContent=MRK_T.on?mrkModeName()+' · '+kbdKey('markWall')+' váltja a módot · + − 0 x polaritás · Shift+kattintás = az előző címkékkel · Esc kilép'
                         :(typeof HINTS!=='undefined'?HINTS[state.mode]||'':'');}
function mrkToolsOff(){MRK_T.on=false;MRK_DRAG=null;MRK_H=null;if(typeof trcCancel==='function')trcCancel();if(typeof MRK_P!=='undefined')MRK_P.on=false;mrkHint();}
function mrkToolStart(mode){toolsOff();mrkToolsOff();
  if(state.mode!=='select')setMode('select');
  MRK_T.on=true;if(mode)MRK_T.mode=mode;mrkHint();$('hud').textContent=mrkModeName();draw();}
function mrkCycle(dir){if(!MRK_T.on)return;const i=MRK_MODES.findIndex(m=>m.k===MRK_T.mode);
  MRK_T.mode=MRK_MODES[(i+dir+MRK_MODES.length)%MRK_MODES.length].k;MRK_H=null;MRK_DRAG=null;mrkHint();$('hud').textContent=mrkModeName();draw();}
function mrkSetPol(p){MRK_T.pol=p;$('hud').textContent='Jelölés polaritás: '+MRK_POL[p].s+' '+MRK_POL[p].n;}
// the overlay: what a click would mark, per mode
function mrkOverlaySvg(){if(!MRK_T.on||!MRK_H)return '';
  const h=MRK_H;
  if(h.opening){const o=h.opening,c=planToBase(o.x,o.y,dz(o.level,0)),R=Math.max(10,((o.w||DOOR_W)/2)*SC*0.9);
    return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${R.toFixed(1)}" fill="none" stroke="${(MRK_POL[MRK_T.pol]||MRK_POL.none).c}" stroke-width="${vsP(2.5)}" stroke-dasharray="${vsDash('4 3')}" pointer-events="none"/>`;}
  const r=mrkWallById(h.level,h.id);if(!r)return '';
  const mode=MRK_T.mode,pol=MRK_T.pol,col=(MRK_POL[pol]||MRK_POL.none).c;let m=null;
  const brush=mrkBrush(mode),v=mrkHstripV(brush[0],r,h.level);
  if(mode==='wall')m={kind:'wall',level:h.level,wall:h.id,pol,tags:brush};
  else if(mode==='side')m={kind:'side',level:h.level,wall:h.id,side:h.side,pol,tags:brush};
  else if(mode==='vstrip'){let a,b;const len=mrkWallLen(r);
    if(MRK_DRAG&&MRK_DRAG.u1!=null&&Math.abs(MRK_DRAG.u1-MRK_DRAG.u0)>=100){a=mrkSnap(Math.min(MRK_DRAG.u0,MRK_DRAG.u1));b=mrkSnap(Math.max(MRK_DRAG.u0,MRK_DRAG.u1));}
    else{a=mrkSnap(h.u-MRK_DEF.strip/2);b=a+MRK_DEF.strip;}
    m={kind:'vstrip',level:h.level,wall:h.id,side:h.side,u0:Math.max(0,a),u1:Math.min(len,b),pol,tags:brush};}
  else m={kind:'hstrip',level:h.level,wall:h.id,side:h.side,v0:v[0],v1:v[1],pol,tags:brush};
  return `<g opacity="0.85" pointer-events="none">`+mrkWallSvg(m)+`</g>`;}
function mrkToolActive(){if(!MRK_T.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){MRK_T.on=false;MRK_DRAG=null;MRK_H=null;mrkHint();return false;}return true;}
STK_TOOLS.push({k:'mrkWall',active:mrkToolActive,
  down(e){if(e.button!==0||(e.buttons&3)===3)return false;
    const pt=mrkPick(e);if(!pt)return false;
    if(pt.opening){MRK_DRAG={op:pt.opening,shift:e.shiftKey};try{stage.setPointerCapture(e.pointerId);}catch(_){}return true;}
    MRK_DRAG={pt,u0:pt.u,u1:null,shift:e.shiftKey};try{stage.setPointerCapture(e.pointerId);}catch(_){}return true;},
  move(e){const pt=mrkPick(e),key=pt?(pt.opening?'op:'+pt.opening.id:pt.id+':'+pt.side+':'+Math.round(pt.u/50)):'';
    if(MRK_DRAG){if(MRK_DRAG.pt&&MRK_T.mode==='vstrip'&&pt&&pt.id===MRK_DRAG.pt.id){MRK_DRAG.u1=pt.u;MRK_H=pt;draw();}return true;}
    if((MRK_H&&MRK_H.key)!==key){MRK_H=pt?Object.assign({key},pt):null;draw();}
    return false;},
  up(e){const d=MRK_DRAG;if(!d)return false;MRK_DRAG=null;
    if(d.op){mrkOpeningCommit(d.op,{shift:e.shiftKey||d.shift});draw();return true;}
    mrkCommit(d.pt,{u0:d.u0,u1:d.u1,shift:e.shiftKey||d.shift});draw();return true;},
  key(e){if(e.ctrlKey||e.metaKey||e.altKey)return false;
    if(e.key==='+'||e.key==='='){mrkSetPol('plus');return true;}
    if(e.key==='-'||e.key==='_'){mrkSetPol('minus');return true;}
    if(e.key==='0'){mrkSetPol('none');return true;}
    if(e.key==='x'||e.key==='X'){mrkSetPol('ban');return true;}
    return false;},
  esc(e){mrkToolsOff();draw();}});
STK_SCENE.push(mrkSceneSvg);
STK_OVERLAY.push(mrkOverlaySvg);
STK_WV.push(mrkWvSvg);

// ---- right-click on a mark ----------------------------------------------------------------------------------------------------
// the nearest visible mark within 10 px of its drawn geometry → {m, wall, side} (wall/side only for hband faces)
function mrkHit(e){const [bx,by]=clientToBase(e),lim=10/state.zoom;let best=null,bd=lim;
  const consider=(m,d,extra)=>{if(d<bd){bd=d;best=Object.assign({m},extra||{});}};
  mrkList().forEach(m=>{if(!state.levels[m.level]||!layerShows(m,'mark'))return;
    if(typeof mrkOtherDist==='function'&&(m.kind==='opening'||m.kind==='pstrip'||m.kind==='zone')){const d=mrkOtherDist(m,bx,by);if(d!=null)consider(m,d);return;}
    const g=mrkGeom(m);if(!g)return;const z=dz(g.level,0);
    if(g.rect){const wi=wallInfo(g.rect),A=planToBase(wi.seg[0][0],wi.seg[0][1],z),B=planToBase(wi.seg[1][0],wi.seg[1][1],z);consider(m,nearestOnSeg(bx,by,A[0],A[1],B[0],B[1]).d);}
    g.faces.forEach(f=>{const a=mrkFacePt(f.r,f.side,f.u0,f.off),b=mrkFacePt(f.r,f.side,f.u1,f.off),A=planToBase(a[0],a[1],z),B=planToBase(b[0],b[1],z);
      consider(m,nearestOnSeg(bx,by,A[0],A[1],B[0],B[1]).d,m.kind==='hband'?{wall:f.r.id,side:f.side}:null);});});
  return best;}
function mrkSetPolOf(m,p){pushUndo(['marks']);m.pol=p;draw();}
function mrkEditTags(m){const kind=m.kind==='hband'?'hstrip':(m.kind==='opening'?mrkOpeningKind(m):(m.kind==='pstrip'||m.kind==='zone')?'plane':m.kind);
  const r=m.wall?mrkWallById(m.level,m.wall):null,opt={h:r?mrkWallH(r,m.level):2700};
  if(kind==='plane'&&typeof mrkPlaneTags==='function')opt.tags=mrkPlaneTags(m.plane);
  mrkPicker(kind,m,res=>{pushUndo(['marks']);m.pol=res.pol;m.tags=res.tags;if(res.note)m.note=res.note;else delete m.note;
    if(kind==='hstrip'&&res.v0!=null){m.v0=res.v0;m.v1=res.v1;}draw();},opt);}
// hstrip → hband: the strip runs round the whole room, on every wall face that looks into it
function mrkExtendToRoom(m){const r=mrkWallById(m.level,m.wall);if(!r)return false;
  let room=mrkRoomOfFace(m.level,r,m.side,mrkWallLen(r)/2);
  for(let u=0;!room&&u<=mrkWallLen(r);u+=100)room=mrkRoomOfFace(m.level,r,m.side,u);
  const id=room&&stkRoomId(room);
  if(!id){$('hud').textContent='Nem találok helyiséget ennek a falnak az oldalán.';return false;}
  pushUndo(['marks']);m.kind='hband';m.room=id;delete m.wall;delete m.side;delete m.u0;delete m.u1;draw();
  $('hud').textContent='Körbefutó sáv a helyiségben: '+mrkBand(m);return true;}
// hband → hstrip on one face only
function mrkShrinkToFace(m,wall,side){if(!wall||!mrkWallById(m.level,wall))return false;
  pushUndo(['marks']);m.kind='hstrip';m.wall=wall;m.side=side;delete m.room;draw();return true;}
function mrkMenu(h){const m=h.m,items=[];
  items.push({label:'Címkék szerkesztése…',act:()=>mrkEditTags(m)});
  [['plus','+ előnyös'],['minus','− kerülendő'],['ban','⛔ tilos'],['none','· semleges']].forEach(p=>{if(m.pol!==p[0])items.push({label:'Polaritás: '+p[1],act:()=>mrkSetPolOf(m,p[0])});});
  if(m.kind==='hstrip')items.push({label:'Kiterjesztés a teljes helyiségre',act:()=>mrkExtendToRoom(m)});
  if(m.kind==='hband')items.push({label:'Visszaalakítás erre a falra',act:()=>mrkShrinkToFace(m,h.wall,h.side)});
  if(m.kind==='pstrip'&&typeof mrkPstripWidth==='function')items.push({label:'Szélesség…',act:()=>mrkPstripWidth(m)});
  items.push({label:'Törlés',act:()=>mrkRemove(m)});
  return items;}
STK_CTX.push(e=>{const h=mrkHit(e);return h?mrkMenu(h):null;});

// ---- validation and checks ----------------------------------------------------------------------------------------------------------
VALIDATORS.push({code:'mark.dangling',run:()=>{const out=[];
  mrkList().forEach(m=>{
    if(m.wall&&!mrkWallById(m.level,m.wall))out.push({sev:'warn',code:'mark.dangling',msg:'A jelölés fala már nincs meg: '+m.id,ref:m.id});
    else if(m.kind==='hband'&&!mrkRoomById(m.room))out.push({sev:'warn',code:'mark.dangling',msg:'A körbefutó sáv helyisége már nincs meg: '+m.id,ref:m.id});
    else if(typeof mrkDanglingOther==='function'){const x=mrkDanglingOther(m);if(x)out.push({sev:'warn',code:'mark.dangling',msg:x,ref:m.id});}});
  return out;}});
(STK_CHECKS.mark=STK_CHECKS.mark||[]).push(S=>{const L=stkLayer(S.id,'mark'),out=[];if(!L)return out;
  if(!mrkList().some(m=>m.kind==='wall'&&m.layer===L.id))
    out.push({sev:'info',msg:'Még nincs falcímke — a tartófalak és a tilos zónák a későbbi rétegeket vezetik.'});
  return out;});

// ---- actions ---------------------------------------------------------------------------------------------------------------------------------
function mrkListDialog(){const S=stkActive(),L=S?stkLayer(S.id,'mark'):null,ms=mrkList().filter(m=>!L||m.layer===L.id);
  const where=m=>m.wall?('fal '+m.wall+(m.side?(m.side>0?' (+)':' (−)'):'')):m.room?('helyiség '+m.room):m.op?('nyílászáró '+m.op):(m.plane?m.plane+' ':'')+(m.room||'');
  openModal('Jelölések'+(S?' — '+S.name:''),
    ms.length?`<div style="max-height:320px;overflow:auto"><table style="width:100%;font-size:12px"><tr><th align="left">Fajta</th><th align="left">Hol</th><th align="left">Címkék</th><th>±</th></tr>`
      +ms.map(m=>`<tr class="mrkRow" data-id="${m.id}" style="cursor:pointer"><td>${esc(MRK_KINDS[m.kind==='hband'?'hband':m.kind==='opening'?mrkOpeningKind(m):(m.kind==='pstrip'||m.kind==='zone')?'plane':m.kind]||m.kind)}</td>`
        +`<td>${esc(where(m))}</td><td>${esc((m.tags||[]).map(k=>mrkTagName(m,k)).join(', '))}</td><td style="color:${mrkCol(m)}">${MRK_POL[m.pol]?MRK_POL[m.pol].s:''}</td></tr>`).join('')+`</table></div>`
      :`<div class="mrow">Még nincs jelölés.</div>`,
    ()=>{},'Bezár');
  document.querySelectorAll('.mrkRow').forEach(tr=>tr.onclick=()=>{const m=mrkList().find(x=>x.id===tr.dataset.id);if(!m)return;
    if(typeof centerOn==='function'&&m.level)centerOn(m);
    $('hud').textContent='Jelölés '+m.id+' — '+MRK_KINDS[m.kind==='opening'?mrkOpeningKind(m):m.kind]+' · '+(m.tags||[]).map(k=>mrkTagName(m,k)).join(', ');});}
registerActions([
 {id:'mark.wall',alias:'jeloles fal wall mark tag cimke',label:'Fal jelölése',icon:'▥',group:'Jelölés',keys:['j'],
  hint:'Fal / falfelület / függőleges sáv / vízszintes sáv címkézése + vagy − jellel. J váltja a módot, Shift+kattintás az előző címkékkel jelöl.',
  run:()=>{if(MRK_T.on)mrkCycle(1);else mrkToolStart(MRK_T.mode);}},
 {id:'mark.wallBack',alias:'jeloles elozo mod previous mode',label:'Jelölés: előző mód',icon:'▥',group:'Jelölés',keys:['shift+j'],
  need:'Indítsd el a Fal jelölése eszközt (J).',when:c=>MRK_T.on,run:()=>mrkCycle(-1)},
 {id:'mark.list',alias:'jelolesek lista marks list',label:'Jelölések listája',icon:'☰',group:'Jelölés',
  hint:'Az aktív stack jelöléseinek táblázata.',run:()=>mrkListDialog()}
]);

// ==========================================================================================================
// WP-B3 — openings (doors, windows) and the floor / ceiling planes
// ==========================================================================================================

// ---- openings: doors and windows carry tags ----------------------------------------------------------------
// a click on an opening wins over the wall under it, in every mode
function mrkOpeningById(id){return id?(data.openings||[]).find(o=>o&&o.id===id)||null:null;}
function mrkOpeningKind(m){const o=mrkOpeningById(m.op);return o&&o.type==='window'?'window':'door';}
function mrkOpeningTags(opId){const s=[];
  mrkList().forEach(m=>{if(m.kind==='opening'&&m.op===opId)(m.tags||[]).forEach(t=>{if(s.indexOf(t)<0)s.push(t);});});return s;}
function mrkDoorTier(opId){const t=mrkOpeningTags(opId);return ['p0','p1','p2','p3'].find(k=>t.indexOf(k)>=0)||null;}
// the two rooms a door joins: [room on the +normal side, room on the −normal side], null when that side is outside
function mrkDoorRooms(o){if(!o)return [null,null];
  const n=[-Math.sin(o.ang||0),Math.cos(o.ang||0)];let thick=100,bd=1e9;
  (WALLS[o.level]||[]).forEach(r=>{const wi=wallInfo(r),a=wi.seg[0],b=wi.seg[1],nr=nearestOnSegPlain(o.x,o.y,a[0],a[1],b[0],b[1]);if(nr.d<bd){bd=nr.d;thick=wi.thick;}});
  const k=thick/2+ROOM_PROBE,list=allRooms(o.level);
  const at=s=>{const x=o.x+n[0]*k*s,y=o.y+n[1]*k*s;for(let i=list.length-1;i>=0;i--)if(pointInPoly(x,y,list[i].rm.poly))return list[i];return null;};
  return [at(1),at(-1)];}
function mrkOpeningCommit(o,opt){opt=opt||{};
  if(!o)return false;
  if(o.type==='stairs'){$('hud').textContent='Lépcsőhöz nincs címke.';return false;}
  if(!o.id)ensureIds(data);
  const kind=o.type==='window'?'window':'door',brush=mrkBrush(kind),layer=mrkLayer();
  const ex=mrkList().find(m=>m.kind==='opening'&&m.op===o.id&&m.layer===layer);        // one per opening per layer
  const finish=res=>{
    if(ex){pushUndo(['marks']);ex.pol=res.pol;ex.tags=res.tags;if(res.note)ex.note=res.note;else delete ex.note;draw();}
    else{const rec={kind:'opening',level:o.level,op:o.id,pol:res.pol,tags:res.tags};if(res.note)rec.note=res.note;mrkAdd(rec);}
    $('hud').textContent='Jelölés: '+MRK_KINDS[kind]+' — '+(res.tags.map(k=>mrkTagName({kind:'opening',op:o.id},k)).join(', ')||MRK_POL[res.pol].n);};
  if(opt.shift&&brush.length&&!ex)return finish({pol:'none',tags:brush,note:''}),true;
  mrkPicker(kind,ex||null,finish,{pol:'none'});return true;}
function mrkOpeningSvg(m){const o=mrkOpeningById(m.op);if(!o||!state.levels[o.level])return '';
  const z=dz(o.level,0),col=mrkCol(m),c=planToBase(o.x,o.y,z),R=Math.max(10,((o.w||(o.type==='window'?WIN_W:DOOR_W))/2)*SC*0.9),t=m.tags||[];
  let lbl='';
  if(o.type==='window')lbl=t.indexOf('redony')>=0?'RED':t.indexOf('nyitaserz')>=0?'ÉRZ':(t[0]?mrkTrunc(mrkTagName(m,t[0]).replace(/ [—(].*$/,''),10):'');
  else{const tier=mrkDoorTier(o.id);
    lbl=t.indexOf('bejarat')>=0?'BEJ':t.indexOf('lepcso')>=0?'LÉP':tier?tier.toUpperCase():t.indexOf('nyitva')>=0?'NYITVA':t.indexOf('nemhasznalt')>=0?'✕':
        (t[0]?mrkTrunc(mrkTagName(m,t[0]).replace(/ [—(].*$/,''),10):'');}
  if(!lbl&&m.pol)lbl=MRK_POL[m.pol].s;
  return `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${R.toFixed(1)}" fill="${col}" fill-opacity="0.10" stroke="${col}" stroke-width="${vsP(2)}"/>`
    +(lbl?`<text x="${c[0].toFixed(1)}" y="${(c[1]+R+vsP(10)).toFixed(1)}" font-size="${vsP(9)}" text-anchor="middle" fill="none" stroke="#fff" stroke-width="${vsP(2.6)}" stroke-linejoin="round">${esc(lbl)}</text>`
         +`<text x="${c[0].toFixed(1)}" y="${(c[1]+R+vsP(10)).toFixed(1)}" font-size="${vsP(9)}" text-anchor="middle" fill="${col}">${esc(lbl)}</text>`:'');}

// ---- floor and ceiling: strips and zones ---------------------------------------------------------------------------
// Modes come from an extensible list: WP-B4 pushes line45 / free / smooth into it.
const MRK_PLANE_MODES=[{k:'px',n:'Sáv (vízszintes)'},{k:'py',n:'Sáv (függőleges)'},{k:'rect',n:'Téglalap zóna'},{k:'circle',n:'Kör zóna'}];
let MRK_P={on:false,plane:'floor',mode:'px'};
let MRK_PD=null,MRK_PH=null;                                  // drag in progress, hover point
function mrkPlaneTags(plane){return (MRK_TAGS.plane||[]).filter(t=>t.pl===plane||t.pl==='both');}
function mrkPlaneName(){const m=MRK_PLANE_MODES.find(x=>x.k===MRK_P.mode);return 'Padló / mennyezet: '+(m?m.n:MRK_P.mode)+' · '+(MRK_P.plane==='floor'?'Padló':'Mennyezet');}
function mrkPlaneZ(level,plane){return dz(level,plane==='ceiling'?wallH(level):0);}
function mrkPlanePt(e){const level=state.active,[bx,by]=clientToBase(e),p=baseToPlan(bx,by,mrkPlaneZ(level,MRK_P.plane));return {level,x:p[0],y:p[1]};}
function mrkRoomAtPt(level,x,y){const list=allRooms(level);for(let k=list.length-1;k>=0;k--)if(pointInPoly(x,y,list[k].rm.poly))return list[k];return null;}
function mrkPlaneStart(mode){toolsOff();mrkToolsOff();if(state.mode!=='select')setMode('select');
  MRK_P.on=true;if(mode)MRK_P.mode=mode;mrkHint();$('hud').textContent=mrkPlaneName();draw();}
function mrkPlaneCycle(dir){if(!MRK_P.on)return;const i=MRK_PLANE_MODES.findIndex(m=>m.k===MRK_P.mode);
  MRK_P.mode=MRK_PLANE_MODES[(i+dir+MRK_PLANE_MODES.length)%MRK_PLANE_MODES.length].k;MRK_PD=null;MRK_PH=null;mrkHint();$('hud').textContent=mrkPlaneName();draw();}
function mrkPlaneToggle(){if(!MRK_P.on)return;MRK_P.plane=MRK_P.plane==='floor'?'ceiling':'floor';mrkHint();
  $('hud').textContent=MRK_P.plane==='floor'?'Padló':'Mennyezet';draw();}
// the geometry of the mark a drag from p0 to p1 would make (null when there is nothing to make)
function mrkPlaneGeo(mode,p0,p1,room,shift){
  const sn=mrkSnap,drag=p1&&Math.hypot(p1.x-p0.x,p1.y-p0.y)>=MRK_DEF.snap;
  if(mode==='px'||mode==='py'){if(!room)return null;const ax=mode==='px'?'x':'y';       // 'x' runs left to right (constant y), 'y' top to bottom
    const a=ax==='x'?p0.y:p0.x,b=p1?(ax==='x'?p1.y:p1.x):a;
    if(shift&&drag&&Math.abs(b-a)>=MRK_DEF.snap)return {kind:'pstrip',axis:ax,c:sn((a+b)/2),w:Math.max(100,sn(Math.abs(b-a))),room:stkRoomId(room)};
    return {kind:'pstrip',axis:ax,c:sn(a),w:MRK_DEF.strip,room:stkRoomId(room)};}
  if(mode==='rect'){if(!p1)return null;const x0=sn(Math.min(p0.x,p1.x)),x1=sn(Math.max(p0.x,p1.x)),y0=sn(Math.min(p0.y,p1.y)),y1=sn(Math.max(p0.y,p1.y));
    if(x1-x0<MRK_DEF.snap||y1-y0<MRK_DEF.snap)return null;return {kind:'zone',shape:'rect',x0,y0,x1,y1};}
  if(mode==='circle'){const r=p1?Math.hypot(p1.x-p0.x,p1.y-p0.y):0;return {kind:'zone',shape:'circle',cx:sn(p0.x),cy:sn(p0.y),r:Math.max(150,sn(r))};}
  return null;}
// create a plane mark from a drag; the picker offers the tags of this plane. Shift + a brush with tags = no dialog.
function mrkPlaneCommit(level,plane,mode,p0,p1,opt){opt=opt||{};
  const room=(mode==='px'||mode==='py')?mrkRoomAtPt(level,p0.x,p0.y):null,geo=mrkPlaneGeo(mode,p0,p1,room,opt.shift);
  if(!geo){if((mode==='px'||mode==='py')&&!room)$('hud').textContent='Kattints egy helyiség belsejébe.';return false;}
  const list=mrkPlaneTags(plane),brush=mrkBrush('plane',list);
  const finish=res=>{const rec=Object.assign({level,plane},geo,{pol:res.pol,tags:res.tags});if(res.note)rec.note=res.note;mrkAdd(rec);
    $('hud').textContent='Jelölés: '+(plane==='floor'?'padló':'mennyezet')+' — '+(res.tags.map(k=>mrkTagName(rec,k)).join(', ')||MRK_POL[res.pol].n);};
  if(opt.shift&&brush.length)return finish({pol:MRK_T.pol,tags:brush,note:''}),true;
  mrkPicker('plane',null,finish,{tags:list});return true;}
// every plane mark of that plane covering a point. A strip is clipped to the room it was drawn in.
function mrkPlaneAt(level,plane,x,y){const out=[];
  mrkList().forEach(m=>{if(m.level!==level||m.plane!==plane)return;let hit=false;
    if(m.kind==='pstrip'){const room=mrkRoomById(m.room);
      hit=!!room&&pointInPoly(x,y,room.rm.poly)&&Math.abs((m.axis==='x'?y:x)-m.c)<=m.w/2;}
    else if(m.kind==='zone')hit=m.shape==='rect'?(x>=m.x0&&x<=m.x1&&y>=m.y0&&y<=m.y1):Math.hypot(x-m.cx,y-m.cy)<=m.r;
    if(hit)out.push({m,pol:m.pol,tags:m.tags||[]});});
  return out;}
// the strips and zones whose centre lies in the room
function mrkRoomZones(roomId,plane){const room=mrkRoomById(roomId);if(!room)return [];
  return mrkList().filter(m=>{if(m.kind!=='pstrip'&&m.kind!=='zone')return false;if(plane&&m.plane!==plane)return false;
    if(m.kind==='pstrip')return m.room===roomId;
    const cx=m.shape==='rect'?(m.x0+m.x1)/2:m.cx,cy=m.shape==='rect'?(m.y0+m.y1)/2:m.cy;return pointInPoly(cx,cy,room.rm.poly);});}
function mrkPstripBox(m){const room=mrkRoomById(m.room);if(!room)return null;const bb=polyBBox(room.rm.poly);
  return m.axis==='x'?{x0:bb.x0,x1:bb.x1,y0:m.c-m.w/2,y1:m.c+m.w/2,poly:room.rm.poly}:{x0:m.c-m.w/2,x1:m.c+m.w/2,y0:bb.y0,y1:bb.y1,poly:room.rm.poly};}
function mrkCirclePoly(cx,cy,r){const p=[];for(let i=0;i<48;i++){const a=i*Math.PI/24;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}return p;}
// plan drawing. A ceiling mark floats in an iso view, so there it is drawn at floor level with a dashed outline.
function mrkPlaneSvg(m){if(!state.levels[m.level])return '';
  const flat=state.flat||state.pitch>=88,float=(m.plane==='ceiling'&&!flat),z=float?dz(m.level,0):mrkPlaneZ(m.level,m.plane),col=mrkCol(m);
  const dash=float?' stroke-dasharray="'+vsDash('5 4')+'"':'',attrs=`fill="${col}" fill-opacity="${mrkOp(m,0.14)}" stroke="${col}" stroke-width="${vsP(0.5)}"${dash}`;let s='',cx,cy;
  if(m.kind==='pstrip'){const b=mrkPstripBox(m);if(!b)return '';
    const id='mrkc-'+m.id;
    s+=`<clipPath id="${id}"><polygon points="${p2b(b.poly.map(p=>[p[0],p[1],z]))}"/></clipPath>`
      +`<g clip-path="url(#${id})"><polygon points="${p2b([[b.x0,b.y0,z],[b.x1,b.y0,z],[b.x1,b.y1,z],[b.x0,b.y1,z]])}" ${attrs}/></g>`;
    cx=(b.x0+b.x1)/2;cy=(b.y0+b.y1)/2;}
  else if(m.shape==='rect'){s+=`<polygon points="${p2b([[m.x0,m.y0,z],[m.x1,m.y0,z],[m.x1,m.y1,z],[m.x0,m.y1,z]])}" ${attrs}/>`;cx=(m.x0+m.x1)/2;cy=(m.y0+m.y1)/2;
    if((mrkStyle(m)||{}).pat==='hstripes'){const y0=Math.min(m.y0,m.y1),y1=Math.max(m.y0,m.y1);let st='';   // padlófűtés: a stripe every 150 mm
      for(let y=y0+75;y<y1;y+=150)st+=`<polyline points="${p2b([[m.x0,y,z],[m.x1,y,z]])}"/>`;
      s+=`<g fill="none" stroke="${col}" stroke-width="${vsP(0.9)}" stroke-opacity="0.7">${st}</g>`;}}
  else{s+=`<polygon points="${p2b(mrkCirclePoly(m.cx,m.cy,m.r).map(p=>[p[0],p[1],z]))}" ${attrs}/>`;cx=m.cx;cy=m.cy;}
  const t=(m.tags||[])[0];if(t)s+=mrkText(cx,cy,z,mrkTrunc(mrkTagName(m,t).replace(/ [—(].*$/,''),16),col,9);
  return s;}
// overlay: what the drag in progress would make
function mrkPlaneOverlay(){if(!MRK_P.on)return '';
  const level=state.active,col=(MRK_POL[MRK_T.pol]||MRK_POL.none).c,mode=MRK_P.mode;let geo=null;
  if(MRK_PD)geo=mrkPlaneGeo(mode,MRK_PD.p0,MRK_PD.p1,MRK_PD.room,MRK_PD.shift);
  else if(MRK_PH&&(mode==='px'||mode==='py'))geo=mrkPlaneGeo(mode,MRK_PH,null,mrkRoomAtPt(level,MRK_PH.x,MRK_PH.y),false);
  else if(MRK_PH&&mode==='circle')geo=mrkPlaneGeo(mode,MRK_PH,null,null,false);
  if(!geo)return '';
  const m=Object.assign({level,plane:MRK_P.plane,pol:MRK_T.pol,tags:mrkBrush('plane',mrkPlaneTags(MRK_P.plane))},geo,{id:'pre'});
  return `<g opacity="0.85" pointer-events="none">`+mrkPlaneSvg(m)+`</g>`;}
function mrkPlaneActive(){if(!MRK_P.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)||(typeof PV!=='undefined'&&PV)){MRK_P.on=false;MRK_PD=null;MRK_PH=null;mrkHint();return false;}return true;}
STK_TOOLS.push({k:'mrkPlane',active:mrkPlaneActive,
  down(e){if(typeof trcIsMode==='function'&&trcIsMode(MRK_P.mode))return trcDown(e);          // traces (05o)
    if(e.button!==0||(e.buttons&3)===3)return false;const p=mrkPlanePt(e),mode=MRK_P.mode;
    const room=(mode==='px'||mode==='py')?mrkRoomAtPt(p.level,p.x,p.y):null;
    if((mode==='px'||mode==='py')&&!room)return false;                               // outside every room: the click pans as usual
    MRK_PD={level:p.level,plane:MRK_P.plane,mode,p0:p,p1:null,room,shift:e.shiftKey};try{stage.setPointerCapture(e.pointerId);}catch(_){}return true;},
  move(e){if(typeof trcIsMode==='function'&&trcIsMode(MRK_P.mode))return trcMove(e);
    const p=mrkPlanePt(e);if(MRK_PD){MRK_PD.p1=p;draw();return true;}
    MRK_PH=p;if(MRK_P.mode==='px'||MRK_P.mode==='py'||MRK_P.mode==='circle')draw();return false;},
  up(e){if(typeof trcIsMode==='function'&&trcIsMode(MRK_P.mode))return trcUp(e);
    const d=MRK_PD;if(!d)return false;MRK_PD=null;d.p1=mrkPlanePt(e);        // the release point counts even if no move event came (touch)
    mrkPlaneCommit(d.level,d.plane,d.mode,d.p0,d.p1,{shift:e.shiftKey||d.shift});draw();return true;},
  key(e){if(typeof trcIsMode==='function'&&trcIsMode(MRK_P.mode)&&trcKey(e))return true;      // Enter / Backspace of a 45° line
    if(e.ctrlKey||e.metaKey||e.altKey)return false;
    if((e.key==='r'||e.key==='R')&&!e.shiftKey){e.preventDefault();mrkPlaneToggle();return true;}   // was Tab (U4)
    if(e.key==='+'||e.key==='='){mrkSetPol('plus');return true;}
    if(e.key==='-'||e.key==='_'){mrkSetPol('minus');return true;}
    if(e.key==='0'){mrkSetPol('none');return true;}
    if(e.key==='x'||e.key==='X'){mrkSetPol('ban');return true;}
    return false;},
  esc(e){if(typeof trcEsc==='function'&&trcEsc())return;      // the first Esc finishes / drops a trace in progress, the next leaves the tool
    mrkToolsOff();draw();}});
STK_OVERLAY.push(mrkPlaneOverlay);

// Plane View: the marks of the plane being edited (floor ↔ floor; álmennyezet and ceiling ↔ ceiling), in plan mm
function mrkPvSvg(ctx){if(!ctx||!ctx.d)return '';const d=ctx.d,plane=(d.kind==='ceiling'||d.kind==='drop')?'ceiling':'floor',X=ctx.X,Y=ctx.Y;let s='';
  mrkList().forEach(m=>{if(m.level!==d.level||m.plane!==plane||!layerShows(m,'mark'))return;
    const col=mrkCol(m),attrs=`fill="${col}" fill-opacity="0.14" stroke="${col}" stroke-width="0.8"`;let svg='',cx,cy;
    if(m.kind==='pstrip'){const b=mrkPstripBox(m);if(!b)return;const id='mrkpv-'+m.id;
      svg=`<clipPath id="${id}"><polygon points="${b.poly.map(p=>X(p[0])+','+Y(p[1])).join(' ')}"/></clipPath>`
        +`<g clip-path="url(#${id})"><rect x="${Math.min(X(b.x0),X(b.x1))}" y="${Math.min(Y(b.y0),Y(b.y1))}" width="${Math.abs(X(b.x1)-X(b.x0)).toFixed(1)}" height="${Math.abs(Y(b.y1)-Y(b.y0)).toFixed(1)}" ${attrs}/></g>`;
      cx=(b.x0+b.x1)/2;cy=(b.y0+b.y1)/2;}
    else if(m.shape==='rect'){svg=`<rect x="${Math.min(X(m.x0),X(m.x1))}" y="${Math.min(Y(m.y0),Y(m.y1))}" width="${Math.abs(X(m.x1)-X(m.x0)).toFixed(1)}" height="${Math.abs(Y(m.y1)-Y(m.y0)).toFixed(1)}" ${attrs}/>`;cx=(m.x0+m.x1)/2;cy=(m.y0+m.y1)/2;}
    else{svg=`<circle cx="${X(m.cx)}" cy="${Y(m.cy)}" r="${(m.r*ctx.sc).toFixed(1)}" ${attrs}/>`;cx=m.cx;cy=m.cy;}
    const t=(m.tags||[])[0];
    if(t)svg+=`<text x="${X(cx)}" y="${Y(cy)}" font-size="9" text-anchor="middle" fill="${col}">${esc(mrkTrunc(mrkTagName(m,t).replace(/ [—(].*$/,''),16))}</text>`;
    s+=lyrWrap(m,'mark',svg);});
  return s;}
STK_PV.push(mrkPvSvg);

// hit-testing the marks that are not wall faces (right-click): distance in base units, or null
function mrkOtherDist(m,bx,by){
  if(m.kind==='opening'){const o=mrkOpeningById(m.op);if(!o)return null;const c=planToBase(o.x,o.y,dz(o.level,0));
    const R=Math.max(10,((o.w||DOOR_W)/2)*SC*0.9);return Math.max(0,Math.hypot(bx-c[0],by-c[1])-R);}
  const z=m.plane==='ceiling'?mrkPlaneZ(m.level,'ceiling'):dz(m.level,0),seg=(a,b)=>{const A=planToBase(a[0],a[1],z),B=planToBase(b[0],b[1],z);return nearestOnSeg(bx,by,A[0],A[1],B[0],B[1]).d;};
  if(m.kind==='pstrip'){const b=mrkPstripBox(m);if(!b)return null;
    return m.axis==='x'?seg([b.x0,m.c],[b.x1,m.c]):seg([m.c,b.y0],[m.c,b.y1]);}
  if(m.shape==='rect')return Math.min(seg([m.x0,m.y0],[m.x1,m.y0]),seg([m.x1,m.y0],[m.x1,m.y1]),seg([m.x1,m.y1],[m.x0,m.y1]),seg([m.x0,m.y1],[m.x0,m.y0]));
  const c=planToBase(m.cx,m.cy,z),e=planToBase(m.cx+m.r,m.cy,z);const R=Math.hypot(e[0]-c[0],e[1]-c[1]);return Math.abs(Math.hypot(bx-c[0],by-c[1])-R);}
function mrkPstripWidth(m){openModal('Sáv szélessége',`<div class="mrow">Szélesség <input id="mpW" type="number" value="${m.w}" style="width:80px"> mm</div>`,
  ()=>{const w=Math.max(100,mrkSnap(+$('mpW').value||m.w));pushUndo(['marks']);m.w=w;draw();});}
function mrkDanglingOther(m){
  if(m.kind==='opening'&&!mrkOpeningById(m.op))return 'A nyílászáró jelölésének nyílászárója már nincs meg: '+m.id;
  if(m.kind==='pstrip'&&!mrkRoomById(m.room))return 'A sáv helyisége már nincs meg: '+m.id;
  return null;}
(STK_CHECKS.mark=STK_CHECKS.mark||[]).push(S=>{const L=stkLayer(S.id,'mark'),C=stkLayer(S.id,'construct'),out=[];if(!L)return out;
  const all=(data.openings||[]).filter(o=>o.type==='door'),own=C?all.filter(o=>(o.layer||'L0')===C.id):[];
  const doors=own.length?own:all;       // the doors on the Szerkezet layer; a fresh stack over an existing drawing looks at every door
  if(doors.length&&!mrkList().some(m=>m.kind==='opening'&&m.layer===L.id&&(m.tags||[]).indexOf('bejarat')>=0))
    out.push({sev:'warn',msg:'Nincs bejárat jelölve — a portálgráf horgonya hiányzik.'});
  return out;});
registerActions([
 {id:'mark.plane',alias:'jeloles padlo mennyezet floor ceiling zone strip zona',label:'Padló / mennyezet jelölése',icon:'◩',group:'Jelölés',keys:['g'],
  hint:'Sávok és zónák (téglalap, kör) a padlón vagy a mennyezeten. G váltja a módot, R a padló ↔ mennyezet között.',
  run:()=>{if(MRK_P.on)mrkPlaneCycle(1);else mrkPlaneStart(MRK_P.mode);}},
 {id:'mark.planeBack',alias:'jeloles elozo mod padlo previous mode plane',label:'Padló / mennyezet: előző mód',icon:'◩',group:'Jelölés',keys:['shift+g'],
  need:'Indítsd el a Padló / mennyezet jelölése eszközt (G).',when:c=>MRK_P.on,run:()=>mrkPlaneCycle(-1)}
]);
window.MRK_PLANE_MODES=MRK_PLANE_MODES;window.MRK_P=MRK_P;window.mrkOpeningTags=mrkOpeningTags;window.mrkDoorTier=mrkDoorTier;window.mrkDoorRooms=mrkDoorRooms;
window.mrkOpeningCommit=mrkOpeningCommit;window.mrkPlaneCommit=mrkPlaneCommit;window.mrkPlaneAt=mrkPlaneAt;window.mrkRoomZones=mrkRoomZones;window.mrkPlaneTags=mrkPlaneTags;
window.mrkPlaneStart=mrkPlaneStart;window.mrkPlaneCycle=mrkPlaneCycle;window.mrkPlaneToggle=mrkPlaneToggle;window.mrkPlaneGeo=mrkPlaneGeo;window.mrkPvSvg=mrkPvSvg;
window.mrkOpeningById=mrkOpeningById;window.mrkOpeningKind=mrkOpeningKind;window.mrkPlaneSvg=mrkPlaneSvg;window.mrkRoomAtPt=mrkRoomAtPt;window.mrkPstripWidth=mrkPstripWidth;

// test hooks
window.MRK_POL=MRK_POL;window.MRK_TAGS=MRK_TAGS;window.MRK_DEF=MRK_DEF;window.MRK_T=MRK_T;window.MRK_MODES=MRK_MODES;window.MRK_TRACE_TAGS=MRK_TRACE_TAGS;
window.mrkList=mrkList;window.mrkLayer=mrkLayer;window.mrkWallById=mrkWallById;window.mrkWallLen=mrkWallLen;window.mrkU=mrkU;window.mrkFacePt=mrkFacePt;
window.mrkFaceRanges=mrkFaceRanges;window.mrkRoomOfFace=mrkRoomOfFace;window.mrkVAbs=mrkVAbs;window.mrkAt=mrkAt;window.mrkWallTags=mrkWallTags;
window.mrkCommit=mrkCommit;window.mrkPicker=mrkPicker;window.mrkHit=mrkHit;window.mrkMenu=mrkMenu;window.mrkToolStart=mrkToolStart;window.mrkToolsOff=mrkToolsOff;
window.mrkCycle=mrkCycle;window.mrkExtendToRoom=mrkExtendToRoom;window.mrkShrinkToFace=mrkShrinkToFace;window.mrkPick=mrkPick;window.mrkSceneSvg=mrkSceneSvg;
window.mrkWvSvg=mrkWvSvg;window.mrkGeom=mrkGeom;window.mrkAdd=mrkAdd;window.mrkRoomById=mrkRoomById;window.mrkBandFaces=mrkBandFaces;window.mrkSnap=mrkSnap;
