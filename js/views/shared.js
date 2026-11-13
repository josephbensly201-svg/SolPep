/* Vèsyon "gade sèlman" yon sòl pataje: manm yo wè ak verifye, yo pa ka modifye anyen. */
import { fetchShare } from '../share.js';
import { compute, key, status } from '../calc.js';
import { htg, num } from '../format.js';
import { FREQUENCIES, dueDate, isPast, formatDate, currentRound } from '../schedule.js';
import { esc, initial, LOGO } from '../ui.js';

const view = { token: null, tab: 'tour', round: null };

const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function shell(inner) {
  return `<div class="hero"><div class="wrap">
      <div class="brand">${LOGO}<h1>SòlPèp</h1></div>
    </div></div>
    <main class="wrap">${inner}</main>`;
}

export async function showShared(app, token) {
  if (view.token !== token) { view.token = token; view.tab = 'tour'; view.round = null; }
  app.innerHTML = shell('<p class="hint">Chajman…</p>');
  const r = await fetchShare(token);

  if (r.missing) {
    app.innerHTML = shell(`<div class="empty"><h2>Lyen sa a pa valab</h2>
      <p>Li ka ekspire, oswa òganizatè a ka retire aksè a. Mande l yon nouvo lyen.</p>
      <a class="btn primary" href="#/">Louvri SòlPèp</a></div>`);
    app.onclick = null;
    return;
  }
  if (r.error) {
    app.innerHTML = shell(`<div class="empty"><h2>Pa gen entènèt</h2>
      <p>Pa ka chaje sòl la kounye a. Verifye koneksyon an epi eseye ankò.</p>
      <button class="btn primary" data-action="reload">Eseye ankò</button></div>`);
    app.onclick = (e) => { if (e.target.closest('[data-action=reload]')) showShared(app, token); };
    return;
  }
  draw(app, token, r);
}

function draw(app, token, info) {
  const d = info.doc;
  const group = { name: d.name, amount: Number(d.amount) || 0, frequency: d.frequency || '', startDate: d.startDate || '' };
  const members = (d.members || []).map((m) => ({ id: m.id, name: m.name, active: m.active !== false, order: m.order }))
    .sort((a, b) => a.order - b.order);
  const payments = (d.payments || []).map((p) => ({ id: key(p.m, p.r), memberId: p.m, round: p.r, amount: Number(p.a) || 0 }));
  const calc = compute(group, members, payments);

  if (view.round === null || view.round >= members.length) {
    const sched = currentRound(group, members.length);
    const open = calc.perRound.find((r) => r.got < r.expected);
    view.round = sched !== null ? sched : open ? open.round : 0;
  }

  const percent = Math.round(calc.progress * 100);
  const statusNote = d.status === 'finished' ? 'Sòl sa a fini.' : d.status === 'archived' ? 'Sòl sa a achive.' : '';
  const tabBtn = (id, label) => `<button role="tab" class="tab ${view.tab === id ? 'on' : ''}" aria-selected="${view.tab === id}" data-action="tab" data-tab="${id}">${label}</button>`;

  app.innerHTML = `
    <div class="hero"><div class="wrap">
      <div class="topbar">
        <div class="titles"><h1>${esc(group.name)}</h1>
          <p>${htg(group.amount)} ${FREQUENCIES[group.frequency] ? FREQUENCIES[group.frequency].short : 'pa manch'} · ${calc.activeCount} manm aktif</p></div>
      </div>
      <div class="pot">
        <p class="pot-label">Lajan kolekte</p>
        <p class="pot-amount">${htg(calc.collected)}</p>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
        <p class="pot-meta">Rete pou kolekte: <b>${htg(calc.remaining)}</b></p>
      </div>
    </div></div>
    <div class="view-only"><div class="wrap">
      <span>👁 Gade sèlman: ou pa ka modifye anyen.</span>
      <span class="view-time">Mizajou ${fmtTime(d.updatedAt)}${info.stale ? ' · pa gen entènèt (dènye vèsyon ou te wè)' : ''}</span>
      <button class="link" data-action="refresh">Rafrechi</button>
    </div></div>
    <div class="tabs-bar"><div class="wrap"><div class="tabs" role="tablist">
      ${tabBtn('tour', 'Manch')}${tabBtn('table', 'Tablo')}${tabBtn('members', 'Manm')}
    </div></div></div>
    <main class="wrap">
      ${statusNote ? `<div class="ro-banner"><b>${statusNote}</b></div>` : ''}
      ${!members.length ? '<div class="empty"><h2>Poko gen manm</h2></div>'
        : view.tab === 'tour' ? roundsView(group, members, calc)
        : view.tab === 'table' ? matrixView(group, members, calc)
        : membersView(calc)}
      <p class="footnote">Done sa yo soti nan telefòn òganizatè a. Si yon bagay pa parèt kòrèk, mande l.<br>
      <a class="link" href="#/">Fè pwòp sòl pa ou ak SòlPèp</a></p>
    </main>`;

  app.onclick = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'tab') { view.tab = el.dataset.tab; draw(app, token, info); }
    if (a === 'pick-round') { view.round = Number(el.dataset.round); draw(app, token, info); }
    if (a === 'refresh') showShared(app, token);
  };
}

