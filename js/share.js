/* Lekti yon sòl pataje (piblik, san kont): yon sèl requèt REST, pa gen SDK Firebase. */
import { firebaseConfig } from './firebase-config.js';
import { _fromFs } from './cloud.js';

const TOKEN_RE = /^[a-z2-7]{24}$/;
const cacheKey = (t) => `sp_share_${t}`;
export const validToken = (t) => TOKEN_RE.test(String(t));

function readCache(token) {
  try { return JSON.parse(localStorage.getItem(cacheKey(token))); } catch { return null; }
}

/**
 * -> { doc, fetchedAt, stale }  (stale = vèsyon ki sove, pa gen entènèt)
 *  | { missing: true }          (lyen envalid oswa retire)
 *  | { error: true }            (pa gen entènèt epi pa gen kopi)
 */
export async function fetchShare(token) {
  if (!validToken(token)) return { missing: true };
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/shares/${token}?key=${firebaseConfig.apiKey}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 404 || res.status === 403) {
      try { localStorage.removeItem(cacheKey(token)); } catch { /* bloke */ }
      return { missing: true };
    }
    if (!res.ok) throw new Error('http ' + res.status);
    const raw = await res.json();
    const doc = _fromFs({ mapValue: { fields: raw.fields || {} } });
    const entry = { doc, fetchedAt: Date.now() };
    try { localStorage.setItem(cacheKey(token), JSON.stringify(entry)); } catch { /* bloke */ }
    return { ...entry, stale: false };
  } catch {
    const cached = readCache(token);
    return cached ? { ...cached, stale: true } : { error: true };
  } finally {
    clearTimeout(timer);
  }
}
