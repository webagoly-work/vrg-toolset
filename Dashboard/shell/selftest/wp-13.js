// WP-13 probe (real Electron): the vendored markdown-it bundle and DOMPurify load from the URLs main gives, and a Markdown
// text renders to sanitized HTML (DESK-Q36): a heading appears, raw HTML and script never do.
'use strict';
module.exports = async function probe({ win }) {
  const errors = [];
  const { frame } = win.desk;
  const fjs = code => frame.webContents.executeJavaScript(code);
  try {
    const libs = await fjs(`window.vrg.app.info().then(i => i && i.libs || {})`);
    if (!libs.markdownIt) errors.push('libs.markdownIt is null (bundle missing?)');
    if (!libs.dompurify) errors.push('libs.dompurify is null');
    if (!errors.length) {
      const html = await fjs(`(async () => {
        const load = src => new Promise(res => { const s = document.createElement('script'); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.head.append(s); });
        if (!window.markdownit && !(await load(${JSON.stringify(libs.markdownIt)}))) return 'load-failed: markdown-it';
        if (!window.DOMPurify && !(await load(${JSON.stringify(libs.dompurify)}))) return 'load-failed: dompurify';
        const md = window.markdownit({ html: false, linkify: false });
        return window.DOMPurify.sanitize(md.render('# Cím ő\\n\\n- egy\\n\\n<script>window.__x=1</script><img src=x onerror=alert(1)>'));
      })()`);
      if (/^load-failed/.test(html)) errors.push(html);
      else {
        if (!/<h1>Cím ő<\/h1>/.test(html)) errors.push('no heading: ' + html.slice(0, 200));
        if (!/<li>egy<\/li>/.test(html)) errors.push('no list item');
        if (/<script|<img/i.test(html)) errors.push('raw HTML came through: ' + html.slice(0, 200));   // escaped (&lt;script) is fine
        if (!/&lt;script&gt;/.test(html)) errors.push('raw HTML not shown as text');
        if (await fjs(`window.__x === 1`)) errors.push('script ran');
      }
    }
  } catch (e) { errors.push('probe error: ' + e.message); }
  return { ok: !errors.length, errors };
};
