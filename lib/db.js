import { neon } from '@neondatabase/serverless';

let client;
let ready;

// With no real DATABASE_URL (local development), use PGlite: a full Postgres
// that runs inside Node and saves its data in the .data folder.
function databaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  if (!url || url.includes('user:pass@host')) return '';
  return url;
}

async function localClient() {
  if (!globalThis.__etPglite) {
    globalThis.__etPglite = (async () => {
      let PGlite;
      try {
        ({ PGlite } = await import('@electric-sql/pglite'));
      } catch {
        throw new Error('No DATABASE_URL set and the local database is not installed. Run: npm install');
      }
      const path = await import('node:path');
      const db = new PGlite(path.join(process.cwd(), '.data', 'pglite'));
      await db.waitReady;
      return { query: async (text, params = []) => (await db.query(text, params)).rows };
    })().catch((e) => {
      globalThis.__etPglite = undefined;
      throw e;
    });
  }
  return globalThis.__etPglite;
}

async function getClient() {
  if (!client) {
    const url = databaseUrl();
    if (!url) {
      if (process.env.VERCEL) throw new Error('DATABASE_URL is not set. Connect a Neon database to this Vercel project.');
      return localClient();
    }
    client = neon(url);
  }
  return client;
}

// Creates the tables the first time the app talks to the database.
async function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const sql = await getClient();
      await sql.query(`CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
        category TEXT NOT NULL DEFAULT 'Other',
        description TEXT NOT NULL DEFAULT '',
        merchant TEXT,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_method TEXT,
        notes TEXT,
        source TEXT NOT NULL DEFAULT 'app',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await sql.query(`CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions (date)`);
      // Friends ledger. Positive amount = friend owes me, negative = I owe friend.
      await sql.query(`CREATE TABLE IF NOT EXISTS ledger (
        id SERIAL PRIMARY KEY,
        friend TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('split', 'settlement')),
        transaction_id INT REFERENCES transactions(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await sql.query(`CREATE INDEX IF NOT EXISTS ledger_tx_idx ON ledger (transaction_id)`);
      // Line items from a bill, e.g. [{"name":"Whole Chicken","price":4.69,"qty":1}]
      await sql.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS items JSONB`);
      // Saved friends, so they can be picked with one tap.
      await sql.query(`CREATE TABLE IF NOT EXISTS friends (
        name TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    })().catch((e) => {
      ready = undefined;
      throw e;
    });
  }
  return ready;
}

export async function q(text, params = []) {
  await ensureSchema();
  return (await getClient()).query(text, params);
}
