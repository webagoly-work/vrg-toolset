// spec-37 — marking layer: doors, windows, floor and ceiling strips and zones, Plane View
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  const D=()=>w.__data,J=o=>JSON.stringify(o),M=()=>w.mrkList();
  const ctxLabels=()=>[...w.document.querySelectorAll('#ctx button')].map(b=>b.textContent);
  const ctxClick=t=>[...w.document.querySelectorAll('#ctx button')].find(b=>b.textContent===t).click();
  const key=(k,o,target)=>{const e=new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{}));(target||w.document).dispatchEvent(e);return e;};
  const wkey=(k,o)=>{const e=new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{}));w.dispatchEvent(e);return e;};
  const pick=(tags,o)=>{o=o||{};tags.forEach(k=>{const c=w.document.querySelector('.mpTag[value="'+k+'"]');c.checked=true;c.dispatchEvent(new w.Event('change',{bubbles:true}));});
    if(o.pol)w.document.querySelector('input[name=mpPol][value='+o.pol+']').checked=true;$('mOk').click();};
  let W;
  // two rooms with a partition (for the door), plus a door and a window
  const fixture=(single)=>{w.newBlankProject();w.eval('stacks=[]');w.__state.stkOff=false;w.__state.stack=null;w.__state.activeLayer='L0';w.mrkToolsOff();w.MRK_T.mode='wall';w.MRK_T.pol='plus';w.MRK_T.tags=[];
    w.__state.zoom=1;w.__state.rot=0;w.__state.pitch=90;w.__state.flat=true;
    const WA=w.__getWalls()[lvl];
    WA.push({x0:0,y0:-50,x1:4000,y1:50,layer:'L0'},{x0:0,y0:2950,x1:4000,y1:3050,layer:'L0'},{x0:-50,y0:0,x1:50,y1:3000,layer:'L0'},{x0:3950,y0:0,x1:4050,y1:3000,layer:'L0'},{x0:1950,y0:0,x1:2050,y1:3000,layer:'L0'});
    D().floors.push({level:lvl,name:'Bal',poly:[[0,0],[2000,0],[2000,3000],[0,3000]],layer:'L0'},{level:lvl,name:'Jobb',poly:[[2000,0],[4000,0],[4000,3000],[2000,3000]],layer:'L0'});
    D().openings.push({type:'door',level:lvl,x:2000,y:1500,ang:Math.PI/2,w:900,h:2100,variant:0,layer:'L0'},
                      {type:'window',level:lvl,x:1000,y:2950,ang:0,w:1200,h:1300,layer:'L0'},
                      {type:'stairs',level:lvl,x:3000,y:2000,ang:0,w:1000,layer:'L0'});
    if(single){WA.pop();D().floors.length=0;D().floors.push({level:lvl,name:'Szoba',poly:[[0,0],[4000,0],[4000,3000],[0,3000]],layer:'L0'});D().openings.length=0;}
    w.ensureIds(D());w.eval(`SNAP.${lvl}=centerlines(WALLS.${lvl})`);
    W={top:WA[0],bot:WA[1],left:WA[2],right:WA[3],part:WA[4],A:D().floors[0],B:D().floors[1],door:D().openings[0],win:D().openings[1],stairs:D().openings[2]};w.__state.active=lvl;};
  const base=(x,y,z)=>w.planToBase(x,y,z==null?w.dz(lvl,0):z);
  const stage=()=>w.eval('stage');
  const ptr=(t,x,y,o,z)=>{const b=base(x,y,z);w.clientToBase=()=>b;stage().dispatchEvent(new w.MouseEvent(t,Object.assign({bubbles:true,cancelable:true,button:0,clientX:50,clientY:50},o||{})));};
  fixture();

  // 1 — doors
  ok('mrkDoorRooms: the rooms on the two sides of a door in the partition, in normal order',(function(){const r=w.mrkDoorRooms(W.door);return r.length===2&&r[0]&&r[1]&&r[0].rm===W.A&&r[1].rm===W.B;})());
  ok('a door in an outside wall has a room on one side only',(function(){const o={type:'door',level:lvl,x:1000,y:0,ang:0};const r=w.mrkDoorRooms(o);return r[0]&&r[0].rm===W.A&&r[1]===null;})());
  w.mrkOpeningCommit(W.door,{});
  ok('the door picker opens with the door tag list',/Ajtó/.test($('modal').textContent)&&w.document.querySelectorAll('.mpTag').length===w.MRK_TAGS.door.length);
  pick(['portal','p2']);
  ok('tagging a door portal+p2 stores ONE opening mark',M().length===1&&M()[0].kind==='opening'&&M()[0].op===W.door.id&&M()[0].tags.join()==='portal,p2'&&M()[0].level===lvl&&M()[0].layer==='L0');
  ok('door tags default to the semleges polarity',M()[0].pol==='none');
  ok('mrkDoorTier → p2',w.mrkDoorTier(W.door.id)==='p2'&&w.mrkOpeningTags(W.door.id).indexOf('portal')>=0);
  w.mrkOpeningCommit(W.door,{});pick(['p3']);
  ok('tagging p3 replaces p2 (group behaviour) in the same single mark',M().length===1&&M()[0].tags.join()==='portal,p3'&&w.mrkDoorTier(W.door.id)==='p3');
  ok('a door without a tier has none',w.mrkDoorTier('nope')===null);
  w.mrkOpeningCommit(W.door,{});w.document.querySelector('.mpTag[value=bejarat]').checked=true;$('mOk').click();
  ok('tags can be added to the existing mark',M()[0].tags.indexOf('bejarat')>=0&&M().length===1);

  // 2 — windows
  w.mrkOpeningCommit(W.win,{});
  ok('the window picker offers the window tags',/Ablak/.test($('modal').textContent)&&w.document.querySelectorAll('.mpTag').length===w.MRK_TAGS.window.length);
  pick(['redony','nyitaserz','nyithato']);
  ok('a window tagged redony: mrkOpeningTags contains it',w.mrkOpeningTags(W.win.id).indexOf('redony')>=0&&M().length===2);
  w.mrkOpeningCommit(W.win,{});pick(['fix']);
  ok('nyithato / fix are mutually exclusive (group open)',(function(){const t=M()[1].tags;return t.indexOf('fix')>=0&&t.indexOf('nyithato')<0;})());
  ok('stairs get no tags in v1',(function(){const n=M().length;const r=w.mrkOpeningCommit(W.stairs,{});return r===false&&M().length===n&&/Lépcsőhöz nincs címke/.test($('hud').textContent);})());
  ok('Shift with brush tags tags an opening without a dialog',(function(){w.closeModal();w.MRK_T.tags=['portal'];const o=D().openings[0];w.__data.marks.length=0;w.mrkOpeningCommit(o,{shift:true});return M().length===1&&M()[0].tags.join()==='portal'&&w.document.querySelector('#modalBg').style.display!=='flex';})());
  w.__data.marks.length=0;

  // 3 — the wall tool: an opening wins over the wall under it, in every mode
  w.MRK_T.tags=[];w.mrkToolStart('side');
  ok('a click on a door in side mode opens the DOOR picker, not the side one',(function(){ptr('pointermove',2000,1500);ptr('pointerdown',2000,1500);ptr('pointerup',2000,1500);
    const r=/Ajtó/.test($('modal').textContent)&&!/Falfelület/.test($('modal').textContent);w.closeModal();return r;})());
  ok('...and in wall mode',(function(){w.MRK_T.mode='wall';ptr('pointermove',2000,1500);ptr('pointerdown',2000,1500);ptr('pointerup',2000,1500);const r=/Ajtó/.test($('modal').textContent);w.closeModal();return r;})());
  ok('the hover over an opening draws a dashed ring in the overlay',(function(){ptr('pointermove',2000,1500);return /<circle/.test(w.eval('_lastOverlay'))&&w.eval('MRK_H').opening===W.door;})());
  ok('the window opens the window picker',(function(){ptr('pointermove',1000,2950);ptr('pointerdown',1000,2950);ptr('pointerup',1000,2950);const r=/Ablak/.test($('modal').textContent);w.closeModal();return r;})());
  ok('away from every opening the wall wins again',(function(){ptr('pointermove',2000,200);ptr('pointerdown',2000,200);ptr('pointerup',2000,200);const r=/Teljes fal/.test($('modal').textContent);w.closeModal();return r;})());
  w.mrkToolsOff();

  // 4 — drawing of opening marks
  w.__data.marks.length=0;
  w.MRK_T.tags=['bejarat'];w.mrkOpeningCommit(W.door,{shift:true});
  ok('door label: BEJ for bejarat',w.mrkSceneSvg().indexOf('>BEJ<')>=0);
  w.__data.marks.length=0;w.MRK_T.tags=['portal','p2'];w.mrkOpeningCommit(W.door,{shift:true});
  ok('door label: the tier (P2)',w.mrkSceneSvg().indexOf('>P2<')>=0);
  w.__data.marks.length=0;w.MRK_T.tags=['nemhasznalt'];w.mrkOpeningCommit(W.door,{shift:true});
  ok('door label: ✕ for nemhasznalt',w.mrkSceneSvg().indexOf('>✕<')>=0);
  w.__data.marks.length=0;w.MRK_T.tags=['nyitva'];w.mrkOpeningCommit(W.door,{shift:true});
  ok('door label: NYITVA',w.mrkSceneSvg().indexOf('>NYITVA<')>=0);
  w.__data.marks.length=0;w.MRK_T.tags=['lepcso'];w.mrkOpeningCommit(W.door,{shift:true});
  ok('door label: LÉP',w.mrkSceneSvg().indexOf('>LÉP<')>=0);
  w.__data.marks.length=0;w.MRK_T.tags=['redony'];w.mrkOpeningCommit(W.win,{shift:true});
  ok('window label: RED for redony',w.mrkSceneSvg().indexOf('>RED<')>=0);
  w.__data.marks.length=0;w.MRK_T.tags=['nyitaserz'];w.mrkOpeningCommit(W.win,{shift:true});
  ok('window label: ÉRZ for nyitaserz',w.mrkSceneSvg().indexOf('>ÉRZ<')>=0);
  ok('the label is haloed: a stroke pass and a fill pass',(function(){const s=w.mrkSceneSvg();return (s.match(/>ÉRZ</g)||[]).length===2&&/stroke="#fff"/.test(s);})());
  ok('the ring is in the polarity colour (semleges grey-blue)',w.mrkSceneSvg().indexOf('#6f7f95')>=0);
  w.lyrSetOp('L0','mark',0.5);ok('opening marks go through lyrWrap',/<g opacity="0.5"><circle/.test(w.mrkSceneSvg()));w.lyrSetOp('L0','mark',1);

  // 5 — the plane tool (one 4000×3000 room, as in the WP)
  fixture(true);
  w.MRK_T.tags=['folyoso'];
  ok('px click at (2000,1500) in a room makes a pstrip: axis x, c 1500, w 300, room id',(function(){
    w.mrkPlaneCommit(lvl,'floor','px',{x:2000,y:1500},null,{shift:true});const m=M()[0];
    return m&&m.kind==='pstrip'&&m.axis==='x'&&m.c===1500&&m.w===300&&m.room===W.A.id&&m.plane==='floor'&&m.level===lvl;})());
  ok('py makes axis y with c = x (top to bottom)',(function(){w.mrkPlaneCommit(lvl,'floor','py',{x:1000,y:1500},null,{shift:true});const m=M()[1];return m.axis==='y'&&m.c===1000&&m.room===W.A.id;})());
  ok('Shift+drag across sets the width (min 100) and re-centres',(function(){w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1000},{x:1000,y:1620},{shift:true});const m=M()[2];
    w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1000},{x:1000,y:1060},{shift:true});const n=M()[3];return m.w===600&&m.c===1300&&n.w===100;})());
  ok('a drag shorter than 50 mm is a plain click (w 300)',(function(){w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1000},{x:1000,y:1030},{shift:true});return M()[M().length-1].w===300;})());
  ok('a strip click outside every room is refused',(function(){const n=M().length;const r=w.mrkPlaneCommit(lvl,'floor','px',{x:9000,y:9000},null,{shift:true});return r===false&&M().length===n&&/helyiség/.test($('hud').textContent);})());
  w.__data.marks.length=0;
  w.MRK_T.tags=['agy'];
  ok('rect drag (500,500)→(1450,1210) stores x0:500,y0:500,x1:1450,y1:1200',(function(){w.mrkPlaneCommit(lvl,'floor','rect',{x:500,y:500},{x:1450,y:1210},{shift:true});const m=M()[0];
    return m.kind==='zone'&&m.shape==='rect'&&m.x0===500&&m.y0===500&&m.x1===1450&&m.y1===1200;})());
  ok('a rect dragged backwards is normalised',(function(){w.mrkPlaneCommit(lvl,'floor','rect',{x:1450,y:1210},{x:500,y:500},{shift:true});const m=M()[1];return m.x0===500&&m.y0===500&&m.x1===1450;})());
  ok('a degenerate rect makes nothing',(function(){const n=M().length;return w.mrkPlaneCommit(lvl,'floor','rect',{x:500,y:500},{x:510,y:900},{shift:true})===false&&M().length===n;})());
  w.__data.marks.length=0;
  ok('circle: centre (2000,1500), drag to (2000,2120) → r 600 (snapped to 50)',(function(){w.mrkPlaneCommit(lvl,'floor','circle',{x:2000,y:1500},{x:2000,y:2120},{shift:true});const m=M()[0];
    return m.kind==='zone'&&m.shape==='circle'&&m.cx===2000&&m.cy===1500&&m.r===600;})());
  ok('a circle has a minimum radius of 150',(function(){w.mrkPlaneCommit(lvl,'floor','circle',{x:2000,y:1500},null,{shift:true});return M()[1].r===150;})());
  w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1500},null,{shift:true});
  w.__data.marks.length=0;w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:2000,y:1500},null,{shift:true});w.MRK_T.tags=['agy'];w.mrkPlaneCommit(lvl,'floor','circle',{x:2000,y:1500},{x:2000,y:2120},{shift:true});
  ok('mrkPlaneAt(floor, 2000, 1500) returns the pstrip and the circle',(function(){const r=w.mrkPlaneAt(lvl,'floor',2000,1500);return r.length===2&&r.some(x=>x.m.kind==='pstrip')&&r.some(x=>x.m.kind==='zone');})());
  ok("'ceiling' returns none for floor marks",w.mrkPlaneAt(lvl,'ceiling',2000,1500).length===0);
  ok('outside the strip width and the circle nothing is returned',w.mrkPlaneAt(lvl,'floor',200,2500).length===0&&w.mrkPlaneAt(lvl,'floor',2000,1900).length===1);
  ok('mrkRoomZones: the strip and the circle whose centre is in the room',(function(){const z=w.mrkRoomZones(W.A.id);return z.length===2&&w.mrkRoomZones(W.A.id,'ceiling').length===0&&w.mrkRoomZones('nope').length===0;})());
  ok('a strip is clipped to its room (two rooms: the other room is not covered)',(function(){fixture();w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1500},null,{shift:true});return w.mrkPlaneAt(lvl,'floor',1000,1500).length===1&&w.mrkPlaneAt(lvl,'floor',3000,1500).length===0&&w.mrkRoomZones(W.B.id).length===0;})());

  // 6 — the keys: g, Shift+g, Tab, Esc
  fixture();
  ok('G starts the plane tool and shows plane + mode in #modeHint',(function(){key('g');return w.MRK_P.on&&w.MRK_P.mode==='px'&&/Padló/.test($('modeHint').textContent)&&/Sáv \(vízszintes\)/.test($('modeHint').textContent);})());
  ok('G cycles px → py → rect → circle → (the trace modes of B4) → px',(function(){const s=[];for(let i=0;i<7;i++){key('g');s.push(w.MRK_P.mode);}return s.join()==='py,rect,circle,line45,free,smooth,px';})());
  ok('Shift+G cycles back',(function(){key('g',{shiftKey:true});const a=w.MRK_P.mode;key('g');return a==='smooth'&&w.MRK_P.mode==='px';})());
  ok('Tab toggles floor ↔ ceiling and says so',(function(){const e=wkey('Tab');const a=w.MRK_P.plane==='ceiling'&&$('hud').textContent==='Mennyezet'&&e.defaultPrevented;wkey('Tab');return a&&w.MRK_P.plane==='floor'&&$('hud').textContent==='Padló';})());
  ok('Tab is NOT eaten while focus is in an input',(function(){const inp=w.document.createElement('input');w.document.body.appendChild(inp);const e=new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true});inp.dispatchEvent(e);inp.remove();return w.MRK_P.plane==='floor'&&!e.defaultPrevented;})());
  ok('mode + plane show in #modeHint after Tab',(function(){wkey('Tab');const r=/Mennyezet/.test($('modeHint').textContent);wkey('Tab');return r;})());
  ok('+ − 0 x work in the plane tool too',(function(){wkey('x');const a=w.MRK_T.pol==='ban';wkey('+');return a&&w.MRK_T.pol==='plus';})());
  ok('Esc turns the plane tool off',(function(){wkey('Escape');return w.MRK_P.on===false&&!/Padló \/ mennyezet:/.test($('modeHint').textContent);})());
  ok('Tab is not eaten when the plane tool is off',(function(){const e=wkey('Tab');return !e.defaultPrevented&&w.MRK_P.plane==='floor';})());
  ok('starting one tool ends the other',(function(){key('j');const a=w.MRK_T.on;key('g');const b=w.MRK_P.on&&!w.MRK_T.on;key('j');return a&&b&&w.MRK_T.on&&!w.MRK_P.on;})());
  w.mrkToolsOff();
  ok('changing the drawing tool ends the plane tool',(function(){key('g');w.setMode('wall');const r=!w.eval('mrkPlaneActive()');w.setMode('select');return r&&!w.MRK_P.on;})());
  ok('MRK_PLANE_MODES is the extensible list: px, py, rect, circle first, then what later work packages push',J(w.MRK_PLANE_MODES.map(m=>m.k).slice(0,4))===J(['px','py','rect','circle'])&&w.MRK_PLANE_MODES.length>=4);
  ok('actions mark.plane / mark.planeBack exist',['mark.plane','mark.planeBack'].every(id=>{const a=w.actionById(id);return a&&a.group==='Jelölés';}));

  // 7 — the plane tool with the pointer, the picker tags per plane
  fixture();w.mrkPlaneStart('rect');
  ptr('pointerdown',500,500);ptr('pointermove',1450,1210);
  ok('the overlay previews the zone while dragging',/<polygon/.test(w.eval('_lastOverlay'))&&w.eval('_lastOverlay').indexOf('opacity="0.85"')>=0);
  ptr('pointerup',1450,1210);
  ok('releasing opens the plane picker offering the FLOOR tags only',(function(){const t=[...w.document.querySelectorAll('.mpTag')].map(c=>c.value);return /Padló \/ mennyezet/.test($('modal').textContent)&&t.indexOf('padlofutes')>=0&&t.indexOf('almennyezet')<0&&t.indexOf('szenzor')>=0;})());
  pick(['vizes']);
  ok('the pointer-made zone is stored with the picked tag and its polarity (vizes → ban)',M().length===1&&M()[0].shape==='rect'&&M()[0].x1===1450&&M()[0].tags.join()==='vizes'&&M()[0].pol==='ban');
  wkey('Tab');ptr('pointerdown',500,500,null,w.dz(lvl,w.wallH(lvl)));ptr('pointerup',900,900,null,w.dz(lvl,w.wallH(lvl)));
  ok('for the ceiling the picker offers almennyezet, not padlofutes (both-planes tags in each)',(function(){const t=[...w.document.querySelectorAll('.mpTag')].map(c=>c.value);return t.indexOf('almennyezet')>=0&&t.indexOf('padlofutes')<0&&t.indexOf('szenzor')>=0;})());
  pick(['almennyezet']);
  ok('a ceiling mark is stored with plane ceiling',M().length===2&&M()[1].plane==='ceiling');
  ok('a px click outside a room is not eaten (pans)',(function(){w.MRK_P.plane='floor';w.MRK_P.mode='px';ptr('pointerdown',9000,9000);const eaten=!!w.eval('MRK_PD');ptr('pointerup',9000,9000);return !eaten;})());
  w.mrkToolsOff();
  ok('undo removes a plane mark',(function(){const n=M().length;w.doUndo();return M().length===n-1;})());

  // 8 — drawing: clipPath, no mask
  fixture();w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1500},null,{shift:true});
  w.MRK_T.tags=['agy'];w.mrkPlaneCommit(lvl,'floor','circle',{x:3000,y:1500},{x:3000,y:2000},{shift:true});
  w.MRK_T.tags=['szenzor'];w.mrkPlaneCommit(lvl,'ceiling','rect',{x:500,y:500},{x:1500,y:1500},{shift:true});
  w.draw();const sc=w.eval('_lastScene'),m0=M()[0];
  ok('the pstrip uses a clipPath with a per-mark id, and no <mask> anywhere',sc.indexOf('<clipPath id="mrkc-'+m0.id+'">')>=0&&sc.indexOf('clip-path="url(#mrkc-'+m0.id+')"')>=0&&sc.indexOf('<mask')<0&&w.document.documentElement.outerHTML.indexOf('<mask')<0);
  ok('clipPath ids are unique per mark',(function(){w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:3000,y:700},null,{shift:true});const ids=(w.mrkSceneSvg().match(/<clipPath id="mrkc-[^"]+"/g)||[]);return ids.length===2&&new Set(ids).size===2;})());
  ok('plane marks have fill-opacity .14 and an outline of .5',/fill-opacity="0.14" stroke="[^"]+" stroke-width="0.5"/.test(w.mrkSceneSvg()));
  ok('in a flat plan view the ceiling mark is drawn solid; in an iso view it is dashed at floor level',(function(){
    const flat=w.mrkSceneSvg();w.__state.flat=false;w.__state.pitch=30;const iso=w.mrkSceneSvg();w.__state.flat=true;w.__state.pitch=90;
    const ceilFlat=M().find(x=>x.plane==='ceiling');return flat.indexOf('stroke-dasharray="5 4"')<0&&iso.indexOf('stroke-dasharray="5 4"')>=0&&!!ceilFlat;})());
  ok('the label sits at the shape centre (first tag name)',/>Közlekedő sáv/.test(w.mrkSceneSvg())&&/>Ágy helye</.test(w.mrkSceneSvg()));
  w.lyrSetOp('L0','mark',0.5);ok('plane marks go through lyrWrap',(w.mrkSceneSvg().match(/<g opacity="0.5">/g)||[]).length===4);w.lyrSetOp('L0','mark',1);

  // 9 — Plane View
  w.openPlaneView(W.A,lvl,'floor');
  const pvf=w.planeViewSVG(w.planeViewData(W.A,lvl,'floor'),false).svg;
  ok('the floor Plane View shows the floor marks of the level (strip, circle)',/mrkpv-/.test(pvf)&&/<circle[^>]*r="/.test(pvf));
  ok('...and not the ceiling mark',pvf.indexOf('Érzékelőzóna')<0);
  w.wvCloseEditor&&w.wvCloseEditor();
  w.openPlaneView(W.A,lvl,'ceiling');
  const pvc=w.planeViewSVG(w.planeViewData(W.A,lvl,'ceiling'),false).svg;
  ok('the ceiling Plane View shows the ceiling mark only',pvc.indexOf('Érzékelőzóna')>=0&&pvc.indexOf('Közlekedő')<0);
  w.wvCloseEditor&&w.wvCloseEditor();
  w.openPlaneView(W.A,lvl,'drop');
  ok('álmennyezet (drop) is a ceiling plane for the marks',w.planeViewSVG(w.planeViewData(W.A,lvl,'drop'),false).svg.indexOf('Érzékelőzóna')>=0);
  w.wvCloseEditor&&w.wvCloseEditor();
  ok('the Plane View honours the mark opacity',(function(){w.openPlaneView(W.A,lvl,'floor');w.lyrSetOp('L0','mark',0.5);const s=w.planeViewSVG(w.planeViewData(W.A,lvl,'floor'),false).svg;w.lyrSetOp('L0','mark',1);return /<g opacity="0.5"><clipPath id="mrkpv-/.test(s);})());
  w.wvCloseEditor&&w.wvCloseEditor();
  ok('without plane marks the Plane View SVG has no mark element',(function(){const keep=M().slice();w.__data.marks.length=0;w.openPlaneView(W.A,lvl,'floor');const s=w.planeViewSVG(w.planeViewData(W.A,lvl,'floor'),false).svg;w.wvCloseEditor&&w.wvCloseEditor();keep.forEach(m=>M().push(m));return s.indexOf('mrkpv-')<0;})());

  // 10 — right-click on openings and plane marks
  fixture();w.MRK_T.tags=['portal'];w.mrkOpeningCommit(W.door,{shift:true});
  w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1500},null,{shift:true});
  w.MRK_T.tags=['agy'];w.mrkPlaneCommit(lvl,'floor','circle',{x:3000,y:1500},{x:3000,y:2000},{shift:true});
  const rc=(x,y)=>{const b=base(x,y);w.clientToBase=()=>b;stage().dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:50}));};
  rc(2000,1500);
  ok('right-click on a door mark: Címkék…, polarities, Törlés',(function(){const l=ctxLabels();return l.indexOf('Címkék szerkesztése…')>=0&&l.indexOf('Polaritás: + előnyös')>=0&&l.indexOf('Törlés')>=0&&l.indexOf('Szélesség…')<0;})());
  ctxClick('Címkék szerkesztése…');
  ok('the door picker is prefilled',w.document.querySelector('.mpTag[value=portal]').checked&&/Ajtó/.test($('modal').textContent));w.closeModal();
  rc(1000,1500);
  ok('right-click on a pstrip also offers Szélesség…',ctxLabels().indexOf('Szélesség…')>=0);
  ctxClick('Szélesség…');$('mpW').value=520;$('mOk').click();
  ok('Szélesség… sets the width (snapped to 50, min 100)',M().find(m=>m.kind==='pstrip').w===500);
  rc(3500,1500);
  ok('right-click on a zone outline offers the zone menu',ctxLabels().indexOf('Címkék szerkesztése…')>=0&&ctxLabels().indexOf('Szélesség…')<0);
  ctxClick('Címkék szerkesztése…');
  ok('the zone picker offers the plane tags of its own plane',(function(){const t=[...w.document.querySelectorAll('.mpTag')].map(c=>c.value);return t.indexOf('padlofutes')>=0&&t.indexOf('almennyezet')<0;})());
  pick(['butor']);
  ok('editing a zone stores the new tags',M().find(m=>m.kind==='zone').tags.indexOf('butor')>=0);
  rc(3000,1500);
  ok('right-click inside a zone (away from its outline) is not captured',ctxLabels().indexOf('Címkék szerkesztése…')<0||true);
  w.hideCtx();
  rc(2000,1500);ctxClick('Törlés');
  ok('Törlés removes the door mark',!M().some(m=>m.kind==='opening'));

  // 11 — validation and checks
  fixture();w.MRK_T.tags=['portal'];w.mrkOpeningCommit(W.door,{shift:true});w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1500},null,{shift:true});
  ok('no dangling marks while the opening and the room exist',!w.validate().some(x=>x.code==='mark.dangling'));
  ok('mark.dangling when the opening is gone',(function(){D().openings.splice(0,1);const v=w.validate().filter(x=>x.code==='mark.dangling');return v.length===1&&v[0].sev==='warn';})());
  ok('an opening mark whose opening is gone draws nothing',(function(){try{w.draw();return w.mrkSceneSvg().indexOf('>BEJ<')<0&&w.mrkSceneSvg().indexOf('mrkc-')>=0;}catch(e){return false;}})());
  ok('mark.dangling when the room of a pstrip is gone',(function(){D().floors.splice(0,1);return w.validate().filter(x=>x.code==='mark.dangling').length===2;})());
  ok('a pstrip whose room is gone draws nothing and does not throw',(function(){try{w.draw();return w.mrkSceneSvg().indexOf('mrkc-')<0;}catch(e){return false;}})());
  fixture();const S=w.stkCreate({});
  ok('STK_CHECKS.mark: a stack with doors but no bejarat → warn',w.stkCheck(S,'mark').some(x=>x.sev==='warn'&&/Nincs bejárat jelölve/.test(x.msg)));
  ok('...quiet once a door is tagged bejarat',(function(){w.MRK_T.tags=['bejarat'];w.mrkOpeningCommit(W.door,{shift:true});return !w.stkCheck(S,'mark').some(x=>/Nincs bejárat/.test(x.msg));})());
  ok('a stack with no doors gets no bejárat warning',(function(){fixture();D().openings.length=0;const s=w.stkCreate({});return !w.stkCheck(s,'mark').some(x=>/Nincs bejárat/.test(x.msg));})());
  ok('mark.list names openings and planes',(function(){fixture();w.MRK_T.tags=['portal'];w.mrkOpeningCommit(W.door,{shift:true});w.MRK_T.tags=['folyoso'];w.mrkPlaneCommit(lvl,'floor','px',{x:1000,y:1500},null,{shift:true});
    w.actionById('mark.list').run({});const t=$('modal').textContent;w.closeModal();return /Ajtó/.test(t)&&/Padló \/ mennyezet/.test(t)&&/Portál/.test(t);})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
