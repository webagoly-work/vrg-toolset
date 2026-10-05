// One command to check the whole planner:
//     node tests/run.js
// Add --golden-update to accept intentional drawing changes.
//
// No suite exits by itself (the JSDOM window keeps Node alive), so each one is ended ~300 ms
// after it prints its verdict. The timeout only catches a suite that hangs before getting there.
// Four run at a time; results still print in suite order.
const {spawn}=require('child_process');const fs=require('fs');const path=require('path');
const dir=__dirname;
const suites=fs.readdirSync(dir).filter(f=>/^spec-.*\.js$/.test(f)).sort();
const JOBS=4,GRACE=300;
let total=0,failed=0,broken=[];

// run one script until it has printed `done` (or exits, or times out); resolves with what it printed
function run(j){return new Promise(resolve=>{
  const p=spawn(process.execPath,[path.join(dir,j.f)].concat(j.args));
  let out='',over=false,grace=null;
  const fin=why=>{if(over)return;over=true;clearTimeout(tm);clearTimeout(grace);
    try{p.kill();}catch(_){}
    p.stdout.destroy();p.stderr.destroy();resolve({out,why});};
  const tm=setTimeout(()=>fin('timeout'),j.timeout);
  p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');
  p.stdout.on('data',s=>{out+=s;if(!grace&&j.done.test(out))grace=setTimeout(()=>fin('done'),GRACE);});
  p.stderr.on('data',s=>{out+=s;});
  p.on('error',e=>{out+=e.message;fin('error');});
  p.on('close',()=>fin('exit'));});}

const jobs=suites.map(f=>({f,args:[],done:/ALL PASS \(\d+\)|\d+ FAILED/,timeout:120000}))
  .concat({f:'golden.js',args:process.argv.includes('--golden-update')?['--update']:[],
           done:/GOLDEN OK|renders differ|baseline (written|created)/,timeout:180000});
const results=jobs.map(j=>new Promise(r=>{j.resolve=r;}));
let next=0;
for(let k=0;k<JOBS;k++)(async()=>{while(next<jobs.length){const j=jobs[next++];j.resolve(await run(j));}})();

(async()=>{
console.log('Planner test run — '+suites.length+' suites + golden output\n');
for(let i=0;i<suites.length;i++){
  const f=suites[i],{out,why}=await results[i];
  const m=out.match(/ALL PASS \((\d+)\)/);
  const bad=out.match(/(\d+) FAILED/);
  if(m){total+=+m[1];console.log('  ok    '+f.padEnd(34)+m[1]+' checks');}
  else{failed++;broken.push(f);console.log('  FAIL  '+f.padEnd(34)+(bad?bad[1]+' failing':why==='timeout'?'timed out':'suite error'));
    out.split('\n').filter(l=>/^FAIL|EXCEPTION/.test(l)).slice(0,6).forEach(l=>console.log('        '+l));}
}
const gold=(await results[suites.length]).out;
if(!/GOLDEN OK|baseline (written|created)/.test(gold)){failed++;broken.push('golden.js');}
console.log('\n'+gold.trim().split('\n').slice(-1)[0]);
console.log('\n'+total+' assertions across '+suites.length+' suites'+(failed?('  ·  '+failed+' PROBLEM: '+broken.join(', ')):'  ·  all green'));
process.exitCode=failed?1:0;
})();
