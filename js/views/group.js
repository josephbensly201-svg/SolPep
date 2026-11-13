/* Paj yon sòl: 3 onglè (Manch / Tablo / Manm), peman pasyèl, nòt, manm inaktif, ekspò CSV. */
import * as db from '../db.js';
import { scheduleSync } from '../cloud.js';
import { key, status } from '../calc.js';
import { htg, num, toInput, parseAmount } from '../format.js';
import { FREQUENCIES, dueDate, isPast, formatDate, formatDateShort, currentRound, scheduleFieldsHTML } from '../schedule.js';
import { esc, initial, openSheet, confirmDialog, toast, downloadFile, safeFilename } from '../ui.js';

const view = { id: null, tab: 'tour', round: null };
let data = null;
let root = null;

/** Pèmèt lòt paj chwazi onglè ouvèti a (ex: apre kreyasyon yon sòl). */
export function presetView(id, tab) {
  view.id = id;
  view.tab = tab;
  view.round = null;
}

export async function showGroup(app, id) {
  root = app;
  if (view.id !== id) presetView(id, 'tour');
  data = await db.getGroupData(id);
  if (!data) { location.hash = '#/'; return; }
  render();
  bind();
}

async function refresh() {
  data = await db.getGroupData(view.id);
  if (!data) { location.hash = '#/'; return; }
  render();
  scheduleSync();
}

/* ------------------------------------------------------------------ */
/* Rendu                                                               */
/* ------------------------------------------------------------------ */

function render() {
  const { group, members, calc } = data;
  if (view.round === null || view.round >= members.length) {
    const scheduled = currentRound(group, members.length);
    const open = calc.perRound.find((r) => r.got < r.expected);
    view.round = scheduled !== null ? scheduled : open ? open.round : 0;
  }

  const scrollY = window.scrollY;
  const matrixScroll = root.querySelector('.matrix-wrap')?.scrollLeft || 0;
  const coinsScroll = root.querySelector('.coins')?.scrollLeft || 0;

  const percent = Math.round(calc.progress * 100);
  root.innerHTML = `
    <div class="hero">
      <div class="wrap">
        <div class="topbar">
          <a class="icon-btn on-dark" href="#/" aria-label="Retounen nan lis sòl yo">‹</a>
          <div class="titles">
            <h1>${esc(group.name)}</h1>
            <p>${htg(group.amount)} ${FREQUENCIES[group.frequency] ? FREQUENCIES[group.frequency].short : 'pa manch'} · ${calc.activeCount} manm aktif${group.status === 'finished' ? ' · fini' : group.status === 'archived' ? ' · achive' : ''}</p>
          </div>
          <button class="icon-btn on-dark" data-action="menu" aria-label="Plis opsyon">⋯</button>
        </div>
        <div class="pot">
          <p class="pot-label">Lajan kolekte</p>
          <p class="pot-amount">${htg(calc.collected)}</p>
          <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Pwogrè kolèk"><span style="width:${percent}%"></span></div>
          <p class="pot-meta">Rete pou kolekte: <b>${htg(calc.remaining)}</b></p>
        </div>
      </div>
    </div>
    <div class="tabs-bar"><div class="wrap">
      <div class="tabs" role="tablist">
        ${tabButton('tour', 'Manch')}${tabButton('table', 'Tablo')}${tabButton('members', 'Manm')}
      </div>
    </div></div>
    <main class="wrap ${group.status !== 'active' ? 'ro' : ''}" role="tabpanel">
      ${statusBanner()}
      ${view.tab === 'tour' ? renderRounds() : view.tab === 'table' ? renderMatrix() : renderMembers()}
    </main>`;

  window.scrollTo(0, scrollY);
  const mw = root.querySelector('.matrix-wrap'); if (mw) mw.scrollLeft = matrixScroll;
  const cs = root.querySelector('.coins'); if (cs) cs.scrollLeft = coinsScroll;
}

