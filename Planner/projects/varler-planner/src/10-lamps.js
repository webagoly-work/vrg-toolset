// ==========================================================================
// 09-lamps.js — lamp data sheet, generated objects, hover preview
//
// Part of the Varler Planner source. These files are CONCATENATED IN ORDER
// by build.js into a single <script>, so they share one scope: a function
// defined here is visible everywhere. Do not reorder them without checking
// tests/golden.js — const/let are subject to temporal dead zones.
// ==========================================================================
//////////////////// LÁMPA adatlap: méret, beépítés, bolti link, thumbnail, generált objektum ////////////////////
const LAMP_MOUNT={
  mennyezeti:{n:'Mennyezeti (falon kívüli)', drop:0,   note:'közvetlenül a mennyezetre'},
  fuggesztett:{n:'Függesztett',              drop:600, note:'a felfüggesztés hossza a lámpatest tetejéig'},
  sullyesztett:{n:'Süllyesztett (spot)',     drop:0,   note:'a mennyezet síkjába épül — furatméret = átmérő'},
  falikar:{n:'Falikar',                      drop:0,   note:'falra szerelt, a magasság a fal síkjától'},
  sines:{n:'Sínes / szpotsor',               drop:0,   note:'sínre fűzött lámpatest'},
  butor:{n:'Bútorvilágítás',                 drop:0,   note:'pult alatti / szekrénybe épített'},
  tukorlampa:{n:'Tükörvilágítás',            drop:0,   note:'tükör fölé/mellé, IP44'}};
const LAMP_FIX={csavaros:'Csavaros (dűbel + csavar)',gipszkarton:'Gipszkarton-rugós',
  sin:'Sínbe pattintva',ragasztott:'Ragasztott / mágneses',kotodoboz:'Kötődoboz-fülre',lanc:'Láncos / sodronyos'};
function lampDef(d){return {w:d.lampW||300,dp:d.lampD||300,ht:d.lampHt||120,shape:d.lampShape||'round',
  mount:(LAMP_MOUNT[d.mount]?d.mount:'mennyezeti'),drop:(d.drop!=null?d.drop:LAMP_MOUNT[LAMP_MOUNT[d.mount]?d.mount:'mennyezeti'].drop),
  fix:d.lampFix||'csavaros',url:d.url||'',thumb:d.thumb||'',hover:d.hover!==false,name:d.lampName||''};}
// the fixture body hangs below the mounting height by the suspension length
function lampBodyZ(d){const L=lampDef(d);return Math.max(0,(d.h||0)-L.drop-L.ht);}
// ---- generated Object: a real 3D box that follows the lamp's parameters ----
function lampObjIndex(di){const dv=data.devices[di];if(!dv||!dv.genId)return -1;
  return data.objects.findIndex(o=>o.genId===dv.genId);}
function lampGenObject(di){const dv=data.devices[di];if(!dv)return null;const L=lampDef(dv);
  if(!dv.genId)dv.genId='lamp'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const rec={level:dv.level,x:dv.x,y:dv.y,z:lampBodyZ(dv),w:L.w,d:L.dp,ht:L.ht,ang:dv.ang||0,
    name:(L.name||dv.ref||'Lámpa'),color:'#f2e6b8',layer:dv.layer,genId:dv.genId,genFor:'lamp',
    url:L.url||undefined,thumb:L.thumb||undefined};
  const ix=lampObjIndex(di);
  if(ix>=0)data.objects[ix]=Object.assign(data.objects[ix],rec);else data.objects.push(rec);
  return dv.genId;}
function lampDropObject(di){const ix=lampObjIndex(di);if(ix>=0)data.objects.splice(ix,1);
  if(data.devices[di])delete data.devices[di].genId;}
function isGenObject(o){return !!(o&&o.genFor);}
function genObjectsVisible(){return state.showGenObjects!==false;}
// ---- the dialog ----
// lamp / height items — shared by BOTH plan device menus (the device-hit one and the hitTest one)
function deviceExtraItems(di,items){const D=data.devices[di];if(!D)return items;
  if(D.type==='light'){
    items.push({label:'💡 Lámpa adatlap… (méret, beépítés, link, kép, objektum)',act:()=>lampDialog(di)});
    items.push({label:(lampObjIndex(di)>=0?'🧊 Objektum frissítése a paraméterekből':'🧊 Objektum generálása a paraméterekből'),
      act:()=>{pushUndo();lampGenObject(di);draw();$('hud').textContent='Lámpatest objektum generálva.';}});
    if(lampObjIndex(di)>=0)items.push({label:'🧊✕ Generált objektum törlése',act:()=>{pushUndo();lampDropObject(di);draw();}});
    items.push({label:(genObjectsVisible()?'👁 Generált objektumok elrejtése':'👁 Generált objektumok mutatása'),
      act:()=>{state.showGenObjects=!genObjectsVisible();draw();}});
    if(D.url)items.push({label:'↗ Bolti link megnyitása',act:()=>{try{window.open(/^https?:/.test(D.url)?D.url:('https://'+D.url),'_blank');}catch(_){}}});
    if(D.thumb)items.push({label:(D.hover===false?'🖼 Kép felugrás be':'🖼 Kép felugrás ki'),
      act:()=>{pushUndo();D.hover=(D.hover===false);draw();}});}
  items.push({label:`⇕ Magasság… (${Math.round(D.h||0)} mm)`,act:()=>openModal('Szerelési magasság',
    `<div class="mrow"><input id="dzz" type="number" step="10" value="${Math.round(D.h||0)}" style="width:90px"> mm</div>`,
    ()=>{pushUndo();D.h=Math.max(0,+$('dzz').value||0);if(D.type==='light'&&lampObjIndex(di)>=0)lampGenObject(di);draw();})});
  return items;}
