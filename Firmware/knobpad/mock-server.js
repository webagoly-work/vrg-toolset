// Stand-in for the knob pad HTTP API: serves the real page from webpage.h so the UI can be tried
// without hardware. node Firmware/knobpad/mock-server.js  ->  http://localhost:8177
const http=require('http'),fs=require('fs');
const h=fs.readFileSync(require("path").join(__dirname,"webpage.h"),'utf8');
const page=h.slice(h.indexOf('R"rawliteral(')+13,h.lastIndexOf(')rawliteral"'));
const st={fw:'1.0.0',host:'vrg-knobs',ip:'192.168.1.50',enc:[{count:0,last:'-',rot:'vol',press:'mute'},{count:0,last:'-',rot:'scroll',press:'play'},{count:0,last:'-',rot:'f13_14',press:'f15'}]};
setInterval(()=>{const e=st.enc[0];e.count++;e.last='VOL+';},1000);
http.createServer((q,r)=>{const u=new URL(q.url,'http://x');
 if(u.pathname==='/'){r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return r.end(page);}
 if(u.pathname==='/state'){r.writeHead(200,{'Content-Type':'application/json'});return r.end(JSON.stringify(st));}
 if(u.pathname==='/set'){const i=+u.searchParams.get('enc')-1;for(const f of['rot','press'])if(u.searchParams.has(f))st.enc[i][f]=u.searchParams.get(f);console.log('SET',u.search);r.writeHead(200);return r.end(JSON.stringify(st));}
 r.writeHead(404);r.end();}).listen(8177,()=>console.log('mock on 8177'));
