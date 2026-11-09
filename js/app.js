/* Pwen antre: auth gate + routè + service worker. */
import { migrateLegacy } from './db.js';
import { showHome } from './views/home.js';
import { showGroup } from './views/group.js';
import { toast } from './ui.js';
import { waitForUser, onAuthStateChanged } from './firebase.js';
import { showLogin } from './auth-ui.js';
import './install.js';

const app = document.getElementById('app');
let booted = false;

async function route() {
  const match = (location.hash || '#/').match(/^#\/g\/([^/?]+)/);
  try {
    if (match) await showGroup(app, decodeURIComponent(match[1]));
    else await showHome(app);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="wrap"><div class="empty"><h2>Gen yon pwoblèm</h2>
      <p>Pa ka louvri done yo. Tcheke koneksyon an epi eseye ankò.</p>
      <button class="btn primary" onclick="location.reload()">Eseye ankò</button></div></div>`;
  }
}

async function init() {
  const user = await waitForUser();

  if (!user) {
    showLogin(app);
    onAuthStateChanged(async (u) => {
      if (u && !booted) await boot();
    });
    return;
  }
  await boot();
}

async function boot() {
  if (booted) return;
  booted = true;

  try {
    const migrated = await migrateLegacy();
    if (migrated > 0) toast(`${migrated} sòl kopye soti nan ansyen vèsyon an.`);
  } catch (err) {
    console.error('Migrasyon echwe:', err);
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  window.addEventListener('hashchange', route);
  await route();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('service-worker.js').catch((err) => console.warn('SW pa enstale:', err));
  }
}

init();
