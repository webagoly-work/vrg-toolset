// phone-proto-smoke.js — the protocol core of mobile/phone-sender.html, tested
// against the real src/07a-link.js. No browser: the page's PROTO-CORE block is
// extracted and evaluated, then its messages are fed straight into the planner's
// link module. If these two ever disagree about the wire format, this fails.
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const PAGE=fs.readFileSync(path.join(ROOT,'mobile','phone-sender.html'),'utf8');

const m=/PROTO-CORE-START[\s\S]*?<script>([\s\S]*?)<\/script>/.exec(PAGE);
if(!m){console.log('FAIL  cannot find the PROTO-CORE block');process.exit(1);}
eval(m[1]);

const A=[],t=(n,c)=>A.push((c?'PASS  ':'FAIL  ')+n);

// ---- envelope shape ---------------------------------------------------------
PHONE._reset();
const h=PHONE.hello('2.0-b');
t('hello has the 2.0 envelope', h.v===1&&h.from==='phone'&&h.seq===1&&h.t>0&&h.type==='hello');
t('hello declares role phone', h.payload.role==='phone');
t('hello declares caps', h.payload.caps.indexOf('cmd')>=0&&h.payload.caps.indexOf('state')>=0);
t('seq increments', PHONE.cmd('edit.undo').seq===2&&PHONE.cmd('edit.redo').seq===3);

// ---- the ids must be ones the planner actually registers --------------------
const LINK=fs.readFileSync(path.join(ROOT,'src','07a-link.js'),'utf8');
['tool.select','edit.undo','edit.redo','view.reset'].forEach(id=>
  t('planner registers '+id, LINK.indexOf("command('"+id+"'")>=0));

// ---- feed the page's messages into the real link module ---------------------
global.window={}; global.VERSION='2.0.0';
const evts=[];
global.document={dispatchEvent:e=>evts.push(e),addEventListener(){}};
global.KeyboardEvent=function(k,o){Object.assign(this,o,{type:k});};
global.state={mode:'select',active:'ground',flat:false};
global.TOOLKEYS=['select','grab','device','cable','wall','build','object','floor','roof','format'];
global.HINTS={select:'Kijelölés',grab:'Fogás',device:'Készülék',cable:'Kábel',wall:'Fal',
  build:'Építés',object:'Objektum',floor:'Padló',roof:'Tető',format:'Formátum',
  path:'Pálya',measure:'Mérés',note:'Jegyzet'};
let sent=[], sock=null;
global.WebSocket=function(u){this.url=u;this.readyState=1;sock=this;
  this.send=s=>sent.push(JSON.parse(s));this.close=()=>{};
  setTimeout(()=>this.onopen&&this.onopen(),0);};
eval(LINK);
const L=global.window.PLANNER_LINK;
L.connect('ws://test');