const tabButton = (id, label) =>
  `<button role="tab" class="tab ${view.tab === id ? 'on' : ''}" aria-selected="${view.tab === id}" data-action="tab" data-tab="${id}">${label}</button>`;

function emptyMembers() {
  return `<div class="empty">
    <h2>Poko gen manm</h2>
    <p>Ajoute manm yo nan lòd yo ap resevwa manch la. Chak manm kreye yon manch.</p>
    <button class="btn primary" data-action="goto-members">Ajoute manm</button>
  </div>`;
}

/* ----- Onglè Manch ----- */
function renderRounds() {
  const { group, members, calc } = data;
  if (!members.length) return emptyMembers();
  const round = calc.perRound[view.round];
  const ben = round.beneficiary;
  const complete = round.expected > 0 && round.got >= round.expected;
  const due = dueDate(group, view.round);
  const late = isPast(due);

  const coins = calc.perRound.map((r) => {
    const done = r.expected > 0 && r.got >= r.expected;
    return `<button class="coin ${r.round === view.round ? 'on' : ''} ${done ? 'done' : ''} ${r.beneficiary.active ? '' : 'off'}"
        data-action="pick-round" data-round="${r.round}" aria-label="Manch ${r.round + 1}, ${esc(r.beneficiary.name)}${done ? ', konplè' : ''}">
        <span class="coin-face">${esc(initial(r.beneficiary.name))}</span>
        <span class="coin-label">M${r.round + 1}</span>
      </button>`;
  }).join('');

  const rows = members.map((m) => {
    const p = calc.map.get(key(m.id, view.round));
    const paid = p ? p.amount : 0;
    const st = status(paid, group.amount);
    const overdue = late && st !== 'full';
    const label = st === 'full' ? 'Peye nèt'
      : st === 'part' ? (overdue ? 'Peye yon pati · an reta' : 'Peye yon pati')
      : (overdue ? 'An reta' : 'Poko peye');
    const isBen = m.id === ben.id;
    return `<li><button class="row ${st} ${m.active ? '' : 'inactive'}" data-action="pay" data-member="${esc(m.id)}" data-round="${view.round}"
        ${m.active ? '' : 'aria-disabled="true"'}>
        <span class="avatar">${esc(initial(m.name))}</span>
        <span class="who">
          <b>${esc(m.name)}${m.active ? '' : ' <i class="tag">inaktif</i>'}${isBen ? ' <i class="tag gold">resevwa manch la</i>' : ''}</b>
          <small>${label}${p && p.note ? ' · 📝 ' + esc(p.note.length > 28 ? p.note.slice(0, 28) + '…' : p.note) : ''}</small>
        </span>
        <span class="amt"><b>${htg(paid)}</b><small>sou ${htg(group.amount)}</small></span>
      </button></li>`;
  }).join('');

  return `
    <div class="coins" role="group" aria-label="Chwazi yon manch">${coins}</div>
    <section class="round-head">
      <p class="round-kicker">Manch ${view.round + 1}${complete ? ' · konplè' : ''}</p>
      <h2>${esc(ben.name)}${ben.active ? '' : ' (inaktif)'} resevwa manch la</h2>
      ${due ? `<p class="round-date ${late && !complete ? 'late' : ''}">📅 ${formatDate(due)}${late && !complete ? ' · dat la pase' : ''}</p>` : ''}
      <p class="round-sum"><b>${htg(round.got)}</b> kolekte sou ${htg(round.expected)}</p>
    </section>
    <ul class="rows">${rows}</ul>`;
}

