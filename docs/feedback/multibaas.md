# Curvegrid MultiBaas — integration feedback

Times UTC, 2026-09-26. Everything below happened live during the hackathon.

## Status: LIVE

All five Sepolia contracts uploaded and linked with event indexing; four
saved event queries (`rfc-sold`, `rfc-rare-minted`, `rfc-attestation-recorded`,
`rfc-rooster-minted`) executing; `/api/market/sales` serves the 90/10 sale
history through MultiBaas (verified: `source: "multibaas"` returning the real
Sepolia sale, tx `0xfb5d…60f04`). Re-run setup any time:
`cd contracts && node scripts/multibaas-setup.mjs` (idempotent).

## Timeline (UTC)

- **08:5x** Start reading docs.curvegrid.com (instructed not to trust memory).
- **~09:05** API model clear: deployment URL + `Authorization: Bearer` key,
  event queries = events + fields + filters, saved and executable over REST.
- **~09:20** Integration written against the documented endpoints.
- **~17:40 (JST) / 08:40** Deployment created by the user.
- **08:55** API key issued; setup fired.
- **08:58** First indexed `Sold` event returned by `rfc-sold`.
- **~09:00** Web route flipped to live MultiBaas data. **Net: under 5 minutes
  from key to working indexed-event feed** — the setup script had already
  absorbed the schema guessing (see friction).

## What was good

- The model is clean: link a contract by address + ABI, then query decoded
  events with a saved query instead of hand-rolled log parsing.
- Auth is a plain bearer key — no signing dance.
- Once the bodies were right, everything worked first try, and the decoded,
  alias-named rows (including `triggered_at` timestamps) were directly
  renderable — no post-processing needed in the app.

## Friction (all actually hit)

1. **The per-endpoint API reference renders empty without JavaScript.**
   `docs.curvegrid.com/multibaas/api/*` pages show only "200 OK / 4XX / 5XX"
   placeholders when fetched statically, so exact request bodies had to be
   reverse-engineered from the generated SDK docs on GitHub (which were
   accurate). ~6 round trips of guess-check-fix against the live API.
2. **Undocumented schema constraints surfaced only as raw SQL errors**:
   labels must satisfy a `label_check` constraint (lowercase; our CamelCase
   labels were rejected with a Postgres error message), and `bytecode` is
   NOT NULL server-side even though the SDK marks `bin` optional.
3. **Event-query body details are stricter than the docs imply**: input
   fields need `inputIndex` (name alone is rejected), and the filter
   operator is `equal` (not `equals` — that fails as an unparseable body).
4. **Plan limit**: linking an address with `startingBlock` at our deploy
   block was rejected ("request exceeds the plan's past logs max depth
   limit"), so indexing starts at `latest` and pre-link events are served
   via direct RPC fallback.
5. **Minor:** docs URLs 404 depending on trailing path (`/docs/en/…` vs
   `/multibaas/…`); a canonical link would help search.

## Top improvement request

Publish the OpenAPI spec as a downloadable static file (or make the endpoint
pages curl-able). Every friction point above except the plan limit is a
direct consequence of the request/response schemas not being readable
without a browser.

## Minutes until first successful verify

Reading docs → first authorized API call (200 on `/api/v0/chains`): **~15
minutes** (account + key were provisioned in parallel by the user). With the
static-spec ask above it would be ~5.
