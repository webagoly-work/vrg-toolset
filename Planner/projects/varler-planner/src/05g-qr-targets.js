// ---------------------------------------------------------------------------
// QR TARGETS — the project-specific half.
//
// This is the file you edit when Yarris points at something and says "make a QR
// option for that". One entry = one option, and it shows up in the ⌘K palette,
// in the inspector, and in the right-click menu of whatever `on:` lists.
//
// Nothing here is imported by the engine. Delete this file and 05f still works;
// copy 05f into another project and write a different version of this one.
//
// Three shapes of target, all present below as templates:
//   STATIC   text() returns a constant-ish string          → wifi, text
//   BOUND    text() reads the clicked/selected record      → dev, path, room
//   RELAY    text() is a qrLink(); needs the relay running → phone, cmd, dl
// ---------------------------------------------------------------------------

// WIFI:T:<auth>;S:<ssid>;P:<pass>;H:<hidden>;;  — the de-facto format both
// Android and iOS accept. Semicolons, commas, colons and backslashes inside the
// SSID or password must be escaped or the phone silently joins the wrong thing.
function qrWifiStr(ssid,pass,auth,hidden){
  const e=s=>String(s==null?'':s).replace(/([\\;,:"])/g,'\\$1');
  auth=auth||(pass?'WPA':'nopass');
  return 'WIFI:T:'+auth+';S:'+e(ssid)+';P:'+(auth==='nopass'?'':e(pass))+';'+(hidden?'H:true;':'')+';';}

function qrDevText(D){if(!D)return null;
  const L=[];
  L.push((D.ref||DEV[D.type]||D.type)+' — '+(DEV[D.type]||D.type));
  if(D.kind)L.push('kivitel: '+D.kind);
  L.push('szint: '+D.level+' · magasság: '+Math.round(D.h||0)+' mm');
  L.push('hely: X'+Math.round(D.x)+' Y'+Math.round(D.y));
  if(D.lampName)L.push('lámpa: '+D.lampName);
  if(D.build)L.push('doboz: '+((BUILDS.find(b=>b.k===D.build)||{}).l||D.build));
  if(D.req)L.push('szükséges erek: '+D.req);
  return L.join('\n');}

function qrPathText(pi,si){const pa=data.paths[pi];if(!pa)return null;
  const sec=(pa.sections||[])[si]||{},L=[];
  const a=pa.nodes[si],b=pa.nodes[si+1];
  L.push('Pálya P'+pi+(si!=null?' / szakasz '+(si+1):''));
  if(sec.build)L.push('kivitel: '+((BUILDS.find(x=>x.k===sec.build)||{}).l||sec.build));
  const cc=(sec.circuit?[sec.circuit]:[]).concat(sec.circuits||[]);
  if(cc.length)L.push('áramkör: '+cc.map(c=>(c.num?c.num+' ':'')+(c.name||'')+' '+(c.count||'')+'×'+(c.mm2||'')).join(' | '));
  if(a&&b)L.push('hossz: '+Math.round(Math.hypot(b.x-a.x,b.y-a.y))+' mm');
  return L.join('\n');}

// The room menu is shared by a floor-slab hit and a room-polygon hit, and only
// one of them carries an index — so accept either the record or the index.
function qrRoomRec(c){if(c&&c.qrRef&&c.qrRef.rm)return c.qrRef.rm;
  const i=qrRefIdx(c,'floors');return i!=null?data.floors[i]:null;}
function qrRoomText(f){if(!f)return null;
  const L=[(f.name||'Helyiség')];
  if(f.poly)L.push('terület: '+(polyArea(f.poly)/1e6).toFixed(2)+' m²');
  if(f.env)L.push('környezet: '+f.env);
  if(f.h!=null)L.push('belmagasság: '+Math.round(f.h)+' mm');
  return L.join('\n');}

// A short human note that goes on the printed code so nobody has to guess what
// they are pointing a phone at three weeks later.
function qrNote(){try{return (B&&B.name)||'Varler Planner';}catch(_){return 'Varler Planner';}}

qrRegisterAll([

// ---- RELAY targets ---------------------------------------------------------
{id:'phone',label:'QR — telefon csatlakoztatása',icon:'📱',group:'Projekt',net:true,on:['stage'],
 alias:'connect phone relay ip cím',
 hint:'A relé címét kódolja, hogy ne kelljen az IP-t kézzel begépelni a telefonon.',
 text:()=>qrLink((QRNET.paths&&QRNET.paths.phone)||'/phone-sender.html',{}),
 sub:()=>t('qr.sub.phone','Olvasd be a telefonnal — ugyanazon a WiFi-n kell lennie.')},

{id:'cmd',label:'QR — parancs a Plannernek',icon:'⌨',group:'Projekt',net:true,
 alias:'command remote control vezérlés',
 hint:'A telefon a relén keresztül küldi vissza a parancsot a rajznak.',
 form:()=>`${esc(t('qr.cmd.what','Parancs'))}
   <select id="qrCmdSel" style="width:210px">
     ${ACTIONS.filter(a=>a.keys&&a.keys.length).slice(0,60)
        .map(a=>`<option value="${esc(a.id)}">${esc(a.label)}</option>`).join('')}
   </select>`,
 text:()=>{const el=$('qrCmdSel');return qrLink((QRNET.paths&&QRNET.paths.cmd)||'/cmd',{a:el?el.value:''});},
 sub:()=>t('qr.sub.cmd','A relé továbbítja; a Planner a nyitott böngészőben futtatja.')},

{id:'dl',label:'QR — letöltés telefonra',icon:'⬇',group:'Dokumentáció',net:true,
 alias:'download export bom anyagkimutatás',
 hint:'Nagy tartalom nem fér QR-be — ez a relén kiszolgált fájlra mutat.',
 form:()=>`${esc(t('qr.dl.what','Mit'))}
   <select id="qrDlSel" style="width:210px">
     <option value="bom">Anyagkimutatás (BOM)</option>
     <option value="wires">Vezetékkimutatás</option>
     <option value="plan">Terv (.vplan.json)</option>
     <option value="svg">Rajz (SVG)</option>
   </select>`,
 text:()=>{const el=$('qrDlSel');
   return qrLink((QRNET.paths&&QRNET.paths.dl)||'/dl',{what:el?el.value:'bom',p:(typeof currentProjId!=='undefined'&&currentProjId)||''});},
 sub:()=>qrNote()},

// ---- STATIC targets --------------------------------------------------------
{id:'wifi',label:'QR — WiFi hálózat',icon:'📶',group:'Projekt',ecc:'M',on:['stage'],
 alias:'wifi wlan hotspot jelszó password',
 hint:'A telefon a beolvasás után felajánlja a csatlakozást — nincs jelszógépelés.',
 form:()=>`<div>${esc(t('qr.wifi.ssid','Hálózat (SSID)'))} <input id="qrWSsid" style="width:170px" value="${esc(qrGet('SSID',''))}"></div>
   <div style="margin-top:4px">${esc(t('qr.wifi.pass','Jelszó'))} <input id="qrWPass" style="width:170px" value="">
   <select id="qrWAuth"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">nyílt</option></select>
   <label style="font-size:11px"><input type="checkbox" id="qrWHid"> ${esc(t('qr.wifi.hidden','rejtett'))}</label></div>`,
 text:()=>{const s=$('qrWSsid');if(!s||!s.value)return null;qrSet('SSID',s.value);
   return qrWifiStr(s.value,$('qrWPass').value,$('qrWAuth').value,$('qrWHid').checked);},
 sub:()=>t('qr.sub.wifi','Jelszót tartalmaz — ne tedd bele ügyfélnek adott rajzba.')},

{id:'url',label:'QR — cím / port',icon:'🔗',group:'Projekt',on:['stage'],
 alias:'url link port service szolgáltatás',
 hint:'Bármelyik helyi szolgáltatás megnyitása a telefonon (relé, kamera, fájlszerver).',
 form:()=>`<input id="qrUrlIn" style="width:100%" placeholder="http://192.168.1.24:8080/…"
   value="${esc(qrBase()||qrGet('LASTURL','http://'))}">`,
 text:()=>{const el=$('qrUrlIn');if(!el||!/^[a-z]+:\/\/./i.test(el.value))return null;
   qrSet('LASTURL',el.value);return el.value.trim();}},

{id:'text',label:'QR — tetszőleges szöveg',icon:'✎',group:'Projekt',
 alias:'text free custom szöveg',
 form:()=>`<textarea id="qrFree" rows="3" style="width:100%" placeholder="${esc(t('qr.free','Írd ide, amit át akarsz vinni…'))}"></textarea>`,
 text:()=>{const el=$('qrFree');return el?el.value:null;}},

// ---- BOUND targets (right-click + inspector) -------------------------------
{id:'dev',label:'QR — készülék adatai',icon:'▦',group:'Készülék',on:['devices'],
 alias:'device data készülék',
 need:'Jelölj ki egy készüléket.',
 when:c=>qrRefIdx(c,'devices')!=null,
 text:c=>qrDevText(data.devices[qrRefIdx(c,'devices')]),
 sub:()=>qrNote()},

{id:'path',label:'QR — pálya szakasz',icon:'▦',group:'Véset',on:['paths'],
 alias:'path section pálya szakasz',
 need:'Kattints jobb gombbal egy pályaszakaszra.',
 when:c=>!!(c.qrRef&&c.qrRef.pi!=null),
 text:c=>qrPathText(c.qrRef.pi,c.qrRef.si),
 sub:()=>qrNote()},

{id:'room',label:'QR — helyiség',icon:'▦',group:'Helyiség',on:['floors'],
 alias:'room floor helyiség',
 need:'Jelölj ki egy helyiséget.',
 when:c=>!!qrRoomRec(c),
 text:c=>qrRoomText(qrRoomRec(c)),
 sub:()=>qrNote()}

]);
