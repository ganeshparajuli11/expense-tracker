import { ok, fail } from '@/lib/http';
import { getSummary } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    return ok(await getSummary(req.nextUrl.searchParams.get('month')));
  } catch (e) {
    return fail(e, 500);
  }
}