setTimeout(()=>{
  const feed=o=>sock.onmessage({data:JSON.stringify(o)});
  const plannerHello=sent.find(x=>x.type==='hello');

  // the page builds its pad from the planner's table
  const buttons=PHONE.toolButtons(plannerHello.payload);
  t('pad built from the planner table', buttons.length===13);
  t('numbered tools keep their key', buttons.find(b=>b.mode==='device').key==='3');
  t('unnumbered tools survive', buttons.find(b=>b.mode==='note')&&buttons.find(b=>b.mode==='note').key===null);
  t('labels are short enough for a phone button', buttons.every(b=>b.label.length<=11));

  // page -> planner: a tool press
  let picked=null;
  global.window.PLANNER_CAM={selectTool:(i,k)=>{picked=[i,k];return true;},
    undo(){picked='undo';},redo(){picked='redo';},resetView(){picked='reset';}};
  sent=[];
  feed(PHONE.cmd('tool.select',{index:4,key:'5'}));
  t('tool press reaches PLANNER_CAM', picked&&picked[0]===4);
  t('planner acks it', sent.some(x=>x.type==='ack'&&x.payload.ok===true));

  feed(PHONE.cmd('edit.undo'));  t('undo reaches PLANNER_CAM', picked==='undo');
  feed(PHONE.cmd('edit.redo'));  t('redo reaches PLANNER_CAM', picked==='redo');
  feed(PHONE.cmd('view.reset')); t('reset reaches PLANNER_CAM', picked==='reset');

  // escape hatch
  evts.length=0;
  feed(PHONE.keys('g',{ctrl:true}));
  t('keys escape hatch arrives as a keydown', evts.length===1&&evts[0].key==='g'&&evts[0].ctrlKey===true);

  // gestures and orientation reach subscribers
  let got=null;
  L.on('gesture',p=>{got=p;});
  feed(PHONE.gesture({kind:'zoompan',dx:5,dy:-3,scale:1}));
  t('gesture reaches the planner', got&&got.dx===5);
  L.on('orientation',p=>{got=p;});
  feed(PHONE.orientation({pitch:42,yaw:100,pitchEnabled:true,yawEnabled:true}));
  t('orientation reaches the planner', got&&got.pitch===42);

  // unknown command is nacked, not silently dropped
  sent=[];
  feed(PHONE.cmd('does.not.exist'));
  t('unknown command nacked', sent.some(x=>x.type==='ack'&&x.payload.ok===false));

  // planner -> page
  const r=PHONE.read(JSON.stringify({v:1,from:'planner',type:'state',payload:{mode:'wall',level:'ground'}}));
  t('page reads a state message', r.kind==='state'&&r.state.mode==='wall');
  t('page ignores its own echo', PHONE.read(JSON.stringify({v:1,from:'phone',type:'cmd'})).kind==='echo');
  t('page survives junk', PHONE.read('not json').kind==='junk');

  // ---- pure helpers ---------------------------------------------------------
  t('one finger pans', (g=>g.dx===10&&g.dy===5&&g.scale===1)(PHONE.pinch({n:1,x:0,y:0,d:0},{n:1,x:10,y:5,d:0})));
  t('two fingers zoom', PHONE.pinch({n:2,x:0,y:0,d:100},{n:2,x:0,y:0,d:150}).scale===1.5);
  t('finger count change is ignored', PHONE.pinch({n:1,x:0,y:0,d:0},{n:2,x:0,y:0,d:100})===null);
  t('degenerate pinch ignored', PHONE.pinch({n:2,x:0,y:0,d:2},{n:2,x:0,y:0,d:80})===null);

  t('pitch clamped to 5..90', PHONE.fromDeviceEvent({beta:180,alpha:0}).pitch===5
     && PHONE.fromDeviceEvent({beta:0,alpha:0}).pitch===90);
  t('yaw normalised to 0..360', PHONE.fromDeviceEvent({beta:45,alpha:-30}).yaw===330);
  t('missing sensor data returns null', PHONE.fromDeviceEvent({})===null&&PHONE.fromDeviceEvent(null)===null);

  t('ws url derived from http origin', PHONE.defaultUrl({protocol:'http:',host:'192.168.1.157:47291'})==='ws://192.168.1.157:47291');
  t('https origin gives wss', PHONE.defaultUrl({protocol:'https:',host:'x.ts.net'})==='wss://x.ts.net');
  t('no host gives null', PHONE.defaultUrl({})===null);

  t('plain http is not a secure context', PHONE.secureContextOk({isSecureContext:false,location:{hostname:'192.168.1.157'}})===false);
  t('localhost counts as secure', PHONE.secureContextOk({isSecureContext:false,location:{hostname:'localhost'}})===true);
  t('https counts as secure', PHONE.secureContextOk({isSecureContext:true,location:{hostname:'x'}})===true);

  // ---- page hygiene ---------------------------------------------------------
  t('no stale 8080 in the page', PAGE.indexOf('8080')<0);
  // strip the HTML comment block first — it documents the 1.0 dialect on purpose
  const CODE=PAGE.replace(/<!--[\s\S]*?-->/g,'');
  t('page sends no 1.0 bare messages', !/type:\s*'undo'/.test(CODE)&&!/type:\s*'tool'/.test(CODE));

  console.log(A.join('\n'));
  const p=A.filter(x=>x[0]==='P').length;
  console.log('\n'+p+'/'+A.length+' passed');
  process.exit(p===A.length?0:1);
},30);
