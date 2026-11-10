/* SòlPèp — tablo admin. Sèl moun ki gen UID admin an (ak modpas la) ka li oswa ekri. Règ Firestore yo fòse sa. */
import { firebaseConfig, ADMIN_UID } from './firebase-config.js';
import { esc, toast } from './ui.js';

const V = '10.14.1';
const BASE = `https://www.gstatic.com/firebasejs/${V}/`;
const root = document.getElementById('root');
let authM, fsM, auth, db;

const fmtDate = (ts) => (ts && ts.toDate ? ts.toDate().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

async function boot() {
  try {
    const [appM, a, f] = await Promise.all([
      import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')
    ]);
    authM = a; fsM = f;
    // Aplikasyon "admin" separe: sesyon an pa melanje ak sesyon anonim aplikasyon an.
    const app = appM.initializeApp(firebaseConfig, 'admin');
    auth = authM.getAuth(app);
    db = fsM.getFirestore(app);
  } catch (e) {
    root.innerHTML = `<p class="admin-loading">Pa ka chaje Firebase. Verifye entènèt la epi rechaje paj la.</p>`;
    return;
  }
  authM.onAuthStateChanged(auth, async (user) => {
    if (!user) return renderLogin();
    if (user.uid !== ADMIN_UID) {
      await authM.signOut(auth);
      return renderLogin('Kont sa a pa otorize.');
    }
    renderDashboard(user);
  });
}

/* ---------------- Koneksyon ---------------- */
function renderLogin(message = '') {
  root.innerHTML = `
    <form class="login-card stack" novalidate>
      <div><h1>SòlPèp · Admin</h1><p>Aksè rezève pou administratè a.</p></div>
      <label class="field"><span>Imèl</span><input name="email" type="email" autocomplete="username" required></label>
      <label class="field"><span>Modpas</span><input name="password" type="password" autocomplete="current-password" required></label>
      <p class="error" data-error ${message ? '' : 'hidden'}>${esc(message)}</p>
      <button class="btn primary" type="submit">Konekte</button>
    </form>`;
  const form = root.querySelector('form');
  const err = root.querySelector('[data-error]');
  form.onsubmit = async (e) => {
    e.preventDefault();
    err.hidden = true;
    try {
      await authM.signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.password.value);
    } catch (ex) {
      err.textContent = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(ex.code)
        ? 'Imèl oswa modpas la pa kòrèk.'
        : ex.code === 'auth/too-many-requests' ? 'Twòp esè. Tann yon ti moman epi eseye ankò.' : 'Koneksyon echwe. Verifye entènèt la.';
      err.hidden = false;
    }
  };
}

/* ---------------- Tablo bò ---------------- */
async function renderDashboard(user) {
  root.innerHTML = `
    <header class="admin-top"><div class="admin-wrap">
      <div><h1>SòlPèp · Admin</h1><small>${esc(user.email || '')}</small></div>
      <button class="btn" data-logout>Dekonekte</button>
    </div></header>
    <main class="admin-wrap">
      <h2>Estatistik</h2>
      <div class="stats-grid" data-stats><div class="stat"><span>Chajman…</span></div></div>
      <p class="note">Chif yo konte <b>aparèy</b>, pa moun (yon moun ki gen 2 telefòn konte pou 2). Yon aparèy ki efase done navigatè a ka konte de fwa.</p>
      <div data-tally></div>

      <h2>Kontwòl aplikasyon an</h2>
      <form class="panel-card" data-config novalidate></form>

      <h2>Notifikasyon pou tout moun</h2>
      <form class="panel-card" data-broadcast novalidate></form>
      <div class="table-scroll" data-broadcasts></div>

      <h2>Dènye aparèy yo</h2>
      <div class="table-scroll" data-installs></div>
    </main>`;
  root.querySelector('[data-logout]').onclick = () => authM.signOut(auth);

  loadStats();
  loadConfig();
  loadBroadcasts();
}

