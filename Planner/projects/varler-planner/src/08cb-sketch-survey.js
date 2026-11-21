// ==========================================================================
// 08cb-sketch-survey.js — VRG Sketcher (Mobile WP M26–M29, M47): the survey's intake and takeoff, kept with the job
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// 08ca imports the DRAWING of a phone survey (rooms, points, circuits, routes, photo points). The survey also holds the
// INTAKE: what the job is and what the client wants (scope toggles and quantities), the answered and open questions,
// the notes with their chips (Tisztázandó = still to clarify) and the purpose photos. Since WP M47 the phone and the
// Desktop Sketcher put the TAKEOFF next to it in the package (o.takeoff, kind vrg-sketch-takeoff v1,
// docs/sketcher/TAKEOFF.md): the work items with quantities, what is guessed (≈) and the open decisions (⚑).
//
// Both are the job's facts, so they live on the building (B.survey), which every save and project file carries; nothing
// is drawn, so the golden renders stay byte-identical. "Felmérés: munkakör lap" (⌘K) shows them. A package from an older
// phone has no takeoff: the raw intake is kept and shown by its ids. Prefix: svy.

const SVY_KIND='vrg-sketch-takeoff';
function svyTakeoff(o){const t=o&&o.takeoff;return t&&t.kind===SVY_KIND&&Array.isArray(t.items)?t:null;}
function svyHasIntake(sk){return !!sk&&(Object.keys(sk.scope||{}).length>0||Object.keys(sk.answers||{}).length>0
  ||(sk.entries||[]).length>0||(sk.captures||[]).length>0);}

// the package → B.survey, or null when the survey carries no intake at all
function svyFromPackage(o){const sk=(o&&o.sketch)||{},t=svyTakeoff(o);
  if(!t&&!svyHasIntake(sk))return null;
  const ans={};Object.keys(sk.answers||{}).forEach(q=>{const a=sk.answers[q]||{};ans[q]={options:(a.options||[]).slice(),text:a.text||'',state:a.state||'answered'};});
  return {src:'vazlat',id:sk.id||'',name:o.name||sk.name||'',at:o.exported||null,
    takeoff:t?JSON.parse(JSON.stringify(t)):null,
    raw:{scope:Object.assign({},sk.scope||{}),answers:ans,
      entries:(sk.entries||[]).map(e=>({id:e.id,text:e.text||'',chips:(e.chips||[]).slice(),open:!!e.open,room:e.room||''})),
      captures:(sk.captures||[]).map(c=>Object.assign({id:c.id,purpose:c.purpose||'egyeb',file:c.file||'',note:c.note||''},
        c.kind&&c.kind!=='photo'?{kind:c.kind}:{},c.signer?{signer:c.signer}:{}))}};}   // F8 (M53): a video / signature stays one

function svySurvey(){return (typeof B==='object'&&B&&B.survey)||null;}

// the HUD's tail after an import
function svySummary(sv){if(!sv)return '';const t=sv.takeoff;
  if(t){const c=t.counts||{};let s=` · felmérés: ${c.items||0} tétel`;if(c.est)s+=` (${c.est} ≈)`;
    if(c.decisions)s+=`, ${c.decisions} nyitott döntés`;if(c.tisztazando)s+=`, ${c.tisztazando} tisztázandó`;return s;}
  const r=sv.raw,open=r.entries.filter(e=>e.open).length;
  return ` · felmérés: ${Object.keys(r.scope).length} munkakör, ${Object.keys(r.answers).length} válasz, ${r.entries.length} jegyzet`+(open?`, ${open} tisztázandó`:'');}

function svyFmt(x){const r=Math.round(x*10);return r%10===0?String(r/10):(r<0?'-':'')+Math.floor(Math.abs(r)/10)+','+(Math.abs(r)%10);}
const SVY_COL={est:'#d0701e',open:'#d64545',ok:'#3dae5a',faint:'var(--pc-mute,#888)'};

