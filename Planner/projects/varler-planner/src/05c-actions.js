// ==========================================================================
// 05c-actions.js — the ACTION REGISTRY, the command palette and the status bar
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Every capability is declared ONCE here, and the UI is generated from it. Today
// that means the ⌘K palette, the keyboard map and the status bar; the stage rail
// and the inspector will read the same list. An action that isn't in the registry
// is a feature nobody can find.
//
//   {id, label, group, icon?, hint?, keys?, when?(ctx), run(ctx), help?}
//
// `when` decides whether the action is offered right now. `run` does the work.
// Keep `label` short and in Hungarian; `hint` is the one-line explanation the
// palette shows underneath and the Súgó tool (1.1 H1) will reuse.

const ACTIONS=[];
function registerAction(a){if(!a||!a.id)return;
  const ix=ACTIONS.findIndex(x=>x.id===a.id);
  if(ix>=0)ACTIONS[ix]=a;else ACTIONS.push(a);return a;}
function registerActions(list){(list||[]).forEach(registerAction);return ACTIONS.length;}
function actionById(id){return ACTIONS.find(a=>a.id===id)||null;}

// the context every action is judged against
function actionCtx(){
  const E=(typeof edCur==='function')?edCur():null;
  const sel=(typeof selected!=='undefined')?selected:null;
  return {mode:state.mode,level:state.active,editor:E,inEditor:!!E,
    sel,selType:(sel&&sel.t)||null,
    selCount:(typeof selList==='function')?selList().length:0,
    is3d:state.pitch<88,style:state.style};}
function actionEnabled(a,ctx){try{return a.when?!!a.when(ctx):true;}catch(_){return false;}}
function actionsFor(ctx){ctx=ctx||actionCtx();return ACTIONS.filter(a=>actionEnabled(a,ctx));}
function runAction(id,ctx){const a=actionById(id);if(!a)return false;
  ctx=ctx||actionCtx();if(!actionEnabled(a,ctx))return false;
  try{a.run(ctx);}catch(e){$('hud').textContent='Hiba: '+(e&&e.message||e);return false;}
  return true;}

// ---- keyboard map, generated from the registry ----
function actionKeyString(e){const p=[];
  if(e.ctrlKey||e.metaKey)p.push('mod');if(e.shiftKey)p.push('shift');if(e.altKey)p.push('alt');
  let k=(e.key||'').toLowerCase();if(k===' ')k='space';
  p.push(k);return p.join('+');}
function actionForKey(str,ctx){return ACTIONS.find(a=>a.keys&&a.keys.indexOf(str)>=0&&actionEnabled(a,ctx))||null;}

// ---- fuzzy match: every query character in order, contiguous runs score higher ----
const FOLD={'á':'a','é':'e','í':'i','ó':'o','ö':'o','ő':'o','ú':'u','ü':'u','ű':'u'};
function fold(s){return String(s||'').toLowerCase().replace(/[áéíóöőúüű]/g,c=>FOLD[c]);}
function paletteScore(q,text){
  if(!q)return 1;
  const t=fold(text),f=fold(q);
  // 1) whole query as a word start — what people actually mean when they type "lámpa"
  const words=t.split(/[^a-z0-9]+/);
  if(words.some(wd=>wd.indexOf(f)===0))return 1000-t.length/50;
  // 2) whole query anywhere in the text
  const at=t.indexOf(f);
  if(at>=0)return 700-at-t.length/50;
  // 3) subsequence, but only a TIGHT one — otherwise "lampa" matches "Készülék" through
  //    scattered letters and the palette becomes noise
  let ti=0,first=-1;
  for(let i=0;i<f.length;i++){const p2=t.indexOf(f[i],ti);if(p2<0)return 0;if(first<0)first=p2;ti=p2+1;}
  const span=ti-first;
  if(span>f.length*2.2)return 0;
  return 200-span;}

