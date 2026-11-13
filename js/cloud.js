/* Pon ak Firebase: estatistik anonim, rapèl push, konfig a distans.
 * Tout bagay isit la opsyonèl: si pa gen entènèt, aplikasyon an kontinye mache nòmalman.
 *
 * Sa k voye bay sèvè a (anonim, pa gen non moun, non sòl ni montan):
 *   idantifyan anonim aparèy la, vèsyon app la, plat-fòm, si app la enstale, dènye ouvèti,
 *   epi (si moun nan aktive rapèl) yon jeton notifikasyon ak dat manch yo ("2026-11-24|3").
 */
import { firebaseConfig, VAPID_KEY } from './firebase-config.js';
import { APP_VERSION } from './version.js';
import { getAllGroupsData } from './db.js';
import { dueDate, todayISO, addDaysISO } from './schedule.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
const KEY = { stats: 'sp_stats', ping: 'sp_ping', reg: 'sp_registered', notif: 'sp_notif', sig: 'sp_remsig', cfg: 'sp_config' };
const PING_EVERY_MS = 6 * 60 * 60 * 1000;

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bloke */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* bloke */ } }
};

/* ------------------------------------------------------------------ */
/* Chajman SDK Firebase (dinamik: pa chaje si pa bezwen)               */
/* ------------------------------------------------------------------ */
let sdkPromise = null;
export function sdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const [appM, authM, fsM] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js')
      ]);
      const app = appM.getApps().length ? appM.getApp() : appM.initializeApp(firebaseConfig);
      return { app, authM, fsM, auth: authM.getAuth(app), db: fsM.getFirestore(app) };
    })().catch((e) => { sdkPromise = null; throw e; });
  }
  return sdkPromise;
}

export async function ensureUser() {
  const { auth, authM } = await sdk();
  const existing = await new Promise((resolve) => {
    const off = authM.onAuthStateChanged(auth, (u) => { off(); resolve(u); });
  });
  if (existing) return existing;
  return (await authM.signInAnonymously(auth)).user;
}

const platform = () => {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
};
const isInstalled = () =>
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

async function baseFields() {
  const { fsM } = await sdk();
  const fields = { lastSeen: fsM.serverTimestamp(), version: APP_VERSION, platform: platform(), installed: isInstalled() };
  if (!store.get(KEY.reg)) fields.createdAt = fsM.serverTimestamp();
  return fields;
}

/* ------------------------------------------------------------------ */
/* Konfig a distans (lekti piblik, san SDK: yon sèl requèt HTTP)       */
/* ------------------------------------------------------------------ */
export function _fromFs(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(_fromFs);
  if ('mapValue' in v) {
    const out = {};
    const f = v.mapValue.fields || {};
    Object.keys(f).forEach((k) => { out[k] = _fromFs(f[k]); });
    return out;
  }
  return null;
}

/** {} si pa gen konfig, null si entènèt la pa disponib. */
export async function fetchConfig() {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/config/app?key=${firebaseConfig.apiKey}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 404) return {};
    if (!res.ok) return null;
    const doc = await res.json();
    return _fromFs({ mapValue: { fields: doc.fields || {} } });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const cachedConfig = () => { try { return JSON.parse(store.get(KEY.cfg)); } catch { return null; } };

/* ------------------------------------------------------------------ */
/* Estatistik anonim                                                   */
/* ------------------------------------------------------------------ */
export const statsEnabled = () => store.get(KEY.stats) !== 'off';

async function ping(force = false) {
  if (!statsEnabled() || !navigator.onLine) return;
  const last = Number(store.get(KEY.ping) || 0);
  if (!force && Date.now() - last < PING_EVERY_MS) return;
  const { fsM, db } = await sdk();
  const user = await ensureUser();
  await fsM.setDoc(fsM.doc(db, 'installs', user.uid), await baseFields(), { merge: true });
  store.set(KEY.reg, '1');
  store.set(KEY.ping, String(Date.now()));
}

export async function setStatsEnabled(on) {
  if (on) {
    store.set(KEY.stats, 'on');
    await ping(true).catch(() => {});
    return;
  }
  // Dezaktive: efase fich anonim nan sèvè a epi sispann voye. Rapèl yo sispann tou.
  try {
    const { fsM, db } = await sdk();
    const user = await ensureUser();
    await fsM.deleteDoc(fsM.doc(db, 'installs', user.uid));
  } catch { /* pa grav si pa gen entènèt */ }
  store.set(KEY.stats, 'off');
  store.set(KEY.notif, 'off');
  store.del(KEY.reg);
  store.del(KEY.ping);
  store.del(KEY.sig);
}

