import { ok, fail } from '@/lib/http';
import { recordSettlement } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    return ok(await recordSettlement(await req.json()), 201);
  } catch (e) {
    return fail(e);
  }
}
