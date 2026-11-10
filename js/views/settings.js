/* Fèy "Rapèl ak konfidansyalite": rapèl push + estatistik anonim. */
import { openSheet, toast } from '../ui.js';
import * as cloud from '../cloud.js';

export function openSettings() {
  openSheet({
    title: 'Rapèl ak konfidansyalite',
    html: '<div data-body></div>',
    onMount(el) { render(el); }
  });
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
      <section>
        <h3 class="sub-title">Rapèl otomatik</h3>
        ${notifBlock(state)}
      </section>
      <section>
        <h3 class="sub-title">Estatistik anonim</h3>
        <label class="switch-row">
          <span>Konte aparèy sa a nan estatistik yo</span>
          <input type="checkbox" data-act="stats" ${cloud.statsEnabled() ? 'checked' : ''}>
        </label>
        <p class="hint">Aplikasyon an voye yon idantifyan anonim, vèsyon an ak dat dènye ouvèti a. Si ou aktive rapèl yo, li voye tou yon jeton notifikasyon ak dat manch yo.
        <b>Pa gen okenn non moun, non sòl, ni montan.</b> Tout peman yo rete sou telefòn ou sèlman. Si ou dezaktive estatistik yo, rapèl yo sispann tou.</p>
      </section>
    </div>`;

  body.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.type === 'checkbox') return;
    b.disabled = true;
    if (b.dataset.act === 'notif-on') {
      const r = await cloud.enableNotifications();
      if (r.ok) toast('Rapèl yo aktive.');
      else if (r.reason === 'denied') toast('Ou pa otorize notifikasyon yo.', 'error');
      else if (r.reason === 'unsupported') toast('Aparèy sa a pa sipòte notifikasyon.', 'error');
      else toast('Pa ka aktive rapèl yo. Verifye entènèt la epi eseye ankò.', 'error');
    }
    if (b.dataset.act === 'notif-off') {
      await cloud.disableNotifications();
      toast('Rapèl yo dezaktive.');
    }
    render(sheet);
  };

  body.onchange = async (e) => {
    if (e.target.dataset.act !== 'stats') return;
    await cloud.setStatsEnabled(e.target.checked);
    toast(e.target.checked ? 'Estatistik anonim aktive.' : 'Estatistik anonim ak rapèl yo dezaktive.');
    render(sheet);
  };
}
