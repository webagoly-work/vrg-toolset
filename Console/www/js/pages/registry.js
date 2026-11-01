/* Turns a page id into a mounted page. Home is always the empty canvas; a page with no module yet
   renders the stub. */
import { t } from '../core/i18n.js';
import { h } from '../ui/dom.js';
import { getManifest, MODULES, pageNameKey } from './catalog.js';

export const HOME = 'home';

export function pageName(id) {
  return id === HOME ? t('nav.home') : t(pageNameKey(id));
}

/* What each unbuilt page is waiting for */
const WAITING = {
  legal: 'stub.need.register', quote: 'stub.need.quote',
  smarthome: 'stub.need.ha', dev: 'stub.need.bridge', servicekit: 'stub.need.bridge', widgets: 'stub.need.lib',
};

function stub(root, manifest, ctx) {
  const perms = manifest.permissions.map((p) => t('perm.' + p));
  root.append(h('div.empty', {},
    h('h2', { text: pageName(manifest.id) }),
    h('p', { text: t('stub.title') }),
    h('p', { text: t(WAITING[manifest.id] ?? WAITING[manifest.category] ?? 'stub.body') }),
    h('dl.kv.panel', {},
      h('div', {}, h('dt', { text: t('stub.category') }), h('dd', { text: t('category.' + manifest.category) })),
      h('div', {}, h('dt', { text: t('stub.availability') }), h('dd', { text: t(manifest.offline ? 'chip.offline' : 'chip.online') })),
      h('div', {}, h('dt', { text: t('stub.perms') }), h('dd', { text: perms.length ? perms.join(', ') : t('stub.noPerms') }))),
    h('button.btn', { type: 'button', text: t('stub.openSettings'), onclick: () => ctx.openPageSettings(manifest.id) })));
}

export function mountPage(id, ctx) {
  const node = h('section.page', { 'aria-label': pageName(id) });
  if (id === HOME) {
    node.classList.add('home');
    return { id, node };
  }
  node.dataset.density = ctx.densityFor(id);
  const mod = MODULES[id];
  if (!mod) {
    stub(node, getManifest(id), ctx);
    return { id, node };
  }
  return { id, node, unmount: mod.mount(node, ctx) };
}
