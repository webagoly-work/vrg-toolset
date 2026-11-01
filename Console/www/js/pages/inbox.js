/* Photo inbox. Originals stay on the device. A copy that leaves it is redrawn on a canvas, which
   drops EXIF and GPS (L2). OCR is a later tier. */
import { t } from '../core/i18n.js';
import { formatNumber } from '../core/format.js';
import { h } from '../ui/dom.js';
import { recordSheet } from '../ui/form.js';
import { toast } from '../ui/feedback.js';
import { activeJob, deleteWithUndo, download, guide, jobBar, liveRender, pageWrap, panel } from './shared.js';

export const manifest = { id: 'inbox', category: 'field', permissions: ['camera', 'files'], offline: true, name: { hu: 'Fotó és OCR gyűjtő', en: 'Photo and OCR inbox' } };

export const strings = {
  hu: {
    'inbox.add': 'Fotó készítése vagy hozzáadása', 'inbox.photos': 'Fotók', 'inbox.none': 'Még nincs fotó. Táblagép, mérőóra vagy felirat fotója ide kerül.',
    'inbox.share': 'Megosztható másolat', 'inbox.shared': 'A másolat EXIF- és GPS-adatok nélkül készült', 'inbox.failed': 'A fotót nem sikerült feldolgozni, az eredeti megmaradt.',
    'inbox.privacy': 'Az eredeti fotó nem hagyja el az eszközt. A megosztható másolatból az EXIF- és GPS-adatok törlődnek.',
    'inbox.caption': 'Felirat', 'inbox.edit': 'Fotó adatai', 'inbox.count': '{n} fotó',
  },
  en: {
    'inbox.add': 'Take or add a photo', 'inbox.photos': 'Photos', 'inbox.none': 'No photos yet. Board, meter and label photos go here.',
    'inbox.share': 'Shareable copy', 'inbox.shared': 'The copy was made without EXIF and GPS data', 'inbox.failed': 'The photo could not be processed. The original is kept.',
    'inbox.privacy': 'The original photo stays on the device. EXIF and GPS data are removed from the shareable copy.',
    'inbox.caption': 'Caption', 'inbox.edit': 'Photo details', 'inbox.count': '{n} photos',
  },
};

/* Redrawing keeps the pixels and nothing else. */
export async function stripExif(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.9));
}

export function mount(root, ctx) {
  const urls = [];
  const view = liveRender(root, ctx, async () => {
    urls.splice(0).forEach(URL.revokeObjectURL);
    const job = await activeJob(ctx);
    if (!job) return pageWrap(jobBar(null, ctx));
    const photos = await ctx.db.list('photo', (r) => r.jobId === job.id);
    const picker = h('input', {
      type: 'file', accept: 'image/*', multiple: true, id: 'photoIn', hidden: true,
      onchange: async (e) => {
        for (const file of e.target.files) await ctx.db.put('photo', { jobId: job.id, blob: file, name: file.name, type: file.type });
        await view.refresh();
      },
    });
    const card = (p) => {
      const url = URL.createObjectURL(p.blob);
      urls.push(url);
      const edit = () => recordSheet({
        title: t('inbox.edit'), fields: [{ key: 'caption', label: t('inbox.caption') }], value: p,
        onSave: async (v) => { await ctx.db.put('photo', v); await view.refresh(); },
        onDelete: () => deleteWithUndo(ctx, 'photo', p, p.caption || p.name, view.refresh),
      });
      const share = async () => {
        try {
          download(`foto-${p.id}.jpg`, await stripExif(p.blob));
          toast(t('inbox.shared'));
        } catch {
          toast(t('inbox.failed'), { error: true, ms: 6000 });
        }
      };
      return h('figure.photo', {},
        h('button.lmain', { type: 'button', onclick: edit, 'aria-label': t('inbox.edit') }, h('img', { src: url, alt: p.caption || p.name })),
        h('figcaption', { text: p.caption || p.name }),
        h('button.btn', { type: 'button', text: t('inbox.share'), onclick: share }));
    };
    return pageWrap(jobBar(job, ctx), panel(t('inbox.photos'),
      picker,
      h('label.btn.primary.filebtn', { for: 'photoIn', text: t('inbox.add') }),
      photos.length ? h('p.hint', { text: t('inbox.count', { n: formatNumber(photos.length) }) }) : guide(t('inbox.none')),
      h('div.photos', {}, photos.map(card)),
      h('p.hint', { text: t('inbox.privacy') })));
  });
  return () => { urls.forEach(URL.revokeObjectURL); view.stop(); };
}
