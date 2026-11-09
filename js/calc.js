/* Kalkil: tout total yo soti isit la. Pa gen okenn kalkil nan views yo. */

export const key = (memberId, round) => `${memberId}_${round}`;
const r2 = (x) => Math.round(x * 100) / 100;

/** 'none' | 'part' | 'full' pou yon kaz peman */
export function status(amount, due) {
  if (!(amount > 0)) return 'none';
  return amount >= due ? 'full' : 'part';
}

/**
 * Règ yo:
 *  - Nonb manch = nonb manm (tout manm konte, menm inaktif, pou lòd la pa chanje).
 *  - Chak manm aktif dwe `amount` × nonb manch.
 *  - Manm inaktif: peman li yo rete konte nan "kolekte", men li pa dwe anyen ankò.
 */
export function compute(group, members, payments) {
  const n = members.length;
  const map = new Map(payments.map((p) => [p.id, p]));
  const activeCount = members.filter((m) => m.active).length;

  let collected = 0, dueActive = 0, paidActive = 0, remaining = 0;

  const perMember = members.map((member) => {
    let paid = 0;
    for (let r = 0; r < n; r++) {
      const p = map.get(key(member.id, r));
      if (p) paid += p.amount;
    }
    paid = r2(paid);
    const owed = r2(group.amount * n);
    const rest = member.active ? r2(Math.max(0, owed - paid)) : 0;
    collected += paid;
    if (member.active) {
      dueActive += owed;
      paidActive += Math.min(paid, owed);
      remaining += rest;
    }
    return { member, paid, owed, rest };
  });

  const perRound = members.map((beneficiary, round) => {
    let got = 0;
    for (const m of members) {
      const p = map.get(key(m.id, round));
      if (p) got += p.amount;
    }
    return { round, beneficiary, got: r2(got), expected: r2(group.amount * activeCount) };
  });

  return {
    n, map, perMember, perRound, activeCount,
    collected: r2(collected),
    dueActive: r2(dueActive),
    remaining: r2(remaining),
    progress: dueActive > 0 ? Math.min(1, paidActive / dueActive) : 0
  };
}
