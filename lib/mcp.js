// Minimal MCP server (Streamable HTTP, JSON responses) for the Claude connector.
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from './categories.js';
import {
  addTransactions,
  listTransactions,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getBalances,
  getFriendHistory,
  recordSettlement,
  listCategoriesInUse,
  todayLondon,
  addFriend,
} from './data.js';

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const catList = (cats) => cats.map((c) => `${c.name} (${c.hint})`).join('; ');

const INSTRUCTIONS = `This is Ganesh's personal expense tracker. All money is GBP (£). Today's date is given by each tool result.
When the user shares a screenshot (receipt, bank/card notification, banking app list, statement, transfer confirmation):
1. Read every transaction in it: amount, date, merchant/description, money in vs money out.
2. Pick the best category yourself from the lists in add_transactions. Do not ask the user to categorise.
3. If the year is missing, assume the current year. If the date is missing, use today.
4. If the user says a bill was shared with friends, fill in "split" (who it was shared with and who paid).
For a shop receipt/bill (e.g. Lidl, Tesco): save it as ONE transaction with merchant = the shop name,
description like "Lidl shop", amount = the receipt TOTAL, date from the receipt, and "items" = every line on the bill
(name as printed but tidied, price). Ignore card numbers, auth codes and VAT lines.
Ask "who paid?" only if the user has not said; "paid by me" is the default. If a friend paid, use split.paid_by.
5. Call add_transactions once with all items. Exact duplicates are skipped automatically.
6. Reply with a short table of what was added (date, description, category, amount) and any friend balances that changed.
Transfers between the user's own accounts are not income or expenses; skip them. Money sent to family abroad is "Money Sent Home".
If an amount is in another currency, convert to GBP at a sensible rate and put the original amount in notes.`;

const splitSchema = {
  type: 'object',
  description:
    'Only for bills shared with friends. The transaction "amount" must be the FULL bill. Equal split by default; give "shares" for unequal splits.',
  properties: {
    with: { type: 'array', items: { type: 'string' }, description: 'Friend names the bill was shared with (not including me).' },
    paid_by: { type: 'string', description: '"me" if I paid the whole bill, or the friend\'s name if they paid. Default "me".' },
    shares: { type: 'object', additionalProperties: { type: 'number' }, description: 'Optional: exact amount each friend owes, e.g. {"Ram": 12.5}.' },
    my_share: { type: 'number', description: 'Optional: my own share if not an equal split.' },
  },
  required: ['with'],
};

const txProps = {
  type: { type: 'string', enum: ['expense', 'income'] },
  amount: { type: 'number', description: 'Amount in GBP, positive number.' },
  category: {
    type: 'string',
    description: `Expense categories: ${catList(EXPENSE_CATEGORIES)}. Income categories: ${catList(INCOME_CATEGORIES)}.`,
  },
  description: { type: 'string', description: 'Short readable label, e.g. "Tesco weekly shop".' },
  merchant: { type: 'string', description: 'Shop / payee / payer name as shown.' },
  date: { type: 'string', description: 'YYYY-MM-DD' },
  payment_method: { type: 'string', description: `One of: ${PAYMENT_METHODS.join(', ')}` },
  notes: { type: 'string' },
  items: {
    type: 'array',
    description: 'Line items from a bill/receipt. Store every product line.',
    items: {
      type: 'object',
      properties: { name: { type: 'string' }, price: { type: 'number', description: 'Line total in GBP' }, qty: { type: 'number' } },
      required: ['name', 'price'],
    },
  },
  split: splitSchema,
};

