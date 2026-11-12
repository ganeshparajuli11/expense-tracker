import { ok, fail } from '@/lib/http';
import { getTransaction, updateTransaction, deleteTransaction } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const { id } = await params;
  const tx = await getTransaction(id);
  return tx ? ok(tx) : fail(new Error('Not found'), 404);
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    return ok(await updateTransaction(id, await req.json()));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  return (await deleteTransaction(id)) ? ok({ deleted: true }) : fail(new Error('Not found'), 404);
}
