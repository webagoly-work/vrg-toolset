// linkpanel-smoke.js — 07d-linkpanel.js discovery and state machine, plus the
// guarantee that 07b no longer builds any UI.
const fs=require('fs'),path=require('path');
const SRC=path.join(__dirname,'..','src');
const A=[],t=(n,c)=>A.push((c?'PASS  ':'FAIL  ')+n);

// ---- minimal DOM ------------------------------------------------------------
function El(tag){return {tag:tag,style:{},dataset:{},_h:'',classList:{_s:new Set(),
  add(c){this._s.add(c);},remove(c){this._s.delete(c);},
  toggle(c,on){on?this._s.add(c):this._s.delete(c);},contains(c){return this._s.has(c);}},
  set className(v){this.classList._s=new Set(String(v).split(/\s+/).filter(Boolean));},
  get className(){return Array.from(this.classList._s).join(' ');},
  set innerHTML(v){this._h=v;},get innerHTML(){return this._h;},
  set textContent(v){this._t=v;},get textContent(){return this._t;},
  insertAdjacentHTML(p,h){this._h+=h;},
  querySelectorAll(){return [];},querySelector(){return null;},
  appendChild(){},addEventListener(){},onclick:null};}
const nodes={};
global.window={};
global.document={readyState:'complete',
  createElement:t=>El(t),head:{appendChild(){}},body:{appendChild(){}},
  addEventListener(){},
  getElementById:id=>nodes[id]||(nodes[id]=El('div'))};
const store={};
global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=v;},removeItem:k=>{delete store[k];}};
global.navigator={clipboard:{writeText(){}}};
global.registerActions=l=>{global.__acts=l;};
global.setInterval=()=>0; global.clearInterval=()=>{};
global.AbortController=function(){this.signal={};this.abort=()=>{};};

let served={};
global.fetch=url=>{
  const m=/:(\d+)\/whoami/.exec(url); const b=served[m&&m[1]];
  if(!b) return Promise.reject(new Error('refused'));
  return Promise.resolve({json:()=>Promise.resolve(b)});
};

// stub link module
let connectedTo=null, status={connected:false,peer:null,url:null};
global.window.PLANNER_LINK={
  connect:u=>{connectedTo=u;status={connected:true,peer:null,url:u};return true;},
  disconnect:()=>{connectedTo=null;status={connected:false,peer:null,url:null};},
  status:()=>status, onStatus:()=>status,
  stats:()=>({in:7,out:3,lastIn:'gesture',lastInAt:Date.now()-400,bad:0})
};

eval(fs.readFileSync(path.join(SRC,'07d-linkpanel.js'),'utf8'));
const P=global.window.PLANNER_PANEL;

const V2={ok:true,app:'varler-phone-relay',v:3,port:47291,
  addresses:['192.168.1.157','192.168.0.100'],
  interfaces:[{name:'WiFi 2',address:'192.168.1.157'},{name:'Ethernet',address:'192.168.0.100'}],
  primary:'192.168.1.157',primaryIface:'WiFi 2',subnetMatched:false,youLoopback:true,
  paths:{phone:'/phone-sender.html',cmd:'/cmd',dl:'/dl'}};

const step=fn=>new Promise(r=>fn(r));

(async()=>{
  // ---- url derivation -------------------------------------------------------
  t('http base becomes a ws url', P.wsUrl('http://192.168.1.157:47291')==='ws://192.168.1.157:47291');
  t('trailing slash trimmed', P.wsUrl('http://x:1/')==='ws://x:1');
  t('null in, null out', P.wsUrl(null)===null);

  // ---- discovery ------------------------------------------------------------
  served={'47291':V2};
  let f=await step(d=>P.probe(d));
  t('finds the relay on the first port', !!f && f.port===47291);
  t('uses the address the relay says this client can reach', f.base==='http://192.168.1.157:47291');
  t('keeps the interface name', f.iface==='WiFi 2');
  t('keeps the alternates', f.addresses.length===2);

  served={'47294':Object.assign({},V2,{port:47294})};
  f=await step(d=>P.probe(d));
  t('walks the port range', !!f && f.port===47294);

  served={'47291':{app:'grafana'}};
  f=await step(d=>P.probe(d));
  t('rejects a foreign service on the port', f===null);

  served={};
  f=await step(d=>P.probe(d));
  t('no relay returns null', f===null);
  t('state reports norelay', P.state()==='norelay');

  // ---- connect --------------------------------------------------------------
  served={'47291':V2};
  await step(d=>P.probe(d));
  connectedTo=null;
  P.connect();
  t('connects to the derived ws url, nothing typed', connectedTo==='ws://192.168.1.157:47291');
  t('remembers it', store['varler_link_url']==='ws://192.168.1.157:47291');
  t('state is waiting until the phone says hello', P.state()==='waiting');
  status.peer={role:'phone',app:'2.0-b',caps:['state','cmd']};
  t('state is paired once a peer exists', P.state()==='paired');

  P.disconnect();
  t('disconnect clears the saved url', !('varler_link_url' in store));
  t('disconnect drops the socket', connectedTo===null);

  // ---- actions --------------------------------------------------------------
  t('three panel actions registered', (global.__acts||[]).length===3);
  t('actions namespaced link.*', (global.__acts||[]).every(a=>a.id.indexOf('link.')===0));

  // ---- source guarantees ----------------------------------------------------
  const b=fs.readFileSync(path.join(SRC,'07b-phone-camera.js'),'utf8');
  t('07b builds no widget', b.indexOf('buildWidget')<0 && b.indexOf('phoneCamWidget')<0);
  t('07b has no connect box', b.indexOf('pcUrl')<0 && b.indexOf('Csatlakozás')<0);
  t('07b keeps the camera handlers', /L\.on\('orientation'/.test(b)&&/L\.on\('gesture'/.test(b));
  t('07b keeps the legacy control bridge', /L\.on\('undo'/.test(b)&&/L\.on\('tool'/.test(b));
  t('07b no longer references the removed dom', !/setDot|dotEl|updateWidgetIcons/.test(b));

  const d=fs.readFileSync(path.join(SRC,'07d-linkpanel.js'),'utf8');
  t('panel encodes the http url, not ws', /Encodes the HTTP address/.test(d));
  t('panel is honest that it cannot start a process', /cannot start a process/.test(d));

  const link=fs.readFileSync(path.join(SRC,'07a-link.js'),'utf8');
  t('link module exposes traffic stats', /stats: function/.test(link));

  console.log(A.join('\n'));
  const p=A.filter(x=>x[0]==='P').length;
  console.log('\n'+p+'/'+A.length+' passed');
  process.exit(p===A.length?0:1);
})();
