// GOLDEN OUTPUT TEST
//
//   node tests/golden.js              → compare against tests/golden.json
//   node tests/golden.js --update     → rewrite the baseline (only when a change is INTENDED)
//
// Every refactor phase must leave these hashes untouched unless the change is deliberate.
// A diff here means the drawing changed; the report tells you which render and by how much.
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const {FIXTURES,LVL}=require('./fixtures.js');

function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),
           path.join(__dirname,'..','planner.html'),
           path.join(__dirname,'..','varler_planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const HTML=findPlanner();
const GOLD=path.join(__dirname,'golden.json');
const UPDATE=process.argv.includes('--update');
const sha=s=>crypto.createHash('sha1').update(String(s)).digest('hex').slice(0,12);

const dom=new JSDOM(fs.readFileSync(HTML,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
try{Object.defineProperty(w,'innerWidth',{value:1600});Object.defineProperty(w,'innerHeight',{value:900});}catch(_){}

setTimeout(()=>{
  const out={};
  const cap=(key,fn)=>{try{const v=fn();out[key]={h:sha(v),n:String(v).length};}
                       catch(e){out[key]={h:'ERROR',n:0,e:e.message.slice(0,80)};}};

  for(const name of Object.keys(FIXTURES)){
    const info=FIXTURES[name](w);
    // the two main scene renders, at a few camera angles
    [0,45,90].forEach(rot=>{w.__state.rot=rot;
      cap(`${name}/scene@${rot}`,()=>{w.__state.style='plan';w.__state.pitch=30;w.__state.flat=false;return w.drawNormalGeom();});});
    w.__state.rot=0;
    cap(`${name}/plan2d`,()=>{w.__state.pitch=90;w.__state.flat=true;return w.drawNormalGeom();});
    cap(`${name}/blueprint`,()=>{w.__state.style='blueprint';w.__state.pitch=90;w.__state.flat=true;
      const v=w.drawBlueprintPlan();w.__state.style='plan';return v;});
    cap(`${name}/blueprintIso`,()=>{w.__state.style='blueprint';w.__state.pitch=30;w.__state.flat=false;
      const v=w.drawBlueprintIso();w.__state.style='plan';w.__state.pitch=30;return v;});
    // editors, where a wall or a room is part of the fixture
    const WA=w.__getWalls()[LVL];
    if(WA.length){const r=info.wall||WA[0];
      cap(`${name}/elevation`,()=>{w.openWallView(r,LVL);
        const v=w.wallElevationSVG(w.wallElevationData(r,LVL),false,true).svg;w.wvCloseEditor(true);return v;});
      cap(`${name}/elevation+far`,()=>{w.openWallView(r,LVL);const WV=w.__WV();WV.far=true;
        const v=w.wallElevationSVG(w.wallElevationData(r,LVL),true,true).svg;w.wvCloseEditor(true);return v;});}
    const room=info.room||(w.__data.floors[0]?{name:w.__data.floors[0].name,poly:w.__data.floors[0].poly}:null);
    if(room){['floor','drop','ceiling'].forEach(kind=>{
      cap(`${name}/plane:${kind}`,()=>{w.openPlaneView(room,LVL,kind);
        const v=w.planeViewSVG(w.planeViewData(room,LVL,kind,300),true).svg;w.wvCloseEditor(true);return v;});});}
    // the numbers that end up in a quote
    cap(`${name}/chaseSummary`,()=>{const WA2=w.__getWalls()[LVL];if(!WA2.length)return 'none';
      w.openWallView(info.wall||WA2[0],LVL);
      const d=w.wallElevationData(info.wall||WA2[0],LVL);
      const o=w.wallElevationSVG(d,false,true);
      const m=o.svg.match(/Véset \(szél[^<]*/g);w.wvCloseEditor(true);return (m||['none']).join(' | ');});
    cap(`${name}/session`,()=>JSON.stringify(w.sessionObj().data));
  }
  cap('version',()=>w.VERSION);

  if(UPDATE||!fs.existsSync(GOLD)){
    fs.writeFileSync(GOLD,JSON.stringify(out,null,1));
    console.log((fs.existsSync(GOLD)?'baseline written':'baseline created')+': '+Object.keys(out).length+' renders');
    console.log('version '+(out.version&&out.version.h?w.VERSION:'?'));
    return;}

  const gold=JSON.parse(fs.readFileSync(GOLD,'utf8'));
  const keys=Array.from(new Set(Object.keys(gold).concat(Object.keys(out))));
  let bad=0,errs=0;
  keys.forEach(k=>{
    const a=gold[k],b=out[k];
    if(!a){console.log('NEW      '+k);bad++;return;}
    if(!b){console.log('MISSING  '+k);bad++;return;}
    if(b.h==='ERROR'){console.log('THREW    '+k+'   ['+b.e+']');errs++;bad++;return;}
    if(a.h!==b.h){console.log('CHANGED  '+k+'   ['+a.n+' → '+b.n+' chars]');bad++;}
  });
  console.log(bad?('\n'+bad+' of '+keys.length+' renders differ'+(errs?' ('+errs+' threw)':'')
                   +'\nIf the change was intended: node tests/golden.js --update')
                : '\nGOLDEN OK — all '+keys.length+' renders byte-identical');
  process.exitCode=bad?1:0;
},700);
