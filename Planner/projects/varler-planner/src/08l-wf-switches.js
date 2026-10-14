// ==========================================================================
// 08l-wf-switches.js — workflow round (docs/workflow), WP-E1: lamps ↔ switches (Kapcsolások)
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// Switches do not start out with a type. The user links LAMPS to switch positions — a door's L1 portal slot (O2), an
// existing switch, or any wall spot (Alt) — and the switch is created there on the first link. Lamps can be joined
// first into one switched leg (d.grp, "Lámpák összekötése"); a group always switches together.
// The link is the existing sw.ctl = [lamp ids] (05s, Q29). The switch TYPE follows from the links, in the Planner's own
// numbering (SWITCH_TYPES, 02-state) on the existing field sw.swType: one leg 101 · two legs 105 csillár · a leg shared
// with other switches 106 váltó at the two ends of the chain, 107 kereszt in the middle · two shared legs 108 dupla
// váltó · a shutter 'redony'.
// ⚠ THE NUMBERS ARE THE HUNGARIAN CODES AND MUST NOT BE CHANGED: 105 = CSILLÁR, 106 = VÁLTÓ, 108 = DUPLA VÁLTÓ (the code
// has gaps — 103 is háromfázisú, 104 is unused). The user corrected this twice; see the note at SWITCH_TYPES in 02-state.js. A type the user set by hand stays (sw.typeFix). A switch in a slot follows its door (E03 = A).
// "Kapcsolások javaslata" (E02 = A): every room's unswitched lamps → one leg → the L1 slot of each room door (two doors =
// two-way); a wet room's lamps → the dry face of its door (the P33 engine's rule) — shown as a table, nothing silent.
const LSW={on:false,set:[],hover:null};

function lswLamp(d){return !!d&&typeof epIsLamp==='function'&&epIsLamp(d);}
function lswSw(d){return !!d&&typeof epCodeOf==='function'&&epCodeOf(d)==='SWI';}
function lswLegOf(l){return l.grp||('L:'+l.id);}
// every lamp of a leg (the group, or the lamp alone)
function lswLeg(l){return l.grp?data.devices.filter(d=>lswLamp(d)&&d.grp===l.grp):[l];}
function lswNextGrp(){let n=0;data.devices.forEach(d=>{const m=/^G(\d+)$/.exec(d&&d.grp||'');if(m)n=Math.max(n,+m[1]);});return 'G'+(n+1);}
// join lamps into one leg (lamps already in groups bring their whole group)
function lswGroup(ids){const L=[...new Set(ids)].map(id=>byId('devices',id)).filter(lswLamp);if(L.length<2)return null;
  pushUndo(['devices']);const keep=L.find(l=>l.grp),g=keep?keep.grp:lswNextGrp(),old=new Set(L.map(l=>l.grp).filter(x=>x&&x!==g));
  data.devices.forEach(d=>{if(lswLamp(d)&&(L.indexOf(d)>=0||old.has(d.grp)))d.grp=g;});
  // a switch that controls part of the leg now controls all of it
  data.devices.forEach(s=>{if(!lswSw(s)||!Array.isArray(s.ctl))return;const leg=data.devices.filter(d=>lswLamp(d)&&d.grp===g).map(d=>d.id);
    if(s.ctl.some(id=>leg.indexOf(id)>=0))leg.forEach(id=>{if(s.ctl.indexOf(id)<0)s.ctl.push(id);});});
  lswRetypeAll();draw();return g;}
function lswUngroup(id){const l=byId('devices',id);if(!l||!l.grp)return false;pushUndo(['devices']);delete l.grp;
  const left=data.devices.filter(d=>lswLamp(d)&&d.grp&&!data.devices.some(o=>o!==d&&o.grp===d.grp));left.forEach(d=>delete d.grp);lswRetypeAll();draw();return true;}

// the switch at a slot, or a new one there (no undo of its own — the caller pushes)
function lswSwitchAtSlot(s){const ex=data.devices.find(d=>lswSw(d)&&d.slot&&d.slot.door===s.door&&d.slot.face===s.face&&d.slot.k===s.k);if(ex)return ex;
  return lswMake({level:s.level,x:s.x,y:s.y,side:s.face>0?1:0,slot:{door:s.door,face:s.face,k:s.k}});}
