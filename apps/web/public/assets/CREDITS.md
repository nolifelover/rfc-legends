# Art credits

All sprites, monster art, scene layers, props and item icons under
`apps/web/public/assets/` are **original works hand-authored as SVG during
ETHGlobal Tokyo 2026** for the RFC Legends vertical slice. No third-party asset
packs were used, traced or embedded.

- **Palette source:** project brand tokens defined in
  `apps/web/src/app/globals.css` (`--field`, `--field-deep`, `--sun`,
  `--sun-soft`, `--clay`, `--clay-deep`, `--cream`, `--bark`, `--bark-soft`),
  extended with rice-field greens (young rice `#7CB342`, deep paddy
  `#33691E`/`#3E6130`) and a single shared ink outline (`#2B1B12`) used on
  every character, monster and prop so the cast reads as one family.
- **Style inspiration:** the cute, flat, outline-based look popularized by CC0
  game-asset creators such as Kenney (kenney.nl). Only the general aesthetic was
  referenced for inspiration — no Kenney (or any other) asset was copied,
  traced, derived from or embedded. Every path in this directory was drawn from
  scratch for this project.
- **Format:** all files are plain vector SVG with honest viewBoxes, transparent
  backgrounds (except the full-bleed scene layers `sky/paddy/ground/hills`),
  no embedded raster data and no external references.
- **Card rarity gem code:** the corner gems on framed cards encode rarity —
  violet `#7C4DBE` = Monster Card (1001-1003), gold `#FFD766` = Legendary
  trim (2001-2003), red `#D14B3D` = MVP (3001). Same code across the family.
- **Cloud variants:** `scene/cloud1.svg` (puffy cumulus), `scene/cloud2.svg`
  (long stratus for wide parallax drift), `scene/cloud3.svg` (tall cotton
  cluster) are standalone transparent clouds for the engine lane; `sky.svg`
  keeps its own embedded clouds for the static backdrop.