// Disabled actions still appear, dimmed, with the reason — that is how someone
// discovers that "Lámpa adatlap" exists and needs a lamp selected first.
function paletteMatches(q){const ctx=actionCtx();
  return ACTIONS
    .map(a=>{
      // WHERE the match landed matters: the name beats an alias beats the group beats the hint,
      // otherwise a word that happens to appear in one action's description outranks the action
      // actually named after it.
      const s0=Math.max(paletteScore(q,a.label),
                        paletteScore(q,a.alias||'')*0.95,
                        paletteScore(q,a.group||'')*0.7,
                        paletteScore(q,a.hint||'')*0.6);
      const on=actionEnabled(a,ctx);
      return {a,on,s:s0*(on?1:0.75)};})   // a strong match still wins while disabled, just ranked lower
    .filter(x=>x.s>0)
    .sort((x,y)=>(y.s-x.s)||(y.on-x.on)||x.a.label.localeCompare(y.a.label))
    .slice(0,40);}
function actionNeed(a){return a.need||t('pal.need','Nem érhető el most — jelölj ki egy megfelelő elemet, vagy zárd be a szerkesztőt.');}

// ---- the palette itself ----
let _palIx=0;
function paletteOpen(){
  let el=$('palette');
  if(!el){el=document.createElement('div');el.id='palette';document.body.appendChild(el);}
  el.innerHTML=`<div id="palBox"><input id="palQ" placeholder="${esc(t('pal.search','Parancs keresése…  (Esc = vissza)'))}" autocomplete="off">`
    +`<div id="palList"></div><div id="palFoot">${esc(t('pal.foot','↑↓ lépkedés · Enter futtatás · Esc bezár'))}</div></div>`;
  el.style.display='flex';_palIx=0;
  const q=$('palQ');
  const render=()=>{const items=paletteMatches(q.value);
    _palIx=Math.max(0,Math.min(_palIx,items.length-1));
    $('palList').innerHTML=items.length?items.map((x,i)=>
      `<div class="palRow${i===_palIx?' on':''}${x.on?'':' off'}" data-i="${i}"><span class="palIc">${x.a.icon||'•'}</span>`
      +`<span class="palLab">${esc(x.a.label)}</span>`
      +`<span class="palGrp">${esc(x.a.group||'')}</span>`
      +`<span class="palKey">${x.a.keys?esc(paletteKeyLabel(x.a.keys[0])):''}</span>`
      +((x.on?x.a.hint:actionNeed(x.a))?`<div class="palHint">${esc(x.on?x.a.hint:actionNeed(x.a))}</div>`:'')+`</div>`).join('')
      : `<div class="palRow" style="opacity:.6">${esc(t('pal.none','Nincs találat'))}</div>`;
    $('palList').querySelectorAll('.palRow').forEach(r=>{
      r.onclick=()=>{const it=paletteMatches(q.value)[+r.dataset.i];if(!it)return;
        if(!it.on){$('hud').textContent=it.a.label+' — '+actionNeed(it.a);return;}
        paletteClose();runAction(it.a.id);};});};
  q.oninput=()=>{_palIx=0;render();};
  q.onkeydown=ev=>{const items=paletteMatches(q.value);
    if(ev.key==='ArrowDown'){ev.preventDefault();_palIx=Math.min(_palIx+1,items.length-1);render();}
    else if(ev.key==='ArrowUp'){ev.preventDefault();_palIx=Math.max(_palIx-1,0);render();}
    else if(ev.key==='Enter'){ev.preventDefault();const it=items[_palIx];if(!it)return;
      if(!it.on){$('hud').textContent=it.a.label+' — '+actionNeed(it.a);return;}
      paletteClose();runAction(it.a.id);}
    else if(ev.key==='Escape'){ev.preventDefault();paletteClose();}};
  el.onpointerdown=ev=>{if(ev.target===el)paletteClose();};
  render();try{q.focus();}catch(_){}}
