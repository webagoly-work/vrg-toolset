// The desk dashboard feed (src/07e-dash-link.js). A stub WebSocket stands in for the relay: it records what the
// tab sends and feeds commands in, as the CYD bridge (<repo>/Firmware/planner-cyd/app/bridge) would.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.hardResetWorkspace();
  const ev=s=>{try{return w.eval(s);}catch(e){return 'ERR:'+e.message;}};
  ok('PLANNER_DASH exists',ev('typeof PLANNER_DASH')==='object');
  ok('no timer while the link is down',ev('PLANNER_DASH.stats().polling')===false);
  const s=JSON.parse(ev('JSON.stringify(PLANNER_DASH.snapshot())'));
  ok('snapshot: six phases with err/warn counts',s.phases.length===6&&s.phases.every(p=>p.k&&p.n&&typeof p.err==='number'&&typeof p.warn==='number'));
  ok('snapshot: the current phase\'s tools',s.phase>=0&&s.tools.length===ev('phByKey(state.wfPhase).tools.length'));
  ok('snapshot: level by its Hungarian name',s.level==='FÖLDSZINT',s.level);
  ok('snapshot: totals',s.totals&&typeof s.totals.dev==='number');
  ok('snapshot: nothing running on plain Select',s.tool===null&&s.tools.every(t=>!t.live));
  ok('snapshot: inputAt in UTC seconds, on a 30 s step',typeof s.inputAt==='number'&&s.inputAt%30===0&&Math.abs(Date.now()/1000-s.inputAt)<120,s.inputAt);
  const t0=ev('PLANNER_DASH.stats().inputAt');await sleep(40);
  w.eval("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Shift',bubbles:true}))");
  ok('a key press counts as input',ev('PLANNER_DASH.stats().inputAt')>t0);
  // the relay stub
  const sent=[];let sock=null;
  w.WebSocket=function(u){sock=this;this.url=u;this.readyState=0;setTimeout(()=>{this.readyState=1;this.onopen&&this.onopen();},5);};
  w.WebSocket.prototype.send=function(d){sent.push(JSON.parse(d));};
  w.WebSocket.prototype.close=function(){this.readyState=3;};
  const cmd=(id,p)=>sock.onmessage({data:JSON.stringify({v:1,from:'cyd',seq:1,type:'cmd',payload:Object.assign({id},p||{})})});
  const lastAck=id=>sent.filter(m=>m.type==='ack'&&m.payload.id===id).pop();
  ev("PLANNER_LINK.connect('ws://stub')");await sleep(80);
  ok('link up → polling, a dash snapshot sent',ev('PLANNER_DASH.stats().polling')===true&&sent.some(m=>m.type==='dash'));
  cmd('dash.phase',{k:'alap'});await sleep(60);
  ok('dash.phase alap → the phase moves, acked ok',ev('state.wfPhase')==='alap'&&lastAck('dash.phase').payload.ok===true);
  cmd('dash.action',{a:'mode.room',mode:'room'});await sleep(60);
  const d1=sent.filter(m=>m.type==='dash').pop().payload;
  ok('dash.action mode.room → the room pen runs',ev('state.mode')==='room');
  ok('… and the next snapshot lights its button',d1.tool&&d1.tools[0].live===true,JSON.stringify(d1.tools[0]));
  cmd('dash.stop');await sleep(60);
  ok('dash.stop → back to plain Select',ev('state.mode')==='select'&&ev('toolCurrent()')===null);
  cmd('dash.phase',{k:'szab'});cmd('dash.action',{a:'wf.routeWalls'});await sleep(60);
  ok('a sub-tool by action id (Vezethető fal)',ev('toolCurrent()&&toolCurrent().id')==='wf.routeWalls');
  cmd('dash.stop');await sleep(30);
  cmd('dash.phase',{k:'nincs'});await sleep(30);
  ok('an unknown phase is refused',lastAck('dash.phase').payload.ok===false);
  cmd('dash.action',{a:'level.up'});await sleep(30);
  ok('a disabled action is refused (one level only)',lastAck('dash.action').payload.ok===false);
  const n=sent.filter(m=>m.type==='dash').length;
  sock.onmessage({data:JSON.stringify({v:1,from:'cyd',type:'dash.request',payload:{}})});await sleep(30);
  ok('dash.request → a fresh snapshot at once',sent.filter(m=>m.type==='dash').length===n+1);
  ev('PLANNER_LINK.disconnect()');await sleep(30);
  ok('link down → the timer stops',ev('PLANNER_DASH.stats().polling')===false);
 }catch(e){R.push(['exception',false,e.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},1500);
