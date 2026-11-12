# Expense Tracker (with a Claude connector)

A phone-first expense tracker you install on your home screen. It also exposes a **Claude connector**: send Claude a screenshot of a receipt, bank notification or statement, and Claude reads it, picks the category and saves it to your app.

- Income & spending by month, by category, "left this month"
- Shared bills: "Ram owes you £15" / "You owe Sita £10", and settle-ups
- Your share of shared bills is what counts in your spending totals
- Duplicate screenshots are skipped automatically
- GBP (£), Europe/London dates
- Password-protected; the connector uses its own secret URL

## 1. Deploy on Vercel

1. On vercel.com, click **Add New → Project**, then import this GitHub repo. Leave the defaults and click **Deploy**. The first deploy works, but the app shows an error until steps 2 and 3 are done.
2. In the project, go to **Storage → Create Database → Neon (Postgres)**, choose the free plan and connect it to this project. This sets `DATABASE_URL` for you. The tables are created on first use.
3. Under **Settings → Environment Variables**, add:
   - `APP_PASSWORD`: the password you'll type on your phone
   - `MCP_SECRET`: a long random string, at least 16 characters (e.g. from `openssl rand -hex 24` or a password generator). Keep it private, because anyone who has it can write to your tracker.
4. Under **Deployments**, click **⋯ → Redeploy** so the new variables take effect.

## 2. Install on your phone

Open `https://<your-project>.vercel.app` and log in with `APP_PASSWORD`.

- **iPhone (Safari):** Share button → **Add to Home Screen**. A home-screen app keeps its own login, separate from Safari's, so you log in once more inside it.
- **Android (Chrome):** ⋮ menu → **Install app** / **Add to Home screen**

## 3. Connect Claude

In Claude: **Settings → Connectors → Add custom connector**

- Name: `Expense Tracker`
- URL: `https://<your-project>.vercel.app/api/mcp/<your MCP_SECRET>`

Then turn the connector on in your chat or project and send a screenshot, for example:

> "Add these" *(screenshot of Monzo/Revolut/bank app)*
> "Dinner with Ram and Sita, I paid" *(receipt)*
> "Ram paid me back £20"
> "How much did I spend on eating out this month?"

### Connector tools

| Tool | What it does |
|---|---|
| `add_transactions` | Add one or many items (from a screenshot); auto-skips exact duplicates |
| `list_transactions` | Search by month, dates, category, text, friend, amount |
| `update_transaction` / `delete_transaction` | Fix or remove an entry |
| `get_summary` | Monthly income, spending, net, per category |
| `get_friend_balances` | Who owes whom, with history |
| `record_settlement` | A friend paid you back, or you paid them back |
| `list_categories` | Standard and in-use categories |

## How shared bills work

- **I paid £60, shared with Ram & Sita:** the expense is £60, Ram and Sita each owe you £20, and your spending counts £20.
- **Ram paid £30, shared with me:** the expense is your £15 share, and you owe Ram £15.
- **Settle-ups** only change balances. They are not income or spending.

## Local development

```bash
cp .env.example .env.local   # fill in a Neon DATABASE_URL, APP_PASSWORD, MCP_SECRET
npm install
npm run dev
```

The login cookie is `secure`, so locally use `http://localhost:3000` in Chrome, which treats localhost as secure.
