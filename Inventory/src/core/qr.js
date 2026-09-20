// Offline QR encoding.
//
// The encoder below is the SAME engine the Planner uses (src/05f-qr.js), which
// its own documentation says is meant to be copied into the next project
// unchanged. Same function names, same result shape, so anything learned about
// QR in one tool transfers to the other — and a bug fixed in one is a known
// patch for the other rather than a rediscovery.
//
// LIMITS, restated because they decide the design:
//   * ~2953 bytes at ECC L, 2331 M, 1663 Q, 1273 H — byte mode.
//   * A phone's own camera app reads ONE code and shows its text. It cannot
//     reassemble a numbered sequence, and it will not open a data: URL. So a
//     payload either fits in one code, or it travels as a file.
//   * shape-rendering=crispEdges is deliberate: without it the browser
//     antialiases module edges and phone cameras fail on small renders.

const QRGEN=(function(){
// ======= https://github.com/nayuki/QR-Code-generator, Copyright © 2024 Project Nayuki. (MIT License) =======
// Minified version of https://github.com/nayuki/QR-Code-generator/releases/download/v1.8.0/qrcodegen-v1.8.0-es6.js using https://closure-compiler.appspot.com/
'use strict';var qrcodegen;
(function(q){function m(b,a,c){if(0>a||31<a||0!=b>>>a)throw new RangeError("Value out of range");for(--a;0<=a;a--)c.push(b>>>a&1)}function h(b){if(!b)throw Error("Assertion error");}class e{constructor(b,a,c,d){this.version=b;this.errorCorrectionLevel=a;this.modules=[];this.isFunction=[];if(b<e.MIN_VERSION||b>e.MAX_VERSION)throw new RangeError("Version value out of range");if(-1>d||7<d)throw new RangeError("Mask value out of range");this.size=4*b+17;b=[];for(a=0;a<this.size;a++)b.push(!1);for(a=0;a<
this.size;a++)this.modules.push(b.slice()),this.isFunction.push(b.slice());this.drawFunctionPatterns();c=this.addEccAndInterleave(c);this.drawCodewords(c);if(-1==d)for(c=1E9,b=0;8>b;b++)this.applyMask(b),this.drawFormatBits(b),a=this.getPenaltyScore(),a<c&&(d=b,c=a),this.applyMask(b);h(0<=d&&7>=d);this.mask=d;this.applyMask(d);this.drawFormatBits(d);this.isFunction=[]}static encodeText(b,a){b=q.QrSegment.makeSegments(b);return e.encodeSegments(b,a)}static encodeBinary(b,a){b=q.QrSegment.makeBytes(b);
return e.encodeSegments([b],a)}static encodeSegments(b,a,c=1,d=40,g=-1,f=!0){if(!(e.MIN_VERSION<=c&&c<=d&&d<=e.MAX_VERSION)||-1>g||7<g)throw new RangeError("Invalid value");for(;;c++){const p=8*e.getNumDataCodewords(c,a),n=k.getTotalBits(b,c);if(n<=p){d=n;break}if(c>=d)throw new RangeError("Data too long");}for(const p of[e.Ecc.MEDIUM,e.Ecc.QUARTILE,e.Ecc.HIGH])f&&d<=8*e.getNumDataCodewords(c,p)&&(a=p);f=[];for(var l of b){m(l.mode.modeBits,4,f);m(l.numChars,l.mode.numCharCountBits(c),f);for(const p of l.getData())f.push(p)}h(f.length==
d);b=8*e.getNumDataCodewords(c,a);h(f.length<=b);m(0,Math.min(4,b-f.length),f);m(0,(8-f.length%8)%8,f);h(0==f.length%8);for(l=236;f.length<b;l^=253)m(l,8,f);let r=[];for(;8*r.length<f.length;)r.push(0);f.forEach((p,n)=>r[n>>>3]|=p<<7-(n&7));return new e(c,a,r,g)}getModule(b,a){return 0<=b&&b<this.size&&0<=a&&a<this.size&&this.modules[a][b]}drawFunctionPatterns(){for(var b=0;b<this.size;b++)this.setFunctionModule(6,b,0==b%2),this.setFunctionModule(b,6,0==b%2);this.drawFinderPattern(3,3);this.drawFinderPattern(this.size-
4,3);this.drawFinderPattern(3,this.size-4);b=this.getAlignmentPatternPositions();const a=b.length;for(let c=0;c<a;c++)for(let d=0;d<a;d++)0==c&&0==d||0==c&&d==a-1||c==a-1&&0==d||this.drawAlignmentPattern(b[c],b[d]);this.drawFormatBits(0);this.drawVersion()}drawFormatBits(b){var a=b|=this.errorCorrectionLevel.formatBits<<3;for(let c=0;10>c;c++)a=a<<1^1335*(a>>>9);b=(b<<10|a)^21522;h(0==b>>>15);for(a=0;5>=a;a++)this.setFunctionModule(8,a,0!=(b>>>a&1));this.setFunctionModule(8,7,0!=(b>>>6&1));this.setFunctionModule(8,
8,0!=(b>>>7&1));this.setFunctionModule(7,8,0!=(b>>>8&1));for(a=9;15>a;a++)this.setFunctionModule(14-a,8,0!=(b>>>a&1));for(a=0;8>a;a++)this.setFunctionModule(this.size-1-a,8,0!=(b>>>a&1));for(a=8;15>a;a++)this.setFunctionModule(8,this.size-15+a,0!=(b>>>a&1));this.setFunctionModule(8,this.size-8,!0)}drawVersion(){if(!(7>this.version)){var b=this.version;for(var a=0;12>a;a++)b=b<<1^7973*(b>>>11);b|=this.version<<12;h(0==b>>>18);for(a=0;18>a;a++){const c=0!=(b>>>a&1),d=this.size-11+a%3,g=Math.floor(a/
3);this.setFunctionModule(d,g,c);this.setFunctionModule(g,d,c)}}}drawFinderPattern(b,a){for(let c=-4;4>=c;c++)for(let d=-4;4>=d;d++){const g=Math.max(Math.abs(d),Math.abs(c)),f=b+d,l=a+c;0<=f&&f<this.size&&0<=l&&l<this.size&&this.setFunctionModule(f,l,2!=g&&4!=g)}}drawAlignmentPattern(b,a){for(let c=-2;2>=c;c++)for(let d=-2;2>=d;d++)this.setFunctionModule(b+d,a+c,1!=Math.max(Math.abs(d),Math.abs(c)))}setFunctionModule(b,a,c){this.modules[a][b]=c;this.isFunction[a][b]=!0}addEccAndInterleave(b){var a=
this.version,c=this.errorCorrectionLevel;if(b.length!=e.getNumDataCodewords(a,c))throw new RangeError("Invalid argument");const d=e.NUM_ERROR_CORRECTION_BLOCKS[c.ordinal][a],g=e.ECC_CODEWORDS_PER_BLOCK[c.ordinal][a];a=Math.floor(e.getNumRawDataModules(a)/8);const f=d-a%d,l=Math.floor(a/d);c=[];const r=e.reedSolomonComputeDivisor(g);for(let n=0,u=0;n<d;n++){let t=b.slice(u,u+l-g+(n<f?0:1));u+=t.length;const v=e.reedSolomonComputeRemainder(t,r);n<f&&t.push(0);c.push(t.concat(v))}let p=[];for(let n=
0;n<c[0].length;n++)c.forEach((u,t)=>{(n!=l-g||t>=f)&&p.push(u[n])});h(p.length==a);return p}drawCodewords(b){if(b.length!=Math.floor(e.getNumRawDataModules(this.version)/8))throw new RangeError("Invalid argument");let a=0;for(let c=this.size-1;1<=c;c-=2){6==c&&(c=5);for(let d=0;d<this.size;d++)for(let g=0;2>g;g++){const f=c-g,l=0==(c+1&2)?this.size-1-d:d;!this.isFunction[l][f]&&a<8*b.length&&(this.modules[l][f]=0!=(b[a>>>3]>>>7-(a&7)&1),a++)}}h(a==8*b.length)}applyMask(b){if(0>b||7<b)throw new RangeError("Mask value out of range");
for(let a=0;a<this.size;a++)for(let c=0;c<this.size;c++){let d;switch(b){case 0:d=0==(c+a)%2;break;case 1:d=0==a%2;break;case 2:d=0==c%3;break;case 3:d=0==(c+a)%3;break;case 4:d=0==(Math.floor(c/3)+Math.floor(a/2))%2;break;case 5:d=0==c*a%2+c*a%3;break;case 6:d=0==(c*a%2+c*a%3)%2;break;case 7:d=0==((c+a)%2+c*a%3)%2;break;default:throw Error("Unreachable");}!this.isFunction[a][c]&&d&&(this.modules[a][c]=!this.modules[a][c])}}getPenaltyScore(){let b=0;for(var a=0;a<this.size;a++){var c=!1,d=0,g=[0,
0,0,0,0,0,0];for(var f=0;f<this.size;f++)this.modules[a][f]==c?(d++,5==d?b+=e.PENALTY_N1:5<d&&b++):(this.finderPenaltyAddHistory(d,g),c||(b+=this.finderPenaltyCountPatterns(g)*e.PENALTY_N3),c=this.modules[a][f],d=1);b+=this.finderPenaltyTerminateAndCount(c,d,g)*e.PENALTY_N3}for(a=0;a<this.size;a++){c=!1;d=0;g=[0,0,0,0,0,0,0];for(f=0;f<this.size;f++)this.modules[f][a]==c?(d++,5==d?b+=e.PENALTY_N1:5<d&&b++):(this.finderPenaltyAddHistory(d,g),c||(b+=this.finderPenaltyCountPatterns(g)*e.PENALTY_N3),c=
this.modules[f][a],d=1);b+=this.finderPenaltyTerminateAndCount(c,d,g)*e.PENALTY_N3}for(a=0;a<this.size-1;a++)for(c=0;c<this.size-1;c++)d=this.modules[a][c],d==this.modules[a][c+1]&&d==this.modules[a+1][c]&&d==this.modules[a+1][c+1]&&(b+=e.PENALTY_N2);a=0;for(var l of this.modules)a=l.reduce((r,p)=>r+(p?1:0),a);l=this.size*this.size;l=Math.ceil(Math.abs(20*a-10*l)/l)-1;h(0<=l&&9>=l);b+=l*e.PENALTY_N4;h(0<=b&&2568888>=b);return b}getAlignmentPatternPositions(){if(1==this.version)return[];const b=Math.floor(this.version/
7)+2,a=32==this.version?26:2*Math.ceil((4*this.version+4)/(2*b-2));let c=[6];for(let d=this.size-7;c.length<b;d-=a)c.splice(1,0,d);return c}static getNumRawDataModules(b){if(b<e.MIN_VERSION||b>e.MAX_VERSION)throw new RangeError("Version number out of range");let a=(16*b+128)*b+64;if(2<=b){const c=Math.floor(b/7)+2;a-=(25*c-10)*c-55;7<=b&&(a-=36)}h(208<=a&&29648>=a);return a}static getNumDataCodewords(b,a){return Math.floor(e.getNumRawDataModules(b)/8)-e.ECC_CODEWORDS_PER_BLOCK[a.ordinal][b]*e.NUM_ERROR_CORRECTION_BLOCKS[a.ordinal][b]}static reedSolomonComputeDivisor(b){if(1>
b||255<b)throw new RangeError("Degree out of range");let a=[];for(var c=0;c<b-1;c++)a.push(0);a.push(1);c=1;for(let d=0;d<b;d++){for(let g=0;g<a.length;g++)a[g]=e.reedSolomonMultiply(a[g],c),g+1<a.length&&(a[g]^=a[g+1]);c=e.reedSolomonMultiply(c,2)}return a}static reedSolomonComputeRemainder(b,a){let c=a.map(d=>0);for(const d of b){const g=d^c.shift();c.push(0);a.forEach((f,l)=>c[l]^=e.reedSolomonMultiply(f,g))}return c}static reedSolomonMultiply(b,a){if(0!=b>>>8||0!=a>>>8)throw new RangeError("Byte out of range");
let c=0;for(let d=7;0<=d;d--)c=c<<1^285*(c>>>7),c^=(a>>>d&1)*b;h(0==c>>>8);return c}finderPenaltyCountPatterns(b){const a=b[1];h(a<=3*this.size);const c=0<a&&b[2]==a&&b[3]==3*a&&b[4]==a&&b[5]==a;return(c&&b[0]>=4*a&&b[6]>=a?1:0)+(c&&b[6]>=4*a&&b[0]>=a?1:0)}finderPenaltyTerminateAndCount(b,a,c){b&&(this.finderPenaltyAddHistory(a,c),a=0);a+=this.size;this.finderPenaltyAddHistory(a,c);return this.finderPenaltyCountPatterns(c)}finderPenaltyAddHistory(b,a){0==a[0]&&(b+=this.size);a.pop();a.unshift(b)}}
e.MIN_VERSION=1;e.MAX_VERSION=40;e.PENALTY_N1=3;e.PENALTY_N2=3;e.PENALTY_N3=40;e.PENALTY_N4=10;e.ECC_CODEWORDS_PER_BLOCK=[[-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],[-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],[-1,17,
28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]];e.NUM_ERROR_CORRECTION_BLOCKS=[[-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],[-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],[-1,1,1,2,4,4,4,5,6,8,8,
11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]];q.QrCode=e;class k{constructor(b,a,c){this.mode=b;this.numChars=a;this.bitData=c;if(0>a)throw new RangeError("Invalid argument");this.bitData=c.slice()}static makeBytes(b){let a=[];for(const c of b)m(c,8,a);return new k(k.Mode.BYTE,b.length,a)}static makeNumeric(b){if(!k.isNumeric(b))throw new RangeError("String contains non-numeric characters");let a=[];for(let c=0;c<b.length;){const d=Math.min(b.length-c,
3);m(parseInt(b.substr(c,d),10),3*d+1,a);c+=d}return new k(k.Mode.NUMERIC,b.length,a)}static makeAlphanumeric(b){if(!k.isAlphanumeric(b))throw new RangeError("String contains unencodable characters in alphanumeric mode");let a=[],c;for(c=0;c+2<=b.length;c+=2){let d=45*k.ALPHANUMERIC_CHARSET.indexOf(b.charAt(c));d+=k.ALPHANUMERIC_CHARSET.indexOf(b.charAt(c+1));m(d,11,a)}c<b.length&&m(k.ALPHANUMERIC_CHARSET.indexOf(b.charAt(c)),6,a);return new k(k.Mode.ALPHANUMERIC,b.length,a)}static makeSegments(b){return""==
b?[]:k.isNumeric(b)?[k.makeNumeric(b)]:k.isAlphanumeric(b)?[k.makeAlphanumeric(b)]:[k.makeBytes(k.toUtf8ByteArray(b))]}static makeEci(b){let a=[];if(0>b)throw new RangeError("ECI assignment value out of range");if(128>b)m(b,8,a);else if(16384>b)m(2,2,a),m(b,14,a);else if(1E6>b)m(6,3,a),m(b,21,a);else throw new RangeError("ECI assignment value out of range");return new k(k.Mode.ECI,0,a)}static isNumeric(b){return k.NUMERIC_REGEX.test(b)}static isAlphanumeric(b){return k.ALPHANUMERIC_REGEX.test(b)}getData(){return this.bitData.slice()}static getTotalBits(b,
a){let c=0;for(const d of b){b=d.mode.numCharCountBits(a);if(d.numChars>=1<<b)return Infinity;c+=4+b+d.bitData.length}return c}static toUtf8ByteArray(b){b=encodeURI(b);let a=[];for(let c=0;c<b.length;c++)"%"!=b.charAt(c)?a.push(b.charCodeAt(c)):(a.push(parseInt(b.substr(c+1,2),16)),c+=2);return a}}k.NUMERIC_REGEX=/^[0-9]*$/;k.ALPHANUMERIC_REGEX=/^[A-Z0-9 $%*+.\/:-]*$/;k.ALPHANUMERIC_CHARSET="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";q.QrSegment=k})(qrcodegen||={});
(function(q){(function(m){class h{constructor(e,k){this.ordinal=e;this.formatBits=k}}h.LOW=new h(0,1);h.MEDIUM=new h(1,0);h.QUARTILE=new h(2,3);h.HIGH=new h(3,2);m.Ecc=h})(q.QrCode||(q.QrCode={}))})(qrcodegen||={});
(function(q){(function(m){class h{constructor(e,k){this.modeBits=e;this.numBitsCharCount=k}numCharCountBits(e){return this.numBitsCharCount[Math.floor((e+7)/17)]}}h.NUMERIC=new h(1,[10,12,14]);h.ALPHANUMERIC=new h(2,[9,11,13]);h.BYTE=new h(4,[8,16,16]);h.KANJI=new h(8,[8,10,12]);h.ECI=new h(7,[0,0,0]);m.Mode=h})(q.QrSegment||(q.QrSegment={}))})(qrcodegen||={});
return qrcodegen;})();

