// Simplified UI WP-S4 — search, the ⌘K half (src/11t-sm-menu.js), on the real tree. Tests 1–9 of docs/simple-ui/WP-S4_search.md.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const d=w.document;const $=id=>d.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 const items=()=>[...$('smMenu').querySelectorAll('.smI')];
 const labels=()=>items().map(b=>b.querySelector('.smLb').childNodes[0].textContent);
 const key=(k,o)=>d.body.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{})));
 const top=r=>r&&r[0]?(r[0].a||r[0].n):'(none)';
 try{
  w.smSet(true);
  // 1–3
  ok('ajto → wf.door',top(w.smSearch('ajto'))==='wf.door',top(w.smSearch('ajto')));
  const vz=w.smSearch('vizes');ok('vizes → wf.rule.vizes, path Épület / Szabályok / Szabálykészlet / Egyéb területek',
   top(vz)==='wf.rule.vizes'&&vz[0].path==='Épület / Szabályok / Szabálykészlet / Egyéb területek',top(vz)+' | '+(vz[0]&&vz[0].path));
  ok('kapcs → wf.switches',top(w.smSearch('kapcs'))==='wf.switches',w.smSearch('kapcs').slice(0,4).map(e=>e.a).join());
  // 4
  ok('zzqx → []',w.smSearch('zzqx').length===0);
  w.smOpen();key('z');key('z');key('q');key('x');
  ok('rendered: Nincs találat (disabled) + Vissza',labels().join()==='Nincs találat,Vissza'&&items()[0].classList.contains('dis'),labels().join());
  w.smClose();
  // 5
  ok('a legacy action is found: kabel → mode.cable',w.smSearch('kabel').some(e=>e.a==='mode.cable'));
  // 6
  w.smOpen();key('l');key('a');key('m');ok('typing l a m while browsing → SM.q lam',w.__SM.q==='lam');
  ok('the dial core shows ⌕ while searching',$('smDial').querySelector('.smGl').textContent==='⌕');
  ok('line 2 of a hit is its path',items()[0].querySelector('small')&&items()[0].querySelector('small').textContent.length>0);
  key('Backspace');key('Backspace');key('Backspace');
  ok('Backspace ×3 → browse at the root',w.__SM.q==null&&w.__SM.open&&labels()[0]==='Épület',String(w.__SM.q)+' '+labels().join());
  // 7
  const vp=w.smSearch('vegpont');ok('vegpont has more than 4 hits ('+vp.length+')',vp.length>4);
  key('v');key('e');key('g');key('p');key('o');key('n');key('t');for(let i=0;i<4;i++)key('ArrowDown');   // WP says ×5; slots 1→4 take 3 presses, the 4th scrolls (WP rule 'past slot 4')
  const cnt=$('smMenu').querySelector('.smCount').textContent;
  ok('↓ ×4 → SM.win 1, the line reads 2–5 / '+vp.length,w.__SM.win===1&&cnt==='2–5 / '+vp.length,w.__SM.win+' "'+cnt+'"');
  ok('the focus stays on slot 4',items()[3].classList.contains('foc'));
  key('Escape');ok('Esc → back to browse',w.__SM.q==null&&w.__SM.open);w.smClose();
  // 8
  key('k',{ctrlKey:true});ok('Ctrl+K in simple mode → open, SM.q empty',w.__SM.open&&w.__SM.q==='');
  ok('the palette did not open',!w.paletteIsOpen());
  w.smClose();w.smSet(false);key('k',{ctrlKey:true});ok('Ctrl+K in normal mode → the palette opens',w.paletteIsOpen());w.paletteClose();
  // 9
  w.registerAction({id:'t.zzA',label:'Zümzümtesztelő',group:'Teszt',when:()=>false,run:()=>{}});
  w.registerAction({id:'t.zzB',label:'Zümzümtesztelő',group:'Teszt',run:()=>{}});
  const zz=w.smSearch('zumzum').map(e=>e.a);ok('a disabled hit sorts after an enabled one of equal score',zz.indexOf('t.zzB')>=0&&zz.indexOf('t.zzB')<zz.indexOf('t.zzA'),zz.join());
  // a hit activates through runAction and closes
  w.smSet(true);w.smOpen();['a','j','t','o'].forEach(k=>key(k));key('Enter');
  ok('Enter on the ajto hit runs wf.door and closes',!w.__SM.open&&w.__state.mode==='build',w.__state.mode);
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x!==''&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