function lampDialog(di){const dv=data.devices[di];if(!dv)return;const L=lampDef(dv);
  const mo=Object.keys(LAMP_MOUNT).map(k=>`<option value="${k}" ${k===L.mount?'selected':''}>${esc(LAMP_MOUNT[k].n)}</option>`).join('');
  const fx=Object.keys(LAMP_FIX).map(k=>`<option value="${k}" ${k===L.fix?'selected':''}>${esc(LAMP_FIX[k])}</option>`).join('');
  const hasObj=lampObjIndex(di)>=0;
  openModal('Lámpa adatlap',
     `<div class="mrow"><label style="width:104px">Megnevezés</label><input id="lpName" value="${esc(L.name)}" placeholder="pl. Nappali mennyezeti" style="flex:1"></div>`
    +`<div class="mrow"><label style="width:104px">Alak / méret</label><select id="lpShape" style="width:104px"><option value="round" ${L.shape==='round'?'selected':''}>kör</option><option value="rect" ${L.shape==='rect'?'selected':''}>szögletes</option></select>`
    +`<input id="lpW" type="number" step="10" min="10" value="${Math.round(L.w)}" style="width:70px"> × <input id="lpD" type="number" step="10" min="10" value="${Math.round(L.dp)}" style="width:70px">`
    +` × mag. <input id="lpHt" type="number" step="10" min="10" value="${Math.round(L.ht)}" style="width:64px"> mm</div>`
    +`<div class="mrow"><label style="width:104px">Beépítés</label><select id="lpMount" style="width:210px">${mo}</select>`
    +`<label style="margin-left:8px">függesztés <input id="lpDrop" type="number" step="10" min="0" value="${Math.round(L.drop)}" style="width:64px"> mm</label></div>`
    +`<div class="mrow"><label style="width:104px">Rögzítés</label><select id="lpFix" style="width:210px">${fx}</select>`
    +`<span id="lpMountNote" style="color:#999;font-size:11px;margin-left:8px"></span></div>`
    +`<div class="mrow"><label style="width:104px">Bolti link</label><input id="lpUrl" value="${esc(L.url)}" placeholder="https://…" style="flex:1">`
    +`<button id="lpOpen" style="margin-left:6px;font-size:11px">↗ Megnyit</button></div>`
    +`<div class="mrow"><label style="width:104px">Kép</label><input id="lpFile" type="file" accept="image/*" style="flex:1">`
    +`<button id="lpClr" style="margin-left:6px;font-size:11px">✕ Kép törlése</button></div>`
    +`<div class="mrow"><label style="width:104px"></label><label><input type="checkbox" id="lpHover" ${L.hover?'checked':''}> Kép felugrik, ha fölé viszem a kurzort</label>`
    +`<span id="lpThumbWrap" style="margin-left:10px">${L.thumb?`<img id="lpThumb" src="${L.thumb}" style="height:44px;border:1px solid #ddd;border-radius:4px;vertical-align:middle">`:'<span style="color:#bbb;font-size:11px">nincs kép</span>'}</span></div>`
    +`<div class="mrow" style="border-top:1px solid #eee;padding-top:5px"><label style="width:104px">3D objektum</label>`
    +`<label><input type="checkbox" id="lpGen" ${hasObj?'checked':''}> Objektum generálása a fenti méretekből</label>`
    +`<label style="margin-left:12px"><input type="checkbox" id="lpShow" ${genObjectsVisible()?'checked':''}> Generált objektumok látszanak</label></div>`
    +`<div class="mrow" id="lpInfo" style="font-size:11px;color:#777"></div>`,
    ()=>{pushUndo();
      const st=(k,v)=>{if(v||v===0)dv[k]=v;else delete dv[k];};
      dv.lampName=$('lpName').value.trim()||undefined;
      dv.lampShape=$('lpShape').value;dv.lampW=+$('lpW').value||300;dv.lampD=+$('lpD').value||300;dv.lampHt=+$('lpHt').value||120;
      dv.mount=$('lpMount').value;dv.drop=Math.max(0,+$('lpDrop').value||0);dv.lampFix=$('lpFix').value;
      st('url',$('lpUrl').value.trim());
      dv.hover=$('lpHover').checked;
      state.showGenObjects=$('lpShow').checked;
      if($('lpGen').checked)lampGenObject(di);else lampDropObject(di);
      draw();},'Mentés');
  const info=()=>{const mk=$('lpMount').value,M=LAMP_MOUNT[mk]||LAMP_MOUNT.mennyezeti;
    const drop=+$('lpDrop').value||0,ht=+$('lpHt').value||0;
    $('lpMountNote').textContent=M.note;
    const top=(dv.h||0),bot=Math.max(0,top-drop-ht);
    $('lpInfo').innerHTML=`Szerelési pont <b>${Math.round(top)} mm</b> · a lámpatest alja <b>${Math.round(bot)} mm</b> a padlótól`
      +(bot<1900&&bot>0?' · <b style="color:#c0530f">fejmagasság alatt</b>':'')
      +` · furat/hely igény <b>${Math.round(+$('lpW').value||0)}×${Math.round(+$('lpD').value||0)} mm</b>`;};
  ['lpMount','lpDrop','lpHt','lpW','lpD'].forEach(id=>{$(id).oninput=info;$(id).onchange=info;});
  $('lpMount').onchange=()=>{const M=LAMP_MOUNT[$('lpMount').value];if(M&&M.drop)$('lpDrop').value=M.drop;info();};
  $('lpOpen').onclick=()=>{const u=$('lpUrl').value.trim();if(!u){alert('Nincs megadva link.');return;}
    try{window.open(/^https?:/.test(u)?u:('https://'+u),'_blank');}catch(_){}};
  $('lpClr').onclick=()=>{delete dv.thumb;$('lpThumbWrap').innerHTML='<span style="color:#bbb;font-size:11px">nincs kép</span>';};
  $('lpFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{lampShrinkImage(rd.result,320,out=>{dv.thumb=out;
      $('lpThumbWrap').innerHTML=`<img src="${out}" style="height:44px;border:1px solid #ddd;border-radius:4px;vertical-align:middle">`;});};
    rd.readAsDataURL(f);};
  info();}
