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
try{Object.defineProperty(w,'innerWidth',{value:1600});Object.defineProperty(w,'innerHeight',{value:900});}catch(_){}
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.__state.active=lvl;
  const WA=w.__getWalls()[lvl];WA.length=0;WA.push({x0:0,y0:0,x1:4000,y1:300});
  w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;w.__data.floors.length=0;w.__data.wallNotes.length=0;

  // ---------- A1 context menu ----------
  const ctx=$('ctx');
  ok('ctx is viewport-fixed and above modals',(function(){const st=w.getComputedStyle(ctx);
    return st.position==='fixed'&&+st.zIndex>=9999;})(),w.getComputedStyle(ctx).position+'/'+w.getComputedStyle(ctx).zIndex);
  w.ctxMenu({clientX:100,clientY:100},[{label:'egy',act:()=>{}},{label:'kettő',act:()=>{}}]);
  ok('menu opens at the cursor',ctx.style.display==='block'&&ctx.style.left==='100px',ctx.style.left+'/'+ctx.style.top);
  ok('two buttons rendered',ctx.querySelectorAll('button').length===2);
  // near the right/bottom edge it must flip back on screen (jsdom reports 0-size rects, so we stub one)
  ok('edge flip logic present',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /x=Math\.max\(M,x-r\.width\)/.test(src)&&/y=Math\.max\(M,y-r\.height\)/.test(src);})());
  ok('clamped when taller than the screen',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /y=Math\.max\(M,H-M-r\.height\)/.test(src);})());
  w.hideCtx();

  // ---------- A2 floor right-click ----------
  w.__data.floors.push({level:lvl,poly:[[0,0],[4000,0],[4000,3000],[0,3000]],name:'Nappali'});
  const items=w.roomMenuItems({rm:w.__data.floors[0],src:'F',i:0,level:lvl});
  ok('room menu builder exists',Array.isArray(items)&&items.length>=8,'n='+(items&&items.length));
  ok('floor menu has the data sheet',items.some(i=>/Helyiség adatlap/.test(i.label)));
  ok('floor menu has both plane views',items.some(i=>/Padló nézet/.test(i.label))&&items.some(i=>/Mennyezet nézet/.test(i.label)));
  ok('floor menu has rename + label toggle',items.some(i=>/Helyiség neve/.test(i.label))&&items.some(i=>/Felirat/.test(i.label)));
  ok('floor menu ends with the floor delete',items.some(i=>/Padló törlése/.test(i.label)));
  ok('hitTest floors routes to the room menu',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /h\.t==='floors'\)\{const rh0=/.test(src);})());

  // ---------- A3 behind-the-wall ----------
  w.__data.devices.push({type:'socket',ref:'D1',x:2000,y:-40,h:300,level:lvl,side:0});  // north face
  w.__data.devices.push({type:'socket',ref:'D2',x:2000,y:340,h:300,level:lvl,side:1});  // south face
  const faceState=()=>{w.draw();return [w.__data.devices[0].faceBack,w.__data.devices[1].faceBack];};
  w.__state.pitch=30;w.__state.flat=false;w.__state.style='plan';
  let seen=new Set();
  for(let rot=0;rot<360;rot+=15){w.__state.rot=rot;const f=faceState();seen.add(JSON.stringify(f));}
  ok('opposite faces disagree except when the wall is edge-on',(function(){let bad=0,angles=[];
    for(let rot=0;rot<360;rot+=15){w.__state.rot=rot;const f=faceState();if(f[0]===f[1]){bad++;angles.push(rot);}}
    return bad<=2&&angles.every(a=>a%90===45);})(),'agreements only at the two grazing angles');
  ok('no flicker: each face is stable over a sweep',(function(){
    let flips=0,prev=null;for(let rot=0;rot<360;rot+=5){w.__state.rot=rot;const f=faceState()[0];
      if(prev!==null&&f!==prev)flips++;prev=f;}
    return flips<=2;})(),'a face may flip at most twice per full turn');
  ok('both states occur across a full turn',seen.size>=2,'variants='+seen.size);
  // a second wall in front must also hide a device (one blocker is enough)
  WA.push({x0:0,y0:1000,x1:4000,y1:1300});
  w.__data.devices.push({type:'socket',ref:'D3',x:2000,y:2000,h:300,level:lvl,side:0});
  ok('a wall standing in front hides the device',(function(){
    let hidden=0;for(let rot=0;rot<360;rot+=15){w.__state.rot=rot;w.draw();if(w.__data.devices[2].faceBack)hidden++;}
    return hidden>0;})());
  ok('a wall too low to reach the device stops hiding it',(function(){
    const only=WA.splice(0,1);                       // leave just the wall standing in front
    let full=0;for(let rot=0;rot<360;rot+=15){w.__state.rot=rot;w.draw();if(w.__data.devices[2].faceBack)full++;}
    WA[0].h=100;                                     // knee-high, device sits at 300
    let low=0;for(let rot=0;rot<360;rot+=15){w.__state.rot=rot;w.draw();if(w.__data.devices[2].faceBack)low++;}
    delete WA[0].h;WA.unshift(only[0]);
    return full>0&&low===0;})());
  WA.length=1;w.__data.devices.length=0;w.__state.rot=0;

  // ---------- A4 raised things are visible from above ----------
  w.__state.pitch=90;w.__state.flat=true;
  w.draw();const flat0=$('stage').innerHTML;
  WA[0].z0=900;w.__data.floors[0].z=150;w.draw();const flat1=$('stage').innerHTML;
  ok('2D marks a raised wall and a podium',flat1!==flat0&&/↑900/.test(flat1)&&/dobogó/.test(flat1));
  ok('the badge disappears when they sit on the floor',(function(){delete WA[0].z0;delete w.__data.floors[0].z;
    w.draw();return !/↑900/.test($('stage').innerHTML);})());
  WA[0].z0=900;
  ok('3D still moves the geometry',(function(){w.__state.pitch=30;w.__state.flat=false;
    w.draw();const a=$('stage').innerHTML;delete WA[0].z0;w.draw();const b=$('stage').innerHTML;
    WA[0].z0=900;return a!==b;})());
  delete WA[0].z0;

  // ---------- A5 fullscreen ----------
  w.openWallView(WA[0],lvl);
  const small=w.wallElevationSVG(w.wallElevationData(WA[0],lvl),false,true);
  w.__WV().full=true;
  const big=w.wallElevationSVG(w.wallElevationData(WA[0],lvl),false,true);
  ok('fullscreen enlarges the sheet',big.sc>small.sc*1.2,small.sc.toFixed(3)+'→'+big.sc.toFixed(3));
  w.renderWallView();
  ok('modal gets the full class',w.document.getElementById('modal').classList.contains('full'));
  ok('full css lifts the width cap',/#modal\.full\{max-width:100vw!important/.test(fs.readFileSync(HTML,'utf8')));
  w.__WV().full=false;w.renderWallView();
  ok('leaving fullscreen drops the class',!w.document.getElementById('modal').classList.contains('full'));

  // ---------- rail ----------
  ok('rail rendered in the wall editor',!!$('edRail'));
  ok('rail has buttons',$('edRail').querySelectorAll('.edRailB').length>=6,''+$('edRail').querySelectorAll('.edRailB').length);
  ok('rail shows the create block when nothing is selected',/Létrehozás/.test($('edRail').innerHTML)&&/Nincs kijelölve/.test($('edRail').innerHTML));
  w.__data.devices.push({type:'socket',ref:'D9',x:1000,y:-40,h:300,level:lvl,side:0});
  w.__WV().sel={kind:'dev',di:0};w.renderWallView();
  ok('selecting a device fills the rail with its actions',/Készülék — D9/.test($('edRail').innerHTML)
     &&/Készülék meghatározása/.test($('edRail').innerHTML)&&/Törlés/.test($('edRail').innerHTML));
  ok('rail buttons are wired',(function(){const b=$('edRail').querySelector('.edRailB');
    return typeof b.onclick==='function';})());
  ok('menu builders are shared with the rail',typeof w.wvDeviceItems==='function'&&typeof w.wvSectionItems==='function'
     &&typeof w.wvCreateItems==='function'&&typeof w.noteItems==='function'&&typeof w.pvCreateItems==='function');
  ok('right-click still works via the builders',(function(){let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it;};
    w.wvDeviceMenu({},0);w.ctxMenu=old;return cap&&cap.length>=5;})());
  ok('other-side button present',!!$('wvOther'));
  ok('other-side flips both side and mirror',(function(){const a=w.__WV().flipSide,b=w.__WV().mirror;
    $('wvOther').onclick();const c=w.__WV().flipSide,d=w.__WV().mirror;return c!==a&&d!==b;})());
  w.wvCloseEditor(true);
  // plane editor rail
  w.openPlaneView({name:'Nappali',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]},lvl,'floor');
  ok('rail rendered in the plane editor',!!$('edRail')&&/Létrehozás/.test($('edRail').innerHTML));
  w.wvCloseEditor(true);

  // ---------- B2 single-axis resize ----------
  w.__data.objects.length=0;
  w.__data.objects.push({level:lvl,x:1000,y:1000,z:0,w:800,d:600,ht:700,ang:0,name:'Szekrény'});
  const g=w.gizmoSvg({t:'objects',i:0,level:lvl});
  ok('four resize handles',(g.match(/data-ax="rs"/g)||[]).length===4);
  ok('two width + two depth handles',(g.match(/data-rd="w"/g)||[]).length===2&&(g.match(/data-rd="d"/g)||[]).length===2);
  ok('single-axis cursors',/cursor:ew-resize/.test(g)&&/cursor:ns-resize/.test(g)&&!/nwse-resize/.test(g));
  ok('handles sit on the edge midpoints, not corners',(function(){
    return /data-cx="-1" data-cy="0"/.test(g)&&/data-cx="0" data-cy="1"/.test(g);})());

  // ---------- B3 palette badge on the height display ----------
  ok('palette size helper',w.placeItemSize({id:'kd80',mk:()=>({type:'junction',jbSize:80})})===80
     &&w.placeItemSize({id:'box',mk:()=>({type:'box'})})===68);
  const badge=w.paletteBadge(0,0,{id:'box',n:'Szerelvénydoboz (üres, ⌀68)',mk:()=>({type:'box'})});
  ok('badge has a grey square and the name',/<rect/.test(badge)&&/68 mm/.test(badge)&&/Szerelvénydoboz/.test(badge));
  ok('badge strips the catalogue ref from the label',!/\[/.test(w.paletteBadge(0,0,{id:'k_107',n:'Kapcsoló 107 — kereszt  [752007]',mk:()=>({type:'switch',kind:'107'})})));
  ok('height display includes it in path mode',(function(){w.__state.mode='path';w.__state.hDisp='hover';
    w.__setCursor({x:1000,y:100,level:lvl,h:1100});w.draw();
    const svg=$('stage').innerHTML;w.__state.mode='select';return /␣/.test(svg);})());

  // ---------- B4 openings locked to the centreline ----------
  ok('centreline helper exists',typeof w.openingOnCentreline==='function');
  ok('a point off the face is pulled to the centreline',(function(){
    const c=w.openingOnCentreline({x:2000,y:20},lvl);return Math.abs(c.y-150)<1;})(),JSON.stringify(w.openingOnCentreline({x:2000,y:20},lvl)));
  ok('a far point is left alone',(function(){const c=w.openingOnCentreline({x:2000,y:5000},lvl);
    return c.y===5000;})());

  // ---------- A6/A7 keyboard ----------
  ok('input release helper',typeof w.releaseInputs==='function');
  ok('number inputs blur on Enter',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /if\(ev\.key==='Enter'\)\{ev\.preventDefault\(\);inp\.blur\(\)/.test(src);})());
  ok('fine mode has an F alias and preventDefault',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /e\.key==='Alt'\|\|e\.key==='f'\|\|e\.key==='F'/.test(src)&&/e\.preventDefault\(\);\s*\/\/ stops Alt/.test(src);})());
  ok('fine lock button + toggle',typeof w.fineToggle==='function'&&!!$('fineBtn'));
  ok('lock keeps fine mode after keyup',(function(){w.fineToggle();const on=w.fineStep(10)===1;
    w.fineToggle();return on&&w.fineStep(10)===10;})());
  ok('typing in a field does not arm fine mode',(function(){const src=fs.readFileSync(HTML,'utf8');
    return /tag==='INPUT'\|\|tag==='TEXTAREA'\|\|tag==='SELECT'\)return;/.test(src);})());

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: editors open+close',(function(){try{w.openWallView(WA[0],lvl);w.wvCloseEditor(true);
    w.openPlaneView({name:'X',poly:[[0,0],[3000,0],[3000,3000],[0,3000]]},lvl,'ceiling');w.wvCloseEditor(true);return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: blueprint',(function(){try{w.__state.style='blueprint';w.__state.pitch=90;const q=w.drawBlueprintGeom();
    w.__state.style='plan';w.__state.pitch=30;return q.length>50;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: session save',(function(){const so=w.sessionObj();return !!so.data&&!!so.DROPC;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},700);
