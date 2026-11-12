import { ok, fail } from '@/lib/http';
import { getFriendHistory, deleteLedgerEntry } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    return ok({ entries: await getFriendHistory(req.nextUrl.searchParams.get('friend')) });
  } catch (e) {
    return fail(e, 500);
  }
}

// Undo a settlement entry (split entries are removed by editing/deleting their transaction).
export async function DELETE(req) {
  const id = req.nextUrl.searchParams.get('id');
  return (await deleteLedgerEntry(id)) ? ok({ deleted: true }) : fail(new Error('Not found'), 404);
}
