/* Kouch done: tout aksè IndexedDB pase isit la. */
import { openDB } from './lib/idb.js';
import { compute, key } from './calc.js';

const DB_NAME = 'jere-sol';
const DB_VERSION = 1;
const LEGACY_KEY = 'jere_sol_v1'; // ansyen kle localStorage (vèsyon MVP)

let dbPromise;
export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('groups', { keyPath: 'id' });
        const members = db.createObjectStore('members', { keyPath: 'id' });
        members.createIndex('byGroup', 'groupId');
        const payments = db.createObjectStore('payments', { keyPath: 'id' });
        payments.createIndex('byGroup', 'groupId');
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    });
  }
  return dbPromise;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Kòd sòl ---------- */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // san 0/O/1/I pou evite konfizyon

export function newCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return 'SOL-' + Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}
export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
/** Aksepte "SOL-K7M4QX", "sol k7m4qx" oswa sèlman "K7M4QX". */
export function codeMatches(input, code) {
  const a = normCode(input), b = normCode(code);
  return a.length > 0 && (a === b || a === b.replace(/^SOL/, ''));
}

async function touch(groupId) {
  const db = await getDB();
  const g = await db.get('groups', groupId);
  if (g) { g.updatedAt = Date.now(); await db.put('groups', g); }
}

/* ---------- Sòl ---------- */

export async function listGroupsOverview() {
  const db = await getDB();
  const [groups, members, payments] = await Promise.all([
    db.getAll('groups'), db.getAll('members'), db.getAll('payments')
  ]);
  return groups
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((group) => {
      const ms = members.filter((m) => m.groupId === group.id).sort((a, b) => a.order - b.order);
      const ps = payments.filter((p) => p.groupId === group.id);
      const calc = compute(group, ms, ps);
      return { group, memberCount: ms.length, activeCount: calc.activeCount, collected: calc.collected, progress: calc.progress };
    });
}

/** Tout sòl yo ak done yo (pou kalkile rapèl yo). */
export async function getAllGroupsData() {
  const db = await getDB();
  const [groups, members, payments] = await Promise.all([
    db.getAll('groups'), db.getAll('members'), db.getAll('payments')
  ]);
  return groups.map((group) => {
    const ms = members.filter((m) => m.groupId === group.id).sort((a, b) => a.order - b.order);
    const ps = payments.filter((p) => p.groupId === group.id);
    return { group, members: ms, payments: ps, calc: compute(group, ms, ps) };
  });
}

export async function getGroupData(id) {
  const db = await getDB();
  const group = await db.get('groups', id);
  if (!group) return null;
  const members = (await db.getAllFromIndex('members', 'byGroup', id)).sort((a, b) => a.order - b.order);
  const payments = await db.getAllFromIndex('payments', 'byGroup', id);
  return { group, members, payments, calc: compute(group, members, payments) };
}

export async function createGroup({ name, amount, frequency, startDate }) {
  const db = await getDB();
  const codes = new Set((await db.getAll('groups')).map((g) => g.code));
  let code;
  do { code = newCode(); } while (codes.has(code));
  const now = Date.now();
  const group = { id: uid(), name: name.trim(), amount, frequency, startDate, code, status: 'active', createdAt: now, updatedAt: now };
  await db.put('groups', group);
  return group;
}

export async function updateGroup(id, { name, amount, frequency, startDate }) {
  const db = await getDB();
  const group = await db.get('groups', id);
  if (!group) return null;
  group.name = name.trim();
  group.amount = amount;
  group.frequency = frequency;
  group.startDate = startDate;
  group.updatedAt = Date.now();
  await db.put('groups', group);
  return group;
}

export async function deleteGroup(id) {
  const db = await getDB();
  const [members, payments] = await Promise.all([
    db.getAllFromIndex('members', 'byGroup', id),
    db.getAllFromIndex('payments', 'byGroup', id)
  ]);
  const tx = db.transaction(['groups', 'members', 'payments'], 'readwrite');
  tx.objectStore('groups').delete(id);
  members.forEach((m) => tx.objectStore('members').delete(m.id));
  payments.forEach((p) => tx.objectStore('payments').delete(p.id));
  await tx.done;
}

/* ---------- Manm ---------- */

export async function addMember(groupId, name) {
  const db = await getDB();
  const existing = await db.getAllFromIndex('members', 'byGroup', groupId);
  const order = existing.reduce((max, m) => Math.max(max, m.order), -1) + 1;
  const member = { id: uid(), groupId, name: name.trim(), active: true, order, createdAt: Date.now() };
  await db.put('members', member);
  await touch(groupId);
  return member;
}

export async function renameMember(memberId, name) {
  const db = await getDB();
  const member = await db.get('members', memberId);
  if (!member) return null;
  member.name = name.trim();
  await db.put('members', member);
  await touch(member.groupId);
  return member;
}

/** "Efase" yon manm = dezaktive li (griz). Pa gen anyen ki pèdi. */
export async function setMemberActive(memberId, active) {
  const db = await getDB();
  const member = await db.get('members', memberId);
  if (!member) return null;
  member.active = !!active;
  await db.put('members', member);
  await touch(member.groupId);
  return member;
}

/* ---------- Peman ---------- */

