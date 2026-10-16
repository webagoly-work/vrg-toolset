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

  // T3 (2026-10-15): the rail is gone and the inspector is docked in the right column — the U5 overlay grips went with them
  ok('T3: the inspector is docked in the right column, no grips, no inline width',$('rInsp').contains($('inspector'))&&!grip('rail')&&!grip('insp')&&$('inspector').style.width==='');
  ok('… the sidebars keep their own two resizers',w.document.querySelectorAll('.resizer').length===2);
  ok('a saved inspector width is cleared, not applied',(function(){$('inspector').style.width='300px';w.renderShell();return $('inspector').style.width==='';})());

  // 3 — Tab: wide mode and back, keeping a sidebar the user had closed
  w.renderShell();
  $('hideL').click();   // the user closes the left sidebar first
  const l0=sides()[0].classList.contains('hide');
  let e=tab();
  ok('Tab: both sidebars hidden, rail and inspector off, snapshot stored',
     sides().every(s=>s.classList.contains('hide'))&&$('inspector').style.display==='none'&&!!st.wideWork&&e.defaultPrevented);
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
