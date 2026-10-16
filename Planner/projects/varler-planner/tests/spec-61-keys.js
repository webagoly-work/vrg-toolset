// spec-61 — the keyboard layout: the camera keys are never captured (round 2026-10-10, WP-U4)
//
// Plain W A S D / Q E used to pan and zoom — except in Move mode with a selection and for a selected object in Select
// mode, where they moved and turned the piece. The selection now moves with Shift + the same keys (or I J K L / U O in
// the 'ijkl' layout), the five stack tools that used Tab moved to ←/→ and R, and Tab is left free for U5.
// Keys are dispatched on document so the registry's capture listener sees them first, as in the browser.
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
  const st=w.__state,D=w.__data;st.zoom=1;st.active=lvl;st.rot=90;st.fineLock=false;
  const key=(k,o)=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{})));
  const obj={level:lvl,x:3000,y:3000,z:0,w:600,d:400,ht:800,ang:0,name:'Asztal',layer:'L0'};D.objects.push(obj);w.ensureIds(D);
  const oi=D.objects.indexOf(obj),selObj=()=>w.__setSel({t:'objects',i:oi});
  const pos=()=>[obj.x,obj.y],pan=()=>[st.panX,st.panY];
  const same=(a,b)=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6;
  // the screen-up direction in plan at the current rotation (what the old WASD used)
  const upDir=()=>{const r=st.rot*Math.PI/180;return [Math.sin(r)*-1,-Math.cos(r)];};

  // 1 — Move mode, an object selected
  w.setMode('grab');selObj();
  {const p0=pos(),q0=pan();key('w');
   ok('w pans the camera and leaves the selected object alone',!same(pan(),q0)&&same(pos(),p0));}
  {const p0=pos(),q0=pan(),u0=w.eval('undo.length');key('W',{shiftKey:true});const d=[obj.x-p0[0],obj.y-p0[1]],u=upDir();
   ok('Shift+W moves the object 100 mm screen-up, the camera stays',same(pan(),q0)&&Math.abs(Math.hypot(d[0],d[1])-100)<1e-6&&Math.abs(d[0]/100-u[0])<1e-6&&Math.abs(d[1]/100-u[1])<1e-6,d.join(','));
   ok('… as one undo step taken before the move (Ctrl+Z puts it back)',w.eval('undo.length')===u0+1&&(function(){w.doUndo();const o=w.__data.objects[oi];return Math.abs(o.x-p0[0])<1e-6&&Math.abs(o.y-p0[1])<1e-6;})());}
  // undo rebuilt the records — re-bind
  const O=()=>w.__data.objects[oi];

  // 2 — fine mode: 10 mm
  {st.fineLock=true;const p0=[O().x,O().y];key('D',{shiftKey:true});const d=Math.hypot(O().x-p0[0],O().y-p0[1]);st.fineLock=false;
   ok('with fine mode on, Shift+D moves 10 mm',Math.abs(d-10)<1e-6,d);}

  // 3 — rotate vs zoom
  {const a0=O().ang||0,z0=st.zoom;key('E',{shiftKey:true});
   ok('Shift+E turns the selection +15°',Math.abs((O().ang||0)-a0-Math.PI/12)<1e-9&&st.zoom===z0);}
  {const a0=O().ang||0,z0=st.zoom;key('e');
   ok('plain e zooms and leaves the angle alone',st.zoom!==z0&&(O().ang||0)===a0);}
  {const a0=O().ang||0;key('Q',{shiftKey:true});ok('Shift+Q turns it back −15°',Math.abs((O().ang||0)-a0+Math.PI/12)<1e-9);}

  // 4 — Select mode, an object selected
  w.setMode('select');selObj();
  {const p0=[O().x,O().y],q0=pan();key('d');ok('Select mode: plain d pans, the object stays',!same(pan(),q0)&&same([O().x,O().y],p0));}
  {const p0=[O().x,O().y];key('A',{shiftKey:true});ok('Select mode: Shift+A moves any selection 100 mm',Math.abs(Math.hypot(O().x-p0[0],O().y-p0[1])-100)<1e-6);}
  {const z0=O().z||0;key('ArrowUp');ok('↑ still lifts a selected object 50 mm',(O().z||0)===z0+50);}
  ok('plain W and D no longer switch tools (camera only); 5 and 3 still do',
     !w.actionForKey('w',w.actionCtx())&&!w.actionForKey('d',w.actionCtx())&&(function(){const m0=st.mode;key('5');const a=st.mode==='wall';key('3');const b=st.mode==='device';
       w.setMode(m0);selObj();return a&&b;})());
  ok('nothing in the registry claims a Shift+W A S D / Q E key',['w','a','s','d','q','e'].every(k=>!w.actionForKey('shift+'+k,w.actionCtx())));
  ok('Ctrl+Shift+W is never a nudge (it closes a Chrome window)',(function(){const p0=[O().x,O().y];key('W',{shiftKey:true,ctrlKey:true});return same([O().x,O().y],p0);})());

  // the Object tool ghost turns on Shift+Q / E, and Q / E zoom
  {w.setMode('object');w.eval('objGhost={level:"ground",x:0,y:0,z:0}');const a0=st.objAng||0,z0=st.zoom;
   key('E',{shiftKey:true});const turned=Math.abs((st.objAng||0)-a0-Math.PI/12)<1e-9;key('q');
   ok('Object tool: Shift+E turns the ghost, plain q zooms',turned&&st.zoom!==z0&&Math.abs((st.objAng||0)-a0-Math.PI/12)<1e-9);
   w.setMode('select');}

  // 5 — the IJKL layout
  st.kbdLayout='ijkl';w.kbdApplyLayout();selObj();
  {const p0=[O().x,O().y],q0=pan();key('l');const r=st.rot*Math.PI/180,ex=[Math.cos(r),-Math.sin(r)];
   ok('ijkl: l moves the selection 100 mm screen-right',same(pan(),q0)&&Math.abs((O().x-p0[0])-100*ex[0])<1e-6&&Math.abs((O().y-p0[1])-100*ex[1])<1e-6);}
  {const a0=O().ang||0;key('o');ok('ijkl: o turns +15°',Math.abs((O().ang||0)-a0-Math.PI/12)<1e-9);}
  ok('ijkl: T is the mark-wall tool, N is circuit picking; M and C stay Move and Cable',(function(){const c=w.actionCtx();
    return (w.actionForKey('t',c)||{}).id==='mark.wall'&&(w.actionForKey('n',c)||{}).id==='circuit.pick'&&(w.actionForKey('m',c)||{}).id==='mode.grab'&&(w.actionForKey('c',c)||{}).id==='mode.cable';})());
  ok('ijkl: J and K start nothing',!w.actionForKey('j',w.actionCtx())&&!w.actionForKey('k',w.actionCtx()));
  ok('ijkl: pressing n starts circuit picking',(function(){w.__setSel(null);key('n');const on=!!w.eval('cktPick');if(on)w.cktPickStop();return on;})());
  ok('ijkl: the hints and the help name the moved keys',(function(){
    const h=w.eval('HINTS.grab'),ck=w.cktPickHint?true:true;w.runAction('help.keys');const help=$('modal').textContent;w.closeModal();
    return /IJKL/.test(h)&&/U\/O/.test(h)&&/\bN\b/.test(help)&&/\bT \/ Shift\+T\b/.test(help)&&/\bIJKL\b/.test(help)&&
      /T váltja/.test(w.actionById('mark.wall').hint)&&/N vagy Esc/.test(w.actionById('circuit.pick').hint);})());
  st.kbdLayout='shift';w.kbdApplyLayout();
  ok('back to Shift: J and K again, T and N free',(function(){const c=w.actionCtx();
    return (w.actionForKey('j',c)||{}).id==='mark.wall'&&(w.actionForKey('k',c)||{}).id==='circuit.pick'&&!w.actionForKey('t',c)&&!w.actionForKey('n',c)&&/J váltja/.test(w.actionById('mark.wall').hint);})());
  ok('Shift layout: plain l / o do nothing to the selection',(function(){selObj();const p0=[O().x,O().y],a0=O().ang;key('l');key('o');return same([O().x,O().y],p0)&&O().ang===a0;})());
  ok('the layout is a Settings choice and survives a save (state)',(function(){w.settingsPanel();const s=$('stKbd');const has=!!s&&[...s.options].map(o=>o.value).join()==='shift,ijkl';
    s.value='ijkl';$('mOk').click();const set=st.kbdLayout==='ijkl'&&(w.actionForKey('t',w.actionCtx())||{}).id==='mark.wall';
    const saved=JSON.parse(JSON.stringify(w.sessionObj())).state.kbdLayout==='ijkl';st.kbdLayout='shift';w.kbdApplyLayout();return has&&set&&saved;})());

  // 6 — RBX tool: ←/→ cycle the class, Tab does not
  w.__setSel(null);w.hwToolStart('rbx');
  {const HW=()=>w.eval('HW_T'),r0=HW().rb,rot0=st.rot;key('ArrowRight');const r1=HW().rb;
   ok('RBX tool: → takes the next RB class, the camera does not turn',r1!==r0&&st.rot===rot0,r0+' → '+r1);
   key('ArrowLeft');ok('RBX tool: ← takes it back',HW().rb===r0);
   key('Tab');ok('RBX tool: Tab does nothing to the class',HW().rb===r0);
   ok('the RBX hint says ←/→, not Tab',/←\/→: osztály/.test($('modeHint').textContent)&&!/Tab/.test($('modeHint').textContent));
   w.hwToolOff();}

  // 7 — ARM tool: R flips the rule, Tab does not
  {const S=w.stkCreate({name:'K'});if(S)w.stkActivate?w.stkActivate(S.id):0;w.armToolStart();
   const A=()=>w.eval('ARM_T');const on=A().on,r0=A().rule;key('r');const r1=A().rule;key('Tab');const r2=A().rule;
   ok('ARM tool: r flips süllyesztett ↔ csatorna, Tab does not',on&&r1!==r0&&r2===r1,on+' '+r0+'→'+r1+'→'+r2);
   ok('the ARM hint says R, not Tab',/R: süllyesztett/.test($('modeHint').textContent)&&!/Tab/.test($('modeHint').textContent));
   key('r');w.setMode('select');}

  // 8 — arrows keep their jobs
  w.setMode('device');
  {const h0=st.drawHKey;key('ArrowUp');ok('↑ in Device mode still steps the drawing height',st.drawHKey!==h0,h0+' → '+st.drawHKey);}
  {const t0=$('devType').value;key('ArrowLeft');ok('← in Device mode still cycles the device type',$('devType').value!==t0);}
  w.setMode('select');
  {const r0=st.rot;key('ArrowRight');ok('→ with nothing else to do still turns the camera 15°',Math.abs(st.rot-r0-15)<1e-9||Math.abs(st.rot-r0+345)<1e-9);}
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
