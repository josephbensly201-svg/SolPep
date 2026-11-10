/* Fonksyon pi yo (san Firebase) pou script notifikasyon an: fasil pou teste. */
export const TZ = 'America/Port-au-Prince';

/** Dat ak èdtan nan lè Ayiti: { date: 'AAAA-MM-JJ', hour: 0-23 } */
export function haitiParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Mesaj rapèl pou yon aparèy: jodi a ak/oswa demen. Pa gen non moun, non sòl ni montan. */
export function reminderMessages(install, today, tomorrow) {
  const list = Array.isArray(install.reminders) ? install.reminders : [];
  const pick = (day) => list.filter((s) => typeof s === 'string' && s.startsWith(day + '|')).map((s) => s.split('|')[1]);
  const out = [];
  const t = pick(today), m = pick(tomorrow);
  if (t.length) {
    out.push({ tag: 'today', title: 'SòlPèp · Jodi a',
      body: t.length === 1 ? `Manch ${t[0]} dwe fèt jodi a. Pa bliye kolekte peman yo.`
        : `${t.length} manch dwe fèt jodi a (${t.join(', ')}). Pa bliye kolekte peman yo.` });
  }
  if (m.length) {
    out.push({ tag: 'tomorrow', title: 'SòlPèp · Demen',
      body: m.length === 1 ? `Manch ${m[0]} dwe fèt demen. Prepare kolekte a.`
        : `${m.length} manch dwe fèt demen (${m.join(', ')}). Prepare kolekte a.` });
  }
  return out;
}
