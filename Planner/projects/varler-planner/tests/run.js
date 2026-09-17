// One command to check the whole planner:
//     node tests/run.js
// Add --golden-update to accept intentional drawing changes.
const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');
const dir=__dirname;
const suites=fs.readdirSync(dir).filter(f=>/^spec-.*\.js$/.test(f)).sort();
let total=0,failed=0,broken=[];

console.log('Planner test run — '+suites.length+' suites + golden output\n');
for(const f of suites){
  let out='';
  try{out=execFileSync('node',[path.join(dir,f)],{encoding:'utf8',timeout:120000});}
  catch(e){out=(e.stdout||'')+(e.stderr||'');}
  const m=out.match(/ALL PASS \((\d+)\)/);
  const bad=out.match(/(\d+) FAILED/);
  if(m){total+=+m[1];console.log('  ok    '+f.padEnd(34)+m[1]+' checks');}
  else{failed++;broken.push(f);console.log('  FAIL  '+f.padEnd(34)+(bad?bad[1]+' failing':'suite error'));
    out.split('\n').filter(l=>/^FAIL|EXCEPTION/.test(l)).slice(0,6).forEach(l=>console.log('        '+l));}
}
let gold='';
try{gold=execFileSync('node',[path.join(dir,'golden.js')].concat(process.argv.includes('--golden-update')?['--update']:[]),
  {encoding:'utf8',timeout:180000});}
catch(e){gold=(e.stdout||'')+(e.stderr||'');failed++;broken.push('golden.js');}
console.log('\n'+gold.trim().split('\n').slice(-1)[0]);
console.log('\n'+total+' assertions across '+suites.length+' suites'+(failed?('  ·  '+failed+' PROBLEM: '+broken.join(', ')):'  ·  all green'));
process.exitCode=failed?1:0;
