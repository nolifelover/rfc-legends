import { resolveConfirmDeps } from "@/server/worldid/chain";
import { confirmMint } from "@/server/worldid/voucher";

// POST { address, dropId, txHash } -> marks the drop minted once the chain shows RareMinted for it.
export async function POST(request: Request) {
  const input = await request.json().catch(() => null);
  const outcome = await confirmMint(input, await resolveConfirmDeps());
  return Response.json(outcome.body, { status: outcome.status });
}
