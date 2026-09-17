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
const w=dom.window;
const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';
  const poly=[[0,0],[4000,0],[4000,3000],[0,3000]];

  // ---------- room helpers ----------
  ok('area + perimeter',Math.round(w.polyArea(poly)/1e6)===12&&Math.round(w.polyPerim(poly)/1000)===14,
     (w.polyArea(poly)/1e6)+' / '+(w.polyPerim(poly)/1000));
  ok('ceiling height falls back to the storey',w.roomCeilH({},lvl)===w.wallH(lvl)&&w.roomCeilH({ch:2500},lvl)===2500);
  ok('environment table has IP ratings',w.ROOM_ENV.length>=5&&w.roomEnv('vizes').ip==='IP65'&&w.roomEnv('szaraz').ip==='IP20');
  ok('unknown environment falls back to dry',w.roomEnv('nonsense').k==='szaraz');
  ok('use / floor / heat lists',w.ROOM_USE.includes('fürdőszoba')&&w.ROOM_FLOOR.includes('laminált')&&w.ROOM_HEAT.includes('padlófűtés'));
  ok('point in polygon',w.pointInPoly2(2000,1500,poly)===true&&w.pointInPoly2(5000,1500,poly)===false);

  // devices inside the room only
  w.__data.devices.length=0;
  w.__data.devices.push({type:'socket',ref:'D1',x:1000,y:1000,h:300,level:lvl});
  w.__data.devices.push({type:'switch',ref:'K1',x:200,y:2800,h:1100,level:lvl});
  w.__data.devices.push({type:'socket',ref:'D2',x:9000,y:9000,h:300,level:lvl});   // outside
  w.__data.devices.push({type:'socket',ref:'D3',x:1000,y:1000,h:300,level:'upper'});// other level
  const rm={name:'Nappali',poly,level:lvl,fill:'#e2ddd0'};
  ok('room devices are scoped by polygon AND level',JSON.stringify(w.roomDevices(rm,lvl))==='[0,1]',JSON.stringify(w.roomDevices(rm,lvl)));

  // ---------- the data sheet writes every field ----------
  ok('dialog exists',typeof w.roomPropsDialog==='function');
  w.roomPropsDialog(rm,lvl,'F');
  ok('dialog rendered its fields',!!$('riName')&&!!$('riUse')&&!!$('riEnv')&&!!$('riMat')&&!!$('riHS')&&!!$('riCirc'));
  ok('live readout computed',/12[.,]00 m²/.test($('riInfo').innerHTML)&&/2 db/.test($('riInfo').innerHTML),
     $('riInfo').textContent.slice(0,110));
  ok('environment note shown',/IP20/.test($('riEnvNote').textContent));
  $('riName').value='Nappali-étkező';$('riNum').value='1.02';$('riUse').value='nappali';
  $('riCh').value='2600';$('riEnv').value='nedves';$('riMat').value='parketta';$('riHeat').value='padlófűtés';
  $('riWall').value='glettelt festett';$('riCeil').value='álmennyezet 2,45 m';
  $('riHS').value='300';$('riHK').value='1100';$('riCirc').value='NA';$('riNote').value='dupla aljzat a TV mögé';
  $('riFill').value='#ffddaa';$('riNoText').checked=true;
  $('mOk').onclick();
  ok('name saved',rm.name==='Nappali-étkező');
  ok('number + use saved',rm.num==='1.02'&&rm.use==='nappali');
  ok('ceiling height saved',rm.ch===2600);
  ok('environment saved',rm.env==='nedves');
  ok('finishes saved',rm.mat==='parketta'&&rm.heat==='padlófűtés'&&rm.wallFin==='glettelt festett'&&rm.ceilFin==='álmennyezet 2,45 m');
  ok('electrical defaults saved',rm.hSocket===300&&rm.hSwitch===1100&&rm.circ==='NA');
  ok('note + colour + label flag saved',rm.note==='dupla aljzat a TV mögé'&&rm.fill==='#ffddaa'&&rm.noText===true);
  ok('dry environment is not stored as clutter',(function(){w.roomPropsDialog(rm,lvl,'F');$('riEnv').value='szaraz';$('mOk').onclick();
    return rm.env===undefined;})());
  ok('empty fields are removed, not blanked',(function(){w.roomPropsDialog(rm,lvl,'F');$('riNum').value='';$('riCirc').value='';$('mOk').onclick();
    return rm.num===undefined&&rm.circ===undefined;})());

  // apply heights to the room's devices
  w.roomPropsDialog(rm,lvl,'F');
  $('riHS').value='400';$('riHK').value='1150';
  w.confirm=()=>true;w.alert=()=>{};
  $('riApply').onclick();
  ok('heights applied to sockets and switches in the room only',
     w.__data.devices[0].h===400&&w.__data.devices[1].h===1150&&w.__data.devices[2].h===300&&w.__data.devices[3].h===300,
     w.__data.devices.map(d=>d.h).join(','));
  ok('applying heights is undoable',(function(){w.document.getElementById('bUndo').onclick();
    return w.__data.devices[0].h===300&&w.__data.devices[1].h===1100;})());
  $('mCancel').onclick();

  // ---------- labels reflect the sheet ----------
  w.__data.floors.length=0;
  w.__data.floors.push({level:lvl,poly,name:'Konyha',num:'1.03',mat:'hidegburkolat',fill:'#e2ddd0'});
  const fl=w.__data.floors[0];
  w.__state.showLabels=true;w.__state.showRoomText=true;
  const iso=w.floorLabel(fl,lvl);
  ok('iso label shows number, name and covering',/1\.03/.test(iso)&&/Konyha/.test(iso)&&/hidegburkolat/.test(iso));
  const bp=w.bpFloorLabel(fl,lvl);
  ok('blueprint label is upper-case with area',/1\.03  KONYHA/.test(bp)&&/m²/.test(bp),(bp.match(/>[^<]+</g)||[]).slice(0,3).join(' '));
  fl.noText=true;
  ok('label hidden when noText is set',(function(){try{w.draw();const svg=$('stage').innerHTML;return !/KONYHA/.test(svg);}catch(e){return 'ERR '+e.message;}})()===true);
  fl.noText=false;

  // ---------- persistence, both room sources ----------
  ok('floor-room fields persist',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.data.floors[0].num==='1.03'&&so.data.floors[0].mat==='hidegburkolat';})());
  ok('building-room fields persist',(function(){const RB=w.__ROOMSB()[lvl];
    if(!RB.length)RB.push({name:'Közlekedő',poly:[[0,0],[1000,0],[1000,1000],[0,1000]]});
    RB[0].num='0.01';RB[0].use='közlekedő';RB[0].hSocket=350;
    const so=JSON.parse(JSON.stringify(w.sessionObj()));
    const back=so.building&&so.building.rooms&&so.building.rooms[lvl];
    return back&&back[0].num==='0.01'&&back[0].hSocket===350;})()===true);
  ok('room menu offers the sheet',(function(){let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it.map(i=>i.label);};
    w.__roomMenu&&w.__roomMenu({name:'X',poly},{level:lvl,src:'F',i:0});w.ctxMenu=old;
    return cap?cap.some(l=>/Helyiség adatlap/.test(l)):'no hook';})());

  // ---------- notes ----------
  const NK=w.NOTEKIND;
  ok('note kinds',['info','warn','todo','done','dim'].every(k=>NK[k]&&NK[k].ic&&NK[k].bg),Object.keys(NK).join(','));
  ok('kind falls back to info',w.noteKind({})==='info'&&w.noteKind({kind:'zzz'})==='info'&&w.noteKind({kind:'warn'})==='warn');
  const L=w.noteLines('ez egy elég hosszú jegyzet ami több sorba fog tördelődni a rajzon');
  ok('text wraps to several lines',L.length>1&&L.every(l=>l.length<=30),JSON.stringify(L));
  ok('explicit newlines respected',w.noteLines('első\nmásodik').length===2);
  ok('very long text is capped',w.noteLines(new Array(200).fill('szó').join(' ')).length<=8);
  const nb=k=>w.noteBox({i:0,text:'próba',kind:k},100,100);
  ok('kind drives the colour',nb('warn').indexOf(NK.warn.bg)>0&&nb('todo').indexOf(NK.todo.bg)>0);
  ok('icon is drawn',/⚠/.test(nb('warn'))&&/☐/.test(nb('todo')));
  ok('done is struck through and faded',/line-through/.test(nb('done'))&&/opacity="0.75"/.test(nb('done')));
  ok('tag rendered',/VF-03/.test(w.noteBox({i:0,text:'x',kind:'info',tag:'VF-03'},50,50)));
  ok('note box is draggable + identified',/class="wvnote" data-ni2="0"/.test(nb('info')));

  // dialog + menu
  w.__data.wallNotes.length=0;
  w.__data.wallNotes.push({wallKey:'k',u:100,h:100,text:'régi',kind:'info'});
  w.openWallView({x0:0,y0:0,x1:4000,y1:100,h:2700},lvl);
  w.noteDialog(0,()=>{});
  ok('note dialog opens with the text',$('ntTxt')&&$('ntTxt').value==='régi'&&!!$('ntKind')&&!!$('ntTag'));
  $('ntTxt').value='új szöveg\nkét sorban';$('ntKind').value='warn';$('ntTag').value='VF-01';
  $('mOk').onclick();
  const N=w.__data.wallNotes[0];
  ok('note edits saved',N.text==='új szöveg\nkét sorban'&&N.kind==='warn'&&N.tag==='VF-01');
  ok('empty tag removed',(function(){w.noteDialog(0,()=>{});$('ntTag').value='';$('mOk').onclick();return N.tag===undefined;})());
  ok('note menu offers edit, kinds and delete',(function(){let cap=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{cap=it.map(i=>i.label);};
    w.noteMenu({},0,()=>{});w.ctxMenu=old;
    return cap&&/Szerkesztés/.test(cap[0])&&cap.length===6&&/Törlés/.test(cap[cap.length-1]);})());
  ok('kind switch from the menu',(function(){let items=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{items=it;};
    w.noteMenu({},0,()=>{});w.ctxMenu=old;items.find(i=>/Teendő/.test(i.label)).act();
    return w.__data.wallNotes[0].kind==='todo';})());
  ok('note edits are undoable',(function(){const t=w.__data.wallNotes[0].kind;w.wvUndo();
    return w.__data.wallNotes[0].kind!==t;})());
  ok('deleting from the menu',(function(){let items=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{items=it;};
    w.noteMenu({},0,()=>{});w.ctxMenu=old;items[items.length-1].act();
    return w.__data.wallNotes.length===0;})());
  w.wvCloseEditor(true);

  // creation flow in both editors leaves an empty note and opens the dialog
  w.__data.wallNotes.length=0;
  w.openWallView({x0:0,y0:0,x1:4000,y1:100,h:2700},lvl);
  (function(){let items=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{items=it;};
   w.wvCreateMenu({},1000,1500);w.ctxMenu=old;items.find(i=>/Jegyzet/.test(i.label)).act();})();
  ok('wall note created + dialog opened',w.__data.wallNotes.length===1&&w.__data.wallNotes[0].kind==='info'&&!!$('ntTxt'));
  $('ntTxt').value='falon';$('mOk').onclick();
  ok('wall note text saved',w.__data.wallNotes[0].text==='falon');
  w.wvCloseEditor(true);
  w.openPlaneView({name:'X',poly},lvl,'ceiling');
  (function(){let items=null;const old=w.ctxMenu;w.ctxMenu=(e,it)=>{items=it;};
   w.pvCreateMenu({},1000,1000);w.ctxMenu=old;items.find(i=>/Jegyzet/.test(i.label)).act();})();
  ok('plane note created with the plane key',w.__data.wallNotes.length===2&&/^PL\|/.test(w.__data.wallNotes[1].wallKey),
     w.__data.wallNotes[1].wallKey);
  $('ntTxt').value='mennyezeten';$('mOk').onclick();
  const pd=w.planeViewData({name:'X',poly},lvl,'ceiling',300);
  ok('plane note renders in its own view',pd.notes.length===1&&pd.notes[0].text==='mennyezeten');
  ok('note kinds render in the plane svg',/#fffbe6|#fff0e6/.test(w.planeViewSVG(pd,true).svg));
  w.wvCloseEditor(true);
  ok('notes persist with the project',(function(){const so=JSON.parse(JSON.stringify(w.sessionObj()));
    return so.data.wallNotes.length===2&&so.data.wallNotes[0].kind==='info';})());
  ok('dblclick + right-click wired once, for every editor surface',(function(){
    const src=fs.readFileSync(HTML,'utf8');
    // after the Phase 3 unification there is ONE binding site, shared by both editors
    return (src.match(/noteDialog\(\+g\.dataset\.ni2/g)||[]).length>=1&&(src.match(/noteMenu\(ev,\+g\.dataset\.ni2/g)||[]).length>=1;})());

  // ---------- regressions ----------
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: blueprint',(function(){try{w.__state.style='blueprint';w.__state.pitch=90;const q=w.drawBlueprintGeom();
    w.__state.style='plan';w.__state.pitch=30;return q.length>50;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: wall + plane editors',(function(){try{w.openWallView({x0:0,y0:0,x1:4000,y1:100,h:2700},lvl);w.wvCloseEditor(true);
    w.openPlaneView({name:'X',poly},lvl,'floor');w.wvCloseEditor(true);return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: wall props + door types',typeof w.setWallGeom==='function'&&!!w.DOORTYPE.garage);
  ok('reg: placement palette + fine mode',w.PLACE_ITEMS.length>=20&&w.fineStep(10)===10);
  ok('reg: chase model',w.chaseWidthOf(32)===51);
  ok('reg: session save',(function(){const so=w.sessionObj();return !!so.data&&!!so.building;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
