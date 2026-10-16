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
  w.newBlankProject();
  const D=w.__data,WA=w.__getWalls()[lvl];
  WA.push({x0:3950,y0:0,x1:4050,y1:3000});
  D.floors.push({level:lvl,name:'NAPPALI',num:'1.02',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});
  const add=o=>{D.devices.push(Object.assign({level:lvl,h:300,layer:'L0'},o));w.ensureIds(D);return D.devices[D.devices.length-1];};
  const s1=add({type:'socket',ref:'D1',x:3950,y:1000,side:0});
  const s2=add({type:'socket',ref:'D2',x:3950,y:1072,side:0});
  const s3=add({type:'socket',ref:'D3',x:1000,y:2950});
  const k1=add({type:'switch',ref:'K1',x:3950,y:500,h:1100,side:0});
  const kd=add({type:'junction',ref:'KD1',x:1000,y:1000,h:2500});
  const el=add({type:'board',ref:'EL1',x:500,y:2500,h:2000});
  const di=d=>D.devices.indexOf(d);
  w.draw();

  // ---------- schema ----------
  ok('circuits is an undoable, saved collection',w.eval('UKEYS').indexOf('circuits')>=0&&w.eval('IDPRE').circuits==='A');
  ok('a blank project starts with no circuits',Array.isArray(D.circuits)&&D.circuits.length===0);

  // ---------- kismegszakító ----------
  const M=s=>w.mcbText(w.mcbParse(s));
  ok('the Kalkulátor form reads back unchanged',M('1C 13A')==='1C 13A');
  ok('C13A1P is read as 1C 13A',M('C13A1P')==='1C 13A',M('C13A1P'));
  ok('lower case and pole suffix',M('c16 3p')==='3C 16A',M('c16 3p'));
  ok('a bare B10 is one pole',M('B10')==='1B 10A');
  ok('1P-N keeps its switched neutral',M('1P-N C16A')==='1P-N C16A'&&w.mcbModules(w.mcbParse('1P-N C16A'))===2);
  ok('3P-N takes four modules',w.mcbModules(w.mcbParse('3P-N C20A'))===4);
  ok('a plain pole count is the module count',w.mcbModules(w.mcbParse('2C 6A'))===2&&w.mcbModules(w.mcbParse('1C 13A'))===1);
  ok('a rating without characteristic is refused',!!w.mcbParse('13A').err);
  ok('five poles are refused',!!w.mcbParse('5C 16A').err);
  ok('an empty field means no breaker',w.mcbParse('  ').empty===true);

  // ---------- records ----------
  let a=w.cktCreate({name:'Nappali dugalj'}),b=w.cktCreate({name:'Klíma',dedicated:true});
  ok('ids come from the document counter with prefix A',/^A\d+$/.test(a.id)&&a.id!==b.id,a.id+' '+b.id);
  ok('display refs count from A1',a.ref==='A1'&&b.ref==='A2');
  ok('each new circuit gets a different colour',a.col!==b.col);
  w.cktAssign(a,s1);w.cktAssign(a,s2);
  ok('members are device ids',a.members.join()===s1.id+','+s2.id);
  ok('a multi circuit reports it must be joined in the room',w.cktStatus(a).k==='multi'&&/összekötendő/.test(w.cktStatus(a).t));
  ok('an empty circuit says so',w.cktStatus(b).k==='empty');
  w.cktAssign(b,s3);w.cktAssign(b,k1);
  ok('a dedikált circuit keeps only one end point',b.members.length===1&&b.members[0]===k1.id);
  ok('…and is then ready for Behúzás',w.cktStatus(b).k==='ready');
  w.cktAssign(b,s2);
  ok('a device belongs to one circuit: joining b takes it out of a',w.cktOfDevice(s2)===b&&a.members.indexOf(s2.id)<0);
  ok('Elosztó and kötődoboz are never end points',!w.cktAssign(a,el)&&!w.cktAssign(a,kd)&&!w.cktOfDevice(kd));
  w.cktSetDedicated(b,false);w.cktAssign(b,s3);
  ok('turning dedikált off allows more points',b.members.length===2);
  w.cktSetDedicated(b,true);
  ok('turning it back on keeps the first point',b.members.length===1&&b.members[0]===s2.id);

  // ---------- pick mode ----------
  w.cktPickStart(a.id);
  ok('K starts picking for a circuit',w.cktIsPicking()===a.id&&w.__state.mode==='select');
  ok('the mode hint names the circuit',/A1/.test($('modeHint').textContent));
  w.cktPickToggle(di(s3));
  ok('a click adds the device',w.cktOfDevice(s3)===a);
  w.cktPickToggle(di(s3));
  ok('a second click takes it out',!w.cktOfDevice(s3));
  w.cktPickToggle(di(kd));
  ok('a kötődoboz click is refused with a message',!w.cktOfDevice(kd)&&/Kötődoboz|kötődoboz/.test($('hud').textContent));
  w.cktPickToggle(di(s3));
  ok('undo restores the membership before the click',(function(){w.doUndo();return !w.cktOfDevice(s3);})());
  a=w.cktById(a.id);b=w.cktById(b.id);          // undo replaced the collection with its snapshot
  ok('undo keeps both circuits and their ids',!!a&&!!b&&w.cktOfDevice(s1)===a);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  ok('Esc ends picking',!w.cktIsPicking());
  w.cktPickStart(a.id);w.setMode('path');
  ok('switching to another tool ends picking',!w.cktIsPicking());
  w.setMode('select');
  ok('K is registered on the circuit.pick action',(function(){const x=w.actionForKey('k',w.actionCtx());return x&&x.id==='circuit.pick';})());
  ok('K toggles picking on and off',(function(){w.runAction('circuit.pick');const on=!!w.cktIsPicking();w.runAction('circuit.pick');return on&&!w.cktIsPicking();})());

  // ---------- drawing ----------
  w.draw();let sc=$('lyScene').innerHTML;
  ok('a multi circuit end point gets a dashed ring in its colour',sc.indexOf('stroke="'+a.col+'"')>=0&&/stroke-dasharray/.test(w.cktRingSvg(s1,0,0,1,false)));
  ok('a dedikált end point gets a solid ring',!/stroke-dasharray/.test(w.cktRingSvg(s2,0,0,1,false))&&sc.indexOf('stroke="'+b.col+'"')>=0);
  ok('a device in no circuit has no ring',w.cktRingSvg(s3,0,0,1,false)==='');
  ok('a crafted colour cannot reach the SVG',(function(){const keep=a.col;a.col='red" onload="x';const s=w.cktRingSvg(s1,0,0,1,false);a.col=keep;return s.indexOf('onload')<0;})());
  w.layerById('L0').tint='#ff0000';w.draw();sc=$('lyScene').innerHTML;
  ok('a tinted layer colours its device bodies',sc.indexOf('fill="'+w.tintMix('#ff0000',0.45)+'"')>=0,w.tintMix('#ff0000',0.45));
  delete w.layerById('L0').tint;w.draw();
  ok('clearing the tint restores white bodies',$('lyScene').innerHTML.indexOf(w.tintMix('#ff0000',0.45))<0);

  // ---------- inspector ----------
  w.setStage('circuits');w.__setSel(null);w.renderShell();
  ok('there is an Áramkörök stage after Kiosztás',w.STAGES.map(s=>s.k).join()==='build,rooms,devices,circuits,paths,doc');
  ok('the stage lists the circuits as cards',$('inspector').querySelectorAll('.ckCard').length===2);
  ok('a card click starts picking that circuit',(function(){$('inspector').querySelector('.ckCard[data-ck="'+b.id+'"]').onclick({target:{dataset:{}}});
    const on=w.cktIsPicking()===b.id;w.cktPickStop();return on;})());
  w.__setSel({t:'devices',i:di(s1),level:lvl});w.renderShell();
  ok('a selected device shows its circuit',/A1/.test($('inspector').textContent)&&/Nappali dugalj/.test($('inspector').textContent));
  ok('the release action is offered for it',!!$('inspector').querySelector('.insA[data-id="circuit.release"]'));

  ok('a new empty circuit is flagged at once, though the drawing did not change',(function(){w.__setSel(null);w.renderShell();
    w.runAction('circuit.new');w.runAction('circuit.pick');w.renderShell();
    const shown=/nincs végpontja/.test($('inspector').textContent);w.doUndo();w.renderShell();
    a=w.cktById(a.id);b=w.cktById(b.id);w.__setSel({t:'devices',i:di(s1),level:lvl});return shown;})());

  // ---------- edit dialog ----------
  w.runAction('circuit.edit');
  ok('the edit dialog previews the DIN modules',(function(){$('ckMcb').value='C16A1P+N';$('ckMcb').oninput();return /1P-N C16A · 2 modul/.test($('ckMcbOut').textContent);})(),$('ckMcbOut')&&$('ckMcbOut').textContent);
  ok('an invalid breaker keeps the dialog open',(function(){$('ckMcb').value='16A';$('mOk').onclick();return !!$('ckMcb')&&/⚠/.test($('ckMcbOut').textContent);})());
  ok('saving stores the breaker in Kalkulátor form',(function(){$('ckMcb').value='c13a1p';$('ckName').value='Nappali aljzatok';$('mOk').onclick();
    return w.mcbText(a.mcb)==='1C 13A'&&a.name==='Nappali aljzatok';})());

  // ---------- export ----------
  const X=w.cktExportObj();
  ok('export is tagged for other tools',X.format==='vrg-circuits'&&X.version===1);
  ok('export totals DIN modules and counts breakers by type',X.totals.modules===1&&X.totals.byMcb['1C 13A']===1,JSON.stringify(X.totals));
  ok('export members carry ref, room and layer',(function(){const m=X.circuits.find(c=>c.id===a.id).members.find(x=>x.id===s1.id);
    return m&&m.ref==='D1'&&m.room&&m.room.num==='1.02'&&m.layer==='L0';})());

  // ---------- deletion + save ----------
  D.devices.splice(di(s1),1);
  ok('a deleted device simply stops resolving',w.cktMembers(a).every(d=>d.id!==s1.id));
  ok('circuits survive a save and reload',(function(){const o=JSON.parse(JSON.stringify(w.sessionObj()));w.applyProjectData(o);
    return w.__data.circuits.length===2&&w.__data.circuits[0].name==='Nappali aljzatok';})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
