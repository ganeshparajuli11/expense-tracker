import { ok, fail } from '@/lib/http';
import { listTransactions, addTransactions } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const p = Object.fromEntries(req.nextUrl.searchParams);
    return ok({ transactions: await listTransactions(p) });
  } catch (e) {
    return fail(e, 500);
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const result = await addTransactions(items, { source: 'app', allowDuplicate: true });
    if (!result.added.length) return fail(new Error(result.skipped[0]?.reason || 'Nothing added'));
    return ok(result, 201);
  } catch (e) {
    return fail(e);
  }
}
