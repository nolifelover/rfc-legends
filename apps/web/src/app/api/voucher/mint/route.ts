import { resolveVoucherDeps } from "@/server/worldid/chain";
import { WorldIdConfigError } from "@/server/worldid/config";
import { issueMintVoucher } from "@/server/worldid/voucher";

// POST { address, dropId, ownership } -> 200 { ok, voucher, signature } | 401/403 { ok: false, code, reason }
// Wallet signature first, then: verified human -> Base Lv >= 30 -> drop owned/unminted/mintable -> daily limit.
export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  let deps;
  try {
    deps = await resolveVoucherDeps();
  } catch (err) {
    if (!(err instanceof WorldIdConfigError)) throw err;
    return Response.json({ ok: false, code: "not_configured", reason: err.message }, { status: 503 });
  }
  const outcome = await issueMintVoucher(input, deps);
  if (!outcome.body.ok) console.warn("[voucher] rejected", outcome.body.code, outcome.body.reason);
  return Response.json(outcome.body, { status: outcome.status });
}
