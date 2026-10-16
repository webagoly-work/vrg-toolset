// ==========================================================================
// 08oc-wf-alloszto.js — workflow round (docs/workflow), WP-E6: an Alosztó on every further level
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// E5-Q8 (the user): "new levels get a sub Elosztó, called Alosztó or a DIN rail RBX of a kind to separate RCD protection
// floor by floor". The main Elosztó is the board on the meter's level (else the first board); a board placed on any
// other level becomes that level's Alosztó (⚡ Alosztó, or simply the Elosztó tool there). Placing it, in the same undo
// step, makes:
//   · its feed point on the level it is fed from (E6-Q4 = B: the nearest level below with a board — chained; else the
//     main one), straight below: a DED endpoint, variant 'alelo', at the ceiling — the riser leaves upward from there;
//   · the feeder circuit: dedicated, 3C 25A, NYM-J 5×6 (Q1 = A; preset 'alelo', 08o) — on that board. A suggested
//     breaker / cross-section is shown from the floor's load and the E5 voltage-drop figures (Q1 C).
// Protection (E6-Q3, the user): ONE main switch, in the main Elosztó; every feeder leaves its cabinet through its own RCD
// — that is the floor's RCD — so the Alosztó has no main switch and its ways are plain MCBs (05x).
// The engine runs per level: the Alosztó's level starts from the Alosztó, fed up through the slab at the riser
// (cfg.subFeed); the feeder's voltage drop is added to every circuit there (cfg.upstreamDropPct). Each board has its own
// cabinet schedule (05x). Kivitel: szekrény or DIN-sínes RBX (d.subKind).
// Prefix: als.

function alsLevelName(l){return typeof CPV_LEVEL_NAMES!=='undefined'&&CPV_LEVEL_NAMES[l]?CPV_LEVEL_NAMES[l][0]:l;}
function alsMain(){const bs=hwList('board').filter(b=>!b.sub);if(!bs.length)return null;
  const m=data.devices.find(d=>d&&d.type==='meter');return (m&&bs.find(b=>b.level===m.level))||bs[0];}
function alsSubs(){return hwList('board').filter(b=>b.sub);}
function alsFeedOf(b){return b&&b.feedEp?byId('devices',b.feedEp):null;}
function alsBoardOf(level){return hwList('board').find(b=>b.level===level)||null;}
// called by jbPlace (08n) inside its undo step, for every new board; sub = the ⚡ Alosztó tool
function alsOnBoard(d,sub){const main=alsMain();
  if(!main||main===d){if(sub)$('hud').textContent='Még nincs fő Elosztó — ez lett az Elosztó ('+(d.ref||d.id)+').';return null;}
  if(main.level===d.level){if(sub)$('hud').textContent='Az Alosztó egy másik szintre kerül — ezen a szinten az Elosztó van.';return null;}
  if(alsSubs().some(b=>b!==d&&b.level===d.level)){$('hud').textContent='Ezen a szinten már van Alosztó — ez egy második szekrény lett.';return null;}
  d.sub=true;d.ref='AL'+alsSubs().length;d.name='Alosztó — '+alsLevelName(d.level);
  // E6-Q4 = B: fed from the board of the nearest level below that has one (chained); with none below, from the main one
  const src=alsFeederBoard(d)||main,down=ORD.indexOf(src.level)>ORD.indexOf(d.level);
  const L=typeof epRoleLayer==='function'?epRoleLayer('sys:DED'):null;
  const ep={type:epTypeFor('DED'),code:'DED',var:'alelo',level:src.level,x:d.x,y:d.y,h:down?300:Math.max(300,(LH[src.level]||2700)-100),
    layer:L?L.id:src.layer,feeds:d.id,note:'Alosztó betáp — felszálló ('+alsLevelName(d.level)+')'};
  if(d.side!=null)ep.side=d.side;
  data.devices.push(ep);ensureIds(data);ep.ref='AB'+d.ref.slice(2);d.feedEp=ep.id;
  const c=cktCreate({name:'Alosztó betáp — '+alsLevelName(d.level),mcb:{curve:'C',amps:25,poles:3,n:false},dedicated:true,members:[ep.id]});c.preset='alelo';
  c.board=src.id;
  $('hud').textContent=d.ref+' Alosztó ('+alsLevelName(d.level)+') · betáp-pont '+ep.ref+' a '+alsLevelName(src.level)+' szinten ('+(src.ref||src.id)+'), '+(down?'fölötte':'alatta')
    +(typeof deviceHostWall==='function'&&!deviceHostWall(ep)?' — told falra (felszálló)':'')+' · kör: '+c.ref+' 3C 25A, NYM-J 5×6';
  return {ep,c};}
