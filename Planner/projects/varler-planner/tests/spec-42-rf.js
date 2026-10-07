// spec-42 — radio coverage, simplified COST-231 multi-wall (WP-C3)
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
  const D=()=>w.__data,near=(a,b,e)=>Math.abs(a-b)<=(e||0.01);
  w.newBlankProject();const WA=w.__getWalls()[lvl];
  WA.push({x0:-50,y0:-50,x1:8050,y1:50},{x0:-50,y0:3950,x1:8050,y1:4050},{x0:-50,y0:-50,x1:50,y1:4050},{x0:7950,y0:-50,x1:8050,y1:4050},
          {x0:3950,y0:50,x1:4050,y1:3950});
  D().floors.push({level:lvl,name:'A',poly:[[0,0],[4000,0],[4000,4000],[0,4000]]},{level:lvl,name:'B',poly:[[4000,0],[8000,0],[8000,4000],[4000,4000]]});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const part=WA[4],B=D().floors[1].id;
  const rbx=w.hwPlace(w.hwGhostAt('rbx',lvl,100,2000));      // left outer wall, facing A
  ok('the RBX has the default radios',JSON.stringify(rbx.radios)==='["thread","ble","espnow"]');
  ok('wall loss: 100 mm untagged partition = 4 dB',w.rfWallLoss(part)===4);
  ok('wall loss: a 300 mm untagged wall = 12 dB',w.rfWallLoss({x0:0,y0:0,x1:1000,y1:300})===12);
  w.mrkList().push({kind:'wall',level:lvl,wall:part.id,pol:'ban',tags:['tartofal'],layer:'L0'});w.ensureIds(D());
  ok('wall loss: tagged tartofal = 15 dB',w.rfWallLoss(part)===15);
  w.mrkList().splice(0,1);
  const src=w.rfSources(lvl,'thread')[0];
  ok('the source radiates 30 mm in front of the face (x = 80)',src&&near(src.x,80)&&near(src.y,2000),src&&src.x);
  ok('a ray into B crosses the partition once, not the RBX own wall',(function(){const ws=w.rfSegWalls(lvl,src.x,src.y,6000,2000);return ws.length===1&&ws[0]===part;})());
  const T=w.RF_TECH.find(t=>t.k==='thread'),budget=10*T.pe*Math.log10(T.R0);
  ok('margin at 1 m in free space = the whole budget',near(w.rfMargin(src,src.x+1000,src.y,'thread'),budget),w.rfMargin(src,src.x+1000,src.y,'thread'));
  ok('margin at R0 with no walls ≈ 0',near(w.rfMargin({x:1e6,y:1e6,dev:{level:lvl}},1e6+T.R0*1000,1e6,'thread'),0,1e-9));
  ok('margin through the partition = budget − distance loss − 4 dB',(function(){const d=(6000-src.x)/1000;return near(w.rfMargin(src,6000,2000,'thread'),budget-10*T.pe*Math.log10(d)-4);})());
  const cA=w.rfRoomCover(B,'thread');
  ok('Thread covers B fully through a plain partition',cA===1,cA);
  w.mrkList().push({kind:'wall',level:lvl,wall:part.id,pol:'ban',tags:['tartofal'],layer:'L0'});w.ensureIds(D());
  const cB=w.rfRoomCover(B,'thread');
  ok('retagging the partition as tartofal lowers B coverage (memo sees the tag)',cB<cA,cB);
  w.mrkList().splice(0,1);
  ok('UWB loses f=1.5 × the wall loss',(function(){const U=w.RF_TECH.find(t=>t.k==='uwb'),d=(6000-src.x)/1000;rbx.radios=['uwb'];const s2=w.rfSources(lvl,'uwb')[0];
    const m=w.rfMargin(s2,6000,2000,'uwb');rbx.radios=['thread','ble','espnow'];return near(m,10*U.pe*Math.log10(U.R0)-10*U.pe*Math.log10(d)-1.5*4);})());
  ok('memo: two calls without a change return the same object',w.rfGrid(lvl,'thread')===w.rfGrid(lvl,'thread'));
  ok('memo: moving the RBX recomputes',(function(){const a=w.rfGrid(lvl,'thread');rbx.y=1000;const b=w.rfGrid(lvl,'thread');rbx.y=2000;return a!==b;})());
  ok('cells only inside rooms',w.rfGrid(lvl,'thread').cells.every(c=>(c.i+0.5)*500>0&&(c.i+0.5)*500<8000&&(c.j+0.5)*500>0&&(c.j+0.5)*500<4000));
  ok('the coverage view draws cells and the faint outline',(function(){const s=w.rfCoverageSvg();return /fill="#3fa36b"/.test(s)&&/stroke-opacity="0.35"/.test(s);})());
  ok('a tech switched off in the settings draws nothing',(function(){w.__state.rf={on:{thread:false,ble:false,espnow:false,wifi:false,uwb:false},R0:{}};const s=w.rfCoverageSvg();w.__state.rf=null;return s==='';})());
  ok('an R0 setting changes the result',(function(){w.__state.rf={on:{},R0:{thread:3}};const c=w.rfRoomCover(B,'thread');w.__state.rf=null;return c<1;})());
  ok('the RF stage turns the overlay on',(function(){const S=w.stkCreate({name:'R'});w.__state.activeLayer=w.stkLayer(S.id,'sys:RF').id;w.draw();
    const ov=(w.document.querySelector('#vp')||w.document.body).innerHTML;return /fill="#3fa36b"/.test(ov);})());
  ok('the RF check warns on a room under 90 %',(function(){w.__state.rf={on:{},R0:{thread:3,wifi:3}};const c=w.stkCheck({id:'x'},'sys:RF').some(x=>/Thread/.test(x.msg));w.__state.rf=null;return c;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
