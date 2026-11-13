/* Sovgad kont: kont Google, kopi chak sòl nan Firestore (users/{uid}/sols/{solId}).
 * Si telefòn nan pèdi, moun nan konekte sou yon lòt telefòn epi tout sòl yo tounen.
 *
 * Done yo ki nan sovgad la: non sòl, kòd, montan, manm, peman, nòt. Règ Firestore yo pèmèt sèlman
 * pwopriyetè kont lan li yo. Sovgad la dwe aktive pa moun nan (kreye kont + dakò). */
import { sdk, ensureUser, onDataChanged } from './cloud.js';
import { getAllGroupsData, importCloudSol } from './db.js';

const K = { acct: 'sp_account', pushed: 'sp_pushed', last: 'sp_lastbackup', auto: 'sp_autosync', prev: 'sp_prev_uid' };
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* bloke */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* bloke */ } }
};

export const accountEmail = () => ls.get(K.acct) || '';
export const isSignedIn = () => !!accountEmail();
export const lastBackup = () => Number(ls.get(K.last) || 0);

const readMap = () => { try { return JSON.parse(ls.get(K.pushed)) || {}; } catch { return {}; } };
const writeMap = (m) => ls.set(K.pushed, JSON.stringify(m));

/** Itilizatè kounye a (san kreye anonim). */
async function peekUser() {
  const { auth, authM } = await sdk();
  return new Promise((resolve) => {
    const off = authM.onAuthStateChanged(auth, (u) => { off(); resolve(u); });
  });
}
async function accountUser() {
  const u = await peekUser();
  return u && !u.isAnonymous ? u : null;
}

/** Fòma done yo voye nan Firestore (pa gen anyen ki endefini). */
export function _toCloud({ group, members, payments }) {
  return {
    name: group.name, code: group.code, amount: group.amount,
    frequency: group.frequency || '', startDate: group.startDate || '',
    status: group.status || 'active',
    createdAt: group.createdAt || 0, updatedAt: group.updatedAt || 0,
    archivedAt: group.archivedAt || 0, finishedAt: group.finishedAt || 0,
    members: members.map((m) => ({ id: m.id, name: m.name, active: !!m.active, order: m.order })),
    payments: payments.map((p) => ({ id: p.id, memberId: p.memberId, round: p.round, amount: p.amount, note: p.note || '' })),
    schema: 1
  };
}

async function pushChanged(user) {
  const { fsM, db } = await sdk();
  const pushed = readMap();
  const all = await getAllGroupsData();
  let count = 0;
  for (const local of all) {
    const stamp = local.group.updatedAt || 0;
    if (pushed[local.group.id] === stamp) continue;
    await fsM.setDoc(fsM.doc(db, 'users', user.uid, 'sols', local.group.id), _toCloud(local));
    pushed[local.group.id] = stamp;
    count++;
  }
  writeMap(pushed);
  if (count) ls.set(K.last, String(Date.now()));
  return count;
}

/** Rekipere sa ki nan sèvè a (sòl ki pi nèf), epi voye sa ki pi nèf lokalman. */
export async function fullSync(user) {
  const { fsM, db } = await sdk();
  const snap = await fsM.getDocs(fsM.collection(db, 'users', user.uid, 'sols'));
  const local = await getAllGroupsData();
  const pushed = readMap();
  let pulled = 0;
  for (const d of snap.docs) {
    const c = d.data();
    const l = local.find((x) => x.group.id === d.id);
    const cloudStamp = c.updatedAt || 0;
    if (!l || cloudStamp > (l.group.updatedAt || 0)) {
      await importCloudSol(d.id, c);
      pushed[d.id] = cloudStamp;
      pulled++;
    } else if ((l.group.updatedAt || 0) === cloudStamp) {
      pushed[d.id] = cloudStamp;
    }
  }
  writeMap(pushed);
  const sent = await pushChanged(user);
  await fsM.setDoc(fsM.doc(db, 'users', user.uid), { updatedAt: Date.now(), lastBackupAt: Date.now() }, { merge: true });
  ls.set(K.last, String(Date.now()));
  return { pulled, pushed: sent };
}