function lswMake(o){const L=typeof epRoleLayer==='function'?epRoleLayer('sys:LIGHT'):null;
  const h=typeof stdH==='function'?(stdH('SWI','alap',null)||1100):1100;
  const d={type:'switch',code:'SWI',var:'230',level:o.level,x:Math.round(o.x),y:Math.round(o.y),h,side:o.side,layer:L?L.id:state.activeLayer};
  if(o.slot)d.slot=o.slot;data.devices.push(d);ensureIds(data);d.ref=typeof nextRef==='function'?nextRef('switch'):d.id;d.swNum=2;return d;}
// link lamps (their whole legs) to a target: {slot} | {sw} | {wall:{level,x,y,side}}
function lswLink(ids,target,noUndo){const lamps=[...new Set(ids.map(id=>byId('devices',id)).filter(lswLamp).flatMap(lswLeg))];if(!lamps.length)return null;
  if(!noUndo)pushUndo(['devices']);
  const sw=target.sw||(target.slot?lswSwitchAtSlot(target.slot):lswMake(target.wall));
  sw.ctl=Array.isArray(sw.ctl)?sw.ctl:[];lamps.forEach(l=>{if(sw.ctl.indexOf(l.id)<0)sw.ctl.push(l.id);});
  lswRetypeAll();if(!noUndo)draw();return sw;}
function lswUnlink(ids,sw){if(!sw||!Array.isArray(sw.ctl))return false;const legs=new Set(ids.map(id=>byId('devices',id)).filter(lswLamp).flatMap(lswLeg).map(l=>l.id));
  pushUndo(['devices']);sw.ctl=sw.ctl.filter(id=>!legs.has(id));if(!sw.ctl.length)delete sw.ctl;lswRetypeAll();draw();return true;}

// ---- the type -----------------------------------------------------------------------------------------------------------
function lswLegsOf(sw){const out=[];(sw.ctl||[]).forEach(id=>{const l=byId('devices',id);if(!l)return;const k=lswLegOf(l);if(out.indexOf(k)<0)out.push(k);});return out;}
function lswSharing(leg){return data.devices.filter(s=>lswSw(s)&&lswLegsOf(s).indexOf(leg)>=0);}
// the order of a chain of switches on one leg: start at the one farthest from the rest, then nearest-next
function lswChain(sws){if(sws.length<3)return sws.slice();const c=[sws.reduce((a,s)=>a+s.x,0)/sws.length,sws.reduce((a,s)=>a+s.y,0)/sws.length];
  let cur=sws.slice().sort((a,b)=>Math.hypot(b.x-c[0],b.y-c[1])-Math.hypot(a.x-c[0],a.y-c[1]))[0];const out=[cur],left=sws.filter(s=>s!==cur);
  while(left.length){left.sort((a,b)=>Math.hypot(a.x-cur.x,a.y-cur.y)-Math.hypot(b.x-cur.x,b.y-cur.y));cur=left.shift();out.push(cur);}return out;}
// {k (SWITCH_TYPES key), why, gang}
function lswType(sw){const legs=lswLegsOf(sw);if(!legs.length)return {k:'101',why:'nincs bekötve',gang:0};
  const lamps=(sw.ctl||[]).map(id=>byId('devices',id)).filter(Boolean);
  if(lamps.length&&lamps.every(l=>epCodeOf(l)==='SHU'))return {k:'redony',why:'redőny',gang:1};
  const shared=legs.filter(g=>lswSharing(g).length>1);
  if(!shared.length)return legs.length===1?{k:'101',why:'egy kapcsolt ág',gang:1}:{k:'105',why:legs.length+' kapcsolt ág'+(legs.length>2?' — többes kapcsoló ⚑':''),gang:legs.length};
  if(shared.length>=2)return {k:'108',why:shared.length+' ág több helyről kapcsolva',gang:2};
  const ch=lswChain(lswSharing(shared[0])),i=ch.indexOf(sw);
  if(i>0&&i<ch.length-1)return {k:'107',why:'a lánc közepe ('+ch.length+' kapcsoló)',gang:1};
  return {k:legs.length>1?'108':'106',why:ch.length+' helyről kapcsolva'+(legs.length>1?' + saját ág':''),gang:legs.length};}
