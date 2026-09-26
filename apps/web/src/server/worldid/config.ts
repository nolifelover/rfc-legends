// World ID server configuration. Everything the verifier trusts (action,
// environment, RP id) comes from here, never from the request body.

export type WorldIdConfig = {
  appId: `app_${string}`;
  action: string;
  rpId: string;
  signingKey: string;
  environment: "production" | "staging";
  allowLegacyProofs: boolean;
  verifyBaseUrl: string;
  stagingToken?: string;
  /** Lifetime of an issued RP signature / nonce, in seconds. */
  nonceTtlSeconds: number;
};

export class WorldIdConfigError extends Error {}

export function loadWorldIdConfig(env: NodeJS.ProcessEnv = process.env): WorldIdConfig {
  const missing: string[] = [];
  const appId = env.NEXT_PUBLIC_WORLD_APP_ID?.trim();
  const action = env.NEXT_PUBLIC_WORLD_ACTION?.trim();
  const rpId = env.WORLD_RP_ID?.trim();
  const signingKey = env.WORLD_RP_SIGNING_KEY?.trim();
  if (!appId) missing.push("NEXT_PUBLIC_WORLD_APP_ID");
  if (!action) missing.push("NEXT_PUBLIC_WORLD_ACTION");
  if (!rpId) missing.push("WORLD_RP_ID");
  if (!signingKey) missing.push("WORLD_RP_SIGNING_KEY");
  if (missing.length > 0) {
    throw new WorldIdConfigError(`World ID is not configured: set ${missing.join(", ")}`);
  }
  if (!appId!.startsWith("app_")) {
    throw new WorldIdConfigError("NEXT_PUBLIC_WORLD_APP_ID must start with app_");
  }

  const environment = env.WORLD_ENVIRONMENT?.trim() === "staging" ? "staging" : "production";
  return {
    appId: appId as `app_${string}`,
    action: action!,
    rpId: rpId!,
    signingKey: signingKey!,
    environment,
    allowLegacyProofs: env.WORLD_ALLOW_LEGACY_PROOFS?.trim() === "true",
    verifyBaseUrl: (env.WORLD_VERIFY_BASE_URL?.trim() || "https://developer.world.org").replace(/\/+$/, ""),
    stagingToken: env.WORLD_STAGING_VERIFICATION_TOKEN?.trim() || undefined,
    nonceTtlSeconds: 600,
  };
}
