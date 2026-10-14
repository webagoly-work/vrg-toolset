// spec-45 — endpoint catalogue, circuits and control groups (WP-D1, D4)
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
  WA.push({x0:-50,y0:-50,x1:8050,y1:50},{x0:-50,y0:2950,x1:8050,y1:3050},{x0:-50,y0:-50,x1:50,y1:3050},{x0:7950,y0:-50,x1:8050,y1:3050},{x0:3950,y0:50,x1:4050,y1:2950});
  D().floors.push({level:lvl,name:'NAPPALI',num:'1.04',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]},{level:lvl,name:'SZOBA',num:'1.05',poly:[[4000,0],[8000,0],[8000,3000],[4000,3000]]});
  w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const A=D().floors[0].id;
  const S=w.stkCreate({name:'E'});const L=r=>w.stkLayer(S.id,r).id;
  w.__state.activeLayer=L('sys:SOC');   // M1
  const put=(code,role,x,y,o)=>{role=(role==='sys:MAINS')?w.mnsRoleOf(code):role;const en=w.epEntry(code,role),g=Object.assign({level:lvl,x,y,h:en.h||2700,mount:en.mount},o||{});if(en.mount==='wall'&&g.side==null)g.side=1;return w.epPlace(g,code,role);};
  // ---- D1 ----
  ok('MAINS codes in order: LMP SWI SOC DED SHU',w.epOfRole('sys:MAINS').map(e=>e.code).join(' ')==='LMP SWI SOC DED SHU');
  ok('LMP on bus B is the egress-light entry, variant b',w.epEntry('LMP','sys:BUSB').vars[0].k==='b');
  const scr=w.epMake({level:lvl,x:1,y:1,h:1200},'SCR','sys:MEDIA','aoc'),avp=w.epMake({level:lvl,x:1,y:1,h:300},'AVP','sys:MEDIA');
  ok('SCR/aoc carries two cables, the second in the DATA family',(function(){D().devices.push(scr);const c=w.epCables(scr);D().devices.pop();return c.length===2&&c[1].fam==='DATA'&&c[0].fam==='MEDIA';})());
  ok('the AV position mains cable comes from the board',(function(){D().devices.push(avp);const c=w.epCables(avp);D().devices.pop();return c[0].fam==='MAINS'&&c[0].from==='board'&&c[2].n===2;})());
  const sen=put('SEN','sys:SENSOR',1000,1000);
  ok('a SEN placed while MAINS is active lands on the SENSOR layer',sen.layer===L('sys:SENSOR')&&sen.type==='ep'&&sen.var==='mmwave');
  const l1=put('LMP','sys:MAINS',1000,1500),acp=put('ACP','sys:DATA',2000,1500);
  ok('an LMP is a classic light with a code; an ACP is an ep',l1.type==='light'&&l1.code==='LMP'&&acp.type==='ep');
  const sen2=put('SEN','sys:SENSOR',3000,1000),sen3=put('SEN','sys:SENSOR',6000,1000);
  ok('epRef numbers per room',w.epRef(sen)==='SEN1'&&w.epRef(sen2)==='SEN2'&&w.epRef(sen3)==='SEN1');
  ok('LNR sorts under Lámpák',w.lyrDevCat({type:'ep',code:'LNR'})==='light');
  w.draw();
  ok('the plan shows the code of an ep device',w.document.querySelector('#vp').innerHTML.indexOf('>ACP<')>=0);
  ok('the variant menu changes var, undo restores',(function(){const it=[];w.deviceExtraItems(D().devices.indexOf(sen),it);const co=it.find(x=>/Változat: CO₂/.test(x.label));
    if(!co)return false;co.act();const a=sen.var==='co2';w.doUndo();const s2=D().devices.find(d=>d.id===sen.id);return a&&s2.var==='mmwave';})());
  ok('an endpoint moved to a wrong role layer is flagged',(function(){const s=D().devices.find(d=>d.id===sen.id);s.layer=L('sys:DATA');const v=w.validate().some(x=>x.code==='ep.role'&&x.ref===s.id);s.layer=L('sys:SENSOR');return v;})());
  ok('a wall endpoint is placed on the centreline with its side',(function(){const d=put('SOC','sys:MAINS',0,1000,{side:1});return d.x===0&&d.side===1&&w.epRoomOf(d)===A;})());
  // ---- D4 ----
  w.newBlankProject();
  const WB=w.__getWalls()[lvl];WB.push({x0:-50,y0:-50,x1:4050,y1:50},{x0:-50,y0:2950,x1:4050,y1:3050},{x0:-50,y0:-50,x1:50,y1:3050},{x0:3950,y0:-50,x1:4050,y1:3050});
  D().floors.push({level:lvl,name:'KONYHA',num:'1.02',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});w.ensureIds(D());w.eval('for(const l of ORD)SNAP[l]=centerlines(WALLS[l]);');
  const K=D().floors[0].id,S2=w.stkCreate({name:'F'}),L2=r=>w.stkLayer(S2.id,r).id;
  const put2=(code,role,x,y,side)=>{role=(role==='sys:MAINS')?w.mnsRoleOf(code):role;const en=w.epEntry(code,role);return w.epPlace({level:lvl,x,y,h:en.h||2700,mount:en.mount,side:en.mount==='wall'?(side==null?1:side):undefined},code,role);};
  const s1=put2('SOC','sys:MAINS',0,500),s2=put2('SOC','sys:MAINS',0,1500),s3=put2('SOC','sys:MAINS',0,2500);
  ok('three sockets in no circuit = one implicit room circuit',(function(){const c=w.epCircuits(K);return c.length===1&&c[0].implicit&&c[0].members.length===3;})());
  ok('a real circuit of two leaves the third implicit',(function(){const c=w.cktCreate({name:'Pult'});w.cktAssign(c,s1);w.cktAssign(c,s2);const cs=w.epCircuits(K);
    return cs.length===2&&cs.some(x=>!x.implicit&&x.members.length===2)&&cs.some(x=>x.implicit&&x.members.length===1);})());
  const ded=put2('DED','sys:MAINS',4000,1500,0);
  ok('a DED is its own dedicated circuit',w.epCircuitOf(ded)==='ded:'+ded.id&&w.epCircuits(K).some(c=>c.key==='ded:'+ded.id&&c.dedicated));
  const L1=put2('LMP','sys:MAINS',1000,1000),Lm2=put2('LMP','sys:MAINS',3000,1000),sw1=put2('SWI','sys:MAINS',2000,0),sw2=put2('SWI','sys:MAINS',2500,0);
  w.epCtlPick(sw1);w.epCtlToggle(L1);w.epCtlToggle(Lm2);w.eval('EP_CTL=null');w.epCtlPick(sw2);w.epCtlToggle(Lm2);w.eval('EP_CTL=null');
  ok('lamps grouped by their switch set: [[L1],[L2]]',JSON.stringify(w.epLampGroups(K))===JSON.stringify([[L1.id],[Lm2.id]]),JSON.stringify(w.epLampGroups(K)));
  ok('SWI2 controlling L1 too merges them: [[L1,L2]]',(function(){w.epCtlPick(sw2);w.epCtlToggle(L1);w.eval('EP_CTL=null');const g=w.epLampGroups(K);return g.length===1&&g[0].length===2;})());
  const G=w.epGroupsFor(K,'sys:MAINS');
  ok('MAINS groups: SOC chains by circuit, LMP chain, each SWI star, DED from the board',
    G.filter(g=>g.code==='SOC').length===2&&G.find(g=>g.code==='LMP').topo==='chain'&&G.filter(g=>g.code==='SWI').every(g=>g.topo==='star'&&g.members.length===1)&&G.find(g=>g.code==='DED').from==='board',JSON.stringify(G.map(g=>g.code+':'+g.topo)));
  ok('a classic socket drawn with the old Device tool counts as SOC',(function(){D().devices.push({type:'socket',level:lvl,x:0,y:2000,h:300,side:1,layer:L2('sys:SOC')});w.ensureIds(D());
    const n=w.epGroupsFor(K,'sys:MAINS').filter(g=>g.code==='SOC').reduce((s,g)=>s+g.members.length,0);D().devices.pop();return n===4;})());
  ok('SENSOR groups are one star per device',(function(){put2('SEN','sys:SENSOR',1000,1000);put2('SEN','sys:SENSOR',2000,2000);const g=w.epGroupsFor(K,'sys:SENSOR');return g.length===2&&g.every(x=>x.topo==='star');})());
  ok('one undo removes a ctl edit',(function(){const n=(sw1.ctl||[]).length;w.epCtlPick(sw1);w.epCtlToggle(L1);w.eval('EP_CTL=null');w.doUndo();const s=D().devices.find(d=>d.id===sw1.id);return (s.ctl||[]).length===n;})());
  ok('MAINS checks: a switch that controls nothing',(function(){const s=put2('SWI','sys:MAINS',1000,0);return w.stkCheck(S2,'sys:LIGHT').some(c=>c.msg.indexOf(s.ref)===0&&/nem vezérel/.test(c.msg));})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
