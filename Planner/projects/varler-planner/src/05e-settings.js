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
      draw();},'Mentés');}

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