/* ---------- Kont (Google) ---------- */

/** Chaje SDK a + itilizatè anonim lan davans, pou fenèt Google a louvri touswit apre klik la. */
export async function warmup() {
  await sdk();
  await ensureUser();
}

/**
 * Konekte ak Google. Si aparèy la gen yon kont anonim (menm UID ak estatistik yo), nou lye l ak kont Google la.
 * Si kont Google la deja egziste sou yon lòt telefòn, nou konekte sou kont sa a pou rekipere sòl yo.
 * confirmMerge(): rele si telefòn nan te itilize pa yon lòt kont avan (pou pa melanje sòl moun).
 */
export async function signInWithGoogle({ confirmMerge } = {}) {
  const { auth, authM, fsM, db } = await sdk();
  const provider = new authM.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const current = await ensureUser();                          // anonim (si pa gen anyen)

  let user;
  try {
    user = current.isAnonymous
      ? (await authM.linkWithPopup(current, provider)).user
      : (await authM.signInWithPopup(auth, provider)).user;
  } catch (e) {
    if (e && e.code === 'auth/credential-already-in-use') {    // kont Google sa a deja egziste (lòt telefòn)
      const credential = authM.GoogleAuthProvider.credentialFromError(e);
      if (!credential) throw e;
      try { await fsM.deleteDoc(fsM.doc(db, 'installs', current.uid)); } catch { /* pa grav */ }
      user = (await authM.signInWithCredential(auth, credential)).user;
    } else {
      throw e;
    }
  }

  const prev = ls.get(K.prev);
  if (prev && prev !== user.uid && confirmMerge) {
    const local = await getAllGroupsData();
    if (local.length && !(await confirmMerge(local.length, user.email))) {
      await authM.signOut(auth);
      const err = new Error('cancelled'); err.code = 'cancelled'; throw err;
    }
  }

  await user.getIdToken(true);
  await fsM.setDoc(fsM.doc(db, 'users', user.uid),
    { email: user.email || '', displayName: String(user.displayName || '').slice(0, 60), updatedAt: Date.now() }, { merge: true });
  ls.set(K.acct, user.email || 'Google');
  ls.set(K.prev, user.uid);
  ls.del(K.pushed);
  return fullSync(user);
}

export async function signOutAccount() {
  const { auth, authM } = await sdk();
  await authM.signOut(auth);
  ls.del(K.acct);
  ls.del(K.pushed);
  ls.del(K.last);
}

export async function backupNow() {
  const user = await accountUser();
  if (!user) throw new Error('not-signed-in');
  return fullSync(user);
}

/** Efase tout sovgad la nan sèvè a (done lokal yo rete sou telefòn nan). */
export async function deleteBackup() {
  const user = await accountUser();
  if (!user) throw new Error('not-signed-in');
  const { fsM, db } = await sdk();
  const snap = await fsM.getDocs(fsM.collection(db, 'users', user.uid, 'sols'));
  for (const d of snap.docs) await fsM.deleteDoc(d.ref);
  await fsM.deleteDoc(fsM.doc(db, 'users', user.uid));
  ls.del(K.pushed);
  ls.del(K.last);
}

/* ---------- Sovgad otomatik ---------- */
let timer = null;
onDataChanged(() => {
  if (!isSignedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      if (!navigator.onLine) return;
      const user = await accountUser();
      if (user) await pushChanged(user);
    } catch (e) { console.warn('Sovgad otomatik echwe:', e); }
  }, 5000);
});

/** Rele nan demaraj: si kont lan konekte, senkronize (max 1 fwa chak 30 minit). */
export async function initSync() {
  if (!isSignedIn() || !navigator.onLine) return 0;
  const last = Number(ls.get(K.auto) || 0);
  if (Date.now() - last < 30 * 60 * 1000) return 0;
  const user = await accountUser();
  if (!user) return 0;
  ls.set(K.auto, String(Date.now()));
  const r = await fullSync(user);
  return r.pulled;
}

export const _importCloudSol = importCloudSol;
