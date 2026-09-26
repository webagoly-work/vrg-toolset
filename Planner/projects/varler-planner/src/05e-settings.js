// ==========================================================================
// 05e-settings.js — the standards panel
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================

// Every number the drawing and the bill of materials are built from, in one place.
// These are DOMAIN decisions — they differ by country, by client and by habit — so
// they belong in front of the user rather than buried in the source.

function settingsPanel(){
  const g=GUIDES.filter(x=>x.mm!=null||x.mm==='ceil').slice(0,14);
  const row=(label,html,note)=>`<div class="mrow" style="align-items:center">`
    +`<label style="width:190px;font-size:11.5px">${esc(label)}</label>${html}`
    +(note?`<span style="color:#999;font-size:11px;margin-left:8px">${esc(note)}</span>`:'')+`</div>`;
  const num=(id,val,step,suffix)=>`<input id="${id}" type="number" step="${step||1}" value="${val}" style="width:86px">`
    +(suffix?` <span style="font-size:11px;color:#777">${suffix}</span>`:'');
  openModal(t('set.title','Beállítások és szabványok'),
     `<div style="max-height:62vh;overflow:auto;padding-right:4px">`
    +`<div style="font-size:11px;color:#777;margin-bottom:6px">${esc(t('set.note','Ezekből a számokból épül a rajz és az anyagkimutatás.'))}</div>`

    +`<h4 style="margin:10px 0 4px">${esc(t('set.chase','Véset'))}</h4>`
    +row('Szélesség = ⌀ ×',num('stF',state.chaseFactor||1.6,0.1),
         `⌀20 → ${chaseWidthOf(20)} · ⌀25 → ${chaseWidthOf(25)} · ⌀32 → ${chaseWidthOf(32)} mm`)
    +row('Doboz-ráhagyás',num('stPad',state.chasePad!=null?state.chasePad:4,1,'mm'))
    +row('Doboz-fészek mélység',num('stBox',state.boxDepth||45,5,'mm'))
    +row('Véset mélység',`<span style="font-size:11.5px">⌀16–25 → 30 mm · ⌀32 → 35 mm</span>`,'szakaszonként felülírható')
    +row('Cső átmérők',`<span style="font-size:11.5px">${PATH_DIA.join(' · ')} mm</span>`,'gégecső, érszám szerint')

    +`<h4 style="margin:12px 0 4px">${esc(t('set.boxes','Dobozok és készülékek'))}</h4>`
    +row('Szerelvénydoboz',`<span style="font-size:11.5px">⌀${DEV_BOX_W} mm</span>`)
    +row('Doboz-osztás (csatolt)',`<span style="font-size:11.5px">${DEV_CLIP_SPACING} mm</span>`,'egymás mellé fűzve')
    +row('Elosztószekrény alapmagasság',num('stBoard',BOARD_DEFAULT_Z,50,'mm'),'új szekrénynél')
    +row('Álmennyezet plénum (alap)',num('stPlen',DROP_PLENUM,10,'mm'),'ha a szinten nincs megadva')

    +`<h4 style="margin:12px 0 4px">${esc(t('set.heights','Szabvány magasságok'))}</h4>`
    +`<div style="font-size:11.5px;columns:2;column-gap:18px">`
    +g.map(x=>`<div>${esc(x.l)} — <b>${x.mm==='ceil'?'belmagasság':x.mm==='gerinc'?'menny.−300':x.mm==='alcell'?'álmennyezet':x.mm+' mm'}</b></div>`).join('')
    +`</div>`

    +`<h4 style="margin:12px 0 4px">${esc(t('set.env','Környezet és IP'))}</h4>`
    +`<div style="font-size:11.5px">`+ROOM_ENV.map(e=>`<div>${esc(e.n)} — <b>${esc(e.ip)}</b> <span style="color:#999">${esc(e.note||'')}</span></div>`).join('')+`</div>`

    +`<h4 style="margin:12px 0 4px">${esc(t('set.walls','Fal sablonok'))}</h4>`
    +`<div style="font-size:11.5px;columns:2;column-gap:18px">`
    +WALL_PRESETS.map(w=>`<div>${esc(w.n)} — <b>${w.th} mm</b></div>`).join('')+`</div>`

    +gpSettingsBlock()

    +`<h4 style="margin:12px 0 4px">Nyelv / Language</h4>`
    +row('Felület nyelve',`<select id="stLang" style="width:140px">`
      +Object.keys(LANGS).map(k=>`<option value="${k}" ${lang()===k?'selected':''}>${LANGS[k]}</option>`).join('')
      +`</select>`,'a fordítás fokozatosan bővül')
    +`</div>`,
    ()=>{state.chaseFactor=Math.max(1,+$('stF').value||1.6);
      state.chasePad=Math.max(0,+$('stPad').value||0);
      state.boxDepth=Math.max(10,+$('stBox').value||45);
      state.boardZ=Math.max(0,+$('stBoard').value||BOARD_DEFAULT_Z);
      state.plenum=Math.max(0,+$('stPlen').value||DROP_PLENUM);
      const L=$('stLang').value;if(L!==lang())setLang(L);
      gpSettingsSave();
      draw();},'Mentés');}