/* ----- Onglè Tablo ----- */
function renderMatrix() {
  const { group, members, calc } = data;
  if (!members.length) return emptyMembers();

  const head = calc.perRound.map((r) =>
    `<th scope="col" class="${r.round === view.round ? 'cur' : ''}"><span class="th-t">M${r.round + 1}</span><span class="th-b">${esc(initial(r.beneficiary.name))}</span></th>`
  ).join('');

  const body = calc.perMember.map(({ member: m, paid }) => {
    const cells = members.map((_, r) => {
      const p = calc.map.get(key(m.id, r));
      const amt = p ? p.amount : 0;
      const st = status(amt, group.amount);
      const isBen = members[r].id === m.id;
      return `<td><button class="cell ${st} ${isBen ? 'ben' : ''} ${p && p.note ? 'has-note' : ''}" data-action="pay" data-member="${esc(m.id)}" data-round="${r}"
          aria-label="${esc(m.name)}, manch ${r + 1}: ${htg(amt)}">${amt > 0 ? num(amt) : '—'}</button></td>`;
    }).join('');
    return `<tr class="${m.active ? '' : 'inactive'}"><th scope="row"><span class="name">${esc(m.name)}</span></th>${cells}<td class="sum">${num(paid)}</td></tr>`;
  }).join('');

  const foot = calc.perRound.map((r) => `<td>${num(r.got)}</td>`).join('');

  return `
    <p class="hint">Touche yon kaz pou antre montan an ak yon nòt. Kare jòn nan make moun ki resevwa manch la.</p>
    <div class="matrix-wrap"><table class="matrix">
      <thead><tr><th scope="col" class="corner">Manm</th>${head}<th scope="col" class="sum">Total</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><th scope="row">Kolekte</th>${foot}<td class="sum">${num(calc.collected)}</td></tr></tfoot>
    </table></div>`;
}

/* ----- Onglè Manm ----- */
function renderMembers() {
  const { members, calc } = data;
  const list = calc.perMember.map(({ member: m, paid, owed, rest }) => {
    const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0;
    return `<li class="member ${m.active ? '' : 'inactive'}">
      <div class="member-top">
        <span class="avatar">${esc(initial(m.name))}</span>
        <span class="who"><b>${esc(m.name)}</b><small>Manch ${m.order >= 0 ? members.indexOf(m) + 1 : ''}${m.active ? '' : ' · inaktif'}</small></span>
        <span class="amt">
          ${m.active
            ? `<b>${rest > 0 ? 'Rete ' + htg(rest) : 'Ajou ✓'}</b>`
            : `<b>Inaktif</b>`}
        </span>
      </div>
      <div class="member-totals"><span>Peye <b>${htg(paid)}</b></span><span>Dwe <b>${m.active ? htg(owed) : '—'}</b></span></div>
      <div class="bar light" aria-hidden="true"><span style="width:${m.active ? pct : 0}%"></span></div>
      <div class="member-actions">
        <button class="link" data-action="rename-member" data-member="${esc(m.id)}">Chanje non</button>
        ${m.active
          ? `<button class="link danger" data-action="deactivate-member" data-member="${esc(m.id)}">Dezaktive</button>`
          : `<button class="link" data-action="reactivate-member" data-member="${esc(m.id)}">Reaktive</button>`}
      </div>
    </li>`;
  }).join('');

  return `
    <form class="add-member" data-form="add-member" novalidate>
      <input name="name" maxlength="40" autocomplete="off" placeholder="Non nouvo manm nan" aria-label="Non nouvo manm nan">
      <button class="btn gold" type="submit">Ajoute</button>
    </form>
    <p class="hint">Lòd la se lòd resevwa manch la. Chak manm ou ajoute kreye yon nouvo manch.</p>
    ${members.length ? `<ul class="members">${list}</ul>` : ''}`;
}

/* ------------------------------------------------------------------ */
/* Evènman                                                             */
/* ------------------------------------------------------------------ */

