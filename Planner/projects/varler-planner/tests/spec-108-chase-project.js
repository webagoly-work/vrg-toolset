// Chase model in mm (O0) + project chase quantities (O1) — docs/research/2026-10-23_chase-sweep-cut-3d.md
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}

const html=fs.readFileSync(findPlanner(),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
  const R=[];const ok=(n,c,x)=>{R.push([n,!!c,x||'']);};
  try{
    const lvl='ground',WA=w.__getWalls()[lvl];WA.length=0;
    w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;w.__data.wallNotes=[];
    // wall A along x (centre y=50), wall B along y (centre x=50) — they meet at the origin corner
    const A={x0:0,y0:0,x1:4000,y1:100,h:2700},B={x0:0,y0:0,x1:100,y1:3000,h:2700};WA.push(A,B);
    w.__data.devices.push({type:'socket',ref:'D1',x:1000,y:50,h:300,level:lvl});
    w.__data.devices.push({type:'junction',ref:'KD1',x:3000,y:50,h:1100,level:lvl,jbSize:100});
    w.__data.devices.push({type:'socket',ref:'D2',x:2000,y:20,h:300,level:lvl});          // far face of A
    const S=b=>({build:b,circuit:null});
    w.__data.paths.push({nodes:[{x:1000,y:50,h:300,level:lvl},{x:3000,y:50,h:300,level:lvl},{x:3000,y:50,h:1100,level:lvl}],
      sections:[S('sull_gege'),S('sull_gege')]});
    // a drop right in the corner: within reach of BOTH walls, closer to A (sd 5 vs 20)
    w.__data.paths.push({nodes:[{x:70,y:55,h:300,level:lvl},{x:70,y:55,h:2400,level:lvl}],sections:[S('sull_gege')]});
    // a sunk floor run in the middle of the room: no wall claims it
    w.__data.paths.push({nodes:[{x:1500,y:1500,h:0,level:lvl},{x:2500,y:1500,h:0,level:lvl}],sections:[S('sull_gege')]});

    // ---- O0: the mm model agrees with the drawn shapes ----
    w.openWallView(A,lvl);const WV=w.__WV();WV.dims=true;WV.far=false;
    const d=w.wallElevationData(A,lvl);
    const out=w.wallElevationSVG(d,false,true),sc=out.sc;
    const X=u=>+(out.M+(out.len-u)*sc).toFixed(1),Y=v=>+(out.M+(out.H-v)*sc).toFixed(1);
    const M=w.chaseModel(d),P=w.wvChaseShapes(d,X,Y,sc);
    ok('model = shapes count', M.length===P.length, M.length+' vs '+P.length);
    ok('model = shapes w/dep/mm', M.every((c,i)=>c.w===P[i].w&&c.dep===P[i].dep&&Math.abs(c.mm-P[i].mm)<1e-9));
    ok('front only by default', !M.some(c=>c.back)&&w.chaseModel(d,true).some(c=>c.back));
    ok('same summary as drawing', JSON.stringify(w.chaseSummary(M))===JSON.stringify(w.chaseSummary(P)));
    w.wvCloseEditor(true);

    // ---- union: exact for axis-aligned items ----
    const it=(o)=>Object.assign({kind:'path',w:32,dep:30,mm:0},o);
    const H=it({u0:0,h0:300,u1:1000,h1:300}),V=it({u0:500,h0:0,u1:500,h1:600}),Bx={kind:'box',w:72,dep:45,u0:1000,h0:300,u1:1000,h1:300};
    const u1=w.chaseUnion([H,V]);
    ok('cross: area counted once', Math.abs(u1.area-52224)<1e-6, u1.area);
    const u2=w.chaseUnion([H,V,Bx]);
    ok('box pocket: deepest wins', Math.abs(u2.area-55744)<1e-6&&Math.abs(u2.vol-1750080)<1e-6, u2.area+' / '+u2.vol);
    const D=it({u0:0,h0:0,u1:1000,h1:1000}),ud=w.chaseUnion([D]),exact=(Math.SQRT2*1000+32)*32*30;
    ok('diagonal within 3 %', Math.abs(ud.vol-exact)/exact<0.03, (ud.vol/exact).toFixed(4));
    ok('empty union', w.chaseUnion([]).vol===0);

    // ---- O1: project quantities ----
    const raw=w.chaseModel(w.wallElevationData(B,lvl),true);
    ok('corner drop seen by wall B too', raw.some(c=>c.kind==='path'&&c.pi===1));
    const Pj=w.chaseProject();
    ok('corner drop counted once', Math.abs(Pj.grpSec['32×30']-(2000+800+2100))<1e-6, JSON.stringify(Pj.grpSec));
    // union metres: runs + square caps, minus what the D1 / KD1 pockets own (hand-computed: 2712 + 2132)
    ok('priced metres from the union', Math.abs(Pj.grp['32×30']-4844)<1e-6, JSON.stringify(Pj.grp));
    ok('pockets: both faces + KD', Pj.pk['72×45']===2&&Pj.pk['104×45']===1, JSON.stringify(Pj.pk));
    ok('floor run reported apart', Math.abs(Pj.off-1)<1e-9, Pj.off);
    let naive=0;Pj.walls.forEach(W=>W.items.forEach(c=>{naive+=c.kind==='box'?c.w*c.w*c.dep:(c.mm+c.w)*c.w*c.dep;}));
    ok('union volume ≤ naive sum', Pj.vol>0&&Pj.vol<naive, (Pj.vol/1e6).toFixed(2)+' l vs '+(naive/1e6).toFixed(2)+' l');
    ok('only walls with chases', Pj.walls.length===1&&Pj.walls[0].r===A);

    // ---- BOM rows ----
    const rows=w.computeBOM(),id=k=>rows.find(r=>r.id===k);
    ok('BOM chase metres', id('chase_32x30')&&id('chase_32x30').qty===4.8&&id('chase_32x30').unit==='m', JSON.stringify(id('chase_32x30')));
    ok('BOM pockets', id('chasebox_72x45').qty===2&&id('chasebox_104x45').qty===1);
    ok('BOM price sticks by id', (function(){w.__state.price.chase_32x30=4000;const t=w.bomJSON();delete w.__state.price.chase_32x30;
      return t.tetelek.some(x=>x.tetel==='Falvésés 32×30 mm'&&x.osszeg===19200);})());
    // a second layer's conduit on exactly the same line: the section sum doubles, the chase does not
    w.__data.paths.push({nodes:[{x:1000,y:50,h:300,level:lvl},{x:3000,y:50,h:300,level:lvl}],sections:[S('sull_gege')]});
    const Pc=w.chaseProject();
    ok('coincident run: sum grows', Math.abs(Pc.grpSec['32×30']-6900)<1e-6, Pc.grpSec['32×30']);
    ok('coincident run: chase does not', Math.abs(Pc.grp['32×30']-4844)<1e-6, Pc.grp['32×30']);
    w.__data.paths.pop();
    // a route on a hidden layer (an old sketch) is off: not chased, not even "off-wall"
    w.eval("layers.push({id:'Lhid',name:'Vázlat',visible:false,cats:layerCatsAll()})");
    w.__data.paths.push({layer:'Lhid',nodes:[{x:500,y:50,h:2500,level:lvl},{x:3500,y:50,h:2500,level:lvl}],sections:[S('sull_gege')]});
    w.__data.paths.push({layer:'Lhid',nodes:[{x:1000,y:2000,h:0,level:lvl},{x:3000,y:2000,h:0,level:lvl}],sections:[S('sull_gege')]});
    const Ph=w.chaseProject();
    ok('hidden layer not counted', Math.abs(Ph.grp['32×30']-4844)<1e-6&&Math.abs(Ph.off-1)<1e-9, Ph.grp['32×30']+' / off '+Ph.off);
    w.__data.paths.splice(-2,2);w.eval("layers=layers.filter(l=>l.id!=='Lhid')");

    // ---- report + action ----
    w.showChaseReport();const txt=w.document.body.textContent;
    ok('report opens', /Véset összesítő/.test(txt)&&/Falon kívül/.test(txt)&&/Összesen/.test(txt));
    ok('action registered', !!w.actionById('chase.report'));
  }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,3).join(' | ')]);}
  let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
  console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},600);