// keep stored images small — the whole project lives in localStorage
function lampShrinkImage(dataUrl,maxPx,cb){try{
    const img=new Image();
    img.onload=()=>{try{
      const k=Math.min(1,maxPx/Math.max(img.width||maxPx,img.height||maxPx));
      const c=document.createElement('canvas');c.width=Math.max(1,Math.round((img.width||maxPx)*k));c.height=Math.max(1,Math.round((img.height||maxPx)*k));
      const ctx=c.getContext('2d');if(!ctx){cb(dataUrl);return;}
      ctx.drawImage(img,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',0.82));
    }catch(_){cb(dataUrl);}};
    img.onerror=()=>cb(dataUrl);img.src=dataUrl;
  }catch(_){cb(dataUrl);}}
// ---- hover preview ----
function lampHoverShow(dv,cx,cy){const L=lampDef(dv);if(!L.thumb||!L.hover)return lampHoverHide();
  let el=$('thumbPop');
  if(!el){el=document.createElement('div');el.id='thumbPop';
    el.style.cssText='position:fixed;z-index:9999;pointer-events:none;background:#fff;border:1px solid #cfc9bd;border-radius:6px;padding:4px;box-shadow:0 6px 18px rgba(0,0,0,.18);max-width:240px';
    document.body.appendChild(el);}
  el.innerHTML=`<img src="${L.thumb}" style="display:block;max-width:230px;max-height:180px;border-radius:3px">`
    +`<div style="font-size:11px;color:#555;padding:3px 2px 1px">${esc(L.name||dv.ref||'Lámpa')}${L.url?' · ↗ bolti link':''}</div>`;
  el.style.left=Math.round(cx+16)+'px';el.style.top=Math.round(cy+16)+'px';el.style.display='block';}
function lampHoverHide(){const el=$('thumbPop');if(el)el.style.display='none';}
// base coords → client pixels (the inverse of clientToBase, minus the fine-mode damping)
function baseToClientPt(bx,by){try{const m=stage.getScreenCTM();if(!m)return null;
  const pt=stage.createSVGPoint();pt.x=bx*state.zoom+state.panX;pt.y=by*state.zoom+state.panY;
  const q=pt.matrixTransform(m);return [q.x,q.y];}catch(_){return null;}}
function lampAt(cx,cy){                                  // topmost lamp under the pointer, in plan pixels
  let best=null,bd=1e9;
  data.devices.forEach((d,i)=>{if(d.type!=='light'||!d.thumb||d.hover===false)return;
    if(d.level!==state.active||!state.levels[d.level])return;
    const b=planToBase(d.x,d.y,dz(d.level,d.h||0));
    const p=baseToClientPt(b[0],b[1]);if(!p)return;const dd=Math.hypot(p[0]-cx,p[1]-cy);
    if(dd<26&&dd<bd){bd=dd;best=i;}});
  return best;}

function editOpening(i){const o=data.openings[i],win=o.type==='window';
  const ww=o.w||(win?WIN_W:DOOR_W),wh=o.h||(win?WIN_H:DOOR_H),sill=(o.sill!=null?o.sill:(win?WIN_SILL:0));
  openModal((win?'Ablak':'Ajtó')+' méretek (mm)',
   `<div class="mrow">Szélesség <input id="oW" type="number" value="${ww}" style="width:80px"></div>`+
   `<div class="mrow">Magasság <input id="oH" type="number" value="${wh}" style="width:80px"></div>`+
   (win?`<div class="mrow">Parapet (sill) <input id="oS" type="number" value="${sill}" style="width:80px"></div>`:''),
   ()=>{pushUndo();o.w=+$('oW').value||ww;o.h=+$('oH').value||wh;if(win)o.sill=+$('oS').value||0;draw();});}
function setDeviceReq(i){const D=data.devices[i];openModal('Szükséges erek – '+(DEV[D.type]||''),circuitForm(D.req),()=>{pushUndo();D.req=readCircuit();draw();});}
// ---- switch type + terminal→device routing ----
let switchPick=null; // {di, term} while picking a target device for a switch terminal
// ---- circuit gating: junction boxes accept certain circuit sorszám; paths can restrict too ----
function parseNums(str){return (str||'').split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean);}
function boxAccepts(box,num){ // does this junction connect a circuit of sorszám `num`?
  if(!box.accept||!box.accept.length)return true; // empty = accept all (default = a normal box)
  return box.accept.map(String).includes(String(num));}
function pathAllows(sec,num){ // does this path section allow a circuit sorszám to be tapped here?
  if(!sec||!sec.allow||!sec.allow.length)return true;
  return sec.allow.map(String).includes(String(num));}
function editBoxAccept(i){const D=data.devices[i];
  const body=`<div class="mrow">Elfogadott áramkör sorszámok<br><input id="bAcc" value="${(D.accept||[]).join(', ')}" placeholder="pl. 3, 5, 7 — üres = mind" style="width:100%"></div>`
    +`<div style="font-size:11px;color:#777">Ha üres, a doboz minden rajta áthaladó áramkört összeköt (normál kötődoboz). Ha meg van adva, csak a felsorolt sorszámú áramköröket köti be — a többi áramkör a pályán MEGSZAKÍTÁS NÉLKÜL halad tovább. A lista módosítása a dobozon áthaladó összes pályát újraköti.</div>`;
  openModal('Kötődoboz – elfogadott áramkörök',body,()=>{pushUndo();D.accept=parseNums($('bAcc').value);regateAll();draw();
    $('hud').textContent=D.accept.length?('Doboz elfogadja: '+D.accept.join(', ')):'Doboz: minden áramkör (normál).';},'Mentés');}
function editPathAllow(pi,si){const pa=data.paths[pi],sec=pa.sections[si]=pa.sections[si]||{build:'sull_gege'};
  const body=`<div class="mrow">Átengedett áramkör sorszámok<br><input id="pAcc" value="${(sec.allow||[]).join(', ')}" placeholder="pl. 3, 5 — üres = mind" style="width:100%"></div>`
    +`<div style="font-size:11px;color:#777">Két kötődoboz közti szakaszon csak a felsorolt sorszámú áramkörök engedélyezettek. Üres = minden áramkör átmehet.</div>`;
  openModal('Pálya szakasz – átengedett áramkörök',body,()=>{pushUndo();sec.allow=parseNums($('pAcc').value);regateAll();draw();},'Mentés');}
// re-evaluate every routed circuit against box-accept + path-allow gates (called after a gate changes)
function regateAll(){data.paths.forEach(pa=>{(pa.sections||[]).forEach((sec,si)=>{if(!sec)return;
    // mark each carried circuit as gated-through (passing) vs tapped, based on the boxes at this path's ends
    const carried=(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]);
    carried.forEach(c=>{if(!c)return;const num=c.num;
      // find junction boxes near this section's nodes
      const a=pa.nodes[si],b=pa.nodes[si+1];if(!a||!b)return;
      const boxesHere=data.devices.filter(dv=>dv.type==='junction'&&dv.level===a.level&&
        (Math.hypot(dv.x-a.x,dv.y-a.y)<400||Math.hypot(dv.x-b.x,dv.y-b.y)<400));
      // a circuit is "tapped" if any adjacent box accepts it AND the path allows it; else it passes through
      const tapped=boxesHere.some(box=>boxAccepts(box,num))&&pathAllows(sec,num);
      c.passing=!tapped; // passing = runs through uninterrupted (rendered lighter)
    });});});}
