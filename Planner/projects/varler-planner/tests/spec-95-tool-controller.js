// UI tidy T1 — the tool controller (src/05cb-toolctl.js, docs/ui-tidy/UI-AUDIT.md §5). At most one tool is live:
// every pair of tools started one after the other leaves only the second one running, ▖ Select ends any of them,
// and toolCurrent / toolStop / toolStart / toolOnChange (the Simplified UI's interface) report it.
const {JSDOM}=require('jsdom');const path=require('path');const fs=require('fs');
function findPlanner(){
  if(process.env.PLANNER)return process.env.PLANNER;
  const c=[path.join(__dirname,'..','dist','varler_planner.html'),path.join(__dirname,'..','planner.html')];
  for(const p of c)if(fs.existsSync(p))return p;
  throw new Error('planner build not found — run: node build.js');}
const dom=new JSDOM(fs.readFileSync(findPlanner(),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 const R=[];const ok=(n,c,x)=>R.push([n,!!c,x||'']);
 try{
  w.confirm=()=>true;w.alert=()=>{};w.prompt=()=>null;w.hardResetWorkspace();
  const ev=s=>{try{return w.eval(s);}catch(e){return 'ERR:'+e.message;}};
  ev("stkCreate({name:'T',construct:{mode:'new'}})");
  // name → [start, own flag]
  const T={
   'Fal jelölése (J)':["mrkToolStart()","MRK_T.on"],'Padló / mennyezet jelölés (G)':["mrkPlaneStart()","MRK_P.on"],
   'RBX':["hwToolStart('rbx')","HW_T.on"],'Végpont':["epToolStart('SOC')","EP_T.on"],'Portál':["ptToolStart()","PT_T.on"],
   'Klaszterdoboz':["clsToolStart()","CL_T.on"],'Vezethető fal':["rwlToolStart()","MKP.on&&MKP.ink==='vezetheto'"],'Jelölő toll: Tilos':["rbPick('tilos')","MKP.on&&MKP.ink==='tilos'"],'Szabály: Ágy zóna':["rbPick('agy')","RB.on"],
   'Kapcsolások':["lswToolStart()","LSW.on"],'Mennyezeti út':["clnToolStart('ceil')","CLN.on"],'Padló út':["clnToolStart('floor')","CLN.on&&CLN.plane==='floor'"],
   'Szobadoboz':["jbToolStart('szoba')","JB_T.on"],'Helyiség-toll':["setMode('room')","state.mode==='room'"],'Ajtó':["opnTool('door')","state.mode==='build'"]};
  const names=Object.keys(T);
  const reset=()=>{ev('toolStop()');ev("setMode('select')");};
  // 1. every pair: after A then B only B is live
  const both=[];names.forEach(a=>names.forEach(b=>{if(a===b)return;reset();ev(T[a][0]);if(ev(T[a][1])!==true)return;ev(T[b][0]);
    const live=ev('toolLiveSubs().length');if(ev(T[b][1])!==true||live>1)both.push(a+' → '+b+' (live '+live+')');}));
  ok('every ordered pair of '+names.length+' tools leaves only the second one live',both.length===0,both.slice(0,6).join(' · '));
  // 2. ▖ Select ends any of them
  const left=names.filter(n=>{reset();ev(T[n][0]);ev("document.querySelector('.tool[data-mode=select]').click()");return ev(T[n][1])===true;});
  ok('a click on ▖ Select ends each of them',left.length===0,left.join(', '));
  // 3. toolCurrent
  reset();ok('plain Select → toolCurrent() is null',ev('toolCurrent()')===null);
  ev('rwlToolStart()');let c=ev('toolCurrent()');
  ok('routing walls → id wf.routeWalls, label Vezethető fal, icon 🟩',c&&c.id==='wf.routeWalls'&&c.label==='Vezethető fal'&&c.icon==='🟩',JSON.stringify(c));
  ev('draw()');
  ok('… the status bar names it',/Vezethető fal/.test(w.document.getElementById('statusBar').textContent));
  ok('… its sidebar button is lit, ▖ Select is not',w.document.getElementById('rwlBtn').classList.contains('on')&&!w.document.querySelector('.tool[data-mode=select]').classList.contains('on'));
  ev("rbPick('tilos')");ok('a face preset → the marker pen, label "Jelölő toll: Tilos"',ev('toolCurrent().label')==='Jelölő toll: Tilos'&&ev('toolCurrent().id')==='wf.rules');
  ev("rbPick('agy')");ok('a zone preset → the rules tool, label "Szabály: Ágy zóna"',ev('toolCurrent().label')==='Szabály: Ágy zóna');
  ev("jbToolStart('board')");ok('the Elosztó box tool → id wf.board, label Elosztó',ev('toolCurrent().id')==='wf.board'&&ev('toolCurrent().label')==='Elosztó');
  ev("clnToolStart('floor')");ok('Padló út → id wf.floorLine',ev('toolCurrent().id')==='wf.floorLine');
  ev("opnTool('door')");ev('draw()');
  ok('Ajtó → id wf.door; the 🚪 button is lit, 🪜 Build is not',ev('toolCurrent().id')==='wf.door'&&w.document.getElementById('opnDoorBtn').classList.contains('on')&&!w.document.querySelector('.tool[data-mode=build]').classList.contains('on'));
  ev("setMode('room')");ev('draw()');
  ok('the room pen → mode.room, the status bar says Helyiség-toll',ev('toolCurrent().id')==='mode.room'&&/Helyiség-toll/.test(w.document.getElementById('statusBar').textContent));
  ev("setMode('note')");ok('a mode without an action → label from MODENAME (Jegyzet)',ev('toolCurrent().label')==='Jegyzet');
  // 4. toolStop / toolStart / Esc
  ev("clnToolStart('ceil')");ev('toolStop()');ok('toolStop() ends a sub-tool and leaves plain Select',ev('CLN.on')===false&&ev('state.mode')==='select'&&ev('toolCurrent()')===null);
  ev("setMode('path')");ev('toolStop()');ok('toolStop() from a mode → select',ev('state.mode')==='select');
  ok('toolStart(id) runs the action',ev("toolStart('wf.switches')")===true&&ev('LSW.on')===true);
  ev('rwlToolStart()');w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));ev('draw()');
  ok('Esc ends the live sub-tool',ev('MKP.on')===false&&ev('toolCurrent()')===null);
  // 5. toolOnChange
  reset();ev('draw()');let calls=[];w.toolOnChange(cur=>calls.push(cur?cur.id:null));
  ev('rwlToolStart()');ev('draw()');ev('draw()');
  ok('toolOnChange fires once per change, not per draw',calls.length===1&&calls[0]==='wf.routeWalls',JSON.stringify(calls));
  ev('toolStop()');ev('draw()');ok('… and with null when the tool ends',calls.length===2&&calls[1]===null,JSON.stringify(calls));
  // 6. toolsOff(except)
  ev('rwlToolStart()');ok('toolsOff(except) keeps the named tool',ev("toolsOff('wf.routeWalls')")===0&&ev('MKP.on')===true);
  ok('toolsOff() ends it and counts 1',ev('toolsOff()')===1&&ev('MKP.on')===false);
  // 7. T4 — the Régi eszközök drawer
  const lg=w.document.getElementById('legacyTools');
  ok('T4: the drawer exists and starts closed',lg&&lg.tagName==='DETAILS'&&!lg.open);
  const inLg=sel=>!!lg.querySelector(sel);
  ok('… it holds Cable, Device, Build, Floor, Roof, the room dialog, Ház / Garázs and the two routing buttons',
    ['cable','device','build','floor','roof'].every(m=>inLg('.tool[data-mode='+m+']'))&&['bCreateRoom','bHouse','bGarage','bRecalc','bClearRoute'].every(id=>inLg('#'+id)));
  ok('… and the phase tools do not (T3: the drawer sits under them)',!w.document.querySelector('#phAlways .tool[data-mode=cable],#phBody .tool[data-mode=cable]')&&!!w.document.querySelector('#phBody .tool[data-mode=room]')&&w.document.getElementById('phaseTools').contains(lg));
  ok('… the Routing panel is gone from the panel list',!w.__panels().some(p=>p.label==='Routing'));
  ev("setMode('cable')");ev('draw()');ok('a legacy mode picked by key opens the drawer (its lit button stays visible)',lg.open===true&&lg.querySelector('.tool[data-mode=cable]').classList.contains('on'));
 }catch(err){R.push(['exception',false,err.stack]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x&&!c?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