function paletteClose(){const el=$('palette');if(el)el.style.display='none';}
function paletteIsOpen(){const el=$('palette');return !!el&&el.style.display!=='none';}
function paletteKeyLabel(k){return (k||'').replace('mod','Ctrl').replace('shift','Shift').replace('alt','Alt')
  .replace(/\+/g,'+').replace('space','Space').toUpperCase();}

// ---- status bar: what is true right now ----
function statusBar(){const el=$('statusBar');if(!el)return;
  const E=(typeof edCur==='function')?edCur():null;
  const hmm=(typeof drawHmm==='function')?drawHmm(state.active):0;
  const gd=GUIDES.find(x=>x.k===state.drawHKey);
  const n=(typeof selList==='function')?selList().length:0;
  const v=(typeof validateSummary==='function')?validateSummary():{error:0,warn:0};
  const chip=(txt,col)=>`<span class="sbChip"${col?` style="color:${col}"`:''}>${txt}</span>`;
  el.innerHTML=
     chip('▣ '+(MODENAME[state.mode]||state.mode))
    +chip(t('sb.level','szint')+': '+state.active)
    +chip(t('sb.height','magasság')+': '+Math.round(hmm)+' mm'+(gd?' ('+esc(gd.l)+')':''))
    +chip(state.midFree?t('sb.free','szabad rajzolás'):t('sb.bound','falhoz köt'))
    +(fineAnchor?chip('🔍 '+t('sb.fine','finom 1 mm'),'#c0530f'):'')
    +(E?chip(t('sb.editor','szerkesztő')+': '+(E===WV?t('sb.wall','fal'):t('sb.plane','sík'))+(E.dirty?' ●':''),'#c0530f'):'')
    +(n?chip(n+' '+t('sb.selected','kijelölve'),'#2f6fb0'):'')
    +(v.error?chip('⛔ '+v.error+' '+t('sb.error','hiba'),'#c0392b'):'')
    +(v.warn?chip('⚠ '+v.warn+' '+t('sb.warn','figyelmeztetés'),'#c0530f'):'')
    +`<span style="flex:1"></span>`
    +chip('⌘K / Ctrl+K — '+t('sb.cmd','parancsok'),'#777');}
const MODENAME={select:'Kijelölés',grab:'Mozgatás',wall:'Fal',floor:'Padló',build:'Építés',device:'Készülék',
  path:'Pálya',cable:'Kábel',measure:'Mérés',note:'Jegyzet',object:'Objektum',roof:'Tető',format:'Formátum'};


// ===================== THE CATALOGUE =====================
// Everything the toolbar, the menus and the keyboard can do, declared once.
// Guarded with typeof so a renamed function degrades to a disabled action
// instead of breaking startup.
const _has=n=>typeof window[n]==='function'||typeof eval('typeof '+n)==='function';
function _mode(m,label,icon,keys,hint){return {id:'mode.'+m,label,icon,group:'Eszköz',keys,hint,
  when:c=>!c.inEditor,run:()=>{setMode(m);draw();}};}

