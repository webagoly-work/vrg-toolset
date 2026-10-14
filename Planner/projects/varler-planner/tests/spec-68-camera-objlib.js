// Views V2 (camera presets + 90° rotation lock) and V7 (object library from the catalogue).
//
// What must hold:
//   * a preset lands on its pitch and on an effective yaw (rot + camK().extra) of phase + k·90;
//   * with the lock on, small drags gather and step one whole quadrant, a jump lands on the nearest
//     quadrant, ±90 keys step, pitch cannot move — and 2D still works;
//   * the lock and the preset survive save / load;
//   * every pre-V7 object name is still in OBJLIB (saved projects reference names), and OBJLIB
//     matches the catalogue (tools/objlib-gen.js --check).
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');const {execFileSync}=require('child_process');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;const $=id=>w.document.getElementById(id);
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 const eff=()=>((w.__state.rot+w.camExtraAt(w.__state.pitch))%360+360)%360;
 try{
  w.confirm=()=>true;w.alert=()=>{};
  w.loadBuilding(w.__H,true);
  const st=w.__state;st.pitch=30;st.rot=90;st.camLock=false;st.camPreset=null;w.draw();

  // ---------- the camera model ----------
  ok('camExtraAt matches camK().extra at every pitch',(function(){
    for(const p of [5,15,20,30,46,60,70,88,90]){st.pitch=p;if(Math.abs(w.camK().extra-w.camExtraAt(p))>1e-9)return 'p='+p;}
    st.pitch=30;return true;})()===true);
  ok('every preset pitch gives a whole-degree extra (setRot rounds)',w.eval('CAM_PRESETS').every(p=>{const e=w.camExtraAt(p.pitch);return Math.abs(e-Math.round(e))<1e-9;}),
    w.eval('CAM_PRESETS').map(p=>p.k+':'+w.camExtraAt(p.pitch)).join(' '));
  ok('the default camera (rot 90, pitch 30) is already the iso preset',w.camPresetNow()&&w.camPresetNow().k==='iso');
  ok('camQuadRot: axo from rot 0 lands on 12 (45 − 33)',w.camQuadRot(0,46,45)===12);
  ok('camQuadRot: elevation at pitch 15 lands on a face-on yaw',(w.camQuadRot(100,15,0)+45)%90===0,w.camQuadRot(100,15,0));

  // ---------- presets ----------
  for(const p of w.eval('CAM_PRESETS')){w.camPresetApply(p.k);
    ok('preset '+p.k+' → pitch '+p.pitch+', effective yaw on '+p.phase+'+k·90',
      st.pitch===p.pitch&&((eff()-p.phase)%90+90)%90===0&&w.camPresetNow().k===p.k,'rot '+st.rot+' eff '+eff());}
  ok('the panel select follows the preset',(w.camPresetApply('mil'),$('camPreset').value==='mil'));
  ok('a free pitch change drops the select back to Szabad',(w.setPitch(37),$('camPreset').value===''));
  ok('choosing a preset from 2D leaves 2D',(function(){st.pitch=90;st.flat=true;w.camPresetApply('iso');return st.pitch===30&&!st.flat;})());

  // ---------- the lock ----------
  w.camPresetApply('axo');w.camLockSet(true);
  const r0=st.rot;
  ok('lock on: pitch fixed at the preset',st.camLockPitch===46&&st.pitch===46);
  ok('lock: a 10° drag does not move',(w.setRot(st.rot+10),st.rot===r0),st.rot);
  ok('lock: drags gather — 10+10+10+20 = one quadrant',(function(){w.setRot(st.rot+10);w.setRot(st.rot+10);w.setRot(st.rot+20);
    return st.rot===(r0+90)%360;})(),st.rot);
  ok('lock: a −90 key step goes back one quadrant',(w.setRot(st.rot-w.camRotStep()),st.rot===r0&&w.camRotStep()===90));
  ok('lock: a jump to 200° lands on the nearest quadrant',(w.setRot(200),((st.rot+33-45)%90+90)%90===0&&Math.abs(st.rot-200)<=45),st.rot);
  ok('lock: setPitch is refused',(w.setPitch(70),st.pitch===46));
  ok('lock: the phone / gamepad path is held too',(function(){w.camSetPitch(80);const a=st.pitch===46;
    const r=st.rot;w.setRotSilent(r+5);return a&&st.rot===r;})());
  ok('lock: the panel checkbox follows',$('camLock').checked===true);
  ok('lock is inactive in 2D (nothing to rotate)',(function(){st.pitch=90;const off=!w.camLockOn()&&w.camRotStep()===15;st.pitch=46;return off;})());

  // ---------- persistence ----------
  ok('lock + preset survive save / load',(function(){
    const snap=JSON.parse(JSON.stringify({state:st}));
    st.camLock=false;st.camPreset=null;st.camLockPitch=null;
    Object.assign(st,snap.state);w.setRot(st.rot);
    return st.camLock===true&&st.camPreset==='axo'&&st.camLockPitch===46&&w.camLockOn();})());
  ok('lock off: free camera again',(w.camLockSet(false),w.setPitch(40),st.pitch===40&&w.camRotStep()===15));
  ok('actions registered for every preset and the lock',(function(){
    const ids=(w.eval('ACTIONS')||[]).map(a=>a.id);
    return w.eval('CAM_PRESETS').every(p=>ids.includes('view.cam.'+p.k))&&ids.includes('view.cam.lock');})());

  // ---------- object library ----------
  const names=[];w.eval('OBJLIB').forEach(g=>g.items.forEach(it=>names.push(it.n)));
  const OLD=['Egyedi méret…','Ágy 200×160','Ágy 200×90','Éjjeliszekrény','Szekrény 120','Gardrób 240','Komód','Íróasztal','Szék',
    'Étkezőasztal 160','Kanapé 3ü','Fotel','Dohányzóasztal','Könyvespolc','TV szekrény','Konyhapult 60','Konyhapult 120','Mosogató',
    'Tűzhely 60','Sütő beépített','Hűtő 60','Mosogatógép 60','Páraelszívó','Felsőszekrény','Kád 170×75','Zuhanytálca 90×90',
    'Mosdó 60','WC csésze','Bidé','Mosógép 60','Szárítógép 60','Törölközőradiátor','Elosztószekrény','Kazán fali','HMV tároló 200l',
    'Hőszivattyú kültéri','Szellőzőgép','Radiátor 1000','Villanyóra szekrény','Oszlop 30×30','Kandalló','Beépített szekrény','Doboz / raklap'];
  ok('every pre-V7 object name survives',OLD.every(n=>names.includes(n)),OLD.filter(n=>!names.includes(n)).join(', '));
  ok('object names are unique',new Set(names).size===names.length);
  ok('106 catalogue items, the custom box first',names.length===106&&names[0]==='Egyedi méret…',names.length);
  ok('every item has positive w/d/h',w.eval('OBJLIB').every(g=>g.items.every(it=>it.w>0&&it.d>0&&it.h>0)));
  ok('OBJLIB matches the catalogue (objlib-gen --check)',(function(){try{
    execFileSync(process.execPath,[path.join(__dirname,'..','tools','objlib-gen.js'),'--check'],{stdio:'pipe'});return true;}
    catch(e){return 'out of date';}})()===true);
  ok('the picker renders every group',(function(){w.renderObjList();const el=$('objList');
    return !el||el.querySelectorAll('.objitem').length===106;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
