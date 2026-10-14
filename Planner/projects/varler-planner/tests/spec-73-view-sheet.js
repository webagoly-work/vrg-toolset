// Views V4, slice 1: the sheet frame (title + legend) in the Planner — viewSheetSvg() in 06c-view-core.js.
//
// Fixture: the committed P33 v2 furnished plan (Calculator/P33-teszt_v2_butor.vplan.json).
// What must hold:
//   * the sheet is the frame tools/p33-axo.js drew before V4: same size, same legend rows, same
//     wall heights quoted, the drawing body embedded unchanged;
//   * the legend lists only the roles actually present (remove a system → its row goes);
//   * title text is escaped; the entrance marker comes from the `bejarat` mark tag;
//   * building a sheet changes neither the data nor the normal drawing.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','P33-teszt_v2_butor.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const st=w.__state;st.wallMode='translucent';w.draw();
  const before=JSON.stringify(w.__data),drawBefore=w.drawNormalGeom();

  const A=w.viewRender({yaw:225}),SA=w.viewSheetSvg(A,{title:'P33'});
  ok('sheet 1697 × 1372 (drawing + 2×70 margin + 270 legend, +40 title)',SA.W===1697&&SA.H===1372,SA.W+'x'+SA.H);
  ok('the svg declares that size',SA.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" class="vw" width="1697" height="1372" viewBox="0 0 1697 1372">'));
  ok('the drawing body is embedded unchanged',SA.svg.includes('stroke-linejoin="round">'+A.body+'</g>'));
  ok('title: P33 · FÖLDSZINT',SA.svg.includes('<text class="t1" x="0" y="0">P33 · FÖLDSZINT</text>'));
  ok('subtitle quotes camera, cut and 128 endpoints',SA.svg.includes('>Axonometria · nézet 225° / 50° · vágás 1500 / 1000 mm · 128 végpont</text>'));
  const rows=[...SA.svg.matchAll(/<text class="lt" x="16" y="(\d+)">([^<]*)<\/text>/g)].map(m=>m[1]+':'+m[2]);
  ok('14 role rows, 17 px apart, in R.roles order',SA.roles.length===14&&rows[0]==='21:Hardver'&&rows[13]==='242:Biztonságtechnika',rows.slice(0,14).join(' | '));
  ok('5 symbol rows follow (Lámpa … Fal túloldalán)',rows[14]==='297:Lámpa (mennyezet, ejtővonallal)'&&rows[18]==='365:Fal túloldalán',rows.slice(14,19).join(' | '));
  ok('wall rows quote the P33 2850 and 1500 / 1000',rows[19]==='412:Távoli külső fal — teljes 2850 mm'&&rows[20]==='429:Vágott fal — belső 1500 · kamera felőli külső 1000 mm',rows.slice(19).join(' | '));
  ok('21 legend rows in all',rows.length===21,rows.length);
  ok('role swatches use STK_COL',SA.svg.includes(`fill="${w.STK_COL['sys:LIGHT']}"/><text class="lt" x="16" y="55">Világítás`));
  ok('the entrance marker (from the bejarat tag) is drawn once',(A.body.match(/>BEJÁRAT</g)||[]).length===1);
  ok('a quarter turn keeps the sheet size (the bounds frame the whole block)',(function(){const S=w.viewSheetSvg(w.viewRender({yaw:45}),{title:'P33'});return S.W===1697&&S.H===1372;})());
  ok('no title → level only',w.viewSheetSvg(A).svg.includes('<text class="t1" x="0" y="0">FÖLDSZINT</text>'));
  ok('title text is escaped',w.viewSheetSvg(A,{title:'a<b>&'}).svg.includes('>A&lt;B&gt;&amp; · FÖLDSZINT</text>'));
  ok('own subtitle replaces the default',w.viewSheetSvg(A,{sub:'Ügyfélnek'}).svg.includes('<text class="t2" x="0" y="18">Ügyfélnek</text>'));
  ok('deterministic',w.viewSheetSvg(w.viewRender({yaw:225}),{title:'P33'}).svg===SA.svg);
  ok('the sheet parses as SVG',(function(){const d=new w.DOMParser().parseFromString(SA.svg,'image/svg+xml');return !d.getElementsByTagName('parsererror').length;})());
  ok('building a sheet changes neither data nor drawing',JSON.stringify(w.__data)===before&&w.drawNormalGeom()===drawBefore);
  // legend = roles present: drop every Biztonságtechnika endpoint, its row goes and the sheet does not change size
  ok('a removed system leaves the legend',(function(){const secL=w.eval('layers').filter(L=>L.role==='sys:SECURITY').map(L=>L.id);
    const keep=w.__data.devices;w.__data.devices=keep.filter(d=>!secL.includes(d.layer));
    const S=w.viewSheetSvg(w.viewRender({yaw:225}),{title:'P33'});w.__data.devices=keep;
    return secL.length>0&&S.roles.length===13&&!S.svg.includes('>Biztonságtechnika<')&&S.W===1697?true:secL.length+' / '+S.roles.length;})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
