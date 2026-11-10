/* Voye notifikasyon yo: (1) mesaj admin an atant, (2) rapèl chak jou a 8è (lè Ayiti).
 * Kouri chak 15 minit pa GitHub Actions. Bezwen sekrè FIREBASE_SERVICE_ACCOUNT. */
import admin from 'firebase-admin';
import { haitiParts, addDaysISO, reminderMessages } from './lib.mjs';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error('Sekrè FIREBASE_SERVICE_ACCOUNT manke.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });

const db = admin.firestore();
const messaging = admin.messaging();
const { FieldValue } = admin.firestore;
const FORCE = process.env.FORCE_REMINDERS === 'true';
const DEAD_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

async function sendMany(items) {
  let ok = 0, fail = 0;
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    const res = await messaging.sendEach(chunk.map((it) => ({
      token: it.token,
      data: { title: it.title, body: it.body, url: it.url || './', tag: it.tag || '' },
      webpush: { headers: { Urgency: 'high', TTL: '43200' } }
    })));
    for (let j = 0; j < res.responses.length; j++) {
      const r = res.responses[j];
      if (r.success) { ok++; continue; }
      fail++;
      if (r.error && DEAD_TOKEN.has(r.error.code)) {
        await chunk[j].ref.update({ notif: false, token: FieldValue.delete() }).catch(() => {});
      }
    }
  }
  return { ok, fail };
}

async function runBroadcasts() {
  const pending = await db.collection('broadcasts').where('sent', '==', false).limit(5).get();
  if (pending.empty) { console.log('Pa gen mesaj an atant.'); return; }
  const installs = await db.collection('installs').where('notif', '==', true).get();
  const targets = installs.docs.filter((d) => d.data().token);
  for (const b of pending.docs) {
    const { title, body, url } = b.data();
    const r = await sendMany(targets.map((d) => ({ ref: d.ref, token: d.data().token, title, body, url, tag: 'broadcast' })));
    await b.ref.update({ sent: true, sentAt: FieldValue.serverTimestamp(), sentCount: r.ok, failedCount: r.fail });
    console.log(`Mesaj "${title}": ${r.ok} ok, ${r.fail} echèk.`);
  }
}

async function runReminders() {
  const { date: today, hour } = haitiParts();
  if (!FORCE && hour < 8) { console.log(`Li ${hour}è nan Ayiti: poko lè rapèl yo.`); return; }
  const marker = db.doc('meta/lastReminderRun');
  if (!FORCE) {
    const m = await marker.get();
    if (m.exists && m.data().date === today) { console.log('Rapèl jodi a deja voye.'); return; }
  }
  const tomorrow = addDaysISO(today, 1);
  const snap = await db.collection('installs').where('notif', '==', true).get();
  const items = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (!data.token) continue;
    for (const m of reminderMessages(data, today, tomorrow)) items.push({ ref: d.ref, token: data.token, ...m, url: './' });
  }
  const r = items.length ? await sendMany(items) : { ok: 0, fail: 0 };
  if (!FORCE) await marker.set({ date: today, sent: r.ok, failed: r.fail, at: FieldValue.serverTimestamp() });
  console.log(`Rapèl ${today}: ${r.ok} ok, ${r.fail} echèk (${snap.size} aparèy ak rapèl).`);
}

await runBroadcasts();
await runReminders();