// E6-Q4 = B: the board an Alosztó is fed from — the nearest level below with a board (main or Alosztó)
function alsFeederBoard(d){const i=ORD.indexOf(d.level);for(let k=i-1;k>=0;k--){const b=hwList('board').find(x=>x!==d&&x.level===ORD[k]);if(b)return b;}return null;}
// E6-Q1 = A, C as a suggestion: the floor's connected load (its cabinet's ways × the diversity factor) → the design current
// → the breaker (the next standard rating) → the smallest NYM-J 5× cross-section that carries it (own pipe, k = 1) and
// keeps the feeder's drop + the floor's worst circuit within the 4 % limit (the E5 checks' own figures).
const ALS_DIVERSITY=0.6;                                  /*r*/ // egyidejűségi tényező for a floor ⚑
const ALS_IN=[16,20,25,32,40,50,63],ALS_MM2=[6,10,16,25];
function alsFloorKw(boardId){if(typeof eloWays!=='function')return 0;return eloWays(boardId).reduce((a,w)=>a+(w.kw||0),0);}
function alsSuggest(alId,Lm,worstPct){const al=byId('devices',alId);if(!al)return null;const ep=alsFeedOf(al),c=ep&&cktOfDevice(ep);
  // the breaker only grows: the circuit's own rating (Q1 = A, 25 A) unless the floor needs more
  const cIn=(c&&c.mcb&&c.mcb.amps)||25,kw=alsFloorKw(alId),Ib=kw*ALS_DIVERSITY*1000/(3*230),In=ALS_IN.find(a=>a>=Math.max(cIn,Ib))||63,R=BL.rules,lim=R.VDROP.limitPct;
  const fit=mm=>(R.IZ[3][mm]||0)>=In&&R.vdropPct(Lm,In,mm,true)+(worstPct||0)<=lim+1e-9;
  const mm2=ALS_MM2.find(fit)||null,cur=c&&c.mcb&&c.mcb.amps,curMm=6;
  return {kw:+kw.toFixed(1),Ib:+Ib.toFixed(1),In,mm2,dUfeed:mm2?+R.vdropPct(Lm,In,mm2,true).toFixed(2):null,worst:+(worstPct||0).toFixed(2),Lm,cur,curMm,
    same:mm2===curMm&&In===cur};}
function alsSuggestText(s){if(!s)return '';const n=v=>String(v).replace('.',',');
  return 'Betáp-javaslat: '+(s.mm2?'3C '+s.In+'A, NYM-J 5×'+s.mm2:'nincs megfelelő 25 mm²-ig — rövidebb út / két betáp')+' — terhelés '+n(s.kw)+' kW × '+n(ALS_DIVERSITY)+' → '+n(s.Ib)+' A; '
    +(s.mm2?'ΔU betáp '+n(s.dUfeed)+' % + legrosszabb kör '+n(s.worst)+' % (betáp '+n(s.Lm)+' m)':'')+(s.same?' — a mostani megfelel.':' — most: 3C '+(s.cur||'?')+'A, 5×'+s.curMm+'.');}
function alsToolStart(){jbToolStart('board');JB_T.sub=true;const mh=$('modeHint');
  if(mh)mh.textContent='Alosztó — kattints a fal oldalára (a fő Elosztótól eltérő szinten); a betáp-pont a lenti szinten, alatta jön létre · Esc: kész';}

