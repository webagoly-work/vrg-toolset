// ==========================================================================
// 08of-wf-tray.js — wireway rebuild (docs/workflow/WIREWAY_AUDIT_2026-10-18.md §4.6), WP-T4: the Elosztó tray
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// The user's model: "reaching the Elosztó prompts a circuit, from a pre-ticked checklist." Q4 = A: not a modal on every
// link (it would be clicked away blindly) but a NON-BLOCKING tray — "⚡ Elosztóra vár: N" — with batch assignment.
//   waiting  an endpoint with no circuit whose up chain reaches the board: straight, through a door's L4 (K1's derived
//            master) or through a master (szobadoboz / RBX / BASE on the board)
//   rows     the circuit suggestion of 08oa (E4, MATERIAL §6) cut to the waiting endpoints, each pre-ticked; a row's target
//            is the suggested NEW circuit, or any existing circuit (a socket added to a room that already has its circuit)
// Endpoints with no up are not "waiting" — they have not reached the board yet (the chain tool, T5, or the fill does it).
const TRAY={open:false,rows:null,level:null};

// does this node's chain reach the board? (a door counts: its L4 is fed by the trunk)
function trayReaches(d){if(!d||!d.up)return false;const ch=upChain(d.id);if(ch.loop)return false;const root=ch.ids[ch.ids.length-1];
  const r=byId('devices',root);if(r&&r.type==='board')return true;if(!r&&typeof upDoor==='function'&&upDoor(root))return true;
  // the last device's up names a door (upChain stops at a door id it cannot resolve as a device)
  const last=byId('devices',ch.ids[ch.ids.length-1]);return !!(last&&last.up&&upDoor(last.up.id));}
function trayWaiting(level){level=level||state.active;return elpUnassigned(level).filter(trayReaches);}
// the rows: 08oa's suggestion restricted to the waiting endpoints
function trayRows(level){level=level||state.active;const W=new Set(trayWaiting(level).map(d=>d.id));if(!W.size)return [];
  const B=data.devices.find(d=>d&&d.type==='board'&&d.level===level);
  return elpSuggest(B&&B.id).map(r=>Object.assign({},r,{members:r.members.filter(id=>W.has(id)),target:'new',on:true})).filter(r=>r.members.length);}
// apply: new circuits through elpApply (one undo with them), existing ones by cktAssign. → {made, joined}
function trayApply(rows){const on=(rows||[]).filter(r=>r.on!==false&&r.members.length);if(!on.length)return {made:0,joined:0};
  const fresh=on.filter(r=>r.target==='new'),old=on.filter(r=>r.target!=='new');let joined=0;
  // one undo step: elpApply snapshots the circuits first, the joins ride in the same step
  const res=fresh.length?elpApply(fresh):{made:0};
  if(old.length){if(!fresh.length)pushUndo(['circuits']);old.forEach(r=>{const c=cktList().find(c=>c.id===r.target||c.ref===r.target);if(!c)return;r.members.forEach(id=>{const d=byId('devices',id);if(d&&!cktOfDevice(d)){cktAssign(c,d);joined++;}});});}
  if(typeof cktRedraw==='function')cktRedraw();draw();return {made:res.made||0,joined};}

// ---- the tray: a small fixed panel, no modal ---------------------------------------------------------------------------
function trayHost(){let h=$('blTray');if(!h){h=document.createElement('div');h.id='blTray';document.body.appendChild(h);
  const st=document.createElement('style');st.textContent='#blTray{position:fixed;right:14px;bottom:44px;z-index:56;max-width:360px;background:#fffefb;border:1px solid #d8d3c8;border-radius:10px;'
   +'box-shadow:0 4px 18px #0002;font-size:12px;display:none}#blTray .hd{padding:6px 10px;cursor:pointer;font-weight:700;color:#7a4b00}#blTray .bd{padding:0 10px 8px;max-height:46vh;overflow:auto}'
   +'#blTray select{font-size:11px;max-width:150px}#blTray .row{margin-top:5px}#blTray .why{color:#888;font-size:11px}';document.head.appendChild(st);
  h.addEventListener('click',e=>{if(e.target.closest('.hd')){TRAY.open=!TRAY.open;TRAY.rows=null;trayDraw(true);return;}
    if(e.target.closest('[data-tray-apply]')){const R=TRAY.rows||[];h.querySelectorAll('[data-tray-on]').forEach(cb=>{R[+cb.dataset.trayOn].on=cb.checked;});
      h.querySelectorAll('[data-tray-to]').forEach(s=>{R[+s.dataset.trayTo].target=s.value;});const r=trayApply(R);TRAY.rows=null;
      $('hud').textContent='Elosztó: '+r.made+' új kör, '+r.joined+' végpont meglévő körbe';trayDraw(true);}});}
  return h;}
let TRAY_SIG='';
function trayDraw(force){const h=trayHost(),lv=state.active,W=trayWaiting(lv),show=W.length&&(state.wfPhase==='vill'||UP.view||UP.tool||TRAY.open);
  const sig=lv+'|'+W.map(d=>d.id).join(',')+'|'+TRAY.open+'|'+show;if(!force&&sig===TRAY_SIG)return;TRAY_SIG=sig;
  if(!show){h.style.display='none';return;}h.style.display='block';
  let s=`<div class="hd" title="Kattints: a körök hozzárendelése">⚡ Elosztóra vár: ${W.length} ${TRAY.open?'▾':'▸'}</div>`;
  if(TRAY.open){if(!TRAY.rows||TRAY.level!==lv){TRAY.rows=trayRows(lv);TRAY.level=lv;}const C=cktList();
    s+='<div class="bd">'+TRAY.rows.map((r,i)=>`<div class="row"><label><input type="checkbox" data-tray-on="${i}"${r.on!==false?' checked':''}> <b>${r.members.length}</b> végpont → </label>`
      +`<select data-tray-to="${i}"><option value="new">új: ${esc(r.name)}</option>${C.map(c=>`<option value="${esc(c.id)}">${esc((c.ref||'')+' '+(c.name||''))}</option>`).join('')}</select>`
      +`<div class="why">${esc(r.why||'')}</div></div>`).join('')+`<div class="row"><button data-tray-apply>Hozzárendel</button></div></div>`;}
  h.innerHTML=s;}
// refreshed with the drawing (cheap: the waiting set is a filter over the devices)
STK_OVERLAY.push(()=>{try{trayDraw(false);}catch(_){}return '';});
registerActions([{id:'tray.open',label:'Elosztóra vár',icon:'⚡',group:'Pálya',alias:'tray eloszto var circuit assign korok hozzarendeles',
  hint:'A betáp-fán az Elosztóig érő, körrel még nem rendelkező végpontok — körbe rendelés egy lépésben (javaslat a körlistából).',when:c=>!c.inEditor,
  run:()=>{TRAY.open=true;TRAY.rows=null;trayDraw(true);}}]);
window.trayWaiting=trayWaiting;window.trayRows=trayRows;window.trayApply=trayApply;window.TRAY=TRAY;window.trayDraw=trayDraw;
