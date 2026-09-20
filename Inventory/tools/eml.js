const fs=require('fs');
function decodeQP(s){
  return s.replace(/=\r?\n/g,'').replace(/=([0-9A-Fa-f]{2})/g,(m,h)=>String.fromCharCode(parseInt(h,16)));
}
function decodeHeaderWord(s){
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,(m,cs,enc,txt)=>{
    let buf;
    if(enc.toUpperCase()==='B') buf=Buffer.from(txt,'base64');
    else buf=Buffer.from(decodeQP(txt.replace(/_/g,' ')),'latin1');
    return buf.toString(/utf-?8/i.test(cs)?'utf8':'latin1');
  }).replace(/\?=\s+=\?/g,'');
}
function parseEml(file){
  const raw=fs.readFileSync(file,'latin1');
  // unfold headers
  let sep=raw.indexOf('\r\n\r\n'); let sl=4;
  if(sep<0){sep=raw.indexOf('\n\n'); sl=2;}
  const headerBlock=raw.slice(0,sep).replace(/\r?\n[ \t]+/g,' ');
  let body=raw.slice(sep+sl);
  const h={};
  for(const line of headerBlock.split(/\r?\n/)){
    const m=line.match(/^([A-Za-z\-]+):\s*(.*)$/);
    if(m && !(m[1].toLowerCase() in h)) h[m[1].toLowerCase()]=m[2];
  }
  const subject=decodeHeaderWord((h['subject']||'').replace(/\r?\n/g,''));
  const date=h['date']||'';
  let ct=h['content-type']||'';
  let cte=(h['content-transfer-encoding']||'').toLowerCase().trim();
  // handle multipart: find html part
  const bm=ct.match(/boundary="?([^";]+)"?/i);
  if(bm){
    const parts=body.split('--'+bm[1]);
    let best=null;
    for(const p of parts){
      let s2=p.indexOf('\r\n\r\n'); let sl2=4;
      if(s2<0){s2=p.indexOf('\n\n'); sl2=2;}
      if(s2<0) continue;
      const ph=p.slice(0,s2).replace(/\r?\n[ \t]+/g,' ');
      if(/text\/html/i.test(ph)){
        const e=(ph.match(/Content-Transfer-Encoding:\s*(\S+)/i)||[])[1]||'';
        best={body:p.slice(s2+sl2),cte:e.toLowerCase()};
      }
    }
    if(best){body=best.body;cte=best.cte;}
  }
  let html;
  if(cte==='base64') html=Buffer.from(body.replace(/\s/g,''),'base64').toString('utf8');
  else if(cte==='quoted-printable') html=Buffer.from(decodeQP(body),'latin1').toString('utf8');
  else html=Buffer.from(body,'latin1').toString('utf8');
  return {subject,date,html,file};
}
module.exports={parseEml};
if(require.main===module){
  const r=parseEml(process.argv[2]);
  console.log('SUBJECT:',r.subject);
  console.log('DATE:',r.date);
  console.log(r.html);
}