async function loadStats() {
  const grid = root.querySelector('[data-stats]');
  try {
    const col = fsM.collection(db, 'installs');
    const since = (ms) => fsM.Timestamp.fromMillis(Date.now() - ms);
    const count = async (...clauses) => (await fsM.getCountFromServer(fsM.query(col, ...clauses))).data().count;
    const [total, d1, d7, d30, installed, notif] = await Promise.all([
      count(),
      count(fsM.where('lastSeen', '>=', since(864e5))),
      count(fsM.where('lastSeen', '>=', since(7 * 864e5))),
      count(fsM.where('lastSeen', '>=', since(30 * 864e5))),
      count(fsM.where('installed', '==', true)),
      count(fsM.where('notif', '==', true))
    ]);
    const card = (n, label) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`;
    grid.innerHTML = card(total, 'Aparèy total') + card(d1, 'Aktif dènye 24è') + card(d7, 'Aktif dènye 7 jou')
      + card(d30, 'Aktif dènye 30 jou') + card(installed, 'App enstale (ekran dakèy)') + card(notif, 'Rapèl aktive');

    const snap = await fsM.getDocs(fsM.query(col, fsM.orderBy('lastSeen', 'desc'), fsM.limit(200)));
    const rows = snap.docs.map((d) => d.data());
    const tally = (key) => rows.reduce((acc, r) => { const k = r[key] || '?'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
    const chips = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span>${esc(k)} · ${n}</span>`).join('');
    root.querySelector('[data-tally]').innerHTML =
      `<p class="note">Sou 200 dènye aparèy yo — vèsyon:</p><div class="tally">${chips(tally('version'))}</div>
       <p class="note">Plat-fòm:</p><div class="tally">${chips(tally('platform'))}</div>`;
    root.querySelector('[data-installs]').innerHTML = `<table>
      <thead><tr><th>Dènye ouvèti</th><th>Vèsyon</th><th>Plat-fòm</th><th>Enstale</th><th>Rapèl</th></tr></thead>
      <tbody>${rows.slice(0, 25).map((r) => `<tr><td>${fmtDate(r.lastSeen)}</td><td>${esc(r.version || '?')}</td><td>${esc(r.platform || '?')}</td>
        <td>${r.installed ? 'Wi' : 'Non'}</td><td>${r.notif ? 'Wi' : 'Non'}</td></tr>`).join('')}</tbody></table>`;
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="stat"><span>Pa ka li estatistik yo (${esc(e.code || e.message)}). Verifye règ Firestore yo.</span></div>`;
  }
}

/* ---------------- Kontwòl a distans ---------------- */
async function loadConfig() {
  const form = root.querySelector('[data-config]');
  let cfg = {};
  try {
    const snap = await fsM.getDoc(fsM.doc(db, 'config', 'app'));
    if (snap.exists()) cfg = snap.data();
  } catch (e) { console.error(e); }
  const m = cfg.maintenance || {}, a = cfg.announcement || {};
  form.innerHTML = `
    <label class="check-row"><input type="checkbox" name="mActive" ${m.active ? 'checked' : ''}> Mòd antretyen (bloke aplikasyon an pou tout moun)</label>
    <label class="field"><span>Mesaj antretyen</span><input type="text" name="mMsg" maxlength="200" value="${esc(m.message || '')}" placeholder="SòlPèp ap fè yon ti antretyen. Tounen talè."></label>
    <label class="check-row"><input type="checkbox" name="aActive" ${a.active ? 'checked' : ''}> Montre yon anons anlè aplikasyon an</label>
    <label class="field"><span>Tèks anons</span><input type="text" name="aText" maxlength="240" value="${esc(a.text || '')}" placeholder="Ex: Nouvo fonksyon disponib!"></label>
    <label class="field"><span>Nivo</span><select name="aLevel"><option value="info" ${a.level !== 'warning' ? 'selected' : ''}>Enfòmasyon</option><option value="warning" ${a.level === 'warning' ? 'selected' : ''}>Avètisman</option></select></label>
    <label class="field"><span>Vèsyon minimòm obligatwa (ex: 1.4.0, vid = pa gen)</span><input type="text" name="minVersion" maxlength="12" value="${esc(cfg.minVersion || '')}" placeholder="1.4.0"></label>
    <button class="btn primary" type="submit">Sove kontwòl yo</button>
    <p class="note">Chanjman yo parèt nan aplikasyon an a pwochen ouvèti a (avèk entènèt). Mòd antretyen an bloke tout moun: sèvi ak li sèlman nan ka ijans.</p>`;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = form.elements;
    const min = f.minVersion.value.trim();
    if (min && !/^\d+\.\d+\.\d+$/.test(min)) { toast('Vèsyon an dwe tankou 1.4.0', 'error'); return; }
    if (f.mActive.checked && !confirm('Mòd antretyen an ap bloke aplikasyon an pou TOUT moun. Kontinye?')) return;
    try {
      await fsM.setDoc(fsM.doc(db, 'config', 'app'), {
        maintenance: { active: f.mActive.checked, message: f.mMsg.value.trim() },
        announcement: { active: f.aActive.checked, text: f.aText.value.trim(), level: f.aLevel.value, id: Date.now().toString(36) },
        minVersion: min,
        updatedAt: fsM.serverTimestamp()
      });
      toast('Kontwòl yo sove.');
    } catch (ex) { console.error(ex); toast('Pa ka sove: ' + (ex.code || ex.message), 'error'); }
  };
}

/* ---------------- Notifikasyon pou tout moun ---------------- */
async function loadBroadcasts() {
  const form = root.querySelector('[data-broadcast]');
  form.innerHTML = `
    <label class="field"><span>Tit (60 karaktè max)</span><input type="text" name="title" maxlength="60" placeholder="SòlPèp"></label>
    <label class="field"><span>Mesaj (180 karaktè max)</span><textarea name="body" rows="3" maxlength="180" placeholder="Ex: Nouvo vèsyon an disponib. Mete l ajou!"></textarea></label>
    <button class="btn gold" type="submit">Mete nan fil voye a</button>
    <p class="note">Notifikasyon an pati nan 15 minit maksimòm (GitHub Actions), pou moun ki aktive rapèl yo.</p>`;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const title = form.elements.title.value.trim(), body = form.elements.body.value.trim();
    if (!title || !body) { toast('Mete yon tit ak yon mesaj.', 'error'); return; }
    if (!confirm(`Voye "${title}" bay tout moun ki gen rapèl aktif?`)) return;
    try {
      await fsM.addDoc(fsM.collection(db, 'broadcasts'), { title, body, url: './', sent: false, createdAt: fsM.serverTimestamp() });
      form.reset();
      toast('Mesaj la nan fil la.');
      refreshBroadcastList();
    } catch (ex) { console.error(ex); toast('Pa ka sove: ' + (ex.code || ex.message), 'error'); }
  };
  refreshBroadcastList();
}

async function refreshBroadcastList() {
  const box = root.querySelector('[data-broadcasts]');
  try {
    const snap = await fsM.getDocs(fsM.query(fsM.collection(db, 'broadcasts'), fsM.orderBy('createdAt', 'desc'), fsM.limit(8)));
    if (snap.empty) { box.innerHTML = ''; return; }
    box.innerHTML = `<table><thead><tr><th>Dat</th><th>Tit</th><th>Estati</th><th>Voye</th></tr></thead><tbody>${snap.docs.map((d) => {
      const b = d.data();
      return `<tr><td>${fmtDate(b.createdAt)}</td><td>${esc(b.title)}</td>
        <td><span class="pill ${b.sent ? 'ok' : 'wait'}">${b.sent ? 'Voye' : 'An atant'}</span></td>
        <td>${b.sent ? `${b.sentCount ?? 0} ok · ${b.failedCount ?? 0} echèk` : '—'}</td></tr>`;
    }).join('')}</tbody></table>`;
  } catch (e) { console.error(e); }
}

boot();
