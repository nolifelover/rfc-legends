import { dailyMintLimit } from "@/server/worldid/chain";
import { loadDeployment } from "@/server/worldid/deps";

// GET -> contract addresses for the market UI. TEMPORARY: once eth-dev1 ships
// lib/contracts/addresses.ts the client can import addresses directly.
export async function GET() {
  const deployment = await loadDeployment();
  return Response.json({ deployment, dailyLimit: dailyMintLimit() });
}
