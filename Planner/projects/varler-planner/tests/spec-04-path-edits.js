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
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const wall={x0:0,y0:0,x1:4000,y1:100,h:2700},lvl='ground';
  const reset=()=>{w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;w.__data.wallNotes=[];
    w.__data.paths.push({nodes:[{x:500,y:50,h:300,level:lvl},{x:2000,y:50,h:300,level:lvl},{x:2000,y:50,h:1100,level:lvl}],
      sections:[{build:'sull_gege',circuit:{name:'A',num:1,count:3}},{build:'sull_gege',dia:32,cd:35}],type:'gege',color:'#00aa00'});};
  reset();
  w.openWallView(wall,lvl);const WV=w.__WV();WV.dims=true;
  let d=w.wallElevationData(wall,lvl);

  // ---------- grab lines + node ordering ----------
  let svg=w.wallElevationSVG(d,false,true).svg;
  ok('grab lines for each near section',(svg.match(/class="wvseg"/g)||[]).length===2);
  ok('grab lines carry pi/na/nb',/class="wvseg" data-pi="0" data-na="0" data-nb="1"/.test(svg));
  ok('nodes drawn AFTER all lines',svg.lastIndexOf('class="wvseg"')<svg.indexOf('class="wvnode"'));
  ok('grab line is hit-testable but invisible',/stroke="transparent" stroke-width="14"[^>]*pointer-events="stroke"/.test(svg));

  // ---------- whole-section move ----------
  const uh=n=>w.wvNodeUH(n);
  ok('wvNodeUH along wall',Math.abs(uh({x:500,y:50,h:300}).u-500)<0.01&&uh({x:500,y:50,h:300}).h===300);
  const pa=w.__data.paths[0];
  const oa=uh(pa.nodes[0]),ob=uh(pa.nodes[1]);
  // simulate: drag section 0 by +300mm along the wall, +200mm up
  w.wvSetNode(0,0,oa.u+300,oa.h+200);w.wvSetNode(0,1,ob.u+300,ob.h+200);
  ok('section move: both ends shift equally',pa.nodes[0].x===800&&pa.nodes[1].x===2300&&pa.nodes[0].h===500&&pa.nodes[1].h===500,
     pa.nodes[0].x+','+pa.nodes[1].x+' h'+pa.nodes[0].h);
  ok('neighbour section follows shared node',pa.nodes[2].x===2000&&pa.nodes[1].x===2300,'the vertical leg now leans (shared node moved)');
  reset();

  // ---------- duplicate beside ----------
  d=w.wallElevationData(wall,lvl);
  let pi2=w.wvDuplicateBeside(0,0,'fel',100,false);
  ok('duplicate: new path appended',pi2===1&&w.__data.paths.length===2);
  let np=w.__data.paths[1];
  ok('duplicate section only = 2 nodes',np.nodes.length===2&&np.sections.length===1,'n='+np.nodes.length);
  ok('offset up by 100mm',np.nodes[0].h===400&&np.nodes[1].h===400,np.nodes[0].h+'');
  ok('same u position',np.nodes[0].x===500&&np.nodes[1].x===2000);
  ok('conduit copied, circuit NOT',np.sections[0].build==='sull_gege'&&np.sections[0].circuit===null);
  ok('path colour/type carried',np.color==='#00aa00'&&np.type==='gege');
  // whole path + sideways
  pi2=w.wvDuplicateBeside(0,0,'balra',150,true);
  np=w.__data.paths[2];
  ok('duplicate whole path = 3 nodes',np.nodes.length===3&&np.sections.length===2,'n='+np.nodes.length);
  ok('mirror-aware sideways offset',np.nodes[0].x===650&&np.nodes[2].x===2150,np.nodes[0].x+','+np.nodes[2].x);
  ok('per-section dia/cd copied',np.sections[1].dia===32&&np.sections[1].cd===35);
  ok('heights unchanged sideways',np.nodes[0].h===300&&np.nodes[2].h===1100);
  // mirrored viewer flips left/right
  WV.mirror=true;
  const pi3=w.wvDuplicateBeside(0,0,'balra',150,false);
  ok('mirror flips the screen direction',w.__data.paths[pi3].nodes[0].x===350,''+w.__data.paths[pi3].nodes[0].x);
  WV.mirror=false;
  reset();

  // ---------- warp ----------
  d=w.wallElevationData(wall,lvl);
  const bb=w.wvWarpBox(d,0);
  ok('warp box spans all nodes',bb&&bb.u0===500&&bb.u1===2000&&bb.h0===300&&bb.h1===1100,JSON.stringify(bb&&{u0:bb.u0,u1:bb.u1,h0:bb.h0,h1:bb.h1}));
  ok('warp box dedupes shared nodes',bb.nodes.length===3,'n='+bb.nodes.length);
  ok('no warp box for a single node',w.wvWarpBox({secs:[]},0)===null);
  ok('no handles when warp off',w.wallElevationSVG(d,false,true).svg.indexOf('class="wvwarp"')<0);
  WV.warp={pi:0};
  svg=w.wallElevationSVG(d,false,true).svg;
  ok('8 warp handles',(svg.match(/class="wvwarp"/g)||[]).length===8,''+(svg.match(/class="wvwarp"/g)||[]).length);
  ok('warp box + hint drawn',/stroke-dasharray="5 3"/.test(svg)&&/WARP/.test(svg));
  ok('warped path nodes highlighted',/stroke="#e8641c" stroke-width="1.6"/.test(svg));
  // apply a horizontal stretch: drag the right-edge handle (hx=1,hy=0.5) from u=2000 to u=3500, anchor u0=500
  const anchorU=bb.u0,startU=bb.u1,sx=(3500-anchorU)/(startU-anchorU);
  bb.nodes.forEach(n=>w.wvSetNode(0,n.ni,anchorU+(n.u-anchorU)*sx,n.h));
  const P=w.__data.paths[0];
  ok('warp stretch: anchor node fixed',P.nodes[0].x===500,''+P.nodes[0].x);
  ok('warp stretch: far node scaled',P.nodes[1].x===3500&&P.nodes[2].x===3500,P.nodes[1].x+','+P.nodes[2].x);
  ok('warp stretch: heights untouched',P.nodes[0].h===300&&P.nodes[2].h===1100);
  // vertical stretch about the bottom
  const d2=w.wallElevationData(wall,lvl),b2=w.wvWarpBox(d2,0);
  const sy=(2200-b2.h0)/(b2.h1-b2.h0);
  b2.nodes.forEach(n=>w.wvSetNode(0,n.ni,n.u,b2.h0+(n.h-b2.h0)*sy));
  ok('warp vertical: bottom fixed, top scaled',P.nodes[0].h===300&&P.nodes[2].h===2200,P.nodes[0].h+','+P.nodes[2].h);
  ok('degenerate axis guarded',(function(){ // a purely horizontal path has zero height → sy must stay 1
    w.__data.paths.length=0;
    w.__data.paths.push({nodes:[{x:0,y:50,h:500,level:lvl},{x:1000,y:50,h:500,level:lvl}],sections:[{build:'sull_gege'}]});
    const dd=w.wallElevationData(wall,lvl),b3=w.wvWarpBox(dd,0);
    return Math.abs(b3.h1-b3.h0)<1;})());
  WV.warp=null;reset();

  // ---------- menu + wiring ----------
  ok('wvDuplicateDialog exists',typeof w.wvDuplicateDialog==='function');
  ok('wvDuplicateBeside exists',typeof w.wvDuplicateBeside==='function');
  ok('warp toggle in section menu',(function(){let cap=null;const old=w.ctxMenu;
    w.ctxMenu=(e,items)=>{cap=items.map(i=>i.label);};
    const dd=w.wallElevationData(wall,lvl);w.wvSectionMenu({},dd.secs[0]);w.ctxMenu=old;
    return cap&&cap.some(l=>/Warp/.test(l))&&cap.some(l=>/Másolat mellé/.test(l))&&cap.some(l=>/⌀ Cső átmérő/.test(l));})());
  ok('duplicate is undoable',(function(){const before=w.__data.paths.length;w.pushUndo();
    w.wvDuplicateBeside(0,0,'fel',100,false);const mid=w.__data.paths.length;w.document.getElementById('bUndo').onclick();
    return mid===before+1&&w.__data.paths.length===before;})());
  ok('new path persists in session',(function(){w.wvDuplicateBeside(0,0,'fel',100,false);
    const so=JSON.parse(JSON.stringify(w.sessionObj()));return so.data.paths.length===w.__data.paths.length;})());

  // ---------- step-3 + older regressions ----------
  reset();d=w.wallElevationData(wall,lvl);
  svg=w.wallElevationSVG(d,false,true).svg;
  ok('reg: chase still merged',(svg.match(/<clipPath id="cutclip"/g)||[]).length===1&&(svg.match(/url\(#chaseh\)/g)||[]).length===1);
  ok('reg: chase summary',/class="cutsum"/.test(svg));
  ok('reg: real-⌀ conduit stroke',/stroke-width="[0-9.]+" stroke-dasharray="6 3"/.test(svg));
  ok('reg: section menu ⌀',typeof w.wvSectionMenu==='function'&&w.chaseWidthOf(32)===51);
  ok('reg: device box render',typeof w.wvDevBox==='function'&&w.deviceCat('schneider_2socket').w===157);
  ok('reg: clip group',typeof w.wvDoClip==='function');
  ok('reg: notes',(function(){w.__data.wallNotes.push({wallKey:w.wallKey(wall,lvl),u:100,h:100,text:'n'});
    return w.wallElevationData(wall,lvl).notes.length===1;})());
  ok('reg: board rect',typeof w.pointInBoard==='function');
  ok('reg: guides',w.__guides().length>0&&typeof w.stepHeight==='function');
  ok('reg: blueprint',typeof w.drawBlueprintGeom==='function');
  ok('reg: switch report',typeof w.switchReportData==='function');
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  ok('reg: renderWallView()',(function(){try{w.renderWallView();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,3).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
