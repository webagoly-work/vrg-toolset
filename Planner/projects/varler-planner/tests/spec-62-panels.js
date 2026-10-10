// spec-62 — the rail and the inspector resize; Tab is the wide work mode (round 2026-10-10, WP-U5)
//
// jsdom has no layout, so these check state and inline styles, not pixels. Tab goes through the real registry
// dispatcher (document, capture phase), which is how the browser delivers it.
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
  w.confirm=()=>true;w.alert=()=>{};
  w.newBlankProject();
  const st=w.__state;st.shell=true;st.wideWork=null;delete st.railW;delete st.inspW;w.renderShell();
  const grip=p=>w.document.querySelector(`.stage-wrap .pnlGrip[data-p="${p}"]`);
  const ptr=(el,type,x)=>el.dispatchEvent(new w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:50}));
  const drag=(p,dx)=>{const g=grip(p);ptr(g,'pointerdown',500);ptr(g,'pointermove',500+dx/2);ptr(g,'pointermove',500+dx);ptr(g,'pointerup',500+dx);};
  const tab=(target,o)=>{const e=new w.KeyboardEvent('keydown',Object.assign({key:'Tab',bubbles:true,cancelable:true},o||{}));(target||w.document).dispatchEvent(e);return e;};
  const sides=()=>[...w.document.querySelectorAll('.side')];

  ok('both grips exist, outside the panels (a panel repaint cannot destroy them)',!!grip('rail')&&!!grip('insp')&&!$('stageRail').contains(grip('rail'))&&!$('inspector').contains(grip('insp')));
  ok('the defaults are 104 / 238 px, set inline',$('stageRail').style.width==='104px'&&$('inspector').style.width==='238px');

  // 1 + 2 — drag, clamp, double-click
  drag('rail',60);
  ok('a +60 px drag on the rail grip → railW 164, width 164px',st.railW===164&&$('stageRail').style.width==='164px',st.railW);
  ok('the grip follows the edge',grip('rail').style.left==='161px',grip('rail').style.left);
  ok('the mode hint moves clear of the wider rail',$('modeHint').style.left==='176px',$('modeHint').style.left);
  drag('rail',500);ok('the rail clamps at 260',st.railW===260);
  drag('insp',400);ok('the inspector: dragging its left grip 400 px right clamps at 200',st.inspW===200&&$('inspector').style.width==='200px',st.inspW);
  drag('insp',-900);ok('… and 900 px left clamps at 520',st.inspW===520);
  grip('insp').dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));
  ok('double-click → back to 238',st.inspW===238&&$('inspector').style.width==='238px');
  grip('rail').dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true}));
  ok('double-click on the rail grip → back to 104',st.railW===104);
  ok('the room thresholds move with the widths',(function(){st.railW=260;const a=w.eval('RAIL_MIN')-104+260;
    const real=w.stageW;w.stageW=()=>a-1;const no=w.railRoom();w.stageW=()=>a;const yes=w.railRoom();w.stageW=real;st.railW=104;return !no&&yes;})());
  ok('widths are plain state, so they save with the project',(function(){st.inspW=300;const s=JSON.parse(JSON.stringify(w.sessionObj())).state;st.inspW=238;return s.inspW===300;})());

  // 3 — Tab: wide mode and back, keeping a sidebar the user had closed
  w.renderShell();
  $('hideL').click();   // the user closes the left sidebar first
  const l0=sides()[0].classList.contains('hide');
  let e=tab();
  ok('Tab: both sidebars hidden, rail and inspector off, snapshot stored',
     sides().every(s=>s.classList.contains('hide'))&&$('modeHint').style.left==='12px'&&$('stageRail').style.display==='none'&&$('inspector').style.display==='none'&&!!st.wideWork&&e.defaultPrevented);
  ok('… and the grips go with the panels',grip('rail').style.display==='none'&&grip('insp').style.display==='none');
  e=tab();
  ok('Tab again: everything back as it was — the left sidebar the user closed stays closed',
     l0===true&&sides()[0].classList.contains('hide')&&!sides()[1].classList.contains('hide')&&st.shell===true&&st.wideWork===null&&$('inspector').style.display==='block');
  ok('the edge arrows follow',$('hideL').textContent==='▶'&&$('hideR').textContent==='▶');
  $('hideL').click();

  // 4 — Tab while typing, in a modal, or in the palette is not ours
  ok('Tab in an <input> changes nothing',(function(){const inp=w.document.createElement('input');w.document.body.appendChild(inp);
    const e=tab(inp);inp.remove();return !st.wideWork&&!e.defaultPrevented;})());
  ok('Tab with a modal open changes nothing',(function(){w.openModal('x','<input id="mx">',()=>{});const e=tab();w.closeModal();return !st.wideWork&&!e.defaultPrevented;})());
  ok('Shift+Tab is not taken',(function(){const e=tab(null,{shiftKey:true});return !st.wideWork&&!e.defaultPrevented;})());

  // 5 — the RBX tool no longer owns Tab
  w.hwToolStart('rbx');
  {const rb=w.eval('HW_T.rb');tab();const on=!!st.wideWork;tab();
   ok('Tab with the RBX tool on toggles the panels, the RB class stays',on&&!st.wideWork&&w.eval('HW_T.rb')===rb);}
  w.hwToolOff();

  ok('Tab is a registered action with a help row',(function(){const a=w.actionById('view.wide');w.runAction('help.keys');const h=$('modal').textContent;w.closeModal();
    return !!a&&a.keys.join()==='tab'&&/Tab\s*széles munkanézet/.test(h);})());
  ok('a project saved in wide mode opens in wide mode',(function(){tab();const o=JSON.parse(JSON.stringify(w.sessionObj()));tab();
    w.applyProjectData(o);const r=!!st.wideWork&&sides().every(s=>s.classList.contains('hide'));tab();return r&&!st.wideWork;})());
 }catch(e){R.push(['EXCEPTION',false,e.stack.split('\n').slice(0,4).join(' | ')]);}
 let bad=0;R.forEach(([n,c,x])=>{if(!c)bad++;console.log((c?'PASS':'FAIL')+'  '+n+(x?'   ['+x+']':''));});
 console.log(bad?('\n'+bad+' FAILED'):'\nALL PASS ('+R.length+')');
 process.exit(0);
},900);