// ---- controller (08b-gamepad.js) ----------------------------------------
// The controller's numbers are the same KIND of thing as the ones above: a
// professional preference that differs per person and per hand. They belong
// in front of the user, not buried in a module. They are NOT part of `state`
// though — sessionObj() serialises state into every saved project, and a
// per-PC input preference has no business travelling in a client's plan.
function gpSettingsBlock(){
  const G=window.PLANNER_GP;
  if(!G)return '';
  const c=G.cfg(),D=G.defaults();
  const row=(label,html,note)=>`<div class="mrow" style="align-items:center">`
    +`<label style="width:190px;font-size:11.5px">${esc(label)}</label>${html}`
    +(note?`<span style="color:#999;font-size:11px;margin-left:8px">${esc(note)}</span>`:'')+`</div>`;
  const num=(id,val,step,min,max,suffix)=>`<input id="${id}" type="number" step="${step}" min="${min}" max="${max}" value="${val}" style="width:86px">`
    +(suffix?` <span style="font-size:11px;color:#777">${esc(suffix)}</span>`:'');
  return `<h4 style="margin:12px 0 4px">${esc(t('set.gamepad','Kontroller'))}</h4>`
    +`<div style="font-size:11px;color:#777;margin-bottom:4px">`
    +esc(t('set.gamepadNote','Bal kar: kurzor · jobb kar: kamera · ravaszok: nagyítás · Y: művelet-kerék. Rajzolás közben a kurzor a képernyő közepére rögzül, és a világ mozog alatta.'))
    +`</div>`
    +row('Kontroller mód',`<input id="gpOn" type="checkbox" ${c.on?'checked':''}>`,
         G.connected()?'kontroller csatlakoztatva':'nyomj meg egy gombot a kontrolleren')
    +row('Gombsáv mutatása',`<input id="gpLeg" type="checkbox" ${c.legend?'checked':''}>`,'alul, folyamatosan')
    +row('Rezgés',`<input id="gpRum" type="checkbox" ${c.rumble?'checked':''}>`)
    +row('Függőleges tengely fordítva',`<input id="gpInv" type="checkbox" ${c.invertY?'checked':''}>`,'jobb kar')
    +row('Holtjáték',num('gpDead',c.dead,0.01,0,0.6),`alap ${D.dead}`)
    +row('Kurzor sebesség',num('gpCur',c.cursorSpeed,25,100,3000,'px/s'),`alap ${D.cursorSpeed}`)
    +row('Kamera sebesség',num('gpYaw',c.yawSpeed,5,10,600,'fok/s'),`alap ${D.yawSpeed}`)
    +row('Tapadás sugara',num('gpStick',c.sticky,4,0,160,'px'),'0 = kikapcsolva')
    +row('Kurzor doboz (kijelölés)',num('gpBoxF',c.boxFree,0.05,0,1),'a képernyő arányában; 0 = középre rögzítve')
    +row('Kurzor doboz (rajzolás)',num('gpBoxD',c.boxDraw,0.05,0,1),'alap 0 — rögzített célkereszt')
    +row('Művelet-kerék',`<select id="gpWheelMode" style="width:200px">`
      +`<option value="auto" ${c.wheel==='auto'?'selected':''}>Automatikus (a műveletlistából)</option>`
      +`<option value="curated" ${c.wheel==='curated'?'selected':''}>Rögzített 8 szelet</option>`
      +`</select>`,'az alkerék mindig generált');}

function gpSettingsSave(){
  const G=window.PLANNER_GP;
  if(!G||!$('gpOn'))return;
  const numv=(id,dflt,min,max)=>{const e=$(id);if(!e)return dflt;
    const v=+e.value;return isNaN(v)?dflt:Math.max(min,Math.min(max,v));};
  const c=G.cfg();
  G.set('legend',$('gpLeg').checked);
  G.set('rumble',$('gpRum').checked);
  G.set('invertY',$('gpInv').checked);
  G.set('dead',numv('gpDead',c.dead,0,0.6));
  G.set('cursorSpeed',numv('gpCur',c.cursorSpeed,100,3000));
  // One "camera speed" knob drives both axes, keeping the default yaw:pitch
  // ratio — two separate numbers for something the hand experiences as one
  // thing is a setting nobody tunes correctly.
  const yaw=numv('gpYaw',c.yawSpeed,10,600),D=G.defaults();
  G.set('yawSpeed',yaw);
  G.set('pitchSpeed',Math.round(yaw*(D.pitchSpeed/D.yawSpeed)));
  G.set('sticky',numv('gpStick',c.sticky,0,160));
  G.set('boxFree',numv('gpBoxF',c.boxFree,0,1));
  G.set('boxDraw',numv('gpBoxD',c.boxDraw,0,1));
  const w=$('gpWheelMode');if(w)G.set('wheel',w.value==='curated'?'curated':'auto');
  if($('gpOn').checked!==c.on)G.setEnabled($('gpOn').checked);}

registerActions([
 {id:'app.settings',label:'Beállítások és szabványok',icon:'⚙',group:'Projekt',
  alias:'settings standards preferences options',keys:['mod+,'],
  hint:'Véset-számítás, dobozméretek, szabvány magasságok, IP-táblázat, fal sablonok, nyelv.',
  run:()=>settingsPanel()},
 {id:'app.lang.hu',label:'Nyelv: magyar',icon:'🇭🇺',group:'Projekt',alias:'language hungarian magyar',
  when:()=>lang()!=='hu',run:()=>setLang('hu')},
 {id:'app.lang.en',label:'Language: English',icon:'🇬🇧',group:'Projekt',alias:'language english angol',
  when:()=>lang()!=='en',run:()=>setLang('en')}
]);

// test hooks
window.settingsPanel=settingsPanel;
