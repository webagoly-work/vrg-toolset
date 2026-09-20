const fs=require('fs'),zlib=require('zlib');
function readZip(buf){
  const files={};
  // find EOCD
  let i=buf.length-22;
  for(;i>=0;i--){if(buf.readUInt32LE(i)===0x06054b50)break;}
  const cdOff=buf.readUInt32LE(i+16), n=buf.readUInt16LE(i+10);
  let p=cdOff;
  for(let k=0;k<n;k++){
    const method=buf.readUInt16LE(p+10);
    const csize=buf.readUInt32LE(p+20), nameLen=buf.readUInt16LE(p+28), extraLen=buf.readUInt16LE(p+30), cmtLen=buf.readUInt16LE(p+32);
    const lho=buf.readUInt32LE(p+42);
    const name=buf.slice(p+46,p+46+nameLen).toString('utf8');
    const lnl=buf.readUInt16LE(lho+26), lel=buf.readUInt16LE(lho+28);
    const dstart=lho+30+lnl+lel;
    const raw=buf.slice(dstart,dstart+csize);
    files[name]=method===0?raw:zlib.inflateRawSync(raw);
    p+=46+nameLen+extraLen+cmtLen;
  }
  return files;
}
const f=readZip(fs.readFileSync(process.argv[2]));
const ss=[];
if(f['xl/sharedStrings.xml']){
  const x=f['xl/sharedStrings.xml'].toString('utf8');
  for(const m of x.matchAll(/<si>([\s\S]*?)<\/si>/g)){
    ss.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(a=>a[1]).join('').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d)));
  }
}
for(const name of Object.keys(f)){
  if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(name))continue;
  console.log('### '+name);
  const x=f[name].toString('utf8');
  for(const row of x.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){
    const cells=[];
    for(const c of row[1].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)){
      const t=(c[3].match(/t="([^"]+)"/)||[])[1];
      let v=(c[4].match(/<v>([\s\S]*?)<\/v>/)||[])[1]||'';
      if(t==='s')v=ss[+v]||'';
      if(t==='inlineStr')v=[...c[4].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(a=>a[1]).join('');
      if(v!=='')cells.push(c[1]+':'+v);
    }
    if(cells.length)console.log(cells.join(' | '));
  }
}