registerActions([
  // ---- tools ----
  _mode('select','Kijelölés','⬚',['v'],'Elemek kiválasztása és tulajdonságaik elérése.'),
  _mode('grab','Mozgatás','✥',['m'],'Kijelölt elem mozgatása a nyilakkal és a gizmóval.'),
  _mode('wall','Fal rajzolása','🧱',['w'],'Falak húzása; a végpontok a meglévő falak tengelyére ugranak.'),
  _mode('floor','Padló rajzolása','▦',null,'Helyiség padlójának kijelölése.'),
  _mode('build','Építés (ajtó/ablak/lépcső)','🚪',['b'],'Nyílászáró elhelyezése a falon; a szellemkép mutatja, hova kerül.'),
  _mode('device','Készülék','🔌',['d'],'Aljzat, kapcsoló, lámpa, kötődoboz elhelyezése.'),
  _mode('path','Pálya','〰',['p'],'Kábelpálya rajzolása; Space letesz egy dobozt, ←/→ vált a palettán.'),
  _mode('cable','Kábel / áramkör','⚡',['c'],'Vezetékek behúzása a meglévő pályákra.'),
  _mode('measure','Mérés','📏',null,'Két pont közti távolság.'),
  _mode('object','Objektum','🧊',null,'Bútor és berendezés elhelyezése.'),
  _mode('roof','Tető','🏠',null,'Tetősík felvétele.'),
  _mode('format','Formátum másoló','🖌',null,'Egy elem beállításainak átmásolása másikra.'),

  // ---- history ----
  {id:'edit.undo',alias:'undo back',label:'Visszavonás',icon:'↶',group:'Szerkesztés',keys:['mod+z'],
   hint:'A szerkesztőben a saját előzményét vonja vissza, egyébként a rajzét.',
   run:c=>{if(c.inEditor)wvUndo();else doUndo();}},
  {id:'edit.redo',alias:'redo forward',label:'Újra',icon:'↷',group:'Szerkesztés',keys:['mod+shift+z','mod+y'],
   run:c=>{if(c.inEditor)wvRedo();else doRedo();}},
  {id:'edit.delete',alias:'delete remove',need:'Jelölj ki egy elemet.',label:'Kijelölt törlése',icon:'🗑',group:'Szerkesztés',
   when:c=>!!c.sel&&!c.inEditor,run:()=>{pushUndo();removeHit(selected);selected=null;draw();}},

  // ---- view ----
  {id:'view.toggle3d',alias:'3d 2d view toggle',label:'2D ↔ 3D',icon:'⬒',group:'Nézet',keys:['mod+3'],
   hint:'A két nézet külön kameraállást őriz.',run:()=>$('view3d').onclick()},
  {id:'view.style.plan',alias:'normal plan view',label:'Normál nézet',icon:'🖼',group:'Nézet',
   when:c=>c.style!=='plan',run:()=>{state.style='plan';if($('style'))$('style').value='plan';
     if($('styleToggle'))$('styleToggle').classList.remove('on');bpUI&&bpUI();draw();}},
  {id:'view.style.blueprint',alias:'blueprint official plan',label:'Hivatalos (blueprint) nézet',icon:'📐',group:'Nézet',
   hint:'A hivatalos 2D rajzi jelkulcs szerinti megjelenítés.',
   when:c=>c.style!=='blueprint',run:()=>{state.style='blueprint';if($('style'))$('style').value='blueprint';
     if($('styleToggle'))$('styleToggle').classList.add('on');
     if(state.pitch<88){state.pitch=90;state.flat=true;$('view3d').textContent='3D';}bpUI&&bpUI();draw();}},
  {id:'view.style.whiteout',label:'Fehér (whiteout) nézet',icon:'⬜',group:'Nézet',
   when:c=>c.style!=='whiteout',run:()=>{state.style='whiteout';if($('style'))$('style').value='whiteout';
     if($('styleToggle'))$('styleToggle').classList.remove('on');bpUI&&bpUI();draw();}},
  {id:'view.reset',alias:'reset view fit zoom',label:'Nézet visszaállítása',icon:'⟲',group:'Nézet',run:()=>{resetView();draw();}},
  {id:'view.fine',label:'Finomhangolt mozgatás be/ki',icon:'🔍',group:'Nézet',
   hint:'1 mm-es lépés, 5× lassabb mozgatás. Tartva: Alt vagy F.',run:()=>fineToggle()},
  {id:'view.midfree',label:'Szabad rajzolás köztes magasságban',icon:'⇕',group:'Nézet',
   hint:'Padló és mennyezet magasságban eddig sem kötött falhoz — ezzel a köztes magasságok is szabaddá válnak.',
   run:()=>{state.midFree=!state.midFree;if($('midFree'))$('midFree').checked=state.midFree;draw();}},

  // ---- levels ----
  {id:'level.up',label:'Feljebb egy szintet',icon:'⬆',group:'Szint',
   when:()=>ORD.indexOf(state.active)<ORD.length-1,
   run:()=>{const i=ORD.indexOf(state.active);setActive&&setActive(ORD[i+1]);state.active=ORD[i+1];draw();}},
  {id:'level.down',label:'Lejjebb egy szintet',icon:'⬇',group:'Szint',
   when:()=>ORD.indexOf(state.active)>0,
   run:()=>{const i=ORD.indexOf(state.active);setActive&&setActive(ORD[i-1]);state.active=ORD[i-1];draw();}},

  // ---- editors ----
  {id:'editor.wall',alias:'wall elevation editor',need:'Jelölj ki egy falat a rajzon.',label:'Fal-nézet szerkesztő',icon:'🧱',group:'Szerkesztő',
   hint:'A kijelölt fal homlokrajza: dobozok, pályák, vésetek, koordináta-lista.',
   when:c=>!c.inEditor&&c.selType==='wall',
   run:c=>openWallView(pieceRef(c.sel),pieceLevel(c.sel))},
  {id:'editor.close.save',label:'Szerkesztő: mentés és bezárás',icon:'💾',group:'Szerkesztő',
   when:c=>c.inEditor,run:()=>wvCloseEditor(true)},
  {id:'editor.close.discard',label:'Szerkesztő: elvetés',icon:'✕',group:'Szerkesztő',
   when:c=>c.inEditor,run:()=>wvCloseEditor(false)},
  {id:'editor.full',label:'Szerkesztő: teljes képernyő',icon:'⛶',group:'Szerkesztő',
   when:c=>c.inEditor,run:c=>{c.editor.full=!c.editor.full;edRender();}},

  // ---- project ----
  {id:'proj.new',alias:'new project reset',label:'Új projekt',icon:'✧',group:'Projekt',
   hint:'Teljesen üres munkaterület: minden réteg, pálya, jegyzet és visszavonási lépés törlődik.',
   run:()=>{if(confirm('Új, üres projekt? A jelenlegi munka mentve marad a projektlistában, ha elmentetted.'))newBlankProject();}},
  {id:'proj.save',alias:'save project',label:'Projekt mentése',icon:'💾',group:'Projekt',keys:['mod+s'],
   run:()=>{if($('pjSave'))$('pjSave').click();else if(typeof saveSession==='function'){saveSession();$('hud').textContent='Mentve.';}}},
  {id:'proj.export',alias:'export json backup',label:'Exportálás JSON-ba',icon:'⬇',group:'Projekt',
   when:()=>!!$('pjExport'),run:()=>$('pjExport').click()},

  // ---- documentation ----
  {id:'doc.png',alias:'png image export screenshot',label:'Kép mentése (PNG)',icon:'🖼',group:'Dokumentáció',
   when:()=>!!$('bPNG'),run:()=>$('bPNG').click()},
  {id:'doc.print',alias:'print pdf paper',label:'Nyomtatás / PDF',icon:'🖨',group:'Dokumentáció',keys:['mod+p'],
   when:()=>!!$('bPrint'),run:()=>$('bPrint').click()},
  {id:'doc.totals',alias:'bom totals schedule quantity',label:'Anyagkimutatás megnyitása',icon:'📊',group:'Dokumentáció',
   when:()=>!!$('bSched'),run:()=>$('bSched').click()},

  // ---- checks ----
  {id:'check.list',alias:'validate check errors issues',label:'Ellenőrzés: hibák és figyelmeztetések',icon:'✔',group:'Ellenőrzés',
   hint:'Lógó kötések, hiányos pályák, kettőzött azonosítók.',
   run:()=>{const v=validateSummary();
     if(!v.issues.length){alert('Nincs kifogásolható elem a tervben.');return;}
     openModal('Ellenőrzés',
       `<div style="max-height:50vh;overflow:auto;font-size:12px">`
       +v.issues.map(i=>`<div style="padding:3px 0;border-bottom:1px solid #f0f0f0">`
         +`<b style="color:${i.sev==='error'?'#c0392b':'#c0530f'}">${i.sev==='error'?'⛔':'⚠'}</b> ${esc(i.msg)}`
         +`<span style="color:#999"> · ${esc(i.code)}</span></div>`).join('')
       +`</div>`,()=>{},'Bezár');}},

  // ---- help ----
  {id:'help.palette',alias:'command palette search',label:'Parancsok keresése',icon:'⌘',group:'Súgó',keys:['mod+k'],
   hint:'Minden funkció egy helyen, kereshetően.',run:()=>paletteOpen()},
  {id:'help.keys',alias:'keyboard shortcuts keys help',label:'Billentyűk',icon:'⌨',group:'Súgó',
   run:()=>openModal('Billentyűk',
     `<div style="font-size:12px;line-height:1.9">`
     +[['Bal egér','kijelölés / rajzolás'],['Jobb egér','helyi menü arra, ami a kurzor alatt van'],
       ['Space','a kiválasztott doboz letétele rajzolás közben'],['←/→','paletta vagy variáns váltása'],
       ['↑/↓','rajzolási magasság'],['Alt vagy F','finomhangolt mozgatás (1 mm)'],
       ['Shift','tengelyre kényszerítés'],['Ctrl','a fal másik oldala / snap felülbírálás'],
       ['Dupla kattintás','tulajdonságok'],['Esc','egy szintet kilép — soha nem dob el munkát'],
       ['Ctrl+Z / Ctrl+Shift+Z','visszavonás / újra'],['Ctrl+K','parancskereső']]
       .map(r=>`<div><b style="display:inline-block;min-width:170px">${r[0]}</b> ${r[1]}</div>`).join('')
     +`</div>`,()=>{},'Bezár')}
]);

