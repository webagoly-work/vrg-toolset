/* The page catalogue: one manifest per template page.
   Manifest: id, name {hu, en}, category, permissions, offline.
   Built pages live in their own module; the rest render the stub until they are built.
   Display names are generic on purpose (landmines L4, L10): the supplier page does not carry the
   supplier's name, and no name comes from a film or series. */
import { addStrings } from '../core/i18n.js';
import * as jobPage from './job.js';
import * as measurePage from './measure.js';
import * as panelPage from './panelschedule.js';
import * as checklistPage from './checklist.js';
import * as inboxPage from './inbox.js';
import * as timePage from './time.js';
import * as cheatPage from './cheat.js';
import * as calcPage from './calculators.js';
import * as supplierPage from './supplier.js';
import * as materialsPage from './materials.js';
import * as agentkitPage from './agentkit.js';

import * as commandsPage from './commands.js';
import * as sugoPage from './sugo.js';
import * as playbooksPage from './playbooks.js';
import * as macrosPage from './macros.js';
import * as pcstatusPage from './pcstatus.js';
import * as tracePage from './tracemini.js';
import { strings as bridgeStrings } from './servicekit-shared.js';
import { clock as clockPage, timer as timerPage, notes as notesPage, todo as todoPage, scicalc as scicalcPage, units as unitsPage, dice as dicePage, radar as radarPage, statusring as statusringPage } from './widgets-simple.js';
import { sun as sunPage, agenda as agendaPage, level as levelPage, compass as compassPage, sound as soundPage, media as mediaPage } from './widgets-device.js';

/* Pages built so far. Each is self-contained: { manifest, strings, mount }. */
export const MODULES = { job: jobPage, measure: measurePage, panel: panelPage, checklist: checklistPage, inbox: inboxPage, time: timePage, cheat: cheatPage, calc: calcPage, supplier: supplierPage, materials: materialsPage, agentkit: agentkitPage, commands: commandsPage, sugo: sugoPage, playbooks: playbooksPage, macros: macrosPage, pcstatus: pcstatusPage, clock: clockPage, timer: timerPage, notes: notesPage, todo: todoPage, scicalc: scicalcPage, units: unitsPage, dice: dicePage, radar: radarPage, statusring: statusringPage, tracemini: tracePage, sun: sunPage, agenda: agendaPage, level: levelPage, compass: compassPage, sound: soundPage, media: mediaPage };

export const CATEGORIES = ['field', 'servicekit', 'smarthome', 'dev', 'widgets', 'thematic'];
export const PERMISSIONS = ['camera', 'microphone', 'sensors', 'location', 'files', 'clipboard', 'bridge', 'homeassistant', 'network'];

const page = (id, category, permissions, offline, huName, enName) =>
  ({ id, category, permissions, offline, name: { hu: huName, en: enName } });

export const CATALOG = [
  jobPage.manifest,
  measurePage.manifest,
  panelPage.manifest,
  checklistPage.manifest,
  inboxPage.manifest,
  timePage.manifest,
  cheatPage.manifest,
  calcPage.manifest,
  supplierPage.manifest,
  materialsPage.manifest,
  page('quote', 'field', ['files'], true, 'várlerÁron gyorsnézet', 'várlerÁron quick view'),
  page('legal', 'field', [], true, 'Jogi hivatkozások', 'Legal citation lookup'),

  commandsPage.manifest,
  sugoPage.manifest,
  playbooksPage.manifest,
  macrosPage.manifest,
  page('deploy', 'servicekit', ['bridge'], false, 'Kit telepítése', 'Kit deploy'),
  pcstatusPage.manifest,
  page('nettools', 'servicekit', ['bridge'], false, 'Hálózati eszközök', 'Network tools'),
  page('survey', 'servicekit', ['bridge'], false, 'Okosotthon-felmérés', 'Smart-home site survey'),

  page('energy', 'smarthome', ['homeassistant'], false, 'Energia fázisonként', 'Energy per phase'),
  page('presence', 'smarthome', ['homeassistant'], false, 'Jelenlét', 'Presence'),
  page('zigbee', 'smarthome', ['homeassistant'], false, 'Zigbee-eszközök', 'Zigbee devices'),
  page('automations', 'smarthome', ['homeassistant'], false, 'Automatizmusok', 'Automation toggles'),
  page('dog', 'smarthome', ['homeassistant'], false, 'Kutyakövető', 'Dog tracker'),

  page('worktrees', 'dev', ['bridge'], false, 'Worktree-ágfa', 'Worktree branch tree'),
  agentkitPage.manifest,
  tracePage.manifest,
  page('terminal', 'dev', ['bridge'], false, 'Terminálréteg', 'Terminal overlay'),
  page('citymap', 'dev', ['bridge'], false, 'Kódváros minitérkép', 'Kódváros mini-map'),
  page('ci', 'dev', ['network'], false, 'CI-állapot', 'CI status'),

  clockPage.manifest,
  timerPage.manifest,
  agendaPage.manifest,
  notesPage.manifest,
  todoPage.manifest,
  scicalcPage.manifest,
  unitsPage.manifest,
  mediaPage.manifest,
  page('convert', 'widgets', ['files'], true, 'Fájlátalakító', 'File converter'),
  page('qr', 'widgets', ['camera'], true, 'QR és vonalkód', 'QR and barcode'),
  page('docview', 'widgets', ['files'], true, 'Dokumentumnézegető', 'Document viewer'),
  levelPage.manifest,
  compassPage.manifest,
  soundPage.manifest,
  sunPage.manifest,

  radarPage.manifest,
  dicePage.manifest,
  statusringPage.manifest,
];

export const PAGE_IDS = CATALOG.map((p) => p.id);
export const getManifest = (id) => CATALOG.find((p) => p.id === id);
export const pageNameKey = (id) => 'page.' + id;

const strings = { hu: {}, en: {} };
for (const p of CATALOG) {
  strings.hu[pageNameKey(p.id)] = p.name.hu;
  strings.en[pageNameKey(p.id)] = p.name.en;
}
addStrings(strings);
addStrings(bridgeStrings);
Object.values(MODULES).forEach((m) => addStrings(m.strings));
