import { q as dbQuery } from './db.js';

let q = dbQuery;
// Lets tests swap the database for a fake one.
export function _setQuery(fn) {
  q = fn;
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function todayLondon() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
}

export function currentMonth() {
  return todayLondon().slice(0, 7);
}

export function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) month = currentMonth();
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { month, start: `${month}-01`, end: `${next}-01` };
}

export function normalizeFriend(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Works out what to store for a shared bill.
 * split = { with: ['Ram', 'Sita'], paid_by: 'me' | 'Ram', shares?: { Ram: 10 }, my_share?: number }
 * total = the full bill amount.
 * Returns { txAmount, entries: [{ friend, amount }] } where amount > 0 means friend owes me.
 */
export function computeSplit(total, split) {
  total = round2(total);
  if (!split) return { txAmount: total, entries: [] };
  const friends = [...new Set((split.with || []).map(normalizeFriend).filter(Boolean))];
  const paidByRaw = String(split.paid_by || 'me').trim();
  const paidByMe = !paidByRaw || /^(me|i|myself|self)$/i.test(paidByRaw);
  const paidBy = paidByMe ? 'me' : normalizeFriend(paidByRaw);
  if (!paidByMe && !friends.includes(paidBy)) friends.push(paidBy);
  if (friends.length === 0) return { txAmount: total, entries: [] };

  const shares = {};
  const custom = split.shares && Object.keys(split.shares).length > 0;
  if (custom) {
    for (const [k, v] of Object.entries(split.shares)) shares[normalizeFriend(k)] = round2(v);
    for (const f of friends) if (shares[f] === undefined) shares[f] = 0;
  }
  let myShare;
  if (split.my_share !== undefined && split.my_share !== null) myShare = round2(split.my_share);
  else if (custom) myShare = round2(total - friends.reduce((s, f) => s + shares[f], 0));
  else {
    const per = Math.floor((total / (friends.length + 1)) * 100) / 100;
    for (const f of friends) shares[f] = per;
    myShare = round2(total - per * friends.length); // I absorb rounding pennies
  }
  if (myShare < 0) throw new Error('Split shares add up to more than the total.');

  if (paidByMe) {
    return {
      txAmount: total,
      entries: friends.filter((f) => shares[f] > 0).map((f) => ({ friend: f, amount: shares[f] })),
    };
  }
  // A friend paid: my cost is only my share, and I owe that friend my share.
  return { txAmount: myShare, entries: myShare > 0 ? [{ friend: paidBy, amount: -myShare }] : [] };
}

function cleanLineItems(list) {
  if (!Array.isArray(list)) return null;
  const out = list
    .map((it) => ({
      name: String(it?.name || '').trim(),
      price: round2(Number(it?.price) || 0),
      qty: Number(it?.qty) > 0 ? Number(it.qty) : 1,
    }))
    .filter((it) => it.name || it.price);
  return out.length ? out : null;
}

function cleanItem(raw) {
  const type = raw.type === 'income' ? 'income' : 'expense';
  const items = cleanLineItems(raw.items);
  let amount = raw.amount === undefined || raw.amount === null || raw.amount === '' ? NaN : Number(raw.amount);
  if (!Number.isFinite(amount) && items) amount = items.reduce((s, it) => s + it.price, 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid amount: ${raw.amount}`);
  const date = raw.date ? String(raw.date).slice(0, 10) : todayLondon();
  if (!isDate(date)) throw new Error(`Invalid date (use YYYY-MM-DD): ${raw.date}`);
  return {
    type,
    amount: round2(amount),
    category: String(raw.category || (type === 'income' ? 'Other Income' : 'Other')).trim(),
    description: String(raw.description || raw.merchant || '').trim(),
    merchant: raw.merchant ? String(raw.merchant).trim() : null,
    date,
    payment_method: raw.payment_method ? String(raw.payment_method).trim() : null,
    notes: raw.notes ? String(raw.notes).trim() : null,
    split: raw.split && Array.isArray(raw.split.with) && raw.split.with.length ? raw.split : null,
    items,
  };
}

const TX_SELECT = `SELECT t.id, t.type, t.amount::float8 AS amount, t.category, t.description, t.merchant,
  to_char(t.date, 'YYYY-MM-DD') AS date, t.payment_method, t.notes, t.source, COALESCE(t.items, '[]'::jsonb) AS items,
  COALESCE((SELECT json_agg(json_build_object('id', l.id, 'friend', l.friend, 'amount', l.amount::float8) ORDER BY l.id)
            FROM ledger l WHERE l.transaction_id = t.id), '[]'::json) AS splits
  FROM transactions t`;

function withMyShare(row) {
  const splits = Array.isArray(row.splits) ? row.splits : [];
  if (!Array.isArray(row.items)) row = { ...row, items: [] };
  const owedToMe = splits.filter((s) => s.amount > 0).reduce((s, x) => s + x.amount, 0);
  return { ...row, splits, my_share: row.type === 'expense' ? round2(row.amount - owedToMe) : row.amount };
}

export async function getTransaction(id) {
  const rows = await q(`${TX_SELECT} WHERE t.id = $1`, [Number(id)]);
  return rows[0] ? withMyShare(rows[0]) : null;
}

export async function listTransactions(opts = {}) {
  const where = [];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replace('?', `$${params.length}`));
  };
  if (opts.month) {
    const r = monthRange(opts.month);
    add('t.date >= ?', r.start);
    add('t.date < ?', r.end);
  }
  if (opts.from && isDate(opts.from)) add('t.date >= ?', opts.from);
  if (opts.to && isDate(opts.to)) add('t.date <= ?', opts.to);
  if (opts.type === 'income' || opts.type === 'expense') add('t.type = ?', opts.type);
  if (opts.category) add('lower(t.category) = lower(?)', opts.category);
  if (opts.min_amount !== undefined && opts.min_amount !== null) add('t.amount >= ?', Number(opts.min_amount));
  if (opts.max_amount !== undefined && opts.max_amount !== null) add('t.amount <= ?', Number(opts.max_amount));
  if (opts.search) {
    params.push(`%${opts.search}%`);
    const p = `$${params.length}`;
    where.push(`(t.description ILIKE ${p} OR t.merchant ILIKE ${p} OR t.notes ILIKE ${p} OR t.category ILIKE ${p})`);
  }
  if (opts.friend) add('EXISTS (SELECT 1 FROM ledger l WHERE l.transaction_id = t.id AND lower(l.friend) = lower(?))', normalizeFriend(opts.friend));
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  const sql = `${TX_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.date DESC, t.id DESC LIMIT ${limit}`;
  const rows = await q(sql, params);
  return rows.map(withMyShare);
}

async function insertSplits(txId, date, entries, note) {
  await saveFriends(entries.map((e) => e.friend));
  for (const e of entries) {
    await q(`INSERT INTO ledger (friend, amount, kind, transaction_id, date, note) VALUES ($1, $2, 'split', $3, $4, $5)`, [
      e.friend,
      e.amount,
      txId,
      date,
      note || null,
    ]);
  }
}

/** Adds one or more transactions. Exact duplicates are skipped unless allowDuplicate is true. */
export async function addTransactions(items, { source = 'app', allowDuplicate = false } = {}) {
  const added = [];
  const skipped = [];
  for (const raw of items) {
    let item;
    try {
      item = cleanItem(raw);
      const { txAmount, entries } = computeSplit(item.amount, item.split);
      if (!allowDuplicate && !raw.allow_duplicate) {
        const dup = await q(
          `SELECT id FROM transactions WHERE type = $1 AND amount = $2 AND date = $3
             AND (lower(description) = lower($4) OR ($5::text IS NOT NULL AND lower(coalesce(merchant, '')) = lower($5::text)))
           LIMIT 1`,
          [item.type, txAmount, item.date, item.description, item.merchant]
        );
        if (dup.length) {
          skipped.push({ reason: 'duplicate', existing_id: dup[0].id, item: raw });
          continue;
        }
      }
      const rows = await q(
        `INSERT INTO transactions (type, amount, category, description, merchant, date, payment_method, notes, source, items)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) RETURNING id`,
        [item.type, txAmount, item.category, item.description, item.merchant, item.date, item.payment_method, item.notes, source,
          item.items ? JSON.stringify(item.items) : null]
      );
      const id = rows[0].id;
      await insertSplits(id, item.date, entries, item.description);
      added.push(await getTransaction(id));
    } catch (e) {
      skipped.push({ reason: e.message, item: raw });
    }
  }
  return { added, skipped };
}

export async function updateTransaction(id, fields) {
  const current = await getTransaction(id);
  if (!current) throw new Error(`Transaction ${id} not found`);
  const base = { ...current };
  // If new items come in without an amount, let the amount follow the items.
  if (fields.items && (fields.amount === undefined || fields.amount === '')) delete base.amount;
  const merged = cleanItem({ ...base, ...fields, split: fields.split || null });
  let amount = merged.amount;
  if (fields.split) {
    const { txAmount, entries } = computeSplit(merged.amount, fields.split);
    amount = txAmount;
    await q(`DELETE FROM ledger WHERE transaction_id = $1`, [Number(id)]);
    await insertSplits(Number(id), merged.date, entries, merged.description);
  } else if (fields.remove_split) {
    await q(`DELETE FROM ledger WHERE transaction_id = $1`, [Number(id)]);
  } else if (fields.date) {
    await q(`UPDATE ledger SET date = $2 WHERE transaction_id = $1`, [Number(id), merged.date]);
  }
  await q(
    `UPDATE transactions SET type = $2, amount = $3, category = $4, description = $5, merchant = $6, date = $7,
       payment_method = $8, notes = $9, items = $10::jsonb WHERE id = $1`,
    [Number(id), merged.type, amount, merged.category, merged.description, merged.merchant, merged.date, merged.payment_method, merged.notes,
      merged.items ? JSON.stringify(merged.items) : null]
  );
  return getTransaction(id);
}

export async function deleteTransaction(id) {
  const rows = await q(`DELETE FROM transactions WHERE id = $1 RETURNING id`, [Number(id)]);
  return rows.length > 0;
}

export async function getSummary(month) {
  const r = monthRange(month);
  const rows = await q(
    `SELECT t.type, t.category, COUNT(*)::int AS count,
       SUM(t.amount - CASE WHEN t.type = 'expense' THEN COALESCE(
         (SELECT SUM(l.amount) FROM ledger l WHERE l.transaction_id = t.id AND l.amount > 0), 0) ELSE 0 END)::float8 AS total
     FROM transactions t WHERE t.date >= $1 AND t.date < $2
     GROUP BY t.type, t.category ORDER BY total DESC`,
    [r.start, r.end]
  );
  const expenses = rows.filter((x) => x.type === 'expense').map((x) => ({ category: x.category, total: round2(x.total), count: x.count }));
  const income = rows.filter((x) => x.type === 'income').map((x) => ({ category: x.category, total: round2(x.total), count: x.count }));
  const totalExpense = round2(expenses.reduce((s, x) => s + x.total, 0));
  const totalIncome = round2(income.reduce((s, x) => s + x.total, 0));
  return {
    month: r.month,
    total_income: totalIncome,
    total_expense: totalExpense,
    net: round2(totalIncome - totalExpense),
    expenses_by_category: expenses,
    income_by_category: income,
    note: 'Expense totals use your own share of shared bills.',
  };
}

/** Saves friend names so they show up as one-tap choices. */
export async function saveFriends(names) {
  for (const n of names.map(normalizeFriend).filter(Boolean)) {
    await q(`INSERT INTO friends (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [n]);
  }
}

export async function addFriend(name) {
  const n = normalizeFriend(name);
  if (!n) throw new Error('Friend name is required');
  await saveFriends([n]);
  return n;
}

/** Removes a saved friend. Only allowed when you are settled up. */
export async function removeFriend(name) {
  const n = normalizeFriend(name);
  const b = (await getBalances()).find((x) => x.friend.toLowerCase() === n.toLowerCase());
  if (b && b.balance !== 0) throw new Error(`Settle up with ${n} first (${b.status}).`);
  await q(`DELETE FROM friends WHERE lower(name) = lower($1)`, [n]);
  return true;
}

export async function getBalances() {
  const rows = await q(
    `SELECT n.friend, COALESCE(SUM(l.amount), 0)::float8 AS balance, COUNT(l.id)::int AS entries,
       to_char(MAX(l.date), 'YYYY-MM-DD') AS last_activity
     FROM (SELECT name AS friend FROM friends UNION SELECT friend FROM ledger) n
     LEFT JOIN ledger l ON l.friend = n.friend
     GROUP BY n.friend ORDER BY ABS(COALESCE(SUM(l.amount), 0)) DESC, n.friend`
  );
  return rows.map((r) => {
    const b = round2(r.balance);
    return {
      friend: r.friend,
      balance: b,
      status: b > 0 ? `${r.friend} owes you £${b.toFixed(2)}` : b < 0 ? `You owe ${r.friend} £${(-b).toFixed(2)}` : 'Settled up',
      entries: r.entries,
      last_activity: r.last_activity,
    };
  });
}

export async function getFriendHistory(friend) {
  return q(
    `SELECT l.id, l.amount::float8 AS amount, l.kind, l.transaction_id, to_char(l.date, 'YYYY-MM-DD') AS date, l.note,
       t.description, t.category, t.amount::float8 AS transaction_amount
     FROM ledger l LEFT JOIN transactions t ON t.id = l.transaction_id
     WHERE lower(l.friend) = lower($1) ORDER BY l.date DESC, l.id DESC LIMIT 200`,
    [normalizeFriend(friend)]
  );
}

/** direction: 'they_paid_me' (friend paid me back) or 'i_paid_them' (I paid friend back). */
export async function recordSettlement({ friend, amount, direction, date, note }) {
  const f = normalizeFriend(friend);
  if (!f) throw new Error('Friend name is required');
  const a = round2(amount);
  if (!(a > 0)) throw new Error('Amount must be more than 0');
  const d = date && isDate(date) ? date : todayLondon();
  const signed = direction === 'i_paid_them' ? a : -a;
  await q(`INSERT INTO ledger (friend, amount, kind, date, note) VALUES ($1, $2, 'settlement', $3, $4)`, [
    f,
    signed,
    d,
    note || (direction === 'i_paid_them' ? `Paid ${f} back` : `${f} paid me back`),
  ]);
  const balances = await getBalances();
  return balances.find((b) => b.friend.toLowerCase() === f.toLowerCase()) || { friend: f, balance: 0, status: 'Settled up' };
}

export async function deleteLedgerEntry(id) {
  const rows = await q(`DELETE FROM ledger WHERE id = $1 AND kind = 'settlement' RETURNING id`, [Number(id)]);
  return rows.length > 0;
}

export async function listCategoriesInUse() {
  return q(`SELECT type, category, COUNT(*)::int AS count FROM transactions GROUP BY type, category ORDER BY count DESC`);
}
