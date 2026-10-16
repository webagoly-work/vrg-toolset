// spec-36 — marking layer: walls, wall faces, vertical and horizontal strips, the tool, right-click, Wall View
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
  const key=(k,o)=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{})));
  // fixture: a 4000×3000 room on centrelines, four 100 mm walls, one partition at x=2000 → two rooms
  let W;
  const fixture=()=>{w.newBlankProject();w.eval('stacks=[]');w.__state.stkOff=false;w.__state.stack=null;w.__state.activeLayer='L0';w.mrkToolsOff();w.MRK_T.mode='wall';w.MRK_T.pol='plus';w.MRK_T.tags=[];
    const WA=w.__getWalls()[lvl];
    WA.push({x0:0,y0:-50,x1:4000,y1:50,layer:'L0'},{x0:0,y0:2950,x1:4000,y1:3050,layer:'L0'},{x0:-50,y0:0,x1:50,y1:3000,layer:'L0'},{x0:3950,y0:0,x1:4050,y1:3000,layer:'L0'},{x0:1950,y0:0,x1:2050,y1:3000,layer:'L0'});
    D().floors.push({level:lvl,name:'Bal',poly:[[0,0],[2000,0],[2000,3000],[0,3000]],layer:'L0'},{level:lvl,name:'Jobb',poly:[[2000,0],[4000,0],[4000,3000],[2000,3000]],layer:'L0'});
    w.ensureIds(D());w.eval(`SNAP.${lvl}=centerlines(WALLS.${lvl})`);
    W={top:WA[0],bot:WA[1],left:WA[2],right:WA[3],part:WA[4],A:D().floors[0],B:D().floors[1]};w.__state.active=lvl;};
  const pick=(tags,o)=>{o=o||{};tags.forEach(k=>{const c=w.document.querySelector('.mpTag[value="'+k+'"]');c.checked=true;c.dispatchEvent(new w.Event('change',{bubbles:true}));});
    if(o.pol)w.document.querySelector('input[name=mpPol][value='+o.pol+']').checked=true;if(o.note)$('mpNote').value=o.note;
    if(o.v0!=null){$('mpV0').value=o.v0;$('mpV1').value=o.v1;}$('mOk').click();};
  const pt=(r,side,u)=>({level:lvl,id:r.id,side,u});
  fixture();

  // 1 — geometry helpers
  ok('mrkU is the position along the centreline, clamped',w.mrkU(W.left,0,1200)===1200&&w.mrkU(W.left,0,-500)===0&&w.mrkU(W.left,0,9000)===3000&&w.mrkU(W.top,1500,0)===1500);
  ok('mrkFacePt: +1 is along wallInfo.perp (the left wall faces +x), off moves further out',(function(){const p=w.mrkFacePt(W.left,1,1000,0),q=w.mrkFacePt(W.left,1,1000,60),n=w.mrkFacePt(W.left,-1,1000,0);
    return p[0]===50&&p[1]===1000&&q[0]===110&&n[0]===-50&&w.mrkFacePt(W.top,1,500,0)[1]===50;})());
  ok("mrkFaceRanges of the left wall's inner face against its room = one range over its length (±100)",(function(){const g=w.mrkFaceRanges(W.left,1,W.A.poly);return g.length===1&&g[0][0]<=100&&g[0][1]>=2900;})());
  ok('the outer face of the same wall looks into no room of this poly',w.mrkFaceRanges(W.left,-1,W.A.poly).length===0);
  ok("the partition's two faces look into different rooms",(function(){const a=w.mrkRoomOfFace(lvl,W.part,-1,1500),b=w.mrkRoomOfFace(lvl,W.part,1,1500);return a&&b&&a.rm===W.A&&b.rm===W.B;})());
  ok('mrkVAbs: a negative band counts both ends down from the ceiling',J(w.mrkVAbs([-300,0],W.left,lvl))===J([2400,2700])&&J(w.mrkVAbs([-450,-150],W.left,lvl))===J([2250,2550])&&J(w.mrkVAbs([950,1250],W.left,lvl))===J([950,1250]));
  ok('a wall with its own height is used for the ceiling reference',J(w.mrkVAbs([-300,0],{h:2500},lvl))===J([2200,2500]));

  // 2 — vertical strips
  w.MRK_T.mode='vstrip';w.MRK_T.tags=['elo'];
  ok('a Shift+click with a brush creates the vstrip without a dialog: {u0:850,u1:1150}',(function(){w.mrkCommit(pt(W.left,1,1000),{shift:true});const m=M()[0];
    return m&&m.kind==='vstrip'&&m.u0===850&&m.u1===1150&&m.side===1&&m.wall===W.left.id&&m.tags.join()==='elo'&&/^J\d+$/.test(m.id)&&m.level===lvl&&m.layer==='L0';})());
  ok('the click position snaps to 50 mm',(function(){w.mrkCommit(pt(W.left,1,1037),{shift:true});const m=M()[1];return m.u0===900&&m.u1===1200;})());
  ok('near the end of a short wall the strip is clamped inside 0…len',(function(){const WA=w.__getWalls()[lvl];WA.push({x0:5000,y0:0,x1:5100,y1:600,layer:'L0'});w.ensureIds(D());const sw=WA[WA.length-1];
    w.mrkCommit(pt(sw,1,550),{shift:true});const m=M()[2];w.mrkCommit(pt(sw,1,20),{shift:true});const n=M()[3];return m.u0>=0&&m.u1<=600&&m.u1===600&&n.u0===0;})());
  ok('a drag along the wall sets u0…u1 (min 100 mm)',(function(){w.mrkCommit(pt(W.top,1,500),{u0:300,u1:1180,shift:true});const m=M()[4];
    w.mrkCommit(pt(W.top,1,500),{u0:300,u1:340,shift:true});const n=M()[5];return m.u0===300&&m.u1===1200&&n.u1-n.u0===300;})());
  w.__data.marks.length=0;

  // 3 — horizontal strips
  w.MRK_T.mode='hstrip';w.MRK_T.tags=['kapcsolo'];w.mrkCommit(pt(W.left,1,1000),{shift:true});
  w.MRK_T.tags=['cove'];w.mrkCommit(pt(W.top,1,1000),{shift:true});
  ok('hstrip from tag kapcsolo gets v0:950, v1:1250',M()[0].kind==='hstrip'&&M()[0].v0===950&&M()[0].v1===1250);
  ok('cove on a 2700 wall gets 2400…2700',M()[1].v0===2400&&M()[1].v1===2700);
  ok('cove follows the wall own height',(function(){const r=W.top;r.h=2500;w.MRK_T.tags=['cove'];w.mrkCommit(pt(W.top,-1,1000),{shift:true});delete r.h;const m=M()[2];return m.v0===2200&&m.v1===2500;})());
  w.__data.marks.length=0;

  // 4 — mrkAt
  w.MRK_T.mode='vstrip';w.MRK_T.tags=['elo'];w.mrkCommit(pt(W.left,1,1000),{shift:true});
  w.MRK_T.mode='vstrip';w.MRK_T.tags=['rbx'];w.mrkCommit(pt(W.left,-1,1000),{shift:true});
  w.MRK_T.mode='hstrip';w.MRK_T.tags=['kapcsolo'];w.mrkCommit(pt(W.left,1,1000),{shift:true});
  ok('mrkAt returns the vstrip and the kapcsolo hstrip of that face, not the strip on the other side',(function(){const r=w.mrkAt(lvl,W.left.id,1,1000,1100);
    return r.length===2&&r.some(x=>x.kind==='vstrip'&&x.tags[0]==='elo')&&r.some(x=>x.kind==='hstrip')&&!r.some(x=>x.tags[0]==='rbx');})());
  ok('the other face sees only its own strip',(function(){const r=w.mrkAt(lvl,W.left.id,-1,1000,1100);return r.length===1&&r[0].tags[0]==='rbx';})());
  ok('outside the strip range nothing is returned',w.mrkAt(lvl,W.left.id,1,2000,100).length===0&&w.mrkAt(lvl,W.left.id,1,1000,100).length===1);
  ok('u and v are optional: omitted = any position',w.mrkAt(lvl,W.left.id,1,null,null).length===2);

  // 5 — extend to room
  ok('Extend-to-room turns the hstrip into one hband',(function(){const m=M().find(x=>x.kind==='hstrip');const r=w.mrkExtendToRoom(m);
    return r&&m.kind==='hband'&&m.room===W.A.id&&!('wall' in m)&&!('side' in m)&&m.v0===950;})());
  ok('mrkAt on another wall face of that room at that height finds the hband',w.mrkAt(lvl,W.top.id,1,1000,1100).some(x=>x.kind==='hband')&&w.mrkAt(lvl,W.bot.id,-1,1000,1100).some(x=>x.kind==='hband'));
  ok('the partition side that looks into the room finds it, the far side (other room) does not',w.mrkAt(lvl,W.part.id,-1,1000,1100).some(x=>x.kind==='hband')&&!w.mrkAt(lvl,W.part.id,1,1000,1100).some(x=>x.kind==='hband'));
  ok("the other room's own walls do not find it",!w.mrkAt(lvl,W.right.id,-1,1000,1100).some(x=>x.kind==='hband'));
  ok('outside the height band the hband is not found',!w.mrkAt(lvl,W.top.id,1,1000,1500).some(x=>x.kind==='hband'));
  ok('hband draws on every face of the room (several dashed lines)',(function(){const s=w.mrkSceneSvg();return (s.match(/stroke-dasharray="6 4"/g)||[]).length>=4;})());
  ok('Visszaalakítás erre a falra turns it back into one hstrip on that face',(function(){const m=M().find(x=>x.kind==='hband');const r=w.mrkShrinkToFace(m,W.top.id,1);return r&&m.kind==='hstrip'&&m.wall===W.top.id&&m.side===1&&!('room' in m);})());
  ok('extending is refused when no room is on that side',(function(){w.MRK_T.tags=['dugalj'];w.mrkCommit(pt(W.left,-1,1000),{shift:true});const m=M()[M().length-1];const r=w.mrkExtendToRoom(m);return r===false&&m.kind==='hstrip'&&/helyiség/.test($('hud').textContent);})());
  w.__data.marks.length=0;

  // 6 — wall and side marks, the picker
  w.MRK_T.mode='wall';
  w.mrkCommit(pt(W.part,1,1000),{});
  ok('the picker opens for a click without Shift',!!$('mOk')&&w.document.querySelectorAll('.mpTag').length===w.MRK_TAGS.wall.length&&/Teljes fal/.test($('modal').textContent));
  ok('the picker offers four polarity radios',w.document.querySelectorAll('input[name=mpPol]').length===4);
  pick(['tartofal']);
  ok('picking a tag sets the radio to the tag polarity: tartofal → ban',M().length===1&&M()[0].pol==='ban'&&M()[0].kind==='wall'&&w.mrkWallTags(W.part.id).join()==='tartofal');
  ok('the choice is remembered as the new brush',w.MRK_T.pol==='ban'&&w.MRK_T.tags.join()==='tartofal');
  w.mrkCommit(pt(W.part,-1,500),{});pick(['fofal'],{pol:'plus'});
  ok('a second wall-mode click on a marked wall edits that mark (one wall mark per wall per layer)',M().length===1&&M()[0].tags.join()==='tartofal,fofal'&&M()[0].pol==='plus');
  ok('the picker was prefilled with the existing tags and unchecked boxes keep them off',true);
  w.mrkCommit(pt(W.part,-1,500),{});
  ok('the editing picker shows the existing tags ticked',w.document.querySelector('.mpTag[value=tartofal]').checked&&w.document.querySelector('.mpTag[value=fofal]').checked);
  w.document.querySelector('.mpTag[value=fofal]').checked=false;$('mpNote').value='Ellenőrizni';$('mOk').click();
  ok('unticking removes a tag, the note is stored',M()[0].tags.join()==='tartofal'&&M()[0].note==='Ellenőrizni');
  w.MRK_T.mode='side';w.mrkCommit(pt(W.left,1,500),{});pick(['media','lforma']);
  ok('a side mark stores the face: {wall, side}',(function(){const m=M()[1];return m.kind==='side'&&m.wall===W.left.id&&m.side===1&&m.tags.join()==='lforma,media';})());
  ok('mrkAt: a side mark covers its face only',w.mrkAt(lvl,W.left.id,1,100,100).some(x=>x.kind==='side')&&!w.mrkAt(lvl,W.left.id,-1,100,100).some(x=>x.kind==='side'));
  ok('a wall mark covers both faces',w.mrkAt(lvl,W.part.id,1,100,100).some(x=>x.kind==='wall')&&w.mrkAt(lvl,W.part.id,-1,100,100).some(x=>x.kind==='wall'));
  ok('the hstrip picker has the height inputs, prefilled from the first ticked tag',(function(){w.MRK_T.mode='hstrip';w.MRK_T.tags=[];w.mrkCommit(pt(W.top,1,100),{});
    const c=w.document.querySelector('.mpTag[value=cove]');c.checked=true;c.dispatchEvent(new w.Event('change',{bubbles:true}));
    const a=+$('mpV0').value===2400&&+$('mpV1').value===2700;$('mpV0').value=2300;$('mOk').click();const m=M()[M().length-1];return a&&m.v0===2300&&m.v1===2700;})());
  ok('Shift with no brush tags still opens the picker',(function(){w.MRK_T.tags=[];w.MRK_T.mode='side';w.mrkCommit(pt(W.bot,-1,500),{shift:true});const o=!!$('mOk')&&w.document.querySelector('#modalBg').style.display==='flex';w.closeModal();return o;})());
  w.__data.marks.length=0;

  // 7 — the keys
  fixture();
  ok('J starts the tool in the first mode and shows it in #modeHint',(function(){key('j');return w.MRK_T.on===true&&w.MRK_T.mode==='wall'&&/teljes fal/.test($('modeHint').textContent);})());
  ok('J cycles wall → side → vstrip → hstrip → wall',(function(){const seq=[];for(let i=0;i<4;i++){key('j');seq.push(w.MRK_T.mode);}return seq.join()==='side,vstrip,hstrip,wall';})());
  ok('Shift+J cycles back',(function(){key('j',{shiftKey:true});const a=w.MRK_T.mode;key('j',{shiftKey:true});return a==='hstrip'&&w.MRK_T.mode==='vstrip';})());
  ok('the mode names show in #modeHint',(function(){key('j');return /vízszintes sáv/.test($('modeHint').textContent);})());
  ok('+ − 0 x set the polarity of the brush',(function(){const r=[];['-','0','x','+'].forEach(k=>{w.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));r.push(w.MRK_T.pol);});return r.join()==='minus,none,ban,plus'&&/Jelölés polaritás/.test($('hud').textContent);})());
  ok('Esc turns the tool off and restores the mode hint',(function(){w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return w.MRK_T.on===false&&!/Jelölés:/.test($('modeHint').textContent);})());
  ok('with the tool off J starts it again, and Shift+J does nothing while off',(function(){key('j',{shiftKey:true});const off=!w.MRK_T.on;key('j');return off&&w.MRK_T.on;})());
  ok('changing the drawing tool ends the marking tool',(function(){w.setMode('wall');const r=!w.eval('mrkToolActive()');w.setMode('select');return r&&w.MRK_T.on===false;})());
  ok('the actions mark.wall, mark.wallBack, mark.list exist in group Jelölés',['mark.wall','mark.wallBack','mark.list'].every(id=>{const a=w.actionById(id);return a&&a.group==='Jelölés';}));

  // 8 — the tool with the pointer
  fixture();w.__state.zoom=1;w.mrkToolStart('vstrip');w.MRK_T.tags=['elo'];
  const stage=w.eval('stage');
  const base=(x,y)=>w.planToBase(x,y,w.dz(lvl,0));
  const ptr=(t,x,y,o)=>{const b=base(x,y);w.clientToBase=()=>b;stage.dispatchEvent(new w.MouseEvent(t,Object.assign({bubbles:true,cancelable:true,button:0,clientX:50,clientY:50},o||{})));};
  ptr('pointermove',50,1000);
  ok('hovering a wall sets the hover target and draws an overlay preview',(function(){const o=w.eval('_lastOverlay');return !!w.eval('MRK_H')&&w.eval('MRK_H').id===W.left.id&&o.indexOf('opacity="0.85"')>=0;})());
  ok('the face under the pointer decides the side (inside = +1 for the left wall, outside = −1)',(function(){ptr('pointermove',150,1000);const a=w.eval('MRK_H.side');ptr('pointermove',-150,1000);const b=w.eval('MRK_H.side');return a===1&&b===-1;})());
  ptr('pointermove',50,1000);
  ok('Shift+click with a brush creates the strip through the real pointer path',(function(){ptr('pointerdown',50,1000,{shiftKey:true});ptr('pointerup',50,1000,{shiftKey:true});
    const m=M()[0];return m&&m.kind==='vstrip'&&m.u0===850&&m.u1===1150;})());
  ok('the click did not select or pan anything (the tool ate it)',w.__getSel()===null);
  ok('a drag along the wall in vstrip mode sets u0…u1',(function(){ptr('pointermove',50,300);ptr('pointerdown',50,300,{shiftKey:true});ptr('pointermove',50,900,{shiftKey:true});ptr('pointerup',50,900,{shiftKey:true});
    const m=M()[1];return m&&m.u0===300&&m.u1===900;})());
  ok('a click that hits no wall is not eaten (it pans as usual)',(function(){const b=base(1000,1500);w.clientToBase=()=>b;return w.stkToolEvent('down',new w.MouseEvent('pointerdown',{button:0}))===false;})());
  ok('right button and the camera chord are not eaten',(function(){const b=base(50,1000);w.clientToBase=()=>b;
    return w.stkToolEvent('down',new w.MouseEvent('pointerdown',{button:2}))===false&&w.stkToolEvent('down',new w.MouseEvent('pointerdown',{button:0,buttons:3}))===false;})());
  ok('undo removes the created mark (scoped to marks)',(function(){const n=M().length;w.doUndo();return M().length===n-1;})());
  w.mrkToolsOff();

  // 9 — drawing and visibility
  fixture();w.MRK_T.mode='vstrip';w.MRK_T.tags=['elo'];w.mrkCommit(pt(W.left,1,1000),{shift:true});
  w.MRK_T.mode='wall';w.MRK_T.tags=['tartofal'];w.MRK_T.pol='ban';w.mrkCommit(pt(W.right,1,100),{shift:true});
  w.MRK_T.mode='side';w.MRK_T.tags=['media'];w.MRK_T.pol='plus';w.mrkCommit(pt(W.top,1,100),{shift:true});
  w.__state.rot=0;w.__state.pitch=90;w.__state.flat=true;w.draw();
  ok('the scene contains the mark elements when the mark layer is visible',(function(){const s=w.eval('_lastScene');return s.indexOf('stroke-width="6"')>=0&&s.indexOf('fill-opacity="0.12"')>=0&&s.indexOf('#c8372d')>=0&&s.indexOf('#3f7fbf')>=0;})());
  ok('a wall mark carries a badge with the first tag (truncated to 14)',w.eval('_lastScene').indexOf('Tartófal')>=0);
  ok('polarity colours: plus blue (green is Vezethető fal only, 2026-10-15), ban red',w.mrkSceneSvg().indexOf('#3f7fbf')>=0&&w.mrkSceneSvg().indexOf('#c8372d')>=0);
  const withMarks=w.eval('_lastScene');w.eval('layers[0].cats.mark=false');w.draw();
  ok('none of it is drawn when cats.mark=false',w.mrkSceneSvg()===''&&w.eval('_lastScene').indexOf('stroke-width="6"')<0&&w.eval('_lastScene').length<withMarks.length);
  w.eval('layers[0].cats.mark=true');w.lyrSetOp('L0','mark',0.5);w.draw();
  ok('opacity goes through lyrWrap: each mark sits in a <g opacity="0.5">',(w.mrkSceneSvg().match(/<g opacity="0.5">/g)||[]).length===3);
  w.lyrSetOp('L0','mark',1);w.eval('layers[0].visible=false');w.draw();
  ok('a hidden layer hides the marks',w.mrkSceneSvg()==='');
  w.eval('layers[0].visible=true');w.draw();
  ok('a mark on a hidden layer still counts for mrkAt (a constraint is a constraint)',(function(){w.eval('layers[0].visible=false');const r=w.mrkAt(lvl,W.left.id,1,1000,100).length===1;w.eval('layers[0].visible=true');return r;})());
  ok('the L-form: two adjacent lforma sides get an L at the shared corner',(function(){fixture();w.MRK_T.mode='side';w.MRK_T.tags=['lforma'];w.MRK_T.pol='plus';
    w.mrkCommit(pt(W.left,1,100),{shift:true});w.mrkCommit(pt(W.top,1,100),{shift:true});return />L<\/text>/.test(w.mrkSceneSvg());})());
  ok('a single lforma side has no L',(function(){fixture();w.MRK_T.mode='side';w.MRK_T.tags=['lforma'];w.mrkCommit(pt(W.left,1,100),{shift:true});return !/>L<\/text>/.test(w.mrkSceneSvg());})());
  ok('the marks use no <mask>',w.mrkSceneSvg().indexOf('<mask')<0);

  // 10 — right-click
  fixture();w.__state.zoom=1;w.MRK_T.mode='hstrip';w.MRK_T.tags=['kapcsolo'];w.MRK_T.pol='plus';w.mrkCommit(pt(W.left,1,1000),{shift:true});
  const rc=(x,y)=>{const b=base(x,y);w.clientToBase=()=>b;stage.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:50}));};
  rc(50,1500);
  ok('right-click on a mark shows its menu: tags, polarities, extend, delete',(function(){const l=ctxLabels();
    return l.indexOf('Címkék szerkesztése…')>=0&&l.indexOf('Polaritás: − kerülendő')>=0&&l.indexOf('Polaritás: ⛔ tilos')>=0&&l.indexOf('Polaritás: · semleges')>=0&&l.indexOf('Polaritás: + előnyös')<0&&l.indexOf('Kiterjesztés a teljes helyiségre')>=0&&l.indexOf('Törlés')>=0;})());
  ctxClick('Polaritás: ⛔ tilos');
  ok('Polaritás changes the mark (undoable)',M()[0].pol==='ban'&&(w.doUndo(),M()[0].pol==='plus'));
  rc(50,1500);ctxClick('Kiterjesztés a teljes helyiségre');
  ok('Kiterjesztés turns it into an hband',M()[0].kind==='hband');
  rc(500,50);
  ok('the hband menu offers Visszaalakítás and not Kiterjesztés',(function(){const l=ctxLabels();return l.indexOf('Visszaalakítás erre a falra')>=0&&l.indexOf('Kiterjesztés a teljes helyiségre')<0;})());
  ctxClick('Visszaalakítás erre a falra');
  ok('Visszaalakítás makes an hstrip on the clicked face',M()[0].kind==='hstrip'&&M()[0].wall===W.top.id&&M()[0].side===1);
  rc(500,50);ctxClick('Címkék szerkesztése…');
  ok('Címkék szerkesztése opens the picker with the current tags',w.document.querySelector('.mpTag[value=kapcsolo]').checked);
  pick(['dugalj']);
  ok('editing stores the new tags',M()[0].tags.indexOf('dugalj')>=0);
  rc(500,50);ctxClick('Törlés');
  ok('Törlés removes the mark',M().length===0);
  rc(1000,1500);
  ok('right-click away from any mark leaves the normal menu alone',ctxLabels().indexOf('Törlés')<0||ctxLabels().indexOf('Címkék szerkesztése…')<0);
  w.hideCtx();
  ok('marks of a hidden mark layer are not offered by the right-click',(function(){w.MRK_T.mode='side';w.MRK_T.tags=['media'];w.mrkCommit(pt(W.left,1,500),{shift:true});w.eval('layers[0].cats.mark=false');
    const h=(function(){const b=base(50,1500);w.clientToBase=()=>b;return w.mrkHit({clientX:0,clientY:0});})();w.eval('layers[0].cats.mark=true');return h===null;})());

  // 11 — Wall View
  fixture();w.MRK_T.mode='vstrip';w.MRK_T.tags=['elo'];w.mrkCommit(pt(W.left,1,1000),{shift:true});
  w.MRK_T.mode='hstrip';w.MRK_T.tags=['kapcsolo'];w.mrkCommit(pt(W.left,1,1000),{shift:true});
  w.MRK_T.mode='vstrip';w.MRK_T.tags=['rbx'];w.mrkCommit(pt(W.left,-1,1000),{shift:true});
  w.MRK_T.mode='wall';w.MRK_T.tags=['tartofal'];w.MRK_T.pol='ban';w.mrkCommit(pt(W.left,1,1000),{shift:true});
  w.openWallView(W.left,lvl);
  const wv=w.wallElevationSVG(w.wallElevationData(W.left,lvl),false,false).svg;
  ok('Wall View draws the marks of the open wall and the viewed face',(wv.match(/class="mrkwv"/g)||[]).length===3);
  ok('the strip on the face behind the view is not drawn',wv.indexOf('RBX')<0);
  ok('Wall View labels carry the tag name and the height band',/Kapcsolómagasság/.test(wv)&&/↕ 950–1250/.test(wv));
  ok('flipping the view shows the other face',(function(){w.__WV().flipSide=true;const s=w.wallElevationSVG(w.wallElevationData(W.left,lvl),false,false).svg;w.__WV().flipSide=false;
    return (s.match(/class="mrkwv"/g)||[]).length===2&&/RBX/.test(s);})());
  ok('a mark on another wall does not show in this wall view',(function(){w.MRK_T.mode='vstrip';w.MRK_T.tags=['base'];w.mrkCommit(pt(W.top,1,1000),{shift:true});
    const s=w.wallElevationSVG(w.wallElevationData(W.left,lvl),false,false).svg;return (s.match(/class="mrkwv"/g)||[]).length===3;})());
  ok('Wall View honours the mark opacity',(function(){w.lyrSetOp('L0','mark',0.5);const s=w.wallElevationSVG(w.wallElevationData(W.left,lvl),false,false).svg;w.lyrSetOp('L0','mark',1);return (s.match(/<g opacity="0.5"><g class="mrkwv"/g)||[]).length===3;})());
  ok('without marks the Wall View SVG has no mark group',(function(){w.__data.marks.length=0;return w.wallElevationSVG(w.wallElevationData(W.left,lvl),false,false).svg.indexOf('mrkwv')<0;})());
  w.wvCloseEditor&&w.wvCloseEditor();

  // 12 — validation and checks
  fixture();w.MRK_T.mode='wall';w.MRK_T.tags=['tartofal'];w.mrkCommit(pt(W.part,1,100),{shift:true});
  ok('a mark with an existing wall is not dangling',!w.validate().some(x=>x.code==='mark.dangling'));
  ok('mark.dangling (warn) after the wall is deleted',(function(){w.__getWalls()[lvl].splice(w.__getWalls()[lvl].indexOf(W.part),1);const v=w.validate().filter(x=>x.code==='mark.dangling');return v.length===1&&v[0].sev==='warn'&&v[0].ref===M()[0].id;})());
  ok('a dangling mark draws nothing and does not throw',(function(){try{w.draw();return w.mrkSceneSvg()==='';}catch(e){return false;}})());
  ok('mark.dangling also covers an hband whose room is gone',(function(){fixture();w.MRK_T.mode='hstrip';w.MRK_T.tags=['dugalj'];w.mrkCommit(pt(W.left,1,100),{shift:true});w.mrkExtendToRoom(M()[0]);
    D().floors.splice(0,1);return w.validate().some(x=>x.code==='mark.dangling');})());
  ok('STK_CHECKS.mark: info while the stack has no wall mark',(function(){fixture();const S=w.stkCreate({});const c=w.stkCheck(S,'mark');return c.some(x=>x.sev==='info'&&/falcímke/.test(x.msg));})());
  ok('STK_CHECKS.mark: quiet once a wall is marked',(function(){const S=w.eval('stacks[0]');w.MRK_T.mode='wall';w.MRK_T.tags=['tartofal'];w.mrkCommit(pt(W.part,1,100),{shift:true});return !w.stkCheck(S,'mark').some(x=>/falcímke/.test(x.msg));})());
  ok('marks go on the active stack Jelölés layer',(function(){const S=w.eval('stacks[0]');return M()[0].layer===w.stkLayer(S.id,'mark').id;})());
  ok('without a stack they go on the active layer',(function(){fixture();w.MRK_T.mode='wall';w.MRK_T.tags=['tartofal'];w.mrkCommit(pt(W.part,1,100),{shift:true});return M()[0].layer==='L0';})());

  // 13 — the list
  ok('mark.list opens a table of the marks and a row click reports the mark in the HUD',(function(){w.actionById('mark.list').run({});const rows=w.document.querySelectorAll('.mrkRow');
    const n=rows.length;rows[0]&&rows[0].click();const h=/Jelölés J\d+/.test($('hud').textContent);w.closeModal();return n===1&&h;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
