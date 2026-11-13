/* Fèy "Kont, sovgad ak rapèl": sovgad kont (Google), rapèl push, estatistik anonim. */
import { openSheet, toast, confirmDialog, esc } from '../ui.js';
import * as cloud from '../cloud.js';
import * as sync from '../sync.js';

export function openSettings() {
  openSheet({
    title: 'Kont, sovgad ak rapèl',
    html: '<div data-body></div>',
    onMount(el) { render(el); sync.warmup().catch(() => {}); }
  });
}

const AUTH_ERRORS = {
  'auth/popup-closed-by-user': 'Fenèt Google a fèmen. Eseye ankò.',
  'auth/cancelled-popup-request': 'Fenèt Google a fèmen. Eseye ankò.',
  'auth/popup-blocked': 'Navigatè a bloke fenèt Google a. Otorize popup yo pou sit sa a epi eseye ankò.',
  'auth/unauthorized-domain': 'Domèn sit la pa otorize nan Firebase (Authentication → Paramètres → Domaines autorisés).',
  'auth/operation-not-allowed': 'Koneksyon Google pa aktive nan Firebase (Authentication → Méthode de connexion).',
  'auth/account-exists-with-different-credential': 'Yon lòt kont deja itilize imèl sa a.',
  'auth/too-many-requests': 'Twòp esè. Tann yon ti moman epi eseye ankò.',
  'auth/network-request-failed': 'Pa gen entènèt. Verifye koneksyon an.',
  'permission-denied': 'Sèvè a refize sovgad la. Verifye règ sekirite yo.'
};
const errText = (e) => AUTH_ERRORS[e && e.code] || 'Gen yon pwoblèm. Verifye entènèt la epi eseye ankò.';

function fmtTime(ms) {
  return ms ? new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'poko';
}

function accountBlock() {
  if (sync.isSignedIn()) {
    return `
      <p class="ok-line">Sovgad aktif ✓</p>
      <p class="hint">Kont: <b>${esc(sync.accountEmail())}</b><br>Dènye sovgad: ${fmtTime(sync.lastBackup())}</p>
      <div class="actions">
        <button type="button" class="btn primary" data-act="backup">Sove kounye a</button>
        <button type="button" class="btn ghost" data-act="signout">Dekonekte</button>
      </div>
      <button type="button" class="link danger center" data-act="delete-backup">Efase sovgad la nan sèvè a</button>`;
  }
  return `
    <p class="hint">Si telefòn ou pèdi, konekte ak Google sou yon lòt telefòn epi jwenn tout sòl ou yo.</p>
    <label class="check-line"><input type="checkbox" data-consent> <span>Mwen dakò: non sòl yo, kòd yo, non manm yo, montan yo ak peman yo ap sere sou sèvè Firebase (Google) pou sovgad. Sèlman kont Google mwen ka li yo.</span></label>
    <p class="error" data-error hidden></p>
    <button type="button" class="btn primary" data-act="google">Kontinye ak Google</button>`;
}

function notifBlock(state) {
  if (state === 'unsupported') {
    return `<p class="hint">Aparèy sa a pa sipòte notifikasyon. Sou iPhone, enstale aplikasyon an sou ekran dakèy la dabò (Pataje → Sou ekran dakèy).</p>`;
  }
  if (state === 'denied') {
    return `<p class="hint">Ou te bloke notifikasyon yo nan navigatè a. Pou aktive yo ankò, ouvri paramèt sit la nan navigatè a epi otorize notifikasyon yo.</p>`;
  }
  if (state === 'on') {
    return `<p class="ok-line">Rapèl yo aktif ✓</p>
            <p class="hint">Ou resevwa yon notifikasyon demen ak jou chak manch, a 8è nan maten (lè Ayiti).</p>
            <button type="button" class="btn ghost" data-act="notif-off">Dezaktive rapèl yo</button>`;
  }
  return `<p class="hint">Resevwa yon notifikasyon la veyè ak jou chak manch pou ou pa bliye kolekte peman yo.</p>
          <button type="button" class="btn primary" data-act="notif-on">Aktive rapèl yo</button>`;
}

