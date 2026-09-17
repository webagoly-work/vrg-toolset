// end-to-end: legacy bare message -> 07a-link -> 07b subscription -> PLANNER_CAM
const fs=require('fs');
global.window={}; global.VERSION='2.0.0';
const evts=[];
const listeners={};
global.document={
  dispatchEvent:e=>evts.push(e),
  addEventListener(t,f){listeners[t]=f;},
  readyState:'complete',
  createElement:()=>({style:{},set innerHTML(v){this._h=v;},get innerHTML(){return this._h;},
    querySelector:()=>({style:{},addEventListener(){},value:''}),appendChild(){}}),
  body:{appendChild(){}}
};
global.KeyboardEvent=function(t,o){Object.assign(this,o,{type:t});};
global.state={mode:'select',active:'ground',flat:false};
global.TOOLKEYS=['select','grab','device','cable','wall','build','object','floor','roof','format'];
global.HINTS={select:'s',grab:'g',device:'d',cable:'c',wall:'w',build:'b',object:'o',floor:'f',roof:'r',format:'F',path:'p',measure:'m',note:'n'};
global.window.innerWidth=1000; global.window.innerHeight=800;
global.window.addEventListener=()=>{};
let ws;
global.WebSocket=function(u){this.url=u;this.readyState=1;ws=this;this.send=()=>{};this.close=()=>{};
  setTimeout(()=>this.onopen&&this.onopen(),0);};

eval(fs.readFileSync('07a-link.js','utf8'));
eval(fs.readFileSync('07b-phone-camera.js','utf8'));

let log=[];
global.window.PLANNER_CAM={
  undo(){log.push('undo');}, redo(){log.push('redo');},
  selectTool(i,k){log.push('tool:'+i+'/'+k); return true;},
  setPitch(v){log.push('pitch');}, setYaw(v){log.push('yaw');},
  zoomBy(f){log.push('zoom:'+f);}, panBy(x,y){log.push('pan:'+x+','+y);},
  pivotAt(){return true;}, pivotCenter(){}, isOverUI(){return false;},
  resetView(){log.push('reset');}
};

global.window.PLANNER_LINK.connect('ws://test');
setTimeout(()=>{
  const feed=r=>ws.onmessage({data:r});
  const A=[],t=(n,c)=>A.push((c?'PASS  ':'FAIL  ')+n);

  log=[]; feed(JSON.stringify({type:'undo'}));            t('legacy {type:undo} reaches PLANNER_CAM.undo', log.join()==='undo');
  log=[]; feed(JSON.stringify({type:'redo'}));            t('legacy {type:redo} reaches PLANNER_CAM.redo', log.join()==='redo');
  log=[]; feed(JSON.stringify({type:'tool',index:4,key:'5'})); t('legacy {type:tool} reaches selectTool', log.join()==='tool:4/5');
  log=[]; feed(JSON.stringify({type:'gesture',kind:'zoompan',scale:1.1,dx:5,dy:-3}));
          t('legacy gesture still zooms and pans', log.join()==='zoom:1.1,pan:5,-3');
  log=[]; feed(JSON.stringify({type:'gesture',kind:'reset'})); t('legacy gesture reset works', log.join()==='reset');
  log=[]; feed(JSON.stringify({type:'orientation',pitch:40,yaw:100,pitchEnabled:true,yawEnabled:true}));
          t('legacy orientation still routes', log.indexOf('pitch')>=0&&log.indexOf('yaw')>=0);
  log=[]; feed(JSON.stringify({v:1,from:'phone',type:'cmd',payload:{id:'edit.undo'}}));
          t('2.0 semantic cmd also reaches undo', log.join()==='undo');
  log=[]; feed(JSON.stringify({v:1,from:'phone',type:'cmd',payload:{id:'tool.select',index:2,key:'3'}}));
          t('2.0 semantic tool.select works', log.join()==='tool:2/3');
  console.log(A.join('\n'));
  const p=A.filter(x=>x[0]==='P').length;
  console.log('\n'+p+'/'+A.length+' passed');
  process.exit(p===A.length?0:1);
},60);
