// 13-card.js — "Kép": a 1200 × 630 PNG share card of the current view (city, brackets, board, HUD).
// The WebGL canvas keeps no drawing buffer, so the frame is rendered and copied in the same task.

function makeCard() {
  const W = 1200, H = 630, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  renderer.render(scene, camera);
  drawBrackets();
  g.fillStyle = '#0a141c'; g.fillRect(0, 0, W, H);
  // the sky is CSS, so paint a matching gradient under the transparent city
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#061018'); sky.addColorStop(0.55, getComputedStyle($('stage')).getPropertyValue('--horizon').trim() || '#11202b'); sky.addColorStop(1, '#050c12');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  seaCardDraw(g, W, H);   // 38-sea: the Mélyvíz water under the city, as on screen
  const src = canvas, k = Math.max(W / src.width, H / src.height), sw = W / k, sh = H / k;
  const sx = (src.width - sw) / 2, sy = (src.height - sh) / 2;
  g.drawImage(src, sx, sy, sw, sh, 0, 0, W, H);
  g.drawImage(brk, sx * brk.width / src.width, sy * brk.height / src.height, sw * brk.width / src.width, sh * brk.height / src.height, 0, 0, W, H);
  // top band: brand + repo; bottom band: board text + HUD + look
  const band = (y, h) => { const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(y ? 0 : 1, 'rgba(6,16,24,0)'); gr.addColorStop(y ? 1 : 0, 'rgba(6,16,24,.92)'); g.fillStyle = gr; g.fillRect(0, y, W, h); };
  band(0, 110); band(H - 130, 130);
  g.font = 'bold 22px ui-monospace, Consolas, monospace'; g.fillStyle = '#93d3e6'; g.fillText('KÓDVÁROS', 32, 46);
  g.font = '20px ui-monospace, Consolas, monospace'; g.fillStyle = '#e8f0f6';
  g.fillText($('title').textContent.slice(0, 80), 32, 78);
  g.fillStyle = '#93d3e6'; g.font = 'bold 20px ui-monospace, Consolas, monospace';
  g.fillText(($('board-1').dataset.text || '').slice(0, 70), 32, H - 76);
  g.fillStyle = '#e8f0f6'; g.font = '18px ui-monospace, Consolas, monospace';
  g.fillText(($('board-2').dataset.text || '').slice(0, 90), 32, H - 50);
  g.fillStyle = '#a6afb7'; g.font = '15px ui-monospace, Consolas, monospace';
  g.fillText(`${lens.name} nézet · ${$('hud').textContent}`.slice(0, 120), 32, H - 22);
  if (query.text) { g.textAlign = 'right'; g.fillStyle = '#93d3e6'; g.fillText(`„${query.text}”`.slice(0, 60), W - 32, 46); g.textAlign = 'left'; }
  return cv;
}
function shareCard() { makeCard().toBlob(b => downloadFile(`${current.city.repo.name}-kodvaros.png`, b), 'image/png'); }
$('card-btn').onclick = shareCard;