function lswRetypeAll(){data.devices.forEach(s=>{if(!lswSw(s)||s.typeFix)return;const t=lswType(s);if(!s.ctl&&!s.slot)return;s.swType=t.k;s.swNum=2;s.gang=t.gang;});if(typeof jbResize==='function')jbResize();}   // E3: a szobadoboz grows when a leg starts meeting in it

// ---- E03 = A: a slot switch follows its door ------------------------------------------------------------------------------
function lswReseat(){let n=0;data.devices.forEach(s=>{if(!lswSw(s)||!s.slot)return;const o=byId('openings',s.slot.door);if(!o)return;
  const t=(typeof ptSlots==='function'?ptSlots(o):[]).find(x=>x.face===s.slot.face&&x.k===s.slot.k)
    ||(typeof ptSlots==='function'?ptSlots(o):[]).find(x=>x.k===s.slot.k&&x.room===(s.slot.room||x.room));
  if(!t)return;if(Math.abs(t.x-s.x)>1||Math.abs(t.y-s.y)>1){s.x=t.x;s.y=t.y;s.side=t.face>0?1:0;n++;}});return n;}
STK_TOOLS.push({k:'lswReseat',active:()=>true,up:()=>{if(lswReseat())draw();return false;}});

// ---- the suggestion (E02 = A) -------------------------------------------------------------------------------------------
function lswWet(rm){const ks=Array.isArray(rm.kinds)&&rm.kinds.length?rm.kinds:[typeof needKind==='function'?needKind(rm):rm.kind];return ks.some(k=>k==='furdo'||k==='wc');}
function lswSuggest(level){level=level||state.active;const rows=[];
  const switched=new Set();data.devices.forEach(s=>{if(lswSw(s))(s.ctl||[]).forEach(id=>switched.add(id));});
  allRooms(level).forEach(e=>{const rm=e.rm;if(!rm.id)return;
    const lamps=data.devices.filter(d=>d&&d.level===level&&epCodeOf(d)==='LMP'&&!switched.has(d.id)&&(roomOfDevice(d)||{}).rm===rm);if(!lamps.length)return;
    const wet=lswWet(rm),doors=(data.openings||[]).filter(o=>o.type==='door'&&o.level===level&&mrkDoorRooms(o).some(x=>x&&x.rm===rm));
    const slots=[];doors.forEach(o=>{const S=ptSlots(o).filter(s=>s.k==='L1');
      const own=S.find(s=>s.room===rm.id),dry=S.find(s=>s.room!==rm.id);const pick=wet?(dry||own):own;if(pick)slots.push(pick);});
    if(!slots.length){rows.push({room:rm,lamps,slots:[],type:'—',why:'nincs ajtó / portálhely — RBX-kimenetről kapcsolt, vagy rakj kapcsolót kézzel'});return;}
    const type=slots.length===1?'101':slots.length===2?'106 + 106':'106 + '+(slots.length-2)+'× 107 + 106';
    rows.push({room:rm,lamps,slots,type,why:(wet?'vizes helyiség: az ajtó száraz oldalán':'az ajtó kilincsoldalán (L1)')+(slots.length>1?' · '+slots.length+' ajtó = több helyről':'')});});
  return rows;}
function lswSuggestApply(rows){let n=0;if(!rows.length)return 0;pushUndo(['devices']);
  rows.forEach(r=>{if(!r.slots.length)return;const ids=r.lamps.map(l=>l.id);
    if(ids.length>1&&!r.lamps.every(l=>l.grp&&l.grp===r.lamps[0].grp)){const g=lswNextGrp();r.lamps.forEach(l=>l.grp=g);}
    r.slots.forEach(s=>{lswLink(ids,{slot:s},true);n++;});});
  lswRetypeAll();draw();$('hud').textContent='Kapcsolások: '+n+' kapcsolóhely bekötve.';return n;}
