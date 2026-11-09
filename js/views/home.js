/* Paj dakèy: lis sòl yo + kreye yon nouvo sòl. */
import * as db from '../db.js';
import { htg, parseAmount } from '../format.js';
import { esc, openSheet, toast, LOGO } from '../ui.js';
import { promptInstall, canInstall } from '../install.js';
import { presetView } from './group.js';
import { FREQUENCIES, scheduleFieldsHTML } from '../schedule.js';

export async function showHome(app) {
  const items = await db.listGroupsOverview();

  const list = items.length
    ? `<ul class="group-list">${items.map(({ group, memberCount, collected, progress }) => `
        <li>
          <a class="group-row" href="#/g/${encodeURIComponent(group.id)}">
            <span class="group-main">
              <b>${esc(group.name)}</b>
              <small>${memberCount} manm · ${htg(group.amount)}${FREQUENCIES[group.frequency] ? ' ' + FREQUENCIES[group.frequency].short : ' pa manch'}</small>
            </span>
            <span class="group-side">
              <b>${htg(collected)}</b>
              <span class="bar light" aria-hidden="true"><span style="width:${Math.round(progress * 100)}%"></span></span>
            </span>
          </a>
        </li>`).join('')}</ul>`
    : `<div class="empty">
         <h2>Poko gen sòl</h2>
         <p>Kreye premye sòl ou a, ajoute manm yo, epi make peman yo kote ou ye a.</p>
         <button class="btn primary" data-action="new-group">Kreye yon sòl</button>
       </div>`;

  app.innerHTML = `
    <div class="hero">
      <div class="wrap">
        <div class="brand">${LOGO}<h1>SòlPèp</h1></div>
        <p class="tagline">Swiv chak peman nan sòl ou, menm san entènèt.</p>
      </div>
    </div>
    <main class="wrap">
      <h2 class="section-title">Sòl mwen yo</h2>
      ${list}
      <button class="btn ghost install" data-install data-action="install" ${canInstall() ? '' : 'hidden'}>Enstale aplikasyon an sou telefòn nan</button>
      <p class="footnote">Zouti sa a se yon kaye nimerik. Li pa jere lajan reyèl.<br>
      Done yo sere sou aparèy sa a sèlman. Ekspòte yon CSV regilyèman pou gen yon kopi.</p>
    </main>
    ${items.length ? '<button class="fab" data-action="new-group"><span aria-hidden="true">＋</span> Nouvo sòl</button>' : ''}`;

  app.onclick = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.action === 'new-group') openNewGroup();
    if (el.dataset.action === 'install') promptInstall();
  };
}

function openNewGroup() {
  openSheet({
    title: 'Nouvo sòl',
    html: `
      <form class="stack" novalidate>
        <label class="field"><span>Non sòl la</span>
          <input name="name" maxlength="60" autocomplete="off" placeholder="Ex: Sòl katye a" data-autofocus></label>
        <label class="field"><span>Montan pa manch (HTG)</span>
          <input name="amount" inputmode="decimal" autocomplete="off" placeholder="Ex: 1500"></label>
        ${scheduleFieldsHTML()}
        <p class="error" data-error hidden></p>
        <div class="actions">
          <button type="button" class="btn ghost" data-close>Anile</button>
          <button type="submit" class="btn primary">Kreye sòl la</button>
        </div>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const err = el.querySelector('[data-error]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        const amount = parseAmount(form.elements.amount.value);
        const frequency = form.elements.frequency.value;
        const startDate = form.elements.startDate.value;
        const fail = (msg) => { err.textContent = msg; err.hidden = false; };
        if (!name) return fail('Mete yon non pou sòl la.');
        if (amount === null || amount <= 0) return fail('Mete yon montan ki pi gran pase 0. Egzanp: 1500 oswa 1500,50.');
        if (!startDate) return fail('Chwazi dat premye manch la.');
        const group = await db.createGroup({ name, amount, frequency, startDate });
        presetView(group.id, 'members');
        close();
        location.hash = `#/g/${encodeURIComponent(group.id)}`;
        toast('Sòl la kreye. Ajoute manm yo.');
      });
    }
  });
}