function bind() {
  root.onclick = async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, member, round, tab } = el.dataset;
    switch (action) {
      case 'tab': view.tab = tab; render(); break;
      case 'pick-round': view.round = Number(round); render(); break;
      case 'goto-members': view.tab = 'members'; render(); root.querySelector('.add-member input')?.focus(); break;
      case 'pay': if (blocked()) break; openPayment(member, Number(round)); break;
      case 'menu': openMenu(); break;
      case 'reactivate-sol': openReactivate(); break;
      case 'finish-sol': finishSol(); break;
      case 'rename-member': if (blocked()) break; openRename(member); break;
      case 'deactivate-member': if (blocked()) break; deactivate(member); break;
      case 'reactivate-member':
        if (blocked()) break;
        await db.setMemberActive(member, true);
        await refresh();
        toast('Manm nan aktif ankò.');
        break;
    }
  };

  root.onsubmit = async (e) => {
    e.preventDefault();
    if (e.target.dataset.form !== 'add-member') return;
    const input = e.target.elements.name;
    const name = input.value.trim();
    if (!name) { toast('Mete yon non pou manm nan.', 'error'); input.focus(); return; }
    if (data.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      toast('Gen yon manm ki gen non sa a deja. Ajoute yon lèt pou diferansye yo.', 'error');
      return;
    }
    await db.addMember(view.id, name);
    await refresh();
    root.querySelector('.add-member input')?.focus();
    toast(`${name} ajoute.`);
  };
}

/* ----- Peman (montan pasyèl + nòt) ----- */
function openPayment(memberId, round) {
  const m = data.members.find((x) => x.id === memberId);
  if (!m) return;
  if (!m.active) { toast('Manm sa a inaktif. Reaktive li pou modifye peman.', 'error'); return; }

  const due = data.group.amount;
  const existing = data.calc.map.get(key(memberId, round));
  const ben = data.members[round];

  openSheet({
    title: m.name,
    html: `
      <p class="sheet-sub">Manch ${round + 1} · ${esc(ben.name)} resevwa manch la</p>
      <form class="stack" novalidate>
        <label class="field"><span>Montan peye (HTG)</span>
          <input name="amount" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${toInput(existing ? existing.amount : 0)}" data-autofocus></label>
        <p class="hint live" data-live></p>
        <div class="quick">
          <button type="button" class="chip-btn" data-fill="full">Peye nèt</button>
          <button type="button" class="chip-btn" data-fill="half">Mwatye</button>
          <button type="button" class="chip-btn" data-fill="clear">Vide</button>
        </div>
        <label class="field"><span>Nòt (opsyonèl)</span>
          <textarea name="note" rows="3" maxlength="280" placeholder="Ex: li ap konplete vandredi">${esc(existing ? existing.note : '')}</textarea></label>
        <p class="error" data-error hidden></p>
        <div class="actions">
          <button type="submit" class="btn primary">Sove</button>
        </div>
        ${existing ? '<button type="button" class="link danger center" data-erase>Efase peman sa a</button>' : ''}
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const amountInput = form.elements.amount;
      const live = el.querySelector('[data-live]');
      const err = el.querySelector('[data-error]');

      const updateLive = () => {
        const v = parseAmount(amountInput.value);
        if (v === null) { live.textContent = 'Montan an pa valab.'; return; }
        const left = Math.round((due - v) * 100) / 100;
        live.innerHTML = left > 0 ? `Dwe: <b>${htg(due)}</b> · Rete: <b>${htg(left)}</b>`
          : left === 0 ? `Dwe: <b>${htg(due)}</b> · <b>Peye nèt ✓</b>`
          : `Dwe: <b>${htg(due)}</b> · Depase ak <b>${htg(-left)}</b>`;
      };
      updateLive();
      amountInput.addEventListener('input', () => { err.hidden = true; updateLive(); });

      el.querySelector('.quick').addEventListener('click', (e) => {
        const b = e.target.closest('[data-fill]');
        if (!b) return;
        const kind = b.dataset.fill;
        amountInput.value = kind === 'full' ? toInput(due) : kind === 'half' ? toInput(Math.round(due * 50) / 100) : '';
        updateLive();
        amountInput.focus();
      });

      const save = async (amount, note) => {
        await db.savePayment({ groupId: view.id, memberId, round, amount, note });
        close();
        await refresh();
        toast('Peman sove.');
      };

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseAmount(amountInput.value);
        const note = form.elements.note.value;
        if (amount === null) {
          err.textContent = 'Montan an pa valab. Egzanp: 1500 oswa 1500,50.';
          err.hidden = false;
          return;
        }
        if (amount === 0 && existing && existing.amount > 0 && !note.trim()) {
          const ok = await confirmDialog({
            title: 'Efase peman an?',
            message: `Ou vle retire ${htg(existing.amount)} ke ${m.name} te peye pou manch ${round + 1} lan?`,
            confirmLabel: 'Efase', danger: true
          });
          if (!ok) return;
        }
        await save(amount, note);
      });

      const erase = el.querySelector('[data-erase]');
      if (erase) erase.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Efase peman an?',
          message: `Sa ap efase montan an ak nòt la pou ${m.name}, manch ${round + 1}.`,
          confirmLabel: 'Efase', danger: true
        });
        if (ok) await save(0, '');
      });
    }
  });
}

/* ----- Manm: chanje non / dezaktive ----- */
function openRename(memberId) {
  const m = data.members.find((x) => x.id === memberId);
  if (!m) return;
  openSheet({
    title: 'Chanje non manm nan',
    html: `
      <form class="stack" novalidate>
        <label class="field"><span>Non</span>
          <input name="name" maxlength="40" autocomplete="off" value="${esc(m.name)}" data-autofocus></label>
        <p class="error" data-error hidden></p>
        <div class="actions">
          <button type="button" class="btn ghost" data-close>Anile</button>
          <button type="submit" class="btn primary">Sove</button>
        </div>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const err = el.querySelector('[data-error]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        if (!name) { err.textContent = 'Mete yon non.'; err.hidden = false; return; }
        if (data.members.some((x) => x.id !== m.id && x.name.toLowerCase() === name.toLowerCase())) {
          err.textContent = 'Gen yon lòt manm ki gen non sa a deja.'; err.hidden = false; return;
        }
        await db.renameMember(m.id, name);
        close();
        await refresh();
        toast('Non an chanje.');
      });
    }
  });
}