function deviceLabel(dv){return (dv.ref||DEV[dv.type]||'')+(dv.type==='light'?' (lámpa)':dv.type==='socket'?' (aljzat)':'');}
function editSwitchType(i){const D=data.devices[i];D.swType=D.swType||'101';D.swMap=D.swMap||{};
  const rowsHtml=()=>{const t=switchType(D.swType);
    return t.terms.map(tm=>{
      const tgd=devByRef(D.swMap[tm.id]);const tdev=tgd?deviceLabel(tgd):null;
      const kindTag=tm.kind==='in'?'<span style="color:#b06">be</span>':'<span style="color:#068">ki</span>';
      return `<div class="mrow" style="gap:6px;align-items:center;border-top:1px solid #eee;padding-top:4px">`
        +`<b style="width:34px">${tm.id}</b> <span style="flex:1;font-size:11.5px">${kindTag} ${tm.l}</span>`
        +(tm.kind==='out'?`<span style="font-size:11px;color:${tdev?'#0a5c33':'#999'};min-width:110px">${tdev?'→ '+esc(tdev):'— nincs cél —'}</span>`
            +`<button class="swPick" data-term="${tm.id}" style="font-size:11px">${tdev?'módosít':'Készülék…'}</button>`
            +(tdev?` <button class="swClr" data-term="${tm.id}" style="font-size:11px" title="törlés">✕</button>`:''):'')
        +`</div>`;}).join('');};
  const body=`<div class="mrow">Típus <select id="swType" style="width:100%">${SWITCH_TYPES.map(x=>`<option value="${x.k}" ${x.k===D.swType?'selected':''}>${x.l}</option>`).join('')}</select></div>`
    +`<div style="font-size:11px;color:#777;margin:4px 0">A kimeneti (ki) pontokhoz rendelj készüléket (lámpát), hogy látszódjon mit kapcsol. A bemenetek (be) a betáplálást jelölik.</div>`
    +`<div id="swRows">${rowsHtml()}</div>`;
  openModal('Kapcsoló típus – '+(D.ref||''),body,()=>{pushUndo();draw();},'Kész');
  const wire=()=>{const ts=$('swType');if(ts)ts.onchange=e=>{D.swType=e.target.value;D.swMap={};$('swRows').innerHTML=rowsHtml();wire();};
    document.querySelectorAll('#swRows .swPick').forEach(btn=>btn.onclick=()=>{switchPick={di:i,term:btn.dataset.term};
      $('modeHint').textContent='Kattints a cél készülékre (pl. lámpa) — Select mód.';closeModal();setMode('select');draw();});
    document.querySelectorAll('#swRows .swClr').forEach(btn=>btn.onclick=()=>{delete D.swMap[btn.dataset.term];$('swRows').innerHTML=rowsHtml();wire();draw();});};
  setTimeout(wire,30);}
// ---- manual per-device wiring (name + colour per wire) ----
const WIRE_HEX={fekete:'#222',kék:'#2f6fb0',zöld:'#1f9d55',barna:'#8a5a2b',szürke:'#9a9a9a','kék-fehér':'#7fb0d8',piros:'#d84a3b',sárgazöld:'#c9d100',fehér:'#eee'};
const WIRE_COLOR_LIST=['fekete','kék','barna','szürke','zöld','sárgazöld','piros','fehér','kék-fehér'];
function wireRowHtml(wr,i){return `<div class="mrow wireRow" data-i="${i}" style="gap:5px;align-items:center">`
  +`<span style="display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid #888;background:${WIRE_HEX[wr.color]||'#222'}"></span>`
  +`<input class="wName" value="${esc(wr.name||'')}" placeholder="pl. fázis / N / kapcsolt" style="width:150px">`
  +`<select class="wColor" style="width:110px">${WIRE_COLOR_LIST.map(c=>`<option ${c===wr.color?'selected':''}>${c}</option>`).join('')}</select>`
  +`<button class="wDel" title="ér törlése">✕</button></div>`;}
function editDeviceWires(i){const D=data.devices[i];D.wires=D.wires||[];
  const body=`<div style="font-size:11.5px;color:#666;margin-bottom:6px">Kézi vezetékek a(z) <b>${esc(D.ref||DEV[D.type]||'')}</b> készülékhez — add meg minden ér nevét és színét (pl. kapcsolók és lámpák bekötéséhez).</div>`
    +`<div id="wireList"></div>`
    +`<div class="mrow"><button id="wAdd" style="font-size:12px">＋ Ér hozzáadása</button></div>`;
  openModal('Vezetékek – '+(D.ref||DEV[D.type]||''),body,()=>{pushUndo();
    D.wires=(D.__tmp||[]).map(wr=>({name:wr.name,color:wr.color}));delete D.__tmp;draw();},'Mentés');
  const refresh=()=>{const list=$('wireList');list.innerHTML=D.__tmp.map(wireRowHtml).join('');
    list.querySelectorAll('.wireRow').forEach(row=>{const idx=+row.dataset.i;
      row.querySelector('.wName').oninput=e=>D.__tmp[idx].name=e.target.value;
      row.querySelector('.wColor').onchange=e=>{D.__tmp[idx].color=e.target.value;refresh();};
      row.querySelector('.wDel').onclick=()=>{D.__tmp.splice(idx,1);refresh();};});};
  D.__tmp=D.wires.length?JSON.parse(JSON.stringify(D.wires)):[{name:'fázis',color:'fekete'},{name:'N',color:'kék'},{name:'PE',color:'sárgazöld'}];
  setTimeout(()=>{refresh();$('wAdd').onclick=()=>{D.__tmp.push({name:'',color:'fekete'});refresh();};},30);}
// ---- routing engine v1: graph of path vertices, boxes anchor in, Dijkstra to board ----
function sectionLen(pa,si){const a=pa.nodes[si],b=pa.nodes[si+1];return (Math.hypot(b.x-a.x,b.y-a.y)+Math.abs(wz(b.level,b.h||0)-wz(a.level,a.h||0)))/1000;}
function buildGraph(){const nodes=[],idOf=new Map();
  data.paths.forEach((pa,pi)=>pa.nodes.forEach((v,vi)=>{idOf.set(pi+'_'+vi,nodes.length);nodes.push({x:v.x,y:v.y,level:v.level});}));
  const par=nodes.map((_,i)=>i);const find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a];}return a;};const uni=(a,b)=>{par[find(a)]=find(b);};
  const TOL=250;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){if(nodes[i].level===nodes[j].level&&Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)<TOL)uni(i,j);}
  const adj={};const addE=(u,v,len,pi,si)=>{const ru=find(u),rv=find(v);if(ru===rv)return;(adj[ru]=adj[ru]||[]).push({to:rv,len,pi,si});(adj[rv]=adj[rv]||[]).push({to:ru,len,pi,si});};
  data.paths.forEach((pa,pi)=>{for(let si=0;si<pa.nodes.length-1;si++)addE(idOf.get(pi+'_'+si),idOf.get(pi+'_'+(si+1)),sectionLen(pa,si)*1000,pi,si);});
  return {nodes,find,adj};}
function anchorNode(g,x,y){let bi=-1,bd=1e18;g.nodes.forEach((n,i)=>{const d=Math.hypot(n.x-x,n.y-y);if(d<bd){bd=d;bi=i;}});return bi<0?-1:g.find(bi);}
// a board connects along its WHOLE rectangle: return the graph-component of any node inside it (or the nearest node
// to the rectangle if none inside). This makes a path reaching the board's underside connect from either wall side,
// regardless of where the board itself sits within that rectangle.
function boardAnchor(g,b){let inside=-1,bd=1e18,near=-1,nd=1e18;
  g.nodes.forEach((n,i)=>{if(n.level!==b.level)return;
    if(pointInBoard(b,n.x,n.y,120)){const dd=Math.hypot(n.x-b.x,n.y-b.y);if(dd<bd){bd=dd;inside=i;}}
    else{const cx=Math.max(-1,Math.min(1,0));const dd=distPointToRect(b,n.x,n.y);if(dd<nd){nd=dd;near=i;}}});
  const pick=inside>=0?inside:(nd<400?near:-1);return pick<0?-1:g.find(pick);}
