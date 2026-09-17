// minimal stubs so the module can be loaded outside a browser
const store = new Map();
global.localStorage = {
  get length(){return store.size;},
  key:i=>[...store.keys()][i],
  getItem:k=>store.has(k)?store.get(k):null,
  setItem:(k,v)=>store.set(k,String(v)),
  removeItem:k=>store.delete(k)
};
global.location = {href:'file:///E:/x.html', reload(){}};
global.navigator = {userAgent:'node'};
const noop=()=>({style:{},appendChild(){},addEventListener(){},remove(){},setAttribute(){},classList:{add(){}}});
global.document = {readyState:'complete', head:noop(), body:noop(),
  getElementById:()=>null, createElement:noop, addEventListener(){}, removeEventListener(){}};
global.window = {};
global.setTimeout = (f)=>0;   // suppress boot retries
global.Blob=function(){}; global.URL={createObjectURL:()=>'',revokeObjectURL(){}};
global.VERSION='1.0.0';

const src = require('fs').readFileSync(require('path').join(__dirname,'..','src','11b-backup.js'),'utf8');
eval(src);
const VBACKUP = global.window.VBACKUP;

// --- seed a library ---
localStorage.setItem('villanyterv_projects_v1', JSON.stringify([
  {id:'pelda', name:'Példa ház', saved:'2026-08-01T10:00:00Z', data:{x:1}},
  {id:'domoszlo', name:'Domoszló', saved:'2026-08-20T18:30:00Z', data:{x:2}}
]));
localStorage.setItem('villanyterv_lock','1');
localStorage.setItem('unrelated_key','nope');

const A=[]; const t=(n,c)=>A.push((c?'PASS':'FAIL')+'  '+n);

const b = VBACKUP.build();
t('format+version', b.format==='varler-planner-bundle'&&b.bundleVersion===1);
t('app version stamped', b.app==='1.0.0');
t('2 projects indexed', b.counts.projects===2);
t('unrelated key excluded', !('unrelated_key' in b.store));
t('lock key included', 'villanyterv_lock' in b.store);
t('index names', b.index.map(p=>p.name).join('|')==='Példa ház|Domoszló');

const round = VBACKUP.parse(JSON.stringify(b));
t('parse roundtrip', round.__projects.length===2);
t('checksum ok', round.__checksumOk===true);

const tampered = JSON.parse(JSON.stringify(b));
tampered.store['villanyterv_lock']='0';
t('checksum catches tampering', VBACKUP.parse(JSON.stringify(tampered)).__checksumOk===false);

let threw=0; try{VBACKUP.parse('{"format":"other"}');}catch(e){threw=1;}
t('rejects foreign file', threw===1);
threw=0; try{VBACKUP.parse('not json');}catch(e){threw=1;}
t('rejects broken json', threw===1);
threw=0; try{const f=JSON.parse(JSON.stringify(b));f.bundleVersion=99;VBACKUP.parse(JSON.stringify(f));}catch(e){threw=1;}
t('rejects newer format', threw===1);

// --- merge into a DIFFERENT (fresh-profile) store ---
store.clear();
localStorage.setItem('villanyterv_projects_v1', JSON.stringify([{id:'domoszlo',name:'Domoszló RÉGI',saved:'2026-01-01'}]));
let r = VBACKUP.apply(round,'merge',['pelda','domoszlo']);
t('merge adds 1 skips 1', r.added===1&&r.skipped===1&&r.replaced===0);
t('merge kept local copy', VBACKUP.projects().find(p=>p.id==='domoszlo').name==='Domoszló RÉGI');
t('merge brought other keys', localStorage.getItem('villanyterv_lock')==='1');

store.clear();
localStorage.setItem('villanyterv_projects_v1', JSON.stringify([{id:'domoszlo',name:'Domoszló RÉGI'}]));
r = VBACKUP.apply(round,'overwrite',['pelda','domoszlo']);
t('overwrite replaces 1 adds 1', r.added===1&&r.replaced===1);
t('overwrite took bundle copy', VBACKUP.projects().find(p=>p.id==='domoszlo').name==='Domoszló');

store.clear();
localStorage.setItem('villanyterv_projects_v1', JSON.stringify([{id:'ghost',name:'Kísértet'}]));
r = VBACKUP.apply(round,'replace',null);
t('replace wipes old', !VBACKUP.projects().some(p=>p.id==='ghost'));
t('replace restores all', VBACKUP.projects().length===2);

store.clear();
localStorage.setItem('villanyterv_projects_v1', JSON.stringify([{id:'ghost',name:'Kísértet'}]));
VBACKUP.apply(round,'replace',['pelda']);
t('selective replace keeps only picked', VBACKUP.projects().length===1&&VBACKUP.projects()[0].id==='pelda');

// object-map shaped library (defensive path)
store.clear();
localStorage.setItem('villanyterv_projects_v1', JSON.stringify({a:{name:'A'},b:{name:'B'}}));
t('handles id->project map', VBACKUP.projects().length===2);
// missing/empty library
store.clear();
t('empty store safe', VBACKUP.projects().length===0 && VBACKUP.build().counts.projects===0);

console.log(A.join('\n'));
console.log('\n'+A.filter(x=>x[0]==='P').length+'/'+A.length+' passed');
