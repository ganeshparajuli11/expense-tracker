import { ok, fail } from '@/lib/http';
import { getBalances, addFriend, removeFriend } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return ok({ balances: await getBalances() });
  } catch (e) {
    return fail(e, 500);
  }
}

// Save a friend: { name: "Ram" }
export async function POST(req) {
  try {
    const { name } = await req.json();
    return ok({ name: await addFriend(name), balances: await getBalances() }, 201);
  } catch (e) {
    return fail(e);
  }
}

// Remove a saved friend: /api/friends?name=Ram
export async function DELETE(req) {
  try {
    await removeFriend(req.nextUrl.searchParams.get('name'));
    return ok({ deleted: true, balances: await getBalances() });
  } catch (e) {
    return fail(e);
  }
}
