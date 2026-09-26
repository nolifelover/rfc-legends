// Shared server-side PocketBase client (interfaces.md §5b). Server code only: it authenticates as
// the superuser, so never import this from a client component.
import 'server-only'
import PocketBase from 'pocketbase'

const url = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090'

let client: PocketBase | null = null
let authing: Promise<void> | null = null

async function authenticate(pb: PocketBase): Promise<void> {
  const email = process.env.POCKETBASE_SUPERUSER_EMAIL
  const password = process.env.POCKETBASE_SUPERUSER_PASSWORD
  if (!email || !password) {
    throw new Error('PocketBase superuser credentials missing: set POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD')
  }
  await pb.collection('_superusers').authWithPassword(email, password)
}

/** Returns an authenticated superuser client, re-authenticating when the token has expired. */
export async function getPb(): Promise<PocketBase> {
  if (!client) {
    client = new PocketBase(url)
    client.autoCancellation(false) // concurrent server requests must not cancel each other
  }
  if (!client.authStore.isValid) {
    authing ??= authenticate(client).finally(() => {
      authing = null
    })
    await authing
  }
  return client
}

/** True when PocketBase is configured, so callers can fall back to the file store in tests and offline dev. */
export function pbConfigured(): boolean {
  return Boolean(process.env.POCKETBASE_SUPERUSER_EMAIL && process.env.POCKETBASE_SUPERUSER_PASSWORD)
}