function distPointToRect(b,x,y){const w=(b.rw||BOARD_RW)/2,d=(b.rd||BOARD_RD)/2,a=b.ang||0,ca=Math.cos(-a),sa=Math.sin(-a);
  const lx=(x-b.x)*ca-(y-b.y)*sa, ly=(x-b.x)*sa+(y-b.y)*ca;
  const dx=Math.max(Math.abs(lx)-w,0),dy=Math.max(Math.abs(ly)-d,0);return Math.hypot(dx,dy);}
function dijkstra(g,src){const dist={},prev={},pq=[[0,src]];dist[src]=0;
  while(pq.length){pq.sort((a,b)=>a[0]-b[0]);const [du,u]=pq.shift();if(du>(dist[u]??Infinity))continue;
    for(const e of (g.adj[u]||[])){const nd=du+e.len;if(nd<(dist[e.to]??Infinity)){dist[e.to]=nd;prev[e.to]={u,e};pq.push([nd,e.to]);}}}
  return {dist,prev};}
function nearestBoard(x,y){const bs=data.devices.filter(d=>d.type==='board');if(!bs.length)return null;
  return bs.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];}
function boxNodeSet(g){const set=new Set();data.devices.forEach(dv=>{if(dv.type==='junction'){const a=anchorNode(g,dv.x,dv.y);if(a>=0)set.add(a);}else if(dv.type==='board'){const a=boardAnchor(g,dv);if(a>=0)set.add(a);}});return set;}
function routeDevice(i,mode,targetDev,silent){const D=data.devices[i];if(!D.req){if(!silent)alert('Előbb állítsd be a Szükséges ereket.');return;}
  const g=buildGraph();if(!g.nodes.length){if(!silent)alert('Nincs pálya. Húzz Path-t.');return;}
  const dst=anchorNode(g,D.x,D.y);if(dst<0){if(!silent)alert('A készülék nincs pálya közelében.');return;}
  let src;
  if(mode==='pick'&&targetDev){src=anchorNode(g,targetDev.x,targetDev.y);}
  else{const bd=nearestBoard(D.x,D.y);if(!bd){if(!silent)alert('Nincs elosztószekrény — jobb klikk a falon → Elosztószekrény ide.');return;}src=boardAnchor(g,bd);}
  if(src<0){if(!silent)alert('A cél nincs pálya közelében.');return;}
  const {prev}=dijkstra(g,src);
  if(dst!==src&&!prev[dst]){if(!silent)alert('Nincs összefüggő pálya-útvonal. Kösd össze a pályákat (közös pont / kötődoboz).');return;}
  const boxes=(mode==='next')?boxNodeSet(g):null;
  if(!silent)pushUndo();let cur=dst,guard=0,hops=0;const devId=devIdOf(i);
  while(cur!==src&&prev[cur]&&guard++<9999){const e=prev[cur].e,pa=data.paths[e.pi];
    if(!pa.sections[e.si])pa.sections[e.si]={build:'sull_gege',circuit:null};
    (pa.sections[e.si].circuits=pa.sections[e.si].circuits||[]).push(Object.assign({},D.req,{dev:devId}));hops++;
    cur=prev[cur].u;if(mode==='next'&&boxes.has(cur)&&cur!==dst)break;}
  if(!silent){draw();$('hud').textContent=`Behúzva: ${hops} szakasz${mode==='next'?' (köv. dobozig)':mode==='pick'?' (célig)':' (szekrényig)'}.`;}}
function runDevice(i){routeDevice(i,'board');}
function clearRouting(silent){if(!silent)pushUndo();data.paths.forEach(pa=>pa.sections.forEach(sec=>{if(sec&&sec.circuits)delete sec.circuits;}));if(!silent)draw();}
function recomputeRouting(){pushUndo();clearRouting(true);data.devices.forEach((D,i)=>{if(D.req)routeDevice(i,'board',null,true);});draw();$('hud').textContent='Útvonalak újraszámolva.';}
function sendToLayer(item){openModal('Rétegbe helyez',`<div class="mrow"><select id="slSel" style="width:100%">`+layers.map(L=>`<option value="${L.id}" ${item.layer===L.id?'selected':''}>${L.name}</option>`).join('')+`</select></div>`,()=>{pushUndo();item.layer=$('slSel').value;draw();});}
function boxSummary(i){const D=data.devices[i],seen=new Set(),lines=[];
  data.paths.forEach(pa=>{if(nearestPathNode(pa,D.x,D.y).d<400)pa.sections.forEach(sec=>{if(!sec)return;
    const carried=(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]);
    carried.forEach(c=>{const k=(c.name||'')+'|'+(c.num||'')+'|'+(c.mm2||c.data);if(seen.has(k))return;seen.add(k);
      lines.push(`${c.name||'?'} ${c.num||''} — ${c.count||'?'}×${c.data||(c.mm2+' mm²')}`);});});});
  openModal('Áthaladó áramkörök',lines.length?'<div class="mrow" style="flex-direction:column;align-items:flex-start">'+lines.map(l=>`<div>• ${esc(l)}</div>`).join('')+'</div>':'<div class="mrow">Nincs bekötött áramkör a csatlakozó pályákon.</div>',()=>true);}
