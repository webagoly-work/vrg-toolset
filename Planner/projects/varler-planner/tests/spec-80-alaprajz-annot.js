// Views V9b — the Alaprajz annotation: room tags, endpoint codes, dimension chains, north arrow, stairs, all texts
// through one collision-avoiding placer (06e-view-plan.js apAnnotSvg / apPlacer).
//
// Fixture: the committed P33 v2 furnished plan, ground floor, cut 1200, 1:50 (docs/views/WORKPLAN.md § V9b, tests 1–7).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','P33-teszt_v2_butor.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);
  const st=w.__state;st.active='ground';st.bpScale=50;
  const scene=()=>$('vp').firstChild.innerHTML;
  const s=$('style');s.value='alaprajz';s.onchange({target:s});w.apCutSet(1200);
  const L=()=>w.eval('AP_LAST').labels,S=()=>w.eval('AP_LAST');
  const fl=w.__data.floors.filter(f=>f.level==='ground');

  // ---------- 1. room tags ----------
  ok('8 room tags',L().rooms===8,L().rooms);
  ok('each tag: NUM  NAME upper case + its polygon area (2 decimals, comma)',fl.every(f=>{const t=((f.num?f.num+'  ':'')+f.name).toUpperCase(),
    a=(w.polyArea(f.poly)/1e6).toFixed(2).replace('.',',')+' m²';return scene().includes('>'+w.esc(t)+'</text>')&&scene().includes('>'+a+'</text>');}),
    fl.map(f=>f.num).join(' '));
  ok('R06 NAPPALI reads 18,26 m²',scene().includes('>R06  NAPPALI</text>')&&scene().includes('>18,26 m²</text>'));

  // ---------- 2. codes ----------
  const drawn=S().drawn,withCode=drawn.filter(e=>w.apDevCode(e.d));
  ok('codes = the drawn endpoints that have one (24 of 42)',L().codes===withCode.length&&withCode.length===24&&drawn.length===42,L().codes+' / '+drawn.length);
  ok('each code = the Normal view\'s first text under that symbol',withCode.every(e=>{const keep=st.style;st.style='normal';const sv=w.devSym(e.d);st.style=keep;
    const m=sv.match(/<text\b[^>]*>([^<]*)<\/text>/);return m&&w.apDevCode(e.d).t===m[1];}));

  // ---------- 3. no overlaps ----------
  const runs=[];for(const sc of [50,100])for(const c of [300,1200,1500]){st.bpScale=sc;w.apCutSet(c);runs.push(sc+'/'+c+':'+L().overlaps+'/'+L().texts);}
  ok('overlaps 0 at 1:50 and 1:100 × cuts 300 / 1200 / 1500',runs.every(r=>/:0\//.test(r)),runs.join(' '));
  st.bpScale=50;w.apCutSet(1200);
  ok('every text has a halo pass before its fill pass',(function(){const g=scene().slice(scene().indexOf('class="ap-annot"'));
    const all=(g.match(/<text /g)||[]).length,halo=(g.match(/<text [^>]*fill="#fff" stroke="#fff"/g)||[]).length;return all===2*halo&&halo>=L().texts;})());

  // ---------- 4. dimension chains ----------
  const bb=w.bpBBox('ground');
  ok('4 chain lines',L().chains===4&&(scene().match(/class="ap-dim"/g)||[]).length===4);
  ok('the overall chains read the level box: '+((bb.x1-bb.x0)/1000).toFixed(2)+' × '+((bb.y1-bb.y0)/1000).toFixed(2),
    scene().includes('>'+(Math.round(bb.x1-bb.x0)/1000).toFixed(2).replace('.',',')+'</text>')&&scene().includes('>'+(Math.round(bb.y1-bb.y0)/1000).toFixed(2).replace('.',',')+'</text>'));
  ok('P33: 7,26 × 10,07',scene().includes('>7,26</text>')&&scene().includes('>10,07</text>'));

  // ---------- 5. north ----------
  ok('one north arrow, letter É',(scene().match(/class="ap-north"/g)||[]).length===1&&scene().includes('>É</text>')&&L().north===1);

  // ---------- 6. stairs ----------
  w.__data.openings.push({type:'stairs',level:'ground',x:3000,y:6000,ang:0,w:1000,riser:180,going:250,h:2880});w.draw();
  const sc6=scene();
  ok('a test stair (riser 180, 16 treads), cut 1200: 6 solid + 9 dashed treads + 1 break line',
    (sc6.match(/class="ap-tread"/g)||[]).length===6&&(sc6.match(/class="ap-tread-hid"/g)||[]).length===9&&(sc6.match(/class="ap-break"/g)||[]).length===1&&S().stairs===1,
    [(sc6.match(/class="ap-tread"/g)||[]).length,(sc6.match(/class="ap-tread-hid"/g)||[]).length,(sc6.match(/class="ap-break"/g)||[]).length].join(' '));
  w.apCutSet(2700);
  ok('cut 2700 (the maximum): 15 solid, 0 dashed, the break still in tread 16 (top 2880)',(scene().match(/class="ap-tread"/g)||[]).length===15&&!scene().includes('ap-tread-hid')&&(scene().match(/class="ap-break"/g)||[]).length===1);
  st.style='blueprint';w.draw();
  ok('the blueprint stair carries no Alaprajz classes',!/ap-(tread|break)/.test(scene())&&/<polygon[^>]*fill="#fff" stroke="#111"/.test(scene()));
  w.__data.openings.pop();st.style='alaprajz';w.apCutSet(1200);

  // ---------- 7. the ticks ----------
  $('apDims').checked=false;$('apDims').onchange({target:$('apDims')});
  ok('méretláncok off → no chains, no dimension texts',L().chains===0&&L().dims===0&&!scene().includes('ap-dim'));
  $('apCodes').checked=false;$('apCodes').onchange({target:$('apCodes')});
  ok('végpont-kódok off → no codes; room tags stay',L().codes===0&&L().rooms===8);
  $('apDims').checked=true;$('apDims').onchange({target:$('apDims')});$('apCodes').checked=true;$('apCodes').onchange({target:$('apCodes')});
  ok('both back on',L().chains===4&&L().codes===24);
  st.style='normal';w.draw();
  ok('Normal draws no annotation group',!scene().includes('ap-annot'));
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