const QRECC = { L: 'LOW', M: 'MEDIUM', Q: 'QUARTILE', H: 'HIGH' };
const QRCAP = { L: 2953, M: 2331, Q: 1663, H: 1273 };

/** UTF-8 byte length without TextEncoder, so this runs anywhere. */
function qrBytes(s) {
  s = String(s == null ? '' : s);
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i);
    if (c < 0x80) n += 1; else if (c < 0x800) n += 2;
    else if (c < 0x10000) n += 3; else { n += 4; i++; }
  }
  return n;
}

/** The one encode entry point. Returns a result object, never throws. */
function qrEncode(text, o) {
  o = o || {};
  const ecc = QRECC[o.ecc] ? o.ecc : 'L';
  const border = (o.border == null ? 2 : o.border);
  const dark = o.dark || '#000', light = o.light || '#fff';
  const s = String(text == null ? '' : text);
  const bytes = qrBytes(s);
  if (!s) return { ok: false, bytes: 0, ecc, err: 'Nincs mit kódolni.' };
  let qr;
  try {
    qr = QRGEN.QrCode.encodeText(s, QRGEN.QrCode.Ecc[QRECC[ecc]]);
  } catch (e) {
    return {
      ok: false, bytes, ecc,
      err: 'Túl hosszú — kb. ' + Math.max(1, bytes - QRCAP[ecc]) + ' bájttal több a férőképességnél.'
    };
  }
  const n = qr.size, w = n + border * 2, d = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.getModule(x, y)) d.push('M' + (x + border) + ',' + (y + border) + 'h1v1h-1z');
    }
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + w + '" '
    + 'shape-rendering="crispEdges" stroke="none">'
    + '<rect width="100%" height="100%" fill="' + light + '"/>'
    + '<path d="' + d.join(' ') + '" fill="' + dark + '"/></svg>';
  return { ok: true, n, w, border, version: qr.version, ecc, bytes, svg, get: (x, y) => qr.getModule(x, y) };
}

function qrSvg(text, o) { const r = qrEncode(text, o); return r.ok ? r.svg : null; }

/** Raster straight from the module matrix — no SVG→Image round trip, no tainting. */
function qrPng(text, o, scale) {
  const r = qrEncode(text, o);
  if (!r.ok) return null;
  const s = Math.max(1, scale || 8), w = r.w * s;
  const cv = document.createElement('canvas');
  cv.width = cv.height = w;
  const g = cv.getContext('2d');
  g.fillStyle = (o && o.light) || '#fff';
  g.fillRect(0, 0, w, w);
  g.fillStyle = (o && o.dark) || '#000';
  for (let y = 0; y < r.n; y++) {
    for (let x = 0; x < r.n; x++) {
      if (r.get(x, y)) g.fillRect((x + r.border) * s, (y + r.border) * s, s, s);
    }
  }
  return cv.toDataURL('image/png');
}

export { qrEncode, qrSvg, qrPng, qrBytes, QRCAP, QRECC };