export const TOOLS = [
  {
    name: 'add_transactions',
    description:
      'Add one or more income/expense transactions (e.g. everything read from a screenshot). Exact duplicates (same type, amount, date and description/merchant) are skipped unless allow_duplicate is true.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { ...txProps, allow_duplicate: { type: 'boolean' } },
            required: ['type', 'category', 'description'],
          },
        },
      },
      required: ['items'],
    },
    annotations: { title: 'Add transactions', readOnlyHint: false, destructiveHint: false },
    run: async (a) => {
      const res = await addTransactions(a.items || [], { source: 'claude' });
      const touched = res.added.some((t) => t.splits.length);
      return { today: todayLondon(), ...res, ...(touched ? { friend_balances: await getBalances() } : {}) };
    },
  },
  {
    name: 'list_transactions',
    description: 'Search/list transactions. Use to check what is already recorded, find an id to edit, or answer questions.',
    inputSchema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'YYYY-MM' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
        type: { type: 'string', enum: ['expense', 'income'] },
        category: { type: 'string' },
        search: { type: 'string', description: 'Text in description, merchant, notes or category' },
        friend: { type: 'string', description: 'Only transactions shared with this friend' },
        min_amount: { type: 'number' },
        max_amount: { type: 'number' },
        limit: { type: 'number', description: 'Default 100, max 500' },
      },
    },
    annotations: { title: 'List transactions', readOnlyHint: true },
    run: async (a) => ({ today: todayLondon(), transactions: await listTransactions(a) }),
  },
  {
    name: 'update_transaction',
    description:
      'Change a transaction (fix category, amount, date, etc). To change how a shared bill is split, pass "split" again with the full bill as "amount". Pass remove_split: true to make it not shared.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'number' }, ...txProps, remove_split: { type: 'boolean' } },
      required: ['id'],
    },
    annotations: { title: 'Update transaction', readOnlyHint: false, destructiveHint: false },
    run: async ({ id, ...fields }) => ({ updated: await updateTransaction(id, fields) }),
  },
  {
    name: 'delete_transaction',
    description: 'Delete a transaction (and its friend split entries) by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] },
    annotations: { title: 'Delete transaction', readOnlyHint: false, destructiveHint: true },
    run: async ({ id }) => ({ deleted: await deleteTransaction(id), id }),
  },
  {
    name: 'get_summary',
    description: 'Monthly totals: income, spending (own share of shared bills), net, and totals per category.',
    inputSchema: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM, default current month' } } },
    annotations: { title: 'Monthly summary', readOnlyHint: true },
    run: async ({ month }) => getSummary(month),
  },
  {
    name: 'get_friend_balances',
    description: 'Who owes whom. Positive balance = friend owes me; negative = I owe the friend. Pass friend for their full history.',
    inputSchema: { type: 'object', properties: { friend: { type: 'string' } } },
    annotations: { title: 'Friend balances', readOnlyHint: true },
    run: async ({ friend }) =>
      friend ? { balances: (await getBalances()).filter((b) => b.friend.toLowerCase() === friend.trim().toLowerCase()), history: await getFriendHistory(friend) } : { balances: await getBalances() },
  },
  {
    name: 'record_settlement',
    description:
      'Record a friend paying me back (they_paid_me) or me paying a friend back (i_paid_them). This is not income or an expense; it only changes the friend balance.',
    inputSchema: {
      type: 'object',
      properties: {
        friend: { type: 'string' },
        amount: { type: 'number' },
        direction: { type: 'string', enum: ['they_paid_me', 'i_paid_them'] },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        note: { type: 'string' },
      },
      required: ['friend', 'amount', 'direction'],
    },
    annotations: { title: 'Settle up', readOnlyHint: false, destructiveHint: false },
    run: async (a) => ({ balance: await recordSettlement(a) }),
  },
  {
    name: 'add_friend',
    description: 'Save a friend\'s name so they appear as a quick choice in the app.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    annotations: { title: 'Add friend', readOnlyHint: false, destructiveHint: false },
    run: async ({ name }) => ({ saved: await addFriend(name), friends: await getBalances() }),
  },
  {
    name: 'list_categories',
    description: 'The standard categories plus any custom categories already used, with counts.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { title: 'Categories', readOnlyHint: true },
    run: async () => ({
      expense: EXPENSE_CATEGORIES.map((c) => c.name),
      income: INCOME_CATEGORIES.map((c) => c.name),
      in_use: await listCategoriesInUse(),
    }),
  },
];

const publicTools = TOOLS.map(({ run, ...t }) => t);

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

export async function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id ?? null, -32600, 'Invalid Request');
  }
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': {
      const v = SUPPORTED_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : SUPPORTED_VERSIONS[1];
      return rpcResult(id, {
        protocolVersion: v,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'expense-tracker', title: 'Expense Tracker', version: '1.0.0' },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: publicTools });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
      try {
        const out = await tool.run(params.arguments || {});
        return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return rpcResult(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }
    case 'resources/list':
      return rpcResult(id, { resources: [] });
    case 'prompts/list':
      return rpcResult(id, { prompts: [] });
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

/** Handles a POST body (single message or batch). Returns null when there is nothing to send back. */
export async function handleBody(body) {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handleMessage))).filter(Boolean);
    return out.length ? out : null;
  }
  return handleMessage(body);
}
