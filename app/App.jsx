'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, categoryEmoji } from '@/lib/categories';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const money = (n) => gbp.format(Number(n) || 0);

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
}
function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function dayLabel(date) {
  const t = today();
  if (date === t) return 'Today';
  const y = new Date(Date.parse(t) - 86400000).toISOString().slice(0, 10);
  if (date === y) return 'Yesterday';
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Not logged in');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [version, setVersion] = useState(0);
  const [sheet, setSheet] = useState(null); // null | { mode: 'add' } | { mode: 'edit', tx }
  const [friends, setFriends] = useState([]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  // Reload when coming back to the app (e.g. after Claude added something).
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  useEffect(() => {
    api('/api/friends')
      .then((d) => setFriends(d.balances))
      .catch(() => {});
  }, [version]);

  return (
    <div className="app">
      <main className="content">
        {tab === 'home' && <Home month={month} setMonth={setMonth} version={version} onOpen={(tx) => setSheet({ mode: 'edit', tx })} onAll={() => setTab('history')} />}
        {tab === 'history' && <History month={month} setMonth={setMonth} version={version} onOpen={(tx) => setSheet({ mode: 'edit', tx })} />}
        {tab === 'friends' && <Friends balances={friends} setBalances={setFriends} refresh={refresh} version={version} onOpen={(tx) => setSheet({ mode: 'edit', tx })} />}
      </main>

      <nav className="tabbar">
        <div className="tabbar-glass">
          <TabButton icon={<IconHome />} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
          <TabButton icon={<IconHistory />} label="History" active={tab === 'history'} onClick={() => setTab('history')} />
          <button className="fab" aria-label="Add" onClick={() => setSheet({ mode: 'add' })}>
            <IconPlus />
          </button>
          <TabButton icon={<IconFriends />} label="Friends" active={tab === 'friends'} onClick={() => setTab('friends')} />
          <TabButton icon={<IconRefresh />} label="Refresh" onClick={refresh} />
        </div>
      </nav>

      {sheet && (
        <TxSheet
          sheet={sheet}
          friendNames={friends.map((f) => f.friend)}
          onFriendAdded={setFriends}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function TabButton({ icon, label, active, onClick }) {
  return (
    <button className={`tab ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="tab-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Line icons in the style of iOS SF Symbols.
function Svg({ children, size = 24, stroke = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function IconHome() {
  return (
    <Svg>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v10a1.5 1.5 0 0 0 1.5 1.5h3.5v-5.5h3v5.5H17a1.5 1.5 0 0 0 1.5-1.5V9" />
    </Svg>
  );
}
function IconHistory() {
  return (
    <Svg>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4v4h4" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}
function IconFriends() {
  return (
    <Svg>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4" />
      <path d="M18 14.4c2.1.8 3.5 2.8 3.5 5.6" />
    </Svg>
  );
}
function IconRefresh() {
  return (
    <Svg>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </Svg>
  );
}
function IconPlus() {
  return (
    <Svg size={26} stroke={2.6}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

function MonthSwitcher({ month, setMonth }) {
  const isCurrent = month === today().slice(0, 7);
  return (
    <div className="month">
      <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
        ‹
      </button>
      <span>{monthLabel(month)}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} aria-label="Next month">
        ›
      </button>
    </div>
  );
}

function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => alive && setState({ loading: false, data, error: '' }))
      .catch((e) => alive && setState({ loading: false, data: null, error: e.message }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Home({ month, setMonth, version, onOpen, onAll }) {
  const summary = useLoad(() => api(`/api/summary?month=${month}`), [month, version]);
  const recent = useLoad(() => api(`/api/transactions?month=${month}&limit=8`), [month, version]);
  const s = summary.data;
  const max = s ? Math.max(1, ...s.expenses_by_category.map((c) => c.total)) : 1;

  return (
    <>
      <header className="top">
        <h1>Expenses</h1>
        <MonthSwitcher month={month} setMonth={setMonth} />
      </header>
      {summary.error && <p className="error card">{summary.error}</p>}
      <section className="stats">
        <div className="card stat">
          <span>Income</span>
          <strong className="pos">{s ? money(s.total_income) : '—'}</strong>
        </div>
        <div className="card stat">
          <span>Spent</span>
          <strong className="neg">{s ? money(s.total_expense) : '—'}</strong>
        </div>
        <div className="card stat wide">
          <span>Left this month</span>
          <strong className={s && s.net < 0 ? 'neg' : 'pos'}>{s ? money(s.net) : '—'}</strong>
        </div>
      </section>

      <section className="card">
        <h2>Where it went</h2>
        {s && s.expenses_by_category.length === 0 && <p className="muted">No spending yet this month.</p>}
        {s &&
          s.expenses_by_category.map((c) => (
            <div key={c.category} className="bar-row">
              <div className="bar-label">
                <span>
                  {categoryEmoji(c.category)} {c.category}
                </span>
                <span>{money(c.total)}</span>
              </div>
              <div className="bar">
                <div style={{ width: `${(c.total / max) * 100}%` }} />
              </div>
            </div>
          ))}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Recent</h2>
          <button className="link" onClick={onAll}>
            See all
          </button>
        </div>
        <TxList items={recent.data?.transactions || []} onOpen={onOpen} empty="Nothing recorded yet. Tap + or send Claude a screenshot." />
      </section>
    </>
  );
}

function History({ month, setMonth, version, onOpen }) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const list = useLoad(() => {
    const p = new URLSearchParams({ limit: '500' });
    if (q) p.set('search', q);
    else p.set('month', month);
    if (type) p.set('type', type);
    return api(`/api/transactions?${p}`);
  }, [month, q, type, version]);

  const groups = useMemo(() => {
    const g = [];
    for (const tx of list.data?.transactions || []) {
      const last = g[g.length - 1];
      if (last && last.date === tx.date) last.items.push(tx);
      else g.push({ date: tx.date, items: [tx] });
    }
    return g;
  }, [list.data]);

  return (
    <>
      <header className="top">
        <h1>History</h1>
        {!q && <MonthSwitcher month={month} setMonth={setMonth} />}
      </header>
      <div className="filters">
        <input placeholder="Search all months…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="seg">
          {[
            ['', 'All'],
            ['expense', 'Out'],
            ['income', 'In'],
          ].map(([v, l]) => (
            <button key={v} className={type === v ? 'on' : ''} onClick={() => setType(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {list.error && <p className="error card">{list.error}</p>}
      {!list.loading && groups.length === 0 && <p className="muted center">No transactions.</p>}
      {groups.map((g) => (
        <section key={g.date} className="card">
          <h3 className="day">{dayLabel(g.date)}</h3>
          <TxList items={g.items} onOpen={onOpen} />
        </section>
      ))}
    </>
  );
}

function TxList({ items, onOpen, empty }) {
  if (!items.length) return empty ? <p className="muted">{empty}</p> : null;
  return (
    <ul className="txs">
      {items.map((tx) => (
        <li key={tx.id} onClick={() => onOpen(tx)}>
          <span className="tx-icon">{categoryEmoji(tx.category)}</span>
          <span className="tx-main">
            <span className="tx-desc">{tx.description || tx.merchant || tx.category}</span>
            <span className="tx-sub">
              {tx.category}
              {tx.items?.length > 0 && ` · ${tx.items.length} items`}
              {tx.splits.length > 0 && ` · shared with ${tx.splits.map((s) => s.friend).join(', ')}`}
              {tx.source === 'claude' && ' · ✨'}
            </span>
          </span>
          <span className="tx-amt">
            <span className={tx.type === 'income' ? 'pos' : ''}>
              {tx.type === 'income' ? '+' : '−'}
              {money(tx.amount)}
            </span>
            {tx.type === 'expense' && tx.my_share !== tx.amount && <span className="tx-sub">your share {money(tx.my_share)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Friends({ balances, setBalances, refresh, version }) {
  const [open, setOpen] = useState(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr('');
    try {
      const d = await api('/api/friends', { method: 'POST', body: { name } });
      setBalances(d.balances);
      setName('');
    } catch (x) {
      setErr(x.message);
    }
  }
  const owedToMe = balances.filter((b) => b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const iOwe = balances.filter((b) => b.balance < 0).reduce((s, b) => s - b.balance, 0);

  if (open)
    return (
      <FriendDetail
        friend={open}
        balance={balances.find((b) => b.friend === open)}
        onBack={() => setOpen(null)}
        onRemoved={(b) => {
          setBalances(b);
          setOpen(null);
        }}
        refresh={refresh}
        version={version}
      />
    );

  return (
    <>
      <header className="top">
        <h1>Friends</h1>
      </header>
      <section className="stats">
        <div className="card stat">
          <span>Owed to you</span>
          <strong className="pos">{money(owedToMe)}</strong>
        </div>
        <div className="card stat">
          <span>You owe</span>
          <strong className="neg">{money(iOwe)}</strong>
        </div>
      </section>
      <form className="card add-friend" onSubmit={add}>
        <input placeholder="Add a friend’s name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {err && <p className="error">{err}</p>}
      <section className="card">
        {balances.length === 0 && <p className="muted">No friends yet. Add one above, then pick them when you add a bill.</p>}
        <ul className="txs">
          {balances.map((b) => (
            <li key={b.friend} onClick={() => setOpen(b.friend)}>
              <span className="tx-icon avatar">{b.friend[0]}</span>
              <span className="tx-main">
                <span className="tx-desc">{b.friend}</span>
                <span className="tx-sub">{b.status}</span>
              </span>
              <span className={`tx-amt ${b.balance > 0 ? 'pos' : b.balance < 0 ? 'neg' : 'muted'}`}>{money(Math.abs(b.balance))}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function FriendDetail({ friend, balance, onBack, onRemoved, refresh, version }) {
  const hist = useLoad(() => api(`/api/friends/history?friend=${encodeURIComponent(friend)}`), [friend, version]);
  const bal = balance?.balance || 0;
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setAmount(bal ? Math.abs(bal).toFixed(2) : ''), [bal]);

  async function settle() {
    setBusy(true);
    setError('');
    try {
      await api('/api/friends/settle', {
        method: 'POST',
        body: { friend, amount: Number(amount), direction: bal >= 0 ? 'they_paid_me' : 'i_paid_them', date: today() },
      });
      refresh();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  async function removeFriend() {
    if (!confirm(`Remove ${friend} from your friends?`)) return;
    try {
      const d = await api(`/api/friends?name=${encodeURIComponent(friend)}`, { method: 'DELETE' });
      onRemoved(d.balances);
    } catch (e) {
      setError(e.message);
    }
  }
  async function undo(id) {
    if (!confirm('Remove this settlement?')) return;
    await api(`/api/friends/history?id=${id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    refresh();
  }

  return (
    <>
      <header className="top">
        <button className="link" onClick={onBack}>
          ‹ Friends
        </button>
        <h1>{friend}</h1>
        <p className={bal > 0 ? 'pos' : bal < 0 ? 'neg' : 'muted'}>{balance?.status || 'Settled up'}</p>
      </header>
      {bal !== 0 && (
        <section className="card settle">
          <h2>{bal > 0 ? `${friend} paid you back` : `You paid ${friend} back`}</h2>
          <div className="row">
            <input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="primary" disabled={busy || !(Number(amount) > 0)} onClick={settle}>
              Settle
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </section>
      )}
      <section className="card">
        <h2>History</h2>
        <ul className="txs">
          {(hist.data?.entries || []).map((e) => (
            <li key={e.id} onClick={() => e.kind === 'settlement' && undo(e.id)}>
              <span className="tx-icon">{e.kind === 'settlement' ? '🤝' : categoryEmoji(e.category)}</span>
              <span className="tx-main">
                <span className="tx-desc">{e.kind === 'settlement' ? e.note || 'Settlement' : e.description || e.category}</span>
                <span className="tx-sub">
                  {dayLabel(e.date)}
                  {e.kind === 'split' && e.transaction_amount ? ` · bill ${money(e.transaction_amount)}` : ''}
                  {e.kind === 'settlement' ? ' · tap to undo' : ''}
                </span>
              </span>
              <span className={`tx-amt ${e.amount > 0 ? 'pos' : 'neg'}`}>
                {e.kind === 'split' ? (e.amount > 0 ? 'owes you ' : 'you owe ') : ''}
                {money(Math.abs(e.amount))}
              </span>
            </li>
          ))}
        </ul>
        {!hist.loading && (hist.data?.entries || []).length === 0 && <p className="muted">Nothing shared with {friend} yet.</p>}
      </section>
      {bal === 0 && (
        <button className="danger" onClick={removeFriend}>
          Remove friend
        </button>
      )}
      {error && bal === 0 && <p className="error center">{error}</p>}
    </>
  );
}

const SHOP_CATEGORIES = [
  [/lidl|aldi|tesco|sainsbury|asda|co-?op|morrisons|iceland|waitrose|m&s|grocer|supermarket|nepali|asian/i, 'Groceries'],
  [/primark|argos|amazon|tk ?maxx|b&m|home bargains|ikea/i, 'Shopping'],
  [/boots|superdrug|pharmacy/i, 'Health'],
  [/greggs|costa|starbucks|pret|mcdonald|kfc|nando|domino|pizza|cafe|restaurant/i, 'Eating Out'],
];
const guessCategory = (shop) => SHOP_CATEGORIES.find(([re]) => re.test(shop || ''))?.[1] || '';
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

function TxSheet({ sheet, friendNames, onFriendAdded, onClose, onSaved }) {
  const editing = sheet.mode === 'edit';
  const tx = sheet.tx || {};
  const [f, setF] = useState({
    type: tx.type || 'expense',
    amount: tx.amount != null ? String(tx.amount) : '',
    merchant: tx.merchant || '',
    description: tx.merchant && tx.description === `${tx.merchant} shop` ? '' : tx.description || '',
    category: tx.category || '',
    date: tx.date || today(),
    payment_method: tx.payment_method || '',
    notes: tx.notes || '',
  });
  const [items, setItems] = useState((tx.items || []).map((it) => ({ name: it.name, price: String(it.price) })));
  const [showItems, setShowItems] = useState((tx.items || []).length > 0);
  const [showMore, setShowMore] = useState(Boolean(tx.notes || tx.payment_method));
  const hasSplit = editing && tx.splits?.length > 0;
  const [changeSharing, setChangeSharing] = useState(!editing);
  const [removeSplit, setRemoveSplit] = useState(false);
  const [paidBy, setPaidBy] = useState('me');
  const [forMe, setForMe] = useState(true);
  const [forFriends, setForFriends] = useState([]);
  const [newFriend, setNewFriend] = useState(null); // null = hidden, string = typing
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const cats = f.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isExpense = f.type === 'expense';

  // Bill items: the total follows the items.
  const itemsTotal = Math.round(items.reduce((s, it) => s + (Number(it.price) || 0), 0) * 100) / 100;
  function setItem(i, k, v) {
    const next = items.map((it, j) => (j === i ? { ...it, [k]: v } : it));
    setItems(next);
    const sum = Math.round(next.reduce((s, it) => s + (Number(it.price) || 0), 0) * 100) / 100;
    if (sum > 0) setF((x) => ({ ...x, amount: sum.toFixed(2) }));
  }
  const addItemRow = () => setItems((x) => [...x, { name: '', price: '' }]);
  function removeItemRow(i) {
    const next = items.filter((_, j) => j !== i);
    setItems(next);
    const sum = Math.round(next.reduce((s, it) => s + (Number(it.price) || 0), 0) * 100) / 100;
    if (sum > 0) setF((x) => ({ ...x, amount: sum.toFixed(2) }));
  }

  // Who paid / who it's for
  const total = Number(f.amount) || 0;
  const payerIsFriend = paidBy !== 'me';
  const people = (forMe || payerIsFriend ? 1 : 0) + forFriends.filter((n) => !sameName(n, paidBy)).length + (payerIsFriend && forFriends.some((n) => sameName(n, paidBy)) ? 1 : 0);
  const perHead = people ? Math.round((total / people) * 100) / 100 : 0;

  function toggleFor(name) {
    setForFriends((list) => (list.some((n) => sameName(n, name)) ? list.filter((n) => !sameName(n, name)) : [...list, name]));
  }
  function pickPayer(name) {
    setPaidBy(name);
    if (name !== 'me') setForMe(true);
  }

  function buildSplit() {
    if (!isExpense || !changeSharing) return null;
    if (payerIsFriend) return { with: [paidBy], paid_by: paidBy, my_share: perHead };
    const others = forFriends;
    if (!others.length) return null;
    if (forMe) return { with: others, paid_by: 'me' };
    // I paid but it was all for friends: they owe the whole amount.
    const per = Math.floor((total / others.length) * 100) / 100;
    const shares = Object.fromEntries(others.map((n, i) => [n, i === others.length - 1 ? Math.round((total - per * (others.length - 1)) * 100) / 100 : per]));
    return { with: others, paid_by: 'me', shares, my_share: 0 };
  }

  function sharingSummary() {
    if (!total) return '';
    if (payerIsFriend) {
      return people <= 1 ? `It was all for you, so you owe ${paidBy} ${money(total)}.` : `Split ${people} ways: you owe ${paidBy} ${money(perHead)}.`;
    }
    if (!forFriends.length) return 'Just for you.';
    if (!forMe) return `${forFriends.join(', ')} will owe you ${money(total)} in total.`;
    return `Split ${forFriends.length + 1} ways: ${forFriends.join(', ')} will owe you about ${money(perHead)} each.`;
  }

  async function saveNewFriend() {
    const name = (newFriend || '').trim();
    if (!name) return setNewFriend(null);
    try {
      const d = await api('/api/friends', { method: 'POST', body: { name } });
      onFriendAdded?.(d.balances);
      setForFriends((l) => (l.some((n) => sameName(n, d.name)) ? l : [...l, d.name]));
      setNewFriend(null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    const cleanItems = items.filter((it) => it.name.trim() || Number(it.price)).map((it) => ({ name: it.name.trim(), price: Number(it.price) || 0 }));
    const body = {
      ...f,
      amount: Number(f.amount),
      description: f.description.trim() || (f.merchant.trim() ? `${f.merchant.trim()} shop` : ''),
      merchant: f.merchant.trim() || null,
      category: f.category || guessCategory(f.merchant) || (isExpense ? 'Other' : 'Other Income'),
      items: cleanItems,
    };
    const split = buildSplit();
    if (split) body.split = split;
    if (removeSplit) body.remove_split = true;
    try {
      if (editing) await api(`/api/transactions/${tx.id}`, { method: 'PATCH', body });
      else await api('/api/transactions', { method: 'POST', body });
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm('Delete this?')) return;
    setBusy(true);
    try {
      await api(`/api/transactions/${tx.id}`, { method: 'DELETE' });
      onSaved();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="row-between">
          <h2>{editing ? 'Edit' : 'Add'}</h2>
          <button className="link" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="seg full">
          {['expense', 'income'].map((t) => (
            <button key={t} className={f.type === t ? 'on' : ''} onClick={() => setF((x) => ({ ...x, type: t, category: '' }))}>
              {t === 'expense' ? 'Money out' : 'Money in'}
            </button>
          ))}
        </div>

        <input
          className="big-amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="£0.00"
          value={f.amount}
          onChange={set('amount')}
          autoFocus={!editing}
        />

        {isExpense && (
          <input
            placeholder="Shop, e.g. Lidl"
            value={f.merchant}
            onChange={(e) => {
              const v = e.target.value;
              setF((x) => ({ ...x, merchant: v, category: x.category || guessCategory(v) }));
            }}
          />
        )}
        <input placeholder={isExpense ? 'What for? (optional)' : 'From? e.g. Salary'} value={f.description} onChange={set('description')} />

        {/* Bill items */}
        {isExpense && (
          <div className="group">
            <button className="group-head" onClick={() => {
                if (!showItems && !items.length) addItemRow();
                setShowItems(true);
              }}>
              <span>
                <b>Bill items</b>
                <span className="muted small">{items.length ? ` · ${items.length} items · ${money(itemsTotal)}` : ' · optional'}</span>
              </span>
              {!showItems && <span className="link">+ Add</span>}
            </button>
            {(showItems || items.length > 0) && (
              <>
                {items.map((it, i) => (
                  <div key={i} className="item-row">
                    <input placeholder="Item" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} />
                    <input className="price" type="number" inputMode="decimal" step="0.01" placeholder="£" value={it.price} onChange={(e) => setItem(i, 'price', e.target.value)} />
                    <button className="icon-btn" aria-label="Remove item" onClick={() => removeItemRow(i)}>
                      ×
                    </button>
                  </div>
                ))}
                <button className="ghost" onClick={addItemRow}>
                  + Add item
                </button>
              </>
            )}
          </div>
        )}

        {/* Who paid / who for */}
        {isExpense && hasSplit && !changeSharing && (
          <div className="group">
            <p className="small">
              {tx.splits.map((s) => `${s.friend} ${s.amount > 0 ? 'owes you' : '— you owe'} ${money(Math.abs(s.amount))}`).join(' · ')}
            </p>
            <div className="row">
              <button className="ghost" onClick={() => setChangeSharing(true)}>
                Change
              </button>
              <button className={`ghost ${removeSplit ? 'on' : ''}`} onClick={() => setRemoveSplit((v) => !v)}>
                {removeSplit ? '✓ Not shared' : 'Not shared'}
              </button>
            </div>
          </div>
        )}
        {isExpense && changeSharing && (
          <div className="group">
            {hasSplit && <p className="muted small">Type the full bill amount above.</p>}
            <b className="small">Who paid?</b>
            <div className="chips">
              <button className={`chip ${paidBy === 'me' ? 'on' : ''}`} onClick={() => pickPayer('me')}>
                Me
              </button>
              {friendNames.map((n) => (
                <button key={n} className={`chip ${paidBy === n ? 'on' : ''}`} onClick={() => pickPayer(n)}>
                  {n}
                </button>
              ))}
            </div>
            <b className="small">Who was it for?</b>
            <div className="chips">
              <button className={`chip ${forMe || payerIsFriend ? 'on' : ''}`} onClick={() => !payerIsFriend && setForMe((v) => !v)}>
                Me
              </button>
              {friendNames.map((n) => (
                <button key={n} className={`chip ${forFriends.some((x) => sameName(x, n)) ? 'on' : ''}`} onClick={() => toggleFor(n)}>
                  {n}
                </button>
              ))}
              {newFriend === null ? (
                <button className="chip add" onClick={() => setNewFriend('')}>
                  + Friend
                </button>
              ) : (
                <span className="new-friend">
                  <input
                    autoFocus
                    placeholder="Name"
                    value={newFriend}
                    onChange={(e) => setNewFriend(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveNewFriend()}
                  />
                  <button className="chip on" onClick={saveNewFriend}>
                    Save
                  </button>
                </span>
              )}
            </div>
            {total > 0 && <p className="muted small">{sharingSummary()}</p>}
          </div>
        )}

        {/* Category */}
        <div className="chips">
          {cats.map((c) => (
            <button key={c.name} className={`chip ${f.category === c.name ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, category: c.name }))}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>

        <input type="date" value={f.date} onChange={set('date')} />
        {showMore ? (
          <>
            <select value={f.payment_method} onChange={set('payment_method')}>
              <option value="">Paid with…</option>
              {PAYMENT_METHODS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <input placeholder="Notes (optional)" value={f.notes} onChange={set('notes')} />
          </>
        ) : (
          <button className="link" onClick={() => setShowMore(true)}>
            + Notes / paid with
          </button>
        )}

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || !(Number(f.amount) >= 0) || f.amount === ''} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {editing && (
          <button className="danger" disabled={busy} onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