function render(sheet) {
  const body = sheet.querySelector('[data-body]');
  const state = cloud.notifState();
  body.innerHTML = `
    <div class="stack">
      <section><h3 class="sub-title">Sovgad kont (pa pèdi sòl ou)</h3>${accountBlock()}</section>
      <section><h3 class="sub-title">Rapèl otomatik</h3>${notifBlock(state)}</section>
      <section>
        <h3 class="sub-title">Estatistik anonim</h3>
        <label class="switch-row">
          <span>Konte aparèy sa a nan estatistik yo</span>
          <input type="checkbox" data-act="stats" ${cloud.statsEnabled() ? 'checked' : ''}>
        </label>
        <p class="hint">Aplikasyon an voye yon idantifyan anonim, vèsyon an ak dat dènye ouvèti a (ak jeton an + dat manch yo si ou aktive rapèl yo), san non, san montan.
        Sovgad kont lan, si ou aktive l, se yon bagay apa: li sere done sòl ou yo pou ou sèlman.</p>
      </section>
    </div>`;

  const rerender = () => render(sheet);
  const refreshApp = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

  body.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.type === 'checkbox') return;
    const act = b.dataset.act;

    if (act === 'google') {
      const err = body.querySelector('[data-error]');
      if (!body.querySelector('[data-consent]').checked) {
        err.textContent = 'Ou dwe dakò ak sovgad done yo pou kontinye.'; err.hidden = false; return;
      }
      err.hidden = true;
      b.disabled = true;
      try {
        const r = await sync.signInWithGoogle({
          confirmMerge: (n, email) => confirmDialog({
            title: 'Voye sòl telefòn sa a?',
            message: `Gen ${n} sòl sou telefòn sa a ki pa nan kont ${email}. Voye yo nan kont sa a?`,
            confirmLabel: 'Wi, voye yo'
          })
        });
        toast(r.pulled ? `Konekte. ${r.pulled} sòl rekipere.` : 'Sovgad aktive.');
        refreshApp();
      } catch (ex) {
        if (!ex || ex.code !== 'cancelled') { console.warn(ex); toast(errText(ex), 'error'); }
        else toast('Konneksyon anile.');
      }
      return rerender();
    }

    b.disabled = true;
    try {
      if (act === 'backup') {
        const r = await sync.backupNow();
        toast(`Sovgad fèt (${r.pushed} voye, ${r.pulled} rekipere).`);
        if (r.pulled) refreshApp();
      }
      if (act === 'signout') {
        const ok = await confirmDialog({ title: 'Dekonekte?', message: 'Sòl yo rete sou telefòn nan. Sovgad otomatik la ap sispann jiskaske ou konekte ankò.', confirmLabel: 'Dekonekte' });
        if (ok) { await sync.signOutAccount(); toast('Ou dekonekte.'); }
      }
      if (act === 'delete-backup') {
        const ok = await confirmDialog({ title: 'Efase sovgad la?', message: 'Sa ap efase kopi sòl ou yo nan sèvè a. Sòl ki sou telefòn nan rete. Ou pap ka rekipere yo si telefòn nan pèdi.', confirmLabel: 'Efase sovgad la', danger: true });
        if (ok) { await sync.deleteBackup(); await sync.signOutAccount(); toast('Sovgad la efase nan sèvè a.'); }
      }
      if (act === 'notif-on') {
        const r = await cloud.enableNotifications();
        if (r.ok) toast('Rapèl yo aktive.');
        else if (r.reason === 'denied') toast('Ou pa otorize notifikasyon yo.', 'error');
        else if (r.reason === 'unsupported') toast('Aparèy sa a pa sipòte notifikasyon.', 'error');
        else toast('Pa ka aktive rapèl yo. Verifye entènèt la epi eseye ankò.', 'error');
      }
      if (act === 'notif-off') { await cloud.disableNotifications(); toast('Rapèl yo dezaktive.'); }
    } catch (ex) {
      console.warn(ex);
      toast(errText(ex), 'error');
    }
    rerender();
  };

  body.onchange = async (e) => {
    if (e.target.dataset.act !== 'stats') return;
    await cloud.setStatsEnabled(e.target.checked);
    toast(e.target.checked ? 'Estatistik anonim aktive.' : 'Estatistik anonim ak rapèl yo dezaktive.');
    rerender();
  };
}
