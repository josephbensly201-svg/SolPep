/* Pwen antre: routè (hash), migrasyon, service worker. */
import { migrateLegacy } from './db.js';
import { showHome } from './views/home.js';
import { showGroup } from './views/group.js';
import { toast } from './ui.js';
import './install.js';

const app = document.getElementById('app');

async function route() {
  const match = (location.hash || '#/').match(/^#\/g\/([^/?]+)/);
  try {
    if (match) await showGroup(app, decodeURIComponent(match[1]));
    else await showHome(app);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="wrap"><div class="empty"><h2>Gen yon pwoblèm</h2>
      <p>Pa ka louvri done yo. Tcheke si navigatè a pa nan mòd prive, epi eseye ankò.</p>
      <button class="btn primary" onclick="location.reload()">Eseye ankò</button></div></div>`;
  }
}

async function init() {
  try {
    const migrated = await migrateLegacy();
    if (migrated > 0) toast(`${migrated} sòl kopye soti nan ansyen vèsyon an.`);
  } catch (err) {
    console.error('Migrasyon echwe:', err);
  }
  // Mande navigatè a pou pa efase done yo otomatikman.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  window.addEventListener('hashchange', route);
  await route();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('service-worker.js').catch((err) => console.warn('Service worker pa enstale:', err));
  }
}

init();
