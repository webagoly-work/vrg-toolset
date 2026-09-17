// qr-net-smoke.js — the relay handshake half of 05f-qr.js against the real
// /whoami shape. No jsdom: stubs fetch, localStorage and the few globals the
// probe touches. Encoder correctness is covered by the 23-assertion harness.
const fs=require('fs'), path=require('path');
const SRC=path.join(__dirname,'..','src','05f-qr.js');

const store={};
global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
global.window={};global.document={createElement:()=>({}),body:{appendChild(){},},querySelectorAll:()=>[]};
global.$=()=>null;
global.esc=s=>String(s);
global.t=(k,d)=>d;
global.registerAction=()=>{};
global.actionCtx=()=>({});
global.AbortController=function(){this.signal={};this.abort=()=>{};};

let served={};   // port -> body | 'fail'
global.fetch=(url)=>{
  const m=/:(\d+)\/whoami/.exec(url); const p=m&&m[1];
  const body=served[p];
  if(!body) return Promise.reject(new Error('ECONNREFUSED'));
  return Promise.resolve({ok:true,json:()=>Promise.resolve(body)});
};

const code=fs.readFileSync(SRC,'utf8');
eval(code);
// pull the API off window under different local names — the module already
// declared qrProbe/qrBase/... in this scope via eval()
const NET=global.window.QRNET, probe=global.window.qrProbe,
      base=global.window.qrBase, has=global.window.qrNetHas,
      useAddr=global.window.qrUseAddress, link=global.window.qrLink;

const A=[],t2=(n,c)=>A.push((c?'PASS  ':'FAIL  ')+n);
const reset=()=>{Object.assign(NET,{base:null,port:null,token:'',lan:[],ifaces:[],paths:{},iface:null,matched:false,loopback:false,at:0,state:'idle'});
  delete store['VQR_BASE'];};

const V2={ok:true,app:'varler-phone-relay',v:2,port:47291,
  addresses:['192.168.1.157','192.168.0.100'],
  interfaces:[{name:'WiFi 2',address:'192.168.1.157',netmask:'255.255.255.0',rank:1},
              {name:'Ethernet',address:'192.168.0.100',netmask:'255.255.255.0',rank:2}],
  you:'127.0.0.1',youLoopback:true,primary:'192.168.1.157',primaryIface:'WiFi 2',
  subnetMatched:false,paths:{phone:'/phone-sender.html'}};
const V1={app:'varler-relay',v:1,port:8080,lan:['192.168.1.24'],paths:{phone:'/phone-sender.html',cmd:'/cmd',dl:'/dl'}};

function step(fn){return new Promise(r=>fn(r));}

(async()=>{
  // --- default port list ---
  t2('default ports are the 47291 range', true&&
     fs.readFileSync(SRC,'utf8').includes('47291,47292'));
  t2('no 8080 left in the module', !/8080/.test(code));

  // --- v2 relay on the first port ---
  reset(); served={'47291':V2};
  await step(d=>probe(d));
  t2('finds relay on 47291', NET.state==='up'&&NET.port===47291);
  t2('uses primary, not addresses[0] blindly', base()==='http://192.168.1.157:47291');
  t2('records the interface name', NET.iface==='WiFi 2');
  t2('loopback probe flagged, not treated as mismatch', NET.loopback===true&&NET.matched===false);
  t2('serves phone endpoint', has('phone')===true);
  t2('does NOT serve cmd', has('cmd')===false);
  t2('does NOT serve dl', has('dl')===false);
  t2('qrLink builds a reachable url', link('/phone-sender.html',{})==='http://192.168.1.157:47291/phone-sender.html');

  // --- switching to the alternate address ---
  useAddr('192.168.0.100');
  t2('alternate address switches base', base()==='http://192.168.0.100:47291');
  t2('alternate address updates iface label', NET.iface==='Ethernet');

  // --- port walk: relay moved to 47293 ---
  reset(); served={'47293':Object.assign({},V2,{port:47293})};
  await step(d=>probe(d));
  t2('walks the port range to 47293', NET.port===47293&&NET.state==='up');

  // --- old v1 relay still understood ---
  reset(); served={'47291':V1};
  await step(d=>probe(d));
  t2('v1 relay (lan[], old app name) still works', base()==='http://192.168.1.24:8080');
  t2('v1 advertises cmd, so cmd is allowed', has('cmd')===true);

  // --- something else answering the port ---
  reset(); served={'47291':{app:'grafana',v:9}};
  await step(d=>probe(d));
  t2('foreign service on the port is rejected', NET.state==='down'&&base()===null);

  // --- nothing listening ---
  reset(); served={};
  await step(d=>probe(d));
  t2('no relay leaves base null', base()===null&&NET.state==='down');
  t2('net targets cannot mint a url with no relay', link('/phone-sender.html',{})===null);

  // --- manual override wins ---
  reset(); served={}; store['VQR_BASE']='http://10.0.0.5:47291';
  await step(d=>probe(d));
  t2('manual base overrides the probe', base()==='http://10.0.0.5:47291'&&NET.state==='manual');

  console.log(A.join('\n'));
  const p=A.filter(x=>x[0]==='P').length;
  console.log('\n'+p+'/'+A.length+' passed');
  process.exit(p===A.length?0:1);
})();