async function deactivate(memberId) {
  const m = data.members.find((x) => x.id === memberId);
  if (!m) return;
  const ok = await confirmDialog({
    title: `Dezaktive ${m.name}?`,
    message: 'Manm nan ap vin griz epi li pap dwe anyen ankò. Peman li fè yo rete sere, e ou ka reaktive li nenpòt ki lè. Anyen pa efase nèt.',
    confirmLabel: 'Dezaktive', danger: true
  });
  if (!ok) return;
  await db.setMemberActive(memberId, false);
  await refresh();
  toast(`${m.name} dezaktive.`);
}

/* ----- Menu sòl la ----- */
function openMenu() {
  const g = data.group;
  const ro = g.status !== 'active';
  openSheet({
    title: g.name,
    html: `
      <div class="menu">
        ${ro
          ? '<button class="menu-item" data-act="reactivate">Reaktive sòl la (bezwen kòd)</button>'
          : `<button class="menu-item" data-act="edit">Chanje non, montan oswa frekans</button>
             <button class="menu-item" data-act="code">Wè kòd sòl la</button>`}
        <button class="menu-item" data-act="csv">Ekspòte an CSV</button>
        ${ro ? '' : `<button class="menu-item" data-act="finish">Make sòl la fini</button>
             <button class="menu-item danger" data-act="archive">Achive sòl la (mete l nan istorik)</button>`}
      </div>`,
    onMount(el, close) {
      el.querySelector('.menu').addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        close();
        const actions = { edit: openEditGroup, csv: exportCsv, code: openCodeView, reactivate: openReactivate, finish: finishSol, archive: archiveSol };
        if (actions[b.dataset.act]) actions[b.dataset.act]();
      });
    }
  });
}

