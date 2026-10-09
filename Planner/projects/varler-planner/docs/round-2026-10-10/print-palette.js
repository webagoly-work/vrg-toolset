// keep each colour's hue, set CIE L* to a target, reduce chroma until it fits sRGB
const lin=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
const gam=v=>{v=v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;return Math.round(v*255)};
const Xn=0.95047,Zn=1.08883,f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116,fi=t=>t**3>0.008856?t**3:(t-16/116)/7.787;
function toLab(h){const n=parseInt(h.slice(1),16),r=lin(n>>16&255),g=lin(n>>8&255),b=lin(n&255);
 const X=(0.4124*r+0.3576*g+0.1805*b)/Xn,Y=0.2126*r+0.7152*g+0.0722*b,Z=(0.0193*r+0.1192*g+0.9505*b)/Zn;
 return [116*f(Y)-16,500*(f(X)-f(Y)),200*(f(Y)-f(Z))];}
function fromLab(L,a,b){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200;const X=fi(fx)*Xn,Y=fi(fy),Z=fi(fz)*Zn;
 const r=3.2406*X-1.5372*Y-0.4986*Z,g=-0.9689*X+1.8758*Y+0.0415*Z,bb=0.0557*X-0.2040*Y+1.0570*Z;return [r,g,bb];}
function atL(h,L){const [,a,b]=toLab(h);let k=1;for(;k>0;k-=0.02){const c=fromLab(L,a*k,b*k);if(c.every(v=>v>=0&&v<=1))return '#'+c.map(v=>gam(v).toString(16).padStart(2,'0')).join('');}return null;}
const P=[ // role, screen colour, target L*, line pattern  — levels 30/45/60/75, patterns s/d/o/x
 ['sys:DED','#6d4c41',30,'s'],['sys:SOC','#c62828',45,'s'],['SWI','#f08c2e',60,'s'],['sys:LIGHT','#ef7b72',75,'s'],
 ['sys:CONTROL','#7a5cc0',30,'d'],['sys:BUSB','#b07a2a',45,'d'],['sys:DATA','#16a085',60,'d'],['sys:LV','#e6a800',75,'d'],
 ['sys:USB','#607d8b',30,'o'],['sys:HMI','#5470b0',45,'o'],['sys:SENSOR','#2f79c9',60,'o'],['sys:MEDIA','#c2638a',75,'o'],
 ['sys:SECURITY','#444444',30,'x'],['sys:KNX','#2e7d32',45,'x'],['arm','#2e9e5b',60,'x'],['sys:RF','#3fa7a7',75,'x'],
 ['hw','#4a5a68',30,'s'],['base','#1f6f8b',45,'s'],['channel','#8a7bbf',60,'s'],['mark','#c0530f',60,'x'],['construct','#7c7468',50,'s']];
P.forEach(([k,h,L,p])=>console.log(JSON.stringify(k)+":{c:'"+atL(h,L)+"',L:"+L+",p:'"+p+"'},   // screen "+h+" L*"+Math.round(toLab(h)[0])));