/** Montan 0 san nòt = efase kaz la. Sinon sove (montan pasyèl posib). */
export async function savePayment({ groupId, memberId, round, amount, note }) {
  const db = await getDB();
  const id = key(memberId, round);
  const cleanNote = (note || '').trim();
  if (!(amount > 0) && !cleanNote) {
    await db.delete('payments', id);
    await touch(groupId);
    return null;
  }
  const record = { id, groupId, memberId, round, amount: amount > 0 ? amount : 0, note: cleanNote, updatedAt: Date.now() };
  await db.put('payments', record);
  await touch(groupId);
  return record;
}

/* ---------- Migrasyon localStorage -> IndexedDB ---------- */

/** Rele youn sèl fwa: kopye done MVP yo, epi kenbe yon kopi sekou nan localStorage. */
export async function migrateLegacy() {
  const db = await getDB();
  if (await db.get('meta', 'legacyMigrated')) return 0;

  let raw = null;
  try { raw = localStorage.getItem(LEGACY_KEY); } catch { /* localStorage bloke */ }
  if (!raw) {
    await db.put('meta', { key: 'legacyMigrated', value: true, at: Date.now(), groups: 0 });
    return 0;
  }

  let legacy;
  try { legacy = JSON.parse(raw); } catch { legacy = null; }
  const groups = legacy && Array.isArray(legacy.groups) ? legacy.groups : [];

  const tx = db.transaction(['groups', 'members', 'payments', 'meta'], 'readwrite');
  const gs = tx.objectStore('groups'), ms = tx.objectStore('members'), ps = tx.objectStore('payments');
  groups.forEach((g) => {
    const amount = Number(g.amount) || 0;
    gs.put({ id: g.id, name: g.name || 'Sòl', amount, createdAt: g.createdAt || Date.now() });
    (g.members || []).forEach((m, i) => {
      ms.put({ id: m.id, groupId: g.id, name: m.name, active: true, order: i, createdAt: g.createdAt || Date.now() });
    });
    Object.keys(g.payments || {}).forEach((k) => {
      if (!g.payments[k]) return;
      const cut = k.lastIndexOf('_');
      const memberId = k.slice(0, cut);
      const round = Number(k.slice(cut + 1));
      // Ansyen ✓ = peye nèt: montan an vin egal ak montan sòl la.
      ps.put({ id: k, groupId: g.id, memberId, round, amount, note: '', updatedAt: Date.now() });
    });
  });
  tx.objectStore('meta').put({ key: 'legacyMigrated', value: true, at: Date.now(), groups: groups.length });
  await tx.done;

  try {
    localStorage.setItem(LEGACY_KEY + '_backup', raw);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* pa grav */ }
  return groups.length;
}


/* ---------- Estati sòl: 'active' | 'finished' | 'archived' (anyen pa efase nèt) ---------- */
export async function setGroupStatus(id, status) {
  const db = await getDB();
  const g = await db.get('groups', id);
  if (!g) return null;
  const now = Date.now();
  g.status = status;
  g.archivedAt = status === 'archived' ? now : 0;
  g.finishedAt = status === 'finished' ? now : 0;
  g.updatedAt = now;
  await db.put('groups', g);
  return g;
}

/** Bay kòd, estati ak updatedAt bay ansyen sòl yo (migrasyon). */
export async function ensureGroupMeta() {
  const db = await getDB();
  const groups = await db.getAll('groups');
  const used = new Set(groups.map((g) => g.code).filter(Boolean));
  for (const g of groups) {
    let changed = false;
    if (!g.code) { let c; do { c = newCode(); } while (used.has(c)); used.add(c); g.code = c; changed = true; }
    if (!g.status) { g.status = 'active'; changed = true; }
    if (!g.updatedAt) { g.updatedAt = g.createdAt || Date.now(); changed = true; }
    if (changed) await db.put('groups', g);
  }
}

/** Ranplase yon sòl lokal ak vèsyon ki nan sovgad la (restorasyon). */
export async function importCloudSol(id, c) {
  const db = await getDB();
  const [oldMembers, oldPayments] = await Promise.all([
    db.getAllFromIndex('members', 'byGroup', id),
    db.getAllFromIndex('payments', 'byGroup', id)
  ]);
  const tx = db.transaction(['groups', 'members', 'payments'], 'readwrite');
  const gs = tx.objectStore('groups'), ms = tx.objectStore('members'), ps = tx.objectStore('payments');
  gs.put({
    id, name: c.name, code: c.code, amount: c.amount,
    frequency: c.frequency || undefined, startDate: c.startDate || undefined,
    status: c.status || 'active', createdAt: c.createdAt || Date.now(), updatedAt: c.updatedAt || Date.now(),
    archivedAt: c.archivedAt || 0, finishedAt: c.finishedAt || 0
  });
  oldMembers.forEach((m) => ms.delete(m.id));
  oldPayments.forEach((p) => ps.delete(p.id));
  (c.members || []).forEach((m) => ms.put({ id: m.id, groupId: id, name: m.name, active: m.active !== false, order: m.order, createdAt: c.createdAt || Date.now() }));
  (c.payments || []).forEach((p) => ps.put({ id: p.id, groupId: id, memberId: p.memberId, round: p.round, amount: p.amount, note: p.note || '', updatedAt: c.updatedAt || Date.now() }));
  await tx.done;
}
