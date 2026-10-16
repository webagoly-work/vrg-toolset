// ==========================================================================
// 05dd-chrome.js — UI tidy T5 (split View) + T7 (header diet): the header menus, the quick-view widget, Megjelenés
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope.
// ==========================================================================

// docs/ui-tidy/UI-AUDIT.md §5. The header has five items: Projekt ▾ · ↩ ↪ · Kimenet ▾ · ⌘K · Bevitel ▾ (was 14
// buttons). The menus hold the existing buttons, by their old ids, so every binding stays where it was. The stage corner
// has the quick-view widget (rotation, projection, style, 2D/3D, reset, full view, ⚙); the rest of the View panel and
// Floor labels are the floating ⚙ Megjelenés panel (05db PANEL_HOME 'el:mgjBody'); the two behaviour toggles are in
// Beállítások (05e). `$` (08-interaction) is not defined yet at load: document.getElementById here. Prefix: chr.

function chrMenuClose(except){document.querySelectorAll('header .hm.open').forEach(m=>{if(m!==except)m.classList.remove('open');});}
function chrMgj(on){const p=document.getElementById('mgj');if(!p)return false;const v=on==null?!p.classList.contains('on'):!!on;
  p.classList.toggle('on',v);const b=document.getElementById('qvMgj');if(b)b.classList.toggle('on',v);return v;}
(function chrBind(){const hdr=document.querySelector('header');if(!hdr)return;
  hdr.querySelectorAll('.hm > .hmB').forEach(b=>{b.onclick=e=>{e.stopPropagation();const m=b.parentNode,open=!m.classList.contains('open');chrMenuClose(m);m.classList.toggle('open',open);};});
  // a menu item closes its menu (not the project panel's inputs / list, which stay usable)
  hdr.querySelectorAll('.hmD').forEach(d=>{d.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.a&&typeof runAction==='function')runAction(b.dataset.a);
    if(d.id!=='projBody'||b.closest('.row'))setTimeout(()=>chrMenuClose(),0);});});
  document.addEventListener('mousedown',e=>{if(!e.target.closest||!e.target.closest('header .hm'))chrMenuClose();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')chrMenuClose();});
  const k=document.getElementById('bCmdK');if(k)k.onclick=()=>{if(typeof paletteOpen==='function')paletteOpen();};
  const g=document.getElementById('qvMgj');if(g)g.onclick=()=>chrMgj();
  const x=document.getElementById('mgjX');if(x)x.onclick=()=>chrMgj(false);})();

registerActions([{id:'view.appearance',label:'Megjelenés',icon:'🎛',group:'Nézet',alias:'appearance view style render walls grid megjelenes nezet stilus',
  hint:'Stílus, falak, rács, léptékek, padlófeliratok — a nézet minden beállítása egy lebegő panelen.',run:()=>chrMgj()}]);
window.chrMgj=chrMgj;window.chrMenuClose=chrMenuClose;
