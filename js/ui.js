/* Zouti UI pataje: echapman HTML, fèy anba (sheet), konfimasyon, toast, telechajman. */

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const initial = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase();

export const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
  <circle cx="16" cy="16" r="12" fill="none" stroke="#F2A900" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="19.5 6"/>
  <circle cx="16" cy="16" r="4.2" fill="#F2A900"/>
</svg>`;

/* ---------- Toast ---------- */
let toastTimer;
export function toast(message, kind = '') {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast ${kind}">${esc(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2800);
}

/* ---------- Fèy anba / dyalòg ---------- */
export function openSheet({ title, html, variant = 'sheet', onMount }) {
  const root = document.getElementById('overlay-root');
  const wrap = document.createElement('div');
  wrap.className = `overlay ${variant}`;
  wrap.innerHTML = `
    <div class="backdrop" data-close></div>
    <div class="panel" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
      <div class="panel-head">
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close aria-label="Fèmen">✕</button>
      </div>
      <div class="panel-body">${html}</div>
    </div>`;

  const previous = document.activeElement;
  let isClosed = false;
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });

  const onKey = (e) => {
    if (e.key === 'Escape' && root.lastElementChild === wrap) close();
  };
  function close(result) {
    if (isClosed) return;
    isClosed = true;
    document.removeEventListener('keydown', onKey);
    wrap.classList.add('closing');
    setTimeout(() => {
      wrap.remove();
      if (!root.children.length) document.body.classList.remove('no-scroll');
      if (previous && document.contains(previous) && previous.focus) previous.focus();
      resolveClosed(result);
    }, 150);
  }

  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  root.appendChild(wrap);
  document.body.classList.add('no-scroll');

  const focusTarget = wrap.querySelector('[data-autofocus]') || wrap.querySelector('.panel');
  focusTarget.focus();
  if (onMount) onMount(wrap, close);
  return { el: wrap, close, closed };
}

/** Konfimasyon avan aksyon danjere. Retounen Promise<boolean>. */
export function confirmDialog({ title, message, confirmLabel = 'Konfime', cancelLabel = 'Anile', danger = false }) {
  return new Promise((resolve) => {
    const sheet = openSheet({
      title,
      variant: 'dialog',
      html: `
        <p class="dialog-msg">${esc(message)}</p>
        <div class="actions">
          <button type="button" class="btn ghost" data-close data-autofocus>${esc(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel)}</button>
        </div>`,
      onMount(el, close) {
        el.querySelector('[data-ok]').addEventListener('click', () => { resolve(true); close(true); });
      }
    });
    sheet.closed.then(() => resolve(false));
  });
}

/* ---------- Telechajman fichye ---------- */
export function downloadFile(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFilename = (name) =>
  String(name || 'sol').trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'sol';
