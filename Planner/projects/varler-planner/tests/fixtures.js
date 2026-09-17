// Deterministic fixture projects. Every golden output is rendered from these, so any refactor
// can be proven to produce byte-identical drawings. Never add randomness or Date.now() here.
const LVL='ground';

function reset(w){
  const WA=w.__getWalls()[LVL];WA.length=0;
  w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;
  w.__data.floors.length=0;w.__data.objects.length=0;w.__data.wallNotes.length=0;
  w.__state.rot=0;w.__state.pitch=30;w.__state.flat=false;w.__state.style='plan';
  w.__state.zoom=1;w.__state.panX=0;w.__state.panY=0;w.__state.active=LVL;
  w.__state.levels={basement:false,ground:true,upper:false};
  w.__state.soloRoom=null;w.__state.showGenObjects=true;w.__state.showDropCeil=true;
  w.DROPC.ground=0;
  return WA;
}

const FIXTURES={
  // 1. the smallest thing that still exercises walls + a room
  empty_room(w){const WA=reset(w);
    WA.push({x0:-100,y0:-100,x1:4300,y1:0},{x0:-100,y0:3200,x1:4300,y1:3300},
            {x0:-100,y0:0,x1:0,y1:3200},{x0:4200,y0:0,x1:4300,y1:3200});
    w.__data.floors.push({level:LVL,poly:[[0,0],[4200,0],[4200,3200],[0,3200]],name:'Nappali',num:'1.01',
      mat:'laminált',fill:'#e8e4d8'});
    return {name:'empty_room'};},

  // 2. openings of every door kind + a window
  openings(w){const WA=reset(w);
    WA.push({x0:0,y0:0,x1:9000,y1:300});
    ['hinged','double','sliding','pocket','folding','garage','fire','opening'].forEach((k,i)=>
      w.__data.openings.push({type:'door',level:LVL,x:600+i*1050,y:150,ang:0,variant:(i%4),w:900,h:2100,dtype:k}));
    w.__data.openings.push({type:'window',level:LVL,x:8600,y:150,ang:0,variant:0,w:1200,h:1500,sill:900});
    return {name:'openings'};},

  // 3. a wall's worth of devices, boxes and a routed path — the elevation editor's bread and butter
  wall_run(w){const WA=reset(w);
    WA.push({x0:0,y0:0,x1:4200,y1:300});
    w.__data.devices.push({type:'socket',ref:'D1',x:600,y:-40,h:300,level:LVL,side:0,devDef:'valena_socket_2p'});
    w.__data.devices.push({type:'switch',ref:'K1',x:2600,y:-40,h:1100,level:LVL,side:0,kind:'106'});
    w.__data.devices.push({type:'junction',ref:'KD1',x:3600,y:-40,h:2200,level:LVL,side:0,jbSize:100,jbShape:'rect'});
    w.__data.devices.push({type:'box',ref:'SZ1',x:1500,y:-40,h:300,level:LVL,side:0,lv:true});
    w.__data.paths.push({nodes:[
      {x:600,y:-40,h:300,level:LVL},{x:2600,y:-40,h:300,level:LVL},
      {x:2600,y:-40,h:1100,level:LVL},{x:2600,y:-40,h:2200,level:LVL},{x:3600,y:-40,h:2200,level:LVL}],
      sections:[{build:'sull_gege'},{build:'sull_gege',dia:25},{build:'sull_gege',dia:32,cd:35},{build:'sull_gege'}]});
    w.__data.devices[0].link={pi:0,ni:0};
    w.__data.wallNotes.push({wallKey:w.wallKey(WA[0],LVL),u:1800,h:1700,text:'gerinc alatt\nkerülni',kind:'warn',tag:'VF-01'});
    return {name:'wall_run',wall:WA[0]};},

  // 4. ceiling ring with a drop to a switch — exercises the plane editor and risers
  ceiling(w){const WA=reset(w);
    const ch=w.wallH(LVL);
    WA.push({x0:-100,y0:-100,x1:4300,y1:0},{x0:-100,y0:3200,x1:4300,y1:3300},
            {x0:-100,y0:0,x1:0,y1:3200},{x0:4200,y0:0,x1:4300,y1:3200});
    w.DROPC.ground=2400;
    w.__data.floors.push({level:LVL,poly:[[0,0],[4200,0],[4200,3200],[0,3200]],name:'Nappali',dropC:2400});
    w.__data.devices.push({type:'light',ref:'L1',x:1400,y:1600,h:ch,level:LVL});
    w.__data.devices.push({type:'light',ref:'L2',x:2800,y:1600,h:ch,level:LVL,
      lampName:'Függeszték',lampW:450,lampD:450,lampHt:250,mount:'fuggesztett',drop:800});
    w.__data.devices.push({type:'junction',ref:'KD1',x:2100,y:600,h:ch,level:LVL,jbSize:100});
    w.__data.devices.push({type:'switch',ref:'K1',x:300,y:3100,h:1100,level:LVL,side:0,kind:'106'});
    w.__data.paths.push({nodes:[{x:2100,y:600,h:ch,level:LVL},{x:1400,y:600,h:ch,level:LVL},{x:1400,y:1600,h:ch,level:LVL}],
      sections:[{build:'sull_gege'},{build:'sull_gege'}]});
    w.__data.paths.push({nodes:[{x:2100,y:600,h:ch,level:LVL},{x:2800,y:600,h:ch,level:LVL},{x:2800,y:1600,h:ch,level:LVL}],
      sections:[{build:'sull_gege',dia:25},{build:'sull_gege',dia:25}]});
    w.__data.paths.push({nodes:[{x:2100,y:600,h:ch,level:LVL},{x:300,y:600,h:ch,level:LVL},
      {x:300,y:3100,h:ch,level:LVL},{x:300,y:3100,h:1100,level:LVL}],
      sections:[{build:'sull_gege'},{build:'sull_gege'},{build:'sull_gege'}]});
    return {name:'ceiling',room:{name:'Nappali',poly:[[0,0],[4200,0],[4200,3200],[0,3200]],dropC:2400,fill:'#e8e4d8'}};},

  // 5. raised geometry: pengefal + podium + a floating wall
  raised(w){const WA=reset(w);
    WA.push({x0:0,y0:0,x1:4200,y1:300},{x0:0,y0:1500,x1:4200,y1:1600,z0:900,h:1200,name:'Pengefal',mat:'gipszkarton'});
    w.__data.floors.push({level:LVL,poly:[[500,2000],[2500,2000],[2500,3000],[500,3000]],name:'Dobogó',z:150,fill:'#dcd6c6'});
    return {name:'raised'};},

  // 6. objects, generated lamp bodies and a board
  objects(w){const WA=reset(w);
    WA.push({x0:0,y0:0,x1:4200,y1:300});
    w.__data.objects.push({level:LVL,x:1000,y:1000,z:0,w:800,d:600,ht:900,ang:0,name:'Szekrény',color:'#c9b79a'});
    w.__data.devices.push({type:'light',ref:'L1',x:2000,y:1500,h:2700,level:LVL,
      lampW:400,lampD:400,lampHt:200,mount:'fuggesztett',drop:600,genId:'fixedgen1'});
    w.__data.objects.push({level:LVL,x:2000,y:1500,z:1900,w:400,d:400,ht:200,ang:0,name:'L1',
      color:'#f2e6b8',genId:'fixedgen1',genFor:'lamp'});
    w.__data.devices.push({type:'board',ref:'EL1',x:3800,y:150,h:2000,level:LVL,z:2000,rw:600,rd:200});
    return {name:'objects'};}
};

module.exports={FIXTURES,LVL,reset};
