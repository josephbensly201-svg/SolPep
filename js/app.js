/* Pwen antre: routè (hash), migrasyon, service worker. */
import { migrateLegacy, ensureGroupMeta } from './db.js';
import { showHome } from './views/home.js';
import { showGroup } from './views/group.js';
import { toast, esc } from './ui.js';
import { initCloud } from './cloud.js';
import { initSync } from './sync.js';
import { APP_VERSION } from './version.js';
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

/* ---------- Konfig a distans (anons, mizajou obligatwa, antretyen) ---------- */
const cmpVersion = (a, b) => {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
};

async function forceUpdate() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('jere-sol-')).map((k) => caches.delete(k)));
  } catch { /* pa grav */ }
  location.reload();
}

function showBlock(title, message, buttonLabel) {
  document.getElementById('block-root').innerHTML = `
    <div class="block-screen" role="alertdialog" aria-modal="true">
      <div class="block-card">
        <h2>${esc(title)}</h2>
        <p>${esc(message)}</p>
        ${buttonLabel ? `<button class="btn gold" data-block-action>${esc(buttonLabel)}</button>` : ''}
      </div>
    </div>`;
  const b = document.querySelector('[data-block-action]');
  if (b) b.onclick = forceUpdate;
}

function showBanner(a) {
  const root = document.getElementById('banner-root');
  if (!a || !a.active || !a.text) { root.innerHTML = ''; return; }
  const id = a.id || 'a';
  try { if (localStorage.getItem('sp_banner_closed') === id) { root.innerHTML = ''; return; } } catch { /* bloke */ }
  root.innerHTML = `<div class="banner ${a.level === 'warning' ? 'warning' : ''}" role="status">
    <span>${esc(a.text)}</span><button type="button" aria-label="Fèmen">✕</button></div>`;
  root.querySelector('button').onclick = () => {
    try { localStorage.setItem('sp_banner_closed', id); } catch { /* bloke */ }
    root.innerHTML = '';
  };
}

function applyConfig(cfg, { fresh }) {
  const block = document.getElementById('block-root');
  if (fresh) block.innerHTML = '';           // sèlman yon konfig fre ka bloke (pa kopi lokal la)
  if (!cfg) return;
  if (fresh && cfg.maintenance && cfg.maintenance.active) {
    return showBlock('Antretyen an kou', (cfg.maintenance.message || 'SòlPèp ap fè yon ti antretyen. Tounen talè.') + ' Done ou yo an sekirite sou telefòn ou.', null);
  }
  if (fresh && cfg.minVersion && cmpVersion(APP_VERSION, cfg.minVersion) < 0) {
    return showBlock('Mizajou obligatwa', 'Gen yon nouvo vèsyon SòlPèp. Peze bouton an pou mete l ajou. Done ou yo pa afekte.', 'Mizajou kounye a');
  }
  showBanner(cfg.announcement);
}

async function init() {
  try {
    const migrated = await migrateLegacy();
    if (migrated > 0) toast(`${migrated} sòl kopye soti nan ansyen vèsyon an.`);
  } catch (err) {
    console.error('Migrasyon echwe:', err);
  }
  try { await ensureGroupMeta(); } catch (err) { console.error('Kòd sòl yo pa ajoute:', err); }
  // Mande navigatè a pou pa efase done yo otomatikman.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  window.addEventListener('hashchange', route);
  await route();

  initCloud({
    onConfig: applyConfig,
    onForeground: (d) => toast([d.title, d.body].filter(Boolean).join(' — '))
  }).catch((err) => console.warn('Cloud endisponib:', err));

  // Sovgad kont: si kont lan konekte, senkronize an silans (epi rafrechi paj la si gen nouvo sòl).
  initSync().then((pulled) => { if (pulled) window.dispatchEvent(new HashChangeEvent('hashchange')); })
    .catch((err) => console.warn('Senkwonizasyon echwe:', err));

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('service-worker.js').catch((err) => console.warn('Service worker pa enstale:', err));
  }
}

init();
