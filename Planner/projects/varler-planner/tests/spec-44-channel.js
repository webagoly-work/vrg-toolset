// spec-44 — channel topology between hardware nodes (WP-C5)
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
  const D=()=>w.__data;
  w.newBlankProject();const WA=w.__getWalls()[lvl];
  WA.push({x0:-50,y0:-50,x1:20050,y1:50},{x0:-50,y0:3950,x1:20050,y1:4050},{x0:-50,y0:-50,x1:50,y1:4050},{x0:19950,y0:-50,x1:20050,y1:4050},
          {x0:9950,y0:50,x1:10050,y1:3950});
  D().floors.push({level:lvl,name:'A',num:'1',poly:[[0,0],[10000,0],[10000,4000],[0,4000]]},{level:lvl,name:'B',num:'2',poly:[[10000,0],[20000,0],[20000,4000],[10000,4000]]});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const S=w.stkCreate({name:'C'});
  const place=(t,x,y,units)=>{if(units)w.HW_T.units=units;return w.hwPlace(w.hwGhostAt(t,lvl,x,y));};
  const el=place('board',1000,100),base=place('base',3000,100,['NET','COMP','MEDIA']),r1=place('rbx',9900,2000),r2=place('rbx',19900,2000),ssc=place('ssc',5000,100);
  // a route through the real Path tool: nodes put down ON a device are marked and linked by finishPath
  const route=(pts)=>{w.chnToolStart();pts.forEach(p=>w.eval('pathAddNode('+JSON.stringify(p)+')'));w.eval('finishPath()');return D().paths[D().paths.length-1];};
  const at=(d,h)=>({level:lvl,x:d.x,y:d.y,h:h||2600,dev:d.id});
  const p1=route([at(base),{level:lvl,x:3000,y:300,h:2600},{level:lvl,x:9700,y:300,h:2600},at(r1)]);
  ok('the tool puts the route on the stack channel layer',p1.layer===w.stkLayer(S.id,'channel').id);
  ok('a route from BASE to RBX: route, rule, both ends linked',p1.route==='channel'&&p1.rule==='sull'&&w.chnEnds(p1)[0]===base&&w.chnEnds(p1)[1]===r1);
  ok('its carrier is the CHANNEL bundle and it is coloured for it',w.chnCarrier(p1)==='channel'&&p1.color==='#2f6fb0');
  const p2=route([at(el),{level:lvl,x:1000,y:400,h:2600},at(r1)]);
  ok('board → RBX carries the room circuits',w.chnCarrier(p2)==='mains');
  const p3=route([at(r1),{level:lvl,x:10200,y:3500,h:2600},at(r2)]);
  ok('RBX → RBX is a chained CHANNEL',w.chnCarrier(p3)==='channel'&&w.chnChain(r2.id)==='chained'&&w.chnChain(r1.id)==='direct');
  ok('length to BASE through the chain = sum of the two routes',Math.abs(w.chnLenToBase(r2.id)-(w.chnLen(p1)+w.chnLen(p3)))<1);
  const p4=route([at(base),{level:lvl,x:3000,y:3500,h:2600},at(r1)]);
  ok('a second BASE→RBX route is named /b, the BASE side first',w.chnName(p1)==='BASE~'+r1.ref&&w.chnName(p4)==='BASE~'+r1.ref+'/b',w.chnName(p4));
  ok('the shortest of parallel routes counts for the tree',w.chnLenToBase(r1.id)===Math.round(Math.min(w.chnLen(p1),w.chnLen(p4))));
  ok('a carrier override sticks; removing it restores the derived one',(function(){p4.carrier='data';const a=w.chnCarrier(p4)==='data';delete p4.carrier;return a&&w.chnCarrier(p4)==='channel';})());
  ok('R while drawing flips the rule; the sections follow',(function(){w.chnToolStart();w.eval('pathAddNode('+JSON.stringify(at(ssc))+')');
    w.stkToolEvent('key',{key:'r',preventDefault(){}});w.eval('pathAddNode('+JSON.stringify(at(r1))+')');w.eval('finishPath()');const p=D().paths[D().paths.length-1];
    w.CHN_T.rule='sull';return p.rule==='csat'&&p.sections.every(s=>s.build==='kv_csat_szeles')&&w.chnCarrier(p)==='security';})());
  ok('an ordinary path drawn later is untouched (tool off after leaving path mode)',(function(){w.setMode('select');w.eval("pathAddNode({level:'ground',x:500,y:500,h:300})");w.eval("pathAddNode({level:'ground',x:900,y:500,h:300})");w.eval('finishPath()');
    const p=D().paths[D().paths.length-1];return !p.route&&!p.rule;})());
  const chk=()=>w.stkCheck(S,'channel');
  ok('checks: r2 has no mains route from the board',chk().some(c=>c.msg.indexOf(r2.ref)===0&&/erősáramú/.test(c.msg)));
  ok('checks: RB-M as a chain node gets the RB-H hint',chk().some(c=>/láncpont/.test(c.msg)));
  ok('checks: removing r1→r2 leaves r2 unreached',(function(){const i=D().paths.indexOf(p3);D().paths.splice(i,1);const c=chk().some(x=>x.msg.indexOf(r2.ref)===0&&/nincs CHANNEL/.test(x.msg));D().paths.splice(i,0,p3);return c;})());
  ok('checks: an open-ended route warns',(function(){w.chnToolStart();w.eval('pathAddNode('+JSON.stringify(at(base))+')');w.eval("pathAddNode({level:'ground',x:6000,y:2000,h:2600})");w.eval('finishPath()');
    const c=chk().some(x=>/Nyitott végű/.test(x.msg));D().paths.pop();w.setMode('select');return c;})());
  ok('the BASE cat6a rule reads the channel length',w.hwBaseRules(base).some(r=>r.k==='cat6a'&&r.ok));
  ok('the route menu gains the channel items',(function(){const it=[];w.stkPathMenu({pi:D().paths.indexOf(p1),si:0},it);return it.some(x=>/Szabály: kábelcsatorna/.test(x.label))&&it.some(x=>/Tartalom/.test(x.label));})());
  ok('the bundle content lists C1…C5 in order',(function(){const t=w.chnContentText(p1);return t.indexOf('C1')<t.indexOf('C2')&&t.indexOf('C4b')>0&&t.indexOf('C5')>t.indexOf('C4b');})());
  ok('labels appear in the channel stage',(function(){w.__state.activeLayer=w.stkLayer(S.id,'channel').id;w.draw();return (w.document.querySelector('#vp').innerHTML).indexOf('CHANNEL köteg')>=0;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
