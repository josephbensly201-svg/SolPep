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
  const group = { id: uid(), name: name.trim(), amount, frequency, startDate, createdAt: Date.now() };
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
  return member;
}

export async function renameMember(memberId, name) {
  const db = await getDB();
  const member = await db.get('members', memberId);
  if (!member) return null;
  member.name = name.trim();
  await db.put('members', member);
  return member;
}

/** "Efase" yon manm = dezaktive li (griz). Pa gen anyen ki pèdi. */
export async function setMemberActive(memberId, active) {
  const db = await getDB();
  const member = await db.get('members', memberId);
  if (!member) return null;
  member.active = !!active;
  await db.put('members', member);
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
    return null;
  }
  const record = { id, groupId, memberId, round, amount: amount > 0 ? amount : 0, note: cleanNote, updatedAt: Date.now() };
  await db.put('payments', record);
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