function lswSuggestDialog(){const rows=lswSuggest();if(!rows.length){$('hud').textContent='Minden lámpának van kapcsolója.';return;}
  const name=rm=>esc(rm.name||rm.id);
  const body=`<div style="font-size:12px">A helyiség kapcsolatlan lámpái egy kapcsolt ágba kerülnek, a kapcsoló az ajtó portálhelyére (L1, 1100).</div>`
   +`<table style="font-size:12px;width:100%;margin-top:6px;border-collapse:collapse">`
   +`<tr style="color:#777"><td></td><td>Helyiség</td><td>Lámpa</td><td>Hely</td><td>Típus</td></tr>`
   +rows.map((r,i)=>`<tr><td><input type="checkbox" class="lswRow" data-i="${i}" ${r.slots.length?'checked':'disabled'}></td><td>${name(r.room)}</td><td>${r.lamps.length}</td>`
     +`<td>${r.slots.length?r.slots.map(s=>esc((byId('openings',s.door)||{}).id||s.door)).join(', '):'—'}</td><td>${esc(r.type)}</td></tr>`
     +`<tr><td></td><td colspan="4" style="color:#888;font-size:11px">Miért? ${esc(r.why)}</td></tr>`).join('')+`</table>`;
  openModal('Kapcsolások javaslata',body,()=>{const on=[...document.querySelectorAll('.lswRow')].filter(c=>c.checked).map(c=>rows[+c.dataset.i]);lswSuggestApply(on);},'Alkalmaz');}

// ---- the tool: click lamps into a set, then click an L1 slot / a switch / Alt + a wall ------------------------------------
function lswToolStart(){['mrkToolsOff','epToolOff','rwlToolOff','rbOff'].forEach(f=>{if(typeof window[f]==='function')try{window[f]();}catch(_){}});
  if(state.mode!=='select')setMode('select');if(typeof wfLayer==='function')wfLayer('sys:LIGHT');LSW.on=true;LSW.set=[];lswHint();draw();}
function lswHint(){const mh=$('modeHint');if(!mh)return;
  mh.textContent=LSW.on?('Kapcsolások — kattints lámpákra ('+LSW.set.length+' kijelölve) · C: összekötés egy ágba · utána kattints egy ajtó L1 helyére vagy egy kapcsolóra · Alt+kattintás a falon: saját kapcsolóhely · Esc: kész')
    :(HINTS[state.mode]||'');}
function lswToolOff(){LSW.on=false;LSW.set=[];lswHint();}
function lswL1At(p,level){let best=null,bd=Math.max(150,14/(state.zoom||1)/SC);
  (data.openings||[]).forEach(o=>{if(o.level!==level||o.type!=='door')return;ptSlots(o).forEach(s=>{if(s.k!=='L1')return;const d=Math.hypot(s.x-p[0],s.y-p[1]);if(d<bd){bd=d;best=s;}});});return best;}
STK_TOOLS.push({k:'lswTool',active:()=>{if(!LSW.on)return false;if(state.mode!=='select'||(typeof WV!=='undefined'&&WV)){lswToolOff();return false;}return true;},
  down(e){if(e.button!==0)return false;const lvl=state.active,[bx,by]=clientToBase(e),p=baseToPlan(bx,by,dz(lvl,0)),h=hitTest(e),d=h&&h.t==='devices'?data.devices[h.i]:null;
    if(d&&lswLamp(d)){const i=LSW.set.indexOf(d.id);if(i>=0)LSW.set.splice(i,1);else LSW.set.push(d.id);lswHint();draw();return true;}
    if(!LSW.set.length){$('hud').textContent='Előbb kattints egy vagy több lámpára.';return true;}
    let sw=null;
    if(d&&lswSw(d))sw=lswLink(LSW.set,{sw:d});
    else if(e.altKey){const pk=mrkPick(e);if(pk&&!pk.opening){const r=mrkWallById(lvl,pk.id),q=mrkFacePt(r,pk.side,pk.u,-wallInfo(r).thick/2);sw=lswLink(LSW.set,{wall:{level:lvl,x:q[0],y:q[1],side:pk.side>0?1:0}});}}
    else{const s=lswL1At(p,lvl);if(s)sw=lswLink(LSW.set,{slot:s});}
    if(sw){$('hud').textContent=(sw.ref||sw.id)+' · '+switchType(sw.swType).l+' — '+lswType(sw).why;LSW.set=[];lswHint();}
    else $('hud').textContent='Itt nincs kapcsolóhely — ajtó L1 helye, meglévő kapcsoló, vagy Alt + fal.';
    return true;},
  key(e){if((e.key==='c'||e.key==='C')&&!e.ctrlKey){if(LSW.set.length>1){const g=lswGroup(LSW.set);$('hud').textContent='Egy kapcsolt ág: '+g+' ('+LSW.set.length+' lámpa)';}else $('hud').textContent='Legalább két lámpát jelölj ki.';return true;}return false;},
  esc(){lswToolOff();draw();},mode(){lswToolOff();}});