// ---- checks -------------------------------------------------------------------------------------------------------
(STK_CHECKS['sys:DED']=STK_CHECKS['sys:DED']||[]).push(()=>{const out=[],main=alsMain();if(!main)return out;
  alsSubs().forEach(b=>{const ep=alsFeedOf(b);
    if(!ep)out.push({sev:'warn',code:'als.feed',msg:(b.ref||b.id)+': az Alosztónak nincs betáp-pontja a fő Elosztó szintjén.'});
    else if(typeof deviceHostWall==='function'&&!deviceHostWall(ep))out.push({sev:'warn',code:'als.wall',msg:(ep.ref||ep.id)+': az Alosztó betáp-pontja nincs falon — told a lenti szint egy falára (felszálló).'});});
  alsSubs().forEach(b=>{const ep=alsFeedOf(b),fb=alsFeederBoard(b);if(ep&&fb&&ep.level!==fb.level)out.push({sev:'info',code:'als.chain',
    msg:(b.ref||b.id)+': a '+alsLevelName(fb.level)+' szint táblájáról táplálható (E6-Q4 B: láncolva) — tedd le újra az Alosztót.'});});
  data.devices.forEach(d=>{if(d&&d.var==='alelo'&&d.feeds&&!byId('devices',d.feeds))out.push({sev:'warn',code:'als.orphan',msg:(d.ref||d.id)+': betáp-pont Alosztó nélkül.'});});
  ORD.forEach(l=>{if(alsBoardOf(l))return;const n=data.devices.filter(d=>d&&d.level===l&&typeof epRoleOf==='function'&&mnsIs(epRoleOf(d))&&epCodeOf(d)).length;
    if(n)out.push({sev:'info',code:'als.none',msg:alsLevelName(l)+': '+n+' erősáramú végpont, de nincs Alosztó — ⚡ Alosztó (E6: szintenként saját RCD-védelem).'});});
  cktList().forEach(c=>{const lv=new Set((c.members||[]).map(id=>(byId('devices',id)||{}).level).filter(Boolean));
    if(lv.size>1)out.push({sev:'warn',code:'als.span',msg:c.ref+' '+(c.name||'')+': két szinten van végpontja — szintenként külön kör kell (az Alosztóról).'});});
  return out;});

// the Alosztó's menu: kivitel — szekrény or a DIN-rail RBX
STK_DEVMENU.push((di,items)=>{const d=data.devices[di];if(!d||d.type!=='board'||!d.sub)return;
  items.push({label:'Alosztó kivitele: '+(d.subKind==='rbx'?'DIN-sínes RBX → szekrény':'szekrény → DIN-sínes RBX'),act:()=>{pushUndo(['devices']);
    if(d.subKind==='rbx')delete d.subKind;else d.subKind='rbx';$('hud').textContent=(d.ref||d.id)+' kivitele: '+(d.subKind==='rbx'?'DIN-sínes RBX':'szekrény');draw();}});
  items.push({label:'≈ Betáp-javaslat (keresztmetszet)…',act:()=>{const r=typeof blRun==='function'?blRun(d.level):null;
    openModal('Alosztó betáp — '+(d.ref||d.id),'<div style="font-size:12px">'+esc(r&&!r.err?(r.notes.find(x=>/^Betáp-javaslat/.test(x))||'A javaslathoz a lenti szint pályái is kellenek (vezethető fal, Elosztó).'):(r&&r.err)||'')+'</div>',()=>{},'Rendben');}});
  const ep=alsFeedOf(d);if(ep)items.push({label:'↧ Betáp-pont: '+(ep.ref||ep.id)+' ('+alsLevelName(ep.level)+')',act:()=>{state.active=ep.level;selected={t:'devices',i:data.devices.indexOf(ep)};draw();}});});

registerActions([{id:'wf.subBoard',label:'Alosztó lerakása',icon:'🗂',group:'Készülék',alias:'sub board alelosztó alosztó szint rcd',
  hint:'Szintenként saját Alosztó (saját RCD-védelem). A betáp-pont és a 3C 25A / NYM-J 5×6 kör a fő Elosztó szintjén, alatta jön létre.',
  when:c=>!c.inEditor,run:()=>alsToolStart()}]);
window.alsSuggest=alsSuggest;window.alsFloorKw=alsFloorKw;window.alsOnBoard=alsOnBoard;window.alsMain=alsMain;window.alsSubs=alsSubs;
