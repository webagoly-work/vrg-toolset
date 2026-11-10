// webmail.js — unread counts for the webmail tabs (WP-26). No credentials here: the Founder signs in inside the pane (own partition).
//   unreadFromTitle(title) → n | null      Gmail "Inbox (3) - …" / "Beérkező levelek (3) - …", Outlook "(3) Mail - …"
//   watch(wc, acc, emit) → stop()           emits  mail.unread { acc, n }  when the title of the page changes and the count differs
'use strict';

const GMAIL = /^(?:Inbox|Beérkező levelek)\s+\((\d{1,6})\)\s+-\s/;
const OUTLOOK = /^\((\d{1,6})\)\s+\S/;

function unreadFromTitle(title) {
  if (typeof title !== 'string' || title.length > 1000) return null;
  const m = GMAIL.exec(title) || OUTLOOK.exec(title);
  return m ? Number(m[1]) : null;
}

function watch(wc, acc, emit) {
  let last = null;
  const on = () => {
    let title = '';
    try { title = wc.getTitle(); } catch (e) { return; }
    const n = unreadFromTitle(title);
    if (n === null || n === last) return;
    last = n;
    try { emit({ acc, n }); } catch (e) {}
  };
  wc.on('page-title-updated', on);
  return () => { try { wc.removeListener('page-title-updated', on); } catch (e) {} };
}

module.exports = { unreadFromTitle, watch };