/* ----- Estati: achive / fini / reaktive (anyen pa efase nèt) ----- */
function blocked() {
  if (data.group.status === 'active') return false;
  toast('Sòl sa a nan istorik. Reaktive l ak kòd li pou modifye l.', 'error');
  return true;
}

function statusBanner() {
  const g = data.group;
  if (g.status !== 'active') {
    return `<div class="ro-banner"><b>${g.status === 'finished' ? 'Sòl sa a fini.' : 'Sòl sa a achive.'}</b>
      <span>Li nan istorik epi li griz. Pou modifye l ankò, reaktive l ak kòd li.</span>
      <button class="btn gold" data-action="reactivate-sol">Reaktive ak kòd</button></div>`;
  }
  const allDone = data.members.length > 0 && data.calc.perRound.every((r) => r.expected > 0 && r.got >= r.expected);
  if (allDone) {
    return `<div class="done-banner"><b>Tout manch yo kolekte 🎉</b><span>Sòl la fini. Mete l nan istorik?</span>
      <button class="btn primary" data-action="finish-sol">Make sòl la fini</button></div>`;
  }
  return '';
}

async function archiveSol() {
  const g = data.group;
  const ok = await confirmDialog({
    title: 'Achive sòl la?',
    message: `"${g.name}" ap vin griz epi ale nan Istorik. Anyen pa efase. Pou reaktive l, ou ap bezwen kòd li a: ${g.code}. Note l kounye a.`,
    confirmLabel: 'Achive', danger: true
  });
  if (!ok) return;
  await db.setGroupStatus(g.id, 'archived');
  scheduleSync();
  location.hash = '#/';
  toast('Sòl la nan istorik.');
}

async function finishSol() {
  const g = data.group;
  const ok = await confirmDialog({
    title: 'Make sòl la fini?',
    message: `Sòl la ap ale nan Istorik epi li pap modifyab ankò. Pou reaktive l, ou ap bezwen kòd li a: ${g.code}.`,
    confirmLabel: 'Make fini'
  });
  if (!ok) return;
  await db.setGroupStatus(g.id, 'finished');
  await refresh();
  toast('Sòl la fini. Li nan istorik.');
}

function openCodeView() {
  const g = data.group;
  openSheet({
    title: 'Kòd sòl la',
    html: `
      <p class="sheet-sub">Chak sòl gen yon kòd inik. Ou bezwen l pou reaktive sòl la si l nan istorik.</p>
      <p class="code-big">${esc(g.code)}</p>
      <div class="actions">
        <button type="button" class="btn ghost" data-copy>Kopye</button>
        <button type="button" class="btn primary" data-close>Fèmen</button>
      </div>
      <p class="hint">Note kòd la yon kote ou sèlman ka jwenn li (kaye, mesaj ba tèt ou). Pa pataje l ak lòt moun.</p>`,
    onMount(el) {
      el.querySelector('[data-copy]').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(g.code); toast('Kòd la kopye.'); }
        catch { toast('Pa ka kopye. Note l a la men.', 'error'); }
      });
    }
  });
}