function svyTakeoffHtml(t){const sec=(h,body)=>body?`<div class="mrow svy-sec" style="flex-direction:column;align-items:stretch;gap:3px"><b>${h}</b>${body}</div>`:'';
  const flag=it=>(it.est?`<span class="svy-est" style="color:${SVY_COL.est}" title="becsült">≈</span>`:'')+((it.open||[]).length?`<span class="svy-flag" style="color:${SVY_COL.open}" title="nyitott döntés">⚑</span>`:'');
  let h=`<div class="mrow" style="font-size:11px;color:${SVY_COL.faint}">≈ becsült · ⚑ nyitott döntés változtathat rajta · árat nem tartalmaz (Workflow Kit)</div>`;
  h+=sec('Munkakör',(t.scope||[]).map(g=>`<div><i>${esc(g.label)}:</i> ${g.items.map(i=>esc(i.sym+' '+i.label)+(i.qty>1?' ×'+i.qty:'')).join(', ')}</div>`).join(''));
  h+=sec('Tételek',(t.items||[]).length?`<table class="svy-items" style="border-collapse:collapse;font-size:12px">`+t.items.map(it=>
    `<tr class="svy-item" data-id="${esc(it.id)}" style="${it.work===false?'opacity:.6':''}"><td>${esc(it.sym)}</td><td>${esc(it.label)}</td>`
    +`<td style="text-align:right;padding:0 6px"><b>${svyFmt(it.qty)}</b> ${esc(it.unit)}</td><td>${flag(it)}</td><td style="font-size:11px;color:${SVY_COL.faint}">${esc(it.note||'')}</td></tr>`).join('')+`</table>`:'<div>Még nincs tétel.</div>');
  const lab=id=>{const it=(t.items||[]).find(x=>x.id===id);return it?it.label:id;};
  h+=sec('Döntésre vár ⚑',(t.decisions||[]).map(d=>`<div class="svy-dec" style="color:${SVY_COL.open}">${d.state==='later'?'⏱ ':'⚑ '}${esc(d.label)}`
    +(d.affects.length?` <span style="color:${SVY_COL.faint}">→ ${esc(d.affects.map(lab).join(', '))}</span>`:'')+`</div>`).join(''));
  h+=sec('Ellenőrizni',(t.checks||[]).map(c=>`<div>${esc(c)}</div>`).join(''));
  const qs=t.questions||[],ans=qs.filter(q=>q.state==='answered'),open=qs.filter(q=>q.state!=='answered');
  h+=sec(`Kérdések — ${ans.length} megválaszolva`,ans.map(q=>`<div class="svy-ans"><span style="color:${SVY_COL.ok}">✓</span> ${esc(q.label)} — ${esc(q.options.join(', '))}${q.text?` „${esc(q.text)}”`:''}</div>`).join(''));
  h+=sec(`Nyitott kérdések — ${open.length}`,open.map(q=>`<div class="svy-q">${q.state==='later'?'⏱':'○'} ${esc(q.label)}</div>`).join(''));
  h+=sec('Jegyzetek',(t.notes||[]).map(n=>`<div class="${n.open?'svy-open':'svy-note'}"${n.open?` style="color:${SVY_COL.open}"`:''}>${n.open?'⚑ Tisztázandó: ':''}${esc(n.text||'(csak címke)')}`
    +(n.chips.length?` <span style="color:${SVY_COL.faint}">[${esc(n.chips.join(', '))}]</span>`:'')+(n.room?` · ${esc(n.room)}`:'')+`</div>`).join('')
    +(t.memos||[]).map(m=>`<div>✎ ${esc(m.text)}</div>`).join(''));
  h+=sec('Fotók',(t.photos||[]).map(p=>`<div class="svy-ph">${esc(p.sym+' '+p.label)}: ${p.n}${p.files.length?` <span style="color:${SVY_COL.faint};font-size:11px">${esc(p.files.join(', '))}</span>`:''}</div>`).join(''));
  return h;}

function svyRawHtml(r){const sec=(h,body)=>body?`<div class="mrow svy-sec" style="flex-direction:column;align-items:stretch;gap:3px"><b>${h}</b>${body}</div>`:'';
  let h=`<div class="mrow" style="font-size:11px;color:${SVY_COL.faint}">A telefon régebbi exportja: tételek és címkék nélkül, az azonosítókkal. Az új export a munkakör lapot is hozza.</div>`;
  h+=sec('Munkakör',Object.keys(r.scope).length?`<div>${esc(Object.keys(r.scope).map(k=>k+(r.scope[k]>1?' ×'+r.scope[k]:'')).join(', '))}</div>`:'');
  h+=sec('Válaszok',Object.keys(r.answers).map(q=>{const a=r.answers[q];return `<div class="svy-ans">${a.state==='answered'?'✓':a.state==='later'?'⏱':'⊘'} ${esc(q)}: ${esc(a.options.join(', '))}${a.text?` „${esc(a.text)}”`:''}</div>`;}).join(''));
  h+=sec('Jegyzetek',r.entries.map(n=>`<div class="${n.open?'svy-open':'svy-note'}"${n.open?` style="color:${SVY_COL.open}"`:''}>${n.open?'⚑ Tisztázandó: ':''}${esc(n.text||'(csak címke)')}${n.chips.length?` [${esc(n.chips.join(', '))}]`:''}</div>`).join(''));
  const by={};r.captures.forEach(c=>{by[c.purpose]=(by[c.purpose]||0)+1;});
  h+=sec('Fotók',Object.keys(by).map(p=>`<div class="svy-ph">${esc(p)}: ${by[p]}</div>`).join(''));
  return h;}

function svyHtml(sv){if(!sv)return '<div class="mrow">Ehhez a tervhez nincs felmérés.</div>';
  return `<div id="svyBody" style="max-height:62vh;overflow:auto">`+(sv.takeoff?svyTakeoffHtml(sv.takeoff):svyRawHtml(sv.raw))+`</div>`;}
function svyOpen(){const sv=svySurvey();openModal('Felmérés: munkakör lap'+(sv&&sv.name?' — '+esc(sv.name):''),svyHtml(sv),()=>true,'Kész');}

registerActions([{id:'sketch.survey',label:'Felmérés: munkakör lap',icon:'☰',group:'Helyiség',
  alias:'felmeres munkakor takeoff anyagkigyujtes tetelek kerdesek jegyzet tisztazando survey intake scope sketcher mobile',
  hint:'A helyszíni felmérés (VRG Sketcher): a munkakör, a tételek mennyiséggel (≈ becsült, ⚑ nyitott döntés), a kérdések, a jegyzetek és a fotók.',
  need:'Ehhez a tervhez nincs felmérés (VRG Sketcher csomagból jön).',when:()=>!!svySurvey(),run:()=>svyOpen()}]);
