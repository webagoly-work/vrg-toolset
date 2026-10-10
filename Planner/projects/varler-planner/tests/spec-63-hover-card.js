// spec-63 — the device hover card, "Lebegő infó (eszközök)" (round 2026-10-10, WP-U6)
//
// With state.devHover on, pointing at a device in Select / Move shows a card: name, type, circuit, layer, room,
// height, extras. One floating box (#thumbPop, shared with the lamp photo), a 120 ms dwell, nothing for a device
// that is not drawn (U1's hitOk through devHitIdx).
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
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  const lvl='ground';w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const st=w.__state,D=w.__data,stage=$('stage');st.zoom=1;st.active=lvl;st.devHover=false;w.setMode('select');
  const S=w.stkCreate({name:'H'});const LM=w.eval('layers').find(l=>l.role==='sys:MAINS');
  D.floors.push({level:lvl,poly:[[0,0],[4000,0],[4000,4000],[0,4000]],num:'R03',name:'Konyha',layer:'L0'});
  const sock={type:'socket',level:lvl,x:2000,y:2000,h:300,layer:LM?LM.id:'L0',side:0,ref:'D7'};D.devices.push(sock);w.ensureIds(D);
  D.circuits=D.circuits||[];D.circuits.push({id:'C9',ref:'A3',name:'Konyha dugalj',mcb:{poles:1,curve:'C',amps:16},members:[sock.id]});
  const F=o=>{const r={};w.hovFacts(o).forEach(x=>r[x.k]=x.v);return r;};

  // 1 — the facts of a socket
  const f=F(sock);
  ok('title = ref · name',(w.hovFacts(sock)[0]||{}).v==='D7 · Aljzat',(w.hovFacts(sock)[0]||{}).v);
  ok('Típus row',!!f['Típus'],f['Típus']);
  ok('Áramkör = A3 … · 1C 16A',/^A3 .* · 1C 16A$/.test(f['Áramkör']||''),f['Áramkör']);
  ok('Réteg names the stack Erősáram layer',/Erősáram/.test(f['Réteg']||''),f['Réteg']);
  ok('Helyiség = R03 Konyha',f['Helyiség']==='R03 Konyha',f['Helyiség']);
  ok('Magasság = 300 mm · alacsony',f['Magasság']==='300 mm · alacsony',f['Magasság']);
  ok('at most 8 rows, none empty',w.hovFacts(sock).length<=8&&w.hovFacts(sock).every(r=>r.v!==''));
  {const c=D.circuits.pop(),r=F(sock);D.circuits.push(c);
   ok('without an explicit circuit the card names the implicit stack one (the room sockets)',r['Áramkör']==='R03 Konyha dugalj',r['Áramkör']);}

  // 2 — RBX
  {const rbx={type:'rbx',level:lvl,x:1000,y:3900,h:1900,rb:'RB-H',layer:'L0'};D.devices.push(rbx);w.ensureIds(D);
   const t=F(rbx)['Típus']||'';ok('RBX: Típus names RB-H and 600 × 600',/RB-H/.test(t)&&/600 × 600/.test(t),t);
   ok('RBX: magas zone at 1900',/magas/.test(F(rbx)['Magasság']||''));D.devices.pop();}
  ok('a ceiling lamp is in the mennyezet zone',(function(){const l={type:'light',level:lvl,x:1,y:1,h:w.wallH(lvl),layer:'L0'};return /mennyezet/.test(F(l)['Magasság']||'');})());

  // 3 — the toggle, the dwell, the box
  let tgt=w.planToBase(sock.x,sock.y,w.dz(lvl,sock.h));w.clientToBase=()=>tgt;
  const move=()=>stage.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,clientX:300,clientY:200,buttons:0}));
  const pop=()=>$('thumbPop'),shown=()=>!!pop()&&pop().style.display==='block';
  move();await sleep(180);
  ok('devHover off → no card over a socket',!shown());
  $('devHover').checked=true;$('devHover').dispatchEvent(new w.Event('change'));
  ok('the checkbox turns state.devHover on',st.devHover===true);
  move();ok('no card before the dwell',!shown());
  await sleep(180);
  ok('the card shows after 120 ms, next to the pointer',shown()&&pop().style.left==='316px'&&/D7 · Aljzat/.test(pop().textContent)&&/1C 16A/.test(pop().textContent),pop()&&pop().style.left);
  ok('one floating box only',w.document.querySelectorAll('#thumbPop').length===1);
  stage.dispatchEvent(new w.MouseEvent('pointerdown',{bubbles:true,clientX:300,clientY:200,button:0,buttons:1}));
  stage.dispatchEvent(new w.MouseEvent('pointerup',{bubbles:true,clientX:300,clientY:200,button:0}));
  ok('pointerdown hides it',!shown());
  move();await sleep(180);w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  ok('Esc hides it',!shown());
  move();await sleep(40);w.setMode('select');await sleep(150);
  ok('a mode change during the dwell cancels it',!shown());

  // 4 — not drawn, not shown
  w.eval('layers').find(l=>l.id===sock.layer).visible=false;
  move();await sleep(180);
  ok('hidden layer → no card (U1)',!shown());
  w.eval('layers').find(l=>l.id===sock.layer).visible=true;
  tgt=w.planToBase(9000,9000,w.dz(lvl,0));move();await sleep(180);
  ok('nothing under the pointer → no card',!shown());

  // the lamp photo rides on the card
  {const lp={type:'light',level:lvl,x:3000,y:1000,h:2600,layer:'L0',thumb:'data:image/png;base64,AAAA',lampName:'Spot'};D.devices.push(lp);w.ensureIds(D);
   w.hovShow(lp,10,10);ok('a lamp with a photo shows it on top of the facts',!!pop().querySelector('img')&&/Spot/.test(pop().textContent));w.hovHide();D.devices.pop();}
  ok('Lebegő infó is a registered action, separate from the circuit panel\'s labels',(function(){const a=w.actionById('layers.hoverInfo');
    const on=st.devHover;w.runAction('layers.hoverInfo');const r=!!a&&st.devHover===!on&&$('devHover').checked===st.devHover;w.runAction('layers.hoverInfo');return r;})());
  ok('the setting saves with the project',JSON.parse(JSON.stringify(w.sessionObj())).state.devHover===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
