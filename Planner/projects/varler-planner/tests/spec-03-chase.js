const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}

const HTML=findPlanner();
const html=fs.readFileSync(HTML,'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
  const R=[];const ok=(n,c,x)=>{R.push([n,!!c,x||'']);};
  try{
    // ---- build a synthetic wall with a horizontal run, a vertical drop, and two device boxes ----
    const wall={x0:0,y0:0,x1:4000,y1:100,h:2700};
    w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;w.__data.wallNotes=[];
    const lvl='ground';
    w.__data.devices.push({type:'socket',ref:'D1',x:1000,y:50,h:300,level:lvl});
    w.__data.devices.push({type:'socket',ref:'D2',x:2500,y:50,h:300,level:lvl});
    w.__data.paths.push({nodes:[{x:1000,y:50,h:300,level:lvl},{x:2500,y:50,h:300,level:lvl},{x:2500,y:50,h:1100,level:lvl}],
      sections:[{build:'sull_gege',circuit:null},{build:'sull_gege',circuit:null}]});
    w.openWallView(wall,lvl);const WV=w.__WV();WV.dims=true;WV.far=false;
    let d=w.wallElevationData(wall,lvl);
    ok('data: 2 secs + 2 devs', d.secs.length===2&&d.devs.length===2, 'secs='+d.secs.length+' devs='+d.devs.length);

    // diameter defaults / overrides
    ok('default dia 20', w.chaseDia('sull_gege',{})===20);
    ok('override dia 32', w.chaseDia('sull_gege',{dia:32})===32);
    ok('depth auto 30 for 20', w.chaseDepthOf({},20)===30);
    ok('depth auto 30 for 25', w.chaseDepthOf({},25)===30);
    ok('depth auto 35 for 32', w.chaseDepthOf({},32)===35);
    ok('depth override', w.chaseDepthOf({cd:35},20)===35);
    ok('width = dia*factor', w.chaseWidthOf(20)===32&&w.chaseWidthOf(32)===51, w.chaseWidthOf(20)+'/'+w.chaseWidthOf(25)+'/'+w.chaseWidthOf(32));

    // ---- vertical vs horizontal use the SAME factor (only diameter differs) ----
    const out=w.wallElevationSVG(d,false,true);
    const sc=out.sc, X=u=>+(out.M+(out.len-u)*sc).toFixed(1), Y=v=>+(out.M+(out.H-v)*sc).toFixed(1);
    const shapes=w.wvChaseShapes(d,X,Y,sc);
    const paths=shapes.filter(s=>s.kind==='path'),boxes=shapes.filter(s=>s.kind==='box');
    ok('shapes: 2 path + 2 box', paths.length===2&&boxes.length===2, 'p='+paths.length+' b='+boxes.length);
    ok('horiz + vert same width', paths[0].w===paths[1].w, paths[0].w+' vs '+paths[1].w);
    // set the vertical drop to 32mm → its width grows, horizontal unchanged
    w.__data.paths[0].sections[1].dia=32;
    d=w.wallElevationData(wall,lvl);
    const sh2=w.wvChaseShapes(d,X,Y,sc).filter(s=>s.kind==='path');
    ok('dia drives width', sh2[0].w===32&&sh2[1].w===51, sh2[0].w+' / '+sh2[1].w);
    ok('dia drives depth', sh2[0].dep===30&&sh2[1].dep===35, sh2[0].dep+' / '+sh2[1].dep);
    w.__data.paths[0].sections[1].dia=undefined;delete w.__data.paths[0].sections[1].dia;

    // ---- merged rendering ----
    d=w.wallElevationData(wall,lvl);
    const svg=w.wallElevationSVG(d,false,true).svg;
    ok('single clipPath element', (svg.match(/<clipPath id="cutclip"/g)||[]).length===1);
    ok('one hatch fill rect', (svg.match(/class="cutfill"/g)||[]).length===1);
    ok('clip has all 4 polys', (svg.split('<clipPath')[1].split('</clipPath>')[0].match(/<polygon/g)||[]).length===4);
    const edges=(svg.match(/class="cutedge"/g)||[]).length;
    ok('union outline drawn', edges>4, edges+' segments');
    // no per-shape polygon fills outside the mask any more
    ok('no separate hatch polygons', (svg.match(/url\(#chaseh\)/g)||[]).length===1);

    // ---- outline really removes interior seams: a lone box vs a box overlapped by a run ----
    const sq=[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
    const solo=w.chaseOutline([{poly:sq,bb:[0,0,100,100]}]);
    const totalSolo=solo.reduce((a,g)=>a+Math.hypot(g[2]-g[0],g[3]-g[1]),0);
    const sq2=[{x:50,y:20},{x:200,y:20},{x:200,y:80},{x:50,y:80}];
    const bb2=[50,20,200,80];
    const pair=w.chaseOutline([{poly:sq,bb:[0,0,100,100]},{poly:sq2,bb:bb2}]);
    const totalPair=pair.reduce((a,g)=>a+Math.hypot(g[2]-g[0],g[3]-g[1]),0);
    const sumIndiv=400+2*(150+60);
    ok('overlap outline shorter than sum', totalPair<sumIndiv-100, totalPair.toFixed(0)+' vs '+sumIndiv);
    ok('solo outline ~ perimeter', Math.abs(totalSolo-400)<6, totalSolo.toFixed(1));

    // ---- labels + summary ----
    ok('chase labels', svg.indexOf('class="cutlbl"')>0 && /⌀20 · 32×30/.test(svg));
    ok('summary line', /class="cutsum"/.test(svg) && /Véset \(szél\.×mély\.\)/.test(svg), (svg.match(/Véset \(szél[^<]*/)||[''])[0].slice(0,120));
    const sum=w.chaseSummary(w.wvChaseShapes(d,X,Y,sc));
    ok('summary metres', Math.abs(sum.grp['32×30']-2300)<2, JSON.stringify(sum.grp)+' '+JSON.stringify(sum.pk));
    ok('summary pockets', sum.pk['72×45']===2, JSON.stringify(sum.pk));

    // labels toggle off
    WV.layers.cutLabels=false;
    ok('label toggle', w.wallElevationSVG(d,false,true).svg.indexOf('class="cutlbl"')<0);
    WV.layers.cutLabels=true;
    // cuts layer off removes everything
    WV.layers.cuts=false;
    const noCut=w.wallElevationSVG(d,false,true).svg;
    ok('cuts layer off', noCut.indexOf('cutclip')<0&&noCut.indexOf('cutsum')<0);
    WV.layers.cuts=true;

    // pad / box depth settings
    w.__state.chasePad=10;w.__state.boxDepth=60;
    const sh3=w.wvChaseShapes(d,X,Y,sc).filter(s=>s.kind==='box');
    ok('pad + box depth settings', sh3[0].w===78&&sh3[0].dep===60, sh3[0].w+'/'+sh3[0].dep);
    w.__state.chasePad=4;w.__state.boxDepth=45;

    // ---- section right-click menu exists + writes sec.dia ----
    ok('wvSectionMenu fn', typeof w.wvSectionMenu==='function');
    ok('wvDistSeg', Math.abs(w.wvDistSeg(0,0,0,10,10,10)-10)<0.01);
    w.__data.paths[0].sections[0].dia=25;
    const d4=w.wallElevationData(wall,lvl);
    ok('sec.dia reaches elevation data', d4.secs[0].dia===25, ''+d4.secs[0].dia);
    ok('25mm → width 40 depth 30', w.chaseWidthOf(25)===40&&w.chaseDepthOf(d4.secs[0],25)===30);
    delete w.__data.paths[0].sections[0].dia;

    // ---- persistence of per-section dia/cd ----
    w.__data.paths[0].sections[0].dia=32;w.__data.paths[0].sections[0].cd=35;
    const so=JSON.parse(JSON.stringify(w.sessionObj()));
    ok('dia/cd persist in session', so.data.paths[0].sections[0].dia===32&&so.data.paths[0].sections[0].cd===35);
    ok('chasePad/boxDepth in state', so.state.chasePad===4&&so.state.boxDepth===45);
    delete w.__data.paths[0].sections[0].dia;delete w.__data.paths[0].sections[0].cd;

    // ---- regressions ----
    ok('reg: pathDia alias', w.pathDia('kv_csat_szeles')===32);
    ok('reg: devices catalog', w.deviceCat('valena_socket_2p').cikk==='753120');
    ok('reg: clip spacing', typeof w.wvDoClip==='function'&&typeof w.clipGroupOf==='function');
    ok('reg: guides/heights', typeof w.stepHeight==='function'&&Array.isArray(w.__guides())&&w.__guides().length>0);
    ok('reg: board rect', typeof w.pointInBoard==='function'&&typeof w.boardAnchor==='function'&&typeof w.ensureBoardObject==='function');
    ok('reg: wv mirror', typeof w.wallElevationSVG==='function');
    ok('reg: blueprint', typeof w.drawBlueprintGeom==='function'&&typeof w.drawBlueprintPlan==='function');
    ok('reg: switch report', typeof w.switchReportData==='function');
    ok('reg: notes still collected', (function(){w.__data.wallNotes.push({wallKey:w.wallKey(wall,lvl),u:500,h:1500,text:'x'});
      const dd=w.wallElevationData(wall,lvl);return dd.notes.length===1;})());
    ok('reg: draw() runs', (function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
  }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,3).join(' | ')]);}
  let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
  console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
