import { resolveVoucherDeps } from "@/server/worldid/chain";
import { issueMintVoucher } from "@/server/worldid/voucher";

// POST { address, dropId } -> 200 { ok, voucher, signature } | 403 { ok: false, code, reason }
// Checks: verified human -> Base Lv >= 30 -> drop owned/unminted/mintable -> daily limit.
export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const outcome = await issueMintVoucher(input, await resolveVoucherDeps());
  if (!outcome.body.ok) console.warn("[voucher] rejected", outcome.body.code, outcome.body.reason);
  return Response.json(outcome.body, { status: outcome.status });
}
