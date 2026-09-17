// qr-menu-smoke.js — proves the five context-menu seams in 10-lamps.js reach
// the right 05g targets, and that a build without 05f degrades to "no QR
// entries" rather than "no menus at all".
const fs=require('fs'),path=require('path');
const SRC=path.join(__dirname,'..','src');
const A=[],t=(n,c)=>A.push((c?'PASS  ':'FAIL  ')+n);

// pull just the qrMenu wrapper out of 10-lamps.js and exercise it
const lamps=fs.readFileSync(path.join(SRC,'10-lamps.js'),'utf8');
const m=/function qrMenu\(items,kind,ref\)\{[\s\S]*?\n  return items;\}/.exec(lamps);
t('qrMenu wrapper present in 10-lamps.js', !!m);

// --- seam placement, checked against the source text ---
const seam=(re,label)=>t(label, re.test(lamps));
seam(/qrMenu\(items,'devices',\{i:di\}\)/,        "seam 1: device menu");
seam(/qrMenu\(items,'paths',\{pi:ps\.pi,si:ps\.si\}\)/, "seam 2: path section");
seam(/qrMenu\(items,h\.t,\{i:h\.i\}\)/,           "seam 3: generic hit");
seam(/qrMenu\(bgItems,'stage',null\)/,            "seam 4: stage background");
seam(/qrMenu\(items,'floors',\{rm:rm\}\)/,        "seam 5: room / floor");
t('exactly 5 call sites', (lamps.match(/qrMenu\(/g)||[]).length===6); // 5 calls + 1 declaration
t('does not redeclare qrInject', !/^function qrInject/m.test(lamps));

// --- behaviour: wrapper with no 05f present ---
let items=[{label:'existing'}];
const noEngine=new Function('items','kind','ref', m[0].replace(/^function qrMenu\([^)]*\)\{/,'').replace(/\}$/,''));
t('no engine: returns the array untouched', noEngine(items,'devices',{i:0})===items && items.length===1);

// --- behaviour: engine present, and one that throws ---
global.qrInject=(it,kind)=>{it.push({label:'▦ QR — '+kind});return it;};
const withEngine=new Function('items','kind','ref', m[0].replace(/^function qrMenu\([^)]*\)\{/,'').replace(/\}$/,''));
items=[{label:'existing'}];
withEngine(items,'devices',{i:0});
t('engine present: entry appended', items.length===2 && items[1].label==='▦ QR — devices');

global.qrInject=()=>{throw new Error('target blew up');};
items=[{label:'existing'}];
let threw=false;
try{ withEngine(items,'floors',{rm:{}}); }catch(e){ threw=true; }
t('a throwing target cannot kill the menu', !threw && items.length===1);

// --- 05g targets declare the kinds the seams pass ---
const g=fs.readFileSync(path.join(SRC,'05g-qr-targets.js'),'utf8');
["'devices'","'paths'","'floors'","'stage'"].forEach(k=>
  t('05g declares on:'+k, g.includes('on:['+k+']')));

// --- the room seam passes a record, not an index ---
t('room seam passes {rm} so qrRoomRec resolves directly',
  /qrMenu\(items,'floors',\{rm:rm\}\)/.test(lamps) && /qrRoomRec\(c\)\{if\(c&&c\.qrRef&&c\.qrRef\.rm\)/.test(g));

console.log(A.join('\n'));
const p=A.filter(x=>x[0]==='P').length;
console.log('\n'+p+'/'+A.length+' passed');
process.exit(p===A.length?0:1);
