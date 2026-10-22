// Views V4, slice 3: the Exportálás menu (docs/views/DECISIONS.md D-V4-2).
//
// Fixture: the committed CLA v2 furnished plan (Calculator/CLA-teszt_v2_butor.vplan.json).
// What must hold:
//   * the views are Felülnézet (default) + the five V2 presets;
//   * the sheet keeps the on-screen zoom (body scale = vsK × zoom) and frames the whole drawing
//     whatever the pan; a preset exports exactly what the 3D Tiszta view shows with it on;
//   * the camera state is borrowed and restored; top-down draws no wall faces;
//   * SVG / PNG / print go out with the right names and sizes; the menu opens from the header.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','CLA-teszt_v2_butor.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const st=w.__state,E=s=>w.eval(s),$=id=>w.document.getElementById(id);
  st.active='ground';st.style='normal';w.camPresetApply('axo');w.draw();
  const before=JSON.stringify(w.__data);
  ok('views: top iso dim axo mil elev',w.VEXP_VIEWS.map(v=>v.k).join(' ')==='top iso dim axo mil elev');
  ok('the menu lists them, Felülnézet first and selected',$('expView').options.length===6&&$('expView').value==='top'&&$('expView').options[0].textContent==='Felülnézet');
  const rot0=st.rot,pitch0=st.pitch;st.zoom=0.5;
  const T=w.vexpSheet('top','CLA');
  ok('the camera state is restored',st.rot===rot0&&st.pitch===pitch0);
  ok('top-down: pitch 90, no wall faces, nothing near',T.R.def.pitch===90&&!T.R.prims.some(p=>p.t==='wall.a'||p.t==='wall.b')&&T.R.stats.near.length===0,T.R.stats.near.length);
  ok('subtitle: Felülnézet · vágás 1500 / 1000 mm · 128 végpont',T.svg.includes('>Felülnézet · vágás 1500 / 1000 mm · 128 végpont</text>'));
  ok('title CLA · FÖLDSZINT',T.svg.includes('>CLA · FÖLDSZINT</text>'));
  ok('body scale = vsK × zoom = 0.5',/stroke-linejoin="round"/.test(T.svg)&&T.svg.includes(' scale(0.5)" stroke-linejoin="round">'));
  ok('pan does not move it (always centred)',(function(){st.panX+=333;st.panY-=111;const a=w.vexpSheet('top','CLA').svg;st.panX-=333;st.panY+=111;return a===T.svg;})());
  ok('zoom 1 doubles the drawing area (frame unchanged)',(function(){st.zoom=1;const U=w.vexpSheet('top','CLA');st.zoom=0.5;
    const dw=(U.W-410)-2*(T.W-410),dh=(U.H-180)-2*(T.H-180);return Math.abs(dw)<=2&&Math.abs(dh)<=2&&U.svg.includes(' scale(1)')===false?true:dw+' '+dh;})()===true);
  ok('the frame is 410 px wide + 180 px high around the drawing',(function(){const b=T.R.bounds,k=0.5;
    return T.W===Math.ceil((b.maxX-b.minX)*k+410)&&T.H===Math.ceil((b.maxY-b.minY)*k+180);})());
  ok('the axo export = the 3D Tiszta view with the axo preset',(function(){st.style='tiszta';w.draw();const a=E('tisztaRender')().body;st.style='normal';w.draw();
    return w.vexpSheet('axo','').R.body===a;})());
  ok('a preset export takes the quadrant nearest the current yaw',(function(){const A=w.vexpSheet('axo','');return A.R.def.yaw===w.camNorm(w.camQuadRot(rot0,46,45));})());
  ok('no title → level only',w.vexpSheet('top','').svg.includes('<text class="t1" x="0" y="0">FÖLDSZINT</text>'));
  ok('sheet parses as SVG',(function(){const d=new w.DOMParser().parseFromString(T.svg,'image/svg+xml');return !d.getElementsByTagName('parsererror').length;})());
  ok('PNG at 2×, held under 8192 px',E('vexpPngK')({W:1000,H:500})===2&&E('vexpPngK')({W:10000,H:100})===0.8192);
  // the downloads
  const got=[];w.HTMLAnchorElement.prototype.click=function(){got.push(this.download);};
  w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
  $('expTitle').value='CLA';$('expView').value='iso';
  ok('SVG button → axo_CLA_iso.svg',(function(){$('expSvg').onclick();return got[0]==='axo_CLA_iso.svg';})(),got.join(','));
  ok('PNG goes through svgToPng at 2× the sheet',(function(){let a=null;const keep=w.svgToPng;w.svgToPng=(s,W,H,n)=>{a=[W,H,n];};
    const S=E('vexpPng')();w.svgToPng=keep;return a&&a[0]===Math.round(S.W*2)&&a[1]===Math.round(S.H*2)&&a[2]==='axo_CLA_iso.png'?true:JSON.stringify(a);})()===true);
  ok('print goes through printSVG',(function(){let a=null;const keep=w.printSVG;w.printSVG=(s,t)=>{a=[s.slice(0,4),t];};E('vexpPrint')();w.printSVG=keep;return a&&a[0]==='<svg'&&a[1]==='Axonometria';})());
  ok('the header button opens and closes the menu',(function(){const m=$('expMenu');$('bExport').onclick();const a=m.style.display==='block';$('bExport').onclick();return a&&m.style.display==='none';})());
  ok('the actions exist (menu, svg, png, print)',['view.export.menu','view.export.svg','view.export.png','view.export.print'].every(id=>E('ACTIONS').some(a=>a.id===id)));
  ok('the data is untouched',JSON.stringify(w.__data)===before);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
