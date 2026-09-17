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
  D.floors.push({level:lvl,name:'HÁLÓ',poly:[[4000,0],[7000,0],[7000,3000],[4000,3000]]});
  const add=o=>{D.devices.push(Object.assign({level:lvl,h:300},o));w.ensureIds(D);return D.devices[D.devices.length-1];};
  // created in this order — the ids decide the numbering, the old refs are deliberately scrambled
  const s1=add({type:'socket',kind:'2pf',ref:'D9',x:3950,y:1000,side:0});
  const l1=add({type:'light',ref:'L7',x:2000,y:1500,h:2700});
  const s2=add({type:'socket',kind:'utp',ref:'D1',x:3950,y:2000,side:0});
  const k1=add({type:'switch',kind:'101',x:3950,y:500,h:1100,side:0});          // no ref at all
  const bx=add({type:'junction',jbShape:'circle',jbSize:80,ref:'KD4',x:1000,y:1000,h:2500});
  const el=add({type:'board',ref:'EL1',x:500,y:2500,h:2000});
  const hs=add({type:'socket',kind:'2pf',ref:'1.02-D2',x:4050,y:1000,side:1});  // HÁLÓ, already holds a NAPPALI-looking ref
  s1.link={p:'P1',n:'n1'};
  w.draw();
  const A={rm:D.floors[0],src:'F',i:0,level:lvl},B={rm:D.floors[1],src:'F',i:1,level:lvl};
  const base={projekt:'',szam:'1.02',nev:'NAPPALI',szint:lvl,tipus:'D',n:1};
  const F=(tpl,o)=>w.fillRefTpl(tpl,Object.assign({},base,o||{}));

  // ---------- template ----------
  ok('default template gives 1.02-D1',F(w.ROOM_REF_TPL)==='1.02-D1',F(w.ROOM_REF_TPL));
  ok('{nn} pads to two digits',F('{szám}-{típus}{nn}')==='1.02-D01');
  ok('tokens work without accents too',F('{szam}-{tipus}{n}')==='1.02-D1');
  ok('project code prefixes when set',F('{projekt}-{szám}-{típus}{n}',{projekt:'P33'})==='P33-1.02-D1');
  ok('an empty project code takes its separator with it',F('{projekt}-{szám}-{típus}{n}')==='1.02-D1',F('{projekt}-{szám}-{típus}{n}'));
  ok('two empty leading tokens leave no stray dash',F('{projekt}-{szám}-{típus}{n}',{szam:''})==='D1',F('{projekt}-{szám}-{típus}{n}',{szam:''}));
  ok('an empty token in the middle is closed up',F('{projekt}-{szám}-{típus}{n}',{projekt:'P33',szam:''})==='P33-D1');
  ok('an unknown token is left visible, not swallowed',F('{szám}-{foo}{n}')==='1.02-{foo}1');

  // ---------- plan ----------
  const plan=w.planRoomRenumber(A);
  const refOf=d=>(plan.rows.find(r=>r.dev===d)||{}).ref;
  ok('sockets count in id order, ignoring their old refs',refOf(s1)==='1.02-D1'&&refOf(s2)==='1.02-D2',refOf(s1)+' '+refOf(s2));
  ok('each type counts from 1',refOf(l1)==='1.02-L1'&&refOf(k1)==='1.02-K1'&&refOf(bx)==='1.02-KD1');
  ok('the Elosztószekrény is skipped by default',!plan.rows.some(r=>r.dev===el));
  ok('…and numbered when asked',(w.planRoomRenumber(A,{skipBoard:false}).rows.find(r=>r.dev===el)||{}).ref==='1.02-EL1');
  ok('the neighbour room\'s devices are not in the plan',!plan.rows.some(r=>r.dev===hs));
  ok('planning changes nothing',s1.ref==='D9'&&k1.ref===undefined);
  ok('a ref already used in another room is warned about',plan.warn.some(m=>/1\.02-D2/.test(m)),plan.warn.join(' | '));
  ok('a template without {n} is blocked',!!w.planRoomRenumber(A,{tpl:'{szám}-{típus}'}).block);
  ok('a room with no number uses its name and says so',(function(){const p=w.planRoomRenumber(B);
    return p.rows[0].ref==='HÁLÓ-D1'&&p.warn.some(m=>/nincs száma/.test(m));})());

  // ---------- apply + undo ----------
  const ids=D.devices.map(d=>d.id).join();
  const n=w.applyRoomRenumber(plan);
  ok('apply rewrites the refs',s1.ref==='1.02-D1'&&s2.ref==='1.02-D2'&&k1.ref==='1.02-K1'&&l1.ref==='1.02-L1');
  ok('apply reports how many changed',n===5,n);
  ok('ids are untouched',D.devices.map(d=>d.id).join()===ids);
  ok('links are untouched',s1.link&&s1.link.p==='P1'&&s1.link.n==='n1');
  ok('the board and the neighbour keep their refs',el.ref==='EL1'&&hs.ref==='1.02-D2');
  ok('renumbering again changes nothing',w.planRoomRenumber(A).rows.every(r=>!r.changed));
  ok('one undo restores every old ref',(function(){w.doUndo();
    const d=w.__data.devices,by=id=>d.find(x=>x.id===id);
    return by(s1.id).ref==='D9'&&by(s2.id).ref==='D1'&&!by(k1.id).ref&&by(l1.id).ref==='L7';})());

  // ---------- surfaces ----------
  ok('the action exists in the Helyiség group',(function(){const a=w.ACTIONS.find(x=>x.id==='room.renumber');return a&&a.group==='Helyiség';})());
  ok('it needs a room selected',(function(){w.__setSel(null);const off=!w.runAction('room.renumber');
    w.__setSel({t:'floors',i:0,level:lvl});return off;})());
  ok('the inspector offers it for a room',(function(){w.renderShell();
    return !!$('inspector').querySelector('.insA[data-id="room.renumber"]');})());
  ok('the room right-click menu offers it',w.roomMenuItems({rm:w.__data.floors[0],src:'F',i:0,level:lvl}).some(it=>/átszámozása/.test(it.label)));
  ok('the dialog previews the new refs',(function(){w.runAction('room.renumber');
    return /1\.02-D1/.test($('rrPrev').textContent)&&/1\.02-KD1/.test($('rrPrev').textContent);})());
  ok('editing the template updates the preview',(function(){$('rrTpl').value='{projekt}-{szám}.{típus}{nn}';$('rrTpl').oninput();
    return /1\.02\.D01/.test($('rrPrev').textContent);})());
  ok('a blocking template disables Átszámozás',(function(){$('rrTpl').value='{szám}';$('rrTpl').oninput();
    const dis=$('mOk').disabled;$('rrTpl').value='{szám}.{típus}{nn}';$('rrTpl').oninput();return dis&&!$('mOk').disabled;})());
  ok('Átszámozás applies and remembers the template',(function(){$('mOk').onclick();
    const d=w.__data.devices.find(x=>x.id===s1.id);return d.ref==='1.02.D01'&&w.__state.roomRefTpl==='{szám}.{típus}{nn}';})());
  ok('the reset button restores the default template',(function(){w.runAction('room.renumber');$('rrDef').onclick();
    const v=$('rrTpl').value===w.ROOM_REF_TPL;$('mOk').onclick();return v&&w.__state.roomRefTpl===undefined;})());
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
