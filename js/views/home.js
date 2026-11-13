/* Paj dakèy: sòl aktif yo + istorik (sòl fini oswa achive) + kreye yon nouvo sòl. */
import * as db from '../db.js';
import { htg, parseAmount } from '../format.js';
import { esc, openSheet, toast, LOGO } from '../ui.js';
import { promptInstall, canInstall } from '../install.js';
import { presetView } from './group.js';
import { openSettings } from './settings.js';
import { scheduleSync } from '../cloud.js';
import { isSignedIn } from '../sync.js';
import { FREQUENCIES, scheduleFieldsHTML } from '../schedule.js';

let tab = 'active';   // 'active' | 'history'
const statusOf = (g) => g.status || 'active';
const STATUS_LABEL = { finished: 'Fini', archived: 'Achive' };

export async function showHome(app) {
  const items = await db.listGroupsOverview();
  const active = items.filter((i) => statusOf(i.group) === 'active');
  const history = items.filter((i) => statusOf(i.group) !== 'active');
  const shown = tab === 'history' ? history : active;

  const rows = shown.map(({ group, memberCount, collected, progress }) => {
    const st = statusOf(group);
    return `
      <li>
        <a class="group-row ${st !== 'active' ? 'dim' : ''}" href="#/g/${encodeURIComponent(group.id)}">
          <span class="group-main">
            <b>${esc(group.name)}${st !== 'active' ? ` <i class="tag">${STATUS_LABEL[st] || ''}</i>` : ''}</b>
            <small>${memberCount} manm · ${htg(group.amount)}${FREQUENCIES[group.frequency] ? ' ' + FREQUENCIES[group.frequency].short : ' pa manch'}</small>
          </span>
          <span class="group-side">
            <b>${htg(collected)}</b>
            <span class="bar light" aria-hidden="true"><span style="width:${Math.round(progress * 100)}%"></span></span>
          </span>
        </a>
      </li>`;
  }).join('');

  let body;
  if (shown.length) body = `<ul class="group-list">${rows}</ul>`;
  else if (tab === 'history') {
    body = `<div class="empty"><h2>Istorik la vid</h2><p>Sòl ou fini oswa achive yo ap parèt isit la, grize. Anyen pa janm efase nèt.</p></div>`;
  } else {
    body = `<div class="empty"><h2>Poko gen sòl</h2>
      <p>Kreye premye sòl ou a, ajoute manm yo, epi make peman yo kote ou ye a.</p>
      <button class="btn primary" data-action="new-group">Kreye yon sòl</button></div>`;
  }

  app.innerHTML = `
    <div class="hero">
      <div class="wrap">
        <div class="brand">${LOGO}<h1>SòlPèp</h1></div>
        <p class="tagline">Swiv chak peman nan sòl ou, menm san entènèt.</p>
      </div>
    </div>
    <main class="wrap">
      ${isSignedIn() ? '' : `<section class="backup-card">
        <b>Pwoteje sòl ou yo</b>
        <span>Si ou pèdi telefòn nan, ou pèdi sòl yo. Konekte ak Google pou sove yo, epi rekipere yo sou nenpòt telefòn.</span>
        <button class="btn gold" data-action="settings">Kontinye ak Google</button>
      </section>`}
      <div class="tabs two home-tabs" role="tablist">
        <button role="tab" class="tab ${tab === 'active' ? 'on' : ''}" aria-selected="${tab === 'active'}" data-action="home-tab" data-tab="active">Aktif (${active.length})</button>
        <button role="tab" class="tab ${tab === 'history' ? 'on' : ''}" aria-selected="${tab === 'history'}" data-action="home-tab" data-tab="history">Istorik (${history.length})</button>
      </div>
      ${body}
      <button class="btn ghost install" data-install data-action="install" ${canInstall() ? '' : 'hidden'}>Enstale aplikasyon an sou telefòn nan</button>
      <p class="footnote">Zouti sa a se yon kaye nimerik. Li pa jere lajan reyèl.<br>
      Pou pa pèdi sòl ou si telefòn nan pèdi, aktive sovgad kont lan.</p>
      <button class="link" data-action="settings">Kont, sovgad ak rapèl</button>
    </main>
    ${tab === 'active' && active.length ? '<button class="fab" data-action="new-group"><span aria-hidden="true">＋</span> Nouvo sòl</button>' : ''}`;

  app.onclick = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'new-group') openNewGroup();
    if (a === 'install') promptInstall();
    if (a === 'settings') openSettings();
    if (a === 'home-tab') { tab = el.dataset.tab; showHome(app); }
  };
  scheduleSync();
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
        <p class="hint">Sòl la ap jwenn yon kòd inik. Ou ap bezwen l pou reaktive sòl la si ou achive l.</p>
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
        tab = 'active';
        presetView(group.id, 'members');
        close();
        location.hash = `#/g/${encodeURIComponent(group.id)}`;
        toast(`Sòl la kreye. Kòd li: ${group.code}`);
      });
    }
  });
}