/* ------------------------------------------------------------------ */
/* Rapèl (notifikasyon push)                                           */
/* ------------------------------------------------------------------ */
export const notifSupport = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

/** 'unsupported' | 'denied' | 'on' | 'off' */
export function notifState() {
  if (!notifSupport()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return store.get(KEY.notif) === 'on' && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Dat manch k ap vini (45 jou), eksepte manch ki deja konplè. Fòma: "AAAA-MM-JJ|nimewo". */
async function buildReminders() {
  const all = await getAllGroupsData();
  const today = todayISO();
  const limit = addDaysISO(today, 45);
  const set = new Set();
  for (const { group, members, calc } of all) {
    for (let r = 0; r < members.length; r++) {
      const due = dueDate(group, r);
      if (!due || due < today || due > limit) continue;
      const round = calc.perRound[r];
      if (round.expected > 0 && round.got >= round.expected) continue;
      set.add(`${due}|${r + 1}`);
    }
  }
  return [...set].sort().slice(0, 120);
}

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Dwe rele nan yon klik itilizatè (pèmisyon an mande yon jès). */
export async function enableNotifications() {
  if (!notifSupport()) return { ok: false, reason: 'unsupported' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };
  try {
    const { app, fsM, db } = await sdk();
    const msgM = await import(SDK + 'firebase-messaging.js');
    if (!(await msgM.isSupported())) return { ok: false, reason: 'unsupported' };
    const registration = await withTimeout(navigator.serviceWorker.ready, 8000);
    const token = await msgM.getToken(msgM.getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return { ok: false, reason: 'error' };

    const user = await ensureUser();
    const reminders = await buildReminders();
    await fsM.setDoc(fsM.doc(db, 'installs', user.uid),
      { ...(await baseFields()), notif: true, token, reminders }, { merge: true });

    store.set(KEY.stats, 'on');
    store.set(KEY.notif, 'on');
    store.set(KEY.reg, '1');
    store.set(KEY.ping, String(Date.now()));
    store.set(KEY.sig, JSON.stringify(reminders));
    return { ok: true };
  } catch (e) {
    console.warn('Notifikasyon pa aktive:', e);
    return { ok: false, reason: 'error' };
  }
}

export async function disableNotifications() {
  try {
    const { fsM, db } = await sdk();
    const user = await ensureUser();
    await fsM.setDoc(fsM.doc(db, 'installs', user.uid),
      { lastSeen: fsM.serverTimestamp(), version: APP_VERSION, notif: false, token: fsM.deleteField(), reminders: [] }, { merge: true });
  } catch { /* pa grav */ }
  store.set(KEY.notif, 'off');
  store.del(KEY.sig);
}

/** Mete lis rapèl yo ajou nan sèvè a (sèlman si li chanje). */
let syncTimer = null;
const hooks = [];
/** Lòt modil (sovgad kont) ka enskri pou konnen lè done yo chanje. */
export const onDataChanged = (fn) => hooks.push(fn);

export function scheduleSync() {
  hooks.forEach((fn) => { try { fn(); } catch { /* pa grav */ } });
  if (notifState() !== 'on' || !statsEnabled()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      if (!navigator.onLine) return;
      const reminders = await buildReminders();
      const sig = JSON.stringify(reminders);
      if (sig === store.get(KEY.sig)) return;
      const { fsM, db } = await sdk();
      const user = await ensureUser();
      await fsM.setDoc(fsM.doc(db, 'installs', user.uid), { reminders }, { merge: true });
      store.set(KEY.sig, sig);
    } catch (e) { console.warn('Sinkwonizasyon rapèl echwe:', e); }
  }, 2500);
}

/* ------------------------------------------------------------------ */
/* Demaraj                                                             */
/* ------------------------------------------------------------------ */
export async function initCloud({ onConfig, onForeground } = {}) {
  // 1) Konfig a distans: sèvi ak kopi lokal dabò, epi rafrechi.
  const cached = cachedConfig();
  if (cached && onConfig) onConfig(cached, { fresh: false });
  fetchConfig().then((cfg) => {
    if (cfg === null) return;
    store.set(KEY.cfg, JSON.stringify(cfg));
    if (onConfig) onConfig(cfg, { fresh: true });
  });

  // 2) Mesaj push pandan app la louvri (SW a voye yo ban nou olye li montre yo).
  if ('serviceWorker' in navigator && onForeground) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'push') onForeground(e.data.data || {});
    });
  }

  // 3) Ping anonim + rapèl.
  ping().catch(() => {});
  scheduleSync();
}
export const _buildReminders = buildReminders;
