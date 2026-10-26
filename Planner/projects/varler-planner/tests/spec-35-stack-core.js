// spec-35 — BRIDGE Stack core: model, wizard, panel group, stage rail, room ids, validator hook, shared hooks
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
  const LY=()=>w.eval('layers'),ST=()=>w.eval('stacks'),D=()=>w.__data,J=o=>JSON.stringify(o);
  const undoLen=()=>w.eval('undo.length');
  const click=el=>el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const ctxLabels=()=>[...w.document.querySelectorAll('#ctx button')].map(b=>b.textContent);
  const ctxClick=t=>[...w.document.querySelectorAll('#ctx button')].find(b=>b.textContent===t).click();
  const fresh=()=>{w.newBlankProject();w.eval('stacks=[]');w.__state.stkOff=false;w.__state.stack=null;w.__state.stage='build';};
  const addL=(id,name)=>{LY().push({id,name,visible:true,cats:w.layerCatsAll()});};
  const addWall=(layer,x)=>{w.__getWalls()[lvl].push({x0:x,y0:0,x1:x+1000,y1:100,layer});w.ensureIds(D());};
  const addDev=(o)=>{D().devices.push(Object.assign({type:'socket',level:lvl,x:100,y:100,h:300,layer:'L0',side:0},o));w.ensureIds(D());return D().devices[D().devices.length-1];};
  const roleKeys=w.stkRolesOf('bridge').map(r=>r.k);   // round 2026-10-22: the BRIDGE kind's roles (the Villany ones: spec-109)
  // T2 (2026-10-15): the rail is gone; the stack's roles are still the inspector's stages, so these checks read the stage list
  const railBtns=()=>w.shellStages().map(s=>({dataset:{k:s.k},textContent:s.n,classList:{contains:c=>c==='on'&&s.k===w.shellKey()}}));

  // 1 — create
  fresh();const n0=LY().length,u0=undoLen();
  const S=w.stkCreate({name:'T'});
  const SL=LY().filter(l=>l.stack===S.id);
  ok('BRIDGE roles: 5 phase-1 (+ the optional Igények, 08q, and Meglévő, 2026-10-22) and 22 phase-2 roles (+ the off-by-default Házimozi, 08r; + EPH, Tűzvédelem, Okos előkészítés off, 2026-10-22; + Veszélyérzékelők off in BRIDGE, 2026-10-26) (Erősáram = 3 since M1) (+ Klaszterpontok, Extrák — IDEA-003), KNX off',(()=>{const B=w.stkRolesOf('bridge');return B.filter(r=>r.ph===1&&!w.stkRoleOpt(r,'bridge')).length===5&&B.filter(r=>w.stkRoleOpt(r,'bridge')).map(r=>r.k).join()==='need,exist'&&B.filter(r=>r.ph===2).length===22&&['sys:BOND','sys:FIRE','sys:SMARTREADY'].every(k=>B.find(r=>r.k===k).off===true);})()&&w.STK_ROLES.find(r=>r.k==='sys:KNX').off===true&&w.STK_ROLES.find(r=>r.k==='sys:CINEMA').off===true);
  ok('stkCreate makes 5 phase-1 + 16 phase-2 layers (KNX off)',SL.length===21&&!SL.some(l=>l.role==='sys:KNX'));
  ok('the layers come in STK_ROLES order, each with stack and role',J(SL.map(l=>l.role))===J(roleKeys.filter(k=>['sys:KNX','need','sys:CINEMA','exist','sys:BOND','sys:FIRE','sys:SMARTREADY','sys:HAZARD'].indexOf(k)<0))&&SL.every(l=>l.stack===S.id&&l.role));
  ok('the new layers are one contiguous block after the existing ones',LY().length===n0+21&&LY().slice(n0).every(l=>l.stack===S.id)&&!LY().slice(0,n0).some(l=>l.stack));
  ok('layers are named "<short> · <role>"',SL[0].name==='B1 · Szerkezet'&&SL[1].name==='B1 · Jelölés');
  ok('the record: kind bridge, scale S-C, phase 1, layers listed in role order',S.kind==='bridge'&&S.scale==='S-C'&&S.phase===1&&J(S.layers)===J(SL.map(l=>l.id))&&ST().length===1&&S.name==='T');
  ok('the Szerkezet layer is active and the stack is entered',w.__state.activeLayer===SL[0].id&&w.stkActive()===S);
  ok('the stack creation is one undo step that removes everything',undoLen()===u0+1&&(w.doUndo(),LY().length===n0&&ST().length===0&&!LY().some(l=>l.stack)));
  w.doRedo();
  ok('redo brings the whole stack back',ST().length===1&&LY().length===n0+21);
  ok('KNX can be ticked and the phase-2 set can be trimmed',(function(){fresh();const s=w.stkCreate({roles:['sys:KNX','sys:LV']});
    return LY().filter(l=>l.stack===s.id).map(l=>l.role).join()==='construct,mark,hw,base,channel,sys:LV,sys:KNX'.split(',').sort((a,b)=>roleKeys.indexOf(a)-roleKeys.indexOf(b)).join();})());
  ok('a second stack is named B2 and its block follows the first',(function(){fresh();w.stkCreate({});const s2=w.stkCreate({name:'Z'});
    const L2=LY().filter(l=>l.stack===s2.id);return L2[0].name==='B2 · Szerkezet'&&LY().indexOf(L2[0])>LY().findIndex(l=>l.stack&&l.stack!==s2.id);})());

  // 2 — adoption
  fresh();addL('LX','Régi fal');addWall('LX',0);addWall('LX',2000);
  const n1=LY().length,sA=w.stkCreate({construct:{mode:'adopt',layers:['LX']}});
  ok('adopting an existing layer as Szerkezet creates no new Szerkezet layer',LY().length===n1+20&&LY().filter(l=>l.role==='construct').length===1);
  ok('the adopted layer is referenced, keeps its name and its items',LY().find(l=>l.id==='LX').role==='construct'&&LY().find(l=>l.id==='LX').stack===sA.id&&LY().find(l=>l.id==='LX').name==='Régi fal'&&w.lyrItemsOf('LX','wall').length===2);
  ok('the adopted layer is the active one',w.__state.activeLayer==='LX'&&w.stkLayer(sA.id,'construct').id==='LX');
  fresh();addL('LA','A');addL('LB','B');addWall('LA',0);addWall('LB',3000);addDev({layer:'LB'});
  const sM=w.stkCreate({construct:{mode:'adopt',layers:['LA','LB'],merge:true}});
  ok('two layers + merge → one layer holding both sets',!LY().some(l=>l.id==='LB')&&w.lyrItemsOf('LA','wall').length===2&&w.lyrItemsOf('LA','device').length+w.lyrItemsOf('LA','socket').length===1&&w.stkLayer(sM.id,'construct').id==='LA');
  ok('adopt + merge is still one undo step',(function(){w.doUndo();return LY().some(l=>l.id==='LB')&&LY().some(l=>l.id==='LA')&&!ST().length&&w.lyrItemsOf('LB','wall').length===1;})());
  ok('L0 can be adopted, and wins as the merge target',(function(){fresh();addL('LQ','Q');addWall('LQ',0);const s=w.stkCreate({construct:{mode:'adopt',layers:['LQ','L0'],merge:true}});
    return w.stkLayer(s.id,'construct').id==='L0'&&!LY().some(l=>l.id==='LQ')&&w.lyrItemsOf('L0','wall').length===1;})());
  ok('a layer that already belongs to a stack is not adopted again',(function(){fresh();const s=w.stkCreate({});const mk=LY().find(l=>l.stack===s.id&&l.role==='mark').id;
    const s2=w.stkCreate({construct:{mode:'adopt',layers:[mk]}});return LY().find(l=>l.id===mk).stack===s.id&&LY().filter(l=>l.stack===s2.id&&l.role==='construct').length===1&&LY().find(l=>l.id===mk).role==='mark';})());
  ok('non-construct items on the adopted layer are reported, and can be moved to a new layer in one step',(function(){
    fresh();addL('LY','Vegyes');addWall('LY',0);addDev({layer:'LY'});addDev({layer:'LY',type:'light',x:300});
    const s=w.stkCreate({construct:{mode:'adopt',layers:['LY']}});
    const odd=w.stkNonConstruct('LY'),hud=$('hud').textContent;const u=undoLen();
    const r=w.stkMoveNonConstruct('LY');
    return odd.n===2&&/nem szerkezeti elem/.test(hud)&&r&&undoLen()===u+1&&w.stkNonConstruct('LY').n===0&&w.lyrItemsOf('LY','wall').length===1&&LY().some(l=>l.name==='Nem szerkezeti elemek');})());
  ok('the Szerkezet layer menu offers the move only when there is something to move',(function(){
    fresh();addL('LZ','Vegyes');addDev({layer:'LZ'});w.stkCreate({construct:{mode:'adopt',layers:['LZ']}});
    w.document.querySelector('[data-lb="LZ"] .lrow').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:5,clientY:5}));
    const a=ctxLabels().indexOf('Nem szerkezeti elemek áthelyezése új rétegre')>=0;
    w.stkMoveNonConstruct('LZ');
    w.document.querySelector('[data-lb="LZ"] .lrow').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:5,clientY:5}));
    return a&&ctxLabels().indexOf('Nem szerkezeti elemek áthelyezése új rétegre')<0;})());
  ok('stkAdopt gives an existing layer a role; the former holder becomes an ordinary layer',(function(){
    fresh();const s=w.stkCreate({});addL('LH','Szekrény');const old=w.stkLayer(s.id,'hw').id;
    const r=w.stkAdopt(s.id,'hw',['LH']);return r&&w.stkLayer(s.id,'hw').id==='LH'&&!LY().find(l=>l.id===old).stack&&!('role' in LY().find(l=>l.id===old))&&J(s.layers).indexOf('LH')>=0;})());
  ok('stkAdopt with several layers + merge folds them into the first',(function(){
    fresh();const s=w.stkCreate({});addL('LP','P');addL('LR','R');addDev({layer:'LP'});addDev({layer:'LR',x:300});
    const r=w.stkAdopt(s.id,'sys:SOC',['LP','LR'],{merge:true});return r&&w.stkLayer(s.id,'sys:SOC').id==='LP'&&!LY().some(l=>l.id==='LR')&&D().devices.every(d=>d.layer==='LP');})());
  ok('stkAdopt refuses a layer of another stack',(function(){fresh();const a=w.stkCreate({}),b=w.stkCreate({});const mk=w.stkLayer(a.id,'mark').id;return w.stkAdopt(b.id,'mark',[mk])===false&&w.stkLayer(a.id,'mark').id===mk;})());

  // 3 — room ids
  fresh();
  w.eval("ROOMSB.ground.push({name:'Nappali',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]})");
  w.eval("ROOMSB.upper.push({name:'Szoba',poly:[[0,0],[3000,0],[3000,3000],[0,3000]],id:'Y40'})");
  D().floors.push({level:lvl,name:'F-szoba',poly:[[5000,0],[6000,0],[6000,1000],[5000,1000]]});
  w.ensureIds(D());
  const rid=w.eval('ROOMSB.ground[0].id');
  ok('building rooms get Y ids from ensureIds',/^Y\d+$/.test(rid)&&w.eval('ROOMSB.upper[0].id')==='Y40');
  ok('an id is never reissued: the seq scan includes the Y rooms',+rid.slice(1)>40&&D().seq>=+rid.slice(1));
  ok('data.floors keep their F ids',/^F\d+$/.test(D().floors[0].id));
  ok('stkRooms lists both kinds with their ids',(function(){const l=w.stkRooms(lvl);return l.length===2&&l.some(r=>r.id===rid&&r.name==='Nappali')&&l.some(r=>/^F/.test(r.id));})());
  ok('room ids survive sessionObj → applyProjectData',(function(){const o=w.sessionObj();const copy=JSON.parse(JSON.stringify(o));w.applyProjectData(copy);return w.eval('ROOMSB.ground[0].id')===rid&&w.eval('ROOMSB.upper[0].id')==='Y40';})());

  // 4 — validator hook
  ok('VALIDATORS.push({run}) is surfaced by validate()',(function(){w.VALIDATORS.push({run:()=>[{sev:'info',code:'t',msg:'x'}]});const r=w.validate().some(x=>x.code==='t');w.VALIDATORS.length=0;return r;})());
  ok('a throwing validator does not break validate()',(function(){w.VALIDATORS.push({run:()=>{throw new Error('x');}});const r=Array.isArray(w.validate());w.VALIDATORS.length=0;return r;})());

  // 5 — the stage rail
  fresh();
  ok('without a stack the rail shows the six general stages',railBtns().length===6&&w.shellStages()===w.STAGES&&!w.stkActive());
  const S5=w.stkCreate({});
  ok('with the stack active the rail shows 21 role buttons and a back button',railBtns().length===21&&!!w.stkActive()&&railBtns()[0].textContent.indexOf('Szerkezet')>=0&&railBtns()[1].textContent.indexOf('Jelölés')>=0);
  ok('the Szerkezet button is the current one',railBtns().find(b=>b.classList.contains('on')).dataset.k==='stk:construct');
  w.setStage('stk:mark');
  ok("setStage('stk:mark') makes the Jelölés layer active and highlights it",LY().find(l=>l.id===w.__state.activeLayer).role==='mark'&&railBtns().find(b=>b.classList.contains('on')).dataset.k==='stk:mark');
  ok('the layer panel follows (the Jelölés radio is checked)',(function(){const r=w.document.querySelector('[data-la="'+w.__state.activeLayer+'"]');return r&&r.checked;})());
  ok('the inspector uses the role: Jelölés stage title and its hint',/Jelölés/.test($('inspector').textContent));
  ok('picking another stack layer in the panel moves the rail with it',(function(){const hw=LY().find(l=>l.role==='hw');const r=w.document.querySelector('[data-la="'+hw.id+'"]');r.checked=true;r.dispatchEvent(new w.Event('change',{bubbles:true}));
    return railBtns().find(b=>b.classList.contains('on')).dataset.k==='stk:hw';})());
  ok('shell.next / shell.prev walk the stack stages',(function(){w.setStage('stk:construct');w.actionById('shell.next').run({});const a=w.shellKey();w.actionById('shell.prev').run({});return a==='stk:mark'&&w.shellKey()==='stk:construct';})());
  ok('the construct role offers the Fal / Helyiség action groups, mark offers none yet',w.stkGroupsOf('construct').indexOf('Fal')>=0&&w.stkGroupsOf('sys:MAINS').slice(0,2).join()==='Végpont,Szükséglet'&&w.stkGroupsOf('mark').join()==='Jelölés');
  ok('STK_GROUPS["+sys:MAINS"] extends one system role only',(function(){w.STK_GROUPS['+sys:MAINS']=['X'];const a=w.stkGroupsOf('sys:MAINS').indexOf('X')>=0&&w.stkGroupsOf('sys:LV').indexOf('X')<0;delete w.STK_GROUPS['+sys:MAINS'];return a;})());
  w.runAction('stack.leave');
  ok('"◂ Általános" restores the six general stages',railBtns().length===6&&!w.stkActive()&&w.stkActive()===null&&w.shellStages()===w.STAGES);
  ok('the active layer is a non-stack layer again',!LY().find(l=>l.id===w.__state.activeLayer).stack);
  ok('the stack stays in the project after leaving it',ST().length===1);
  w.stkActivate(S5.id);
  ok('Stack aktiválása re-enters it',w.stkActive()===S5&&railBtns().length===21);
  ok('a stack role without a layer has no button',(function(){const lay=w.stkLayer(S5.id,'sys:HMI');LY().splice(LY().indexOf(lay),1);w.renderShell();const n=railBtns().length;LY().push(lay);return n===20;})());

  ok('a stack whose role layers were all deleted falls back to the general rail instead of crashing',(function(){fresh();const s=w.stkCreate({});
    const ids=LY().filter(l=>l.stack===s.id).map(l=>l.id);w.eval('layers=layers.filter(l=>!l.stack)');w.__state.activeLayer='L0';w.__state.stack=s.id;
    let r=true;try{w.draw();r=railBtns().length===6&&w.shellStages()===w.STAGES;}catch(e){r=false;}return r;})());

  // 6 — dissolve
  fresh();const S6=w.stkCreate({});addDev({layer:w.stkLayer(S6.id,'hw').id});const nl=LY().length;
  ok('stkDissolve keeps all layers and items, clears stack and role',(function(){const r=w.stkDissolve(S6.id);return r&&ST().length===0&&LY().length===nl&&LY().every(l=>!l.stack&&!l.role)&&D().devices.length===1;})());
  ok('after dissolving the rail is the general one',w.stkActive()===null&&railBtns().length===6);
  ok('dissolving is undoable',(function(){w.doUndo();return ST().length===1&&LY().filter(l=>l.stack).length===21;})());

  // 7 — merge rule regression
  ok('merging a stack layer into a non-stack layer is refused',(function(){fresh();const s=w.stkCreate({});addL('LN','N');const mk=w.stkLayer(s.id,'mark').id;const r=w.lyrMerge('LN',[mk]);return r===false&&LY().some(l=>l.id===mk)&&/Stack réteg/.test($('hud').textContent);})());
  ok('merging within one stack is allowed',(function(){fresh();const s=w.stkCreate({});const a=w.stkLayer(s.id,'mark').id,b=w.stkLayer(s.id,'hw').id;return w.lyrMerge(b,[a])===true&&!LY().some(l=>l.id===a);})());

  // 8 — the wizard
  fresh();addL('LW1','Alap fal');addL('LW2','Másik');
  // round 2026-10-22 (V2): the wizard opens on Villany; these checks are about its BRIDGE side
  const toBridge=()=>{const r=w.document.querySelector('input[name=skKind][value=bridge]');r.checked=true;r.dispatchEvent(new w.Event('change',{bubbles:true}));};
  w.actionById('stack.create').run({});toBridge();
  ok('the wizard lists the BRIDGE phase-2 roles, KNX, Házimozi, EPH, Tűzvédelem, Okos előkészítés unticked',w.document.querySelectorAll('.skR').length===22&&!w.document.querySelector('.skR[value="sys:CINEMA"]').checked&&[...w.document.querySelectorAll('.skR')].filter(x=>x.checked).length===16&&!w.document.querySelector('.skR[value="sys:KNX"]').checked);
  ok('the name defaults to "BRIDGE Stack <n>"',$('skName').value==='BRIDGE Stack 1');
  ok('the adopt list shows only non-stack layers; merge appears at 2+ ticked',(function(){
    const ad=w.document.querySelector('input[name=skMode][value=adopt]');ad.checked=true;ad.dispatchEvent(new w.Event('change',{bubbles:true}));
    const shown=$('skAdopt').style.display==='block'&&w.document.querySelectorAll('.skL').length===3;
    const b=w.document.querySelectorAll('.skL');b[1].checked=true;b[1].dispatchEvent(new w.Event('change',{bubbles:true}));const one=$('skMergeRow').style.display==='none';
    b[2].checked=true;b[2].dispatchEvent(new w.Event('change',{bubbles:true}));return shown&&one&&$('skMergeRow').style.display==='block';})());
  ok('OK creates the stack from the wizard, merging the ticked layers',(function(){$('skName').value='Lakás';$('mOk').click();
    const s=ST()[0];return s&&s.name==='Lakás'&&LY().filter(l=>l.stack===s.id).length===21&&LY().find(l=>l.role==='construct').id==='LW1'&&!LY().some(l=>l.id==='LW2');})());
  ok('adopt without any ticked layer is refused and keeps the dialog',(function(){fresh();addL('LV','V');w.actionById('stack.create').run({});const ad=w.document.querySelector('input[name=skMode][value=adopt]');ad.checked=true;
    $('mOk').click();const kept=w.document.querySelector('#modalBg').style.display==='flex'&&ST().length===0;w.closeModal();return kept;})());
  ok('the wizard can leave optional phase-2 layers out',(function(){fresh();w.actionById('stack.create').run({});toBridge();w.document.querySelectorAll('.skR').forEach(x=>{x.checked=(x.value==='sys:LV');});$('mOk').click();
    return LY().filter(l=>l.stack).length===6;})());

  // 9 — the panel group
  fresh();addL('LO','Egyéb');const S9=w.stkCreate({name:'Ház'});w.renderLayers();
  ok('a stack header with short name, name and phase renders above the stack layers',(function(){const h=w.document.querySelector('#layerList .lstack');return h&&/B1 · Ház/.test(h.textContent)&&/1\. fázis/.test(h.textContent);})());
  ok('the stack layers sit in an indented body, in role order, with a role caption',(function(){const b=w.document.querySelector('#layerList .lstkbody');const ids=[...b.querySelectorAll('[data-lb]')].map(x=>x.dataset.lb);
    return ids.length===21&&ids[0]===w.stkLayer(S9.id,'construct').id&&b.querySelector('.lrole').textContent==='Szerkezet';})());
  ok('non-stack layers render below the stack block, as before',(function(){const list=w.document.querySelector('#layerList');const kids=[...list.children];const lastStk=kids.indexOf(list.querySelector('.lstkbody'));
    return kids.slice(lastStk+1).every(k=>k.classList.contains('lblock'))&&kids.slice(lastStk+1).map(k=>k.dataset.lb).join()==='L0,LO';})());
  click(w.document.querySelector('[data-lsf]'));
  ok('the header folds the stack block',!w.document.querySelector('#layerList .lstkbody')&&!!w.document.querySelector('[data-lb="L0"]'));
  click(w.document.querySelector('[data-lsf]'));
  w.document.querySelector('[data-lsm]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:5,clientY:5}));
  ok('the ⋯ menu offers the five stack operations',['Stack aktiválása','Átnevezés…','Fázis: 1 → 2','Meglévő réteg felvétele szerepbe…','Stack feloldása (rétegek maradnak)'].every(t=>ctxLabels().indexOf(t)>=0));
  ctxClick('Fázis: 1 → 2');
  ok('Fázis toggles 1 ↔ 2 and the header shows it',S9.phase===2&&/2\. fázis/.test(w.document.querySelector('#layerList .lstack').textContent));
  w.document.querySelector('#layerList .lstack').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:5,clientY:5}));
  ctxClick('Átnevezés…');$('srName').value='Új név';$('mOk').click();
  ok('Átnevezés renames the stack (undoable)',S9.name==='Új név'&&(w.doUndo(),w.stkById(S9.id).name==='Ház'));
  w.document.querySelector('[data-lsm]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:5,clientY:5}));ctxClick('Meglévő réteg felvétele szerepbe…');
  $('saRole').value='sys:LV';$('saLayer').value='LO';$('mOk').click();
  ok('Meglévő réteg felvétele szerepbe… gives LO the role',w.stkLayer(S9.id,'sys:LV').id==='LO');
  w.document.querySelector('[data-lsm]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:5,clientY:5}));ctxClick('Stack feloldása (rétegek maradnak)');
  ok('Stack feloldása from the menu dissolves it',ST().length===0&&!w.document.querySelector('#layerList .lstack'));
  ok('the actions exist in group Stack',['stack.create','stack.dissolve','stack.leave'].every(id=>{const a=w.actionById(id);return a&&a.group==='Stack';}));

  // 10 — checks
  fresh();const S10=w.stkCreate({});
  ok('construct check: no wall, no door → info',(function(){const c=w.stkCheck(S10,'construct');return c.some(x=>x.sev==='info'&&/fal/.test(x.msg))&&c.some(x=>x.sev==='info'&&/ajtó/.test(x.msg));})());
  ok('construct check: a room without a name → warn',(function(){D().floors.push({level:lvl,name:'',poly:[[0,0],[1000,0],[1000,1000],[0,1000]],layer:w.stkLayer(S10.id,'construct').id});w.ensureIds(D());
    return w.stkCheck(S10,'construct').some(x=>x.sev==='warn');})());
  ok('construct check: a room without an id → error',(function(){const f=D().floors[0];delete f.id;const r=w.stkCheck(S10,'construct').some(x=>x.sev==='error');w.ensureIds(D());return r;})());
  ok('construct check is quiet once there is a wall, a door and a named room',(function(){D().floors[0].name='Hall';addWall(w.stkLayer(S10.id,'construct').id,0);
    D().openings.push({type:'door',level:lvl,x:0,y:0,ang:0,layer:w.stkLayer(S10.id,'construct').id});w.ensureIds(D());return w.stkCheck(S10,'construct').length===0;})());
  ok('a role no work package registered checks for returns none',w.stkCheck(S10,'zz:none').length===0);
  ok('STK_CHECKS[role] functions are concatenated, a throwing one is skipped',(function(){w.STK_CHECKS.hw=[()=>[{sev:'warn',msg:'q'}],()=>{throw new Error('x');}];const c=w.stkCheck(S10,'hw');delete w.STK_CHECKS.hw;return c.length===1&&c[0].msg==='q';})());
  ok('a role check reaches the inspector of that role',(function(){w.STK_CHECKS.mark=[()=>[{sev:'warn',msg:'qq-role-check'}]];w.invalidateShell();w.setStage('stk:mark');w.renderShell();const has=/qq-role-check/.test($('inspector').textContent);delete w.STK_CHECKS.mark;w.invalidateShell();return has;})());

  // 11 — persistence
  fresh();const S11=w.stkCreate({name:'P'});
  ok('stacks and the layer role fields survive sessionObj → applyProjectData',(function(){const o=JSON.parse(JSON.stringify(w.sessionObj()));w.applyProjectData(o);
    return ST().length===1&&ST()[0].name==='P'&&LY().filter(l=>l.stack===ST()[0].id).length===21&&w.stkLayer(ST()[0].id,'hw')!==null;})());
  ok('a project without a stack opens on the general rail',(function(){const o=JSON.parse(JSON.stringify(w.sessionObj()));o.stacks=[];o.layers.forEach(l=>{delete l.stack;delete l.role;});o.state.stack=null;w.applyProjectData(o);return w.stkActive()===null&&railBtns().length===6;})());

  // 12 — shared hooks
  fresh();w.__state.rot=0;w.__state.pitch=90;w.__state.flat=true;
  D().floors.push({level:lvl,name:'T',poly:[[0,0],[4000,0],[4000,3000],[0,3000]]});const dv=addDev({x:1000,y:1000});
  w.draw();const base=w.eval('_lastScene'),baseOv=w.eval('_lastOverlay');
  const keepS=w.STK_SCENE.slice(),keepO=w.STK_OVERLAY.slice();      // the marking layer (05n) registers its own hooks
  ok('with no stack data every registered hook draws nothing: the scene is what it was without them',w.stkHookSvg([])===''&&w.stkHookSvg(w.STK_SCENE)===''&&w.stkHookSvg(w.STK_OVERLAY)===''&&base.indexOf('id="t"')<0);
  w.STK_SCENE.push(()=>'<g id="t"/>');w.STK_OVERLAY.push(()=>'<g id="o"/>');w.draw();
  ok('a pushed scene fn appears in the scene, an overlay fn in the overlay only',w.eval('_lastScene').indexOf('<g id="t"/>')>=0&&w.eval('_lastOverlay').indexOf('<g id="o"/>')>=0&&w.eval('_lastScene').indexOf('id="o"')<0);
  w.STK_SCENE.length=0;keepS.forEach(f=>w.STK_SCENE.push(f));w.STK_OVERLAY.length=0;keepO.forEach(f=>w.STK_OVERLAY.push(f));w.draw();
  ok('removing them restores the scene byte for byte',w.eval('_lastScene')===base&&w.eval('_lastOverlay')===baseOv);
  ok('a throwing hook is skipped, the others still draw',(function(){w.STK_SCENE.push(()=>{throw new Error('x');},()=>'<g id="t2"/>');w.draw();const r=w.eval('_lastScene').indexOf('id="t2"')>=0;w.STK_SCENE.length=0;keepS.forEach(f=>w.STK_SCENE.push(f));w.draw();return r;})());
  // tools: pointer
  const bb=w.planToBase(dv.x,dv.y,w.dz(dv.level,dv.h||0));w.clientToBase=()=>bb;
  w.setMode('select');w.__setSel(null);
  const stage=$('stage')||w.eval('stage');
  const ptr=(t,o)=>stage.dispatchEvent(new w.MouseEvent(t,Object.assign({bubbles:true,cancelable:true,button:0,clientX:100,clientY:100},o||{})));
  ptr('pointerdown');ptr('pointerup');
  const sel0=w.__getSel();
  ok('without a tool, a click on the device selects it (the control for the next test)',!!sel0&&sel0.t==='devices');
  w.__setSel(null);let seen=[];
  w.STK_TOOLS.push({k:'t',active:()=>true,down:e=>{seen.push('down');return true;},move:e=>{seen.push('move');return false;},up:e=>{seen.push('up');return true;},key:e=>{seen.push('key:'+e.key);return false;},esc:e=>{seen.push('esc');}});
  ptr('pointerdown');ptr('pointermove');ptr('pointerup');
  ok('a tool whose down returns true stops select mode from selecting',w.__getSel()===null&&seen.indexOf('down')>=0);
  ok('the tool also sees move and up',seen.indexOf('move')>=0&&seen.indexOf('up')>=0);
  w.document.dispatchEvent(new w.Event('x'));w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'g',bubbles:true}));
  ok('the tool sees keys',seen.indexOf('key:g')>=0);
  w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  ok('the tool is told about Esc',seen.indexOf('esc')>=0);
  w.STK_TOOLS.length=0;w.STK_TOOLS.push({k:'off',active:()=>false,down:()=>true});
  ptr('pointerdown');ptr('pointerup');
  ok('an inactive tool does not eat events',!!w.__getSel());
  w.STK_TOOLS.length=0;
  ok('a throwing tool is skipped',(function(){w.STK_TOOLS.push({k:'b',active:()=>{throw new Error('x');},down:()=>true});w.__setSel(null);ptr('pointerdown');ptr('pointerup');const r=!!w.__getSel();w.STK_TOOLS.length=0;return r;})());
  // context menu
  w.STK_CTX.push(e=>[{label:'Stack menü teszt',act:()=>{}}]);
  stage.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:50}));
  ok('the first non-empty STK_CTX answer wins the stage right-click',ctxLabels().join()==='Stack menü teszt');
  w.hideCtx();w.STK_CTX.length=0;w.STK_CTX.push(()=>null,()=>[]);
  stage.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:50,clientY:50}));
  ok('null / empty answers fall through to the normal menu',ctxLabels().join()!=='Stack menü teszt');
  w.hideCtx();w.STK_CTX.length=0;
  ok('reg: draw()',(function(){try{w.draw();return true;}catch(e){return 'ERR '+e.message;}})()===true);
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
},900);