// ---- palette + status wiring ----
document.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName)||'';
  if(paletteIsOpen())return;                                  // the palette handles its own keys
  if((e.ctrlKey||e.metaKey)&&(e.key||'').toLowerCase()==='k'){e.preventDefault();paletteOpen();return;}
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  if(edCur())return;                                          // an open editor owns the keyboard
  const a=actionForKey(actionKeyString(e),actionCtx());
  if(a&&a.keys&&a.keys[0]!=='mod+z'&&a.keys[0]!=='mod+shift+z'){ // undo/redo already have handlers
    e.preventDefault();runAction(a.id);}
},true);

// test hooks
window.ACTIONS=ACTIONS;window.actionById=actionById;window.actionsFor=actionsFor;window.actionCtx=actionCtx;
window.runAction=runAction;window.paletteMatches=paletteMatches;window.paletteOpen=paletteOpen;
window.paletteClose=paletteClose;window.paletteIsOpen=paletteIsOpen;window.statusBar=statusBar;
window.registerAction=registerAction;window.actionKeyString=actionKeyString;window.actionForKey=actionForKey;
window.paletteScore=paletteScore;

// ---- second batch: the things that used to live only in the side panel or a menu ----
registerActions([
  {id:'chase.settings',alias:'chase groove settings',label:'Véset beállítások (szélesség, doboz-ráhagyás, mélység)',icon:'▨',group:'Véset',
   hint:'A véset szélessége a cső átmérőjéből számolódik: ⌀ × szorzó.',
   run:()=>openModal('Véset beállítások',
     `<div class="mrow">Szélesség = ⌀ × <input id="csF" type="number" step="0.1" min="1" value="${state.chaseFactor||1.6}" style="width:70px"></div>`
    +`<div class="mrow">Doboz-ráhagyás <input id="csP" type="number" step="1" min="0" value="${state.chasePad!=null?state.chasePad:4}" style="width:70px"> mm</div>`
    +`<div class="mrow">Doboz-mélység <input id="csD" type="number" step="5" min="10" value="${state.boxDepth||45}" style="width:70px"> mm</div>`
    +`<div class="mrow" style="font-size:11px;color:#777">⌀20 → ${chaseWidthOf(20)} mm · ⌀25 → ${chaseWidthOf(25)} mm · ⌀32 → ${chaseWidthOf(32)} mm széles véset.</div>`,
     ()=>{state.chaseFactor=Math.max(1,+$('csF').value||1.6);state.chasePad=Math.max(0,+$('csP').value||0);
       state.boxDepth=Math.max(10,+$('csD').value||45);draw();})},
  {id:'drop.settings',label:'Álmennyezet beállítása',icon:'⬓',group:'Szint',
   hint:'Szintenkénti álmennyezet-magasság; helyiségenként felülírható az adatlapon.',
   when:()=>!!$('dcVal'),run:()=>{$('dcVal').focus();$('hud').textContent='Álmennyezet: a szint melletti mezőben állítható.';}},
  {id:'bg.load',alias:'background image underlay load',label:'Háttérkép betöltése',icon:'🖼',group:'Rajz',run:()=>loadBgImage()},
  {id:'bg.settings',label:'Háttérkép beállítás (pozíció, méret, forgatás)',icon:'◐',group:'Rajz',
   when:()=>!!state.bg,run:()=>bgSettings()},
  {id:'bg.toggle',label:'Háttérkép mutatása / elrejtése',icon:'👁',group:'Rajz',
   when:()=>!!state.bg,run:()=>{state.bg.visible=!state.bg.visible;draw();}},
  {id:'gen.toggle',label:'Generált objektumok mutatása / elrejtése',icon:'🧊',group:'Rajz',
   hint:'A lámpa-adatlapból generált lámpatestek.',
   run:()=>{state.showGenObjects=!genObjectsVisible();draw();}},
  {id:'drop.toggle',label:'Álmennyezet sík mutatása / elrejtése',icon:'⬓',group:'Rajz',
   run:()=>{state.showDropCeil=!(state.showDropCeil!==false);if($('dcShow'))$('dcShow').checked=state.showDropCeil;draw();}},
  {id:'labels.toggle',label:'Feliratok mutatása / elrejtése',icon:'🏷',group:'Rajz',
   run:()=>{state.showLabels=!state.showLabels;if($('showLabels'))$('showLabels').checked=state.showLabels;draw();}},
  {id:'refs.toggle',label:'Jelölések (D1, K1…) mutatása / elrejtése',icon:'#',group:'Rajz',
   run:()=>{state.showRefs=!state.showRefs;if($('showRefs'))$('showRefs').checked=state.showRefs;draw();}},
  {id:'place.next',label:'Következő elem a Space-palettán',icon:'␣',group:'Eszköz',
   hint:'Ugyanaz, mint a → nyíl pálya rajzolása közben.',
   when:c=>!c.inEditor,run:()=>cyclePlace(1)},
  {id:'place.prev',label:'Előző elem a Space-palettán',icon:'␣',group:'Eszköz',
   when:c=>!c.inEditor,run:()=>cyclePlace(-1)},
  {id:'place.list',label:'Space-paletta: elem választása',icon:'␣',group:'Eszköz',
   hint:'Szerelvénydoboz, kötődobozok, minden kapcsoló- és aljzattípus.',
   run:()=>{const opts=PLACE_ITEMS.map((it,i)=>`<option value="${i}" ${i===(state.placeIdx||0)?'selected':''}>${esc(it.n)}</option>`).join('');
     openModal('Mit tegyen le a Space?',`<div class="mrow"><select id="plSel" style="width:100%">${opts}</select></div>`,
       ()=>{state.placeIdx=+$('plSel').value||0;$('hud').textContent='Space → '+placeItem().n;draw();});}},
  {id:'room.sheet',alias:'room properties sheet',need:'Jelölj ki egy helyiséget (padlót).',label:'Helyiség adatlap',icon:'🏷',group:'Helyiség',
   hint:'Név, rendeltetés, környezet (IP), burkolatok, alapmagasságok.',
   when:c=>c.selType==='floors',
   run:c=>roomPropsDialog(data.floors[c.sel.i],pieceLevel(c.sel),'F')},
  {id:'room.floorview',need:'Jelölj ki egy helyiséget (padlót).',label:'Padló nézet (felülnézet)',icon:'⬓',group:'Helyiség',
   when:c=>c.selType==='floors'&&!c.inEditor,
   run:c=>openPlaneView(data.floors[c.sel.i],pieceLevel(c.sel),'floor')},
  {id:'room.ceilview',need:'Jelölj ki egy helyiséget (padlót).',label:'Mennyezet nézet (felülnézet)',icon:'⬒',group:'Helyiség',
   when:c=>c.selType==='floors'&&!c.inEditor,
   run:c=>openPlaneView(data.floors[c.sel.i],pieceLevel(c.sel),'ceiling')},
  {id:'room.dropview',need:'Jelölj ki egy helyiséget (padlót).',label:'Álmennyezet nézet (felülnézet)',icon:'⬓⬒',group:'Helyiség',
   when:c=>c.selType==='floors'&&!c.inEditor,
   run:c=>openPlaneView(data.floors[c.sel.i],pieceLevel(c.sel),'drop')},
  {id:'wall.props',alias:'wall properties thickness',need:'Jelölj ki egy falat.',label:'Fal tulajdonságai (vastagság, magasság, indulás)',icon:'📐',group:'Fal',
   hint:'Pengefal, lebegő fal, anyag — élő m²/m³ kijelzéssel.',
   when:c=>c.selType==='wall',run:c=>wallPropsDialog(pieceRef(c.sel),pieceLevel(c.sel))},
  {id:'wall.pengefal',need:'Jelölj ki egy falat.',label:'Pengefal 100 mm',icon:'🔪',group:'Fal',
   when:c=>c.selType==='wall',run:c=>{pushUndo();setWallGeom(pieceRef(c.sel),pieceLevel(c.sel),{th:100});draw();}},
  {id:'lamp.sheet',alias:'lamp light fixture sheet',need:'Jelölj ki egy lámpát.',label:'Lámpa adatlap',icon:'💡',group:'Készülék',
   hint:'Méret, beépítés, bolti link, kép, generált objektum.',
   when:c=>c.selType==='devices'&&(data.devices[c.sel.i]||{}).type==='light',
   run:c=>lampDialog(c.sel.i)},
  {id:'dev.height',need:'Jelölj ki egy készüléket.',label:'Készülék magassága',icon:'⇕',group:'Készülék',
   when:c=>c.selType==='devices',
   run:c=>{const D=data.devices[c.sel.i];openModal('Szerelési magasság',
     `<div class="mrow"><input id="dzq" type="number" step="10" value="${Math.round(D.h||0)}" style="width:90px"> mm</div>`,
     ()=>{pushUndo();D.h=Math.max(0,+$('dzq').value||0);draw();});}},
  {id:'door.type',alias:'door type sliding garage',need:'Jelölj ki egy ajtót.',label:'Ajtó típusa',icon:'🚪',group:'Nyílászáró',
   hint:'Nyíló, kétszárnyú, toló, falba futó, harmonika, garázskapu, redőnykapu, tűzgátló.',
   when:c=>c.selType==='openings'&&(data.openings[c.sel.i]||{}).type==='door',
   run:c=>doorTypeDialog(c.sel.i)},
  {id:'note.layer',label:'Jegyzetek mutatása / elrejtése (minden felületen)',icon:'📝',group:'Jegyzet',
   when:()=>!!$('lyNotes'),run:()=>{$('lyNotes').click();}},
]);