STK_OVERLAY.push(()=>{const lvl=state.active,z=h=>dz(lvl,h||0);let s='';
  // legs: dotted lines between the lamps of a group
  const by={};data.devices.forEach(d=>{if(lswLamp(d)&&d.grp&&d.level===lvl)(by[d.grp]=by[d.grp]||[]).push(d);});
  Object.keys(by).forEach(g=>{const L=by[g];for(let i=1;i<L.length;i++){const a=planToBase(L[i-1].x,L[i-1].y,z(L[i-1].h)),b=planToBase(L[i].x,L[i].y,z(L[i].h));
    s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#ef7b72" stroke-width="${vsP(1.2)}" stroke-dasharray="${vsDash('1.5 3')}"/>`;}});
  if(LSW.on){
    LSW.set.forEach(id=>{const l=byId('devices',id);if(!l)return;const b=planToBase(l.x,l.y,z(l.h));s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(9)}" fill="none" stroke="#e8641c" stroke-width="${vsP(2)}"/>`;});
    (data.openings||[]).forEach(o=>{if(o.level!==lvl||o.type!=='door')return;ptSlots(o).forEach(t=>{if(t.k!=='L1')return;const b=planToBase(t.x,t.y,z(0));
      s+=`<circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="${vsP(5)}" fill="#fff" stroke="#d1493f" stroke-width="${vsP(1.6)}"/>`;});});
    // every switch → its lamps
    data.devices.forEach(w=>{if(!lswSw(w)||w.level!==lvl)return;const a=planToBase(w.x,w.y,z(w.h));(w.ctl||[]).forEach(id=>{const l=byId('devices',id);if(!l)return;const b=planToBase(l.x,l.y,z(l.h));
      s+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#d1493f" stroke-width="${vsP(0.9)}" stroke-dasharray="${vsDash('4 3')}"/>`;});});}
  return s?`<g pointer-events="none">${s}</g>`:'';});
// check: a lamp nobody switches (info)
(STK_CHECKS['sys:LIGHT']=STK_CHECKS['sys:LIGHT']||[]).push(()=>{const sw=new Set();data.devices.forEach(s=>{if(lswSw(s))(s.ctl||[]).forEach(id=>sw.add(id));});
  return data.devices.filter(d=>d&&epCodeOf(d)==='LMP'&&!sw.has(d.id)).map(d=>({sev:'info',code:'lsw.none',msg:(d.ref||d.id)+': a lámpának nincs kapcsolója.'}));});

// the bar's 4.2 step comes alive
(function(){if(typeof WF_PHASES==='undefined')return;const P=WF_PHASES.find(p=>p.k==='vill');if(!P)return;const i=P.tools.findIndex(t=>t.off==='E1');
  if(i>=0)P.tools.splice(i,1,{n:'4.2 Kapcsolások',run:()=>lswToolStart()},{n:'✨ Kapcsolások javaslata',run:()=>lswSuggestDialog()});})();
registerActions([{id:'wf.switches',label:'Kapcsolások',icon:'🔀',group:'Készülék',alias:'switches lamps kapcsolo osszekotes',
  hint:'Lámpák kapcsolóhoz: kattints lámpákra, majd egy ajtó L1 helyére; C = egy ágba kötés.',when:c=>!c.inEditor,run:()=>lswToolStart()},
  {id:'wf.switchSuggest',label:'Kapcsolások javaslata',icon:'✨',group:'Készülék',alias:'suggest switches javaslat',
   hint:'Helyiségenként: kapcsolatlan lámpák → az ajtó L1 helye (vizes helyiség: száraz oldal); táblázat jóváhagyásra.',when:()=>true,run:()=>lswSuggestDialog()}]);
