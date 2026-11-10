/* Kalandriye sòl la: frekans peman + dat chak manch. Dat yo se tèks ISO "AAAA-MM-JJ" (lè lokal). */

export const FREQUENCIES = {
  daily:    { label: 'Chak jou',    short: 'chak jou' },
  weekly:   { label: 'Chak semèn',  short: 'chak semèn' },
  biweekly: { label: 'Chak 15 jou', short: 'chak 15 jou' },
  monthly:  { label: 'Chak mwa',    short: 'chak mwa' }
};

const MONTHS = ['janvye', 'fevriye', 'mas', 'avril', 'me', 'jen', 'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export function todayISO() {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
}

function addDays(y, m, d, n) {
  const dt = new Date(y, m, d + n);
  return iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/** Dat limit manch `round` (0 = premye manch). Retounen null si sòl la pa gen kalandriye. */
export function dueDate(group, round) {
  if (!group || !FREQUENCIES[group.frequency] || !/^\d{4}-\d{2}-\d{2}$/.test(group.startDate || '')) return null;
  const [y, mo, d] = group.startDate.split('-').map(Number);
  const m = mo - 1;
  switch (group.frequency) {
    case 'daily': return addDays(y, m, d, round);
    case 'weekly': return addDays(y, m, d, 7 * round);
    case 'biweekly': return addDays(y, m, d, 15 * round);
    case 'monthly': {
      const total = m + round;
      const yy = y + Math.floor(total / 12);
      const mm = ((total % 12) + 12) % 12;
      const lastDay = new Date(yy, mm + 1, 0).getDate();   // 31 janvye -> 28/29 fevriye
      return iso(yy, mm, Math.min(d, lastDay));
    }
  }
  return null;
}

/** Ajoute n jou sou yon dat ISO. */
export function addDaysISO(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return addDays(y, m - 1, d, n);
}

export const isPast = (isoDate) => !!isoDate && isoDate < todayISO();

/** "2026-11-15" -> "15 novanm 2026" */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-11-15" -> "15/11/2026" (pou CSV) */
export function formatDateShort(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

/** Manch ki pi pre dat jodi a (premye tou ki poko pase, sinon dènye a). null si pa gen kalandriye. */
export function currentRound(group, roundCount) {
  if (roundCount < 1 || !dueDate(group, 0)) return null;
  const today = todayISO();
  for (let r = 0; r < roundCount; r++) if (dueDate(group, r) >= today) return r;
  return roundCount - 1;
}

/** Chan fòm (frekans + dat premye manch) pataje ant kreyasyon ak modifikasyon. */
export function scheduleFieldsHTML({ frequency, startDate } = {}) {
  const chosen = frequency || 'monthly';
  const options = Object.entries(FREQUENCIES).map(([id, f]) => `
    <label class="seg-opt"><input type="radio" name="frequency" value="${id}" ${id === chosen ? 'checked' : ''}><span>${f.label}</span></label>`).join('');
  return `
    <fieldset class="field seg-field"><legend>Ki lè moun yo peye?</legend>
      <div class="seg">${options}</div>
    </fieldset>
    <label class="field"><span>Dat premye manch la</span>
      <input type="date" name="startDate" value="${startDate || todayISO()}"></label>`;
}