function roundsView(group, members, calc) {
  const round = calc.perRound[view.round];
  const ben = round.beneficiary;
  const due = dueDate(group, view.round);
  const late = isPast(due);
  const complete = round.expected > 0 && round.got >= round.expected;

  const coins = calc.perRound.map((r) => {
    const done = r.expected > 0 && r.got >= r.expected;
    return `<button class="coin ${r.round === view.round ? 'on' : ''} ${done ? 'done' : ''}" data-action="pick-round" data-round="${r.round}" aria-label="Manch ${r.round + 1}, ${esc(r.beneficiary.name)}">
      <span class="coin-face">${esc(initial(r.beneficiary.name))}</span><span class="coin-label">M${r.round + 1}</span></button>`;
  }).join('');

  const rows = members.map((m) => {
    const p = calc.map.get(key(m.id, view.round));
    const paid = p ? p.amount : 0;
    const st = status(paid, group.amount);
    const overdue = late && st !== 'full';
    const label = st === 'full' ? 'Peye nèt' : st === 'part' ? (overdue ? 'Peye yon pati · an reta' : 'Peye yon pati') : (overdue ? 'An reta' : 'Poko peye');
    return `<li><div class="row ${st} ${m.active ? '' : 'inactive'}">
      <span class="avatar">${esc(initial(m.name))}</span>
      <span class="who"><b>${esc(m.name)}${m.active ? '' : ' <i class="tag">inaktif</i>'}${m.id === ben.id ? ' <i class="tag gold">resevwa manch la</i>' : ''}</b><small>${label}</small></span>
      <span class="amt"><b>${htg(paid)}</b><small>sou ${htg(group.amount)}</small></span></div></li>`;
  }).join('');

  return `<div class="coins" role="group" aria-label="Chwazi yon manch">${coins}</div>
    <section class="round-head">
      <p class="round-kicker">Manch ${view.round + 1}${complete ? ' · konplè' : ''}</p>
      <h2>${esc(ben.name)} resevwa manch la</h2>
      ${due ? `<p class="round-date ${late && !complete ? 'late' : ''}">📅 ${formatDate(due)}${late && !complete ? ' · dat la pase' : ''}</p>` : ''}
      <p class="round-sum"><b>${htg(round.got)}</b> kolekte sou ${htg(round.expected)}</p>
    </section><ul class="rows">${rows}</ul>`;
}

function matrixView(group, members, calc) {
  const head = calc.perRound.map((r) => `<th scope="col" class="${r.round === view.round ? 'cur' : ''}"><span class="th-t">M${r.round + 1}</span><span class="th-b">${esc(initial(r.beneficiary.name))}</span></th>`).join('');
  const body = calc.perMember.map(({ member: m, paid }) => {
    const cells = members.map((_, r) => {
      const p = calc.map.get(key(m.id, r));
      const amt = p ? p.amount : 0;
      return `<td><div class="cell ${status(amt, group.amount)} ${members[r].id === m.id ? 'ben' : ''}">${amt > 0 ? num(amt) : '—'}</div></td>`;
    }).join('');
    return `<tr class="${m.active ? '' : 'inactive'}"><th scope="row"><span class="name">${esc(m.name)}</span></th>${cells}<td class="sum">${num(paid)}</td></tr>`;
  }).join('');
  const foot = calc.perRound.map((r) => `<td>${num(r.got)}</td>`).join('');
  return `<div class="matrix-wrap"><table class="matrix">
    <thead><tr><th scope="col" class="corner">Manm</th>${head}<th scope="col" class="sum">Total</th></tr></thead>
    <tbody>${body}</tbody><tfoot><tr><th scope="row">Kolekte</th>${foot}<td class="sum">${num(calc.collected)}</td></tr></tfoot></table></div>`;
}

function membersView(calc) {
  const list = calc.perMember.map(({ member: m, paid, owed, rest }, i) => {
    const pct = owed > 0 ? Math.min(100, Math.round((paid / owed) * 100)) : 0;
    return `<li class="member ${m.active ? '' : 'inactive'}">
      <div class="member-top"><span class="avatar">${esc(initial(m.name))}</span>
        <span class="who"><b>${esc(m.name)}</b><small>Manch ${i + 1}${m.active ? '' : ' · inaktif'}</small></span>
        <span class="amt"><b>${m.active ? (rest > 0 ? 'Rete ' + htg(rest) : 'Ajou ✓') : 'Inaktif'}</b></span></div>
      <div class="member-totals"><span>Peye <b>${htg(paid)}</b></span><span>Dwe <b>${m.active ? htg(owed) : '—'}</b></span></div>
      <div class="bar light" aria-hidden="true"><span style="width:${m.active ? pct : 0}%"></span></div></li>`;
  }).join('');
  return `<ul class="members">${list}</ul>`;
}
