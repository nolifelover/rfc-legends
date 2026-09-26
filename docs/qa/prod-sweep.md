# Q1 — judge-eye QA sweep of https://rfclegends.rfcclub.app

Headless Chromium (Playwright), 2026-09-26. Matrix: 1920×1080 and 390×844 × wallet off / wallet on (injected EIP-1193 stub on chain 11155111). Pages: `/`, `/game`, `/roosters`, `/roosters/4`, `/roosters/theprawang.rfclegends.eth`, `/market`. Raw data + screenshots: `~/qa-sweep/sweep.json`, `~/qa-sweep/shots/`.

## Verdict

**Shippable.** All 6 pages × 4 contexts return 200, loads 0.2–1.5 s, zero console errors, zero broken images, zero horizontal overflow on mobile, and no dead buttons confirmed. One real gap: **social-preview metadata is missing** (hurts the ETHGlobal link card). Everything else is informational.

## Issues

| # | Page / scope | Issue | Severity | Owner (interfaces.md §1) | Status |
|---|---|---|---|---|---|
| 1 | all pages (`<head>`) | **No `og:title`, `og:description`, `og:image`, `twitter:card`.** `title` + `description` exist, so the fix is one `metadata.openGraph`/`metadata.twitter` block in the root layout. Link previews on the ETHGlobal page will render text-only. `og:image` needs a 1200×630 asset — existing art under `apps/web/public/assets/` can be cropped. | **Medium** | eth-dev2 (`apps/web/src/app/layout.tsx`); og:image asset possibly manager | open |
| 2 | `/roosters*` | Next.js client prefetches (`?_rsc=…`) appear as `net::ERR_ABORTED` in the network panel when navigating mid-prefetch. Benign framework behavior, but a judge with devtools open may read it as errors. No action unless we want to disable prefetch on those links. | Info | eth-dev3 (`apps/web/src/app/roosters/**`) | open (optional) |
| 3 | `/roosters/4`, `/roosters/[name]` | "copy" button (copies the ENS name) flagged by the headless heuristic; clipboard is unavailable headless, so this is expected — works in real browsers. Verify once manually. | Low | eth-dev3 | verify only |
| 4 | `/` no-wallet | "Connect wallet" click opened a menu (verified by pixel diff + "wallet" text; the modal markup isn't a standard `[role=dialog]` so automated probes miss it). Not dead. | None | — | closed |
| 5 | `/game` wallet-on | Sire-line selector buttons (คิงคอง/เจ้าขุนทอง/เทพบุตร/แร๊พเตอร์) show no text change on click — selection likely visual-only (highlight). Confirm the selected state is visible to a cold user. | Low | eth-dev2 (`apps/web/src/game/**`) | verify only |
| 6 | site-wide copy | Mixed Thai/English UI: sire-line names, bird names, demo badge (`อัตราเร่งสำหรับสาธิต`), market title (`ตลาดของหายาก`) are Thai; navigation/CTAs are English. This is the intended Thai-themed voice per the GDD — noted so nobody "fixes" it away. The **demo-mode badge IS visible on every page ✓** (hard rule satisfied). | Info | — (product decision) | closed |

## Checks that passed

- All 6 pages × (desktop/mobile) × (wallet on/off): **200**, no page slower than 1.5 s to load event.
- Zero console errors (React/network) after 2.5 s settle, all contexts.
- Zero broken images / sprites (`naturalWidth === 0` scan).
- Zero horizontal overflow at 390 px on every page.
- Metadata routes: `/api/items/1001` 200 (OpenSea-style JSON), `/api/roosters/4` 200, `/api/market/sales` returns `source: "multibaas"` with live Sepolia data.
- No untrue claims spotted in visible UI copy; demo badge present; rooster pages label sample data.

## Suggested owner actions

1. **eth-dev2**: add `openGraph` + `twitter` metadata (title, description, `summary_large_image`, og:image 1200×630) to `apps/web/src/app/layout.tsx`. Highest value per minute on this list.
2. **eth-dev3** (optional): consider `prefetch={false}` on roosters index links if the `_rsc` abort noise bothers anyone; verify the copy button manually.
3. **eth-dev2**: confirm the sire-line selected state is visibly distinct.
