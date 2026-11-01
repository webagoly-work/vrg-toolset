/* Calculator expressions, parsed by hand: no eval, so typed text can never run as code.
   Numbers (decimal comma or point), + - * / ^ %, brackets, and the functions below. */
const FUNCS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, log: Math.log10, ln: Math.log, abs: Math.abs };
const CONSTS = { pi: Math.PI, e: Math.E };

export function evaluate(source, { degrees = true } = {}) {
  const s = String(source).replace(/\s/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/,/g, '.');
  let i = 0;
  const peek = () => s[i];
  const eat = (c) => { if (s[i] === c) { i++; return true; } return false; };

  function primary() {
    if (eat('(')) {
      const v = sum();
      if (!eat(')')) throw new Error('bracket');
      return v;
    }
    const num = s.slice(i).match(/^\d+\.?\d*|^\.\d+/);
    if (num) { i += num[0].length; return Number(num[0]); }
    const word = s.slice(i).match(/^[a-z]+/i)?.[0].toLowerCase();
    if (!word) throw new Error('syntax');
    i += word.length;
    if (Object.hasOwn(CONSTS, word)) return CONSTS[word];
    if (!Object.hasOwn(FUNCS, word) || !eat('(')) throw new Error('name');
    let v = sum();
    if (!eat(')')) throw new Error('bracket');
    if (degrees && ['sin', 'cos', 'tan'].includes(word)) v = v * Math.PI / 180;
    return FUNCS[word](v);
  }
  function unary() {
    if (eat('-')) return -unary();
    if (eat('+')) return unary();
    return power();
  }
  function power() {
    let v = primary();
    if (eat('%')) v /= 100;
    return eat('^') ? v ** unary() : v;
  }
  function product() {
    let v = unary();
    for (;;) {
      if (eat('*')) v *= unary();
      else if (eat('/')) v /= unary();
      else if (peek() === '(' || /[a-z]/i.test(peek() ?? '')) v *= unary();
      else return v;
    }
  }
  function sum() {
    let v = product();
    for (;;) {
      if (eat('+')) v += product();
      else if (eat('-')) v -= product();
      else return v;
    }
  }

  const value = sum();
  if (i !== s.length) throw new Error('syntax');
  return value;
}
