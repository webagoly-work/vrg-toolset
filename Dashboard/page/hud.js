// hud.js — the answer window's page (WP-56): shows the Parancs-héj's short answer; plain text only.
(function () {
  'use strict';
  const box = document.getElementById('hud'), say = document.getElementById('say'), detail = document.getElementById('detail');
  const LISTEN = 'Hallgatlak…';
  if (window.hud && window.hud.on) window.hud.on(m => {
    box.dataset.state = m && m.state || 'result';
    say.textContent = (m && m.say) || (m && m.state === 'listen' ? LISTEN : '');
    detail.textContent = (m && m.detail) || '';
    detail.hidden = !detail.textContent;
  });
})();
