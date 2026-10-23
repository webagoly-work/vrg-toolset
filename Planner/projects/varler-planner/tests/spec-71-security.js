// WP-S5 (round 2026-10-10): the security layer's Home Assistant / ESPHome device types.
//
// Fixture: the committed CLA v2 plan (stack, rooms R01…R08, the entrance B107 marked `bejarat`).
// What must hold:
//   * the 10 new codes are complete (role, origin, height or ceiling, real cable codes) and battery
//     variants carry no cable — so they make no run and no "unreached" warning;
//   * room needs and the needs derived from the marks follow MATERIAL §3;
//   * the tier (answer S01): Alap sends MOT / PNC to the room's RBX, Prémium to the SSC; DWC always SSC;
//   * every new code has its own mark; the placement hints land where §3 says.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const PLAN=path.join(__dirname,'..','..','..','..','Calculator','CLA-teszt_v2.vplan.json');
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 const NEW=['MOT','DWC','GLB','SRN','KPD','PNC','LCK','SMK','COA','DBL'];
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const doc=JSON.parse(fs.readFileSync(PLAN,'utf8'));
  w.hardResetWorkspace();w.applyProjectData(doc.project);w.draw();
  const CAT=w.eval('EP_CAT'),CAB=w.eval('AFILL_CABLES'),S=w.eval('stacks')[0];
  const secL=w.eval('layers').find(l=>l.role==='sys:SECURITY'&&l.stack===S.id);

  // ---------- the catalogue ----------
  ok('MOT has four variants',w.epEntry('MOT','sys:SECURITY').vars.length===4);
  ok('every new code: security role, an origin, a height or a ceiling mount',NEW.every(c=>{const e=w.epEntry(c,'sys:SECURITY');
    return e&&e.role==='sys:SECURITY'&&(e.from==='ssc'||e.from==='rbx')&&(e.h>0||e.mount==='ceiling');}),NEW.filter(c=>!w.epEntry(c)).join(','));
  ok('every cable code they use exists in the fill cable table',(function(){const bad=[];
    NEW.forEach(c=>w.epEntry(c).vars.forEach(v=>(v.cab||[]).forEach(k=>{if(!CAB[k.c])bad.push(c+':'+k.c);})));return bad.length?bad.join(','):true;})()===true);
  ok('the third-party SEC code stays',!!w.epEntry('SEC','sys:SECURITY'));
  ok('life safety: SMK and COA name their standard',/EN 14604/.test(w.epEntry('SMK').n)&&/EN 50291/.test(w.epEntry('COA').n));

  // ---------- needs ----------
  const nd=(kind)=>w.needDefaults({kind,name:'X',poly:[[0,0],[1,0],[1,1]]},'sys:SECURITY').codes;
  ok('Előszoba needs DWC KPD SRN MOT',JSON.stringify(nd('eloszoba'))==='["DWC","KPD","SRN","MOT"]',nd('eloszoba').join(','));
  ok('Háló SMK · Konyha SMK · Gépészet SMK COA · Kültér SRN MOT · Közlekedő SMK MOT · Nappali MOT',
    nd('halo').join()==='SMK'&&nd('konyha').join()==='SMK'&&nd('gepeszet').join()==='SMK,COA'&&nd('kulter').join()==='SRN,MOT'&&nd('kozlekedo').join()==='SMK,MOT'&&nd('nappali').join()==='MOT');
  const R01=w.__data.floors.find(f=>f.num==='R01');
  ok('the bejarat door derives DWC, KPD and DBL',(function(){const d=w.needDerived(R01)['sys:SECURITY']||[];
    return ['DWC','KPD','DBL'].every(c=>d.indexOf(c)>=0)?true:d.join(',');})()===true);
  ok('no room still derives the old SEC',w.__data.floors.every(f=>((w.needDerived(f)['sys:SECURITY'])||[]).indexOf('SEC')<0));

  // ---------- battery variants ----------
  const mk=(o)=>{const d=Object.assign({type:'ep',level:'ground',h:2000,layer:secL.id},o);w.__data.devices.push(d);w.eval('ensureIds(data)');return d;};
  const dwcZb=mk({code:'DWC',var:'zb',x:7000,y:3000});
  ok('a battery DWC has no cables (no run, no unreached)',w.epCables(dwcZb).length===0);

  // ---------- tier ----------
  const mot=mk({code:'MOT',var:'pir',x:7500,y:4200}),dwc=mk({code:'DWC',var:'reed',x:7600,y:4200}),pnc=mk({code:'PNC',var:'wired',x:7700,y:4200});
  delete S.secTier;
  ok('Alap (no secTier): MOT and PNC start at the room RBX',w.epCables(mot)[0].from==='rbx'&&w.epCables(pnc)[0].from==='rbx');
  ok('Alap: DWC still starts at the SSC',w.epCables(dwc)[0].from==='ssc');
  const rid=w.roomOfDevice(mot)&&w.stkRoomId(w.roomOfDevice(mot));
  ok('the fill groups carry the tier too',(function(){const g=w.epGroupsFor(rid,'sys:SECURITY',S.id),m=g.find(x=>x.code==='MOT'),d=g.find(x=>x.code==='DWC');
    return m&&d&&m.from==='rbx'&&d.from==='ssc';})());
  ok('Prémium: MOT and PNC go to the SSC',(w.epSecTierSet(S.id,'premium'),w.epCables(mot)[0].from==='ssc'&&w.epCables(pnc)[0].from==='ssc'&&w.epCables(dwc)[0].from==='ssc'));
  ok('the tier change is one undo step',(w.doUndo(),w.eval('stacks')[0].secTier!=='premium'));
  ok('the Security Info offers the tier select and it writes the stack',(function(){const St=w.eval('stacks')[0];w.rliDialog('sys:SECURITY',St.id);
    const sel=w.document.getElementById('rliSecTier');if(!sel)return 'no select';sel.value='premium';sel.onchange();
    const r=w.eval('stacks')[0].secTier==='premium';w.epSecTierSet(St.id,'alap');return r;})()===true);
  ok('the SSC right-click menu has its kind and the tier',(function(){const ssc=mk({type:'ssc',x:1500,y:3000,h:1800,layer:w.eval('layers').find(l=>l.role==='hw').id});
    const items=w.stkDevMenu(w.__data.devices.indexOf(ssc),[]).map(i=>i.label);
    return items.some(t=>/^SSC: ESPHome riasztó-csomópont/.test(t))&&items.some(t=>/^Biztonsági kivitel: Alap/.test(t))?true:items.join(' | ');})()===true);

  // ---------- symbols ----------
  const dev=c=>({type:'ep',code:c,level:'ground',x:0,y:0,h:1000,layer:secL.id});
  const marks=NEW.map(c=>w.icoMarkOf(dev(c))),M=w.eval('ICO_MARK');
  ok('every new code has its own mark',new Set(marks).size===NEW.length&&marks.every(m=>m!=='generic'&&m!=='shield'&&M[m]&&M[m].d.length>10),marks.join(','));
  ok('SMK draws on the ceiling body',w.icoFamOf(dev('SMK'))==='ceiling');

  // ---------- placement hints ----------
  const r01=R01.id;
  const hint=(c,fn)=>(w.sugFor(c,'sys:SECURITY',r01)||[]).filter(fn||(()=>true));
  ok('DWC: a hint at the entrance frame top (2050)',hint('DWC',g=>g.kind==='pt'&&g.h===2050).length>=1);
  ok('KPD: a hint beside the entrance at 1450',hint('KPD',g=>g.kind==='pt'&&g.h===1450).length>=1);
  ok('MOT: a corner hint on a wall that names the doors it sees',hint('MOT',g=>g.kind==='pt'&&g.mount==='wall'&&/ajtó\)/.test(g.why)).length===1);
  ok('SRN: the outdoor hint sits outside the entrance at 2800',hint('SRN',g=>g.kind==='pt'&&g.h===2800).length>=1);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
