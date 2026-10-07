// spec-49 — drawing on the stack as one layer: ARM routes (WP-E1)
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
  const lvl='ground',D=()=>w.__data;w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();const WA=w.__getWalls()[lvl];
  WA.push({x0:-50,y0:-50,x1:8050,y1:50},{x0:-50,y0:2950,x1:8050,y1:3050},{x0:-50,y0:-50,x1:50,y1:3050},{x0:7950,y0:-50,x1:8050,y1:3050},{x0:3950,y0:50,x1:4050,y1:2950});
  D().floors.push({level:lvl,name:'A',num:'1',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]},{level:lvl,name:'B',num:'2',poly:[[4000,0],[8000,0],[8000,3000],[4000,3000]]});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const S=w.stkCreate({name:'R'});
  const rbx=w.hwPlace(w.hwGhostAt('rbx',lvl,100,1500));
  const put=(code,role,x,y,side)=>{const en=w.epEntry(code,role);return w.epPlace({level:lvl,x,y,h:en.h||2700,mount:en.mount,side:en.mount==='wall'?(side==null?1:side):undefined},code,role);};
  const sen=put('SEN','sys:SENSOR',3000,1500),soc=put('SOC','sys:MAINS',2000,0,1);
  const draw=pts=>{w.armToolStart();pts.forEach(p=>w.eval('pathAddNode('+JSON.stringify(p)+')'));w.eval('finishPath()');return D().paths[D().paths.length-1];};
  const at=(d,h)=>({level:lvl,x:d.x,y:d.y,h:h||2600,dev:d.id});
  const p1=draw([at(rbx),{level:lvl,x:1500,y:1500,h:2600},at(sen)]);
  ok('the ARM tool puts a route on the stack ARM layer, both ends linked',p1.route==='arm'&&p1.layer===w.stkLayer(S.id,'arm').id&&w.devLinks(rbx).some(l=>l.p===p1.id)&&w.devLinks(sen).some(l=>l.p===p1.id));
  ok('the tool turns the stack view on',w.__state.stkView===true);
  const p2=draw([{level:lvl,x:1510,y:1490,h:2600},{level:lvl,x:2000,y:400,h:2600},at(soc)]);
  ok('a route that starts on another route\'s node joins it there',!!p2.nodes[0].j&&p2.nodes[0].j.p===p1.id&&p2.nodes[0].j.n===p1.nodes[1].id&&p2.nodes[0].x===1500&&p2.nodes[0].y===1500);
  const n1=p1.nodes.length;
  const p3=draw([{level:lvl,x:2300,y:1530,h:2600},{level:lvl,x:2300,y:2500,h:2600}]);
  ok('a route that starts on a segment splits it and joins the new node',p1.nodes.length===n1+1&&p1.sections.length===p1.nodes.length-1&&p3.nodes[0].j&&p3.nodes[0].j.p===p1.id&&p3.nodes[0].x===2300&&p3.nodes[0].y===1500);
  ok('the split keeps the other links (SEN still on the route end)',w.devLinks(sen).some(l=>l.p===p1.id&&l.n===p1.nodes[p1.nodes.length-1].id));
  ok('the graph sees one connected tree',(function(){const G=w.rgBuild();const r=w.rgReach(G,'D:'+rbx.id);return r.has('D:'+sen.id)&&r.has('D:'+soc.id)&&r.has(p3.id+'/'+p3.nodes[1].id);})());
  ok('ARM refs per room: A1, A2, A3',w.armRef(p1)==='A1'&&w.armRef(p2)==='A2'&&w.armRef(p3)==='A3');
  const pB=draw([{level:lvl,x:5000,y:500,h:2600},{level:lvl,x:6000,y:500,h:2600}]);
  ok('another room starts at A1',w.armRef(pB)==='A1');
  ok('an end on nothing is reported open',w.armEndOpen(p3).length===1&&w.stkCheck(S,'arm').some(c=>/kötetlen vég/.test(c.msg)));
  // stack view fade
  ok('stack view: an item on a non-stack layer is drawn at 30 %',(function(){const o={type:'socket',level:lvl,x:500,y:500,h:300,layer:'L0'};D().devices.push(o);w.ensureIds(D());
    w.__state.stkView=true;const a=w.lyrOp(o,'socket');w.__state.stkView=false;const b=w.lyrOp(o,'socket');D().devices.pop();return a===0.3&&b===1;})());
  ok('stack items keep full opacity in the stack view',(function(){w.__state.stkView=true;const v=w.lyrOp(sen,'device');w.__state.stkView=false;return v===1;})());
  // ban walls
  w.mrkList().push({kind:'wall',level:lvl,wall:WA[2].id,pol:'ban',tags:['tartofal'],layer:w.stkLayer(S.id,'mark').id});w.ensureIds(D());
  const pBan=draw([{level:lvl,x:0,y:2000,h:2600},{level:lvl,x:0,y:2800,h:2600}]);
  ok('a sull ARM along a tartófal is a warning',w.armBanSegs(pBan).some(b=>b.kind==='along')&&w.stkCheck(S,'arm').some(c=>/Tartófal/.test(c.msg)));
  ok('…the same route as kábelcsatorna is fine',(function(){w.chnApplyRule(pBan,'csat');const c=w.stkCheck(S,'arm').some(x=>/Tartófal/.test(x.msg)&&x.msg.indexOf(w.armRef(pBan))>=0);w.chnApplyRule(pBan,'sull');return !c;})());
  ok('an unreached endpoint is reported',(function(){const s2=put('SEN','sys:SENSOR',3500,500);const c=w.stkCheck(S,'arm').some(x=>x.msg.indexOf(s2.ref)===0&&/nincs ARM/.test(x.msg));return c&&w.armUnreached(S).indexOf(s2)>=0;})());
  // orphaned join
  ok('deleting the joined-to route: the dangling join is pruned and reported',(function(){const i=D().paths.indexOf(p1);D().paths.splice(i,1);
    const v=w.validate().some(x=>x.code==='arm.join');return v&&!p2.nodes[0].j;})());
  ok('leaving path mode turns the ARM flag off',(function(){w.armToolStart();w.setMode('select');return w.ARM_T.on===false;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
