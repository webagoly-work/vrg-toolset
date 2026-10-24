// Simplified UI WP-S2 — the menu engine (src/11t-sm-menu.js), on a fixture tree. Tests 1–11 of docs/simple-ui/WP-S2_menu-engine.md.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const d=w.document;const $=id=>d.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);let max=0;
 const items=()=>{const b=[...$('smMenu').querySelectorAll('.smI')];max=Math.max(max,b.length);return b;};
 const labels=()=>items().map(b=>b.querySelector('.smLb').childNodes[0].textContent);
 const crumb=()=>$('smMenu').querySelector('.smCrumb').textContent;
 const key=(k,o)=>{const e=new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{}));d.body.dispatchEvent(e);};
 try{
  const C={};const act=id=>({id,label:id,group:'Teszt',run:()=>{C[id]=(C[id]||0)+1;}});
  ['t.a1','t.a2','t.a3','t.a4','t.a5','t.a6','t.b1','t.b2','t.c'].forEach(id=>w.registerAction(act(id)));
  w.registerAction({id:'t.off',label:'t.off',group:'Teszt',when:()=>false,need:'Előbb jelölj ki',run:()=>{C['t.off']=1;}});
  w.SM_GEN.boom=()=>{throw new Error('kaboom');};
  const T={k:'root',n:'Menü',items:[
   {k:'A',n:'A',items:[1,2,3,4,5,6].map(i=>({a:'t.a'+i,n:'a'+i,kind:'action'}))},
   {k:'B',n:'B',items:[{a:'t.b1',n:'b1',kind:'stay'},{a:'t.b2',n:'b2',kind:'action'},{a:'t.off',n:'b3',kind:'action'}]},
   {a:'t.c',n:'C',kind:'action'},
   {k:'D',n:'D',gen:'boom'},
   {k:'E',n:'E',items:[{a:'x.y',kind:'action'}]}]};
  w.smSet(true);w.smUseTree(T);
  // 1 — the fixture has 5 root items, so the root pages as 3 + Tovább; test 1 runs on the first four (WP fixture A–D)
  w.smUseTree({k:'root',n:'Menü',items:T.items.slice(0,4)});w.smOpen();
  ok('smOpen: A B C D Bezár',JSON.stringify(labels())==='["A","B","C","D","Bezár"]',labels().join());
  ok('breadcrumb Menü',crumb()==='Menü');
  // 2
  key('2');ok('"2" → B, breadcrumb Menü / B, last slot Vissza',crumb()==='Menü / B'&&labels()[labels().length-1]==='Vissza',crumb());
  // 3
  ok('b3 (disabled) → false, still open',w.smActivate(2)===false&&w.__SM.open);
  ok('slot 3 line2 = Előbb jelölj ki',items()[2].querySelector('small').textContent==='Előbb jelölj ki');
  ok('disabled slot carries aria-disabled + .dis',items()[2].getAttribute('aria-disabled')==='true'&&items()[2].classList.contains('dis'));
  // 4
  w.smActivate(0);ok('b1 (stay) runs once, still open at B',C['t.b1']===1&&w.__SM.open&&crumb()==='Menü / B');
  ok('stay item shows ↺',items()[0].querySelector('.smCh').textContent==='↺');
  // 5
  w.smActivate(1);ok('b2 runs once, menu closed',C['t.b2']===1&&!w.__SM.open);
  // 6
  w.smOpen();w.smActivate(0);
  ok('A page 1 = a1 a2 a3 Tovább Vissza',JSON.stringify(labels())==='["a1","a2","a3","Tovább","Vissza"]',labels().join());
  ok('breadcrumb Menü / A (1/2)',crumb()==='Menü / A (1/2)',crumb());
  w.smActivate(3);ok('Tovább → a4 a5 a6 Vissza',JSON.stringify(labels())==='["a4","a5","a6","Vissza"]',labels().join());
  w.smBack();ok('Back → page 1, focus on Tovább (slot 4)',labels()[0]==='a1'&&items()[3].classList.contains('foc'));
  w.smBack();ok('Back → root',crumb()==='Menü');
  key('Escape');ok('Esc at the root → closed',!w.__SM.open);
  // 7
  const sizes=n=>{const L=Array.from({length:n},(_,i)=>i);const out=[];let p=0,r;do{r=w.smPage(L,p);out.push(r.items.length);p++;}while(r.more);return out.join(',');};
  ok('smPage 5/6/8/10 → [3,2] [3,3] [3,3,2] [3,3,4]',sizes(5)==='3,2'&&sizes(6)==='3,3'&&sizes(8)==='3,3,2'&&sizes(10)==='3,3,4',[5,6,8,10].map(sizes).join(' | '));
  // 8
  let threw=false;try{w.smOpen();w.smActivate(3);}catch(_){threw=true;}
  ok('D: one disabled "Hiba:" slot + Vissza, no throw',!threw&&labels().length===2&&/^Hiba:/.test(labels()[0])&&items()[0].classList.contains('dis')&&labels()[1]==='Vissza',labels().join());
  w.smClose();
  // 9
  let appEsc=0,appZ=0;d.addEventListener('keydown',e=>{if(e.key==='Escape')appEsc++;if(e.key==='z'&&e.ctrlKey)appZ++;});
  w.smOpen();for(let i=0;i<5;i++)key('ArrowDown');
  ok('ArrowDown ×5 from slot 1 wraps to slot 1',items()[0].classList.contains('foc'));
  key('z',{ctrlKey:true});ok('Ctrl+Z passes through while open',appZ===1);
  key('Escape');ok('Esc does not reach the app',appEsc===0&&!w.__SM.open);
  // 10
  w.smOpen();const sel0=JSON.stringify(w.__getSel?w.__getSel():null);
  $('stage').dispatchEvent(new w.Event('pointerdown',{bubbles:true,cancelable:true}));
  ok('pointerdown on #stage closes, selection unchanged',!w.__SM.open&&JSON.stringify(w.__getSel?w.__getSel():null)===sel0);
  // 11
  w.smUseTree(T);w.smOpen();w.smActivate(3);w.smActivate(1);// root page 2 (D, E) → E
  ok('missing action → disabled, "hiányzó parancs: x.y"',items()[0].classList.contains('dis')&&items()[0].querySelector('small').textContent==='hiányzó parancs: x.y',crumb()+' '+labels().join());
  // clicking + the dial
  w.smClose();w.smUseTree({k:'root',n:'Menü',items:T.items.slice(0,4)});
  $('smDial').querySelector('.smQ').dispatchEvent(new w.Event('pointerup',{bubbles:true}));
  ok('the dial opens the menu (depth 1 lit)',w.__SM.open&&$('smDial').querySelectorAll('.smDp.on').length===1);
  items()[2].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));ok('click on C runs it and closes',C['t.c']===1&&!w.__SM.open);
  ok('no render ever had more than 5 items',max<=5,max);
  w.smOpen();w.smSet(false);ok('leaving simple mode closes the menu',!w.__SM.open&&$('smMenu').innerHTML==='');
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x!==''&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