let codeFails = 0, lockUntil = 0;
function openReactivate() {
  const g = data.group;
  openSheet({
    title: 'Reaktive sòl la',
    html: `
      <form class="stack" novalidate>
        <p class="sheet-sub">Antre kòd sòl "${esc(g.name)}" la pou reaktive l.</p>
        <label class="field"><span>Kòd sòl la</span>
          <input name="code" autocomplete="off" autocapitalize="characters" placeholder="SOL-XXXXXX" data-autofocus></label>
        <p class="error" data-error hidden></p>
        <div class="actions">
          <button type="button" class="btn ghost" data-close>Anile</button>
          <button type="submit" class="btn primary">Reaktive</button>
        </div>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const err = el.querySelector('[data-error]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        if (Date.now() < lockUntil) return fail('Twòp esè. Tann kèk segonn epi eseye ankò.');
        if (!db.codeMatches(form.elements.code.value, g.code)) {
          codeFails++;
          if (codeFails >= 5) { lockUntil = Date.now() + 30000; codeFails = 0; }
          return fail('Kòd la pa kòrèk.');
        }
        codeFails = 0;
        await db.setGroupStatus(g.id, 'active');
        close();
        await refresh();
        toast('Sòl la reaktive.');
      });
    }
  });
}

function openEditGroup() {
  const g = data.group;
  openSheet({
    title: 'Modifye sòl la',
    html: `
      <form class="stack" novalidate>
        <label class="field"><span>Non sòl la</span>
          <input name="name" maxlength="60" autocomplete="off" value="${esc(g.name)}" data-autofocus></label>
        <label class="field"><span>Montan pa manch (HTG)</span>
          <input name="amount" inputmode="decimal" autocomplete="off" value="${toInput(g.amount)}"></label>
        ${scheduleFieldsHTML(g)}
        <p class="hint">Si ou chanje montan an oswa dat yo, tout total ak dat manch yo ap rekalkile.</p>
        <p class="error" data-error hidden></p>
        <div class="actions">
          <button type="button" class="btn ghost" data-close>Anile</button>
          <button type="submit" class="btn primary">Sove</button>
        </div>
      </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const err = el.querySelector('[data-error]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.elements.name.value.trim();
        const amount = parseAmount(form.elements.amount.value);
        if (!name) { err.textContent = 'Mete yon non pou sòl la.'; err.hidden = false; return; }
        if (amount === null || amount <= 0) { err.textContent = 'Mete yon montan ki pi gran pase 0.'; err.hidden = false; return; }
        const startDate = form.elements.startDate.value;
        if (!startDate) { err.textContent = 'Chwazi dat premye manch la.'; err.hidden = false; return; }
        await db.updateGroup(g.id, { name, amount, frequency: form.elements.frequency.value, startDate });
        close();
        await refresh();
        toast('Sòl la modifye.');
      });
    }
  });
}

/* ----- Ekspò CSV (separatè ";" ak vigil desimal pou Excel/LibreOffice an fransè) ----- */
function exportCsv() {
  const { group, members, calc } = data;
  const dec = (v) => String(v).replace('.', ',');
  const cell = (v) => {
    const s = String(v ?? '');
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = [];
  rows.push(['Sòl', group.name]);
  rows.push(['Montan pa manch (HTG)', dec(group.amount)]);
  if (FREQUENCIES[group.frequency]) rows.push(['Frekans', FREQUENCIES[group.frequency].label]);
  rows.push([]);
  rows.push(['Manm', 'Estati', ...members.map((_, r) => { const d = dueDate(group, r); return d ? `Manch ${r + 1} (${formatDateShort(d)})` : `Manch ${r + 1}`; }), 'Total peye (HTG)', 'Total dwe (HTG)', 'Rete (HTG)']);
  calc.perMember.forEach(({ member: m, paid, owed, rest }) => {
    const row = [m.name, m.active ? 'Aktif' : 'Inaktif'];
    members.forEach((_, r) => { const p = calc.map.get(key(m.id, r)); row.push(dec(p ? p.amount : 0)); });
    row.push(dec(paid), m.active ? dec(owed) : '', m.active ? dec(rest) : '');
    rows.push(row);
  });
  rows.push(['Total kolekte', '', ...calc.perRound.map((r) => dec(r.got)), dec(calc.collected), '', '']);

  const notes = data.payments.filter((p) => p.note);
  if (notes.length) {
    rows.push([]);
    rows.push(['Nòt', 'Manm', 'Manch', 'Montan (HTG)']);
    notes.forEach((p) => {
      const m = members.find((x) => x.id === p.memberId);
      rows.push([p.note, m ? m.name : '?', p.round + 1, dec(p.amount)]);
    });
  }

  const csv = '\ufeff' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  downloadFile(`sol-${safeFilename(group.name)}.csv`, csv, 'text/csv;charset=utf-8');
  toast('Fichye CSV la telechaje.');
}
