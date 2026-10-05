const {JSDOM}=require('jsdom');const fs=require('fs');
const SRC=process.env.PLANNER, OUT=process.env.OUT;
const dom=new JSDOM(fs.readFileSync(SRC,'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/'});
const w=dom.window;
setTimeout(()=>{
 try{
  w.confirm=()=>true;w.alert=()=>{};
  const L='ground',WA=w.__getWalls()[L];
  WA.length=0;w.__data.devices.length=0;w.__data.paths.length=0;w.__data.openings.length=0;
  w.__data.floors.length=0;w.__data.objects.length=0;w.__data.wallNotes.length=0;
  WA.push({x0:0,y0:0,x1:8000,y1:300},{x0:0,y0:5700,x1:8000,y1:6000},
          {x0:0,y0:300,x1:300,y1:5700},{x0:7700,y0:300,x1:8000,y1:5700},
          {x0:3500,y0:300,x1:3600,y1:3500},{x0:3600,y0:3400,x1:7700,y1:3500},{x0:300,y0:3400,x1:3500,y1:3500});
  w.__data.openings.push({type:'door',level:L,x:1800,y:150,ang:0,variant:0,w:900,h:2100,dtype:'hinged'});
  w.__data.openings.push({type:'window',level:L,x:5500,y:150,ang:0,variant:0,w:1800,h:1500,sill:900});
  w.__data.floors.push({level:L,poly:[[300,300],[3500,300],[3500,3400],[300,3400]],name:'NAPPALI',mat:'laminált'});
  w.__data.floors.push({level:L,poly:[[3600,300],[7700,300],[7700,3400],[3600,3400]],name:'KONYHA',mat:'hidegburkolat'});
  w.__data.floors.push({level:L,poly:[[300,3500],[7700,3500],[7700,5700],[300,5700]],name:'HÁLÓ',mat:'laminált'});
  const st=w.__state;st.style=process.env.STYLE||'plan';st.pitch=90;st.rot=0;st.active=L;
  st.levels={basement:false,ground:true,upper:false};
  st.zoom=1;st.panX=0;st.panY=0;w.draw();
  // frame the drawing: model 0..8000 x 0..6000 mm at SC=0.045 -> 360 x 270 base units
  const z=Math.min((1000-90)/360,(720-90)/270), cx=180, cy=135;
  st.zoom=z;st.panX=1000/2-cx*z;st.panY=720/2-cy*z;w.setTransform();w.draw();
  const svg=w.document.getElementById('stage');
  svg.setAttribute('style','background:#fbfaf7');
  fs.writeFileSync(OUT,'<?xml version="1.0" encoding="UTF-8"?>\n'+svg.outerHTML);
  console.log('wrote '+OUT+'  ('+svg.outerHTML.length+' chars)');
 }catch(e){console.log('ERR '+e.stack.split('\n').slice(0,3).join(' | '));}
 process.exit(0);
},900);