// ---- rooms / solo visibility / background ----
function pointInPoly(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
  if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function allRooms(level){const out=[];(ROOMSB[level]||[]).forEach((rm,i)=>out.push({rm,src:'B',i,level}));
  data.floors.forEach((fl,i)=>{if(fl.level===level)out.push({rm:fl,src:'F',i,level});});return out;}
function roomHitAt(e){const lvl=state.active,z=dz(lvl,0);const p=baseToPlan(...clientToBase(e),z);
  const list=allRooms(lvl);for(let k=list.length-1;k>=0;k--)if(pointInPoly(p[0],p[1],list[k].rm.poly))return list[k];return null;}
function soloRoomObj(){const S=state.soloRoom;if(!S)return null;return S.src==='B'?((ROOMSB[S.level]||[])[S.i]):data.floors[S.i];}
function soloOk(x,y,level){const S=state.soloRoom;if(!S)return true;if(level!==S.level)return false;
  const rm=soloRoomObj();return rm?pointInPoly(x,y,rm.poly):true;}
function soloWallOk(r,level){const S=state.soloRoom;if(!S)return true;if(level!==S.level)return false;
  const rm=soloRoomObj();if(!rm)return true;const b=polyBBox(rm.poly),T=450;
  return r.x1>b.x0-T&&r.x0<b.x1+T&&r.y1>b.y0-T&&r.y0<b.y1+T;}
function soloRoomIs(entry){const S=state.soloRoom;return !!S&&S.src===entry.src&&S.i===entry.i&&S.level===entry.level;}
function bgSvg(){const bg=state.bg;if(!bg||!bg.visible||!bg.src)return '';
  const z=dz('ground',0),O=planToBase(bg.x,bg.y,z),Ex=planToBase(bg.x+1000,bg.y,z),Ey=planToBase(bg.x,bg.y+1000,z);
  const ax=(Ex[0]-O[0])/1000,ay=(Ex[1]-O[1])/1000,bx2=(Ey[0]-O[0])/1000,by2=(Ey[1]-O[1])/1000;
  const rot=+bg.rot||0;
  const inner=rot?`<g transform="rotate(${rot} ${bg.w/2} ${bg.h/2})">`:'';
  return `<g transform="matrix(${ax},${ay},${bx2},${by2},${O[0]},${O[1]})" opacity="${bg.opacity}">${inner}`
    +`<image href="${bg.src}" x="0" y="0" width="${bg.w}" height="${bg.h}" preserveAspectRatio="none"/>${rot?'</g>':''}</g>`;}
function loadBgImage(){const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=()=>{const f=inp.files[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{const im=new Image();im.onload=()=>{const w=14600,h=Math.round(w*im.height/im.width);
      state.bg={src:r.result,w,h,x:0,y:0,opacity:0.5,visible:true};draw();};im.src=r.result;};r.readAsDataURL(f);};
  inp.click();}
// Live settings: every field applies as you type, so positioning is a matter of
// nudging a number and watching the drawing, not guessing and pressing OK.
function bgSettings(){const bg=state.bg;if(!bg)return;
  const start=JSON.parse(JSON.stringify(bg));
  openModal('Háttérkép beállítás',
     `<div class="mrow">Átlátszóság <input id="bgO" type="range" min="0.05" max="1" step="0.05" value="${bg.opacity}"><span id="bgOv" style="font-size:11px;color:#777"></span></div>`
    +`<div class="mrow">Szélesség <input id="bgW" type="number" step="100" value="${Math.round(bg.w)}" style="width:100px"> mm`
    +`<span style="font-size:11px;color:#888;margin-left:8px">a magasság arányosan követi</span></div>`
    +`<div class="mrow">Eltolás X <input id="bgX" type="number" step="50" value="${Math.round(bg.x)}" style="width:90px">`
    +` Y <input id="bgY" type="number" step="50" value="${Math.round(bg.y)}" style="width:90px"> mm</div>`
    +`<div class="mrow">Forgatás <input id="bgR" type="number" step="1" value="${Math.round(bg.rot||0)}" style="width:80px">°`
    +`<button id="bgR90" style="margin-left:6px;font-size:11px">+90°</button>`
    +`<button id="bgFit" style="margin-left:6px;font-size:11px">Illeszd a rajzhoz</button></div>`
    +`<div class="mrow" style="font-size:11px;color:#888">A kép a földszint padlósíkján fekszik és együtt forog a modellel. Minden mező azonnal érvényesül; a Mégse visszaállít.</div>`,
   ()=>{draw();},'Kész');
  const apply=()=>{const ow=bg.w||1;
    bg.opacity=+$('bgO').value;bg.w=Math.max(100,+$('bgW').value||ow);
    bg.h=Math.round(start.h*(bg.w/start.w));
    bg.x=+$('bgX').value||0;bg.y=+$('bgY').value||0;bg.rot=+$('bgR').value||0;
    $('bgOv').textContent=Math.round(bg.opacity*100)+'%';draw();};
  ['bgO','bgW','bgX','bgY','bgR'].forEach(id=>{$(id).oninput=apply;$(id).onchange=apply;});
  $('bgR90').onclick=()=>{$('bgR').value=(((+$('bgR').value||0)+90)%360);apply();};
  $('bgFit').onclick=()=>{                                   // scale to the drawn walls, and sit under them
    let b={x0:1e9,y0:1e9,x1:-1e9,y1:-1e9},any=false;
    for(const l of ORD)(WALLS[l]||[]).forEach(r=>{any=true;
      b.x0=Math.min(b.x0,r.x0);b.y0=Math.min(b.y0,r.y0);b.x1=Math.max(b.x1,r.x1);b.y1=Math.max(b.y1,r.y1);});
    if(!any){alert('Nincs mihez illeszteni — előbb rajzolj falat.');return;}
    $('bgW').value=Math.round(b.x1-b.x0);$('bgX').value=Math.round(b.x0);$('bgY').value=Math.round(b.y0);apply();};
  const cancel=$('mCancel');if(cancel)cancel.onclick=()=>{Object.assign(bg,start);draw();closeModal();};
  apply();}
// ---- context menu ----
// ---- QR menu seam ---------------------------------------------------------
// NOT named qrInject: 05f-qr.js already declares a top-level qrInject, and
// these files share one scope. A second declaration here would hoist last and
// win, and 05f's `window.qrInject = qrInject` would then bind that name to
// THIS wrapper — which calls window.qrInject — infinite recursion on every
// right-click. Distinct name, no collision.
//
// The guard exists so a build without 05f-qr.js loses the QR entries and
// nothing else. Without it a ReferenceError inside the contextmenu listener
// takes out every menu in the app.
// Same guard shape as qrMenu, same reason: 10b-notes.js is optional, and a
// ReferenceError inside the contextmenu listener would take out every menu.
// Not named ntMenuItems — that name belongs to 10b-notes.js and these files
// share one scope.
function ntMenu(items,i){
  if(typeof ntMenuItems==='function'){try{return ntMenuItems(i,items);}catch(_){}}
  return items;}

function qrMenu(items,kind,ref){
  if(typeof qrInject==='function'){try{return qrInject(items,kind,ref);}catch(_){}}
  return items;}

function ctxMenu(e,items){ctx.innerHTML=items.map((it,i)=>`<button data-i="${i}">${it.label}</button>`).join('');
  // viewport-fixed (so it also shows ABOVE the editor modals) and flipped/clamped at the screen edges
  ctx.style.left='0px';ctx.style.top='0px';ctx.style.display='block';
  const r=ctx.getBoundingClientRect(),W=window.innerWidth||1200,H=window.innerHeight||800,M=6;
  let x=(e&&e.clientX!=null)?e.clientX:M,y=(e&&e.clientY!=null)?e.clientY:M;
  if(x+r.width>W-M)x=Math.max(M,x-r.width);
  if(y+r.height>H-M)y=Math.max(M,y-r.height);
  if(y+r.height>H-M)y=Math.max(M,H-M-r.height);
  ctx.style.left=Math.round(x)+'px';ctx.style.top=Math.round(y)+'px';
  ctx.querySelectorAll('button').forEach(b=>b.onclick=()=>{hideCtx();items[+b.dataset.i].act();});}
stage.addEventListener('contextmenu',e=>{e.preventDefault();if(ctxSuppress){ctxSuppress=false;return;}if(camDrag&&camDrag.moved){return;}
  if(state.lockTouch)return; // locked: no piece/edit menu (right-drag still rotates the camera)
  const di=devHitIdx(e);
  if(di!=null){const D=data.devices[di];const items=[];
    if(D.type==='socket'||D.type==='switch'||D.type==='light'||D.type==='junction'){items.push({label:'⚙ Szükséges erek',act:()=>setDeviceReq(di)});items.push({label:'▶ Behúzás a szekrényig',act:()=>routeDevice(di,'board')});items.push({label:'▶ Behúzás a köv. dobozig',act:()=>routeDevice(di,'next')});items.push({label:'▶ Behúzás… (cél kiválasztása)',act:()=>{pendingRoute={dev:di};$('modeHint').textContent='Kattints a cél dobozra / készülékre (Select mód).';setMode('select');}});}
    if(D.type==='switch'){items.push({label:'🎚 Kapcsoló típus (101/102/105…)',act:()=>editSwitchType(di)});}
    if(D.type==='switch'||D.type==='light'||D.type==='socket'){items.push({label:'🔌 Vezetékek (kézi)',act:()=>editDeviceWires(di)});}
    if(D.type==='junction'){items.push({label:'🔀 Elfogadott áramkörök…',act:()=>editBoxAccept(di)});items.push({label:'⚙ Beállítás (kivitel)',act:()=>{openModal('Kötődoboz kivitele',`<div class="mrow"><select id="bSel" style="width:100%">`+BUILDS.map(b=>`<option value="${b.k}">${b.l}</option>`).join('')+`</select></div>`,()=>{pushUndo();D.build=$('bSel').value;draw();});}});
      items.push({label:'🔎 Áthaladó áramkörök',act:()=>boxSummary(di)});}
    if(D.type==='board')items.push({label:'🔎 Áthaladó áramkörök',act:()=>boxSummary(di)});
    items.push({label:'→ Réteg…',act:()=>sendToLayer(D)});
    deviceExtraItems(di,items);
    qrMenu(items,'devices',{i:di});                                     // QR: 05g on:['devices']
    items.push({label:'🗑 Törlés',act:()=>{pushUndo();data.devices.splice(di,1);draw();}});
    ctxMenu(e,items);return;}
  const oh=hitTest(e);
  if(oh&&oh.t==='roofs'){const R=data.roofs[oh.i];ctxMenu(e,[
    {label:'📐 Tető beállítás',act:()=>roofDlg('Tető beállítás',R,v=>{pushUndo();Object.assign(R,v);draw();})},
    {label:'⧉ Másolás',act:()=>{pushUndo();data.roofs.push(Object.assign({},R,{y0:R.y0+(R.y1-R.y0)+500,y1:R.y1+(R.y1-R.y0)+500}));draw();}},
    {label:'🗑 Törlés',act:()=>{pushUndo();data.roofs.splice(oh.i,1);selected=null;draw();}}]);return;}
  if(oh&&oh.t==='objects'){const O=data.objects[oh.i];ctxMenu(e,[
    {label:'📐 Méretek',act:()=>objDimModal('Objektum méretei',{n:O.name,w:O.w,d:O.d,ht:O.ht,z:O.z||0},v=>{pushUndo();O.name=v.n;O.w=v.w;O.d=v.d;O.ht=v.ht;O.z=v.z;draw();})},
    {label:'↻ Forgatás 15°',act:()=>{pushUndo();O.ang=(O.ang||0)+Math.PI/12;draw();}},
    {label:'⧉ Másolás',act:()=>{pushUndo();data.objects.push(Object.assign({},O,{x:O.x+(O.w||600)+200}));draw();}},
    {label:'→ Réteg…',act:()=>sendToLayer(O)},
    {label:'⬆ Előre hozás (floor fölé)',act:()=>{pushUndo();O.zord=(O.zord||0)+1;draw();}},
    {label:'⬇ Hátra küldés (floor alá)',act:()=>{pushUndo();O.zord=(O.zord||0)-1;draw();}},
    {label:'↕ Sorrend alaphelyzet',act:()=>{pushUndo();O.zord=0;draw();}},
    {label:'🗑 Törlés',act:()=>{pushUndo();data.objects.splice(oh.i,1);selected=null;draw();}}]);return;}
  const ps=pathSectionHit(e);
  if(ps){const items=[
    {label:'🧱 Kivitel (build)',act:()=>setSectionBuild(ps.pi,ps.si)},
    {label:'⚡ Áramkör beállítása',act:()=>setSectionCircuit(ps.pi,ps.si)},
    {label:'🔀 Átengedett áramkörök…',act:()=>editPathAllow(ps.pi,ps.si)},
    {label:'⊙ + Kötődoboz ide',act:()=>{pushUndo();const pa=data.paths[ps.pi],a=pa.nodes[ps.si],b=pa.nodes[ps.si+1];data.devices.push({type:'junction',level:a.level,x:(a.x+b.x)/2,y:(a.y+b.y)/2,h:((a.h||0)+(b.h||0))/2,layer:curLayer()});draw();}},
    {label:'⇉ + Párhuzamos pálya',act:()=>addParallelPath(ps.pi)},
    {label:'🎨 Pálya szín…',act:()=>{const pa=data.paths[ps.pi];openModal('Pálya szín',`<div class="mrow">Szín <input id="pcPick" type="color" value="${pa.color||state.pathColor||'#6f757d'}" style="width:48px;height:26px;vertical-align:middle"></div><div class="mrow" style="font-size:11px;color:#777">Ez a pálya saját színe (felülírja a globális beállítást).</div>`,()=>{pushUndo();pa.color=$('pcPick').value;draw();},'Alkalmaz');}},
    {label:'↺ Pálya szín törlése',act:()=>{pushUndo();delete data.paths[ps.pi].color;draw();}},
    {label:'🗑 Pálya törlése',act:()=>{pushUndo();data.paths.splice(ps.pi,1);draw();}}];
    qrMenu(items,'paths',{pi:ps.pi,si:ps.si});                          // QR: 05g on:['paths']
    ctxMenu(e,items);return;}
  const h=hitTest(e);if(h&&h.t!=='wall'){const items=[];if(h.t==='openings'){const oo=data.openings[h.i];if(oo.type==='stairs')items.push({label:'📐 Méretek',act:()=>editStairs(h.i)});else if(oo.type==='door'||oo.type==='window')items.push({label:'📐 Méretek',act:()=>editOpening(h.i)});
      if(oo.type==='door'){
        items.push({label:'🚪 Ajtó típusa… ('+doorName(oo)+')',act:()=>doorTypeDialog(h.i)});
        items.push({label:'⇄ Zsanér oldal (bal ↔ jobb)',act:()=>{pushUndo();oo.variant=((oo.variant||0)^2)&3;draw();
          $('hud').textContent='Zsanér: '+(((oo.variant||0)&2)?'túlsó tok':'közeli tok');}});
        items.push({label:'⇅ Nyitásirány (befelé ↔ kifelé)',act:()=>{pushUndo();oo.variant=((oo.variant||0)^1)&3;draw();
          $('hud').textContent='Nyitásirány átfordítva.';}});}items.push({label:'⧉ Másolás',act:()=>{pushUndo();const d=[Math.cos(oo.ang),Math.sin(oo.ang)],off=(oo.w||1000);data.openings.push(Object.assign({},oo,{x:oo.x+d[0]*off,y:oo.y+d[1]*off}));draw();}});items.push({label:'→ Réteg…',act:()=>sendToLayer(oo)});}
    if(h.t==='devices')deviceExtraItems(h.i,items);
    if(h.t==='notes')ntMenu(items,h.i);                                 // note RCO: 10b-notes.js
    if(h.t==='floors'){const rh0={rm:data.floors[h.i],src:'F',i:h.i,level:data.floors[h.i].level};
      ctxMenu(e,roomMenuItems(rh0));return;}                       // a floor IS a room — give it the room menu
    qrMenu(items,h.t,{i:h.i});                                          // QR: whatever is declared for this kind
    items.push({label:'🗑 Delete',act:()=>{pushUndo();removeHit(h);draw();}});ctxMenu(e,items);return;}
  const wallR=wallHitRect(e);
  if(wallR){ctxMenu(e,[{label:'🧱 Fal nézet (elevation)',act:()=>openWallView(wallR,state.active)},
    {label:'📐 Fal tulajdonságai… (vastagság / hossz / magasság / indulás)',act:()=>wallPropsDialog(wallR,state.active)},
    {label:'🔪 Pengefal 100 mm',act:()=>{pushUndo();setWallGeom(wallR,state.active,{th:100});draw();
      $('hud').textContent='Pengefal — 100 mm vastag.';}},
    {label:(noteSurfaceHidden(wallKey(wallR,state.active))?'📝 Jegyzetek mutatása ezen a falon':'📝 Jegyzetek elrejtése ezen a falon'),
      act:()=>{pushUndo();const on=noteSurfaceToggle(wallKey(wallR,state.active));draw();
        $('hud').textContent='A fal jegyzetei '+(on?'láthatók':'elrejtve')+' (a Fal nézetben).';}},
    {label:'📐 Magasság',act:()=>{const cur=wallR.h||wallH(state.active);openModal('Fal magassága (mm)',`<div class="mrow"><input id="whv" type="number" value="${cur}" style="width:90px"> mm</div>`,()=>{pushUndo();wallR.h=+$('whv').value||wallH(state.active);draw();});}},{label:'▣ Elosztószekrény ide',act:()=>placeBoardAt(e)},{label:'▣ Elosztószekrény… (haladó)',act:()=>advancedBoardAt(e,wallR)},
    {label:'🗑 Fal törlése',act:()=>{pushUndo();const a=WALLS[state.active];a.splice(a.indexOf(wallR),1);SNAP[state.active]=centerlines(a);draw();}}]);return;}
  const rh=roomHitAt(e);
  if(rh){ctxMenu(e,roomMenuItems(rh));return;}

  const bgItems=[{label:'🖼 Háttérkép betöltése',act:()=>loadBgImage()}];
  if(state.bg)bgItems.push({label:'◐ Háttérkép beállítás (pozíció, méret, forgatás)',act:()=>bgSettings()},
    {label:(state.bg.visible?'🚫 Háttér elrejtése':'👁 Háttér mutatása'),act:()=>{state.bg.visible=!state.bg.visible;draw();}},
    {label:'◐ Háttér beállítás',act:()=>bgSettings()},{label:'🗑 Háttér törlése',act:()=>{state.bg=null;draw();}});
  if(state.soloRoom)bgItems.push({label:'👁 Összes helyiség',act:()=>{state.soloRoom=null;draw();}});
  qrMenu(bgItems,'stage',null);                                         // QR: wifi / url / phone
  ctxMenu(e,bgItems);});
function hideCtx(){ctx.style.display='none';}
// the room / floor menu, shared by a floor-slab hit and a room-polygon hit
function roomMenuItems(rh){const rm=rh.rm,solo=soloRoomIs(rh);const items=[
    {label:'✎ Helyiség neve',act:()=>openModal('Helyiség neve',`<div class="mrow"><input id="rnm" value="${esc(rm.name||'')}" style="width:200px"></div>`,()=>{pushUndo();rm.name=$('rnm').value;draw();})},
    {label:(solo?'👁 Összes helyiség':'👁 Csak ez a helyiség'),act:()=>{state.soloRoom=solo?null:{src:rh.src,i:rh.i,level:rh.level};draw();}},
    {label:(rm.noText?'🔤 Felirat be':'🔤 Felirat ki'),act:()=>{pushUndo();rm.noText=!rm.noText;draw();}},
    {label:'🏷 Helyiség adatlap… (név, burkolat, környezet, magasságok)',act:()=>roomPropsDialog(rm,rh.level,rh.src)},
    {label:'🔢 Helyiség átszámozása… (készülékjelölések a sablon szerint)',act:()=>roomRenumberDialog(rh)},
    {label:'🧱 Helyiség kiterítve',act:()=>openRoomUnfold(rm,rh.level)},
    {label:'⬓ Padló nézet (felülnézet, szerkeszthető)',act:()=>openPlaneView(rm,rh.level,'floor')},
    {label:'⬒ Mennyezet nézet (felülről, a falakon átnézve)',act:()=>openPlaneView(rm,rh.level,'ceiling')},
    {label:'🖼 Háttérkép betöltése',act:()=>loadBgImage()}];
  if(state.bg)items.push({label:'◐ Háttérkép beállítás (pozíció, méret, forgatás)',act:()=>bgSettings()});
  ['floor','drop','ceiling'].forEach(kind=>{const k=planeKey(rh.level,kind,rm.poly);
    const nm={floor:'padló',drop:'álmennyezet',ceiling:'mennyezet'}[kind];
    items.push({label:(noteSurfaceHidden(k)?'📝 Jegyzetek mutatása — '+nm:'📝 Jegyzetek elrejtése — '+nm),
      act:()=>{pushUndo();const on=noteSurfaceToggle(k);draw();
        $('hud').textContent='A '+nm+' jegyzetei '+(on?'láthatók':'elrejtve')+'.';}});});
    if(rh.src==='F')items.push({label:'🗑 Padló törlése',act:()=>{pushUndo();data.floors.splice(rh.i,1);draw();}});
    qrMenu(items,'floors',{rm:rm});                                     // QR: 05g on:['floors']
    return items;}
function hideCtx2_(){}

