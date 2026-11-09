/* Fòma lajan an HTG: 1 500,00 HTG (espas ensekab kòm separatè milye, vigil pou desimal). */

const NBSP = '\u00a0';

function split(value) {
  const v = Math.round((Number(value) || 0) * 100) / 100;
  const [int, frac] = Math.abs(v).toFixed(2).split('.');
  return { neg: v < 0, int: int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP), frac };
}

/** 1500 -> "1 500,00 HTG" */
export function htg(value) {
  const { neg, int, frac } = split(value);
  return `${neg ? '-' : ''}${int},${frac}${NBSP}HTG`;
}

/** Fòm kout pou tablo a: 1500 -> "1 500", 1500.5 -> "1 500,50" */
export function num(value) {
  const { neg, int, frac } = split(value);
  return `${neg ? '-' : ''}${int}${frac === '00' ? '' : ',' + frac}`;
}

/** Valè pou mete nan yon chan: 1500.5 -> "1500,5" (vid si 0) */
export function toInput(value) {
  return value > 0 ? String(value).replace('.', ',') : '';
}

/** Konvèti sa itilizatè a tape. Vid -> 0. Envalid -> null. Aksepte "1500", "1 500,50", "1500.5". */
export function parseAmount(text) {
  const t = String(text ?? '').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (t === '') return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}
