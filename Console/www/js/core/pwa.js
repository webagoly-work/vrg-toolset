/* Offline install for the browser. The APK carries its files, so it needs no service worker, and one would
   keep serving the old files after an app update. */
import { t } from './i18n.js';
import { toast } from '../ui/feedback.js';

const STAY = 600000;

function offerUpdate(worker) {
  toast(t('pwa.update'), { ms: STAY, action: { label: t('pwa.reload'), run: () => worker.postMessage('update') } });
}

export async function startPwa() {
  if (globalThis.Capacitor?.isNativePlatform?.() || !navigator.serviceWorker) return;
  navigator.storage?.persist?.().catch(() => {});
  const firstRun = !navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (firstRun || reloading) return;
    reloading = true;
    location.reload();
  });
  const reg = await navigator.serviceWorker.register('sw.js').catch(() => null);
  if (!reg) return;
  if (reg.waiting) offerUpdate(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    next.addEventListener('statechange', () => {
      if (next.state !== 'installed') return;
      if (navigator.serviceWorker.controller) offerUpdate(next);
      else toast(t('pwa.ready'));
    });
  });
}
